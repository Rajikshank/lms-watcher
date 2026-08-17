export const githubSecretNames = [
  "LMS_BASE_URL",
  "LMS_USERNAME",
  "LMS_PASSWORD",
  "MOODLE_CALENDAR_URL",
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_CHAT_ID",
  "CLOUDFLARE_ACCOUNT_ID",
  "CF_KV_NAMESPACE_ID",
  "CLOUDFLARE_API_TOKEN",
  "WATCHED_COURSE_IDS",
  "WATCHED_COURSE_NAMES",
  "CALENDAR_FILTER_MODE",
  "NOTIFY_REMOVED_ITEMS",
  "TELEGRAM_SCREENSHOTS",
  "MAX_SCREENSHOTS_PER_RUN",
  "DEPLOYMENT_SCREENSHOT",
  "SCAN_GAP_WARN_MINUTES",
  "HEALTH_NOTIFICATIONS",
  "STATUS_NOTIFICATION_HOURS",
  "ERROR_REMINDER_HOURS"
] as const;

export function buildGithubSecretsEnv(values: Map<string, string>): string {
  return `${githubSecretNames
    .map((name) => `${name}=${values.get(name) ?? ""}`)
    .join("\n")}\n`;
}

export function redact(text: string, secrets: string[]): string {
  return secrets
    .filter(Boolean)
    .reduce((current, secret) => current.split(secret).join("[secret]"), text);
}

