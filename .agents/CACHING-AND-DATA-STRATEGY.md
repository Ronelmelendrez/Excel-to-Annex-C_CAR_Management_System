# Caching, Optimistic Updates & Refresh Strategy

Scope: web app, trusted API, Supabase, worker · Owner feature: F11 (cross-cutting), applies to F01–F10, F12
Status: Draft v1 · Requirement IDs: `REQ-CACHE-*` (see `REQUIREMENTS.md` §1.13)

## 1. Goals
1. **Refresh without pain.** Pressing F5, reopening a tab or returning later must not log the user out, lose their place, or show a blank screen.
2. **Fast and calm UI.** Show known data instantly, update it in the background, avoid spinners and layout jumps.
3. **Never wrong on important things.** Approvals, grantee resolution, roles and template activation always reflect the server.
4. **Safe with sensitive data.** This system holds personal, health, pregnancy and disability data. **Convenience never outranks privacy:** sensitive data is not persisted to disk by the browser.
5. **Cheap on the backend.** Fewer repeated queries, no thundering herds, predictable load.

## 2. Principles
| # | Principle |
|---|-----------|
| P1 | The server is the source of truth. The client cache is a **disposable copy**. |
| P2 | Cache by **sensitivity class** (§3), not by convenience. |
| P3 | **Pessimistic by default** for state transitions; **optimistic only** for low-risk, reversible edits (§6). |
| P4 | Every cache entry has an owner (user ID), a key, a freshness time and an invalidation rule. |
| P5 | Logout, user switch, disabled account or role change **clears** the cache. |
| P6 | State that should survive refresh lives in the **URL** or the **server**, not in component memory. |
| P7 | Immutable things (template versions, approved revisions, import versions) can be cached for a long time. Mutable things get short freshness and explicit invalidation. |

## 3. Data classification → caching rules
| Class | Examples | In-memory cache | Persisted in browser (localStorage / IndexedDB) | HTTP / CDN cache |
|-------|----------|:---:|:---:|:---:|
| **Public/static** | JS/CSS/fonts/icons (hashed files) | ✅ | ✅ (browser/CDN) | ✅ `immutable`, 1 year |
| **Config / non-sensitive** | Enums, status labels, role→nav map, UI prefs, filters | ✅ | ✅ | ❌ (API: `private`) |
| **Operational, non-PII** | Dashboard aggregates, import status, job status, template list | ✅ short TTL | ⚠️ optional, short TTL, cleared on logout | ❌ `no-store` / `private, max-age=0` |
| **Sensitive (PII)** | Households, members, grantee, CAR content, LRN, PCN, disability | ✅ short, per user | ❌ **never** | ❌ `no-store` |
| **Secrets / signed URLs** | Access tokens, signed download URLs | memory only | tokens only via Supabase SDK storage | ❌ `no-store` |
| **Immutable references** | Template version schema, approved revision snapshot | ✅ long | ⚠️ non-PII parts only (template schema) | ✅ by id+version, still `private` |

Rule: if in doubt, treat as sensitive.

## 4. Layers
```
Browser
  ├─ L0  HTTP cache / CDN        → static assets only (hashed, immutable)
  ├─ L1  Service worker (opt.)   → app shell only; NEVER API or file responses
  ├─ L2  Query cache (in memory) → server data, stale-while-revalidate (TanStack Query)
  ├─ L3  Persisted cache         → non-sensitive classes only (config, UI prefs)
  └─ L4  URL state               → page, filters, sort, tab, selected record id
Trusted API
  ├─ L5  Request-level memo      → per-request role/profile lookups
  ├─ L6  Short in-process cache  → settings, catalog, immutable template schema
  └─ L7  Idempotency + ETag      → safe retries and conditional requests
Postgres
  └─ L8  Indexes, keyset paging, materialized views (dashboard), RLS-aware queries
```

## 5. Client data layer (React Query pattern)
### 5.1 Query keys (factory, scoped to the user)
```ts
// keys always start with the user id so a user switch can never read another user's data
const k = {
  me:        (uid)            => [uid,'me'],
  households:(uid, filters)   => [uid,'households', filters],
  household: (uid, id)        => [uid,'household', id],
  cars:      (uid, filters)   => [uid,'cars', filters],
  car:       (uid, id)        => [uid,'car', id],
  imports:   (uid, filters)   => [uid,'imports', filters],
  jobs:      (uid, assessmentId) => [uid,'jobs', assessmentId],
  dashboard: (uid, range)     => [uid,'dashboard', range],
  templates: (uid)            => [uid,'templates'],
  template:  (uid, id, ver)   => [uid,'template', id, ver],
  audit:     (uid, filters)   => [uid,'audit', filters],
};
```
### 5.2 Freshness table (`staleTime`) and memory (`gcTime`)
| Resource | staleTime | gcTime | Refetch on focus | Notes |
|----------|-----------|--------|:---:|-------|
| `me` (profile + roles + status) | 60s | 10m | ✅ | Detects disabled account / role change quickly |
| Household list | 30s | 5m | ✅ | `placeholderData: keepPrevious` for pagination |
| Household detail | 30s | 5m | ✅ | |
| CAR list | 15s | 5m | ✅ | |
| CAR detail (editing) | 0 (always revalidate on open) | 5m | ❌ while editing | Avoid overwriting the user's in-progress edits; use revision check |
| CAR approved revision | ∞ (immutable) | 30m | ❌ | Keyed by revision |
| Review queue | 10s | 2m | ✅ | |
| Import status (running) | 0 + polling | 5m | ✅ | See §7 |
| Import history | 60s | 10m | ✅ | |
| Dashboard aggregates | 60s | 10m | ✅ | Server also caches (§8) |
| Template list | 60s | 10m | ✅ | |
| Template version schema | ∞ | 1h | ❌ | Immutable by `id + version` |
| Intervention catalog | 5m | 30m | ❌ | Admin-edited, rare |
| System settings | 5m | 30m | ❌ | Invalidated on admin change |
| Audit logs | 0 | 2m | ❌ | Always fresh when opened |
| Signed download URL | not cached | — | — | Request a new one per download |

Global defaults: `retry` 2 with exponential backoff for GET (never for non-idempotent POST without an idempotency key), `refetchOnReconnect: true`, `structuralSharing: true`.

### 5.3 Surviving refresh (the "every time I refresh" problem)
| Situation | What happens | How |
|-----------|-------------|-----|
| Press F5 | Stay signed in, same page, same filters and tab, no flash | Supabase SDK restores the session; app shows a shell skeleton until `getSession()` resolves; route and filters come from the **URL** |
| Reload on a detail page | Same record opens | Record id in the URL; data refetched; skeleton matches layout |
| Return after hours | Silent token refresh; if refresh fails → sign-in with "Session expired" and return-to URL | `onAuthStateChange`, `redirectTo` kept |
| Open second tab | Both tabs stay in sync | `BroadcastChannel`: sign-out, role change, CAR saved |
| Browser crash mid-edit | At most a few seconds of typing lost | Autosave to the server every ~2s after the last keystroke (§6.3) |
| Offline | Clear banner; edits queue **in memory** and retry; leaving warns | No PII written to disk |
| Reload during an import wizard | Resumes at the same step | Import status and mapping stored **server-side** (`imports.status`, `column_mapping`); URL holds `importId` |
| Reload during document generation | Job continues; status reappears | Job state is server-side; UI re-polls |

**Do not** persist households, CARs or any PII to localStorage / IndexedDB to "make refresh fast." Fast refresh comes from a warm HTTP cache for assets, a quick `getSession`, and stale-while-revalidate against a fast API.

### 5.4 What *may* be persisted locally
- Theme, sidebar collapsed, table density, last-used non-sensitive filters (e.g. status = Needs review).
- Role→nav map and enum labels (rebuilt from `me` each load).
- Wrapped in try/catch; the app must work with storage blocked.
- All persisted keys are namespaced by user id and **wiped on logout**.

### 5.5 Clearing rules
| Event | Action |
|-------|--------|
| Logout | `queryClient.clear()`, remove namespaced storage, `BroadcastChannel` signal, redirect |
| User switch / different `uid` | Clear before rendering any data |
| 401 from API | Try refresh once → on failure clear and go to sign-in |
| 403 on `me` or status = disabled | Clear and show "Account unavailable" |
| Role change detected (`me` differs) | Invalidate everything, re-evaluate nav and route guards |

## 6. Optimistic vs pessimistic updates
### 6.1 Decision rule
Use **optimistic** only when all are true: low risk, easily reversible, owned by the current user, no server-side gate, and a failure is cheap to explain. Otherwise **pessimistic** (show "Saving…", change the UI after the server confirms).

### 6.2 Action matrix
| Action | Strategy | Why |
|--------|----------|-----|
| Edit CAR slot / text (autosave) | **Optimistic + debounced save** | Reversible, owner-only; rolls back with a visible error |
| Toggle intervention row include/exclude | Optimistic | Low risk |
| Reorder / expand UI, save filters | Local only | No server state |
| Mark notification read | Optimistic | Harmless |
| Search / filter / paginate | Cache + keep previous data | Read-only |
| Submit CAR for review | **Pessimistic** | Server checks gates |
| Approve / request changes | **Pessimistic** | Legal weight; transactional |
| Resolve grantee, exclude member, correction | **Pessimistic** | Audited human decision |
| Commit import | **Pessimistic** | Creates immutable version |
| Template validate / activate / retire | **Pessimistic + re-auth** | Irreversible |
| Role assignment, user disable, settings, purge | **Pessimistic + re-auth** | Admin, high risk |
| Generate document | **Optimistic "Queued" chip, server-confirmed** | Idempotent job; UI shows Queued only after the API returns the job id (otherwise rolls back) |
| Download | Pessimistic (fresh signed URL) | URLs expire and are logged |

### 6.3 Optimistic edit flow (CAR autosave)
```
user types → update local form state immediately
          → debounce 1.5–2s (and save on blur / section change)
          → PATCH /case-assessments/:id { changes, baseRevision, updatedAt }
              ├─ 200 → set "Saved 10:42"; update cache with server copy (new updatedAt)
              ├─ 409 (someone else changed it) → keep local text, show conflict panel (§6.4)
              ├─ 422 → mark the field with the server message, keep the value
              └─ network error → "Not saved · retrying"; keep a retry queue in memory
beforeunload / route-leave → warn if there are unsaved changes
```
- Send **only changed slots**, not the whole document (smaller payloads, fewer conflicts).
- Cancel in-flight queries for the record before applying the optimistic edit, snapshot the previous value, roll back on error (`onMutate` / `onError` / `onSettled`).
- One in-flight save per record; later edits are merged into the next save.

### 6.4 Conflict handling (optimistic locking)
- Every editable record has `revision` and `updated_at`. The client sends the version it edited from.
- On **409**: show a panel with "Your version / Latest version", per-field choose (keep mine / take theirs), then resave on the new revision. Never silently overwrite.
- Approved CARs are immutable: edits create a new revision (server returns the new id; UI navigates and invalidates).
- Idempotency keys (`Idempotency-Key` header) on create/submit/generate so a retry after a timeout never duplicates.

## 7. Real-time and background updates
| Need | Method | Notes |
|------|--------|-------|
| Document job status (queued → verified/failed) | Poll with backoff (2s → 5s → 10s, cap 30s) **or** Supabase Realtime on `export_jobs` | Stop on terminal state; show elapsed time |
| Import validation progress | Poll `GET /imports/:id` | Same backoff |
| CAR status change by a reviewer | Realtime or refetch on focus | Show a toast "Returned by reviewer", invalidate CAR keys |
| Dashboard | Refetch on focus + interval 60s while visible | `refetchIntervalInBackground: false` |
| Other tabs | `BroadcastChannel` | Sign-out and role change are immediate |

Realtime messages carry **ids and status only**, never PII; the client then refetches through the normal authorized path (RLS/API).

### Invalidation matrix (mutation → keys to invalidate)
| Mutation | Invalidate |
|----------|-----------|
| Commit import | imports, households, dashboard |
| Resolve grantee / correct member | household(id), households, cars (for that household), dashboard |
| Save CAR | car(id) (set from response), cars list (status badges only) |
| Submit / approve / return | car(id), cars, review queue, dashboard, notifications |
| Generate / job finished | jobs(assessmentId), documents list, dashboard |
| Activate template | templates, template(id,ver), settings if linked |
| Role / user change | me (affected user), users list, everything for that user on next load |
| Settings / catalog change | settings / catalog, any CAR page using the catalog |

Prefer `setQueryData` from the mutation response for the edited record, plus `invalidateQueries` for lists.

## 8. Server and database caching
| Item | Strategy | TTL / rule |
|------|----------|-----------|
| Authorization (profile status + roles) | Per-request memo; optional 15–30s in-process cache keyed by `uid` | Must be short so disabling an account takes effect fast; invalidate on role/status write |
| System settings, intervention catalog | In-process cache | Invalidate on admin write (version counter) |
| Template schema by `id+version` | In-process cache, long TTL | Immutable once active |
| Dashboard aggregates | Materialized views or summary tables, refreshed on commit/status events or every 1–5 min | Define the metric definitions (see `SYSTEM-DESIGN.md` §8); counts must equal source queries |
| Lists | **Keyset pagination** (`created_at, id`) instead of deep `OFFSET` | Index on filter + sort columns |
| Search by HH_ID | B-tree index, trigram only on approved text fields | |
| Import row writes | Batched inserts in one transaction | |
| File downloads | Fresh signed URLs (short TTL, e.g. 60–300s); never cached | Logged |
| Connection use | Pooled connections; avoid per-request heavy queries; `select` only needed columns | |

HTTP headers from the API:
| Response | Header |
|----------|--------|
| Any PII / authenticated JSON | `Cache-Control: no-store` |
| Non-PII authenticated JSON (config) | `Cache-Control: private, max-age=0, must-revalidate` + `ETag` |
| Hashed static assets | `Cache-Control: public, max-age=31536000, immutable` |
| `index.html` | `Cache-Control: no-cache` (always revalidate, so deploys are picked up) |
| Signed file URLs | `no-store` on the API response that issues them |

`Vary: Authorization` where responses differ per user. Never put a user's data behind a shared/CDN cache.

## 9. Frontend performance practices
- **Route-level code splitting;** lazy-load heavy parts (charts, SheetJS, DOCX preview).
- **Prefetch** on intent: hover/focus on a list row prefetches the detail; next page of a table prefetches in the background.
- **Skeletons** that match the final layout (no layout shift); `keepPreviousData` so tables do not blank when filters change.
- **Virtualize** long lists (import preview, audit) beyond ~200 rows.
- **Excel parsing for preview in a Web Worker** so the UI stays responsive; commit parses on the server.
- **Debounce** search (300ms) and cancel stale requests (`AbortController` / query cancellation).
- Avoid re-render storms: memoize slot components, subscribe to slices of form state.
- Version the app shell: when a new deploy is detected, show "Update available · Reload" instead of force-reloading mid-edit.
- Service worker, if used at all: **app shell only**, never intercept `/api`, Supabase, or storage requests.

## 10. Auth and session specifics (Supabase)
- Use the SDK's persisted session and automatic refresh; on load render a shell skeleton until `getSession()` resolves, then route.
- Subscribe to `onAuthStateChange` for `SIGNED_OUT`, `TOKEN_REFRESHED`, `USER_UPDATED`; sync across tabs.
- Do not decode the JWT in the UI to decide permissions. Permissions come from `GET /me` (server), cached 60s and refetched on focus.
- Treat `me.status = disabled` or a 401/403 as a hard sign-out and cache wipe.
- Access token lives where the SDK keeps it; never copy it into your own storage, logs or URLs.

## 11. Guardrails (do / don't)
| Do | Don't |
|----|------|
| Key every cache entry by user id | Share cache between users or roles |
| Use the URL for page, filters, tab, id | Keep navigation state only in memory |
| Optimistic for autosave and toggles | Optimistic for approval, grantee, roles, templates |
| Send `baseRevision` and handle 409 | Last-write-wins on CARs |
| Clear everything on logout | Leave data in storage "for next time" |
| Short freshness for status-driven data | Cache job status for minutes |
| Cache immutable versions long | Cache mutable settings forever |
| `no-store` for PII responses | Put PII in localStorage, IndexedDB, service worker caches, or URLs |

## 12. Observability
- Metrics: cache hit ratio (server caches), API p50/p95 per route, refetch counts per page, optimistic rollback rate, 409 rate, autosave failure rate, session-refresh failures.
- Web vitals budgets (targets to validate): LCP < 2.5s on list pages, INP < 200ms, no layout shift > 0.1 on tables.
- Logs contain ids and counts only, no PII.

## 13. Test plan
| Test | Pass condition |
|------|---------------|
| F5 on every page | Still signed in, same route/filters/tab, no blank flash, no duplicate fetch storm |
| Logout in tab A | Tab B signs out; no data visible; storage and query cache empty |
| User switch | Second user never sees first user's cached data |
| Disabled account / role removed | Within `me` stale time (≤60s or on focus) access is lost and cache cleared |
| Autosave | Edit saves once per debounce; payload has only changed slots |
| Optimistic rollback | Forced 500/422 reverts UI and shows the error; no stuck "Saved" |
| 409 conflict | Panel appears; no silent overwrite; resolving saves a new revision |
| Approve / grantee / template | UI changes only after server success (pessimistic) |
| Duplicate submit | Double-click or retry creates one revision/job (idempotency key) |
| Offline then online | Banner shown; queued autosave sent once on reconnect; warns on leave |
| Stale data after mutation | Lists/dashboards reflect the change after invalidation |
| Storage audit | No PII in localStorage, IndexedDB, Cache Storage, URLs, or logs |
| Headers | PII routes return `no-store`; assets immutable; `index.html` no-cache |
| Deploy | Users see "Update available", not a broken half-old/half-new app |
| Load | Dashboard and list endpoints meet p95 targets with caching on and off |

## 14. Rollout phases
| Phase | Work |
|-------|------|
| C1 (with Phase 1) | Query client, key factory, auth/session restore, `me` caching, clear-on-logout, URL state, cross-tab sync, headers (`no-store`, asset immutability) |
| C2 (Phase 2) | Import status polling/backoff, server-held wizard state, preview worker, keyset pagination on households |
| C3 (Phase 3) | CAR autosave, optimistic edit, 409 conflict UI, idempotency keys, pessimistic transitions |
| C4 (Phase 4) | Template schema long cache, job status polling/realtime, signed-URL handling |
| C5 (Phase 5) | Dashboard materialized views, invalidation matrix, audit pagination |
| C6 (Phase 6) | Storage audit, load tests, cache-hit metrics, "update available" flow, sign-off |

## 15. Requirements added
`REQ-CACHE-001…012` in `REQUIREMENTS.md` §1.13.

## 16. Open questions (owner / team)
1. Is a service worker or offline mode wanted at all? (Default here: no offline PII; app shell only if needed.)
2. Is Supabase Realtime available and approved for status events, or poll only?
3. Acceptable staleness for disabling an account (default ≤ 60s)?
4. Expected concurrency (editors per CAR, users online) to size server caches and the conflict UX.
5. Hosting/CDN in use, so header rules can be applied at the right layer.
6. May non-sensitive filters and UI preferences be stored per user on the server instead of the browser?