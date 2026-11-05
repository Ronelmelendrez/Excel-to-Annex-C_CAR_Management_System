/**
 * Annex C CASE ASSESSMENT REPORT (CAR) — versioned report template definition.
 *
 * Single source of truth for the CAR report page and the DOCX/PDF generator:
 * static wording lives here (versioned), never in components. Only `{{slot}}`
 * blanks are dynamic. Pure JavaScript — no Deno, browser, or database APIs —
 * so the Edge Function, the React app, and tests all read this same file.
 *
 * Template v1 was extracted from "Annex C CASE STUDY REPORT FOR ACTIVE OR
 * LEVEL 2.docx" (repo root) and fixes the defects found in that file:
 *   - leftover personal names from an old case ("Vicenta", "Ramil") are now
 *     `{{grantee_possessive}}` / `{{grantee_first_name}}` slots (REQ-RPT-014),
 *   - "Tagbilaran City, Bohol" typed into the prose is a setting-backed slot,
 *   - signatory names are settings, not static text.
 */

export const REPORT_TEMPLATE_VERSION = 'annex-c-car-v1';
export const REPORT_TEMPLATE_SOURCE =
  'Annex C CASE STUDY REPORT FOR ACTIVE OR LEVEL 2.docx';

/* ------------------------------------------------------------------ slots */

export type SlotType = 'text' | 'longtext' | 'number' | 'date' | 'select';
export type SlotSource = 'derived' | 'computed' | 'manual' | 'setting';
export type SlotFormat = 'money' | 'date_long' | 'phrase' | 'text';

export type ReportSectionId =
  | 'header'
  | 'identity'
  | 'family'
  | 'problem'
  | 'background'
  | 'environment'
  | 'assessment'
  | 'intervention'
  | 'recommendation'
  | 'signatory';

export type SlotDef = {
  key: string;
  /** Label exactly as the paper form writes it. */
  label: string;
  type: SlotType;
  source: SlotSource;
  section: ReportSectionId;
  /** Empty required slots block approval (owner list, plan §4). */
  required: boolean;
  /** Where the value comes from: `grantee.data.<FIELD>`, `household.<field>`,
   *  `formula:<name>`, or `setting:<key>`. Documentation + derivation switch. */
  from?: string;
  format?: SlotFormat;
  /** Singular/plural nouns for `format: 'phrase'` count slots. */
  phrase?: { one: string; many: string };
  options?: string[];
  /** Masked by default; reveal is logged (REQ-RPT-012). */
  sensitive?: boolean;
  note?: string;
};

export type SlotValue = {
  value: string;
  source?: SlotSource;
  /** Set only by an explicit override of a derived value (REQ-RPT-007). */
  overridden?: boolean;
  /** Original derived value, kept forever. */
  original?: string | null;
  reason?: string;
  at?: string;
};

export type SlotValues = Record<string, SlotValue | undefined>;

export const SLOT_DEFS: SlotDef[] = [
  // Header
  { key: 'report_date', label: 'Date', type: 'date', source: 'manual', section: 'header', required: true, format: 'date_long', note: 'Defaults to today while Draft; editable.' },

  // I. Identifying Information
  { key: 'grantee_name', label: 'Grantee’s Name', type: 'text', source: 'derived', section: 'identity', required: true, from: 'grantee.name', note: 'Validated grantee only.' },
  { key: 'household_id', label: 'Household ID Number', type: 'text', source: 'derived', section: 'identity', required: true, from: 'household.hhId' },
  { key: 'hh_set_group', label: 'HH Set Group', type: 'text', source: 'derived', section: 'identity', required: true, from: 'grantee.data.HH_SET' },
  { key: 'national_id_no', label: 'National ID No.', type: 'text', source: 'manual', section: 'identity', required: false, sensitive: true, note: 'No workbook column; sensitive.' },
  { key: 'sex', label: 'Sex', type: 'text', source: 'derived', section: 'identity', required: true, from: 'grantee.data.SEX' },
  { key: 'birthday', label: 'Birthday', type: 'text', source: 'derived', section: 'identity', required: true, from: 'grantee.data.BIRTHDAY' },
  { key: 'age', label: 'Age', type: 'number', source: 'computed', section: 'identity', required: true, from: 'formula:age', note: 'From birthday as of the report date; workbook AGE is a cross-check.' },
  { key: 'place_of_birth', label: 'Place of Birth', type: 'text', source: 'manual', section: 'identity', required: false, note: 'No workbook column.' },
  { key: 'civil_status', label: 'Civil Status', type: 'text', source: 'derived', section: 'identity', required: true, from: 'grantee.data.CIVIL_STATUS' },
  { key: 'present_address', label: 'Present Address', type: 'text', source: 'derived', section: 'identity', required: true, from: 'formula:present_address', note: 'Composed from REGION/PROVINCE/MUNICIPALITY/BARANGAY when present.' },
  { key: 'educational_attainment', label: 'Educational Attainment', type: 'text', source: 'derived', section: 'identity', required: true, from: 'grantee.data.GRADE_LEVEL', note: 'GRADE_LEVEL is an approximation (grade ≠ attainment).' },
  { key: 'contact_info', label: 'Contact information', type: 'text', source: 'manual', section: 'identity', required: false, sensitive: true, note: 'No workbook column; masked by default.' },
  { key: 'religion', label: 'Religion', type: 'text', source: 'manual', section: 'identity', required: false, note: 'No workbook column.' },
  { key: 'ip_affiliation', label: 'IP Affiliation', type: 'text', source: 'derived', section: 'identity', required: true, from: 'grantee.data.IP_AFFLIATION' },
  { key: 'source_of_information', label: 'Source of Information', type: 'text', source: 'manual', section: 'identity', required: true },
  { key: 'wellbeing_present', label: 'HH level of well-being (present)', type: 'text', source: 'manual', section: 'identity', required: false },
  { key: 'previous_assessment', label: 'Previous assessment (if applicable)', type: 'text', source: 'manual', section: 'identity', required: false },
  { key: 'hh_risk_level', label: 'HH Risk Level Category', type: 'text', source: 'manual', section: 'identity', required: false },
  { key: 'case_category', label: 'Case Category (for special cases)', type: 'text', source: 'manual', section: 'identity', required: false, note: 'Workbook CS_CATEGORY/CLIENT_STATUS exist but are unconfirmed.' },

  // IV.A Background Information — The Family
  { key: 'family_name', label: 'Family name', type: 'text', source: 'derived', section: 'background', required: true, from: 'grantee.last_name', note: 'Wording to confirm: surname vs. grantee full name (owner Q2).' },
  { key: 'member_count', label: 'Members', type: 'number', source: 'computed', section: 'background', required: true, from: 'formula:member_count', format: 'phrase', phrase: { one: 'member', many: 'members' } },
  { key: 'adult_count', label: 'Adults', type: 'number', source: 'computed', section: 'background', required: true, from: 'formula:adult_count', format: 'phrase', phrase: { one: 'adult', many: 'adults' } },
  { key: 'child_count', label: 'Children', type: 'number', source: 'computed', section: 'background', required: true, from: 'formula:child_count', format: 'phrase', phrase: { one: 'child', many: 'children' } },
  { key: 'residence_locality', label: 'Currently residing in', type: 'text', source: 'derived', section: 'background', required: true, from: 'household.municipality' },
  { key: 'barangay', label: 'Barangay', type: 'text', source: 'derived', section: 'background', required: true, from: 'household.barangay', note: 'Entered once; shown in IV.A and IV.B.' },
  { key: 'locality', label: 'City/Municipality and province', type: 'text', source: 'setting', section: 'background', required: true, from: 'setting:report.locality', note: 'Was typed into the template prose; now a setting so the system is not locked to one city.' },
  { key: 'primary_provider_name', label: 'Household is primarily supported by', type: 'text', source: 'derived', section: 'background', required: true, from: 'formula:provider', note: 'Suggests the HH head/grantee; case worker confirms.' },
  { key: 'provider_occupation', label: 'Works as', type: 'text', source: 'manual', section: 'background', required: true, note: 'No workbook column for occupation.' },
  { key: 'provider_monthly_income', label: 'Estimated monthly income', type: 'text', source: 'manual', section: 'background', required: true, format: 'money', note: 'No workbook column for income; rendered as PHP 12,500.00 after the static "PHP ".' },
  { key: 'family_challenges', label: 'Challenges related to', type: 'longtext', source: 'manual', section: 'background', required: true },

  // IV.B Environment/Community
  { key: 'community_characteristics', label: 'Community is characterized by', type: 'longtext', source: 'manual', section: 'environment', required: true },
  { key: 'basic_services', label: 'Basic services such as', type: 'longtext', source: 'manual', section: 'environment', required: true },
  { key: 'residence_description', label: 'Residence is described as', type: 'longtext', source: 'manual', section: 'environment', required: true },
  { key: 'housing_materials', label: 'Housing materials made of', type: 'longtext', source: 'manual', section: 'environment', required: true, note: 'No workbook column.' },
  { key: 'access_level', label: 'Access to transportation, livelihood, schools and health facilities', type: 'select', source: 'manual', section: 'environment', required: true, options: ['limited', 'adequate', 'easy'] },
  { key: 'neighbor_relationship', label: 'Relationship with neighbors', type: 'longtext', source: 'manual', section: 'environment', required: true },

  // V. Assessment
  { key: 'assessment_challenges', label: 'Experiencing challenges related to', type: 'longtext', source: 'manual', section: 'assessment', required: true, from: 'family_challenges', note: 'Defaults to family_challenges until edited.' },
  { key: 'primary_income_source', label: 'Primary source of income', type: 'text', source: 'manual', section: 'assessment', required: true, note: 'No workbook column for occupation/income.' },
  { key: 'income_sufficiency', label: 'Income sufficiency', type: 'select', source: 'manual', section: 'assessment', required: true, options: ['sufficient', 'insufficient'] },
  { key: 'coping_demonstrated', label: 'Demonstrated in coping', type: 'longtext', source: 'manual', section: 'assessment', required: true },
  { key: 'assessment_difficulties', label: 'Difficulties in terms of', type: 'longtext', source: 'manual', section: 'assessment', required: true },
  { key: 'strengths_resources', label: 'Strengths and resources', type: 'longtext', source: 'manual', section: 'assessment', required: true },
  { key: 'recommended_support', label: 'May benefit from', type: 'longtext', source: 'manual', section: 'assessment', required: true },

  // Intervention plan
  { key: 'goal_year', label: 'Goal year', type: 'text', source: 'setting', section: 'intervention', required: true, from: 'setting:report.goal_year' },
  { key: 'grantee_first_name', label: 'Grantee first name', type: 'text', source: 'computed', section: 'intervention', required: false, from: 'formula:grantee_first_name', note: 'Used inside intervention activities ("refer ___ to RHU"); replaces the leftover "Ramil".' },
  { key: 'grantee_possessive', label: 'Grantee first name (possessive)', type: 'text', source: 'computed', section: 'intervention', required: false, from: 'formula:grantee_possessive', note: 'Used in remarks ("maintain the ___ overall health"); replaces the leftover "Vicenta’s".' },

  // Signatories
  { key: 'prepared_by_name', label: 'Prepared by (name)', type: 'text', source: 'setting', section: 'signatory', required: false, from: 'setting:report.signatories.prepared_by.name' },
  { key: 'prepared_by_title', label: 'Prepared by (title)', type: 'text', source: 'setting', section: 'signatory', required: false, from: 'setting:report.signatories.prepared_by.title' },
  { key: 'prepared_by_date', label: 'Prepared by (date)', type: 'date', source: 'manual', section: 'signatory', required: false, note: 'Left blank for wet-ink signing (owner Q6).' },
  { key: 'concurred_by_name', label: 'Concurred by (name)', type: 'text', source: 'setting', section: 'signatory', required: false, from: 'setting:report.signatories.concurred_by.name' },
  { key: 'concurred_by_title', label: 'Concurred by (title)', type: 'text', source: 'setting', section: 'signatory', required: false, from: 'setting:report.signatories.concurred_by.title' },
  { key: 'concurred_by_date', label: 'Concurred by (date)', type: 'date', source: 'manual', section: 'signatory', required: false },
  { key: 'approved_by_name', label: 'Approved by (name)', type: 'text', source: 'setting', section: 'signatory', required: false, from: 'setting:report.signatories.approved_by.name' },
  { key: 'approved_by_title', label: 'Approved by (title)', type: 'text', source: 'setting', section: 'signatory', required: false, from: 'setting:report.signatories.approved_by.title' },
  { key: 'approved_by_date', label: 'Approved by (date)', type: 'date', source: 'manual', section: 'signatory', required: false },
];

export const SLOT_BY_KEY: Record<string, SlotDef> = Object.fromEntries(
  SLOT_DEFS.map((def) => [def.key, def]),
);

/* --------------------------------------------------------------- settings */

/** Seed values for `system_settings`-backed slots. Admin settings, never
 *  static template text (REQ-RPT-014 lint scans static blocks only). */
export const DEFAULT_REPORT_SETTINGS: Record<string, string> = {
  'report.locality': 'Tagbilaran City, Bohol',
  'report.goal_year': '2027',
  'report.adult_age_threshold': '18',
  'report.signatories.prepared_by.name': 'JAY ANN L. EMBUSCADO, RSW',
  'report.signatories.prepared_by.title': 'City Link',
  'report.signatories.concurred_by.name': 'MICHAEL ANGELO ADO, RSW',
  'report.signatories.concurred_by.title': 'Social Welfare Officer III',
  'report.signatories.approved_by.name': 'LUZ C. FEGARIDO, RSW',
  'report.signatories.approved_by.title': 'Provincial Link',
};

export type ReportSettings = Record<string, string>;

export function resolveSettings(overrides?: Partial<ReportSettings> | null): ReportSettings {
  const merged: ReportSettings = { ...DEFAULT_REPORT_SETTINGS };
  for (const [key, value] of Object.entries(overrides ?? {})) {
    if (typeof value === 'string') merged[key] = value;
  }
  return merged;
}

/** Workbook columns snapshotted onto each family row when a CAR is created
 *  (the plan's "CAR report fields" group). Everything else is not read back. */
export const CAR_MEMBER_FIELDS = [
  'REGION',
  'PROVINCE',
  'MUNICIPALITY',
  'BARANGAY',
  'FIRST_NAME',
  'LAST_NAME',
  'SEX',
  'BIRTHDAY',
  'AGE',
  'CIVIL_STATUS',
  'RELATION_TO_HH_HEAD',
  'HH_SET',
  'IP_AFFLIATION',
  'GRADE_LEVEL',
  'DISABILITY_TYPES',
  'CHILD_BENE',
  'EDUC_MONITORED',
  'MEMBER_STATUS',
] as const;

/* ---------------------------------------------------------------- template */

export type ReportField = { label: string; slot: string };

export type ReportBlock =
  | { kind: 'title'; text: string }
  | { kind: 'heading'; level: 2 | 3; text: string }
  | { kind: 'para'; text: string; align?: 'right' }
  | { kind: 'fields'; fields: ReportField[] }
  | { kind: 'familyTable' }
  | { kind: 'goal'; text: string }
  | { kind: 'interventionTable' }
  | { kind: 'signatories' };

export type ReportSection = {
  id: ReportSectionId;
  /** Short label for the section rail (I, II, III, IV.A, …). */
  rail: string;
  title: string;
  blocks: ReportBlock[];
  /** Fixed wording only — no slots (Section III). */
  staticOnly?: boolean;
};

export type ReportTemplate = {
  version: string;
  name: string;
  sourceFile: string;
  sections: ReportSection[];
};

const PRESENTING_PROBLEM_TEXT =
  'The family is experiencing financial difficulties due to limited and/or unstable income, making it challenging to meet their basic needs, including food, education, healthcare, and other daily expenses. The situation requires further assessment to identify the family’s needs, available resources, and appropriate interventions to improve their overall well-being.';

const THE_FAMILY_TEXT =
  'The family of {{family_name}} consists of {{member_count}}, including {{adult_count}} and {{child_count}}. ' +
  'The family is currently residing in {{residence_locality}}, Barangay {{barangay}}, {{locality}}. ' +
  'The household is primarily supported by {{primary_provider_name}}, who works as a {{provider_occupation}} ' +
  'with an estimated monthly income of PHP {{provider_monthly_income}}. The family’s income is mainly used ' +
  'for food, education, healthcare, utilities, and other daily expenses. Despite their efforts to meet their ' +
  'basic needs, the family experiences challenges related to {{family_challenges}}. The family’s current ' +
  'situation requires appropriate support and interventions to improve their living conditions and overall well-being.';

const ENVIRONMENT_TEXT =
  'The family resides in Barangay {{barangay}}, which is characterized by {{community_characteristics}}. ' +
  'The community has access to basic services such as {{basic_services}}, although the availability and ' +
  'accessibility of these services may vary depending on the family’s location and financial capacity. ' +
  'The family’s residence is described as {{residence_description}}, with housing materials primarily made ' +
  'of {{housing_materials}}. Their access to transportation, livelihood opportunities, educational institutions, ' +
  'and healthcare facilities is {{access_level}}. The family’s relationship with neighbors and community ' +
  'members is described as {{neighbor_relationship}}. These environmental and community factors may influence ' +
  'the family’s daily living conditions, access to resources, and overall well-being.';

const ASSESSMENT_TEXT_1 =
  'Based on the information gathered during the assessment and interview, the family of {{family_name}} ' +
  'is currently experiencing challenges related to {{assessment_challenges}}. The household’s primary source ' +
  'of income is {{primary_income_source}}, which is [{{income_sufficiency}}] to meet their basic needs. ' +
  'The family has demonstrated {{coping_demonstrated}} in coping with their current situation. However, they ' +
  'continue to face difficulties in terms of {{assessment_difficulties}}.';

const ASSESSMENT_TEXT_2 =
  'The family has available strengths and resources, including {{strengths_resources}}, which may help them ' +
  'address their identified concerns. Based on the assessment, the family may benefit from {{recommended_support}} ' +
  'to improve their living conditions, strengthen their capacity to manage their resources, and promote their ' +
  'overall well-being. Continued monitoring and appropriate interventions are recommended to support the family ' +
  'in achieving greater stability and self-sufficiency.';

const GOAL_TEXT =
  'Goal: At the end of {{goal_year}} the family improve their economic stability and well-being through better access to program and services.';

const RECOMMENDATION_TEXT =
  'It is recommended that the family of {{family_name}} be provided with appropriate interventions and assistance ' +
  'based on their identified needs and current circumstances. The family may be referred to relevant government ' +
  'agencies, community resources, and available livelihood or employment programs to help address their concerns ' +
  'and improve their financial stability. Continued monitoring, home visits, and appropriate guidance are also ' +
  'recommended to assess the family’s progress and ensure the interventions are responsive to their needs. ' +
  'The family is encouraged to actively participate in the recommended interventions and utilize available ' +
  'resources to improve their overall well-being and work toward self-sufficiency.';

export const REPORT_TEMPLATE: ReportTemplate = {
  version: REPORT_TEMPLATE_VERSION,
  name: 'CASE ASSESSMENT REPORT (CAR)',
  sourceFile: REPORT_TEMPLATE_SOURCE,
  sections: [
    {
      id: 'header',
      rail: '',
      title: 'CASE ASSESSMENT REPORT (CAR)',
      blocks: [
        { kind: 'title', text: 'CASE ASSESSMENT REPORT (CAR)' },
        { kind: 'para', text: 'Date: {{report_date}}', align: 'right' },
      ],
    },
    {
      id: 'identity',
      rail: 'I',
      title: 'Identifying Information',
      blocks: [
        { kind: 'heading', level: 2, text: 'Identifying Information:' },
        {
          kind: 'fields',
          fields: [
            { label: 'Grantee’s Name:', slot: 'grantee_name' },
            { label: 'Household ID Number:', slot: 'household_id' },
            { label: 'HH Set Group:', slot: 'hh_set_group' },
            { label: 'National ID No.:', slot: 'national_id_no' },
            { label: 'Sex:', slot: 'sex' },
            { label: 'Birthday:', slot: 'birthday' },
            { label: 'Age:', slot: 'age' },
            { label: 'Place of Birth:', slot: 'place_of_birth' },
            { label: 'Civil Status:', slot: 'civil_status' },
            { label: 'Present Address:', slot: 'present_address' },
            { label: 'Educational Attainment:', slot: 'educational_attainment' },
            { label: 'Contact information:', slot: 'contact_info' },
            { label: 'Religion:', slot: 'religion' },
            { label: 'IP Affiliation:', slot: 'ip_affiliation' },
            { label: 'Source of Information:', slot: 'source_of_information' },
            { label: 'HH level of well-being (present):', slot: 'wellbeing_present' },
            { label: 'Previous assessment (if applicable):', slot: 'previous_assessment' },
            { label: 'HH Risk Level Category:', slot: 'hh_risk_level' },
            { label: 'Case Category (for special cases):', slot: 'case_category' },
          ],
        },
      ],
    },
    {
      id: 'family',
      rail: 'II',
      title: 'Family Composition',
      blocks: [
        { kind: 'heading', level: 2, text: 'Family Composition:' },
        { kind: 'familyTable' },
      ],
    },
    {
      id: 'problem',
      rail: 'III',
      title: 'Presenting Problem',
      staticOnly: true,
      blocks: [
        { kind: 'heading', level: 2, text: 'Presenting Problem' },
        { kind: 'para', text: PRESENTING_PROBLEM_TEXT },
      ],
    },
    {
      id: 'background',
      rail: 'IV.A',
      title: 'Background Information',
      blocks: [
        { kind: 'heading', level: 2, text: 'Background Information' },
        { kind: 'heading', level: 3, text: 'The Family' },
        { kind: 'para', text: THE_FAMILY_TEXT },
      ],
    },
    {
      id: 'environment',
      rail: 'IV.B',
      title: 'Environment/Community',
      blocks: [
        { kind: 'heading', level: 3, text: 'Environment/ Community' },
        { kind: 'para', text: ENVIRONMENT_TEXT },
      ],
    },
    {
      id: 'assessment',
      rail: 'V',
      title: 'Assessment',
      blocks: [
        { kind: 'heading', level: 2, text: 'Assessment' },
        { kind: 'para', text: ASSESSMENT_TEXT_1 },
        { kind: 'para', text: ASSESSMENT_TEXT_2 },
      ],
    },
    {
      id: 'intervention',
      rail: 'Plan',
      title: 'Intervention Plan',
      blocks: [
        { kind: 'heading', level: 2, text: 'INTERVENTION PLAN' },
        { kind: 'goal', text: GOAL_TEXT },
        { kind: 'interventionTable' },
      ],
    },
    {
      id: 'recommendation',
      rail: 'VI',
      title: 'Recommendation',
      blocks: [
        { kind: 'heading', level: 2, text: 'Recommendation' },
        { kind: 'para', text: RECOMMENDATION_TEXT },
      ],
    },
    {
      id: 'signatory',
      rail: 'Sig',
      title: 'Signatories',
      blocks: [{ kind: 'signatories' }],
    },
  ],
};

/* ------------------------------------------------------- family table */

export type FamilyColumnKey =
  | 'name'
  | 'sex'
  | 'age'
  | 'civilStatus'
  | 'relationship'
  | 'stayingWithHh'
  | 'monitoredChild'
  | 'educationalAttainment'
  | 'occupation'
  | 'monthlyIncome'
  | 'typeOfDisability';

export type FamilyColumn = {
  key: FamilyColumnKey;
  label: string;
  /** YES/NO split sub-columns (Monitored Child). */
  split?: [string, string];
  /** Workbook column the cell derives from, when there is one. */
  from?: string;
};

export const FAMILY_COLUMNS: FamilyColumn[] = [
  { key: 'name', label: 'Name', from: 'member.name' },
  { key: 'sex', label: 'Sex', from: 'data.SEX' },
  { key: 'age', label: 'Age', from: 'member.age' },
  { key: 'civilStatus', label: 'Civil Status', from: 'data.CIVIL_STATUS' },
  { key: 'relationship', label: 'Relationship to the grantee', from: 'data.RELATION_TO_HH_HEAD' },
  { key: 'stayingWithHh', label: 'Staying with the HH' },
  { key: 'monitoredChild', label: 'Monitored Child', split: ['YES', 'NO'], from: 'data.CHILD_BENE' },
  { key: 'educationalAttainment', label: 'Educational Attainment', from: 'data.GRADE_LEVEL' },
  { key: 'occupation', label: 'Occupation' },
  { key: 'monthlyIncome', label: 'Monthly Income' },
  { key: 'typeOfDisability', label: 'Type of Disability', from: 'data.DISABILITY_TYPES' },
];

export type FamilyMemberLike = {
  name?: string;
  age?: number | null;
  relationship?: string;
  data?: Record<string, string | undefined>;
  overlay?: Record<string, string>;
};

function yesNo(value: string | undefined): string {
  const normalized = (value ?? '').trim().toLowerCase();
  if (['yes', 'y', 'true', '1'].includes(normalized)) return 'YES';
  if (['no', 'n', 'false', '0'].includes(normalized)) return 'NO';
  return '';
}

/** Cell value: overlay (case-worker correction) wins, else the derived
 *  workbook value, else '' (a blank on the paper form). Raw import rows are
 *  never modified (REQ-RPT-007). */
export function familyCellDisplay(column: FamilyColumnKey, member: FamilyMemberLike): string {
  const overlay = member.overlay ?? {};
  if (Object.prototype.hasOwnProperty.call(overlay, column)) return overlay[column];
  const data = member.data ?? {};
  switch (column) {
    case 'name':
      return member.name ?? '';
    case 'age':
      return member.age === null || member.age === undefined ? '' : String(member.age);
    case 'relationship':
      return (member.relationship ?? '').trim() || (data.RELATION_TO_HH_HEAD ?? '');
    case 'sex':
      return data.SEX ?? '';
    case 'civilStatus':
      return data.CIVIL_STATUS ?? '';
    case 'stayingWithHh':
      return data.MEMBER_STATUS ?? '';
    case 'monitoredChild':
      return yesNo(data.CHILD_BENE) || yesNo(data.EDUC_MONITORED);
    case 'educationalAttainment':
      return data.GRADE_LEVEL ?? '';
    case 'occupation':
      return '';
    case 'monthlyIncome':
      return '';
    case 'typeOfDisability':
      return data.DISABILITY_TYPES ?? '';
    default:
      return '';
  }
}

/* --------------------------------------------------- intervention catalog */

export type InterventionCatalogRow = {
  id: string;
  need: string;
  objective: string;
  /** May contain {{grantee_first_name}} / {{grantee_possessive}} tokens —
   *  the v1 fix for the leftover "Vicenta"/"Ramil" names. */
  activities: string;
  responsible: string;
  timeline: string;
  remarks: string;
};

/** Standard rows shipped with template v1; an admin maintains the live
 *  catalog, each CAR may include/exclude rows or add custom ones. */
export const DEFAULT_INTERVENTION_CATALOG: InterventionCatalogRow[] = [
  {
    id: 'int-medical',
    need: 'Medical Assistance',
    objective: 'Avail free medical assistance and check-up',
    activities:
      '-refer {{grantee_first_name}} to RHU or barangay health center for monthly heath check up and receive free medicine',
    responsible: 'Brgy. Health Center\nRHU',
    timeline: '',
    remarks:
      'Access regular health services, receive timely medical checkup, and maintain the {{grantee_possessive}} overall health and well-being.',
  },
  {
    id: 'int-scholarship',
    need: 'Scholarship for college ongoing children',
    objective: 'To avail educational scholarship',
    activities:
      '- {{grantee_first_name}} attend career pathway seminars\n-apply scholarship in CHED\n-take entrance examination in state university\n-apply and take exam in DOST\n-refer to DSWD for educational assistance',
    responsible: 'CHED\nDOST\nDSWD',
    timeline: '',
    remarks: 'Avail scholarship for college',
  },
  {
    id: 'int-social-network',
    need: 'Increased social network',
    objective: 'Strengthen social support',
    activities:
      'Encourage participation in more community support groups\n-continue to actively participate their SHG',
    responsible: 'Grantee\nLGU Tagbilaran\nBarangay Officials',
    timeline: '',
    remarks:
      'Increase involvement in community support groups and build a stronger network for guidance and assistance during times of need.',
  },
  {
    id: 'int-employment',
    need: 'Stable Employment',
    objective: 'To obtain stable employment',
    activities:
      '-Encourage {{grantee_first_name}} to apply in any job vacancy position that aligns with his skills\n-refer to PESO for job vacancy',
    responsible: '{{responsible_person}}\nPESO\nLGU\nML',
    timeline: '',
    remarks:
      'Secure a steady job that provides consistent income and benefits, ensuring financial stability for the family.',
  },
  {
    id: 'int-capability',
    need: 'Capability Building',
    objective: 'Enhance Entrepreneurial Skills',
    activities:
      'link {{grantee_first_name}} to TESDA to access technical assistance\n-refer {{grantee_first_name}} to SLP for livelihood assistance and capability building.',
    responsible: '{{responsible_person}}\nTESDA\nSLP\nML',
    timeline: '',
    remarks: 'Avail livelihood assistance and capability building.',
  },
  {
    id: 'int-monitoring',
    need: 'Progress Monitoring',
    objective: 'To monitor and evaluate progress',
    activities: 'Regular household monitoring and follow-up',
    responsible: 'Grantee\nCase Manager',
    timeline: 'Every 6mons',
    remarks: 'Accurately monitor and evaluate progress',
  },
];

export const INTERVENTION_COLUMNS = [
  'Need/Problem',
  'Objective',
  'Helping Activities',
  'Responsible Person',
  'Timeline',
  'Remarks/Expected Outputs',
] as const;

/* --------------------------------------------------------------- rendering */

export type TextSegment = { t: 'text'; value: string } | { t: 'slot'; key: string };

const TOKEN_RE = /\{\{([a-z0-9_]+)\}\}/g;

/** Splits static text into plain-text and slot segments for the UI. */
export function parseSegments(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  TOKEN_RE.lastIndex = 0;
  while ((match = TOKEN_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ t: 'text', value: text.slice(lastIndex, match.index) });
    }
    segments.push({ t: 'slot', key: match[1] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) segments.push({ t: 'text', value: text.slice(lastIndex) });
  return segments;
}

/** Token keys referenced by a piece of static text. */
export function slotKeysIn(text: string): string[] {
  return parseSegments(text)
    .filter((segment): segment is { t: 'slot'; key: string } => segment.t === 'slot')
    .map((segment) => segment.key);
}

export function formatMoney(raw: string): string {
  const numeric = Number(String(raw).replace(/[^0-9.-]/g, ''));
  if (!Number.isFinite(numeric) || String(raw).trim() === '') return raw;
  return numeric.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatDateLong(raw: string): string {
  const date = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

/** Formatted display text for a filled slot; '' when the raw value is empty. */
export function formatSlotValue(def: SlotDef | undefined, raw: string): string {
  if (!def) return raw;
  const value = String(raw ?? '');
  if (def.format === 'money') return formatMoney(value);
  if (def.format === 'date_long') return formatDateLong(value);
  if (def.format === 'phrase' && def.phrase) {
    const count = Number(value);
    if (!Number.isFinite(count)) return value;
    return `${count} ${count === 1 ? def.phrase.one : def.phrase.many}`;
  }
  return value;
}

/** Display text for a slot, or null when it is still a blank (`____`). */
export function slotDisplay(
  def: SlotDef | undefined,
  value: SlotValue | undefined,
): string | null {
  const raw = (value?.value ?? '').trim();
  if (!raw) return null;
  return formatSlotValue(def, raw);
}

/** Fills `{{token}}` placeholders with display text; blanks become `____`.
 *  Used for plain rendering: golden tests, sentence preview, DOCX parity. */
export function fillText(
  text: string,
  values: SlotValues,
  options?: { missing?: string; maskSensitive?: boolean; revealed?: Set<string> },
): string {
  const missing = options?.missing ?? '____';
  return parseSegments(text)
    .map((segment) => {
      if (segment.t === 'text') return segment.value;
      const def = SLOT_BY_KEY[segment.key];
      const display = formatSlotValue(def, values[segment.key]?.value ?? '');
      if (!display) return missing;
      if (def?.sensitive && options?.maskSensitive && !options.revealed?.has(def.key)) {
        return '•••••';
      }
      return display;
    })
    .join('');
}

/** Plain-text rendering of the whole template (golden tests / DOCX parity). */
export function fillTemplate(
  template: ReportTemplate,
  values: SlotValues,
  options?: { missing?: string },
): string[] {
  const lines: string[] = [];
  for (const section of template.sections) {
    for (const block of section.blocks) {
      switch (block.kind) {
        case 'title':
        case 'heading':
          lines.push(block.text);
          break;
        case 'para':
        case 'goal':
          lines.push(fillText(block.text, values, options));
          break;
        case 'fields':
          for (const field of block.fields) {
            lines.push(
              `${field.label} ${fillText(`{{${field.slot}}}`, values, options)}`.trimEnd(),
            );
          }
          break;
        default:
          break;
      }
    }
  }
  return lines;
}

/** Static sentence in the template that contains the given slot (live preview). */
export function sentenceForSlot(key: string, template: ReportTemplate = REPORT_TEMPLATE): string | null {
  for (const section of template.sections) {
    for (const block of section.blocks) {
      if ((block.kind === 'para' || block.kind === 'goal') && block.text.includes(`{{${key}}}`)) {
        return block.text;
      }
    }
  }
  return null;
}

/* ------------------------------------------------------------ derivation */

/** Family row as the derivation reads it. The client's `CarDraft` rows and
 *  the server's `content.familyComposition` both satisfy this shape. */
export type FamilySnapshot = {
  id?: string;
  name?: string;
  age?: number | null;
  relationship?: string;
  include?: boolean;
  sourceRow?: number;
  data?: Record<string, string>;
  /** Case-worker cell corrections kept beside the raw values, never over them. */
  overlay?: Record<string, string>;
};

/** The slice of a draft the derivation needs (client `CarDraft` / server
 *  `content`). Keeping this structural lets the editor and the Edge Function
 *  run the exact same code for slot values and completeness — completeness
 *  can never drift between the UI and `missing_fields`. */
export type ReportDraftLike = {
  hhId?: string;
  datePrepared?: string;
  granteeMemberId?: string;
  slots?: SlotValues;
  familyComposition?: FamilySnapshot[];
  interventions?: Array<{
    included?: boolean;
    need?: string;
    type?: string;
    objective?: string;
    activities?: string;
    responsible?: string;
    timeline?: string;
    remarks?: string;
    /** Per-row slot values (e.g. `responsible_person`), merged over the
     *  report's values when filling catalog text. */
    values?: Record<string, string>;
  }>;
};

export type HouseholdContext = { barangay?: string; municipality?: string } | null;
export type SettingsOverrides = Partial<ReportSettings> | null;

function memberData(member: FamilySnapshot | null | undefined): Record<string, string | undefined> {
  return member?.data ?? {};
}

export function granteeSnapshot(draft: ReportDraftLike): FamilySnapshot | null {
  const members = draft.familyComposition ?? [];
  return members.find((member) => member.id === draft.granteeMemberId) ?? null;
}

function includedSnapshots(draft: ReportDraftLike): FamilySnapshot[] {
  return (draft.familyComposition ?? []).filter((member) => member.include);
}

function firstToken(name: string): string {
  return name.trim().split(/\s+/)[0] ?? '';
}

function lastToken(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : '';
}

function todayIso(now?: Date): string {
  const date = now ?? new Date();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function adultThreshold(settings: ReportSettings): number {
  const raw = Number(settings['report.adult_age_threshold'] ?? '18');
  return Number.isFinite(raw) ? raw : 18;
}

/** Age from the workbook AGE cell when it parses, else birthday as of the
 *  report date, else the snapshot age. */
function computeAge(draft: ReportDraftLike): string {
  const member = granteeSnapshot(draft);
  const bag = memberData(member);
  const workbookAge = Number(bag.AGE);
  if (Number.isFinite(workbookAge) && String(bag.AGE ?? '').trim() !== '') {
    return String(Math.trunc(workbookAge));
  }
  const birthdayRaw = (bag.BIRTHDAY ?? '').trim();
  if (birthdayRaw) {
    const birthday = new Date(birthdayRaw);
    if (!Number.isNaN(birthday.getTime())) {
      const reportRaw = draft.slots?.report_date?.value || draft.datePrepared || todayIso();
      const reportDate = new Date(`${reportRaw}T00:00:00`);
      const reference = Number.isNaN(reportDate.getTime()) ? new Date() : reportDate;
      let age = reference.getFullYear() - birthday.getFullYear();
      const beforeBirthday =
        reference.getMonth() < birthday.getMonth() ||
        (reference.getMonth() === birthday.getMonth() && reference.getDate() < birthday.getDate());
      if (beforeBirthday) age -= 1;
      if (age >= 0 && age < 130) return String(age);
    }
  }
  if (typeof member?.age === 'number') return String(member.age);
  return '';
}

function computeProvider(draft: ReportDraftLike): string {
  const members = includedSnapshots(draft);
  const head = members.find((member) =>
    (member.relationship ?? '').toLowerCase().includes('head'),
  );
  return (head ?? granteeSnapshot(draft) ?? members[0])?.name ?? '';
}

function computePresentAddress(draft: ReportDraftLike, household: HouseholdContext): string {
  const bag = memberData(granteeSnapshot(draft));
  const fromWorkbook = [bag.REGION, bag.PROVINCE, bag.MUNICIPALITY, bag.BARANGAY]
    .map((part) => (part ?? '').trim())
    .filter(Boolean)
    .join(', ');
  if (fromWorkbook) return fromWorkbook;
  return [household?.barangay, household?.municipality]
    .map((part) => (part ?? '').trim())
    .filter(Boolean)
    .join(', ');
}

function householdField(
  draft: ReportDraftLike,
  household: HouseholdContext,
  field: string,
): string {
  const bag = memberData(granteeSnapshot(draft));
  if (field === 'barangay') {
    return (bag.BARANGAY ?? '').trim() || (household?.barangay ?? '').trim();
  }
  if (field === 'municipality') {
    return (bag.MUNICIPALITY ?? '').trim() || (household?.municipality ?? '').trim();
  }
  if (field === 'hhId') return draft.hhId ?? '';
  return '';
}

/** Value for a def's `from` formula, or '' when the formula yields nothing. */
function computedValue(
  def: SlotDef,
  draft: ReportDraftLike,
  household: HouseholdContext,
  settings: ReportSettings,
): string {
  const member = granteeSnapshot(draft);
  const name = member?.name ?? '';
  const bag = memberData(member);
  switch (def.from) {
    case 'formula:age':
      return computeAge(draft);
    case 'formula:member_count':
      return String(includedSnapshots(draft).length);
    case 'formula:adult_count': {
      const threshold = adultThreshold(settings);
      return String(includedSnapshots(draft).filter((row) => (row.age ?? 0) >= threshold).length);
    }
    case 'formula:child_count': {
      const threshold = adultThreshold(settings);
      return String(includedSnapshots(draft).filter((row) => (row.age ?? 0) < threshold).length);
    }
    case 'formula:present_address':
      return computePresentAddress(draft, household);
    case 'formula:provider':
      return computeProvider(draft);
    case 'formula:grantee_first_name': {
      const first = (bag.FIRST_NAME ?? '').trim();
      return first || firstToken(name);
    }
    case 'formula:grantee_possessive': {
      const first = (bag.FIRST_NAME ?? '').trim() || firstToken(name);
      return first ? `${first}’s` : '';
    }
    default:
      return '';
  }
}

/** Derived value from the snapshot/import data, or ''. */
function derivedValue(
  def: SlotDef,
  draft: ReportDraftLike,
  household: HouseholdContext,
): string {
  const member = granteeSnapshot(draft);
  const bag = memberData(member);
  const from = def.from ?? '';
  if (from.startsWith('grantee.data.')) {
    return (bag[from.slice('grantee.data.'.length)] ?? '').trim();
  }
  if (from === 'grantee.name') return (member?.name ?? '').trim();
  if (from === 'grantee.last_name') {
    const stored = (bag.LAST_NAME ?? '').trim();
    return stored || lastToken(member?.name ?? '');
  }
  if (from.startsWith('household.')) return householdField(draft, household, from.slice('household.'.length));
  if (from.startsWith('formula:')) return computedValue(def, draft, household, resolveSettings(null));
  return '';
}

/** Resolves every slot for rendering. Saved values win (overrides included);
 *  computed slots are always recalculated so counts never go stale. */
export function resolveSlotValues(
  draft: ReportDraftLike,
  household?: HouseholdContext,
  settingsOverrides?: SettingsOverrides,
): SlotValues {
  const settings = resolveSettings(settingsOverrides);
  const context: HouseholdContext = household ?? null;
  const saved = draft.slots ?? {};
  const values: SlotValues = {};

  for (const def of SLOT_DEFS) {
    const previous = saved[def.key];

    if (def.source === 'computed') {
      values[def.key] = { value: computedValue(def, draft, context, settings), source: 'computed' };
      continue;
    }

    if (def.source === 'setting') {
      if (previous?.value) {
        values[def.key] = previous;
      } else {
        const key = (def.from ?? '').replace(/^setting:/, '');
        values[def.key] = { value: settings[key] ?? '', source: 'setting' };
      }
      continue;
    }

    if (previous?.value) {
      values[def.key] = previous;
      continue;
    }

    if (def.key === 'report_date') {
      values[def.key] = { value: draft.datePrepared || todayIso(), source: 'manual' };
      continue;
    }

    if (def.source === 'derived') {
      values[def.key] = { value: derivedValue(def, draft, context), source: 'derived' };
      continue;
    }

    // Manual slot with a documented default (assessment_challenges ← family_challenges).
    if (def.from && SLOT_BY_KEY[def.from]) {
      const fallback = values[def.from]?.value ?? '';
      if (fallback) {
        values[def.key] = { value: fallback, source: 'derived' };
        continue;
      }
    }
    values[def.key] = { value: '', source: 'manual' };
  }
  return values;
}

/* ------------------------------------------------------------ DOCX data */

/**
 * Data object for the tagged Annex C .docx (docxtemplater), built from the
 * same derivation as the UI preview so REQ-RPT-005 holds by construction:
 *
 *   - every scalar slot key → formatted display text, blank → the paper's
 *     `____` (the same missing default `fillTemplate` renders),
 *   - `familyComposition` → one row per included member, cells exactly as
 *     `FamilyCompositionTable` shows them (overlay wins, blanks stay blank,
 *     Monitored Child splits into a ✓ in the YES/NO cell),
 *   - `interventions` → one row per included plan row, cells exactly as
 *     `InterventionPlanTable` shows them (`need || "Untitled row"`, filled
 *     catalog text or `____`), with catalog `{{...}}` tokens already resolved
 *     so no nested tag ever reaches docxtemplater.
 *
 * Used by the web DOCX generator, tests, and scripts — one builder, no drift.
 */
export function buildDocxData(
  draft: ReportDraftLike,
  household?: HouseholdContext,
  settingsOverrides?: SettingsOverrides,
): Record<string, unknown> {
  const values = resolveSlotValues(draft, household, settingsOverrides);
  const data: Record<string, unknown> = {};

  for (const def of SLOT_DEFS) {
    data[def.key] = formatSlotValue(def, values[def.key]?.value ?? '') || '____';
  }

  data.familyComposition = includedSnapshots(draft).map((member) => {
    const cell = (column: FamilyColumnKey) => familyCellDisplay(column, member);
    const monitored = cell('monitoredChild');
    return {
      member_name: cell('name'),
      member_sex: cell('sex'),
      member_age: cell('age'),
      member_civil_status: cell('civilStatus'),
      member_relationship: cell('relationship'),
      member_staying: cell('stayingWithHh'),
      member_monitored_yes: monitored === 'YES' ? '✓' : '',
      member_monitored_no: monitored === 'NO' ? '✓' : '',
      member_education: cell('educationalAttainment'),
      member_occupation: cell('occupation'),
      member_income: cell('monthlyIncome'),
      member_disability: cell('typeOfDisability'),
    };
  });

  data.interventions = (draft.interventions ?? [])
    .filter((row) => row.included ?? true)
    .map((row) => {
      // Same merge fillInterventionText applies in the preview table.
      const merged: SlotValues = { ...values };
      for (const [key, entry] of Object.entries(row.values ?? {})) {
        merged[key] = { value: entry };
      }
      const fill = (text: string | undefined) => fillText(text ?? '', merged) || '____';
      return {
        need: (row.need ?? row.type ?? '').trim() || 'Untitled row',
        objective: fill(row.objective),
        activities: fill(row.activities),
        responsible: fill(row.responsible),
        timeline: fill(row.timeline),
        remarks: fill(row.remarks),
      };
    });

  return data;
}

/* ------------------------------------------------------------- completeness */

export type ChecklistInput = {
  slots: SlotValues;
  familyIncluded: number;
  interventions: Array<{ included?: boolean; need?: string; type?: string }>;
};

/** Missing required slot keys plus the two structural checks
 *  (`familyComposition`, `interventions`). The server and the client both
 *  call this so completeness can never drift (parity). */
export function computeMissingKeys(input: ChecklistInput): string[] {
  const missing: string[] = [];
  for (const def of SLOT_DEFS) {
    if (!def.required) continue;
    const raw = (input.slots[def.key]?.value ?? '').trim();
    if (!raw) missing.push(def.key);
  }
  if (input.familyIncluded < 1) missing.push('familyComposition');
  const hasIntervention = input.interventions.some((row) => {
    const included = row.included ?? true;
    const need = (row.need ?? row.type ?? '').trim();
    return included && Boolean(need);
  });
  if (!hasIntervention) missing.push('interventions');
  return missing;
}

/* -------------------------------------------------------------------- lint */

/** Names that must never appear inside static template wording (REQ-RPT-014).
 *  Settings defaults are allowed — they are settings, not template text. */
export const FORBIDDEN_STATIC_NAMES = [
  'Vicenta',
  'Ramil',
  'JAY ANN L. EMBUSCADO',
  'MICHAEL ANGELO ADO',
  'LUZ C. FEGARIDO',
];

export type TemplateLintIssue = {
  code: 'unknown_slot' | 'personal_name_in_static';
  message: string;
  where: string;
};

/** Static-text lint: every token must be a known slot, and no personal name
 *  may be baked into fixed wording. Run in tests and at template load. */
export function lintReportTemplate(template: ReportTemplate = REPORT_TEMPLATE): TemplateLintIssue[] {
  const issues: TemplateLintIssue[] = [];
  template.sections.forEach((section, index) => {
    const where = `sections[${index}] ${section.id}`;
    const texts: Array<{ kind: string; text: string }> = [];
    for (const block of section.blocks) {
      if (block.kind === 'title' || block.kind === 'heading' || block.kind === 'para' || block.kind === 'goal') {
        texts.push({ kind: block.kind, text: block.text });
      }
      if (block.kind === 'fields') {
        for (const field of block.fields) {
          texts.push({ kind: 'field-label', text: field.label });
        }
      }
    }
    for (const entry of texts) {
      for (const key of slotKeysIn(entry.text)) {
        if (!SLOT_BY_KEY[key]) {
          issues.push({
            code: 'unknown_slot',
            message: `Unknown slot {{${key}}}`,
            where: `${where} ${entry.kind}`,
          });
        }
      }
      for (const name of FORBIDDEN_STATIC_NAMES) {
        if (entry.text.includes(name)) {
          issues.push({
            code: 'personal_name_in_static',
            message: `Personal name "${name}" in static text`,
            where: `${where} ${entry.kind}`,
          });
        }
      }
    }
  });
  // Intervention catalog remarks/activities are static wording too.
  DEFAULT_INTERVENTION_CATALOG.forEach((row) => {
    for (const text of [row.activities, row.responsible, row.remarks]) {
      for (const name of FORBIDDEN_STATIC_NAMES) {
        if (text.includes(name)) {
          issues.push({
            code: 'personal_name_in_static',
            message: `Personal name "${name}" in catalog text`,
            where: `catalog ${row.id}`,
          });
        }
      }
      for (const key of slotKeysIn(text)) {
        if (!SLOT_BY_KEY[key] && key !== 'responsible_person') {
          issues.push({
            code: 'unknown_slot',
            message: `Unknown token {{${key}}}`,
            where: `catalog ${row.id}`,
          });
        }
      }
    }
  });
  return issues;
}
