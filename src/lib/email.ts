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

/** Accent colors per notification type (hex for email clients) */
const ACCENT = {
  assigned: "#0ea5e9",
  started: "#8b5cf6",
  approved: "#10b981",
  rejected: "#ef4444",
  completed: "#06b6d4",
} as const;

/** Base layout for BPM notification emails – branded header, card body, CTA button, footer */
function emailLayout(options: {
  title: string;
  accent: keyof typeof ACCENT;
  greeting: string;
  intro: string;
  details: Array<{ label: string; value: string }>;
  ctaUrl: string;
  ctaLabel: string;
}): string {
  const color = ACCENT[options.accent];
  const detailsRows = options.details
    .map(
      (d) => `
    <tr><td style="padding: 12px 16px 4px 16px; font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">${escapeHtml(d.label)}</td></tr>
    <tr><td style="padding: 0 16px 14px 16px; font-size: 15px; color: #0f172a; font-weight: 500;">${escapeHtml(d.value)}</td></tr>`
    )
    .join("");
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(options.title)}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f1f5f9; line-height: 1.6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 520px; background: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1); overflow: hidden;">
          <tr>
            <td style="height: 4px; background: ${color};"></td>
          </tr>
          <tr>
            <td style="padding: 24px 28px 16px 28px;">
              <h1 style="margin: 0; font-size: 20px; font-weight: 700; color: #0f172a; letter-spacing: -0.025em;">${escapeHtml(options.title)}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 28px 24px 28px;">
              <p style="margin: 0 0 16px 0; font-size: 15px; color: #334155;">${escapeHtml(options.greeting)}</p>
              <p style="margin: 0 0 20px 0; font-size: 15px; color: #475569;">${escapeHtml(options.intro)}</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f8fafc; border-radius: 8px; padding: 4px;">
                ${detailsRows}
              </table>
              <p style="margin: 24px 0 0 0;">
                <a href="${options.ctaUrl}" style="display: inline-block; padding: 12px 24px; background: ${color}; color: #ffffff !important; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 8px;">${escapeHtml(options.ctaLabel)}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 28px; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">
                <a href="${SITE_URL}" style="color: #0ea5e9; text-decoration: none;">Open BPM</a> · You received this notification from your BPM application.
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
    subject: `[BPM] Task assigned: ${p.taskName} – ${p.processName}`,
    html: emailLayout({
      title: "New task assigned",
      accent: "assigned",
      greeting: `Hello ${p.assigneeName},`,
      intro: "You have been assigned to a task. Review the details below and open the process when you're ready.",
      details: [
        { label: "Process", value: p.processName },
        { label: "Task", value: p.taskName },
      ],
      ctaUrl: url,
      ctaLabel: "View process & task",
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
    subject: `[BPM] Task started: ${p.taskName} – ${p.processName}`,
    html: emailLayout({
      title: "Task in progress",
      accent: "started",
      greeting: `Hello ${p.assigneeName},`,
      intro: "A task you can act on has been started. See who started it and open the process below.",
      details: [
        { label: "Process", value: p.processName },
        { label: "Task", value: p.taskName },
        { label: "Started by", value: p.startedByName },
      ],
      ctaUrl: url,
      ctaLabel: "View process",
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
    subject: `[BPM] Task approved: ${p.taskName} – ${p.processName}`,
    html: emailLayout({
      title: "Task approved",
      accent: "approved",
      greeting: `Hello ${p.toName},`,
      intro: "A task in a process you're involved in has been approved. Details below.",
      details: [
        { label: "Process", value: p.processName },
        { label: "Task", value: p.taskName },
        { label: "Approved by", value: p.approvedByName },
      ],
      ctaUrl: url,
      ctaLabel: "View process",
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
    { label: "Process", value: p.processName },
    { label: "Task", value: p.taskName },
    { label: "Rejected by", value: p.rejectedByName },
  ];
  if (p.comment?.trim()) details.push({ label: "Comment", value: p.comment.trim() });
  return {
    subject: `[BPM] Task rejected: ${p.taskName} – ${p.processName}`,
    html: emailLayout({
      title: "Task rejected",
      accent: "rejected",
      greeting: `Hello ${p.toName},`,
      intro: "A task in a process you're involved in has been rejected. You can view the process and comment below.",
      details,
      ctaUrl: url,
      ctaLabel: "View process",
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
    subject: `[BPM] Process completed: ${p.processName}`,
    html: emailLayout({
      title: "Process completed",
      accent: "completed",
      greeting: `Hello ${p.toName},`,
      intro: "The following process has been completed. You can open it to review the outcome.",
      details: [{ label: "Process", value: p.processName }],
      ctaUrl: url,
      ctaLabel: "View process",
    }),
  };
}

/** Test email HTML (e.g. for "Send test email" from License modal) */
export function buildTestEmailHtml(): string {
  return emailLayout({
    title: "BPM email test",
    accent: "assigned",
    greeting: "Hello,",
    intro: "This is a test email from your BPM application. If you received this, email sending (Office 365 or Resend) is configured correctly.",
    details: [{ label: "Sent at", value: new Date().toISOString() }],
    ctaUrl: SITE_URL,
    ctaLabel: "Open BPM",
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
