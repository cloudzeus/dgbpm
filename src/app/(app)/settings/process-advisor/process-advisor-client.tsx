"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  Sparkles,
  CheckCircle2,
  ListChecks,
  FormInput,
  ChevronDown,
  Building2,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { fieldTypeLabel } from "@/lib/process-fields/field-types";
import {
  generateBusinessProcesses,
  createProcessTemplatesFromBlueprints,
  type ProcessBlueprint,
} from "../../process-templates/actions";

const EXAMPLES = [
  "Εμπορική επιχείρηση με αποθήκη και e-shop",
  "Λογιστικό γραφείο με πελατολόγιο",
  "Βιοτεχνία παραγωγής με τμήμα ποιότητας",
  "Εταιρία παροχής υπηρεσιών IT",
];

/** Παλέτα χρωμάτων για τις κάρτες προτεινόμενων διαδικασιών (κυκλική ανά κάρτα). */
const CARD_ACCENTS = [
  { bar: "bg-gradient-to-r from-blue-500 to-indigo-500", tint: "bg-blue-500/10 text-blue-600 dark:text-blue-400", selRing: "ring-blue-500/40 border-blue-500", selBg: "bg-blue-500/5" },
  { bar: "bg-gradient-to-r from-emerald-500 to-teal-500", tint: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", selRing: "ring-emerald-500/40 border-emerald-500", selBg: "bg-emerald-500/5" },
  { bar: "bg-gradient-to-r from-amber-500 to-orange-500", tint: "bg-amber-500/10 text-amber-600 dark:text-amber-400", selRing: "ring-amber-500/40 border-amber-500", selBg: "bg-amber-500/5" },
  { bar: "bg-gradient-to-r from-violet-500 to-fuchsia-500", tint: "bg-violet-500/10 text-violet-600 dark:text-violet-400", selRing: "ring-violet-500/40 border-violet-500", selBg: "bg-violet-500/5" },
  { bar: "bg-gradient-to-r from-rose-500 to-pink-500", tint: "bg-rose-500/10 text-rose-600 dark:text-rose-400", selRing: "ring-rose-500/40 border-rose-500", selBg: "bg-rose-500/5" },
  { bar: "bg-gradient-to-r from-cyan-500 to-sky-500", tint: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400", selRing: "ring-cyan-500/40 border-cyan-500", selBg: "bg-cyan-500/5" },
] as const;

export function ProcessAdvisorClient() {
  const [description, setDescription] = useState("");
  const [processes, setProcesses] = useState<ProcessBlueprint[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdCount, setCreatedCount] = useState<number | null>(null);

  const totalSteps = useMemo(
    () => processes.reduce((s, p) => s + p.tasks.length, 0),
    [processes],
  );

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    setCreatedCount(null);
    setProcesses([]);
    setSelected(new Set());
    setExpanded(new Set());
    const res = await generateBusinessProcesses({ description });
    setGenerating(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setProcesses(res.processes);
  }

  function toggle(i: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  function toggleExpand(i: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  const selectAll = () => setSelected(new Set(processes.map((_, i) => i)));
  const clearAll = () => setSelected(new Set());

  async function handleCreate() {
    const chosen = processes.filter((_, i) => selected.has(i));
    if (chosen.length === 0) return;
    setCreating(true);
    setError(null);
    try {
      const res = await createProcessTemplatesFromBlueprints(chosen);
      setCreatedCount(res.created);
      setProcesses([]);
      setSelected(new Set());
      setExpanded(new Set());
      setDescription("");
    } catch {
      setError("Αποτυχία δημιουργίας των προτύπων. Δοκιμάστε ξανά.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6 pb-24">
      {/* ---------- Input panel ---------- */}
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm ring-1 ring-violet-500/5">
        <div className="flex items-start gap-3 border-b border-violet-500/10 bg-gradient-to-r from-violet-500/10 via-indigo-500/10 to-sky-500/10 px-5 py-4">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-sm shadow-violet-500/30">
            <Sparkles className="size-5" />
          </div>
          <div className="min-w-0">
            <h2 className="ui-section-title">Περιγράψτε την επιχείρησή σας</h2>
            <p className="mt-0.5 ui-meta">
              Το AI συνδυάζει την περιγραφή με τους ΚΑΔ της εταιρίας για να προτείνει ένα πλήρες
              σύνολο εσωτερικών διαδικασιών (~20).
            </p>
          </div>
        </div>

        <div className="space-y-4 p-5">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="π.χ. αντικείμενο δραστηριότητας, τμήματα, ροές εργασίας, τι σας απασχολεί οργανωτικά…"
            rows={5}
            disabled={generating}
            className="resize-none text-sm"
          />

          <div className="flex flex-wrap items-center gap-2">
            <span className="ui-meta">Παραδείγματα:</span>
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                disabled={generating}
                onClick={() => setDescription(ex)}
                className="rounded-full border bg-background px-3 py-1 text-xs text-muted-foreground transition hover:border-violet-400/60 hover:bg-violet-500/10 hover:text-violet-700 disabled:opacity-50 dark:hover:text-violet-300"
              >
                {ex}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            <Building2 className="size-3.5 shrink-0" />
            <span>
              Για πιο στοχευμένες προτάσεις, καταχωρήστε ΑΦΜ & ΚΑΔ στο{" "}
              <Link href="/settings/company" className="font-medium text-primary hover:underline">
                Ρυθμίσεις → Εταιρία
              </Link>
              .
            </span>
          </div>

          <div className="flex items-center justify-between gap-3">
            <Button
              onClick={handleGenerate}
              disabled={generating || !description.trim()}
              size="lg"
              className="border-0 bg-gradient-to-r from-violet-600 via-indigo-600 to-sky-500 text-white shadow-md shadow-indigo-500/25 transition-all hover:shadow-lg hover:shadow-indigo-500/40 hover:brightness-110 disabled:opacity-60"
            >
              {generating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              {generating ? "Δημιουργία προτάσεων…" : "Πρόταση διαδικασιών (AI)"}
            </Button>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        </div>
      </div>

      {/* ---------- Success banner ---------- */}
      {createdCount !== null && (
        <div className="flex flex-col gap-3 rounded-xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/15 to-teal-500/10 px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5 text-sm">
            <span className="flex size-8 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm shadow-emerald-500/40">
              <CheckCircle2 className="h-5 w-5" />
            </span>
            <span className="font-medium">Δημιουργήθηκαν {createdCount} πρότυπα διαδικασιών.</span>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/process-templates">Δείτε τα πρότυπα</Link>
          </Button>
        </div>
      )}

      {/* ---------- Loading skeleton ---------- */}
      {generating && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-xl border bg-muted/40" />
          ))}
        </div>
      )}

      {/* ---------- Results ---------- */}
      {!generating && processes.length > 0 && (
        <div className="space-y-4">
          {/* summary toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm ring-1 ring-violet-500/5">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className="font-semibold">
                <span className="bg-gradient-to-r from-violet-600 to-sky-500 bg-clip-text text-transparent">
                  {processes.length}
                </span>{" "}
                προτεινόμενες διαδικασίες
              </span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">{totalSteps} βήματα συνολικά</span>
              {selected.size > 0 && (
                <Badge className="ml-1 border-0 bg-gradient-to-r from-violet-600 to-indigo-600 text-white">
                  {selected.size} επιλεγμένες
                </Badge>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={selectAll}>
                Επιλογή όλων
              </Button>
              <Button variant="ghost" size="sm" onClick={clearAll} disabled={selected.size === 0}>
                Καθαρισμός
              </Button>
            </div>
          </div>

          {/* grid of process cards */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {processes.map((p, i) => {
              const isSel = selected.has(i);
              const isOpen = expanded.has(i);
              const accent = CARD_ACCENTS[i % CARD_ACCENTS.length];
              return (
                <div
                  key={i}
                  className={cn(
                    "flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-all",
                    isSel
                      ? cn("ring-1 shadow-md", accent.selRing, accent.selBg)
                      : "hover:-translate-y-0.5 hover:border-border hover:shadow-md",
                  )}
                >
                  {/* colored accent bar */}
                  <div className={cn("h-1.5 w-full", accent.bar)} />

                  {/* card head */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => toggle(i)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggle(i);
                      }
                    }}
                    className="flex cursor-pointer items-start gap-3 p-4 text-left"
                  >
                    <Checkbox checked={isSel} className="mt-0.5 pointer-events-none" />
                    <div className="min-w-0 flex-1">
                      <h3 className="ui-subsection-title leading-snug">
                        {p.name || "Διαδικασία"}
                      </h3>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <span className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium", accent.tint)}>
                          <ListChecks className="size-3" />
                          {p.tasks.length} βήματα
                        </span>
                        <span className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium", accent.tint)}>
                          <FormInput className="size-3" />
                          {p.fields.length} πεδία
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* explanation — always visible */}
                  {p.description && (
                    <div className="mx-4 mb-3 flex gap-2 rounded-lg bg-muted/40 px-3 py-2">
                      <Info className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                      <p className="ui-meta leading-relaxed">
                        {p.description}
                      </p>
                    </div>
                  )}

                  {/* details toggle */}
                  <div className="mt-auto border-t">
                    <button
                      type="button"
                      onClick={() => toggleExpand(i)}
                      className="flex w-full items-center justify-between px-4 py-2 text-xs font-medium text-muted-foreground transition hover:text-foreground"
                    >
                      Βήματα & πεδία
                      <ChevronDown
                        className={cn("size-4 transition-transform", isOpen && "rotate-180")}
                      />
                    </button>
                    {isOpen && (
                      <div className="space-y-3 px-4 pb-4">
                        <div>
                          <p className="mb-1 ui-eyebrow">
                            Βήματα
                          </p>
                          <ol className="list-decimal space-y-1 pl-4 text-xs">
                            {p.tasks.map((t, ti) => (
                              <li key={ti}>
                                <span className="font-medium">{t.name}</span>
                                {t.mandatory && (
                                  <span className="text-muted-foreground"> — υποχρεωτικό</span>
                                )}
                                {t.needFile && (
                                  <span className="text-muted-foreground"> — απαιτεί αρχείο</span>
                                )}
                              </li>
                            ))}
                          </ol>
                        </div>
                        {p.fields.length > 0 && (
                          <div>
                            <p className="mb-1 ui-eyebrow">
                              Πεδία
                            </p>
                            <ul className="space-y-1 text-xs">
                              {p.fields.map((f, fi) => (
                                <li key={fi}>
                                  <span className="font-medium">{f.name}</span>
                                  <span className="text-muted-foreground">
                                    {" — "}
                                    {fieldTypeLabel(f.type)}
                                    {" · βήμα "}
                                    {(f.captureTaskOrder ?? 0) + 1}
                                    {f.required ? " · υποχρ." : ""}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ---------- Sticky action bar ---------- */}
      {!generating && processes.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/70">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
            <p className="text-sm text-muted-foreground">
              {selected.size > 0
                ? `${selected.size} διαδικασίες θα δημιουργηθούν ως πρότυπα`
                : "Επιλέξτε διαδικασίες για δημιουργία"}
            </p>
            <Button
              onClick={handleCreate}
              disabled={creating || selected.size === 0}
              size="lg"
              className="border-0 bg-gradient-to-r from-emerald-600 to-teal-500 text-white shadow-md shadow-emerald-500/25 transition-all hover:shadow-lg hover:shadow-emerald-500/40 hover:brightness-110 disabled:opacity-60"
            >
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Δημιουργία επιλεγμένων ({selected.size})
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
