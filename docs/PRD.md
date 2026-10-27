# PRD — Excel-to-Annex C CAR Management System

Status: Draft v1 · Owner: TBD (authorized owner must confirm) · Audience: Product, Engineering, Security, Domain reviewers

## 1. Problem Statement
Household records arrive as Excel workbooks. Staff manually identify the grantee per household, retype data into Word-based Case Assessment Reports (CARs, Annex C), and route them for review by hand. This is slow, error-prone, hard to audit, and exposes sensitive personal data (health, pregnancy, disability, education) through uncontrolled files. Current login is hardcoded and not production-safe.

## 2. Goals
| # | Goal | Measure |
|---|------|---------|
| G1 | Replace hardcoded auth with Supabase Auth + server-enforced roles | 0 hardcoded credentials / bypasses at release |
| G2 | Import workbooks with validation and full row traceability | 100% source rows traceable after grouping/correction |
| G3 | Never auto-pick a grantee; enforce exactly one valid `GRANTEE=Yes` | 0 CARs approved with zero/multiple grantees |
| G4 | Editable CAR with draft → review → approved workflow and revisions | Approved docs always generated from approved revision |
| G5 | Template-driven DOCX/PDF generation with provenance | Every report links import version + template version + approver |
| G6 | Auditable, privacy-preserving operations | All approvals, corrections, activations, exports logged |
| G7 | Privileged actions are admin-only, server-enforced (see `05-ADMIN-ONLY-RULES.md`) | 0 non-admin successes on A1–A9 in tests; last admin cannot be removed |

## 3. Non-Goals (v1)
- Not asserting official DSWD roles or delegated authority (roles are proposed; owner must map them).
- No replacement of the existing app framework; reuse what the repo already has.
- No public report links; no bulk-download feature without explicit approval.
- No automatic grantee selection or auto-approval.

## 4. Personas & Roles
| Role | Needs |
|------|-------|
| System administrator | Manage users, roles, settings, templates |
| Data/import operator | Upload workbooks, resolve validation errors |
| Case worker | Review households, author CAR drafts |
| Reviewer/approver | Approve or return CARs, authorize final export |
| Read-only/auditor | View records and audit trail without edit rights |

## 5. User Stories (by epic)
**E1 Auth** — As a user I sign in via Supabase, my session survives refresh, and disabled accounts are blocked. As an admin I assign roles; nobody can self-promote.

**E2 Import** — As an operator I upload a workbook, pick a sheet, map columns, preview, see row-level errors, and commit a versioned import. Duplicate uploads are detected.

**E3 Households** — As a case worker I search by HH_ID, see all members, and see grantee status. Zero/multiple/blank/invalid grantee flags send the household to a review queue where a human makes an explicit, audited correction.

**E4 CAR** — As a case worker I create a CAR from a household + validated grantee, edit fields, family composition, assessment, intervention plan, recommendation, see a missing-field checklist, preview, and submit.

**E5 Review** — As a reviewer I approve or request corrections. Editing an approved CAR creates a new revision requiring re-approval.

**E6 Templates** — As an admin I upload `.docx` templates, map fields, mark required/optional, configure repeating rows, test with sample data, and activate an approved version.

**E7 Documents** — As a user I generate DOCX/PDF, see status/failure details, and download via short-lived signed URLs.

**E8 Dashboard/Audit** — As staff I see real, privacy-safe metrics; as an auditor I search audit logs.

## 6. Functional Requirements (summary)
Detailed in `04-FEATURES.md`. Key rules:
- FR-1 Preserve raw imported values; corrections are overlays, never overwrites.
- FR-2 HH_ID, ENTRY_ID, LRN, PCN stored as text (leading zeros).
- FR-3 No global unique constraint on ENTRY_ID until its scope is confirmed.
- FR-4 Draft may have missing fields (with visible warnings and a DRAFT watermark); final approval requires: one validated grantee, resolved blocking conflicts, required fields complete or authorized exception, active approved template.
- FR-5 Approved documents are generated only from the approved revision.
- FR-6 DOCX and PDF outputs are independently verified and recorded.
- FR-7 Admin-only actions (user/role management, template activation, system settings, purge, audit export) are enforced by API + RLS, audited, and protected by last-admin and no-self-escalation rules. Optional `admin_only` access mode can lock the whole system to admins.

## 7. Non-Functional Requirements
- **Security:** RLS on all client-accessible tables; service-role key server-only; private buckets; signed URLs (short TTL); IDOR tests.
- **Privacy:** No LRN/PCN/pregnancy/disability in dashboards or logs; owner-confirmed alignment with applicable Philippine data-protection requirements (e.g., Data Privacy Act); defined retention/deletion.
- **Reliability:** Idempotent jobs, retries with backoff, duplicate-processing prevention.
- **Performance (targets, to be validated):** import of ~10k rows validates within minutes; list pages paginated server-side; PDF generation async.
- **Accessibility:** WCAG 2.1 AA target.
- **Observability:** Structured logs without PII; job metrics; failure alerts.

## 8. Success Metrics
- Time from workbook upload to approved CAR (baseline TBD).
- % households auto-resolved without review queue.
- Export failure rate; template validation failure rate.
- Zero security findings at release test.

## 9. Release Criteria
See Section 9 of the source plan; mirrored in `03-SYSTEM-DESIGN.md` §10 (test matrix).

## 10. Phasing
1. Audit + auth migration · 2. Import + household validation · 3. CAR management · 4. Templates + documents · 5. Dashboard + audit · 6. Production verification.

## 11. Open Questions (need owner confirmation)
1. Official mapping of app roles to real staff roles/delegations.
2. Official uniqueness scope of ENTRY_ID.
3. Required-field list and permitted exception policy for final CARs.
4. Retention, backup, and deletion policy; data-privacy sign-off.
5. Exact Annex C template(s) and who may activate them.
6. Is the existing app direct-to-Supabase or does it have an API layer?
7. Expected volumes (rows per workbook, CARs per month).
8. Admin scope: privileged actions only, or whole-system admin-only mode? May admins also author/approve CARs? Is MFA/re-auth available for critical actions? (See `05-ADMIN-ONLY-RULES.md` §9.)

## 12. Risks
| Risk | Mitigation |
|------|-----------|
| Sensitive data leakage | RLS, private storage, PII-free logs, access tests |
| Wrong grantee picked | No auto-selection; human audited resolution |
| Template drift breaks docs | Versioned templates, validation + sample render before activation |
| PDF layout defects | Output verification + layout test corpus |
| Privilege escalation | Protected `user_roles`, server checks, tests |