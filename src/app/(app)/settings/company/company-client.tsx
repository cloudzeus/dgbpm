"use client";

import { useState, useTransition } from "react";
import { FiDownloadCloud, FiSave, FiTrash2, FiLoader } from "react-icons/fi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { saveCompany, type CompanyInput } from "./actions";

type Activity = {
  code: string;
  description: string | null;
  kind: string | null;
  isPrimary: boolean;
};

type CompanyData = {
  afm: string | null;
  name: string | null;
  commercialTitle: string | null;
  legalStatus: string | null;
  taxOffice: string | null;
  gemi: string | null;
  address: string | null;
  city: string | null;
  zip: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  registDate: string | null;
  isActive: boolean;
  activities: Activity[];
} | null;

type FormState = Omit<NonNullable<CompanyData>, "activities">;

const emptyForm: FormState = {
  afm: "",
  name: "",
  commercialTitle: "",
  legalStatus: "",
  taxOffice: "",
  gemi: "",
  address: "",
  city: "",
  zip: "",
  country: "Ελλάδα",
  phone: "",
  email: "",
  website: "",
  registDate: "",
  isActive: true,
};

export function CompanyClient({ company }: { company: CompanyData }) {
  const [form, setForm] = useState<FormState>(() => ({
    ...emptyForm,
    ...(company
      ? Object.fromEntries(
          Object.entries(company).filter(([k]) => k !== "activities"),
        )
      : {}),
  }) as FormState);
  const [activities, setActivities] = useState<Activity[]>(company?.activities ?? []);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [isSaving, startSaving] = useTransition();

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleLookup() {
    setMsg(null);
    const afm = (form.afm ?? "").trim();
    if (!/^\d{9}$/.test(afm)) {
      setMsg({ type: "err", text: "Συμπληρώστε έγκυρο ΑΦΜ (9 ψηφία)." });
      return;
    }
    setLookupLoading(true);
    try {
      const res = await fetch("/api/company/vat-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ afm }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ type: "err", text: data.error || "Αποτυχία λήψης στοιχείων." });
        return;
      }
      setForm((f) => ({
        ...f,
        afm: data.afm ?? f.afm,
        name: data.name ?? "",
        commercialTitle: data.commercialTitle ?? "",
        legalStatus: data.legalStatus ?? "",
        taxOffice: data.taxOffice ?? "",
        address: data.address ?? "",
        city: data.city ?? "",
        zip: data.zip ?? "",
        country: data.country ?? "Ελλάδα",
        registDate: data.registDate ?? "",
        isActive: data.isActive ?? true,
      }));
      setActivities(data.activities ?? []);
      setMsg({
        type: "ok",
        text: `Λήφθηκαν τα στοιχεία από ΑΑΔΕ (${data.activities?.length ?? 0} ΚΑΔ). Πατήστε Αποθήκευση για να καταχωρηθούν.`,
      });
    } catch {
      setMsg({ type: "err", text: "Σφάλμα σύνδεσης με την υπηρεσία." });
    } finally {
      setLookupLoading(false);
    }
  }

  function handleSave() {
    setMsg(null);
    startSaving(async () => {
      try {
        const payload: CompanyInput = { ...form, activities };
        await saveCompany(payload);
        setMsg({ type: "ok", text: "Τα στοιχεία της εταιρίας αποθηκεύτηκαν." });
      } catch (e) {
        setMsg({
          type: "err",
          text: e instanceof Error ? e.message : "Αποτυχία αποθήκευσης.",
        });
      }
    });
  }

  const field = (
    key: keyof FormState,
    label: string,
    opts?: { type?: string; placeholder?: string },
  ) => (
    <div className="space-y-1.5">
      <Label htmlFor={key}>{label}</Label>
      <Input
        id={key}
        type={opts?.type ?? "text"}
        placeholder={opts?.placeholder}
        value={(form[key] as string) ?? ""}
        onChange={(e) => set(key, e.target.value as FormState[typeof key])}
      />
    </div>
  );

  return (
    <div className="space-y-6">
      {msg && (
        <div
          className={`rounded-md border px-4 py-3 text-sm ${
            msg.type === "ok"
              ? "border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-400"
              : "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-400"
          }`}
        >
          {msg.text}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Λήψη στοιχείων από ΑΑΔΕ</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="afm">ΑΦΜ</Label>
              <Input
                id="afm"
                inputMode="numeric"
                placeholder="π.χ. 094014201"
                value={form.afm ?? ""}
                onChange={(e) => set("afm", e.target.value.replace(/\D/g, "").slice(0, 9))}
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={handleLookup}
              disabled={lookupLoading}
            >
              {lookupLoading ? (
                <FiLoader className="size-4 animate-spin" />
              ) : (
                <FiDownloadCloud className="size-4" />
              )}
              Λήψη από ΑΑΔΕ
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Στοιχεία εταιρίας</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {field("name", "Επωνυμία")}
          {field("commercialTitle", "Διακριτικός τίτλος")}
          {field("legalStatus", "Νομική μορφή")}
          {field("taxOffice", "ΔΟΥ")}
          {field("gemi", "Αριθμός ΓΕΜΗ")}
          {field("registDate", "Ημ/νία έναρξης")}
          <div className="sm:col-span-2">
            <Separator />
          </div>
          {field("address", "Διεύθυνση")}
          {field("city", "Πόλη")}
          {field("zip", "Τ.Κ.")}
          {field("country", "Χώρα")}
          <div className="sm:col-span-2">
            <Separator />
          </div>
          {field("phone", "Τηλέφωνο")}
          {field("email", "Email", { type: "email" })}
          {field("website", "Ιστότοπος", { placeholder: "https://" })}
          <div className="flex items-center gap-2 pt-6">
            <input
              id="isActive"
              type="checkbox"
              className="size-4 accent-[#0c0ce5]"
              checked={form.isActive}
              onChange={(e) => set("isActive", e.target.checked)}
            />
            <Label htmlFor="isActive" className="cursor-pointer">
              Ενεργή στην ΑΑΔΕ
            </Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Δραστηριότητες (ΚΑΔ)
            <Badge variant="secondary">{activities.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activities.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Δεν υπάρχουν καταχωρημένοι ΚΑΔ. Χρησιμοποιήστε τη «Λήψη από ΑΑΔΕ».
            </p>
          ) : (
            <ul className="divide-y">
              {activities.map((a, i) => (
                <li key={`${a.code}-${i}`} className="flex items-start gap-3 py-2.5">
                  <span className="font-mono text-sm font-medium">{a.code}</span>
                  <div className="flex-1">
                    <p className="ui-body">{a.description}</p>
                    {a.kind && (
                      <p className="ui-meta">{a.kind}</p>
                    )}
                  </div>
                  {a.isPrimary && <Badge>Κύρια</Badge>}
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-red-600"
                    onClick={() =>
                      setActivities((list) => list.filter((_, idx) => idx !== i))
                    }
                    aria-label="Διαγραφή ΚΑΔ"
                  >
                    <FiTrash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="button" onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <FiLoader className="size-4 animate-spin" />
          ) : (
            <FiSave className="size-4" />
          )}
          Αποθήκευση
        </Button>
      </div>
    </div>
  );
}
