/**
 * SLA / καθυστερήσεις — κοινή λογική.
 *
 * Μια ενεργή εργασία θεωρείται καθυστερημένη όταν έχει περάσει ο διαθέσιμος χρόνος της:
 *   - Αν το βήμα του προτύπου έχει `slaDays`, χρησιμοποιείται αυτό.
 *   - Αλλιώς πέφτει πίσω στο καθολικό όριο `DEFAULT_SLA_DAYS`.
 * Το ρολόι μετράει από `startedAt` (αν έχει ξεκινήσει) αλλιώς από την έναρξη της διαδικασίας.
 */

export const DEFAULT_SLA_DAYS = Number(process.env.DEFAULT_SLA_DAYS ?? 3);

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** Effective SLA (μέρες) για ένα βήμα: το δικό του ή το καθολικό fallback. */
export function effectiveSlaDays(slaDays: number | null | undefined): number {
  return slaDays != null && slaDays > 0 ? slaDays : DEFAULT_SLA_DAYS;
}

export type DelayInfo = {
  /** Πόσες μέρες τρέχει η εργασία (ακέραιο, προς τα κάτω). */
  ageDays: number;
  /** Προθεσμία (Date) — πότε έπρεπε να έχει ολοκληρωθεί. */
  dueAt: Date;
  /** Μέρες πέρα από την προθεσμία (>0 = καθυστερημένη). */
  overdueDays: number;
  isOverdue: boolean;
  /** true αν πλησιάζει την προθεσμία (>=75% του χρόνου) χωρίς να την έχει ξεπεράσει. */
  isAtRisk: boolean;
};

/** Υπολογισμός κατάστασης καθυστέρησης ενεργής εργασίας. */
export function computeDelay(
  clockStart: Date,
  slaDays: number | null | undefined,
  now: Date,
): DelayInfo {
  const sla = effectiveSlaDays(slaDays);
  const dueAt = new Date(clockStart.getTime() + sla * MS_PER_DAY);
  const ageMs = now.getTime() - clockStart.getTime();
  const overdueMs = now.getTime() - dueAt.getTime();
  const ageDays = Math.floor(ageMs / MS_PER_DAY);
  const overdueDays = Math.floor(overdueMs / MS_PER_DAY);
  const isOverdue = overdueMs > 0;
  const isAtRisk = !isOverdue && ageMs >= sla * MS_PER_DAY * 0.75;
  return { ageDays, dueAt, overdueDays: Math.max(0, overdueDays), isOverdue, isAtRisk };
}

/** Ημέρες μεταξύ δύο ημερομηνιών (float). */
export function daysBetween(a: Date, b: Date): number {
  return Math.abs(b.getTime() - a.getTime()) / MS_PER_DAY;
}
