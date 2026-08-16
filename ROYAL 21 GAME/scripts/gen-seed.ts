/* Generates the SQL seed block from the TypeScript catalogue so the two can never drift. */
import { ITEMS } from '../src/data/items';
import { ACHIEVEMENTS } from '../src/data/achievements';

const q = (value: string) => `'${value.replace(/'/g, "''")}'`;
const j = (value: unknown) => `${q(JSON.stringify(value))}::jsonb`;

const itemRows = ITEMS.map(
  (i) => `  (${q(i.id)}, ${q(i.category)}, ${j(i.name)}, ${q(i.rarity)}, ${i.price}, ${q(i.icon)}, ${j(i.payload)})`,
).join(',\n');

const achRows = ACHIEVEMENTS.map(
  (a) => `  (${q(a.id)}, ${j(a.name)}, ${j(a.desc)}, ${q(a.stat)}, ${a.goal}, ${a.reward})`,
).join(',\n');

console.log(`
-- =============================================================================
-- 10. SEED DATA (generated from src/data — run \`npm run gen:seed\` to refresh)
-- =============================================================================
insert into public.items (id, category, name, rarity, price, icon, payload) values
${itemRows}
on conflict (id) do update set
  category = excluded.category, name = excluded.name, rarity = excluded.rarity,
  price = excluded.price, icon = excluded.icon, payload = excluded.payload;

insert into public.achievements (id, name, descr, stat, goal, reward) values
${achRows}
on conflict (id) do update set
  name = excluded.name, descr = excluded.descr, stat = excluded.stat,
  goal = excluded.goal, reward = excluded.reward;
`);
