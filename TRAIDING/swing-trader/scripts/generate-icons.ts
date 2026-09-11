/**
 * סקריפט חד-פעמי: מייצר את כל גדלי האייקון (192, 512, apple-touch 180)
 * מתוך קובץ המקור שהמשתמש סיפק ב-public/uploads/icon-source.png/*.png,
 * ומעתיק אותם ל-public/ ול-src/app/ (מוסכמת ה-static icons של Next.js).
 * הרצה: npx tsx scripts/generate-icons.ts
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const SOURCE_DIR = join(__dirname, "..", "public", "uploads", "icon-source.png");
const sourceFile = readdirSync(SOURCE_DIR).find((f) => f.endsWith(".png"));
if (!sourceFile) throw new Error(`No PNG found in ${SOURCE_DIR}`);
const sourcePath = join(SOURCE_DIR, sourceFile);

async function writeSize(size: number, outPath: string) {
  await sharp(sourcePath).resize(size, size).png().toFile(outPath);
  console.log(`wrote ${outPath} (${size}x${size})`);
}

async function main() {
  const publicDir = join(__dirname, "..", "public");
  const appDir = join(__dirname, "..", "src", "app");

  await writeSize(192, join(publicDir, "icon-192.png"));
  await writeSize(512, join(publicDir, "icon-512.png"));
  // מוסכמת Next.js: קובץ סטטי בשם icon.png / apple-icon.png בתוך app/ נתפס אוטומטית
  await writeSize(512, join(appDir, "icon.png"));
  await writeSize(180, join(appDir, "apple-icon.png"));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
