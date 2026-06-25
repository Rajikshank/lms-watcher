import { env } from "./env.js";
import { getFilterSummary } from "./filter.js";

console.log("LMS Watcher config check");
console.log("LMS input URL:", env.lmsInputUrl);
console.log("Normalized LMS root URL:", env.lmsRootUrl);
console.log("Normalized LMS login URL:", env.lmsLoginUrl);
console.log("Filter:", getFilterSummary());
console.log("Notify removed/hidden items:", env.notifyRemovedItems);
console.log("Calendar URL configured:", Boolean(env.moodleCalendarUrl));
console.log("Telegram configured:", Boolean(env.telegramBotToken && env.telegramChatId));
console.log("Cloudflare KV configured:", Boolean(env.cfAccountId && env.cfKvNamespaceId && env.cfApiToken));
