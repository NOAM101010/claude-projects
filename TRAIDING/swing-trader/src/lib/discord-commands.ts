/**
 * הגדרות ה-Slash Commands של הבוט (פורמט JSON של Discord).
 * נרשמות דרך /api/discord/register. שמות בעברית — Discord תומך.
 */

const STRING = 3;
const NUMBER = 10;

export const DISCORD_COMMANDS = [
  {
    name: "מחיר",
    description: "מחיר, שינוי יומי, מרחק משיא.",
    options: [
      {
        type: STRING,
        name: "symbol",
        description: "סימבול המניה (למשל AAPL)",
        required: true,
      },
    ],
  },
  {
    name: "פוזיציות",
    description: "הפוזיציות הפתוחות שלך + P&L חי.",
  },
  {
    name: "סריקה",
    description: "תוצאות הסריקה האחרונה.",
  },
  {
    name: "ביצועים",
    description: "P&L והצלחה החודש.",
  },
  {
    name: "התראה",
    description: "צור התראת מחיר.",
    options: [
      {
        type: STRING,
        name: "symbol",
        description: "סימבול המניה",
        required: true,
      },
      {
        type: NUMBER,
        name: "מחיר",
        description: "מחיר היעד",
        required: true,
      },
      {
        type: STRING,
        name: "כיוון",
        description: "מעל או מתחת למחיר היעד",
        required: true,
        choices: [
          { name: "מעל", value: "מעל" },
          { name: "מתחת", value: "מתחת" },
        ],
      },
    ],
  },
  {
    name: "עזרה",
    description: "רשימת הפקודות של Swing Terminal.",
  },
  {
    name: "נתח",
    description: "ניתוח מניה מלא — ציון, גרייד, סטופ מוצע, אותות.",
    options: [
      {
        type: STRING,
        name: "symbol",
        description: "סימבול המניה (למשל AAPL)",
        required: true,
      },
    ],
  },
  {
    name: "מעקב",
    description: "הוסף או הסר מניה מרשימת המעקב.",
    options: [
      {
        type: STRING,
        name: "פעולה",
        description: "הוסף או הסר",
        required: true,
        choices: [
          { name: "הוסף", value: "add" },
          { name: "הסר", value: "remove" },
        ],
      },
      {
        type: STRING,
        name: "symbol",
        description: "סימבול המניה",
        required: true,
      },
    ],
  },
  {
    name: "חדשות",
    description: "כותרות חדשות — למניה ספציפית או פיד מצטבר.",
    options: [
      {
        type: STRING,
        name: "symbol",
        description: "סימבול המניה (רשות — ריק = פיד מצטבר)",
        required: false,
      },
    ],
  },
];
