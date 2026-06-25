import { env } from "./env.js";
import { diffItems } from "./diff.js";
import { formatErrorReport } from "./error-report.js";
import { getFilterSummary } from "./filter.js";
import { formatChange, sendTelegramMessage } from "./notify/telegram.js";
import { retry } from "./retry.js";
import { readSnapshot, writeSnapshot } from "./storage/cloudflare-kv.js";
import type { Change, LmsItem, Snapshot } from "./types.js";
import { readCalendarItems } from "./watchers/calendar.js";
import { crawlMoodleItems } from "./watchers/moodle.js";

function dedupeItems(items: LmsItem[]): LmsItem[] {
  const map = new Map<string, LmsItem>();
  for (const item of items) map.set(item.id, item);
  return [...map.values()];
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

  if (changes.length > 0) {
    for (const change of changes.slice(0, 15)) {
      await sendTelegramWithRetry("Telegram change notification", formatChange(change));
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
