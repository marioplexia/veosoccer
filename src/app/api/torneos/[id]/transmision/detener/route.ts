import { NextResponse, type NextRequest } from "next/server";
import { livekitConfig } from "@/lib/livekit-server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });

  let broadcastId = "";
  try { broadcastId = String((await request.json()).broadcastId ?? ""); } catch { return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 }); }

  const { data: b } = await supabase.from("broadcasts").select("id, room, egress_id, status").eq("id", broadcastId).eq("tournament_id", id).maybeSingle();
  if (!b) return NextResponse.json({ error: "Transmisión no encontrada." }, { status: 404 });

  const cfg = livekitConfig();
  if (cfg) {
    if (b.egress_id) await cfg.egress.stopEgress(b.egress_id).catch(() => undefined);
    await cfg.rooms.deleteRoom(b.room).catch(() => undefined);
  }
  await supabase.from("broadcasts").update({ status: "ended", ended_at: new Date().toISOString() }).eq("id", b.id);
  return NextResponse.json({ ok: true });
}
