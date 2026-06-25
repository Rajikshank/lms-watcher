import { formatDeploymentNotification, sendTelegramMessage } from "./notify/telegram.js";

const serverUrl = process.env.GITHUB_SERVER_URL ?? "https://github.com";
const repository = process.env.GITHUB_REPOSITORY;
const runId = process.env.GITHUB_RUN_ID;
const runUrl = repository && runId ? `${serverUrl}/${repository}/actions/runs/${runId}` : undefined;

await sendTelegramMessage(formatDeploymentNotification({
  sha: process.env.GITHUB_SHA,
  eventName: process.env.GITHUB_EVENT_NAME,
  runUrl
}));

console.log("Deployment notification sent.");
