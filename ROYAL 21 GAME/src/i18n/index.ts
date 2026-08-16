import he from './he.json';
import en from './en.json';
import type { Lang } from '@/types';

type Dict = Record<string, unknown>;
const dicts: Record<Lang, Dict> = { he: he as Dict, en: en as Dict };

export const LANGS: { key: Lang; label: string; dir: 'rtl' | 'ltr' }[] = [
  { key: 'he', label: 'עברית', dir: 'rtl' },
  { key: 'en', label: 'English', dir: 'ltr' },
];

export const dirOf = (lang: Lang): 'rtl' | 'ltr' => (lang === 'he' ? 'rtl' : 'ltr');

function lookup(dict: Dict, path: string): string | undefined {
  const value = path.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object') return (acc as Dict)[part];
    return undefined;
  }, dict);
  return typeof value === 'string' ? value : undefined;
}

/** Translate `path`, interpolating `{name}` style tokens. Falls back he -> path. */
export function translate(lang: Lang, path: string, vars?: Record<string, string | number>): string {
  const raw = lookup(dicts[lang], path) ?? lookup(dicts.he, path) ?? path;
  if (!vars) return raw;
  return Object.entries(vars).reduce(
    (out, [key, value]) => out.split(`{${key}}`).join(String(value)),
    raw,
  );
}

/**
 * Applies language to the document: direction, lang attribute and the
 * logical-property flip that the whole layout relies on.
 */
export function applyLang(lang: Lang) {
  const dir = dirOf(lang);
  document.documentElement.lang = lang;
  document.documentElement.dir = dir;
  document.documentElement.dataset.lang = lang;
}
