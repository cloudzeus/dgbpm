/**
 * BunnyCDN Storage API – upload files and return public CDN URL.
 * Uses from env: BUNNY_STORAGE_ZONE, BUNNY_ACCESS_KEY, BUNNY_CDN_HOSTNAME, BUNNY_STORAGE_API_HOST.
 * Optional: BUNNY_CDN_HOST (full URL override), BUNNY_STORAGE_REGION (e.g. "la", "sg", "syd"; empty = Falkenstein).
 */

const STORAGE_REGION = process.env.BUNNY_STORAGE_REGION ?? "";
const STORAGE_ZONE = process.env.BUNNY_STORAGE_ZONE;
const ACCESS_KEY = process.env.BUNNY_ACCESS_KEY;
const STORAGE_API_HOST = process.env.BUNNY_STORAGE_API_HOST?.replace(/^https?:\/\//, "").replace(/\/$/, "");
// CDN URL for public file links: BUNNY_CDN_HOST (full URL) or BUNNY_CDN_HOSTNAME (e.g. dgsmart.b-cdn.net)
const CDN_HOST = (() => {
  const host = process.env.BUNNY_CDN_HOST?.replace(/\/$/, "");
  if (host) return host;
  const hostname = process.env.BUNNY_CDN_HOSTNAME?.replace(/\/$/, "");
  return hostname ? `https://${hostname}` : undefined;
})();

function getStorageHost(): string {
  if (STORAGE_API_HOST) return `https://${STORAGE_API_HOST}`;
  const prefix = STORAGE_REGION ? `${STORAGE_REGION}.` : "";
  return `https://${prefix}storage.bunnycdn.com`;
}

export function isBunnyConfigured(): boolean {
  return !!(STORAGE_ZONE && ACCESS_KEY && CDN_HOST);
}

/**
 * Upload file to BunnyCDN Storage and return the public CDN URL.
 * @param buffer - File content (Buffer or Uint8Array)
 * @param path - Path within storage, e.g. "bpm/tasks/{taskId}/{filename}"
 * @param contentType - MIME type, e.g. "application/pdf"
 * @returns Public URL (BUNNY_CDN_HOST + path) or throws
 */
export async function uploadToBunny(
  buffer: Buffer | Uint8Array,
  path: string,
  contentType: string
): Promise<string> {
  if (!isBunnyConfigured()) {
    throw new Error("BunnyCDN is not configured (BUNNY_STORAGE_ZONE, BUNNY_ACCESS_KEY, and BUNNY_CDN_HOST or BUNNY_CDN_HOSTNAME)");
  }

  const host = getStorageHost();
  const url = `${host}/${STORAGE_ZONE}/${path}`;

  const body =
    buffer instanceof Buffer
      ? new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)
      : buffer;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      AccessKey: ACCESS_KEY!,
      "Content-Type": contentType,
    },
    body: body as BodyInit,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`BunnyCDN upload failed: ${res.status} ${text}`);
  }

  return `${CDN_HOST}/${path}`;
}
