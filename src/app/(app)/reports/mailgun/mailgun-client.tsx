"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Send,
  MailCheck,
  Eye,
  MousePointerClick,
  XCircle,
  UserMinus,
  AlertTriangle,
  Link2,
} from "lucide-react";
import type { MailgunStatsData, MailgunStatPoint } from "../mailgun-data";

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

function VolumeChart({ points }: { points: MailgunStatPoint[] }) {
  const max = Math.max(1, ...points.map((p) => Math.max(p.delivered, p.opened, p.clicked)));
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="ui-section-title">Ημερήσια δραστηριότητα</h3>
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-emerald-500" /> Παραδόθηκαν
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-blue-500" /> Ανοίχτηκαν
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-violet-500" /> Κλικ
          </span>
        </div>
      </div>
      <div className="flex items-end justify-between gap-1.5 h-40 overflow-x-auto">
        {points.map((p) => (
          <div key={p.date} className="flex-1 flex flex-col items-center gap-2 min-w-[14px]">
            <div className="flex items-end gap-0.5 w-full justify-center h-32">
              <div
                className="w-1/3 max-w-4 rounded-t bg-emerald-500"
                style={{ height: `${(p.delivered / max) * 100}%` }}
                title={`${p.delivered} παραδόθηκαν`}
              />
              <div
                className="w-1/3 max-w-4 rounded-t bg-blue-500"
                style={{ height: `${(p.opened / max) * 100}%` }}
                title={`${p.opened} ανοίχτηκαν`}
              />
              <div
                className="w-1/3 max-w-4 rounded-t bg-violet-500"
                style={{ height: `${(p.clicked / max) * 100}%` }}
                title={`${p.clicked} κλικ`}
              />
            </div>
            <span className="text-[10px] text-muted-foreground whitespace-nowrap">{p.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RangeSelector({ current }: { current: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const options = [
    { days: 7, label: "7 ημέρες" },
    { days: 30, label: "30 ημέρες" },
    { days: 90, label: "90 ημέρες" },
  ];
  function select(days: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("days", String(days));
    router.push(`${pathname}?${params.toString()}`);
  }
  return (
    <div className="inline-flex rounded-lg border bg-card p-0.5">
      {options.map((o) => (
        <button
          key={o.days}
          onClick={() => select(o.days)}
          className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
            current === o.days
              ? "bg-[#0c0ce5] text-white"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function MailgunClient({ data }: { data: MailgunStatsData }) {
  if (!data.configured) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center">
        <Link2 className="mx-auto mb-3 size-8 text-muted-foreground" />
        <h3 className="ui-section-title">Δεν έχει ρυθμιστεί το Mailgun</h3>
        <p className="mt-1 ui-meta">
          Ρυθμίστε το domain και το API Key για να δείτε στατιστικά αποστολής.
        </p>
        <Link
          href="/settings/connectors"
          className="mt-4 inline-block rounded-md bg-[#0c0ce5] px-4 py-2 text-sm text-white"
        >
          Ρύθμιση διασύνδεσης
        </Link>
      </div>
    );
  }

  const t = data.totals;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          Domain: <span className="font-medium text-foreground">{data.domain}</span>
          {!data.enabled && (
            <span className="ml-2 rounded bg-amber-500/10 px-2 py-0.5 text-xs text-amber-600 dark:text-amber-500">
              Ανενεργός
            </span>
          )}
        </div>
        <RangeSelector current={data.rangeDays} />
      </div>

      {data.error && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{data.error}</span>
        </div>
      )}

      {!data.error && (
        <>
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <StatCard icon={Send} label="Απεστάλησαν" value={t.accepted} tone="info" />
            <StatCard
              icon={MailCheck}
              label="Παραδόθηκαν"
              value={t.delivered}
              hint={`${data.deliveryRate}% delivery rate`}
              tone="success"
            />
            <StatCard
              icon={Eye}
              label="Ανοίχτηκαν"
              value={t.opened}
              hint={`${data.openRate}% open rate`}
              tone="info"
            />
            <StatCard
              icon={MousePointerClick}
              label="Κλικ"
              value={t.clicked}
              hint={`${data.clickRate}% click rate`}
              tone="neutral"
            />
            <StatCard
              icon={XCircle}
              label="Απέτυχαν"
              value={t.failed}
              hint={`${data.failRate}% fail rate`}
              tone="danger"
            />
            <StatCard icon={UserMinus} label="Απεγγραφές" value={t.unsubscribed} tone="warning" />
            <StatCard icon={AlertTriangle} label="Παράπονα (spam)" value={t.complained} tone="warning" />
          </div>

          {data.points.length > 0 ? (
            <VolumeChart points={data.points} />
          ) : (
            <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
              Δεν υπάρχουν δεδομένα αποστολής για το επιλεγμένο διάστημα.
            </div>
          )}
        </>
      )}
    </div>
  );
}
