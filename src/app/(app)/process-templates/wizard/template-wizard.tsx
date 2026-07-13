"use client";

import { useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Accordion } from "@/components/ui/accordion";
import { ArrowRight, Sparkles, Loader2, Wand2 } from "lucide-react";
import { ProcessIcon, PROCESS_ICON_OPTIONS } from "@/lib/process-icons";
import { ENTITY_KIND_LABELS, fieldTypeLabel } from "@/lib/process-fields/field-types";
import { generateProcessBlueprint } from "../actions";
import type { FieldInput } from "../actions";
import {
  SortableTaskItem,
  TaskTimelineModal,
  type TaskInput,
} from "../process-templates-client";
import { StepFields, slugifyKey } from "./step-fields";

const STEPS = [
  "Βασικά",
  "Τμήματα",
  "Βήματα & Ανάθεση",
  "Πεδία Δεδομένων",
  "Επισκόπηση",
] as const;

export type WizardState = {
  name: string;
  description: string;
  icon: string;
  allowedDepartmentIds: string[];
  tasks: TaskInput[];
  fields: FieldInput[];
};

export function emptyWizardState(): WizardState {
  return {
    name: "",
    description: "",
    icon: "FiFileText",
    allowedDepartmentIds: [],
    tasks: [],
    fields: [],
  };
}

function newTask(order: number): TaskInput {
  return {
    id: crypto.randomUUID(),
    name: "",
    order,
    description: "",
    needFile: false,
    mandatory: true,
    slaDays: null,
    approverPositionIds: [],
    notifyOnStartPositionIds: [],
    notifyOnCompletePositionIds: [],
    approverSameDepartment: false,
    approverDepartmentManager: false,
    notifyOnStartSameDepartment: false,
    notifyOnStartDepartmentManager: false,
    notifyOnCompleteSameDepartment: false,
    notifyOnCompleteDepartmentManager: false,
    notifyOnStartInitiator: false,
    notifyOnCompleteInitiator: true,
  };
}

export function TemplateWizard(props: {
  initial?: WizardState;
  departments: { id: string; name: string }[];
  positions: { id: string; name: string; department: { name: string } }[];
  lookupLists: {
    id: string;
    name: string;
    valueHeader: string | null;
    labelHeader: string | null;
    extraColumns?: unknown;
    items: { id: string; value: string; label: string }[];
  }[];
  onSubmit: (state: WizardState) => Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
}) {
  const [step, setStep] = useState(0);
  const [state, setState] = useState<WizardState>(props.initial ?? emptyWizardState());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // ---- AI blueprint ----
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  async function handleGenerateBlueprint() {
    setAiError(null);
    setAiLoading(true);
    try {
      const res = await generateProcessBlueprint({ description: aiPrompt });
      if (!res.ok) {
        setAiError(res.error);
        return;
      }
      const bp = res.blueprint;
      setState((s) => ({
        ...s,
        name: bp.name || s.name,
        description: bp.description || s.description,
        tasks: bp.tasks.map((t, i) => ({
          ...newTask(i),
          name: t.name,
          description: t.description,
          mandatory: t.mandatory,
          needFile: t.needFile,
        })),
        fields: bp.fields.map((f, i) => ({
          name: f.name,
          key: slugifyKey(f.name),
          type: f.type,
          order: i,
          required: f.required,
          captureTaskOrder: f.captureTaskOrder,
          lookupListId: null,
          lookupDisplayKey: null,
          entityKind: null,
        })),
      }));
    } catch {
      setAiError("Αποτυχία δημιουργίας διαδικασίας.");
    } finally {
      setAiLoading(false);
    }
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function patch(p: Partial<WizardState>) {
    setState((s) => ({ ...s, ...p }));
  }

  // ---- task helpers ----
  function addTask() {
    setState((s) => ({ ...s, tasks: [...s.tasks, newTask(s.tasks.length)] }));
  }
  function updateTask(index: number, updates: Partial<TaskInput>) {
    setState((s) => {
      const next = [...s.tasks];
      next[index] = { ...next[index], ...updates };
      return { ...s, tasks: next };
    });
  }
  function removeTask(index: number) {
    setState((s) => ({ ...s, tasks: s.tasks.filter((_, i) => i !== index) }));
  }
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setState((s) => {
      const oldIndex = s.tasks.findIndex((t) => t.id === active.id);
      const newIndex = s.tasks.findIndex((t) => t.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return s;
      return { ...s, tasks: arrayMove(s.tasks, oldIndex, newIndex) };
    });
  }
  const toggleDepartment = (id: string) =>
    setState((s) => ({
      ...s,
      allowedDepartmentIds: s.allowedDepartmentIds.includes(id)
        ? s.allowedDepartmentIds.filter((d) => d !== id)
        : [...s.allowedDepartmentIds, id],
    }));

  // ---- validation per step ----
  function validateStep(i: number): string | null {
    if (i === 0) {
      if (!state.name.trim()) return "Συμπληρώστε το όνομα της διαδικασίας.";
    }
    if (i === 2) {
      if (state.tasks.length === 0) return "Προσθέστε τουλάχιστον ένα βήμα.";
      if (state.tasks.some((t) => !t.name.trim())) return "Κάθε βήμα πρέπει να έχει όνομα.";
    }
    if (i === 3) {
      const err = validateFields();
      if (err) return err;
    }
    return null;
  }

  function validateFields(): string | null {
    if (state.fields.some((f) => !f.name.trim())) return "Κάθε πεδίο πρέπει να έχει όνομα.";
    if (state.fields.some((f) => !f.key.trim())) return "Κάθε πεδίο πρέπει να έχει κλειδί.";
    const keys = state.fields.map((f) => f.key.trim());
    if (new Set(keys).size !== keys.length) return "Τα κλειδιά των πεδίων πρέπει να είναι μοναδικά.";
    if (state.fields.some((f) => f.type === "SELECT" && !f.lookupListId))
      return "Τα πεδία τύπου «Λίστα τιμών» απαιτούν επιλογή λίστας.";
    if (state.fields.some((f) => f.type === "ENTITY" && !f.entityKind))
      return "Τα πεδία τύπου «Οντότητα» απαιτούν επιλογή είδους οντότητας.";
    return null;
  }

  function next() {
    const err = validateStep(step);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }
  function back() {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  }
  function goto(target: number) {
    if (target <= step) {
      setError(null);
      setStep(target);
      return;
    }
    // validate all steps up to target-1
    for (let i = step; i < target; i++) {
      const err = validateStep(i);
      if (err) {
        setError(err);
        setStep(i);
        return;
      }
    }
    setError(null);
    setStep(target);
  }

  async function handleSubmit() {
    // full validation
    for (let i = 0; i < STEPS.length - 1; i++) {
      const err = validateStep(i);
      if (err) {
        setError(err);
        setStep(i);
        return;
      }
    }
    setError(null);
    setLoading(true);
    try {
      // renumber tasks & fields order to reflect current arrangement
      const normalized: WizardState = {
        ...state,
        tasks: state.tasks.map((t, i) => ({ ...t, order: i })),
        fields: state.fields.map((f, i) => ({ ...f, order: i })),
      };
      await props.onSubmit(normalized);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Αποτυχία αποθήκευσης.");
    } finally {
      setLoading(false);
    }
  }

  const taskOptions = state.tasks.map((t, i) => ({ order: i, name: t.name }));
  const listName = (id: string | null) =>
    id ? props.lookupLists.find((l) => l.id === id)?.name ?? "—" : "—";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* progress bar */}
      <div className="flex shrink-0 items-center gap-1 border-b px-6 py-4">
        {STEPS.map((label, i) => {
          const done = i < step;
          const current = i === step;
          return (
            <div key={label} className="flex items-center flex-1 min-w-0">
              <button
                type="button"
                onClick={() => goto(i)}
                className="flex items-center gap-2 min-w-0"
              >
                <span
                  className={`flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors ${
                    current
                      ? "border-primary bg-primary text-primary-foreground"
                      : done
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-muted-foreground/30 text-muted-foreground"
                  }`}
                >
                  {i + 1}
                </span>
                <span
                  className={`text-xs font-medium truncate hidden sm:inline ${
                    current ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {label}
                </span>
              </button>
              {i < STEPS.length - 1 && (
                <div className={`mx-2 h-0.5 flex-1 rounded ${done ? "bg-primary" : "bg-muted"}`} />
              )}
            </div>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        {/* Step 0 — Βασικά */}
        {step === 0 && (
          <div className="space-y-6">
            {/* AI blueprint hero */}
            <section className="overflow-hidden rounded-xl border border-primary/30 bg-gradient-to-br from-primary/5 via-primary/5 to-transparent">
              <div className="flex items-center gap-2 border-b border-primary/20 bg-primary/10 px-4 py-2.5">
                <Wand2 className="size-4 text-primary" />
                <h3 className="ui-subsection-title">Δημιουργία με AI</h3>
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary">
                  προτεινόμενο
                </span>
              </div>
              <div className="space-y-3 p-4">
                <p className="text-sm text-muted-foreground">
                  Περιγράψτε τι θέλετε να πετύχει η διαδικασία και το AI θα προτείνει{" "}
                  <span className="font-medium text-foreground">όνομα, βήματα και πεδία δεδομένων</span>{" "}
                  — μπορείτε να τα προσαρμόσετε στη συνέχεια.
                </p>
                <Textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  rows={3}
                  placeholder="π.χ. Διαδικασία έγκρισης δαπάνης: ο εργαζόμενος υποβάλλει αίτημα με ποσό και παραστατικό, ο προϊστάμενος εγκρίνει, το λογιστήριο πληρώνει."
                  className="bg-background"
                />
                {aiError && <p className="text-sm text-destructive">{aiError}</p>}
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    onClick={handleGenerateBlueprint}
                    disabled={aiLoading || !aiPrompt.trim()}
                    className="gap-1.5"
                  >
                    {aiLoading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Sparkles className="size-4" />
                    )}
                    {aiLoading ? "Δημιουργία..." : "Δημιουργία διαδικασίας"}
                  </Button>
                  {(state.tasks.length > 0 || state.fields.length > 0) && !aiLoading && (
                    <span className="ui-meta">
                      ✓ Προτάθηκαν {state.tasks.length} βήματα & {state.fields.length} πεδία — δείτε τα
                      επόμενα βήματα.
                    </span>
                  )}
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="ui-subsection-title border-b pb-1">Γενικά</h3>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Όνομα</Label>
                <Input
                  className="h-9"
                  value={state.name}
                  onChange={(e) => patch({ name: e.target.value })}
                  required
                  placeholder="π.χ. Αίτηση άδειας"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Περιγραφή</Label>
                <Textarea
                  value={state.description}
                  onChange={(e) => patch({ description: e.target.value })}
                  placeholder="Σύντομη περιγραφή αυτής της διαδικασίας"
                  rows={3}
                />
              </div>
            </section>
            <section className="space-y-3">
              <h3 className="ui-subsection-title border-b pb-1">Εικονίδιο</h3>
              <p className="text-muted-foreground text-sm">Επιλέξτε ένα εικονίδιο για αυτή τη διαδικασία</p>
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2 py-1">
                {PROCESS_ICON_OPTIONS.map((opt) => {
                  const label = opt.replace(/^Fi/, "").replace(/([A-Z])/g, " $1").trim();
                  const isSelected = state.icon === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => patch({ icon: opt })}
                      className={`flex flex-col items-center gap-1.5 rounded-lg border py-2.5 px-2 transition-all hover:bg-muted/80 hover:border-muted-foreground/30 min-w-0 ${isSelected ? "border-primary bg-primary/5 ring-2 ring-primary/20 ring-offset-2" : "border-border bg-card"}`}
                    >
                      <ProcessIcon icon={opt} className="size-5 shrink-0 text-muted-foreground" />
                      <span className="text-[10px] font-medium text-center text-muted-foreground truncate w-full leading-tight">
                        {label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        )}

        {/* Step 1 — Τμήματα */}
        {step === 1 && (
          <section className="space-y-3">
            <h3 className="ui-subsection-title border-b pb-1">
              Ποιος μπορεί να ξεκινήσει αυτή τη διαδικασία
            </h3>
            <p className="text-muted-foreground text-sm">
              Επιλέξτε τα τμήματα που επιτρέπεται να ξεκινούν διαδικασίες αυτού του τύπου.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {props.departments.map((d) => {
                const checked = state.allowedDepartmentIds.includes(d.id);
                return (
                  <label
                    key={d.id}
                    className={`flex cursor-pointer select-none items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                      checked
                        ? "border-primary/40 bg-primary/5 text-foreground"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleDepartment(d.id)}
                    />
                    {d.name}
                  </label>
                );
              })}
              {props.departments.length === 0 && (
                <p className="text-sm text-muted-foreground">Δεν υπάρχουν διαθέσιμα τμήματα.</p>
              )}
            </div>
          </section>
        )}

        {/* Step 2 — Βήματα & Ανάθεση */}
        {step === 2 && (
          <div className="space-y-4">
            <TaskTimelineModal tasks={state.tasks} />
            <section>
              <div className="flex justify-between items-center mb-3">
                <h3 className="ui-subsection-title">Λίστα εργασιών</h3>
                <Button type="button" variant="outline" size="sm" onClick={addTask}>
                  Προσθήκη εργασίας
                </Button>
              </div>
              <div className="rounded-md border">
                {state.tasks.length === 0 ? (
                  <p className="text-muted-foreground text-sm p-4">
                    Καμία εργασία ακόμη. Κάντε κλικ στο «Προσθήκη εργασίας» για να προσθέσετε μία.
                  </p>
                ) : (
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={state.tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                      <Accordion type="multiple" className="w-full">
                        {state.tasks.map((task, index) => (
                          <SortableTaskItem
                            key={task.id}
                            task={task}
                            index={index}
                            positions={props.positions}
                            processName={state.name}
                            onUpdate={updateTask}
                            onRemove={removeTask}
                          />
                        ))}
                      </Accordion>
                    </SortableContext>
                  </DndContext>
                )}
              </div>
            </section>
          </div>
        )}

        {/* Step 3 — Πεδία Δεδομένων */}
        {step === 3 && (
          <StepFields
            fields={state.fields}
            taskOptions={taskOptions}
            lookupLists={props.lookupLists}
            onChange={(fields) => patch({ fields })}
          />
        )}

        {/* Step 4 — Επισκόπηση */}
        {step === 4 && (
          <div className="space-y-5">
            <section className="space-y-2">
              <h3 className="ui-subsection-title border-b pb-1">Επισκόπηση</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <ProcessIcon icon={state.icon} className="size-5 text-muted-foreground" />
                  <span className="font-semibold">{state.name || "—"}</span>
                </div>
                <div className="text-muted-foreground">
                  Τμήματα:{" "}
                  {state.allowedDepartmentIds.length
                    ? props.departments
                        .filter((d) => state.allowedDepartmentIds.includes(d.id))
                        .map((d) => d.name)
                        .join(", ")
                    : "—"}
                </div>
              </div>
              {state.description && <p className="text-muted-foreground text-sm">{state.description}</p>}
            </section>

            <section className="space-y-2">
              <h4 className="ui-subsection-title">Βήματα ({state.tasks.length})</h4>
              <ol className="list-decimal pl-5 text-sm space-y-1">
                {state.tasks.map((t) => (
                  <li key={t.id}>
                    {t.name.trim() || "Χωρίς όνομα"}
                    {t.mandatory && <span className="text-muted-foreground"> · υποχρεωτικό</span>}
                    {t.needFile && <span className="text-muted-foreground"> · αρχείο</span>}
                  </li>
                ))}
                {state.tasks.length === 0 && <li className="text-muted-foreground">—</li>}
              </ol>
            </section>

            <section className="space-y-2">
              <h4 className="ui-subsection-title">Πεδία δεδομένων ({state.fields.length})</h4>
              {state.fields.length === 0 ? (
                <p className="text-muted-foreground text-sm">Δεν έχουν οριστεί πεδία.</p>
              ) : (
                <div className="rounded-md border divide-y text-sm">
                  {state.fields.map((f, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-2 px-3 py-2">
                      <span className="font-medium">{f.name.trim() || "—"}</span>
                      <span className="ui-meta">({fieldTypeLabel(f.type)})</span>
                      {f.required && <span className="ui-meta">· υποχρεωτικό</span>}
                      <span className="ui-meta">
                        · βήμα{" "}
                        {f.captureTaskOrder == null ? "—" : `${f.captureTaskOrder + 1}`}
                      </span>
                      {f.type === "SELECT" && (
                        <span className="ui-meta">· λίστα: {listName(f.lookupListId)}</span>
                      )}
                      {f.type === "ENTITY" && f.entityKind && (
                        <span className="ui-meta">· οντότητα: {ENTITY_KIND_LABELS[f.entityKind]}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      <div className="shrink-0 border-t bg-muted/20 px-6 py-3.5">
        {error && (
          <p className="mb-2.5 text-sm text-destructive">{error}</p>
        )}
        <div className="flex items-center justify-between gap-2">
          <div>
            {props.onCancel && (
              <Button type="button" variant="ghost" onClick={props.onCancel}>
                Άκυρο
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="mr-1 hidden ui-meta sm:inline">
              Βήμα {step + 1} από {STEPS.length}
            </span>
            {step > 0 && (
              <Button type="button" variant="outline" onClick={back} disabled={loading}>
                Πίσω
              </Button>
            )}
            {step < STEPS.length - 1 ? (
              <Button type="button" size="lg" onClick={next} className="gap-1.5 px-6">
                Επόμενο
                <ArrowRight className="size-4" />
              </Button>
            ) : (
              <Button type="button" size="lg" onClick={handleSubmit} disabled={loading} className="px-6">
                {loading ? "Αποθήκευση..." : props.submitLabel ?? "Αποθήκευση"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
