import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Get credentials from environment or use defaults
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://gnxadfydbnigwboojhgw.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";

// Validate configuration
if (!SUPABASE_URL) {
  console.error('Missing VITE_SUPABASE_URL. Available env vars:', {
    viteUrl: import.meta.env.VITE_SUPABASE_URL,
    processUrl: typeof process !== 'undefined' ? process.env.VITE_SUPABASE_URL : 'N/A',
  });
}

if (!SUPABASE_PUBLISHABLE_KEY) {
  console.error('Missing VITE_SUPABASE_PUBLISHABLE_KEY');
}

console.log('Supabase Config:', {
  url: SUPABASE_URL?.substring(0, 30) + '...',
  keyPresent: !!SUPABASE_PUBLISHABLE_KEY,
});

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
  global: {
    headers: {
      'X-Client-Info': 'supabase-js/web',
    },
  },
  // Add retry logic for network failures
  db: {
    schema: 'public',
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});
