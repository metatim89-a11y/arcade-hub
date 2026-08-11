import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || '');
const publishableKey = String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '');

export const isSupabaseConfigured = Boolean(supabaseUrl && publishableKey);

const client: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, publishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

export const getSupabase = (): SupabaseClient => {
  if (!client) {
    throw new Error('Arcade Hub is not connected to Supabase. Configure VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.');
  }
  return client;
};
