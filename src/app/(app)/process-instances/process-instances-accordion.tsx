"use client";

import {
  Accordion,
  AccordionContent,
  AccordionHeader,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { ProcessIcon } from "@/lib/process-icons";
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

function ProcessStepDots({ tasks }: { tasks: InstanceTask[] }) {
  const ordered = [...tasks].sort((a, b) => a.templateTask.order - b.templateTask.order);
  return (
    <div className="flex items-center gap-0.5" title={`${tasks.filter((t) => t.status === "APPROVED").length}/${tasks.length} steps`}>
      {ordered.map((t, idx) => {
        const color =
          t.status === "APPROVED"
            ? "bg-emerald-500"
            : t.status === "REJECTED"
              ? "bg-destructive"
              : t.status === "IN_PROGRESS"
                ? "bg-blue-500 animate-pulse"
                : t.status === "SKIPPED"
                  ? "bg-muted-foreground/40"
                  : "bg-amber-500";
        return (
          <span key={t.id} className="flex items-center">
            <span
              className={`inline-block size-2 rounded-full ${color} ring-1 ring-background`}
              aria-hidden
            />
            {idx < ordered.length - 1 && (
              <span className="w-1 h-px bg-border mx-0.5" aria-hidden />
            )}
          </span>
        );
      })}
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
    <Accordion type="single" collapsible className="rounded-md border">
      {instances.map((i) => (
        <AccordionItem key={i.id} value={i.id} className="px-4">
          <AccordionHeader className="hover:no-underline">
            <AccordionTrigger asChildHeader className="flex-1 py-4">
              <div className="flex flex-wrap items-center gap-4 w-full text-left">
                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex items-center justify-center size-10 rounded-lg bg-primary/10 text-primary border border-primary/20">
                    <ProcessIcon icon={i.processTemplate.icon} className="size-5" />
                  </div>
                  <ProcessStepDots tasks={i.tasks} />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="font-semibold">{i.name}</span>
                  <span className="text-muted-foreground text-sm ml-2">
                    {i.processTemplate.name}
                  </span>
                </div>
                <div className="text-muted-foreground text-sm shrink-0 hidden sm:block">
                  {i.startedBy.firstName} {i.startedBy.lastName}
                </div>
                <Badge
                  variant={
                    i.status === "COMPLETED"
                      ? "success"
                      : i.status === "CANCELLED"
                        ? "destructive"
                        : i.status === "RUNNING"
                          ? "info"
                          : "secondary"
                  }
                  className="shrink-0"
                >
                  {i.status}
                </Badge>
                <span className="text-muted-foreground text-sm shrink-0 tabular-nums">
                  {new Date(i.startDateTime).toLocaleDateString()}
                </span>
              </div>
            </AccordionTrigger>
          </AccordionHeader>
          <AccordionContent>
            <div className="pt-2 pb-4">
              <div className="grid gap-4 md:grid-cols-2 text-sm mb-4 pb-4 border-b">
                <div>
                  <span className="text-muted-foreground">Started by:</span>{" "}
                  {i.startedBy.firstName} {i.startedBy.lastName}
                </div>
                <div>
                  <span className="text-muted-foreground">Start:</span>{" "}
                  {new Date(i.startDateTime).toLocaleString()}
                </div>
                {i.endDateTime && (
                  <div>
                    <span className="text-muted-foreground">End:</span>{" "}
                    {new Date(i.endDateTime).toLocaleString()}
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
  );
}
