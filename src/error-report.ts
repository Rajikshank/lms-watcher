type ErrorReportContext = {
  startedAt: string;
  failedAt?: string;
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function likelyCause(message: string): string {
  const lower = message.toLowerCase();

  if (lower.includes("moodle login failed")) {
    return "LMS login/session problem. Check LMS_USERNAME, LMS_PASSWORD, CAPTCHA/SSO changes, or whether LMS is down.";
  }

  if (lower.includes("cloudflare kv") || lower.includes("cloudflare snapshot")) {
    return "Cloudflare KV problem. Check account id, namespace id, API token permissions, and Cloudflare availability.";
  }

  if (lower.includes("calendar")) {
    return "Moodle calendar feed problem. Check MOODLE_CALENDAR_URL and whether the calendar export is still valid.";
  }

  if (lower.includes("telegram")) {
    return "Telegram problem. Check TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, or Telegram API availability.";
  }

  if (lower.includes("timeout") || lower.includes("network") || lower.includes("fetch")) {
    return "Network or service timeout. The watcher retried; check the GitHub run logs for the failing step.";
  }

  return "Unexpected watcher error. Check the GitHub run logs for the full stack trace.";
}

export function formatErrorReport(error: unknown, context: ErrorReportContext): string {
  const message = errorMessage(error);

  return [
    "[ERROR] LMS Watcher failed",
    "",
    `Problem: ${message}`,
    `Started: ${context.startedAt}`,
    `Failed: ${context.failedAt ?? new Date().toISOString()}`,
    "",
    "What to check:",
    likelyCause(message),
    "GitHub run logs show the exact step and retry attempts."
  ].join("\n");
}
