import type { Metadata } from "next";
import { buildDemoDashboard } from "@/lib/demo";
import { DashboardV2 } from "@/components/v2/DashboardV2";

export const metadata: Metadata = { title: "Demo v2: Northside Climate Co." };
export const dynamic = "force-dynamic";

export default function DemoV2Page() {
  return <DashboardV2 data={buildDemoDashboard()} />;
}
