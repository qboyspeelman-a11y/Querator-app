import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iajdspyrpasfkjvxkhkk.supabase.co';
const supabaseAnonKey = 'sb_publishable_sZvuTQt2uZ4cOTVWBeL_mg_cIxuihLG';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'implicit',
  },
});