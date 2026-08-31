import "dotenv/config";
import { runScanner } from "../src/lib/scanner";

const type = (process.argv[2] as "morning" | "premarket" | "custom") ?? "morning";

runScanner(type)
  .then((r) => {
    console.log(`\n✅ Scan complete (${type}):`);
    console.log(`   Scanned: ${r.totalScanned}`);
    console.log(`   Matches: ${r.matches.length}`);
    console.log("");
    for (const m of r.matches.slice(0, 15)) {
      console.log(
        `  ${m.symbol.padEnd(6)} $${m.price?.toFixed(2)} ${
          (m.changePercent ?? 0) >= 0 ? "+" : ""
        }${m.changePercent?.toFixed(2)}%  score=${m.score.toFixed(0)}  ${m.matchedSetups.join(", ")}`
      );
    }
    process.exit(0);
  })
  .catch((e) => {
    console.error("❌ Scan failed:", e);
    process.exit(1);
  });
