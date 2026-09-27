# Edventure

School management for administrators, teachers and students: attendance, timetables, homework and
quizzes, exams and results, promotion, fees and bank reconciliation, announcements and reports —
in English and Urdu (right-to-left).

**One backend for every frontend.** A single API serves the admin website and the Android/iOS app.
Admin, teacher and student experiences are different screens over the same endpoints; only the
client files differ (`apps/web`, `apps/mobile`).

```
                  ┌──────────────────────────────┐
 Admin website ──▶│  apps/web (Next.js, UI only) │── /api/* proxy ─┐
                  └──────────────────────────────┘                 ▼
                                                   ┌─────────────────────────────┐
 Android / iOS app (apps/mobile, Expo) ──────────▶│ apps/api  REST /api/v1       │
   students · teachers · administrators            │ Fastify · Zod · Drizzle      │
                                                   └───────┬─────────────────────┘
                                   jobs (pg-boss)          │ Postgres (RLS per school)
                                   ┌───────────────┐       │ Supabase Auth · Storage
                                   │ apps/api      │◀──────┘
                                   │ worker entry  │  PDFs · imports · push · scans
                                   └───────────────┘
```

See [PLAN.md](PLAN.md) for the full product and technical plan.

## Repository

| Path | What it is |
|---|---|
| `apps/api` | The single backend: REST API (`src/server.ts`) and background worker (`src/worker.ts`) |
| `apps/web` | Admin website (Next.js 16). No server logic; `/api/*` is proxied to the API so session cookies stay first-party |
| `apps/mobile` | Expo SDK 57 app with student, teacher and admin experiences |
| `packages/contracts` | Zod schemas and types shared by the API and both clients |
| `packages/api-client` | Typed client; `web` (cookies + CSRF) and `mobile` (secure-store tokens) transports |
| `packages/i18n` | Shared English/Urdu strings, notification text, direction helpers |
| `packages/design-tokens` | Colors, spacing, typography used by web (CSS variables) and mobile |
| `scripts/check-i18n.mts` | Fails if any key used by either app is missing in English or Urdu |
| `docs/` | [Deployment](docs/deployment.md) and [operations/recovery](docs/operations.md) guides |

## Run it locally

Requirements: Node.js 22.12 or newer. No Docker is needed: development uses an embedded PostgreSQL
17, local sign-in and on-disk file storage.

```bash
npm install
```

```bash
cp apps/api/.env.example apps/api/.env
```

```bash
npm run db:start
```

Leave `db:start` running (PostgreSQL on port 54329, data in `.data/`). In another terminal:

```bash
npm run db:migrate
```

```bash
npm run db:seed
```

Then start the API, the worker and the website, each in its own terminal:

```bash
npm run dev:api
```

```bash
npm run dev:worker
```

```bash
npm run dev:web
```

Open <http://localhost:3000> and sign in with the demo school below. The worker is needed for
imports, reports/PDFs, push notifications and file scanning (uploads are marked clean immediately
when `SKIP_MALWARE_SCAN=true`). PDF rendering uses a local Chromium-based browser
(`PDF_BROWSER_CHANNEL=msedge` by default; use `chrome` on macOS/Linux or set `PDF_BROWSER_PATH`).

### Demo school

`npm run db:seed` creates school **DEMO**. Every demo account uses the password `Demo-Pass-2026`
(override with `DEMO_PASSWORD`). Demo accounts skip the first-sign-in password change and MFA.

| Experience | Username |
|---|---|
| Administrator (website and app) | `admin` |
| Teachers (app) | `t.ayesha`, `t.bilal`, `t.sana`, `t.imran`, `t.nadia` |
| Students (app) | printed by `npm run db:seed` (e.g. `first.last1`) |

### Mobile app

For a quick UI preview, Expo Go works without remote push notifications or persistent offline
storage. Drafts and cached data stay in memory and disappear when Expo Go closes. Use a development
build for push notifications and SQLCipher-encrypted offline storage.

```bash
cp apps/mobile/.env.example apps/mobile/.env
```

On a local LAN, the app takes the API host from Expo's Metro address and uses port 4000. Keep the
phone and computer on the same network, and start the API with `npm run dev:api`. Set
`EXPO_PUBLIC_API_URL` when using a tunnel, a remote backend, or a different API port. For an Android
emulator use `http://10.0.2.2:4000`; on a physical phone use your computer's LAN address, never
`localhost`. Build and install the development app once (`ios` works the same on macOS):

```bash
npm run android -w @edventure/mobile
```

After that, start the bundler for the development build whenever you work on the app:

```bash
npm run start:dev -w @edventure/mobile
```

To preview in Expo Go instead, run `npm run start:go -w @edventure/mobile` and scan its QR code.

Push notifications also need an EAS project (`eas init`) and `EAS_PROJECT_ID`.

## Everyday commands

| Command | Does |
|---|---|
| `npm run typecheck` | Type-checks every workspace |
| `npm test` | API test suite (embedded PostgreSQL; includes cross-school isolation tests) |
| `npm run check:i18n` | Verifies every English/Urdu key used by the website and the app |
| `npm run db:generate -w @edventure/api` | Generates a migration after changing `apps/api/src/db/schema` |
| `npm run openapi -w @edventure/api` | Writes `apps/api/openapi.json` for `/api/v1` |
| `npm run provision:school -w @edventure/api -- --code … --name … --admin-username … --admin-name … --operator …` | Platform action: new school and first administrator |
| `npm run build` | Production builds (API bundle, website) |

`TEST_LOG=1 npm test` shows server logs while tests run.

## How it fits together

- **Tenant isolation.** Every table carries `school_id`; PostgreSQL row-level security uses the school
  set per transaction. The API connects as `edventure_app`, a role without `BYPASSRLS`. The
  owner connection is used only for migrations, provisioning and the job-queue schema.
- **Sessions.** The website uses HttpOnly cookies plus a double-submit CSRF token; the app uses
  short-lived bearer tokens with rotating refresh tokens in the device keychain. Sessions are
  checked on every request, so suspensions and sign-outs take effect immediately. Administrators
  must use two-step verification.
- **Correctness.** Money and scores are exact decimal strings. Concurrent edits carry versions
  (stale writes get `409`). Payments, imports, roll calls, publication and promotion accept
  idempotency keys. History (placements, marks revisions, results revisions, audit log) is kept.
- **Urdu.** Shared strings live in `packages/i18n`; app-specific ones in `apps/web/src/i18n/web.ts`
  and `apps/mobile/src/i18n/mobile.ts`. School-authored content has optional Urdu variants that
  are shown when present and never machine-translated. PDFs are rendered by Chromium so Nastaliq
  shapes correctly.
- **Offline (app).** Only timetables, homework summaries, class rosters and roll-call drafts are
  stored, encrypted (SQLCipher, key in the keychain), bound to the school account, expired after
  seven days and wiped at sign-out. Roll calls are never submitted without the teacher's
  confirmation, and a changed class list must be reviewed first.

## Deploying

See [docs/deployment.md](docs/deployment.md) (Supabase, Render blueprint in `render.yaml`, EAS) and
[docs/operations.md](docs/operations.md) (monitoring, releases, backups and restore drills).
