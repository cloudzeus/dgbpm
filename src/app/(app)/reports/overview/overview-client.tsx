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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
        <div className="text-xs text-muted-foreground truncate">{label}</div>
        <div className={`text-2xl font-semibold tabular-nums ${toneCls[tone]}`}>{value}</div>
        {hint && <div className="text-xs text-muted-foreground truncate">{hint}</div>}
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
          <h3 className="font-semibold text-sm">Ροή διαδικασιών (τελευταίοι 6 μήνες)</h3>
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
            <span className="text-xs text-muted-foreground">{t.label}</span>
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
  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold text-sm flex items-center gap-2">
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
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Κατάσταση</TableHead>
                <TableHead>Διαδικασία</TableHead>
                <TableHead>Βήμα</TableHead>
                <TableHead>Υπεύθυνος</TableHead>
                <TableHead className="text-right">Ηλικία</TableHead>
                <TableHead className="w-[90px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {delayed.map((d, i) => (
                <TableRow key={`${d.instanceId}-${d.stepName}-${i}`}>
                  <TableCell>
                    <DelayBadge item={d} />
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{d.instanceName}</div>
                    <div className="text-xs text-muted-foreground">{d.templateName}</div>
                  </TableCell>
                  <TableCell>
                    <span className="text-muted-foreground text-xs tabular-nums mr-1">#{d.order}</span>
                    {d.stepName}
                  </TableCell>
                  <TableCell className="text-sm">{d.assigneeName ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums text-sm">{d.ageDays}μ</TableCell>
                  <TableCell>
                    <Link
                      href={`/process-instances/${d.instanceId}`}
                      className="text-primary text-sm underline underline-offset-2"
                    >
                      Άνοιγμα
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function BottlenecksSection({ bottlenecks }: { bottlenecks: Bottleneck[] }) {
  const rows = bottlenecks.filter((b) => b.totalHandled > 0).slice(0, 10);
  return (
    <div className="rounded-lg border bg-card">
      <div className="p-4 border-b">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <Timer className="size-4 text-muted-foreground" />
          Σημεία συμφόρησης ανά βήμα
        </h3>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground p-6 text-center">Δεν υπάρχουν δεδομένα ακόμη.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Βήμα</TableHead>
                <TableHead className="text-right">Ενεργά</TableHead>
                <TableHead className="text-right">Καθυστ/να</TableHead>
                <TableHead className="text-right">Μέσος χρόνος</TableHead>
                <TableHead className="text-right">Απορρίψεις</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((b) => (
                <TableRow key={b.templateTaskId}>
                  <TableCell>
                    <div className="font-medium">{b.stepName}</div>
                    <div className="text-xs text-muted-foreground">{b.templateName}</div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{b.activeCount}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {b.overdueCount > 0 ? (
                      <span className="text-destructive font-medium">{b.overdueCount}</span>
                    ) : (
                      "0"
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {b.avgProcessingDays == null ? "—" : `${b.avgProcessingDays}μ`}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {b.rejectionRatePct > 0 ? (
                      <span className={b.rejectionRatePct >= 30 ? "text-destructive font-medium" : ""}>
                        {b.rejectionRatePct}%
                      </span>
                    ) : (
                      "0%"
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function WorkloadUsers({ users }: { users: WorkloadUser[] }) {
  const rows = users.slice(0, 10);
  return (
    <div className="rounded-lg border bg-card">
      <div className="p-4 border-b">
        <h3 className="font-semibold text-sm">Φόρτος ανά χρήστη</h3>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground p-6 text-center">Καμία ενεργή ανάθεση.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Χρήστης</TableHead>
                <TableHead className="text-right">Αναμονή</TableHead>
                <TableHead className="text-right">Σε εξέλιξη</TableHead>
                <TableHead className="text-right">Καθυστ/να</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((u) => (
                <TableRow key={u.userId}>
                  <TableCell>
                    <div className="font-medium">{u.userName}</div>
                    <div className="text-xs text-muted-foreground">{roleLabel(u.role)}</div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{u.pending}</TableCell>
                  <TableCell className="text-right tabular-nums">{u.inProgress}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {u.overdue > 0 ? (
                      <span className="text-destructive font-medium">{u.overdue}</span>
                    ) : (
                      "0"
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function WorkloadDepts({ depts }: { depts: WorkloadDept[] }) {
  return (
    <div className="rounded-lg border bg-card">
      <div className="p-4 border-b">
        <h3 className="font-semibold text-sm">Φόρτος ανά τμήμα</h3>
      </div>
      {depts.length === 0 ? (
        <p className="text-sm text-muted-foreground p-6 text-center">Καμία ενεργή ανάθεση.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Τμήμα</TableHead>
                <TableHead className="text-right">Αναμονή</TableHead>
                <TableHead className="text-right">Σε εξέλιξη</TableHead>
                <TableHead className="text-right">Καθυστ/να</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {depts.map((d) => (
                <TableRow key={d.departmentId}>
                  <TableCell>
                    <span className="flex items-center gap-2 font-medium">
                      <span
                        className="size-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: d.color }}
                      />
                      {d.name}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{d.pending}</TableCell>
                  <TableCell className="text-right tabular-nums">{d.inProgress}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {d.overdue > 0 ? (
                      <span className="text-destructive font-medium">{d.overdue}</span>
                    ) : (
                      "0"
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
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

      <p className="text-xs text-muted-foreground">
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
