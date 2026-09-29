import Link from "next/link";

export default function NotFound() {
  return (
    <div className="wrap narrow">
      <header className="top">
        <div className="brand">Owner Optional Advisory</div>
      </header>
      <section className="hero">
        <h1 className="h1-sm">Nothing here</h1>
        <p className="lede">This page doesn't exist, or your login doesn't have access to it.</p>
        <Link href="/">Go to your dashboard</Link>
      </section>
    </div>
  );
}
