// Configuración de LiveKit (solo servidor). Las claves viven en variables de entorno de Render.
import { EgressClient, RoomServiceClient } from "livekit-server-sdk";

export function livekitConfig() {
  const url = process.env.LIVEKIT_URL;           // wss://<proyecto>.livekit.cloud
  const key = process.env.LIVEKIT_API_KEY;
  const secret = process.env.LIVEKIT_API_SECRET;
  if (!url || !key || !secret) return null;
  const httpUrl = url.replace(/^wss:/, "https:").replace(/^ws:/, "http:");
  return { url, httpUrl, key, secret, egress: new EgressClient(httpUrl, key, secret), rooms: new RoomServiceClient(httpUrl, key, secret) };
}

/** URL completa de destino RTMPS: servidor + clave (con o sin "/" entre ambos). */
export function rtmpTarget(server: string, key: string): string {
  return server.endsWith("/") ? `${server}${key}` : `${server}/${key}`;
}
