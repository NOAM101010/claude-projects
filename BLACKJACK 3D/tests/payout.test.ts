import { describe, it, expect, beforeEach, vi } from 'vitest'

// The stores persist through localStorage, which does not exist under Node.
const store = new Map<string, string>()
;(globalThis as any).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() { return store.size },
}

import { useGame } from '../src/state/useGame'
import { useWallet, STARTING_BALANCE } from '../src/state/useWallet'
import { useSettings } from '../src/state/useSettings'
import { useProgress, ACHIEVEMENTS } from '../src/progression/useProgress'
import { DEFAULT_RULES } from '../src/engine/types'

/** Pre-unlock achievements so their rewards don't perturb the money accounting. */
function neutralizeAchievements() {
  useProgress.setState({
    xp: 0, winStreak: 0, bestStreak: 0, pending: [],
    unlocked: ACHIEVEMENTS.map(a => ({ id: a.id, at: 0 })),
  })
}

/**
 * Regression cover for a payout that could be cancelled.
 *
 * settle() used to run on a timer, and nextRound() called clearTimers(). A
 * player who clicked "new round" during the result pause was charged for the
 * hand and never paid for winning it — the wallet silently drained and no stats
 * were recorded. Money must settle the moment a round resolves.
 */
function playToPayout() {
  const game = useGame.getState()
  game.addChip(100)
  // addChip commits on a timer; flush it the way deal() does.
  game.deal()

  let guard = 0
  while (guard++ < 40) {
    const r = useGame.getState().round
    if (!r) break
    if (r.phase === 'PAYOUT') break
    if (r.phase === 'INSURANCE') { useGame.getState().doInsurance(false); continue }
    if (r.phase === 'PLAYER') { useGame.getState().doStand(); continue }
    if (r.phase === 'DEALER') {
      // The UI paces this; drive it directly so the test stays synchronous.
      vi.advanceTimersByTime(4000)
      continue
    }
    break
  }
  return useGame.getState().round
}

describe('payout settlement', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useWallet.getState().reset()
    neutralizeAchievements()
    useSettings.setState({ speed: 'fast' })
    useGame.setState({
      round: null, pendingBet: 0, inFlightBet: 0, lastBet: 0,
      toast: null, dealerLine: null, flights: [], payoutDone: false,
    })
  })

  it('pays before the result banner is shown', () => {
    const round = playToPayout()
    expect(round?.phase).toBe('PAYOUT')
    // Wallet is already correct with no timers run at all.
    expect(useGame.getState().payoutDone).toBe(true)
  })

  it('survives an immediate new round, the bug that drained the wallet', () => {
    const round = playToPayout()
    expect(round?.phase).toBe('PAYOUT')

    const balanceAfterSettle = useWallet.getState().balance
    const handsAfter = useWallet.getState().handsPlayed

    // Click through instantly, cancelling every pending timer.
    useGame.getState().nextRound()
    vi.advanceTimersByTime(10_000)

    expect(useWallet.getState().balance).toBe(balanceAfterSettle)
    expect(useWallet.getState().handsPlayed).toBe(handsAfter)
    expect(handsAfter).toBe(1)
  })

  it('records exactly one hand per round, never double-paying', () => {
    playToPayout()
    const balance = useWallet.getState().balance
    // Re-entering settlement must be a no-op.
    useGame.getState().nextRound()
    expect(useWallet.getState().balance).toBe(balance)
    expect(useWallet.getState().handsPlayed).toBe(1)
  })

  it('never loses more than the stake on a single flat hand', () => {
    playToPayout()
    useGame.getState().nextRound()
    const balance = useWallet.getState().balance
    expect(balance).toBeGreaterThanOrEqual(STARTING_BALANCE - 100)
    expect(balance).toBeLessThanOrEqual(STARTING_BALANCE + 150)
  })

  it('charges and pays each split hand separately', () => {
    const card = (rank: any, suit: any = 'S', faceUp = true) => ({
      rank, suit, faceUp, id: `${rank}${suit}${Math.random()}`,
    })
    // A pair of eights against a dealer six, with a shoe that fills both hands.
    useGame.setState({
      payoutDone: false,
      round: {
        phase: 'PLAYER',
        shoe: [card('2'), card('3'), card('K'), card('9'), card('7')],
        hands: [{
          cards: [card('8'), card('8', 'H')], bet: 100, doubled: false,
          surrendered: false, stood: false, fromSplit: false,
        }],
        activeHandIndex: 0,
        dealer: [card('6'), card('K', 'H', false)],
        rules: { ...DEFAULT_RULES },
        outcomes: [],
        totalDelta: 0,
      },
    })

    const before = useWallet.getState().balance
    useGame.getState().doSplit()

    // The second hand costs a second full stake.
    expect(useWallet.getState().balance).toBe(before - 100)
    const round = useGame.getState().round!
    expect(round.hands).toHaveLength(2)
    expect(round.hands.every(h => h.bet === 100)).toBe(true)
    expect(round.hands.every(h => h.fromSplit)).toBe(true)
  })

  it('refuses a split the bankroll cannot cover', () => {
    const card = (rank: any, suit: any = 'S') => ({
      rank, suit, faceUp: true, id: `${rank}${suit}${Math.random()}`,
    })
    useWallet.setState({ balance: 50 })
    useGame.setState({
      payoutDone: false,
      round: {
        phase: 'PLAYER', shoe: [card('2'), card('3')],
        hands: [{
          cards: [card('8'), card('8')], bet: 100, doubled: false,
          surrendered: false, stood: false, fromSplit: false,
        }],
        activeHandIndex: 0, dealer: [card('6'), card('K')],
        rules: { ...DEFAULT_RULES }, outcomes: [], totalDelta: 0,
      },
    })
    useGame.getState().doSplit()
    expect(useWallet.getState().balance).toBe(50)
    expect(useGame.getState().round!.hands).toHaveLength(1)
  })

  it('keeps the books straight across several quick rounds', () => {
    for (let i = 0; i < 6; i++) {
      playToPayout()
      useGame.getState().nextRound()
      vi.advanceTimersByTime(200)
    }
    const w = useWallet.getState()
    expect(w.handsPlayed).toBe(6)
    expect(w.wins + w.losses + w.pushes).toBe(6)
    expect(w.totalWagered).toBe(600)
  })
})
