# CAR Report Page — Refactor Plan (template-faithful, blanks-only dynamic)

Feature: F05 CAR Authoring (also touches F04, F07, F08) · Source template: `Annex C CASE STUDY REPORT FOR ACTIVE OR LEVEL 2.docx` (repo root)
Status: Draft v2 · Requirement IDs: `REQ-RPT-*` (see `.agents/REQUIREMENTS.md` §1.12)

## 1. Goal
Make the CAR page look and read exactly like the Annex C template. **The template's fixed wording is always on screen. Only the blanks are dynamic**, filled from the household's real data (or entered by the case worker when the data does not exist in the workbook).

Rule of thumb: *if it is a blank (`____`) in the Word template, it is a slot. If it is written text, it is static and read-only on the CAR page.*

## 2. What the template contains (extracted from your .docx)
| Section | Static content | Dynamic (blank) content |
|---------|---------------|--------------------------|
| Header | Title "CASE ASSESSMENT REPORT (CAR)" | Date |
| I. Identifying Information | 15 field labels | Grantee name, Household ID, HH Set Group, National ID, Sex, Birthday, Age, Place of birth, Civil status, Present address, Educational attainment, Contact info, Religion, IP affiliation, Source of information |
| (after I) | 4 labels | HH level of well-being (present), Previous assessment, HH Risk Level Category, Case Category |
| II. Family Composition | Table headers (11 columns, Monitored Child split YES/NO) | One row per household member |
| III. Presenting Problem | Full paragraph (no blanks) | none |
| IV.A The Family | Full paragraph | family name, member/adult/child counts, residence, barangay, provider, occupation, income, challenges |
| IV.B Environment/Community | Full paragraph | barangay, community description, basic services, residence description, housing materials, access level, neighbor relationship |
| V. Assessment | Two paragraphs | family name, challenges, income source, sufficient/insufficient, coping, difficulties, strengths/resources, recommended support |
| Intervention Plan | Goal line, table headers, standard rows (need, objective, activities, responsible, remarks) | Names inside activities, some responsible persons, timeline, include/exclude per row |
| VI. Recommendation | Full paragraph | family name |
| Signatories | Labels | Names/titles/dates (see §9) |

## 3. Core design: one template definition, two renderers
```
Template definition (versioned JSON: static text blocks + slot references)
        │
        ├──► React <CarDocument/>   → what the user sees and edits
        └──► Docxtemplater mapping  → the DOCX/PDF (F08)
                    ▲
        Same slot values from case_assessments.content
```
- UI and DOCX read the **same slot values** and the **same template version**, so they cannot drift apart.
- Static paragraphs live in the template definition, not in components. Changing wording = new template version (F07), never a code edit.
- A slot used in several places (e.g. *family name*, *barangay*) is **filled once, shown everywhere**.

### Slot definition
```ts
type SlotDef = {
  key: string;                 // 'family_name'
  label: string;               // 'Family name'
  type: 'text'|'number'|'date'|'money'|'select'|'longtext'|'toggle';
  source: 'derived'|'computed'|'manual'|'setting';
  from?: string;               // household field / member field / formula id
  required: boolean;           // blocks approval if empty (owner confirms list)
  options?: string[];          // for select/toggle, e.g. ['sufficient','insufficient']
  format?: string;             // 'title_case', 'PHP #,###.00'
  sensitive?: boolean;         // masked by default in UI
};
```
### Slot value (stored in `case_assessments.content.slots[key]`)
```json
{ "value": "Maria Santos", "source": "derived", "overridden": false, "original": null }
```
Overrides keep the `original` derived value, record who/why in the audit log, and never touch raw import rows (FR-1).

## 4. Slot inventory
Source: **D** derived from workbook household/grantee/member data · **C** computed · **M** manual by case worker · **S** system setting.

**Workbook column list confirmed** (2026-11-04) against `supabase/functions/_shared/import-domain.ts` → `CANONICAL_FIELDS` (44 columns) — the real source list:
```
REGION, PROVINCE, MUNICIPALITY, BARANGAY, HH_ID, ENTRY_ID, FIRST_NAME, MIDDLE_NAME,
LAST_NAME, EXT_NAME, BIRTHDAY, AGE, AGE_ON_EDUC, SEX, CLIENT_STATUS, CS_CATEGORY,
MEMBER_STATUS, RELATION_TO_HH_HEAD, CIVIL_STATUS, GRANTEE, HH_SET, SOLO_PARENT,
IP_AFFLIATION, PCN, PCN_REMARKS, PREGNANCY_STATUS, LMP, HEALTH_MONITORED,
HEALTH_FACILITY, HEALTH_FACILITY_STATUS, REASON_FOR_NOT_ATTENDING_HEALTH,
REASON_HEALTH_REMARKS, DISABILITY_TYPES, CHILD_BENE, GRADE_LEVEL, SHS_STRAND,
SHS_TRACK, EDUC_MONITORED, ATTEND_SCHOOL, SCHOOL_NAME,
REASON_FOR_NOT_ATTENDING_SCHOOL, REASON_EDUC_REMARKS, LRN, LRN_REMARKS
```
- `GRANTEE` is a **Yes/No flag**, not a name; grantee name is composed from `FIRST_NAME + MIDDLE_NAME + LAST_NAME + EXT_NAME`.
- The workbook has **no columns** for national ID, place of birth, contact info, religion, occupation, monthly income, basic services, housing materials, community/coping/strengths — those slots are **M/S**, never D.
- All 44 fields live in `import_rows.normalized` (jsonb), reachable via `household_members.import_row_id`; today's `cars/index.ts` read path only maps name, relationship, age, grantee flag — **R2 must extend it** (no schema migration needed to read data).
- Header spellings that do **not** auto-map today (add `HEADER_ALIASES` in R2): "HH Set Group" → `HH_SET_GROUP` (canonical is `HH_SET`), plus non-canonical "Grantee Name", "National ID", "Religion", "Relationship", "Occupation" (silently ignored).

### 4.1 Identifying Information (grantee member)
| Slot key | Label | Src | Workbook column / notes |
|----------|-------|:--:|-------------------------|
| report_date | Date | C | Defaults to today; editable while Draft |
| grantee_name | Grantee's Name | D | `FIRST_NAME + MIDDLE_NAME + LAST_NAME + EXT_NAME` of the validated grantee member (never auto-picked); `GRANTEE` is only the Yes/No flag |
| household_id | Household ID Number | D | `HH_ID`, text |
| hh_set_group | HH Set Group | D | `HH_SET` (header "HH Set Group" does not auto-map today; add alias) |
| national_id_no | National ID No. | M | no workbook column; sensitive |
| sex | Sex | D | `SEX` |
| birthday | Birthday | D | `BIRTHDAY` |
| age | Age | C | From `BIRTHDAY` as of report date; workbook `AGE`/`AGE_ON_EDUC` used only as a cross-check (as-of date unknown) |
| place_of_birth | Place of birth | M | no workbook column |
| civil_status | Civil status | D | `CIVIL_STATUS` |
| present_address | Present Address | D/M | Compose from `REGION, PROVINCE, MUNICIPALITY, BARANGAY` (format to confirm), else manual |
| educational_attainment | Educational attainment | D/M | `GRADE_LEVEL` is an approximation (grade ≠ attainment); confirm or manual |
| contact_info | Contact info | M | no workbook column; masked by default |
| religion | Religion | M | no workbook column |
| ip_affiliation | IP affiliation | D | `IP_AFFLIATION` |
| source_of_information | Source of information | M | default from setting |
| wellbeing_present | HH level of well-being (present) | M | no workbook column |
| previous_assessment | Previous assessment (if applicable) | M | Optional; no workbook column |
| hh_risk_level | HH Risk Level Category | M | no workbook column |
| case_category | Case Category (special cases) | M | Optional; candidate columns `CS_CATEGORY`/`CLIENT_STATUS` exist but are unused and semantics unconfirmed |

### 4.2 Family Composition (table, one row per member)
Columns: Name · Sex · Age · Civil Status · Relationship to grantee · Staying with HH · Monitored Child (YES / NO) · Educational Attainment · Occupation · Monthly Income · Type of Disability.

Workbook sources: Name ← `FIRST/MIDDLE/LAST/EXT_NAME` · Sex ← `SEX` · Age ← `AGE` (or computed from `BIRTHDAY`) · Civil Status ← `CIVIL_STATUS` · Relationship ← `RELATION_TO_HH_HEAD` (relation to HH head; grantee = head assumed — confirm) · Educational Attainment ← `GRADE_LEVEL` · Type of Disability ← `DISABILITY_TYPES`. **No workbook column exists for:** Staying with HH, Occupation, Monthly Income (manual/overlay). Monitored Child ← confirm which of `CHILD_BENE` (best fit), `EDUC_MONITORED`, `HEALTH_MONITORED`.
- Rows are generated from `household_members` (excluding members the user excluded via an audited correction).
- Grantee row listed first; then by relationship/age (rule to confirm).
- *Monitored Child* renders a mark in the YES or NO sub-column.
- Cells are editable as **overlays** (corrections), never overwriting raw rows.
- Disability and similar fields appear in the official CAR but are masked until "Reveal" (logged) and are never used in dashboards or logs.

### 4.3 Narrative sections
| Slot key | Appears in | Src | Notes |
|----------|-----------|:--:|-------|
| family_name | IV.A, V, VI | D | Grantee's `LAST_NAME`; wording to confirm: surname vs. grantee full name |
| member_count | IV.A | C | Count of included members |
| adult_count, child_count | IV.A | C | Age threshold (18) to confirm |
| residence_locality | IV.A | D | `MUNICIPALITY` — "currently residing in ____" |
| barangay | IV.A, IV.B | D | `BARANGAY` — entered once, shown in both |
| primary_provider_name | IV.A | D/M | Suggest the member with `RELATION_TO_HH_HEAD` = head/grantee; user confirms (no occupation/income columns exist to pick the highest earner) |
| provider_occupation | IV.A | M | no workbook column |
| provider_monthly_income | IV.A | M | no workbook column; money, `PHP 12,500.00` |
| family_challenges | IV.A | M | Suggestions from structured answers |
| community_characteristics | IV.B | M | |
| basic_services | IV.B | M | multi-select → "a, b, and c" |
| residence_description | IV.B | M | |
| housing_materials | IV.B | M | no workbook column |
| access_level | IV.B | M | select (e.g. limited / adequate / easy) |
| neighbor_relationship | IV.B | M | |
| assessment_challenges | V | M | Defaults to `family_challenges` |
| primary_income_source | V | M | no workbook column for occupation/income |
| income_sufficiency | V | M | toggle: sufficient / insufficient |
| coping_demonstrated | V | M | |
| assessment_difficulties | V | M | |
| strengths_resources | V | M | |
| recommended_support | V | M | |

Most of IV.B and V cannot come from an Excel household record. Those slots are **manual** and show as amber "needs input" chips until filled. Only what the workbook truly contains is auto-filled.

### 4.4 Intervention Plan
- **Goal** line is static; its year ("At the end of 2027…") comes from a setting (**S**) so it can change without editing the template.
- The standard rows (Medical Assistance, Scholarship, Increased social network, Stable Employment, Capability Building, Progress Monitoring) move into an **intervention catalog** (see §6). Each CAR **includes or excludes** rows and can add a custom row.
- Slots inside activities: `{{grantee_first_name}}` (e.g. "refer ___ to RHU", "Encourage ___ to apply"), `{{responsible_person}}` where the template left a blank, timeline per row.
- **Template defects found** (fix in the new template version): "maintain the **Vicenta's** overall health" and "refer **Ramil** to SLP" are leftover names from a previous case. Replace with `{{grantee_first_name}}` / `{{grantee_possessive}}`. The header has an extra empty column; the Progress Monitoring objective lands in it.

### 4.5 Signatories
Names and titles in the template (Prepared by / Concurred by / Approved by) become **admin settings** (S). Dates stay blank for wet-ink signing unless the owner wants them auto-filled at approval. See open questions.

## 5. Page design (follows the UI/UX skill)
```
┌ Sticky header: HH-0001 · [Draft] · Rev 2 · Saved 10:42        [Edit|Preview|Print] ┐
├──────────────┬──────────────────────────────────────────────┬────────────────────┤
│ Section rail │  PAPER VIEW (A4/Letter look, template text)  │ Context panel      │
│ I   ✓        │  CASE ASSESSMENT REPORT (CAR)                │ Tabs:              │
│ II  ✓        │  Date: [ Nov 4, 2026 ]                       │  • Missing (7)     │
│ III static   │  I. Identifying Information                  │  • Data source     │
│ IV.A ⚠ 2     │   Grantee's Name: [Maria Santos]  ← derived  │  • History         │
│ IV.B ⚠ 5     │  ...                                         │  • Slot details    │
│ V   ⚠ 6      │  The family of [Santos] consists of [5]      │                    │
│ Interv. ⚠ 1  │  members, including [2] adults and [3]…      │ Click a slot →     │
│ VI  ✓        │                                              │ shows its source   │
└──────────────┴──────────────────────────────────────────────┴────────────────────┘
Footer: [Save draft] [Generate draft DOCX/PDF]                    [Submit for review]
```
### Slot chip states
| State | Look | Behavior |
|-------|------|----------|
| Derived | Teal-tinted inline text + small link icon | Click → popover shows source (import row, member); "Override…" requires a reason |
| Computed | Same as derived, "calc" icon | Read-only; shows formula |
| Manual, filled | Indigo-tinted text | Inline editable |
| Manual, missing | Amber underline with `______` and placeholder label | Click to type; counted in checklist |
| Overridden | Dotted underline + "edited" tag | Shows original value on hover |
| Sensitive | `•••••` + Reveal | Reveal is logged, auto-hides |

### Modes
- **Edit:** slot chips visible; static text is read-only (lock icon on hover: "Fixed template wording").
- **Preview:** clean document, no chips, with DRAFT watermark when not approved.
- **Print/Approved:** read-only, identical to the DOCX layout.

### Behavior rules
- Static paragraphs are never editable on the CAR page.
- Long text slots (challenges, strengths) expand inline; text must read correctly inside the sentence. Show a live sentence preview.
- Multi-select slots join with commas and "and" ("food, education, and healthcare").
- Singular/plural: counts of 1 render "1 member" / "1 child" via a small formatter, so the fixed sentence stays grammatical.
- Checklist lists every missing **required** slot with a jump link; Submit stays disabled with a reason until required slots are filled or an authorized exception is recorded.
- Autosave per slot; optimistic locking via `revision`.

## 6. Data changes
| Change | Detail |
|--------|--------|
| `document_templates.report_schema jsonb` | Static blocks + slot refs + section order + table definitions; versioned with the template (immutable once active) |
| `report_slot_defs` (or part of schema) | Slot registry (key, type, source, required, options) |
| `case_assessments.content.slots` | `{key: {value, source, overridden, original}}` |
| `case_assessments.content.family_rows` | Overlay edits per member (member_id → changed cells) |
| `intervention_catalog` | id, need, objective, activities[], default_responsible[], expected_output, default_timeline, active, sort |
| `interventions` (existing) | Add `catalog_id`, `included bool`, `custom bool`, `activities_override`, `timeline`, `responsible` |
| `system_settings` | `report.goal_year`, `report.locality` (default "Tagbilaran City, Bohol"), `report.signatories[]`, `report.adult_age_threshold` |
| Column mapping (F03) | Add the "CAR report fields" group so household columns used by slots are mapped explicitly |

"Tagbilaran City, Bohol" is hardcoded in the template text of IV.A and IV.B. Treat it as a setting-backed slot so the system is not locked to one city (owner decides).

## 7. Refactor phases
| Phase | Work | Output |
|-------|------|--------|
| R0 Audit | Review the current CAR page, field list and how DOCX is produced today | Gap list |
| R1 Template extraction | Convert the .docx into a template definition: static text + slot tokens; fix defects (§4.4); freeze as template v1 | `report_schema` v1 |
| R2 Slot registry + data map | Define all slots (§4), map derived ones to the confirmed workbook columns — extend the `cars/index.ts` read path over `household_members → import_rows.normalized` — add missing `HEADER_ALIASES` (e.g. `HH_SET_GROUP → HH_SET`), write computed formulas (age, counts, formatting) | Slot registry + unit tests |
| R3 UI components | `CarDocument`, `Section`, `StaticBlock`, `Slot`, `FamilyTable`, `InterventionTable`, context panel; Edit / Preview / Print modes | New report page behind a feature flag |
| R4 Intervention catalog | Seed the standard rows, include/exclude/add custom, per-row slots | Catalog + editor |
| R5 DOCX parity | Map the same schema to Docxtemplater (loops for family and interventions), generate, compare | UI ≙ DOCX test |
| R6 Migration | Convert existing draft CAR content into slot values; keep old revisions readable | Migration script + rollback |
| R7 Verification | Golden tests, accessibility, print layout, role checks | Sign-off |

Delivery: ship R1–R3 behind a flag, run old and new pages side by side for a pilot batch, then switch over.

## 8. Requirements added
See `.agents/REQUIREMENTS.md` §1.12 (`REQ-RPT-001…014`). Highlights: static text always shown and read-only; only blanks dynamic; one value per slot shown everywhere; UI and DOCX share one template version; overrides keep the original and are audited; missing required slots block approval; sensitive slots masked.

## 9. Test plan
| Test | Pass condition |
|------|---------------|
| Golden render | A sample household renders to a known expected text with no unresolved `{{ }}` or `____` |
| Static integrity | Static paragraphs are byte-identical to the template version, and not editable |
| One-value-many-places | Changing `barangay` updates IV.A and IV.B |
| UI ≙ DOCX | Text extracted from the generated DOCX equals the UI preview text (whitespace-normalized) |
| Family table | 5 members → 5 rows; excluded member removed with audit; Monitored Child YES/NO correct |
| Counts | adults + children = members; singular/plural correct for 1 and 0 |
| Overrides | Original kept, reason required, audit row written, raw rows untouched |
| Missing slots | Checklist matches actual blanks; Submit disabled until required slots filled |
| Grantee | Cannot open the report for a household without a validated grantee |
| Sensitive | National ID, contact, disability masked until Reveal; Reveal logged |
| Versioning | Editing an approved CAR creates a new revision; the template version used is recorded |
| Print | PDF page breaks keep table rows intact; signatories not orphaned |

## 10. Risks
| Risk | Mitigation |
|------|-----------|
| UI and DOCX drift | Single template definition, UI ≙ DOCX test in CI |
| Workbook lacks many fields | Mark as manual slots; show clearly what is auto-filled vs typed |
| Sentences break with odd values | Formatter helpers, live sentence preview, length limits |
| Template wording changes later | New template version; old CARs keep the version they used |
| Wrong provider/income auto-suggested | Suggest only; user confirms; source shown |
| Leftover names ("Vicenta", "Ramil") reach approved reports | Fix in template v1; add a lint rule: no literal personal names in static text |

## 11. Open questions (owner)
1. Which workbook columns exist for each derived slot in §4? (Needed to finish R2.)
2. *Family name* in "The family of ____": surname or the grantee's full name?
3. Adult/child age cut-off (assumed 18)?
4. Which slots are **required** for approval, and who may grant exceptions?
5. Should "Tagbilaran City, Bohol" be fixed or a setting? Should the goal year (2027) be a setting?
6. Signatories: fixed names, or chosen per CAR? Should dates be auto-filled at approval or left blank?
7. Order of family rows (grantee first, then by age?) and whether excluded members still appear (struck through) in the report.
8. Is the Intervention catalog complete (the six standard rows), and who maintains it (admin only)?
9. Does a CAR need the "Level 2" / "Active" variant of the template (file name suggests there are other variants)?