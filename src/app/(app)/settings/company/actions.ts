"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("Μη εξουσιοδοτημένη πρόσβαση");
  requireRole(session.user.role, [Role.SUPER_ADMIN]);
}

export type CompanyActivityInput = {
  code: string;
  description?: string | null;
  kind?: string | null;
  isPrimary?: boolean;
};

export type CompanyInput = {
  afm?: string | null;
  name?: string | null;
  commercialTitle?: string | null;
  legalStatus?: string | null;
  taxOffice?: string | null;
  gemi?: string | null;
  address?: string | null;
  city?: string | null;
  zip?: string | null;
  country?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  registDate?: string | null;
  isActive?: boolean;
  activities?: CompanyActivityInput[];
};

function clean(v: string | null | undefined): string | null {
  const t = (v ?? "").trim();
  return t === "" ? null : t;
}

/**
 * Αποθήκευση των στοιχείων της εταιρίας (singleton — μία εγγραφή).
 * Αντικαθιστά πλήρως τη λίστα ΚΑΔ με αυτήν που στάλθηκε.
 */
export async function saveCompany(input: CompanyInput) {
  await requireAdmin();

  const data = {
    afm: clean(input.afm),
    name: clean(input.name),
    commercialTitle: clean(input.commercialTitle),
    legalStatus: clean(input.legalStatus),
    taxOffice: clean(input.taxOffice),
    gemi: clean(input.gemi),
    address: clean(input.address),
    city: clean(input.city),
    zip: clean(input.zip),
    country: clean(input.country) ?? "Ελλάδα",
    phone: clean(input.phone),
    email: clean(input.email),
    website: clean(input.website),
    registDate: clean(input.registDate),
    isActive: input.isActive ?? true,
  };

  const activities = (input.activities ?? [])
    .filter((a) => clean(a.code))
    .map((a) => ({
      code: clean(a.code)!,
      description: clean(a.description),
      kind: clean(a.kind),
      isPrimary: a.isPrimary ?? false,
    }));

  const existing = await prisma.company.findFirst({ select: { id: true } });

  if (existing) {
    await prisma.$transaction([
      prisma.companyActivity.deleteMany({ where: { companyId: existing.id } }),
      prisma.company.update({
        where: { id: existing.id },
        data: { ...data, activities: { create: activities } },
      }),
    ]);
  } else {
    await prisma.company.create({
      data: { ...data, activities: { create: activities } },
    });
  }

  revalidatePath("/settings/company");
  return { success: true };
}
