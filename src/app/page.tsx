import { redirect } from "next/navigation";
import { getViewer } from "@/lib/data";

export default async function Home() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?error=nomember");
  if (viewer.kind === "advisor") redirect("/admin");
  redirect(viewer.clientSlug ? `/c/${viewer.clientSlug}` : "/login");
}
