# Operating Edventure

Runbook for monitoring, releases, backups and recovery. Targets from PLAN.md §5: lose at most
**15 minutes** of database changes and **1 hour** of files, and restore service within **8 hours**.

## Monitoring

Send Render logs (JSON, one line per request with `requestId`) to your log platform and alert on:

| Signal | Where to look | Alert when |
|---|---|---|
| API errors and latency | Render metrics for `edventure-api`; `statusCode >= 500` in logs | 5xx > 1% for 5 min, p95 > 1.5 s |
| Database saturation, slow queries | Supabase → Reports / Query performance | CPU > 80%, connections near the pool limit |
| Queue age and failed jobs | `pgboss.job` (owner connection) | oldest `created` job > 10 min; any job in the `dead-letter` queue |
| Sign-in / account setup failures | `app.accounts` with `provisioning_state = 'failed'` | any, for more than an hour |
| Import and bank-reconciliation failures | `app.import_batches` with `state = 'failed'` | any |
| Push delivery failures | `app.notification_deliveries` with `status = 'failed'` | failure rate > 5% per day |
| File scanning | `app.files` with `lifecycle = 'quarantine'`; scanner service health | any file quarantined > 30 min |
| Storage growth | Supabase → Storage usage | month-over-month jump > 25% |
| Backup freshness | Supabase PITR status; last object in the S3 backup bucket | older than 15 min (DB) / 1 h (files) |

Useful queries (run as the owner in the Supabase SQL editor):

```sql
select name, state, count(*), min(created_on) as oldest
from pgboss.job where state in ('created', 'retry', 'failed')
group by name, state order by oldest;
```

```sql
select school_id, count(*) from app.accounts where provisioning_state = 'failed' group by school_id;
```

Administrators can retry account setup themselves ("Set up sign-in" on the person's page). Failed
imports are re-uploaded after fixing the file; reports can simply be requested again.

## Releases and rollback

- Every release: CI (typecheck, tests, i18n check, build) → staging → production. Migrations run
  automatically before the new API version receives traffic.
- **Additive changes only.** Add columns/tables/endpoints; stop using old ones in one release and
  remove them in a later one. Old mobile apps keep calling the API for weeks.
- **Rolling back the API/worker/website:** redeploy the previous Render deploy. This is safe as long
  as the migration that shipped with the bad release was additive. Never "down-migrate" production;
  fix forward with a new migration.
- **Rolling back the app:** `eas update:republish` the previous update on the channel, or roll back
  the store release. To force old native builds to update, raise `MIN_MOBILE_VERSION` (they
  receive `426` and show the update screen).

## Backups

| What | How | Recovery point |
|---|---|---|
| Database | Supabase point-in-time recovery (paid plan) | ≤ 15 minutes |
| Files (Supabase Storage bucket `edventure-private`) | Hourly copy to an **encrypted, versioned** AWS S3 bucket (separate account, object lock or MFA delete) | ≤ 1 hour |
| Configuration | `render.yaml`, `eas.json` and migrations in git; secrets in a password manager | — |

Supabase database backups do **not** include Storage objects, so the file copy is required. Set it
up as a Render cron job (or any scheduler) that syncs the bucket through Supabase Storage's
S3-compatible endpoint, for example with rclone:

```bash
rclone sync supabase:edventure-private s3backup:edventure-files-backup --checksum --fast-list
```

Use S3 credentials that can write but not delete (versioning keeps prior copies). Keep at least 35
days of versions — longer than the 30-day account-recovery window.

## Restoring

Rehearse this on **staging** before go-live and at least every quarter; record the times.

1. **Freeze writes.** Scale `edventure-worker` to zero and put `edventure-api` in maintenance
   (suspend the service) so no new jobs or notifications are produced.
2. **Restore the database** with Supabase PITR to the chosen time (or into a new project for a
   drill). Custom roles are part of the database: confirm `edventure_app` exists and still lacks
   `BYPASSRLS`:

   ```sql
   select rolname, rolbypassrls, rolcanlogin from pg_roles where rolname = 'edventure_app';
   ```

3. **Restore files** from the S3 backup into the bucket (copy the versions as of the same time).
   Then compare references with objects: every `app.files` row with `lifecycle = 'available'` must
   have its `object_key` in the bucket; list any gaps before reopening.
4. **Re-apply security decisions made after the restore point.** Anything revoked after that time
   is not in the restored data, so:
   - Sign everyone out — revoke all application sessions so stolen or revoked sessions cannot
     come back:

     ```sql
     update app.app_sessions set revoked_at = now(), revoked_reason = 'restore' where revoked_at is null;
     ```

   - From the audit log of the old database (or the log platform), re-apply account suspensions,
     role removals and deletion requests made after the restore point.
   - Deletion requests whose recovery window has ended are processed again by the nightly
     `retention-process` job (02:15 Pakistan time); nothing needs to be replayed by hand.
5. **Avoid replaying external actions.** Before starting the worker, mark queued push deliveries
   older than the restore point as retired so students do not get duplicate notifications:

   ```sql
   update app.notification_deliveries set status = 'retired' where status = 'pending';
   ```

   Bank imports and payments carry transaction IDs and idempotency keys, so re-importing a
   statement does not create duplicate receipts.
6. **Reopen.** Resume the API, then the worker. Sign in on web and app in English and Urdu, open
   a file, generate a report, and check the job queue drains.
7. **Tell the school** what time the data was restored to and which changes (if any) must be
   re-entered — typically roll calls or payments recorded after the restore point.

## Access and credentials

- Platform operators provision schools (`provision-school` script) and are the only people with
  the owner database URL and service-role key.
- School administrators reset staff and student passwords themselves; a new temporary password is
  shown once. An administrator who loses their authenticator needs another administrator (or a
  platform operator) to reset their sign-in.
- Rotate `SUPABASE_SERVICE_ROLE_KEY`, database passwords and `EXPO_ACCESS_TOKEN` at least yearly
  and whenever someone with access leaves.
