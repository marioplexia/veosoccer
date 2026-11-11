"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_BRANDS } from "@/lib/brand";
import type { MatchSummary } from "@/lib/match-view";
import { drawRecap, recapDuration } from "@/lib/motion/recap";
import { DEFAULT_MATCH, type SceneImage, type SceneInput } from "@/lib/motion/scenes";
import type { Fixture } from "@/lib/types";
import { useGoogleFonts } from "@/components/brand/useGoogleFonts";
import type { DetailTeam, OwnerTools } from "./MatchDetail";
import { INK } from "./MatchesView";

const W = 1920, H = 1080;
const MIME = ["video/mp4;codecs=avc1.42E01E", "video/mp4", "video/webm;codecs=vp9", "video/webm"];

function loadImage(url: string | null): Promise<SceneImage | null> {
  return new Promise((resolve) => {
    if (!url) return resolve(null);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve({ img, w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/** Resumen con IA: la crónica escrita y el video que la IA guioniza y la app edita con los gráficos del partido. */
export default function SummaryPanel({ owner, played, tournamentName, fixture, home, away, scorers }: {
  owner: OwnerTools; played: boolean; tournamentName: string; fixture: Fixture; home: DetailTeam; away: DetailTeam;
  scorers: { home: string[]; away: string[] };
}) {
  const [summary, setSummary] = useState<MatchSummary | null>(owner.summary);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [recording, setRecording] = useState<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const assets = useRef<{ logo: SceneImage | null; images: Record<string, SceneImage> }>({ logo: null, images: {} });
  const tRef = useRef(1.4); // en pausa muestra el titular ya visible

  useGoogleFonts(Object.values(owner.fonts).map((f) => f.family));

  const render = useCallback((t: number) => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !summary) return;
    const A = assets.current;
    const input: SceneInput = {
      w: W, h: H, t, kind: "broadcast", colors: DEFAULT_BRANDS.broadcast.colors, fonts: owner.fonts,
      logo: A.logo?.img ?? null, logoSize: A.logo ? { w: A.logo.w, h: A.logo.h } : null, images: A.images, tournamentName,
      data: { ...DEFAULT_MATCH, home: home.name, away: away.name, homeScore: fixture.home_score ?? 0, awayScore: fixture.away_score ?? 0, round: fixture.round, scorers },
    };
    drawRecap(ctx, input, summary, t);
  }, [summary, owner.fonts, tournamentName, home.name, away.name, fixture.home_score, fixture.away_score, fixture.round, scorers]);

  // Logo y escudos para el video.
  useEffect(() => {
    let alive = true;
    Promise.all([loadImage(owner.logoUrl), loadImage(home.crestUrl), loadImage(away.crestUrl)]).then(([logo, h, a]) => {
      if (!alive) return;
      assets.current = { logo, images: { ...(h ? { homeLogo: h } : {}), ...(a ? { awayLogo: a } : {}) } };
      render(tRef.current);
    });
    return () => { alive = false; };
  }, [owner.logoUrl, home.crestUrl, away.crestUrl, render]);

  // Reproducción en bucle, o fotograma fijo cuando está en pausa.
  useEffect(() => {
    if (!summary || recording !== null) return;
    if (!playing) { render(tRef.current); document.fonts.ready.then(() => render(tRef.current)); return; }
    const D = recapDuration(summary);
    let raf = 0;
    const t0 = performance.now() - tRef.current * 1000;
    const tick = () => { tRef.current = ((performance.now() - t0) / 1000) % D; render(tRef.current); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [summary, playing, recording, render]);

  async function generate() {
    setError(null); setNotice(null); setBusy(true); setPlaying(false);
    try {
      const res = await fetch(owner.summaryEndpoint, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setError(body.error ?? "No se pudo crear el resumen."); return; }
      tRef.current = 0;
      setSummary(body.summary as MatchSummary);
      setNotice(body.saved === false ? "Resumen creado, pero no se pudo guardar. Cópialo antes de salir." : "Resumen creado y guardado.");
    } catch { setError("No se pudo conectar con el servidor."); }
    finally { setBusy(false); }
  }

  async function download() {
    const canvas = canvasRef.current;
    const type = typeof MediaRecorder === "undefined" ? null : MIME.find((m) => MediaRecorder.isTypeSupported(m));
    if (!canvas || !summary || !type) { setError("Este navegador no puede grabar video."); return; }
    const D = recapDuration(summary);
    setError(null); setPlaying(false); setRecording(0);
    try {
      await document.fonts.ready;
      render(0);
      const stream = canvas.captureStream(30);
      const rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 8_000_000 });
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      const stopped = new Promise<void>((r) => { rec.onstop = () => r(); });
      rec.start(1000);
      const t0 = performance.now();
      await new Promise<void>((res) => {
        const tick = () => {
          const el = (performance.now() - t0) / 1000;
          render(Math.min(el, D - 0.01)); setRecording(Math.min(1, el / D));
          if (el < D + 0.2) requestAnimationFrame(tick); else res();
        };
        requestAnimationFrame(tick);
      });
      rec.stop(); await stopped; stream.getTracks().forEach((tr) => tr.stop());
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob(chunks, { type: type.split(";")[0] }));
      a.download = `resumen-${home.name}-${away.name}.${type.startsWith("video/mp4") ? "mp4" : "webm"}`.replace(/\s+/g, "-").toLowerCase();
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
    } catch { setError("No se pudo grabar el video."); }
    finally { setRecording(null); tRef.current = 0; }
  }

  const copy = async (text: string, what: string) => {
    try { await navigator.clipboard.writeText(text); setNotice(`${what} copiado.`); } catch { setError("No se pudo copiar."); }
  };
  const btn = "rounded-lg px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50";

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">Resumen del partido con IA</h2>
          <p className="mt-1 max-w-2xl text-sm opacity-75">La IA escribe la crónica y el guion con los datos del partido (resultado, goleadores, minutos y tabla), y con ese guion se edita sola un video resumen con los gráficos de tu torneo.</p>
        </div>
        <button onClick={generate} disabled={busy || !played || recording !== null} className={`${btn} text-white`} style={{ background: INK }}>
          {busy ? "Creando resumen…" : summary ? "↻ Volver a generar" : "✨ Generar resumen"}
        </button>
      </div>
      {!played && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">Registra primero el resultado del partido (en el Calendario o al terminar la transmisión) para poder resumirlo.</p>}
      {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {notice && !error && <p role="status" className="mt-3 text-sm text-emerald-700">{notice}</p>}

      {summary && (
        <div className="mt-5 grid gap-6 xl:grid-cols-2">
          <div className="min-w-0">
            <canvas ref={canvasRef} width={W} height={H} className="block w-full rounded-xl bg-slate-900" role="img" aria-label="Video resumen del partido" />
            {recording !== null && (
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#EFE6F0]" role="progressbar" aria-valuenow={Math.round(recording * 100)} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full" style={{ width: `${recording * 100}%`, background: INK }} />
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={() => setPlaying((v) => !v)} disabled={recording !== null} className={`${btn} bg-[#EFE6F0]`}>{playing ? "⏸ Pausar" : "▶ Reproducir"}</button>
              <button onClick={download} disabled={recording !== null} className={`${btn} text-white`} style={{ background: INK }}>
                {recording !== null ? `Grabando… ${Math.round(recording * 100)}%` : `⬇ Descargar video (${Math.round(recapDuration(summary))} s)`}
              </button>
            </div>
            <p className="mt-2 text-xs opacity-60">El video se graba en tiempo real en tu navegador; no cierres la pestaña mientras se descarga.</p>
          </div>

          <article className="min-w-0">
            <h3 className="text-2xl font-bold leading-tight">{summary.headline}</h3>
            {summary.paragraphs.map((x, k) => <p key={k} className="mt-3 text-[15px] leading-relaxed">{x}</p>)}
            {summary.moments.length > 0 && (
              <ul className="mt-4 space-y-2 text-sm">
                {summary.moments.map((m, k) => (
                  <li key={k} className="flex gap-3">
                    <span className="grid h-7 min-w-[2.6rem] shrink-0 place-items-center rounded-md text-xs font-bold text-white" style={{ background: INK }}>{m.minute != null ? `${m.minute}'` : "★"}</span>
                    <span>{m.text}</span>
                  </li>
                ))}
              </ul>
            )}
            {summary.social && (
              <div className="mt-5 rounded-xl bg-[#F6F2F7] p-3 text-sm">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide opacity-60">Para redes</p>
                <p>{summary.social}</p>
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={() => copy(`${summary.headline}\n\n${summary.paragraphs.join("\n\n")}`, "Resumen")} className={`${btn} bg-[#EFE6F0]`}>Copiar crónica</button>
              {summary.social && <button onClick={() => copy(summary.social, "Texto para redes")} className={`${btn} bg-[#EFE6F0]`}>Copiar texto para redes</button>}
            </div>
          </article>
        </div>
      )}
    </div>
  );
}
