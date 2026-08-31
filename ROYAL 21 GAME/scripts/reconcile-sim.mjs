/**
 * Standalone simulation of usePlayer.runReconcile's chained convergence.
 *
 * Mirrors the exact arithmetic of src/stores/usePlayer.ts:
 *   - lastSyncedChips baseline per profile
 *   - ±100,000 clamp on the delta pushed to adjust_chips
 *   - server ADDS the (clamped) delta, floors at 0
 *   - surprise correction applied to the HUD as a delta
 *   - NEW: a follow-up runReconcile chained on reconcileChain while the clamp
 *     truncated a larger movement, with the stop conditions from the fix
 *
 * Proves: for a single addChips() movement larger than the clamp, the promise
 * chain drives server balance == HUD balance (diff 0) with no browser.
 */

const ID = 'user-uuid';
const MAX_RECONCILE_SLICES = 200;

function makeWorld(startBalance) {
  return {
    server: startBalance,          // authoritative profiles.chips
    hud: startBalance,             // usePlayer profile.chips
    lastSynced: startBalance,      // lastSyncedChips[ID]
    chain: Promise.resolve(),      // reconcileChain[ID]
    rpcCalls: 0,
  };
}

// Fake profileService.adjustChips: server adds the clamped delta, floors at 0.
async function adjustChips(w, delta) {
  await Promise.resolve();
  w.rpcCalls++;
  w.server = Math.max(0, w.server + delta);
  return w.server;
}

async function runReconcile(w, slice = 0) {
  const known = w.lastSynced;
  if (w.hud === known) return;

  const rawDelta = w.hud - known;
  const delta = Math.max(-100000, Math.min(100000, rawDelta));
  const balance = await adjustChips(w, delta);
  w.lastSynced = balance;

  const surprise = balance - (known + delta);
  if (surprise !== 0) {
    w.hud = Math.max(0, Math.round(w.hud + surprise));
  }

  if (delta !== rawDelta) {
    const remaining = w.hud - w.lastSynced;
    if (remaining === 0) return;
    if (Math.abs(remaining) >= Math.abs(rawDelta)) return;
    if (slice + 1 >= MAX_RECONCILE_SLICES) return;
    w.chain = w.chain.then(() => runReconcile(w, slice + 1)).catch(() => {});
  }
}

// Fake persist() -> reconcileChips(): chain a run behind the previous one.
function reconcileChips(w) {
  w.chain = w.chain.then(() => runReconcile(w)).catch(() => {});
}

async function scenario(name, startBalance, addChipsDelta) {
  const w = makeWorld(startBalance);

  // addChips(delta): HUD moves immediately, then persist() -> reconcileChips().
  w.hud = Math.max(0, Math.round(w.hud + addChipsDelta));
  reconcileChips(w);

  // Drain the promise chain (what the event loop does between renders).
  let guard = 0;
  let prev;
  do {
    prev = w.chain;
    await w.chain;
  } while (prev !== w.chain && guard++ < 1000);

  const diff = w.hud - w.server;
  const ok = diff === 0 && w.server === Math.max(0, startBalance + addChipsDelta);
  console.log(
    `  ${ok ? 'ok  ' : 'FAIL'} ${name}\n` +
    `        start=${startBalance}  addChips=${addChipsDelta >= 0 ? '+' : ''}${addChipsDelta}\n` +
    `        HUD=${w.hud}  server=${w.server}  diff=${diff}  rpcCalls=${w.rpcCalls}`,
  );
  return ok;
}

console.log('\nrunReconcile chained convergence — single movement > ±100,000 clamp\n');

let failures = 0;
const run = async (n, s, d) => { if (!(await scenario(n, s, d))) failures++; };

await run('VIP bet 200K (loss leaves HUD down 200K)', 5_000_000, -200_000);
await run('VIP payout +250K', 5_000_000, +250_000);
await run('big refund -300K', 5_000_000, -300_000);
await run('exact clamp +100K (no follow-up needed)', 1_000_000, +100_000);
await run('just over clamp +100,001', 1_000_000, +100_001);
await run('huge jackpot +2,000,000', 1_000_000, +2_000_000);
await run('bet larger than balance -> server floors at 0', 150_000, -400_000);
await run('sub-clamp move +40K (untouched path)', 1_000_000, +40_000);

// Interleaved: a second addChips lands while the chain is still draining.
{
  const w = makeWorld(3_000_000);
  w.hud += 250_000; reconcileChips(w);
  await w.chain;                 // let the first slice go out
  w.hud -= 180_000; reconcileChips(w);
  let guard = 0, prev;
  do { prev = w.chain; await w.chain; } while (prev !== w.chain && guard++ < 1000);
  const diff = w.hud - w.server;
  const ok = diff === 0 && w.server === 3_000_000 + 250_000 - 180_000;
  if (!ok) failures++;
  console.log(
    `  ${ok ? 'ok  ' : 'FAIL'} interleaved +250K then -180K mid-chain\n` +
    `        HUD=${w.hud}  server=${w.server}  diff=${diff}  rpcCalls=${w.rpcCalls}`,
  );
}

console.log(`\n${failures === 0 ? 'ALL PASS' : failures + ' FAILED'}\n`);
process.exit(failures === 0 ? 0 : 1);
