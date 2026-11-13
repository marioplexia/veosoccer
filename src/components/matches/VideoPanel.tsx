"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { INK } from "./MatchesView";

export type MatchVideos = {
  recordings: { id: string; createdAt: string; complete: boolean; segments: { url: string; durationMs: number }[] }[];
  clips: { id: string; url: string; side: "home" | "away"; minute: number | null }[];
};

const mmss = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** Reproduce una grabación hecha por segmentos como si fuera un solo video. */
function RecordingPlayer({ segments }: { segments: { url: string; durationMs: number }[] }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [idx, setIdx] = useState(0);
  const [pos, setPos] = useState(0); // ms dentro del segmento
  const [playing, setPlaying] = useState(false);
  const starts = useMemo(() => segments.reduce<number[]>((acc, s, k) => { acc.push(k === 0 ? 0 : acc[k - 1] + segments[k - 1].durationMs); return acc; }, []), [segments]);
  const total = starts.length ? starts[starts.length - 1] + segments[segments.length - 1].durationMs : 0;
  const pendingSeek = useRef<number | null>(null);

  // Al cambiar de segmento, sigue reproduciendo desde donde toca.
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const onLoaded = () => {
      if (pendingSeek.current != null) { try { v.currentTime = pendingSeek.current / 1000; } catch { /* sin búsqueda */ } pendingSeek.current = null; }
      if (playing) v.play().catch(() => setPlaying(false));
    };
    v.addEventListener("loadedmetadata", onLoaded);
    return () => v.removeEventListener("loadedmetadata", onLoaded);
  }, [idx, playing]);

  const seek = (ms: number) => {
    let k = starts.findLastIndex((st) => st <= ms);
    if (k < 0) k = 0;
    const inside = ms - starts[k];
    if (k === idx && ref.current) { try { ref.current.currentTime = inside / 1000; } catch { /* sin búsqueda */ } }
    else { pendingSeek.current = inside; setIdx(k); }
    setPos(inside);
  };
  const toggle = () => {
    const v = ref.current;
    if (!v) return;
    if (v.paused) { v.play().then(() => setPlaying(true)).catch(() => undefined); } else { v.pause(); setPlaying(false); }
  };
  const now = (starts[idx] ?? 0) + pos;

  return (
    <div className="overflow-hidden rounded-xl bg-black">
      <video ref={ref} key={idx} src={segments[idx]?.url} playsInline preload="auto" className="block aspect-video w-full bg-black" onClick={toggle}
        onTimeUpdate={(e) => setPos(e.currentTarget.currentTime * 1000)}
        onEnded={() => { if (idx < segments.length - 1) { setPos(0); setIdx(idx + 1); } else setPlaying(false); }} />
      {/* precarga del siguiente segmento, para que el cambio no se note */}
      {segments[idx + 1] && <video src={segments[idx + 1].url} preload="auto" muted className="hidden" aria-hidden />}
      <div className="flex items-center gap-3 px-3 py-2.5 text-white">
        <button onClick={toggle} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/15 text-sm hover:bg-white/25" aria-label={playing ? "Pausar" : "Reproducir"}>{playing ? "⏸" : "▶"}</button>
        <span className="shrink-0 font-mono text-xs tabular-nums">{mmss(now)} / {mmss(total)}</span>
        <input type="range" min={0} max={Math.max(1, total)} step={1000} value={Math.min(now, total)} onChange={(e) => seek(Number(e.target.value))} aria-label="Posición del video" className="min-w-0 flex-1 accent-white" />
        <button onClick={() => ref.current?.requestFullscreen?.().catch(() => undefined)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/15 hover:bg-white/25" aria-label="Pantalla completa">⛶</button>
      </div>
    </div>
  );
}

/** Videos del partido: la grabación completa y los clips automáticos de cada gol. */
export default function VideoPanel({ videos, homeName, awayName }: { videos: MatchVideos; homeName: string; awayName: string }) {
  const recs = videos.recordings.filter((r) => r.segments.length > 0);
  if (recs.length === 0 && videos.clips.length === 0) {
    return <p className="text-sm opacity-70">Aún no hay video de este partido. Al grabarlo en la nube o transmitirlo, aquí aparecerán la grabación y un clip de cada gol.</p>;
  }
  return (
    <div className="space-y-8">
      {videos.clips.length > 0 && (
        <div>
          <h3 className="mb-3 font-semibold">Clips de gol</h3>
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {videos.clips.map((c) => (
              <li key={c.id} className="min-w-0">
                <video src={c.url} controls playsInline preload="metadata" className="block aspect-video w-full rounded-xl bg-black" />
                <div className="mt-2 flex items-center justify-between gap-2 text-sm">
                  <span className="truncate font-semibold">⚽ {c.side === "home" ? homeName : awayName}{c.minute != null ? ` · ${c.minute}'` : ""}</span>
                  <a href={c.url} download className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold text-white" style={{ background: INK }}>Descargar</a>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      {recs.map((r, k) => (
        <div key={r.id}>
          <h3 className="mb-3 font-semibold">Partido completo{recs.length > 1 ? ` · grabación ${k + 1}` : ""}{r.complete ? "" : " (incompleta)"}</h3>
          <RecordingPlayer segments={r.segments} />
        </div>
      ))}
      <p className="text-xs opacity-60">Los enlaces de video son privados y caducan en unas horas; al recargar la página se renuevan.</p>
    </div>
  );
}
