import { crawlMoodleItems } from "./watchers/moodle.js";

const items = await crawlMoodleItems();
const counts = new Map<string, number>();

for (const item of items) {
  counts.set(item.type, (counts.get(item.type) ?? 0) + 1);
}

console.log(`Moodle crawl reachable. Filtered Moodle items: ${items.length}`);
console.log("Moodle item types:", Object.fromEntries([...counts.entries()].sort()));
