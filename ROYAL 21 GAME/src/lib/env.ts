/** Environment access, in one place. Never read import.meta.env elsewhere. */
const url = (import.meta.env.VITE_SUPABASE_URL ?? '').trim();
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim();

export const env = {
  supabaseUrl: url,
  supabaseAnonKey: anonKey,
  /** True when the project is wired to a Supabase backend. */
  get online() {
    return url.length > 0 && anonKey.length > 0;
  },
};
