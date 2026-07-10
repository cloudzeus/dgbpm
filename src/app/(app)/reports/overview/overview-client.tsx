"use client";

import Link from "next/link";
import {
  AlertTriangle,
  Clock,
  CheckCircle2,
  Activity,
  XCircle,
  Timer,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { roleLabel } from "@/lib/role-labels";
import type {
  OverviewData,
  DelayedItem,
  Bottleneck,
  WorkloadUser,
  WorkloadDept,
  TrendPoint,
} from "../overview-data";

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "neutral",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  hint?: string;
  tone?: "neutral" | "danger" | "warning" | "success" | "info";
}) {
  const toneCls: Record<string, string> = {
    neutral: "text-foreground",
    danger: "text-destructive",
    warning: "text-amber-600 dark:text-amber-500",
    success: "text-emerald-600 dark:text-emerald-500",
    info: "text-blue-600 dark:text-blue-500",
  };
  const iconBg: Record<string, string> = {
    neutral: "bg-muted text-muted-foreground",
    danger: "bg-destructive/10 text-destructive",
    warning: "bg-amber-500/10 text-amber-600 dark:text-amber-500",
    success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-500",
    info: "bg-blue-500/10 text-blue-600 dark:text-blue-500",
  };
  return (
    <div className="rounded-lg border bg-card p-4 flex items-start gap-3">
      <div className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${iconBg[tone]}`}>
        <Icon className="size-5" />
      </div>
      <div className="min-w-0">
        <div className="ui-eyebrow truncate">{label}</div>
        <div className={`ui-metric ${toneCls[tone]}`}>{value}</div>
        {hint && <div className="ui-meta truncate">{hint}</div>}
      </div>
    </div>
  );
}

function TrendChart({ trends }: { trends: TrendPoint[] }) {
  const max = Math.max(1, ...trends.map((t) => Math.max(t.started, t.completed)));
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="size-4 text-muted-foreground" />
          <h3 className="ui-section-title">Ροή διαδικασιών (τελευταίοι 6 μήνες)</h3>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-blue-500" /> Ξεκίνησαν
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-emerald-500" /> Ολοκληρώθηκαν
          </span>
        </div>
      </div>
      <div className="flex items-end justify-between gap-3 h-40">
        {trends.map((t) => (
          <div key={t.month} className="flex-1 flex flex-col items-center gap-2 min-w-0">
            <div className="flex items-end gap-1 w-full justify-center h-32">
              <div
                className="w-1/3 max-w-6 rounded-t bg-blue-500 relative group"
                style={{ height: `${(t.started / max) * 100}%` }}
                title={`${t.started} ξεκίνησαν`}
              >
                <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[10px] tabular-nums text-muted-foreground opacity-0 group-hover:opacity-100">
                  {t.started}
                </span>
              </div>
              <div
                className="w-1/3 max-w-6 rounded-t bg-emerald-500 relative group"
                style={{ height: `${(t.completed / max) * 100}%` }}
                title={`${t.completed} ολοκληρώθηκαν`}
              >
                <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[10px] tabular-nums text-muted-foreground opacity-0 group-hover:opacity-100">
                  {t.completed}
                </span>
              </div>
            </div>
            <span className="ui-meta">{t.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DelayBadge({ item }: { item: DelayedItem }) {
  if (item.severity === "overdue") {
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertTriangle className="size-3" />
        {item.overdueDays > 0 ? `+${item.overdueDays}μ καθυστέρηση` : "Καθυστερημένη"}
      </Badge>
    );
  }
  return (
    <Badge variant="warning" className="gap-1">
      <Clock className="size-3" /> Σε κίνδυνο
    </Badge>
  );
}

function DelayedSection({ delayed }: { delayed: DelayedItem[] }) {
  const columns: DataTableColumn<DelayedItem>[] = [
    {
      key: "status",
      header: "Κατάσταση",
      cell: (d) => <DelayBadge item={d} />,
    },
    {
      key: "process",
      header: "Διαδικασία",
      cell: (d) => (
        <>
          <div className="font-medium">{d.instanceName}</div>
          <div className="ui-meta">{d.templateName}</div>
        </>
      ),
    },
    {
      key: "step",
      header: "Βήμα",
      cell: (d) => (
        <>
          <span className="ui-meta tabular-nums mr-1">#{d.order}</span>
          {d.stepName}
        </>
      ),
    },
    {
      key: "assignee",
      header: "Υπεύθυνος",
      cell: (d) => <span className="text-sm">{d.assigneeName ?? "—"}</span>,
    },
    {
      key: "age",
      header: "Ηλικία",
      align: "right",
      cell: (d) => <span className="tabular-nums text-sm">{d.ageDays}μ</span>,
    },
    {
      key: "open",
      header: "",
      cell: (d) => (
        <Link
          href={`/process-instances/${d.instanceId}`}
          className="text-primary text-sm underline underline-offset-2"
        >
          Άνοιγμα
        </Link>
      ),
    },
  ];
  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="ui-section-title flex items-center gap-2">
          <AlertTriangle className="size-4 text-destructive" />
          Καθυστερημένες & σε κίνδυνο εργασίες
        </h3>
        <Badge variant="secondary">{delayed.length}</Badge>
      </div>
      {delayed.length === 0 ? (
        <p className="text-sm text-muted-foreground p-6 text-center">
          Καμία καθυστερημένη εργασία — όλα εντός προθεσμίας. 🎉
        </p>
      ) : (
        <DataTable
          columns={columns}
          data={delayed}
          rowKey={(d) => `${d.instanceId}-${d.stepName}-${d.order}`}
        />
      )}
    </div>
  );
}

function BottlenecksSection({ bottlenecks }: { bottlenecks: Bottleneck[] }) {
  const rows = bottlenecks.filter((b) => b.totalHandled > 0).slice(0, 10);
  const columns: DataTableColumn<Bottleneck>[] = [
    {
      key: "step",
      header: "Βήμα",
      cell: (b) => (
        <>
          <div className="font-medium">{b.stepName}</div>
          <div className="ui-meta">{b.templateName}</div>
        </>
      ),
    },
    {
      key: "active",
      header: "Ενεργά",
      align: "right",
      cell: (b) => <span className="tabular-nums">{b.activeCount}</span>,
    },
    {
      key: "overdue",
      header: "Καθυστ/να",
      align: "right",
      cell: (b) => (
        <span className="tabular-nums">
          {b.overdueCount > 0 ? (
            <span className="text-destructive font-medium">{b.overdueCount}</span>
          ) : (
            "0"
          )}
        </span>
      ),
    },
    {
      key: "avg",
      header: "Μέσος χρόνος",
      align: "right",
      cell: (b) => (
        <span className="tabular-nums">
          {b.avgProcessingDays == null ? "—" : `${b.avgProcessingDays}μ`}
        </span>
      ),
    },
    {
      key: "rejections",
      header: "Απορρίψεις",
      align: "right",
      cell: (b) => (
        <span className="tabular-nums">
          {b.rejectionRatePct > 0 ? (
            <span className={b.rejectionRatePct >= 30 ? "text-destructive font-medium" : ""}>
              {b.rejectionRatePct}%
            </span>
          ) : (
            "0%"
          )}
        </span>
      ),
    },
  ];
  return (
    <div className="rounded-lg border bg-card">
      <div className="p-4 border-b">
        <h3 className="ui-section-title flex items-center gap-2">
          <Timer className="size-4 text-muted-foreground" />
          Σημεία συμφόρησης ανά βήμα
        </h3>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground p-6 text-center">Δεν υπάρχουν δεδομένα ακόμη.</p>
      ) : (
        <DataTable columns={columns} data={rows} rowKey={(b) => String(b.templateTaskId)} />
      )}
    </div>
  );
}

function WorkloadUsers({ users }: { users: WorkloadUser[] }) {
  const rows = users.slice(0, 10);
  const columns: DataTableColumn<WorkloadUser>[] = [
    {
      key: "user",
      header: "Χρήστης",
      cell: (u) => (
        <>
          <div className="font-medium">{u.userName}</div>
          <div className="ui-meta">{roleLabel(u.role)}</div>
        </>
      ),
    },
    {
      key: "pending",
      header: "Αναμονή",
      align: "right",
      cell: (u) => <span className="tabular-nums">{u.pending}</span>,
    },
    {
      key: "inProgress",
      header: "Σε εξέλιξη",
      align: "right",
      cell: (u) => <span className="tabular-nums">{u.inProgress}</span>,
    },
    {
      key: "overdue",
      header: "Καθυστ/να",
      align: "right",
      cell: (u) => (
        <span className="tabular-nums">
          {u.overdue > 0 ? (
            <span className="text-destructive font-medium">{u.overdue}</span>
          ) : (
            "0"
          )}
        </span>
      ),
    },
  ];
  return (
    <div className="rounded-lg border bg-card">
      <div className="p-4 border-b">
        <h3 className="ui-section-title">Φόρτος ανά χρήστη</h3>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground p-6 text-center">Καμία ενεργή ανάθεση.</p>
      ) : (
        <DataTable columns={columns} data={rows} rowKey={(u) => String(u.userId)} />
      )}
    </div>
  );
}

function WorkloadDepts({ depts }: { depts: WorkloadDept[] }) {
  const columns: DataTableColumn<WorkloadDept>[] = [
    {
      key: "dept",
      header: "Τμήμα",
      cell: (d) => (
        <span className="flex items-center gap-2 font-medium">
          <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
          {d.name}
        </span>
      ),
    },
    {
      key: "pending",
      header: "Αναμονή",
      align: "right",
      cell: (d) => <span className="tabular-nums">{d.pending}</span>,
    },
    {
      key: "inProgress",
      header: "Σε εξέλιξη",
      align: "right",
      cell: (d) => <span className="tabular-nums">{d.inProgress}</span>,
    },
    {
      key: "overdue",
      header: "Καθυστ/να",
      align: "right",
      cell: (d) => (
        <span className="tabular-nums">
          {d.overdue > 0 ? (
            <span className="text-destructive font-medium">{d.overdue}</span>
          ) : (
            "0"
          )}
        </span>
      ),
    },
  ];
  return (
    <div className="rounded-lg border bg-card">
      <div className="p-4 border-b">
        <h3 className="ui-section-title">Φόρτος ανά τμήμα</h3>
      </div>
      {depts.length === 0 ? (
        <p className="text-sm text-muted-foreground p-6 text-center">Καμία ενεργή ανάθεση.</p>
      ) : (
        <DataTable columns={columns} data={depts} rowKey={(d) => String(d.departmentId)} />
      )}
    </div>
  );
}

export function OverviewClient({ data }: { data: OverviewData }) {
  const { kpis, delayed, bottlenecks, workloadUsers, workloadDepts, trends, defaultSlaDays } = data;
  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Activity} label="Ενεργές διαδικασίες" value={kpis.running} tone="info" />
        <StatCard
          icon={AlertTriangle}
          label="Καθυστερημένες εργασίες"
          value={kpis.overdueTasks}
          hint={`${kpis.overdueInstances} διαδικασίες επηρεάζονται`}
          tone={kpis.overdueTasks > 0 ? "danger" : "success"}
        />
        <StatCard
          icon={Clock}
          label="Σε κίνδυνο"
          value={kpis.atRiskTasks}
          hint="πλησιάζουν την προθεσμία"
          tone={kpis.atRiskTasks > 0 ? "warning" : "neutral"}
        />
        <StatCard
          icon={Timer}
          label="Μέσος χρόνος ολοκλήρωσης"
          value={kpis.avgCompletionDays == null ? "—" : `${kpis.avgCompletionDays}μ`}
          tone="neutral"
        />
        <StatCard icon={CheckCircle2} label="Ολοκληρωμένες" value={kpis.completed} tone="success" />
        <StatCard
          icon={TrendingUp}
          label="Ποσοστό ολοκλήρωσης"
          value={`${kpis.completionRatePct}%`}
          tone="neutral"
        />
        <StatCard
          icon={XCircle}
          label="Ποσοστό απορρίψεων"
          value={`${kpis.rejectionRatePct}%`}
          tone={kpis.rejectionRatePct >= 30 ? "danger" : "neutral"}
        />
        <StatCard icon={Activity} label="Ενεργές εργασίες" value={kpis.activeTasks} tone="neutral" />
      </div>

      <p className="ui-meta">
        Οι καθυστερήσεις υπολογίζονται από την προθεσμία κάθε βήματος (ή {defaultSlaDays} μέρες όπου δεν έχει
        οριστεί).
      </p>

      <TrendChart trends={trends} />

      <DelayedSection delayed={delayed} />

      <div className="grid gap-6 lg:grid-cols-2">
        <BottlenecksSection bottlenecks={bottlenecks} />
        <div className="space-y-6">
          <WorkloadUsers users={workloadUsers} />
          <WorkloadDepts depts={workloadDepts} />
        </div>
      </div>
    </div>
  );
}
