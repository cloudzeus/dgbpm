/**
 * Send email via Microsoft Graph API (Office 365).
 * Requires Mail.Send application permission and admin consent.
 * OFFICE365_SENDER must be the User Principal Name (e.g. newsletterapp@yourdomain.com) of the mailbox to send from.
 */

const TENANT = process.env.OFFICE365_TENANT_ID;
const CLIENT_ID = process.env.OFFICE365_CLIENT_ID;
const CLIENT_SECRET = process.env.OFFICE365_CLIENT_SECRET;
const SENDER = process.env.OFFICE365_SENDER;
const DISPLAY_NAME = process.env.OFFICE365_DISPLAY_NAME ?? "BPM";

export function isOutlookConfigured(): boolean {
  return !!(TENANT && CLIENT_ID && CLIENT_SECRET && SENDER);
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }
  const url = `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: CLIENT_ID!,
    client_secret: CLIENT_SECRET!,
    scope: "https://graph.microsoft.com/.default",
  });
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Graph token failed: ${res.status} ${text}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return cachedToken.token;
}

export async function sendEmailViaOutlook(params: {
  to: string | string[];
  subject: string;
  html: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isOutlookConfigured()) {
    return { ok: false, error: "Office 365 email is not configured." };
  }
  const toAddresses = Array.isArray(params.to) ? params.to : [params.to];
  const toRecipients = toAddresses.map((address) => ({
    emailAddress: { address, name: address },
  }));
  try {
    const token = await getAccessToken();
    const url = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(SENDER!)}/sendMail`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          subject: params.subject,
          body: {
            contentType: "HTML",
            content: params.html,
          },
          toRecipients,
        },
        saveToSentItems: true,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `Graph sendMail failed: ${res.status} ${text}` };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to send email",
    };
  }
}
