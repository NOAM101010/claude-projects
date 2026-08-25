// Reference/static data only — no personal seed content. Everything the user
// sees (vehicles, trips, expenses, service, friends...) is entered by them and
// lives in the store, so a fresh browser/phone always starts empty.

export type Bi = [string, string];

export type PhotoCat = 'hero' | 'exterior' | 'interior' | 'doors' | 'trunk' | 'hood' | 'lights';

export const PHOTO_SLOT_COUNT: Record<PhotoCat, number> = {
  hero: 1, exterior: 8, interior: 4, doors: 4, trunk: 3, hood: 3, lights: 3,
};

export type ViewKey = 'r360' | 'interior' | 'doors' | 'lights' | 'trunk' | 'hood';
export const VIEW_CAT: Record<ViewKey, PhotoCat> = {
  r360: 'exterior', interior: 'interior', doors: 'doors', lights: 'lights', trunk: 'trunk', hood: 'hood',
};
export const CAT_ORDER: PhotoCat[] = ['hero', 'exterior', 'interior', 'doors', 'trunk', 'hood', 'lights'];
export const VIEW_KEYS: ViewKey[] = ['r360', 'interior', 'doors', 'lights', 'trunk', 'hood'];

export const SHOTS: Record<PhotoCat, { deg?: string; he: string; en: string }[]> = {
  hero: [{ he: 'תמונת הרכב הראשית', en: 'Your car’s signature shot' }],
  exterior: [
    { deg: '0°', he: 'חזית מלאה', en: 'Front' },
    { deg: '45°', he: 'אלכסון קדמי ימין', en: 'Front 3/4 right' },
    { deg: '90°', he: 'צד ימין', en: 'Right side' },
    { deg: '135°', he: 'אלכסון אחורי ימין', en: 'Rear 3/4 right' },
    { deg: '180°', he: 'אחור מלא', en: 'Rear' },
    { deg: '225°', he: 'אלכסון אחורי שמאל', en: 'Rear 3/4 left' },
    { deg: '270°', he: 'צד שמאל', en: 'Left side' },
    { deg: '315°', he: 'אלכסון קדמי שמאל', en: 'Front 3/4 left' },
  ],
  interior: [
    { he: 'מושב הנהג', en: 'Driver seat' }, { he: 'לוח שעונים', en: 'Instrument cluster' },
    { he: 'הגה וקונסולה', en: 'Wheel + console' }, { he: 'מושבים אחוריים', en: 'Rear seats' },
  ],
  doors: [
    { he: 'דלת נהג פתוחה', en: 'Driver door open' }, { he: 'דלת נוסע פתוחה', en: 'Passenger door open' },
    { he: 'שתי הדלתות מבחוץ', en: 'Both doors, from outside' }, { he: 'פנים הדלת', en: 'Door card' },
  ],
  trunk: [
    { he: 'תא מטען פתוח מלפנים', en: 'Trunk open, straight on' }, { he: 'תא מטען מהצד', en: 'Trunk from the side' },
    { he: 'רצפת תא המטען', en: 'Trunk floor' },
  ],
  hood: [
    { he: 'מכסה מנוע פתוח', en: 'Hood open' }, { he: 'תא המנוע מקרוב', en: 'Engine bay, close' },
    { he: 'מספר שילדה / מדבקה', en: 'VIN plate' },
  ],
  lights: [
    { he: 'אורות ראשיים דולקים', en: 'Headlights on' }, { he: 'אורות אחוריים דולקים', en: 'Tail lights on' },
    { he: 'פנסי יום ואיתות', en: 'Daytime + indicators' },
  ],
};


// Common manufacturers for the onboarding autocomplete — a real make/model/trim
// database is out of scope, so this stays a helpful typeahead rather than a
// pretend-authoritative catalog.
export const MAKES: Bi[] = [
  ['טויוטה', 'Toyota'], ['אאודי', 'Audi'], ['ב.מ.וו', 'BMW'], ['פולקסווגן', 'Volkswagen'],
  ['מרצדס', 'Mercedes-Benz'], ['הונדה', 'Honda'], ['מאזדה', 'Mazda'], ['יונדאי', 'Hyundai'],
  ['קיה', 'Kia'], ['ניסאן', 'Nissan'], ['פורד', 'Ford'], ['שברולט', 'Chevrolet'],
  ['סקודה', 'Škoda'], ['סיאט', 'SEAT'], ['רנו', 'Renault'], ['פיג׳ו', 'Peugeot'],
  ['סיטרואן', 'Citroën'], ['וולוו', 'Volvo'], ['סובארו', 'Subaru'], ['מיצובישי', 'Mitsubishi'],
  ['סוזוקי', 'Suzuki'], ['פיאט', 'Fiat'], ['אלפא רומיאו', 'Alfa Romeo'], ['ג׳יפ', 'Jeep'],
  ['דודג׳', 'Dodge'], ['קרייזלר', 'Chrysler'], ['לקסוס', 'Lexus'], ['אינפיניטי', 'Infiniti'],
  ['פורשה', 'Porsche'], ['מיני', 'MINI'], ['לנד רובר', 'Land Rover'], ['ג׳אגואר', 'Jaguar'],
  ['טסלה', 'Tesla'], ['פרארי', 'Ferrari'], ['למבורגיני', 'Lamborghini'], ['מזראטי', 'Maserati'],
  ['אסטון מרטין', 'Aston Martin'], ['בנטלי', 'Bentley'], ['רולס רויס', 'Rolls-Royce'],
  ['קופרה', 'Cupra'], ['דאצ׳יה', 'Dacia'], ['אופל', 'Opel'], ['ביואיק', 'Buick'],
  ['ג׳י.אם.סי', 'GMC'], ['קדילק', 'Cadillac'], ['ג׳י.או', 'BYD'], ['MG', 'MG'],
];


export const NAV_ICONS = [
  'M3 10.6 12 3.4l9 7.2V20a1 1 0 0 1-1 1h-5.2v-6H9.2v6H4a1 1 0 0 1-1-1z',
  'M4.2 16.2 5.5 11a2.3 2.3 0 0 1 2.2-1.7h8.6A2.3 2.3 0 0 1 18.5 11l1.3 5.2v3a.9.9 0 0 1-.9.9h-1.2a.9.9 0 0 1-.9-.9v-1.4H7.2v1.4a.9.9 0 0 1-.9.9H5.1a.9.9 0 0 1-.9-.9z',
  'M6 20.4a2.7 2.7 0 1 0 0-5.4 2.7 2.7 0 0 0 0 5.4zm12-11a2.7 2.7 0 1 0 0-5.4 2.7 2.7 0 0 0 0 5.4zM8.7 17.7h4.6a4.4 4.4 0 0 0 0-8.8H8.2',
  'M20.6 4.4a5 5 0 0 1-6.4 6.4L6.3 18.7a2.1 2.1 0 1 1-3-3l7.9-7.9a5 5 0 0 1 6.4-6.4l-3 3 2 2z',
  'M12 12.4a4.2 4.2 0 1 0 0-8.4 4.2 4.2 0 0 0 0 8.4zM4.2 20.6a7.8 7.8 0 0 1 15.6 0',
];
export const NAV_KEYS = ['home', 'garage', 'trips', 'service', 'profile'] as const;
export const CONTROL_ICONS = [
  'M20.4 12a8.4 8.4 0 1 1-2.6-6.1M20.4 4.2v4.2h-4.2',
  'M7.6 4h5.8a2 2 0 0 1 2 2v6.6H7.6zM5.4 12.6h13.2a2 2 0 0 1 2 2V20H5.4z',
  'M6.4 3.2h8.4a3 3 0 0 1 3 3v14.6H6.4zM9.4 12.2h2.2',
  'M4.6 8.2h4.8a5.8 5.8 0 0 1 0 7.6H4.6zM15.6 9.2h4M15.6 12h5M15.6 14.8h4',
  'M4.4 15.2V9.4a7.6 7.6 0 0 1 15.2 0v5.8M4.4 15.2h15.2v4.2H4.4z',
  'M3.4 16.4C5.4 9.6 9.8 6.4 14 6.4c2.8 0 4.8 1 6.6 2.8l-1.8 7.2zM3.4 16.4h17.2',
];

export const BODY_SWATCHES = ['#EDEDEA', '#15151A', '#8E939B', '#2A4A7A', '#7A2A2A'];
export const TRIM_SWATCHES = ['#15151A', '#C9BFAE', '#5A3F2E'];

// 30-day streak ladder — one car per day, day 30 is the ceiling.
export const STREAK_CARS = [
  'Škoda Fabia', 'Volkswagen Polo', 'SEAT Ibiza', 'Renault Clio', 'Peugeot 208', 'Hyundai i30', 'Kia Ceed',
  'Mazda 3', 'Toyota Corolla', 'Honda Civic', 'Volkswagen Golf', 'Škoda Octavia RS', 'Golf GTI', 'Cupra Leon',
  'Audi A3', 'BMW 320i', 'Mercedes C200', 'Volvo S60', 'Audi S4', 'BMW M340i', 'Mercedes-AMG A45',
  'Alfa Romeo Giulia QV', 'Audi RS3', 'BMW M3', 'Porsche Cayman GTS', 'Aston Martin Vantage', 'Maserati MC20',
  'Porsche 911 Turbo S', 'Ferrari 296 GTB', 'Lamborghini Revuelto',
];
export const STREAK_MARKS: [string, string][] = [
  ['ŠK', '#4BA82E'], ['VW', '#5A8FD6'], ['SE', '#B02E2E'], ['RE', '#E8C33D'], ['PE', '#3B7FD6'], ['HY', '#5F7A99'], ['KI', '#C4453B'],
  ['MZ', '#8A98A8'], ['TO', '#D6483B'], ['HO', '#C43A3A'], ['VW', '#5A8FD6'], ['ŠK', '#4BA82E'], ['GT', '#C43A3A'], ['CU', '#B08050'],
  ['A', '#B5121B'], ['BM', '#4B87C4'], ['MB', '#9BA5AE'], ['VO', '#2E5B8A'], ['S', '#B5121B'], ['M', '#3D6FA8'], ['AMG', '#C9A227'],
  ['AR', '#8E2230'], ['RS', '#B5121B'], ['M', '#3D6FA8'], ['PO', '#B79A5B'], ['AM', '#00594F'], ['MA', '#0E2A5C'],
  ['PO', '#B79A5B'], ['FE', '#D62B1F'], ['LB', '#D9A31A'],
];

export const UNIT_ROWS = [
  { key: 'dist', he: 'מרחק', en: 'Distance', opts: [['ק״מ', 'km'], ['מייל', 'mi']] as Bi[] },
  { key: 'vol', he: 'נפח', en: 'Volume', opts: [['ליטר', 'litres'], ['גלון', 'gallon']] as Bi[] },
  { key: 'cons', he: 'צריכה', en: 'Consumption', opts: [['ל׳ ל-100 ק״מ', 'L / 100 km'], ['ק״מ לליטר', 'km / L']] as Bi[] },
  { key: 'cur', he: 'מטבע', en: 'Currency', opts: [['₪', '₪'], ['$', '$'], ['€', '€']] as Bi[] },
  { key: 'date', he: 'תאריך', en: 'Date', opts: [['DD/MM/YYYY', 'DD/MM/YYYY'], ['MM/DD/YYYY', 'MM/DD/YYYY']] as Bi[] },
];
export const PRIVACY_ROWS = [
  { key: 'loc', he: 'שיתוף מיקום', en: 'Location sharing', type: 'seg', opts: [['בזמן נסיעה', 'While driving'], ['תמיד', 'Always'], ['כבוי', 'Off']] as Bi[] },
  { key: 'usage', he: 'נתוני שימוש אנונימיים', en: 'Anonymous usage data', type: 'toggle',
    dHe: 'שולח דפוסי שימוש בלי פרטים מזהים, כדי שנדע מה לשפר.',
    dEn: 'Shares usage patterns with nothing identifying attached, so we know what to improve.' },
  { key: 'visible', he: 'גלוי לחברים', en: 'Visible to friends', type: 'seg', opts: [['רכב ראשי', 'Primary car'], ['כל הרכבים', 'All cars'], ['אף אחד', 'Nobody']] as Bi[] },
  { key: 'content', he: 'התאמת תוכן אישית', en: 'Personalised content', type: 'toggle',
    dHe: 'מתאים טיפים ותזכורות לפי הרגלי הנהיגה והרכב שלך.',
    dEn: 'Tailors tips and reminders to how and what you drive.' },
];

// Expense category *definitions* only (label + colour) — amounts always come from the user's own entries.
export const EXPENSE_CAT_DEFS: { he: string; en: string; color: string }[] = [
  { he: 'דלק', en: 'Fuel', color: '#E8A33D' },
  { he: 'טיפולים', en: 'Servicing', color: '#F5C77E' },
  { he: 'ביטוח וטסט', en: 'Insurance & test', color: '#4EBE82' },
  { he: 'צמיגים', en: 'Tyres', color: '#E8734D' },
  { he: 'חניה', en: 'Parking', color: '#5C6270' },
  { he: 'אחר', en: 'Other', color: '#3A5F8A' },
];

export const PLATES = [
  { key: 'il', face: '#F2C230', ink: '#0C0C0C', edge: 'rgba(0,0,0,.55)', band: '#12327A', code: ['ישראל', 'IL'] as Bi },
  { key: 'us', face: '#F4F4F1', ink: '#12327A', edge: 'rgba(20,32,64,.6)', band: '#12327A', code: ['USA', 'USA'] as Bi },
  { key: 'eu', face: '#F4F4F1', ink: '#101418', edge: 'rgba(20,32,64,.55)', band: '#0B3FA8', code: ['EU', 'EU'] as Bi },
];

// A tiny public "directory" so the Friends search tab has someone findable —
// not the user's own data, just a stand-in for what a real backend would search.
export const SEARCH_DIRECTORY = [
  { initials: 'GK', name: ['גיא כהן', 'Guy K.'] as Bi, car: ['Leon FR · 2018', 'Leon FR · 2018'] as Bi, km: '1,120', handle: '@guyk', mutual: 0 },
  { initials: 'NS', name: ['נועה שביט', 'Noa S.'] as Bi, car: ['Model 3 · 2023', 'Model 3 · 2023'] as Bi, km: '3,050', handle: '@noas', mutual: 0 },
  { initials: 'EO', name: ['עידו אורן', 'Ido O.'] as Bi, car: ['Polo GTI · 2017', 'Polo GTI · 2017'] as Bi, km: '760', handle: '@idoo', mutual: 0 },
];
export type Person = (typeof SEARCH_DIRECTORY)[number];
