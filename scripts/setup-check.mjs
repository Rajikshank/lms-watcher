import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const requiredEnv = [
  "LMS_BASE_URL",
  "LMS_USERNAME",
  "LMS_PASSWORD",
  "MOODLE_CALENDAR_URL",
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_CHAT_ID",
  "CF_KV_NAMESPACE_ID"
];

const cloudflareAccountNames = ["CLOUDFLARE_ACCOUNT_ID", "CF_ACCOUNT_ID"];
const cloudflareTokenNames = ["CLOUDFLARE_API_TOKEN", "CF_API_TOKEN"];

const optionalEnv = [
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
];

const placeholderPatterns = [
  /^your_/i,
  /example/i,
  /replace_me/i,
  /changeme/i,
  /^<.*>$/,
  /^\s*$/
];

const checks = [];

function addCheck(ok, message, detail = "", level = "error") {
  checks.push({ ok, message, detail, level });
}

function parseEnvFile(path) {
  const values = new Map();
  const content = readFileSync(path, "utf8");

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    let value = rawValue.trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values.set(key, value);
  }

  return values;
}

function isPlaceholder(value) {
  return placeholderPatterns.some((pattern) => pattern.test(value));
}

function getCommandVersion(command, args) {
  const candidates =
    process.platform === "win32" && !command.endsWith(".cmd")
      ? [command, `${command}.cmd`]
      : [command];

  for (const candidate of candidates) {
    try {
      return execFileSync(candidate, args, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"]
      }).trim();
    } catch {
      // Try the next platform-specific candidate.
    }
  }

  return "";
}

function getPnpmVersion() {
  const userAgent = process.env.npm_config_user_agent ?? "";
  const userAgentMatch = userAgent.match(/pnpm\/([^\s]+)/);
  if (userAgentMatch) return userAgentMatch[1];

  const execPath = process.env.npm_execpath ?? "";
  if (execPath.toLowerCase().includes("pnpm")) {
    return "available";
  }

  return getCommandVersion("pnpm", ["--version"]);
}

function parseJsonc(content) {
  const withoutLineComments = content.replace(/(^|\s)\/\/.*$/gm, "");
  const withoutTrailingCommas = withoutLineComments.replace(/,\s*([}\]])/g, "$1");
  return JSON.parse(withoutTrailingCommas);
}

console.log("LMS Watcher setup check");
console.log("=======================\n");

const nodeMajor = Number.parseInt(process.versions.node.split(".")[0] ?? "0", 10);
addCheck(nodeMajor >= 22, `Node.js ${process.versions.node}`, "Use Node.js 22 or newer.");
if (nodeMajor !== 22) {
  addCheck(
    false,
    "Node.js version differs from GitHub Actions",
    "GitHub Actions uses Node.js 22. If local TLS or Playwright checks behave differently, test with Node.js 22.",
    "warning"
  );
}

const pnpmVersion = getPnpmVersion();
addCheck(Boolean(pnpmVersion), pnpmVersion ? `pnpm ${pnpmVersion}` : "pnpm not found", "Install with: npm install -g pnpm");

const hasEnv = existsSync(".env");
addCheck(hasEnv, ".env file", "Create it from .env.example before local verification.");

let envValues = new Map();
if (hasEnv) {
  envValues = parseEnvFile(".env");

  for (const name of requiredEnv) {
    const value = envValues.get(name) ?? "";
    addCheck(Boolean(value) && !isPlaceholder(value), `${name}`, "Required in .env and GitHub Actions secrets.");
  }

  const hasCfAccount = cloudflareAccountNames.some((name) => {
    const value = envValues.get(name) ?? "";
    return Boolean(value) && !isPlaceholder(value);
  });
  addCheck(hasCfAccount, "Cloudflare account ID", "Set CLOUDFLARE_ACCOUNT_ID or CF_ACCOUNT_ID.");

  const hasCfToken = cloudflareTokenNames.some((name) => {
    const value = envValues.get(name) ?? "";
    return Boolean(value) && !isPlaceholder(value);
  });
  addCheck(hasCfToken, "Cloudflare API token", "Set CLOUDFLARE_API_TOKEN or CF_API_TOKEN.");

  const calendarMode = envValues.get("CALENDAR_FILTER_MODE");
  if (calendarMode) {
    addCheck(
      ["strict", "loose"].includes(calendarMode.toLowerCase()),
      "CALENDAR_FILTER_MODE",
      "Use strict or loose."
    );
  }

  for (const name of ["NOTIFY_REMOVED_ITEMS", "TELEGRAM_SCREENSHOTS", "DEPLOYMENT_SCREENSHOT", "HEALTH_NOTIFICATIONS"]) {
    const value = envValues.get(name);
    if (!value) continue;
    addCheck(
      ["true", "false", "1", "0", "yes", "no", "y", "n"].includes(value.toLowerCase()),
      name,
      "Use true or false."
    );
  }

  for (const name of ["MAX_SCREENSHOTS_PER_RUN", "SCAN_GAP_WARN_MINUTES", "STATUS_NOTIFICATION_HOURS", "ERROR_REMINDER_HOURS"]) {
    const value = envValues.get(name);
    if (!value) continue;
    const parsed = Number.parseInt(value, 10);
    addCheck(Number.isFinite(parsed) && parsed >= 0, name, "Use a whole number greater than or equal to 0.");
  }
}

const hasWorkflow = existsSync(".github/workflows/watch.yml");
addCheck(hasWorkflow, "GitHub Actions workflow", "Expected .github/workflows/watch.yml.");

const hasWrangler = existsSync("wrangler.jsonc");
addCheck(hasWrangler, "wrangler.jsonc", "Required only if using the Cloudflare scheduler.");

if (hasWrangler) {
  try {
    const wrangler = parseJsonc(readFileSync("wrangler.jsonc", "utf8"));
    const vars = wrangler.vars ?? {};
    addCheck(Boolean(wrangler.name), "Cloudflare Worker name", "Set name in wrangler.jsonc.");
    addCheck(Boolean(vars.GITHUB_OWNER), "Scheduler GITHUB_OWNER", "Set to your GitHub username or organization.");
    addCheck(Boolean(vars.GITHUB_REPO), "Scheduler GITHUB_REPO", "Set to your repository name.");
    addCheck(Boolean(vars.GITHUB_WORKFLOW), "Scheduler GITHUB_WORKFLOW", "Usually watch.yml.");

    if (vars.GITHUB_OWNER === "Rajikshank" || vars.GITHUB_REPO === "lms-watcher") {
      addCheck(
        false,
        "Scheduler still points to the original repository",
        "If this is your fork, update GITHUB_OWNER and GITHUB_REPO in wrangler.jsonc.",
        "warning"
      );
    }
  } catch (error) {
    addCheck(false, "wrangler.jsonc parse", error instanceof Error ? error.message : String(error));
  }
}

const okMark = "[OK]";
const warnMark = "[CHECK]";
let failed = 0;
let warnings = 0;

for (const check of checks) {
  if (check.ok) {
    console.log(`${okMark} ${check.message}`);
  } else {
    if (check.level === "warning") {
      warnings += 1;
    } else {
      failed += 1;
    }
    console.log(`${warnMark} ${check.message}`);
    if (check.detail) console.log(`       ${check.detail}`);
  }
}

console.log("\nGitHub Actions secrets to configure:");
console.log([...requiredEnv, ...cloudflareAccountNames.slice(0, 1), ...cloudflareTokenNames.slice(0, 1), ...optionalEnv].join("\n"));

console.log("\nNext verification commands:");
console.log("pnpm verify:config");
console.log("pnpm verify:kv");
console.log("pnpm verify:telegram");
console.log("pnpm verify:calendar");
console.log("pnpm verify:moodle");

if (warnings > 0) {
  console.log(`\nSetup check found ${warnings} warning(s) to review.`);
}

if (failed > 0) {
  console.log(`Setup check found ${failed} required item(s) to fix.`);
  process.exitCode = 1;
} else {
  console.log("\nSetup check passed.");
}
