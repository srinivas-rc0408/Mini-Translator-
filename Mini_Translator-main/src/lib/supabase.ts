import { createClient } from '@supabase/supabase-js';

// Audit Supabase Configuration
const rawUrl = import.meta.env.VITE_SUPABASE_URL || 'https://gxbgutztsjfkjiiibsnk.supabase.co';
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_TYyoqqVEW7VwywO-zD-tBA_SZOA8u_2';

/**
 * Normalizes the Supabase URL to prevent "Invalid path" errors.
 * Ensures it's a domain-only origin without path appendages.
 */
function normalizeUrl(url: string): string {
  if (!url) return '';
  try {
    const parsed = new URL(url.trim());
    return parsed.origin;
  } catch (e) {
    // Fallback for relative paths or malformed strings
    return url.trim()
      .replace(/\/+$/, "")
      .replace(/\/rest\/v1\/?$/, "")
      .replace(/\/auth\/v1\/?$/, "");
  }
}

const supabaseUrl = normalizeUrl(rawUrl);
const supabaseAnonKey = rawKey.trim();

// Debug logs to help identify configuration issues in the browser console
console.group('Supabase Configuration Audit');
console.log('Project URL:', supabaseUrl);
console.log('Key Status:', supabaseAnonKey.startsWith('eyJ') ? 'Valid Format (JWT)' : 'Invalid Format (Check Settings > API)');
console.groupEnd();

// Security/Config Audit:
export const isSupabaseAvailable = (): boolean => {
  const hasValidKey = supabaseAnonKey && supabaseAnonKey.startsWith('eyJ');
  const hasValidUrl = supabaseUrl && supabaseUrl.startsWith('https://') && !supabaseUrl.includes('your-project-id');
  return !!(hasValidKey && hasValidUrl);
};

if (!isSupabaseAvailable()) {
  console.warn(
    'Supabase has not been fully configured or is using placeholder credentials. ' +
    'The application will run smoothly in Offline / Local Mode using LocalStorage.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'minitranslator-auth-token',
    flowType: 'pkce', // Modern flow type
  }
});
