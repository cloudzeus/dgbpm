"use client";

import { useState } from "react";
import Link from "next/link";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionHeader,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ProcessIcon } from "@/lib/process-icons";
import {
  createProcessTemplate,
  updateProcessTemplate,
  deleteProcessTemplate,
  generateTaskDescription,
  type FieldInput,
} from "./actions";
import { TemplateWizard, emptyWizardState, type WizardState } from "./wizard/template-wizard";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  GripVertical,
  ChevronRight,
  Sparkles,
  Loader2,
  MoreHorizontal,
  BarChart3,
  Pencil,
  Trash2,
} from "lucide-react";

type TemplateTask = {
  id: string;
  name: string;
  order: number;
  description: string | null;
  needFile: boolean;
  mandatory: boolean;
  slaDays: number | null;
};

type Template = {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  allowedDepartments: { departmentId: string; department: { name: string } }[];
  _count: { tasks: number };
  tasks: TemplateTask[];
  fields: FieldInput[];
};

export type TaskInput = {
  id: string;
  name: string;
  order: number;
  description: string;
  needFile: boolean;
  mandatory: boolean;
  slaDays: number | null;
  approverPositionIds: string[];
  notifyOnStartPositionIds: string[];
  notifyOnCompletePositionIds: string[];
  approverSameDepartment: boolean;
  approverDepartmentManager: boolean;
  notifyOnStartSameDepartment: boolean;
  notifyOnStartDepartmentManager: boolean;
  notifyOnCompleteSameDepartment: boolean;
  notifyOnCompleteDepartmentManager: boolean;
  notifyOnStartInitiator: boolean;
  notifyOnCompleteInitiator: boolean;
};

export function PositionMultiSelect({
  positions,
  selectedIds,
  onChange,
  placeholder = "Επιλέξτε θέσεις εργασίας...",
}: {
  positions: { id: string; name: string; department: { name: string } }[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
}) {
  const toggle = (id: string) => {
    onChange(
      selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]
    );
  };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="w-full justify-between font-normal min-h-9">
          <span className="truncate">
            {selectedIds.length === 0
              ? placeholder
              : `${selectedIds.length} ${selectedIds.length === 1 ? "θέση επιλέχθηκε" : "θέσεις επιλέχθηκαν"}`}
          </span>
          <span className="text-muted-foreground shrink-0 ml-2">▼</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] max-h-64 overflow-y-auto p-2" align="start">
        <div className="flex flex-col gap-1">
          {positions.map((p) => (
            <label
              key={p.id}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted cursor-pointer text-sm"
            >
              <Checkbox
                checked={selectedIds.includes(p.id)}
                onCheckedChange={() => toggle(p.id)}
              />
              <span>{p.name}</span>
              <span className="text-muted-foreground text-xs">({p.department.name})</span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

const STEP_BORDER_CLASSES = [
  "border-l-indigo-500",
  "border-l-cyan-500",
  "border-l-fuchsia-500",
  "border-l-amber-500",
  "border-l-emerald-500",
  "border-l-rose-500",
];


export function TaskTimelineModal({ tasks }: { tasks: TaskInput[] }) {
  if (tasks.length === 0) return null;
  return (
    <div className="mb-6 rounded-xl border bg-card p-4 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <h3 className="text-sm font-semibold text-foreground">Ροή διαδικασίας</h3>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {tasks.length} {tasks.length === 1 ? "βήμα" : "βήματα"}
        </span>
      </div>
      <div className="flex items-start overflow-x-auto pb-2">
        {tasks.map((task, i) => {
          const named = task.name.trim();
          return (
            <div key={task.id} className="flex shrink-0 items-start">
              <div className="flex w-[132px] flex-col items-center gap-2 px-1 text-center">
                <span
                  className={cn(
                    "flex size-9 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors",
                    named
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : "border-dashed border-muted-foreground/40 bg-background text-muted-foreground",
                  )}
                >
                  {i + 1}
                </span>
                <span
                  className={cn(
                    "line-clamp-2 text-xs font-medium leading-tight",
                    named ? "text-foreground" : "italic text-muted-foreground",
                  )}
                >
                  {named || "Χωρίς όνομα"}
                </span>
                <div className="flex min-h-[18px] flex-wrap justify-center gap-1">
                  {task.mandatory && (
                    <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-medium">
                      Υποχρ.
                    </Badge>
                  )}
                  {task.needFile && (
                    <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-medium">
                      Αρχείο
                    </Badge>
                  )}
                </div>
              </div>
              {i < tasks.length - 1 && (
                <div className="mt-[18px] h-0.5 w-6 shrink-0 rounded-full bg-border" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TaskFlowVisual({ tasks }: { tasks: TemplateTask[] }) {
  if (tasks.length === 0) {
    return (
      <p className="text-muted-foreground text-sm py-4 text-center">Δεν έχουν οριστεί βήματα ακόμη.</p>
    );
  }
  const gradientClasses = [
    "from-indigo-600 to-violet-700 text-white shadow-lg shadow-violet-500/25 border-0",
    "from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/25 border-0",
    "from-fuchsia-500 to-pink-600 text-white shadow-lg shadow-fuchsia-500/25 border-0",
    "from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/25 border-0",
    "from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25 border-0",
    "from-rose-500 to-red-500 text-white shadow-lg shadow-rose-500/25 border-0",
  ];
  return (
    <div className="flex flex-wrap items-center gap-2 py-4">
      {tasks.map((task, i) => {
        const gradient = gradientClasses[i % gradientClasses.length];
        return (
          <div key={task.id} className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={`flex flex-col items-center gap-1 rounded-xl border-2 bg-gradient-to-br ${gradient} px-4 py-3 min-w-[120px] hover:scale-[1.02] hover:shadow-xl transition-all duration-200 cursor-default`}>
                  <span className="text-xs font-semibold text-white/80 uppercase tracking-wider">Βήμα {task.order + 1}</span>
                  <span className="font-semibold text-sm text-center leading-tight text-white drop-shadow-sm">{task.name || "Χωρίς όνομα"}</span>
                  {(task.needFile || task.mandatory) && (
                    <span className="flex gap-1 mt-0.5 text-white/90">
                      {task.needFile && <span className="text-[10px]">📎</span>}
                      {task.mandatory && <span className="text-[10px]">*</span>}
                    </span>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-left space-y-2 p-3 bg-foreground text-white border-0">
                <div className="font-semibold text-white">{task.name || "Βήμα χωρίς όνομα"}</div>
                {task.description ? (
                  <p className="text-white/90 text-xs leading-relaxed">{task.description}</p>
                ) : (
                  <p className="text-white/70 text-xs italic">Χωρίς περιγραφή</p>
                )}
                <div className="flex flex-wrap gap-2 pt-1 border-t border-white/20">
                  {task.needFile && <span className="text-xs text-white/90">Απαιτείται αρχείο</span>}
                  {task.mandatory && <span className="text-xs text-white/90">Υποχρεωτικό</span>}
                </div>
              </TooltipContent>
            </Tooltip>
            {i < tasks.length - 1 && (
              <ChevronRight className="size-5 text-muted-foreground shrink-0" aria-hidden />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function SortableTaskItem({
  task,
  index,
  positions,
  processName,
  onUpdate,
  onRemove,
}: {
  task: TaskInput;
  index: number;
  positions: { id: string; name: string; department: { name: string } }[];
  processName: string;
  onUpdate: (index: number, updates: Partial<TaskInput>) => void;
  onRemove: (index: number) => void;
}) {
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  async function handleGenerate() {
    setGenError(null);
    setGenerating(true);
    try {
      const res = await generateTaskDescription({
        shortDescription: task.description,
        taskName: task.name,
        processName,
      });
      if (res.ok) {
        onUpdate(index, { description: res.text });
      } else {
        setGenError(res.error);
      }
    } catch {
      setGenError("Αποτυχία δημιουργίας περιγραφής.");
    } finally {
      setGenerating(false);
    }
  }
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const borderClass = STEP_BORDER_CLASSES[index % STEP_BORDER_CLASSES.length];
  return (
    <AccordionItem
      value={task.id}
      ref={setNodeRef}
      style={style}
      className={`border-l-4 ${borderClass} ${isDragging ? "opacity-50" : ""}`}
    >
      <AccordionHeader className="flex-row items-center gap-2">
        <span
          className="touch-none cursor-grab active:cursor-grabbing rounded p-1 hover:bg-muted shrink-0"
          {...attributes}
          {...listeners}
          onClick={(e) => e.preventDefault()}
        >
          <GripVertical className="size-4 text-muted-foreground" />
        </span>
        <AccordionTrigger asChildHeader className="flex-1 hover:no-underline [&[data-state=open]>svg]:rotate-180 py-2">
          {task.name.trim() ? task.name : `Εργασία ${index + 1}`}
        </AccordionTrigger>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="shrink-0"
          onClick={() => onRemove(index)}
        >
          Αφαίρεση
        </Button>
      </AccordionHeader>
      <AccordionContent>
        <div className="space-y-5 px-4 pt-1 pb-4">
          <section className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Λεπτομέρειες βήματος</h4>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Όνομα εργασίας</Label>
              <Input
                className="h-9"
                placeholder="Όνομα εργασίας"
                value={task.name}
                onChange={(e) => onUpdate(index, { name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs text-muted-foreground">Περιγραφή</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5 text-xs"
                  onClick={handleGenerate}
                  disabled={generating || !task.description.trim()}
                  title="Γράψτε μια σύντομη ιδέα και το AI θα τη μετατρέψει σε αναλυτικές οδηγίες"
                >
                  {generating ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="size-3.5" />
                  )}
                  {generating ? "Δημιουργία..." : "Δημιουργία με AI"}
                </Button>
              </div>
              <Textarea
                placeholder="Γράψτε μια σύντομη ιδέα (π.χ. «έλεγχος τιμολογίου») και πατήστε «Δημιουργία με AI» για αναλυτικές οδηγίες."
                value={task.description}
                rows={task.description.length > 120 ? 8 : 3}
                onChange={(e) => onUpdate(index, { description: e.target.value })}
              />
              {genError && <p className="text-xs text-destructive">{genError}</p>}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={task.needFile}
                  onCheckedChange={(c) => onUpdate(index, { needFile: !!c })}
                />
                Απαιτείται αρχείο
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={task.mandatory}
                  onCheckedChange={(c) => onUpdate(index, { mandatory: !!c })}
                />
                Υποχρεωτικό
              </label>
              <label className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Προθεσμία (μέρες)</span>
                <Input
                  type="number"
                  min={1}
                  placeholder="προεπιλογή"
                  className="h-8 w-24"
                  value={task.slaDays ?? ""}
                  onChange={(e) =>
                    onUpdate(index, {
                      slaDays: e.target.value === "" ? null : Math.max(1, Number(e.target.value)),
                    })
                  }
                />
              </label>
            </div>
          </section>
          <section className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Εγκρίνοντες</h4>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Ποιος μπορεί να εγκρίνει αυτή την εργασία</Label>
            <PositionMultiSelect
              positions={positions}
              selectedIds={task.approverPositionIds}
              onChange={(ids) => onUpdate(index, { approverPositionIds: ids })}
              placeholder="Επιλέξτε θέσεις εργασίας..."
            />
            <div className="flex flex-wrap gap-4 pt-1">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={task.approverSameDepartment}
                  onCheckedChange={(c) => onUpdate(index, { approverSameDepartment: !!c })}
                />
                Ίδιο τμήμα με τον υπεύθυνο (οποιοσδήποτε στο τμήμα του υπευθύνου)
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={task.approverDepartmentManager}
                  onCheckedChange={(c) => onUpdate(index, { approverDepartmentManager: !!c })}
                />
                Προϊστάμενος τμήματος του υπευθύνου
              </label>
            </div>
          </div>
          </section>
          <section className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ειδοποιήσεις</h4>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Ειδοποίηση όταν ξεκινά η εργασία</Label>
            <p className="text-muted-foreground text-xs">Θέσεις εργασίας ή/και κανόνες προς ειδοποίηση όταν ξεκινά αυτή η εργασία</p>
            <PositionMultiSelect
              positions={positions}
              selectedIds={task.notifyOnStartPositionIds}
              onChange={(ids) => onUpdate(index, { notifyOnStartPositionIds: ids })}
              placeholder="Επιλέξτε θέσεις εργασίας..."
            />
            <div className="flex flex-wrap gap-4 pt-1">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={task.notifyOnStartSameDepartment}
                  onCheckedChange={(c) => onUpdate(index, { notifyOnStartSameDepartment: !!c })}
                />
                Ίδιο τμήμα με τον υπεύθυνο
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={task.notifyOnStartDepartmentManager}
                  onCheckedChange={(c) => onUpdate(index, { notifyOnStartDepartmentManager: !!c })}
                />
                Προϊστάμενος τμήματος του υπευθύνου
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={task.notifyOnStartInitiator}
                  onCheckedChange={(c) => onUpdate(index, { notifyOnStartInitiator: !!c })}
                />
                Αυτόν που ξεκίνησε τη διαδικασία
              </label>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Ειδοποίηση όταν ολοκληρωθεί η εργασία</Label>
            <p className="text-muted-foreground text-xs">Θέσεις εργασίας ή/και κανόνες προς ειδοποίηση όταν αυτή η εργασία εγκριθεί ή απορριφθεί</p>
            <PositionMultiSelect
              positions={positions}
              selectedIds={task.notifyOnCompletePositionIds}
              onChange={(ids) => onUpdate(index, { notifyOnCompletePositionIds: ids })}
              placeholder="Επιλέξτε θέσεις εργασίας..."
            />
            <div className="flex flex-wrap gap-4 pt-1">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={task.notifyOnCompleteSameDepartment}
                  onCheckedChange={(c) => onUpdate(index, { notifyOnCompleteSameDepartment: !!c })}
                />
                Ίδιο τμήμα με τον υπεύθυνο
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={task.notifyOnCompleteDepartmentManager}
                  onCheckedChange={(c) => onUpdate(index, { notifyOnCompleteDepartmentManager: !!c })}
                />
                Προϊστάμενος τμήματος του υπευθύνου
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={task.notifyOnCompleteInitiator}
                  onCheckedChange={(c) => onUpdate(index, { notifyOnCompleteInitiator: !!c })}
                />
                Αυτόν που ξεκίνησε τη διαδικασία
              </label>
            </div>
          </div>
          </section>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

export function ProcessTemplatesClient({
  templates,
  departments,
  positions,
  lookupLists,
}: {
  templates: Template[];
  departments: { id: string; name: string }[];
  positions: { id: string; name: string; department: { name: string } }[];
  lookupLists: { id: string; name: string; items: { id: string; value: string; label: string }[] }[];
}) {
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // null while an edit template's tasks are still loading
  const [wizardInitial, setWizardInitial] = useState<WizardState | null>(null);

  function openCreate() {
    setEditId(null);
    setWizardInitial(emptyWizardState());
    setOpen(true);
  }

  async function openEdit(t: Template) {
    setEditId(t.id);
    setWizardInitial(null);
    setOpen(true);
    const tasks = await loadTemplateTasks(t.id);
    setWizardInitial({
      name: t.name,
      description: t.description ?? "",
      icon: t.icon,
      allowedDepartmentIds: t.allowedDepartments.map((d) => d.departmentId),
      tasks,
      fields: t.fields.map((f) => ({ ...f })),
    });
  }

  async function loadTemplateTasks(id: string): Promise<TaskInput[]> {
    const res = await fetch(`/api/process-templates/${id}/tasks`);
    const data = await res.json();
    if (!data.tasks) return [];
    return data.tasks.map(
      (
        task: {
          name: string;
          order: number;
          description: string | null;
          needFile: boolean;
          mandatory: boolean;
          slaDays?: number | null;
          approverRoles: { jobPositionId: string }[];
          notifyOnStartPositionIds?: string[];
          notifyOnCompletePositionIds?: string[];
          approverSameDepartment?: boolean;
          approverDepartmentManager?: boolean;
          notifyOnStartSameDepartment?: boolean;
          notifyOnStartDepartmentManager?: boolean;
          notifyOnCompleteSameDepartment?: boolean;
          notifyOnCompleteDepartmentManager?: boolean;
          notifyOnStartInitiator?: boolean;
          notifyOnCompleteInitiator?: boolean;
        },
        i: number
      ): TaskInput => ({
        id: `task-${task.order}-${i}-${Math.random().toString(36).slice(2)}`,
        name: task.name,
        order: task.order,
        description: task.description ?? "",
        needFile: task.needFile,
        mandatory: task.mandatory,
        slaDays: task.slaDays ?? null,
        approverPositionIds: task.approverRoles?.map((r: { jobPositionId: string }) => r.jobPositionId) ?? [],
        notifyOnStartPositionIds: task.notifyOnStartPositionIds ?? [],
        notifyOnCompletePositionIds: task.notifyOnCompletePositionIds ?? [],
        approverSameDepartment: task.approverSameDepartment ?? false,
        approverDepartmentManager: task.approverDepartmentManager ?? false,
        notifyOnStartSameDepartment: task.notifyOnStartSameDepartment ?? false,
        notifyOnStartDepartmentManager: task.notifyOnStartDepartmentManager ?? false,
        notifyOnCompleteSameDepartment: task.notifyOnCompleteSameDepartment ?? false,
        notifyOnCompleteDepartmentManager: task.notifyOnCompleteDepartmentManager ?? false,
        notifyOnStartInitiator: task.notifyOnStartInitiator ?? false,
        notifyOnCompleteInitiator: task.notifyOnCompleteInitiator ?? true,
      })
    );
  }

  async function handleWizardSubmit(state: WizardState) {
    const taskPayload = state.tasks.map((t, i) => ({
      name: t.name,
      order: i,
      description: t.description || undefined,
      needFile: t.needFile,
      mandatory: t.mandatory,
      slaDays: t.slaDays,
      approverPositionIds: t.approverPositionIds,
      notifyOnStartPositionIds: t.notifyOnStartPositionIds,
      notifyOnCompletePositionIds: t.notifyOnCompletePositionIds,
      approverSameDepartment: t.approverSameDepartment,
      approverDepartmentManager: t.approverDepartmentManager,
      notifyOnStartSameDepartment: t.notifyOnStartSameDepartment,
      notifyOnStartDepartmentManager: t.notifyOnStartDepartmentManager,
      notifyOnCompleteSameDepartment: t.notifyOnCompleteSameDepartment,
      notifyOnCompleteDepartmentManager: t.notifyOnCompleteDepartmentManager,
      notifyOnStartInitiator: t.notifyOnStartInitiator,
      notifyOnCompleteInitiator: t.notifyOnCompleteInitiator,
    }));
    const fieldPayload: FieldInput[] = state.fields.map((f, i) => ({
      id: f.id,
      name: f.name.trim(),
      key: f.key.trim(),
      type: f.type,
      order: i,
      required: f.required,
      captureTaskOrder: f.captureTaskOrder,
      lookupListId: f.lookupListId,
    }));
    if (editId) {
      await updateProcessTemplate(editId, {
        name: state.name,
        description: state.description || undefined,
        icon: state.icon,
        allowedDepartmentIds: state.allowedDepartmentIds,
        tasks: taskPayload,
        fields: fieldPayload,
      });
    } else {
      await createProcessTemplate({
        name: state.name,
        description: state.description || undefined,
        icon: state.icon,
        allowedDepartmentIds: state.allowedDepartmentIds,
        tasks: taskPayload,
        fields: fieldPayload,
      });
    }
    setOpen(false);
    setWizardInitial(null);
    setEditId(null);
  }

  async function handleDelete() {
    if (!deleteId) return;
    setLoading(true);
    try {
      await deleteProcessTemplate(deleteId);
      setDeleteId(null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <TooltipProvider>
        <Accordion type="multiple" className="rounded-md border">
          {templates.map((t) => (
            <AccordionItem key={t.id} value={t.id} className="px-4">
              <AccordionHeader className="hover:no-underline">
                <div className="flex items-center gap-3 w-full py-3">
                  <AccordionTrigger asChildHeader className="flex-1 min-w-0 py-0 hover:no-underline">
                    <div className="flex min-w-0 items-center gap-3 text-left">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <ProcessIcon icon={t.icon} className="size-5" />
                      </span>
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="truncate font-semibold">{t.name}</span>
                          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                            {t._count.tasks} βήματα
                          </span>
                        </div>
                        {t.description && (
                          <p className="truncate text-xs text-muted-foreground">{t.description}</p>
                        )}
                        <p className="truncate text-xs text-muted-foreground/80">
                          {t.allowedDepartments.length
                            ? t.allowedDepartments.map((d) => d.department.name).join(" · ")
                            : "Όλα τα τμήματα"}
                        </p>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="shrink-0 gap-1.5">
                        Ενέργειες
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuItem asChild>
                        <Link href={`/process-templates/${t.id}/results`}>
                          <BarChart3 className="size-4 text-primary" />
                          Αποτελέσματα
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openEdit(t)}>
                        <Pencil className="size-4 text-primary" />
                        Επεξεργασία
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setDeleteId(t.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="size-4 text-destructive" />
                        Διαγραφή
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </AccordionHeader>
              <AccordionContent>
                <div className="pb-4">
                  <p className="text-muted-foreground text-sm mb-2">Ροή διαδικασίας (περάστε τον δείκτη πάνω από ένα βήμα για λεπτομέρειες)</p>
                  <TaskFlowVisual tasks={t.tasks} />
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </TooltipProvider>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) {
            setWizardInitial(null);
            setEditId(null);
          }
        }}
      >
        <DialogTrigger asChild>
          <Button onClick={openCreate}>Δημιουργία προτύπου</Button>
        </DialogTrigger>
        <DialogContent className="flex max-h-[88vh] w-[90vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
          <DialogHeader className="shrink-0 border-b px-6 py-4">
            <DialogTitle>{editId ? "Επεξεργασία προτύπου διαδικασίας" : "Δημιουργία προτύπου διαδικασίας"}</DialogTitle>
          </DialogHeader>
          {wizardInitial ? (
            <TemplateWizard
              key={editId ?? "new"}
              initial={wizardInitial}
              departments={departments}
              positions={positions}
              lookupLists={lookupLists}
              onSubmit={handleWizardSubmit}
              onCancel={() => setOpen(false)}
              submitLabel={editId ? "Ενημέρωση" : "Δημιουργία"}
            />
          ) : (
            <div className="flex items-center gap-2 py-10 justify-center text-muted-foreground text-sm">
              <Loader2 className="size-4 animate-spin" /> Φόρτωση…
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Διαγραφή προτύπου διαδικασίας;</AlertDialogTitle>
            <AlertDialogDescription>
              Αυτό θα αφαιρέσει το πρότυπο. Οι υπάρχουσες διαδικασίες δεν επηρεάζονται.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Άκυρο</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={loading}>
              Διαγραφή
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
