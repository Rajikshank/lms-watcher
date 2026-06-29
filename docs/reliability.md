# LMS Watcher Reliability

The watcher has two independent schedulers:

- Cloudflare Worker Cron dispatches `watch.yml` every 15 minutes.
- GitHub Actions schedule remains enabled as a backup.

Both paths execute the same watcher. GitHub concurrency serializes overlapping
runs, and Cloudflare-triggered runs skip deployment checks and deployment
Telegram messages. LMS text and screenshot notification behavior is unchanged.

## Notification delivery

Detected LMS changes are staged in the Cloudflare KV notification outbox before
the scan snapshot advances. Telegram text is delivered at least once and each
entry is acknowledged immediately after text succeeds. If Telegram fails,
undelivered entries remain for the next run instead of causing the whole batch
to be forgotten. Batches are no longer truncated at 15 changes.

Screenshots remain best-effort follow-ups. Capture or photo-upload failure never
blocks or requeues a text alert. Telegram has no idempotency key, so a process
crash after Telegram accepts text but before KV acknowledges it can still cause
a rare duplicate; this is preferable to missing an LMS change.

## Quiet health alerts

Routine healthy Telegram messages are disabled by default. Set
`HEALTH_NOTIFICATIONS=true` to enable them and use
`STATUS_NOTIFICATION_HOURS` as their minimum interval.

A new failure sends one actionable error. Identical repeated failures stay
quiet for `ERROR_REMINDER_HOURS` (six hours by default), then send one reminder
if still unresolved. A successful scan after an incident sends one short
recovery message. Scan-gap warnings remain enabled and cannot stop crawling if
Telegram itself is unavailable.

Cloudflare retries transient GitHub network, rate-limit, and server failures up
to three times. Authentication and permission failures stop immediately because
retrying them cannot repair the credential.

## Required secret

Create a fine-grained GitHub personal access token restricted to the
`Rajikshank/lms-watcher` repository with **Actions: Read and write** permission.
Store it as the encrypted Cloudflare Worker secret `GITHUB_TOKEN`; never add it
to `wrangler.jsonc` or commit it.

```powershell
pnpm exec wrangler secret put GITHUB_TOKEN
pnpm scheduler:deploy
```

Cloudflare deployment uses `CLOUDFLARE_ACCOUNT_ID` and
`CLOUDFLARE_API_TOKEN`. The API token needs Workers Scripts edit permission.

## Verification and logs

```powershell
pnpm scheduler:check
pnpm scheduler:logs
pnpm verify:status
```

Status output includes alerts delivered, alerts still pending, failure streak,
and the latest successful scan timestamp.

Cloudflare dashboard path: **Workers & Pages > lms-watcher-scheduler > Logs**.
A successful cron entry says `Watcher workflow dispatched` and includes the
GitHub request ID. A failed dispatch is logged as an error and marks the Worker
invocation failed. GitHub run history then shows the resulting
`workflow_dispatch` run with source `cloudflare-cron`.

## Rollback

Disable or delete the `*/15 * * * *` Cron Trigger in Cloudflare first. The
native GitHub schedule continues to run. Revert the scheduler commit only if
the repository changes also need to be removed; LMS snapshot and KV data do not
need to be changed.
