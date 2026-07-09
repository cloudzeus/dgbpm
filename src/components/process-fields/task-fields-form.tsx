"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { FieldType } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DynamicFieldInput } from "./dynamic-field-input";
import { saveTaskFieldValues } from "@/app/(app)/process-instances/actions";

export type StoredFieldValue = {
  valueString: string | null;
  valueNumber: number | null;
  valueDate: Date | string | null;
  valueBool: boolean | null;
  valueListItemId: string | null;
  listItem: { label: string } | null;
} | null;

export type EditableField = {
  id: string;
  name: string;
  type: FieldType;
  required: boolean;
  options: { id: string; label: string }[];
  value: StoredFieldValue;
};

export type PriorField = {
  id: string;
  name: string;
  type: FieldType;
  value: StoredFieldValue;
};

/** Map a stored value row into the string the DynamicFieldInput expects. */
function toInitialString(type: FieldType, v: StoredFieldValue): string {
  if (!v) return "";
  switch (type) {
    case "NUMBER":
      return v.valueNumber == null ? "" : String(v.valueNumber);
    case "DATE":
      return v.valueDate ? new Date(v.valueDate).toISOString().slice(0, 10) : "";
    case "BOOLEAN":
      return v.valueBool == null ? "false" : v.valueBool ? "true" : "false";
    case "SELECT":
      return v.valueListItemId ?? "";
    default:
      return v.valueString ?? "";
  }
}

/** Human-readable display for a read-only prior field. */
function toDisplay(type: FieldType, v: StoredFieldValue): string {
  if (!v) return "—";
  switch (type) {
    case "NUMBER":
      return v.valueNumber == null ? "—" : String(v.valueNumber);
    case "DATE":
      return v.valueDate ? new Date(v.valueDate).toLocaleDateString("el-GR") : "—";
    case "BOOLEAN":
      return v.valueBool == null ? "—" : v.valueBool ? "Ναι" : "Όχι";
    case "SELECT":
      return v.listItem?.label ?? "—";
    default:
      return v.valueString && v.valueString.trim() !== "" ? v.valueString : "—";
  }
}

export function TaskFieldsForm({
  taskId,
  editable,
  readOnly,
  canEdit,
}: {
  taskId: string;
  editable: EditableField[];
  readOnly: PriorField[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of editable) init[f.id] = toInitialString(f.type, f.value);
    return init;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  if (editable.length === 0 && readOnly.length === 0) return null;

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await saveTaskFieldValues(taskId, values);
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Η αποθήκευση απέτυχε");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {readOnly.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Στοιχεία προηγούμενων βημάτων</h4>
          <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            {readOnly.map((f) => (
              <div key={f.id} className="flex flex-col">
                <dt className="text-xs text-muted-foreground">{f.name}</dt>
                <dd>{toDisplay(f.type, f.value)}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {editable.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Στοιχεία αυτού του βήματος</h4>
          {editable.map((f) => (
            <div key={f.id} className="space-y-1">
              <Label className="flex items-center gap-1">
                {f.name}
                {f.required && <span className="text-destructive">*</span>}
              </Label>
              <DynamicFieldInput
                type={f.type}
                value={values[f.id] ?? ""}
                onChange={(v) => setValues((prev) => ({ ...prev, [f.id]: v }))}
                disabled={!canEdit || saving}
                options={f.options}
              />
            </div>
          ))}
          {canEdit && (
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={handleSave} disabled={saving} variant="outline" size="sm">
                {saving ? "Αποθήκευση..." : "Αποθήκευση στοιχείων"}
              </Button>
              {saved && !error && (
                <span className="text-xs text-muted-foreground">Αποθηκεύτηκε.</span>
              )}
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      )}
    </div>
  );
}
