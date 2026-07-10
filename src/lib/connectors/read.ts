import { prisma } from "@/lib/prisma";
import { decryptJson } from "@/lib/crypto";
import type { ConnectorType } from "@prisma/client";

export interface ConnectorValues {
  enabled: boolean;
  /** Μη-ευαίσθητα πεδία (URLs, domains, usernames κλπ.). */
  config: Record<string, string>;
  /** Αποκρυπτογραφημένα ευαίσθητα πεδία (API keys, passwords). */
  secrets: Record<string, string>;
}

/**
 * Φορτώνει έναν αποθηκευμένο connector με τα ΑΠΟΚΡΥΠΤΟΓΡΑΦΗΜΕΝΑ secrets του.
 * Μόνο για server-side χρήση (π.χ. κλήση τρίτου API) — ΠΟΤΕ μη το επιστρέψεις σε client.
 */
export async function getConnectorValues(type: ConnectorType): Promise<ConnectorValues | null> {
  const row = await prisma.connector.findUnique({ where: { type } });
  if (!row) return null;
  return {
    enabled: row.enabled,
    config: (row.config as Record<string, string> | null) ?? {},
    secrets: decryptJson<Record<string, string>>(row.secretsEnc) ?? {},
  };
}
