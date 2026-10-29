---
name: "car-system-ui-ux"
description: Use when designing or building any UI for the Excel-to-Annex C CAR Management System (dashboard, imports, households, CAR editor, templates, documents, audit, admin). Modern, colorful-but-calm, panel-based, user-friendly interface for sensitive case-work.
---
 
# CAR System — UI/UX Skill (v2: modern, panel-based)
 
## 1. Design Principles
1. **Modern and calm.** Soft surfaces, rounded corners, generous whitespace, one confident brand color. Color means something; it is never decoration.
2. **Everything lives in a panel.** Each task area is a clearly titled card/panel with one job. Users always know where they are and what to do next.
3. **One primary action per panel.** A single filled button; everything else is secondary or ghost.
4. **Status is always visible.** Draft vs Approved, needs-review, missing fields, job state: colored badge + icon + text.
5. **Never hide risk.** Missing fields, grantee conflicts and drafts show visible warnings.
6. **Privacy by default.** LRN, PCN, pregnancy, disability are masked until the user taps "Reveal" (logged). Never in charts, URLs, toasts or page titles.
7. **Explicit over implicit.** Corrections, exclusions, grantee choice and approval are deliberate actions with a reason where audited. Never auto-select a grantee.
8. **Guide, don't blame.** Plain words, next-step hints, helpful empty states.
9. **Server is the authority.** UI hides what a role can't do, but every denial still renders a clear 403/409 message.
## 2. Color System
Brand: **Indigo** (primary) with **Teal** (success/positive accent). Neutrals are cool slate. Define as CSS variables / Tailwind tokens; support light and dark.
 
### Core tokens
| Token | Light | Dark | Use |
|-------|-------|------|-----|
| `--bg` | `#F4F6FB` | `#0B1020` | App background |
| `--surface` | `#FFFFFF` | `#121830` | Panels, cards |
| `--surface-2` | `#EEF1F8` | `#1A2140` | Table header, inset areas |
| `--border` | `#E1E6F0` | `#2A3358` | Panel and input borders |
| `--text` | `#0F172A` | `#E8ECF8` | Body |
| `--text-muted` | `#5B6478` | `#9AA5C4` | Secondary text |
| `--primary` | `#4F46E5` | `#818CF8` | Primary buttons, links, active nav |
| `--primary-soft` | `#EEF0FF` | `#232A5C` | Selected row, active nav bg |
| `--accent` | `#0D9488` | `#2DD4BF` | Positive highlights, progress |
| `--focus` | `#4F46E5` @ 40% | `#818CF8` @ 50% | 3px focus ring |
 
### Status palette (badge = soft bg + strong text + icon)
| State | Meaning | Text | Soft bg | Icon |
|-------|---------|------|---------|------|
| Draft | Editable, not final | `#B45309` | `#FEF3C7` | pencil |
| Needs review | Grantee/conflict issue | `#C2410C` | `#FFEDD5` | alert-triangle |
| Submitted | Awaiting reviewer | `#1D4ED8` | `#DBEAFE` | clock |
| Changes requested | Returned | `#7E22CE` | `#F3E8FF` | corner-up-left |
| Approved | Final | `#047857` | `#D1FAE5` | check-circle |
| Failed | Job/validation error | `#B91C1C` | `#FEE2E2` | x-circle |
| Processing | Queued/running | `#0E7490` | `#CFFAFE` | loader |
| Retired/Disabled | Inactive | `#475569` | `#E2E8F0` | minus-circle |
 
Rules: color is never the only signal (always icon + label). Text on soft bg ≥ 4.5:1. Use red only for errors and destructive actions. Use the brand color for navigation and primary actions only.
 
## 3. Typography, Shape, Motion
- **Font:** Inter (fallback system-ui). Base 15/16px, line-height 1.5. Headings 600 weight. Tabular numerals for counts, IDs and tables.
- **IDs:** HH_ID, ENTRY_ID, LRN, PCN in monospace (they are text; keep leading zeros).
- **Scale:** 12 / 14 / 16 / 20 / 24 / 32.
- **Spacing:** 4px grid (4, 8, 12, 16, 24, 32). Panel padding 20–24px; gap between panels 16–24px.
- **Radius:** 12px panels, 8px inputs/buttons, 999px badges.
- **Elevation:** panels use a 1px border plus a very soft shadow (`0 1px 2px rgba(15,23,42,.06)`); dialogs a larger shadow. No heavy shadows.
- **Header accents:** a subtle brand gradient is allowed only on the login hero, empty states and the top of the dashboard welcome panel (indigo → teal at low saturation). Never behind data.
- **Motion:** 150–200ms ease-out for hover, expand, toast. Respect `prefers-reduced-motion`.
- **Icons:** one set (Lucide), 16/20px, stroke 1.75.
## 4. App Shell (the panel layout)
```
┌───────────────┬────────────────────────────────────────────────────────┐
│  LOGO  CAR    │  Topbar: breadcrumb · global search · notifications · user │
│               ├────────────────────────────────────────────────────────┤
│  ▣ Dashboard  │  Page header: Title · subtitle            [Primary btn] │
│  ⇪ Imports    │ ┌──────────────────────────────┐ ┌───────────────────┐ │
│  ⌂ Households │ │  MAIN PANEL                  │ │  CONTEXT PANEL    │ │
│  ▤ CARs       │ │  (table / form / wizard)     │ │  (details, checks,│ │
│  ✓ Review     │ │                              │ │   help, activity) │ │
│  ▦ Templates  │ └──────────────────────────────┘ └───────────────────┘ │
│  ⇩ Documents  │                                                        │
│  ☰ Audit      │                                                        │
│  ─────────    │                                                        │
│  ⚙ Admin      │                                                        │
│  (admins only)│                                                        │
└───────────────┴────────────────────────────────────────────────────────┘
```
- **Sidebar (left, 248px, collapsible to 72px icons):** grouped nav, active item uses `--primary-soft` bg and a 3px primary bar. Shows only items the role may use. Admin group separated at the bottom with a small "ADMIN" label.
- **Topbar (56px):** breadcrumb, global search by HH_ID (non-sensitive), notification bell (jobs, returned CARs), user menu (profile, theme, sign out).
- **Page header:** title, one-line description, single primary action on the right.
- **Main panel (fluid):** the work area. **Context panel (right, 320–360px, collapsible):** details, checklist, help, history for the selected item. On tablet it becomes a slide-over drawer; on mobile it is a bottom sheet.
- Max content width 1440px; panels stack on narrow screens.
### Panel anatomy
```
┌─ Panel title ───────────────────────────── [secondary] [primary] ┐
│ Helper text: one line saying what this panel is for              │
│ ───────────────────────────────────────────────────────────────  │
│ Content                                                          │
│ ───────────────────────────────────────────────────────────────  │
│ Footer: summary / pagination / save state                        │
└──────────────────────────────────────────────────────────────────┘
```
Variants: **Info** (neutral), **Warning** (amber left bar + icon), **Error** (red left bar), **Success** (teal left bar). Warning panels carry the action to fix it.
 
## 5. Roles → What the user sees
| Role | Sidebar items | Notes |
|------|--------------|-------|
| Admin | All + Admin group | Admin ≠ reviewer/case worker unless also assigned |
| Operator | Dashboard, Imports, Households (view) | |
| Case worker | Dashboard, Households, CARs, Documents | |
| Reviewer | Dashboard, Review, CARs (read), Documents | |
| Auditor | Dashboard, Audit, read-only views | No edit buttons anywhere |
 
Hidden nav is cosmetic. Direct URL access without permission shows a friendly "You don't have access" page (no hint whether the record exists).
 
## 6. Page Patterns (panel by panel)
 
### Login
Split screen: left brand panel (indigo→teal soft gradient, short tagline, no sensitive info); right sign-in card. Email, password (show/hide), "Forgot password?", primary "Sign in". Inline errors without role hints. Loading skeleton while the session resolves.
 
### Dashboard
Row 1: **Welcome panel** (greeting, today's to-dos: "3 households need review", "2 CARs returned").
Row 2: **KPI cards** (4–6): Imports, Households, Needs review, CAR drafts, Awaiting approval, Approved. Each has icon chip in its status color, big number, delta, info tooltip with the metric definition.
Row 3: **Pipeline panel** (stacked bar: Draft → Submitted → Approved) + **Needs attention panel** (actionable list) + **Recent activity panel**.
Aggregate-only; no sensitive fields. Loading skeletons and friendly empty states.
 
### Excel Imports (wizard)
Horizontal **stepper** at top: Upload → Sheet → Map columns → Preview → Validate → Commit (done = teal check, current = indigo, upcoming = gray).
- **Upload panel:** large dashed drop zone, accepted types, size limit, privacy note.
- **Map panel:** two columns, "Your column" → "System field", auto-suggested matches with confidence chip, required fields marked.
- **Preview panel:** first rows, error cells highlighted red with row numbers.
- **Validate panel:** result cards (Rows OK, Warnings, Errors) + "Download validation errors".
- **Context panel:** checklist of steps and tips. Duplicate-file warning banner links to the existing import.
- Footer: Back (ghost) / Next (primary). Commit requires a confirm dialog.
### Households
- **Filter panel (top):** HH_ID search, grantee status chips (All · OK · Needs review), import version, clear filters.
- **Table panel:** HH_ID (mono), members count, grantee name, status badge, import version, row action "Open". Server-paginated, 44px rows, sticky header.
- **Detail page:** header card (HH_ID, status, import version) + tabs: **Members · Grantee · Corrections · CARs**. Context panel shows source rows and checks.
- **Needs-review resolution:** warning panel at top → opens a right **drawer**: choose member, required reason, source row numbers, "Resolve" (primary). Never preselect a person.
### CAR Editor
```
┌ Sticky header: HH-0001 · Grantee: … · [Draft] · Rev 2 · Saved 10:42 ┐
├──────────────────────────────┬─────────────────────────────────────┤
│ Section nav (left rail)      │ FORM PANEL                          │
│ ● CAR fields        ✓        │  fields, grouped in cards           │
│ ● Family composition ⚠ 2     │                                     │
│ ● Assessment        ✓        ├─────────────────────────────────────┤
│ ● Intervention plan ⚠ 1      │ CONTEXT PANEL (tabs)                │
│ ● Recommendation    ✓        │  Checklist · Preview · History      │
└──────────────────────────────┴─────────────────────────────────────┘
Footer bar: [Save draft] [Generate draft]            [Submit for review]
```
- Left rail shows completion per section (✓ done, ⚠ missing count). Clicking jumps and scrolls.
- **Missing-field checklist** with jump links; counts in the header.
- Preview carries a diagonal "DRAFT — not approved" watermark.
- Submit is disabled with a tooltip listing exactly what is missing.
- **Approved** CARs are read-only with a green banner; "Create revision" opens a confirm dialog explaining re-approval.
### Review Queue
Left: queue list panel (author, household, submitted time, age chip). Right: read-only CAR with a **Gate checklist panel** (Grantee ✓, Conflicts ✓, Required fields ✓/exception, Active template ✓). Buttons: **Approve** (teal) and **Request changes** (outline, comment required). Approve dialog names the revision.
 
### Templates (admin)
Table of templates with version and status badge. Detail: **Upload panel**, **Placeholders panel** (detected → mapped field, required toggle, unmapped = red), **Repeating table panel**, **Test preview panel** (generate sample DOCX/PDF). Activate button in a confirm dialog with re-auth; disabled with a reason until required placeholders are mapped.
 
### Documents
Table with DOCX and PDF status chips side by side, template version, import version, requested by, time. Failed row expands to a safe error message and Retry (if permitted). Download shows a toast and is logged. Processing rows show a progress chip with elapsed time.
 
### Audit
Filter bar (actor, entity, action, date range). Timeline-style table; row expands to before/after with sensitive values shown as `••••`. Export button visible to admins only.
 
### Admin
Tabs: **Users & Roles · Templates · Settings · Access mode · Data retention**. Role assignment uses a drawer with a checklist of roles; blocked actions explain why ("Cannot remove the last active administrator"). Access-mode switch shows a persistent amber banner to admins: "System restricted to administrators."
 
## 7. Component Library (one consistent set)
Button (primary, secondary, ghost, danger) · Input / Select / Combobox / DatePicker · Textarea with counter · Table (sortable, sticky header, row actions) · Badge · Panel/Card · Tabs · Stepper · Drawer · Dialog · Toast · Banner · Tooltip · Skeleton · EmptyState · Avatar · Breadcrumb · Pagination · FileDropzone · Checklist · Timeline.
 
Button rules: primary = indigo fill; danger = red fill only for destructive; min height 40px (44px touch); loading state with spinner and disabled; label is a verb ("Submit for review", not "OK").
 
Form rules: top-aligned labels, helper text under the field, inline validation on blur, required marked with an asterisk and text "(required)" for screen readers, group related fields in sub-cards, error text red with an icon.
 
Table rules: 44px rows, zebra off, hover row `--surface-2`, selected row `--primary-soft`, sticky first column on small screens, empty state inside the table body.
 
## 8. Interaction Rules
- **Destructive/irreversible** (approve, activate template, exclude member, purge): confirm dialog that names the consequence; danger styling only when data is lost.
- **Autosave** drafts; show Saving… / Saved 10:42 / Couldn't save (retry); warn on unsaved navigation.
- **Async jobs:** "Queued" → "Processing" → "Ready/Failed"; never an endless spinner; show elapsed time and a failure path.
- **Tables:** server-side pagination, sort and filter; filters persist in the URL (non-sensitive params only).
- **Feedback:** toasts for success (4s), banners for blocking problems, inline errors for fields.
- **Errors:** specific and actionable, no stack traces, no PII. 403 → "You don't have access"; 409 → explain the state conflict and offer Reload.
- **Empty states:** illustration icon + one sentence + the next action ("No imports yet. Upload a workbook").
- **Loading:** skeletons that match the final layout; no layout shift.
- **Sensitive fields:** masked `•••••`; "Reveal" button logs the access and auto-hides after 30s.
## 9. Responsive & Accessibility
- Breakpoints: ≥1280 full shell with context panel · 768–1279 collapsed sidebar, context panel as drawer · <768 bottom nav / hamburger, panels stack, tables become cards or scroll with sticky first column.
- Keyboard operable; visible focus ring (3px `--focus`); logical tab order; skip-to-content link.
- Labels on all inputs; errors linked with `aria-describedby`; live region for toasts and job status.
- Dialog/drawer focus trap; Escape closes non-destructive ones.
- Contrast AA (4.5:1 text, 3:1 UI); status never by color alone; text resizable to 200%.
- Dark mode via tokens, tested for contrast; theme toggle in the user menu, defaults to system.
## 10. Content & Microcopy
Plain, warm, non-technical. Fixed vocabulary: *Household, Grantee, CAR, Revision, Template version, Import version*.
| Instead of | Write |
|-----------|-------|
| "Invalid input" | "Row 14: GRANTEE must be Yes or No." |
| "Error 403" | "You don't have access to this page." |
| "Submit" | "Submit for review" |
| "Failed" | "PDF couldn't be created. Try again, or contact an administrator." |
Tone: helpful, never blaming. Buttons are verbs. Keep sentences short.
 
## 11. Do / Don't
| Do | Don't |
|----|------|
| One primary action per panel | Several competing filled buttons |
| Group content in titled panels | Long unbroken pages |
| Show why an action is disabled | Silently disable buttons |
| Pair color with icon and text | Rely on color alone |
| Mask LRN/PCN by default | Show sensitive data in lists, charts, toasts, titles |
| Make Draft and Approved look clearly different | Reuse the same look for both |
| Link errors to the source row | Show a bare "validation failed" |
| Require a reason for corrections | Allow silent overwrites |
| Use brand color for actions and navigation | Use brand color to decorate data |
 
## 12. Tailwind Starter Tokens
```js
// tailwind.config.js (extend)
colors: {
  brand: { 50:'#EEF0FF', 100:'#E0E4FF', 500:'#6366F1', 600:'#4F46E5', 700:'#4338CA' },
  accent: { 500:'#14B8A6', 600:'#0D9488' },
  surface: 'var(--surface)', bg: 'var(--bg)', border: 'var(--border)',
},
borderRadius: { panel: '12px', control: '8px' },
boxShadow: { panel: '0 1px 2px rgba(15,23,42,.06)', dialog: '0 12px 32px rgba(15,23,42,.18)' },
fontFamily: { sans: ['Inter','system-ui','sans-serif'], mono: ['JetBrains Mono','ui-monospace','monospace'] },
```
Define the light/dark values from section 2 as CSS variables on `:root` and `[data-theme="dark"]`.
 
## 13. Definition of Done (UI)
- Uses the shell, panel anatomy and tokens in this skill.
- States covered: loading, empty, error, success, denied, disabled.
- Role-based variants verified (including admin-only items).
- Light and dark mode checked for contrast.
- Keyboard and screen-reader pass; responsive at desktop, tablet, mobile.
- No sensitive data in DOM titles, URLs, console logs, toasts.
- Status badges and microcopy match this document.
 