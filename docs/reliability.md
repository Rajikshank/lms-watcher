# LMS Watcher Reliability

The watcher has two independent schedulers:

- Cloudflare Worker Cron dispatches `watch.yml` every 15 minutes.
- GitHub Actions schedule remains enabled as a backup.

Both paths execute the same watcher. GitHub concurrency serializes overlapping
runs, and Cloudflare-triggered runs skip deployment checks and deployment
Telegram messages. LMS text and screenshot notification behavior is unchanged.

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
