import { env } from "../env.js";
import type { Change, LmsItem, LmsItemType } from "../types.js";

type DeploymentNotification = {
  sha?: string;
  eventName?: string;
  runUrl?: string;
};

export async function sendTelegramMessage(message: string): Promise<void> {
  const response = await fetch(`https://api.telegram.org/bot${env.telegramBotToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: env.telegramChatId,
      text: message.slice(0, 3900),
      disable_web_page_preview: true
    })
  });

  if (!response.ok) {
    throw new Error(`Telegram send failed: ${response.status} ${await response.text()}`);
  }
}

export async function sendTelegramPhoto(photo: Buffer, caption: string): Promise<void> {
  const form = new FormData();
  form.append("chat_id", env.telegramChatId);
  form.append("caption", caption.slice(0, 1000));
  form.append("photo", new Blob([new Uint8Array(photo)], { type: "image/png" }), "lms-item.png");

  const response = await fetch(`https://api.telegram.org/bot${env.telegramBotToken}/sendPhoto`, {
    method: "POST",
    body: form
  });

  if (!response.ok) {
    throw new Error(`Telegram photo send failed: ${response.status} ${await response.text()}`);
  }
}

export function formatDeploymentNotification(input: DeploymentNotification): string {
  const shortSha = input.sha ? input.sha.slice(0, 7) : "unknown";

  return [
    "[DEPLOYED] LMS Watcher update verified",
    "",
    `Event: ${input.eventName ?? "unknown"}`,
    `Commit: ${shortSha}`,
    input.runUrl ? `Run: ${input.runUrl}` : undefined,
    "",
    "GitHub Actions completed the watcher checks successfully."
  ].filter(Boolean).join("\n");
}

export function formatChange(change: Change): string {
  if (change.kind === "new") {
    const item = change.item;
    return [
      `[NEW] New ${displayType(item.type)}`,
      "",
      item.courseName ? `Course: ${item.courseName}` : undefined,
      `Title: ${item.title}`,
      item.dueAt ? `Due: ${formatDueAt(item.dueAt)}` : undefined,
      item.url ? `Open: ${item.url}` : undefined,
      contextLine(item)
    ].filter(Boolean).join("\n");
  }

  if (change.kind === "changed") {
    return [
      `[UPDATED] ${displayType(change.after.type)} changed`,
      "",
      change.after.courseName ? `Course: ${change.after.courseName}` : undefined,
      `Title: ${change.after.title}`,
      change.before.dueAt !== change.after.dueAt
        ? `Due changed: ${formatMaybeDueAt(change.before.dueAt)} -> ${formatMaybeDueAt(change.after.dueAt)}`
        : undefined,
      change.after.url ? `Open: ${change.after.url}` : undefined,
      contextLine(change.after)
    ].filter(Boolean).join("\n");
  }

  return [
    `[REMOVED] ${displayType(change.item.type)} removed or hidden`,
    "",
    change.item.courseName ? `Course: ${change.item.courseName}` : undefined,
    `Title: ${change.item.title}`,
    change.item.url ? `Open: ${change.item.url}` : undefined,
    contextLine(change.item)
  ].filter(Boolean).join("\n");
}

export function shouldAttachScreenshot(change: Change): boolean {
  if (change.kind === "removed") return false;
  const item = change.kind === "new" ? change.item : change.after;
  return Boolean(item.url);
}

function displayType(type: LmsItemType): string {
  const labels: Record<LmsItemType, string> = {
    calendar: "calendar event",
    assignment: "assignment",
    quiz: "quiz",
    forum: "forum",
    resource: "resource",
    course_page: "course page",
    unknown: "LMS item"
  };

  return labels[type];
}

function contextLine(item: LmsItem): string | undefined {
  if (item.type === "calendar") return "Category: calendar/deadline";
  if (item.type === "assignment") return "Category: assignment submission";
  if (item.type === "quiz") return "Category: quiz/test";
  if (item.type === "forum") return "Category: forum/discussion";
  if (item.type === "resource") return "Category: lecture/resource material";
  return undefined;
}

function formatMaybeDueAt(value: string | undefined): string {
  return value ? formatDueAt(value) : "none";
}

function formatDueAt(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-LK", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Colombo"
  }).format(date);
}
