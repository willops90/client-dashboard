import type { Metadata } from "next";
import { buildDemoDashboard } from "@/lib/demo";
import { LeapPlanDoc } from "@/components/plan/LeapPlanDoc";

export const metadata: Metadata = { title: "LEAP plan: Northside Climate Co. (demo)" };
export const dynamic = "force-dynamic";

export default function DemoPlanPage() {
  return <LeapPlanDoc data={buildDemoDashboard()} backHref="/demo-v2" />;
}
