import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureBuiltinProfiles } from "@/lib/scanner-profiles";
import { DEFAULT_SCANNER_CONFIG } from "@/lib/scanner-config";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureBuiltinProfiles();
  const profiles = await prisma.scannerProfile.findMany({
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
  return NextResponse.json({ ok: true, profiles });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, description, config, universe, isDefault } = body ?? {};
  if (!name) return NextResponse.json({ ok: false, error: "name required" }, { status: 400 });

  if (isDefault) {
    await prisma.scannerProfile.updateMany({
      data: { isDefault: false },
      where: { isDefault: true },
    });
  }

  const p = await prisma.scannerProfile.create({
    data: {
      name,
      description: description ?? null,
      config: JSON.stringify(config ?? DEFAULT_SCANNER_CONFIG),
      universe: universe ? JSON.stringify(universe) : null,
      isDefault: !!isDefault,
    },
  });
  return NextResponse.json({ ok: true, profile: p });
}
