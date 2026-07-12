"use client";

import { useEffect, useRef, useState } from "react";
import type { EntityKind, FieldType } from "@prisma/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { searchEntityOptions } from "@/app/(app)/entities/actions";

const selectClass =
  "border-input dark:bg-input/30 h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm";

export function DynamicFieldInput(props: {
  type: FieldType;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  options?: { id: string; label: string }[]; // for SELECT
  entityKind?: EntityKind | null; // for ENTITY
  entityLabel?: string | null; // for ENTITY: label of the currently stored value
}) {
  const { type, value, onChange, disabled } = props;

  if (type === "TEXT") {
    return (
      <Textarea
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  if (type === "NUMBER") {
    return (
      <Input
        type="number"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  if (type === "DATE") {
    return (
      <Input
        type="date"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  if (type === "BOOLEAN") {
    return (
      <Checkbox
        checked={value === "true"}
        disabled={disabled}
        onCheckedChange={(c) => onChange(c === true ? "true" : "false")}
      />
    );
  }
  if (type === "FILE_URL") {
    return (
      <Input
        type="url"
        placeholder="https://…"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  if (type === "SELECT") {
    return (
      <select
        className={cn(selectClass)}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">—</option>
        {(props.options ?? []).map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }
  if (type === "ENTITY" && props.entityKind) {
    return (
      <EntitySearchSelect
        kind={props.entityKind}
        value={value}
        initialLabel={props.entityLabel ?? null}
        disabled={disabled}
        onChange={onChange}
      />
    );
  }
  // STRING (default)
  return (
    <Input
      type="text"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

/**
 * Αναζητήσιμο select οντότητας: debounced αναζήτηση μέσω searchEntityOptions,
 * εμφανίζει «κωδικός — όνομα» και αποθηκεύει το id της οντότητας ως τιμή.
 */
function EntitySearchSelect(props: {
  kind: EntityKind;
  value: string; // entity id
  initialLabel: string | null;
  disabled?: boolean;
  onChange: (id: string) => void;
}) {
  const { kind, value, initialLabel, disabled, onChange } = props;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<{ id: string; code: string; name: string }[]>([]);
  // Ετικέτα επιλεγμένης τιμής: από τον server αρχικά, από την επιλογή μετά.
  const [selectedLabel, setSelectedLabel] = useState<string | null>(initialLabel);
  const rootRef = useRef<HTMLDivElement>(null);
  const seqRef = useRef(0);

  // Debounced αναζήτηση όσο το dropdown είναι ανοιχτό.
  useEffect(() => {
    if (!open) return;
    const seq = ++seqRef.current;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const rows = await searchEntityOptions(kind, query);
        if (seqRef.current === seq) setOptions(rows);
      } catch {
        if (seqRef.current === seq) setOptions([]);
      } finally {
        if (seqRef.current === seq) setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [open, query, kind]);

  // Κλείσιμο στο κλικ εκτός.
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  function pick(o: { id: string; code: string; name: string }) {
    onChange(o.id);
    setSelectedLabel(`${o.code} — ${o.name}`);
    setOpen(false);
    setQuery("");
  }

  function clear() {
    onChange("");
    setSelectedLabel(null);
  }

  return (
    <div ref={rootRef} className="relative">
      {value && !open ? (
        <div className={cn(selectClass, "flex items-center justify-between gap-2")}>
          <button
            type="button"
            disabled={disabled}
            className="min-w-0 flex-1 truncate text-left"
            onClick={() => setOpen(true)}
          >
            {selectedLabel ?? value}
          </button>
          {!disabled && (
            <button
              type="button"
              aria-label="Καθαρισμός"
              className="shrink-0 text-muted-foreground hover:text-foreground"
              onClick={clear}
            >
              ×
            </button>
          )}
        </div>
      ) : (
        <Input
          type="text"
          placeholder="Αναζήτηση με κωδικό ή όνομα…"
          value={query}
          disabled={disabled}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
        />
      )}
      {open && !disabled && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md">
          {loading ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">Αναζήτηση…</p>
          ) : options.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">Δεν βρέθηκαν αποτελέσματα.</p>
          ) : (
            options.map((o) => (
              <button
                key={o.id}
                type="button"
                className={cn(
                  "block w-full truncate px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground",
                  o.id === value && "bg-accent/50 font-medium",
                )}
                onClick={() => pick(o)}
              >
                {o.code} — {o.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
