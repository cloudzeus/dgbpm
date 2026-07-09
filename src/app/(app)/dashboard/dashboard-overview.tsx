import Link from "next/link";
import {
  Activity,
  CheckCircle2,
  Clock,
  AlertTriangle,
  TimerReset,
  ListChecks,
  TrendingUp,
  Percent,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { OverviewData } from "../reports/overview-data";

type Tone = "default" | "primary" | "success" | "warning" | "danger";

const TONE: Record<Tone, { chip: string; value: string }> = {
  default: { chip: "bg-muted text-muted-foreground", value: "text-foreground" },
  primary: { chip: "bg-primary/10 text-primary", value: "text-foreground" },
  success: { chip: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", value: "text-foreground" },
  warning: { chip: "bg-amber-500/10 text-amber-600 dark:text-amber-500", value: "text-amber-600 dark:text-amber-500" },
  danger: { chip: "bg-red-500/10 text-red-600 dark:text-red-500", value: "text-red-600 dark:text-red-500" },
};

function StatTile({
  label,
  value,
  sub,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: Tone;
}) {
  const t = TONE[tone];
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className={cn("flex size-7 items-center justify-center rounded-lg", t.chip)}>
          <Icon className="size-4" />
        </span>
      </div>
      <div className={cn("mt-2 text-2xl font-bold tabular-nums", t.value)}>{value}</div>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function StatusBar({ running, completed, cancelled }: { running: number; completed: number; cancelled: number }) {
  const total = running + completed + cancelled || 1;
  const seg = [
    { n: running, cls: "bg-primary", label: "Σε εξέλιξη" },
    { n: completed, cls: "bg-emerald-500", label: "Ολοκληρωμένες" },
    { n: cancelled, cls: "bg-muted-foreground/40", label: "Ακυρωμένες" },
  ];
  return (
    <div className="space-y-2">
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
        {seg.map((s, i) => (
          <div key={i} className={s.cls} style={{ width: `${(s.n / total) * 100}%` }} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {seg.map((s, i) => (
          <span key={i} className="flex items-center gap-1.5">
            <span className={cn("size-2 rounded-full", s.cls)} />
            {s.label} <span className="font-medium text-foreground">{s.n}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function TrendChart({ trends }: { trends: OverviewData["trends"] }) {
  const w = 320;
  const h = 90;
  const pad = 6;
  const max = Math.max(1, ...trends.flatMap((t) => [t.started, t.completed]));
  const stepX = trends.length > 1 ? (w - pad * 2) / (trends.length - 1) : 0;
  const y = (v: number) => h - pad - (v / max) * (h - pad * 2);
  const line = (key: "started" | "completed") =>
    trends.map((t, i) => `${pad + i * stepX},${y(t[key])}`).join(" ");
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-24 w-full" preserveAspectRatio="none">
        <polyline points={line("started")} fill="none" className="stroke-primary" strokeWidth={2} />
        <polyline points={line("completed")} fill="none" className="stroke-emerald-500" strokeWidth={2} strokeDasharray="4 3" />
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        {trends.map((t) => (
          <span key={t.month}>{t.label}</span>
        ))}
      </div>
      <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-primary" /> Ξεκίνησαν</span>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-emerald-500" /> Ολοκληρώθηκαν</span>
      </div>
    </div>
  );
}

export function DashboardOverview({ data }: { data: OverviewData }) {
  const { kpis, delayed } = data;
  const topDelayed = delayed.slice(0, 6);

  return (
    <div className="space-y-4">
      {/* KPI tiles */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <StatTile label="Σε εξέλιξη" value={kpis.running} icon={Activity} tone="primary" />
        <StatTile label="Ενεργές εργασίες" value={kpis.activeTasks} icon={ListChecks} />
        <StatTile
          label="Εκπρόθεσμες εργασίες"
          value={kpis.overdueTasks}
          icon={AlertTriangle}
          tone={kpis.overdueTasks > 0 ? "danger" : "default"}
        />
        <StatTile
          label="Σε κίνδυνο (SLA)"
          value={kpis.atRiskTasks}
          icon={Clock}
          tone={kpis.atRiskTasks > 0 ? "warning" : "default"}
        />
        <StatTile label="Ολοκληρωμένες" value={kpis.completed} icon={CheckCircle2} tone="success" />
        <StatTile
          label="Ποσοστό ολοκλήρωσης"
          value={`${kpis.completionRatePct}%`}
          icon={Percent}
          sub={kpis.avgCompletionDays != null ? `~${kpis.avgCompletionDays} μέρες μ.ό.` : undefined}
        />
      </div>

      {/* charts + delayed */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold">Κατάσταση διαδικασιών</h3>
          <StatusBar running={kpis.running} completed={kpis.completed} cancelled={kpis.cancelled} />
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-muted/40 p-2.5">
              <p className="text-xs text-muted-foreground">Εκπρόθεσμες διαδικασίες</p>
              <p className={cn("text-lg font-bold", kpis.overdueInstances > 0 && "text-red-600 dark:text-red-500")}>
                {kpis.overdueInstances}
              </p>
            </div>
            <div className="rounded-lg bg-muted/40 p-2.5">
              <p className="text-xs text-muted-foreground">Ποσοστό απορρίψεων</p>
              <p className="text-lg font-bold">{kpis.rejectionRatePct}%</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
            <TrendingUp className="size-4 text-muted-foreground" /> Τάση (6 μήνες)
          </h3>
          <TrendChart trends={data.trends} />
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold">
              <TimerReset className="size-4 text-muted-foreground" /> Καθυστερήσεις
            </h3>
            <Link href="/reports/overview" className="text-xs text-primary hover:underline">
              Όλες
            </Link>
          </div>
          {topDelayed.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Καμία καθυστέρηση 🎉</p>
          ) : (
            <ul className="space-y-2">
              {topDelayed.map((d) => (
                <li key={`${d.instanceId}-${d.order}`} className="flex items-center gap-2 text-sm">
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                      d.severity === "overdue"
                        ? "bg-red-500/10 text-red-600 dark:text-red-500"
                        : "bg-amber-500/10 text-amber-600 dark:text-amber-500",
                    )}
                  >
                    {d.severity === "overdue" ? `+${d.overdueDays}μ` : "σύντομα"}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-medium">{d.stepName}</span>
                    <span className="text-muted-foreground"> · {d.instanceName}</span>
                  </span>
                  {d.assigneeName && (
                    <span className="shrink-0 truncate text-xs text-muted-foreground">{d.assigneeName}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
