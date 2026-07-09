"use client";

import { useState } from "react";
import { Trash2, Plus, Database, AlertCircle, Pencil } from "lucide-react";
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

const GREEK_MAP: Record<string, string> = {
  α: "a", β: "v", γ: "g", δ: "d", ε: "e", ζ: "z", η: "i", θ: "th", ι: "i",
  κ: "k", λ: "l", μ: "m", ν: "n", ξ: "x", ο: "o", π: "p", ρ: "r", σ: "s",
  ς: "s", τ: "t", υ: "y", φ: "f", χ: "ch", ψ: "ps", ω: "o",
  ά: "a", έ: "e", ή: "i", ί: "i", ό: "o", ύ: "y", ώ: "o", ϊ: "i", ϋ: "y", ΐ: "i", ΰ: "y",
};

export function slugifyKey(s: string): string {
  const transliterated = s
    .toLowerCase()
    .split("")
    .map((ch) => GREEK_MAP[ch] ?? ch)
    .join("");
  return (
    transliterated
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
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
          {fields.map((f, i) => (
            <FieldRow
              key={i}
              index={i}
              field={f}
              taskOptions={taskOptions}
              lookupLists={lookupLists}
              dupKey={f.key.trim() !== "" && (keyCounts.get(f.key.trim()) ?? 0) > 1}
              onUpdate={(patch) => update(i, patch)}
              onRemove={() => remove(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FieldRow(props: {
  index: number;
  field: FieldInput;
  taskOptions: { order: number; name: string }[];
  lookupLists: { id: string; name: string }[];
  dupKey: boolean;
  onUpdate: (patch: Partial<FieldInput>) => void;
  onRemove: () => void;
}) {
  const { index, field: f, taskOptions, lookupLists, dupKey, onUpdate, onRemove } = props;
  const [showKey, setShowKey] = useState(false);
  // Key auto-syncs (Latin slug) from the name until the user edits it manually.
  const [keyEdited, setKeyEdited] = useState(() => f.key.trim() !== "");
  const missingList = f.type === "SELECT" && !f.lookupListId;

  function handleNameChange(name: string) {
    onUpdate(keyEdited ? { name } : { name, key: name.trim() ? slugifyKey(name) : "" });
  }
  function handleKeyChange(key: string) {
    setKeyEdited(true);
    onUpdate({ key });
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm transition-shadow focus-within:shadow-md">
      {/* header: index label + delete */}
      <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-1.5">
        <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <span className="flex size-5 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
            {index + 1}
          </span>
          Πεδίο {index + 1}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
          aria-label="Αφαίρεση πεδίου"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      {/* primary controls */}
      <div className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
          <Label className="text-xs text-muted-foreground">Όνομα πεδίου</Label>
          <Input
            value={f.name}
            placeholder="π.χ. Ποσό δαπάνης"
            className="h-9"
            onChange={(e) => handleNameChange(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Τύπος</Label>
          <Select
            value={f.type}
            onValueChange={(v) =>
              onUpdate({
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
            onValueChange={(v) => onUpdate({ captureTaskOrder: v === NONE ? null : Number(v) })}
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
      </div>

      {/* secondary row: required toggle + collapsible key */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 pb-3">
        <label className="flex cursor-pointer select-none items-center gap-2 text-sm">
          <Checkbox checked={f.required} onCheckedChange={(c) => onUpdate({ required: !!c })} />
          Υποχρεωτικό
        </label>
        <button
          type="button"
          onClick={() => setShowKey((s) => !s)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <span>Κλειδί:</span>
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">
            {f.key.trim() || "—"}
          </code>
          <Pencil className="size-3" />
        </button>
        {dupKey && (
          <span className="flex items-center gap-1 text-xs text-destructive">
            <AlertCircle className="size-3" />
            Διπλό κλειδί
          </span>
        )}
      </div>

      {showKey && (
        <div className="space-y-1.5 border-t bg-muted/20 px-3 py-3">
          <Label className="text-xs text-muted-foreground">Κλειδί (τεχνικό αναγνωριστικό)</Label>
          <Input
            value={f.key}
            placeholder={f.name.trim() ? slugifyKey(f.name) : "auto"}
            className="h-9 max-w-xs font-mono text-xs"
            onChange={(e) => handleKeyChange(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Δημιουργείται αυτόματα από το όνομα. Χρησιμοποιείται στις στήλες αποτελεσμάτων/export.
          </p>
        </div>
      )}

      {/* lookup list binding (SELECT only) */}
      {f.type === "SELECT" && (
        <div className="space-y-1.5 border-t bg-primary/5 px-3 py-3">
          <Label className="text-xs font-medium text-foreground">Λίστα τιμών</Label>
          <Select
            value={f.lookupListId ?? undefined}
            onValueChange={(v) => onUpdate({ lookupListId: v })}
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
}
