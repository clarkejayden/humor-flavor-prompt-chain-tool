const SUPABASE_ENV_VALUES = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
} as const;

export function getMissingSupabaseEnvVars() {
  return Object.entries(SUPABASE_ENV_VALUES)
    .filter(([_, value]) => {
      return !value || value.trim().length === 0;
    })
    .map(([key]) => key);
}

export function hasSupabaseEnv() {
  return getMissingSupabaseEnvVars().length === 0;
}

export function getSupabaseEnvErrorMessage() {
  const missing = getMissingSupabaseEnvVars();
  if (missing.length === 0) {
    return null;
  }

  return `Missing Supabase environment variables: ${missing.join(", ")}.`;
}
