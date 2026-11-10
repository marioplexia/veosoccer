"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BrandKind, BrandSettings } from "@/lib/brand";
import { DEFAULT_MATCH, FORMATS, TEMPLATES, drawScene, templateById, type FieldKey, type FormatId, type MatchData, type SceneId } from "@/lib/motion/scenes";
import { btnGhost, btnPrimary, Card, ErrorMsg, inputCls } from "@/components/ui";
import { useGoogleFonts } from "./useGoogleFonts";

export type MatchOption = { id: string; label: string; home: string; away: string; homeScore: number; awayScore: number };

const MIME_CANDIDATES = ["video/mp4;codecs=avc1.640028", "video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
const pickMime = () => (typeof MediaRecorder === "undefined" ? null : MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m)) ?? null);

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

const label = "block text-sm font-medium text-slate-700";

export default function MotionStudio({
  kind, settings, logoUrl, tournamentName, matches,
}: { kind: BrandKind; settings: BrandSettings; logoUrl: string | null; tournamentName: string; matches: MatchOption[] }) {
  const templates = useMemo(() => TEMPLATES.filter((t) => t.kind === kind), [kind]);
  const [id, setId] = useState<SceneId>(templates[0].id);
  const [format, setFormat] = useState<FormatId>("horizontal");
  const [data, setData] = useState<MatchData>(DEFAULT_MATCH);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [exporting, setExporting] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logo, setLogo] = useState<{ img: HTMLImageElement; w: number; h: number } | null>(null);
  const [fontsTick, setFontsTick] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const tpl = templateById(id);
  const { w, h } = FORMATS[format];
  const families = Object.values(settings.fonts).map((f) => f.family);
  useGoogleFonts(families);

  // El canvas necesita las fuentes ya cargadas: se espera y se vuelve a dibujar.
  const fontKey = JSON.stringify(settings.fonts);
  useEffect(() => {
    let alive = true;
    Promise.all(Object.values(settings.fonts).map((f) => document.fonts.load(`${f.italic ? "italic " : ""}${f.weight} 48px "${f.family}"`)))
      .catch(() => undefined)
      .then(() => { if (alive) setFontsTick((n) => n + 1); });
    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fontKey]);

  useEffect(() => {
    if (!logoUrl) { setLogo(null); return; }
    let alive = true;
    const img = new Image();
    if (!/^(blob:|data:)/.test(logoUrl)) img.crossOrigin = "anonymous"; // necesario para poder grabar el canvas
    img.onload = () => { if (alive) setLogo({ img, w: img.naturalWidth, h: img.naturalHeight }); };
    img.onerror = () => { if (alive) { setLogo(null); setError("No se pudo cargar el logo para el video; se usará el nombre del torneo."); } };
    img.src = logoUrl;
    return () => { alive = false; };
  }, [logoUrl]);

  // Referencia a los últimos valores, para que el bucle de animación no use datos viejos.
  const live = useRef({ id, w, h, kind, settings, logo, tournamentName, data });
  live.current = { id, w, h, kind, settings, logo, tournamentName, data };

  const render = useCallback((time: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const L = live.current;
    drawScene(ctx, L.id, {
      w: L.w, h: L.h, t: time, kind: L.kind, colors: L.settings.colors, fonts: L.settings.fonts,
      logo: L.logo?.img ?? null, logoSize: L.logo ? { w: L.logo.w, h: L.logo.h } : null,
      tournamentName: L.tournamentName, data: L.data,
    });
  }, []);

  // Vista previa: reproducción en bucle o fotograma fijo.
  useEffect(() => {
    if (exporting !== null) return;
    if (!playing) { render(Math.min(t, tpl.duration)); return; }
    let raf = 0;
    const start = performance.now() - t * 1000;
    const tick = () => {
      const el = ((performance.now() - start) / 1000) % tpl.duration;
      render(el);
      setT(el);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  // `t` se omite a propósito: solo se usa para retomar donde se quedó.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, exporting, id, format, tpl.duration, render, settings, data, logo, fontsTick, tournamentName]);

  useEffect(() => { if (!playing) render(Math.min(t, tpl.duration)); }, [t, playing, render, tpl.duration]);

  function chooseTemplate(next: SceneId) { setId(next); setT(0); setError(null); }
  const set = <K extends keyof MatchData>(k: K, v: MatchData[K]) => setData((d) => ({ ...d, [k]: v }));
  const num = (v: string, min: number, max: number) => Math.min(max, Math.max(min, Math.round(Number(v) || 0)));

  function pickMatch(mid: string) {
    const m = matches.find((x) => x.id === mid);
    if (m) setData((d) => ({ ...d, home: m.home, away: m.away, homeScore: m.homeScore, awayScore: m.awayScore }));
  }

  // Se detecta tras montar (en el servidor no existe MediaRecorder) para no desajustar el HTML.
  const [mime, setMime] = useState<string | null>(null);
  useEffect(() => { setMime(pickMime()); }, []);
  const ext = mime?.startsWith("video/mp4") ? "mp4" : "webm";

  async function exportVideo() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const type = pickMime();
    if (!type || typeof canvas.captureStream !== "function") { setError("Este navegador no puede grabar video. Prueba con Chrome, Edge o Safari actualizado."); return; }
    setError(null);
    setPlaying(false);
    setExporting(0);
    try {
      await document.fonts.ready;
      const D = tpl.duration;
      render(0);
      const stream = canvas.captureStream(30);
      const rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 10_000_000 });
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      const stopped = new Promise<void>((res) => { rec.onstop = () => res(); });
      rec.start(250);
      const t0 = performance.now();
      await new Promise<void>((res) => {
        const tick = () => {
          const el = (performance.now() - t0) / 1000;
          render(Math.min(el, D));
          setExporting(Math.min(1, el / D));
          if (el < D + 0.2) requestAnimationFrame(tick); else res();
        };
        requestAnimationFrame(tick);
      });
      rec.stop();
      await stopped;
      stream.getTracks().forEach((tr) => tr.stop());
      download(new Blob(chunks, { type: type.split(";")[0] }), `${id}-${format}.${type.startsWith("video/mp4") ? "mp4" : "webm"}`);
    } catch (e) {
      setError(e instanceof Error ? `No se pudo grabar el video: ${e.message}` : "No se pudo grabar el video.");
    } finally {
      setExporting(null);
      setT(0);
      setPlaying(true);
    }
  }

  function exportPng() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((b) => { if (b) download(b, `${id}-${format}.png`); }, "image/png");
  }

  const has = (k: FieldKey) => tpl.fields.includes(k);

  return (
    <Card title="Videos y animaciones">
      <p className="mb-4 text-sm text-slate-600">
        Se crean con los colores, tipografías y logo de esta marca (incluso los cambios que aún no has guardado). Elige una animación, ajusta los datos y descárgala.
      </p>

      <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Animación">
        {templates.map((x) => (
          <button
            key={x.id}
            onClick={() => chooseTemplate(x.id)}
            aria-pressed={id === x.id}
            title={x.description}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${id === x.id ? "bg-emerald-600 text-white" : "border border-slate-300 text-slate-700 hover:bg-slate-50"}`}
          >
            {x.label}
          </button>
        ))}
      </div>
      <p className="mb-4 text-sm text-slate-500">{tpl.description} · {tpl.duration.toFixed(1)} s</p>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-3">
          <label className={label}>Formato
            <select className={`${inputCls} mt-1`} value={format} onChange={(e) => setFormat(e.target.value as FormatId)}>
              {Object.entries(FORMATS).map(([k, f]) => <option key={k} value={k}>{f.label}</option>)}
            </select>
          </label>

          {has("match") && matches.length > 0 && (
            <label className={label}>Usar un partido del calendario
              <select className={`${inputCls} mt-1`} defaultValue="" onChange={(e) => pickMatch(e.target.value)}>
                <option value="">Escribir a mano</option>
                {matches.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </label>
          )}
          {has("home") && <label className={label}>Equipo local<input className={`${inputCls} mt-1`} value={data.home} maxLength={40} onChange={(e) => set("home", e.target.value)} /></label>}
          {has("away") && <label className={label}>Equipo visitante<input className={`${inputCls} mt-1`} value={data.away} maxLength={40} onChange={(e) => set("away", e.target.value)} /></label>}
          {(has("homeScore") || has("awayScore")) && (
            <div className="grid grid-cols-2 gap-3">
              <label className={label}>Goles local<input type="number" min={0} max={99} className={`${inputCls} mt-1`} value={data.homeScore} onChange={(e) => set("homeScore", num(e.target.value, 0, 99))} /></label>
              <label className={label}>Goles visitante<input type="number" min={0} max={99} className={`${inputCls} mt-1`} value={data.awayScore} onChange={(e) => set("awayScore", num(e.target.value, 0, 99))} /></label>
            </div>
          )}
          {has("side") && (
            <label className={label}>Anota
              <select className={`${inputCls} mt-1`} value={data.side} onChange={(e) => set("side", e.target.value as "home" | "away")}>
                <option value="home">Local ({data.home || "—"})</option>
                <option value="away">Visitante ({data.away || "—"})</option>
              </select>
            </label>
          )}
          {has("player") && <label className={label}>Jugador<input className={`${inputCls} mt-1`} value={data.player} maxLength={40} onChange={(e) => set("player", e.target.value)} /></label>}
          {has("playerOut") && <label className={label}>Jugador que sale<input className={`${inputCls} mt-1`} value={data.playerOut} maxLength={40} onChange={(e) => set("playerOut", e.target.value)} /></label>}
          {has("playerIn") && <label className={label}>Jugador que entra<input className={`${inputCls} mt-1`} value={data.playerIn} maxLength={40} onChange={(e) => set("playerIn", e.target.value)} /></label>}
          {has("minute") && <label className={label}>Minuto<input type="number" min={0} max={150} className={`${inputCls} mt-1`} value={data.minute} onChange={(e) => set("minute", num(e.target.value, 0, 150))} /></label>}
          {has("round") && <label className={label}>Jornada<input type="number" min={1} max={99} className={`${inputCls} mt-1`} value={data.round} onChange={(e) => set("round", num(e.target.value, 1, 99))} /></label>}
          {has("subtitle") && <label className={label}>Texto (fecha u horario)<input className={`${inputCls} mt-1`} value={data.subtitle} maxLength={60} onChange={(e) => set("subtitle", e.target.value)} /></label>}
          {tpl.fields.length === 0 && <p className="text-sm text-slate-500">Esta animación no necesita datos: usa tu logo y los colores de la marca.</p>}
        </div>

        <div className="min-w-0 space-y-3">
          <div className="overflow-hidden rounded-xl bg-slate-900">
            <canvas
              ref={canvasRef}
              width={w}
              height={h}
              role="img"
              aria-label={`Vista previa de la animación ${tpl.label}`}
              className="mx-auto block max-h-[70vh] w-auto max-w-full"
            />
          </div>

          <div className="flex items-center gap-3">
            <button onClick={() => setPlaying((p) => !p)} disabled={exporting !== null} className={btnGhost} aria-label={playing ? "Pausar" : "Reproducir"}>
              {playing ? "⏸ Pausar" : "▶ Reproducir"}
            </button>
            <input
              type="range"
              min={0}
              max={Math.round(tpl.duration * 1000)}
              value={Math.round(Math.min(t, tpl.duration) * 1000)}
              disabled={exporting !== null}
              onChange={(e) => { setPlaying(false); setT(Number(e.target.value) / 1000); }}
              aria-label="Posición de la animación"
              className="w-full accent-emerald-600"
            />
            <span className="w-24 shrink-0 text-right font-mono text-xs text-slate-500">{t.toFixed(1)} / {tpl.duration.toFixed(1)} s</span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button onClick={exportVideo} disabled={exporting !== null || !mime} className={btnPrimary}>
              {exporting !== null ? `Grabando… ${Math.round(exporting * 100)} %` : `Descargar video (${ext.toUpperCase()})`}
            </button>
            <button onClick={exportPng} disabled={exporting !== null} className={btnGhost}>Descargar imagen (PNG)</button>
            <span className="text-xs text-slate-500">{w}×{h} · 30 fps · el video se graba en tiempo real, no cierres esta página mientras tanto.</span>
          </div>
          <ErrorMsg message={error} />
        </div>
      </div>
    </Card>
  );
}
