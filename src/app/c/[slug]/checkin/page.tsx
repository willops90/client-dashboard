import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { formatDate, inFortnight } from "@/lib/leap";
import { getViewer, loadDashboard } from "@/lib/data";
import { CheckinForm } from "./CheckinForm";

export const metadata: Metadata = { title: "Friday check-in" };

export default async function CheckinPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=/c/${slug}/checkin`);
  if (viewer.kind === "advisor") redirect(`/admin/${slug}`);
  const data = await loadDashboard(slug, viewer);
  if (!data) notFound();

  const { window, cycle, client } = data;
  const week = window.week;

  return (
    <div className="wrap narrow">
      <header className="top">
        <div className="brand">
          <Link href={`/c/${slug}`}>← {client.name}</Link>
        </div>
      </header>
      <section className="hero" style={{ paddingTop: 24 }}>
        {week && window.open ? (
          <>
            <p className="cycle">
              Week {week} · Friday {formatDate(window.friday)} · open until the end of {formatDate(window.closesOn, { weekday: "long" })}
            </p>
            <h1 className="h1-sm">Friday check-in</h1>
            <p className="lede">Two minutes. Only the numbers are required.</p>
            <CheckinForm
              slug={slug}
              week={week}
              clientId={client.id}
              cycleId={cycle.id}
              advisorName={data.advisorName}
              kpis={data.kpis.map((k) => ({
                id: k.id,
                name: k.name,
                unit: k.unit,
                target: k.target_value,
                last: k.readings.filter((r) => r.week_number < week).at(-1) ?? null,
                current: k.readings.find((r) => r.week_number === week)?.value ?? null,
              }))}
              actions={data.actions
                .filter((a) => !a.owner_is_advisor && !a.done_at && inFortnight(a, data.today, client.timezone))
                .map((a) => ({ id: a.id, title: a.title, owner: a.owner_name, due: a.due_date }))}
              existing={data.checkins.find((c) => c.week_number === week) ?? null}
            />
          </>
        ) : (
          <>
            <h1 className="h1-sm">The check-in isn't open</h1>
            <p className="lede">
              Check-ins open on Thursday and close at the end of Sunday
              {week ? `. The next one is for week ${Math.min(13, week + 1)}` : ""}.
            </p>
            <Link href={`/c/${slug}`}>Back to the dashboard</Link>
          </>
        )}
      </section>
    </div>
  );
}
