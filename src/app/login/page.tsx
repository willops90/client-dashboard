import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <div className="wrap narrow">
      <header className="top">
        <div className="brand">Owner Optional Advisory</div>
      </header>
      <section className="hero">
        <h1 className="h1-sm">Sign in to your dashboard</h1>
        <p className="lede">No password. We'll email you a link.</p>
        {error && (
          <p className="field-error" role="alert">
            {error === "nomember"
              ? "You're signed in, but this email isn't linked to a dashboard yet. Ask Will to add you."
              : "That sign-in link has expired or was already used. Ask for a new one below."}
          </p>
        )}
        <LoginForm next={next} />
      </section>
    </div>
  );
}
