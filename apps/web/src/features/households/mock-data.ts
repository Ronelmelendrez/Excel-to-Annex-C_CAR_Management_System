export type GranteeFlag = "Yes" | "No" | "" | "Yess";

export type HouseholdMember = {
  id: string;
  entryId: string;
  name: string;
  relationship: string;
  age: number;
  granteeFlag: GranteeFlag;
  sourceRow: number;
};

export type HouseholdRecord = {
  id: string;
  hhId: string;
  barangay: string;
  municipality: string;
  importName: string;
  importVersion: number;
  members: HouseholdMember[];
  car: { reference: string; status: string } | null;
};

export const mockHouseholds: HouseholdRecord[] = [
  {
    id: "hh-0083",
    hhId: "000083",
    barangay: "San Isidro",
    municipality: "Tanauan City",
    importName: "SY2026_Q1_household_profiles.xlsx",
    importVersion: 3,
    members: [
      { id: "m-083-1", entryId: "00008301", name: "Rosa Dela Cruz", relationship: "Household head", age: 48, granteeFlag: "Yes", sourceRow: 17 },
      { id: "m-083-2", entryId: "00008302", name: "Mario Dela Cruz", relationship: "Spouse", age: 51, granteeFlag: "Yes", sourceRow: 18 },
      { id: "m-083-3", entryId: "00008303", name: "Liza Dela Cruz", relationship: "Daughter", age: 20, granteeFlag: "No", sourceRow: 19 },
      { id: "m-083-4", entryId: "00008304", name: "Noel Dela Cruz", relationship: "Son", age: 16, granteeFlag: "No", sourceRow: 20 },
      { id: "m-083-5", entryId: "00008305", name: "Mila Dela Cruz", relationship: "Daughter", age: 11, granteeFlag: "No", sourceRow: 21 },
    ],
    car: { reference: "CAR-2026-014", status: "Draft" },
  },
  {
    id: "hh-0091",
    hhId: "000091",
    barangay: "Poblacion II",
    municipality: "Tanauan City",
    importName: "SY2026_Q1_household_profiles.xlsx",
    importVersion: 3,
    members: [
      { id: "m-091-1", entryId: "00009101", name: "Celia Ramos", relationship: "Household head", age: 42, granteeFlag: "No", sourceRow: 43 },
      { id: "m-091-2", entryId: "00009102", name: "Jomar Ramos", relationship: "Son", age: 17, granteeFlag: "Yes", sourceRow: 44 },
      { id: "m-091-3", entryId: "00009103", name: "Nina Ramos", relationship: "Daughter", age: 13, granteeFlag: "No", sourceRow: 45 },
      { id: "m-091-4", entryId: "00009104", name: "Tomas Ramos", relationship: "Father", age: 68, granteeFlag: "No", sourceRow: 46 },
      { id: "m-091-5", entryId: "00009105", name: "Lorna Ramos", relationship: "Mother", age: 64, granteeFlag: "No", sourceRow: 47 },
    ],
    car: { reference: "CAR-2026-019", status: "Submitted" },
  },
  {
    id: "hh-0104",
    hhId: "000104",
    barangay: "Santor",
    municipality: "Tanauan City",
    importName: "SY2026_Q1_household_profiles.xlsx",
    importVersion: 3,
    members: [
      { id: "m-104-1", entryId: "00010401", name: "Erlinda Santos", relationship: "Household head", age: 37, granteeFlag: "", sourceRow: 61 },
      { id: "m-104-2", entryId: "00010402", name: "Paolo Santos", relationship: "Son", age: 9, granteeFlag: "No", sourceRow: 62 },
    ],
    car: null,
  },
  {
    id: "hh-0117",
    hhId: "000117",
    barangay: "Balele",
    municipality: "Tanauan City",
    importName: "Region_IV-A_batch02.xlsx",
    importVersion: 2,
    members: [
      { id: "m-117-1", entryId: "00011701", name: "Danilo Mercado", relationship: "Household head", age: 53, granteeFlag: "Yess", sourceRow: 108 },
      { id: "m-117-2", entryId: "00011702", name: "Teresa Mercado", relationship: "Spouse", age: 49, granteeFlag: "No", sourceRow: 109 },
      { id: "m-117-3", entryId: "00011703", name: "Aira Mercado", relationship: "Daughter", age: 18, granteeFlag: "No", sourceRow: 110 },
    ],
    car: null,
  },
  {
    id: "hh-0132",
    hhId: "000132",
    barangay: "Darasa",
    municipality: "Tanauan City",
    importName: "Region_IV-A_batch02.xlsx",
    importVersion: 2,
    members: [
      { id: "m-132-1", entryId: "00013201", name: "Rogelio Bautista", relationship: "Household head", age: 45, granteeFlag: "No", sourceRow: 151 },
      { id: "m-132-2", entryId: "00013202", name: "Myrna Bautista", relationship: "Spouse", age: 43, granteeFlag: "No", sourceRow: 152 },
      { id: "m-132-3", entryId: "00013203", name: "Lea Bautista", relationship: "Daughter", age: 15, granteeFlag: "No", sourceRow: 153 },
      { id: "m-132-4", entryId: "00013204", name: "Rico Bautista", relationship: "Son", age: 12, granteeFlag: "No", sourceRow: 154 },
    ],
    car: null,
  },
];
