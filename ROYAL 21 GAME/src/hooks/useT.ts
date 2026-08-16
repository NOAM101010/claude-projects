import { useCallback } from 'react';
import { translate } from '@/i18n';
import { useSettings } from '@/stores/useSettings';

/** Translator bound to the current language. `t('hub.sitDown')`. */
export function useT() {
  const lang = useSettings((s) => s.lang);
  const t = useCallback(
    (path: string, vars?: Record<string, string | number>) => translate(lang, path, vars),
    [lang],
  );
  return { t, lang, rtl: lang === 'he' };
}
