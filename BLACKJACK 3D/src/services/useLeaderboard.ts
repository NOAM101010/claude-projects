import { useCallback, useEffect, useState } from 'react'
import { leaderboard, LeaderboardEntry, deviceId } from './leaderboardService'
import { useWallet } from '../state/useWallet'
import { useProgress } from '../progression/useProgress'

/** Builds the player's current entry from the live stores. */
export function playerEntry(): LeaderboardEntry {
  const wallet = useWallet.getState()
  const progress = useProgress.getState()
  return {
    id: deviceId(),
    name: progress.name || 'שחקן',
    level: progress.level(),
    chips: wallet.balance,
    biggestWin: wallet.biggestWin,
    avatar: progress.avatar,
  }
}

/** Pushes the player's latest standing to the board (fire and forget). */
export function submitPlayerScore() {
  void leaderboard.submitScore(playerEntry()).catch(() => {})
}

export function useLeaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const myId = deviceId()

  const refresh = useCallback(async () => {
    setLoading(true)
    await leaderboard.submitScore(playerEntry()).catch(() => {})
    const top = await leaderboard.topScores(15).catch(() => [])
    setEntries(top)
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { entries, loading, online: leaderboard.online, myId, refresh }
}
