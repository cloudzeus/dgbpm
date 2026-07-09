import crypto from "crypto";

/**
 * AES-256-GCM κρυπτογράφηση για ευαίσθητα δεδομένα (credentials connectors).
 *
 * Το κλειδί προέρχεται από το env `CONNECTORS_SECRET_KEY` (οποιοδήποτε string)
 * μέσω scrypt με στατικό salt, ώστε να μην απαιτείται συγκεκριμένη μορφή.
 * Ορίστε ένα ισχυρό, σταθερό μυστικό στο περιβάλλον παραγωγής.
 */

const SALT = "dgbpm.connectors.v1";

function getKey(): Buffer {
  const secret = process.env.CONNECTORS_SECRET_KEY;
  if (!secret || secret.length < 8) {
    throw new Error(
      "Το CONNECTORS_SECRET_KEY δεν έχει οριστεί (ή είναι πολύ σύντομο). Απαιτείται για την κρυπτογράφηση των στοιχείων σύνδεσης.",
    );
  }
  return crypto.scryptSync(secret, SALT, 32);
}

/** Κρυπτογραφεί ένα αντικείμενο σε συμπαγές string: v1:<iv>:<tag>:<ciphertext> (base64). */
export function encryptJson(value: unknown): string {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(JSON.stringify(value ?? null), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    "v1",
    iv.toString("base64"),
    tag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

/** Αποκρυπτογραφεί ένα string που παρήχθη από `encryptJson`. Επιστρέφει null σε αποτυχία/κενό. */
export function decryptJson<T = unknown>(payload: string | null | undefined): T | null {
  if (!payload) return null;
  const parts = payload.split(":");
  if (parts.length !== 4 || parts[0] !== "v1") return null;
  try {
    const key = getKey();
    const iv = Buffer.from(parts[1], "base64");
    const tag = Buffer.from(parts[2], "base64");
    const ciphertext = Buffer.from(parts[3], "base64");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return JSON.parse(plaintext.toString("utf8")) as T;
  } catch {
    return null;
  }
}
