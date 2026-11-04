# Requirements — Excel-to-Annex C CAR Management System

Status: Draft v1 · Source: `PRD.md`, `SYSTEM-DESIGN.md`, `ADMIN-ONLY-RULES.md`
Priority: **M** = Must (release blocker) · **S** = Should · **C** = Could
IDs are stable. Tests and tickets should cite them (e.g. `REQ-IMP-004`).

---
## 1. Functional Requirements

### 1.1 Authentication (F01)
| ID | Requirement | Pri |
|----|-------------|:--:|
| REQ-AUTH-001 | Users sign in only through Supabase Auth; the frontend never compares passwords or uses a local user list. | M |
| REQ-AUTH-002 | The session is restored on reload and tokens refresh automatically; a loading state shows until auth resolves. | M |
| REQ-AUTH-003 | Logout signs out via Supabase and clears client state. | M |
| REQ-AUTH-004 | Password recovery works with an allow-listed redirect URL. | M |
| REQ-AUTH-005 | Expired or revoked sessions send the user to sign-in with a clear message. | M |
| REQ-AUTH-006 | Disabled accounts (`profiles.status = disabled`) are rejected on every protected call. | M |
| REQ-AUTH-007 | All hardcoded credentials, mock logins, test users and bypass flags are removed before release. | M |
| REQ-AUTH-008 | Existing users are migrated by invitation or verified creation, and access is verified before the old login is removed. | M |
| REQ-AUTH-009 | Password policy and email verification are configured in Supabase. | S |

### 1.2 Roles & Permissions (F02)
| ID | Requirement | Pri |
|----|-------------|:--:|
| REQ-ROLE-001 | Roles (admin, operator, case worker, reviewer, auditor) are stored in `user_roles`, never in client code. | M |
| REQ-ROLE-002 | Client writes to `user_roles` are denied by RLS; only the trusted API changes roles. | M |
| REQ-ROLE-003 | A user cannot grant themselves any role. | M |
| REQ-ROLE-004 | Every protected request checks JWT, active profile, role, record scope and allowed status transition. | M |
| REQ-ROLE-005 | Role changes are audited. | M |
| REQ-ROLE-006 | Role-to-staff mapping is confirmed by the authorized owner before go-live. | M |

### 1.3 Admin-Only Controls (F12)
| ID | Requirement | Pri |
|----|-------------|:--:|
| REQ-ADM-001 | User management, role assignment, template activation, system settings, purge, audit export and access-mode changes are admin-only (A1–A9). | M |
| REQ-ADM-002 | Admin status is resolved server-side via `is_admin()` (admin role AND active profile) on every request. | M |
| REQ-ADM-003 | The last active admin cannot be removed or disabled. | M |
| REQ-ADM-004 | No hardcoded admin account; the first admin is provisioned by an owner runbook and logged. | M |
| REQ-ADM-005 | Critical admin actions (role change, template activation, purge, access-mode switch) require re-authentication. | S |
| REQ-ADM-006 | An optional `access_mode = admin_only` locks all non-admin access with 403 and a neutral screen. | S |
| REQ-ADM-007 | Admin does not imply reviewer or case worker; those roles are assigned explicitly. | M |
| REQ-ADM-008 | Every admin action is written to the audit log. | M |

### 1.4 Excel Import (F03)
| ID | Requirement | Pri |
|----|-------------|:--:|
| REQ-IMP-001 | Operators upload `.xlsx` workbooks to private storage; type, size and MIME are validated. | M |
| REQ-IMP-002 | A SHA-256 fingerprint is computed; duplicate (file hash + sheet) uploads are flagged. | M |
| REQ-IMP-003 | Users select a worksheet; the header row is detected and mapped to required fields explicitly. | M |
| REQ-IMP-004 | A preview of rows is shown before commit. | M |
| REQ-IMP-005 | Validation runs before commit: required columns, types, GRANTEE value domain, ID text preservation. | M |
| REQ-IMP-006 | Original row values are stored immutably with source row number; normalized values are stored separately. | M |
| REQ-IMP-007 | Committing creates an immutable import version; history is listed. | M |
| REQ-IMP-008 | A validation error report with row numbers and correction guidance is downloadable. | M |
| REQ-IMP-009 | Parsing for commit happens server-side; client parsing is preview only. | M |
| REQ-IMP-010 | HH_ID, ENTRY_ID, LRN and PCN are stored as text; leading zeros are preserved. | M |

### 1.5 Households & Grantee Validation (F04)
| ID | Requirement | Pri |
|----|-------------|:--:|
| REQ-HH-001 | Rows are grouped by HH_ID into one household with all its members. | M |
| REQ-HH-002 | Grantee rule: exactly one member with GRANTEE = Yes → `ok`; zero, multiple, blank or unrecognized → `needs_review`. | M |
| REQ-HH-003 | The system never auto-selects a grantee. | M |
| REQ-HH-004 | Resolution of review cases is a human action with a required reason and an audit record. | M |
| REQ-HH-005 | Corrections and exclusions are stored as overlays; raw data is never overwritten. | M |
| REQ-HH-006 | Users can search and filter by HH_ID and approved fields; lists paginate server-side. | M |
| REQ-HH-007 | Household detail lists all members, grantee status, correction history and linked CARs. | M |
| REQ-HH-008 | No global unique constraint on ENTRY_ID until the owner confirms its scope. | M |
| REQ-HH-009 | Every source row stays traceable after grouping and correction. | M |

### 1.6 CAR Authoring (F05)
| ID | Requirement | Pri |
|----|-------------|:--:|
| REQ-CAR-001 | A CAR can be created only from a household with a validated grantee. | M |
| REQ-CAR-002 | Editable sections: CAR fields, Family Composition, assessment, intervention plan, recommendation. | M |
| REQ-CAR-003 | A missing-field checklist is shown and updated as the user edits. | M |
| REQ-CAR-004 | Drafts may be saved and previewed with missing fields; they show visible warnings and a DRAFT marker. | M |
| REQ-CAR-005 | Autosave with visible saved/saving/error state; optimistic locking prevents silent overwrites. | S |
| REQ-CAR-006 | Revision history is kept; `unique(case_group_id, revision)` prevents duplicates. | M |
| REQ-CAR-007 | Users can search CARs by household ID, status, import version and approved filters. | M |

### 1.7 Review & Approval (F06)
| ID | Requirement | Pri |
|----|-------------|:--:|
| REQ-REV-001 | A case worker submits a draft for review. | M |
| REQ-REV-002 | A reviewer can request changes (comment required) or approve. | M |
| REQ-REV-003 | Approval requires: one validated grantee, no blocking conflicts, required fields complete or an authorized exception with reason, and an active approved template. | M |
| REQ-REV-004 | Only a user with the reviewer role can approve. | M |
| REQ-REV-005 | An approved revision is immutable; any edit creates a new revision requiring re-approval. | M |
| REQ-REV-006 | Approver, time and revision are audited; approval is transactional. | M |
| REQ-REV-007 | The reviewer must differ from the author (confirm with owner). | S |

### 1.8 Template Management (F07)
| ID | Requirement | Pri |
|----|-------------|:--:|
| REQ-TPL-001 | Admins upload `.docx` templates (macro-free, size and zip limits enforced). | M |
| REQ-TPL-002 | Placeholders are detected; fields are mapped explicitly; required/optional is configurable. | M |
| REQ-TPL-003 | Repeating table rows (Family Composition) are configurable. | M |
| REQ-TPL-004 | Test-data preview and sample DOCX/PDF generation are available before activation. | M |
| REQ-TPL-005 | Versions and statuses (`draft → validated → active → retired`) are tracked. | M |
| REQ-TPL-006 | Unmapped required placeholders block activation; an active version is immutable. | M |
| REQ-TPL-007 | Template activation is admin-only and audited. | M |

### 1.9 Document Generation & Downloads (F08)
| ID | Requirement | Pri |
|----|-------------|:--:|
| REQ-DOC-001 | Generation is asynchronous through a durable, idempotent job queue. | M |
| REQ-DOC-002 | Approved documents are generated only from the approved revision and active template. | M |
| REQ-DOC-003 | Draft documents carry a visible DRAFT / missing-field warning. | M |
| REQ-DOC-004 | DOCX and PDF are verified independently (opens, page count, no unresolved placeholders, checksum) and recorded. | M |
| REQ-DOC-005 | Failures show safe details; retries are bounded with backoff; duplicate retries are no-ops. | M |
| REQ-DOC-006 | Each report records source import version, template version and approval details. | M |
| REQ-DOC-007 | Downloads use short-lived signed URLs and are logged; no public file links. | M |
| REQ-DOC-008 | Bulk download is disabled unless explicitly approved by the owner. | M |

### 1.10 Dashboard (F09)
| ID | Requirement | Pri |
|----|-------------|:--:|
| REQ-DASH-001 | Show imports, rows processed, households, needs-review, grantee issues, CAR pipeline, export failures and recent activity. | M |
| REQ-DASH-002 | Each metric has a documented definition and matches persisted-record queries. | M |
| REQ-DASH-003 | Aggregate-only: no LRN, PCN, pregnancy or disability data. | M |

### 1.11 Audit Logs (F10)
| ID | Requirement | Pri |
|----|-------------|:--:|
| REQ-AUD-001 | Log data changes, corrections, approvals, template activation, exports, role and admin actions. | M |
| REQ-AUD-002 | Entries record actor, action, entity, timestamp and PII-minimized before/after. | M |
| REQ-AUD-003 | Auditors and admins can filter by actor, entity, action and date. | M |
| REQ-AUD-004 | Audit rows are inserted by the server only; clients cannot modify them. | M |

### 1.12 CAR Report Page (F05) — see `.agents/REFACTOR-PLAN-REPORT-PAGE.md`
| ID | Requirement | Pri |
|----|-------------|:--:|
| REQ-RPT-001 | The CAR page reproduces the Annex C template layout and wording; fixed template text is always displayed. | M |
| REQ-RPT-002 | Only blanks in the template are dynamic (slots); static paragraphs are read-only on the CAR page. | M |
| REQ-RPT-003 | Slots are filled from real household/grantee/member data where available; otherwise entered manually by the case worker. | M |
| REQ-RPT-004 | A slot used in multiple places (e.g. family name, barangay) has one value and updates everywhere. | M |
| REQ-RPT-005 | The UI and the generated DOCX/PDF use the same template version and slot values. | M |
| REQ-RPT-006 | Static wording lives in the versioned template definition, not in code; wording changes require a new template version. | M |
| REQ-RPT-007 | Derived values can be overridden only with a reason; the original value is kept and the change is audited; raw import rows are never modified. | M |
| REQ-RPT-008 | Family Composition rows are generated from household members, grantee first, with audited exclusions and a Monitored Child YES/NO mark. | M |
| REQ-RPT-009 | The Intervention Plan is built from an admin-managed catalog; each CAR may include, exclude or add rows, and rows use the grantee's name via slots. | M |
| REQ-RPT-010 | Missing required slots appear in a checklist with jump links and block approval unless an authorized exception is recorded. | M |
| REQ-RPT-011 | Computed slots (age, member/adult/child counts, formatted money, list joins, singular/plural) are produced by tested formatters. | M |
| REQ-RPT-012 | Sensitive slots (National ID, contact, disability) are masked by default; reveal is logged. | M |
| REQ-RPT-013 | Edit, Preview and Print modes are provided; non-approved reports carry a DRAFT marker. | M |
| REQ-RPT-014 | Static template text must not contain personal names; a template lint check enforces this. | S |

---
## 2. Non-Functional Requirements
| ID | Category | Requirement | Pri |
|----|----------|-------------|:--:|
| NFR-SEC-001 | Security | RLS is enabled on every client-accessible table with least-privilege policies; allow and deny are tested. | M |
| NFR-SEC-002 | Security | The service-role key is server-only and never appears in frontend code, `VITE_` variables or bundles. | M |
| NFR-SEC-003 | Security | Storage buckets are private; access is via signed URLs issued by the API. | M |
| NFR-SEC-004 | Security | Changing an ID in a URL or API request never exposes another user's unauthorized records (IDOR tests). | M |
| NFR-SEC-005 | Security | Rate limiting on auth, upload and download endpoints. | S |
| NFR-SEC-006 | Security | Upload hardening: MIME/extension/size checks, macro-free docx, zip-bomb limits, virus scan if available. | M |
| NFR-SEC-007 | Security | Document worker is sandboxed, resource-limited, with timeouts and no outbound access except Supabase. | M |
| NFR-PRV-001 | Privacy | Logs, audit descriptions and job errors contain no PII. | M |
| NFR-PRV-002 | Privacy | LRN, PCN, pregnancy and disability data are masked by default in UI and excluded from dashboards. | M |
| NFR-PRV-003 | Privacy | Retention, backup and secure-deletion policy is defined and owner-approved, aligned with applicable Philippine data-protection requirements. | M |
| NFR-REL-001 | Reliability | Jobs are idempotent (key = assessment + revision + template version + kind); concurrent workers do not double-process. | M |
| NFR-REL-002 | Reliability | Postgres PITR and storage backups exist; a restore drill passes before release. | M |
| NFR-PERF-001 | Performance | A ~10k-row workbook validates within minutes (target, validate with owner volumes). | S |
| NFR-PERF-002 | Performance | List pages paginate server-side; PDF generation never blocks the request. | M |
| NFR-A11Y-001 | Accessibility | WCAG 2.1 AA: keyboard operable, visible focus, labels, status not by color alone. | S |
| NFR-OBS-001 | Observability | Structured logs (IDs only), job metrics, and alerts on failure and retry spikes. | S |
| NFR-MNT-001 | Maintainability | Code is organized by feature; migrations are version-controlled; config via env vars only. | M |
| NFR-ENV-001 | Environments | Separate dev, staging and prod Supabase projects; secrets in a secret manager. | M |

---
## 3. Constraints & Assumptions
- Roles are proposed application roles, not official DSWD titles or delegated authority; the owner confirms mapping.
- The existing repo is audited first; the app framework is not replaced.
- Stack (recommended, adaptable): React + TypeScript + Vite, Tailwind, Supabase (Auth, Postgres, Storage), SheetJS, Docxtemplater, Recharts, sandboxed PDF conversion, DB-backed queue.
- Exact Annex C template(s), required-field list and exception policy are supplied by the owner.

## 4. Out of Scope (v1)
Automatic grantee selection, auto-approval, bulk export, public sharing links, non-Word templates, SSO beyond Supabase-supported methods.

## 5. Open Questions (block specific requirements)
| # | Question | Blocks |
|---|----------|--------|
| 1 | Mapping of app roles to real staff roles/delegations | REQ-ROLE-006 |
| 2 | Official uniqueness scope of ENTRY_ID | REQ-HH-008 |
| 3 | Required-field list and exception policy | REQ-REV-003 |
| 4 | Retention, backup and deletion policy; privacy sign-off | NFR-PRV-003 |
| 5 | Exact Annex C template(s) and who may activate them | REQ-TPL-* |
| 6 | Does the existing app query Supabase directly or have an API layer? | NFR-MNT-001, REQ-ROLE-004 |
| 7 | Expected volumes (rows/workbook, CARs/month) | NFR-PERF-001 |
| 8 | May admins also author/approve CARs? Is MFA available? | REQ-ADM-005, REQ-ADM-007 |

## 6. Traceability (feature → requirements → release test)
| Feature | Requirement IDs | Release test area |
|---------|-----------------|-------------------|
| F01 Auth | REQ-AUTH-001…009 | Auth |
| F02 Roles | REQ-ROLE-001…006 | Authz |
| F12 Admin | REQ-ADM-001…008 | Admin-only |
| F03 Import | REQ-IMP-001…010 | Import |
| F04 Households | REQ-HH-001…009 | Grantee |
| F05 CAR | REQ-CAR-001…007, REQ-RPT-001…014 | CAR, Docs |
| F06 Review | REQ-REV-001…007 | CAR |
| F07 Templates | REQ-TPL-001…007 | Docs |
| F08 Documents | REQ-DOC-001…008 | Docs, Ops |
| F09 Dashboard | REQ-DASH-001…003 | Privacy |
| F10 Audit | REQ-AUD-001…004 | Privacy |
| F11 Security/Ops | NFR-* | Security, Ops, Privacy |