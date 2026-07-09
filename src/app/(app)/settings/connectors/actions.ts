"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { Role, type ConnectorType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { decryptJson, encryptJson } from "@/lib/crypto";
import { CONNECTOR_DEFS, getConnectorDef, splitFieldValues } from "@/lib/connectors/registry";
import { runConnectorTest, type TestResult } from "@/lib/connectors/test";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("Μη εξουσιοδοτημένη πρόσβαση");
  requireRole(session.user.role, [Role.SUPER_ADMIN]);
}

export type ConnectorView = {
  type: ConnectorType;
  enabled: boolean;
  config: Record<string, string>;
  /** Ποια ευαίσθητα πεδία έχουν ήδη αποθηκευμένη τιμή (χωρίς να αποκαλύπτεται η τιμή). */
  secretsSet: Record<string, boolean>;
  lastTestAt: string | null;
  lastTestOk: boolean | null;
  lastTestMsg: string | null;
};

/** Επιστρέφει την κατάσταση όλων των connectors — ΠΟΤΕ σε plaintext τα secrets. */
export async function getConnectors(): Promise<ConnectorView[]> {
  await requireAdmin();
  const rows = await prisma.connector.findMany();
  const byType = new Map(rows.map((r) => [r.type, r]));

  return CONNECTOR_DEFS.map((def) => {
    const row = byType.get(def.type);
    const config = (row?.config as Record<string, string> | null) ?? {};
    const secrets = decryptJson<Record<string, string>>(row?.secretsEnc) ?? {};
    const secretsSet: Record<string, boolean> = {};
    for (const f of def.fields) {
      if (f.secret) secretsSet[f.key] = Boolean(secrets[f.key]);
    }
    return {
      type: def.type,
      enabled: row?.enabled ?? false,
      config,
      secretsSet,
      lastTestAt: row?.lastTestAt ? row.lastTestAt.toISOString() : null,
      lastTestOk: row?.lastTestOk ?? null,
      lastTestMsg: row?.lastTestMsg ?? null,
    };
  });
}

/** Συνθέτει τις πλήρεις τιμές (config + secrets), κρατώντας τα υπάρχοντα secrets όταν το πεδίο έρθει κενό. */
async function resolveFullValues(
  type: ConnectorType,
  incoming: Record<string, string>,
): Promise<Record<string, string>> {
  const def = getConnectorDef(type);
  const row = await prisma.connector.findUnique({ where: { type } });
  const storedSecrets = decryptJson<Record<string, string>>(row?.secretsEnc) ?? {};
  const values: Record<string, string> = {};
  for (const f of def.fields) {
    const typed = (incoming[f.key] ?? "").trim();
    if (f.secret) {
      values[f.key] = typed !== "" ? typed : storedSecrets[f.key] ?? "";
    } else {
      values[f.key] = typed;
    }
  }
  return values;
}

export async function saveConnector(
  type: ConnectorType,
  enabled: boolean,
  incoming: Record<string, string>,
): Promise<{ success: true }> {
  await requireAdmin();
  getConnectorDef(type); // validate type

  const full = await resolveFullValues(type, incoming);
  const { config, secrets } = splitFieldValues(type, full);

  await prisma.connector.upsert({
    where: { type },
    create: {
      type,
      enabled,
      config,
      secretsEnc: Object.keys(secrets).length ? encryptJson(secrets) : null,
    },
    update: {
      enabled,
      config,
      secretsEnc: Object.keys(secrets).length ? encryptJson(secrets) : null,
    },
  });

  revalidatePath("/settings/connectors");
  return { success: true };
}

/** Δοκιμή σύνδεσης με τις τρέχουσες τιμές της φόρμας (τα κενά secrets συμπληρώνονται από τα αποθηκευμένα). */
export async function testConnector(
  type: ConnectorType,
  incoming: Record<string, string>,
): Promise<TestResult> {
  await requireAdmin();
  getConnectorDef(type);

  const full = await resolveFullValues(type, incoming);
  const result = await runConnectorTest(type, full);

  await prisma.connector.upsert({
    where: { type },
    create: {
      type,
      lastTestAt: new Date(),
      lastTestOk: result.ok,
      lastTestMsg: result.message,
    },
    update: {
      lastTestAt: new Date(),
      lastTestOk: result.ok,
      lastTestMsg: result.message,
    },
  });

  revalidatePath("/settings/connectors");
  return result;
}
