import { env } from "./env.js";
import { diffItems } from "./diff.js";
import { formatErrorReport } from "./error-report.js";
import { getFilterSummary } from "./filter.js";
import { deliverChangeNotification, type ScreenshotFailureContext } from "./notify/change-delivery.js";
import { sendTelegramMessage, sendTelegramPhoto } from "./notify/telegram.js";
import { retry } from "./retry.js";
import { readSnapshot, writeSnapshot } from "./storage/cloudflare-kv.js";
import type { Change, LmsItem, Snapshot } from "./types.js";
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

async function run(): Promise<void> {
  const startedAt = new Date().toISOString();
  const previousSnapshot = await retry("Cloudflare snapshot read", readSnapshot);

  const [calendarItems, moodleItems] = await Promise.all([
    retry("Moodle calendar read", readCalendarItems),
    retry("Moodle browser crawl", crawlMoodleItems)
  ]);

  const currentItems = dedupeItems([...calendarItems, ...moodleItems]);
  const currentSnapshot: Snapshot = { scannedAt: startedAt, items: currentItems };

  if (!previousSnapshot) {
    await retry("Cloudflare snapshot write", () => writeSnapshot(currentSnapshot));
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
  console.log(`Scan complete. Items: ${currentItems.length}. Notified changes: ${changes.length}. ${getFilterSummary()}`);
}

const startedAt = new Date().toISOString();

run().catch(async (error) => {
  const message = formatErrorReport(error, {
    startedAt,
    failedAt: new Date().toISOString()
  });

  console.error(error);

  try {
    await sendTelegramWithRetry("Telegram error notification", message);
  } catch (telegramError) {
    console.error("Also failed to send Telegram error message:", telegramError);
  }

  process.exit(1);
});
