import { sendTelegramMessage } from "./notify/telegram.js";

await sendTelegramMessage(`✅ LMS Watcher Telegram test\nTime: ${new Date().toISOString()}`);
console.log("Telegram test message sent.");
