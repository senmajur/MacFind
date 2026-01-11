import { createClient, SupabaseClient } from '@supabase/supabase-js';

type EnvValue = string | boolean | undefined;
type Env = Record<string, EnvValue>;

const env = import.meta.env as Env;

const normalizeUrl = (value?: string) => value?.replace(/\/$/, '');

const supabaseUrl = normalizeUrl(
  (env.VITE_SUPABASE_URL as string | undefined) ??
    (env.NEXT_PUBLIC_SUPABASE_URL as string | undefined),
);

const supabaseAnonKey =
  (env.VITE_SUPABASE_ANON_KEY as string | undefined) ??
  (env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined);

export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

export const hasSupabase = Boolean(supabase);
