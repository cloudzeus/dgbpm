/**
 * Server-side client for https://vat.wwa.gr/afm2info — λήψη επίσημων στοιχείων
 * εταιρίας (ΑΑΔΕ) από ΑΦΜ, μαζί με τους ΚΑΔ (δραστηριότητες).
 */

const VAT_WWA_URL = "https://vat.wwa.gr/afm2info";

/** Κανονικοποιημένο αποτέλεσμα για χρήση στη φόρμα / DB. */
export type VatCompanyData = {
  afm: string;
  name: string | null; // Επωνυμία
  commercialTitle: string | null; // Διακριτικός τίτλος
  legalStatus: string | null; // Νομική μορφή
  taxOffice: string | null; // ΔΟΥ
  address: string | null; // Οδός + αριθμός
  city: string | null;
  zip: string | null;
  country: string;
  registDate: string | null;
  isActive: boolean;
  activities: Array<{
    code: string; // ΚΑΔ
    description: string | null;
    kind: string | null; // ΚΥΡΙΑ / ΔΕΥΤΕΡΕΥΟΥΣΑ κλπ.
    isPrimary: boolean;
  }>;
};

/** Επιστρέφει καθαρό string ή null από πιθανώς object/άδεια τιμή. */
function str(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (typeof v === "object") {
    const s =
      (v as Record<string, unknown>)["$t"] ??
      (v as Record<string, unknown>).value ??
      (v as Record<string, unknown>).text ??
      "";
    const t = String(s).trim();
    return t === "" ? null : t;
  }
  const t = String(v).trim();
  return t === "" || t === "[object Object]" ? null : t;
}

export type VatLookupResult =
  | { ok: true; data: VatCompanyData }
  | { ok: false; error: string; status: number };

/**
 * Λήψη στοιχείων εταιρίας από ΑΦΜ. Server-side only.
 */
export async function fetchVatCompany(afmRaw: string): Promise<VatLookupResult> {
  const afm = afmRaw?.trim();
  if (!afm || !/^\d{9}$/.test(afm)) {
    return { ok: false, error: "Μη έγκυρο ΑΦΜ (9 ψηφία)", status: 400 };
  }

  let data: Record<string, unknown> & { error?: string };
  try {
    const res = await fetch(VAT_WWA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ afm }),
      cache: "no-store",
    });
    if (!res.ok) {
      return { ok: false, error: "Αποτυχία σύνδεσης με την υπηρεσία ΑΑΔΕ", status: 502 };
    }
    data = await res.json();
  } catch {
    return { ok: false, error: "Αποτυχία σύνδεσης με την υπηρεσία ΑΑΔΕ", status: 502 };
  }

  if (data.error) {
    return { ok: false, error: String(data.error), status: 404 };
  }

  const r = data.basic_rec as Record<string, unknown> | undefined;
  if (!r) {
    return { ok: false, error: "Το ΑΦΜ δεν βρέθηκε", status: 404 };
  }

  const address = [str(r.postal_address), str(r.postal_address_no)]
    .filter(Boolean)
    .join(" ")
    .trim();

  const rawItems = (data.firm_act_tab as Record<string, unknown> | undefined)?.item;
  const itemArray = Array.isArray(rawItems)
    ? rawItems
    : rawItems != null && typeof rawItems === "object"
      ? [rawItems]
      : [];

  const activities = (itemArray as Array<Record<string, unknown>>).map((a) => ({
    code: str(a.firm_act_code) ?? "",
    description: str(a.firm_act_descr),
    kind: str(a.firm_act_kind_descr),
    isPrimary: String(a.firm_act_kind ?? "").trim() === "1",
  }));

  return {
    ok: true,
    data: {
      afm,
      name: str(r.onomasia),
      commercialTitle: str(r.commer_title),
      legalStatus: str(r.legal_status_descr),
      taxOffice: str(r.doy_descr),
      address: address || null,
      city: str(r.postal_area_description),
      zip: str(r.postal_zip_code),
      country: "Ελλάδα",
      registDate: str(r.regist_date),
      // deactivation_flag === "1" σημαίνει ΑΝΕΝΕΡΓΗ
      isActive: String(r.deactivation_flag ?? "").trim() !== "1",
      activities,
    },
  };
}
