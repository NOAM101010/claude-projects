import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeProfileConfig } from "@/lib/scanner-config";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json();
  const { name, description, config, universe, isDefault } = body ?? {};

  // פרופיל מובנה נדרס בכל ensureBuiltinProfiles — עריכה שלו רק מבלבלת.
  // מותר רק לסמן אותו כברירת מחדל.
  const existing = await prisma.scannerProfile.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ ok: false, error: "profile not found" }, { status: 404 });
  }
  const editsContent =
    name !== undefined || description !== undefined || config !== undefined || universe !== undefined;
  if (existing.isBuiltin && editsContent) {
    return NextResponse.json(
      { ok: false, error: "פרופיל מובנה — שכפל אותו כדי לערוך" },
      { status: 400 }
    );
  }

  if (isDefault) {
    await prisma.scannerProfile.updateMany({
      data: { isDefault: false },
      where: { isDefault: true },
    });
  }

  const p = await prisma.scannerProfile.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(config !== undefined && { config: JSON.stringify(normalizeProfileConfig(config)) }),
      ...(universe !== undefined && { universe: universe ? JSON.stringify(universe) : null }),
      ...(isDefault !== undefined && { isDefault: !!isDefault }),
    },
  });
  return NextResponse.json({ ok: true, profile: p });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const existing = await prisma.scannerProfile.findUnique({ where: { id } });
  if (existing?.isBuiltin) {
    return NextResponse.json(
      { ok: false, error: "פרופיל מובנה — לא ניתן למחיקה" },
      { status: 400 }
    );
  }
  await prisma.scannerProfile.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
