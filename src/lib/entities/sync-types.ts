/**
 * Κοινοί τύποι συγχρονισμού οντοτήτων + καθαρός (pure) planner για upserts.
 * Καμία πρόσβαση σε δίκτυο/DB εδώ — πλήρως unit-testable.
 */

export type SyncRow = {
  /** Το κλειδί της εγγραφής στο εξωτερικό σύστημα (TRDR/MTRL/Woo id κλπ.), ως string. */
  externalId: string;
  code: string;
  name: string;
  /** Επιπλέον πεδία (afm, address, priceRetail κλπ.) — περνούν ως έχουν στο write. */
  extra?: Record<string, unknown>;
  isActive?: boolean;
};

export type ExistingEntity = {
  id: string;
  code: string;
  /** Η αποθηκευμένη τιμή της στήλης αναφοράς της πηγής (softoneKey/wooId), αν υπάρχει. */
  extId: string | null;
};

export type UpsertPlan = {
  toCreate: SyncRow[];
  toUpdate: { id: string; row: SyncRow }[];
};

/**
 * Σχεδιάζει create/update με προτεραιότητα:
 * 1) ταίριασμα extId === externalId, 2) ταίριασμα code (case-insensitive), 3) create.
 * Διπλότυπα στα incoming (ίδιο externalId) απαλείφονται κρατώντας το τελευταίο.
 */
export function planUpserts(existing: ExistingEntity[], incoming: SyncRow[]): UpsertPlan {
  const byExternalId = new Map<string, SyncRow>();
  for (const row of incoming) byExternalId.set(row.externalId, row);

  const byExtId = new Map<string, ExistingEntity>();
  const byCode = new Map<string, ExistingEntity>();
  for (const e of existing) {
    if (e.extId != null && e.extId !== "") byExtId.set(e.extId, e);
    if (!byCode.has(e.code.toLowerCase())) byCode.set(e.code.toLowerCase(), e);
  }

  const toCreate: SyncRow[] = [];
  const toUpdate: { id: string; row: SyncRow }[] = [];
  const claimed = new Set<string>(); // ids που ήδη δεσμεύτηκαν από κάποιο incoming row

  for (const row of byExternalId.values()) {
    const match = byExtId.get(row.externalId) ?? byCode.get(row.code.toLowerCase());
    if (match && !claimed.has(match.id)) {
      claimed.add(match.id);
      toUpdate.push({ id: match.id, row });
    } else {
      toCreate.push(row);
    }
  }

  return { toCreate, toUpdate };
}
