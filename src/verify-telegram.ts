import { sendTelegramMessage } from "./notify/telegram.js";

await sendTelegramMessage(`[OK] LMS Watcher Telegram test\nTime: ${new Date().toISOString()}`);
console.log("Telegram test message sent.");
