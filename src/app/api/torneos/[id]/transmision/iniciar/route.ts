import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { AccessToken, EncodingOptionsPreset, StreamOutput, StreamProtocol } from "livekit-server-sdk";
import { livekitConfig, rtmpTarget } from "@/lib/livekit-server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
const CAMERA_IDENTITY = "camara";

const fail = (error: string, status: number, code?: string) => NextResponse.json({ error, code }, { status });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail("Debes iniciar sesión.", 401);

  let fixtureId = "";
  try { fixtureId = String((await request.json()).fixtureId ?? ""); } catch { return fail("Solicitud inválida.", 400); }

  // RLS: solo encuentra el partido si el torneo es del usuario.
  const { data: fixture } = await supabase.from("fixtures").select("id").eq("id", fixtureId).eq("tournament_id", id).maybeSingle();
  if (!fixture) return fail("Partido no encontrado.", 404);

  const cfg = livekitConfig();
  if (!cfg) return fail("La transmisión en vivo no está configurada en el servidor (faltan las claves de LiveKit). Puedes usar el modo ensayo.", 503, "no_livekit");

  const { data: settings } = await supabase.from("broadcast_settings").select("rtmp_url, stream_key").eq("tournament_id", id).maybeSingle();
  if (!settings?.stream_key) return fail("Primero guarda tu clave de transmisión de Facebook en la pestaña Transmitir.", 400, "no_stream_key");

  const room = `tx-${fixtureId.slice(0, 8)}-${randomBytes(6).toString("hex")}`;
  const { data: row, error: insErr } = await supabase.from("broadcasts").insert({ tournament_id: id, fixture_id: fixtureId, room }).select("id").single();
  if (insErr || !row) return fail("No se pudo registrar la transmisión.", 500);

  try {
    await cfg.rooms.createRoom({ name: room, emptyTimeout: 15 * 60 });
    const at = new AccessToken(cfg.key, cfg.secret, { identity: CAMERA_IDENTITY, ttl: "8h" });
    at.addGrant({ roomJoin: true, room, canPublish: true, canSubscribe: false, canPublishData: false });
    const token = await at.toJwt();

    // El servicio de egress espera a que la cámara se conecte y publique, y reenvía a Facebook.
    const egress = await cfg.egress.startParticipantEgress(
      room,
      CAMERA_IDENTITY,
      { stream: new StreamOutput({ protocol: StreamProtocol.RTMP, urls: [rtmpTarget(settings.rtmp_url, settings.stream_key)] }) },
      { encodingOptions: EncodingOptionsPreset.H264_720P_30 },
    );
    await supabase.from("broadcasts").update({ egress_id: egress.egressId, status: "live" }).eq("id", row.id);
    return NextResponse.json({ mode: "live", url: cfg.url, token, broadcastId: row.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message.slice(0, 300) : "error";
    await supabase.from("broadcasts").update({ status: "failed", error: msg, ended_at: new Date().toISOString() }).eq("id", row.id);
    await cfg.rooms.deleteRoom(room).catch(() => undefined);
    return fail("No se pudo iniciar la transmisión en LiveKit. Revisa las claves de LiveKit en el servidor.", 502);
  }
}
