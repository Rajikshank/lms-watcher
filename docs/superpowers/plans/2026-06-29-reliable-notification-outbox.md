# Reliable Notification Outbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver every detected LMS change at least once while keeping routine Telegram health traffic quiet and making scheduler dispatch tolerant of transient GitHub failures.

**Architecture:** A versioned Cloudflare KV outbox stages deterministic change entries before the snapshot advances and acknowledges each entry immediately after text delivery. Pure incident-health functions decide first-error, reminder, and recovery notifications. The Cloudflare scheduler retries only transient GitHub errors while the native GitHub cron remains independent.

**Tech Stack:** TypeScript, Node test runner through `tsx`, Playwright, Cloudflare KV and Workers, GitHub Actions, Telegram Bot API.

---

## File Map

- Create `src/notification-outbox.ts`: outbox types, deterministic IDs, merge/remove/attempt operations, staging order, and delivery loop.
- Modify `src/storage/cloudflare-kv.ts`: read and write the versioned outbox key.
- Modify `src/notify/change-delivery.ts`: acknowledge successful text before screenshot capture.
- Create `src/incident-health.ts`: pure incident suppression and recovery decisions.
- Modify `src/types.ts`: optional incident and outbox diagnostic fields on `ScanStatus`.
- Modify `src/env.ts`: quiet-health controls with routine messages disabled by default.
- Modify `src/scan-report.ts`: recovery format and outbox/incident diagnostics.
- Modify `src/main.ts`: stage, snapshot, drain, quiet health, and recovery orchestration.
- Modify `scheduler/dispatcher.ts`: typed GitHub dispatch errors with retryability.
- Modify `scheduler/worker.ts`: three-attempt transient retry with injected delay seam.
- Modify `.env.example` and `docs/reliability.md`: document quiet-health and outbox behavior.
- Test using ignored local files beside each module so tests remain local as requested.

### Task 1: Versioned KV Outbox

**Files:**
- Create: `src/notification-outbox.ts`
- Modify: `src/storage/cloudflare-kv.ts`
- Modify: `src/types.ts`
- Test: `src/notification-outbox.test.ts`

- [ ] **Step 1: Write failing tests for deterministic IDs, duplicate merging, removal, and attempt increments**

Use assignment changes with stable item IDs/fingerprints and assert that repeated merges produce one entry while changed fingerprints produce distinct entries.

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `pnpm exec tsx --test src/notification-outbox.test.ts`

Expected: failure because `notification-outbox.ts` does not exist.

- [ ] **Step 3: Implement the pure outbox interface**

Define `NotificationOutboxEntry`, `NotificationOutbox`, `emptyOutbox`, `outboxEntryId`, `mergeOutboxChanges`, `removeOutboxEntry`, and `incrementOutboxAttempt`. Use SHA-256 over change kind, item ID, and relevant fingerprint. Preserve insertion order.

- [ ] **Step 4: Add KV storage adapters**

Add `NOTIFICATION_OUTBOX_KEY`, `readNotificationOutbox`, and `writeNotificationOutbox`. A missing key returns an empty outbox at the caller; malformed versions fail visibly.

- [ ] **Step 5: Run focused and existing tests, then commit**

Run: `pnpm exec tsx --test src/notification-outbox.test.ts && pnpm test && pnpm exec tsc --noEmit`

Commit: `Add versioned notification outbox`

### Task 2: Safe Staging And Per-Message Acknowledgement

**Files:**
- Modify: `src/notification-outbox.ts`
- Modify: `src/notify/change-delivery.ts`
- Modify: `src/main.ts`
- Test: `src/notification-outbox.test.ts`
- Test: `src/notify/change-delivery.test.ts`

- [ ] **Step 1: Write failing tests for persistence order and partial delivery**

Assert outbox write precedes snapshot write. Assert a three-entry queue with failure on entry two permanently removes entry one and retains entries two and three. Assert a screenshot failure does not restore acknowledged text.

- [ ] **Step 2: Run focused tests and confirm RED for the missing orchestration**

Run: `pnpm exec tsx --test src/notification-outbox.test.ts src/notify/change-delivery.test.ts`

- [ ] **Step 3: Implement staging and draining**

Add `stageOutboxAndSnapshot` with injected writers and `drainNotificationOutbox` with injected persistence and delivery. Persist an incremented attempt before text. Add an `onTextSent` callback to change delivery and invoke it immediately after text succeeds and before screenshot work.

- [ ] **Step 4: Integrate the outbox into `main.ts`**

Read outbox with snapshot/status. Initialization writes the first snapshot without historical entries. Normal scans merge all filtered changes, persist outbox, persist snapshot, then drain every pending entry. Remove the 15-change truncation and overflow message. Record detected, delivered, pending, and screenshot counts accurately.

- [ ] **Step 5: Run focused, complete, and type checks, then commit**

Run: `pnpm exec tsx --test src/notification-outbox.test.ts src/notify/change-delivery.test.ts && pnpm test && pnpm exec tsc --noEmit`

Commit: `Deliver LMS changes through KV outbox`

### Task 3: Quiet Incident Health

**Files:**
- Create: `src/incident-health.ts`
- Modify: `src/types.ts`
- Modify: `src/env.ts`
- Modify: `src/scan-report.ts`
- Modify: `src/main.ts`
- Modify: `.env.example`
- Test: `src/incident-health.test.ts`
- Test: `src/scan-report.test.ts`

- [ ] **Step 1: Write failing tests for first error, suppression, reminder, and recovery**

Use fixed timestamps. Verify a new fingerprint notifies, the same fingerprint before six hours is silent, the same fingerprint after six hours reminds once, a changed fingerprint notifies immediately, and only a prior failed status triggers recovery.

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `pnpm exec tsx --test src/incident-health.test.ts src/scan-report.test.ts`

- [ ] **Step 3: Implement incident decisions and optional status fields**

Add SHA-256 error fingerprints, incident start, last notification, consecutive failures, pending notifications, and delivered notifications. Keep every field optional for compatibility with old KV JSON.

- [ ] **Step 4: Integrate quiet health behavior**

Add `HEALTH_NOTIFICATIONS` defaulting to false and `ERROR_REMINDER_HOURS` defaulting to six. Routine health reports require explicit opt-in. Gap warnings and recovery messages are best-effort and cannot stop crawling or snapshot updates. Failure alerts use incident decisions; when KV is unavailable, send the actionable error because suppression state cannot be trusted.

- [ ] **Step 5: Run focused, complete, and type checks, then commit**

Run: `pnpm exec tsx --test src/incident-health.test.ts src/scan-report.test.ts && pnpm test && pnpm exec tsc --noEmit`

Commit: `Make watcher health alerts incident based`

### Task 4: Transient Worker Dispatch Retry

**Files:**
- Modify: `scheduler/dispatcher.ts`
- Modify: `scheduler/worker.ts`
- Test: `scheduler/dispatcher.test.ts`

- [ ] **Step 1: Write failing tests for transient and permanent failures**

Verify HTTP 500 followed by 204 makes two requests, network failure followed by 204 retries, HTTP 401 makes one request, and three transient failures rethrow with the final GitHub request ID.

- [ ] **Step 2: Run the scheduler test and confirm RED**

Run: `pnpm exec tsx --test scheduler/dispatcher.test.ts`

- [ ] **Step 3: Implement typed retryability and three attempts**

Throw `GitHubDispatchError` with status, request ID, and `retryable` for 429 and 5xx. Treat network errors as retryable in the worker. Inject a wait function for zero-delay tests. Log attempt numbers without credentials.

- [ ] **Step 4: Run scheduler, complete, type, and bundle checks, then commit**

Run: `pnpm exec tsx --test scheduler/dispatcher.test.ts && pnpm test && pnpm exec tsc --noEmit && pnpm scheduler:check`

Commit: `Retry transient scheduler dispatch failures`

### Task 5: Documentation And Full Verification

**Files:**
- Modify: `docs/reliability.md`
- Modify: `.env.example`

- [ ] **Step 1: Document outbox, incident health, retry, diagnostics, and rollback**

State that routine health is off by default, real changes remain immediate, screenshots remain best-effort, and the delivery guarantee is at-least-once.

- [ ] **Step 2: Run all local gates**

Run: `pnpm test`

Run: `pnpm exec tsx --test src/notification-outbox.test.ts src/incident-health.test.ts scheduler/dispatcher.test.ts`

Run: `pnpm exec tsc --noEmit`

Run: `pnpm scheduler:check`

Run: `pnpm verify:config`

Run: `pnpm verify:kv`

Run: `pnpm verify:calendar`

Run: `pnpm verify:moodle`

Run: `pnpm watch`

Run: `pnpm verify:status`

- [ ] **Step 3: Commit documentation and merge only after every gate passes**

Commit: `Document reliable watcher delivery`

- [ ] **Step 4: Push and verify GitHub deployment**

Push `main`, poll the exact push SHA, and require every workflow step to complete successfully. Confirm deployment Telegram notification remains push-only.

- [ ] **Step 5: Deploy and verify Cloudflare Worker**

Run `pnpm scheduler:deploy`. Confirm `GITHUB_TOKEN` remains `secret_text`, the cron remains `*/15 * * * *`, and a real `workflow_dispatch` run completes successfully after deployment.

- [ ] **Step 6: Verify production state and rollback readiness**

Confirm KV status has a newer healthy timestamp, outbox pending count is zero on a no-change scan, local and remote `main` hashes match, and the worktree is clean. If any new behavior fails, revert only the reliability commits and redeploy the prior Worker version without modifying the existing snapshot.
