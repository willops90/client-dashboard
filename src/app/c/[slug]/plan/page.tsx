import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getViewer, loadDashboard } from "@/lib/data";
import { LeapPlanDoc } from "@/components/plan/LeapPlanDoc";

export const metadata: Metadata = { title: "LEAP plan" };

// Members and the advisor can both open a client's plan; RLS decides access.
export default async function PlanPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=/c/${slug}/plan`);
  const data = await loadDashboard(slug, viewer);
  if (!data) notFound();
  return <LeapPlanDoc data={data} backHref={viewer.kind === "advisor" ? `/admin/${slug}` : `/c/${slug}`} />;
}
