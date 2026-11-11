"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BrandKind, BrandSettings } from "@/lib/brand";
import { DEFAULT_MATCH, FORMATIONS, FORMATS, TEMPLATES, drawScene, parseFormation, resolveTeamColors, templateById, type FieldKey, type FormatId, type MatchData, type SceneId, type SceneImage } from "@/lib/motion/scenes";
import { btnGhost, btnPrimary, Card, ErrorMsg, inputCls } from "@/components/ui";
import { useGoogleFonts } from "./useGoogleFonts";
import { mediaUrl } from "@/lib/media";
import { createClient } from "@/lib/supabase/client";
import type { Division, Fixture, Player, Team } from "@/lib/types";
import { computeStandings } from "@/lib/standings";

export type MatchOption = { id: string; label: string; home: string; away: string; homeScore: number; awayScore: number; homeTeamId?: string; awayTeamId?: string };

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

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_IMAGE = 8 * 1024 * 1024;
type LocalImage = SceneImage & { url: string };

/** Botón para elegir una imagen del dispositivo (no se sube a ningún servidor). */
function ImageButton({ text, has, onPick, onClear }: { text: string; has: boolean; onPick: (f: File) => void; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1">
      <label className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm font-medium ${has ? "border-emerald-600 bg-emerald-50 text-emerald-800" : "border-slate-300 text-slate-700 hover:bg-slate-50"}`}>
        {has ? "✓ " : ""}{text}
        <input type="file" accept={IMAGE_TYPES.join(",")} className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = ""; }} />
      </label>
      {has && <button type="button" onClick={onClear} aria-label={`Quitar ${text}`} className="rounded-full px-1.5 text-slate-400 hover:text-red-600">✕</button>}
    </span>
  );
}

export default function MotionStudio({
  kind, settings, logoUrl, tournamentName, matches, teams = [], players = [], fixtures = [], divisions = [], palette,
}: { kind: BrandKind; settings: BrandSettings; logoUrl: string | null; tournamentName: string; matches: MatchOption[]; teams?: Team[]; players?: Player[]; fixtures?: Fixture[]; divisions?: Division[]; palette?: string[] }) {
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
  const [images, setImages] = useState<Record<string, LocalImage>>({});
  const imagesRef = useRef(images);
  imagesRef.current = images;
  const revoke = (u: string) => { if (u.startsWith("blob:")) URL.revokeObjectURL(u); };
  useEffect(() => () => { Object.values(imagesRef.current).forEach((x) => revoke(x.url)); }, []);

  function pickImage(key: string, file: File) {
    setError(null);
    if (!IMAGE_TYPES.includes(file.type)) return setError("La imagen debe ser PNG, JPG o WebP.");
    if (file.size > MAX_IMAGE) return setError("La imagen no puede pesar más de 8 MB.");
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => setImages((m) => { if (m[key]) revoke(m[key].url); return { ...m, [key]: { url, img, w: img.naturalWidth, h: img.naturalHeight } }; });
    img.onerror = () => { URL.revokeObjectURL(url); setError("No se pudo leer esa imagen."); };
    img.src = url;
  }
  const clearImage = (key: string) => setImages((m) => { if (!m[key]) return m; revoke(m[key].url); const n = { ...m }; delete n[key]; return n; });

  // Imágenes guardadas en el torneo (escudos y fotos). crossOrigin para poder grabar el canvas.
  const supabase = useMemo(() => createClient(), []);
  function loadRemote(key: string, path: string | null | undefined) {
    const url = mediaUrl(supabase, path);
    if (!url) { clearImage(key); return; }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => setImages((m) => { if (m[key]) revoke(m[key].url); return { ...m, [key]: { url, img, w: img.naturalWidth, h: img.naturalHeight } }; });
    img.onerror = () => setError("No se pudo cargar una imagen guardada del torneo.");
    img.src = url;
  }
  const teamById = (tid: string | undefined) => teams.find((x) => x.id === tid);
  function applyTeam(side: "home" | "away", tid: string) {
    const tm = teamById(tid);
    if (!tm) return;
    set(side, tm.name);
    loadRemote(side === "home" ? "homeLogo" : "awayLogo", tm.logo_path);
  }
  function applyPlayerAward(pid: string) {
    const pl = players.find((x) => x.id === pid);
    if (!pl) return;
    set("player", pl.name);
    loadRemote("photo", pl.photo_path);
    loadRemote("teamLogo", teamById(pl.team_id)?.logo_path);
  }
  function applyPlayerCard(k: number, pid: string) {
    const pl = players.find((x) => x.id === pid);
    if (!pl) return;
    setData((d) => ({ ...d, players: d.players.map((x, j) => (j === k ? { ...x, name: pl.name } : x)) }));
    loadRemote(`p${k}`, pl.photo_path);
  }
  // Tablas: jornadas disponibles (por división) y tabla de posiciones calculada.
  const multiDiv = divisions.length > 1;
  const divName = (id: string) => divisions.find((d) => d.id === id)?.name ?? "";
  const roundOptions = [...new Map(fixtures.map((f) => [`${f.division_id}|${f.round}`, f])).values()]
    .sort((a, b) => (divisions.findIndex((d) => d.id === a.division_id) - divisions.findIndex((d) => d.id === b.division_id)) || a.round - b.round)
    .map((f) => ({ key: `${f.division_id}|${f.round}`, label: `${multiDiv ? `${divName(f.division_id)} · ` : ""}Jornada ${f.round}` }));
  const crestKey = (tid: string) => `crest:${tid}`;
  function loadCrests(ids: string[]) {
    for (const tid of new Set(ids)) { const tm = teamById(tid); if (tm?.logo_path) loadRemote(crestKey(tid), tm.logo_path); }
  }
  function applyBugTeams(div: string) {
    const tms = teams.filter((x) => div === "all" || x.division_id === div).slice(0, 12);
    setData((d) => ({ ...d, bugTeams: tms.map((tm) => ({ name: tm.name, ...resolveTeamColors(tm.name, tm.color ?? "", tm.color2 ?? ""), crest: crestKey(tm.id) })) }));
    loadCrests(tms.map((tm) => tm.id));
  }
  function applyRound(key: string) {
    const [div, round] = key.split("|");
    const fx = fixtures.filter((f) => f.division_id === div && f.round === Number(round))
      .sort((a, b) => (a.kickoff ?? "").localeCompare(b.kickoff ?? ""));
    const nm = (tid: string) => teamById(tid)?.name ?? "?";
    setData((d) => ({
      ...d,
      tableTitle: `${multiDiv ? `${divName(div)} · ` : ""}Jornada ${round}`,
      results: fx.map((f) => ({
        home: nm(f.home_team_id), away: nm(f.away_team_id), homeScore: f.home_score, awayScore: f.away_score,
        homeCrest: crestKey(f.home_team_id), awayCrest: crestKey(f.away_team_id),
      })),
    }));
    loadCrests(fx.flatMap((f) => [f.home_team_id, f.away_team_id]));
  }
  function applyStandings(div: string) {
    const tms = teams.filter((x) => x.division_id === div);
    const rows = computeStandings(tms, fixtures.filter((f) => f.division_id === div));
    setData((d) => ({
      ...d,
      tableTitle: multiDiv ? `Tabla · ${divName(div)}` : "Tabla de posiciones",
      standings: rows.map((r, k) => ({ pos: k + 1, team: r.name, played: r.played, gd: r.gd, points: r.points, crest: crestKey(r.teamId) })),
    }));
    loadCrests(rows.map((r) => r.teamId));
  }

  const playerLabel = (pl: Player) => `${pl.number != null ? `${pl.number} · ` : ""}${pl.name} — ${teamById(pl.team_id)?.name ?? ""}`;
  const playerSelect = (aria: string, onPick: (id: string) => void, cls = "") => players.length > 0 && (
    <select aria-label={aria} className={`${inputCls} ${cls}`} value="" onChange={(e) => { if (e.target.value) onPick(e.target.value); }}>
      <option value="">{aria}…</option>
      {teams.filter((tm) => players.some((pl) => pl.team_id === tm.id)).map((tm) => (
        <optgroup key={tm.id} label={tm.name}>
          {players.filter((pl) => pl.team_id === tm.id).map((pl) => <option key={pl.id} value={pl.id}>{playerLabel(pl)}</option>)}
        </optgroup>
      ))}
    </select>
  );
  const imgBtn = (key: string, text: string) => <ImageButton text={text} has={!!images[key]} onPick={(f) => pickImage(key, f)} onClear={() => clearImage(key)} />;

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
  const live = useRef({ id, w, h, kind, settings, logo, tournamentName, data, images, palette });
  live.current = { id, w, h, kind, settings, logo, tournamentName, data, images, palette };

  const render = useCallback((time: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const L = live.current;
    drawScene(ctx, L.id, {
      w: L.w, h: L.h, t: time, kind: L.kind, colors: L.settings.colors, fonts: L.settings.fonts,
      logo: L.logo?.img ?? null, logoSize: L.logo ? { w: L.logo.w, h: L.logo.h } : null,
      tournamentName: L.tournamentName, data: L.data, images: L.images, palette: L.palette,
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
  }, [playing, exporting, id, format, tpl.duration, render, settings, data, logo, fontsTick, tournamentName, images]);

  useEffect(() => { if (!playing) render(Math.min(t, tpl.duration)); }, [t, playing, render, tpl.duration, images, data]);

  function chooseTemplate(next: SceneId) { setId(next); setT(0); setError(null); const f = templateById(next).format; if (f) setFormat(f); }
  const set = <K extends keyof MatchData>(k: K, v: MatchData[K]) => setData((d) => ({ ...d, [k]: v }));
  const num = (v: string, min: number, max: number) => Math.min(max, Math.max(min, Math.round(Number(v) || 0)));

  function pickMatch(mid: string) {
    const m = matches.find((x) => x.id === mid);
    if (!m) return;
    const th = teamById(m.homeTeamId), ta = teamById(m.awayTeamId);
    setData((d) => ({
      ...d, home: m.home, away: m.away, homeScore: m.homeScore, awayScore: m.awayScore,
      homeColor: th?.color ?? "", homeColor2: th?.color2 ?? "", awayColor: ta?.color ?? "", awayColor2: ta?.color2 ?? "",
    }));
    loadRemote("homeLogo", teamById(m.homeTeamId)?.logo_path);
    loadRemote("awayLogo", teamById(m.awayTeamId)?.logo_path);
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
    // Los carteles se exportan ya armados, aunque la vista previa vaya por el inicio.
    if (tpl.poster != null) { setPlaying(false); setT(tpl.poster); render(tpl.poster); }
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
          {(has("homeLogo") || has("awayLogo")) && teams.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {(["home", "away"] as const).map((side) => (
                <select key={side} aria-label={side === "home" ? "Elegir equipo local" : "Elegir equipo visitante"} className={inputCls} value="" onChange={(e) => applyTeam(side, e.target.value)}>
                  <option value="">{side === "home" ? "Equipo local…" : "Equipo visitante…"}</option>
                  {teams.map((tm) => <option key={tm.id} value={tm.id}>{tm.name}{tm.logo_path ? "" : " (sin escudo)"}</option>)}
                </select>
              ))}
            </div>
          )}
          {(has("homeLogo") || has("awayLogo")) && (
            <div className="flex flex-wrap gap-2">
              {has("homeLogo") && imgBtn("homeLogo", "Escudo local")}
              {has("awayLogo") && imgBtn("awayLogo", "Escudo visitante")}
            </div>
          )}
          {has("teamTitle") && <label className={label}>Título<input className={`${inputCls} mt-1`} value={data.teamTitle} maxLength={60} onChange={(e) => set("teamTitle", e.target.value)} /></label>}
          {has("awardTitle") && <label className={label}>Título<input className={`${inputCls} mt-1`} value={data.awardTitle} maxLength={60} onChange={(e) => set("awardTitle", e.target.value)} /></label>}
          {has("label") && <label className={label}>Etiqueta<input className={`${inputCls} mt-1`} value={data.label} maxLength={20} onChange={(e) => set("label", e.target.value)} /></label>}
          {has("player") && <label className={label}>Jugador<input className={`${inputCls} mt-1`} value={data.player} maxLength={40} onChange={(e) => set("player", e.target.value)} /></label>}
          {has("playerOut") && <label className={label}>Jugador que sale<input className={`${inputCls} mt-1`} value={data.playerOut} maxLength={40} onChange={(e) => set("playerOut", e.target.value)} /></label>}
          {has("playerIn") && <label className={label}>Jugador que entra<input className={`${inputCls} mt-1`} value={data.playerIn} maxLength={40} onChange={(e) => set("playerIn", e.target.value)} /></label>}
          {has("minute") && <label className={label}>Minuto<input type="number" min={0} max={150} className={`${inputCls} mt-1`} value={data.minute} onChange={(e) => set("minute", num(e.target.value, 0, 150))} /></label>}
          {has("round") && <label className={label}>Jornada<input type="number" min={1} max={99} className={`${inputCls} mt-1`} value={data.round} onChange={(e) => set("round", num(e.target.value, 1, 99))} /></label>}
          {has("subtitle") && <label className={label}>Texto (fecha u horario)<input className={`${inputCls} mt-1`} value={data.subtitle} maxLength={60} onChange={(e) => set("subtitle", e.target.value)} /></label>}
          {has("photo") && playerSelect("Elegir jugador del torneo", applyPlayerAward, "")}
          {(has("photo") || has("teamLogo")) && (
            <div className="flex flex-wrap gap-2">
              {has("photo") && imgBtn("photo", "Foto del jugador")}
              {has("teamLogo") && imgBtn("teamLogo", "Escudo del equipo")}
            </div>
          )}
          {has("formation") && (
            <label className={label}>Formación
              <select className={`${inputCls} mt-1`} value={data.formation} onChange={(e) => set("formation", e.target.value)}>
                {FORMATIONS.map((f) => <option key={f} value={f}>{f}{f.split("-").reduce((a, b) => a + Number(b), 0) < 10 ? " (fútbol 7)" : ""}</option>)}
              </select>
            </label>
          )}
          {has("players") && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-slate-700">Jugadores (el primero es el portero)</legend>
              {data.players.slice(0, 1 + parseFormation(data.formation).reduce((a, b) => a + b, 0)).map((p, k) => (
                <div key={k} className="flex items-center gap-2">
                  <input
                    type="color"
                    value={p.color}
                    onChange={(e) => set("players", data.players.map((x, j) => (j === k ? { ...x, color: e.target.value.toUpperCase() } : x)))}
                    aria-label={`Color de la tarjeta ${k + 1}`}
                    className="h-9 w-9 shrink-0 cursor-pointer rounded border border-slate-300 p-0.5"
                  />
                  <input
                    className={inputCls}
                    value={p.name}
                    maxLength={24}
                    onChange={(e) => set("players", data.players.map((x, j) => (j === k ? { ...x, name: e.target.value } : x)))}
                    aria-label={`Nombre del jugador ${k + 1}`}
                  />
                  {imgBtn(`p${k}`, "Foto")}
                  {playerSelect(`Elegir jugador ${k + 1}`, (pid) => applyPlayerCard(k, pid), "w-28! shrink-0")}
                </div>
              ))}
            </fieldset>
          )}
          {(has("homeLogo") || has("photo") || has("players")) && (
            <p className="text-xs text-slate-500">
              {teams.some((tm) => tm.logo_path) || players.length
                ? "Los escudos y fotos guardados en Equipos se cargan solos. Las imágenes que subas aquí solo se usan en esta pieza."
                : "Consejo: sube escudos y plantillas en la pestaña Equipos y aquí se cargarán solos."}
            </p>
          )}
          {has("teamColors") && (
            <div className="grid grid-cols-2 gap-3">
              {(["home", "away"] as const).map((side) => {
                const nm = side === "home" ? data.home : data.away;
                const c = resolveTeamColors(nm, side === "home" ? data.homeColor : data.awayColor, side === "home" ? data.homeColor2 : data.awayColor2);
                return (
                  <div key={side} className="text-sm font-medium text-slate-700">
                    Colores {side === "home" ? "local" : "visitante"}
                    <div className="mt-1 flex gap-2">
                      <input type="color" value={c.color} aria-label={`Color principal ${side === "home" ? "local" : "visitante"}`} className="h-9 w-12 cursor-pointer rounded border border-slate-300 p-0.5"
                        onChange={(e) => set(side === "home" ? "homeColor" : "awayColor", e.target.value.toUpperCase())} />
                      <input type="color" value={c.color2} aria-label={`Color secundario ${side === "home" ? "local" : "visitante"}`} className="h-9 w-12 cursor-pointer rounded border border-slate-300 p-0.5"
                        onChange={(e) => set(side === "home" ? "homeColor2" : "awayColor2", e.target.value.toUpperCase())} />
                    </div>
                  </div>
                );
              })}
              <p className="col-span-2 text-xs text-slate-500">Al elegir un partido se usan los colores y escudos guardados en Equipos.</p>
            </div>
          )}
          {has("bugTeamsPick") && (teams.length > 0 ? (
            <label className={label}>Equipos
              <select className={`${inputCls} mt-1`} defaultValue="" onChange={(e) => e.target.value && applyBugTeams(e.target.value)}>
                <option value="">Elegir…</option>
                {divisions.length > 1 && <option value="all">Todas las divisiones (máx. 12)</option>}
                {divisions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </label>
          ) : <p className="text-sm text-slate-500">Aún no hay equipos; se muestran marcadores de ejemplo.</p>)}
          {has("resultsPick") && (roundOptions.length > 0 ? (
            <label className={label}>Jornada del calendario
              <select className={`${inputCls} mt-1`} defaultValue="" onChange={(e) => e.target.value && applyRound(e.target.value)}>
                <option value="">Elegir jornada…</option>
                {roundOptions.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
            </label>
          ) : <p className="text-sm text-slate-500">Aún no hay partidos en el calendario; se muestran resultados de ejemplo.</p>)}
          {has("standingsPick") && (divisions.length > 0 && teams.length > 0 ? (
            <label className={label}>División
              <select className={`${inputCls} mt-1`} defaultValue="" onChange={(e) => e.target.value && applyStandings(e.target.value)}>
                <option value="">Elegir división…</option>
                {divisions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </label>
          ) : <p className="text-sm text-slate-500">Aún no hay equipos; se muestra una tabla de ejemplo.</p>)}
          {(has("resultsPick") || has("standingsPick")) && (
            <p className="text-xs text-slate-500">Caben hasta 20 renglones; con muchos, el texto se hace más pequeño.</p>
          )}
          {has("tableTitle") && <label className={label}>Título<input className={`${inputCls} mt-1`} value={data.tableTitle} maxLength={50} onChange={(e) => set("tableTitle", e.target.value)} /></label>}
          {has("background") && (
            <div className="space-y-1">
              <div className="flex flex-wrap gap-2">{imgBtn("background", "Foto de fondo")}</div>
              <p className="text-xs text-slate-500">Se ve en la franja lateral y al final, cuando sale el color. Sin foto, termina con tu logo.</p>
            </div>
          )}
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
