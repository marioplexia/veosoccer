"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Room } from "livekit-client";
import type { BrandSettings } from "@/lib/brand";
import { DURATIONS, direct, liveScore, scorersOf, matchClock, matchMinute, type DirectorState, type FullScene, type LiveEvent, type Phase, type Shot, type Side } from "@/lib/director";
import { buildBroadcastData, buildLineups } from "@/lib/broadcast-data";
import { renderBroadcastFrame } from "@/lib/motion/broadcast-frame";
import type { MatchData, SceneInput } from "@/lib/motion/scenes";
import { drawStadium } from "@/lib/motion/stadium";
import { useBroadcastImages } from "./useBroadcastImages";
import { createClient } from "@/lib/supabase/client";
import type { Fixture, Player, Sponsor, Team } from "@/lib/types";
import { useGoogleFonts } from "@/components/brand/useGoogleFonts";

const W = 1280, H = 720;
type Status = "setup" | "connecting" | "live" | "ensayo" | "ended";
type Ev = LiveEvent & { id: string; goalRowId?: string };
type Picker = { kind: "goal" | "yellow" | "red" | "sub"; side?: Side; eventId?: string; step: "team" | "player" | "in" };

/** Gráficos que se pueden lanzar a mano desde el reproductor (además del director automático). */
const GRAPHICS: { scene: FullScene; label: string; needs?: "home" | "away" }[] = [
  { scene: "ident", label: "Intro" },
  { scene: "matchup", label: "Presentación" },
  { scene: "lineupHome", label: "Alineación local", needs: "home" },
  { scene: "lineupAway", label: "Alineación visitante", needs: "away" },
  { scene: "kickoff", label: "Inicio" },
  { scene: "halftime", label: "Medio tiempo" },
  { scene: "fulltime", label: "Final" },
  { scene: "standings", label: "Tabla" },
  { scene: "results", label: "Resultados" },
];
const SCENE_LABEL: Record<FullScene, string> = {
  ident: "Intro", matchup: "Presentación del partido", lineupHome: "Alineación local", lineupAway: "Alineación visitante", kickoff: "Inicio del partido",
  halftime: "Medio tiempo", fulltime: "Final", standings: "Tabla de posiciones", results: "Resultados de la jornada",
};
const hms = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

const NEXT_PHASE: Record<Phase, { to: Phase | null; label: string }> = {
  previa: { to: "1T", label: "▶ Iniciar 1er tiempo" },
  "1T": { to: "descanso", label: "⏸ Medio tiempo" },
  descanso: { to: "2T", label: "▶ Iniciar 2º tiempo" },
  "2T": { to: "final", label: "🏁 Final del partido" },
  final: { to: null, label: "" },
};

type Props = {
  tournament: { id: string; name: string };
  fixture: Fixture;
  teams: Team[];
  divisionFixtures: Fixture[];
  players: Player[];
  brand: BrandSettings;
  brandLogoPath: string | null;
  sponsors: Sponsor[];
  adEveryMinutes: number;
  hasStreamKey: boolean;
  palette?: string[];
};

export default function LiveStudio(p: Props) {
  const supabase = useMemo(() => createClient(), []);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const roomRef = useRef<Room | null>(null);
  const broadcastIdRef = useRef<string | null>(null);
  const storeKey = `tx:${p.fixture.id}`;

  const base = { home: p.fixture.home_score ?? 0, away: p.fixture.away_score ?? 0 };

  // Estado del partido (se guarda en el dispositivo por si se recarga la página).
  const [phase, setPhase] = useState<Phase>("previa");
  const [phaseStartedAt, setPhaseStartedAt] = useState<number>(() => Date.now());
  const [events, setEvents] = useState<Ev[]>([]);
  const [restored, setRestored] = useState(false);
  const [status, setStatus] = useState<Status>("setup");
  const [error, setError] = useState<string | null>(null);
  const [camError, setCamError] = useState<string | null>(null);
  const [picker, setPicker] = useState<Picker | null>(null);
  const [now, setNow] = useState(Date.now());
  // Reproductor: gráfico lanzado a mano, micrófono, cámara, nivel de audio, tiempo al aire.
  const [manual, setManual] = useState<{ scene: FullScene; at: number } | null>(null);
  const [muted, setMuted] = useState(false);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [camReady, setCamReady] = useState(false);
  const [level, setLevel] = useState(0);
  const [onAirSince, setOnAirSince] = useState<number | null>(null);
  const [shotLabel, setShotLabel] = useState("Cámara + marcador");
  const playerRef = useRef<HTMLDivElement>(null);
  const { images, logo } = useBroadcastImages(supabase, { brandLogoPath: p.brandLogoPath, teams: p.teams, sponsors: p.sponsors, homeId: p.fixture.home_team_id, awayId: p.fixture.away_team_id });

  // Recupera el partido en curso si la página se recargó (solo en el navegador, tras montar).
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storeKey) ?? "null") as null | { phase: Phase; phaseStartedAt: number; events: Ev[] };
      if (saved && saved.phase && Array.isArray(saved.events)) {
        setPhase(saved.phase);
        setPhaseStartedAt(saved.phaseStartedAt);
        setEvents(saved.events);
      }
    } catch { /* almacenamiento no disponible */ }
    setRestored(true);
  }, [storeKey]);
  useEffect(() => {
    if (!restored) return; // no sobrescribir lo guardado antes de leerlo
    try { localStorage.setItem(storeKey, JSON.stringify({ phase, phaseStartedAt, events })); } catch { /* almacenamiento no disponible */ }
  }, [restored, storeKey, phase, phaseStartedAt, events]);

  // Fuentes de la marca para el lienzo.
  useGoogleFonts(Object.values(p.brand.fonts).map((f) => f.family));
  const [fontsReady, setFontsReady] = useState(0);
  useEffect(() => {
    Promise.all(Object.values(p.brand.fonts).map((f) => document.fonts.load(`${f.italic ? "italic " : ""}${f.weight} 48px "${f.family}"`))).catch(() => undefined).then(() => setFontsReady((n) => n + 1));
  }, [p.brand.fonts]);

  // Cámara + micrófono. Al cambiar de cámara se conserva la pista de audio (la que ya puede estar al aire).
  useEffect(() => {
    let cancelled = false;
    const keepAudio = streamRef.current?.getAudioTracks() ?? [];
    setCamReady(false);
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } }, audio: keepAudio.length === 0 })
      .then((ms) => {
        if (cancelled) { ms.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current?.getVideoTracks().forEach((t) => t.stop());
        const next = new MediaStream([...ms.getVideoTracks(), ...(keepAudio.length ? keepAudio : ms.getAudioTracks())]);
        streamRef.current = next;
        setCamError(null); setCamReady(true);
        if (videoRef.current) { videoRef.current.srcObject = next; videoRef.current.play().catch(() => undefined); }
      })
      .catch(() => setCamError("No se pudo abrir la cámara. Da permiso de cámara y micrófono a esta página. Mientras tanto ves los gráficos sobre una cancha de muestra."));
    return () => { cancelled = true; };
  }, [facing]);
  useEffect(() => () => { streamRef.current?.getTracks().forEach((t) => t.stop()); }, []);

  // Silenciar el micrófono (también al aire: la pista sigue publicada, pero sin sonido).
  useEffect(() => { streamRef.current?.getAudioTracks().forEach((t) => { t.enabled = !muted; }); }, [muted, camReady]);

  // Medidor de nivel de audio.
  useEffect(() => {
    const ms = streamRef.current;
    if (!camReady || !ms || ms.getAudioTracks().length === 0) return;
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ac = new AC();
    const an = ac.createAnalyser(); an.fftSize = 256;
    ac.createMediaStreamSource(new MediaStream(ms.getAudioTracks())).connect(an);
    const buf = new Uint8Array(an.fftSize);
    const id = setInterval(() => {
      an.getByteTimeDomainData(buf);
      let peak = 0;
      for (const v of buf) peak = Math.max(peak, Math.abs(v - 128) / 128);
      setLevel(peak);
    }, 120);
    return () => { clearInterval(id); ac.close().catch(() => undefined); };
  }, [camReady]);

  // Mantener la pantalla encendida mientras se transmite.
  useEffect(() => {
    if (status !== "live" && status !== "ensayo") return;
    let lock: { release: () => Promise<void> } | null = null;
    (navigator as unknown as { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request("screen").then((l) => { lock = l; }).catch(() => undefined);
    return () => { lock?.release().catch(() => undefined); };
  }, [status]);

  const score = liveScore(base, events);
  const directorState: DirectorState = {
    phase, phaseStartedAt, events, sponsors: p.sponsors.length, adEveryMinutes: p.adEveryMinutes,
    lineups: { home: p.players.some((x) => x.team_id === p.fixture.home_team_id), away: p.players.some((x) => x.team_id === p.fixture.away_team_id) },
  };

  // Datos para los gráficos (tabla y resultados con el marcador en vivo).
  const matchData = useMemo((): MatchData => buildBroadcastData({
    fixture: p.fixture, teams: p.teams, divisionFixtures: p.divisionFixtures, sponsors: p.sponsors, score, started: phase !== "previa", scorers: scorersOf(events),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [p.fixture, p.teams, p.divisionFixtures, p.sponsors, phase, score.home, score.away, events]);
  const lineups = useMemo(() => buildLineups(p.fixture, p.teams, p.players), [p.fixture, p.teams, p.players]);

  const live = useRef({ directorState, matchData, images, logo, lineups, status, manual });
  live.current = { directorState, matchData, images, logo, lineups, status, manual };

  /** Lo que se ve en el monitor: fuera del aire, cámara con el marcador ya puesto; un gráfico lanzado a mano tiene prioridad. */
  const shotAt = useCallback((t: number): Shot => {
    const L = live.current;
    let shot = direct(L.directorState, t);
    if (L.status === "setup" || L.status === "connecting" || L.status === "ended") shot = { scoreboard: true, clock: shot.clock };
    if (L.manual) {
      const mt = (t - L.manual.at) / 1000;
      if (mt >= 0 && mt < DURATIONS[L.manual.scene]) shot = { scoreboard: false, clock: shot.clock, full: { scene: L.manual.scene, t: mt } };
    }
    return shot;
  }, []);

  // Bucle de dibujo: video + gráficos según el director.
  useEffect(() => {
    let raf = 0;
    const draw = () => {
      const c = canvasRef.current, v = videoRef.current;
      const ctx = c?.getContext("2d");
      if (c && ctx) {
        const L = live.current;
        const t = Date.now();
        const shot: Shot = shotAt(t);
        const input: SceneInput = {
          w: W, h: H, t: 0, kind: "broadcast", colors: p.brand.colors, fonts: p.brand.fonts,
          logo: L.logo?.img ?? null, logoSize: L.logo ? { w: L.logo.w, h: L.logo.h } : null,
          tournamentName: p.tournament.name, data: L.matchData, images: L.images, palette: p.palette, scoreStyle: p.brand.scoreboard,
        };
        renderBroadcastFrame(ctx, shot, input, L.lineups, (c2) => {
          c2.fillStyle = "#0B0F19"; c2.fillRect(0, 0, W, H);
          if (v && v.readyState >= 2 && v.videoWidth) {
            const k = Math.max(W / v.videoWidth, H / v.videoHeight);
            const vw = v.videoWidth * k, vh = v.videoHeight * k;
            c2.drawImage(v, (W - vw) / 2, (H - vh) / 2, vw, vh);
          } else if (L.status !== "live") {
            // Sin cámara todavía: cancha de muestra, para ver los gráficos desde el primer momento.
            drawStadium(c2, input, t / 1000);
          }
        });
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    const tick = setInterval(() => {
      const t = Date.now();
      setNow(t);
      const sh = shotAt(t);
      setShotLabel(sh.full ? SCENE_LABEL[sh.full.scene] : sh.goal ? "Cámara · animación de gol" : sh.lower ? "Cámara · rótulo" : sh.sponsor ? "Cámara · patrocinador" : sh.scoreboard ? "Cámara + marcador" : "Cámara");
    }, 500);
    return () => { cancelAnimationFrame(raf); clearInterval(tick); };
  }, [p.brand, p.palette, p.tournament.name, fontsReady, shotAt]);

  /* ───── salir al aire ───── */
  async function goLive() {
    setError(null);
    setStatus("connecting");
    try {
      const res = await fetch(`/api/torneos/${p.tournament.id}/transmision/iniciar`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fixtureId: p.fixture.id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setStatus("setup"); setError(json.error ?? "No se pudo iniciar la transmisión."); return; }
      const { Room, Track } = await import("livekit-client");
      const room = new Room();
      await room.connect(json.url, json.token);
      const video = canvasRef.current!.captureStream(30).getVideoTracks()[0];
      await room.localParticipant.publishTrack(video, { source: Track.Source.Camera, simulcast: false, videoEncoding: { maxBitrate: 3_000_000, maxFramerate: 30 } });
      const mic = streamRef.current?.getAudioTracks()[0];
      if (mic) await room.localParticipant.publishTrack(mic, { source: Track.Source.Microphone });
      roomRef.current = room;
      broadcastIdRef.current = json.broadcastId;
      room.on("disconnected", () => setError("Se perdió la conexión con el servidor de transmisión. Revisa la señal y vuelve a iniciar."));
      setOnAirSince(Date.now());
      setStatus("live");
    } catch (e) {
      setStatus("setup");
      setError(e instanceof Error ? `No se pudo conectar: ${e.message}` : "No se pudo conectar.");
    }
  }

  async function endBroadcast() {
    if (!window.confirm("¿Terminar la transmisión?")) return;
    await roomRef.current?.disconnect().catch(() => undefined);
    roomRef.current = null;
    if (broadcastIdRef.current) {
      await fetch(`/api/torneos/${p.tournament.id}/transmision/detener`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ broadcastId: broadcastIdRef.current }),
      }).catch(() => undefined);
    }
    setStatus("ended");
  }

  /* ───── eventos del partido ───── */
  const saveScore = useCallback(async (s: { home: number; away: number }) => {
    const { error } = await supabase.from("fixtures").update({ home_score: s.home, away_score: s.away }).eq("id", p.fixture.id);
    if (error) setError("El marcador no se pudo guardar en el torneo (sin conexión). La transmisión sigue.");
  }, [supabase, p.fixture.id]);

  function addEvent(e: Omit<Ev, "id" | "at" | "minute">) {
    const ev = { ...e, id: crypto.randomUUID(), at: Date.now(), minute: matchMinute(phase, phaseStartedAt, Date.now()) } as Ev;
    const next = [...events, ev];
    setEvents(next);
    if (ev.kind === "goal") saveScore(liveScore(base, next));
    return ev;
  }

  function goal(side: Side) {
    const ev = addEvent({ kind: "goal", side });
    setPicker({ kind: "goal", side, eventId: ev.id, step: "player" });
  }

  async function setEventPlayer(eventId: string, pl: Player | null, field: "player" | "playerOut" | "playerIn" = "player") {
    const ev = events.find((x) => x.id === eventId);
    setEvents((list) => list.map((x) => (x.id === eventId ? { ...x, [field]: pl?.name } : x)));
    if (ev?.kind === "goal" && pl) {
      const teamId = ev.side === "home" ? p.fixture.home_team_id : p.fixture.away_team_id;
      const { data } = await supabase.from("fixture_goals").insert({ fixture_id: p.fixture.id, team_id: teamId, player_name: pl.name, minute: ev.minute }).select("id").single();
      if (data) setEvents((list) => list.map((x) => (x.id === eventId ? { ...x, goalRowId: data.id } : x)));
    }
  }

  async function undo() {
    const last = events[events.length - 1];
    if (!last || !window.confirm("¿Deshacer el último evento?")) return;
    const next = events.slice(0, -1);
    setEvents(next);
    if (last.kind === "goal") {
      await saveScore(liveScore(base, next));
      if (last.goalRowId) await supabase.from("fixture_goals").delete().eq("id", last.goalRowId);
    }
  }

  function advancePhase() {
    const to = NEXT_PHASE[phase].to;
    if (!to) return;
    if (to === "final" && !window.confirm("¿Terminar el partido? Se mostrará el resultado final.")) return;
    setPhase(to);
    setPhaseStartedAt(Date.now());
    if (to === "1T") saveScore(score);
  }

  const teamPlayers = (side: Side) => p.players.filter((x) => x.team_id === (side === "home" ? p.fixture.home_team_id : p.fixture.away_team_id));
  const clock = matchClock(phase, phaseStartedAt, now);
  const inPlay = phase === "1T" || phase === "2T";
  const onAir = status === "live" || status === "ensayo";
  const hc = matchData.homeColor, ac = matchData.awayColor;
  const homeName = matchData.home, awayName = matchData.away;
  const big = "rounded-2xl px-4 py-4 text-lg font-extrabold shadow-sm active:scale-[.98] disabled:opacity-40";
  const manualOn = manual && now - manual.at < DURATIONS[manual.scene] * 1000 ? manual.scene : null;
  const ctl = "grid h-10 min-w-10 place-items-center rounded-lg bg-white/10 px-2.5 text-sm font-semibold backdrop-blur transition hover:bg-white/20 disabled:opacity-40";
  const toggleFullscreen = () => {
    const el = playerRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined); else el.requestFullscreen?.().catch(() => undefined);
  };
  const statusPill = status === "live" ? { text: "● EN VIVO", cls: "bg-red-600" } : status === "ensayo" ? { text: "ENSAYO", cls: "bg-amber-500 text-slate-950" }
    : status === "connecting" ? { text: "CONECTANDO…", cls: "bg-white/20" } : status === "ended" ? { text: "TERMINADA", cls: "bg-white/20" } : { text: "VISTA PREVIA", cls: "bg-white/20" };

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-[1440px] p-3 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <Link href={`/panel/torneos/${p.tournament.id}`} className="text-sm text-slate-300 hover:text-white">← Volver al torneo</Link>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${status === "live" ? "bg-red-600" : status === "ensayo" ? "bg-amber-500 text-slate-950" : "bg-slate-700"}`}>
            {status === "live" ? "● EN VIVO EN FACEBOOK" : status === "ensayo" ? "ENSAYO · no sale al aire" : status === "connecting" ? "Conectando…" : status === "ended" ? "Transmisión terminada" : "Preparando"}
          </span>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0">
            {/* reproductor: monitor de programa con barra de estado y controles */}
            <div ref={playerRef} className="group relative overflow-hidden rounded-2xl bg-black shadow-2xl ring-1 ring-white/10">
              <canvas ref={canvasRef} width={W} height={H} className="block aspect-video w-full bg-black object-contain" aria-label="Monitor de la transmisión" />
              <video ref={videoRef} playsInline muted className="hidden" />
              {/* estado arriba a la derecha: el marcador de la transmisión ocupa la esquina izquierda */}
              <div className="pointer-events-none absolute right-3 top-3 flex flex-wrap items-center justify-end gap-2 text-xs font-bold">
                {status === "live" && onAirSince && <span className="rounded-md bg-black/60 px-2 py-1 font-mono tabular-nums">{hms(now - onAirSince)}</span>}
                <span className={`rounded-md px-2.5 py-1 ${status === "live" || status === "ensayo" ? statusPill.cls : "bg-black/60"}`}>{statusPill.text}</span>
                <span className="rounded-md bg-black/60 px-2 py-1 font-medium">720p · 30 fps</span>
              </div>
              <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-center gap-2 bg-gradient-to-t from-black/85 via-black/50 to-transparent px-3 pb-3 pt-8">
                <button onClick={() => setMuted((v) => !v)} className={ctl} aria-pressed={muted} aria-label={muted ? "Activar micrófono" : "Silenciar micrófono"} title={muted ? "Activar micrófono" : "Silenciar micrófono"}>{muted ? "🔇" : "🎙️"}</button>
                <span className="flex h-10 items-center gap-[3px]" role="meter" aria-label="Nivel de audio" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((muted ? 0 : level) * 100)}>
                  {Array.from({ length: 12 }, (_, k) => {
                    const on = !muted && level * 12 > k;
                    return <span key={k} className="w-1.5 rounded-sm" style={{ height: 8 + k * 1.6, background: on ? (k > 9 ? "#EF4444" : k > 6 ? "#FACC15" : "#22C55E") : "rgba(255,255,255,.22)" }} />;
                  })}
                </span>
                <button onClick={() => setFacing((f) => (f === "environment" ? "user" : "environment"))} className={ctl} aria-label="Cambiar de cámara" title="Cambiar de cámara">🔄</button>
                <span className="min-w-0 flex-1 truncate px-1 text-xs text-white/85"><span className="font-bold text-white">En pantalla:</span> {shotLabel}</span>
                <span className="hidden rounded-md bg-white/10 px-2 py-1 text-[11px] font-bold sm:block" title="El director automático decide qué gráfico va en cada momento">🤖 Director IA: {manualOn ? "manual" : "auto"}</span>
                <button onClick={toggleFullscreen} className={ctl} aria-label="Pantalla completa" title="Pantalla completa">⛶</button>
              </div>
            </div>

            {/* gráficos a un toque */}
            <div className="mt-3 rounded-2xl bg-slate-900 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Gráficos</p>
                {manualOn && <button onClick={() => setManual(null)} className="rounded-md bg-white/10 px-2 py-1 text-xs font-semibold">✕ Quitar gráfico</button>}
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {GRAPHICS.filter((g) => !g.needs || directorState.lineups[g.needs]).map((g) => (
                  <button key={g.scene} onClick={() => setManual({ scene: g.scene, at: Date.now() })} aria-pressed={manualOn === g.scene}
                    className={`shrink-0 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${manualOn === g.scene ? "bg-white text-slate-900" : "bg-white/10 hover:bg-white/20"}`}>
                    {g.label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-400">{onAir ? "Tócalo para lanzarlo al aire ahora; al terminar vuelve el director automático." : "Tócalo para ver cómo se verá. Aún no estás al aire."}</p>
            </div>
            {camError && <p role="alert" className="mt-2 rounded-lg bg-red-900/60 px-3 py-2 text-sm">{camError}</p>}
            {error && <p role="alert" className="mt-2 rounded-lg bg-red-900/60 px-3 py-2 text-sm">{error}</p>}
          </div>

          <div className="space-y-3">
            <div className="rounded-2xl bg-slate-900 p-4 text-center">
              <p className="text-xs uppercase tracking-widest text-slate-400">{phase === "previa" ? "Previa" : phase === "descanso" ? "Medio tiempo" : phase === "final" ? "Final" : phase === "1T" ? "1er tiempo" : "2º tiempo"}</p>
              <p className="mt-1 text-3xl font-extrabold tabular-nums">{homeName.slice(0, 12)} {score.home} - {score.away} {awayName.slice(0, 12)}</p>
              <p className="font-mono text-lg text-slate-300">{clock}</p>
            </div>

            {status === "setup" && (
              <div className="space-y-2 rounded-2xl bg-slate-900 p-4">
                <p className="text-sm text-slate-300">Ya estás viendo el marcador y los gráficos sobre tu cámara. Coloca el celular en horizontal apuntando a la cancha; el director automático se encarga del resto.</p>
                <button onClick={goLive} disabled={!p.hasStreamKey || !camReady} className={`${big} w-full bg-red-600`}>● Salir en vivo a Facebook</button>
                {!p.hasStreamKey && <p className="text-xs text-amber-300">Falta tu clave de Facebook (pestaña Transmitir del torneo).</p>}
                <button onClick={() => setStatus("ensayo")} className={`${big} w-full bg-slate-700 text-base`}>Ensayar sin transmitir</button>
              </div>
            )}

            {onAir && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => goal("home")} disabled={!inPlay} className={big} style={{ background: hc }}>⚽ GOL<br /><span className="text-sm font-bold">{homeName}</span></button>
                  <button onClick={() => goal("away")} disabled={!inPlay} className={big} style={{ background: ac }}>⚽ GOL<br /><span className="text-sm font-bold">{awayName}</span></button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button onClick={() => setPicker({ kind: "yellow", step: "team" })} disabled={!inPlay} className={`${big} bg-yellow-400 text-base text-slate-900`}>Amarilla</button>
                  <button onClick={() => setPicker({ kind: "red", step: "team" })} disabled={!inPlay} className={`${big} bg-red-600 text-base`}>Roja</button>
                  <button onClick={() => setPicker({ kind: "sub", step: "team" })} disabled={!inPlay} className={`${big} bg-emerald-600 text-base`}>Cambio</button>
                </div>
                {NEXT_PHASE[phase].to && <button onClick={advancePhase} className={`${big} w-full bg-white text-slate-900`}>{NEXT_PHASE[phase].label}</button>}
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={undo} disabled={events.length === 0} className={`${big} bg-slate-800 text-sm`}>↶ Deshacer</button>
                  {status === "live"
                    ? <button onClick={endBroadcast} className={`${big} bg-slate-800 text-sm text-red-300`}>■ Terminar</button>
                    : <button onClick={() => setStatus("setup")} className={`${big} bg-slate-800 text-sm`}>Salir del ensayo</button>}
                </div>
              </>
            )}
            {status === "ended" && <p className="rounded-2xl bg-slate-900 p-4 text-sm text-slate-300">La transmisión terminó. El marcador quedó guardado en el torneo.</p>}
          </div>
        </div>
      </div>

      {picker && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 sm:items-center" role="dialog" aria-modal="true" aria-label="Elegir">
          <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl bg-slate-900 p-4">
            {picker.step === "team" && (
              <>
                <p className="mb-3 font-bold">¿De qué equipo?</p>
                <div className="grid grid-cols-2 gap-2">
                  {(["home", "away"] as const).map((side) => (
                    <button key={side} className={big} style={{ background: side === "home" ? hc : ac }}
                      onClick={() => {
                        const ev = addEvent(picker.kind === "sub" ? { kind: "sub", side } : { kind: picker.kind as "yellow" | "red", side });
                        setPicker({ kind: picker.kind, side, eventId: ev.id, step: picker.kind === "sub" ? "player" : "player" });
                      }}>
                      {side === "home" ? homeName : awayName}
                    </button>
                  ))}
                </div>
              </>
            )}
            {picker.step !== "team" && picker.side && picker.eventId && (
              <>
                <p className="mb-1 font-bold">
                  {picker.kind === "goal" ? "¿Quién anotó?" : picker.kind === "sub" ? (picker.step === "in" ? "¿Quién entra?" : "¿Quién sale?") : "¿Qué jugador?"}
                </p>
                <p className="mb-3 text-xs text-slate-400">{picker.kind === "goal" ? "La animación ya está en pantalla; esto agrega el nombre." : "Opcional."}</p>
                <div className="grid grid-cols-2 gap-2">
                  {teamPlayers(picker.side).map((pl) => (
                    <button key={pl.id} className="rounded-xl bg-slate-800 px-3 py-3 text-left text-sm font-semibold active:bg-slate-700"
                      onClick={() => {
                        const field = picker.kind === "sub" ? (picker.step === "in" ? "playerIn" : "playerOut") : "player";
                        setEventPlayer(picker.eventId!, pl, field);
                        if (picker.kind === "sub" && picker.step === "player") setPicker({ ...picker, step: "in" }); else setPicker(null);
                      }}>
                      {pl.number != null && <span className="mr-1 text-slate-400">{pl.number}</span>}{pl.name}
                    </button>
                  ))}
                </div>
                {teamPlayers(picker.side).length === 0 && <p className="text-sm text-slate-400">Este equipo no tiene plantilla cargada.</p>}
                <button onClick={() => setPicker(null)} className="mt-3 w-full rounded-xl bg-slate-700 py-3 text-sm font-semibold">Omitir</button>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
