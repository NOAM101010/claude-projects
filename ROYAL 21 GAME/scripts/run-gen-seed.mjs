/* Rebuilds the seed block at the end of supabase/setup.sql from src/data. */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

execSync('./node_modules/.bin/esbuild scripts/gen-seed.ts --bundle --platform=node --format=esm --outfile=node_modules/.cache/gen-seed.mjs --log-level=error --alias:@=./src', { stdio: 'inherit' });
const seed = execSync('node node_modules/.cache/gen-seed.mjs').toString();
const sql = readFileSync('supabase/setup.sql', 'utf8');
const marker = '-- 10. SEED DATA';
const cut = sql.indexOf('-- =============================================================================\n' + marker);
const head = cut === -1 ? sql : sql.slice(0, cut);
writeFileSync('supabase/setup.sql', head.trimEnd() + '\n' + seed);
console.log('seed block regenerated');
