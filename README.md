# ROYAL 21

A private social game room on the web. Blackjack against the dealer, Blackjack
with friends at one table, Blackjack **against** friends as a points race, plus
coin flip, high card and scratch cards at the counter.

**Virtual chips only.** There is no deposit, no withdrawal, no purchase and no
real-money balance anywhere in the code or the database. Chips are won at the
table, and the free house scratch card is always there when you run dry.

---

## Requirements

- **Node.js 18 or newer** (`node -v` to check)
- npm (comes with Node)
- A free **Supabase** project — only needed for friends, rooms and multiplayer.
  Solo play works without it.

---

## Installation

```bash
npm install
```

---

## Environment variables

Copy the example file and fill it in:

```bash
cp .env.example .env
```

```env
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

Leave them empty and the game still runs: solo Blackjack, coin flip, high card,
scratch cards, the vault, your profile and all progress work, saved on that
device. Friends, rooms and cross-device multiplayer need the two values above.

Never commit `.env` — it is already in `.gitignore`.

---

## Supabase setup — step by step

1. **Create the project.** Go to https://supabase.com, sign in, click
   **New project**. Pick any name (for example `royal21`), set a database
   password (save it somewhere), choose the region closest to you and click
   **Create new project**. Wait about two minutes for it to finish provisioning.

2. **Find your Project URL.** In the project, open **Settings** (the gear, bottom
   left) → **API**. The first box is **Project URL**. It looks like
   `https://abcdefghijkl.supabase.co`. Copy it.

3. **Find your anon key.** On the same page, under **Project API keys**, copy the
   key labelled **anon** / **public**. It is a long string starting with `eyJ`.
   *(Never use the `service_role` key in this project — it must not reach a browser.)*

4. **Create `.env`.** In the project folder on your computer:

   ```bash
   cp .env.example .env
   ```

   Open `.env` and paste the two values:

   ```env
   VITE_SUPABASE_URL=https://abcdefghijkl.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
   ```

   Save the file. If the dev server is running, stop it (Ctrl+C) and start it
   again — Vite only reads `.env` at startup.

5. **Open the SQL editor.** Back in Supabase, click **SQL Editor** in the left
   sidebar, then **New query**.

6. **Run the schema.** Open `supabase/setup.sql` from this project, copy the
   whole file, paste it into the query window and press **Run** (or Ctrl+Enter).
   It should finish with *Success. No rows returned*. The script is safe to run
   again later — it will not duplicate or delete anything.

7. **Check the tables exist.** Click **Table Editor** in the sidebar. You should
   see `profiles`, `player_stats`, `friendships`, `friend_requests`, `rooms`,
   `room_members`, `room_actions`, `blackjack_hands`, `blackjack_payouts`,
   `items`, `user_items`, `achievements`, `notifications` and more. Open `items`
   — it should already contain the whole cosmetics catalogue.

8. **Realtime.** The last block of `setup.sql` already adds the needed tables to
   the `supabase_realtime` publication. To confirm: **Database** → **Publications**
   → `supabase_realtime` should list `rooms`, `room_members`, `room_actions`,
   `notifications`, `friend_requests`, `friendships` and `profiles`.

9. **Guest sign-in (optional but recommended).** **Authentication** → **Providers**
   → enable **Anonymous sign-ins**. This lets a friend open your link and play
   immediately without creating an account. Without it, guests still play — their
   progress just stays on their own device and they cannot join rooms.

10. **Email sign-up (optional).** **Authentication** → **Providers** → **Email**
    is on by default. For testing, turn **Confirm email** off under
    **Authentication → Sign In / Providers**, so accounts work instantly.

---

## Run locally

```bash
npm run dev
```

Open http://localhost:5173

The terminal also prints a **Network** address such as `http://192.168.1.20:5173`.
Open that one on your phone (same Wi-Fi) to test on a real device.

Other commands:

```bash
npm run build        # production build into dist/
npm run preview      # serve the production build
npm run typecheck    # TypeScript, no emit
npm run test:engine  # Blackjack rules, duel scoring and economy tests
npm run gen:seed     # rebuild the SQL seed block from src/data
```

---

## Multiplayer testing (two devices)

1. `npm run dev` and open the app on your laptop. Sign in (or continue as guest).
2. In the room, click the **duel table** (or open the Blackjack table and choose
   playing with friends). A room is created with a five-character code and a URL
   like `/room/7KX92`.
3. Press **Copy link** or **Send on WhatsApp** and send it to yourself.
4. Open that link on your phone, or in a second browser / an incognito window.
   Sign in as a **different** user.
5. The phone lands straight in the room — the invite is remembered across the
   sign-in, so nobody gets dumped back in the hub.
6. Both screens now show both players. Press **Start**.
7. Place bets on both devices, then **Ready**. The hand deals for everyone.
8. Hit on the laptop — the card appears on the phone within a moment, and the
   turn indicator moves. Act on the phone and the laptop updates the same way.
9. Join from a third device in the middle of a hand: it shows *the hand already
   started, you are watching until the next round*, and it deals you in when the
   next round opens.

---

## Deploy

Both configs are already in the repo. Pick one.

**Netlify** (uses `netlify.toml`)

1. Push the project to GitHub.
2. netlify.com → **Add new site** → **Import an existing project** → pick the repo.
3. Build command `npm run build`, publish directory `dist` (already filled in).
4. **Site settings → Environment variables** → add `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY`.
5. Deploy. The SPA redirect in `netlify.toml` keeps `/room/7KX92` working on refresh.

**Vercel** (uses `vercel.json`)

1. Push to GitHub.
2. vercel.com → **Add New → Project** → pick the repo (framework: Vite).
3. **Settings → Environment Variables** → add the same two variables.
4. Deploy.

Then send friends the plain link, e.g. `https://your-site.netlify.app`.

---

## PWA

`public/manifest.webmanifest` is wired up: standalone display, theme colours,
safe-area support and an SVG icon.

- **iPhone:** open the site in Safari → Share → *Add to Home Screen*.
- **Android:** Chrome shows *Install app*, or use the ⋮ menu → *Install*.

For the Android install prompt, generate the two PNG sizes once — see
`public/icons/README.md`.

---

## Troubleshooting

| What you see | What to do |
| --- | --- |
| "Playing with friends needs Supabase connected" | `.env` is missing or empty. Fill both values and restart `npm run dev`. |
| Friends list is empty after adding someone | The other player must accept the request from their own device. |
| Room code says "no room with that code" | Codes are per-project. Both devices must use the same deployment / same Supabase project. |
| Nothing syncs between devices | Check **Database → Publications → supabase_realtime** includes `rooms` and `room_actions`. Re-run `setup.sql` if not. |
| Sign-up does nothing | Turn off **Confirm email** in Supabase → Authentication, or check the inbox for the confirmation mail. |
| Guest cannot join a room | Enable **Anonymous sign-ins** in Supabase → Authentication → Providers. |
| No sound | Browsers need one tap first — click anywhere. Then check Settings → Sound. |
| `/room/XXXXX` 404s in production | The SPA rewrite is missing. Use the provided `netlify.toml` / `vercel.json`. |
| Chips look wrong after a room hand | The server recomputes the payout and corrects the balance a moment later — that value is the real one. |

---

## Project structure

```
src/
  app/          App shell, routes, deep-link handling
  audio/        AudioManager — every sound is synthesised, no audio files
  components/
    ui/         GlassPanel, GameButton, Modal, Tabs, Meter, Toasts, Loading
    game/       PlayingCard, Chip, ChipStack, Dealer
    social/     Avatar, PlayerBadge, FriendsPanel, EmoteBar, InviteOverlay
    effects/    LightPool, Particles, MomentLayer, VictoryEffect
    layout/     HUD, SceneShell, ChipsPanel, ConnectionBanner
  scenes/       intro · auth · hub · room · blackjack · vault · profile · settings
  games/
    blackjack/  engine.ts (pure rules) · duel.ts (points race) · types.ts
    coinflip/ highcard/ scratch/
  services/     auth · profile · friends · rooms · blackjack · shop · notifications · presence
  stores/       usePlayer · useRoom · useSocial · useSettings · useUI
  data/         items.ts · achievements.ts · economy.ts
  i18n/         he.json · en.json (full RTL/LTR)
  styles/       tokens.css · global.css · game.css
supabase/       setup.sql — schema, RLS, functions, seed
scripts/        engine.test.ts, gen-seed
```
