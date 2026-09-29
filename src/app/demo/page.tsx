import type { Metadata } from "next";
import { buildDemoDashboard } from "@/lib/demo";
import { Dashboard } from "@/components/dashboard/Dashboard";

export const metadata: Metadata = { title: "Demo: Northside Climate Co." };

// Recomputed on each request so the demo is always on day 44.
export const dynamic = "force-dynamic";

export default function DemoPage() {
  return <Dashboard data={buildDemoDashboard()} />;
}
