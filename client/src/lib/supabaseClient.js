import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing frontend Supabase environment variables. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in client/.env.",
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export async function upsertUserProfile(user) {
  if (!user?.id) return;

  const displayName = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "PinMind user";
  const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture || null;

  const { error } = await supabase.from("profiles").upsert({
    id: user.id,
    display_name: displayName,
    avatar_url: avatarUrl,
  });

  if (error) throw error;
}
