"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { buildBroadcastData, buildLineups } from "@/lib/broadcast-data";
import type { BrandSettings } from "@/lib/brand";
import { direct, liveScore } from "@/lib/director";
import { renderBroadcastFrame } from "@/lib/motion/broadcast-frame";
import { DEFAULT_MATCH, type SceneInput } from "@/lib/motion/scenes";
import { drawStadium } from "@/lib/motion/stadium";
import { SIM_CHAPTERS, SIM_DURATION, simulateAt } from "@/lib/sim";
import { createClient } from "@/lib/supabase/client";
import type { Fixture, Player, Sponsor, Team } from "@/lib/types";
import { btnGhost, btnPrimary, inputCls } from "@/components/ui";
import { useGoogleFonts } from "@/components/brand/useGoogleFonts";
import { useBroadcastImages } from "./useBroadcastImages";

const W = 1280, H = 720;
const MIME = ["video/mp4;codecs=avc1.640028", "video/mp4", "video/webm;codecs=vp9", "video/webm"];

// Partido de ejemplo si el torneo aún no tiene calendario.
const DEMO_TEAMS: Team[] = [
  { id: "demo-h", name: "Leones", division_id: "demo", color: "#C8102E", color2: "#1D4ED8" },
  { id: "demo-a", name: "Tigres", division_id: "demo", color: "#F59E0B", color2: "#111827" },
];
const DEMO_FIXTURE: Fixture = { id: "demo", division_id: "demo", round: 1, home_team_id: "demo-h", away_team_id: "demo-a", venue_id: null, kickoff: null, home_score: null, away_score: null, note: null };
const DEMO_PLAYERS: Player[] = DEFAULT_MATCH.lineup.players.flatMap((pl, k) => [
  { id: `dh${k}`, team_id: "demo-h", name: pl.name, number: pl.number, photo_path: null },
  { id: `da${k}`, team_id: "demo-a", name: pl.name, number: pl.number, photo_path: null },
]);

export default function BroadcastSimulator(p: {
  tournamentName: string; brand: BrandSettings; brandLogoPath: string | null;
  teams: Team[]; fixtures: Fixture[]; players: Player[]; sponsors: Sponsor[]; adEveryMinutes: number; palette?: string[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const usable = p.fixtures.filter((f) => p.teams.some((t) => t.id === f.home_team_id) && p.teams.some((t) => t.id === f.away_team_id));
  const [fixtureId, setFixtureId] = useState(usable.find((f) => f.home_score == null)?.id ?? usable[0]?.id ?? "demo");
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [recording, setRecording] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const demo = fixtureId === "demo";
  const fixture = demo ? DEMO_FIXTURE : usable.find((f) => f.id === fixtureId)!;
  const teams = demo ? DEMO_TEAMS : p.teams;
  const players = demo ? DEMO_PLAYERS : p.players;
  const divFixtures = demo ? [DEMO_FIXTURE] : p.fixtures.filter((f) => f.division_id === fixture.division_id);

  useGoogleFonts(Object.values(p.brand.fonts).map((f) => f.family));
  const { images, logo } = useBroadcastImages(supabase, { brandLogoPath: p.brandLogoPath, teams, sponsors: p.sponsors, homeId: fixture.home_team_id, awayId: fixture.away_team_id });
  const lineups = useMemo(() => buildLineups(fixture, teams, players), [fixture, teams, players]);

  // Nombres de jugadores para los eventos del guion (por dorsal, o genéricos).
  const names = (side: "home" | "away", k: number) => {
    const list = side === "home" ? lineups.home.players : lineups.away.players;
    return list.length ? list[k % list.length].name : `Jugador ${k}`;
  };

  const live = useRef({ fixture, teams, divFixtures, lineups, images, logo, names });
  live.current = { fixture, teams, divFixtures, lineups, images, logo, names };

  const render = (time: number) => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const L = live.current;
    const sim = simulateAt(time, {
      sponsors: p.sponsors.length, adEveryMinutes: 8, names: L.names,
      lineups: { home: L.lineups.home.players.length > 0, away: L.lineups.away.players.length > 0 },
    });
    const shot = direct(sim.state, sim.now);
    const score = liveScore({ home: 0, away: 0 }, sim.state.events);
    const data = buildBroadcastData({ fixture: { ...L.fixture, home_score: null, away_score: null }, teams: L.teams, divisionFixtures: L.divFixtures, sponsors: p.sponsors, score, started: sim.state.phase !== "previa" });
    const input: SceneInput = {
      w: W, h: H, t: 0, kind: "broadcast", colors: p.brand.colors, fonts: p.brand.fonts,
      logo: L.logo?.img ?? null, logoSize: L.logo ? { w: L.logo.w, h: L.logo.h } : null,
      tournamentName: p.tournamentName, data, images: L.images, palette: p.palette,
    };
    renderBroadcastFrame(ctx, shot, input, L.lineups, (c) => drawStadium(c, input, time));
  };

  // Reproducción
  useEffect(() => {
    if (!playing || recording !== null) return;
    let raf = 0;
    const start = performance.now() - t * 1000;
    const tick = () => {
      const el = (performance.now() - start) / 1000;
      if (el >= SIM_DURATION) { setT(SIM_DURATION); setPlaying(false); render(SIM_DURATION); return; }
      setT(el);
      render(el);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, recording]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (!playing) render(t); }, [t, playing, images, logo, fixtureId, p.brand, p.palette]);

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  async function record() {
    const canvas = canvasRef.current;
    const type = typeof MediaRecorder === "undefined" ? null : MIME.find((m) => MediaRecorder.isTypeSupported(m));
    if (!canvas || !type) { setError("Este navegador no puede grabar video."); return; }
    if (!window.confirm(`El video se graba en tiempo real: tardará ${fmt(SIM_DURATION)}. ¿Continuar?`)) return;
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
          render(Math.min(el, SIM_DURATION)); setT(Math.min(el, SIM_DURATION)); setRecording(Math.min(1, el / SIM_DURATION));
          if (el < SIM_DURATION + 0.2) requestAnimationFrame(tick); else res();
        };
        requestAnimationFrame(tick);
      });
      rec.stop(); await stopped; stream.getTracks().forEach((tr) => tr.stop());
      const blob = new Blob(chunks, { type: type.split(";")[0] });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `simulacion-transmision.${type.startsWith("video/mp4") ? "mp4" : "webm"}`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
    } catch (e) {
      setError(e instanceof Error ? `No se pudo grabar: ${e.message}` : "No se pudo grabar.");
    } finally {
      setRecording(null);
    }
  }

  const nm = (id: string) => p.teams.find((x) => x.id === id)?.name ?? "?";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm font-medium text-slate-700">Partido para la simulación
          <select className={`${inputCls} mt-1 w-72!`} value={fixtureId} onChange={(e) => { setFixtureId(e.target.value); setT(0); }} disabled={recording !== null}>
            {usable.map((f) => <option key={f.id} value={f.id}>J{f.round} · {nm(f.home_team_id)} vs {nm(f.away_team_id)}</option>)}
            <option value="demo">Partido de ejemplo</option>
          </select>
        </label>
        <p className="text-xs text-slate-500">Un partido completo en {fmt(SIM_DURATION)}, con tu marca, tus equipos y tus patrocinadores. El estadio es virtual: en la transmisión real se ve tu cámara.</p>
      </div>

      <canvas ref={canvasRef} width={W} height={H} className="w-full rounded-xl bg-black" aria-label="Simulación de la transmisión" />

      <div className="flex items-center gap-3">
        <button onClick={() => { if (t >= SIM_DURATION) setT(0); setPlaying((x) => !x); }} disabled={recording !== null} className={btnGhost} aria-label={playing ? "Pausar" : "Reproducir"}>
          {playing ? "⏸ Pausar" : "▶ Reproducir"}
        </button>
        <input type="range" min={0} max={SIM_DURATION * 10} value={Math.round(t * 10)} disabled={recording !== null}
          onChange={(e) => { setPlaying(false); setT(Number(e.target.value) / 10); }} aria-label="Posición de la simulación" className="w-full accent-emerald-600" />
        <span className="w-24 shrink-0 text-right font-mono text-xs text-slate-500">{fmt(t)} / {fmt(SIM_DURATION)}</span>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Capítulos">
        {SIM_CHAPTERS.map((c) => (
          <button key={c.label} onClick={() => { setT(c.t); setPlaying(true); }} disabled={recording !== null}
            className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            {c.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button onClick={record} disabled={recording !== null} className={btnPrimary}>
          {recording !== null ? `Grabando… ${Math.round(recording * 100)} %` : "Descargar video de la simulación"}
        </button>
        {p.sponsors.length === 0 && <span className="text-xs text-amber-700">Agrega patrocinadores para ver sus anuncios y las vallas LED con sus logos.</span>}
      </div>
      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}
