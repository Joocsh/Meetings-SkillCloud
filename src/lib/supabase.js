import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('Supabase URL or Anon Key is missing. Check your .env file.');
}

// Regular client — used for all normal user operations (login, data fetching)
export const supabase = createClient(supabaseUrl, supabaseKey);

// Admin client — used ONLY for admin operations like creating users
// Uses the service_role key which bypasses RLS and email validation
export const supabaseAdmin = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null;
