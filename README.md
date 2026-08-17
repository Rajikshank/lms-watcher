<p align="center">
  <img src="assets/lms-watcher-terminal-logo.svg" alt="LMS-Watcher" width="700">
</p>

# LMS-Watcher

**LMS-Watcher** sends Telegram alerts for the **SLTC Moodle LMS** at `https://lms.sltc.ac.lk`.

It checks your selected modules on a schedule and notifies you when it finds new or changed assignments, quizzes, resources, forums, or calendar deadlines. When nothing changes, it stays quiet.

Text alerts are the reliable default. Screenshots are attached when available, but a screenshot failure will never block the main Telegram alert.

## Highlights

- Watches selected SLTC modules by course ID or course name.
- Sends clear Telegram alerts for new and changed LMS items.
- Supports assignments, quizzes, resources, forums, and calendar deadlines.
- Runs automatically with GitHub Actions.
- Stores scan history in Cloudflare KV so repeated alerts are avoided.
- Retries failed Telegram text alerts so important updates are not silently lost.
- Includes a guided setup wizard for beginners.

## Quick Setup

Install dependencies:

```bash
pnpm install
```

Start the setup wizard:

```bash
pnpm setup
```

The wizard guides you through Telegram, SLTC LMS login, Moodle calendar, watched modules, Cloudflare KV, and GitHub Actions secrets.

Preview the setup without saving anything:

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

## Module Selection

Use course IDs from SLTC LMS course URLs whenever possible.

Example URL:

```text
https://lms.sltc.ac.lk/course/view.php?id=3549
```

Example `.env`:

```env
WATCHED_COURSE_IDS=3549,3555,3556
```

You can also use course names or course codes:

```env
WATCHED_COURSE_NAMES=Software Quality Assurance,Cloud Security
```

Leave both values empty only if you want to watch every visible SLTC LMS module.

## Telegram Message Example

```text
[NEW] New assignment
Course: Software Quality Assurance
Title: Assignment 1
Open: https://lms.sltc.ac.lk/mod/assign/view.php?id=12345
Category: assignment
```

Screenshots may be attached for supported LMS pages. If screenshot capture fails, the text message still sends.

## Verify Everything

Run these commands after setup:

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
| `pnpm setup:check` | Finds missing tools and common setup mistakes |
| `pnpm verify:config` | Checks environment values and watched modules |
| `pnpm verify:kv` | Confirms Cloudflare KV access |
| `pnpm verify:telegram` | Confirms Telegram bot and chat access |
| `pnpm verify:calendar` | Confirms Moodle calendar feed access |
| `pnpm verify:moodle` | Confirms SLTC LMS login and item crawling |
| `pnpm watch` | Runs one real watcher scan |

The first successful scan creates the baseline. New Telegram alerts are sent only for changes found after that baseline.

## How It Runs

1. GitHub Actions starts the watcher on schedule.
2. The watcher logs in to SLTC Moodle.
3. It scans selected module pages and the Moodle calendar feed.
4. It compares the latest scan with the previous scan in Cloudflare KV.
5. It sends new or changed items to Telegram.
6. Failed text alerts are saved and retried on later runs.

A Cloudflare Worker scheduler can also trigger the same GitHub workflow as a backup schedule.

## Troubleshooting

No Telegram alerts usually means there were no new LMS changes after the baseline scan.

```bash
pnpm verify:status
pnpm verify:moodle
```

If the wrong modules are watched, check your filter values:

```bash
pnpm verify:config
```

If Telegram does not send, make sure you pressed **Start** on your bot and your bot token/chat ID are correct:

```bash
pnpm verify:telegram
```

If SLTC login fails, use one of these base URLs:

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

Never commit `.env`. Never share tokens or passwords in screenshots, chats, or public issues. If a secret is exposed, rotate it immediately before running the watcher again.
