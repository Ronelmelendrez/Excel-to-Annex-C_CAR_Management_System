---
name: car-system-ui-ux
description: Use when designing or building any UI for the Excel-to-Annex C CAR Management System (dashboard, imports, households, CAR editor, templates, documents, audit). Enforces a clear, trustworthy, privacy-aware interface for sensitive government case-work.
---
 
# CAR System — UI/UX Skill
 
## Design Principles
1. **Trust over flair.** Calm, legible, official-feeling. No decorative gradients or novelty animation.
2. **Status is always visible.** Draft vs Approved, needs-review, missing fields, job state — never ambiguous.
3. **Never hide risk.** Missing fields, grantee conflicts, and drafts show visible warnings.
4. **Privacy by default.** Mask sensitive fields (LRN, PCN, pregnancy, disability) until the user expands them; never put them in charts, URLs, toasts, or page titles.
5. **Explicit over implicit.** Corrections, exclusions, grantee choice, approval always require a deliberate action (and a reason where audited). Never auto-select a grantee.
6. **Server is the authority.** UI hides what a role can't do, but every denial must still render a clear 403/409 message.
## Information Architecture
Sidebar: Dashboard · Imports · Households · CARs · Templates · Documents · Audit (+ Admin: Users & Roles). Items shown per role.
 
## Roles → UI
| Role | Sees / can do |
|------|--------------|
| Admin | everything incl. Users, Templates |
| Operator | Imports, validation, Households (view) |
| Case worker | Households, CAR edit, submit, generate draft |
| Reviewer | CAR queue, approve/return, final export |
| Auditor | read-only everywhere + Audit |
 
## Visual System
- **Tone:** neutral surfaces, one primary accent (deep blue), semantic colors only for state.
- **Status tokens:** Draft = amber · Needs review = orange · Submitted = blue · Changes requested = purple · Approved = green · Failed = red · Disabled/Retired = gray. Always pair color with an icon + text (never color alone).
- **Type:** system/Inter sans; base 16px; tabular numerals for IDs and counts; monospace for HH_ID/ENTRY_ID (text, preserve zeros).
- **Spacing:** 4/8px scale; dense tables with 40px rows; comfortable forms.
- **Components:** Tailwind + one consistent component set (Button, Input, Select, Table, Badge, Dialog, Toast, Stepper, Tabs, Banner).
- **Dark mode:** supported via tokens; contrast ≥ WCAG AA.
## Page Patterns
 
### Login
Email/password via Supabase; inline errors; "Forgot password"; loading state while session resolves; no role hints in error text.
 
### Dashboard
Metric cards (with info tooltip showing the definition) + trend charts + recent activity. Aggregate-only. Empty and loading skeletons.
 
### Excel Imports (wizard)
Stepper: **Upload → Sheet → Map columns → Preview → Validate → Commit**.
- Mapping: left = detected headers, right = required fields; auto-suggest, user confirms.
- Preview: first N rows, error rows highlighted with row numbers.
- Results: summary counts + "Download validation errors".
- Duplicate-file warning banner with link to existing import.
### Households
Filter bar (HH_ID, status, import version) + server-paginated table. Badge column: Grantee OK / Needs review. Detail page: household header, member table, grantee panel, correction history, linked CARs.
- Needs-review: side panel to choose/resolve; requires reason; shows source row numbers.
### CAR Editor
Two-column: form (left) + live preview/checklist (right).
- Sticky header: household, grantee, status badge, revision, save state ("Saved 10:42").
- Sections (accordion/tabs): CAR fields · Family Composition (editable table) · Assessment · Intervention Plan · Recommendation.
- **Missing-field checklist** panel with jump links; counts in header.
- Draft preview carries a "DRAFT — not approved" banner/watermark.
- Actions: Save, Submit for review (disabled with reason tooltip if gates fail), Generate draft.
- Approved CAR is read-only; "Create revision" is the only edit path (confirm dialog explaining re-approval).
### Review Queue
List of Submitted CARs; detail view with read-only CAR, gate checklist (grantee, conflicts, required fields, active template), buttons **Approve** / **Request changes** (comment required). Approve confirm dialog states revision number.
 
### Templates
Table with version/status. Detail: upload, detected placeholders, mapping grid (placeholder → field, required toggle), repeating-table config, test-data preview, "Generate sample DOCX/PDF", Activate (confirm; irreversible per version).
 
### Documents
Table: report, revision, template version, import version, DOCX/PDF status chips, failure detail (safe message), Download (signed URL; success toast; logged). Retry for failed jobs where permitted.
 
### Audit
Filter by actor/entity/date/action; expandable before/after with sensitive values redacted.
 
## Interaction Rules
- **Destructive/irreversible** (approve, activate template, exclude member): confirm dialog naming the consequence.
- **Autosave** drafts; show saved/saving/error state; warn on unsaved navigation.
- **Async jobs:** optimistic "Queued" → poll/subscribe → success/failure; never spin indefinitely (show elapsed + failure path).
- **Tables:** server-side pagination/sort/filter; keyboard navigable; persistent filters in URL (non-sensitive params only).
- **Errors:** specific, actionable, no stack traces, no PII. 403 → "You don't have access" (don't reveal record existence); 409 → explain state conflict and offer reload.
- **Empty states:** explain what to do next (e.g., "No imports yet — upload a workbook").
## Accessibility Checklist
- Keyboard-only operable; visible focus ring.
- Labels on all inputs; errors linked via aria-describedby.
- Status not conveyed by color alone.
- Dialog focus trap; Escape closes non-destructive dialogs.
- Responsive down to tablet; tables scroll horizontally with sticky first column.
- Contrast AA; text resizable to 200%.
## Content & Microcopy
Plain, respectful, non-technical. Use the same terms everywhere: *Household*, *Grantee*, *CAR*, *Revision*, *Template version*. Avoid blame ("Row 14: GRANTEE must be Yes or No" over "Invalid input").
 
## Do / Don't
| Do | Don't |
|----|------|
| Show why an action is disabled | Silently disable buttons |
| Mask LRN/PCN by default | Show sensitive data in lists, charts, toasts |
| Distinguish Draft/Approved loudly | Reuse the same look for both |
| Link errors to source row | Show bare "validation failed" |
| Require reason for corrections | Allow silent overwrites |
 
## Definition of Done (UI)
- States covered: loading, empty, error, success, denied, disabled.
- Role-based variants verified.
- Keyboard + screen-reader pass.
- No sensitive data in DOM titles, URLs, console logs.
- Matches status tokens and microcopy gl