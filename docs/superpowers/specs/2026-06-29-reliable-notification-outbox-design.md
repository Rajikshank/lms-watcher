# Reliable Notification Outbox Design

## Goal

Make LMS change delivery at-least-once without increasing routine Telegram
noise. Preserve the working crawler, selected-course filters, screenshots,
Cloudflare KV snapshot, Cloudflare scheduler, and native GitHub scheduler.

The system prioritizes not missing an LMS change. Telegram does not provide an
idempotency key, so a process crash after Telegram accepts a message but before
KV confirms it can still produce a rare duplicate. The design minimizes that
window and prevents a partial batch failure from resending the whole batch.

## Invariants

- A newly detected change is persisted before its source snapshot advances.
- Text delivery is authoritative; screenshot delivery is best-effort.
- A screenshot failure never leaves a successfully delivered text alert pending.
- A pending alert is removed only after Telegram text delivery succeeds.
- More than 15 changes are retained and delivered, not replaced by an overflow
  message and forgotten.
- Routine successful scans stay silent.
- Repeated instances of the same failure do not repeatedly notify Telegram.
- Existing KV data remains compatible; missing new keys mean an empty outbox
  and no active incident.

## KV Notification Outbox

Add the KV key `lms-watcher:notification-outbox`. It stores a versioned object
containing pending entries. Each entry contains a deterministic ID, discovery
time, attempt count, and the complete `Change` needed to format its message.

The deterministic ID combines change kind, LMS item identity, and the relevant
fingerprint. Re-detecting the same change after an interrupted run merges with
the existing entry instead of creating another pending alert.

Each successful scan follows this order:

1. Read snapshot, scan status, and outbox.
2. Crawl and filter the configured LMS courses.
3. Diff the previous snapshot against current items.
4. Merge new changes into the outbox and persist it.
5. Persist the current snapshot.
6. Deliver pending entries sequentially.
7. After each successful text message, remove that entry and persist the
   outbox immediately.
8. Attempt its screenshot after removal. Screenshot failure is logged but does
   not restore the text entry.

If outbox persistence fails, the snapshot does not advance. If snapshot
persistence fails afterward, the next scan re-detects changes but deterministic
IDs prevent duplicate pending entries. If Telegram fails, the undelivered entry
and every later entry remain for the next run.

The watcher drains every pending entry during a successful run. This preserves
individual, clear change notifications while remaining quiet when nothing has
changed. Initialization does not enqueue historical items.

## Quiet Incident Health

Extend scan status with optional incident fields: error fingerprint,
consecutive failure count, incident start time, and last error notification
time. Older status records remain valid.

On failure:

- Persist the failed status whenever KV is reachable.
- Notify Telegram when the error fingerprint is new.
- Suppress an identical repeated error for six hours.
- After six hours, send one reminder if the incident is still active.

On recovery:

- Send one short recovery message only when the previous stored status was
  failed.
- Clear incident fields in the successful status.

Periodic healthy Telegram reports are disabled by default. Existing scan-gap
warnings remain because they indicate that neither scheduler produced a timely
successful scan. Deployment notifications remain push-only.

## Scheduler Retry

The Cloudflare scheduler retries GitHub workflow dispatch up to three times
with short increasing delays. Each failure records the HTTP status and GitHub
request ID without logging the token. The scheduled invocation fails visibly
only after all attempts are exhausted. The native GitHub cron remains an
independent fallback.

## Diagnostics

Scan status adds pending outbox count and consecutive failure count. Successful
console output includes detected changes, text alerts delivered, screenshots
sent, and alerts still pending. `pnpm verify:status` reports the same values.

No LMS credentials, Telegram credentials, GitHub token, or Cloudflare token are
added to source, logs, snapshots, or the outbox.

## Testing

Local ignored tests must prove:

- deterministic outbox IDs and duplicate merging;
- outbox persistence occurs before snapshot persistence;
- text success removes exactly one pending entry;
- partial Telegram failure keeps only undelivered entries;
- screenshot failure does not requeue delivered text;
- batches larger than 15 retain and deliver every change;
- repeated identical errors are suppressed for six hours;
- a changed error starts a new notification incident;
- recovery sends exactly one message;
- routine healthy scans remain silent;
- Cloudflare dispatch succeeds after a transient retry;
- all existing formatting, filtering, crawler, screenshot, and retry tests pass.

Live verification must include TypeScript, configuration, KV, calendar, Moodle
crawl, a no-change watcher run, GitHub Actions deployment, Worker deployment,
and a real Cloudflare-triggered workflow run that updates KV status.

## Rollout And Rollback

Implementation occurs on an isolated branch. Before merging, back up the
current outbox value if one exists and run every local and live verification
gate. Deploy the application first, then the Worker retry update.

Rollback disables no schedulers and deletes no KV data. Revert the reliability
commit and redeploy the previous Worker version. The old watcher ignores the
new outbox key and optional scan-status fields, so the existing snapshot remains
usable.
