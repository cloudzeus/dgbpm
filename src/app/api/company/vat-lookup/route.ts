import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { requireRole } from "@/lib/rbac";
import { Role } from "@prisma/client";
import { fetchVatCompany } from "@/lib/vat-wwa";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Μη εξουσιοδοτημένη πρόσβαση" }, { status: 401 });
  }
  try {
    requireRole(session.user.role, [Role.SUPER_ADMIN]);
  } catch {
    return NextResponse.json({ error: "Μη εξουσιοδοτημένη πρόσβαση" }, { status: 403 });
  }

  const { afm } = await req.json().catch(() => ({ afm: undefined }));
  const result = await fetchVatCompany(String(afm ?? ""));
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.data);
}
