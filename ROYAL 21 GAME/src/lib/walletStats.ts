import type { ActivityEntry } from '@/services/localStore';
import type { GameKey } from '@/types';

export interface DailyStats {
  /** Sum of all nets today — positive means net winnings. */
  net: number;
  /** Total chips won today (sum of positive nets only). */
  won: number;
  /** Total chips lost today (sum of |negative nets|). */
  lost: number;
  /** Best single win today. */
  biggestWin: number;
  /** Worst single loss today. */
  biggestLoss: number;
  /** How many games played today. */
  gameCount: number;
  /** Win/loss/push counts. */
  wins: number;
  losses: number;
  pushes: number;
}

export interface PerGameBreakdown {
  game: GameKey;
  gameCount: number;
  net: number;
  wins: number;
  losses: number;
}

/** Filter activity to entries from today (local date). */
function todaysActivity(activity: ActivityEntry[]): ActivityEntry[] {
  const today = new Date().toISOString().slice(0, 10);
  return activity.filter((entry) => entry.at.slice(0, 10) === today);
}

export function computeDailyStats(activity: ActivityEntry[]): DailyStats {
  const today = todaysActivity(activity);
  const stats: DailyStats = {
    net: 0, won: 0, lost: 0, biggestWin: 0, biggestLoss: 0,
    gameCount: 0, wins: 0, losses: 0, pushes: 0,
  };
  for (const entry of today) {
    stats.gameCount += 1;
    stats.net += entry.net;
    if (entry.outcome === 'win') stats.wins += 1;
    else if (entry.outcome === 'lose') stats.losses += 1;
    else stats.pushes += 1;
    if (entry.net > 0) {
      stats.won += entry.net;
      if (entry.net > stats.biggestWin) stats.biggestWin = entry.net;
    } else if (entry.net < 0) {
      const loss = -entry.net;
      stats.lost += loss;
      if (loss > stats.biggestLoss) stats.biggestLoss = loss;
    }
  }
  return stats;
}

export function computePerGameBreakdown(activity: ActivityEntry[]): PerGameBreakdown[] {
  const today = todaysActivity(activity);
  const byGame = new Map<GameKey, PerGameBreakdown>();
  for (const entry of today) {
    const existing = byGame.get(entry.game) ?? {
      game: entry.game, gameCount: 0, net: 0, wins: 0, losses: 0,
    };
    existing.gameCount += 1;
    existing.net += entry.net;
    if (entry.outcome === 'win') existing.wins += 1;
    else if (entry.outcome === 'lose') existing.losses += 1;
    byGame.set(entry.game, existing);
  }
  // Sort by absolute net descending — the most impactful games surface first.
  return Array.from(byGame.values()).sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
}
