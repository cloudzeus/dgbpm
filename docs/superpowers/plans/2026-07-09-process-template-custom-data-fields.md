# Process Template Custom Data Fields — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let template admins define named, typed data fields per process template (assigned to the step that captures them), persist the values structured & linked to each process instance, manage reusable lookup lists for combo-box fields, and export per-template results to Excel / PDF / Word.

**Architecture:** EAV storage with typed value columns (`ProcessFieldDefinition` + `ProcessFieldValue`) plus global `LookupList`/`LookupListItem`. A 5-step horizontal-progress wizard drives template creation/editing. Dynamic field forms render on the task screen gated by capture step. An auto-generated pivot SQL VIEW per template exposes clean columns for BI. Export reuses the existing exceljs/jspdf client-side pattern, adding `docx` for Word.

**Tech Stack:** Next.js (App Router, server actions), Prisma + MySQL (`prisma db push`), shadcn/ui, react-hook-form + zod, exceljs, jspdf + jspdf-autotable (Roboto for Greek), docx, vitest.

Spec: `docs/superpowers/specs/2026-07-09-process-template-custom-data-fields-design.md`

---

## File Structure

**Prisma**
- Modify: `prisma/schema.prisma` — new models/enum + relations

**Domain logic (lib) — unit-tested**
- Create: `src/lib/process-fields/field-types.ts` — `FieldType` labels, value column mapping, zod helpers
- Create: `src/lib/process-fields/coerce.ts` — raw form value → typed `ProcessFieldValue` columns + validation
- Create: `src/lib/process-fields/pivot.ts` — build rows (one per instance, columns per field) from field defs + values
- Create: `src/lib/process-fields/pivot-view.ts` — generate `CREATE OR REPLACE VIEW` SQL + identifier sanitization
- Create: `src/lib/lookup-lists/excel-import.ts` — parse an uploaded `.xlsx` ArrayBuffer → `{value,label}[]`
- Create: `src/lib/process-results/results-export.ts` — Excel/PDF/Word export of pivoted results (client-only)

**Lookup Lists feature**
- Create: `src/app/(app)/settings/lookup-lists/page.tsx` — server component (list + role guard)
- Create: `src/app/(app)/settings/lookup-lists/actions.ts` — CRUD + Excel import server actions
- Create: `src/app/(app)/settings/lookup-lists/lookup-lists-client.tsx` — client UI

**Template wizard + fields**
- Modify: `src/app/(app)/process-templates/actions.ts` — extend create/update with fields; add field upsert/soft-delete + view refresh
- Create: `src/app/(app)/process-templates/wizard/template-wizard.tsx` — 5-step horizontal wizard shell
- Create: `src/app/(app)/process-templates/wizard/step-fields.tsx` — Step 4 field editor (incl. combo-box lookup binding)
- Modify: `src/app/(app)/process-templates/process-templates-client.tsx` — mount wizard for create/edit
- Modify: `src/app/(app)/process-templates/page.tsx` — pass lookup lists to client

**Capture during execution**
- Create: `src/components/process-fields/dynamic-field-input.tsx` — one input per field type
- Create: `src/components/process-fields/task-fields-form.tsx` — editable current-step fields + read-only prior fields
- Modify: `src/app/(app)/process-instances/actions.ts` — `saveTaskFieldValues` action + required-field gate in `approveTask`
- Modify: `src/app/(app)/process-instances/[id]/process-instance-detail.tsx` — mount `task-fields-form`

**Results page**
- Create: `src/app/(app)/process-templates/[id]/results/page.tsx` — server component (pivot data)
- Create: `src/app/(app)/process-templates/[id]/results/results-client.tsx` — table + Export ▾ menu

**Nav**
- Modify: `src/lib/nav-config.ts` — add “Λίστες Τιμών” under Settings

---

## Task 1: Prisma schema — new models & enum

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add enum + models**

Append to `prisma/schema.prisma`:

```prisma
enum FieldType {
  STRING
  TEXT
  NUMBER
  DATE
  FILE_URL
  BOOLEAN
  SELECT
}

model ProcessFieldDefinition {
  id                String    @id @default(cuid())
  processTemplateId String
  name              String
  key               String
  type              FieldType
  order             Int
  required          Boolean   @default(false)
  captureTaskOrder  Int?      // matches ProcessTaskTemplate.order at runtime
  lookupListId      String?
  deletedAt         DateTime?

  processTemplate ProcessTemplate     @relation(fields: [processTemplateId], references: [id], onDelete: Cascade)
  lookupList      LookupList?         @relation(fields: [lookupListId], references: [id], onDelete: Restrict)
  values          ProcessFieldValue[]

  @@unique([processTemplateId, key])
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model ProcessFieldValue {
  id                String    @id @default(cuid())
  processInstanceId String
  fieldDefinitionId String
  valueString       String?   @db.Text
  valueNumber       Float?
  valueDate         DateTime?
  valueBool         Boolean?
  valueListItemId   String?

  processInstance ProcessInstance        @relation(fields: [processInstanceId], references: [id], onDelete: Cascade)
  fieldDefinition ProcessFieldDefinition @relation(fields: [fieldDefinitionId], references: [id], onDelete: Cascade)
  listItem        LookupListItem?        @relation(fields: [valueListItemId], references: [id], onDelete: SetNull)

  @@unique([processInstanceId, fieldDefinitionId])
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model LookupList {
  id          String                   @id @default(cuid())
  name        String
  description String?                  @db.Text
  items       LookupListItem[]
  fields      ProcessFieldDefinition[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model LookupListItem {
  id           String              @id @default(cuid())
  lookupListId String
  value        String
  label        String
  order        Int
  lookupList   LookupList          @relation(fields: [lookupListId], references: [id], onDelete: Cascade)
  usedByValues ProcessFieldValue[]
}
```

- [ ] **Step 2: Add back-relations on existing models**

In `model ProcessTemplate` add: `fields ProcessFieldDefinition[]`
In `model ProcessInstance` add: `fieldValues ProcessFieldValue[]`

- [ ] **Step 3: Push schema**

Run: `npx prisma db push && npx prisma generate`
Expected: “Your database is now in sync with your Prisma schema.” No destructive-reset prompt (additive only).

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(db): add process field definitions, values & lookup lists"
```

---

## Task 2: Field-type metadata helpers

**Files:**
- Create: `src/lib/process-fields/field-types.ts`
- Test: `src/lib/process-fields/field-types.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { FIELD_TYPES, fieldTypeLabel, valueColumnFor } from "./field-types";

describe("field-types", () => {
  it("lists all 7 types with Greek labels", () => {
    expect(FIELD_TYPES).toHaveLength(7);
    expect(fieldTypeLabel("NUMBER")).toBe("Αριθμός");
    expect(fieldTypeLabel("SELECT")).toBe("Λίστα τιμών");
  });
  it("maps each type to its storage column", () => {
    expect(valueColumnFor("NUMBER")).toBe("valueNumber");
    expect(valueColumnFor("DATE")).toBe("valueDate");
    expect(valueColumnFor("BOOLEAN")).toBe("valueBool");
    expect(valueColumnFor("SELECT")).toBe("valueListItemId");
    expect(valueColumnFor("STRING")).toBe("valueString");
    expect(valueColumnFor("TEXT")).toBe("valueString");
    expect(valueColumnFor("FILE_URL")).toBe("valueString");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/process-fields/field-types.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
import type { FieldType } from "@prisma/client";

export const FIELD_TYPES: FieldType[] = [
  "STRING", "TEXT", "NUMBER", "DATE", "FILE_URL", "BOOLEAN", "SELECT",
];

const LABELS: Record<FieldType, string> = {
  STRING: "Κείμενο (σύντομο)",
  TEXT: "Κείμενο (μεγάλο)",
  NUMBER: "Αριθμός",
  DATE: "Ημερομηνία",
  FILE_URL: "Αρχείο (URL)",
  BOOLEAN: "Ναι/Όχι",
  SELECT: "Λίστα τιμών",
};

export function fieldTypeLabel(t: FieldType): string {
  return LABELS[t];
}

export type ValueColumn =
  | "valueString" | "valueNumber" | "valueDate" | "valueBool" | "valueListItemId";

export function valueColumnFor(t: FieldType): ValueColumn {
  switch (t) {
    case "NUMBER": return "valueNumber";
    case "DATE": return "valueDate";
    case "BOOLEAN": return "valueBool";
    case "SELECT": return "valueListItemId";
    default: return "valueString"; // STRING, TEXT, FILE_URL
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/process-fields/field-types.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/process-fields/field-types.ts src/lib/process-fields/field-types.test.ts
git commit -m "feat(fields): field-type labels and storage-column mapping"
```

---

## Task 3: Value coercion & validation

**Files:**
- Create: `src/lib/process-fields/coerce.ts`
- Test: `src/lib/process-fields/coerce.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { coerceFieldValue } from "./coerce";

describe("coerceFieldValue", () => {
  it("coerces a number", () => {
    expect(coerceFieldValue("NUMBER", "12.5", false)).toEqual({ ok: true, columns: { valueNumber: 12.5 } });
  });
  it("rejects a non-number", () => {
    expect(coerceFieldValue("NUMBER", "abc", false).ok).toBe(false);
  });
  it("coerces a date to Date", () => {
    const r = coerceFieldValue("DATE", "2026-07-09", false);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.columns.valueDate?.toISOString().slice(0, 10)).toBe("2026-07-09");
  });
  it("coerces boolean", () => {
    expect(coerceFieldValue("BOOLEAN", "true", false)).toEqual({ ok: true, columns: { valueBool: true } });
  });
  it("stores SELECT as list item id", () => {
    expect(coerceFieldValue("SELECT", "item_1", false)).toEqual({ ok: true, columns: { valueListItemId: "item_1" } });
  });
  it("stores string types verbatim", () => {
    expect(coerceFieldValue("FILE_URL", "https://x/y.pdf", false)).toEqual({ ok: true, columns: { valueString: "https://x/y.pdf" } });
  });
  it("empty required fails", () => {
    expect(coerceFieldValue("STRING", "", true).ok).toBe(false);
  });
  it("empty optional yields null columns", () => {
    expect(coerceFieldValue("STRING", "", false)).toEqual({ ok: true, columns: { valueString: null } });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/process-fields/coerce.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
import type { FieldType } from "@prisma/client";

type Columns = {
  valueString?: string | null;
  valueNumber?: number | null;
  valueDate?: Date | null;
  valueBool?: boolean | null;
  valueListItemId?: string | null;
};

export type CoerceResult =
  | { ok: true; columns: Columns }
  | { ok: false; error: string };

export function coerceFieldValue(type: FieldType, raw: string | null | undefined, required: boolean): CoerceResult {
  const v = (raw ?? "").toString().trim();
  if (v === "") {
    if (required) return { ok: false, error: "Υποχρεωτικό πεδίο" };
    switch (type) {
      case "NUMBER": return { ok: true, columns: { valueNumber: null } };
      case "DATE": return { ok: true, columns: { valueDate: null } };
      case "BOOLEAN": return { ok: true, columns: { valueBool: null } };
      case "SELECT": return { ok: true, columns: { valueListItemId: null } };
      default: return { ok: true, columns: { valueString: null } };
    }
  }
  switch (type) {
    case "NUMBER": {
      const n = Number(v);
      if (!Number.isFinite(n)) return { ok: false, error: "Μη έγκυρος αριθμός" };
      return { ok: true, columns: { valueNumber: n } };
    }
    case "DATE": {
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) return { ok: false, error: "Μη έγκυρη ημερομηνία" };
      return { ok: true, columns: { valueDate: d } };
    }
    case "BOOLEAN":
      return { ok: true, columns: { valueBool: v === "true" || v === "1" || v === "on" } };
    case "SELECT":
      return { ok: true, columns: { valueListItemId: v } };
    default:
      return { ok: true, columns: { valueString: v } };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/process-fields/coerce.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/process-fields/coerce.ts src/lib/process-fields/coerce.test.ts
git commit -m "feat(fields): typed value coercion and validation"
```

---

## Task 4: Pivot rows builder

**Files:**
- Create: `src/lib/process-fields/pivot.ts`
- Test: `src/lib/process-fields/pivot.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { buildPivotRows } from "./pivot";

const fields = [
  { id: "f1", name: "Ποσό", type: "NUMBER" as const },
  { id: "f2", name: "Κατάστημα", type: "SELECT" as const },
];

const instances = [
  {
    id: "i1", name: "Δαπάνη #1",
    fieldValues: [
      { fieldDefinitionId: "f1", valueNumber: 100, valueString: null, valueDate: null, valueBool: null, listItem: null },
      { fieldDefinitionId: "f2", valueNumber: null, valueString: null, valueDate: null, valueBool: null, listItem: { label: "Αθήνα" } },
    ],
  },
];

describe("buildPivotRows", () => {
  it("returns one cell per field with display values", () => {
    const rows = buildPivotRows(fields, instances);
    expect(rows[0].instanceName).toBe("Δαπάνη #1");
    expect(rows[0].cells.f1).toBe("100");
    expect(rows[0].cells.f2).toBe("Αθήνα");
  });
  it("empty cell for missing value", () => {
    const rows = buildPivotRows(fields, [{ id: "i2", name: "Κενή", fieldValues: [] }]);
    expect(rows[0].cells.f1).toBe("");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/process-fields/pivot.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
import type { FieldType } from "@prisma/client";

export type PivotField = { id: string; name: string; type: FieldType };
export type PivotValue = {
  fieldDefinitionId: string;
  valueString: string | null;
  valueNumber: number | null;
  valueDate: Date | null;
  valueBool: boolean | null;
  listItem: { label: string } | null;
};
export type PivotInstance = { id: string; name: string; fieldValues: PivotValue[] };
export type PivotRow = { instanceId: string; instanceName: string; cells: Record<string, string> };

function display(field: PivotField, v: PivotValue | undefined): string {
  if (!v) return "";
  switch (field.type) {
    case "NUMBER": return v.valueNumber == null ? "" : String(v.valueNumber);
    case "DATE": return v.valueDate ? new Date(v.valueDate).toLocaleDateString("el-GR") : "";
    case "BOOLEAN": return v.valueBool == null ? "" : v.valueBool ? "Ναι" : "Όχι";
    case "SELECT": return v.listItem?.label ?? "";
    default: return v.valueString ?? "";
  }
}

export function buildPivotRows(fields: PivotField[], instances: PivotInstance[]): PivotRow[] {
  return instances.map((inst) => {
    const byField = new Map(inst.fieldValues.map((v) => [v.fieldDefinitionId, v]));
    const cells: Record<string, string> = {};
    for (const f of fields) cells[f.id] = display(f, byField.get(f.id));
    return { instanceId: inst.id, instanceName: inst.name, cells };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/process-fields/pivot.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/process-fields/pivot.ts src/lib/process-fields/pivot.test.ts
git commit -m "feat(fields): pivot rows builder for results table"
```

---

## Task 5: Pivot VIEW SQL generator

**Files:**
- Create: `src/lib/process-fields/pivot-view.ts`
- Test: `src/lib/process-fields/pivot-view.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { sanitizeIdentifier, buildPivotViewSql } from "./pivot-view";

describe("pivot-view", () => {
  it("sanitizes identifiers to safe snake_case", () => {
    expect(sanitizeIdentifier("Ποσό δαπάνης!")).toMatch(/^[a-z0-9_]+$/);
    expect(sanitizeIdentifier("")).toBe("col");
  });
  it("builds a CREATE OR REPLACE VIEW with one column per field", () => {
    const sql = buildPivotViewSql("tmpl123", [
      { id: "f1", key: "amount", type: "NUMBER" },
      { id: "f2", key: "store", type: "SELECT" },
    ]);
    expect(sql).toContain("CREATE OR REPLACE VIEW");
    expect(sql).toContain("process_data_tmpl123");
    expect(sql).toContain("MAX(CASE WHEN fv.fieldDefinitionId = 'f1'");
    expect(sql).toContain("`amount`");
    expect(sql).toContain("`store`");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/process-fields/pivot-view.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
import type { FieldType } from "@prisma/client";

export function sanitizeIdentifier(raw: string): string {
  const s = raw
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return s || "col";
}

type ViewField = { id: string; key: string; type: FieldType };

function valueExpr(type: FieldType): string {
  switch (type) {
    case "NUMBER": return "fv.valueNumber";
    case "DATE": return "fv.valueDate";
    case "BOOLEAN": return "fv.valueBool";
    case "SELECT": return "(SELECT li.label FROM LookupListItem li WHERE li.id = fv.valueListItemId)";
    default: return "fv.valueString";
  }
}

/** id values come from cuid (safe); key is sanitized. */
export function buildPivotViewSql(templateId: string, fields: ViewField[]): string {
  const viewName = `process_data_${sanitizeIdentifier(templateId)}`;
  const cols = fields.map((f) => {
    const alias = sanitizeIdentifier(f.key);
    return `MAX(CASE WHEN fv.fieldDefinitionId = '${f.id}' THEN ${valueExpr(f.type)} END) AS \`${alias}\``;
  });
  const select = [
    "pi.id AS process_instance_id",
    "pi.name AS process_name",
    "pi.status AS status",
    "pi.startDateTime AS start_date",
    ...cols,
  ].join(",\n  ");
  return (
    `CREATE OR REPLACE VIEW \`${viewName}\` AS\n` +
    `SELECT\n  ${select}\n` +
    `FROM ProcessInstance pi\n` +
    `LEFT JOIN ProcessFieldValue fv ON fv.processInstanceId = pi.id\n` +
    `WHERE pi.processTemplateId = '${templateId}'\n` +
    `GROUP BY pi.id;`
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/process-fields/pivot-view.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/process-fields/pivot-view.ts src/lib/process-fields/pivot-view.test.ts
git commit -m "feat(fields): pivot VIEW SQL generator with identifier sanitization"
```

---

## Task 6: Lookup lists — server actions

**Files:**
- Create: `src/app/(app)/settings/lookup-lists/actions.ts`
- Create: `src/lib/lookup-lists/excel-import.ts`
- Test: `src/lib/lookup-lists/excel-import.test.ts`

- [ ] **Step 1: Write the failing test for the Excel parser**

```ts
import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { parseLookupItemsFromWorkbook } from "./excel-import";

async function makeBuffer(rows: [string, string][]): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Sheet1");
  ws.addRow(["value", "label"]);
  rows.forEach((r) => ws.addRow(r));
  const buf = await wb.xlsx.writeBuffer();
  return buf as ArrayBuffer;
}

describe("parseLookupItemsFromWorkbook", () => {
  it("parses value/label rows, skipping the header and blanks", async () => {
    const buf = await makeBuffer([["ATH", "Αθήνα"], ["THE", "Θεσσαλονίκη"], ["", ""]]);
    const items = await parseLookupItemsFromWorkbook(buf);
    expect(items).toEqual([
      { value: "ATH", label: "Αθήνα", order: 0 },
      { value: "THE", label: "Θεσσαλονίκη", order: 1 },
    ]);
  });
  it("falls back label=value when only one column", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("S");
    ws.addRow(["value"]); ws.addRow(["SOLO"]);
    const buf = (await wb.xlsx.writeBuffer()) as ArrayBuffer;
    const items = await parseLookupItemsFromWorkbook(buf);
    expect(items).toEqual([{ value: "SOLO", label: "SOLO", order: 0 }]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/lookup-lists/excel-import.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the parser**

```ts
import ExcelJS from "exceljs";

export type ParsedLookupItem = { value: string; label: string; order: number };

/** First sheet, row 1 is a header (skipped). Col A = value, Col B = label (defaults to value). */
export async function parseLookupItemsFromWorkbook(buf: ArrayBuffer): Promise<ParsedLookupItem[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const items: ParsedLookupItem[] = [];
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // header
    const value = String(row.getCell(1).value ?? "").trim();
    const label = String(row.getCell(2).value ?? "").trim() || value;
    if (!value) return;
    items.push({ value, label, order: items.length });
  });
  return items;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/lookup-lists/excel-import.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the server actions**

Create `src/app/(app)/settings/lookup-lists/actions.ts`:

```ts
"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { parseLookupItemsFromWorkbook } from "@/lib/lookup-lists/excel-import";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("Μη εξουσιοδοτημένη πρόσβαση");
  requireRole(session.user.role, [Role.SUPER_ADMIN]);
}

export async function createLookupList(data: {
  name: string;
  description?: string;
  items: { value: string; label: string }[];
}) {
  await requireAdmin();
  await prisma.lookupList.create({
    data: {
      name: data.name,
      description: data.description ?? undefined,
      items: { create: data.items.map((it, i) => ({ value: it.value, label: it.label, order: i })) },
    },
  });
  revalidatePath("/settings/lookup-lists");
}

export async function updateLookupList(id: string, data: {
  name: string;
  description?: string;
  items: { value: string; label: string }[];
}) {
  await requireAdmin();
  await prisma.$transaction(async (tx) => {
    await tx.lookupList.update({ where: { id }, data: { name: data.name, description: data.description ?? undefined } });
    // items referenced by values must survive: delete only unreferenced, upsert by (list,value)
    const existing = await tx.lookupListItem.findMany({ where: { lookupListId: id } });
    const keepValues = new Set(data.items.map((i) => i.value));
    const removable = existing.filter((e) => !keepValues.has(e.value));
    for (const r of removable) {
      const refs = await tx.processFieldValue.count({ where: { valueListItemId: r.id } });
      if (refs === 0) await tx.lookupListItem.delete({ where: { id: r.id } });
    }
    const byValue = new Map(existing.map((e) => [e.value, e]));
    let order = 0;
    for (const it of data.items) {
      const found = byValue.get(it.value);
      if (found) await tx.lookupListItem.update({ where: { id: found.id }, data: { label: it.label, order } });
      else await tx.lookupListItem.create({ data: { lookupListId: id, value: it.value, label: it.label, order } });
      order++;
    }
  });
  revalidatePath("/settings/lookup-lists");
}

export async function deleteLookupList(id: string) {
  await requireAdmin();
  const inUse = await prisma.processFieldDefinition.count({ where: { lookupListId: id, deletedAt: null } });
  if (inUse > 0) throw new Error("Η λίστα χρησιμοποιείται σε πρότυπο και δεν μπορεί να διαγραφεί.");
  await prisma.lookupList.delete({ where: { id } });
  revalidatePath("/settings/lookup-lists");
}

export async function importLookupItems(formData: FormData): Promise<{ value: string; label: string }[]> {
  await requireAdmin();
  const file = formData.get("file") as File | null;
  if (!file) throw new Error("Δεν επιλέχθηκε αρχείο.");
  const buf = await file.arrayBuffer();
  const parsed = await parseLookupItemsFromWorkbook(buf);
  return parsed.map((p) => ({ value: p.value, label: p.label }));
}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/lookup-lists/excel-import.ts src/lib/lookup-lists/excel-import.test.ts "src/app/(app)/settings/lookup-lists/actions.ts"
git commit -m "feat(lookup): lookup list CRUD actions and Excel import parser"
```

---

## Task 7: Lookup lists — page & client UI

**Files:**
- Create: `src/app/(app)/settings/lookup-lists/page.tsx`
- Create: `src/app/(app)/settings/lookup-lists/lookup-lists-client.tsx`
- Modify: `src/lib/nav-config.ts`

- [ ] **Step 1: Add nav entry**

In `src/lib/nav-config.ts`, add to the appropriate group (create a “Ρυθμίσεις” group if none exists), following the existing item shape:

```ts
{ href: "/settings/lookup-lists", label: "Λίστες Τιμών", icon: FiList, roles: ["SUPER_ADMIN"] },
```
Ensure `FiList` (or another `react-icons/fi` icon) is imported at the top like the others.

- [ ] **Step 2: Create the server page**

`src/app/(app)/settings/lookup-lists/page.tsx`:

```tsx
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { LookupListsClient } from "./lookup-lists-client";

export default async function LookupListsPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");
  try {
    requireRole(session.user.role, [Role.SUPER_ADMIN]);
  } catch {
    redirect("/dashboard");
  }
  const lists = await prisma.lookupList.findMany({
    orderBy: { name: "asc" },
    include: { items: { orderBy: { order: "asc" } }, _count: { select: { fields: true } } },
  });
  return <LookupListsClient lists={lists} />;
}
```

- [ ] **Step 3: Create the client UI**

`src/app/(app)/settings/lookup-lists/lookup-lists-client.tsx` — a client component that:
- lists all lookup lists (name, item count, usage count) using existing shadcn `Card`/`Table` components already used in this repo (mirror `process-templates-client.tsx` styling);
- has “Νέα λίστα” opening a dialog with: name, description, an editable rows table (value/label add/remove/reorder), and an “⇪ Import Excel” `<input type="file" accept=".xlsx">` that calls `importLookupItems(formData)` and appends the returned rows;
- edit dialog calls `updateLookupList`, delete calls `deleteLookupList` (guarded — show the thrown error via toast).

Follow the exact client-component conventions in `process-templates-client.tsx` (imports, `"use client"`, dialog + toast usage). Wire the three server actions from Task 6.

Reference reading before writing: open `src/app/(app)/process-templates/process-templates-client.tsx` for the dialog/toast/table patterns to copy.

- [ ] **Step 4: Manual verification**

Run: `npm run dev`, open `/settings/lookup-lists`, create a list manually, then import a small `.xlsx` (columns value/label). Confirm rows appear and save persists (reload).

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/settings/lookup-lists/page.tsx" "src/app/(app)/settings/lookup-lists/lookup-lists-client.tsx" src/lib/nav-config.ts
git commit -m "feat(lookup): lookup lists management page with Excel import"
```

---

## Task 8: Extend template actions with fields + VIEW refresh

**Files:**
- Modify: `src/app/(app)/process-templates/actions.ts`

- [ ] **Step 1: Add a shared field input type and view-refresh helper**

At the top of `actions.ts` add imports:

```ts
import { buildPivotViewSql, sanitizeIdentifier } from "@/lib/process-fields/pivot-view";
import type { FieldType, Prisma } from "@prisma/client";
```

Add a shared type (exported for the client):

```ts
export type FieldInput = {
  id?: string;            // present when editing an existing field def
  name: string;
  key: string;
  type: FieldType;
  order: number;
  required: boolean;
  captureTaskOrder: number | null;
  lookupListId: string | null;
};
```

Add a helper that (re)builds the pivot view inside a transaction:

```ts
async function refreshPivotView(tx: Prisma.TransactionClient, templateId: string) {
  const fields = await tx.processFieldDefinition.findMany({
    where: { processTemplateId: templateId, deletedAt: null },
    orderBy: { order: "asc" },
    select: { id: true, key: true, type: true },
  });
  const viewName = `process_data_${sanitizeIdentifier(templateId)}`;
  if (fields.length === 0) {
    await tx.$executeRawUnsafe(`DROP VIEW IF EXISTS \`${viewName}\``);
    return;
  }
  await tx.$executeRawUnsafe(buildPivotViewSql(templateId, fields));
}
```

- [ ] **Step 2: Persist fields in `createProcessTemplate`**

Add `fields: FieldInput[]` to the `createProcessTemplate` `data` parameter type. Replace the single `prisma.processTemplate.create(...)` call with a transaction that creates the template (as today) and then the field defs, then refreshes the view:

```ts
await prisma.$transaction(async (tx) => {
  const template = await tx.processTemplate.create({
    data: {
      name: data.name,
      description: data.description ?? undefined,
      icon: data.icon,
      createdById: session.user.id,
      allowedDepartments: { create: data.allowedDepartmentIds.map((departmentId) => ({ departmentId })) },
      tasks: { create: data.tasks.map((t) => ({ /* …unchanged task mapping… */ })) },
    },
  });
  for (const f of data.fields) {
    await tx.processFieldDefinition.create({
      data: {
        processTemplateId: template.id,
        name: f.name, key: f.key, type: f.type, order: f.order,
        required: f.required, captureTaskOrder: f.captureTaskOrder,
        lookupListId: f.lookupListId ?? undefined,
      },
    });
  }
  await refreshPivotView(tx, template.id);
});
```
(Keep the existing task-mapping block verbatim inside `tasks.create`.)

- [ ] **Step 3: Upsert fields in `updateProcessTemplate`**

Add `fields: FieldInput[]` to the update `data` type. Inside the existing `prisma.$transaction`, after the task recreation loop, add a **diff-based** field upsert (do NOT delete-recreate field defs — values reference them):

```ts
const existingFields = await tx.processFieldDefinition.findMany({
  where: { processTemplateId: id, deletedAt: null },
});
const keepIds = new Set(data.fields.filter((f) => f.id).map((f) => f.id as string));

// soft-delete removed fields (preserve historical values)
for (const ef of existingFields) {
  if (!keepIds.has(ef.id)) {
    await tx.processFieldDefinition.update({ where: { id: ef.id }, data: { deletedAt: new Date() } });
  }
}

for (const f of data.fields) {
  if (f.id) {
    const prev = existingFields.find((e) => e.id === f.id);
    // block type change once values exist
    if (prev && prev.type !== f.type) {
      const used = await tx.processFieldValue.count({ where: { fieldDefinitionId: f.id } });
      if (used > 0) throw new Error(`Δεν επιτρέπεται αλλαγή τύπου στο πεδίο «${f.name}» — υπάρχουν καταχωρημένες τιμές.`);
    }
    await tx.processFieldDefinition.update({
      where: { id: f.id },
      data: { name: f.name, key: f.key, type: f.type, order: f.order, required: f.required, captureTaskOrder: f.captureTaskOrder, lookupListId: f.lookupListId ?? null },
    });
  } else {
    await tx.processFieldDefinition.create({
      data: { processTemplateId: id, name: f.name, key: f.key, type: f.type, order: f.order, required: f.required, captureTaskOrder: f.captureTaskOrder, lookupListId: f.lookupListId ?? undefined },
    });
  }
}
await refreshPivotView(tx, id);
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors from `actions.ts` (client callers updated in Task 9 — if the client isn’t updated yet, temporarily leave `fields` optional? No: update Task 9 next; a transient type error in the client is acceptable until Task 9).

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/process-templates/actions.ts"
git commit -m "feat(templates): persist field definitions and refresh pivot view"
```

---

## Task 9: Wizard shell (Layout B) + Step 4 field editor

**Files:**
- Create: `src/app/(app)/process-templates/wizard/template-wizard.tsx`
- Create: `src/app/(app)/process-templates/wizard/step-fields.tsx`
- Modify: `src/app/(app)/process-templates/process-templates-client.tsx`
- Modify: `src/app/(app)/process-templates/page.tsx`

- [ ] **Step 1: Load lookup lists in the page**

In `src/app/(app)/process-templates/page.tsx`, add to the existing data fetch:

```ts
const lookupLists = await prisma.lookupList.findMany({
  orderBy: { name: "asc" },
  select: { id: true, name: true, items: { orderBy: { order: "asc" }, select: { id: true, value: true, label: true } } },
});
```
Pass `lookupLists` as a prop into the existing client component.

- [ ] **Step 2: Build the wizard shell**

`src/app/(app)/process-templates/wizard/template-wizard.tsx` — a `"use client"` component that renders a **horizontal progress bar** (5 steps: Βασικά · Τμήματα · Βήματα & Ανάθεση · Πεδία Δεδομένων · Επισκόπηση) with Back/Next and per-step validation. It owns the full form state:

```tsx
"use client";
import { useState } from "react";
import type { FieldInput } from "../actions";

const STEPS = ["Βασικά", "Τμήματα", "Βήματα & Ανάθεση", "Πεδία Δεδομένων", "Επισκόπηση"] as const;

export type WizardTask = { /* mirror the task shape used by create/update actions */ };
export type WizardState = {
  name: string; description: string; icon: string;
  allowedDepartmentIds: string[];
  tasks: WizardTask[];
  fields: FieldInput[];
};

export function TemplateWizard(props: {
  initial?: WizardState;
  departments: { id: string; name: string }[];
  positions: { id: string; name: string }[];
  lookupLists: { id: string; name: string; items: { id: string; value: string; label: string }[] }[];
  onSubmit: (state: WizardState) => Promise<void>;
}) {
  const [step, setStep] = useState(0);
  const [state, setState] = useState<WizardState>(props.initial ?? {
    name: "", description: "", icon: "FiFileText", allowedDepartmentIds: [], tasks: [], fields: [],
  });
  // render progress bar (map STEPS → clickable segments, current highlighted)
  // render current step body; steps 1-3 reuse existing form fragments from process-templates-client
  // step 3 = <StepFields state={state} setState={setState} lookupLists={props.lookupLists} />
  // step 4 = review summary; final button calls props.onSubmit(state)
  return null; // replace with JSX per above
}
```

Reuse the existing basics/departments/tasks form markup already present in `process-templates-client.tsx` — extract those fragments into the wizard steps rather than duplicating logic. The task step must expose each task’s `order` so Step 4 can offer capture-step options.

- [ ] **Step 3: Build Step 4 (field editor)**

`src/app/(app)/process-templates/wizard/step-fields.tsx`:

```tsx
"use client";
import type { FieldInput } from "../actions";
import { FIELD_TYPES, fieldTypeLabel } from "@/lib/process-fields/field-types";

function slugify(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "field";
}

export function StepFields(props: {
  fields: FieldInput[];
  taskOptions: { order: number; name: string }[];
  lookupLists: { id: string; name: string }[];
  onChange: (fields: FieldInput[]) => void;
}) {
  const { fields, onChange } = props;
  function update(i: number, patch: Partial<FieldInput>) {
    const next = fields.map((f, idx) => (idx === i ? { ...f, ...patch } : f));
    onChange(next);
  }
  function add() {
    onChange([...fields, { name: "", key: "", type: "STRING", order: fields.length, required: false, captureTaskOrder: props.taskOptions[0]?.order ?? null, lookupListId: null }]);
  }
  function remove(i: number) {
    onChange(fields.filter((_, idx) => idx !== i).map((f, idx) => ({ ...f, order: idx })));
  }
  // Render a table: name input (onBlur → auto key = slugify(name) if key empty),
  // type <select> over FIELD_TYPES (labels via fieldTypeLabel),
  // capture-step <select> over taskOptions (value = order),
  // required checkbox,
  // when type === "SELECT": lookupList <select> over props.lookupLists (required),
  // delete button. "+ Προσθήκη πεδίου" button calls add().
  // Validation surfaced by the wizard: every field needs name+key; SELECT needs lookupListId; keys unique.
  return null; // replace with JSX per above
}
```

- [ ] **Step 4: Mount the wizard in the client**

In `process-templates-client.tsx`, replace the current create/edit form (or its dialog body) with `<TemplateWizard … onSubmit={…}>`, mapping `WizardState` → the `createProcessTemplate` / `updateProcessTemplate` argument (now including `fields`). For edit, build `initial` from the loaded template including its non-deleted `fields` (add `fields` to the template query’s `include` where the client’s edit data is loaded).

- [ ] **Step 5: Manual verification**

Run: `npm run dev`. Create a new template with 2 tasks and 3 fields (one SELECT bound to a lookup list). Save. Reload, edit it, confirm fields load and persist. In MySQL, confirm `SHOW TABLES LIKE 'process_data_%'` (or `information_schema.views`) shows the view.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/process-templates/wizard/template-wizard.tsx" "src/app/(app)/process-templates/wizard/step-fields.tsx" "src/app/(app)/process-templates/process-templates-client.tsx" "src/app/(app)/process-templates/page.tsx"
git commit -m "feat(templates): 5-step creation wizard with data-fields editor"
```

---

## Task 10: Capture fields during execution

**Files:**
- Create: `src/components/process-fields/dynamic-field-input.tsx`
- Create: `src/components/process-fields/task-fields-form.tsx`
- Modify: `src/app/(app)/process-instances/actions.ts`
- Modify: `src/app/(app)/process-instances/[id]/process-instance-detail.tsx`

- [ ] **Step 1: `saveTaskFieldValues` server action + required gate**

In `src/app/(app)/process-instances/actions.ts` add:

```ts
import { coerceFieldValue } from "@/lib/process-fields/coerce";

/** Fields whose captureTaskOrder matches this task's template order. */
async function fieldsForTask(taskId: string) {
  const task = await prisma.processTaskAssignment.findUnique({
    where: { id: taskId },
    include: { templateTask: true, processInstance: true },
  });
  if (!task) throw new Error("Δεν βρέθηκε η εργασία.");
  const fields = await prisma.processFieldDefinition.findMany({
    where: {
      processTemplateId: task.processInstance.processTemplateId,
      deletedAt: null,
      captureTaskOrder: task.templateTask.order,
    },
    orderBy: { order: "asc" },
  });
  return { task, fields };
}

export async function saveTaskFieldValues(taskId: string, values: Record<string, string>) {
  const session = await auth();
  if (!session?.user) throw new Error("Μη εξουσιοδοτημένη πρόσβαση");
  const { task, fields } = await fieldsForTask(taskId);
  const instanceId = task.processInstanceId;
  await prisma.$transaction(async (tx) => {
    for (const f of fields) {
      const res = coerceFieldValue(f.type, values[f.id], false); // required checked separately on complete
      if (!res.ok) throw new Error(`${f.name}: ${res.error}`);
      const existing = await tx.processFieldValue.findUnique({
        where: { processInstanceId_fieldDefinitionId: { processInstanceId: instanceId, fieldDefinitionId: f.id } },
      });
      if (existing) await tx.processFieldValue.update({ where: { id: existing.id }, data: res.columns });
      else await tx.processFieldValue.create({ data: { processInstanceId: instanceId, fieldDefinitionId: f.id, ...res.columns } });
    }
  });
  revalidatePath(`/process-instances/${instanceId}`);
}

/** Throws if any required field for this task is still empty. Call at the start of approveTask. */
export async function assertRequiredFieldsFilled(taskId: string) {
  const { task, fields } = await fieldsForTask(taskId);
  const required = fields.filter((f) => f.required);
  if (required.length === 0) return;
  const values = await prisma.processFieldValue.findMany({
    where: { processInstanceId: task.processInstanceId, fieldDefinitionId: { in: required.map((f) => f.id) } },
  });
  const byField = new Map(values.map((v) => [v.fieldDefinitionId, v]));
  for (const f of required) {
    const v = byField.get(f.id);
    const empty = !v || (v.valueString == null && v.valueNumber == null && v.valueDate == null && v.valueBool == null && v.valueListItemId == null);
    if (empty) throw new Error(`Συμπληρώστε το υποχρεωτικό πεδίο «${f.name}» πριν ολοκληρώσετε το βήμα.`);
  }
}
```

Then in the existing `approveTask`, immediately after auth, add: `await assertRequiredFieldsFilled(taskId);`

- [ ] **Step 2: `DynamicFieldInput` component**

`src/components/process-fields/dynamic-field-input.tsx` — `"use client"`, renders the right control per `FieldType`:

```tsx
"use client";
import type { FieldType } from "@prisma/client";

export function DynamicFieldInput(props: {
  type: FieldType;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  options?: { id: string; label: string }[]; // for SELECT
}) {
  const { type, value, onChange, disabled } = props;
  if (type === "TEXT") return <textarea className="…" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} />;
  if (type === "NUMBER") return <input type="number" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} />;
  if (type === "DATE") return <input type="date" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} />;
  if (type === "BOOLEAN") return <input type="checkbox" checked={value === "true"} disabled={disabled} onChange={(e) => onChange(e.target.checked ? "true" : "false")} />;
  if (type === "FILE_URL") return <input type="url" placeholder="https://…" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} />;
  if (type === "SELECT") return (
    <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
      <option value="">—</option>
      {(props.options ?? []).map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
    </select>
  );
  return <input type="text" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} />;
}
```
Use the repo’s existing shadcn `Input`/`Textarea`/`Checkbox`/`Select` components and classNames instead of raw elements — mirror how inputs are styled elsewhere (e.g. in `process-templates-client.tsx`).

- [ ] **Step 3: `TaskFieldsForm` component**

`src/components/process-fields/task-fields-form.tsx` — `"use client"`. Props: the current task’s editable fields (with existing values + SELECT options), and the prior-step fields to show read-only. Renders labels (with `*` for required), a `DynamicFieldInput` each, a “Αποθήκευση στοιχείων” button that calls `saveTaskFieldValues(taskId, values)` and toasts success/error. Read-only prior fields render their display value (reuse `buildPivotRows`-style display, or a small inline formatter).

Initial `value` strings map from stored columns: NUMBER→String(valueNumber), DATE→`toISOString().slice(0,10)`, BOOLEAN→"true"/"false", SELECT→valueListItemId, else valueString.

- [ ] **Step 4: Mount in the instance detail**

In `process-instance-detail.tsx`, for the active task, fetch (server side, in the page that feeds this component) the template’s field defs grouped by `captureTaskOrder` and the instance’s existing values + relevant lookup lists, and render `<TaskFieldsForm …/>` within the task panel. Prior-step fields (lower `captureTaskOrder`) render read-only.

- [ ] **Step 5: Manual verification**

Run: `npm run dev`. Start an instance of the template from Task 9. On task 1, fill the fields, save. Try to complete a step with an empty required field → expect the block message. Fill it → completes. Advance to task 2 → task-1 fields show read-only.

- [ ] **Step 6: Commit**

```bash
git add src/components/process-fields "src/app/(app)/process-instances/actions.ts" "src/app/(app)/process-instances/[id]/process-instance-detail.tsx"
git commit -m "feat(execution): capture custom field values per step with required gating"
```

---

## Task 11: Results page + Excel/PDF/Word export

**Files:**
- Create: `src/lib/process-results/results-export.ts`
- Create: `src/app/(app)/process-templates/[id]/results/page.tsx`
- Create: `src/app/(app)/process-templates/[id]/results/results-client.tsx`
- Modify: `package.json` (add `docx`)

- [ ] **Step 1: Add the Word dependency**

Run: `npm install docx`
Expected: `docx` added to dependencies.

- [ ] **Step 2: Export helpers**

`src/lib/process-results/results-export.ts` (client-only; mirror `src/lib/report-export.ts`):

```ts
import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun } from "docx";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export type ResultsExport = {
  title: string;
  columns: string[];           // ["Διαδικασία", ...field names]
  rows: string[][];            // each row: [instanceName, ...cell values]
};

export async function exportResultsExcel(d: ResultsExport) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Αποτελέσματα", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.addRow(d.columns);
  d.rows.forEach((r) => ws.addRow(r));
  ws.getRow(1).font = { bold: true };
  const buf = await wb.xlsx.writeBuffer();
  downloadBlob(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${d.title.replace(/\s+/g, "-")}.xlsx`);
}

export async function exportResultsPdf(d: ResultsExport, robotoBase64?: string) {
  const doc = new jsPDF({ orientation: "landscape" });
  if (robotoBase64) {
    doc.addFileToVFS("Roboto.ttf", robotoBase64);
    doc.addFont("Roboto.ttf", "Roboto", "normal");
    doc.setFont("Roboto");
  }
  doc.setFontSize(14);
  doc.text(d.title, 14, 12);
  autoTable(doc, {
    head: [d.columns], body: d.rows, startY: 18,
    styles: { fontSize: 8, font: robotoBase64 ? "Roboto" : undefined },
  });
  downloadBlob(doc.output("blob"), `${d.title.replace(/\s+/g, "-")}.pdf`);
}

export async function exportResultsWord(d: ResultsExport) {
  const header = new TableRow({ children: d.columns.map((c) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: c, bold: true })] })] })) });
  const body = d.rows.map((r) => new TableRow({ children: r.map((c) => new TableCell({ children: [new Paragraph(c)] })) }));
  const docx = new Document({ sections: [{ children: [new Paragraph({ children: [new TextRun({ text: d.title, bold: true, size: 28 })] }), new Table({ rows: [header, ...body] })] }] });
  const blob = await Packer.toBlob(docx);
  downloadBlob(blob, `${d.title.replace(/\s+/g, "-")}.docx`);
}
```
For `robotoBase64`, import the existing base64 string from `src/app/(app)/organization/roboto-font.ts` (check its export name and reuse it) so Greek renders in the PDF.

- [ ] **Step 3: Results server page**

`src/app/(app)/process-templates/[id]/results/page.tsx` — role-guarded (SUPER_ADMIN/ADMIN/MANAGER, mirror reports pages). Load:

```ts
const template = await prisma.processTemplate.findUnique({
  where: { id },
  select: { id: true, name: true, fields: { where: { deletedAt: null }, orderBy: { order: "asc" }, select: { id: true, name: true, type: true } } },
});
const instances = await prisma.processInstance.findMany({
  where: { processTemplateId: id },
  orderBy: { startDateTime: "desc" },
  select: {
    id: true, name: true,
    fieldValues: { select: { fieldDefinitionId: true, valueString: true, valueNumber: true, valueDate: true, valueBool: true, listItem: { select: { label: true } } } },
  },
});
```
Pass `template.fields` and `instances` into the client, using `buildPivotRows` there (or precompute rows server-side and pass plain strings).

- [ ] **Step 4: Results client**

`src/app/(app)/process-templates/[id]/results/results-client.tsx` — `"use client"`. Renders a table (columns = "Διαδικασία" + field names, one row per instance via `buildPivotRows`) and an **Export ▾** dropdown (shadcn `DropdownMenu`) with checkboxes for **Excel / PDF / Word** and an “Εξαγωγή” button that maps the pivot rows into a `ResultsExport` (`columns`, `rows`) and calls the selected export helper(s). Multi-select allowed (loop over chosen formats).

Add a “Αποτελέσματα” link/button to each template card in `process-templates-client.tsx` pointing to `/process-templates/{id}/results`.

- [ ] **Step 5: Manual verification**

Run: `npm run dev`. Open `/process-templates/{id}/results` for the template with instance data from Task 10. Confirm the table shows field columns and values. Export Excel, PDF (Greek renders), Word — open each file and verify content.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/lib/process-results "src/app/(app)/process-templates/[id]/results" "src/app/(app)/process-templates/process-templates-client.tsx"
git commit -m "feat(results): per-template results page with Excel/PDF/Word export"
```

---

## Task 12: Final verification

- [ ] **Step 1: Typecheck & tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no type errors; all unit tests pass.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: successful production build.

- [ ] **Step 3: End-to-end smoke (manual)**

1. Create a lookup list (manual + Excel import).
2. Create a template via the wizard with fields incl. a SELECT bound to that list.
3. Start an instance, fill fields across steps, hit the required-field gate, complete steps.
4. Open results, verify table, export all three formats.
5. Edit the template: rename a field, add a field, remove a field (soft-delete), confirm old instance values survive and the results table reflects changes.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "chore: final verification fixes for custom data fields"
```

---

## Notes for the implementer

- **`prisma db push` only** — never `migrate dev` (repo convention; it wants a destructive reset).
- The pivot VIEW uses `$executeRawUnsafe` with sanitized identifiers; field `id`s are cuids (safe), and `key`/template-id are sanitized via `sanitizeIdentifier`. Do not interpolate unsanitized user text into DDL.
- Field defs are **soft-deleted**, never hard-deleted, so historical `ProcessFieldValue` rows remain valid. Always filter `deletedAt: null` for active fields.
- Capture step is matched by `captureTaskOrder === ProcessTaskTemplate.order`, because `updateProcessTemplate` recreates task rows (new ids) on each edit.
- Follow existing client-component conventions (dialogs, toasts, shadcn imports) from `process-templates-client.tsx`; do not introduce a new UI pattern.
