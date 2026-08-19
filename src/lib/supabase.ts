import '@/lib/install-local-storage';

import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

export function getSupabaseConfigError(): string | null {
  if (!supabaseUrl) {
    return 'Missing EXPO_PUBLIC_SUPABASE_URL in .env.local';
  }
  if (!supabasePublishableKey || supabasePublishableKey === 'your-publishable-key-here') {
    return 'Missing EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local';
  }
  return null;
}

const memoryStore = new Map<string, string>();

const authStorage = {
  getItem: (key: string) => {
    if (typeof globalThis.localStorage !== 'undefined') {
      return globalThis.localStorage.getItem(key);
    }
    return memoryStore.get(key) ?? null;
  },
  setItem: (key: string, value: string) => {
    if (typeof globalThis.localStorage !== 'undefined') {
      globalThis.localStorage.setItem(key, value);
      return;
    }
    memoryStore.set(key, value);
  },
  removeItem: (key: string) => {
    if (typeof globalThis.localStorage !== 'undefined') {
      globalThis.localStorage.removeItem(key);
      return;
    }
    memoryStore.delete(key);
  },
};

export const supabase = createClient(
  supabaseUrl || 'https://example.supabase.co',
  supabasePublishableKey || 'missing',
  {
    auth: {
      storage: authStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: Platform.OS === 'web',
    },
  }
);

AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
