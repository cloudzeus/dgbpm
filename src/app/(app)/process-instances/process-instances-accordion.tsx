"use client";

import {
  Accordion,
  AccordionContent,
  AccordionHeader,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { ProcessIcon } from "@/lib/process-icons";
import { taskStatusMeta, instanceStatusMeta, taskProgress } from "@/lib/process-status";
import { formatDate, formatDateTime } from "@/lib/format";
import { ProcessInstanceDetail } from "./[id]/process-instance-detail";

export type InstanceTask = {
  id: string;
  status: string;
  startedAt: Date | null;
  completedAt: Date | null;
  comment: string | null;
  fileUrl: string | null;
  templateTask: {
    name: string;
    description: string | null;
    needFile: boolean;
    mandatory: boolean;
    order: number;
  };
  currentAssignee: { firstName: string; lastName: string } | null;
  possibleAssignees: { id: string }[];
  actions: {
    action: string;
    message: string | null;
    createdAt: Date;
    user: { firstName: string; lastName: string };
  }[];
};

export type ProcessInstanceWithTasks = {
  id: string;
  name: string;
  status: string;
  startDateTime: Date;
  endDateTime: Date | null;
  processTemplate: { name: string; icon: string };
  startedBy: { firstName: string; lastName: string; email: string };
  tasks: InstanceTask[];
};

function ProcessProgress({ tasks }: { tasks: InstanceTask[] }) {
  const ordered = [...tasks].sort((a, b) => a.templateTask.order - b.templateTask.order);
  const { total, done, rejected, pct } = taskProgress(tasks);

  return (
    <div className="w-40 sm:w-48 shrink-0">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium text-muted-foreground tabular-nums">
          {done}/{total} βήματα
        </span>
        <span className="text-xs font-semibold tabular-nums text-foreground">{pct}%</span>
      </div>
      {/* progress track */}
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            rejected ? "bg-destructive" : done === total ? "bg-emerald-500" : "bg-blue-500"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {/* per-step markers */}
      <div className="mt-1.5 flex items-center gap-1">
        {ordered.map((t) => {
          const meta = taskStatusMeta(t.status);
          return (
            <Tooltip key={t.id}>
              <TooltipTrigger asChild>
                <span
                  className={`h-1.5 flex-1 rounded-full ${meta.dot} ${
                    t.status === "IN_PROGRESS" ? "animate-pulse" : ""
                  } ${t.status === "PENDING" ? "opacity-40" : ""}`}
                  aria-hidden
                />
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <span className="font-medium">{t.templateTask.name}</span> — {meta.label}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}

export function ProcessInstancesAccordion({
  instances,
  currentUserId,
  isSuperOrAdmin,
}: {
  instances: ProcessInstanceWithTasks[];
  currentUserId: string;
  isSuperOrAdmin: boolean;
}) {
  return (
    <TooltipProvider delayDuration={100}>
    <Accordion type="single" collapsible className="rounded-md border">
      {instances.map((i) => (
        <AccordionItem key={i.id} value={i.id} className="px-4">
          <AccordionHeader className="hover:no-underline">
            <AccordionTrigger asChildHeader className="flex-1 py-4">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-3 w-full text-left">
                {/* icon + title block */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="flex items-center justify-center size-10 shrink-0 rounded-lg bg-primary/10 text-primary border border-primary/20">
                    <ProcessIcon icon={i.processTemplate.icon} className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{i.name}</div>
                    <div className="ui-meta truncate">
                      {i.processTemplate.name} · {i.startedBy.firstName} {i.startedBy.lastName}
                    </div>
                  </div>
                </div>

                {/* progress */}
                <ProcessProgress tasks={i.tasks} />

                {/* status + date */}
                <div className="flex items-center gap-3 shrink-0">
                  {(() => {
                    const s = instanceStatusMeta(i.status);
                    return (
                      <Badge variant={s.variant} className="gap-1.5">
                        <span className={`size-1.5 rounded-full ${s.dot} ring-1 ring-white/40`} aria-hidden />
                        {s.label}
                      </Badge>
                    );
                  })()}
                  <span className="text-muted-foreground text-sm tabular-nums w-20 text-right hidden sm:inline">
                    {formatDate(i.startDateTime)}
                  </span>
                </div>
              </div>
            </AccordionTrigger>
          </AccordionHeader>
          <AccordionContent>
            <div className="pt-2 pb-4">
              <div className="grid gap-4 md:grid-cols-2 text-sm mb-4 pb-4 border-b">
                <div>
                  <span className="text-muted-foreground">Εκκίνηση από:</span>{" "}
                  {i.startedBy.firstName} {i.startedBy.lastName}
                </div>
                <div>
                  <span className="text-muted-foreground">Έναρξη:</span>{" "}
                  {formatDateTime(i.startDateTime)}
                </div>
                {i.endDateTime && (
                  <div>
                    <span className="text-muted-foreground">Λήξη:</span>{" "}
                    {formatDateTime(i.endDateTime)}
                  </div>
                )}
              </div>
              <ProcessInstanceDetail
                instance={{ id: i.id, status: i.status, tasks: i.tasks }}
                currentUserId={currentUserId}
                isSuperOrAdmin={isSuperOrAdmin}
              />
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
    </TooltipProvider>
  );
}
