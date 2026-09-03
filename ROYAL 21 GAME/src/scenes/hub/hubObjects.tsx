import { motion } from 'framer-motion';
import { Dealer } from '@/components/game/Dealer';
import { Avatar } from '@/components/social/Avatar';
import type { Friend } from '@/types';

/* Silhouettes: each object must be recognisable with the labels hidden (§151). */

export function BlackjackTableArt({ focused, dealerSkin }: { focused: boolean; dealerSkin: string }) {
  return (
    <div className="relative w-full" style={{ aspectRatio: '1.55' }}>
      <svg viewBox="0 0 320 206" className="w-full h-full" style={{ overflow: 'visible' }}>
        <defs>
          <radialGradient id="bjFelt" cx="50%" cy="18%" r="80%">
            <stop offset="0" stopColor="#1d4a37" /><stop offset="1" stopColor="#0c2018" />
          </radialGradient>
        </defs>
        {/* half-moon table */}
        <path d="M18 74h284a142 92 0 0 1-284 0z" fill="url(#bjFelt)" stroke="rgba(227,178,60,.4)" strokeWidth="2" />
        <path d="M18 74h284" stroke="rgba(227,178,60,.55)" strokeWidth="3" />
        <path d="M40 96h240a120 66 0 0 1-240 0z" fill="none" stroke="rgba(227,178,60,.2)" strokeWidth="1.4" />
        {/* three seat marks */}
        {[92, 160, 228].map((cx) => (
          <ellipse key={cx} cx={cx} cy={148} rx="22" ry="9" fill="none" stroke="rgba(255,255,255,.13)" />
        ))}
        {/* dealt cards nudge when you look at the table */}
        <motion.g animate={{ y: focused ? -3 : 0, rotate: focused ? -1.5 : 0 }} transition={{ duration: 0.4 }}>
          <rect x="132" y="86" width="26" height="36" rx="4" fill="#fffdf6" transform="rotate(-8 145 104)" />
          <rect x="150" y="86" width="26" height="36" rx="4" fill="#fffdf6" transform="rotate(6 163 104)" />
          <text x="140" y="110" fontSize="14" fill="#b0201f" transform="rotate(-8 145 104)">♥</text>
          <text x="158" y="110" fontSize="14" fill="#15161a" transform="rotate(6 163 104)">♠</text>
        </motion.g>
        {/* chip stacks catch the light */}
        {[[70, 152, '#a8413e'], [250, 154, '#e3b23c']].map(([cx, cy, color], i) => (
          <motion.g key={i} animate={{ y: focused ? -2 : 0 }} transition={{ duration: 0.4, delay: i * 0.05 }}>
            <ellipse cx={cx as number} cy={(cy as number) + 6} rx="17" ry="6" fill="rgba(0,0,0,.45)" />
            <ellipse cx={cx as number} cy={cy as number} rx="17" ry="6" fill={color as string} />
            <ellipse cx={cx as number} cy={(cy as number) - 5} rx="17" ry="6" fill={color as string} opacity=".82" />
          </motion.g>
        ))}
      </svg>
      {/* the dealer stands behind the table and looks up when you approach */}
      <div className="absolute start-1/2 -translate-x-1/2" style={{ top: '-28%', width: '34%' }}>
        <Dealer mood={focused ? 'deal' : 'shuffle'} skin={dealerSkin} size={140} lookAt={focused ? 0.4 : 0} />
      </div>
    </div>
  );
}

export function PokerTableArt({ focused }: { focused: boolean }) {
  const seats = [56, 130, 204, 268];
  return (
    <svg viewBox="0 0 320 176" className="w-full" style={{ aspectRatio: '1.8' }}>
      <ellipse cx="160" cy="90" rx="140" ry="66" fill="#123024" stroke="rgba(227,178,60,.4)" strokeWidth="2" />
      <ellipse cx="160" cy="86" rx="118" ry="52" fill="none" stroke="rgba(255,255,255,.1)" />
      {/* community cards + pot */}
      <motion.g animate={{ y: focused ? -3 : 0 }} transition={{ duration: 0.4 }}>
        {[0, 1, 2].map((i) => (
          <rect key={i} x={132 + i * 20} y="72" width="17" height="24" rx="3" fill="#fffdf6" stroke="rgba(0,0,0,.25)" transform={`rotate(${(i - 1) * 4} ${140 + i * 20} 84)`} />
        ))}
      </motion.g>
      <ellipse cx="160" cy="112" rx="16" ry="6" fill="rgba(0,0,0,.4)" />
      <ellipse cx="160" cy="110" rx="16" ry="6" fill="#e3b23c" opacity=".85" />
      {/* seats around the oval */}
      {seats.map((cx, i) => (
        <motion.g key={cx} animate={focused ? { y: [0, -3, 0] } : {}} transition={{ duration: 1.8, repeat: focused ? Infinity : 0, delay: i * 0.18 }}>
          <circle cx={cx} cy={i % 2 ? 40 : 142} r="11" fill="#1b1f27" stroke="rgba(227,178,60,.35)" strokeWidth="1.4" />
          <circle cx={cx} cy={(i % 2 ? 40 : 142) - 3} r="4" fill="#e3b23c" opacity=".8" />
        </motion.g>
      ))}
    </svg>
  );
}

export function DuelTableArt({ focused }: { focused: boolean }) {
  return (
    <svg viewBox="0 0 240 150" className="w-full" style={{ aspectRatio: '1.6' }}>
      <ellipse cx="120" cy="96" rx="96" ry="40" fill="#16302a" stroke="rgba(227,178,60,.35)" strokeWidth="2" />
      <ellipse cx="120" cy="90" rx="80" ry="31" fill="none" stroke="rgba(255,255,255,.1)" />
      {/* two facing seats: this is a versus table */}
      {[36, 204].map((cx, i) => (
        <g key={cx}>
          <rect x={cx - 16} y={64} width="32" height="26" rx="7" fill="#20242e" />
          <rect x={cx - 12} y={54} width="24" height="16" rx="6" fill="#2a2f3b" />
          <motion.circle cx={cx} cy={46} r="7" fill={i ? '#4aa8c8' : '#e3b23c'}
            animate={{ y: focused ? [-1, -4, -1] : 0 }} transition={{ duration: 1.6, repeat: Infinity }} />
        </g>
      ))}
      {/* the scoreboard is the tell */}
      <motion.g animate={{ opacity: focused ? 1 : 0.72 }}>
        <rect x="86" y="18" width="68" height="30" rx="7" fill="#0d1015" stroke="rgba(227,178,60,.5)" />
        <text x="106" y="40" fontSize="18" fontWeight="900" fill="#f8e3a8" fontFamily="var(--font-display)">7</text>
        <text x="120" y="39" fontSize="12" fill="#6a665f">:</text>
        <text x="130" y="40" fontSize="18" fontWeight="900" fill="#f8e3a8" fontFamily="var(--font-display)">5</text>
      </motion.g>
      <rect x="104" y="82" width="14" height="20" rx="3" fill="#fffdf6" transform="rotate(-7 111 92)" />
      <rect x="122" y="82" width="14" height="20" rx="3" fill="#fffdf6" transform="rotate(7 129 92)" />
    </svg>
  );
}

export function CoinStandArt({ focused }: { focused: boolean }) {
  return (
    <svg viewBox="0 0 120 140" className="w-full" style={{ aspectRatio: '0.86' }}>
      <rect x="34" y="86" width="52" height="42" rx="8" fill="#1b1f27" stroke="rgba(227,178,60,.28)" />
      <ellipse cx="60" cy="128" rx="34" ry="8" fill="rgba(0,0,0,.5)" />
      <motion.g
        animate={focused ? { rotateY: [0, 180, 360], y: [-6, -22, -6] } : { y: [0, -4, 0] }}
        transition={{ duration: focused ? 1.6 : 4, repeat: Infinity, ease: 'easeInOut' }}
        style={{ transformOrigin: '60px 52px' }}
      >
        <circle cx="60" cy="52" r="30" fill="#e3b23c" stroke="#8a6a1f" strokeWidth="3" />
        <text x="60" y="63" textAnchor="middle" fontSize="26" fontWeight="900" fill="#8a6a1f" fontFamily="var(--font-display)">21</text>
      </motion.g>
    </svg>
  );
}

export function HighCardArt({ focused }: { focused: boolean }) {
  return (
    <svg viewBox="0 0 130 130" className="w-full" style={{ aspectRatio: '1' }}>
      <rect x="20" y="92" width="90" height="30" rx="8" fill="#1b1f27" stroke="rgba(227,178,60,.24)" />
      <motion.g animate={{ y: focused ? -8 : 0, rotate: focused ? -8 : -4 }} transition={{ duration: 0.4 }}>
        <rect x="26" y="34" width="42" height="60" rx="6" fill="#8f2b28" stroke="rgba(255,255,255,.2)" />
        <text x="47" y="72" textAnchor="middle" fontSize="20" fill="rgba(255,255,255,.45)">♦</text>
      </motion.g>
      <motion.g animate={{ y: focused ? -14 : 0, rotate: focused ? 9 : 5 }} transition={{ duration: 0.4, delay: 0.05 }}>
        <rect x="62" y="30" width="42" height="60" rx="6" fill="#fffdf6" />
        <text x="70" y="50" fontSize="16" fontWeight="900" fill="#15161a" fontFamily="var(--font-display)">K</text>
        <text x="80" y="78" fontSize="22" fill="#15161a">♠</text>
      </motion.g>
    </svg>
  );
}

export function ScratchCounterArt({ focused }: { focused: boolean }) {
  return (
    <svg viewBox="0 0 220 130" className="w-full" style={{ aspectRatio: '1.7' }}>
      <rect x="10" y="62" width="200" height="52" rx="10" fill="#241812" stroke="rgba(227,178,60,.24)" />
      <rect x="10" y="62" width="200" height="9" rx="4" fill="#3a2a1c" />
      {[[30, -10], [78, -4], [126, 3], [172, 9]].map(([x, rot], i) => (
        <motion.g key={i} animate={{ y: focused ? -7 - i * 1.5 : 0, rotate: rot as number }}
          transition={{ duration: 0.35, delay: i * 0.04 }} style={{ transformOrigin: `${(x as number) + 20}px 60px` }}>
          <rect x={x as number} y="26" width="40" height="30" rx="5"
            fill={['#8b8f98', '#c08a3e', '#b9c0cb', '#e3b23c'][i]} stroke="rgba(0,0,0,.3)" />
          <rect x={(x as number) + 5} y="33" width="30" height="16" rx="3" fill="rgba(255,255,255,.25)" />
        </motion.g>
      ))}
    </svg>
  );
}

export function VaultDoorArt({ focused }: { focused: boolean }) {
  return (
    <svg viewBox="0 0 150 160" className="w-full" style={{ aspectRatio: '0.94' }}>
      <rect x="12" y="14" width="126" height="134" rx="14" fill="#14161b" stroke="rgba(227,178,60,.45)" strokeWidth="2" />
      <circle cx="75" cy="80" r="46" fill="#1b1f27" stroke="rgba(227,178,60,.35)" strokeWidth="2" />
      <motion.g animate={{ rotate: focused ? 42 : 0 }} transition={{ type: 'spring', stiffness: 90, damping: 14 }}
        style={{ transformOrigin: '75px 80px' }}>
        <circle cx="75" cy="80" r="30" fill="none" stroke="#e3b23c" strokeWidth="4" />
        {[0, 90, 180, 270].map((angle) => (
          <rect key={angle} x="72" y="42" width="6" height="18" rx="3" fill="#f8e3a8"
            transform={`rotate(${angle} 75 80)`} />
        ))}
        <circle cx="75" cy="80" r="9" fill="#8a6a1f" />
      </motion.g>
      <motion.rect x="26" y="26" width="98" height="106" rx="10" fill="none" stroke="#f8e3a8" strokeWidth="1"
        animate={{ opacity: focused ? 0.9 : 0.2 }} />
    </svg>
  );
}

export function LoungeArt({ friends, focused }: { friends: Friend[]; focused: boolean }) {
  return (
    <div className="relative w-full">
      <svg viewBox="0 0 240 110" className="w-full">
        <rect x="16" y="46" width="208" height="46" rx="14" fill="#2a1420" stroke="rgba(255,255,255,.08)" />
        <rect x="26" y="30" width="188" height="30" rx="12" fill="#381b2a" />
        <rect x="16" y="86" width="208" height="10" rx="5" fill="#1c0f16" />
        <motion.ellipse cx="120" cy="24" rx="70" ry="10" fill="rgba(74,168,200,.16)"
          animate={{ opacity: focused ? 0.9 : 0.4 }} />
      </svg>
      <div className="absolute inset-x-0 flex justify-center gap-1.5" style={{ top: '4%' }}>
        {friends.slice(0, 4).map((friend, index) => (
          <motion.div key={friend.id}
            animate={{ y: [0, -3, 0] }}
            transition={{ duration: 3 + index * 0.4, repeat: Infinity, ease: 'easeInOut', delay: index * 0.3 }}>
            <Avatar config={friend.avatar} size={30} level={friend.level} presence={friend.presence} id={`lounge-${friend.id}`} />
          </motion.div>
        ))}
        {friends.length === 0 && (
          <div className="text-[22px] ambient-breathe" style={{ opacity: 0.5 }}>🕯️</div>
        )}
      </div>
    </div>
  );
}

export function MyRoomDoorArt({ focused, name }: { focused: boolean; name: string }) {
  return (
    <svg viewBox="0 0 110 160" className="w-full" style={{ aspectRatio: '0.69' }}>
      <rect x="10" y="10" width="90" height="140" rx="8" fill="url(#wood)" />
      <defs>
        <linearGradient id="wood" x1="0" x2="1"><stop offset="0" stopColor="#2a1c14" /><stop offset="1" stopColor="#150d09" /></linearGradient>
      </defs>
      <rect x="10" y="10" width="90" height="140" rx="8" fill="none" stroke="rgba(227,178,60,.3)" strokeWidth="2" />
      <rect x="22" y="26" width="66" height="46" rx="5" fill="none" stroke="rgba(227,178,60,.18)" />
      <rect x="22" y="86" width="66" height="46" rx="5" fill="none" stroke="rgba(227,178,60,.18)" />
      <motion.circle cx="84" cy="82" r="5" fill="#e3b23c" animate={{ scale: focused ? 1.25 : 1 }} />
      <rect x="26" y="40" width="58" height="18" rx="4" fill="#0d1015" stroke="rgba(227,178,60,.4)" />
      <text x="55" y="53" textAnchor="middle" fontSize="10" fill="#f8e3a8" fontFamily="var(--font-display)" fontWeight="700">
        {name.slice(0, 12)}
      </text>
    </svg>
  );
}

export function SlotMachineArt({ focused }: { focused: boolean }) {
  const reels = ['7', '💎', '7'];
  return (
    <svg viewBox="0 0 140 160" className="w-full" style={{ aspectRatio: '0.88' }}>
      <defs>
        <linearGradient id="slotBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a2d35" />
          <stop offset="1" stopColor="#14161b" />
        </linearGradient>
      </defs>
      {/* cabinet */}
      <rect x="16" y="18" width="108" height="126" rx="14" fill="url(#slotBody)" stroke="rgba(227,178,60,.38)" strokeWidth="2" />
      <rect x="26" y="30" width="88" height="16" rx="6" fill="#0e1014" stroke="rgba(227,178,60,.22)" />
      <text x="70" y="42" textAnchor="middle" fill="var(--gold)" fontSize="9" fontWeight="900" letterSpacing="2">ROYAL</text>
      {/* reel window */}
      <rect x="26" y="54" width="88" height="46" rx="7" fill="#08090b" stroke="rgba(255,255,255,.12)" />
      {reels.map((symbol, index) => (
        <motion.text
          key={index}
          x={41 + index * 29}
          y="84"
          textAnchor="middle"
          fontSize="20"
          animate={focused ? { y: [84, 74, 84] } : {}}
          transition={{ duration: 0.6, repeat: focused ? Infinity : 0, delay: index * 0.12, ease: 'easeInOut' }}
        >
          {symbol}
        </motion.text>
      ))}
      {/* payline */}
      <line x1="30" y1="77" x2="110" y2="77" stroke="rgba(227,178,60,.35)" strokeWidth="1" strokeDasharray="3 3" />
      {/* bulbs */}
      {[0, 1, 2, 3, 4].map((i) => (
        <motion.circle
          key={i}
          cx={32 + i * 19}
          cy="112"
          r="3.4"
          fill="var(--gold)"
          animate={{ opacity: focused ? [0.35, 1, 0.35] : 0.4 }}
          transition={{ duration: 1.1, repeat: focused ? Infinity : 0, delay: i * 0.14 }}
        />
      ))}
      <rect x="42" y="124" width="56" height="10" rx="5" fill="#0e1014" stroke="rgba(227,178,60,.2)" />
      {/* lever */}
      <motion.g animate={{ rotate: focused ? 16 : 0 }} style={{ originX: '124px', originY: '70px' }} transition={{ duration: 0.35 }}>
        <line x1="124" y1="70" x2="130" y2="46" stroke="#8b8f98" strokeWidth="3" strokeLinecap="round" />
        <circle cx="131" cy="43" r="6" fill="var(--crimson-hi)" stroke="rgba(0,0,0,.4)" />
      </motion.g>
      <ellipse cx="70" cy="150" rx="46" ry="7" fill="rgba(0,0,0,.55)" />
    </svg>
  );
}

export function GameNightArt({ focused }: { focused: boolean }) {
  const seats = [
    { x: 40, y: 52, tint: 'var(--gold)' },
    { x: 100, y: 44, tint: 'var(--social)' },
    { x: 160, y: 52, tint: 'var(--violet)' },
    { x: 100, y: 96, tint: 'var(--jade-hi)' },
  ];
  return (
    <svg viewBox="0 0 200 140" className="w-full" style={{ aspectRatio: '1.43' }}>
      {/* round table with a scoreboard on it */}
      <ellipse cx="100" cy="86" rx="78" ry="34" fill="#16302a" stroke="rgba(227,178,60,.34)" strokeWidth="2" />
      <ellipse cx="100" cy="82" rx="62" ry="24" fill="none" stroke="rgba(255,255,255,.09)" />
      <rect x="72" y="70" width="56" height="26" rx="5" fill="#0e1014" stroke="rgba(227,178,60,.3)" />
      <text x="100" y="82" textAnchor="middle" fill="var(--gold-hi)" fontSize="8" fontWeight="900">SCORE</text>
      <motion.text
        x="100" y="92" textAnchor="middle" fill="var(--text)" fontSize="8" fontWeight="700"
        animate={focused ? { opacity: [0.5, 1, 0.5] } : {}}
        transition={{ duration: 1.4, repeat: focused ? Infinity : 0 }}
      >
        7 · 5 · 3
      </motion.text>
      {/* players around it */}
      {seats.map((seat, index) => (
        <motion.g
          key={index}
          animate={focused ? { y: [0, -4, 0] } : {}}
          transition={{ duration: 1.8, repeat: focused ? Infinity : 0, delay: index * 0.2, ease: 'easeInOut' }}
        >
          <circle cx={seat.x} cy={seat.y} r="12" fill="#1b1f27" stroke={seat.tint} strokeWidth="1.6" />
          <circle cx={seat.x} cy={seat.y - 3} r="4" fill={seat.tint} opacity=".85" />
          <path d={`M${seat.x - 6} ${seat.y + 8} q6 -6 12 0`} fill={seat.tint} opacity=".7" />
        </motion.g>
      ))}
      <ellipse cx="100" cy="126" rx="60" ry="8" fill="rgba(0,0,0,.5)" />
    </svg>
  );
}

export function RouletteTableArt({ focused }: { focused: boolean }) {
  const pockets = 14;
  return (
    <svg viewBox="0 0 160 160" className="w-full" style={{ aspectRatio: '1' }}>
      <ellipse cx="80" cy="146" rx="58" ry="9" fill="rgba(0,0,0,.5)" />
      <circle cx="80" cy="78" r="66" fill="#0e1014" stroke="rgba(227,178,60,.4)" strokeWidth="2" />
      <motion.g
        style={{ transformOrigin: '80px 78px' }}
        animate={focused ? { rotate: 360 } : { rotate: 0 }}
        transition={{ duration: 3.2, repeat: focused ? Infinity : 0, ease: 'linear' }}
      >
        {Array.from({ length: pockets }, (_, i) => {
          const angle = (360 / pockets) * i;
          const color = i % 5 === 0 ? '#1c7a4a' : i % 2 === 0 ? '#a8413e' : '#15161a';
          return (
            <rect key={i} x="78" y="18" width="4" height="16" rx="1.5" fill={color}
              transform={`rotate(${angle} 80 78)`} />
          );
        })}
        <circle cx="80" cy="78" r="30" fill="url(#rlHub)" stroke="rgba(227,178,60,.5)" strokeWidth="1.6" />
      </motion.g>
      <defs>
        <radialGradient id="rlHub" cx="50%" cy="35%" r="70%">
          <stop offset="0" stopColor="#2a2d35" /><stop offset="1" stopColor="#0e1014" />
        </radialGradient>
      </defs>
      <motion.circle cx="80" cy="30" r="4" fill="#e8e3d4"
        animate={focused ? { rotate: -360 } : { rotate: 0 }}
        style={{ transformOrigin: '80px 78px' }}
        transition={{ duration: 2, repeat: focused ? Infinity : 0, ease: 'linear' }} />
    </svg>
  );
}

export function GiftArt({ ready }: { ready: boolean }) {
  return (
    <motion.div
      animate={ready ? { y: [0, -7, 0], rotate: [0, -4, 4, 0] } : {}}
      transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
      style={{ fontSize: 'clamp(28px, 4vw, 44px)', filter: ready ? 'drop-shadow(0 0 16px var(--glow-gold))' : 'grayscale(.7) opacity(.6)' }}
    >
      🎁
    </motion.div>
  );
}

export function InviteArt({ ready }: { ready: boolean }) {
  return (
    <motion.div
      animate={ready ? { y: [0, -9, 0], x: [0, 6, 0], rotate: [-8, 4, -8] } : {}}
      transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      style={{ fontSize: 'clamp(28px, 4vw, 44px)', filter: ready ? 'drop-shadow(0 0 16px var(--glow-gold))' : 'grayscale(.7) opacity(.6)' }}
    >
      ✈️
    </motion.div>
  );
}
