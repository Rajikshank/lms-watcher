import { env } from "./env.js";
import { diffItems } from "./diff.js";
import { formatErrorReport } from "./error-report.js";
import { getFilterSummary } from "./filter.js";
import { deliverChangeNotification, type ScreenshotFailureContext } from "./notify/change-delivery.js";
import { sendTelegramMessage, sendTelegramPhoto } from "./notify/telegram.js";
import { retry } from "./retry.js";
import {
  readScanStatus,
  readSnapshot,
  writeScanStatus,
  writeSnapshot
} from "./storage/cloudflare-kv.js";
import {
  countItemsByType,
  formatGapWarning,
  formatHealthReport,
  shouldSendGapWarning,
  shouldSendHealthReport
} from "./scan-report.js";
import type { Change, LmsItem, ScanStatus, Snapshot } from "./types.js";
import { readCalendarItems } from "./watchers/calendar.js";
import { crawlMoodleItems } from "./watchers/moodle.js";
import { captureLmsItemScreenshot } from "./watchers/screenshot.js";

function dedupeItems(items: LmsItem[]): LmsItem[] {
  const map = new Map<string, LmsItem>();
  for (const item of items) {
    const key = itemIdentityKey(item);
    if (!map.has(key)) {
      map.set(key, item);
    }
  }
  return [...map.values()];
}

function itemIdentityKey(item: LmsItem): string {
  const url = normalizeItemUrl(item.url);
  const course = item.courseId ?? item.courseName ?? "";
  const title = item.title.toLowerCase().replace(/\s+/g, " ").trim();

  return [course, item.type, url || title].join("|").toLowerCase();
}

function normalizeItemUrl(value: string | undefined): string {
  if (!value) return "";

  try {
    const url = new URL(value);
    url.hash = "";
    return `${url.origin}${url.pathname}${url.search}`;
  } catch {
    return value.split("#")[0]?.trim() ?? value;
  }
}

function filterNoisyChanges(changes: Change[]): Change[] {
  if (env.notifyRemovedItems) {
    return changes;
  }

  return changes.filter((change) => change.kind !== "removed");
}

async function sendTelegramWithRetry(label: string, message: string): Promise<void> {
  await retry(label, () => sendTelegramMessage(message));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function logScreenshotFailure(context: ScreenshotFailureContext): void {
  console.warn("Screenshot delivery failed:", {
    stage: context.stage,
    changeKind: context.changeKind,
    itemType: context.itemType,
    courseName: context.courseName,
    title: context.title,
    url: context.url,
    error: errorMessage(context.error)
  });
}

function buildScanStatus(input: {
  status: ScanStatus["status"];
  scannedAt: string;
  lastHealthNotifiedAt?: string;
  currentItems: LmsItem[];
  rawCalendarItems: number;
  rawMoodleItems: number;
  notifiedChanges: number;
  screenshotsSent: number;
  durationMs: number;
  error?: string;
}): ScanStatus {
  return {
    status: input.status,
    scannedAt: input.scannedAt,
    lastHealthNotifiedAt: input.lastHealthNotifiedAt,
    totalItems: input.currentItems.length,
    rawCalendarItems: input.rawCalendarItems,
    rawMoodleItems: input.rawMoodleItems,
    itemCounts: countItemsByType(input.currentItems),
    notifiedChanges: input.notifiedChanges,
    screenshotsSent: input.screenshotsSent,
    durationMs: input.durationMs,
    filterSummary: getFilterSummary(),
    error: input.error
  };
}

async function writeFailureStatus(error: unknown, startedAt: string, failedAt: string): Promise<void> {
  const status = buildScanStatus({
    status: "failed",
    scannedAt: failedAt,
    currentItems: [],
    rawCalendarItems: 0,
    rawMoodleItems: 0,
    notifiedChanges: 0,
    screenshotsSent: 0,
    durationMs: Date.parse(failedAt) - Date.parse(startedAt),
    error: errorMessage(error)
  });

  try {
    await retry("Cloudflare failed scan status write", () => writeScanStatus(status), {
      attempts: 1,
      delayMs: 0
    });
  } catch (statusError) {
    console.error("Failed to write failure scan status:", statusError);
  }
}

async function run(): Promise<void> {
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  const previousSnapshot = await retry("Cloudflare snapshot read", readSnapshot);
  const previousStatus = await retry("Cloudflare scan status read", readScanStatus);
  const gap = shouldSendGapWarning(previousSnapshot?.scannedAt, startedAt, env.scanGapWarnMinutes);

  if (previousSnapshot && gap.shouldSend) {
    await sendTelegramWithRetry("Telegram scan gap warning", formatGapWarning({
      previousScannedAt: previousSnapshot.scannedAt,
      currentScannedAt: startedAt,
      gapMinutes: gap.gapMinutes,
      thresholdMinutes: env.scanGapWarnMinutes
    }));
  }

  const [calendarItems, moodleItems] = await Promise.all([
    retry("Moodle calendar read", readCalendarItems),
    retry("Moodle browser crawl", crawlMoodleItems)
  ]);

  const currentItems = dedupeItems([...calendarItems, ...moodleItems]);
  const currentSnapshot: Snapshot = { scannedAt: startedAt, items: currentItems };
  const shouldSendHealth = shouldSendHealthReport(previousStatus, startedAt, env.statusNotificationHours);

  if (!previousSnapshot) {
    await retry("Cloudflare snapshot write", () => writeSnapshot(currentSnapshot));
    const status = buildScanStatus({
      status: "success",
      scannedAt: startedAt,
      lastHealthNotifiedAt: startedAt,
      currentItems,
      rawCalendarItems: calendarItems.length,
      rawMoodleItems: moodleItems.length,
      notifiedChanges: 0,
      screenshotsSent: 0,
      durationMs: Date.now() - startedMs
    });
    await retry("Cloudflare scan status write", () => writeScanStatus(status));
    await sendTelegramWithRetry("Telegram initialization message", [
      "[OK] LMS Watcher initialized",
      "",
      `Found ${currentItems.length} LMS items.`,
      getFilterSummary(),
      "No old snapshot existed, so I will start notifying from the next scan."
    ].join("\n"));
    return;
  }

  const changes = filterNoisyChanges(diffItems(previousSnapshot.items, currentItems));
  let screenshotsSent = 0;

  if (changes.length > 0) {
    for (const change of changes.slice(0, 15)) {
      const delivery = await deliverChangeNotification(change, screenshotsSent, {
        screenshotsEnabled: env.telegramScreenshots,
        maxScreenshotsPerRun: env.maxScreenshotsPerRun,
        captureScreenshot: (item) => retry("LMS item screenshot", () => captureLmsItemScreenshot(item), {
          attempts: 2,
          delayMs: 1_000
        }),
        sendText: (message) => retry("Telegram change notification", () => sendTelegramMessage(message)),
        sendPhoto: (photo, caption) => retry("Telegram screenshot notification", () => sendTelegramPhoto(photo, caption)),
        logScreenshotFailure
      });

      if (delivery.screenshotSent) {
        screenshotsSent += 1;
      }
    }

    if (changes.length > 15) {
      await sendTelegramWithRetry(
        "Telegram overflow notification",
        `[INFO] ${changes.length - 15} more LMS changes found. Check GitHub Actions logs.`
      );
    }
  }

  await retry("Cloudflare snapshot write", () => writeSnapshot(currentSnapshot));
  const status = buildScanStatus({
    status: "success",
    scannedAt: startedAt,
    lastHealthNotifiedAt: shouldSendHealth ? startedAt : previousStatus?.lastHealthNotifiedAt,
    currentItems,
    rawCalendarItems: calendarItems.length,
    rawMoodleItems: moodleItems.length,
    notifiedChanges: changes.length,
    screenshotsSent,
    durationMs: Date.now() - startedMs
  });
  await retry("Cloudflare scan status write", () => writeScanStatus(status));

  if (shouldSendHealth) {
    await sendTelegramWithRetry("Telegram health report", formatHealthReport(status));
  }

  console.log([
    `Scan complete. Items: ${currentItems.length}.`,
    `Raw Moodle items: ${moodleItems.length}.`,
    `Raw calendar items: ${calendarItems.length}.`,
    `Notified changes: ${changes.length}.`,
    `Screenshots sent: ${screenshotsSent}.`,
    getFilterSummary()
  ].join(" "));
}

const startedAt = new Date().toISOString();

run().catch(async (error) => {
  const failedAt = new Date().toISOString();
  const message = formatErrorReport(error, { startedAt, failedAt });

  console.error(error);

  try {
    await writeFailureStatus(error, startedAt, failedAt);
    await sendTelegramWithRetry("Telegram error notification", message);
  } catch (telegramError) {
    console.error("Also failed to send Telegram error message:", telegramError);
  }

  process.exit(1);
});
