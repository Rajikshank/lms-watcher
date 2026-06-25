import { env } from "../env.js";
import type { Change } from "../types.js";

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

export function formatChange(change: Change): string {
  if (change.kind === "new") {
    const item = change.item;
    return [
      "📌 New LMS item",
      "",
      `Type: ${item.type}`,
      item.courseName ? `Course: ${item.courseName}` : undefined,
      `Title: ${item.title}`,
      item.dueAt ? `Due: ${item.dueAt}` : undefined,
      item.url ? `Link: ${item.url}` : undefined,
      `Source: ${item.source}`
    ].filter(Boolean).join("\n");
  }

  if (change.kind === "changed") {
    return [
      "⚠️ LMS item changed",
      "",
      `Type: ${change.after.type}`,
      change.after.courseName ? `Course: ${change.after.courseName}` : undefined,
      `Title: ${change.after.title}`,
      change.before.dueAt !== change.after.dueAt
        ? `Due changed: ${change.before.dueAt ?? "none"} → ${change.after.dueAt ?? "none"}`
        : undefined,
      change.after.url ? `Link: ${change.after.url}` : undefined,
      `Source: ${change.after.source}`
    ].filter(Boolean).join("\n");
  }

  return [
    "🗑️ LMS item removed or hidden",
    "",
    `Type: ${change.item.type}`,
    change.item.courseName ? `Course: ${change.item.courseName}` : undefined,
    `Title: ${change.item.title}`,
    change.item.url ? `Link: ${change.item.url}` : undefined,
    `Source: ${change.item.source}`
  ].filter(Boolean).join("\n");
}
