import { env } from "./env.js";
import { diffItems } from "./diff.js";
import { getFilterSummary } from "./filter.js";
import { readSnapshot, writeSnapshot } from "./storage/cloudflare-kv.js";
import { formatChange, sendTelegramMessage } from "./notify/telegram.js";
import { readCalendarItems } from "./watchers/calendar.js";
import { crawlMoodleItems } from "./watchers/moodle.js";
import type { Change, LmsItem, Snapshot } from "./types.js";

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

async function run(): Promise<void> {
  const startedAt = new Date().toISOString();
  const previousSnapshot = await readSnapshot();

  const [calendarItems, moodleItems] = await Promise.all([
    readCalendarItems(),
    crawlMoodleItems()
  ]);

  const currentItems = dedupeItems([...calendarItems, ...moodleItems]);
  const currentSnapshot: Snapshot = { scannedAt: startedAt, items: currentItems };

  if (!previousSnapshot) {
    await writeSnapshot(currentSnapshot);
    await sendTelegramMessage([
      "✅ LMS Watcher initialized",
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
      await sendTelegramMessage(formatChange(change));
    }

    if (changes.length > 15) {
      await sendTelegramMessage(`⚠️ ${changes.length - 15} more LMS changes found. Check GitHub Actions logs.`);
    }
  }

  await writeSnapshot(currentSnapshot);
  console.log(`Scan complete. Items: ${currentItems.length}. Notified changes: ${changes.length}. ${getFilterSummary()}`);
}

run().catch(async (error) => {
  const message = [
    "❌ LMS Watcher failed",
    "",
    error instanceof Error ? error.message : String(error),
    "",
    `Time: ${new Date().toISOString()}`
  ].join("\n");

  console.error(error);

  try {
    await sendTelegramMessage(message);
  } catch (telegramError) {
    console.error("Also failed to send Telegram error message:", telegramError);
  }

  process.exit(1);
});
