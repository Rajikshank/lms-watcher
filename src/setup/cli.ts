import { confirm, input, password, select } from "@inquirer/prompts";
import open from "open";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import { renderBanner } from "./banner.js";
import { runCommand } from "./command.js";
import { readEnvFile, writeEnvFile, mergeEnv } from "./env-file.js";
import { parseGitHubRemote } from "./github.js";
import { telegramBotStartUrl } from "./telegram.js";
import { buildGithubSecretsEnv } from "./secrets.js";
import { parseKvNamespaceId } from "./cloudflare.js";
import { runDoctor } from "./doctor.js";
import { info, section, success, warning, fail, maskSecret, withSpinner } from "./ui.js";
import { writeSetupState } from "./state.js";

type SetupAnswers = {
  lmsBaseUrl: string;
  lmsUsername: string;
  lmsPassword: string;
  calendarUrl: string;
  telegramBotToken: string;
  telegramChatId: string;
  courseIds: string;
  courseNames: string;
  calendarFilterMode: "strict" | "loose";
  cloudflareAccountId: string;
  cloudflareApiToken: string;
  kvNamespaceId: string;
  githubOwner: string;
  githubRepo: string;
};

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

async function showDoctor(): Promise<void> {
  console.log(renderBanner());
  console.log(section("Setup Doctor", "Checking the basic tools needed to configure LMS-Watcher."));

  const checks = await runDoctor();
  let failed = 0;

  for (const check of checks) {
    if (check.ok) {
      success(check.name);
    } else {
      failed += 1;
      warning(`${check.name}: ${check.detail}`);
    }
  }

  if (failed > 0) {
    process.exitCode = 1;
    return;
  }

  success("Setup doctor passed.");
}

async function detectGitHubRepo(dryRun: boolean): Promise<{ owner: string; repo: string } | null> {
  try {
    const result = await runCommand("git", ["remote", "get-url", "origin"], { dryRun });
    if (dryRun) return { owner: "your-github-username", repo: "lms-watcher" };
    return parseGitHubRemote(result.stdout.trim());
  } catch {
    return null;
  }
}

async function maybeCreateKvNamespace(accountId: string, apiToken: string): Promise<string> {
  const alreadyHasKv = await confirm({
    message: "Do you already have a Cloudflare KV namespace ID?",
    default: true
  });

  if (alreadyHasKv) {
    return input({
      message: "Paste your Cloudflare KV namespace ID:",
      validate: (value) => Boolean(value.trim()) || "Enter your KV namespace ID."
    });
  }

  console.log(
    section(
      "Create KV Automatically",
      [
        "The wizard can ask Wrangler to create the KV namespace for you.",
        "It will run: pnpm exec wrangler kv namespace create LMS_WATCHER",
        "This creates storage only. It will not delete or reset existing watcher data."
      ].join("\n")
    )
  );

  const shouldCreate = await confirm({ message: "Create the KV namespace now?", default: true });
  if (!shouldCreate) {
    return input({
      message: "Paste your Cloudflare KV namespace ID after creating it manually:",
      validate: (value) => Boolean(value.trim()) || "Enter your KV namespace ID."
    });
  }

  process.env.CLOUDFLARE_ACCOUNT_ID = accountId;
  process.env.CLOUDFLARE_API_TOKEN = apiToken;

  const result = await withSpinner("Creating Cloudflare KV namespace", async () =>
    runCommand("pnpm", ["exec", "wrangler", "kv", "namespace", "create", "LMS_WATCHER"])
  );

  const namespaceId = parseKvNamespaceId(`${result.stdout}\n${result.stderr}`);
  if (!namespaceId) {
    warning("Wrangler ran, but the namespace ID could not be detected automatically.");
    return input({
      message: "Paste the KV namespace ID shown by Wrangler:",
      validate: (value) => Boolean(value.trim()) || "Enter your KV namespace ID."
    });
  }

  success(`KV namespace created: ${namespaceId}`);
  return namespaceId;
}

async function askSetupQuestions(dryRun: boolean): Promise<SetupAnswers> {
  if (dryRun) {
    return {
      lmsBaseUrl: "https://lms.example.edu/login/index.php",
      lmsUsername: "student123",
      lmsPassword: "dry-run-password",
      calendarUrl: "https://lms.example.edu/calendar/export_execute.php?dry-run=1",
      telegramBotToken: "123456:dry-run-token",
      telegramChatId: "123456789",
      courseIds: "3549,3555",
      courseNames: "",
      calendarFilterMode: "strict",
      cloudflareAccountId: "dry-run-cloudflare-account",
      cloudflareApiToken: "dry-run-cloudflare-token",
      kvNamespaceId: "dryrunnamespace000000000000000000",
      githubOwner: "your-github-username",
      githubRepo: "lms-watcher"
    };
  }

  console.log(
    section(
      "Before We Start",
      [
        "This wizard uses simple questions and checks each important setup step.",
        "You can stop anytime and run pnpm setup again later.",
        "Passwords and tokens are saved only in your local .env file and GitHub/Cloudflare secrets."
      ].join("\n")
    )
  );

  await confirm({ message: "Ready to start LMS-Watcher setup?", default: true });

  writeSetupState("github");
  const detectedRepo = await detectGitHubRepo(false);

  const githubOwner = await input({
    message: "What is your GitHub username or organization?",
    default: detectedRepo?.owner,
    validate: (value) => Boolean(value.trim()) || "Enter your GitHub username or organization."
  });

  const githubRepo = await input({
    message: "What is this repository name?",
    default: detectedRepo?.repo ?? "lms-watcher",
    validate: (value) => Boolean(value.trim()) || "Enter the repository name."
  });

  writeSetupState("telegram");
  console.log(
    section(
      "Telegram Bot",
      [
        "1. Open Telegram.",
        "2. Search for @BotFather.",
        "3. Send /newbot.",
        "4. Give your bot a name.",
        "5. Copy the token BotFather gives you."
      ].join("\n")
    )
  );

  if (await confirm({ message: "Open BotFather in your browser?", default: true })) {
    await open("https://t.me/BotFather");
  }

  const telegramBotToken = await password({
    message: "Paste your Telegram bot token:",
    mask: "*",
    validate: (value) => value.includes(":") || "Telegram bot tokens usually look like 123456:ABC..."
  });

  const botName = await input({
    message: "What is your bot username? Example: my_lms_watcher_bot",
    validate: (value) => Boolean(value.trim()) || "Enter the bot username from BotFather."
  });

  info(`Open this link, press Start, then return here: ${telegramBotStartUrl(botName)}`);
  if (await confirm({ message: "Open your bot start link?", default: true })) {
    await open(telegramBotStartUrl(botName));
  }

  const telegramChatId = await input({
    message: "Paste your Telegram chat ID:",
    validate: (value) => Boolean(value.trim()) || "Enter your Telegram chat ID."
  });

  writeSetupState("moodle");
  console.log(
    section(
      "Moodle LMS",
      [
        "Use the same username and password you use to log in to the university LMS.",
        "For modules, the easiest reliable option is course IDs from URLs like /course/view.php?id=3549.",
        "You can leave module filters empty only if you want to watch every visible module."
      ].join("\n")
    )
  );

  const lmsBaseUrl = await input({
    message: "Paste your LMS login URL:",
    default: "https://lms.sltc.ac.lk/login/index.php",
    validate: (value) => value.startsWith("http") || "Enter the full LMS URL starting with https://"
  });

  const lmsUsername = await input({
    message: "Enter your LMS username:",
    validate: (value) => Boolean(value.trim()) || "Enter your LMS username."
  });

  const lmsPassword = await password({
    message: "Enter your LMS password:",
    mask: "*",
    validate: (value) => Boolean(value) || "Enter your LMS password."
  });

  const calendarUrl = await input({
    message: "Paste your Moodle calendar export URL:",
    validate: (value) => value.startsWith("http") || "Enter the full calendar export URL."
  });

  const moduleMode = await select({
    message: "How do you want to choose modules?",
    choices: [
      { name: "Course IDs from Moodle URLs (recommended)", value: "ids" },
      { name: "Course names or codes", value: "names" },
      { name: "Watch every visible module", value: "all" }
    ]
  });

  const courseIds =
    moduleMode === "ids"
      ? await input({
          message: "Enter course IDs separated by commas. Example: 3549,3555",
          validate: (value) => Boolean(value.trim()) || "Enter at least one course ID."
        })
      : "";

  const courseNames =
    moduleMode === "names"
      ? await input({
          message: "Enter course names/codes separated by commas:",
          validate: (value) => Boolean(value.trim()) || "Enter at least one course name or code."
        })
      : "";

  const calendarFilterMode = await select({
    message: "Calendar filtering mode:",
    default: "strict",
    choices: [
      { name: "strict - only selected modules", value: "strict" },
      { name: "loose - safer if calendar events hide module names", value: "loose" }
    ]
  });

  writeSetupState("cloudflare");
  console.log(
    section(
      "Cloudflare",
      [
        "Cloudflare stores the watcher memory.",
        "This prevents old LMS items from being sent again and keeps failed alerts pending for retry.",
        "You need a Cloudflare account ID and API token. The wizard can create the KV namespace for you."
      ].join("\n")
    )
  );

  if (await confirm({ message: "Open the Cloudflare dashboard?", default: false })) {
    await open("https://dash.cloudflare.com/");
  }

  const cloudflareAccountId = await input({
    message: "Paste your Cloudflare account ID:",
    validate: (value) => Boolean(value.trim()) || "Enter your Cloudflare account ID."
  });

  const cloudflareApiToken = await password({
    message: "Paste your Cloudflare API token:",
    mask: "*",
    validate: (value) => Boolean(value.trim()) || "Enter your Cloudflare API token."
  });

  const kvNamespaceId = await maybeCreateKvNamespace(cloudflareAccountId, cloudflareApiToken);

  return {
    lmsBaseUrl,
    lmsUsername,
    lmsPassword,
    calendarUrl,
    telegramBotToken,
    telegramChatId,
    courseIds,
    courseNames,
    calendarFilterMode,
    cloudflareAccountId,
    cloudflareApiToken,
    kvNamespaceId,
    githubOwner,
    githubRepo
  };
}

async function maybeUploadGitHubSecrets(values: Map<string, string>, dryRun: boolean): Promise<void> {
  const secretsEnv = buildGithubSecretsEnv(values);

  if (dryRun) {
    info(secretsEnv.replace(/=.*/g, "=[hidden]"));
    return;
  }

  const upload = await confirm({
    message: "Upload these values to GitHub Actions secrets using GitHub CLI?",
    default: false
  });

  if (!upload) {
    warning("Skipped GitHub secret upload. You can run: gh secret set -f .env");
    return;
  }

  const tempPath = ".setup-secrets.env";
  writeFileSync(tempPath, secretsEnv, "utf8");

  try {
    await runCommand("gh", ["secret", "set", "-f", tempPath]);
    success("GitHub Actions secrets uploaded.");
  } finally {
    rmSync(tempPath, { force: true });
  }
}

async function runSetup(): Promise<void> {
  const dryRun = hasFlag("--dry-run");
  const nonInteractive = hasFlag("--non-interactive");

  console.log(renderBanner());

  if (nonInteractive && !dryRun) {
    throw new Error("--non-interactive is only supported with --dry-run.");
  }

  if (!dryRun && existsSync(".lms-watcher-setup.json")) {
    warning("A previous setup state file exists. The wizard can safely continue and overwrite new answers.");
  }

  const answers = await askSetupQuestions(dryRun);

  const envValues = mergeEnv(readEnvFile(), {
    LMS_BASE_URL: answers.lmsBaseUrl,
    LMS_USERNAME: answers.lmsUsername,
    LMS_PASSWORD: answers.lmsPassword,
    MOODLE_CALENDAR_URL: answers.calendarUrl,
    TELEGRAM_BOT_TOKEN: answers.telegramBotToken,
    TELEGRAM_CHAT_ID: answers.telegramChatId,
    CLOUDFLARE_ACCOUNT_ID: answers.cloudflareAccountId,
    CF_KV_NAMESPACE_ID: answers.kvNamespaceId,
    CLOUDFLARE_API_TOKEN: answers.cloudflareApiToken,
    WATCHED_COURSE_IDS: answers.courseIds,
    WATCHED_COURSE_NAMES: answers.courseNames,
    CALENDAR_FILTER_MODE: answers.calendarFilterMode,
    NOTIFY_REMOVED_ITEMS: "false",
    TELEGRAM_SCREENSHOTS: "true",
    MAX_SCREENSHOTS_PER_RUN: "10",
    DEPLOYMENT_SCREENSHOT: "false",
    SCAN_GAP_WARN_MINUTES: "75",
    HEALTH_NOTIFICATIONS: "false",
    STATUS_NOTIFICATION_HOURS: "6",
    ERROR_REMINDER_HOURS: "6"
  });

  if (!dryRun) writeSetupState("write-env");

  if (dryRun) {
    info("[dry-run] Would write .env with masked values.");
  } else {
    writeEnvFile(envValues);
    success(".env saved.");
  }

  info(`Telegram token: ${maskSecret(answers.telegramBotToken)}`);
  info(`Cloudflare token: ${maskSecret(answers.cloudflareApiToken)}`);

  if (!dryRun) writeSetupState("secrets");
  await withSpinner(
    dryRun ? "Previewing GitHub Actions secrets" : "Preparing GitHub Actions secrets",
    async () => maybeUploadGitHubSecrets(envValues, dryRun),
    { dryRun }
  );

  if (!dryRun) writeSetupState("verify");
  await withSpinner(
    "Checking local setup tools",
    async () => {
      const checks = await runDoctor();
      const failed = checks.filter((check) => !check.ok);
      if (failed.length > 0) {
        for (const check of failed) warning(`${check.name}: ${check.detail}`);
      }
    },
    { dryRun }
  );

  console.log(
    section(
      dryRun ? "Dry Run Complete" : "Setup Saved",
      [
        dryRun
          ? "No files, secrets, Cloudflare resources, or GitHub settings were changed."
          : "Your local setup file was saved. If you uploaded secrets, GitHub Actions can use them now.",
        "Next recommended commands:",
        "pnpm setup:doctor",
        "pnpm verify:config",
        "pnpm verify:kv",
        "pnpm verify:telegram",
        "pnpm verify:moodle",
        "pnpm watch"
      ].join("\n")
    )
  );
}

if (process.argv.includes("doctor")) {
  await showDoctor();
} else {
  try {
    await runSetup();
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}