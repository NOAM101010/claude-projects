import { create } from 'zustand'
import {
  RoundState, newRound, dealInitial, hit, stand, double, split, surrender,
  takeInsurance, activeHand, dealerNeedsCard, dealerDrawOne, finishDealer,
} from '../engine/round'
import { canDouble, canSplit, isBlackjack, isBust } from '../engine/hand'
import { DEFAULT_RULES } from '../engine/types'
import { useWallet } from './useWallet'
import { useSettings } from './useSettings'
import { playSfx } from '../audio/sfx'
import { CHIP_VALUES, breakIntoChips } from '../scene/models'
import { useProgress } from '../progression/useProgress'
import { maybeCelebrate } from './useCelebration'
import { speak } from '../audio/voice'
import { DEALER_LINES } from '../i18n/he'

export type ToastKind = 'win' | 'lose' | 'push' | 'blackjack' | 'info'

/** What the dealer is saying right now, shown as a bubble above him. */
export type DealerLine =
  | 'welcome' | 'dealing' | 'insurance' | 'yourTurn' | 'bust'
  | 'dealerTurn' | 'dealerBust' | 'blackjack' | 'youWin' | 'youLose' | 'push'

export interface ChipFlight {
  id: number
  value: number
  from: [number, number, number]
  to: [number, number, number]
  startedAt: number
  duration: number
}

/** World positions the scene measures once the table is fitted. */
export interface TableAnchors {
  rack: [number, number, number]
  bet: [number, number, number]
  dealerTray: [number, number, number]
}

const DEFAULT_ANCHORS: TableAnchors = {
  rack: [0, 0.82, 0.39],
  bet: [0, 0.82, 0.21],
  dealerTray: [0, 0.82, -0.42],
}

const FLIGHT_MS = 430

interface GameState {
  round: RoundState | null
  /** Chips settled on the betting spot. */
  pendingBet: number
  /** Chips still arcing toward the spot; committed to pendingBet on arrival. */
  inFlightBet: number
  lastBet: number
  toast: { text: string; kind: ToastKind } | null
  dealerLine: DealerLine | null
  flights: ChipFlight[]
  anchors: TableAnchors
  /** Guards against paying the same round twice. */
  payoutDone: boolean

  setAnchors: (a: TableAnchors) => void
  addChip: (value: number) => void
  clearBet: () => void
  rebet: () => void
  deal: () => void
  doHit: () => void
  doStand: () => void
  doDouble: () => void
  doSplit: () => void
  doSurrender: () => void
  doInsurance: (take: boolean) => void
  nextRound: () => void
  showToast: (text: string, kind: ToastKind) => void
  say: (line: DealerLine | null) => void
  launchFlight: (f: Omit<ChipFlight, 'id' | 'startedAt'>) => void
  retireFlight: (id: number) => void

  canHit: () => boolean
  canDoubleNow: () => boolean
  canSplitNow: () => boolean
  canSurrenderNow: () => boolean
}

/**
 * Every pending timer, so a new round or a fast-forward can cancel work that
 * would otherwise fire into a stale round and appear to freeze the game.
 */
const timers = new Set<ReturnType<typeof setTimeout>>()

function clearTimers() {
  for (const t of timers) clearTimeout(t)
  timers.clear()
}

function later(fn: () => void, ms: number) {
  const factor = useSettings.getState().factor()
  // Self-removing, so a long session does not accumulate dead handles.
  const id = setTimeout(() => {
    timers.delete(id)
    fn()
  }, Math.max(ms * factor, 0))
  timers.add(id)
}

let flightId = 0

export const useGame = create<GameState>((set, get) => ({
  round: null,
  pendingBet: 0,
  inFlightBet: 0,
  lastBet: 0,
  toast: null,
  dealerLine: null,
  flights: [],
  anchors: DEFAULT_ANCHORS,
  payoutDone: false,

  setAnchors: a => set({ anchors: a }),

  say: line => {
    set({ dealerLine: line })
    if (line) speak(DEALER_LINES[line])
  },

  launchFlight: f =>
    set(s => ({
      flights: [...s.flights, { ...f, id: ++flightId, startedAt: performance.now() }],
    })),

  retireFlight: id => set(s => ({ flights: s.flights.filter(f => f.id !== id) })),

  addChip: value => {
    const r = get().round
    if (r && r.phase !== 'BETTING') return
    const { pendingBet, inFlightBet, anchors } = get()
    if (!useWallet.getState().canAfford(pendingBet + inFlightBet + value)) {
      get().showToast('אין מספיק ציפים', 'info')
      return
    }

    playSfx('chip')
    // The wager lands on the felt when the chip does, not when you click.
    set({ inFlightBet: inFlightBet + value })
    get().launchFlight({ value, from: anchors.rack, to: anchors.bet, duration: FLIGHT_MS })
    later(() => {
      set(s => ({ pendingBet: s.pendingBet + value, inFlightBet: Math.max(s.inFlightBet - value, 0) }))
    }, FLIGHT_MS)
  },

  clearBet: () => set({ pendingBet: 0, inFlightBet: 0, flights: [] }),

  rebet: () => {
    const amount = get().lastBet
    if (amount <= 0) return
    if (!useWallet.getState().canAfford(amount)) {
      get().showToast('אין מספיק ציפים', 'info')
      return
    }
    set({ pendingBet: amount, inFlightBet: 0 })
  },

  deal: () => {
    const current = get().round
    if (current && current.phase !== 'BETTING') return
    // Sweep up anything still in the air so a fast click never drops a chip.
    const bet = get().pendingBet + get().inFlightBet
    if (bet <= 0) {
      get().showToast('הנח הימור קודם', 'info')
      return
    }
    const wallet = useWallet.getState()
    if (!wallet.wager(bet)) {
      get().showToast('אין מספיק ציפים', 'info')
      return
    }

    clearTimers()
    playSfx('deal')
    const prev = get().round
    let r = newRound(bet, prev ?? undefined, DEFAULT_RULES)
    r = dealInitial(r)
    set({
      round: r, pendingBet: 0, inFlightBet: 0, flights: [],
      lastBet: bet, toast: null, payoutDone: false,
    })
    get().say('dealing')

    if (r.phase === 'PAYOUT') {
      settle(get, set, 900)
    } else if (r.phase === 'INSURANCE') {
      later(() => get().say('insurance'), 700)
    } else {
      later(() => get().say('yourTurn'), 700)
    }
  },

  doHit: () => {
    const r = get().round
    if (!r || r.phase !== 'PLAYER') return
    playSfx('deal')
    const next = hit(r)
    set({ round: next })
    afterPlayerAction(get, set, next)
  },

  doStand: () => {
    const r = get().round
    if (!r || r.phase !== 'PLAYER') return
    const next = stand(r)
    set({ round: next })
    afterPlayerAction(get, set, next)
  },

  doDouble: () => {
    const r = get().round
    if (!r || r.phase !== 'PLAYER') return
    const h = activeHand(r)
    if (!h || !canDouble(h)) return
    if (!useWallet.getState().wager(h.bet)) {
      get().showToast('אין מספיק ציפים להכפלה', 'info')
      return
    }
    playSfx('chip')
    const next = double(r)
    set({ round: next })
    afterPlayerAction(get, set, next)
  },

  doSplit: () => {
    const r = get().round
    if (!r || r.phase !== 'PLAYER') return
    const h = activeHand(r)
    if (!h || !canSplit(h) || r.hands.length > r.rules.maxSplits) return
    if (!useWallet.getState().wager(h.bet)) {
      get().showToast('אין מספיק ציפים לפיצול', 'info')
      return
    }
    playSfx('chip')
    const next = split(r)
    set({ round: next })
    afterPlayerAction(get, set, next)
  },

  doSurrender: () => {
    const r = get().round
    if (!r || r.phase !== 'PLAYER') return
    const next = surrender(r)
    set({ round: next })
    afterPlayerAction(get, set, next)
  },

  doInsurance: take => {
    const r = get().round
    if (!r || r.phase !== 'INSURANCE') return
    if (take) {
      const cost = r.hands[0].bet / 2
      if (!useWallet.getState().wager(cost)) {
        get().showToast('אין מספיק ציפים לביטוח', 'info')
        return
      }
      playSfx('chip')
    }
    const next = takeInsurance(r, take)
    set({ round: next })
    afterPlayerAction(get, set, next)
  },

  nextRound: () => {
    const r = get().round
    if (!r || r.phase !== 'PAYOUT') return
    // Pay before cancelling timers — leaving on the payout must never forfeit it.
    settleMoney(get, set)
    clearTimers()
    set({
      round: { ...r, phase: 'BETTING', hands: [], dealer: [], outcomes: [], totalDelta: 0, activeHandIndex: 0 },
      toast: null,
      dealerLine: null,
      flights: [],
    })
  },

  showToast: (text, kind) => {
    set({ toast: { text, kind } })
    later(() => {
      if (get().toast?.text === text) set({ toast: null })
    }, 2800)
  },

  canHit: () => {
    const r = get().round
    if (!r || r.phase !== 'PLAYER') return false
    const h = activeHand(r)
    return !!h && !h.stood && !isBust(h)
  },
  canDoubleNow: () => {
    const r = get().round
    if (!r || r.phase !== 'PLAYER') return false
    const h = activeHand(r)
    if (!h || !canDouble(h)) return false
    if (h.fromSplit && !r.rules.doubleAfterSplit) return false
    return useWallet.getState().canAfford(h.bet)
  },
  canSplitNow: () => {
    const r = get().round
    if (!r || r.phase !== 'PLAYER') return false
    const h = activeHand(r)
    if (!h || !canSplit(h)) return false
    if (r.hands.length > r.rules.maxSplits) return false
    return useWallet.getState().canAfford(h.bet)
  },
  canSurrenderNow: () => {
    const r = get().round
    if (!r || r.phase !== 'PLAYER') return false
    const h = activeHand(r)
    return !!h && h.cards.length === 2 && !h.fromSplit && r.rules.surrenderAllowed
  },
}))

type Get = () => GameState
type Set = (p: Partial<GameState>) => void

/** Routes to the dealer sequence or the payout once a player action lands. */
function afterPlayerAction(get: Get, set: Set, next: RoundState) {
  if (next.phase === 'DEALER') {
    get().say('dealerTurn')
    later(() => runDealerStep(get, set), 750)
  } else if (next.phase === 'PAYOUT') {
    settle(get, set, 700)
  } else if (next.phase === 'PLAYER') {
    const h = activeHand(next)
    if (h && isBust(h)) get().say('bust')
  }
}

/**
 * Draws the dealer one card at a time on a timer so the reveal is watchable,
 * re-reading state each tick and bailing if the round moved on underneath us.
 */
function runDealerStep(get: Get, set: Set) {
  const r = get().round
  if (!r || r.phase !== 'DEALER') return

  if (dealerNeedsCard(r)) {
    playSfx('deal')
    const next = dealerDrawOne(r)
    set({ round: next })
    later(() => runDealerStep(get, set), 900)
    return
  }

  const done = finishDealer(r)
  set({ round: done })
  settle(get, set, 600)
}

/**
 * Credits the wallet for a finished round.
 *
 * Deliberately synchronous and idempotent. This used to run on a timer
 * alongside the result banner, which meant clicking "new round" during the
 * pause hit clearTimers() and cancelled the payout — the player was charged for
 * the hand and never paid for winning it. Money settles the instant the round
 * resolves; only the announcement is allowed to wait.
 */
function settleMoney(get: Get, set: Set) {
  const r = get().round
  if (!r || r.phase !== 'PAYOUT') return
  if (get().payoutDone) return
  set({ payoutDone: true })

  const wallet = useWallet.getState()

  // Return stakes for everything that did not lose, then the winnings on top.
  let returned = 0
  for (const o of r.outcomes) {
    const h = r.hands[o.handIndex]
    if (o.result === 'WIN' || o.result === 'BLACKJACK') returned += h.bet + o.delta
    else if (o.result === 'PUSH') returned += h.bet
    else if (o.result === 'SURRENDER') returned += h.bet / 2
  }
  const dealerBJ = r.dealer.length === 2 && isDealerBlackjack(r)
  for (const h of r.hands) {
    if (h.insurance && dealerBJ) returned += h.insurance * (1 + r.rules.insurancePayout)
  }
  wallet.add(returned)
  wallet.recordOutcome(r.totalDelta, r.outcomes.some(o => o.result === 'BLACKJACK'))

  // Progression reads the wallet, so it must run after the wallet is updated.
  const wagered = r.hands.reduce((a, h) => a + h.bet, 0)
  useProgress.getState().recordRound(wagered, r.totalDelta)

  maybeCelebrate(r.totalDelta, wagered)
}

/** The result banner, dealer line and chip movement. Presentation only. */
function announceResult(get: Get) {
  const r = get().round
  if (!r || r.phase !== 'PAYOUT') return

  const net = r.totalDelta
  const hadBJ = r.outcomes.some(o => o.result === 'BLACKJACK')

  settleFlights(get, net, r.hands.reduce((a, h) => a + h.bet, 0))

  const kind: ToastKind = hadBJ ? 'blackjack' : net > 0 ? 'win' : net < 0 ? 'lose' : 'push'
  const text =
    hadBJ ? `בלאק ג'ק! +${Math.round(net)}`
      : net > 0 ? `ניצחת +${Math.round(net)}`
      : net < 0 ? `הפסדת ${Math.abs(Math.round(net))}`
      : 'תיקו'

  playSfx(net > 0 ? 'win' : net < 0 ? 'lose' : 'chip')
  get().say(hadBJ ? 'blackjack' : net > 0 ? 'youWin' : net < 0 ? 'youLose' : 'push')
  get().showToast(text, kind)
}

/** Pays immediately, then announces after a beat. */
function settle(get: Get, set: Set, delayMs = 0) {
  settleMoney(get, set)
  if (delayMs > 0) later(() => announceResult(get), delayMs)
  else announceResult(get)
}

/**
 * Sends chips where the money went: the dealer pays out of his tray to your
 * rack, or sweeps your stake off the spot into it.
 */
function settleFlights(get: Get, net: number, staked: number) {
  const { anchors, launchFlight } = get()
  if (net === 0) return

  const won = net > 0
  const amount = won ? net : staked
  const chips = breakIntoChips(Math.abs(amount), CHIP_VALUES, 7)
  if (chips.length === 0) return

  const from = won ? anchors.dealerTray : anchors.bet
  const to = won ? anchors.rack : anchors.dealerTray

  chips.forEach((value, i) => {
    later(() => launchFlight({ value, from, to, duration: 520 }), i * 110)
  })
}

function isDealerBlackjack(r: RoundState): boolean {
  const vals = r.dealer.map(c =>
    c.rank === 'A' ? 11 : ['K', 'Q', 'J', '10'].includes(c.rank) ? 10 : Number(c.rank)
  )
  return vals.reduce((a, b) => a + b, 0) === 21
}
