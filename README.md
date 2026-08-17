<p align="center">
  <img src="assets/lms-watcher-terminal-logo.svg" alt="LMS-Watcher" width="700">
</p>

# LMS-Watcher

**LMS-Watcher** sends Telegram alerts for the **SLTC Moodle LMS** at `https://lms.sltc.ac.lk`.

It watches your selected modules and notifies you about new or changed assignments, quizzes, resources, forums, and calendar deadlines. It stays quiet when nothing changes. Screenshots are attached when possible, but the text alert is always the reliable fallback.

## Highlights

- Watches selected SLTC modules by course ID or course name.
- Sends clear Telegram alerts for new and changed LMS items.
- Runs automatically with GitHub Actions.
- Stores scan history in Cloudflare KV to avoid repeated alerts.
- Retries failed text alerts on later runs.
- Includes a guided setup wizard for beginners.

## Quick Setup

```bash
pnpm install
pnpm setup
```

The setup wizard guides you through Telegram, SLTC LMS login, Moodle calendar, watched modules, Cloudflare KV, and GitHub Actions secrets.

Preview setup without saving anything:

```bash
pnpm setup:dry-run
```

Check local tools and common setup issues:

```bash
pnpm setup:doctor
```

## Requirements

- SLTC LMS account
- Telegram account
- GitHub account
- Cloudflare account
- Node.js 22
- pnpm

Keep your `.env`, LMS password, bot token, GitHub token, and Cloudflare token private.

## Select Modules

Use course IDs from SLTC LMS course URLs whenever possible.

```text
https://lms.sltc.ac.lk/course/view.php?id=3549
```

```env
WATCHED_COURSE_IDS=3549,3555,3556
```

You can also use course names or course codes:

```env
WATCHED_COURSE_NAMES=Software Quality Assurance,Cloud Security
```

Leave both values empty only if you want to watch every visible SLTC LMS module.

## Telegram Alert Example

```text
[NEW] New assignment
Course: Software Quality Assurance
Title: Assignment 1
Open: https://lms.sltc.ac.lk/mod/assign/view.php?id=12345
Category: assignment
```

## Verify Setup

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

| Command | Purpose |
| --- | --- |
| `pnpm setup:check` | Finds missing tools and common mistakes |
| `pnpm verify:config` | Checks environment values and watched modules |
| `pnpm verify:kv` | Confirms Cloudflare KV access |
| `pnpm verify:telegram` | Confirms Telegram bot and chat access |
| `pnpm verify:calendar` | Confirms Moodle calendar access |
| `pnpm verify:moodle` | Confirms SLTC LMS login and crawling |
| `pnpm watch` | Runs one real watcher scan |

The first successful scan creates the baseline. Telegram alerts are sent only for changes found after that baseline.

## How It Runs

1. GitHub Actions starts the watcher on schedule.
2. The watcher logs in to SLTC Moodle.
3. It scans selected module pages and the Moodle calendar feed.
4. It compares the latest scan with the previous scan in Cloudflare KV.
5. It sends new or changed items to Telegram.
6. Failed text alerts are saved and retried later.

A Cloudflare Worker scheduler can also trigger the same GitHub workflow as a backup schedule.

## Troubleshooting

No alerts usually means there were no new LMS changes after the baseline scan.

```bash
pnpm verify:status
pnpm verify:moodle
```

Wrong modules? Check your filters:

```bash
pnpm verify:config
```

Telegram not sending? Press **Start** on your bot, then verify the bot token and chat ID:

```bash
pnpm verify:telegram
```

SLTC login failing? Use one of these values:

```env
LMS_BASE_URL=https://lms.sltc.ac.lk
```

```env
LMS_BASE_URL=https://lms.sltc.ac.lk/login/index.php
```

Then run:

```bash
pnpm verify:moodle
```

## Useful Commands

```bash
pnpm setup
pnpm setup:dry-run
pnpm setup:doctor
pnpm setup:check
pnpm verify:status
pnpm scheduler:check
pnpm scheduler:logs
```

## Security

Never commit `.env`. Never share tokens or passwords in screenshots, chats, or public issues. If a secret is exposed, rotate it before running the watcher again.
