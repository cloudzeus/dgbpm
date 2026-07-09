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
