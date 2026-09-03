import type { ShopItem } from '@/types';
import { PRICE_BY_RARITY } from './economy';

/** Seed catalogue. Mirrored into the `items` table by supabase/setup.sql. */
export const ITEMS: ShopItem[] = [
  // ---- card faces ----
  { id: 'cf_classic', category: 'cards', name: { he: 'קלפים קלאסיים', en: 'Classic Cards' }, rarity: 'common', price: 0, icon: '🂡', payload: { cardFace: 'cf-classic' } },
  { id: 'cf_noir', category: 'cards', name: { he: 'קלפי נואר', en: 'Noir Cards' }, rarity: 'rare', price: 2000, icon: '🖤', payload: { cardFace: 'cf-noir' } },
  { id: 'cf_gold', category: 'cards', name: { he: 'קלפי זהב', en: 'Gold Cards' }, rarity: 'epic', price: 8000, icon: '👑', payload: { cardFace: 'cf-gold' } },
  { id: 'cf_neon', category: 'cards', name: { he: 'קלפי ניאון', en: 'Neon Cards' }, rarity: 'epic', price: 8000, icon: '⚡', payload: { cardFace: 'cf-neon' } },
  { id: 'cf_ice', category: 'cards', name: { he: 'קלפי קרח', en: 'Ice Cards' }, rarity: 'legendary', price: 22000, icon: '❄️', payload: { cardFace: 'cf-ice' } },
  { id: 'cf_fire', category: 'cards', name: { he: 'קלפי אש', en: 'Fire Cards' }, rarity: 'mythic', price: 55000, icon: '🔥', payload: { cardFace: 'cf-fire' } },
  // ---- card backs ----
  { id: 'bk_crimson', category: 'backs', name: { he: 'ארגמן קלאסי', en: 'Crimson Classic' }, rarity: 'common', price: 0, icon: '🂠', payload: { cardBack: 'bk-crimson' } },
  { id: 'bk_noir', category: 'backs', name: { he: 'שחור יוקרתי', en: 'Black Luxury' }, rarity: 'rare', price: 2000, icon: '🃏', payload: { cardBack: 'bk-noir' } },
  { id: 'bk_crown', category: 'backs', name: { he: 'כתר זהב', en: 'Gold Crown' }, rarity: 'epic', price: 8000, icon: '👑', payload: { cardBack: 'bk-crown' } },
  { id: 'bk_galaxy', category: 'backs', name: { he: 'גלקסיה', en: 'Galaxy' }, rarity: 'epic', price: 8000, icon: '✦', payload: { cardBack: 'bk-galaxy' } },
  { id: 'bk_ember', category: 'backs', name: { he: 'גחלים', en: 'Ember' }, rarity: 'legendary', price: 22000, icon: '🔥', payload: { cardBack: 'bk-ember' } },
  { id: 'bk_frost', category: 'backs', name: { he: 'כפור', en: 'Frost' }, rarity: 'legendary', price: 22000, icon: '❄️', payload: { cardBack: 'bk-frost' } },
  // ---- chips ----
  { id: 'ch_classic', category: 'chips', name: { he: 'צ׳יפים קלאסיים', en: 'Classic Chips' }, rarity: 'common', price: 0, icon: '🪙', payload: { chipSkin: 'ck-classic' } },
  { id: 'ch_gold', category: 'chips', name: { he: 'צ׳יפים מוזהבים', en: 'Gold Chips' }, rarity: 'rare', price: 2000, icon: '🟡', payload: { chipSkin: 'ck-gold' } },
  { id: 'ch_neon', category: 'chips', name: { he: 'צ׳יפי ניאון', en: 'Neon Chips' }, rarity: 'epic', price: 8000, icon: '⚡', payload: { chipSkin: 'ck-neon' } },
  { id: 'ch_ivory', category: 'chips', name: { he: 'צ׳יפי שנהב', en: 'Ivory Chips' }, rarity: 'epic', price: 8000, icon: '🤍', payload: { chipSkin: 'ck-ivory' } },
  { id: 'ch_obsidian', category: 'chips', name: { he: 'צ׳יפי אובסידיאן', en: 'Obsidian Chips' }, rarity: 'legendary', price: 22000, icon: '⬛', payload: { chipSkin: 'ck-obsidian' } },
  { id: 'ch_ember', category: 'chips', name: { he: 'צ׳יפי להבה', en: 'Ember Chips' }, rarity: 'mythic', price: 55000, icon: '🔥', payload: { chipSkin: 'ck-ember' } },
  // ---- tables ----
  { id: 'tb_green', category: 'tables', name: { he: 'ירוק קלאסי', en: 'Classic Green' }, rarity: 'common', price: 0, icon: '🟢', payload: { table: 'tb-green' } },
  { id: 'tb_noir', category: 'tables', name: { he: 'שחור מלכותי', en: 'Royal Black' }, rarity: 'rare', price: 2000, icon: '⬛', payload: { table: 'tb-noir' } },
  { id: 'tb_midnight', category: 'tables', name: { he: 'כחול חצות', en: 'Midnight Blue' }, rarity: 'rare', price: 2000, icon: '🔵', payload: { table: 'tb-midnight' } },
  { id: 'tb_gold', category: 'tables', name: { he: 'זהב יוקרתי', en: 'Luxury Gold' }, rarity: 'epic', price: 8000, icon: '👑', payload: { table: 'tb-gold' } },
  { id: 'tb_cyber', category: 'tables', name: { he: 'סייבר', en: 'Cyber' }, rarity: 'epic', price: 8000, icon: '⚡', payload: { table: 'tb-cyber' } },
  { id: 'tb_crimson', category: 'tables', name: { he: 'קטיפה ארגמנית', en: 'Crimson Velvet' }, rarity: 'mythic', price: 55000, icon: '🍷', payload: { table: 'tb-crimson' } },
  // ---- clothing ----
  { id: 'cl_gold', category: 'clothing', name: { he: 'חליפת זהב', en: 'Gold Suit' }, rarity: 'epic', price: 8000, icon: '🥇', payload: { shirt: 'gold' } },
  { id: 'cl_royal', category: 'clothing', name: { he: 'חליפה מלכותית', en: 'Royal Suit' }, rarity: 'epic', price: 8000, icon: '🟣', payload: { shirt: 'royal' } },
  { id: 'cl_neon', category: 'clothing', name: { he: 'חליפת ניאון', en: 'Neon Suit' }, rarity: 'rare', price: 2000, icon: '🟩', payload: { shirt: 'neon' } },
  { id: 'cl_crimson', category: 'clothing', name: { he: 'חליפה ארגמנית', en: 'Crimson Suit' }, rarity: 'rare', price: 2000, icon: '🟥', payload: { shirt: 'crimson' } },
  { id: 'cl_cap', category: 'clothing', name: { he: 'כובע מצחייה', en: 'Cap' }, rarity: 'common', price: 0, icon: '🧢', payload: { hat: 'cap' } },
  { id: 'cl_fedora', category: 'clothing', name: { he: 'מגבעת', en: 'Fedora' }, rarity: 'rare', price: 2000, icon: '🎩', payload: { hat: 'fedora' } },
  { id: 'cl_crown', category: 'clothing', name: { he: 'כתר', en: 'Crown' }, rarity: 'legendary', price: 22000, icon: '👑', payload: { hat: 'crown' } },
  // ---- glasses / watches / chains ----
  { id: 'gl_sun', category: 'glasses', name: { he: 'משקפי שמש', en: 'Sunglasses' }, rarity: 'common', price: 0, icon: '🕶️', payload: { glasses: 'sun' } },
  { id: 'gl_gold', category: 'glasses', name: { he: 'משקפי זהב', en: 'Gold Frames' }, rarity: 'rare', price: 2000, icon: '👓', payload: { glasses: 'clear' } },
  { id: 'wt_steel', category: 'watches', name: { he: 'שעון פלדה', en: 'Steel Watch' }, rarity: 'rare', price: 2000, icon: '⌚', payload: { watch: 'steel' } },
  { id: 'wt_gold', category: 'watches', name: { he: 'שעון זהב', en: 'Gold Watch' }, rarity: 'epic', price: 8000, icon: '⌚', payload: { watch: 'gold' } },
  { id: 'cn_silver', category: 'chains', name: { he: 'שרשרת כסף', en: 'Silver Chain' }, rarity: 'rare', price: 2000, icon: '🔗', payload: { chain: 'silver' } },
  { id: 'cn_gold', category: 'chains', name: { he: 'שרשרת זהב', en: 'Gold Chain' }, rarity: 'epic', price: 8000, icon: '📿', payload: { chain: 'gold' } },
  // ---- frames ----
  { id: 'fr_gold', category: 'frames', name: { he: 'מסגרת זהב', en: 'Gold Frame' }, rarity: 'epic', price: 8000, icon: '🖼️', payload: { frame: 'fr-gold' } },
  { id: 'fr_ice', category: 'frames', name: { he: 'מסגרת קרח', en: 'Ice Frame' }, rarity: 'legendary', price: 22000, icon: '💠', payload: { frame: 'fr-ice' } },
  { id: 'fr_ember', category: 'frames', name: { he: 'מסגרת גחלים', en: 'Ember Frame' }, rarity: 'mythic', price: 55000, icon: '🔥', payload: { frame: 'fr-ember' } },
  // ---- victory animations ----
  { id: 'vc_sparks', category: 'victory', name: { he: 'ניצוצות', en: 'Sparks' }, rarity: 'rare', price: 2000, icon: '✨', payload: { victory: 'vc-sparks' } },
  { id: 'vc_coins', category: 'victory', name: { he: 'גשם צ׳יפים', en: 'Chip Rain' }, rarity: 'epic', price: 8000, icon: '🪙', payload: { victory: 'vc-coins' } },
  { id: 'vc_crown', category: 'victory', name: { he: 'הכתרה', en: 'Coronation' }, rarity: 'mythic', price: 55000, icon: '👑', payload: { victory: 'vc-crown' } },
  // ---- dealer skins ----
  { id: 'dl_house', category: 'dealers', name: { he: 'דילר הבית', en: 'House Dealer' }, rarity: 'common', price: 0, icon: '🎩', payload: { dealerSkin: 'dl-house' } },
  { id: 'dl_noir', category: 'dealers', name: { he: 'דילר נואר', en: 'Noir Dealer' }, rarity: 'epic', price: 8000, icon: '🕴️', payload: { dealerSkin: 'dl-noir' } },
  { id: 'dl_royal', category: 'dealers', name: { he: 'דילר מלכותי', en: 'Royal Dealer' }, rarity: 'legendary', price: 22000, icon: '👑', payload: { dealerSkin: 'dl-royal' } },
  // ---- emotes ----
  { id: 'em_laugh', category: 'emotes', name: { he: 'צחוק', en: 'Laugh' }, rarity: 'common', price: 0, icon: '😂', payload: { emote: '😂' } },
  { id: 'em_cool', category: 'emotes', name: { he: 'קול', en: 'Cool' }, rarity: 'common', price: 0, icon: '😎', payload: { emote: '😎' } },
  { id: 'em_angry', category: 'emotes', name: { he: 'כועס', en: 'Angry' }, rarity: 'common', price: 0, icon: '😡', payload: { emote: '😡' } },
  { id: 'em_shake', category: 'emotes', name: { he: 'לחיצת יד', en: 'Handshake' }, rarity: 'common', price: 0, icon: '🤝', payload: { emote: '🤝' } },
  { id: 'em_fire', category: 'emotes', name: { he: 'אש', en: 'Fire' }, rarity: 'rare', price: 2000, icon: '🔥', payload: { emote: '🔥' } },
  { id: 'em_skull', category: 'emotes', name: { he: 'גולגולת', en: 'Skull' }, rarity: 'rare', price: 2000, icon: '💀', payload: { emote: '💀' } },
  { id: 'em_clown', category: 'emotes', name: { he: 'ליצן', en: 'Clown' }, rarity: 'rare', price: 2000, icon: '🤡', payload: { emote: '🤡' } },
  { id: 'em_crown', category: 'emotes', name: { he: 'כתר', en: 'Crown' }, rarity: 'epic', price: 8000, icon: '👑', payload: { emote: '👑' } },
  // ---- coin flip skins ----
  { id: 'cn_classic', category: 'coins', name: { he: 'מטבע קלאסי', en: 'Classic Coin' }, desc: { he: 'מטבע כסף עם סמל ₪', en: 'A silver coin stamped with ₪' }, rarity: 'common', price: 0, icon: '🪙', payload: { coinSkin: 'cn-classic' } },
  { id: 'cn_gold_shine', category: 'coins', name: { he: 'מטבע זהב מבריק', en: 'Shining Gold Coin' }, desc: { he: 'מטבע זהב עם סמל €', en: 'A gold coin stamped with €' }, rarity: 'rare', price: 1800, icon: '✨', payload: { coinSkin: 'cn-gold' } },
  { id: 'cn_neon', category: 'coins', name: { he: 'מטבע ניאון', en: 'Neon Coin' }, desc: { he: 'מטבע ניאון עם סמל $', en: 'A neon coin stamped with $' }, rarity: 'epic', price: 7000, icon: '⚡', payload: { coinSkin: 'cn-neon' } },
  { id: 'cn_diamond', category: 'coins', name: { he: 'מטבע יהלום', en: 'Diamond Coin' }, desc: { he: 'מטבע פלטינה עם יהלום', en: 'A platinum coin set with a diamond' }, rarity: 'legendary', price: 20000, icon: '💎', payload: { coinSkin: 'cn-diamond' } },
  { id: 'cn_royal', category: 'coins', name: { he: 'מטבע מלכותי', en: 'Royal Coin' }, desc: { he: 'מטבע סגול-זהב עם כתר', en: 'A purple-gold coin crowned in gold' }, rarity: 'mythic', price: 50000, icon: '👑', payload: { coinSkin: 'cn-royal' } },
  // ---- Daily Rarity exclusive CURRENCIES — replace the chip glyph everywhere, ----
  // ---- but never appear as a Coin Flip game piece (they use currencySkin, not coinSkin). ----
  { id: 'cn_dollar', category: 'coins', name: { he: 'מטבע דולר', en: 'Dollar Coin' }, desc: { he: 'מטבע נחושת עם סמל $ מוזהב', en: 'Copper coin with a gilded $ mark' }, rarity: 'legendary', price: 30000, icon: '💵', payload: { currencySkin: 'cn-dollar' }, dailyRarityOnly: true },
  { id: 'cn_euro', category: 'coins', name: { he: 'מטבע יורו', en: 'Euro Coin' }, desc: { he: 'מטבע כחול-כסף עם סמל €', en: 'Silver-blue coin with a € mark' }, rarity: 'legendary', price: 30000, icon: '💶', payload: { currencySkin: 'cn-euro' }, dailyRarityOnly: true },
  { id: 'cn_pound', category: 'coins', name: { he: 'מטבע ליש"ט', en: 'Pound Coin' }, desc: { he: 'מטבע ברונזה עתיק עם סמל £', en: 'Antique bronze coin with a £ mark' }, rarity: 'legendary', price: 30000, icon: '💷', payload: { currencySkin: 'cn-pound' }, dailyRarityOnly: true },
  { id: 'cn_yen', category: 'coins', name: { he: 'מטבע יין', en: 'Yen Coin' }, desc: { he: 'מטבע יפני מסורתי עם סמל ¥', en: 'Traditional Japanese coin with a ¥ mark' }, rarity: 'legendary', price: 30000, icon: '💴', payload: { currencySkin: 'cn-yen' }, dailyRarityOnly: true },
  { id: 'cn_bitcoin', category: 'coins', name: { he: 'מטבע ביטקוין', en: 'Bitcoin Coin' }, desc: { he: 'מטבע דיגיטלי מיתי עם סמל ₿', en: 'Mythic digital coin with a ₿ mark' }, rarity: 'mythic', price: 75000, icon: '🟠', payload: { currencySkin: 'cn-bitcoin' }, dailyRarityOnly: true },
  { id: 'cn_shekel_gold', category: 'coins', name: { he: 'שקל זהב עתיק', en: 'Ancient Gold Shekel' }, desc: { he: 'שקל זהב טהור עם סמל ₪', en: 'Pure gold shekel with a ₪ mark' }, rarity: 'mythic', price: 75000, icon: '🟡', payload: { currencySkin: 'cn-shekel-gold' }, dailyRarityOnly: true },
  // ---- slot machine themes ----
  { id: 'sl_classic', category: 'reels', name: { he: 'מכונה קלאסית', en: 'Classic Machine' }, desc: { he: 'מראה קלאסי וניטרלי', en: 'Classic look & feel' }, rarity: 'common', price: 0, icon: '🎰', payload: { slotsTheme: 'sl-classic' } },
  { id: 'sl_fruit', category: 'reels', name: { he: 'מכונת פירות', en: 'Fruit Machine' }, desc: { he: 'סגנון פירות צבעוני', en: 'Colorful fruit theme' }, rarity: 'rare', price: 1800, icon: '🍒', payload: { slotsTheme: 'sl-fruit' } },
  { id: 'sl_neon', category: 'reels', name: { he: 'מכונת ניאון', en: 'Neon Machine' }, desc: { he: 'אורות ניאון זוהרים', en: 'Glowing neon lights' }, rarity: 'epic', price: 7000, icon: '⚡', payload: { slotsTheme: 'sl-neon' } },
  { id: 'sl_egypt', category: 'reels', name: { he: 'אוצרות מצרים', en: 'Egyptian Treasure' }, desc: { he: 'נושא מצרי עתיק', en: 'Ancient Egyptian vibes' }, rarity: 'legendary', price: 20000, icon: '𓂀', payload: { slotsTheme: 'sl-egypt' } },
  { id: 'sl_galaxy', category: 'reels', name: { he: 'גלקסיה', en: 'Galaxy' }, desc: { he: 'כוכבים וחלל קוסמי', en: 'Stars & cosmic space' }, rarity: 'mythic', price: 50000, icon: '🌌', payload: { slotsTheme: 'sl-galaxy' } },
  // ---- room backgrounds ----
  { id: 'rb_default', category: 'backgrounds', name: { he: 'רקע קלאסי', en: 'Classic Room' }, desc: { he: 'תמונת רקע ניטרלית', en: 'Default backdrop' }, rarity: 'common', price: 0, icon: '🌑', payload: { roomBackground: 'rb-default' } },
  { id: 'rb_emerald', category: 'backgrounds', name: { he: 'ירוק אזמרגד', en: 'Emerald Room' }, desc: { he: 'ירוק עשיר וטבעי', en: 'Rich emerald green' }, rarity: 'rare', price: 2000, icon: '💚', payload: { roomBackground: 'rb-emerald' } },
  { id: 'rb_crimson', category: 'backgrounds', name: { he: 'אדום ארגמן', en: 'Crimson Room' }, desc: { he: 'אדום עמוק וחם', en: 'Deep warm crimson' }, rarity: 'rare', price: 2000, icon: '❤️', payload: { roomBackground: 'rb-crimson' } },
  { id: 'rb_midnight', category: 'backgrounds', name: { he: 'כחול חצות', en: 'Midnight Room' }, desc: { he: 'כחול קר וסתרי', en: 'Cool midnight blue' }, rarity: 'epic', price: 8000, icon: '💙', payload: { roomBackground: 'rb-midnight' } },
  { id: 'rb_gold', category: 'backgrounds', name: { he: 'זהב מלכותי', en: 'Royal Gold Room' }, desc: { he: 'זהב בוהק וממלכתי', en: 'Lustrous royal gold' }, rarity: 'legendary', price: 22000, icon: '💛', payload: { roomBackground: 'rb-gold' } },

  // ==== Stage G — shop expansion (themed packs + rare rotation pool) ==========
  // ---- card faces ----
  { id: 'cf_royal', category: 'cards', name: { he: 'קלפים מלכותיים', en: 'Royal Cards' }, rarity: 'legendary', price: 22000, icon: '♛', payload: { cardFace: 'cf-royal' } },
  { id: 'cf_jade', category: 'cards', name: { he: 'קלפי אזמרגד', en: 'Jade Cards' }, rarity: 'epic', price: 8000, icon: '💚', payload: { cardFace: 'cf-jade' } },
  { id: 'cf_blush', category: 'cards', name: { he: 'קלפי ורד', en: 'Blush Cards' }, rarity: 'rare', price: 2000, icon: '🌹', payload: { cardFace: 'cf-blush' } },
  // ---- card backs ----
  { id: 'bk_royal', category: 'backs', name: { he: 'גב מלכותי', en: 'Royal Back' }, rarity: 'legendary', price: 22000, icon: '♛', payload: { cardBack: 'bk-royal' } },
  { id: 'bk_jade', category: 'backs', name: { he: 'גב אזמרגד', en: 'Jade Back' }, rarity: 'epic', price: 8000, icon: '💚', payload: { cardBack: 'bk-jade' } },
  { id: 'bk_wave', category: 'backs', name: { he: 'גב גלים', en: 'Wave Back' }, rarity: 'rare', price: 2000, icon: '🌊', payload: { cardBack: 'bk-wave' } },
  // ---- tables ----
  { id: 'tb_royal', category: 'tables', name: { he: 'קטיפה מלכותית', en: 'Royal Velvet' }, rarity: 'legendary', price: 22000, icon: '👑', payload: { table: 'tb-royal' } },
  { id: 'tb_jade', category: 'tables', name: { he: 'לבד אזמרגד', en: 'Jade Felt' }, rarity: 'epic', price: 8000, icon: '💚', payload: { table: 'tb-jade' } },
  // ---- avatar frames ----
  { id: 'fr_royal', category: 'frames', name: { he: 'מסגרת מלכותית', en: 'Royal Frame' }, rarity: 'legendary', price: 22000, icon: '👑', payload: { frame: 'fr-royal' } },
  { id: 'fr_jade', category: 'frames', name: { he: 'מסגרת אזמרגד', en: 'Jade Frame' }, rarity: 'epic', price: 8000, icon: '💠', payload: { frame: 'fr-jade' } },
  { id: 'fr_rose', category: 'frames', name: { he: 'מסגרת ורד', en: 'Rose Frame' }, rarity: 'rare', price: 2000, icon: '🌹', payload: { frame: 'fr-rose' } },
  // ---- victory animations ----
  { id: 'vc_fireworks', category: 'victory', name: { he: 'זיקוקים', en: 'Fireworks' }, rarity: 'epic', price: 8000, icon: '🎆', payload: { victory: 'vc-fireworks' } },
  { id: 'vc_stars', category: 'victory', name: { he: 'מטר כוכבים', en: 'Star Shower' }, rarity: 'legendary', price: 22000, icon: '🌟', payload: { victory: 'vc-stars' } },
  // ---- currency skins (change the chip glyph everywhere) ----
  // Rare Rotation pool — surface one per weekday, hidden from the regular grid.
  { id: 'cn_gem', category: 'coins', name: { he: 'מטבע יהלום', en: 'Gem Coin' }, desc: { he: 'מטבע קריסטל עם סמל 💎', en: 'Crystal coin bearing a 💎 mark' }, rarity: 'legendary', price: 30000, icon: '💎', payload: { currencySkin: 'cn-gem' }, rareRotationOnly: true },
  { id: 'cn_crown_cur', category: 'coins', name: { he: 'מטבע כתר', en: 'Crown Coin' }, desc: { he: 'מטבע זהב-סגול עם כתר', en: 'Purple-gold coin crowned in gold' }, rarity: 'mythic', price: 75000, icon: '👑', payload: { currencySkin: 'cn-crown' }, rareRotationOnly: true },
  { id: 'cn_nova', category: 'coins', name: { he: 'מטבע נובה', en: 'Nova Coin' }, desc: { he: 'מטבע קוסמי עם סמל ✦', en: 'Cosmic coin bearing a ✦ mark' }, rarity: 'mythic', price: 75000, icon: '✦', payload: { currencySkin: 'cn-nova' }, rareRotationOnly: true },
  // Daily Rarity pool — one exclusive per day.
  { id: 'cn_ancient', category: 'coins', name: { he: 'מטבע עתיק', en: 'Ancient Coin' }, desc: { he: 'מטבע נחושת עתיק עם סמל ⚜', en: 'Antique copper coin with a ⚜ mark' }, rarity: 'legendary', price: 30000, icon: '⚜', payload: { currencySkin: 'cn-ancient' }, dailyRarityOnly: true },
  { id: 'cn_casino', category: 'coins', name: { he: 'ז׳יטון קזינו', en: 'Casino Token' }, desc: { he: 'ז׳יטון קלאסי עם סמל ♠', en: 'Classic casino token with a ♠ mark' }, rarity: 'epic', price: 8000, icon: '♠', payload: { currencySkin: 'cn-casino' }, dailyRarityOnly: true },
];

export const priceOf = (rarity: string) => PRICE_BY_RARITY[rarity] ?? 0;

export const itemById = (id: string) => ITEMS.find((item) => item.id === id);

export const DEFAULT_OWNED = [
  'cf_classic', 'bk_crimson', 'ch_classic', 'tb_green', 'dl_house',
  'em_laugh', 'em_cool', 'em_angry', 'em_shake', 'cn_classic', 'sl_classic', 'rb_default',
];

export const RARITY_ORDER: Record<string, number> = {
  common: 0, rare: 1, epic: 2, legendary: 3, mythic: 4,
};
