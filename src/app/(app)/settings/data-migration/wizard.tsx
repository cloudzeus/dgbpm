"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FiLoader,
  FiZap,
  FiTrash2,
  FiCheckCircle,
  FiAlertTriangle,
  FiArrowLeft,
  FiArrowRight,
  FiExternalLink,
} from "react-icons/fi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { MigrationOverview } from "./actions";
import { generateDemoInstances, deleteDemoData } from "./actions";
import {
  generateBusinessProcesses,
  createProcessTemplatesFromBlueprints,
  type ProcessBlueprint,
} from "@/app/(app)/process-templates/actions";

type Step = 1 | 2 | 3 | 4;
type Msg = { type: "ok" | "err"; text: string } | null;

const STEPS: { n: Step; label: string }[] = [
  { n: 1, label: "Επισκόπηση" },
  { n: 2, label: "AI Διαδικασίες" },
  { n: 3, label: "Παράμετροι" },
  { n: 4, label: "Δημιουργία" },
];

function MsgBanner({ msg }: { msg: Msg }) {
  if (!msg) return null;
  return (
    <div
      className={`rounded-md border px-4 py-3 text-sm ${
        msg.type === "ok"
          ? "border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-400"
          : "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-400"
      }`}
    >
      {msg.text}
    </div>
  );
}

function CountCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-card px-4 py-3">
      <div className="ui-metric">{value}</div>
      <div className="ui-meta">{label}</div>
    </div>
  );
}

export function DataMigrationWizard({ overview }: { overview: MigrationOverview }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<Msg>(null);

  // Βήμα 2 state
  const [description, setDescription] = useState("");
  const [proposals, setProposals] = useState<ProcessBlueprint[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [aiFormOpen, setAiFormOpen] = useState(false);
  const [createdTemplates, setCreatedTemplates] = useState(0);

  // Βήμα 3 state
  const today = new Date().toISOString().slice(0, 10);
  const sixMonthsAgo = new Date(Date.now() - 182 * 86_400_000).toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(sixMonthsAgo);
  const [endDate, setEndDate] = useState(today);
  const [count, setCount] = useState(150);
  const [completedPct, setCompletedPct] = useState(65);

  // Βήμα 4 state
  const [result, setResult] = useState<null | {
    instances: number;
    tasks: number;
    actions: number;
    fieldValues: number;
    entitiesCreated: number;
  }>(null);

  const blocked =
    !overview.users.some((u) => u.positions.length > 0) || overview.departments.length === 0;
  const hasTemplates = overview.templates.length > 0;
  const usableTemplates = hasTemplates || createdTemplates > 0;

  const paramsValid =
    Boolean(startDate) &&
    Boolean(endDate) &&
    startDate < endDate &&
    endDate <= today &&
    Number.isFinite(count) &&
    count >= 1 &&
    count <= 1000 &&
    completedPct >= 0 &&
    completedPct <= 100;

  function goTo(next: Step) {
    setMsg(null);
    setStep(next);
  }

  function handlePropose() {
    setMsg(null);
    startTransition(async () => {
      const r = await generateBusinessProcesses({ description });
      if (r.ok) {
        setProposals(r.processes);
        setSelected(new Set(r.processes.map((_, i) => i)));
        setMsg({ type: "ok", text: `Το AI πρότεινε ${r.processes.length} διαδικασίες.` });
      } else {
        setMsg({ type: "err", text: r.error });
      }
    });
  }

  function handleCreateTemplates() {
    setMsg(null);
    startTransition(async () => {
      try {
        const chosen = proposals.filter((_, i) => selected.has(i));
        const r = await createProcessTemplatesFromBlueprints(chosen, { isDemo: true });
        setCreatedTemplates((c) => c + r.created);
        setMsg({ type: "ok", text: `Δημιουργήθηκαν ${r.created} πρότυπα.` });
        setStep(3);
        router.refresh();
      } catch (e) {
        setMsg({
          type: "err",
          text: e instanceof Error ? e.message : "Αποτυχία δημιουργίας προτύπων.",
        });
      }
    });
  }

  function handleGenerate() {
    setMsg(null);
    startTransition(async () => {
      const r = await generateDemoInstances({
        startDate,
        endDate,
        count,
        completedRatio: completedPct / 100,
      });
      if (r.ok) {
        setResult({
          instances: r.instances,
          tasks: r.tasks,
          actions: r.actions,
          fieldValues: r.fieldValues,
          entitiesCreated: r.entitiesCreated,
        });
        setMsg({
          type: "ok",
          text:
            `Δημιουργήθηκαν ${r.instances} demo διαδικασίες με ${r.tasks} βήματα.` +
            (r.failedChunks > 0
              ? " Ορισμένα τμήματα απέτυχαν — δείτε τα logs ή κάντε επαναφορά."
              : ""),
        });
        router.refresh();
      } else {
        setMsg({ type: "err", text: r.error });
      }
    });
  }

  function handleReset() {
    setMsg(null);
    startTransition(async () => {
      const r = await deleteDemoData();
      if (r.ok) {
        setResult(null);
        setMsg({
          type: "ok",
          text: `Διαγράφηκαν ${r.instances} demo διαδικασίες, ${r.templates} demo πρότυπα και ${r.entities} demo οντότητες.`,
        });
        router.refresh();
      } else {
        setMsg({ type: "err", text: r.error });
      }
    });
  }

  const resetButton = (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" disabled={pending}>
          <FiTrash2 className="size-4" />
          Διαγραφή demo δεδομένων
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Διαγραφή demo δεδομένων;</AlertDialogTitle>
          <AlertDialogDescription>
            Θα διαγραφούν {result ? result.instances : overview.demoInstanceCount} demo
            διαδικασίες. Τα πραγματικά δεδομένα δεν επηρεάζονται.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Άκυρο</AlertDialogCancel>
          <AlertDialogAction onClick={handleReset}>Διαγραφή</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return (
    <div className="space-y-6">
      {/* Stepper header */}
      <div className="flex flex-wrap items-center gap-2">
        {STEPS.map((s) => (
          <div
            key={s.n}
            className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${
              step === s.n
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground"
            }`}
          >
            <span
              className={`flex size-5 items-center justify-center rounded-full text-xs font-semibold ${
                step === s.n ? "bg-primary-foreground/20" : "bg-muted"
              }`}
            >
              {s.n}
            </span>
            {s.label}
          </div>
        ))}
      </div>

      <MsgBanner msg={msg} />

      {/* Βήμα 1 — Επισκόπηση */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Επισκόπηση υπαρχόντων δεδομένων</CardTitle>
            {overview.company && (
              <p className="ui-body-muted">
                Εταιρία: {overview.company.name}
                {overview.company.afm ? ` — ΑΦΜ ${overview.company.afm}` : ""}
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <CountCard label="Τμήματα" value={overview.departments.length} />
              <CountCard label="Θέσεις" value={overview.positions.length} />
              <CountCard label="Χρήστες" value={overview.users.length} />
              <CountCard label="Πρότυπα" value={overview.templates.length} />
              <CountCard label="Λίστες τιμών" value={overview.lookupLists.length} />
            </div>

            <div className="space-y-1.5">
              <div className="ui-field-label">Ενεργές διασυνδέσεις</div>
              {overview.activeConnectors.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {overview.activeConnectors.map((c) => (
                    <Badge key={c} variant="secondary">
                      {c}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="ui-meta">Καμία ενεργή διασύνδεση.</p>
              )}
            </div>

            {blocked && (
              <div className="flex items-start gap-3 rounded-md border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-400">
                <FiAlertTriangle className="mt-0.5 size-4 shrink-0" />
                <div>
                  Απαιτούνται χρήστες με θέσεις εργασίας και τμήματα για τη δημιουργία demo δεδομένων.{" "}
                  <Link href="/users" className="underline underline-offset-2">
                    Χρήστες
                  </Link>{" "}
                  ·{" "}
                  <Link href="/departments" className="underline underline-offset-2">
                    Τμήματα
                  </Link>
                </div>
              </div>
            )}

            {overview.users.length > 0 && (
              <div className="space-y-1.5">
                <div className="ui-field-label">Χρήστες ({overview.users.length})</div>
                <div className="max-h-64 overflow-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ονοματεπώνυμο</TableHead>
                        <TableHead>Θέσεις</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {overview.users.map((u) => (
                        <TableRow key={u.id}>
                          <TableCell>{u.name}</TableCell>
                          <TableCell className="ui-body-muted">
                            {u.positions.length > 0 ? u.positions.join(", ") : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {overview.templates.length > 0 && (
              <div className="space-y-1.5">
                <div className="ui-field-label">Πρότυπα διαδικασιών ({overview.templates.length})</div>
                <div className="max-h-64 overflow-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Όνομα</TableHead>
                        <TableHead className="text-right">Βήματα</TableHead>
                        <TableHead className="text-right">Πεδία</TableHead>
                        <TableHead className="text-right">Διαδικασίες</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {overview.templates.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell>{t.name}</TableCell>
                          <TableCell className="text-right">{t.taskCount}</TableCell>
                          <TableCell className="text-right">{t.fieldCount}</TableCell>
                          <TableCell className="text-right">{t.instanceCount}</TableCell>
                          <TableCell>
                            {t.isDemo && <Badge variant="outline">Demo</Badge>}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {overview.demoInstanceCount > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border px-4 py-3">
                <p className="ui-body">
                  Υπάρχουν ήδη <strong>{overview.demoInstanceCount}</strong> demo διαδικασίες
                  {overview.demoTemplateCount > 0 && (
                    <> και {overview.demoTemplateCount} demo πρότυπα</>
                  )}
                  .
                </p>
                {resetButton}
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={() => goTo(2)} disabled={blocked}>
                Επόμενο
                <FiArrowRight className="size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Βήμα 2 — AI Διαδικασίες */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>AI Διαδικασίες</CardTitle>
            <p className="ui-body-muted">
              Δημιουργία προτύπων διαδικασιών με τη βοήθεια AI, από περιγραφή της επιχείρησης.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {hasTemplates && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-green-500/40 bg-green-500/10 px-4 py-3">
                <p className="text-sm text-green-700 dark:text-green-400">
                  <FiCheckCircle className="mr-1.5 inline size-4" />
                  Υπάρχουν ήδη {overview.templates.length} πρότυπα — μπορείτε να συνεχίσετε.
                </p>
                <Button onClick={() => goTo(3)}>
                  Παράλειψη
                  <FiArrowRight className="size-4" />
                </Button>
              </div>
            )}

            {hasTemplates && !aiFormOpen ? (
              <Button variant="outline" onClick={() => setAiFormOpen(true)}>
                <FiZap className="size-4" />
                Δημιουργία επιπλέον με AI
              </Button>
            ) : (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="dm-description">Περιγραφή επιχείρησης</Label>
                  <Textarea
                    id="dm-description"
                    rows={4}
                    placeholder="π.χ. Εμπορική εταιρία ηλεκτρονικού εξοπλισμού με eshop, αποθήκη και τμήμα εξυπηρέτησης πελατών…"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
                <Button onClick={handlePropose} disabled={pending || description.trim().length === 0}>
                  {pending ? (
                    <FiLoader className="size-4 animate-spin" />
                  ) : (
                    <FiZap className="size-4" />
                  )}
                  {pending ? "Δημιουργία προτάσεων…" : "Πρόταση διαδικασιών (AI)"}
                </Button>

                {proposals.length > 0 && (
                  <div className="space-y-3">
                    <div className="ui-field-label">Προτεινόμενες διαδικασίες</div>
                    <div className="space-y-2">
                      {proposals.map((p, i) => (
                        <label
                          key={i}
                          className="flex cursor-pointer items-start gap-3 rounded-md border px-4 py-3 hover:bg-muted/50"
                        >
                          <Checkbox
                            checked={selected.has(i)}
                            onCheckedChange={(checked) => {
                              setSelected((prev) => {
                                const next = new Set(prev);
                                if (checked === true) next.add(i);
                                else next.delete(i);
                                return next;
                              });
                            }}
                            className="mt-0.5"
                          />
                          <div className="space-y-0.5">
                            <div className="ui-body font-medium">
                              {p.name}{" "}
                              <span className="ui-meta">({p.tasks.length} βήματα)</span>
                            </div>
                            <p className="ui-body-muted">{p.description}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                    <Button
                      onClick={handleCreateTemplates}
                      disabled={pending || selected.size === 0}
                    >
                      {pending && <FiLoader className="size-4 animate-spin" />}
                      Δημιουργία επιλεγμένων ({selected.size})
                    </Button>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => goTo(1)}>
                <FiArrowLeft className="size-4" />
                Πίσω
              </Button>
              <Button onClick={() => goTo(3)} disabled={!usableTemplates}>
                Επόμενο
                <FiArrowRight className="size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Βήμα 3 — Παράμετροι */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Παράμετροι δημιουργίας</CardTitle>
            <p className="ui-body-muted">
              Ορίστε το εύρος ημερομηνιών και το πλήθος των demo διαδικασιών.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="dm-start">Έναρξη</Label>
                <Input
                  id="dm-start"
                  type="date"
                  max={today}
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dm-end">Λήξη</Label>
                <Input
                  id="dm-end"
                  type="date"
                  max={today}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dm-count">Πλήθος διαδικασιών (1–1000)</Label>
                <Input
                  id="dm-count"
                  type="number"
                  min={1}
                  max={1000}
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dm-pct">% Ολοκληρωμένων (0–100)</Label>
                <Input
                  id="dm-pct"
                  type="number"
                  min={0}
                  max={100}
                  value={completedPct}
                  onChange={(e) => setCompletedPct(Number(e.target.value))}
                />
              </div>
            </div>

            {!paramsValid && (
              <p className="text-sm text-red-600 dark:text-red-400">
                Ελέγξτε τις παραμέτρους: η έναρξη πρέπει να είναι πριν τη λήξη, η λήξη έως
                σήμερα, το πλήθος 1–1000 και το ποσοστό 0–100.
              </p>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => goTo(2)}>
                <FiArrowLeft className="size-4" />
                Πίσω
              </Button>
              <Button onClick={() => goTo(4)} disabled={!paramsValid}>
                Επόμενο
                <FiArrowRight className="size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Βήμα 4 — Δημιουργία */}
      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>Δημιουργία demo δεδομένων</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border bg-card px-4 py-3">
                <div className="ui-meta">Έναρξη</div>
                <div className="ui-data">{startDate}</div>
              </div>
              <div className="rounded-lg border bg-card px-4 py-3">
                <div className="ui-meta">Λήξη</div>
                <div className="ui-data">{endDate}</div>
              </div>
              <div className="rounded-lg border bg-card px-4 py-3">
                <div className="ui-meta">Πλήθος</div>
                <div className="ui-data">{count}</div>
              </div>
              <div className="rounded-lg border bg-card px-4 py-3">
                <div className="ui-meta">Ολοκληρωμένες</div>
                <div className="ui-data">{completedPct}%</div>
              </div>
            </div>

            {!result && (
              <Button size="lg" onClick={handleGenerate} disabled={pending}>
                {pending ? (
                  <>
                    <FiLoader className="size-4 animate-spin" />
                    Δημιουργία σε εξέλιξη…
                  </>
                ) : (
                  <>
                    <FiZap className="size-4" />
                    Δημιουργία {count} διαδικασιών
                  </>
                )}
              </Button>
            )}

            {result && (
              <Card className="border-green-500/40 bg-green-500/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
                    <FiCheckCircle className="size-5" />
                    Η δημιουργία ολοκληρώθηκε
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <CountCard label="Διαδικασίες" value={result.instances} />
                    <CountCard label="Βήματα" value={result.tasks} />
                    <CountCard label="Ενέργειες" value={result.actions} />
                    <CountCard label="Τιμές πεδίων" value={result.fieldValues} />
                  </div>
                  {result.entitiesCreated > 0 && (
                    <p className="ui-body text-muted-foreground">
                      Δημιουργήθηκαν {result.entitiesCreated} demo οντότητες (προμηθευτές, πελάτες, είδη κ.λπ.).
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-3">
                    <Button asChild variant="outline">
                      <Link href="/dashboard">
                        <FiExternalLink className="size-4" />
                        Πίνακας Ελέγχου
                      </Link>
                    </Button>
                    <Button asChild variant="outline">
                      <Link href="/reports/overview">
                        <FiExternalLink className="size-4" />
                        Αναφορές — Επισκόπηση
                      </Link>
                    </Button>
                    {resetButton}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => goTo(3)} disabled={pending}>
                <FiArrowLeft className="size-4" />
                Πίσω
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
