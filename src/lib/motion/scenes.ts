import type { BrandKind, BrandSettings, FontSpec } from "@/lib/brand";
import { contrastRatio, hexToHsv, hexToRgb, hsvToHex, readableOn, rgbToHex } from "@/lib/color";
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
  { id: "ident", kind: "tournament", label: "Intro con logo", description: "Panel de color que cambia, pasa a blanco mientras el logo gira y florece el siguiente color.", duration: 5.8, fields: [] },
  { id: "matchday", kind: "tournament", label: "Anuncio de jornada", description: "Presenta la jornada con el nombre del torneo.", duration: 5, fields: ["round", "subtitle"] },
  { id: "goal", kind: "broadcast", label: "Gol", description: "¡GOL! con el goleador, el minuto y el marcador actualizado.", duration: 5.2, fields: ["match", "home", "away", "homeScore", "awayScore", "side", "player", "minute"] },
  { id: "halftime", kind: "broadcast", label: "Medio tiempo", description: "Resultado al descanso.", duration: 5, fields: ["match", "home", "away", "homeScore", "awayScore"] },
  { id: "fulltime", kind: "broadcast", label: "Final del partido", description: "Resultado final.", duration: 5, fields: ["match", "home", "away", "homeScore", "awayScore"] },
  { id: "kickoff", kind: "broadcast", label: "Inicio del partido", description: "Presentación de los equipos al arrancar.", duration: 5, fields: ["match", "home", "away"] },
  { id: "yellow", kind: "broadcast", label: "Tarjeta amarilla", description: "Jugador amonestado y minuto.", duration: 4.6, fields: ["match", "home", "away", "player", "minute"] },
  { id: "red", kind: "broadcast", label: "Tarjeta roja", description: "Jugador expulsado y minuto.", duration: 4.6, fields: ["match", "home", "away", "player", "minute"] },
  { id: "substitution", kind: "broadcast", label: "Cambio de jugador", description: "Quién sale, quién entra y el minuto.", duration: 4.8, fields: ["match", "home", "away", "playerOut", "playerIn", "minute"] },
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

function drawLogo(ctx: Ctx, i: SceneInput, cx: number, cy: number, maxW: number, maxH: number) {
  if (!i.logo || !i.logoSize) return false;
  const k = Math.min(maxW / i.logoSize.w, maxH / i.logoSize.h);
  ctx.drawImage(i.logo, cx - (i.logoSize.w * k) / 2, cy - (i.logoSize.h * k) / 2, i.logoSize.w * k, i.logoSize.h * k);
  return true;
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

/* ───────────── escenario: panel de color → barrido → blanco con giro → siguiente color ───────────── */

/** Colores que recorre el panel, según la marca. */
export function washPalette(kind: BrandKind, c: Record<string, string>): string[] {
  return kind === "tournament"
    ? [c.primary, c.secondary, c.accent, c.highlight, c.extra]
    : [c.homeStripe, c.awayStripe, c.clockBg, c.lowerAccent];
}

function mix(a: string, b: string, k: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return rgbToHex(lerp(r1, r2, k), lerp(g1, g2, k), lerp(b1, b2, k));
}
/** Punto medio entre dos colores recorriendo el matiz (evita el gris al cruzar colores opuestos). */
export function vividMid(a: string, b: string): string {
  const x = hexToHsv(a), y = hexToHsv(b);
  if (x.s < 0.15 || y.s < 0.15) return mix(a, b, 0.5); // con grises no hay matiz que recorrer
  let dh = y.h - x.h;
  if (dh > 180) dh -= 360;
  if (dh < -180) dh += 360;
  return hsvToHex({ h: x.h + dh / 2, s: (x.s + y.s) / 2, v: Math.max(x.v, y.v) });
}
function samplePalette(pal: string[], x: number): string {
  const n = pal.length;
  const k = ((x % n) + n) % n;
  const i0 = Math.floor(k);
  return mix(pal[i0], pal[(i0 + 1) % n], k - i0);
}

/** Color de tinta: oscuro de la marca (o casi negro si no contrasta con blanco). */
function inkOf(i: SceneInput): string {
  const cand = i.kind === "tournament" ? i.colors.text : i.colors.scoreBg;
  return contrastRatio(cand, "#FFFFFF") >= 4.5 ? cand : "#111111";
}

export type StageCfg = { D: number; lead: number; blocks: number; white: number };

/**
 * Estado del escenario en el instante t:
 * - reveal (0-1): cuánto se ve el panel de color (florece desde la esquina y se disuelve a blanco).
 * - phase: posición en la paleta; cada bloque mantiene un par de colores, barre rápido al siguiente par y lo mantiene.
 * - spin (0-1 o -1): progreso del giro del logo durante la fase en blanco.
 */
export function stageState(t: number, cfg: StageCfg) {
  const L = (cfg.D - cfg.lead - cfg.blocks * cfg.white) / cfg.blocks;
  let reveal = 0, phase = 0, spin = -1, base = 0, sweep = 0, drift = 0;
  if (cfg.lead > 0 && t >= 0 && t < cfg.lead) spin = t / cfg.lead;
  for (let j = 0; j < cfg.blocks; j++) {
    const s = cfg.lead + j * (L + cfg.white);
    const e = s + L;
    if (t >= s && t < e + 0.05) {
      const local = (t - s) / L;
      reveal = Math.min(easeOutCubic(progress(t, s, s + 0.22)), 1 - easeInCubic(progress(t, e - 0.15, e + 0.05)));
      base = 2 * j;
      sweep = easeInOutCubic(progress(local, 0.5, 0.66));
      drift = 0.12 * local;
      phase = base + sweep + drift;
    }
    if (t >= e && t < e + cfg.white) spin = (t - e) / cfg.white;
  }
  return { reveal, phase, spin, base, sweep, drift, blockLen: L };
}

/** Franjas diagonales en zigzag que se desplazan. */
function shards(ctx: Ctx, w: number, h: number, t: number, color: string, alpha: number) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha;
  const span = w + h * 1.2;
  const bw = h * 0.1;
  for (let k = 0; k < 6; k++) {
    const x = ((k / 6 + t * 0.05) % 1) * span - h * 1.1;
    ctx.beginPath();
    ctx.moveTo(x, h);
    ctx.lineTo(x + 0.5 * h, 0.5 * h);
    ctx.lineTo(x + 0.38 * h, 0.5 * h);
    ctx.lineTo(x + 0.88 * h, 0);
    ctx.lineTo(x + 0.88 * h + bw, 0);
    ctx.lineTo(x + 0.38 * h + bw + 0.1 * h, 0.4 * h);
    ctx.lineTo(x + 0.5 * h + bw + 0.1 * h, 0.4 * h);
    ctx.lineTo(x + bw, h);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawStage(ctx: Ctx, i: SceneInput, cfg: StageCfg) {
  const { w, h, t } = i;
  const st = stageState(t, cfg);
  const ink = inkOf(i);
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, w, h);
  shards(ctx, w, h, t, ink, 0.02);

  if (st.reveal > 0.001) {
    const pal = washPalette(i.kind, i.colors);
    const pw = w * 0.5;
    const r = Math.min(w, h) * 0.09;
    ctx.save();
    ctx.globalAlpha = Math.min(1, st.reveal * 1.4);
    // florece desde la esquina superior izquierda
    ctx.beginPath();
    ctx.arc(0, 0, st.reveal * Math.hypot(pw, h) * 1.08, 0, Math.PI * 2);
    ctx.clip();
    // panel izquierdo con la esquina superior derecha redondeada
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(pw - r, 0);
    ctx.arcTo(pw, 0, pw, r, r);
    ctx.lineTo(pw, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.clip();
    // Par de colores actual; el siguiente par entra como un barrido diagonal desde abajo (sin mezclar a gris).
    const paint = (k: number) => {
      const g = ctx.createLinearGradient(0, 0, pw, h);
      const ca = samplePalette(pal, k + st.drift), cb = samplePalette(pal, k + 1 + st.drift);
      g.addColorStop(0, ca);
      g.addColorStop(0.5, vividMid(ca, cb));
      g.addColorStop(1, cb);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, pw, h);
      shards(ctx, w, h, t * 1.6 + k, cb, 0.22);
    };
    paint(st.base);
    if (st.sweep > 0.001) {
      const e = st.sweep * (pw + h) * 1.05;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(-2, h + 2);
      ctx.lineTo(e, h + 2);
      ctx.lineTo(-2, h + 2 - e);
      ctx.closePath();
      ctx.clip();
      paint(st.base + 1);
      ctx.restore();
    }
    shards(ctx, w, h, t * 1.6 + 3.1, "#FFFFFF", 0.1);
    ctx.restore();
  }
  return st;
}

/** Logo (o nombre del torneo) con contorno claro; durante el giro se estrecha, se encoge y deja estela. */
function spinLogo(ctx: Ctx, i: SceneInput, cx: number, cy: number, maxW: number, maxH: number, spin: number, vanish = false) {
  const u = Math.min(i.w, i.h) / 1080;
  const s = spin >= 0 && spin <= 1 ? Math.sin(Math.PI * spin) : 0;
  const grow = vanish ? 1 - easeInCubic(clamp01(spin)) : 1;
  if (grow <= 0.01) return;
  const scale = (1 - 0.42 * s) * grow;
  const sx = scale * lerp(1, 0.2, vanish ? clamp01(spin * 1.6) : s);
  const drawOnce = () => {
    if (!drawLogo(ctx, i, 0, 0, maxW, maxH)) {
      text(ctx, i.tournamentName.toUpperCase(), 0, 0, i.fonts.heading, 130 * u, inkOf(i), { maxW, stroke: "#FFFFFF", strokeW: 16 * u });
    }
  };
  const copies = s > 0.05 || vanish ? 7 : 1;
  for (let k = 0; k < copies; k++) {
    const off = copies === 1 ? 0 : (k / (copies - 1) - 0.5) * maxW * 0.16 * (vanish ? clamp01(spin * 2) : s);
    ctx.save();
    ctx.translate(cx + off, cy);
    ctx.scale(sx, scale);
    ctx.globalAlpha = copies === 1 ? 1 : 0.3;
    if (copies === 1) { ctx.shadowColor = "rgba(255,255,255,.95)"; ctx.shadowBlur = 26 * u; }
    drawOnce();
    ctx.restore();
  }
}

const STROKE = "#FFFFFF";
/** Aparición y salida del contenido: 1 mientras se muestra. */
const fade = (t: number, inAt: number, outAt: number, d: number) => easeOutCubic(progress(t, inAt, inAt + 0.4)) * (1 - easeInCubic(progress(t, outAt, d)));

/** Escenario de las piezas de partido: empieza en blanco con el logo girando y luego florece el color. */
const EVENT_LEAD = 0.55;
function eventStage(ctx: Ctx, i: SceneInput, D: number) {
  const st = drawStage(ctx, i, { D, lead: EVENT_LEAD, blocks: 2, white: 0.5 });
  if (i.t < EVENT_LEAD) spinLogo(ctx, i, i.w / 2, i.h / 2, i.w * 0.5, Math.min(i.w, i.h) * 0.42, i.t / EVENT_LEAD, true);
  return st;
}

function slam(ctx: Ctx, i: SceneInput, word: string, start: number, cy: number, sizeK: number, d: number, outAt: number) {
  const { w, h, t } = i;
  const u = Math.min(w, h) / 1080;
  const p = progress(t, start, start + 0.55);
  if (p <= 0) return;
  const s = lerp(2.4, 1, easeOutBack(p));
  ctx.save();
  ctx.translate(w / 2, cy);
  ctx.scale(s, s);
  ctx.globalAlpha = clamp01(p * 3) * (1 - easeInCubic(progress(t, outAt, d)));
  text(ctx, word, 0, 0, i.fonts.heading, sizeK * Math.min(w, h * 1.25), inkOf(i), { maxW: w * 0.9, stroke: STROKE, strokeW: 20 * u });
  ctx.restore();
}

function drawScoreboardIn(ctx: Ctx, i: SceneInput, inAt: number, outAt: number, d: number, o: { clock: string; popSide?: "home" | "away"; popAt?: number }) {
  const b = scoreboardBox(i);
  const inP = easeOutCubic(progress(i.t, inAt, inAt + 0.5));
  const outP = easeInCubic(progress(i.t, outAt, d));
  const dy = (1 - inP + outP) * (b.h * 2.4);
  const pop = o.popAt != null && i.t >= o.popAt ? 1 - easeOutBounce(progress(i.t, o.popAt, o.popAt + 0.6)) : 0;
  ctx.save(); ctx.translate(0, dy); ctx.globalAlpha = inP * (1 - outP);
  scoreboard(ctx, i, b, { clock: o.clock, popSide: o.popSide, pop });
  ctx.restore();
}

/* ───────────── escenas ───────────── */

function sceneIdent(ctx: Ctx, i: SceneInput) {
  const st = drawStage(ctx, i, { D: 5.8, lead: 0, blocks: 2, white: 0.7 });
  spinLogo(ctx, i, i.w / 2, i.h / 2, i.w * 0.78, i.w >= i.h ? i.h * 0.62 : i.h * 0.42, st.spin);
}

function sceneMatchday(ctx: Ctx, i: SceneInput) {
  const { w, h, t, colors: c } = i;
  const u = Math.min(w, h) / 1080;
  const D = 5;
  const outAt = D - 0.45;
  eventStage(ctx, i, D);
  const ink = inkOf(i);
  const left = w * 0.07;
  const row = (start: number, fn: (dx: number) => void) => {
    const p = easeOutCubic(progress(t, start, start + 0.5));
    ctx.save(); ctx.globalAlpha = p * (1 - easeInCubic(progress(t, outAt, D)));
    fn((1 - p) * -140 * u); ctx.restore();
  };
  const numPx = (w >= h ? 400 : 320) * u;
  const top = h * 0.26;
  row(0.6, (dx) => text(ctx, "JORNADA", left + dx, top, i.fonts.body, 64 * u, ink, { align: "left", stroke: STROKE, strokeW: 10 * u }));
  row(0.75, (dx) => text(ctx, String(i.data.round).padStart(2, "0"), left + dx, top + numPx * 0.58, i.fonts.numbers, numPx, ink, { align: "left", maxW: w * 0.8, stroke: STROKE, strokeW: 22 * u }));
  row(0.95, (dx) => text(ctx, i.tournamentName.toUpperCase(), left + dx, top + numPx * 1.2, i.fonts.heading, 72 * u, ink, { align: "left", maxW: w * 0.86, stroke: STROKE, strokeW: 12 * u }));
  row(1.15, (dx) => {
    ctx.font = fontStr(i.fonts.body, 44 * u);
    const tw = Math.min(ctx.measureText(i.data.subtitle).width + 56 * u, w * 0.86);
    const ty = top + numPx * 1.2 + 96 * u;
    ctx.fillStyle = ink; rr(ctx, left + dx, ty - 36 * u, tw, 72 * u, 14 * u); ctx.fill();
    text(ctx, i.data.subtitle, left + dx + 28 * u, ty, i.fonts.body, 44 * u, readableOn(ink), { align: "left", maxW: tw - 56 * u });
  });
  void c;
}

function sceneGoal(ctx: Ctx, i: SceneInput) {
  const { w, h, t, data } = i;
  const u = Math.min(w, h) / 1080;
  const D = 5.2;
  const outAt = D - 0.45;
  eventStage(ctx, i, D);
  slam(ctx, i, "¡GOL!", EVENT_LEAD, h * 0.3, 0.3, D, outAt);

  const team = data.side === "home" ? data.home : data.away;
  ctx.save(); ctx.globalAlpha = fade(t, 1.05, outAt, D);
  text(ctx, team.toUpperCase(), w / 2, h * 0.3 + Math.min(w, h * 1.25) * 0.22, i.fonts.heading, 72 * u, inkOf(i), { maxW: w * 0.86, stroke: STROKE, strokeW: 12 * u });
  ctx.restore();

  const b = scoreboardBox(i);
  lowerThird(ctx, i, b.y - 104 * u - 56 * u, progress(t, 1.15, 1.7) * (1 - progress(t, outAt, D)), data.player, `${Math.round(data.minute)}'`);
  drawScoreboardIn(ctx, i, 1.45, outAt, D, { clock: clockText(data.minute), popSide: data.side, popAt: 1.95 });
}

function versus(ctx: Ctx, i: SceneInput, middle: string, midFont: FontSpec, midPx: number) {
  const { w, h, data } = i;
  const u = Math.min(w, h) / 1080;
  const ink = inkOf(i);
  const cy = h * 0.5;
  const name = { stroke: STROKE, strokeW: 12 * u };
  if (w >= h) {
    text(ctx, data.home.toUpperCase(), w * 0.27, cy, i.fonts.heading, 84 * u, ink, { maxW: w * 0.34, ...name });
    text(ctx, middle, w / 2, cy, midFont, midPx * u, ink, { maxW: w * 0.26, stroke: STROKE, strokeW: 18 * u });
    text(ctx, data.away.toUpperCase(), w * 0.73, cy, i.fonts.heading, 84 * u, ink, { maxW: w * 0.34, ...name });
  } else {
    text(ctx, data.home.toUpperCase(), w / 2, cy - midPx * 0.8 * u, i.fonts.heading, 78 * u, ink, { maxW: w * 0.88, ...name });
    text(ctx, middle, w / 2, cy, midFont, midPx * 1.1 * u, ink, { maxW: w * 0.86, stroke: STROKE, strokeW: 18 * u });
    text(ctx, data.away.toUpperCase(), w / 2, cy + midPx * 0.8 * u, i.fonts.heading, 78 * u, ink, { maxW: w * 0.88, ...name });
  }
}

function sceneResult(ctx: Ctx, i: SceneInput, headline: string, clock: string) {
  const D = 5;
  const outAt = D - 0.45;
  eventStage(ctx, i, D);
  slam(ctx, i, headline, EVENT_LEAD, i.h * 0.26, 0.19, D, outAt);
  ctx.save(); ctx.globalAlpha = fade(i.t, 1.15, outAt, D);
  versus(ctx, i, `${i.data.homeScore} - ${i.data.awayScore}`, i.fonts.numbers, 230);
  ctx.restore();
  drawScoreboardIn(ctx, i, 1.45, outAt, D, { clock });
}

function sceneKickoff(ctx: Ctx, i: SceneInput) {
  const D = 5;
  const outAt = D - 0.45;
  eventStage(ctx, i, D);
  slam(ctx, i, "¡COMIENZA!", EVENT_LEAD, i.h * 0.26, 0.17, D, outAt);
  ctx.save(); ctx.globalAlpha = fade(i.t, 1.15, outAt, D);
  versus(ctx, i, "VS", i.fonts.numbers, 150);
  ctx.restore();
  drawScoreboardIn(ctx, i, 1.45, outAt, D, { clock: "00:00" });
}

function sceneCard(ctx: Ctx, i: SceneInput, color: string, label: string) {
  const { w, h, t, data } = i;
  const u = Math.min(w, h) / 1080;
  const D = 4.6;
  const outAt = D - 0.45;
  eventStage(ctx, i, D);

  const outP = easeInCubic(progress(t, outAt, D));
  const p = progress(t, EVENT_LEAD, EVENT_LEAD + 1.0);
  const cw = Math.min(w, h) * 0.24;
  const ch = cw * 1.45;
  const cy = lerp(-ch, h * 0.34, easeOutBounce(p));
  const rot = lerp(-0.35, 0, easeOutCubic(progress(t, EVENT_LEAD, EVENT_LEAD + 1.2))) + Math.sin(t * 2.2) * 0.02 * (p >= 1 ? 1 : 0);
  ctx.save();
  ctx.translate(w / 2, cy); ctx.rotate(rot); ctx.globalAlpha = 1 - outP;
  ctx.shadowColor = "rgba(0,0,0,.35)"; ctx.shadowBlur = 50 * u; ctx.shadowOffsetY = 20 * u;
  ctx.fillStyle = color;
  rr(ctx, -cw / 2, -ch / 2, cw, ch, cw * 0.09); ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.lineWidth = 8 * u; ctx.strokeStyle = "#FFFFFF"; ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,.25)";
  rr(ctx, -cw / 2 + cw * 0.1, -ch / 2 + cw * 0.1, cw * 0.26, ch - cw * 0.2, cw * 0.06); ctx.fill();
  ctx.restore();

  ctx.save(); ctx.globalAlpha = fade(t, 1.5, outAt, D);
  text(ctx, label, w / 2, h * 0.34 + ch * 0.74, i.fonts.heading, 92 * u, inkOf(i), { maxW: w * 0.9, stroke: STROKE, strokeW: 14 * u });
  ctx.restore();
  lowerThird(ctx, i, h * 0.34 + ch * 0.74 + 110 * u, progress(t, 1.7, 2.25) * (1 - progress(t, outAt, D)), data.player, `${Math.round(data.minute)}'`);
}

function sceneSubstitution(ctx: Ctx, i: SceneInput) {
  const { w, h, t, colors: c, data } = i;
  const u = Math.min(w, h) / 1080;
  const D = 4.8;
  const outAt = D - 0.45;
  eventStage(ctx, i, D);
  slam(ctx, i, "CAMBIO", EVENT_LEAD, h * 0.24, 0.16, D, outAt);

  const pw = Math.min(w * 0.86, 1100 * u);
  const ph = 130 * u;
  const x0 = (w - pw) / 2;
  const rowsTop = h * 0.4;
  const exit = easeInCubic(progress(t, outAt, D));
  [
    { y: rowsTop, name: data.playerOut, label: "SALE", color: "#DC2626", up: false, at: 1.2 },
    { y: rowsTop + ph + 36 * u, name: data.playerIn, label: "ENTRA", color: "#16A34A", up: true, at: 1.5 },
  ].forEach((r) => {
    const p = easeOutCubic(progress(t, r.at, r.at + 0.5));
    ctx.save();
    ctx.translate((1 - p + exit) * -w, 0);
    ctx.shadowColor = "rgba(0,0,0,.3)"; ctx.shadowBlur = 30 * u;
    ctx.fillStyle = c.lowerBg; rr(ctx, x0, r.y, pw, ph, 10 * u); ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.fillStyle = r.color; ctx.save(); rr(ctx, x0, r.y, pw, ph, 10 * u); ctx.clip(); ctx.fillRect(x0, r.y, ph, ph); ctx.restore();
    ctx.fillStyle = "#fff"; ctx.beginPath();
    const ax = x0 + ph / 2, ay = r.y + ph / 2, s = ph * 0.22;
    if (r.up) { ctx.moveTo(ax, ay - s); ctx.lineTo(ax + s, ay + s); ctx.lineTo(ax - s, ay + s); }
    else { ctx.moveTo(ax, ay + s); ctx.lineTo(ax + s, ay - s); ctx.lineTo(ax - s, ay - s); }
    ctx.closePath(); ctx.fill();
    text(ctx, r.label, x0 + ph + 30 * u, r.y + ph * 0.3, i.fonts.body, 30 * u, c.lowerAccent, { align: "left" });
    text(ctx, r.name.toUpperCase(), x0 + ph + 30 * u, r.y + ph * 0.66, i.fonts.heading, 48 * u, c.lowerText, { align: "left", maxW: pw - ph - 60 * u });
    ctx.restore();
  });

  ctx.save(); ctx.globalAlpha = fade(t, 2.0, outAt, D);
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
    case "halftime": sceneResult(ctx, input, "MEDIO TIEMPO", "45:00"); break;
    case "fulltime": sceneResult(ctx, input, "FINAL", "90:00"); break;
    case "kickoff": sceneKickoff(ctx, input); break;
    case "yellow": sceneCard(ctx, input, "#FACC15", "TARJETA AMARILLA"); break;
    case "red": sceneCard(ctx, input, "#DC2626", "TARJETA ROJA"); break;
    case "substitution": sceneSubstitution(ctx, input); break;
  }
  ctx.restore();
}

export const templateById = (id: SceneId) => TEMPLATES.find((t) => t.id === id)!;
