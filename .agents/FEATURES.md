# Features (by feature) — Excel-to-Annex C CAR Management System

Format per feature: **Purpose · Roles · Requirements · Acceptance criteria · Dependencies · Phase**.

---
## F1. Authentication (Supabase Auth)
- **Purpose:** Real identity; remove hardcoded login.
- **Roles:** All.
- **Requirements:** Supabase login/logout; session restore with loading state; token refresh; password recovery with allowed redirect URLs; disabled-account block; env-based config; remove fake users/bypass flags.
- **Acceptance:** valid/invalid login, refresh, expiry, recovery, disabled, unauthorized-role tests pass; repo has no credential literals.
- **Phase:** 1

## F2. Roles & Permissions
- **Purpose:** Server-controlled access.
- **Roles:** Admin manages; all consume.
- **Requirements:** `profiles`, `user_roles`; admin UI for assignment; no self-grant; audited role changes; RLS + API checks.
- **Acceptance:** ordinary user cannot grant self admin/approver; denied access verified by tests.
- **Phase:** 1

## F3. Excel Import
- **Roles:** Operator, Admin.
- **Requirements:** upload; sheet select; header detection; explicit column mapping; preview; validation before commit; raw row preservation; import versioning; duplicate detection; history; downloadable error report (row no. + guidance).
- **Acceptance:** leading zeros preserved; duplicate upload flagged; every row traceable.
- **Dependencies:** F1, F2.
- **Phase:** 2

## F4. Households & Grantee Validation
- **Roles:** Case worker, reviewer, auditor(RO).
- **Requirements:** search/filter by HH_ID + approved fields; detail with all members; exact GRANTEE rule; conflict review; explicit audited corrections/exclusions as overlays; link to CARs.
- **Acceptance:** 5 members + 1 valid Yes → 1 household/5 members; zero/multiple/blank/invalid → needs_review; system never auto-selects.
- **Phase:** 2

## F5. CAR Authoring
- **Roles:** Case worker.
- **Requirements:** create from household + validated grantee; editable fields; Family Composition; assessment, intervention plan, recommendation; missing-field checklist; draft preview; autosave; revision history.
- **Acceptance:** drafts allowed with visible warnings; clearly marked non-final.
- **Phase:** 3

## F6. Review & Approval
- **Roles:** Reviewer.
- **Requirements:** submit; request corrections with comments; approve with gate checks; authorized exception with reason; approved revision immutable; edit ⇒ new revision.
- **Acceptance:** approval blocked when gates fail; approver/time/revision audited.
- **Phase:** 3

## F7. Template Management
- **Roles:** Admin (template admin).
- **Requirements:** upload `.docx`; versions + status; placeholder detection; field mapping; required/optional; repeating table config; test-data preview; sample DOCX/PDF; approve + activate.
- **Acceptance:** unmapped required placeholders block activation; active version immutable.
- **Phase:** 4

## F8. Document Generation & Downloads
- **Roles:** Case worker, reviewer (per policy).
- **Requirements:** async queue; DOCX + PDF independently verified; status + safe failure details; provenance (import version, template version, approval); signed short-lived downloads; export logging.
- **Acceptance:** approved docs derive from approved revision; failures reported accurately; retries idempotent.
- **Phase:** 4

## F9. Dashboard
- **Roles:** Staff (scoped), admin.
- **Requirements:** imports/rows, households, review counts, grantee issues, CAR pipeline, export failures, recent activity; documented metric definitions; aggregate-only (no LRN/PCN/pregnancy/disability).
- **Acceptance:** metrics equal persisted-record queries.
- **Phase:** 5

## F10. Audit Logs
- **Roles:** Auditor, admin.
- **Requirements:** log data changes, corrections, approvals, template activation, exports, role changes; filter by actor/entity/date; PII-minimized.
- **Acceptance:** each sensitive action produces a record; no sensitive payload in descriptions.
- **Phase:** 5

## F12. Admin-Only Controls
- **Purpose:** Restrict privileged actions to active admins; optional whole-system lock.
- **Roles:** Admin.
- **Requirements:** admin-only actions A1–A9 (users, roles, templates, settings, purge, audit export, job re-run, access mode); `is_admin()` DB helper; last-admin protection; no self-escalation; re-authentication for critical actions; audit of every admin action; `access_mode = admin_only | standard` setting with banner.
- **Acceptance:** non-admin gets 403 on every A1–A9 endpoint and RLS denies direct writes; last admin cannot be removed/disabled; disabled admin loses access immediately; admin-only mode blocks all non-admins. Full list in `05-ADMIN-ONLY-RULES.md` §8.
- **Dependencies:** F1, F2.
- **Phase:** 1 (core rules), 4 (template activation), 5 (audit export).

## F11. Security, Privacy & Operations
- Private storage, signed URLs, rate limits, upload hardening, backup/restore drill, retention policy, IDOR tests.
- **Phase:** 1–6 (cross-cutting); verification in 6.

---
## Release Backlog Order
F1 → F2 → F12 (admin-only core) → F3 → F4 → F5 → F6 → F7 → F8 → F9 → F10 → F11 verification.

## Out of Scope / Deferred
Auto-grantee selection, bulk export, public sharing, non-Word template formats, SSO beyond Supabase-supported methods (revisit).