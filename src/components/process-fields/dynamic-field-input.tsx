"use client";

import type { FieldType } from "@prisma/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

const selectClass =
  "border-input dark:bg-input/30 h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm";

export function DynamicFieldInput(props: {
  type: FieldType;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  options?: { id: string; label: string }[]; // for SELECT
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
