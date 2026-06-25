import { readJson, writeJson } from "./storage/cloudflare-kv.js";

const key = "lms-watcher:kv-test";
const value = { ok: true, testedAt: new Date().toISOString() };

await writeJson(key, value);
const stored = await readJson<typeof value>(key);

console.log("Cloudflare KV test result:", stored);
