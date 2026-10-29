# System Requirements Specification

## Excel-to-Annex C Case Assessment Report (CAR) Management System

**Document status:** Draft for stakeholder validation\
**Version:** 1.0\
**Date:** 2026-10-28

------------------------------------------------------------------------

## 1. Purpose

This document defines the functional, data, security, operational, and
acceptance requirements for a web-based system that imports
household-member data from Excel, validates and groups the records into
households, supports the preparation and review of Annex C Case
Assessment Reports (CARs), and generates approved reports as both DOCX
and PDF files.

The system must replace hard-coded authentication with **Supabase Auth**
and enforce authorization on the server/database---not only in the user
interface.

This specification is intended to guide implementation, testing, and
stakeholder sign-off. Policy-dependent details are explicitly marked for
confirmation rather than assumed.

## 2. Goals

The system shall:

1.  Import and validate Excel workbooks containing one row per household
    member.
2.  Group records by normalized household ID (`HH_ID`) without merging
    unrelated households.
3.  identify the grantee using the validated `GRANTEE` flag.
4.  Preserve source data and provide a review workflow for ambiguous,
    invalid, or conflicting records.
5.  Allow authorized staff to create, edit, review, and manually approve
    CARs.
6.  Support uploaded, versioned DOCX templates with configurable field
    mappings and repeating family-composition rows.
7.  Generate both DOCX and PDF outputs from approved reports, with
    private file access and traceable provenance.
8.  Provide dashboards based on real database records.
9.  Maintain audit trails for sensitive actions and changes.
10. Protect household and case information using authentication,
    role-based authorization, database row-level security (RLS), and
    private storage.

## 3. Scope

### 3.1 In scope

-   Supabase Auth login, logout, session handling, and account recovery
    as configured.
-   Admin-managed user provisioning by default, unless public
    registration is formally approved.
-   Role and permission management.
-   Excel upload, worksheet/header selection, preview, column mapping,
    validation, and import review.
-   Household grouping and household-member management.
-   Grantee validation and conflict handling.
-   Household and import dashboards.
-   CAR creation, editing, draft saving, review, change requests, and
    manual approval.
-   DOCX template upload, versioning, mapping, preview, validation,
    activation, and retirement.
-   DOCX and PDF generation.
-   Private storage of source files, templates, and generated documents.
-   Audit logs, export history, operational error handling, and access
    testing.

### 3.2 Out of scope unless separately approved

-   Automatically inventing or generating case narratives, assessments,
    risk classifications, recommendations, interventions, staff names,
    or signatures.
-   Automatic CAR approval.
-   Automatically determining household head from the grantee flag.
-   Automatically merging households based on similar names or
    addresses.
-   Automatically excluding members based on status fields whose
    official rules have not been confirmed.
-   Public self-registration, e-signatures, external agency
    integrations, AI case decisions, or mobile apps unless separately
    specified.
-   Treating this system as an authoritative replacement for the source
    household registry.

## 4. Users and permissions

The following roles are proposed and require stakeholder approval.

  -----------------------------------------------------------------------
  Role                                Intended permissions
  ----------------------------------- -----------------------------------
  `admin`                             Manage users/roles, configuration,
                                      templates, and system settings;
                                      access permitted operational
                                      records; review audit activity.

  `case_worker`                       Import or view permitted household
                                      data; create and edit CAR drafts;
                                      resolve assigned review items;
                                      submit reports for review.

  `reviewer`                          Review submitted CARs, request
                                      changes, and approve reports within
                                      assigned scope.

  `viewer`                            Read only the records explicitly
                                      permitted by policy.
  -----------------------------------------------------------------------

Requirements:

-   **AUTH-01:** The system shall use Supabase Auth rather than
    hard-coded credentials, passwords, or authentication conditions.
-   **AUTH-02:** The system shall distinguish authentication (identity)
    from authorization (permissions).
-   **AUTH-03:** User roles shall be stored in database-controlled
    records linked to the Supabase Auth user ID. Users shall not be able
    to grant themselves roles by editing user metadata or client
    requests.
-   **AUTH-04:** User provisioning shall be administrator-managed by
    default. Public registration shall remain disabled unless explicitly
    approved.
-   **AUTH-05:** Protected pages and actions shall require a valid
    session and the appropriate permission.
-   **AUTH-06:** Authorization shall be enforced on server-side
    operations and through database/storage policies. Hiding a button or
    route shall not be treated as sufficient security.
-   **AUTH-07:** Logout shall end the session and clear
    application-cached private data.
-   **AUTH-08:** Expired or invalid sessions shall be handled safely and
    require reauthentication where appropriate.
-   **AUTH-09:** Account recovery, email verification, account
    disablement, and password policies shall follow the approved
    Supabase Auth configuration.
-   **AUTH-10:** Approval and role-assignment permissions shall be
    separate from ordinary CAR editing permissions.
-   **AUTH-11:** All denied privileged actions shall fail safely and
    shall not disclose protected records.

## 5. Source Excel requirements

### 5.1 Supported source fields

The import pipeline shall recognize these source column names when
present:

`REGION`, `PROVINCE`, `MUNICIPALITY`, `BARANGAY`, `HH_ID`, `ENTRY_ID`,
`FIRST_NAME`, `MIDDLE_NAME`, `LAST_NAME`, `EXT_NAME`, `BIRTHDAY`, `AGE`,
`AGE_ON_EDUC`, `SEX`, `CLIENT_STATUS`, `CS_CATEGORY`, `MEMBER_STATUS`,
`RELATION_TO_HH_HEAD`, `CIVIL_STATUS`, `GRANTEE`, `HH_SET`,
`SOLO_PARENT`, `IP_AFFLIATION`, `PCN`, `PCN_REMARKS`,
`PREGNANCY_STATUS`, `LMP`, `HEALTH_MONITORED`, `HEALTH_FACILITY`,
`HEALTH_FACILITY_STATUS`, `REASON_FOR_NOT_ATTENDING_HEALTH`,
`REASON_HEALTH_REMARKS`, `DISABILITY_TYPES`, `CHILD_BENE`,
`GRADE_LEVEL`, `SHS_STRAND`, `SHS_TRACK`, `EDUC_MONITORED`,
`ATTEND_SCHOOL`, `SCHOOL_NAME`, `REASON_FOR_NOT_ATTENDING_SCHOOL`,
`REASON_EDUC_REMARKS`, `LRN`, `LRN_REMARKS`.

These are source headers, not a declaration that every field is an
approved CAR field. The mapping from source fields to the approved CAR
template must be configurable and reviewed.

### 5.2 Upload and preview

-   **IMP-01:** The system shall accept supported Excel formats (`.xlsx`
    and `.xls` only when the selected parser supports them).
-   **IMP-02:** The user shall be able to select a worksheet and confirm
    or adjust the detected header row.
-   **IMP-03:** The system shall display a preview before committing an
    import.
-   **IMP-04:** The system shall support explicit column mapping and
    approved header aliases.
-   **IMP-05:** The system shall report missing required columns,
    duplicate headers, unexpected columns, empty worksheets, malformed
    values, and row-level validation issues.
-   **IMP-06:** The system shall preserve identifiers such as `HH_ID`,
    `ENTRY_ID`, `LRN`, and `PCN` as text to avoid losing leading zeros.
-   **IMP-07:** The system shall apply configurable file-size,
    row-count, and processing-time limits and explain how the user can
    resolve a limit error.
-   **IMP-08:** The system shall not silently overwrite a prior import.
    Re-uploading an identical file shall produce a duplicate/fingerprint
    warning and follow an explicit, logged policy.
-   **IMP-09:** Each committed import shall have an immutable import
    identifier, source-file fingerprint, uploader, timestamp, validation
    summary, and processing status.
-   **IMP-10:** Source values shall be preserved for traceability.
    Corrections shall be stored separately rather than silently
    rewriting the original import.
-   **IMP-11:** Parsing and validation shall handle malformed files
    safely and shall not expose server paths, stack traces, secrets, or
    sensitive row data in user-facing errors.

### 5.3 Minimum import validation

The default minimum columns for household grouping and grantee checks
are:

-   `HH_ID`
-   `ENTRY_ID`
-   `FIRST_NAME`
-   `LAST_NAME`
-   `GRANTEE`

The final list of required import columns must be configurable and
approved by the system owner. A source column can be optional for import
processing but still be required for a final CAR.

## 6. Household grouping and member rules

-   **HH-01:** Household grouping shall use `HH_ID` after trimming
    leading and trailing whitespace for matching.
-   **HH-02:** The original `HH_ID` value shall remain available for
    audit and source traceability.
-   **HH-03:** Blank or whitespace-only `HH_ID` rows shall not be
    assigned to a guessed household. They shall be placed in a review
    queue.
-   **HH-04:** Similar names, addresses, or family details shall never
    be used to automatically merge households.
-   **HH-05:** By default, all imported household-member rows shall be
    included. The system shall not silently filter records using
    `CLIENT_STATUS`, `CS_CATEGORY`, `MEMBER_STATUS`, `CHILD_BENE`, or
    other status fields until official rules are approved.
-   **HH-06:** Duplicate `ENTRY_ID` values within an import shall be
    flagged for review. The system shall not automatically delete,
    merge, or discard these rows.
-   **HH-07:** Repeated household-level values, such as address
    components, shall be checked for conflicts. The system shall not use
    an undocumented "first nonblank value wins" rule.
-   **HH-08:** Household-member records shall retain links to their
    source import and source row.
-   **HH-09:** Corrections shall record the actor, timestamp, reason,
    and before/after values.
-   **HH-10:** Household and member counts on dashboards shall be
    derived from persisted records and shall reflect the defined
    counting rules.

## 7. Grantee validation

-   **GR-01:** The system shall normalize the `GRANTEE` value by
    trimming whitespace and comparing case-insensitively.
-   **GR-02:** The default accepted values shall be `Yes` and `No`.
    Values such as `Y`, `N`, `1`, `0`, `True`, `False`, blank, or other
    values shall be invalid unless an authorized administrator adds them
    through versioned configuration.
-   **GR-03:** A household may be finalized for CAR preparation only
    when exactly one member has a valid `GRANTEE = Yes` flag.
-   **GR-04:** If no member is marked Yes, the household shall receive
    `GRANTEE_MISSING`.
-   **GR-05:** If more than one member is marked Yes, the household
    shall receive `GRANTEE_MULTIPLE`.
-   **GR-06:** If a member has a blank or unsupported grantee flag, the
    household shall receive `GRANTEE_INVALID` until reviewed under the
    approved policy.
-   **GR-07:** Grantee selection shall be based only on a validated
    `GRANTEE` flag---not row order, age, name, or relationship to the
    household head.
-   **GR-08:** The system shall not assume that the grantee is the
    household head. Household-head information shall come from an
    authoritative source or verified manual selection under approved
    policy.
-   **GR-09:** Invalid or conflicting grantee records may be shown in a
    review queue and draft preview with clear warnings, but shall not be
    automatically resolved or approved.
-   **GR-10:** The selected grantee and the validation result shall be
    traceable to the source import and member row.

## 8. CAR management

### 8.1 CAR lifecycle

The system shall support the following states, with transitions
controlled by permissions and validation rules:

-   `DRAFT_INCOMPLETE`
-   `DRAFT_READY_FOR_REVIEW`
-   `CHANGES_REQUESTED`
-   `APPROVED`
-   `EXPORT_FAILED`
-   `EXPORTED`

Import-level or household-level review statuses may include
`IMPORT_VALIDATION_FAILED` and `NEEDS_REVIEW`. These shall not be
confused with a CAR's approval state.

### 8.2 Create and edit CAR

-   **CAR-01:** Authorized users shall be able to create a CAR from a
    validated household.
-   **CAR-02:** The user shall be able to search for and select a
    household.
-   **CAR-03:** The system shall display household members and the
    validated grantee before CAR creation.
-   **CAR-04:** The user shall select an approved document-template
    version.
-   **CAR-05:** The CAR editor shall support the sections present in the
    approved template, including as applicable: Identifying Information,
    Family Composition, Presenting Problem, Background Information,
    Assessment, Intervention Plan, Recommendation, and signature/date
    fields.
-   **CAR-06:** Family Composition shall support repeating rows for the
    household members included under the approved policy.
-   **CAR-07:** Users shall be able to save drafts and return to them
    later.
-   **CAR-08:** The system shall warn users about unsaved changes and
    shall provide reliable save status.
-   **CAR-09:** Missing required fields shall be listed with clear links
    or navigation to the relevant fields.
-   **CAR-10:** Drafts with missing required fields may be saved and
    previewed, but must be clearly marked `DRAFT — NOT APPROVED`.
-   **CAR-11:** The system shall block approval while required fields
    are missing unless a formally authorized, auditable exception is
    configured.
-   **CAR-12:** Narrative and professional judgment fields shall be
    entered by an authorized case worker or supplied from a verified
    source. The system shall not fabricate narratives, assessments, risk
    classifications, interventions, recommendations, staff names, or
    signatures.
-   **CAR-13:** Missing information shall remain blank or be marked
    according to an approved template convention; the system shall not
    infer occupation, income, household residence, or other absent data.
-   **CAR-14:** The system shall maintain links to the source import,
    household, selected grantee, template version, creator, reviewer,
    and generated outputs.
-   **CAR-15:** The system shall prevent unauthorized users from viewing
    or editing CARs outside their permitted scope.

### 8.3 Review and approval

-   **REV-01:** Submission for review shall require the configured
    validation checks to pass.
-   **REV-02:** A reviewer with the required permission shall be able to
    approve or request changes.
-   **REV-03:** The reviewer shall be able to provide a reason or
    instructions when requesting changes.
-   **REV-04:** A case worker shall not approve their own CAR unless an
    explicit, documented policy allows it.
-   **REV-05:** Approval shall record reviewer identity and timestamp
    and shall be audit logged.
-   **REV-06:** Editing an approved CAR shall follow an explicit
    version/revision policy. Previously approved content and generated
    files shall remain traceable.
-   **REV-07:** A draft, a submitted CAR, and an approved CAR shall be
    visually distinguishable in the interface and exports.
-   **REV-08:** Manual approval is required. The system shall not
    automatically approve a report based solely on field completeness.

## 9. Document template management

-   **TPL-01:** Authorized users shall be able to upload DOCX templates.
-   **TPL-02:** Templates shall be versioned. Updating a template shall
    create a new version rather than overwrite a version used by
    existing reports.
-   **TPL-03:** Each template version shall have a status such as draft,
    validated, active, or retired.
-   **TPL-04:** The system shall provide a mapping interface to connect
    template placeholders and repeating table rows to approved CAR
    fields.
-   **TPL-05:** The system shall support repeating rows for Family
    Composition and Intervention Plan where required by the template.
-   **TPL-06:** The system shall validate mappings and detect unresolved
    required placeholders before a template is activated.
-   **TPL-07:** Authorized users shall be able to preview a template
    using clearly identified test data before activation.
-   **TPL-08:** The system shall retain the exact template version used
    for every generated report.
-   **TPL-09:** The system shall not assume all DOCX placeholders can be
    detected or mapped correctly without configuration and validation.
-   **TPL-10:** The approved Annex C template version, required fields,
    and signature conventions must be confirmed by the system owner.

## 10. Document generation and export

-   **DOC-01:** The system shall generate both DOCX and PDF for an
    approved CAR.
-   **DOC-02:** Document rendering and PDF conversion shall run in a
    trusted server-side worker or equivalent controlled service, not
    solely in the browser.
-   **DOC-03:** The server shall re-check authentication, authorization,
    CAR state, required fields, and template version before generation.
-   **DOC-04:** Generated files shall be stored in private storage and
    accessed only by authorized users through controlled access or
    short-lived signed URLs.
-   **DOC-05:** The system shall not report generation success until
    both required output files have been created and verified.
-   **DOC-06:** The worker shall support safe retries and idempotent job
    handling so a retry does not create duplicate or inconsistent report
    records.
-   **DOC-07:** Generation failures shall be logged with a safe error
    code, and authorized users shall be able to retry failed jobs.
-   **DOC-08:** The system shall check for unresolved placeholders and
    required fields before final generation.
-   **DOC-09:** Generated documents shall be checked for basic
    integrity: file exists, non-zero size, valid format, and successful
    opening/parsing by the selected verification process.
-   **DOC-10:** Document layout checks shall include repeating table
    rows, page breaks, signature blocks, long names, long narratives,
    and empty optional fields.
-   **DOC-11:** Export history shall record report ID, template version,
    output format, requester, timestamps, job status, and file
    reference.
-   **DOC-12:** Draft previews, if supported, shall be watermarked or
    otherwise clearly identified as unapproved.
-   **DOC-13:** The system shall not create or apply signatures or
    represent an unsigned document as signed.

## 11. Dashboard and navigation

The system shall provide these primary pages:

1.  Dashboard
2.  Excel Imports
3.  Households
4.  Case Assessment Reports (CAR)
5.  Document Templates
6.  Generated Documents
7.  Audit Logs
8.  User/Role Management (authorized administrators only)

-   **UI-01:** Dashboard metrics shall be calculated from actual
    persisted data, not mock constants.
-   **UI-02:** The interface shall display import counts, validation
    failures, households needing review, CARs by lifecycle state, and
    export failures where permitted.
-   **UI-03:** Lists shall support appropriate search, filters,
    pagination, loading states, empty states, and actionable error
    states.
-   **UI-04:** Actions shall be disabled or unavailable when the user
    lacks permission, while the backend independently enforces the same
    restrictions.
-   **UI-05:** Sensitive values shall not be exposed in URLs, analytics
    events, client error reports, or unnecessary UI previews.
-   **UI-06:** The interface shall clearly distinguish source data,
    verified corrections, computed values, and manually authored case
    content.

## 12. Data model requirements

The following tables/entities are recommended; final schema and
relationships shall be validated during implementation:

-   `profiles` --- user profile linked to `auth.users.id`.
-   `user_roles` --- database-controlled role assignments.
-   `imports` --- import metadata, fingerprint, status, uploader, and
    validation summary.
-   `import_rows` --- source-row traceability and/or validated row data,
    subject to data-retention and scale decisions.
-   `households` --- normalized household identity and review state.
-   `household_members` --- member data, source-row linkage, and
    validation state.
-   `case_assessments` --- CAR content, status, source links, creator,
    reviewer, and revision information.
-   `interventions` --- structured intervention-plan rows when separate
    storage is appropriate.
-   `document_templates` --- template identity and version metadata.
-   `generated_reports` --- report version and output-file references.
-   `export_jobs` --- generation job status, retry metadata, and safe
    failure codes.
-   `audit_logs` --- immutable record of sensitive actions and
    corrections.

Requirements:

-   **DATA-01:** Use stable primary keys and explicit foreign keys.
-   **DATA-02:** Store timestamps consistently and retain actor identity
    for sensitive changes.
-   **DATA-03:** Store imported identifiers as text when leading zeros
    or exact source formatting matters.
-   **DATA-04:** Keep original import data traceable and separate from
    reviewed corrections.
-   **DATA-05:** Use database constraints where appropriate to prevent
    invalid state transitions and broken references.
-   **DATA-06:** Avoid storing duplicate sensitive data unnecessarily.
-   **DATA-07:** Set explicit retention, archival, deletion, and backup
    rules after policy review.
-   **DATA-08:** Do not assume `PCN` is a national ID or assign
    undocumented meanings to `PCN`, status, or classification fields.
-   **DATA-09:** `HH_SET` and any other ambiguous field shall be mapped
    only after its meaning is confirmed.

## 13. Security and privacy requirements

-   **SEC-01:** Enable and test RLS on every exposed table containing
    private household, member, case, import, or report data.
-   **SEC-02:** Define separate read/write policies as needed and test
    both allowed and denied access.
-   **SEC-03:** Apply corresponding access controls to private Storage
    buckets and file operations.
-   **SEC-04:** A Supabase publishable/anon key may be used in the
    frontend as intended by Supabase; service-role/secret keys shall
    never be included in frontend bundles, browser storage, source
    control, or public logs.
-   **SEC-05:** Privileged operations shall execute server-side with a
    verified user identity and explicit authorization checks.
-   **SEC-06:** Route guards shall be treated as a usability feature,
    not the security boundary.
-   **SEC-07:** Sensitive records shall not be accessible through
    guessable IDs or unprotected direct API calls.
-   **SEC-08:** Validate file type, size, content, and parsing behavior.
    Do not trust file extensions alone.
-   **SEC-09:** Use secure transport (HTTPS) and protect secrets with
    environment-specific secret management.
-   **SEC-10:** Avoid exposing personal information in logs, analytics,
    exception traces, and URLs.
-   **SEC-11:** Audit logs shall capture actor, action, timestamp,
    target record, and appropriate before/after metadata without
    unnecessarily duplicating sensitive values.
-   **SEC-12:** Changes to roles, approvals, mappings, template
    activation, manual overrides, and export actions shall be audit
    logged.
-   **SEC-13:** Use separate development, staging, and production
    environments with versioned database migrations.
-   **SEC-14:** Establish and test backup, recovery, incident response,
    access review, and data-retention procedures.
-   **SEC-15:** Privacy and access rules shall be reviewed against
    applicable Philippine data-protection requirements and the
    responsible agency's policies before production use.

## 14. Reliability, performance, and operations

-   **NFR-01:** The system shall provide clear loading, progress,
    success, empty, and failure states for imports and document jobs.
-   **NFR-02:** Large workbook processing shall use bounded resources,
    progress reporting, and configured limits. If processing is
    asynchronous, the user shall be able to inspect job status and retry
    recoverable failures.
-   **NFR-03:** Long-running document generation shall not depend on a
    single browser tab remaining open.
-   **NFR-04:** Import and export operations shall be safe against
    accidental duplicate submissions and retried requests.
-   **NFR-05:** The system shall handle concurrent edits and stale
    versions using an explicit conflict strategy, such as optimistic
    concurrency checks.
-   **NFR-06:** Errors shall be logged with correlation/job IDs while
    excluding secrets and unnecessary personal data.
-   **NFR-07:** Database migrations shall be version-controlled,
    repeatable, and tested before production deployment.
-   **NFR-08:** Backups and recovery objectives (RPO/RTO) shall be
    defined by the system owner and verified through restore testing.
-   **NFR-09:** Supported browsers, expected workbook sizes, expected
    concurrent users, and performance targets shall be agreed before
    launch.
-   **NFR-10:** Accessibility and responsive behavior shall be tested
    for the supported devices and browsers.
-   **NFR-11:** Dependency updates and security patches shall follow a
    documented maintenance process.

## 15. Auditability and traceability

-   **AUD-01:** Record import creation, validation outcomes,
    corrections, grantee conflict resolution, CAR creation/editing,
    submission, change requests, approval, template changes, and
    document generation/download actions as required by policy.
-   **AUD-02:** Audit records shall identify the actor, action, target,
    timestamp, and outcome.
-   **AUD-03:** Audit records shall be protected from unauthorized
    modification and deletion.
-   **AUD-04:** A generated report shall be traceable to its source
    import, household, selected grantee, CAR revision, template version,
    approval event, and export job.
-   **AUD-05:** Authorized staff shall be able to search/filter audit
    records within their permissions.
-   **AUD-06:** Audit retention and access shall follow an approved
    policy.

## 16. Validation and mapping rules

The following mappings are allowed only where the approved CAR template
has a matching field:

  ------------------------------------------------------------------------------
  Source field(s)                Proposed use            Constraint
  ------------------------------ ----------------------- -----------------------
  `FIRST_NAME`, `MIDDLE_NAME`,   Member/grantee full     Preserve source parts;
  `LAST_NAME`, `EXT_NAME`        name                    avoid inventing missing
                                                         names.

  `HH_ID`                        Household identifier    Normalize only for
                                                         matching; preserve raw
                                                         value.

  `REGION`, `PROVINCE`,          Address components      Check conflicts; do not
  `MUNICIPALITY`, `BARANGAY`                             silently choose one
                                                         conflicting value.

  `BIRTHDAY`, `AGE`, `SEX`,      Corresponding           Use only approved
  `CIVIL_STATUS`                 demographic fields      matching fields; define
                                                         date/age validation
                                                         rules.

  `RELATION_TO_HH_HEAD`          Relationship to         Does not identify the
                                 household head          grantee.

  `GRADE_LEVEL`, `SHS_STRAND`,   Education details       Follow the approved
  `SHS_TRACK`                                            template's mapping.

  `DISABILITY_TYPES`             Disability field, if    Preserve meaning; do
                                 present                 not infer diagnoses.

  Health-related columns         Corresponding health    Keep separate fields
                                 fields, if present      distinct and map only
                                                         to confirmed targets.

  Education                      Corresponding education Do not infer missing
  attendance/school/reason/LRN   fields, if present      school or attendance
  columns                                                information.

  `CLIENT_STATUS`,               Preserve for            Do not infer meanings
  `CS_CATEGORY`,                 review/configuration    or rules until
  `MEMBER_STATUS`,                                       confirmed.
  `SOLO_PARENT`, `CHILD_BENE`,                           
  `PCN`, `PCN_REMARKS`, `HH_SET`                         
  ------------------------------------------------------------------------------

Narrative sections---Presenting Problem, Background, Assessment,
Intervention Plan, Recommendation, and signatures---must be authored or
verified by authorized personnel unless the owner identifies an approved
source for the content.

## 17. Acceptance criteria

### 17.1 Authentication and authorization

-   A valid provisioned user can sign in using Supabase Auth.
-   Invalid credentials are rejected.
-   Logout clears the active session and application-cached private
    data.
-   An unauthorized role cannot access a restricted page, database
    record, file, or privileged API action---even through a direct
    request.
-   A user cannot promote their own role by editing client-side data or
    user metadata.
-   No service-role/secret key appears in the browser bundle or
    client-side configuration.

### 17.2 Import and grouping

-   A workbook with one `HH_ID` and five member rows, exactly one valid
    `GRANTEE=Yes`, and four `No` flags produces one household, five
    members, and one selected grantee.
-   A household with zero Yes flags is marked `GRANTEE_MISSING` and
    cannot be finalized.
-   A household with multiple Yes flags is marked `GRANTEE_MULTIPLE` and
    cannot be finalized.
-   Blank or unsupported grantee values trigger `GRANTEE_INVALID` and
    review.
-   Rows with missing `HH_ID` are not guessed into a household.
-   Duplicate `ENTRY_ID` values and conflicting household-level fields
    are flagged for review without silent deletion or "first value
    wins."
-   Unknown member-status values do not silently exclude household
    members.
-   Leading zeros in identifiers are preserved.

### 17.3 CAR and approval

-   An authorized case worker can create a CAR linked to the correct
    household, source import, and validated grantee.
-   Required-field warnings are shown for incomplete drafts.
-   An incomplete draft is clearly labeled as unapproved and cannot be
    approved unless a configured, authorized exception applies.
-   A user without reviewer permission cannot approve a CAR.
-   Approval records the reviewer, timestamp, and audit event.
-   Changes to an approved report remain traceable under the revision
    policy.

### 17.4 Templates and exports

-   An authorized user can upload and version a DOCX template.
-   A template cannot be activated while required mappings or
    placeholders remain unresolved.
-   Repeating family-composition and intervention rows render correctly.
-   An approved CAR can produce both valid DOCX and PDF files.
-   The generated outputs contain no unresolved placeholders and pass
    basic integrity checks.
-   Generation failure is recorded and retry does not create duplicate
    inconsistent records.
-   Unauthorized users cannot download generated files.
-   Each output is traceable to the CAR revision, source import, and
    template version.

### 17.5 Audit and operations

-   Corrections, approval actions, role changes, template activation,
    and export outcomes are audit logged.
-   Dashboard figures match the persisted data and documented counting
    rules.
-   Restore and recovery procedures are tested before production launch.
-   RLS and Storage access policies have automated or documented
    positive and negative tests.

## 18. Implementation phases and exit gates

### Phase 1 --- Authentication and security foundation

-   Remove hard-coded authentication logic and mock users.
-   Configure Supabase Auth and session lifecycle.
-   Create profiles and database-controlled role assignments.
-   Implement RLS and private Storage policies.
-   Add protected server-side actions and security tests.

**Exit gate:** Auth and authorization acceptance criteria pass,
including direct API and file-access denial tests.

### Phase 2 --- Import, validation, and household grouping

-   Create versioned schema migrations.
-   Implement Excel upload, preview, mapping, validation,
    fingerprinting, and import history.
-   Implement normalized `HH_ID` grouping and grantee validation.
-   Add conflict/review queues and correction audit trails.

**Exit gate:** Import and grouping acceptance tests pass without silent
merges, deletions, or grantee guesses.

### Phase 3 --- CAR editor and templates

-   Implement CAR list, creation, editor, required-field checklist, and
    draft saving.
-   Implement DOCX upload/versioning, field mapping, repeating rows, and
    template validation.
-   Add template preview and activation controls.

**Exit gate:** Test templates render mapped fields and repeating tables
correctly; drafts and review states are enforced.

### Phase 4 --- Review, approval, and exports

-   Implement submission, reviewer decisions, change requests, and
    approval history.
-   Implement trusted generation worker and PDF conversion.
-   Store outputs privately and record export job/provenance.
-   Add retry handling and integrity checks.

**Exit gate:** Approved reports produce verified DOCX and PDF files, and
access controls and failure recovery tests pass.

### Phase 5 --- Dashboard, hardening, and launch

-   Replace all mock dashboard data with database-backed metrics.
-   Complete access, privacy, performance, concurrency, and
    malformed-file tests.
-   Define and test backups, retention, monitoring, and incident
    response.
-   Complete stakeholder validation and production deployment review.

**Exit gate:** All critical acceptance tests pass and policy-dependent
items have an approved owner decision.

## 19. Decisions required before production

The following items must be confirmed by the system owner and
documented:

1.  Official Annex C template version and the required fields for each
    report section.
2.  Required import columns and permitted missing-field exceptions.
3.  Household-head source and manual verification procedure.
4.  Whether a case worker may approve their own report.
5.  User provisioning, role definitions, assignment scope, and approval
    authority.
6.  Official meanings and allowed values for `CLIENT_STATUS`,
    `CS_CATEGORY`, `MEMBER_STATUS`, `HH_SET`, `PCN`, and other ambiguous
    fields.
7.  Whether any member categories may be excluded, and the authoritative
    rule for doing so.
8.  Approved wording for blank, not applicable, unavailable, or
    unverified fields.
9.  Signature, concurrence, approval, and date requirements.
10. Data retention, deletion, archival, access review, incident
    response, and backup/recovery objectives.
11. Expected maximum workbook size, row count, concurrent users, and
    acceptable processing time.
12. Hosting/deployment environment and the trusted DOCX-to-PDF
    conversion method.
13. Applicable privacy review and agency authorization for processing
    household and case data.

## 20. Definition of done

The system is production-ready only when:

-   Hard-coded authentication has been removed and Supabase Auth is in
    use.
-   Server-side authorization, RLS, and private Storage access have been
    verified.
-   Import, household grouping, grantee validation, review, CAR editing,
    manual approval, and export workflows pass their acceptance tests.
-   DOCX and PDF outputs are verified and traceable.
-   Audit logging, safe error handling, backups, recovery, retention,
    and operational monitoring are in place.
-   Required stakeholder decisions are documented and approved.
-   No unresolved critical security, privacy, data-integrity, or
    document-generation defects remain.
