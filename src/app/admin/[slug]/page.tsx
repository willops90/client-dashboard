import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getViewer, loadDashboard } from "@/lib/data";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { AdvisorPanel } from "@/components/advisor/AdvisorPanel";

export const metadata: Metadata = { title: "Advisor view" };

export default async function AdvisorClientPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=/admin/${slug}`);
  if (viewer.kind !== "advisor") redirect(`/c/${slug}`);
  const data = await loadDashboard(slug, viewer);
  if (!data) notFound();
  return <Dashboard data={data} advisorPanel={<AdvisorPanel data={data} />} />;
}
