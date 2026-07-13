/**
 * Pure λογική σχεδιασμού εισαγωγής λίστας τιμών από Excel:
 * ταίριασμα γονέων με κωδικό ή/και όνομα (case/accent-insensitive),
 * ομαδοποίηση αγνώστων γονέων, προαιρετική αυτόματη δημιουργία ριζών,
 * ανίχνευση κύκλων. Χωρίς I/O ώστε να τρέχει και σε client.
 */
import { detectCycles, treeOrder } from "@/lib/entities/tree";

export type LookupImportRow = { value: string; label: string; parent: string | null };

export type ExistingLookupItem = {
  id: string;
  value: string;
  label: string;
  parentId: string | null;
};

export type ParentMatchMode = "auto" | "value" | "label";

export type PlannedItem = {
  value: string;
  label: string;
  /** value του γονέα στο τελικό σύνολο, ή null (ρίζα). */
  parentRef: string | null;
  isNew: boolean;
};

export type LookupImportPlan = {
  items: PlannedItem[];
  stats: { total: number; created: number; updated: number; roots: number; depth: number };
  /** Διακριτά ονόματα γονέων που δεν βρέθηκαν → πλήθος γραμμών. */
  unresolved: { name: string; count: number }[];
  /** values γραμμών που συμμετείχαν σε κύκλο και εισάγονται χωρίς γονέα. */
  cycles: string[];
};

/** "", "-", "—", "–" (και συνδυασμοί τους) = χωρίς γονέα. */
const NO_PARENT_RE = /^[-—–\s]*$/;

/** lowercase, χωρίς τόνους, τελικό ς→σ, ενιαία κενά. */
export function normalizeText(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/ς/g, "σ")
    .replace(/\s+/g, " ")
    .trim();
}

/** slug από ετικέτα: normalized, μη αλφαριθμητικά → «-». */
export function slugify(s: string): string {
  return normalizeText(s)
    .replace(/[^a-z0-9α-ω]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function planLookupImport(input: {
  rows: LookupImportRow[];
  existing: ExistingLookupItem[];
  parentMatch: ParentMatchMode;
  createMissingParents: boolean;
}): LookupImportPlan {
  const { rows, existing, parentMatch, createMissingParents } = input;

  // 1) Deduplicate γραμμών αρχείου κατά value (η τελευταία κερδίζει, σειρά της πρώτης).
  const fileByValue = new Map<string, LookupImportRow>();
  for (const raw of rows) {
    const value = raw.value.trim();
    if (!value) continue;
    const prev = fileByValue.get(value);
    if (prev) {
      prev.label = raw.label.trim() || value;
      prev.parent = raw.parent;
    } else {
      fileByValue.set(value, {
        value,
        label: raw.label.trim() || value,
        parent: raw.parent,
      });
    }
  }

  // 2) Τελικό σύνολο: υπάρχοντα (με τον τρέχοντα γονέα τους) + γραμμές αρχείου.
  const existingValueById = new Map(existing.map((e) => [e.id, e.value]));
  const items = new Map<string, PlannedItem>();
  for (const e of existing) {
    items.set(e.value, {
      value: e.value,
      label: e.label,
      parentRef: e.parentId ? existingValueById.get(e.parentId) ?? null : null,
      isNew: false,
    });
  }
  let updated = 0;
  for (const row of fileByValue.values()) {
    const found = items.get(row.value);
    if (found) {
      found.label = row.label;
      updated++;
    } else {
      items.set(row.value, { value: row.value, label: row.label, parentRef: null, isNew: true });
    }
  }

  // 3) Ευρετήρια ταιριάσματος γονέα πάνω στο τελικό σύνολο.
  const byNormValue = new Map<string, string>();
  const byNormLabel = new Map<string, string>();
  const bySlugLabel = new Map<string, string>();
  for (const it of items.values()) {
    const nv = normalizeText(it.value);
    if (nv && !byNormValue.has(nv)) byNormValue.set(nv, it.value);
    const nl = normalizeText(it.label);
    if (nl && !byNormLabel.has(nl)) byNormLabel.set(nl, it.value);
    const sl = slugify(it.label);
    if (sl && !bySlugLabel.has(sl)) bySlugLabel.set(sl, it.value);
  }

  const resolveParent = (raw: string): string | null => {
    const norm = normalizeText(raw);
    if (parentMatch === "value" || parentMatch === "auto") {
      const hit = byNormValue.get(norm);
      if (hit !== undefined) return hit;
      if (parentMatch === "value") return null;
    }
    return byNormLabel.get(norm) ?? bySlugLabel.get(slugify(raw)) ?? null;
  };

  // 4) Ανάλυση γονέων ανά γραμμή αρχείου· ομαδοποίηση αγνώστων.
  const unresolvedCounts = new Map<string, number>();
  const unresolvedChildren = new Map<string, string[]>(); // parent name → child values
  for (const row of fileByValue.values()) {
    const rawParent = (row.parent ?? "").trim();
    if (NO_PARENT_RE.test(rawParent)) continue;
    const resolved = resolveParent(rawParent);
    const item = items.get(row.value)!;
    if (resolved !== null) {
      item.parentRef = resolved;
    } else {
      unresolvedCounts.set(rawParent, (unresolvedCounts.get(rawParent) ?? 0) + 1);
      const kids = unresolvedChildren.get(rawParent) ?? [];
      kids.push(row.value);
      unresolvedChildren.set(rawParent, kids);
    }
  }

  // 5) Προαιρετική δημιουργία γονέων που λείπουν ως νέες ρίζες.
  if (createMissingParents) {
    const usedValues = new Set(items.keys());
    let nextNumeric =
      Math.max(0, ...[...usedValues].map((v) => (/^\d+$/.test(v) ? Number(v) : 0))) + 1;
    for (const [name, children] of unresolvedChildren) {
      let value = slugify(name);
      if (!value) value = String(nextNumeric++);
      let candidate = value;
      let n = 2;
      while (usedValues.has(candidate)) candidate = `${value}-${n++}`;
      usedValues.add(candidate);
      items.set(candidate, { value: candidate, label: name, parentRef: null, isNew: true });
      for (const child of children) {
        const it = items.get(child);
        if (it) it.parentRef = candidate;
      }
    }
  }

  // 6) Κύκλοι (συμπερ. self-parent) → αποσύνδεση + αναφορά.
  const all = [...items.values()];
  const nodes = all.map((i) => ({
    id: i.value,
    parentId: i.parentRef !== null && items.has(i.parentRef) ? i.parentRef : null,
  }));
  const cycles = detectCycles(nodes);
  const cycleSet = new Set(cycles);
  for (const it of all) {
    if (cycleSet.has(it.value)) it.parentRef = null;
    else if (it.parentRef !== null && !items.has(it.parentRef)) it.parentRef = null;
  }

  // 7) Στατιστικά.
  const ordered = treeOrder(all.map((i) => ({ id: i.value, parentId: i.parentRef })));
  const depth = ordered.length === 0 ? 0 : Math.max(...ordered.map((o) => o.depth)) + 1;

  return {
    items: all,
    stats: {
      total: rows.length,
      created: all.filter((i) => i.isNew).length,
      updated,
      roots: all.filter((i) => i.parentRef === null).length,
      depth,
    },
    unresolved: [...unresolvedCounts.entries()].map(([name, count]) => ({ name, count })),
    cycles,
  };
}

// ---------------------------------------------------------------------------
// Αυτόματη πρόταση αντιστοίχισης στηλών για λίστες τιμών.

export type LookupColumnMapping = { value?: string; label?: string; parent?: string };

const SYNONYMS: Record<keyof LookupColumnMapping, string[]> = {
  value: ["value", "τιμη", "κωδικοσ", "code", "sku", "id", "key"],
  label: ["label", "ετικετα", "ονομα", "ονομασια", "name", "περιγραφη", "τιτλοσ", "title"],
  parent: [
    "γονικοσ κωδικοσ",
    "γονικη κατηγορια",
    "γονικοσ",
    "γονεασ",
    "parent",
    "parent code",
    "κατηγορια γονεα",
  ],
};

/** Πρόταση mapping στηλών: value/label/parent, case/accent-insensitive, κάθε header μία φορά. */
export function suggestLookupMapping(headers: string[]): LookupColumnMapping {
  const normalized = headers.map((h) => normalizeText(h));
  const used = new Set<number>();
  const mapping: LookupColumnMapping = {};

  for (const key of ["value", "label", "parent"] as const) {
    let matchIdx = -1;
    for (const exact of [true, false]) {
      for (let i = 0; i < normalized.length && matchIdx === -1; i++) {
        if (used.has(i) || normalized[i] === "") continue;
        const h = normalized[i];
        const hit = SYNONYMS[key].some((c) =>
          exact ? h === c : h.includes(c) || (c.length >= 3 && h.length >= 3 && c.includes(h))
        );
        if (hit) matchIdx = i;
      }
      if (matchIdx !== -1) break;
    }
    if (matchIdx !== -1) {
      used.add(matchIdx);
      mapping[key] = headers[matchIdx];
    }
  }

  // Fallbacks: πρώτη μη κενή στήλη ως value· label = value αν δεν βρέθηκε άλλη.
  if (!mapping.value) {
    const idx = headers.findIndex((h, i) => h.trim() !== "" && !used.has(i));
    if (idx !== -1) mapping.value = headers[idx];
  }
  if (!mapping.label && mapping.value) mapping.label = mapping.value;

  return mapping;
}
