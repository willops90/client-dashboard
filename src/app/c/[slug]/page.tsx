import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getViewer, loadDashboard } from "@/lib/data";
import { Dashboard } from "@/components/dashboard/Dashboard";

export const metadata: Metadata = { title: "Progress dashboard" };

export default async function ClientDashboardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=/c/${slug}`);
  if (viewer.kind === "advisor") redirect(`/admin/${slug}`);

  // RLS returns nothing for another client's slug, so this is a 404, not a leak.
  const data = await loadDashboard(slug, viewer);
  if (!data) notFound();
  return <Dashboard data={data} />;
}
