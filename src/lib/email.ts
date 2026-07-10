import { Resend } from "resend";
import { isOutlookConfigured, sendEmailViaOutlook } from "@/lib/email-outlook";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.BPM_EMAIL_FROM ?? "BPM <onboarding@resend.dev>";

export function isEmailConfigured(): boolean {
  return isOutlookConfigured() || !!process.env.RESEND_API_KEY;
}

export async function sendEmail(params: {
  to: string | string[];
  subject: string;
  html: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (isOutlookConfigured()) {
    return sendEmailViaOutlook(params);
  }
  if (!resend) {
    return { ok: false, error: "Email is not configured (set Office 365 or RESEND_API_KEY)." };
  }
  const to = Array.isArray(params.to) ? params.to : [params.to];
  const { data, error } = await resend.emails.send({
    from: FROM,
    to,
    subject: params.subject,
    html: params.html,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/** Χρώματα, emoji & ετικέτα κατάστασης ανά τύπο ειδοποίησης */
const ACCENT = {
  assigned: { base: "#0ea5e9", soft: "#e0f2fe", text: "#0369a1", emoji: "📋", badge: "Ανάθεση" },
  started: { base: "#8b5cf6", soft: "#ede9fe", text: "#6d28d9", emoji: "⏳", badge: "Σε εξέλιξη" },
  approved: { base: "#10b981", soft: "#d1fae5", text: "#047857", emoji: "✅", badge: "Εγκρίθηκε" },
  rejected: { base: "#ef4444", soft: "#fee2e2", text: "#b91c1c", emoji: "⛔", badge: "Απορρίφθηκε" },
  completed: { base: "#06b6d4", soft: "#cffafe", text: "#0e7490", emoji: "🎉", badge: "Ολοκληρώθηκε" },
} as const;

const BRAND = process.env.BPM_EMAIL_BRAND ?? "DG-Smart · BPM";

/** Βασικό layout ειδοποιήσεων BPM – header με brand, status badge, λεπτομέρειες, CTA, footer */
function emailLayout(options: {
  title: string;
  accent: keyof typeof ACCENT;
  greeting: string;
  intro: string;
  details: Array<{ label: string; value: string }>;
  ctaUrl: string;
  ctaLabel: string;
  /** Προαιρετικό callout (π.χ. λόγος απόρριψης) με έμφαση στο χρώμα του accent */
  callout?: { label: string; value: string };
}): string {
  const c = ACCENT[options.accent];
  const detailsRows = options.details
    .map(
      (d, i) => `
    <tr><td style="padding: ${i === 0 ? "2px" : "14px"} 18px 4px 18px; border-top: ${i === 0 ? "none" : "1px solid #eef2f7"}; font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.6px; font-weight: 600;">${escapeHtml(d.label)}</td></tr>
    <tr><td style="padding: 0 18px 6px 18px; font-size: 15px; color: #0f172a; font-weight: 600;">${escapeHtml(d.value)}</td></tr>`
    )
    .join("");
  const callout = options.callout
    ? `
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 16px 0 0 0; background: ${c.soft}; border-radius: 10px;">
                <tr><td style="padding: 14px 18px 4px 18px; font-size: 11px; color: ${c.text}; text-transform: uppercase; letter-spacing: 0.6px; font-weight: 700;">${escapeHtml(options.callout.label)}</td></tr>
                <tr><td style="padding: 0 18px 14px 18px; font-size: 15px; color: #0f172a; line-height: 1.5;">${escapeHtml(options.callout.value)}</td></tr>
              </table>`
    : "";
  return `
<!DOCTYPE html>
<html lang="el">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(options.title)}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f1f5f9; line-height: 1.6;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px;">${escapeHtml(options.title)} — ${escapeHtml(options.intro)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 540px; background: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.08), 0 2px 4px -2px rgba(0,0,0,0.06); overflow: hidden;">
          <tr>
            <td style="height: 5px; background: ${c.base};"></td>
          </tr>
          <tr>
            <td style="padding: 22px 28px 0 28px;">
              <p style="margin: 0 0 18px 0; font-size: 12px; font-weight: 700; letter-spacing: 0.4px; color: #94a3b8; text-transform: uppercase;">${escapeHtml(BRAND)}</p>
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align: middle;">
                    <div style="width: 44px; height: 44px; border-radius: 12px; background: ${c.soft}; text-align: center; line-height: 44px; font-size: 22px;">${c.emoji}</div>
                  </td>
                  <td style="vertical-align: middle; padding-left: 14px;">
                    <span style="display: inline-block; padding: 3px 10px; border-radius: 999px; background: ${c.soft}; color: ${c.text}; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">${escapeHtml(c.badge)}</span>
                    <h1 style="margin: 6px 0 0 0; font-size: 21px; font-weight: 700; color: #0f172a; letter-spacing: -0.02em;">${escapeHtml(options.title)}</h1>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 28px 26px 28px;">
              <p style="margin: 0 0 14px 0; font-size: 15px; color: #334155;">${escapeHtml(options.greeting)}</p>
              <p style="margin: 0 0 20px 0; font-size: 15px; color: #475569;">${escapeHtml(options.intro)}</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f8fafc; border: 1px solid #eef2f7; border-radius: 12px; padding: 8px 0;">
                ${detailsRows}
              </table>
              ${callout}
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 26px 0 0 0;">
                <tr><td style="border-radius: 10px; background: ${c.base};">
                  <a href="${options.ctaUrl}" style="display: inline-block; padding: 13px 28px; color: #ffffff !important; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 10px;">${escapeHtml(options.ctaLabel)} →</a>
                </td></tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 18px 28px; border-top: 1px solid #eef2f7; background: #fafbfc;">
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">
                <a href="${SITE_URL}" style="color: ${c.base}; text-decoration: none; font-weight: 600;">Άνοιγμα BPM</a> · Λάβατε αυτή την ειδοποίηση από την εφαρμογή BPM σας.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export type TaskAssignedPayload = {
  assigneeEmail: string;
  assigneeName: string;
  processName: string;
  taskName: string;
  instanceId: string;
};

export function buildTaskAssignedEmail(p: TaskAssignedPayload): { subject: string; html: string } {
  const url = `${SITE_URL}/process-instances/${p.instanceId}`;
  return {
    subject: `[BPM] Ανάθεση εργασίας: ${p.taskName} – ${p.processName}`,
    html: emailLayout({
      title: "Νέα ανάθεση εργασίας",
      accent: "assigned",
      greeting: `Γεια σας ${p.assigneeName},`,
      intro: "Σας ανατέθηκε μια εργασία. Δείτε τις λεπτομέρειες παρακάτω και ανοίξτε τη διαδικασία όποτε είστε έτοιμοι.",
      details: [
        { label: "Διαδικασία", value: p.processName },
        { label: "Εργασία", value: p.taskName },
      ],
      ctaUrl: url,
      ctaLabel: "Προβολή εργασίας",
    }),
  };
}

export type TaskStartedPayload = {
  assigneeEmail: string;
  assigneeName: string;
  processName: string;
  taskName: string;
  startedByName: string;
  instanceId: string;
};

export function buildTaskStartedEmail(p: TaskStartedPayload): { subject: string; html: string } {
  const url = `${SITE_URL}/process-instances/${p.instanceId}`;
  return {
    subject: `[BPM] Έναρξη εργασίας: ${p.taskName} – ${p.processName}`,
    html: emailLayout({
      title: "Εργασία σε εξέλιξη",
      accent: "started",
      greeting: `Γεια σας ${p.assigneeName},`,
      intro: "Ξεκίνησε μια εργασία στην οποία μπορείτε να ενεργήσετε. Δείτε ποιος την ξεκίνησε και ανοίξτε τη διαδικασία παρακάτω.",
      details: [
        { label: "Διαδικασία", value: p.processName },
        { label: "Εργασία", value: p.taskName },
        { label: "Έναρξη από", value: p.startedByName },
      ],
      ctaUrl: url,
      ctaLabel: "Προβολή διαδικασίας",
    }),
  };
}

export type TaskApprovedPayload = {
  toEmail: string;
  toName: string;
  processName: string;
  taskName: string;
  approvedByName: string;
  instanceId: string;
};

export function buildTaskApprovedEmail(p: TaskApprovedPayload): { subject: string; html: string } {
  const url = `${SITE_URL}/process-instances/${p.instanceId}`;
  return {
    subject: `[BPM] Έγκριση εργασίας: ${p.taskName} – ${p.processName}`,
    html: emailLayout({
      title: "Η εργασία εγκρίθηκε",
      accent: "approved",
      greeting: `Γεια σας ${p.toName},`,
      intro: "Μια εργασία σε διαδικασία που σας αφορά εγκρίθηκε. Ακολουθούν οι λεπτομέρειες.",
      details: [
        { label: "Διαδικασία", value: p.processName },
        { label: "Εργασία", value: p.taskName },
        { label: "Εγκρίθηκε από", value: p.approvedByName },
      ],
      ctaUrl: url,
      ctaLabel: "Προβολή διαδικασίας",
    }),
  };
}

export type TaskRejectedPayload = {
  toEmail: string;
  toName: string;
  processName: string;
  taskName: string;
  rejectedByName: string;
  comment: string;
  instanceId: string;
};

export function buildTaskRejectedEmail(p: TaskRejectedPayload): { subject: string; html: string } {
  const url = `${SITE_URL}/process-instances/${p.instanceId}`;
  const details: Array<{ label: string; value: string }> = [
    { label: "Διαδικασία", value: p.processName },
    { label: "Εργασία", value: p.taskName },
    { label: "Απορρίφθηκε από", value: p.rejectedByName },
  ];
  const callout = p.comment?.trim()
    ? { label: "Λόγος απόρριψης", value: p.comment.trim() }
    : undefined;
  return {
    subject: `[BPM] Απόρριψη εργασίας: ${p.taskName} – ${p.processName}`,
    html: emailLayout({
      title: "Η εργασία απορρίφθηκε",
      accent: "rejected",
      greeting: `Γεια σας ${p.toName},`,
      intro: "Μια εργασία σε διαδικασία που σας αφορά απορρίφθηκε. Δείτε τον λόγο παρακάτω. Η διαδικασία έχει διακοπεί.",
      details,
      callout,
      ctaUrl: url,
      ctaLabel: "Προβολή διαδικασίας",
    }),
  };
}

export type ProcessCompletedPayload = {
  toEmail: string;
  toName: string;
  processName: string;
  instanceId: string;
};

export function buildProcessCompletedEmail(p: ProcessCompletedPayload): { subject: string; html: string } {
  const url = `${SITE_URL}/process-instances/${p.instanceId}`;
  return {
    subject: `[BPM] Ολοκλήρωση διαδικασίας: ${p.processName}`,
    html: emailLayout({
      title: "Η διαδικασία ολοκληρώθηκε",
      accent: "completed",
      greeting: `Γεια σας ${p.toName},`,
      intro: "Η παρακάτω διαδικασία ολοκληρώθηκε. Μπορείτε να την ανοίξετε για να δείτε το αποτέλεσμα.",
      details: [{ label: "Διαδικασία", value: p.processName }],
      ctaUrl: url,
      ctaLabel: "Προβολή διαδικασίας",
    }),
  };
}

/** Test email HTML (e.g. for "Send test email" from License modal) */
export function buildTestEmailHtml(): string {
  return emailLayout({
    title: "Δοκιμαστικό email BPM",
    accent: "assigned",
    greeting: "Γεια σας,",
    intro: "Αυτό είναι ένα δοκιμαστικό email από την εφαρμογή BPM σας. Αν το λάβατε, η αποστολή email (Office 365 ή Resend) έχει ρυθμιστεί σωστά.",
    details: [{ label: "Στάλθηκε", value: new Date().toLocaleString("el-GR") }],
    ctaUrl: SITE_URL,
    ctaLabel: "Άνοιγμα BPM",
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
