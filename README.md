# LMS Watcher

LMS Watcher monitors a Moodle-based university LMS and sends Telegram alerts when new or changed course items are detected. It is designed for students who want a reliable, low-maintenance way to track assignments, quizzes, resources, forums, and calendar deadlines from selected modules.

The project runs from GitHub Actions, stores scan state in Cloudflare KV, and can use a Cloudflare Worker scheduler to keep checks running even when one scheduler is delayed. Telegram text alerts are the primary notification path. Screenshots are attached when possible, but a screenshot failure will not block the text alert.

## Features

- Watches selected Moodle courses/modules by course ID or course name.
- Detects new and changed assignments, quizzes, resources, forums, and calendar items.
- Sends clear Telegram notifications with course, type, title, link, and category.
- Sends logged-in screenshots for item notifications when screenshot capture succeeds.
- Stores scan snapshots in Cloudflare KV so old items are not repeatedly sent.
- Keeps pending notifications in a KV outbox so Telegram failures can be retried.
- Sends deployment verification messages after successful pushes.
- Includes verification commands for config, Telegram, Cloudflare KV, Moodle crawling, and watcher status.
- Keeps routine health messages quiet by default while still reporting real failures.

## How It Works

1. GitHub Actions runs the watcher on a schedule and on deployment.
2. The watcher logs in to Moodle with your LMS username and password.
3. It crawls Moodle course pages and reads the Moodle calendar export.
4. It filters items to the modules you configured.
5. It compares the latest scan with the previous snapshot in Cloudflare KV.
6. New or changed items are sent to Telegram.
7. If an alert cannot be delivered, it remains pending for the next run.
8. A Cloudflare Worker can also dispatch the GitHub workflow on a separate schedule for better continuity.

## Requirements

Before setup, create these accounts or tools:

- A GitHub account.
- A Cloudflare account.
- A Telegram account.
- Access to your Moodle/LMS account.
- Node.js 22 on your computer. Newer versions may work, but GitHub Actions uses Node.js 22.
- pnpm 10 or newer.

Install pnpm if you do not already have it:

```bash
npm install -g pnpm
```

Then install project dependencies:

```bash
pnpm install
pnpm exec playwright install chromium
```

On GitHub Actions, Chromium is installed automatically by the workflow.

## Quick Setup Checklist

Use this checklist when setting up a new copy:

- Fork or clone this repository.
- Create a Telegram bot.
- Find your Telegram chat ID.
- Get your Moodle calendar export URL.
- Create a Cloudflare KV namespace.
- Create a Cloudflare API token.
- Add all required GitHub repository secrets.
- Configure watched course IDs or names.
- Update the Cloudflare scheduler repository settings.
- Run verification commands.
- Push to GitHub and confirm the first deployment message.

The detailed steps below explain each item.

## 1. Fork Or Clone The Repository

For your own setup, fork this repository into your GitHub account.

After cloning it locally:

```bash
pnpm install
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Never commit `.env`. It contains private credentials.

## 2. Create A Telegram Bot

1. Open Telegram.
2. Search for `@BotFather`.
3. Send `/newbot`.
4. Follow the prompts.
5. Copy the bot token.

Your token will be used as:

```env
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
```

## 3. Find Your Telegram Chat ID

The bot needs to know where to send alerts.

Simple method:

1. Open your new bot in Telegram.
2. Press Start or send any message to the bot.
3. Open this URL in your browser, replacing the token:

```text
https://api.telegram.org/botYOUR_BOT_TOKEN/getUpdates
```

4. Look for `chat` and copy the `id`.

Use it as:

```env
TELEGRAM_CHAT_ID=your_telegram_chat_id
```

If `getUpdates` returns an empty result, send another message to the bot and refresh the URL.

## 4. Configure LMS Login

Set your LMS URL, username, and password:

```env
LMS_BASE_URL=https://lms.example.edu/login/index.php
LMS_USERNAME=your_lms_username
LMS_PASSWORD=your_lms_password
```

You can use either the Moodle root URL or login URL:

```env
LMS_BASE_URL=https://lms.example.edu
LMS_BASE_URL=https://lms.example.edu/login/index.php
```

## 5. Get Your Moodle Calendar URL

Moodle usually provides a calendar export link from the calendar page.

Look for options such as:

- Calendar
- Export calendar
- Subscribe to calendar
- iCal export

Use the full export URL:

```env
MOODLE_CALENDAR_URL=your_moodle_calendar_export_url
```

The watcher uses this to detect calendar deadlines in addition to course page items.

## 6. Choose Which Modules To Watch

You can watch all modules or only selected modules.

To watch all configured/visible modules, leave both values empty:

```env
WATCHED_COURSE_IDS=
WATCHED_COURSE_NAMES=
```

Recommended option: use Moodle course IDs. Open a course page and copy the number from a URL like this:

```text
https://lms.example.edu/course/view.php?id=3549
```

Then configure:

```env
WATCHED_COURSE_IDS=3549,3555,3556
```

You can also match by course code or name:

```env
WATCHED_COURSE_NAMES=CCS3310,Software Quality Assurance,Cloud Security
```

If both IDs and names are set, an item can match either one.

## 7. Configure Calendar Filtering

Use strict mode when your Moodle calendar events clearly include course names or IDs:

```env
CALENDAR_FILTER_MODE=strict
```

Use loose mode if your LMS calendar events do not always show the course name:

```env
CALENDAR_FILTER_MODE=loose
```

Loose mode reduces the chance of missing a deadline, but it may include extra calendar items.

## 8. Create Cloudflare KV Storage

Cloudflare KV stores:

- The last successful LMS snapshot.
- Pending Telegram notifications.
- Last scan status.
- Error/incident state.

Login to Cloudflare from your terminal:

```bash
pnpm exec wrangler login
```

Create a KV namespace:

```bash
pnpm exec wrangler kv namespace create LMS_WATCHER
```

Copy the generated namespace ID into:

```env
CF_KV_NAMESPACE_ID=your_cloudflare_kv_namespace_id
```

Also set:

```env
CLOUDFLARE_ACCOUNT_ID=your_cloudflare_account_id
CLOUDFLARE_API_TOKEN=your_cloudflare_api_token
```

The API token needs permission to read and write Workers KV. If you will deploy the Cloudflare scheduler, it also needs permission to edit Workers scripts.

## 9. Add GitHub Repository Secrets

In your GitHub repository:

1. Open `Settings`.
2. Open `Secrets and variables`.
3. Open `Actions`.
4. Add each secret below.

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

Optional values can still be added as empty strings if you do not use them.

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

## 10. Configure The Cloudflare Scheduler

The GitHub Actions workflow already has a schedule. The Cloudflare Worker scheduler is an extra reliability layer that dispatches the same GitHub workflow.

Open `wrangler.jsonc` and update these values:

```jsonc
"vars": {
  "GITHUB_OWNER": "your-github-username",
  "GITHUB_REPO": "your-repository-name",
  "GITHUB_WORKFLOW": "watch.yml",
  "GITHUB_REF": "main",
  "GITHUB_DISPATCH_SOURCE": "cloudflare-cron"
}
```

You may also change the Worker name if you want:

```jsonc
"name": "my-lms-watcher-scheduler"
```

Create a fine-grained GitHub personal access token for your repository with Actions read/write permission. Store it as the Cloudflare Worker secret:

```bash
pnpm exec wrangler secret put GITHUB_TOKEN
```

Then verify and deploy the scheduler:

```bash
pnpm scheduler:check
pnpm scheduler:deploy
```

## 11. Run Local Setup Checks

Run the setup checker:

```bash
pnpm setup:check
```

This command checks local setup files and common mistakes. It does not send Telegram messages, write to Cloudflare KV, or run the watcher.

Then run the safe verification commands:

```bash
pnpm verify:config
pnpm verify:kv
pnpm verify:telegram
pnpm verify:calendar
pnpm verify:moodle
```

What each command checks:

| Command | Purpose |
| --- | --- |
| `pnpm verify:config` | Confirms environment variables and filter summary. |
| `pnpm verify:kv` | Confirms Cloudflare KV can be reached. |
| `pnpm verify:telegram` | Sends a Telegram verification message. |
| `pnpm verify:calendar` | Confirms the calendar feed can be read. |
| `pnpm verify:moodle` | Logs in to Moodle and checks filtered items. |
| `pnpm verify:status` | Shows the latest stored watcher status. |

## 12. Run The Watcher Manually

After verification:

```bash
pnpm watch
```

The first run may store a baseline snapshot. Future runs notify only when new or changed LMS items appear.

## 13. Deploy To GitHub Actions

Commit your configuration changes, but never commit `.env`.

```bash
git add README.md .env.example package.json pnpm-lock.yaml wrangler.jsonc .github/workflows/watch.yml
git commit -m "Prepare LMS Watcher setup"
git push
```

After pushing:

1. Open the GitHub repository.
2. Go to `Actions`.
3. Open the latest `LMS Watcher` run.
4. Confirm all steps pass.
5. Check Telegram for the deployment verification message.

## Notification Behavior

For LMS changes, the watcher sends messages like:

```text
[NEW] New assignment
Course: Software Quality Assurance
Title: Assignment 1
Open: https://lms.example.edu/mod/assign/view.php?id=12345
Category: assignment
```

If screenshots are enabled, the watcher attempts to attach a logged-in screenshot. If screenshot capture or photo upload fails, the text alert still sends.

## Useful Commands

```bash
pnpm setup:check
pnpm verify:config
pnpm verify:kv
pnpm verify:telegram
pnpm verify:calendar
pnpm verify:moodle
pnpm verify:status
pnpm watch
pnpm scheduler:check
pnpm scheduler:deploy
pnpm scheduler:logs
```

## Common Configuration Options

| Variable | Required | Description |
| --- | --- | --- |
| `LMS_BASE_URL` | Yes | Moodle root or login URL. |
| `LMS_USERNAME` | Yes | Your LMS username. |
| `LMS_PASSWORD` | Yes | Your LMS password. |
| `MOODLE_CALENDAR_URL` | Yes | Moodle calendar export URL. |
| `TELEGRAM_BOT_TOKEN` | Yes | Bot token from BotFather. |
| `TELEGRAM_CHAT_ID` | Yes | Telegram chat ID for alerts. |
| `CLOUDFLARE_ACCOUNT_ID` | Yes | Cloudflare account ID. |
| `CF_KV_NAMESPACE_ID` | Yes | Cloudflare KV namespace ID. |
| `CLOUDFLARE_API_TOKEN` | Yes | Cloudflare API token. |
| `WATCHED_COURSE_IDS` | No | Comma-separated Moodle course IDs. |
| `WATCHED_COURSE_NAMES` | No | Comma-separated course names/codes. |
| `CALENDAR_FILTER_MODE` | No | `strict` or `loose`. |
| `NOTIFY_REMOVED_ITEMS` | No | Send removed/hidden item alerts. Usually `false`. |
| `TELEGRAM_SCREENSHOTS` | No | Enable best-effort screenshots. |
| `MAX_SCREENSHOTS_PER_RUN` | No | Screenshot cap per watcher run. |
| `HEALTH_NOTIFICATIONS` | No | Send routine healthy status messages. Usually `false`. |

## Troubleshooting

### Missing Required Environment Variable

Error:

```text
Missing required environment variable: CLOUDFLARE_ACCOUNT_ID
```

Fix:

- Add the missing value to `.env` for local runs.
- Add the same value to GitHub Actions secrets for deployed runs.
- The app also accepts `CF_ACCOUNT_ID` as a fallback for Cloudflare account ID.

### Telegram Verification Fails

Check:

- The bot token is copied correctly.
- You sent at least one message to the bot.
- The chat ID is correct.
- The bot is not blocked.

Run:

```bash
pnpm verify:telegram
```

If local verification fails with a certificate error such as `UNABLE_TO_VERIFY_LEAF_SIGNATURE`, test with Node.js 22 first. Some local Windows or university network setups intercept HTTPS certificates differently from GitHub Actions. Do not disable TLS verification in the app.

### Moodle Login Fails

Check:

- `LMS_BASE_URL` points to the correct Moodle site.
- Username and password are correct.
- Your university did not require a new login challenge.
- The account can open Moodle in a normal browser.

Run:

```bash
pnpm verify:moodle
```

### No LMS Notifications

This can be normal if no new items were added after the baseline snapshot.

Check:

```bash
pnpm verify:status
pnpm verify:moodle
```

If Moodle items are found but not notified, check your module filters:

```env
WATCHED_COURSE_IDS=
WATCHED_COURSE_NAMES=
```

Temporarily leaving both empty watches all visible modules.

### Screenshots Are Not Attached

Screenshots are best-effort. Text alerts are the reliable notification path.

Check:

```env
TELEGRAM_SCREENSHOTS=true
MAX_SCREENSHOTS_PER_RUN=10
```

Also confirm Playwright Chromium is installed locally:

```bash
pnpm exec playwright install chromium
```

### Cloudflare KV Verification Fails

Check:

- Cloudflare account ID.
- Cloudflare API token permissions.
- KV namespace ID.
- API token has Workers KV read/write access.

Run:

```bash
pnpm verify:kv
```

### Scheduler Does Not Dispatch GitHub Actions

Check:

- `wrangler.jsonc` has your GitHub owner and repository.
- The Cloudflare Worker secret `GITHUB_TOKEN` is set.
- The GitHub token has Actions read/write access.
- The workflow file exists at `.github/workflows/watch.yml`.

Run:

```bash
pnpm scheduler:check
pnpm scheduler:deploy
pnpm scheduler:logs
```

## Updating Watched Modules

To add or remove modules:

1. Update `WATCHED_COURSE_IDS` or `WATCHED_COURSE_NAMES` in GitHub secrets.
2. Update local `.env` if you test locally.
3. Run:

```bash
pnpm verify:config
pnpm verify:moodle
```

4. Push a small commit or manually run the GitHub Action.

## Security Notes

- Never commit `.env`.
- Never paste tokens into public chats, issues, or screenshots.
- Use one Telegram bot per watcher setup if possible.
- Use a Cloudflare API token with only the permissions this app needs.
- Use a fine-grained GitHub token for the scheduler, limited to one repository.
- Rotate tokens immediately if they are exposed.

## Operational Notes

- The watcher is quiet when nothing changed.
- Deployment messages are only sent after successful pushes.
- Error messages are rate-limited so Telegram does not become noisy.
- A successful scan after a failure sends a recovery message.
- Duplicate Telegram alerts are rare but possible if Telegram accepts a message and the process stops before KV acknowledgement. The system prioritizes not missing LMS changes.

## Official References

- GitHub Actions secrets: https://docs.github.com/actions/security-guides/using-secrets-in-github-actions
- GitHub scheduled workflows: https://docs.github.com/actions/using-workflows/events-that-trigger-workflows
- Cloudflare KV: https://developers.cloudflare.com/kv/get-started/
- Cloudflare Cron Triggers: https://developers.cloudflare.com/workers/configuration/cron-triggers/
- Telegram bots: https://core.telegram.org/bots/tutorial
