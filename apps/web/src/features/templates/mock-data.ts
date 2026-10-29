import type { RepeatingTableConfig, TemplateFieldMapping, TemplateVersion } from "./types";

export const mockDetectedPlaceholders = [
  { id: "p-car-reference", placeholder: "CAR_REFERENCE", required: true },
  { id: "p-household-id", placeholder: "HOUSEHOLD_ID", required: true },
  { id: "p-grantee-name", placeholder: "GRANTEE_NAME", required: true },
  { id: "p-date-prepared", placeholder: "DATE_PREPARED", required: true },
  { id: "p-presenting-problem", placeholder: "PRESENTING_PROBLEM", required: true },
  { id: "p-background", placeholder: "BACKGROUND_INFORMATION", required: true },
  { id: "p-assessment", placeholder: "ASSESSMENT", required: true },
  { id: "p-recommendation", placeholder: "RECOMMENDATION", required: true },
  { id: "p-prepared-by", placeholder: "PREPARED_BY", required: false },
] as const;

const activeMappings: TemplateFieldMapping[] = [
  { id: "m-car-reference", placeholder: "CAR_REFERENCE", fieldKey: "car.reference", required: true },
  { id: "m-household-id", placeholder: "HOUSEHOLD_ID", fieldKey: "household.hhId", required: true },
  { id: "m-grantee-name", placeholder: "GRANTEE_NAME", fieldKey: "grantee.name", required: true },
  { id: "m-date-prepared", placeholder: "DATE_PREPARED", fieldKey: "car.datePrepared", required: true },
  { id: "m-presenting-problem", placeholder: "PRESENTING_PROBLEM", fieldKey: "car.presentingProblem", required: true },
  { id: "m-background", placeholder: "BACKGROUND_INFORMATION", fieldKey: "car.backgroundInformation", required: true },
  { id: "m-assessment", placeholder: "ASSESSMENT", fieldKey: "car.assessment", required: true },
  { id: "m-recommendation", placeholder: "RECOMMENDATION", fieldKey: "car.recommendation", required: true },
  { id: "m-prepared-by", placeholder: "PREPARED_BY", fieldKey: "", required: false },
];

const defaultRepeatingTables: RepeatingTableConfig[] = [
  {
    id: "family-composition",
    label: "Family Composition",
    enabled: true,
    required: true,
    collectionKey: "familyComposition",
  },
  {
    id: "intervention-plan",
    label: "Intervention Plan",
    enabled: true,
    required: true,
    collectionKey: "interventions",
  },
];

export const mockInitialTemplateVersions: TemplateVersion[] = [
  {
    id: "annex-c-v2-draft",
    name: "Annex C",
    version: 2,
    fileName: "Annex_C_template_v2.docx",
    fileSizeBytes: 284_160,
    status: "draft",
    uploadedAt: "2026-10-28T07:45:00.000Z",
    uploadedBy: "Template admin (mock)",
    mappings: activeMappings.map((mapping) =>
      mapping.id === "m-assessment"
        ? { ...mapping, fieldKey: "" }
        : { ...mapping },
    ),
    repeatingTables: defaultRepeatingTables.map((table) =>
      table.id === "intervention-plan"
        ? { ...table, enabled: false, collectionKey: "" }
        : { ...table },
    ),
  },
  {
    id: "annex-c-v1-active",
    name: "Annex C",
    version: 1,
    fileName: "Annex_C_template_v1.docx",
    fileSizeBytes: 261_120,
    status: "active",
    uploadedAt: "2026-09-16T02:00:00.000Z",
    uploadedBy: "Template admin (mock)",
    mappings: activeMappings.map((mapping) => ({ ...mapping })),
    repeatingTables: defaultRepeatingTables.map((table) => ({ ...table })),
    approvedBy: "Admin (mock)",
    approvedAt: "2026-09-17T03:00:00.000Z",
    activatedAt: "2026-09-18T04:30:00.000Z",
  },
];

export const mockTemplatePreviewData: Record<string, string> = {
  "car.reference": "CAR-2026-023",
  "car.datePrepared": "2026-10-29",
  "household.hhId": "000091",
  "grantee.name": "Sample grantee",
  "household.barangay": "Sample barangay",
  "car.presentingProblem": "Sample test data — not a real case narrative.",
  "car.backgroundInformation": "Sample test data only.",
  "car.assessment": "Sample test data only.",
  "car.recommendation": "Sample test data only.",
  "staff.preparedBy": "Sample staff (mock)",
};
