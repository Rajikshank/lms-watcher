# LMS-Watcher

```text
 __     _____  _____       _ _ _       _         _
|  |   |     ||   __| ___ | | | | ___ | |_  ___ | |_  ___  ___
|  |__ | | | ||__   ||___|| | | || .'||  _||  _||   || -_||  _|
|_____||_|_|_||_____|     |_____||__,||_|  |___||_|_||___||_|
```

LMS-Watcher checks a Moodle-based university LMS and sends Telegram alerts for new or changed assignments, quizzes, resources, forums, and calendar deadlines.

It is built for students who want a quiet watcher that keeps working in the background. Text notifications are the reliable alert path. Screenshots are attached when possible, but screenshot failure never blocks the text alert.

## Quick Start

You need these accounts before starting:

- GitHub
- Cloudflare
- Telegram
- Your Moodle/LMS login

Then run:

```bash
pnpm install
pnpm setup
```

The setup wizard explains every step in simple English. It helps you connect Telegram, Moodle, Cloudflare storage, GitHub Actions secrets, and module filters.

To preview the setup without changing anything:

```bash
pnpm setup:dry-run
```

To check what tools are missing on your computer:

```bash
pnpm setup:doctor
```

## What The Wizard Helps You Do

The wizard walks you through:

1. Checking your computer setup.
2. Finding your GitHub repository name.
3. Creating a Telegram bot with BotFather.
4. Connecting your Telegram chat.
5. Entering your LMS login safely.
6. Adding your Moodle calendar export URL.
7. Choosing which modules to watch.
8. Connecting Cloudflare KV storage.
9. Uploading GitHub Actions secrets if GitHub CLI is available.
10. Showing the verification commands to run next.

You can stop and run `pnpm setup` again later. Progress is saved locally in `.lms-watcher-setup.json`, which is ignored by Git.

## What You Will Receive

Example Telegram alert:

```text
[NEW] New assignment
Course: Software Quality Assurance
Title: Assignment 1
Open: https://lms.example.edu/mod/assign/view.php?id=12345
Category: assignment
```

The watcher stays quiet when nothing changed.

## How It Works

1. GitHub Actions runs the watcher on a schedule.
2. The watcher logs in to Moodle using your LMS account.
3. It checks Moodle course pages and your Moodle calendar feed.
4. It filters items to the modules you selected.
5. It compares the latest scan with the previous scan stored in Cloudflare KV.
6. New or changed items are sent to Telegram.
7. If Telegram delivery fails, pending text alerts stay in Cloudflare KV and retry later.
8. A Cloudflare Worker scheduler can dispatch the same GitHub workflow as a backup schedule.

## Install Requirements

Use Node.js 22 if possible because GitHub Actions also uses Node.js 22.

Install pnpm if needed:

```bash
npm install -g pnpm
```

Install project dependencies:

```bash
pnpm install
```

The GitHub Actions workflow installs Playwright Chromium automatically. For local browser crawling checks, run:

```bash
pnpm exec playwright install chromium
```

## Setup Details

### Telegram

The wizard will guide you, but these are the steps:

1. Open Telegram.
2. Search for `@BotFather`.
3. Send `/newbot`.
4. Copy the bot token.
5. Open your bot and press Start.
6. Paste the bot token and chat ID into the wizard.

If you need to find the chat ID manually, send a message to your bot and open:

```text
https://api.telegram.org/botYOUR_BOT_TOKEN/getUpdates
```

Look for `chat.id`.

### Moodle LMS

The wizard asks for:

- LMS login URL
- LMS username
- LMS password
- Moodle calendar export URL
- Course IDs or course names to watch

The recommended module filter is Moodle course ID. Open a course and copy the number from a URL like:

```text
https://lms.example.edu/course/view.php?id=3549
```

Use comma-separated IDs:

```env
WATCHED_COURSE_IDS=3549,3555,3556
```

Leave both filters empty only if you want to watch every visible module:

```env
WATCHED_COURSE_IDS=
WATCHED_COURSE_NAMES=
```

### Cloudflare

Cloudflare KV stores watcher memory so the app knows what it already saw.

It stores:

- Last successful LMS snapshot
- Pending Telegram alerts
- Last scan status
- Error status

The wizard can help create the KV namespace with Wrangler. If doing it manually:

```bash
pnpm exec wrangler login
pnpm exec wrangler kv namespace create LMS_WATCHER
```

Then use the namespace ID as:

```env
CF_KV_NAMESPACE_ID=your_cloudflare_kv_namespace_id
```

### GitHub Secrets

GitHub Actions needs your secrets to run the watcher in the cloud.

The wizard can upload secrets with GitHub CLI if `gh` is installed and logged in. Manual path:

1. Open your GitHub repository.
2. Go to `Settings`.
3. Go to `Secrets and variables`.
4. Go to `Actions`.
5. Add the values from `.env` as repository secrets.

Required secrets:

```text
LMS_BASE_URL
LMS_USERNAME
LMS_PASSWORD
MOODLE_CALENDAR_URL
TELEGRAM_BOT_TOKEN
TELEGRAM_CHAT_ID
CLOUDFLARE_ACCOUNT_ID
CF_KV_NAMESPACE_ID
CLOUDFLARE_API_TOKEN
WATCHED_COURSE_IDS
WATCHED_COURSE_NAMES
CALENDAR_FILTER_MODE
NOTIFY_REMOVED_ITEMS
TELEGRAM_SCREENSHOTS
MAX_SCREENSHOTS_PER_RUN
SCAN_GAP_WARN_MINUTES
HEALTH_NOTIFICATIONS
STATUS_NOTIFICATION_HOURS
ERROR_REMINDER_HOURS
```

Recommended defaults:

```text
CALENDAR_FILTER_MODE=strict
NOTIFY_REMOVED_ITEMS=false
TELEGRAM_SCREENSHOTS=true
MAX_SCREENSHOTS_PER_RUN=10
SCAN_GAP_WARN_MINUTES=75
HEALTH_NOTIFICATIONS=false
STATUS_NOTIFICATION_HOURS=6
ERROR_REMINDER_HOURS=6
```

### Cloudflare Scheduler

GitHub Actions already has a schedule. The Cloudflare Worker scheduler is an extra backup scheduler.

For your own fork, update `wrangler.jsonc`:

```jsonc
"vars": {
  "GITHUB_OWNER": "your-github-username",
  "GITHUB_REPO": "your-repository-name",
  "GITHUB_WORKFLOW": "watch.yml",
  "GITHUB_REF": "main",
  "GITHUB_DISPATCH_SOURCE": "cloudflare-cron"
}
```

Then set the Worker secret and deploy:

```bash
pnpm exec wrangler secret put GITHUB_TOKEN
pnpm scheduler:check
pnpm scheduler:deploy
```

The GitHub token used for `GITHUB_TOKEN` should be fine-grained, limited to your repository, with Actions read/write permission.

## Verify Everything

Run these after setup:

```bash
pnpm setup:check
pnpm verify:config
pnpm verify:kv
pnpm verify:telegram
pnpm verify:calendar
pnpm verify:moodle
pnpm watch
```

Useful command meanings:

| Command | What it checks |
| --- | --- |
| `pnpm setup:doctor` | Required local tools. |
| `pnpm setup:check` | Local `.env` and common setup mistakes. |
| `pnpm verify:config` | Environment variables and watched module filters. |
| `pnpm verify:kv` | Cloudflare KV access. |
| `pnpm verify:telegram` | Telegram bot and chat. Sends a test message. |
| `pnpm verify:calendar` | Moodle calendar export URL. |
| `pnpm verify:moodle` | Moodle login and watched item crawl. |
| `pnpm verify:status` | Last stored watcher status. |
| `pnpm watch` | Runs one real watcher scan. |

The first successful watcher run may create a baseline. After that, alerts are sent only for new or changed LMS items.

## Troubleshooting

### Missing Environment Variable

Example:

```text
Missing required environment variable: CLOUDFLARE_ACCOUNT_ID
```

Fix:

- Add it to local `.env` for local runs.
- Add it to GitHub Actions secrets for cloud runs.
- `CF_ACCOUNT_ID` also works as a fallback for Cloudflare account ID.

### Telegram Does Not Send

Check:

- Bot token is correct.
- You pressed Start on the bot.
- Chat ID is correct.
- Bot is not blocked.

Run:

```bash
pnpm verify:telegram
```

If local Windows verification fails with `UNABLE_TO_VERIFY_LEAF_SIGNATURE`, try Node.js 22. Do not disable TLS verification.

### Moodle Login Fails

Check:

- LMS URL is correct.
- Username/password are correct.
- Your account can log in from a normal browser.
- Your LMS is not asking for captcha or extra verification.

Run:

```bash
pnpm verify:moodle
```

### No Notifications

This is normal if nothing new was added after the baseline scan.

Check:

```bash
pnpm verify:status
pnpm verify:moodle
```

If Moodle items are found but not watched, check your filters. To test all visible modules, temporarily leave both empty:

```env
WATCHED_COURSE_IDS=
WATCHED_COURSE_NAMES=
```

### Screenshots Are Missing

Screenshots are best-effort. Text alerts are the reliable notification.

Check:

```env
TELEGRAM_SCREENSHOTS=true
MAX_SCREENSHOTS_PER_RUN=10
```

For local screenshot checks:

```bash
pnpm exec playwright install chromium
```

### Cloudflare KV Fails

Check:

- Cloudflare account ID
- Cloudflare API token
- KV namespace ID
- Token permission for Workers KV read/write

Run:

```bash
pnpm verify:kv
```

### Scheduler Fails

Check:

- `wrangler.jsonc` has your GitHub owner and repo.
- Cloudflare Worker secret `GITHUB_TOKEN` is set.
- GitHub token has Actions read/write permission.

Run:

```bash
pnpm scheduler:check
pnpm scheduler:logs
```

## Updating Watched Modules

1. Update `WATCHED_COURSE_IDS` or `WATCHED_COURSE_NAMES` in GitHub secrets.
2. Update `.env` if testing locally.
3. Run:

```bash
pnpm verify:config
pnpm verify:moodle
```

4. Push a small commit or manually run the GitHub Action.

## Security Notes

- Never commit `.env`.
- Never share LMS passwords, Telegram tokens, GitHub tokens, or Cloudflare tokens.
- Use one Telegram bot per watcher setup if possible.
- Use limited API tokens.
- Rotate tokens immediately if exposed.
- Do not run random remote install scripts with your LMS credentials.

## Operational Notes

- The watcher is quiet when there are no LMS changes.
- Deployment messages are sent after successful pushes.
- Repeated error messages are rate-limited.
- A successful scan after a failure sends a recovery message.
- Rare duplicate alerts can happen if Telegram accepts a message but the process stops before KV acknowledgement. The system prioritizes not missing LMS changes.

## Official References

- GitHub Actions secrets: https://docs.github.com/actions/security-guides/using-secrets-in-github-actions
- GitHub scheduled workflows: https://docs.github.com/actions/using-workflows/events-that-trigger-workflows
- GitHub CLI secrets: https://cli.github.com/manual/gh_secret_set
- Cloudflare KV: https://developers.cloudflare.com/kv/get-started/
- Cloudflare Cron Triggers: https://developers.cloudflare.com/workers/configuration/cron-triggers/
- Cloudflare Wrangler KV commands: https://developers.cloudflare.com/workers/wrangler/commands/kv/
- Telegram bots: https://core.telegram.org/bots/tutorial