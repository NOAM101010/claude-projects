/**
 * סקריפט חד-פעמי: מייצר PNG סטטיים אמיתיים ל-public/icon-192.png ו-
 * public/icon-512.png (מ-`next/og` ImageResponse, מריץ satori ב-node ישירות,
 * בלי שרת Next רץ). ה-manifest.json של ה-PWA צריך קבצים סטטיים אמיתיים —
 * ה-metadata route (src/app/icon.tsx) לא מספיק לבד עבור אנדרואיד maskable icons.
 * הרצה: npx tsx scripts/generate-icons.ts
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { CandleIcon } from "../src/lib/icon-design";

async function writeIcon(size: number, filename: string) {
  const res = new ImageResponse(CandleIcon({ size }), { width: size, height: size });
  const buf = Buffer.from(await res.arrayBuffer());
  const outPath = join(__dirname, "..", "public", filename);
  writeFileSync(outPath, buf);
  console.log(`wrote ${outPath} (${buf.length} bytes)`);
}

async function main() {
  await writeIcon(192, "icon-192.png");
  await writeIcon(512, "icon-512.png");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
