import type { BrandKind, BrandSettings, FontSpec } from "@/lib/brand";
import { readableOn } from "@/lib/color";
import {
  abbreviation, clamp01, clockText, easeInCubic, easeInOutCubic, easeOutBack, easeOutBounce, easeOutCubic, lerp, progress,
} from "./easing";

type Ctx = CanvasRenderingContext2D;

export type MatchData = {
  home: string; away: string; homeScore: number; awayScore: number;
  side: "home" | "away";          // equipo que anota (gol)
  player: string; minute: number;
  playerOut: string; playerIn: string;
  round: number; subtitle: string;
};

export const DEFAULT_MATCH: MatchData = {
  home: "Leones", away: "Tigres", homeScore: 2, awayScore: 1, side: "home",
  player: "Nombre Apellido", minute: 34, playerOut: "Jugador Sale", playerIn: "Jugador Entra", round: 6, subtitle: "Domingo 8 de noviembre",
};

export type SceneId = "ident" | "matchday" | "goal" | "halftime" | "fulltime" | "kickoff" | "yellow" | "red" | "substitution";
export type FieldKey = "match" | "home" | "away" | "homeScore" | "awayScore" | "side" | "player" | "minute" | "playerOut" | "playerIn" | "round" | "subtitle";

export type TemplateDef = { id: SceneId; kind: BrandKind; label: string; description: string; duration: number; fields: FieldKey[] };

export const TEMPLATES: TemplateDef[] = [
  { id: "ident", kind: "tournament", label: "Intro con logo", description: "Fondo que recorre los colores de tu marca y tu logo al centro.", duration: 4.2, fields: [] },
  { id: "matchday", kind: "tournament", label: "Anuncio de jornada", description: "Presenta la jornada con el nombre del torneo.", duration: 4, fields: ["round", "subtitle"] },
  { id: "goal", kind: "broadcast", label: "Gol", description: "¡GOL! con el goleador, el minuto y el marcador actualizado.", duration: 4.6, fields: ["match", "home", "away", "homeScore", "awayScore", "side", "player", "minute"] },
  { id: "halftime", kind: "broadcast", label: "Medio tiempo", description: "Resultado al descanso.", duration: 4, fields: ["match", "home", "away", "homeScore", "awayScore"] },
  { id: "fulltime", kind: "broadcast", label: "Final del partido", description: "Resultado final.", duration: 4, fields: ["match", "home", "away", "homeScore", "awayScore"] },
  { id: "kickoff", kind: "broadcast", label: "Inicio del partido", description: "Presentación de los equipos al arrancar.", duration: 4, fields: ["match", "home", "away"] },
  { id: "yellow", kind: "broadcast", label: "Tarjeta amarilla", description: "Jugador amonestado y minuto.", duration: 3.6, fields: ["match", "home", "away", "player", "minute"] },
  { id: "red", kind: "broadcast", label: "Tarjeta roja", description: "Jugador expulsado y minuto.", duration: 3.6, fields: ["match", "home", "away", "player", "minute"] },
  { id: "substitution", kind: "broadcast", label: "Cambio de jugador", description: "Quién sale, quién entra y el minuto.", duration: 3.8, fields: ["match", "home", "away", "playerOut", "playerIn", "minute"] },
];

export const FORMATS = {
  horizontal: { label: "Horizontal 16:9 (1920×1080)", w: 1920, h: 1080 },
  vertical: { label: "Vertical 9:16 (1080×1920)", w: 1080, h: 1920 },
  square: { label: "Cuadrado 1:1 (1080×1080)", w: 1080, h: 1080 },
} as const;
export type FormatId = keyof typeof FORMATS;

export type SceneInput = {
  w: number; h: number; t: number;
  kind: BrandKind;
  colors: Record<string, string>;
  fonts: BrandSettings["fonts"];
  logo: CanvasImageSource | null;
  logoSize: { w: number; h: number } | null;
  tournamentName: string;
  data: MatchData;
};

/* ───────────── utilidades de dibujo ───────────── */

const fontStr = (f: FontSpec, px: number) => `${f.italic ? "italic " : ""}${f.weight} ${Math.max(1, Math.round(px))}px "${f.family}", system-ui, sans-serif`;

function fitPx(ctx: Ctx, s: string, f: FontSpec, px: number, maxW: number) {
  ctx.font = fontStr(f, px);
  const m = ctx.measureText(s).width;
  return m > maxW && m > 0 ? px * (maxW / m) : px;
}

type TextOpts = { align?: CanvasTextAlign; maxW?: number; stroke?: string; strokeW?: number; alpha?: number };
function text(ctx: Ctx, s: string, x: number, y: number, f: FontSpec, px: number, color: string, o: TextOpts = {}) {
  const size = o.maxW ? fitPx(ctx, s, f, px, o.maxW) : px;
  ctx.save();
  ctx.font = fontStr(f, size);
  ctx.textAlign = o.align ?? "center";
  ctx.textBaseline = "middle";
  ctx.globalAlpha *= o.alpha ?? 1;
  if (o.stroke) {
    ctx.lineJoin = "round";
    ctx.lineWidth = o.strokeW ?? size * 0.12;
    ctx.strokeStyle = o.stroke;
    ctx.strokeText(s, x, y);
  }
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
  ctx.restore();
}

function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const k = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + k, y);
  ctx.arcTo(x + w, y, x + w, y + h, k);
  ctx.arcTo(x + w, y + h, x, y + h, k);
  ctx.arcTo(x, y + h, x, y, k);
  ctx.arcTo(x, y, x + w, y, k);
  ctx.closePath();
}

function blur(ctx: Ctx, px: number) {
  if (px > 0.2 && "filter" in ctx) (ctx as Ctx & { filter: string }).filter = `blur(${px.toFixed(1)}px)`;
}

function drawLogo(ctx: Ctx, i: SceneInput, cx: number, cy: number, maxW: number, maxH: number) {
  if (!i.logo || !i.logoSize) return false;
  const k = Math.min(maxW / i.logoSize.w, maxH / i.logoSize.h);
  ctx.drawImage(i.logo, cx - (i.logoSize.w * k) / 2, cy - (i.logoSize.h * k) / 2, i.logoSize.w * k, i.logoSize.h * k);
  return true;
}

/** Colores que recorre el fondo animado, según la marca. */
export function washPalette(kind: BrandKind, c: Record<string, string>): string[] {
  return kind === "tournament"
    ? [c.primary, c.secondary, c.accent, c.highlight, c.extra]
    : [c.homeStripe, c.awayStripe, c.clockBg, c.lowerAccent, c.scoreBg];
}

/** Fondo degradado que recorre la paleta sin cortes; `cover` (0-1) es cuánto del cuadro cubre al entrar. */
function wash(ctx: Ctx, w: number, h: number, t: number, palette: string[], cover: number, speed = 0.3) {
  if (cover <= 0.001) return;
  const slant = h * 0.3;
  const edge = Math.min(1, cover) * (w + slant);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-2, -2);
  ctx.lineTo(edge, -2);
  ctx.lineTo(edge - slant, h + 2);
  ctx.lineTo(-2, h + 2);
  ctx.closePath();
  ctx.clip();

  const diag = Math.hypot(w, h);
  ctx.translate(w / 2, h / 2);
  ctx.rotate((-20 * Math.PI) / 180);
  const n = palette.length;
  const g = ctx.createLinearGradient(-1.5 * diag, 0, 1.5 * diag, 0);
  const total = n * 3;
  for (let k = 0; k <= total; k++) g.addColorStop(k / total, palette[k % n]);
  ctx.save();
  ctx.translate(((t * speed) % 1) * diag, 0);
  ctx.fillStyle = g;
  ctx.fillRect(-3 * diag, -3 * diag, 6 * diag, 6 * diag);
  ctx.restore();
  ctx.rotate((20 * Math.PI) / 180);
  ctx.translate(-w / 2, -h / 2);

  // franjas claras en movimiento
  ctx.fillStyle = "#fff";
  ctx.globalAlpha = 0.1;
  for (let k = 0; k < 5; k++) {
    const x = (((k / 5 + t * 0.1) % 1) * (w + h)) - h;
    ctx.beginPath();
    ctx.moveTo(x, h);
    ctx.lineTo(x + h * 0.9, 0);
    ctx.lineTo(x + h * 0.9 + h * 0.14, 0);
    ctx.lineTo(x + h * 0.14, h);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/* ───────────── marcador ───────────── */

function scoreboard(ctx: Ctx, i: SceneInput, box: { x: number; y: number; w: number; h: number }, o: { clock: string; popSide?: "home" | "away"; pop?: number }) {
  const c = i.colors;
  const { x, y, w, h } = box;
  const logoD = h * 1.3;
  const startX = x + logoD * 0.55;
  const rest = w - logoD * 0.55;
  const cell = (frac: number) => rest * frac;
  const widths = [cell(0.3), cell(0.02), cell(0.17), cell(0.02), cell(0.29), cell(0.2)];
  const xs: number[] = [];
  widths.reduce((acc, wd) => { xs.push(acc); return acc + wd; }, startX);

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.35)";
  ctx.shadowBlur = h * 0.3;
  ctx.shadowOffsetY = h * 0.08;
  ctx.fillStyle = c.barBg;
  rr(ctx, startX, y, rest, h, h * 0.08);
  ctx.fill();
  ctx.restore();

  ctx.save();
  rr(ctx, startX, y, rest, h, h * 0.08);
  ctx.clip();
  const fills = [c.barBg, c.homeStripe, c.scoreBg, c.awayStripe, c.barBg, c.clockBg];
  widths.forEach((wd, k) => { ctx.fillStyle = fills[k]; ctx.fillRect(xs[k], y, wd + 1, h); });
  ctx.restore();

  const mid = y + h / 2;
  text(ctx, abbreviation(i.data.home, "LOC"), xs[0] + widths[0] / 2 + logoD * 0.1, mid, i.fonts.heading, h * 0.55, c.barText, { maxW: widths[0] * 0.8 });
  text(ctx, abbreviation(i.data.away, "VIS"), xs[4] + widths[4] / 2, mid, i.fonts.heading, h * 0.55, c.barText, { maxW: widths[4] * 0.8 });

  // resultado, con "rebote" en el lado que anotó
  const scoreCx = xs[2] + widths[2] / 2;
  const popK = o.pop ?? 0;
  const s = (side: "home" | "away") => (o.popSide === side ? 1 + 0.45 * popK : 1);
  ctx.save();
  ctx.fillStyle = c.scoreText;
  const px = fitPx(ctx, "00 - 00", i.fonts.numbers, h * 0.66, widths[2] * 0.9);
  const gap = px * 0.95;
  ctx.save(); ctx.translate(scoreCx - gap * 0.55, mid); ctx.scale(s("home"), s("home"));
  text(ctx, String(i.data.homeScore), 0, 0, i.fonts.numbers, px, c.scoreText); ctx.restore();
  text(ctx, "-", scoreCx, mid, i.fonts.numbers, px, c.scoreText);
  ctx.save(); ctx.translate(scoreCx + gap * 0.55, mid); ctx.scale(s("away"), s("away"));
  text(ctx, String(i.data.awayScore), 0, 0, i.fonts.numbers, px, c.scoreText); ctx.restore();
  ctx.restore();

  text(ctx, o.clock, xs[5] + widths[5] / 2, mid, i.fonts.numbers, h * 0.62, c.clockText, { maxW: widths[5] * 0.85 });

  // logo en círculo
  const lcx = x + logoD / 2;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.3)"; ctx.shadowBlur = h * 0.25;
  ctx.fillStyle = "#fff";
  ctx.beginPath(); ctx.arc(lcx, mid, logoD / 2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.beginPath(); ctx.arc(lcx, mid, logoD / 2, 0, Math.PI * 2); ctx.clip();
  if (!drawLogo(ctx, i, lcx, mid, logoD * 0.72, logoD * 0.72)) {
    text(ctx, i.tournamentName.slice(0, 1).toUpperCase() || "•", lcx, mid, i.fonts.heading, logoD * 0.5, c.barText);
  }
  ctx.restore();
}

function scoreboardBox(i: SceneInput) {
  const u = Math.min(i.w, i.h) / 1080;
  const w = Math.min(i.w * 0.94, 1500 * u);
  const h = Math.max(64 * u, Math.min(110 * u, w / 14));
  return { x: (i.w - w) / 2, y: i.h - h - i.h * 0.07, w, h };
}

/* ───────────── rótulo (jugador + minuto) ───────────── */

function lowerThird(ctx: Ctx, i: SceneInput, y: number, slideP: number, name: string, tag: string) {
  const c = i.colors;
  const u = Math.min(i.w, i.h) / 1080;
  const w = Math.min(i.w * 0.9, 1100 * u);
  const h = 104 * u;
  const x0 = (i.w - w) / 2;
  const off = (1 - easeOutCubic(slideP)) * -(w + x0 + 40);
  ctx.save();
  ctx.translate(off, 0);
  ctx.shadowColor = "rgba(0,0,0,.4)"; ctx.shadowBlur = 30 * u;
  ctx.fillStyle = c.lowerBg;
  rr(ctx, x0, y, w, h, 8 * u); ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.save(); rr(ctx, x0, y, w, h, 8 * u); ctx.clip();
  ctx.fillStyle = c.lowerAccent; ctx.fillRect(x0, y, 16 * u, h);
  const tagW = Math.min(w * 0.26, 240 * u);
  ctx.fillStyle = c.scoreBg; ctx.fillRect(x0 + w - tagW, y, tagW, h);
  ctx.restore();
  text(ctx, name.toUpperCase(), x0 + 44 * u, y + h / 2, i.fonts.heading, 46 * u, c.lowerText, { align: "left", maxW: w - tagW - 80 * u });
  text(ctx, tag, x0 + w - tagW / 2, y + h / 2, i.fonts.numbers, 56 * u, c.scoreText, { maxW: tagW * 0.8 });
  ctx.restore();
}

/* ───────────── escenas ───────────── */

function sceneIdent(ctx: Ctx, i: SceneInput) {
  const { w, h, t, colors: c } = i;
  const u = Math.min(w, h) / 1080;
  const D = 4.2;
  ctx.fillStyle = c.background; ctx.fillRect(0, 0, w, h);

  const cover = t < 3.3 ? easeInOutCubic(progress(t, 0, 0.9)) : 1 - easeInOutCubic(progress(t, 3.3, 4.05));
  wash(ctx, w, h, t, washPalette("tournament", c), cover, 0.28);

  const inP = easeOutBack(progress(t, 0.25, 1.0));
  const outP = progress(t, 3.3, D - 0.1);
  const float = 1 + 0.03 * Math.sin(progress(t, 1, 3.3) * Math.PI);
  const sx = lerp(0.55, 1, inP) * float * (1 - 0.8 * easeInCubic(outP));
  const sy = lerp(0.55, 1, inP) * float * (1 + 0.04 * outP);
  const alpha = clamp01(progress(t, 0.25, 0.7)) * (1 - easeInCubic(outP));

  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.scale(sx, sy);
  ctx.globalAlpha = alpha;
  blur(ctx, 18 * u * easeInCubic(outP));
  ctx.shadowColor = "rgba(0,0,0,.3)"; ctx.shadowBlur = 50 * u; ctx.shadowOffsetY = 12 * u;
  if (!drawLogo(ctx, i, 0, 0, w * 0.6, Math.min(h, w) * 0.5)) {
    text(ctx, i.tournamentName.toUpperCase(), 0, 0, i.fonts.heading, 130 * u, "#fff", { maxW: w * 0.8, stroke: c.text, strokeW: 14 * u });
  }
  ctx.restore();
}

function sceneMatchday(ctx: Ctx, i: SceneInput) {
  const { w, h, t, colors: c } = i;
  const u = Math.min(w, h) / 1080;
  ctx.fillStyle = c.background; ctx.fillRect(0, 0, w, h);
  const cover = t < 3.4 ? easeInOutCubic(progress(t, 0, 0.8)) : 1 - easeInOutCubic(progress(t, 3.4, 4));
  wash(ctx, w, h, t, washPalette("tournament", c), cover, 0.25);

  // sombra lateral para que el texto se lea sobre cualquier color
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, "rgba(0,0,0,.62)"); g.addColorStop(0.7, "rgba(0,0,0,.05)");
  ctx.save(); ctx.globalAlpha = cover; ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); ctx.restore();

  const left = w * 0.08;
  const slide = (start: number) => easeOutCubic(progress(t, start, start + 0.55));
  const exit = 1 - easeInCubic(progress(t, 3.4, 4));
  const row = (s: number, fn: (a: number, dx: number) => void) => fn(slide(s) * exit, (1 - slide(s)) * -120 * u);

  const horizontal = w >= h;
  const numPx = (horizontal ? 420 : 330) * u;
  row(0.5, (a, dx) => { ctx.save(); ctx.globalAlpha = a; text(ctx, "JORNADA", left + dx, h * 0.3, i.fonts.body, 62 * u, "#fff", { align: "left" }); ctx.restore(); });
  row(0.7, (a, dx) => { ctx.save(); ctx.globalAlpha = a; text(ctx, String(i.data.round).padStart(2, "0"), left + dx, h * 0.3 + numPx * 0.55, i.fonts.numbers, numPx, "#fff", { align: "left", maxW: w * 0.8 }); ctx.restore(); });
  row(0.95, (a, dx) => { ctx.save(); ctx.globalAlpha = a; text(ctx, i.tournamentName.toUpperCase(), left + dx, h * 0.3 + numPx * 1.15, i.fonts.heading, 70 * u, "#fff", { align: "left", maxW: w * 0.84 }); ctx.restore(); });
  row(1.15, (a, dx) => {
    ctx.save(); ctx.globalAlpha = a;
    ctx.font = fontStr(i.fonts.body, 44 * u);
    const tw = Math.min(ctx.measureText(i.data.subtitle).width + 56 * u, w * 0.84);
    const ty = h * 0.3 + numPx * 1.15 + 90 * u;
    ctx.fillStyle = c.accent; rr(ctx, left + dx, ty - 34 * u, tw, 68 * u, 14 * u); ctx.fill();
    text(ctx, i.data.subtitle, left + dx + 28 * u, ty, i.fonts.body, 44 * u, readableOn(c.accent), { align: "left", maxW: tw - 56 * u });
    ctx.restore();
  });
}

/** Base de las escenas de transmisión: fondo oscuro + degradado de la marca que entra en diagonal. */
function broadcastBackdrop(ctx: Ctx, i: SceneInput, inEnd = 0.5, outStart = D_OUT_DEFAULT, duration = 4) {
  const { w, h, t, colors: c } = i;
  ctx.fillStyle = c.scoreBg; ctx.fillRect(0, 0, w, h);
  const cover = t < outStart ? easeInOutCubic(progress(t, 0, inEnd)) : 1 - easeInOutCubic(progress(t, outStart, duration - 0.05));
  wash(ctx, w, h, t, washPalette("broadcast", c), cover, 0.3);
  const g = ctx.createLinearGradient(0, h * 0.35, 0, h);
  g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,.55)");
  ctx.save(); ctx.globalAlpha = cover; ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); ctx.restore();
  return cover;
}
const D_OUT_DEFAULT = 3.4;

/** Entrada y salida comunes: 1 mientras se muestra, 0 fuera (para atenuar contenido). */
const fade = (t: number, inAt: number, outAt: number, d: number) => easeOutCubic(progress(t, inAt, inAt + 0.4)) * (1 - easeInCubic(progress(t, outAt, d)));

function slam(ctx: Ctx, i: SceneInput, word: string, start: number, cy: number, sizeK: number, d: number, outAt: number, color = "#fff") {
  const { w, h, t, colors: c } = i;
  const u = Math.min(w, h) / 1080;
  const p = progress(t, start, start + 0.6);
  if (p <= 0) return;
  const s = lerp(2.6, 1, easeOutBack(p));
  const shakeP = progress(t, start + 0.6, start + 1.1);
  const dx = Math.sin(t * 70) * 10 * u * (1 - shakeP) * (p >= 1 ? 1 : 0);
  ctx.save();
  ctx.translate(w / 2 + dx, cy);
  ctx.scale(s, s);
  ctx.globalAlpha = clamp01(p * 3) * (1 - easeInCubic(progress(t, outAt, d)));
  ctx.shadowColor = "rgba(0,0,0,.45)"; ctx.shadowBlur = 40 * u; ctx.shadowOffsetY = 10 * u;
  text(ctx, word, 0, 0, i.fonts.heading, sizeK * Math.min(w, h * 1.25), color, { maxW: w * 0.9, stroke: c.scoreBg, strokeW: 16 * u });
  ctx.restore();
}

function drawScoreboardIn(ctx: Ctx, i: SceneInput, inAt: number, outAt: number, d: number, o: { clock: string; popSide?: "home" | "away"; popAt?: number }) {
  const b = scoreboardBox(i);
  const inP = easeOutCubic(progress(i.t, inAt, inAt + 0.5));
  const outP = easeInCubic(progress(i.t, outAt, d));
  const dy = (1 - inP + outP) * (b.h * 2.4);
  const pop = o.popAt != null ? 1 - easeOutBounce(progress(i.t, o.popAt, o.popAt + 0.6)) : 0;
  ctx.save(); ctx.translate(0, dy); ctx.globalAlpha = inP * (1 - outP);
  scoreboard(ctx, i, b, { clock: o.clock, popSide: o.popSide, pop: o.popAt != null && i.t >= o.popAt ? pop : 0 });
  ctx.restore();
}

function sceneGoal(ctx: Ctx, i: SceneInput) {
  const { w, h, t, data } = i;
  const u = Math.min(w, h) / 1080;
  const D = 4.6;
  broadcastBackdrop(ctx, i, 0.45, 4.0, D);
  slam(ctx, i, "¡GOL!", 0.35, h * 0.3, 0.3, D, 4.0);

  // destello al impacto
  const fl = 0.8 * (1 - progress(t, 0.35, 0.65)) * (t >= 0.35 ? 1 : 0);
  if (fl > 0) { ctx.save(); ctx.globalAlpha = fl; ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h); ctx.restore(); }

  const team = data.side === "home" ? data.home : data.away;
  ctx.save(); ctx.globalAlpha = fade(t, 0.9, 4.0, D);
  text(ctx, team.toUpperCase(), w / 2, h * 0.3 + Math.min(w, h * 1.25) * 0.22, i.fonts.heading, 70 * u, "#fff", { maxW: w * 0.86, stroke: i.colors.scoreBg, strokeW: 10 * u });
  ctx.restore();

  const b = scoreboardBox(i);
  lowerThird(ctx, i, b.y - 104 * u - 56 * u, progress(t, 0.95, 1.5) * (t < 4.0 ? 1 : 1 - progress(t, 4.0, D)), data.player, `${Math.round(data.minute)}'`);
  drawScoreboardIn(ctx, i, 1.25, 4.0, D, { clock: clockText(data.minute), popSide: data.side, popAt: 1.7 });
}

function sceneResult(ctx: Ctx, i: SceneInput, headline: string, clock: string, showScore: boolean) {
  const { w, h, t, data } = i;
  const u = Math.min(w, h) / 1080;
  const D = 4;
  broadcastBackdrop(ctx, i, 0.5, 3.4, D);
  slam(ctx, i, headline, 0.4, h * 0.27, 0.19, D, 3.4);

  if (showScore) {
    const a = fade(t, 1.0, 3.4, D);
    ctx.save(); ctx.globalAlpha = a;
    const cy = h * 0.5;
    const horizontal = w >= h;
    if (horizontal) {
      text(ctx, data.home.toUpperCase(), w * 0.1, cy, i.fonts.heading, 70 * u, "#fff", { align: "left", maxW: w * 0.3, stroke: i.colors.scoreBg, strokeW: 9 * u });
      text(ctx, `${data.homeScore} - ${data.awayScore}`, w / 2, cy, i.fonts.numbers, 230 * u, "#fff", { maxW: w * 0.3, stroke: i.colors.scoreBg, strokeW: 14 * u });
      text(ctx, data.away.toUpperCase(), w * 0.9, cy, i.fonts.heading, 70 * u, "#fff", { align: "right", maxW: w * 0.3, stroke: i.colors.scoreBg, strokeW: 9 * u });
    } else {
      text(ctx, `${data.homeScore} - ${data.awayScore}`, w / 2, cy, i.fonts.numbers, 260 * u, "#fff", { maxW: w * 0.86, stroke: i.colors.scoreBg, strokeW: 14 * u });
      text(ctx, data.home.toUpperCase(), w / 2, cy - 190 * u, i.fonts.heading, 64 * u, "#fff", { maxW: w * 0.86, stroke: i.colors.scoreBg, strokeW: 9 * u });
      text(ctx, data.away.toUpperCase(), w / 2, cy + 190 * u, i.fonts.heading, 64 * u, "#fff", { maxW: w * 0.86, stroke: i.colors.scoreBg, strokeW: 9 * u });
    }
    ctx.restore();
  }
  drawScoreboardIn(ctx, i, 1.3, 3.4, D, { clock });
}

function sceneKickoff(ctx: Ctx, i: SceneInput) {
  const { w, h, t, data } = i;
  const u = Math.min(w, h) / 1080;
  const D = 4;
  broadcastBackdrop(ctx, i, 0.5, 3.4, D);
  slam(ctx, i, "¡COMIENZA!", 0.4, h * 0.27, 0.17, D, 3.4);
  const a = fade(t, 1.0, 3.4, D);
  ctx.save(); ctx.globalAlpha = a;
  const cy = h * 0.5;
  const stroke = i.colors.scoreBg;
  if (w >= h) {
    text(ctx, data.home.toUpperCase(), w * 0.3, cy, i.fonts.heading, 90 * u, "#fff", { maxW: w * 0.36, stroke, strokeW: 11 * u });
    text(ctx, "VS", w / 2, cy, i.fonts.numbers, 130 * u, i.colors.lowerAccent, { stroke, strokeW: 12 * u });
    text(ctx, data.away.toUpperCase(), w * 0.7, cy, i.fonts.heading, 90 * u, "#fff", { maxW: w * 0.36, stroke, strokeW: 11 * u });
  } else {
    text(ctx, data.home.toUpperCase(), w / 2, cy - 150 * u, i.fonts.heading, 90 * u, "#fff", { maxW: w * 0.86, stroke, strokeW: 11 * u });
    text(ctx, "VS", w / 2, cy, i.fonts.numbers, 130 * u, i.colors.lowerAccent, { stroke, strokeW: 12 * u });
    text(ctx, data.away.toUpperCase(), w / 2, cy + 150 * u, i.fonts.heading, 90 * u, "#fff", { maxW: w * 0.86, stroke, strokeW: 11 * u });
  }
  ctx.restore();
  drawScoreboardIn(ctx, i, 1.3, 3.4, D, { clock: "00:00" });
}

function sceneCard(ctx: Ctx, i: SceneInput, color: string, label: string) {
  const { w, h, t, colors: c, data } = i;
  const u = Math.min(w, h) / 1080;
  const D = 3.6;
  ctx.fillStyle = c.scoreBg; ctx.fillRect(0, 0, w, h);
  const bg = ctx.createRadialGradient(w / 2, h * 0.4, 0, w / 2, h * 0.4, Math.max(w, h) * 0.7);
  bg.addColorStop(0, color + "66"); bg.addColorStop(1, "rgba(0,0,0,.65)");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);

  const outP = easeInCubic(progress(t, 3.0, D));
  const p = progress(t, 0.2, 1.2);
  const cw = Math.min(w, h) * 0.24;
  const ch = cw * 1.45;
  const cy = lerp(-ch, h * 0.36, easeOutBounce(p));
  const rot = lerp(-0.35, 0, easeOutCubic(progress(t, 0.2, 1.4))) + Math.sin(t * 2.2) * 0.02 * (p >= 1 ? 1 : 0);
  ctx.save();
  ctx.translate(w / 2, cy); ctx.rotate(rot); ctx.globalAlpha = 1 - outP;
  ctx.shadowColor = "rgba(0,0,0,.5)"; ctx.shadowBlur = 50 * u; ctx.shadowOffsetY = 20 * u;
  ctx.fillStyle = color;
  rr(ctx, -cw / 2, -ch / 2, cw, ch, cw * 0.09); ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.fillStyle = "rgba(255,255,255,.22)";
  rr(ctx, -cw / 2 + cw * 0.08, -ch / 2 + cw * 0.08, cw * 0.28, ch - cw * 0.16, cw * 0.06); ctx.fill();
  ctx.restore();

  ctx.save(); ctx.globalAlpha = fade(t, 1.1, 3.0, D);
  text(ctx, label, w / 2, h * 0.36 + ch * 0.72, i.fonts.heading, 92 * u, "#fff", { maxW: w * 0.9, stroke: c.scoreBg, strokeW: 12 * u });
  ctx.restore();
  const y = h * 0.36 + ch * 0.72 + 110 * u;
  lowerThird(ctx, i, y, progress(t, 1.3, 1.85) * (t < 3.0 ? 1 : 1 - progress(t, 3.0, D)), data.player, `${Math.round(data.minute)}'`);
}

function sceneSubstitution(ctx: Ctx, i: SceneInput) {
  const { w, h, t, colors: c, data } = i;
  const u = Math.min(w, h) / 1080;
  const D = 3.8;
  broadcastBackdrop(ctx, i, 0.45, 3.2, D);
  slam(ctx, i, "CAMBIO", 0.35, h * 0.24, 0.16, D, 3.2);

  const pw = Math.min(w * 0.86, 1100 * u);
  const ph = 130 * u;
  const x0 = (w - pw) / 2;
  const rowsTop = h * 0.4;
  const exit = easeInCubic(progress(t, 3.2, D));
  [
    { y: rowsTop, name: data.playerOut, label: "SALE", color: "#DC2626", up: false, at: 1.0 },
    { y: rowsTop + ph + 36 * u, name: data.playerIn, label: "ENTRA", color: "#16A34A", up: true, at: 1.35 },
  ].forEach((r) => {
    const p = easeOutCubic(progress(t, r.at, r.at + 0.5));
    const off = (1 - p + exit) * -(w);
    ctx.save();
    ctx.translate(off, 0);
    ctx.shadowColor = "rgba(0,0,0,.4)"; ctx.shadowBlur = 30 * u;
    ctx.fillStyle = c.lowerBg; rr(ctx, x0, r.y, pw, ph, 10 * u); ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.fillStyle = r.color; ctx.save(); rr(ctx, x0, r.y, pw, ph, 10 * u); ctx.clip(); ctx.fillRect(x0, r.y, ph, ph); ctx.restore();
    // flecha
    ctx.fillStyle = "#fff"; ctx.beginPath();
    const ax = x0 + ph / 2, ay = r.y + ph / 2, s = ph * 0.22;
    if (r.up) { ctx.moveTo(ax, ay - s); ctx.lineTo(ax + s, ay + s); ctx.lineTo(ax - s, ay + s); }
    else { ctx.moveTo(ax, ay + s); ctx.lineTo(ax + s, ay - s); ctx.lineTo(ax - s, ay - s); }
    ctx.closePath(); ctx.fill();
    text(ctx, r.label, x0 + ph + 30 * u, r.y + ph * 0.3, i.fonts.body, 30 * u, c.lowerAccent, { align: "left" });
    text(ctx, r.name.toUpperCase(), x0 + ph + 30 * u, r.y + ph * 0.66, i.fonts.heading, 48 * u, c.lowerText, { align: "left", maxW: pw - ph - 60 * u });
    ctx.restore();
  });

  const chipP = fade(t, 1.8, 3.2, D);
  ctx.save(); ctx.globalAlpha = chipP;
  const cy = rowsTop + ph * 2 + 36 * u + 90 * u;
  ctx.fillStyle = c.clockBg; rr(ctx, w / 2 - 110 * u, cy - 40 * u, 220 * u, 80 * u, 14 * u); ctx.fill();
  text(ctx, `${Math.round(data.minute)}'`, w / 2, cy, i.fonts.numbers, 58 * u, c.clockText);
  ctx.restore();
}

export function drawScene(ctx: Ctx, id: SceneId, input: SceneInput) {
  ctx.save();
  ctx.clearRect(0, 0, input.w, input.h);
  switch (id) {
    case "ident": sceneIdent(ctx, input); break;
    case "matchday": sceneMatchday(ctx, input); break;
    case "goal": sceneGoal(ctx, input); break;
    case "halftime": sceneResult(ctx, input, "MEDIO TIEMPO", "45:00", true); break;
    case "fulltime": sceneResult(ctx, input, "FINAL", "90:00", true); break;
    case "kickoff": sceneKickoff(ctx, input); break;
    case "yellow": sceneCard(ctx, input, "#FACC15", "TARJETA AMARILLA"); break;
    case "red": sceneCard(ctx, input, "#DC2626", "TARJETA ROJA"); break;
    case "substitution": sceneSubstitution(ctx, input); break;
  }
  ctx.restore();
}

export const templateById = (id: SceneId) => TEMPLATES.find((t) => t.id === id)!;
