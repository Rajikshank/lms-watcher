import { env } from "./env.js";
import { formatDeploymentNotification, sendTelegramMessage, sendTelegramPhoto } from "./notify/telegram.js";
import { retry } from "./retry.js";
import { crawlMoodleItems } from "./watchers/moodle.js";
import { captureLmsDashboardScreenshot } from "./watchers/screenshot.js";

const serverUrl = process.env.GITHUB_SERVER_URL ?? "https://github.com";
const repository = process.env.GITHUB_REPOSITORY;
const runId = process.env.GITHUB_RUN_ID;
const runUrl = repository && runId ? `${serverUrl}/${repository}/actions/runs/${runId}` : undefined;
const items = await retry("Deployment Moodle summary crawl", crawlMoodleItems);
const itemCounts: Record<string, number> = {};

for (const item of items) {
  itemCounts[item.type] = (itemCounts[item.type] ?? 0) + 1;
}

const watchedModules = env.watchedCourseNames.length > 0
  ? env.watchedCourseNames
  : env.watchedCourseIds.map((id) => `course id ${id}`);

let screenshot: Buffer | undefined;

try {
  screenshot = await retry("Deployment dashboard screenshot", captureLmsDashboardScreenshot, {
    attempts: 2,
    delayMs: 1_000
  });
} catch (error) {
  console.warn("Deployment screenshot skipped:", error);
}

const message = formatDeploymentNotification({
  sha: process.env.GITHUB_SHA,
  eventName: process.env.GITHUB_EVENT_NAME,
  runUrl,
  watchedModules,
  totalItems: items.length,
  itemCounts,
  screenshotAttached: Boolean(screenshot)
});

if (screenshot) {
  await sendTelegramPhoto(screenshot, message);
} else {
  await sendTelegramMessage(message);
}

console.log("Deployment notification sent.");
