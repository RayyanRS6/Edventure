# Deploying Edventure

One environment = one Supabase project + the Render services in [`render.yaml`](../render.yaml) +
an EAS channel for the app. Create **staging** first, rehearse the release and a restore there, then
repeat for **production**. Region: Singapore for everything (see PLAN.md §5).

| Piece | Where | Notes |
|---|---|---|
| Edventure API | Render web service `edventure-api` | The single backend for website and app. `/health` for checks |
| Background worker | Render worker `edventure-worker` (Docker) | Same codebase, `worker` entry. Chromium for PDFs |
| Malware scanner | Render private service `edventure-clamav` | Uploads stay quarantined until scanned |
| Admin website | Render web service `edventure-web` | UI only; proxies `/api` to the API privately |
| Database, Auth, Storage | Supabase (paid plan with point-in-time recovery) | |
| Android/iOS app | Expo EAS build + submit, EAS Update channels | |

## 1. Supabase project

1. Create the project in **Southeast Asia (Singapore)** on a paid plan and enable
   **Point-in-Time Recovery** (Database → Backups).
2. **Auth → Providers → Email:** keep Email enabled, **disable sign-ups**, and turn off email
   confirmation. Accounts are created only by the API with the service-role key; their internal
   email is an opaque `<account-id>@AUTH_IDENTITY_DOMAIN` that is never mailed.
3. **Auth → JWT signing keys:** use asymmetric signing keys. The API verifies access tokens
   against the project's JWKS (`/auth/v1/.well-known/jwks.json`).
4. **Auth → Sessions:** access token expiry 15 minutes; refresh-token rotation and reuse detection
   on.
5. **Auth → MFA:** enable TOTP (administrators must enrol).
6. **Storage:** create a **private** bucket named `edventure-private` (no public access). The API
   issues short-lived signed URLs only after its own permission checks.
7. Note the project URL, anon key and service-role key. The service-role key is a backend secret:
   it goes into Render only, never into the website or the app.

### Database roles and connection strings

Migrations run as the owner (`postgres`) and create the non-owner application role
`edventure_app` (`NOLOGIN`, `NOBYPASSRLS`). After the first migration, give it a password:

```sql
ALTER ROLE edventure_app WITH LOGIN PASSWORD '<long random secret>';
```

| Variable | Role | Connection |
|---|---|---|
| `DATABASE_URL` | `edventure_app` | Supavisor **transaction** pooler (port 6543). The client already disables prepared statements |
| `DATABASE_OWNER_URL` | `postgres` | **Session** pooler or direct connection (port 5432): migrations, provisioning and the job queue need session features |

Row-level security is enforced for `edventure_app`; never point `DATABASE_URL` at the owner role.

## 2. Render

1. Create a Blueprint from this repository; Render reads `render.yaml`.
2. Fill in every `sync: false` value (the same values for API and worker):
   `DATABASE_URL`, `DATABASE_OWNER_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, `AUTH_IDENTITY_DOMAIN` (e.g. `accounts.example.com`),
   `PUBLIC_API_URL` (e.g. `https://api.example.com`), `WEB_ORIGINS` (e.g.
   `https://admin.example.com`) and `EXPO_ACCESS_TOKEN` (push delivery).
3. Add custom domains: `api.<domain>` → `edventure-api` (the app calls it directly) and
   `admin.<domain>` → `edventure-web`.
4. Deploy. Each API release runs `npm run start:migrate` (bundled `dist/migrate.js`) before
   going live. Migrations must stay backward compatible because installed apps lag behind.
5. Check `https://api.<domain>/health` and sign in on the website.

The website's `/api` rewrite is compiled at build time from `EDVENTURE_API_ORIGIN` (the API's
private `host:port`), so redeploy the website if the API service is renamed.

## 3. First school

Provisioning is a platform action run with the owner connection, from a Render shell on
`edventure-api` in `apps/api` (migrations have already run as part of the deploy):

```bash
npx tsx scripts/provision-school.ts --code PILOT --name "Pilot School" --admin-username principal --admin-name "Principal Name" --operator "your.name"
```

The temporary password is printed once. The administrator must replace it and enrol MFA at first
sign-in. Everything else (years, classes, teachers, students, fee plans) is set up on the website;
bulk students/teachers use CSV imports.

## 4. Mobile app (EAS)

From `apps/mobile`:

1. `eas init` links the project; put the project ID in `EAS_PROJECT_ID` (needed for Expo push
   tokens) and the Expo access token in the API/worker `EXPO_ACCESS_TOKEN`.
2. Set the real API URLs in [`eas.json`](../apps/mobile/eas.json) (`staging` and `production`
   profiles) — `EXPO_PUBLIC_API_URL` must be the public `https://api.<domain>`.
3. Configure push credentials (FCM for Android, APNs key for iOS) with `eas credentials`.
4. Build and distribute:

```bash
eas build --profile staging --platform all
```

```bash
eas build --profile production --platform all
```

```bash
eas submit --profile production --platform all
```

Ship JavaScript-only fixes with `eas update --channel production`. When a release needs a newer
native build, raise `MIN_MOBILE_VERSION` on the API **after** the store release is live: older apps
then show "Please update the app" instead of failing.

## 5. Release checklist

- `npm run typecheck`, `npm test`, `npm run check:i18n` and `npm run build` pass.
- New migrations are additive (no dropped/renamed columns still used by the previous release).
- Staging deploy + smoke test in English and Urdu on web, Android and iOS.
- Production deploy; watch error rates, queue age and failed jobs for 30 minutes
  (see [operations.md](operations.md)).
