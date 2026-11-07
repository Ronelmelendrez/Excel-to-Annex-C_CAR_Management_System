# Excel-to-Annex-C CAR Management System

A staff-facing application for reviewing household records and preparing Case
Assessment Reports (CARs) in the Annex C format.

**Stack:** React · TypeScript · Vite · Supabase  
**Status:** Imports and CAR review decisions are paused. Some backend endpoints
and security-test files are placeholders. See [Known limitations](#known-limitations).

## Contents

- [Features](#features)
- [Pages and access](#pages-and-access)
- [Project structure](#project-structure)
- [Frontend folders by feature](#frontend-folders-by-feature)
- [Quick start](#quick-start)
- [Development and tests](#development-and-tests)
- [Backend overview](#backend-overview)
- [Security notes](#security-notes)
- [Known limitations](#known-limitations)

## Features

| Area | Available functionality |
|---|---|
| Authentication | Supabase sign-in, session restoration, password recovery, disabled-account handling |
| Dashboard | Role-scoped metrics and recent activity |
| Households | Search/filter records; view member and source-row details |
| CAR authoring | Create and edit drafts from households with exactly one valid `GRANTEE=Yes`; view history and revisions |
| Annex C reports | Read-only preview and Word download using the bundled template |
| Audit | Filter and inspect event metadata as an administrator or auditor |

Household corrections and member exclusions are not available in the UI.
Creating a CAR draft does not approve or finalize it.

## Pages and access

| Page | Who can access it | Availability |
|---|---|---|
| `/` | Public | Landing page |
| `/login`, `/forgot-password`, `/reset-password` | Public | Authentication |
| `/dashboard` | Active users with an approved staff role | Available |
| `/households` | Signed-in users | Available; read-only |
| `/cars` | `admin`, `case_worker` | Draft authoring |
| `/templates` | `admin`, `case_worker`, `reviewer` | Read-only report generator |
| `/audit` | `admin`, `auditor` | Audit trail |
| `/imports` | `admin`, `operator` | Paused notice |
| `/review` | `reviewer` | Paused notice |
| `/documents` | Signed-in users | Redirects to `/dashboard` |

Dashboard roles are `admin`, `operator`, `case_worker`, `reviewer`, and
`auditor`. Administrators see system-wide dashboard metrics; other dashboard
roles see assigned data.

## Project structure

| Path | Contents |
|---|---|
| `apps/web/` | React web application |
| `apps/web/src/app/` | Router, auth provider, route guards, and app shell |
| `apps/web/src/features/` | Authentication and application features |
| `apps/web/src/shared/` | Supabase/API helpers and shared utilities |
| `packages/contracts/` | Shared contracts |
| `supabase/functions/` | Deno Edge Functions and shared server helpers |
| `supabase/migrations/` | Database schema, RLS, and storage migrations |
| `supabase/seed/` | Development seed placeholder |
| `scripts/` | Annex C document utilities |
| `tests/security/` | Security test placeholders |

### Frontend folders by feature

The web app keeps feature-specific UI, hooks, helpers, assets, and tests
together under `apps/web/src/features/`:

```text
apps/web/src/features/
├── admin/       components/  hooks/  __tests__/
├── audit/       components/  hooks/  lib/  __tests__/
├── auth/        components/  hooks/  __tests__/
├── cars/        components/  hooks/  lib/  __tests__/
├── dashboard/  components/  hooks/  lib/  __tests__/
├── documents/  components/  hooks/  lib/  __tests__/
├── households/ components/  hooks/  lib/  __tests__/
├── imports/    components/  hooks/  lib/  __tests__/
├── landing/    components/  __tests__/
├── review/     components/  hooks/  lib/  __tests__/
├── roles/      components/  hooks/  __tests__/
└── templates/  assets/  components/  lib/  __tests__/
```

Not every feature needs every subfolder. Shared application setup lives in
`apps/web/src/app/`, while reusable code used across features belongs in
`apps/web/src/shared/`.

**Technology:** React 18, TypeScript, Vite 5, Tailwind CSS, Supabase Auth,
PostgreSQL, Storage, Deno Edge Functions, `xlsx`, `docxtemplater`, `pizzip`,
Vitest, jsdom, and Testing Library.

## Quick start

### Prerequisites

- Node.js and npm (the repository does not pin a Node version; use a version
  supported by Vite 5)
- A configured Supabase project for normal app use
- Deno and the Supabase CLI to serve or deploy Edge Functions

### 1. Install dependencies

From the repository root:

```sh
npm ci
npm --prefix apps/web ci
```

### 2. Configure Supabase

Copy the example environment file:

```sh
cp apps/web/.env.example apps/web/.env.local
```

On Windows PowerShell:

```powershell
Copy-Item apps\web\.env.example apps\web\.env.local
```

Set the project URL and browser-safe anon/publishable key in
`apps/web/.env.local`:

```dotenv
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
# Optional. Defaults to <project URL>/functions/v1
VITE_API_BASE=
```

The app shows an unavailable screen if the URL or anon key is empty. The
demo-mode note in `.env.example` is outdated.

> **Never put a Supabase `service_role` or secret key in a `VITE_*` variable.**
> Vite exposes those variables to the browser.

### 3. Start the app

```sh
npm run dev
```

The Vite development server prints its local URL when ready.

## Development and tests

| Task | Command |
|---|---|
| Run web app | `npm run dev` |
| Build from repository root | `npm run build:web` |
| Build web app directly | `npm --prefix apps/web run build` |
| Preview production build | `npm --prefix apps/web run preview` |
| Run frontend tests | `npm --prefix apps/web test` |
| Run one test file | `npm --prefix apps/web test -- src/features/households/__tests__/households.test.tsx` |
| Check Annex C rendering | `node scripts/render-annex-c-check.mjs` |

Vitest runs in jsdom and clears Supabase credentials. There is no root-level
test script.

### Supabase backend setup

Apply SQL files in `supabase/migrations/` in numeric order to the configured
project. This repository does not include `supabase/config.toml` or a complete
local-stack bootstrap process. The development seed is a placeholder, so
provision profiles and roles through an approved administrative workflow.

For local function serving, copy `supabase/functions/.env.example` to
`supabase/functions/.env` and set values from the local Supabase stack. Keep
secrets out of source control. Deployed functions should receive server
secrets from the Supabase project environment.

## Backend overview

The web app uses Supabase Auth and calls Edge Functions for application APIs.
Migrations define profiles, roles, settings, imports, households, CARs,
templates, exports, audit records, and RLS policies.

Main Edge Function areas:

- `auth-me` and administrative user, role, and access-mode functions
- `dashboard`, `households`, `cars`, and `audit`
- `imports` (currently disabled)
- `review`, `templates`, and `documents` (unavailable or placeholder APIs)

Protected frontend routes are not the security boundary. Edge Functions must
verify JWTs, active profile status, roles, and record scope. Functions use a
server-side service-role client, which bypasses RLS.

## Security notes

- Treat browser code and frontend validation as untrusted.
- Enforce authorization and record scoping on the server.
- Keep the service-role key and all secrets out of the web app and source
  control.
- The files in `tests/security/` are currently empty placeholders; they do not
  verify RLS, privacy, or IDOR protections.

## Known limitations

- **Imports are paused.** The UI displays a notice and the imports function is
  disabled.
- **CAR review is paused.** Review decisions cannot currently be recorded.
- **Document backend is incomplete.** The report generator uses the bundled
  Word template; full template-management and document-job APIs are not
  implemented.
- **Household changes are unavailable.** Corrections and member exclusions
  cannot be made in the UI.
- **Local Supabase setup is not turnkey.** A project config and populated
  development seed are not included.