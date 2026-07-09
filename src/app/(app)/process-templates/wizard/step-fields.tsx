"use client";

import { Trash2, Plus, Database, AlertCircle } from "lucide-react";
import type { FieldInput } from "../actions";
import { FIELD_TYPES, fieldTypeLabel } from "@/lib/process-fields/field-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const NONE = "__none__";

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
      fields.filter((_, idx) => idx !== i).map((f, idx) => ({ ...f, order: idx })),
    );
  }

  const keyCounts = new Map<string, number>();
  for (const f of fields) {
    const k = f.key.trim();
    if (k) keyCounts.set(k, (keyCounts.get(k) ?? 0) + 1);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-foreground">Πεδία δεδομένων</h3>
          <p className="max-w-prose text-sm text-muted-foreground">
            Ορίστε τα δεδομένα που θα συμπληρώνονται κατά την εκτέλεση της διαδικασίας και σε
            ποιο βήμα καταχωρούνται. Τα αποτελέσματα αποθηκεύονται δομημένα ανά διαδικασία.
          </p>
        </div>
        {fields.length > 0 && (
          <Button type="button" size="sm" onClick={add} className="shrink-0">
            <Plus className="size-4" />
            Προσθήκη πεδίου
          </Button>
        )}
      </div>

      {fields.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-muted/20 px-6 py-12 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Database className="size-6" />
          </span>
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">Δεν έχουν οριστεί πεδία</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              Προσθέστε πεδία (κείμενο, αριθμό, ημερομηνία, αρχείο, λίστα τιμών κ.λπ.) για να
              καταγράφετε αξιοποιήσιμα αποτελέσματα.
            </p>
          </div>
          <Button type="button" size="sm" onClick={add}>
            <Plus className="size-4" />
            Προσθήκη πρώτου πεδίου
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {fields.map((f, i) => {
            const dupKey = f.key.trim() !== "" && (keyCounts.get(f.key.trim()) ?? 0) > 1;
            const missingList = f.type === "SELECT" && !f.lookupListId;
            return (
              <div
                key={i}
                className="overflow-hidden rounded-xl border bg-card shadow-sm transition-shadow focus-within:shadow-md"
              >
                {/* header: number · name · delete */}
                <div className="flex items-center gap-3 border-b bg-muted/30 px-3 py-2">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {i + 1}
                  </span>
                  <Input
                    value={f.name}
                    placeholder="Όνομα πεδίου — π.χ. Ποσό δαπάνης"
                    className="h-8 flex-1 border-0 bg-transparent px-0 text-sm font-medium shadow-none focus-visible:ring-0"
                    onChange={(e) => update(i, { name: e.target.value })}
                    onBlur={() => {
                      if (!f.key.trim() && f.name.trim()) update(i, { key: slugifyKey(f.name) });
                    }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => remove(i)}
                    aria-label="Αφαίρεση πεδίου"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>

                {/* controls */}
                <div className="grid gap-4 p-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Τύπος</Label>
                    <Select
                      value={f.type}
                      onValueChange={(v) =>
                        update(i, {
                          type: v as FieldInput["type"],
                          lookupListId: v === "SELECT" ? f.lookupListId : null,
                        })
                      }
                    >
                      <SelectTrigger className="h-9 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FIELD_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {fieldTypeLabel(t)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Βήμα καταχώρησης</Label>
                    <Select
                      value={f.captureTaskOrder == null ? NONE : String(f.captureTaskOrder)}
                      onValueChange={(v) =>
                        update(i, { captureTaskOrder: v === NONE ? null : Number(v) })
                      }
                    >
                      <SelectTrigger className="h-9 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Κανένα / πρώτο</SelectItem>
                        {taskOptions.map((t) => (
                          <SelectItem key={t.order} value={String(t.order)}>
                            Βήμα {t.order + 1}: {t.name.trim() || "Χωρίς όνομα"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Κλειδί (slug)</Label>
                    <Input
                      value={f.key}
                      placeholder="auto από το όνομα"
                      className="h-9 font-mono text-xs"
                      onChange={(e) => update(i, { key: e.target.value })}
                    />
                    {dupKey && (
                      <p className="flex items-center gap-1 text-xs text-destructive">
                        <AlertCircle className="size-3" />
                        Το κλειδί πρέπει να είναι μοναδικό.
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Συμπλήρωση</Label>
                    <label className="flex h-9 cursor-pointer select-none items-center gap-2 rounded-md border border-input bg-transparent px-3 text-sm">
                      <Checkbox
                        checked={f.required}
                        onCheckedChange={(c) => update(i, { required: !!c })}
                      />
                      Υποχρεωτικό
                    </label>
                  </div>
                </div>

                {/* lookup list binding (SELECT only) */}
                {f.type === "SELECT" && (
                  <div className="space-y-1.5 border-t bg-primary/5 px-3 py-3">
                    <Label className="text-xs font-medium text-foreground">Λίστα τιμών</Label>
                    <Select
                      value={f.lookupListId ?? undefined}
                      onValueChange={(v) => update(i, { lookupListId: v })}
                      disabled={lookupLists.length === 0}
                    >
                      <SelectTrigger className="h-9 w-full max-w-sm">
                        <SelectValue placeholder="Επιλέξτε λίστα τιμών…" />
                      </SelectTrigger>
                      <SelectContent>
                        {lookupLists.map((l) => (
                          <SelectItem key={l.id} value={l.id}>
                            {l.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {lookupLists.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Δεν υπάρχουν λίστες τιμών. Δημιουργήστε μία από τις Ρυθμίσεις → Λίστες Τιμών.
                      </p>
                    ) : (
                      missingList && (
                        <p className="flex items-center gap-1 text-xs text-destructive">
                          <AlertCircle className="size-3" />
                          Τα πεδία τύπου «Λίστα τιμών» απαιτούν επιλογή λίστας.
                        </p>
                      )
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
