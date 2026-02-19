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
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ProcessIcon, PROCESS_ICON_OPTIONS } from "@/lib/process-icons";
import { createProcessTemplate, updateProcessTemplate, deleteProcessTemplate } from "./actions";
import { GripVertical, ChevronRight } from "lucide-react";

type TemplateTask = {
  id: string;
  name: string;
  order: number;
  description: string | null;
  needFile: boolean;
  mandatory: boolean;
};

type Template = {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  allowedDepartments: { departmentId: string; department: { name: string } }[];
  _count: { tasks: number };
  tasks: TemplateTask[];
};

type TaskInput = {
  id: string;
  name: string;
  order: number;
  description: string;
  needFile: boolean;
  mandatory: boolean;
  approverPositionIds: string[];
  notifyOnStartPositionIds: string[];
  notifyOnCompletePositionIds: string[];
  approverSameDepartment: boolean;
  approverDepartmentManager: boolean;
  notifyOnStartSameDepartment: boolean;
  notifyOnStartDepartmentManager: boolean;
  notifyOnCompleteSameDepartment: boolean;
  notifyOnCompleteDepartmentManager: boolean;
};

function PositionMultiSelect({
  positions,
  selectedIds,
  onChange,
  placeholder = "Select positions...",
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
              : `${selectedIds.length} position${selectedIds.length === 1 ? "" : "s"} selected`}
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

const TIMELINE_DOT_CLASSES = [
  "bg-indigo-500 border-indigo-600",
  "bg-cyan-500 border-cyan-600",
  "bg-fuchsia-500 border-fuchsia-600",
  "bg-amber-500 border-amber-600",
  "bg-emerald-500 border-emerald-600",
  "bg-rose-500 border-rose-600",
];

function TaskTimelineModal({ tasks }: { tasks: TaskInput[] }) {
  if (tasks.length === 0) return null;
  return (
    <div className="mb-6 rounded-lg border bg-muted/30 p-4">
      <h3 className="text-sm font-semibold text-foreground mb-3">Process timeline</h3>
      <div className="relative pl-6">
        <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-gradient-to-b from-indigo-500 via-cyan-500 to-rose-500 rounded-full" />
        {tasks.map((task, i) => {
          const dotClass = TIMELINE_DOT_CLASSES[i % TIMELINE_DOT_CLASSES.length];
          return (
            <div key={task.id} className="relative flex items-start gap-3 pb-4 last:pb-0">
              <div className={`absolute left-0 size-6 rounded-full border-2 border-background shadow-sm -translate-x-1/2 translate-y-0.5 shrink-0 ${dotClass}`} />
              <div className="flex-1 min-w-0 pt-0.5">
                <span className="text-xs font-medium text-muted-foreground">Step {i + 1}</span>
                <p className="font-medium text-sm text-foreground">{task.name.trim() || "Unnamed step"}</p>
              </div>
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
      <p className="text-muted-foreground text-sm py-4 text-center">No steps defined yet.</p>
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
                  <span className="text-xs font-semibold text-white/80 uppercase tracking-wider">Step {task.order + 1}</span>
                  <span className="font-semibold text-sm text-center leading-tight text-white drop-shadow-sm">{task.name || "Unnamed"}</span>
                  {(task.needFile || task.mandatory) && (
                    <span className="flex gap-1 mt-0.5 text-white/90">
                      {task.needFile && <span className="text-[10px]">📎</span>}
                      {task.mandatory && <span className="text-[10px]">*</span>}
                    </span>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-left space-y-2 p-3 bg-foreground text-white border-0">
                <div className="font-semibold text-white">{task.name || "Unnamed step"}</div>
                {task.description ? (
                  <p className="text-white/90 text-xs leading-relaxed">{task.description}</p>
                ) : (
                  <p className="text-white/70 text-xs italic">No description</p>
                )}
                <div className="flex flex-wrap gap-2 pt-1 border-t border-white/20">
                  {task.needFile && <span className="text-xs text-white/90">Requires file</span>}
                  {task.mandatory && <span className="text-xs text-white/90">Mandatory</span>}
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

function SortableTaskItem({
  task,
  index,
  positions,
  onUpdate,
  onRemove,
}: {
  task: TaskInput;
  index: number;
  positions: { id: string; name: string; department: { name: string } }[];
  onUpdate: (index: number, updates: Partial<TaskInput>) => void;
  onRemove: (index: number) => void;
}) {
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
          {task.name.trim() ? task.name : `Task ${index + 1}`}
        </AccordionTrigger>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="shrink-0"
          onClick={() => onRemove(index)}
        >
          Remove
        </Button>
      </AccordionHeader>
      <AccordionContent>
        <div className="space-y-6 px-6 pt-2 pb-4">
          <section className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground border-b pb-1">Step details</h4>
            <div className="space-y-2">
              <Label>Task name</Label>
              <Input
                placeholder="Task name"
                value={task.name}
                onChange={(e) => onUpdate(index, { name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                placeholder="Description"
                value={task.description}
                onChange={(e) => onUpdate(index, { description: e.target.value })}
              />
            </div>
            <div className="flex flex-wrap gap-3 pt-1">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={task.needFile}
                  onChange={(e) => onUpdate(index, { needFile: e.target.checked })}
                />
                Need file
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={task.mandatory}
                  onChange={(e) => onUpdate(index, { mandatory: e.target.checked })}
                />
                Mandatory
              </label>
            </div>
          </section>
          <section className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground border-b pb-1">Approvers</h4>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Who can approve this task</Label>
            <PositionMultiSelect
              positions={positions}
              selectedIds={task.approverPositionIds}
              onChange={(ids) => onUpdate(index, { approverPositionIds: ids })}
              placeholder="Select positions..."
            />
            <div className="flex flex-wrap gap-4 pt-1">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={task.approverSameDepartment}
                  onCheckedChange={(c) => onUpdate(index, { approverSameDepartment: !!c })}
                />
                Same department as assignee (anyone in assignee&apos;s department)
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={task.approverDepartmentManager}
                  onCheckedChange={(c) => onUpdate(index, { approverDepartmentManager: !!c })}
                />
                Department manager of assignee
              </label>
            </div>
          </div>
          </section>
          <section className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground border-b pb-1">Notifications</h4>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Notify when task starts</Label>
            <p className="text-muted-foreground text-xs">Job positions and/or rules to notify when this task is started</p>
            <PositionMultiSelect
              positions={positions}
              selectedIds={task.notifyOnStartPositionIds}
              onChange={(ids) => onUpdate(index, { notifyOnStartPositionIds: ids })}
              placeholder="Select positions..."
            />
            <div className="flex flex-wrap gap-4 pt-1">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={task.notifyOnStartSameDepartment}
                  onCheckedChange={(c) => onUpdate(index, { notifyOnStartSameDepartment: !!c })}
                />
                Same department as assignee
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={task.notifyOnStartDepartmentManager}
                  onCheckedChange={(c) => onUpdate(index, { notifyOnStartDepartmentManager: !!c })}
                />
                Department manager of assignee
              </label>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Notify when task completed</Label>
            <p className="text-muted-foreground text-xs">Job positions and/or rules to notify when this task is approved or rejected</p>
            <PositionMultiSelect
              positions={positions}
              selectedIds={task.notifyOnCompletePositionIds}
              onChange={(ids) => onUpdate(index, { notifyOnCompletePositionIds: ids })}
              placeholder="Select positions..."
            />
            <div className="flex flex-wrap gap-4 pt-1">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={task.notifyOnCompleteSameDepartment}
                  onCheckedChange={(c) => onUpdate(index, { notifyOnCompleteSameDepartment: !!c })}
                />
                Same department as assignee
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={task.notifyOnCompleteDepartmentManager}
                  onCheckedChange={(c) => onUpdate(index, { notifyOnCompleteDepartmentManager: !!c })}
                />
                Department manager of assignee
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
}: {
  templates: Template[];
  departments: { id: string; name: string }[];
  positions: { id: string; name: string; department: { name: string } }[];
}) {
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("FiFileText");
  const [allowedDepartmentIds, setAllowedDepartmentIds] = useState<string[]>([]);
  const [tasks, setTasks] = useState<TaskInput[]>([]);

  const editing = editId ? templates.find((t) => t.id === editId) : null;

  function resetForm() {
    setName("");
    setDescription("");
    setIcon("FiFileText");
    setAllowedDepartmentIds([]);
    setTasks([]);
    setEditId(null);
  }

  function openEdit(t: Template) {
    setEditId(t.id);
    setName(t.name);
    setDescription(t.description ?? "");
    setIcon(t.icon);
    setAllowedDepartmentIds(t.allowedDepartments.map((d) => d.departmentId));
    setTasks([]);
    setOpen(true);
  }

  async function loadTemplateTasks(id: string) {
    const res = await fetch(`/api/process-templates/${id}/tasks`);
    const data = await res.json();
    if (data.tasks) {
      setTasks(
        data.tasks.map(
          (
            task: {
              name: string;
              order: number;
              description: string | null;
              needFile: boolean;
              mandatory: boolean;
              approverRoles: { jobPositionId: string }[];
              notifyOnStartPositionIds?: string[];
              notifyOnCompletePositionIds?: string[];
              approverSameDepartment?: boolean;
              approverDepartmentManager?: boolean;
              notifyOnStartSameDepartment?: boolean;
              notifyOnStartDepartmentManager?: boolean;
              notifyOnCompleteSameDepartment?: boolean;
              notifyOnCompleteDepartmentManager?: boolean;
            },
            i: number
          ) => ({
            id: `task-${task.order}-${i}-${Math.random().toString(36).slice(2)}`,
            name: task.name,
            order: task.order,
            description: task.description ?? "",
            needFile: task.needFile,
            mandatory: task.mandatory,
            approverPositionIds: task.approverRoles?.map((r: { jobPositionId: string }) => r.jobPositionId) ?? [],
            notifyOnStartPositionIds: task.notifyOnStartPositionIds ?? [],
            notifyOnCompletePositionIds: task.notifyOnCompletePositionIds ?? [],
            approverSameDepartment: task.approverSameDepartment ?? false,
            approverDepartmentManager: task.approverDepartmentManager ?? false,
            notifyOnStartSameDepartment: task.notifyOnStartSameDepartment ?? false,
            notifyOnStartDepartmentManager: task.notifyOnStartDepartmentManager ?? false,
            notifyOnCompleteSameDepartment: task.notifyOnCompleteSameDepartment ?? false,
            notifyOnCompleteDepartmentManager: task.notifyOnCompleteDepartmentManager ?? false,
          })
        )
      );
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const taskPayload = tasks.map((t, i) => ({
        name: t.name,
        order: i,
        description: t.description || undefined,
        needFile: t.needFile,
        mandatory: t.mandatory,
        approverPositionIds: t.approverPositionIds,
        notifyOnStartPositionIds: t.notifyOnStartPositionIds,
        notifyOnCompletePositionIds: t.notifyOnCompletePositionIds,
        approverSameDepartment: t.approverSameDepartment,
        approverDepartmentManager: t.approverDepartmentManager,
        notifyOnStartSameDepartment: t.notifyOnStartSameDepartment,
        notifyOnStartDepartmentManager: t.notifyOnStartDepartmentManager,
        notifyOnCompleteSameDepartment: t.notifyOnCompleteSameDepartment,
        notifyOnCompleteDepartmentManager: t.notifyOnCompleteDepartmentManager,
      }));
      if (editId) {
        await updateProcessTemplate(editId, {
          name,
          description: description || undefined,
          icon,
          allowedDepartmentIds,
          tasks: taskPayload,
        });
      } else {
        await createProcessTemplate({
          name,
          description: description || undefined,
          icon,
          allowedDepartmentIds,
          tasks: taskPayload,
        });
      }
      setOpen(false);
      resetForm();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
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

  function addTask() {
    setTasks((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: "",
        order: prev.length,
        description: "",
        needFile: false,
        mandatory: true,
        approverPositionIds: [],
        notifyOnStartPositionIds: [],
        notifyOnCompletePositionIds: [],
        approverSameDepartment: false,
        approverDepartmentManager: false,
        notifyOnStartSameDepartment: false,
        notifyOnStartDepartmentManager: false,
        notifyOnCompleteSameDepartment: false,
        notifyOnCompleteDepartmentManager: false,
      },
    ]);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setTasks((prev) => {
      const oldIndex = prev.findIndex((t) => t.id === active.id);
      const newIndex = prev.findIndex((t) => t.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  }

  function updateTask(index: number, updates: Partial<TaskInput>) {
    setTasks((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      return next;
    });
  }

  function removeTask(index: number) {
    setTasks((prev) => prev.filter((_, i) => i !== index));
  }

  const toggleDepartment = (id: string) => {
    setAllowedDepartmentIds((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
  };

  return (
    <>
      <TooltipProvider>
        <Accordion type="multiple" className="rounded-md border">
          {templates.map((t) => (
            <AccordionItem key={t.id} value={t.id} className="px-4">
              <AccordionHeader className="hover:no-underline">
                <div className="flex flex-wrap items-center gap-4 w-full py-4">
                  <AccordionTrigger asChildHeader className="flex-1 min-w-0 py-0">
                    <div className="flex flex-wrap items-center gap-4 w-full text-left">
                      <ProcessIcon icon={t.icon} className="size-5 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <span className="font-semibold">{t.name}</span>
                        {t.description && (
                          <span className="text-muted-foreground text-sm ml-2 truncate max-w-[200px] inline-block align-middle">
                            — {t.description}
                          </span>
                        )}
                      </div>
                      <div className="text-muted-foreground text-sm shrink-0">
                        {t.allowedDepartments.length
                          ? t.allowedDepartments.map((d) => d.department.name).join(", ")
                          : "—"}
                      </div>
                      <span className="text-muted-foreground text-sm shrink-0">{t._count.tasks} steps</span>
                    </div>
                  </AccordionTrigger>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        openEdit(t);
                        await loadTemplateTasks(t.id);
                      }}
                    >
                      Edit
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => setDeleteId(t.id)}>
                      Delete
                    </Button>
                  </div>
                </div>
              </AccordionHeader>
              <AccordionContent>
                <div className="pb-4">
                  <p className="text-muted-foreground text-sm mb-2">Process flow (hover a step for details)</p>
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
          if (!o) resetForm();
        }}
      >
        <DialogTrigger asChild>
          <Button
            onClick={() => {
              resetForm();
              setOpen(true);
            }}
          >
            Create template
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editId ? "Edit process template" : "Create process template"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="min-w-0 flex-1 flex flex-col">
            <Tabs defaultValue="basic" className="min-w-0 flex-1 flex flex-col">
              <TabsList>
                <TabsTrigger value="basic">Basic</TabsTrigger>
                <TabsTrigger value="access">Access</TabsTrigger>
                <TabsTrigger value="tasks">Tasks</TabsTrigger>
              </TabsList>
              <TabsContent value="basic" className="space-y-6 pt-4">
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground border-b pb-1">General</h3>
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} name="name" required placeholder="e.g. Leave request" />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea value={description} onChange={(e) => setDescription(e.target.value)} name="description" placeholder="Brief description of this process" rows={3} />
                  </div>
                </section>
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground border-b pb-1">Icon</h3>
                  <p className="text-muted-foreground text-sm">Choose an icon for this process</p>
                  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2 py-1">
                    {PROCESS_ICON_OPTIONS.map((opt) => {
                      const label = opt.replace(/^Fi/, "").replace(/([A-Z])/g, " $1").trim();
                      const isSelected = icon === opt;
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setIcon(opt)}
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
                  <input type="hidden" name="icon" value={icon} />
                </section>
              </TabsContent>
              <TabsContent value="access" className="space-y-4 pt-4">
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground border-b pb-1">Who can start this process</h3>
                  <p className="text-muted-foreground text-sm">Select departments that are allowed to start instances of this process.</p>
                <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
                  {departments.map((d) => (
                    <label key={d.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={allowedDepartmentIds.includes(d.id)}
                        onChange={() => toggleDepartment(d.id)}
                      />
                      {d.name}
                    </label>
                  ))}
                </div>
                </section>
              </TabsContent>
              <TabsContent value="tasks" className="space-y-4 pt-4">
                <TaskTimelineModal tasks={tasks} />
                <section>
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-sm font-semibold text-foreground">Task list</h3>
                    <Button type="button" variant="outline" size="sm" onClick={addTask}>
                      Add task
                    </Button>
                  </div>
                <div className="rounded-md border">
                  {tasks.length === 0 ? (
                    <p className="text-muted-foreground text-sm p-4">No tasks yet. Click &quot;Add task&quot; to add one.</p>
                  ) : (
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleDragEnd}
                    >
                      <SortableContext
                        items={tasks.map((t) => t.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <Accordion type="multiple" className="w-full">
                          {tasks.map((task, index) => (
                            <SortableTaskItem
                              key={task.id}
                              task={task}
                              index={index}
                              positions={positions}
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
              </TabsContent>
            </Tabs>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Saving..." : editId ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete process template?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the template. Existing process instances are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={loading}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
