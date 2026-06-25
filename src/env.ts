import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];

  if (!value || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value.trim();
}

function optional(name: string, fallback = ""): string {
  return process.env[name]?.trim() ?? fallback;
}

function parseCsv(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseBoolean(value: string, fallback: boolean): boolean {
  if (!value) return fallback;

  const normalized = value.trim().toLowerCase();

  if (["true", "1", "yes", "y"].includes(normalized)) return true;
  if (["false", "0", "no", "n"].includes(normalized)) return false;

  return fallback;
}

function normalizeLmsUrls(input: string): {
  lmsInputUrl: string;
  lmsRootUrl: string;
  lmsLoginUrl: string;
} {
  const cleaned = input.trim().replace(/\/+$/, "");
  const url = new URL(cleaned);

  let rootPath = url.pathname.replace(/\/+$/, "");

  if (rootPath.endsWith("/login/index.php")) {
    rootPath = rootPath.slice(0, -"/login/index.php".length);
  } else if (rootPath.endsWith("/login")) {
    rootPath = rootPath.slice(0, -"/login".length);
  }

  const rootUrl = `${url.origin}${rootPath}`.replace(/\/+$/, "");
  const safeRootUrl = rootUrl || url.origin;

  return {
    lmsInputUrl: cleaned,
    lmsRootUrl: safeRootUrl,
    lmsLoginUrl: `${safeRootUrl}/login/index.php`
  };
}

const lmsUrls = normalizeLmsUrls(required("LMS_BASE_URL"));

export const env = {
  ...lmsUrls,

  // Backward-compatible alias. Use lmsRootUrl in new code.
  lmsBaseUrl: lmsUrls.lmsRootUrl,

  lmsUsername: required("LMS_USERNAME"),
  lmsPassword: required("LMS_PASSWORD"),
  moodleCalendarUrl: required("MOODLE_CALENDAR_URL"),

  telegramBotToken: required("TELEGRAM_BOT_TOKEN"),
  telegramChatId: required("TELEGRAM_CHAT_ID"),

  cfAccountId: required("CLOUDFLARE_ACCOUNT_ID"),
  cfKvNamespaceId: required("CF_KV_NAMESPACE_ID"),
  cfApiToken: required("CLOUDFLARE_API_TOKEN"),

  watchedCourseIds: parseCsv(optional("WATCHED_COURSE_IDS")),
  watchedCourseNames: parseCsv(optional("WATCHED_COURSE_NAMES")),

  // loose = keep calendar events that cannot be confidently matched to a course.
  // strict = drop calendar events unless they match WATCHED_COURSE_IDS or WATCHED_COURSE_NAMES.
  calendarFilterMode: optional("CALENDAR_FILTER_MODE", "loose").toLowerCase() === "strict" ? "strict" : "loose",

  // Disabled by default because Moodle pages are messy and removed/hidden alerts can become noisy.
  notifyRemovedItems: parseBoolean(optional("NOTIFY_REMOVED_ITEMS"), false)
};
