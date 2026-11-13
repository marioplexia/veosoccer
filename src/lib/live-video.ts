// Piezas de video de la transmisión: búfer para la repetición, clips de gol y subida de la grabación por segmentos.

export type Frame = { t: number; blob: Blob };

/** Guarda los últimos segundos de la cámara como imágenes pequeñas (poca memoria) para repetir una jugada. */
export class FrameRing {
  private frames: Frame[] = [];
  constructor(private maxAgeMs = 24_000) {}
  push(f: Frame) {
    this.frames.push(f);
    const min = f.t - this.maxAgeMs;
    while (this.frames.length && this.frames[0].t < min) this.frames.shift();
  }
  /** Cuadros entre `from` y `to` (ms), en orden. */
  window(from: number, to: number): Frame[] { return this.frames.filter((f) => f.t >= from && f.t <= to); }
  get size() { return this.frames.length; }
  clear() { this.frames = []; }
}

/**
 * Qué cuadro toca al reproducir una repetición: `times` son las marcas de tiempo originales,
 * `elapsedMs` lo que lleva la repetición y `speed` la velocidad (0.7 = cámara lenta suave).
 * Devuelve -1 cuando ya terminó.
 */
export function replayFrameIndex(times: number[], elapsedMs: number, speed: number): number {
  if (times.length === 0 || elapsedMs < 0) return -1;
  const target = times[0] + elapsedMs * speed;
  if (target > times[times.length - 1]) return -1;
  let lo = 0, hi = times.length - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (times[mid] <= target) lo = mid; else hi = mid - 1; }
  return lo;
}
/** Duración en pantalla de una repetición. */
export const replayDurationMs = (times: number[], speed: number) => (times.length < 2 ? 0 : (times[times.length - 1] - times[0]) / speed);

export const VIDEO_MIME = ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
export const pickVideoMime = () => (typeof MediaRecorder === "undefined" ? null : VIDEO_MIME.find((m) => MediaRecorder.isTypeSupported(m)) ?? null);
export const baseMime = (m: string): "video/mp4" | "video/webm" => (m.startsWith("video/mp4") ? "video/mp4" : "video/webm");
export const extOf = (m: string) => (m.startsWith("video/mp4") ? "mp4" : "webm");

/** Convierte cuadros guardados en un video corto (se graba en tiempo real, sin audio). Solo navegador. */
export async function encodeClip(frames: Frame[], o: { w: number; h: number; label?: string }): Promise<{ blob: Blob; mime: string } | null> {
  const mime = pickVideoMime();
  if (!mime || frames.length < 5) return null;
  const canvas = document.createElement("canvas");
  canvas.width = o.w; canvas.height = o.h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const stream = canvas.captureStream(15);
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 1_200_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const stopped = new Promise<void>((r) => { rec.onstop = () => r(); });
  rec.start(1000);
  const t0 = performance.now();
  const first = frames[0].t;
  for (const f of frames) {
    const wait = f.t - first - (performance.now() - t0);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    try {
      const bmp = await createImageBitmap(f.blob);
      ctx.drawImage(bmp, 0, 0, o.w, o.h);
      bmp.close();
      if (o.label) {
        const pad = o.h * 0.03, fh = o.h * 0.06;
        ctx.font = `700 ${Math.round(fh)}px system-ui, sans-serif`;
        const tw = ctx.measureText(o.label).width;
        ctx.fillStyle = "rgba(55,0,60,.88)"; ctx.fillRect(pad, o.h - pad - fh * 1.7, tw + fh * 1.2, fh * 1.7);
        ctx.fillStyle = "#FFFFFF"; ctx.textBaseline = "middle"; ctx.fillText(o.label, pad + fh * 0.6, o.h - pad - fh * 0.85);
      }
    } catch { /* cuadro dañado: se omite */ }
  }
  await new Promise((r) => setTimeout(r, 250));
  rec.stop(); await stopped; stream.getTracks().forEach((t) => t.stop());
  return chunks.length ? { blob: new Blob(chunks, { type: baseMime(mime) }), mime: baseMime(mime) } : null;
}

export type Segment = { idx: number; blob: Blob; durationMs: number };

/**
 * Cola de subida de segmentos: sube de uno en uno, reintenta con espera creciente y nunca
 * descarta un segmento; lo pendiente se puede reintentar con `flush()`.
 */
export class SegmentUploader {
  private queue: Segment[] = [];
  private current: Promise<void> | null = null;
  uploaded = 0;
  failedOnce = false;
  constructor(private upload: (s: Segment) => Promise<boolean>, private onChange: () => void = () => undefined, private waitMs = (attempt: number) => Math.min(8000, 1000 * 2 ** attempt)) {}
  get pending() { return this.queue.length; }
  add(s: Segment) { this.queue.push(s); this.onChange(); void this.run(); }
  /** Espera la subida en curso e intenta de nuevo lo pendiente; resuelve con true si la cola quedó vacía. */
  async flush(maxAttempts = 4): Promise<boolean> {
    if (this.current) await this.current;
    await this.run(maxAttempts);
    return this.queue.length === 0;
  }
  private run(maxAttempts = 3): Promise<void> {
    if (!this.current) this.current = this.drain(maxAttempts).finally(() => { this.current = null; });
    return this.current;
  }
  private async drain(maxAttempts: number) {
    while (this.queue.length) {
      const seg = this.queue[0];
      let ok = false;
      for (let a = 0; a < maxAttempts && !ok; a++) {
        if (a > 0) await new Promise((r) => setTimeout(r, this.waitMs(a - 1)));
        try { ok = await this.upload(seg); } catch { ok = false; }
      }
      if (!ok) { this.failedOnce = true; this.onChange(); return; } // se queda en la cola para el siguiente intento
      this.queue.shift(); this.uploaded++; this.onChange();
    }
  }
}
