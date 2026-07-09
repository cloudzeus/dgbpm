"use client";

import type { FieldInput } from "../actions";
import { FIELD_TYPES, fieldTypeLabel } from "@/lib/process-fields/field-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export function slugifyKey(s: string): string {
  return (
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "field"
  );
}

export function StepFields(props: {
  fields: FieldInput[];
  taskOptions: { order: number; name: string }[];
  lookupLists: { id: string; name: string }[];
  onChange: (fields: FieldInput[]) => void;
}) {
  const { fields, taskOptions, lookupLists, onChange } = props;

  function update(i: number, patch: Partial<FieldInput>) {
    onChange(fields.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  }

  function add() {
    onChange([
      ...fields,
      {
        name: "",
        key: "",
        type: "STRING",
        order: fields.length,
        required: false,
        captureTaskOrder: taskOptions[0]?.order ?? null,
        lookupListId: null,
      },
    ]);
  }

  function remove(i: number) {
    onChange(
      fields
        .filter((_, idx) => idx !== i)
        .map((f, idx) => ({ ...f, order: idx })),
    );
  }

  const keyCounts = new Map<string, number>();
  for (const f of fields) {
    const k = f.key.trim();
    if (k) keyCounts.set(k, (keyCounts.get(k) ?? 0) + 1);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Πεδία δεδομένων</h3>
          <p className="text-muted-foreground text-sm">
            Ορίστε τα δεδομένα που θα συμπληρώνονται κατά την εκτέλεση της διαδικασίας και σε ποιο βήμα.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={add}>
          + Προσθήκη πεδίου
        </Button>
      </div>

      {fields.length === 0 ? (
        <p className="text-muted-foreground text-sm rounded-md border p-4">
          Δεν έχουν οριστεί πεδία. Κάντε κλικ στο «Προσθήκη πεδίου» για να προσθέσετε ένα.
        </p>
      ) : (
        <div className="space-y-3">
          {fields.map((f, i) => {
            const dupKey = f.key.trim() !== "" && (keyCounts.get(f.key.trim()) ?? 0) > 1;
            return (
              <div key={i} className="rounded-lg border bg-muted/20 p-3 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Όνομα πεδίου</Label>
                    <Input
                      value={f.name}
                      placeholder="π.χ. Ποσό δαπάνης"
                      onChange={(e) => update(i, { name: e.target.value })}
                      onBlur={() => {
                        if (!f.key.trim() && f.name.trim()) {
                          update(i, { key: slugifyKey(f.name) });
                        }
                      }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Κλειδί (slug)</Label>
                    <Input
                      value={f.key}
                      placeholder="auto από το όνομα"
                      onChange={(e) => update(i, { key: e.target.value })}
                    />
                    {dupKey && (
                      <p className="text-xs text-destructive">Το κλειδί πρέπει να είναι μοναδικό.</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Τύπος</Label>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                      value={f.type}
                      onChange={(e) =>
                        update(i, {
                          type: e.target.value as FieldInput["type"],
                          // clear lookup binding when leaving SELECT
                          lookupListId: e.target.value === "SELECT" ? f.lookupListId : null,
                        })
                      }
                    >
                      {FIELD_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {fieldTypeLabel(t)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Βήμα καταχώρησης</Label>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                      value={f.captureTaskOrder ?? ""}
                      onChange={(e) =>
                        update(i, {
                          captureTaskOrder: e.target.value === "" ? null : Number(e.target.value),
                        })
                      }
                    >
                      <option value="">— (κανένα / πρώτο)</option>
                      {taskOptions.map((t) => (
                        <option key={t.order} value={t.order}>
                          Βήμα {t.order + 1}: {t.name.trim() || "Χωρίς όνομα"}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-end gap-4 pb-1">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={f.required}
                        onCheckedChange={(c) => update(i, { required: !!c })}
                      />
                      Υποχρεωτικό
                    </label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="ml-auto text-destructive"
                      onClick={() => remove(i)}
                    >
                      Αφαίρεση
                    </Button>
                  </div>
                </div>

                {f.type === "SELECT" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Λίστα τιμών</Label>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                      value={f.lookupListId ?? ""}
                      onChange={(e) =>
                        update(i, { lookupListId: e.target.value === "" ? null : e.target.value })
                      }
                    >
                      <option value="">— Επιλέξτε λίστα —</option>
                      {lookupLists.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </select>
                    {!f.lookupListId && (
                      <p className="text-xs text-destructive">
                        Τα πεδία τύπου «Λίστα τιμών» απαιτούν επιλογή λίστας.
                      </p>
                    )}
                    {lookupLists.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        Δεν υπάρχουν λίστες τιμών. Δημιουργήστε μία από τις Ρυθμίσεις → Λίστες Τιμών.
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
