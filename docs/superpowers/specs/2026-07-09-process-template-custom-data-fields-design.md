# Process Templates — Custom Data Fields, Combo-box Lookup Lists, Results Export

**Date:** 2026-07-09
**Status:** Approved (brainstorming)
**Author:** brainstorming session

## Problem

Process instances generate a workflow of tasks. During execution the involved people
fill in text, dates, files, or approve requests. Today those results are **not stored
in a structured, reusable way** — only `ProcessTaskAssignment.comment` and `fileUrl`
exist. There is no way to report on or exploit the actual data a process produced.

## Goal

Let a template admin define, per template, a set of **named, typed data fields**, assign
each field to the workflow step where it is filled in, and have the application persist
those values structured and linked to the process instance. Provide a well-designed
step-by-step **wizard** for building a template, reusable **lookup lists** for combo-box
fields, and **Excel / PDF / Word export** of results.

## Decisions (locked during brainstorming)

- **Field-to-step model: Hybrid (C).** Fields are defined once at template level, and
  each field is assigned to a single task where it is captured. Earlier-step fields show
  read-only in later steps.
- **Storage: EAV (typed columns), not one physical table per template.** Keeps everything
  inside Prisma / `prisma db push`, type-safe, no live `ALTER TABLE` per field change.
- **Plus an auto-generated pivot SQL VIEW per template** so raw-SQL/BI consumers still get
  the "clean one-table-per-process" view the user originally described.
- **Lookup lists are global & reusable**, managed on their own dedicated page.
- **Wizard layout: Horizontal progress bar (Layout B).**
- **Export lives on the per-template results page**, not in the wizard.

## Data Model (Prisma / MySQL)

```prisma
enum FieldType { STRING TEXT NUMBER DATE FILE_URL BOOLEAN SELECT }

model ProcessFieldDefinition {
  id                    String   @id @default(cuid())
  processTemplateId     String
  name                  String
  key                   String   // slug, used for VIEW column + export header
  type                  FieldType
  order                 Int
  required              Boolean  @default(false)
  captureTaskTemplateId String?  // which step captures it (Hybrid C); null = any/first
  lookupListId          String?  // required when type = SELECT
  deletedAt             DateTime? // soft-delete; historical values survive

  processTemplate ProcessTemplate      @relation(fields: [processTemplateId], references: [id], onDelete: Cascade)
  captureTask     ProcessTaskTemplate? @relation(fields: [captureTaskTemplateId], references: [id], onDelete: SetNull)
  lookupList      LookupList?          @relation(fields: [lookupListId], references: [id], onDelete: Restrict)
  values          ProcessFieldValue[]

  @@unique([processTemplateId, key])
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model ProcessFieldValue {
  id                 String   @id @default(cuid())
  processInstanceId  String
  fieldDefinitionId  String
  valueString        String?  @db.Text
  valueNumber        Float?
  valueDate          DateTime?
  valueBool          Boolean?
  valueListItemId    String?  // when field type = SELECT

  processInstance ProcessInstance        @relation(fields: [processInstanceId], references: [id], onDelete: Cascade)
  fieldDefinition ProcessFieldDefinition @relation(fields: [fieldDefinitionId], references: [id], onDelete: Cascade)
  listItem        LookupListItem?        @relation(fields: [valueListItemId], references: [id], onDelete: SetNull)

  @@unique([processInstanceId, fieldDefinitionId])
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model LookupList {
  id          String           @id @default(cuid())
  name        String
  description String?          @db.Text
  items       LookupListItem[]
  fields      ProcessFieldDefinition[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model LookupListItem {
  id           String @id @default(cuid())
  lookupListId String
  value        String
  label        String
  order        Int
  lookupList   LookupList          @relation(fields: [lookupListId], references: [id], onDelete: Cascade)
  usedByValues ProcessFieldValue[]
}
```

Relations to add on existing models: `ProcessTemplate.fields`, `ProcessInstance.fieldValues`,
`ProcessTaskTemplate.capturedFields`.

Value is stored in the **typed column** matching the field type (cleaner queries/sorting)
rather than a single generic string.

### Pivot VIEW per template

A service function generates/refreshes `VIEW process_data_<templateKey>` with one column per
field definition (`MAX(CASE WHEN fieldDefinitionId = ... THEN value... END)` grouped by
`processInstanceId`), joined to `ProcessInstance` core columns. Called whenever a template's
field set changes. Executed via `prisma.$executeRawUnsafe` with sanitized identifiers.

## Wizard (Layout B — horizontal progress)

Reusable shadcn/ui component, client-side state, single transactional submit API. Steps:

1. **Βασικά** — name, icon, description
2. **Τμήματα** — allowed departments (existing)
3. **Βήματα & Ανάθεση** — tasks + assignment/approvers (existing, enriched)
4. **Πεδία Δεδομένων** — table of fields; per field: name, type, capture-step dropdown
   (populated from step 3's tasks), required toggle; for SELECT → pick existing lookup list,
   "+ New list", or "Import Excel" inline
5. **Επισκόπηση** — summary + validation before save

Supports both create and edit of an existing template. Per-step validation, Back/Next.

## Capture during execution

On the task screen (`ProcessTaskAssignment`), beyond comment/file, render the fields whose
`captureTaskTemplateId` equals this step as an editable form. Fields from earlier steps show
read-only. Required fields block "Complete step" when empty. Values upserted into
`ProcessFieldValue`.

## Lookup Lists page (Ρυθμίσεις → Λίστες Τιμών)

Dedicated CRUD page: create list, add/edit/reorder items manually, and **import from Excel**
(upload `.xlsx` → map value/label columns → bulk insert) using `xlsx`/SheetJS.

## Results & Export

Per-template "Αποτελέσματα" page: table with one row per instance and one column per field
(pivot of `ProcessFieldValue`). **Export ▾** button offering **Excel (.xlsx) / PDF / Word
(.docx)**, multi-select. PDF via existing Roboto/Greek PDF infra, Excel via `xlsx`, Word via
`docx`.

## Out of scope (YAGNI for now)

- Conditional/branching field visibility
- Field-level permissions beyond capture-step gating
- Multilingual field labels
- Versioning of a template's field schema across already-running instances (new fields
  simply appear empty for old instances)

## Non-obvious risks

- `prisma db push` only (no migrations) per project convention — VIEW creation is a manual
  `$executeRawUnsafe`, kept idempotent (`CREATE OR REPLACE VIEW`).
- Editing/deleting a field on a template that already has instances: **type change is blocked
  once any value exists** (rename/reorder/required-toggle allowed); **deleting a field is a
  soft-delete** (`deletedAt` on `ProcessFieldDefinition`) so historical values survive and are
  excluded from new captures, the pivot VIEW, and default result columns.
