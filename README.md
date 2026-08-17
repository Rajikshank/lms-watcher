<p align="center">
  <img src="assets/lms-watcher-logo.svg" alt="LMS-Watcher" width="720">
</p>

# LMS-Watcher

LMS-Watcher is a Telegram alert system for the **SLTC Moodle LMS** at `https://lms.sltc.ac.lk`. It checks your selected SLTC modules and sends a Telegram message when it finds new or changed assignments, quizzes, resources, forums, or calendar deadlines.

The watcher stays quiet when nothing changes. Text alerts are the reliable fallback, and screenshots are attached when the run can capture them safely.

## Who This Is For

This project is for SLTC students who want automatic Telegram notifications from their own LMS account. Each student should use their own LMS login, Telegram bot, GitHub account, and Cloudflare account.

## Quick Start

Install the project dependencies:

```bash
pnpm install
```

Start the guided setup:

```bash
pnpm setup
```

The setup wizard explains each step in simple language and helps you configure:

- SLTC LMS login
- Telegram bot and chat ID
- Moodle calendar export link
- Modules to watch
- Cloudflare KV storage
- GitHub Actions secrets

To preview the wizard without saving anything:

```bash
pnpm setup:dry-run
```

To check whether your computer has the needed tools:

```bash
pnpm setup:doctor
```

## What You Need

- SLTC LMS username and password
- Telegram account
- GitHub account
- Cloudflare account
- Node.js 22
- pnpm

Do not share your `.env`, bot token, GitHub token, Cloudflare token, or SLTC password.

## Telegram Alert Example

```text
[NEW] New assignment
Course: Software Quality Assurance
Title: Assignment 1
Open: https://lms.sltc.ac.lk/mod/assign/view.php?id=12345
Category: assignment
```

If screenshot capture is available, the watcher may also attach a logged-in screenshot. If screenshot capture fails, the text alert still sends.

## Choosing Modules

The best way is to use the course ID from your SLTC LMS course URL.

Example course URL:

```text
https://lms.sltc.ac.lk/course/view.php?id=3549
```

Example `.env` value:

```env
WATCHED_COURSE_IDS=3549,3555,3556
```

You can also watch by course name or course code:

```env
WATCHED_COURSE_NAMES=Software Quality Assurance,Cloud Security
```

Leave both values empty only if you want to watch every visible SLTC LMS module.

## Verify Your Setup

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

| Command | What it checks |
| --- | --- |
| `pnpm setup:check` | Local setup and common mistakes |
| `pnpm verify:config` | Required environment values and watched modules |
| `pnpm verify:kv` | Cloudflare KV storage access |
| `pnpm verify:telegram` | Telegram bot and chat connection |
| `pnpm verify:calendar` | Moodle calendar export feed |
| `pnpm verify:moodle` | SLTC LMS login and item crawling |
| `pnpm watch` | One real watcher scan |

The first successful run creates a baseline. After that, only new or changed LMS items are sent to Telegram.

## How It Runs

1. GitHub Actions runs the watcher on schedule.
2. The watcher logs in to SLTC Moodle.
3. It checks selected module pages and the Moodle calendar feed.
4. It compares the latest scan with the previous scan stored in Cloudflare KV.
5. New or changed items are sent to Telegram.
6. Failed Telegram text alerts are stored as pending and retried later.

A Cloudflare Worker scheduler can also trigger the GitHub workflow as a backup schedule.

## Common Problems

### I do not get notifications

Usually this means nothing new was added after your first baseline scan.

```bash
pnpm verify:status
pnpm verify:moodle
```

### The wrong modules are watched

Check your module filters:

```bash
pnpm verify:config
```

### Telegram messages do not send

Make sure you pressed **Start** on your bot, the bot token is correct, and the chat ID is correct.

```bash
pnpm verify:telegram
```

### SLTC LMS login fails

Use one of these values for `LMS_BASE_URL`:

```env
LMS_BASE_URL=https://lms.sltc.ac.lk
```

or:

```env
LMS_BASE_URL=https://lms.sltc.ac.lk/login/index.php
```

Then run:

```bash
pnpm verify:moodle
```

### Screenshots are missing

Screenshots are best-effort. The important text notification still sends even when screenshots fail.

```env
TELEGRAM_SCREENSHOTS=true
MAX_SCREENSHOTS_PER_RUN=10
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

- Never commit `.env`.
- Never post tokens or passwords in screenshots.
- Rotate any token immediately if it is exposed.
- Use your own accounts and credentials.
- Review GitHub Actions secrets before sharing or publishing your fork.
