"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-next";

export type LoginState = { sent?: string; error?: string };

export async function sendMagicLink(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter the email address Will invited." };

  const h = await headers();
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const next = safeNext(String(form.get("next") ?? ""));

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    // Only invited people have accounts. Nobody can sign themselves up.
    options: { shouldCreateUser: false, emailRedirectTo: `${origin}/auth/confirm?next=${encodeURIComponent(next)}` },
  });

  // Don't reveal whether an address has an account: same message either way,
  // unless Supabase is rate limiting.
  if (error && error.status === 429) return { error: "Too many attempts. Wait a minute and try again." };
  return { sent: email };
}
