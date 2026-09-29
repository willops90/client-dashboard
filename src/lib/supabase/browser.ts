import { createBrowserClient } from "@supabase/ssr";

/** Used only to upload check-in files straight to Storage, under the user's own session. */
export function createClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
