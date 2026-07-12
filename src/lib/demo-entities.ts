/**
 * Demo οντότητες — ελληνικά fixtures ανά EntityKind για το Data Migration demo.
 * Καθαρά δεδομένα (κανένα I/O)· ο caller κάνει τα Prisma writes.
 * Τα products αναφέρονται σε category/color/size με CODE ώστε ο δημιουργός
 * να επιλύει τα FKs από τις μόλις-δημιουργημένες (ή υπάρχουσες) γραμμές.
 */

export type DemoEntityRecord = {
  code: string;
  name: string;
  afm?: string;
  city?: string;
  priceWholesale?: number;
  priceRetail?: number;
  categoryCode?: string;
  colorCode?: string;
  sizeCode?: string;
};

export const DEMO_ENTITIES: Record<string, DemoEntityRecord[]> = {
  SUPPLIER: [
    { code: "SUP-001", name: "Αφοί Παπαδόπουλοι ΟΕ", afm: "094321657", city: "Αθήνα" },
    { code: "SUP-002", name: "Υφάσματα Κρήτης ΑΕ", afm: "998745123", city: "Ηράκλειο" },
    { code: "SUP-003", name: "Ελληνικά Νήματα ΕΠΕ", afm: "094876321", city: "Θεσσαλονίκη" },
    { code: "SUP-004", name: "Κλωστοϋφαντουργία Βόλου ΑΕ", afm: "099812456", city: "Βόλος" },
    { code: "SUP-005", name: "Δέρματα Χανίων ΙΚΕ", afm: "800654987", city: "Χανιά" },
    { code: "SUP-006", name: "Εισαγωγική Πειραιώς ΑΕ", afm: "094112233", city: "Πειραιάς" },
    { code: "SUP-007", name: "Κουμπιά & Φερμουάρ Γεωργίου", afm: "045678912", city: "Λάρισα" },
    { code: "SUP-008", name: "Συσκευασίες Πάτρας ΜΕΠΕ", afm: "801234765", city: "Πάτρα" },
  ],
  CUSTOMER: [
    { code: "CUS-001", name: "Μόδα Κεντρικής ΑΕ", afm: "094556677", city: "Αθήνα" },
    { code: "CUS-002", name: "Boutique Ελένη", afm: "045112398", city: "Θεσσαλονίκη" },
    { code: "CUS-003", name: "Ενδύματα Νότου ΕΠΕ", afm: "099887744", city: "Καλαμάτα" },
    { code: "CUS-004", name: "Παιδικά Χαμόγελο", afm: "046778812", city: "Πάτρα" },
    { code: "CUS-005", name: "Κατάστημα Ιωάννου & ΣΙΑ ΟΕ", afm: "094223311", city: "Ιωάννινα" },
    { code: "CUS-006", name: "Fashion Point ΙΚΕ", afm: "800998877", city: "Αθήνα" },
    { code: "CUS-007", name: "Ανδρικά Δημητρίου", afm: "047665544", city: "Ηράκλειο" },
    { code: "CUS-008", name: "Στυλ & Χρώμα ΑΕ", afm: "094778855", city: "Λάρισα" },
    { code: "CUS-009", name: "Εμπορία Ενδυμάτων Ρόδου ΕΕ", afm: "801556644", city: "Ρόδος" },
    { code: "CUS-010", name: "Νεανική Μόδα Καβάλας", afm: "048332211", city: "Καβάλα" },
    { code: "CUS-011", name: "Οίκος Μόδας Αργυρίου", afm: "094665522", city: "Βόλος" },
    { code: "CUS-012", name: "Πολυκατάστημα Ερμής ΑΕ", afm: "099445566", city: "Χαλκίδα" },
  ],
  PRODUCT_CATEGORY: [
    { code: "CAT-01", name: "Μπλούζες" },
    { code: "CAT-02", name: "Παντελόνια" },
    { code: "CAT-03", name: "Φορέματα" },
    { code: "CAT-04", name: "Πουκάμισα" },
    { code: "CAT-05", name: "Μπουφάν" },
    { code: "CAT-06", name: "Αξεσουάρ" },
  ],
  COLOR: [
    { code: "COL-01", name: "Κόκκινο" },
    { code: "COL-02", name: "Μπλε" },
    { code: "COL-03", name: "Μαύρο" },
    { code: "COL-04", name: "Λευκό" },
    { code: "COL-05", name: "Πράσινο" },
    { code: "COL-06", name: "Γκρι" },
    { code: "COL-07", name: "Μπεζ" },
    { code: "COL-08", name: "Ναυτικό Μπλε" },
  ],
  SIZE: [
    { code: "SIZ-01", name: "XS" },
    { code: "SIZ-02", name: "S" },
    { code: "SIZ-03", name: "M" },
    { code: "SIZ-04", name: "L" },
    { code: "SIZ-05", name: "XL" },
    { code: "SIZ-06", name: "XXL" },
    { code: "SIZ-07", name: "38" },
    { code: "SIZ-08", name: "40" },
  ],
  PRODUCT: [
    { code: "PRD-001", name: "Μπλούζα Βαμβακερή Basic", priceWholesale: 6.5, priceRetail: 14.9, categoryCode: "CAT-01", colorCode: "COL-04", sizeCode: "SIZ-03" },
    { code: "PRD-002", name: "Μπλούζα Ριγέ Μακρυμάνικη", priceWholesale: 8.2, priceRetail: 19.9, categoryCode: "CAT-01", colorCode: "COL-02", sizeCode: "SIZ-04" },
    { code: "PRD-003", name: "Παντελόνι Τζιν Slim", priceWholesale: 18.5, priceRetail: 44.9, categoryCode: "CAT-02", colorCode: "COL-08", sizeCode: "SIZ-07" },
    { code: "PRD-004", name: "Παντελόνι Υφασμάτινο Chino", priceWholesale: 15.0, priceRetail: 39.9, categoryCode: "CAT-02", colorCode: "COL-07", sizeCode: "SIZ-08" },
    { code: "PRD-005", name: "Φόρεμα Μίντι Φλοράλ", priceWholesale: 22.0, priceRetail: 54.9, categoryCode: "CAT-03", colorCode: "COL-01", sizeCode: "SIZ-02" },
    { code: "PRD-006", name: "Φόρεμα Βραδινό Σατέν", priceWholesale: 34.0, priceRetail: 89.9, categoryCode: "CAT-03", colorCode: "COL-03", sizeCode: "SIZ-03" },
    { code: "PRD-007", name: "Πουκάμισο Λινό Ανδρικό", priceWholesale: 16.8, priceRetail: 42.9, categoryCode: "CAT-04", colorCode: "COL-04", sizeCode: "SIZ-05" },
    { code: "PRD-008", name: "Πουκάμισο Καρό Casual", priceWholesale: 13.5, priceRetail: 34.9, categoryCode: "CAT-04", colorCode: "COL-05", sizeCode: "SIZ-04" },
    { code: "PRD-009", name: "Μπουφάν Δερμάτινο Biker", priceWholesale: 58.0, priceRetail: 149.0, categoryCode: "CAT-05", colorCode: "COL-03", sizeCode: "SIZ-04" },
    { code: "PRD-010", name: "Μπουφάν Puffer Χειμερινό", priceWholesale: 32.0, priceRetail: 79.9, categoryCode: "CAT-05", colorCode: "COL-06", sizeCode: "SIZ-05" },
    { code: "PRD-011", name: "Ζώνη Δερμάτινη Κλασική", priceWholesale: 7.5, priceRetail: 19.9, categoryCode: "CAT-06", colorCode: "COL-03", sizeCode: "SIZ-04" },
    { code: "PRD-012", name: "Κασκόλ Μάλλινο", priceWholesale: 5.8, priceRetail: 15.9, categoryCode: "CAT-06", colorCode: "COL-06", sizeCode: "SIZ-03" },
    { code: "PRD-013", name: "Μπλούζα Polo Πικέ", priceWholesale: 9.9, priceRetail: 24.9, categoryCode: "CAT-01", colorCode: "COL-05", sizeCode: "SIZ-06" },
    { code: "PRD-014", name: "Παντελόνι Φόρμας Jogger", priceWholesale: 11.2, priceRetail: 29.9, categoryCode: "CAT-02", colorCode: "COL-06", sizeCode: "SIZ-01" },
    { code: "PRD-015", name: "Φόρεμα Πλεκτό Χειμωνιάτικο", priceWholesale: 19.5, priceRetail: 49.9, categoryCode: "CAT-03", colorCode: "COL-07", sizeCode: "SIZ-02" },
  ],
};
