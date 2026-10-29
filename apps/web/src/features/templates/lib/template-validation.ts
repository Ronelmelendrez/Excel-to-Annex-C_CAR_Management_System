import type {
  RepeatingTableConfig,
  TemplateFieldMapping,
  TemplateValidationIssue,
  TemplateVersion,
} from "../types";

export const templateFieldOptions = [
  { value: "car.reference", label: "CAR reference" },
  { value: "car.datePrepared", label: "Date prepared" },
  { value: "household.hhId", label: "Household ID" },
  { value: "grantee.name", label: "Validated grantee name" },
  { value: "household.barangay", label: "Barangay" },
  { value: "car.presentingProblem", label: "Presenting problem" },
  { value: "car.backgroundInformation", label: "Background information" },
  { value: "car.assessment", label: "Case worker assessment" },
  { value: "car.recommendation", label: "Case worker recommendation" },
  { value: "staff.preparedBy", label: "Prepared by" },
] as const;

export const repeatingCollectionOptions = [
  { value: "familyComposition", label: "Family composition rows" },
  { value: "interventions", label: "Intervention plan rows" },
] as const;

export function getTemplateValidationIssues(
  mappings: TemplateFieldMapping[],
  repeatingTables: RepeatingTableConfig[],
): TemplateValidationIssue[] {
  const mappingIssues = mappings.flatMap((mapping) =>
    mapping.required && !mapping.fieldKey
      ? [
          {
            id: `mapping-${mapping.id}`,
            label: mapping.placeholder,
            message: "Map this required placeholder to a CAR field or mark it optional.",
          },
        ]
      : [],
  );
  const repeatingIssues = repeatingTables.flatMap((table) =>
    table.required && (!table.enabled || !table.collectionKey)
      ? [
          {
            id: `repeat-${table.id}`,
            label: table.label,
            message: table.enabled
              ? "Choose a source collection for this required repeating table."
              : "Enable and configure this required repeating table.",
          },
        ]
      : [],
  );
  return [...mappingIssues, ...repeatingIssues];
}

export function canValidateTemplate(template: TemplateVersion): boolean {
  return (
    template.status === "draft" &&
    getTemplateValidationIssues(template.mappings, template.repeatingTables).length === 0
  );
}
