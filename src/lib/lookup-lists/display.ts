export type LookupColumnDef = { key: string; label: string };

/** Ασφαλές parse του Json πεδίου extraColumns μιας λίστας. */
export function parseLookupColumns(json: unknown): LookupColumnDef[] {
  if (!Array.isArray(json)) return [];
  return json.filter(
    (c): c is LookupColumnDef =>
      !!c &&
      typeof c === "object" &&
      typeof (c as LookupColumnDef).key === "string" &&
      typeof (c as LookupColumnDef).label === "string"
  );
}

/** Εμφανιζόμενο κείμενο ενός item λίστας βάσει της στήλης εμφάνισης του πεδίου. */
export type LookupDisplayItem = { value: string; label: string; extra?: unknown };

/**
 * displayKey: null/"label" → ετικέτα, "value" → κλειδί, αλλιώς key extra στήλης.
 * Πέφτει πάντα πίσω στην ετικέτα αν η στήλη λείπει από την εγγραφή.
 */
export function lookupItemDisplay(
  item: LookupDisplayItem,
  displayKey: string | null | undefined
): string {
  if (!displayKey || displayKey === "label") return item.label;
  if (displayKey === "value") return item.value;
  const extra = item.extra;
  if (extra && typeof extra === "object" && !Array.isArray(extra)) {
    const v = (extra as Record<string, unknown>)[displayKey];
    if (typeof v === "string" && v.trim() !== "") return v;
  }
  return item.label;
}
