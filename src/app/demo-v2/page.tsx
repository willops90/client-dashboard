import type { Metadata } from "next";
import { buildDemoDashboard } from "@/lib/demo";
import { DashboardV2 } from "@/components/v2/DashboardV2";

export const metadata: Metadata = { title: "Demo v2: Northside Climate Co." };
export const dynamic = "force-dynamic";

// /demo-v2?day=65 previews the page later in the cycle (e.g. the review phase).
export default async function DemoV2Page({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  const { day } = await searchParams;
  return <DashboardV2 data={buildDemoDashboard(new Date(), day ? Number(day) : undefined)} />;
}
