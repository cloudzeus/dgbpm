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

/** Base layout for BPM notification emails */
function emailLayout(content: string): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #333; max-width: 560px; margin: 0 auto; padding: 24px;">
  <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin-bottom: 16px;">
    ${content}
  </div>
  <p style="font-size: 12px; color: #666;">
    <a href="${siteUrl}" style="color: #2563eb;">Open BPM</a>
  </p>
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
  const url = `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/process-instances/${p.instanceId}`;
  const content = `
    <h2 style="margin: 0 0 12px 0; font-size: 18px;">New task assigned</h2>
    <p style="margin: 0 0 8px 0;">Hello ${escapeHtml(p.assigneeName)},</p>
    <p style="margin: 0 0 8px 0;">You have been assigned to a task in the following process:</p>
    <ul style="margin: 8px 0; padding-left: 20px;">
      <li><strong>Process:</strong> ${escapeHtml(p.processName)}</li>
      <li><strong>Task:</strong> ${escapeHtml(p.taskName)}</li>
    </ul>
    <p style="margin: 12px 0 0 0;"><a href="${url}" style="color: #2563eb;">View process &amp; task</a></p>
  `;
  return {
    subject: `[BPM] Task assigned: ${p.taskName} – ${p.processName}`,
    html: emailLayout(content),
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
  const url = `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/process-instances/${p.instanceId}`;
  const content = `
    <h2 style="margin: 0 0 12px 0; font-size: 18px;">Task in progress</h2>
    <p style="margin: 0 0 8px 0;">Hello ${escapeHtml(p.assigneeName)},</p>
    <p style="margin: 0 0 8px 0;">A task you can act on has been started:</p>
    <ul style="margin: 8px 0; padding-left: 20px;">
      <li><strong>Process:</strong> ${escapeHtml(p.processName)}</li>
      <li><strong>Task:</strong> ${escapeHtml(p.taskName)}</li>
      <li><strong>Started by:</strong> ${escapeHtml(p.startedByName)}</li>
    </ul>
    <p style="margin: 12px 0 0 0;"><a href="${url}" style="color: #2563eb;">View process</a></p>
  `;
  return {
    subject: `[BPM] Task started: ${p.taskName} – ${p.processName}`,
    html: emailLayout(content),
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
  const url = `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/process-instances/${p.instanceId}`;
  const content = `
    <h2 style="margin: 0 0 12px 0; font-size: 18px;">Task approved</h2>
    <p style="margin: 0 0 8px 0;">Hello ${escapeHtml(p.toName)},</p>
    <p style="margin: 0 0 8px 0;">A task in a process you are involved in has been approved:</p>
    <ul style="margin: 8px 0; padding-left: 20px;">
      <li><strong>Process:</strong> ${escapeHtml(p.processName)}</li>
      <li><strong>Task:</strong> ${escapeHtml(p.taskName)}</li>
      <li><strong>Approved by:</strong> ${escapeHtml(p.approvedByName)}</li>
    </ul>
    <p style="margin: 12px 0 0 0;"><a href="${url}" style="color: #2563eb;">View process</a></p>
  `;
  return {
    subject: `[BPM] Task approved: ${p.taskName} – ${p.processName}`,
    html: emailLayout(content),
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
  const url = `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/process-instances/${p.instanceId}`;
  const content = `
    <h2 style="margin: 0 0 12px 0; font-size: 18px;">Task rejected</h2>
    <p style="margin: 0 0 8px 0;">Hello ${escapeHtml(p.toName)},</p>
    <p style="margin: 0 0 8px 0;">A task in a process you are involved in has been rejected:</p>
    <ul style="margin: 8px 0; padding-left: 20px;">
      <li><strong>Process:</strong> ${escapeHtml(p.processName)}</li>
      <li><strong>Task:</strong> ${escapeHtml(p.taskName)}</li>
      <li><strong>Rejected by:</strong> ${escapeHtml(p.rejectedByName)}</li>
      ${p.comment ? `<li><strong>Comment:</strong> ${escapeHtml(p.comment)}</li>` : ""}
    </ul>
    <p style="margin: 12px 0 0 0;"><a href="${url}" style="color: #2563eb;">View process</a></p>
  `;
  return {
    subject: `[BPM] Task rejected: ${p.taskName} – ${p.processName}`,
    html: emailLayout(content),
  };
}

export type ProcessCompletedPayload = {
  toEmail: string;
  toName: string;
  processName: string;
  instanceId: string;
};

export function buildProcessCompletedEmail(p: ProcessCompletedPayload): { subject: string; html: string } {
  const url = `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/process-instances/${p.instanceId}`;
  const content = `
    <h2 style="margin: 0 0 12px 0; font-size: 18px;">Process completed</h2>
    <p style="margin: 0 0 8px 0;">Hello ${escapeHtml(p.toName)},</p>
    <p style="margin: 0 0 8px 0;">The following process has been completed:</p>
    <p style="margin: 8px 0;"><strong>${escapeHtml(p.processName)}</strong></p>
    <p style="margin: 12px 0 0 0;"><a href="${url}" style="color: #2563eb;">View process</a></p>
  `;
  return {
    subject: `[BPM] Process completed: ${p.processName}`,
    html: emailLayout(content),
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
