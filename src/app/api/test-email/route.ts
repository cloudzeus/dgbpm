import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isEmailConfigured, sendEmail } from "@/lib/email";

async function sendTestEmail(to: string) {
  const subject = "[BPM] Test email";
  const html = `
    <p>This is a test email from the BPM application.</p>
    <p>If you received this, email sending (Office 365 or Resend) is working.</p>
    <p><em>Sent at ${new Date().toISOString()}</em></p>
  `;
  return sendEmail({ to, subject, html });
}

/**
 * GET /api/test-email – send a test email to your logged-in account.
 * Open this URL while signed in to verify email config.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized. Sign in first." }, { status: 401 });
  }
  if (!isEmailConfigured()) {
    return NextResponse.json(
      { error: "Email is not configured. Set Office 365 (OFFICE365_*) or RESEND_API_KEY in .env." },
      { status: 400 }
    );
  }
  const result = await sendTestEmail(session.user.email);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true, message: `Test email sent to ${session.user.email}` });
}

/**
 * POST /api/test-email – send a test email. Body: { "to": "optional@email.com" }.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized. Sign in first." }, { status: 401 });
  }
  if (!isEmailConfigured()) {
    return NextResponse.json(
      { error: "Email is not configured. Set Office 365 (OFFICE365_*) or RESEND_API_KEY in .env." },
      { status: 400 }
    );
  }
  let to = session.user.email;
  try {
    const body = await req.json().catch(() => ({}));
    if (typeof body.to === "string" && body.to.includes("@")) to = body.to;
  } catch {
    // ignore
  }
  const result = await sendTestEmail(to);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true, message: `Test email sent to ${to}` });
}
