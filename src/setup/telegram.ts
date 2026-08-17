export function telegramBotStartUrl(botUsername: string, start = "lms_watcher_setup"): string {
  return `https://t.me/${botUsername.replace(/^@/, "")}?start=${encodeURIComponent(start)}`;
}

export function parseBotUsername(getMeResponse: unknown): string | null {
  if (
    typeof getMeResponse === "object" &&
    getMeResponse !== null &&
    "result" in getMeResponse &&
    typeof getMeResponse.result === "object" &&
    getMeResponse.result !== null &&
    "username" in getMeResponse.result &&
    typeof getMeResponse.result.username === "string"
  ) {
    return getMeResponse.result.username;
  }

  return null;
}

export function parseChatIdFromUpdates(updates: unknown): string | null {
  if (
    typeof updates !== "object" ||
    updates === null ||
    !("result" in updates) ||
    !Array.isArray(updates.result)
  ) {
    return null;
  }

  for (const update of updates.result) {
    const message = update?.message ?? update?.channel_post;
    const id = message?.chat?.id;
    if (typeof id === "number" || typeof id === "string") return String(id);
  }

  return null;
}

