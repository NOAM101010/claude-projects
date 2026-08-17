import type { Achievement } from '@/types';

/**
 * Playful, not grindy — §98 of the brief.
 *
 * Every achievement is a trophy on the shelf in My Room, so the list is graded:
 * bronze ones should land in the first evening, platinum ones should take real
 * time or real luck. The `social` ones can only be earned with other people at
 * the table — they are the reason to send the link.
 */
/* Rewards were previously ~2-3x too generous — a couple of easy Bronzes
   basically covered a shop item. Rebalance keeps the tier scaling but
   tightens the numbers to what actually reflects difficulty:
     Bronze  : 100–300   (first evening — should feel like a nod, not a payday)
     Silver  : 400–1200  (a few sessions, meaningful lift)
     Gold    : 1500–4000 (real time at the table)
     Platinum: 8K–25K    (rare — the real trophies)
   Individual values scale within the tier by the size of the goal. */
export const ACHIEVEMENTS: Achievement[] = [
  /* ------------------------------- bronze: the first evening ------------- */
  { id: 'beginners_luck', tier: 'bronze', trophy: '🍀', name: { he: 'מזל של מתחילים', en: "Beginner's luck" }, desc: { he: 'נצח במשחק הראשון שלך', en: 'Win your very first game' }, stat: 'wins', goal: 1, reward: 200 },
  { id: 'first_blackjack', tier: 'bronze', trophy: '🂡', name: { he: 'Blackjack ראשון', en: 'First Blackjack' }, desc: { he: 'קבל Blackjack אחד', en: 'Land a single Blackjack' }, stat: 'blackjacks', goal: 1, reward: 200 },
  { id: 'first_spin', tier: 'bronze', trophy: '🎰', name: { he: 'משיכה ראשונה', en: 'First pull' }, desc: { he: 'סובב את מכונת המזל 10 פעמים', en: 'Spin the slot machine 10 times' }, stat: 'slSpins', goal: 10, reward: 150 },
  { id: 'scratcher', tier: 'bronze', trophy: '🎫', name: { he: 'מגרד', en: 'Scratcher' }, desc: { he: 'גרד 10 כרטיסים', en: 'Scratch 10 cards' }, stat: 'scCards', goal: 10, reward: 150 },
  { id: 'ten_hands', tier: 'bronze', trophy: '🃏', name: { he: 'מתחמם', en: 'Warming up' }, desc: { he: 'שחק 10 ידיים Blackjack', en: 'Play 10 Blackjack hands' }, stat: 'bjHands', goal: 10, reward: 200 },

  /* ------------------------------- silver: a few sessions ---------------- */
  { id: 'dealer_hates_you', tier: 'silver', trophy: '😤', name: { he: 'הדילר שונא אותך', en: 'The dealer hates you' }, desc: { he: 'קבל 3 Blackjacks', en: 'Land 3 Blackjacks' }, stat: 'blackjacks', goal: 3, reward: 900 },
  { id: 'unstoppable', tier: 'silver', trophy: '🔥', name: { he: 'בלתי ניתן לעצירה', en: 'Unstoppable' }, desc: { he: 'נצח 5 ידיים ברצף', en: 'Win 5 hands in a row' }, stat: 'bestStreak', goal: 5, reward: 600 },
  { id: 'no_luck', tier: 'silver', trophy: '💀', name: { he: 'אין לך מזל', en: 'No luck at all' }, desc: { he: 'הפסד 5 הטלות מטבע ברצף', en: 'Lose 5 coin flips in a row' }, stat: 'cfLossStreak', goal: 5, reward: 400 },
  { id: 'double_or_nothing', tier: 'silver', trophy: '⚡', name: { he: 'כפול או כלום', en: 'Double or nothing' }, desc: { he: 'נצח בסיבוב כפול או כלום', en: 'Win a double-or-nothing round' }, stat: 'doubleOrNothing', goal: 1, reward: 700 },
  { id: 'host', tier: 'silver', trophy: '🎩', social: true, name: { he: 'המארח', en: 'The host' }, desc: { he: 'הוסף 5 חברים', en: 'Add 5 friends' }, stat: 'friendCount', goal: 5, reward: 500 },
  { id: 'jackpot', tier: 'silver', trophy: '💰', name: { he: "ג'קפוט", en: 'Jackpot' }, desc: { he: 'זכה 25 פעמים במכונת המזל', en: 'Win 25 times on the slots' }, stat: 'slWins', goal: 25, reward: 800 },

  /* ------------------------------- social: only with other people -------- */
  { id: 'first_table', tier: 'bronze', trophy: '🤝', social: true, name: { he: 'לא לבד', en: 'Not alone' }, desc: { he: 'שחק יד אחת מול חברים', en: 'Play one hand with friends' }, stat: 'roomHands', goal: 1, reward: 250 },
  { id: 'table_night', tier: 'silver', trophy: '🍸', social: true, name: { he: 'ערב שלם', en: 'A whole evening' }, desc: { he: 'שחק 50 ידיים מול חברים', en: 'Play 50 hands with friends' }, stat: 'roomHands', goal: 50, reward: 1200 },
  { id: 'duelist', tier: 'silver', trophy: '⚔️', social: true, name: { he: 'דואליסט', en: 'Duellist' }, desc: { he: 'נצח בתחרות מול חבר', en: 'Win a match against a friend' }, stat: 'duelWins', goal: 1, reward: 700 },
  { id: 'king_of_night', tier: 'gold', trophy: '👑', social: true, name: { he: 'מלך הערב', en: 'King of the night' }, desc: { he: 'נצח בערב חברה', en: 'Win a game night' }, stat: 'nightWins', goal: 1, reward: 2000 },
  { id: 'rival', tier: 'gold', trophy: '🏅', social: true, name: { he: 'יריב רציני', en: 'Serious rival' }, desc: { he: 'נצח ב-5 תחרויות מול חברים', en: 'Win 5 matches against friends' }, stat: 'duelWins', goal: 5, reward: 3000 },
  { id: 'legend_of_night', tier: 'platinum', trophy: '🌟', social: true, name: { he: 'אגדת הערבים', en: 'Legend of the nights' }, desc: { he: 'נצח ב-10 ערבי חברה', en: 'Win 10 game nights' }, stat: 'nightWins', goal: 10, reward: 10000 },

  /* ------------------------------- gold: real time at the table ---------- */
  { id: 'high_roller', tier: 'gold', trophy: '💎', name: { he: 'הימור גבוה', en: 'High roller' }, desc: { he: 'שים הימור של 10,000 צ׳יפים', en: 'Place a 10,000 chip bet' }, stat: 'biggestBet', goal: 10000, reward: 1500 },
  { id: 'table_regular', tier: 'gold', trophy: '♠️', name: { he: 'קבוע בשולחן', en: 'Table regular' }, desc: { he: 'שחק 100 ידיים Blackjack', en: 'Play 100 Blackjack hands' }, stat: 'bjHands', goal: 100, reward: 1000 },
  { id: 'collector', tier: 'gold', trophy: '🗝️', name: { he: 'אספן', en: 'Collector' }, desc: { he: 'החזק 20 פריטים', en: 'Own 20 items' }, stat: 'itemCount', goal: 20, reward: 2500 },
  { id: 'royal', tier: 'gold', trophy: '🏆', name: { he: 'רויאל', en: 'Royal' }, desc: { he: 'הגע לרמה 25', en: 'Reach level 25' }, stat: 'level', goal: 25, reward: 2000 },
  { id: 'big_win', tier: 'gold', trophy: '💸', name: { he: 'הזכייה הגדולה', en: 'The big one' }, desc: { he: 'זכה 25,000 צ׳יפים ביד אחת', en: 'Win 25,000 chips in one hand' }, stat: 'biggestWin', goal: 25000, reward: 3500 },

  /* ------------------------------- platinum: rare ------------------------ */
  { id: 'ice_cold', tier: 'platinum', trophy: '❄️', name: { he: 'קרח', en: 'Ice cold' }, desc: { he: 'נצח 12 ידיים ברצף', en: 'Win 12 hands in a row' }, stat: 'bestStreak', goal: 12, reward: 8000 },
  { id: 'blackjack_master', tier: 'platinum', trophy: '🖤', name: { he: 'מאסטר Blackjack', en: 'Blackjack master' }, desc: { he: 'קבל 25 Blackjacks', en: 'Land 25 Blackjacks' }, stat: 'blackjacks', goal: 25, reward: 12000 },
  { id: 'veteran', tier: 'platinum', trophy: '🕰️', name: { he: 'ותיק הבית', en: 'House veteran' }, desc: { he: 'שחק 1,000 ידיים Blackjack', en: 'Play 1,000 Blackjack hands' }, stat: 'bjHands', goal: 1000, reward: 15000 },
  { id: 'the_royal', tier: 'platinum', trophy: '👑', name: { he: 'ROYAL אמיתי', en: 'Truly Royal' }, desc: { he: 'הגע לרמה 50', en: 'Reach level 50' }, stat: 'level', goal: 50, reward: 20000 },

  /* ------------------------------- poker specials ------------------------- */
  { id: 'streak_master', tier: 'silver', trophy: '🔥', name: { he: 'מאסטר הרצף', en: 'Streak Master' }, desc: { he: 'נצח 10 משחקים ברצף', en: 'Win 10 games in a row' }, stat: 'bestStreak', goal: 10, reward: 1200 },
  { id: 'allin_legend', tier: 'gold', trophy: '🎲', name: { he: 'אגדת ה-All-In', en: 'All-In Legend' }, desc: { he: 'נצח ביד פוקר all-in כשהיו לך 10% סיכוי או פחות', en: 'Win an all-in poker hand with 10% equity or less' }, stat: 'allInLongshotWins', goal: 1, reward: 3500 },
  { id: 'royal_flush', tier: 'platinum', trophy: '👑', name: { he: 'רויאל פלאש', en: 'Royal Flush' }, desc: { he: 'קבל רויאל פלאש בפוקר', en: 'Make a royal flush at poker' }, stat: 'royalFlushes', goal: 1, reward: 15000 },
  { id: 'poker_millionaire', tier: 'platinum', trophy: '💵', name: { he: 'מיליונר פוקר', en: 'Poker Millionaire' }, desc: { he: 'זכה במיליון צ׳יפים בפוקר, במצטבר', en: 'Win 1,000,000 chips at poker, lifetime' }, stat: 'pokerChipsWon', goal: 1_000_000, reward: 25000 },
  { id: 'sng_champion', tier: 'gold', trophy: '🥇', social: true, name: { he: 'אלוף הטורניר המהיר', en: 'Sit & Go Champion' }, desc: { he: 'נצח 5 טורנירי Sit & Go ברצף', en: 'Win 5 Sit & Go tournaments in a row' }, stat: 'sngWinStreak', goal: 5, reward: 6000 },
];

/** Plating for each tier — used by the shelf and the achievement list. */
export const TIER_STYLE: Record<Achievement['tier'], { ring: string; glow: string; label: { he: string; en: string } }> = {
  bronze: { ring: '#c08a3e', glow: 'rgba(192,138,62,.35)', label: { he: 'ארד', en: 'Bronze' } },
  silver: { ring: '#b9c0cb', glow: 'rgba(185,192,203,.35)', label: { he: 'כסף', en: 'Silver' } },
  gold: { ring: '#e3b23c', glow: 'rgba(227,178,60,.42)', label: { he: 'זהב', en: 'Gold' } },
  platinum: { ring: '#a878f0', glow: 'rgba(168,120,240,.42)', label: { he: 'פלטינה', en: 'Platinum' } },
};

export const achievementById = (id: string) => ACHIEVEMENTS.find((entry) => entry.id === id);

/** Ordered hardest-first, so the shelf shows off the best trophies. */
const TIER_RANK: Record<Achievement['tier'], number> = { platinum: 0, gold: 1, silver: 2, bronze: 3 };
export const byTierDesc = (a: Achievement, b: Achievement) => TIER_RANK[a.tier] - TIER_RANK[b.tier];
