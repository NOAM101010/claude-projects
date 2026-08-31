/**
 * Leaderboard with two interchangeable backends behind one interface.
 *
 * - Local (default): localStorage plus a few fixed AI rivals, so the board is
 *   populated and the game is fully playable with no server.
 * - Supabase: activates when VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are
 *   set. It talks to Supabase's REST (PostgREST) endpoint with plain fetch, so
 *   no client library or extra dependency is required. Run supabase/leaderboard.sql
 *   once to create the table.
 */

export interface LeaderboardEntry {
  id: string
  name: string
  level: number
  chips: number
  biggestWin: number
  /** Emoji avatar; local-only (not stored in Supabase). */
  avatar?: string
}

export interface Leaderboard {
  readonly online: boolean
  submitScore(entry: LeaderboardEntry): Promise<void>
  topScores(limit?: number): Promise<LeaderboardEntry[]>
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

const AI_RIVALS: LeaderboardEntry[] = [
  { id: 'ai-1', name: 'הקוסם', level: 24, chips: 184000, biggestWin: 42000, avatar: '🎩' },
  { id: 'ai-2', name: 'ליידי לאק', level: 19, chips: 96500, biggestWin: 25000, avatar: '🌹' },
  { id: 'ai-3', name: 'אמיל', level: 15, chips: 61200, biggestWin: 18000, avatar: '🦁' },
  { id: 'ai-4', name: 'ויקטור', level: 11, chips: 33400, biggestWin: 9000, avatar: '🐉' },
  { id: 'ai-5', name: 'רוני', level: 7, chips: 14800, biggestWin: 4200, avatar: '🍀' },
]

const LOCAL_KEY = 'goldenace-leaderboard'

class LocalLeaderboard implements Leaderboard {
  readonly online = false

  private read(): LeaderboardEntry[] {
    try {
      const raw = localStorage.getItem(LOCAL_KEY)
      return raw ? (JSON.parse(raw) as LeaderboardEntry[]) : []
    } catch {
      return []
    }
  }

  async submitScore(entry: LeaderboardEntry): Promise<void> {
    const list = this.read().filter(e => e.id !== entry.id)
    list.push(entry)
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(list))
    } catch {
      /* storage full or unavailable; the board just won't persist */
    }
  }

  async topScores(limit = 10): Promise<LeaderboardEntry[]> {
    const merged = [...AI_RIVALS, ...this.read()]
    // De-dupe by id, keeping the player's own latest entry.
    const byId = new Map<string, LeaderboardEntry>()
    for (const e of merged) byId.set(e.id, e)
    return [...byId.values()].sort((a, b) => b.chips - a.chips).slice(0, limit)
  }
}

class SupabaseLeaderboard implements Leaderboard {
  readonly online = true
  constructor(private url: string, private key: string) {}

  private headers(extra: Record<string, string> = {}) {
    return {
      apikey: this.key,
      Authorization: `Bearer ${this.key}`,
      'Content-Type': 'application/json',
      ...extra,
    }
  }

  async submitScore(entry: LeaderboardEntry): Promise<void> {
    // Upsert on the primary key.
    await fetch(`${this.url}/rest/v1/leaderboard`, {
      method: 'POST',
      headers: this.headers({ Prefer: 'resolution=merge-duplicates' }),
      body: JSON.stringify({
        id: entry.id,
        name: entry.name,
        level: entry.level,
        chips: entry.chips,
        biggest_win: entry.biggestWin,
        updated_at: new Date().toISOString(),
      }),
    })
  }

  async topScores(limit = 10): Promise<LeaderboardEntry[]> {
    const res = await fetch(
      `${this.url}/rest/v1/leaderboard?select=id,name,level,chips,biggest_win&order=chips.desc&limit=${limit}`,
      { headers: this.headers() }
    )
    if (!res.ok) return []
    const rows = (await res.json()) as any[]
    return rows.map(r => ({
      id: r.id,
      name: r.name,
      level: r.level,
      chips: r.chips,
      biggestWin: r.biggest_win,
    }))
  }
}

export const leaderboard: Leaderboard =
  SUPABASE_URL && SUPABASE_KEY
    ? new SupabaseLeaderboard(SUPABASE_URL, SUPABASE_KEY)
    : new LocalLeaderboard()

/** A stable per-device id for the player, created once. */
export function deviceId(): string {
  const KEY = 'goldenace-device-id'
  try {
    let id = localStorage.getItem(KEY)
    if (!id) {
      id = 'p-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
      localStorage.setItem(KEY, id)
    }
    return id
  } catch {
    return 'p-anon'
  }
}
