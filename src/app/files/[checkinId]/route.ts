import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Opens a check-in upload through a signed URL that expires after a minute.
// RLS decides whether the signed-in user can see the check-in and the file.
export async function GET(request: NextRequest, { params }: { params: Promise<{ checkinId: string }> }) {
  const { checkinId } = await params;
  const supabase = await createClient();
  const { data: checkin } = await supabase.from("checkins").select("review_file_path").eq("id", checkinId).maybeSingle();
  if (!checkin?.review_file_path) return new NextResponse("Not found", { status: 404 });
  const { data } = await supabase.storage.from("checkin-uploads").createSignedUrl(checkin.review_file_path, 60);
  if (!data?.signedUrl) return new NextResponse("Not found", { status: 404 });
  return NextResponse.redirect(data.signedUrl);
}
