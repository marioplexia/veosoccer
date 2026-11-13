"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Room } from "livekit-client";
import type { BrandSettings } from "@/lib/brand";
import { DURATIONS, GOAL_SECONDS, direct, liveScore, scorersOf, matchClock, matchMinute, type DirectorState, type FullScene, type LiveEvent, type Phase, type Shot, type Side } from "@/lib/director";
import { buildBroadcastData, buildLineups } from "@/lib/broadcast-data";
import { renderBroadcastFrame } from "@/lib/motion/broadcast-frame";
import type { MatchData, SceneInput } from "@/lib/motion/scenes";
import { drawStadium } from "@/lib/motion/stadium";
import { FrameRing, SegmentUploader, baseMime, encodeClip, extOf, pickVideoMime, replayFrameIndex, type Segment } from "@/lib/live-video";
import { useBroadcastImages } from "./useBroadcastImages";
import { createClient } from "@/lib/supabase/client";
import type { Fixture, Player, Sponsor, Team } from "@/lib/types";
import { useGoogleFonts } from "@/components/brand/useGoogleFonts";

const W = 1280, H = 720;
type Status = "setup" | "connecting" | "live" | "grabando" | "ensayo" | "ended";

type Ev = LiveEvent & { id: string; goalRowId?: string };
type Picker = { kind: "goal" | "yellow" | "red" | "foul" | "sub"; side?: Side; eventId?: string; step: "team" | "player" | "in" };

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
  const [showPad, setShowPad] = useState(true);
  // Grabación en el dispositivo (en lugar de transmitir): se guarda por partes para no llenar la memoria.
  const segStartRef = useRef(0);
  const recRef = useRef<{ rec: MediaRecorder; chunks: Blob[]; type: string; part: number; stream: MediaStream } | null>(null);
  const [savedParts, setSavedParts] = useState(0);
  // Grabación en la nube: un segmento cada 30 s, subido en segundo plano.
  const cloudRef = useRef<{ id: string; idx: number; uploader: SegmentUploader; timer: ReturnType<typeof setInterval> } | null>(null);
  const [cloud, setCloud] = useState<{ uploaded: number; pending: number; failed: boolean } | null>(null);
  // Repetición y clips: últimos segundos de la cámara en imágenes pequeñas.
  const ringRef = useRef(new FrameRing(24_000));
  const replayRef = useRef<{ bitmaps: ImageBitmap[]; times: number[]; startedAt: number; speed: number } | null>(null);
  const [replaying, setReplaying] = useState(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clipByEvent = useRef(new Map<string, { id: string; path: string } | "pending" | "cancelled">());
  const clipQueue = useRef<Promise<void>>(Promise.resolve());
  const [clipsSaved, setClipsSaved] = useState(0);
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
    if (status !== "live" && status !== "ensayo" && status !== "grabando") return;
    let lock: { release: () => Promise<void> } | null = null;
    (navigator as unknown as { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request("screen").then((l) => { lock = l; }).catch(() => undefined);
    return () => { lock?.release().catch(() => undefined); };
  }, [status]);

  const score = liveScore(base, events);
  const directorState: DirectorState = {
    phase, phaseStartedAt, events, sponsors: p.sponsors.length, adEveryMinutes: p.adEveryMinutes,
    lineups: { home: p.players.some((x) => x.team_id === p.fixture.home_team_id), away: p.players.some((x) => x.team_id === p.fixture.away_team_id) },
    names: { home: p.teams.find((t) => t.id === p.fixture.home_team_id)?.name ?? "Local", away: p.teams.find((t) => t.id === p.fixture.away_team_id)?.name ?? "Visitante" },
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
          const R = replayRef.current;
          const ri = R ? replayFrameIndex(R.times, t - R.startedAt, R.speed) : -1;
          if (R && ri < 0) { R.bitmaps.forEach((b) => b.close()); replayRef.current = null; setReplaying(false); }
          if (R && ri >= 0) {
            // Repetición: se ve la jugada grabada (algo más lenta) con su distintivo.
            const b = R.bitmaps[ri];
            const k = Math.max(W / b.width, H / b.height);
            c2.drawImage(b, (W - b.width * k) / 2, (H - b.height * k) / 2, b.width * k, b.height * k);
            const bw = 250, bh = 46, bx = (W - bw) / 2, by = 34; // arriba al centro: libre del marcador y de los controles
            c2.fillStyle = "rgba(55,0,60,.92)"; c2.fillRect(bx, by, bw, bh);
            c2.fillStyle = "#FFFFFF"; c2.fillRect(bx, by, 8, bh);
            c2.font = `800 24px "${p.brand.fonts.heading.family}", system-ui, sans-serif`; c2.textAlign = "center"; c2.textBaseline = "middle";
            c2.fillText("REPETICIÓN", bx + bw / 2 + 4, by + bh / 2 + 1);
          } else if (v && v.readyState >= 2 && v.videoWidth) {
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
      setShotLabel(replayRef.current && !sh.full ? "Repetición de la jugada" : sh.full ? SCENE_LABEL[sh.full.scene] : sh.goal ? "Cámara · animación de gol" : sh.lower ? "Cámara · rótulo" : sh.sponsor ? "Cámara · patrocinador" : sh.scoreboard ? "Cámara + marcador" : "Cámara");
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

  /* ───── repetición y clips ───── */
  // Guarda ~24 s de cámara a 15 cuadros por segundo en imágenes pequeñas (unos pocos MB).
  useEffect(() => {
    if (!camReady || (status !== "live" && status !== "grabando" && status !== "ensayo")) return;
    const ring = ringRef.current;
    const small = document.createElement("canvas");
    small.width = 640; small.height = 360;
    const sctx = small.getContext("2d");
    let busy = false;
    const id = setInterval(() => {
      const v = videoRef.current;
      if (busy || !sctx || !v || v.readyState < 2 || !v.videoWidth || replayRef.current) return;
      busy = true;
      const k = Math.max(640 / v.videoWidth, 360 / v.videoHeight);
      sctx.drawImage(v, (640 - v.videoWidth * k) / 2, (360 - v.videoHeight * k) / 2, v.videoWidth * k, v.videoHeight * k);
      const t = Date.now();
      small.toBlob((blob) => { busy = false; if (blob) ring.push({ t, blob }); }, "image/jpeg", 0.62);
    }, 66);
    return () => { clearInterval(id); ring.clear(); };
  }, [camReady, status]);
  useEffect(() => () => { timersRef.current.forEach(clearTimeout); replayRef.current?.bitmaps.forEach((b) => b.close()); }, []);

  /** Repite en pantalla lo ocurrido entre `from` y `to` (ms). Sale al aire: se dibuja en el mismo lienzo. */
  const startReplay = useCallback(async (from: number, to: number) => {
    if (replayRef.current) return;
    const frames = ringRef.current.window(from, to);
    if (frames.length < 10) { setError("Aún no hay suficiente video para la repetición. Espera unos segundos."); return; }
    const bitmaps = (await Promise.all(frames.map((f) => createImageBitmap(f.blob).catch(() => null)))).filter((b): b is ImageBitmap => !!b);
    if (bitmaps.length < 10) return;
    replayRef.current = { bitmaps, times: frames.slice(0, bitmaps.length).map((f) => f.t), startedAt: Date.now(), speed: 0.7 };
    setReplaying(true);
  }, []);
  const replayNow = () => { const t = Date.now(); void startReplay(t - 10_000, t); };

  /** Tras un gol: repetición automática al terminar la animación y, si se transmite o se graba, un clip guardado en la nube. */
  function afterGoal(ev: Ev) {
    const at = ev.at;
    timersRef.current.push(setTimeout(() => { void startReplay(at - 9000, at + 1500); }, GOAL_SECONDS * 1000 + 300));
    if (status !== "live" && status !== "grabando") return;
    clipByEvent.current.set(ev.id, "pending");
    timersRef.current.push(setTimeout(() => {
      const frames = ringRef.current.window(at - 11_000, at + 3200);
      const team = ev.side === "home" ? matchData.home : matchData.away;
      clipQueue.current = clipQueue.current.then(async () => {
        if (clipByEvent.current.get(ev.id) === "cancelled") return;
        const clip = await encodeClip(frames, { w: 640, h: 360, label: `GOL · ${team} · ${ev.minute}'` });
        if (!clip || clipByEvent.current.get(ev.id) === "cancelled") return;
        const id = crypto.randomUUID();
        const path = `${p.tournament.id}/${p.fixture.id}/clips/${id}.${extOf(clip.mime)}`;
        const up = await supabase.storage.from("match-video").upload(path, clip.blob, { contentType: clip.mime });
        if (up.error) return;
        const { error } = await supabase.from("match_clips").insert({ id, tournament_id: p.tournament.id, fixture_id: p.fixture.id, side: ev.side, minute: ev.minute, path, mime: clip.mime });
        if (error) { await supabase.storage.from("match-video").remove([path]); return; }
        if (clipByEvent.current.get(ev.id) === "cancelled") { await supabase.from("match_clips").delete().eq("id", id); await supabase.storage.from("match-video").remove([path]); return; }
        clipByEvent.current.set(ev.id, { id, path });
        setClipsSaved((n) => n + 1);
      }).catch(() => undefined);
    }, 3400));
  }

  /* ───── grabar en la nube (por segmentos) ───── */
  async function endSegment(): Promise<{ blob: Blob; type: string; part: number } | null> {
    const R = recRef.current;
    if (!R) return null;
    recRef.current = null;
    await new Promise<void>((res) => { R.rec.onstop = () => res(); try { R.rec.stop(); } catch { res(); } });
    R.stream.getVideoTracks().forEach((t) => t.stop());
    return R.chunks.length ? { blob: new Blob(R.chunks, { type: baseMime(R.type) }), type: R.type, part: R.part } : null;
  }
  async function rotateSegment(last = false) {
    const C = cloudRef.current, old = recRef.current;
    if (!C || !old) return;
    const startedAt = segStartRef.current;
    recRef.current = null;
    if (!last) startRecorder(C.idx + 1); // el siguiente empieza antes de cerrar el anterior, para no dejar hueco
    const now = Date.now();
    segStartRef.current = now;
    await new Promise<void>((res) => { old.rec.onstop = () => res(); try { old.rec.stop(); } catch { res(); } });
    old.stream.getVideoTracks().forEach((t) => t.stop());
    if (old.chunks.length) C.uploader.add({ idx: C.idx, blob: new Blob(old.chunks, { type: baseMime(old.type) }), durationMs: Math.min(600_000, now - startedAt) });
    C.idx += 1;
  }
  async function startCloudRecording() {
    setError(null);
    const type = pickVideoMime();
    if (!type) { setError("Este navegador no puede grabar video. Prueba con Chrome o Safari actualizados."); return; }
    const mime = baseMime(type);
    const { data, error } = await supabase.from("recordings").insert({ tournament_id: p.tournament.id, fixture_id: p.fixture.id, mime }).select("id").single();
    if (error || !data) { setError("No se pudo iniciar la grabación en la nube (revisa tu conexión). Puedes grabar solo en este dispositivo."); return; }
    const recId = data.id as string;
    const sync = () => { const C = cloudRef.current; if (C) setCloud({ uploaded: C.uploader.uploaded, pending: C.uploader.pending, failed: C.uploader.failedOnce && C.uploader.pending > 0 }); };
    const uploader = new SegmentUploader(async (seg: Segment) => {
      const path = `${p.tournament.id}/${p.fixture.id}/rec/${recId}/${String(seg.idx).padStart(4, "0")}.${extOf(mime)}`;
      const up = await supabase.storage.from("match-video").upload(path, seg.blob, { contentType: mime, upsert: true });
      if (up.error) return false;
      const row = await supabase.from("recording_segments").upsert({ recording_id: recId, idx: seg.idx, path, duration_ms: seg.durationMs });
      return !row.error;
    }, sync);
    if (!startRecorder(0)) return;
    segStartRef.current = Date.now();
    cloudRef.current = { id: recId, idx: 0, uploader, timer: setInterval(() => { void rotateSegment(); }, 30_000) };
    setCloud({ uploaded: 0, pending: 0, failed: false });
    setSavedParts(0);
    setOnAirSince(Date.now());
    setStatus("grabando");
  }
  async function stopCloudRecording() {
    const C = cloudRef.current;
    if (!C || !window.confirm("¿Terminar la grabación? Se subirá lo que falte a tu cuenta.")) return;
    clearInterval(C.timer);
    await rotateSegment(true);
    setStatus("ended");
    const ok = await C.uploader.flush();
    if (ok) await supabase.from("recordings").update({ status: "complete" }).eq("id", C.id);
    setCloud({ uploaded: C.uploader.uploaded, pending: C.uploader.pending, failed: !ok });
  }
  async function retryUploads() {
    const C = cloudRef.current;
    if (!C) return;
    setCloud((c) => (c ? { ...c, failed: false } : c));
    const ok = await C.uploader.flush();
    if (ok && status === "ended") await supabase.from("recordings").update({ status: "complete" }).eq("id", C.id);
    setCloud({ uploaded: C.uploader.uploaded, pending: C.uploader.pending, failed: !ok });
  }
  useEffect(() => () => { if (cloudRef.current) clearInterval(cloudRef.current.timer); }, []);

  /* ───── grabar en el dispositivo ───── */
  function startRecorder(part: number): boolean {
    const canvas = canvasRef.current;
    const type = pickVideoMime();
    if (!canvas || !type) { setError("Este navegador no puede grabar video. Prueba con Chrome o Safari actualizados."); return false; }
    const stream = new MediaStream([...canvas.captureStream(30).getVideoTracks(), ...(streamRef.current?.getAudioTracks() ?? [])]);
    const rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: cloudRef.current || part === 0 ? 1_500_000 : 2_500_000, audioBitsPerSecond: 96_000 });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    rec.start(2000);
    recRef.current = { rec, chunks, type, part, stream };
    return true;
  }
  /** Cierra la parte en curso y la descarga. Hay que llamarla desde un toque del usuario (el navegador lo exige para descargar). */
  async function savePart() {
    const seg = await endSegment();
    if (!seg) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(seg.blob);
    const slug = (x: string) => x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
    a.download = `${slug(matchData.home)}-vs-${slug(matchData.away)}-parte-${seg.part}.${extOf(seg.type)}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
    setSavedParts((n) => n + 1);
  }
  function startRecording() {
    setError(null);
    if (!startRecorder(1)) return;
    setSavedParts(0);
    setOnAirSince(Date.now());
    setStatus("grabando");
  }
  async function stopRecording() {
    if (!window.confirm("¿Terminar la grabación? El video se guardará en este dispositivo.")) return;
    await savePart();
    setStatus("ended");
  }
  // Avisar antes de cerrar la pestaña con una grabación sin guardar.
  useEffect(() => {
    if (status !== "grabando" && !(cloud && cloud.pending > 0)) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [status, cloud]);

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
    afterGoal(ev);
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
      // El clip de ese gol tampoco debe quedar guardado.
      const clip = clipByEvent.current.get(last.id);
      clipByEvent.current.set(last.id, "cancelled");
      if (clip && typeof clip === "object") {
        await supabase.from("match_clips").delete().eq("id", clip.id);
        await supabase.storage.from("match-video").remove([clip.path]);
        setClipsSaved((n) => Math.max(0, n - 1));
      }
    }
  }

  function advancePhase() {
    const to = NEXT_PHASE[phase].to;
    if (!to) return;
    if (to === "final" && !window.confirm("¿Terminar el partido? Se mostrará el resultado final.")) return;
    setPhase(to);
    setPhaseStartedAt(Date.now());
    if (to === "1T") saveScore(score);
    // Al medio tiempo se guarda la primera parte y se sigue grabando en otra, para no acumular todo el partido en memoria.
    if (to === "descanso" && recRef.current && !cloudRef.current) { const next = recRef.current.part + 1; savePart().then(() => { startRecorder(next); }); }
  }

  const teamPlayers = (side: Side) => p.players.filter((x) => x.team_id === (side === "home" ? p.fixture.home_team_id : p.fixture.away_team_id));
  const clock = matchClock(phase, phaseStartedAt, now);
  const inPlay = phase === "1T" || phase === "2T";
  const onAir = status === "live" || status === "ensayo" || status === "grabando";
  const hc = matchData.homeColor, ac = matchData.awayColor;
  const homeName = matchData.home, awayName = matchData.away;
  const big = "rounded-2xl px-4 py-4 text-lg font-extrabold shadow-sm active:scale-[.98] disabled:opacity-40";
  const manualOn = manual && now - manual.at < DURATIONS[manual.scene] * 1000 ? manual.scene : null;
  const pad = "rounded-xl font-extrabold text-white shadow-lg backdrop-blur-sm transition active:scale-95 disabled:opacity-35";
  const ctl = "grid h-10 min-w-10 place-items-center rounded-lg bg-white/10 px-2.5 text-sm font-semibold backdrop-blur transition hover:bg-white/20 disabled:opacity-40";
  const toggleFullscreen = () => {
    const el = playerRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined); else el.requestFullscreen?.().catch(() => undefined);
  };
  const statusPill = status === "live" ? { text: "● EN VIVO", cls: "bg-red-600" } : status === "grabando" ? { text: "● GRABANDO", cls: "bg-red-600" } : status === "ensayo" ? { text: "ENSAYO", cls: "bg-amber-500 text-slate-950" }
    : status === "connecting" ? { text: "CONECTANDO…", cls: "bg-white/20" } : status === "ended" ? { text: "TERMINADA", cls: "bg-white/20" } : { text: "VISTA PREVIA", cls: "bg-white/20" };

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-[1440px] p-3 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <Link href={`/panel/torneos/${p.tournament.id}`} className="text-sm text-slate-300 hover:text-white">← Volver al torneo</Link>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${status === "live" || status === "grabando" ? "bg-red-600" : status === "ensayo" ? "bg-amber-500 text-slate-950" : "bg-slate-700"}`}>
            {status === "live" ? "● EN VIVO EN FACEBOOK" : status === "grabando" ? (cloud ? "● GRABANDO EN LA NUBE" : "● GRABANDO EN ESTE DISPOSITIVO") : status === "ensayo" ? "ENSAYO · no sale al aire" : status === "connecting" ? "Conectando…" : status === "ended" ? "Transmisión terminada" : "Preparando"}
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
                {(status === "live" || status === "grabando") && onAirSince && <span className="rounded-md bg-black/60 px-2 py-1 font-mono tabular-nums">{hms(now - onAirSince)}</span>}
                <span className={`rounded-md px-2.5 py-1 ${onAir ? statusPill.cls : "bg-black/60"}`}>{statusPill.text}</span>
                <span className="rounded-md bg-black/60 px-2 py-1 font-medium">720p · 30 fps</span>
              </div>
              {/* botonera del partido dentro del monitor (no sale en el video: solo la ve quien opera) */}
              {onAir && showPad && (
                <>
                  {/* a los lados, para no tapar el centro de la imagen ni los rótulos */}
                  <div className="absolute left-2 top-1/2 z-10 flex w-[5.2rem] -translate-y-1/2 flex-col gap-1.5 sm:w-28">
                    <button onClick={() => goal("home")} disabled={!inPlay} className={`${pad} px-2 py-3 text-sm sm:py-5 sm:text-lg`} style={{ background: `${hc}E6` }}>⚽ GOL<br /><span className="block truncate text-[11px] font-bold sm:text-sm">{homeName}</span></button>
                    <button onClick={() => setPicker({ kind: "yellow", step: "team" })} disabled={!inPlay} className={`${pad} bg-yellow-400/95 px-2 py-2 text-xs text-slate-950 sm:text-sm`}>🟨 Amarilla</button>
                    <button onClick={() => setPicker({ kind: "red", step: "team" })} disabled={!inPlay} className={`${pad} bg-red-600/95 px-2 py-2 text-xs sm:text-sm`}>🟥 Roja</button>
                  </div>
                  <div className="absolute right-2 top-1/2 z-10 flex w-[5.2rem] -translate-y-1/2 flex-col gap-1.5 sm:w-28">
                    <button onClick={() => goal("away")} disabled={!inPlay} className={`${pad} px-2 py-3 text-sm sm:py-5 sm:text-lg`} style={{ background: `${ac}E6` }}>⚽ GOL<br /><span className="block truncate text-[11px] font-bold sm:text-sm">{awayName}</span></button>
                    <button onClick={() => setPicker({ kind: "foul", step: "team" })} disabled={!inPlay} className={`${pad} bg-orange-500/95 px-2 py-2 text-xs sm:text-sm`}>✋ Falta</button>
                    <button onClick={() => setPicker({ kind: "sub", step: "team" })} disabled={!inPlay} className={`${pad} bg-sky-600/95 px-2 py-2 text-xs sm:text-sm`}>🔁 Cambio</button>
                  </div>
                </>
              )}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap items-center gap-2 bg-gradient-to-t from-black/85 via-black/50 to-transparent px-3 pb-3 pt-8 [&>*]:pointer-events-auto">
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
                {onAir && <button onClick={replayNow} disabled={replaying || !camReady} className={ctl} title="Repetir los últimos 10 segundos">⏪ <span className="ml-1 hidden sm:inline">Repetición</span></button>}
                {onAir && NEXT_PHASE[phase].to && <button onClick={advancePhase} className={`${ctl} bg-white! text-slate-950`}>{NEXT_PHASE[phase].label}</button>}
                {onAir && <button onClick={undo} disabled={events.length === 0} className={ctl} aria-label="Deshacer el último evento" title="Deshacer el último evento">↶</button>}
                {onAir && <button onClick={() => setShowPad((v) => !v)} className={ctl} aria-pressed={showPad} aria-label={showPad ? "Ocultar botones del partido" : "Mostrar botones del partido"} title={showPad ? "Ocultar botones del partido" : "Mostrar botones del partido"}>{showPad ? "🎛️" : "👁️"}</button>}
                <button onClick={toggleFullscreen} className={ctl} aria-label="Pantalla completa" title="Pantalla completa">⛶</button>
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
                                const ev = addEvent(picker.kind === "sub" ? { kind: "sub", side } : { kind: picker.kind as "yellow" | "red" | "foul", side });
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
                <button onClick={startCloudRecording} disabled={!camReady} className={`${big} w-full bg-white text-base text-slate-900`}>⏺ Grabar el partido en la nube</button>
                <p className="text-xs text-slate-400">Sin Facebook. El video se sube a tu cuenta cada 30 segundos y queda en la ficha del partido, con un clip de cada gol.</p>
                <button onClick={startRecording} disabled={!camReady} className={`${big} w-full bg-slate-700 text-base`}>Grabar solo en este dispositivo</button>
                <button onClick={() => setStatus("ensayo")} className={`${big} w-full bg-slate-700 text-base`}>Ensayar sin transmitir</button>
              </div>
            )}

            {onAir && (
              <>
                <p className="rounded-2xl bg-slate-900 p-4 text-sm text-slate-300">Los botones de gol, tarjetas, falta y cambio están dentro del monitor, para usarlos también en pantalla completa. {inPlay ? "" : "Se activan al iniciar el tiempo."}</p>
                {NEXT_PHASE[phase].to && <button onClick={advancePhase} className={`${big} w-full bg-white text-slate-900`}>{NEXT_PHASE[phase].label}</button>}
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={undo} disabled={events.length === 0} className={`${big} bg-slate-800 text-sm`}>↶ Deshacer</button>
                  {status === "live"
                    ? <button onClick={endBroadcast} className={`${big} bg-slate-800 text-sm text-red-300`}>■ Terminar</button>
                    : status === "grabando"
                    ? <button onClick={cloud ? stopCloudRecording : stopRecording} className={`${big} bg-slate-800 text-sm text-red-300`}>■ Terminar y guardar</button>
                    : <button onClick={() => setStatus("setup")} className={`${big} bg-slate-800 text-sm`}>Salir del ensayo</button>}
                </div>
              </>
            )}
            {cloud && (status === "grabando" || status === "ended") && (
              <div className="rounded-2xl bg-slate-900 p-3 text-xs text-slate-300" role="status">
                <p>☁️ En la nube: <b className="text-white">{cloud.uploaded}</b> {cloud.uploaded === 1 ? "segmento subido" : "segmentos subidos"}{cloud.pending > 0 ? ` · ${cloud.pending} por subir` : status === "ended" ? " · grabación completa" : ""}</p>
                {cloud.failed && (
                  <div className="mt-2">
                    <p className="text-amber-300">No se pudo subir todo (¿sin señal?). No cierres esta pestaña: lo pendiente sigue guardado aquí.</p>
                    <button onClick={retryUploads} className="mt-2 rounded-lg bg-white px-3 py-1.5 font-semibold text-slate-900">Reintentar subida</button>
                  </div>
                )}
              </div>
            )}
            {clipsSaved > 0 && <p className="rounded-2xl bg-slate-900 p-3 text-xs text-slate-300">🎬 {clipsSaved} {clipsSaved === 1 ? "clip de gol guardado" : "clips de gol guardados"} en la ficha del partido.</p>}
            {status === "grabando" && savedParts > 0 && <p className="rounded-2xl bg-slate-900 p-3 text-xs text-slate-300">Parte {savedParts} guardada en tus descargas. Sigue grabando la parte {savedParts + 1}.</p>}
            {status === "ended" && <p className="rounded-2xl bg-slate-900 p-4 text-sm text-slate-300">{cloud ? (cloud.pending === 0 ? "La grabación terminó y quedó guardada en la ficha del partido. " : "La grabación terminó; falta subir una parte. ") : savedParts > 0 ? `La grabación terminó: ${savedParts} ${savedParts === 1 ? "archivo guardado" : "archivos guardados"} en las descargas de este dispositivo. ` : "La transmisión terminó. "}El marcador quedó guardado en el torneo.</p>}
          </div>
        </div>
      </div>

    </main>
  );
}
