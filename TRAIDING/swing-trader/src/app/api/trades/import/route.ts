import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";

function parseDate(val: unknown): Date | null {
  if (val == null || val === "") return null;
  if (val instanceof Date) return val;
  if (typeof val === "number") {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(val);
    if (!d) return null;
    return new Date(Date.UTC(d.y, d.m - 1, d.d));
  }
  if (typeof val === "string") {
    const m = val.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) {
      const [, dd, mm, yyyy] = m;
      return new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
    }
    const parsed = new Date(val);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function num(val: unknown): number | null {
  if (val == null || val === "") return null;
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const cleaned = val.replace(/[$,₪\s]/g, "").trim();
    if (cleaned === "" || cleaned === "-") return null;
    const n = Number(cleaned);
    return isNaN(n) ? null : n;
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ ok: false, error: "no file" }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      raw: true,
      defval: null,
    });

    // Data starts after header rows (col index: 0=seq,2=ticker,3=qty,5=buyPrice,7=buyDate,9=sellPrice,11=sellDate,17=commission,21=usdIlsRate)
    const imported: { ticker: string; buyDate: string }[] = [];
    let skipped = 0;

    for (const row of rows) {
      const ticker = row[2];
      if (typeof ticker !== "string" || !ticker.trim()) continue;

      const quantity = num(row[3]);
      const buyPrice = num(row[5]);
      const buyDate = parseDate(row[7]);
      if (!quantity || !buyPrice || !buyDate) {
        skipped++;
        continue;
      }

      const rawSellPrice = num(row[9]);
      let sellPrice = rawSellPrice && rawSellPrice > 0 ? rawSellPrice : null;
      let sellDate = sellPrice ? parseDate(row[11]) : null;
      // A sell date in the future is a live-quote formula artifact, not a real sale.
      // A sell price with no parseable sell date is an incomplete/pending row — treat as still open.
      if (!sellPrice || !sellDate || sellDate.getTime() > Date.now()) {
        sellPrice = null;
        sellDate = null;
      }
      const commission = num(row[17]) ?? 0;
      const usdIlsRate = num(row[21]);

      const existing = await prisma.trade.findFirst({
        where: {
          ticker: ticker.trim().toUpperCase(),
          buyDate,
          quantity,
        },
      });
      if (existing) {
        skipped++;
        continue;
      }

      await prisma.trade.create({
        data: {
          ticker: ticker.trim().toUpperCase(),
          quantity,
          buyPrice,
          buyAmount: buyPrice * quantity,
          buyDate,
          sellPrice: sellPrice,
          sellAmount: sellPrice ? sellPrice * quantity : null,
          sellDate: sellPrice ? sellDate : null,
          commission,
          usdIlsRate,
        },
      });
      imported.push({ ticker: ticker.trim().toUpperCase(), buyDate: buyDate.toISOString() });
    }

    return NextResponse.json({
      ok: true,
      imported: imported.length,
      skipped,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
