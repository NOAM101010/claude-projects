import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json();
  const { name, description, config, universe, isDefault } = body ?? {};

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
      ...(config !== undefined && { config: JSON.stringify(config) }),
      ...(universe !== undefined && { universe: universe ? JSON.stringify(universe) : null }),
      ...(isDefault !== undefined && { isDefault: !!isDefault }),
    },
  });
  return NextResponse.json({ ok: true, profile: p });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  await prisma.scannerProfile.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
