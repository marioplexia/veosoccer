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
  teamTitle: string; awardTitle: string; label: string;
  formation: string;
  players: PlayerCard[];
  tableTitle: string;
  results: ResultRow[];
  standings: StandRow[];
  /** Colores de los equipos ("" = automático según el nombre). */
  homeColor: string; homeColor2: string; awayColor: string; awayColor2: string;
  bugTeams: BugTeam[];
  lineup: { team: string; players: { number: number | null; name: string }[] };
  sponsors: { name: string; image?: string }[];
};

export type BugTeam = { name: string; color: string; color2: string; crest?: string };

/** Colores automáticos y estables para un equipo sin colores definidos. */
export function autoTeamColors(name: string): { color: string; color2: string } {
  let hsh = 0;
  for (const ch of name) hsh = (hsh * 31 + ch.charCodeAt(0)) >>> 0;
  const hue = hsh % 360;
  return { color: hsvToHex({ h: hue, s: 0.78, v: 0.72 }), color2: hsvToHex({ h: (hue + 160) % 360, s: 0.65, v: 0.95 }) };
}

/** Renglón de resultados. homeCrest/awayCrest son claves de `images` (escudos). */
export type ResultRow = { home: string; away: string; homeScore: number | null; awayScore: number | null; homeCrest?: string; awayCrest?: string };
export type StandRow = { pos: number; team: string; played: number; gd: number; points: number; crest?: string };
export const MAX_TABLE_ROWS = 20;

export type PlayerCard = { name: string; color: string };
export type SceneImage = { img: CanvasImageSource; w: number; h: number };

export const FORMATIONS = ["4-3-3", "4-4-2", "4-2-3-1", "3-5-2", "3-4-3", "5-3-2", "3-2-1", "2-3-1"] as const;
const CARD_COLORS = ["#DC2626", "#1D4ED8", "#059669", "#7C3AED", "#EA580C", "#0F172A"];

/** "4-3-3" -> [4, 3, 3]. Entre 1 y 5 líneas de 1 a 5 jugadores, máximo 10 de campo; si no, 4-3-3. */
export function parseFormation(s: string): number[] {
  const parts = s.split("-").map((x) => Number(x.trim()));
  const ok = parts.length >= 1 && parts.length <= 5 && parts.every((n) => Number.isInteger(n) && n >= 1 && n <= 5) && parts.reduce((a, b) => a + b, 0) <= 10;
  return ok ? parts : [4, 3, 3];
}

export const DEFAULT_MATCH: MatchData = {
  home: "Leones", away: "Tigres", homeScore: 2, awayScore: 1, side: "home",
  player: "Nombre Apellido", minute: 34, playerOut: "Jugador Sale", playerIn: "Jugador Entra", round: 6, subtitle: "Domingo 8 de noviembre",
  teamTitle: "Equipo ideal de la jornada", awardTitle: "Jugador de la jornada", label: "Ganador", formation: "4-3-3",
  players: Array.from({ length: 11 }, (_, k) => ({ name: `Jugador ${k + 1}`, color: CARD_COLORS[k % CARD_COLORS.length] })),
  tableTitle: "Jornada 6",
  results: [
    ["Leones", "Tigres", 5, 0], ["Águilas", "Halcones", 2, 1], ["Lobos", "Toros", 1, 0], ["Búhos", "Pumas", 4, 4], ["Cóndores", "Jaguares", 1, 0],
    ["Delfines", "Osos", 1, 1], ["Zorros", "Panteras", 1, 1], ["Coyotes", "Linces", 1, 0], ["Venados", "Gallos", 2, 1], ["Potros", "Rayos", 1, 4],
  ].map(([home, away, hs, as]) => ({ home: home as string, away: away as string, homeScore: hs as number, awayScore: as as number })),
  standings: ["Leones", "Águilas", "Lobos", "Búhos", "Cóndores", "Delfines", "Zorros", "Coyotes", "Venados", "Potros"].map((team, k) => ({
    pos: k + 1, team, played: 6, gd: 12 - k * 3, points: 16 - k * 1 - (k > 4 ? 2 : 0),
  })),
  homeColor: "", homeColor2: "", awayColor: "", awayColor2: "",
  bugTeams: [["Leones", "#C8102E", "#1D4ED8"], ["Tigres", "#F59E0B", "#111827"], ["Águilas", "#1D4ED8", "#FFFFFF"], ["Lobos", "#4B5563", "#F43F5E"], ["Búhos", "#7C2D12", "#FACC15"], ["Halcones", "#0F766E", "#A7F3D0"]]
    .map(([name, color, color2]) => ({ name, color, color2 })),
  lineup: { team: "Leones", players: ["Portero Uno", "Lateral Dos", "Central Tres", "Central Cuatro", "Lateral Cinco", "Medio Seis", "Medio Ocho", "Medio Diez", "Extremo Siete", "Delantero Nueve", "Extremo Once"].map((name, k) => ({ number: [1, 2, 3, 4, 5, 6, 8, 10, 7, 9, 11][k], name })) },
  sponsors: [{ name: "Tu patrocinador" }],
};

export type SceneId = "lineup" | "teamGoal" | "teamBugs" | "ident" | "matchday" | "matchup" | "totw" | "potw" | "results" | "standings" | "goal" | "halftime" | "fulltime" | "kickoff" | "yellow" | "red" | "substitution";
export type FieldKey = "match" | "home" | "away" | "homeScore" | "awayScore" | "side" | "player" | "minute" | "playerOut" | "playerIn" | "round" | "subtitle" | "homeLogo" | "awayLogo" | "teamLogo" | "photo" | "teamTitle" | "awardTitle" | "label" | "formation" | "players" | "resultsPick" | "standingsPick" | "tableTitle" | "background" | "teamColors" | "bugTeamsPick" | "lineupPick";

export type TemplateDef = { id: SceneId; kind: BrandKind; label: string; description: string; duration: number; fields: FieldKey[]; format?: FormatId; poster?: number };

export const TEMPLATES: TemplateDef[] = [
  { id: "ident", kind: "tournament", label: "Intro con logo", description: "Panel de color que cambia, pasa a blanco mientras el logo gira y florece el siguiente color.", duration: 5.8, fields: [] },
  { id: "matchday", kind: "tournament", label: "Anuncio de jornada", description: "Presenta la jornada con el nombre del torneo.", duration: 5, fields: ["round", "subtitle"] },
  { id: "matchup", kind: "tournament", label: "Presentación de partido", description: "Los dos escudos con tu logo al centro, el partido y la fecha.", duration: 5, fields: ["match", "home", "away", "homeLogo", "awayLogo", "subtitle"], poster: 3.5 },
  { id: "totw", kind: "tournament", label: "Equipo ideal", description: "Cancha con las tarjetas de los jugadores en su formación.", duration: 5, fields: ["teamTitle", "round", "formation", "players"], format: "portrait", poster: 4 },
  { id: "potw", kind: "tournament", label: "Jugador de la jornada", description: "Foto y nombre del jugador destacado.", duration: 5, fields: ["awardTitle", "label", "round", "player", "photo", "teamLogo"], format: "portrait", poster: 4 },
  { id: "lineup", kind: "broadcast", label: "Alineación", description: "Plantilla del equipo con dorsales, con el mismo movimiento que la tabla.", duration: 10, fields: ["lineupPick", "background"], poster: 5 },
  { id: "teamGoal", kind: "broadcast", label: "Gol del equipo", description: "Marcador del equipo con sus colores y escudo: cae “GOL” letra por letra, corre el reloj y aparece el resultado.", duration: 6, fields: ["match", "home", "away", "homeScore", "awayScore", "side", "minute", "teamColors"], poster: 3 },
  { id: "teamBugs", kind: "broadcast", label: "Marcadores de equipos", description: "Columna con el marcador de cada equipo, animándose uno tras otro.", duration: 8, fields: ["bugTeamsPick", "minute"], format: "vertical", poster: 5 },
  { id: "results", kind: "broadcast", label: "Resultados de la jornada", description: "Lista de resultados con escudos; sale con barrido de color y deja ver tu foto de fondo.", duration: 10, fields: ["resultsPick", "tableTitle", "background"], poster: 5 },
  { id: "standings", kind: "broadcast", label: "Tabla de posiciones", description: "Tabla con escudos y puntos, con el mismo movimiento que los resultados.", duration: 10, fields: ["standingsPick", "tableTitle", "background"], poster: 5 },
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
  portrait: { label: "Retrato 4:5 (1080×1350)", w: 1080, h: 1350 },
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
  images?: Record<string, SceneImage>;
  /** Paleta de identidad (Marca del Torneo). Si existe, los paneles de color animados la usan. */
  palette?: string[];
  tournamentName: string;
  data: MatchData;
};

/* ───────────── utilidades de dibujo ───────────── */

export const fontStr = (f: FontSpec, px: number) => `${f.italic ? "italic " : ""}${f.weight} ${Math.max(1, Math.round(px))}px "${f.family}", system-ui, sans-serif`;

function fitPx(ctx: Ctx, s: string, f: FontSpec, px: number, maxW: number) {
  ctx.font = fontStr(f, px);
  const m = ctx.measureText(s).width;
  return m > maxW && m > 0 ? px * (maxW / m) : px;
}

type TextOpts = { align?: CanvasTextAlign; maxW?: number; stroke?: string; strokeW?: number; alpha?: number };
export function text(ctx: Ctx, s: string, x: number, y: number, f: FontSpec, px: number, color: string, o: TextOpts = {}) {
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

export function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
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

/** Colores de los paneles animados: la paleta de identidad si se indicó; si no, la de la marca de la pieza. */
export function paletteOf(i: Pick<SceneInput, "kind" | "colors" | "palette">): string[] {
  const p = (i.palette ?? []).filter((c) => /^#[0-9A-Fa-f]{6}$/.test(c));
  return p.length >= 2 ? p : washPalette(i.kind, i.colors);
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
const hueDist = (a: number, b: number) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

/**
 * Transición entre dos colores de la marca sin inventar tonos ajenos:
 * - Si son cercanos (y el recorrido pasa cerca de la paleta), recorre el matiz entre ellos.
 * - Si son lejanos, pasa por un tono casi blanco ("un color, blanco, y luego el otro"),
 *   así nunca aparece, por ejemplo, un naranja que no está en tu marca.
 */
export function vividMix(a: string, b: string, k: number, pal?: string[]): string {
  const x = hexToHsv(a), y = hexToHsv(b);
  if (x.s < 0.15 || y.s < 0.15) return mix(a, b, k);
  let dh = y.h - x.h;
  if (dh > 180) dh -= 360;
  if (dh < -180) dh += 360;
  const hues = (pal ?? [a, b]).map(hexToHsv).filter((c) => c.s >= 0.15).map((c) => c.h);
  const near = (h: number) => Math.min(...hues.map((q) => hueDist(((h % 360) + 360) % 360, q)));
  const closeEnough = Math.abs(dh) <= 100 && [0.25, 0.5, 0.75].every((f) => near(x.h + dh * f) <= 45);
  if (closeEnough) return hsvToHex({ h: x.h + dh * k, s: lerp(x.s, y.s, k), v: lerp(x.v, y.v, k) });
  // Destello blanco angosto en el centro: los extremos conservan su color pleno.
  return mix(mix(a, b, k), "#FFFFFF", 0.7 * Math.pow(Math.sin(Math.PI * clamp01(k)), 4));
}
export function samplePalette(pal: string[], x: number): string {
  const n = pal.length;
  const k = ((x % n) + n) % n;
  const i0 = Math.floor(k);
  return vividMix(pal[i0], pal[(i0 + 1) % n], k - i0, pal);
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
    const pal = paletteOf(i);
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
      g.addColorStop(0.5, vividMix(ca, cb, 0.5, pal));
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

/** Iniciales para el respaldo del logo: "Liga Municipal de Fútbol" -> "LMF" (máx. 3). */
export function initials(name: string): string {
  const skip = new Set(["de", "del", "la", "las", "el", "los", "y"]);
  const words = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/[^A-Za-z0-9]+/).filter((w) => w && !skip.has(w.toLowerCase()));
  const s = words.slice(0, 3).map((w) => w[0].toUpperCase()).join("");
  return s || "•";
}

/* ───────────── carteles: partido, equipo ideal, jugador de la jornada ───────────── */

const appear = (t: number, k: number) => easeOutCubic(progress(t, 0.15 + k * 0.12, 0.65 + k * 0.12));

function brandGradient(ctx: Ctx, i: SceneInput, x0: number, y0: number, x1: number, y1: number) {
  const pal = paletteOf(i);
  const ph = 0.12 * Math.sin(i.t * 0.9) + 0.12; // vaivén suave alrededor del primer par de colores
  const a = samplePalette(pal, ph), b = samplePalette(pal, ph + 1);
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, a); g.addColorStop(0.5, vividMix(a, b, 0.5, pal)); g.addColorStop(1, b);
  return g;
}

function posterBase(ctx: Ctx, i: SceneInput) {
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, i.w, i.h);
  shards(ctx, i.w, i.h, i.t, inkOf(i), 0.02);
}

export function contain(ctx: Ctx, im: SceneImage, cx: number, cy: number, maxW: number, maxH: number) {
  const k = Math.min(maxW / im.w, maxH / im.h);
  ctx.drawImage(im.img, cx - (im.w * k) / 2, cy - (im.h * k) / 2, im.w * k, im.h * k);
}
/** Rellena el rectángulo recortando la imagen (prioriza la parte superior, donde suele estar la cara). */
function cover(ctx: Ctx, im: SceneImage, x: number, y: number, w: number, h: number) {
  const k = Math.max(w / im.w, h / im.h);
  const sw = w / k, sh = h / k;
  ctx.drawImage(im.img, (im.w - sw) / 2, (im.h - sh) * 0.2, sw, sh, x, y, w, h);
}

export function wrapLines(ctx: Ctx, s: string, f: FontSpec, px: number, maxW: number, maxLines = 2): string[] {
  ctx.font = fontStr(f, px);
  const lines: string[] = [];
  let cur = "";
  for (const word of s.trim().split(/\s+/).filter(Boolean)) {
    const test = cur ? `${cur} ${word}` : word;
    if (cur && ctx.measureText(test).width > maxW && lines.length < maxLines - 1) { lines.push(cur); cur = word; } else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}

function silhouette(ctx: Ctx, cx: number, top: number, w: number, h: number) {
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,.4)";
  ctx.beginPath(); ctx.arc(cx, top + h * 0.38, h * 0.2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx, top + h * 1.02, w * 0.3, h * 0.38, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/** Escudo de un equipo; si no se subió imagen, un círculo con sus siglas. */
function teamBadge(ctx: Ctx, i: SceneInput, key: string, name: string, cx: number, cy: number, size: number) {
  const u = Math.min(i.w, i.h) / 1080;
  const im = i.images?.[key];
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.18)"; ctx.shadowBlur = 30 * u; ctx.shadowOffsetY = 8 * u;
  if (im) contain(ctx, im, cx, cy, size, size);
  else {
    ctx.fillStyle = inkOf(i);
    ctx.beginPath(); ctx.arc(cx, cy, size * 0.42, 0, Math.PI * 2); ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.lineWidth = 8 * u; ctx.strokeStyle = "#FFFFFF"; ctx.stroke();
    text(ctx, abbreviation(name, "?"), cx, cy, i.fonts.heading, size * 0.26, "#FFFFFF", { maxW: size * 0.7 });
  }
  ctx.restore();
}

function leagueLogo(ctx: Ctx, i: SceneInput, cx: number, cy: number, size: number) {
  const u = Math.min(i.w, i.h) / 1080;
  ctx.save();
  ctx.shadowColor = "rgba(255,255,255,.95)"; ctx.shadowBlur = 24 * u;
  if (!drawLogo(ctx, i, cx, cy, size, size)) {
    // Sin logo: círculo de marca con las iniciales del torneo ("Liga Municipal" -> "LM").
    ctx.fillStyle = inkOf(i);
    ctx.beginPath(); ctx.arc(cx, cy, size * 0.42, 0, Math.PI * 2); ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.lineWidth = Math.max(3, size * 0.045); ctx.strokeStyle = "#FFFFFF"; ctx.stroke();
    text(ctx, initials(i.tournamentName), cx, cy, i.fonts.heading, size * 0.3, "#FFFFFF", { maxW: size * 0.62 });
  }
  ctx.restore();
}

/** Banda superior de color con el logo colgando; devuelve la coordenada Y donde sigue el contenido. */
function topBand(ctx: Ctx, i: SceneInput): number {
  const { w, t } = i;
  const u = Math.min(i.w, i.h) / 1080;
  const bandH = 70 * u;
  const a = appear(t, 0);
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(0, (1 - a) * -bandH);
  ctx.fillStyle = brandGradient(ctx, i, w * 0.1, 0, w * 0.9, 0);
  rr(ctx, w * 0.1, -40 * u, w * 0.8, bandH + 40 * u, 30 * u); ctx.fill();
  leagueLogo(ctx, i, w / 2, bandH * 1.05, 120 * u);
  ctx.restore();
  return bandH + 105 * u;
}

function sceneMatchup(ctx: Ctx, i: SceneInput) {
  const { w, h, t, data } = i;
  const u = Math.min(w, h) / 1080;
  const ink = inkOf(i);
  const horizontal = w >= h;
  posterBase(ctx, i);

  const p0 = appear(t, 0);
  const R = 60 * u;
  ctx.save();
  ctx.globalAlpha = p0;
  if (horizontal) { ctx.translate((p0 - 1) * w * 0.15, 0); rr(ctx, -R, 0, w * 0.5 + R, h, R); }
  else { ctx.translate(0, (p0 - 1) * h * 0.15); rr(ctx, 0, -R, w, h * 0.5 + R, R); }
  ctx.fillStyle = horizontal ? brandGradient(ctx, i, 0, 0, w * 0.5, h) : brandGradient(ctx, i, 0, 0, w, h * 0.5);
  ctx.fill();
  ctx.clip();
  shards(ctx, w, h, t * 1.4, "#FFFFFF", 0.12);
  ctx.restore();

  // "<torneo> presenta"
  ctx.save(); ctx.globalAlpha = appear(t, 1);
  const hx = w * 0.05, hy = horizontal ? h * 0.11 : h * 0.06;
  const namePx = fitPx(ctx, i.tournamentName, i.fonts.heading, 56 * u, w * (horizontal ? 0.3 : 0.6));
  text(ctx, i.tournamentName, hx, hy, i.fonts.heading, namePx, ink, { align: "left" });
  ctx.font = fontStr(i.fonts.heading, namePx);
  const nameW = ctx.measureText(i.tournamentName).width;
  text(ctx, "presenta", hx + nameW + namePx * 0.3, hy, i.fonts.body, namePx, ink, { align: "left" });
  ctx.restore();

  const S = horizontal ? Math.min(w * 0.3, h * 0.5) : Math.min(w * 0.5, h * 0.24);
  const pos = horizontal
    ? { home: [w * 0.25, h * 0.52], away: [w * 0.75, h * 0.5], mid: [w * 0.5, h * 0.52], midS: S * 0.8 }
    : { home: [w * 0.5, h * 0.27], away: [w * 0.5, h * 0.72], mid: [w * 0.5, h * 0.5], midS: S * 0.62 };
  const pop = (k: number, fn: () => void, cx: number, cy: number) => {
    const p = progress(t, 0.35 + k * 0.18, 0.9 + k * 0.18);
    if (p <= 0) return;
    ctx.save(); ctx.translate(cx, cy); ctx.scale(lerp(0.6, 1, easeOutBack(p)), lerp(0.6, 1, easeOutBack(p))); ctx.translate(-cx, -cy);
    ctx.globalAlpha = clamp01(p * 2.5); fn(); ctx.restore();
  };
  pop(0, () => teamBadge(ctx, i, "homeLogo", data.home, pos.home[0], pos.home[1], S), pos.home[0], pos.home[1]);
  pop(1, () => teamBadge(ctx, i, "awayLogo", data.away, pos.away[0], pos.away[1], S), pos.away[0], pos.away[1]);
  pop(2, () => leagueLogo(ctx, i, pos.mid[0], pos.mid[1], pos.midS), pos.mid[0], pos.mid[1]);

  ctx.save(); ctx.globalAlpha = appear(t, 6);
  const tx = horizontal ? w * 0.75 : w * 0.5;
  const ty = horizontal ? h * 0.86 : h * 0.9;
  text(ctx, `${data.home} v ${data.away}`, tx, ty, i.fonts.heading, 46 * u, ink, { maxW: w * (horizontal ? 0.44 : 0.9) });
  text(ctx, data.subtitle, tx, ty + 56 * u, i.fonts.body, 40 * u, ink, { maxW: w * (horizontal ? 0.44 : 0.9) });
  ctx.restore();
}

function playerCard(ctx: Ctx, i: SceneInput, p: PlayerCard, idx: number, cx: number, cy: number, S: number) {
  const x = cx - S / 2, y = cy - S / 2;
  const im = i.images?.[`p${idx}`];
  const nameH = S * 0.27;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.25)"; ctx.shadowBlur = S * 0.12; ctx.shadowOffsetY = S * 0.04;
  ctx.fillStyle = p.color;
  rr(ctx, x, y, S, S, S * 0.12); ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.clip();
  const sheen = ctx.createLinearGradient(x, y, x + S, y + S);
  sheen.addColorStop(0, "rgba(255,255,255,.22)"); sheen.addColorStop(0.6, "rgba(255,255,255,0)");
  ctx.fillStyle = sheen; ctx.fillRect(x, y, S, S);
  if (im) cover(ctx, im, x, y, S, S - nameH);
  else silhouette(ctx, cx, y, S, S - nameH);
  ctx.fillStyle = p.color; ctx.fillRect(x, y + S - nameH, S, nameH);
  ctx.fillStyle = "rgba(0,0,0,.16)"; ctx.fillRect(x, y + S - nameH, S, nameH);
  ctx.restore();
  text(ctx, p.name, cx, y + S - nameH / 2, i.fonts.heading, S * 0.14, readableOn(p.color), { maxW: S * 0.9 });
}

function sceneTotw(ctx: Ctx, i: SceneInput) {
  const { w, h, t, colors: c, data } = i;
  const u = Math.min(w, h) / 1080;
  const ink = inkOf(i);
  posterBase(ctx, i);
  let y = topBand(ctx, i);

  ctx.save(); ctx.globalAlpha = appear(t, 1);
  const titlePx = 92 * u;
  const lines = wrapLines(ctx, data.teamTitle, i.fonts.heading, titlePx, w * 0.86);
  y += titlePx * 0.75;
  for (const line of lines) { text(ctx, line, w / 2, y, i.fonts.heading, titlePx, ink, { maxW: w * 0.9 }); y += titlePx * 1.05; }
  ctx.restore();

  ctx.save(); ctx.globalAlpha = appear(t, 2);
  const pill = `Jornada ${data.round}`;
  ctx.font = fontStr(i.fonts.body, 50 * u);
  const pw = ctx.measureText(pill).width + 90 * u;
  ctx.fillStyle = c.secondary; rr(ctx, w / 2 - pw / 2, y - titlePx * 0.45, pw, 74 * u, 16 * u); ctx.fill();
  text(ctx, pill, w / 2, y - titlePx * 0.45 + 37 * u, i.fonts.body, 50 * u, readableOn(c.secondary));
  ctx.restore();
  y += 74 * u;

  // cancha
  const top = y, bottom = h - 24 * u;
  const inset = w * 0.09;
  const pa = appear(t, 3);
  ctx.save(); ctx.globalAlpha = pa;
  ctx.beginPath();
  ctx.moveTo(inset, top); ctx.lineTo(w - inset, top); ctx.lineTo(w + 4, top + (bottom - top) * 0.6); ctx.lineTo(w + 4, bottom + 4); ctx.lineTo(-4, bottom + 4); ctx.lineTo(-4, top + (bottom - top) * 0.6);
  ctx.closePath();
  const pg = ctx.createLinearGradient(0, top, 0, bottom);
  pg.addColorStop(0, "#E4E4EA"); pg.addColorStop(1, "#F4F4F7");
  ctx.fillStyle = pg; ctx.fill();
  ctx.lineWidth = 3 * u; ctx.strokeStyle = c.primary; ctx.stroke();
  ctx.clip();
  ctx.strokeStyle = "#FFFFFF"; ctx.lineWidth = 4 * u;
  const midY = top + (bottom - top) * 0.6;
  ctx.beginPath(); ctx.moveTo(0, midY); ctx.lineTo(w, midY); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(w / 2, midY, w * 0.16, (bottom - top) * 0.11, 0, 0, Math.PI * 2); ctx.stroke();
  rr(ctx, w * 0.26, top - 20 * u, w * 0.48, (bottom - top) * 0.19 + 20 * u, 12 * u); ctx.stroke();
  rr(ctx, w * 0.4, top - 20 * u, w * 0.2, (bottom - top) * 0.07 + 20 * u, 8 * u); ctx.stroke();
  ctx.restore();

  // tarjetas: portero arriba y luego cada línea
  const rows = [1, ...parseFormation(data.formation)];
  const gap = (bottom - top) / rows.length;
  const S = Math.min(gap * 0.76, (w * 0.86) / (Math.max(...rows) * 1.22));
  let idx = 0;
  rows.forEach((n, r) => {
    const cy = top + gap * (r + 0.5);
    const spacing = Math.min(S * 1.55, (w * 0.9) / n);
    for (let j = 0; j < n; j++) {
      const p = data.players[idx];
      const cx = w / 2 + (j - (n - 1) / 2) * spacing;
      const k = progress(t, 0.7 + idx * 0.07, 1.15 + idx * 0.07);
      if (p && k > 0) {
        const sc = lerp(0.5, 1, easeOutBack(k));
        ctx.save(); ctx.translate(cx, cy); ctx.scale(sc, sc); ctx.globalAlpha = clamp01(k * 2.5);
        playerCard(ctx, i, p, idx, 0, 0, S);
        ctx.restore();
      }
      idx++;
    }
  });
}

function scenePotw(ctx: Ctx, i: SceneInput) {
  const { w, h, t, data } = i;
  const u = Math.min(w, h) / 1080;
  const ink = inkOf(i);
  posterBase(ctx, i);
  let y = topBand(ctx, i) + 40 * u;

  // píldora "Jornada N | GANADOR"
  ctx.save(); ctx.globalAlpha = appear(t, 1);
  const left = `Jornada ${data.round}`, right = data.label.toUpperCase();
  const px = 44 * u, ph = 70 * u;
  ctx.font = fontStr(i.fonts.body, px); const lw = ctx.measureText(left).width + 50 * u;
  ctx.font = fontStr(i.fonts.heading, px); const rw = right ? ctx.measureText(right).width + 50 * u : 0;
  const x0 = w / 2 - (lw + rw) / 2;
  ctx.save(); rr(ctx, x0, y, lw + rw, ph, 14 * u); ctx.clip();
  ctx.fillStyle = brandGradient(ctx, i, x0, 0, x0 + lw, 0); ctx.fillRect(x0, y, lw, ph);
  ctx.fillStyle = ink; ctx.fillRect(x0 + lw, y, rw, ph);
  ctx.restore();
  text(ctx, left, x0 + lw / 2, y + ph / 2, i.fonts.body, px, ink);
  if (right) text(ctx, right, x0 + lw + rw / 2, y + ph / 2, i.fonts.heading, px, readableOn(ink));
  ctx.restore();
  y += ph + 30 * u;

  ctx.save(); ctx.globalAlpha = appear(t, 2);
  const titlePx = 118 * u;
  const lines = wrapLines(ctx, data.awardTitle.toUpperCase(), i.fonts.heading, titlePx, w * 0.88);
  y += titlePx * 0.55;
  for (const line of lines) { text(ctx, line, w / 2, y, i.fonts.heading, titlePx, ink, { maxW: w * 0.9 }); y += titlePx * 0.98; }
  ctx.restore();
  y -= titlePx * 0.35;

  // marco con la foto y el nombre
  const bottomBand = 70 * u;
  const fTop = y, fBottom = h - bottomBand - 90 * u;
  const fh = Math.max(fBottom - fTop, 100 * u);
  const fw = Math.min(w * 0.6, fh * 0.9);
  const fx = w / 2 - fw / 2;
  const nameH = Math.min(110 * u, fh * 0.2);
  const k = progress(t, 0.6, 1.2);
  if (k > 0) {
    const sc = lerp(0.85, 1, easeOutBack(k));
    ctx.save();
    ctx.translate(w / 2, fTop + fh / 2); ctx.scale(sc, sc); ctx.translate(-w / 2, -(fTop + fh / 2));
    ctx.globalAlpha = clamp01(k * 2);
    ctx.shadowColor = "rgba(0,0,0,.2)"; ctx.shadowBlur = 40 * u; ctx.shadowOffsetY = 12 * u;
    ctx.fillStyle = "#E5E7EB"; rr(ctx, fx, fTop, fw, fh, 26 * u); ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.save(); ctx.clip();
    const im = i.images?.photo;
    if (im) cover(ctx, im, fx, fTop, fw, fh - nameH);
    else { ctx.fillStyle = ink; ctx.fillRect(fx, fTop, fw, fh - nameH); silhouette(ctx, w / 2, fTop, fw, fh - nameH); }
    ctx.fillStyle = brandGradient(ctx, i, fx, 0, fx + fw, 0); ctx.fillRect(fx, fTop + fh - nameH, fw, nameH);
    ctx.restore();
    ctx.lineWidth = 5 * u; ctx.strokeStyle = "#FFFFFF"; rr(ctx, fx, fTop, fw, fh, 26 * u); ctx.stroke();
    text(ctx, data.player, w / 2, fTop + fh - nameH / 2, i.fonts.heading, nameH * 0.5, ink, { maxW: fw * 0.9 });
    ctx.restore();
  }

  // banda inferior con el escudo del equipo
  const a = appear(t, 5);
  ctx.save(); ctx.globalAlpha = a; ctx.translate(0, (1 - a) * bottomBand);
  ctx.fillStyle = brandGradient(ctx, i, w * 0.12, 0, w * 0.88, 0);
  rr(ctx, w * 0.12, h - bottomBand, w * 0.76, bottomBand + 40 * u, 30 * u); ctx.fill();
  const logo = i.images?.teamLogo;
  if (logo) contain(ctx, logo, w / 2, h - bottomBand - 5 * u, 130 * u, 130 * u);
  ctx.restore();
}

/* ───────────── tabla animada (resultados / posiciones), 10 s ───────────── */

export const TABLE_T = { panelIn: 0.6, rowsAt: 0.75, rowStep: 0.11, spotFrom: 2.4, spotTo: 7.2, exitAt: 7.4, logoOut: 8.15, expandAt: 8.5, revealAt: 9.15, D: 10 };

function crest(ctx: Ctx, i: SceneInput, key: string | undefined, name: string, cx: number, cy: number, size: number) {
  const im = key ? i.images?.[key] : undefined;
  if (im) { contain(ctx, im, cx, cy, size, size); return; }
  ctx.save();
  ctx.fillStyle = inkOf(i);
  ctx.beginPath(); ctx.arc(cx, cy, size * 0.45, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  text(ctx, abbreviation(name, "?").slice(0, 2), cx, cy, i.fonts.heading, size * 0.38, "#FFFFFF");
}

/** Estado del panel de color durante la salida: 0 normal, 1 cubre toda la pantalla. */
function tableLayout(i: SceneInput) {
  const { w, h } = i;
  const horizontal = w >= h;
  const u = Math.min(w, h) / 1080;
  return horizontal
    ? { horizontal, u, panel: { x: 0, y: 0, w: w * 0.16, h }, list: { x: w * 0.22, y: h * 0.08, w: w * 0.52, h: h * 0.86 }, strip: { x: w * 0.79, y: 0, w: w * 0.21, h }, logo: { x: w * 0.16, y: h * 0.52, s: Math.min(h * 0.4, w * 0.16) } }
    : { horizontal, u, panel: { x: 0, y: 0, w, h: h * 0.14 }, list: { x: w * 0.06, y: h * 0.19, w: w * 0.88, h: h * 0.68 }, strip: { x: 0, y: h * 0.89, w, h: h * 0.11 }, logo: { x: w / 2, y: h * 0.14, s: Math.min(w * 0.3, h * 0.13) } };
}

function tableScene(ctx: Ctx, i: SceneInput, title: string, n: number, header: ((x: number, y: number, rh: number) => void) | null, drawRow: (k: number, x: number, y: number, rw: number, rh: number) => void) {
  const { w, h, t } = i;
  const T = TABLE_T;
  const L = tableLayout(i);
  const { u } = L;
  const ink = inkOf(i);
  const bg = i.images?.background;

  ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, w, h);
  shards(ctx, w, h, t, ink, 0.025);

  // franja con la foto de fondo
  const stripIn = easeOutCubic(progress(t, 0.5, 1.1));
  ctx.save();
  if (L.horizontal) ctx.translate((1 - stripIn) * L.strip.w, 0); else ctx.translate(0, (1 - stripIn) * L.strip.h);
  rr(ctx, L.strip.x, L.strip.y, L.strip.w, L.strip.h, L.horizontal ? 0 : 0);
  ctx.clip();
  if (bg) cover(ctx, bg, L.strip.x, L.strip.y, L.strip.w, L.strip.h);
  else { ctx.fillStyle = brandGradient(ctx, i, L.strip.x, L.strip.y, L.strip.x + L.strip.w, L.strip.y + L.strip.h); ctx.fillRect(L.strip.x, L.strip.y, L.strip.w, L.strip.h); shards(ctx, w, h, t * 1.3, "#FFFFFF", 0.14); }
  ctx.restore();

  // encabezado
  const headA = easeOutCubic(progress(t, 0.45, 0.95)) * (1 - easeInCubic(progress(t, T.exitAt + 0.5, T.exitAt + 0.9)));
  const count = Math.max(0, Math.min(n, MAX_TABLE_ROWS));
  const n2 = Math.max(1, count); // para medir; con 0 renglones no se dibuja ninguno
  const headH = 70 * u;
  const colH = header ? 46 * u : 0;
  const rh = Math.min(84 * u, (L.list.h - headH - colH) / n2);
  const listH = headH + colH + rh * n2;
  const top = L.list.y + (L.list.h - listH) / 2;
  ctx.save(); ctx.globalAlpha = headA;
  ctx.font = fontStr(i.fonts.heading, 30 * u);
  const nameW = ctx.measureText(i.tournamentName).width;
  ctx.font = fontStr(i.fonts.body, 30 * u);
  const titleW = ctx.measureText(title).width;
  const hx = L.list.x + L.list.w / 2 - (nameW + 14 * u + titleW) / 2;
  text(ctx, i.tournamentName, hx, top + headH / 2, i.fonts.heading, 30 * u, ink, { align: "left" });
  text(ctx, title, hx + nameW + 14 * u, top + headH / 2, i.fonts.body, 30 * u, ink, { align: "left" });
  if (header) header(L.list.x, top + headH + colH / 2, colH);
  ctx.restore();

  // renglones: entran escalonados, un resaltado recorre la lista, y salen de abajo hacia arriba
  const y0 = top + headH + colH;
  const spotSpan = (T.spotTo - T.spotFrom) / n2;
  for (let k = 0; k < count; k++) {
    const inP = easeOutCubic(progress(t, T.rowsAt + k * T.rowStep, T.rowsAt + k * T.rowStep + 0.45));
    const outStart = T.exitAt + (n2 - 1 - k) * Math.min(0.06, 0.7 / n2);
    const outP = easeInCubic(progress(t, outStart, outStart + 0.22));
    if (inP <= 0 || outP >= 1) continue;
    const y = y0 + k * rh;
    ctx.save();
    ctx.beginPath(); ctx.rect(L.list.x - 20 * u, y, L.list.w + 40 * u, rh * (1 - outP)); ctx.clip();
    ctx.globalAlpha = inP;
    ctx.translate(0, (1 - inP) * rh * 0.6);
    // resaltado
    const sp = progress(t, T.spotFrom + k * spotSpan, T.spotFrom + (k + 1.4) * spotSpan);
    const glow = Math.sin(Math.PI * sp);
    if (glow > 0.01) {
      ctx.save(); ctx.globalAlpha = inP * 0.16 * glow;
      ctx.fillStyle = brandGradient(ctx, i, L.list.x, 0, L.list.x + L.list.w, 0);
      rr(ctx, L.list.x - 10 * u, y + rh * 0.08, L.list.w + 20 * u, rh * 0.84, 12 * u); ctx.fill();
      ctx.restore();
    }
    ctx.strokeStyle = "rgba(15,23,42,.08)"; ctx.lineWidth = 2 * u;
    ctx.beginPath(); ctx.moveTo(L.list.x, y + rh); ctx.lineTo(L.list.x + L.list.w, y + rh); ctx.stroke();
    drawRow(k, L.list.x, y, L.list.w, rh);
    ctx.restore();
  }

  // panel de color: entra, se mantiene; en la salida se expande hasta cubrir y se retira
  const pal = paletteOf(i);
  const inK = easeOutCubic(progress(t, 0, T.panelIn));
  const expand = easeInOutCubic(progress(t, T.expandAt, T.revealAt));
  const leave = easeInOutCubic(progress(t, T.revealAt, T.D - 0.15));
  const R = 70 * u;
  let px: number, py: number, pw: number, ph: number;
  if (L.horizontal) {
    const baseW = L.panel.w * inK;
    const right = lerp(baseW, w + R, expand);
    px = lerp(0, w + R, leave); py = 0; pw = Math.max(0, right - px); ph = h;
  } else {
    const baseH = L.panel.h * inK;
    const bottom = lerp(baseH, h + R, expand);
    px = 0; py = lerp(0, h + R, leave); pw = w; ph = Math.max(0, bottom - py);
  }
  if (t >= T.revealAt && bg) {
    // la foto completa aparece debajo del panel que se retira
    ctx.save();
    if (L.horizontal) { ctx.beginPath(); ctx.rect(0, 0, px + R, h); ctx.clip(); } else { ctx.beginPath(); ctx.rect(0, 0, w, py + R); ctx.clip(); }
    cover(ctx, bg, 0, 0, w, h);
    ctx.restore();
  } else if (t >= T.revealAt) {
    ctx.save();
    if (L.horizontal) { ctx.beginPath(); ctx.rect(0, 0, px + R, h); ctx.clip(); } else { ctx.beginPath(); ctx.rect(0, 0, w, py + R); ctx.clip(); }
    ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, w, h);
    leagueLogo(ctx, i, w / 2, h / 2, Math.min(w, h) * 0.35 * easeOutBack(progress(t, T.revealAt + 0.2, T.D - 0.1)));
    ctx.restore();
  }
  if (pw > 0 && ph > 0) {
    ctx.save();
    ctx.beginPath();
    if (L.horizontal) {
      ctx.moveTo(px, py); ctx.lineTo(px + pw - R, py); ctx.arcTo(px + pw, py, px + pw, py + R, R); ctx.lineTo(px + pw, py + ph); ctx.lineTo(px, py + ph);
    } else {
      ctx.moveTo(px, py); ctx.lineTo(px + pw, py); ctx.lineTo(px + pw, py + ph - R); ctx.arcTo(px + pw, py + ph, px + pw - R, py + ph, R); ctx.lineTo(px, py + ph);
    }
    ctx.closePath(); ctx.clip();
    const ph0 = t * 0.1;
    const g = L.horizontal ? ctx.createLinearGradient(0, 0, Math.max(L.panel.w, pw) * 0.6, h) : ctx.createLinearGradient(0, 0, w, Math.max(L.panel.h, ph));
    const ca = samplePalette(pal, ph0), cb = samplePalette(pal, ph0 + 1);
    g.addColorStop(0, ca); g.addColorStop(0.5, vividMix(ca, cb, 0.5, pal)); g.addColorStop(1, cb);
    ctx.fillStyle = g; ctx.fillRect(px, py, pw, ph);
    shards(ctx, w, h, t * 1.4, cb, 0.25);
    ctx.restore();
  }

  // logo sobre el borde del panel; se encoge y desaparece al salir
  const logoIn = easeOutBack(progress(t, 0.25, 0.85));
  if (logoIn > 0.01 && t < T.logoOut + 0.5) {
    const lp = L.horizontal ? { x: L.panel.w * inK, y: L.logo.y } : { x: L.logo.x, y: L.panel.h * inK };
    const spin = t >= T.logoOut ? progress(t, T.logoOut, T.logoOut + 0.45) : -1;
    ctx.save();
    ctx.translate(lp.x, lp.y); ctx.scale(logoIn, logoIn); ctx.translate(-lp.x, -lp.y);
    if (spin >= 0) spinLogo(ctx, i, lp.x, lp.y, L.logo.s, L.logo.s, spin, true);
    else leagueLogo(ctx, i, lp.x, lp.y, L.logo.s);
    ctx.restore();
  }
}

function sceneResults(ctx: Ctx, i: SceneInput) {
  const rows = i.data.results.slice(0, MAX_TABLE_ROWS);
  const ink = inkOf(i);
  tableScene(ctx, i, i.data.tableTitle, rows.length, null, (k, x, y, rw, rh) => {
    const r = rows[k];
    const cy = y + rh / 2;
    const mid = x + rw / 2;
    const cs = rh * 0.62;
    const px = Math.min(rh * 0.4, 36 * (Math.min(i.w, i.h) / 1080));
    const scoreW = rh * 1.5;
    text(ctx, r.home, mid - scoreW / 2 - cs - rh * 0.3, cy, i.fonts.heading, px, ink, { align: "right", maxW: rw / 2 - scoreW / 2 - cs - rh * 0.4 });
    crest(ctx, i, r.homeCrest, r.home, mid - scoreW / 2 - cs / 2 - rh * 0.12, cy, cs);
    const score = r.homeScore != null && r.awayScore != null ? `${r.homeScore}-${r.awayScore}` : "vs";
    text(ctx, score, mid, cy, i.fonts.numbers, px * 1.05, ink, { maxW: scoreW * 0.9 });
    crest(ctx, i, r.awayCrest, r.away, mid + scoreW / 2 + cs / 2 + rh * 0.12, cy, cs);
    text(ctx, r.away, mid + scoreW / 2 + cs + rh * 0.3, cy, i.fonts.heading, px, ink, { align: "left", maxW: rw / 2 - scoreW / 2 - cs - rh * 0.4 });
  });
}

function sceneStandings(ctx: Ctx, i: SceneInput) {
  const rows = i.data.standings.slice(0, MAX_TABLE_ROWS);
  const ink = inkOf(i);
  const u = Math.min(i.w, i.h) / 1080;
  const cols = (x: number, rw: number) => ({ pos: x + rw * 0.05, crest: x + rw * 0.13, name: x + rw * 0.19, pj: x + rw * 0.7, dg: x + rw * 0.81, pts: x + rw * 0.93 });
  tableScene(ctx, i, i.data.tableTitle, rows.length,
    (x, cy) => {
      const L = tableLayout(i);
      const c = cols(x, L.list.w);
      const px = 24 * u;
      text(ctx, "PJ", c.pj, cy, i.fonts.body, px, ink, { alpha: 0.6 });
      text(ctx, "DG", c.dg, cy, i.fonts.body, px, ink, { alpha: 0.6 });
      text(ctx, "PTS", c.pts, cy, i.fonts.heading, px, ink, { alpha: 0.8 });
    },
    (k, x, y, rw, rh) => {
      const r = rows[k];
      const c = cols(x, rw);
      const cy = y + rh / 2;
      const px = Math.min(rh * 0.4, 36 * u);
      if (k < 1) {
        ctx.save(); ctx.fillStyle = brandGradient(ctx, i, x, 0, x + rw * 0.1, 0);
        rr(ctx, c.pos - rh * 0.32, cy - rh * 0.32, rh * 0.64, rh * 0.64, rh * 0.14); ctx.fill(); ctx.restore();
      }
      text(ctx, String(r.pos), c.pos, cy, i.fonts.numbers, px, ink);
      crest(ctx, i, r.crest, r.team, c.crest, cy, rh * 0.62);
      text(ctx, r.team, c.name, cy, i.fonts.heading, px, ink, { align: "left", maxW: c.pj - c.name - rh * 0.6 });
      text(ctx, String(r.played), c.pj, cy, i.fonts.numbers, px, ink);
      text(ctx, r.gd > 0 ? `+${r.gd}` : String(r.gd), c.dg, cy, i.fonts.numbers, px, ink);
      text(ctx, String(r.points), c.pts, cy, i.fonts.numbers, px * 1.1, ink);
    });
}

/* ───────────── marcador de equipo con animación de gol ───────────── */

export function resolveTeamColors(name: string, color: string, color2: string) {
  const auto = autoTeamColors(name);
  return { color: normalizeTeamHex(color) ?? auto.color, color2: normalizeTeamHex(color2) ?? auto.color2 };
}
function normalizeTeamHex(s: string): string | null {
  return /^#[0-9A-Fa-f]{6}$/.test(s) ? s.toUpperCase() : null;
}

/** Balón simple (círculo blanco con parches), girando. */
function ball(ctx: Ctx, cx: number, cy: number, r: number, rot: number, line: string) {
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(rot);
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = Math.max(1.5, r * 0.09); ctx.strokeStyle = line; ctx.stroke();
  ctx.fillStyle = line;
  const pent = (x: number, y: number, rr2: number) => {
    ctx.beginPath();
    for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + (k * 2 * Math.PI) / 5; ctx.lineTo(x + rr2 * Math.cos(a), y + rr2 * Math.sin(a)); }
    ctx.closePath(); ctx.fill();
  };
  pent(0, 0, r * 0.32);
  for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + (k * 2 * Math.PI) / 5; pent(Math.cos(a) * r * 0.86, Math.sin(a) * r * 0.86, r * 0.2); }
  ctx.restore();
}

/**
 * Marcador de un equipo: siglas | franja en zigzag | escudo | GOL, con el reloj debajo.
 * `tl` es el tiempo local desde que entra la barra. `after` (0-1) cambia GOL por el resultado.
 */
export function teamBug(ctx: Ctx, i: SceneInput, cx: number, top: number, W: number, team: BugTeam, tl: number, o: { clock: string; score?: string; after?: number }) {
  const H = W * 0.105;
  const x0 = cx - W / 2;
  const c = i.colors;
  const txt = readableOn(team.color);
  const inP = easeOutCubic(progress(tl, 0, 0.35));
  if (inP <= 0) return;

  // reloj (sale de detrás de la barra)
  const tabW = W * 0.27, tabH = H * 0.82;
  const tabCx = x0 + W * 0.43;
  const tabP = easeOutCubic(progress(tl, 0.25, 0.6));
  ctx.save();
  ctx.translate(0, (tabP - 1) * tabH);
  ctx.fillStyle = c.scoreBg;
  ctx.beginPath();
  const r = tabH * 0.22;
  ctx.moveTo(tabCx - tabW / 2, top + H - 2);
  ctx.lineTo(tabCx + tabW / 2, top + H - 2);
  ctx.lineTo(tabCx + tabW / 2, top + H + tabH - r);
  ctx.arcTo(tabCx + tabW / 2, top + H + tabH, tabCx + tabW / 2 - r, top + H + tabH, r);
  ctx.lineTo(tabCx - tabW / 2 + r, top + H + tabH);
  ctx.arcTo(tabCx - tabW / 2, top + H + tabH, tabCx - tabW / 2, top + H + tabH - r, r);
  ctx.closePath(); ctx.fill();
  text(ctx, o.clock, tabCx, top + H + tabH * 0.55, i.fonts.numbers, tabH * 0.68, c.clockText, { maxW: tabW * 0.9 });
  ctx.restore();

  // barra (se abre desde el centro)
  ctx.save();
  ctx.translate(cx, 0); ctx.scale(inP, 1); ctx.translate(-cx, 0);
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.22)"; ctx.shadowBlur = H * 0.35; ctx.shadowOffsetY = H * 0.08;
  ctx.fillStyle = team.color;
  rr(ctx, x0, top, W, H, H * 0.08); ctx.fill();
  ctx.restore();
  ctx.save();
  rr(ctx, x0, top, W, H, H * 0.08); ctx.clip();
  // lado de GOL un poco más claro para separar
  const g = ctx.createLinearGradient(x0 + W * 0.45, 0, x0 + W, 0);
  g.addColorStop(0, "rgba(255,255,255,.0)"); g.addColorStop(1, "rgba(255,255,255,.12)");
  ctx.fillStyle = g; ctx.fillRect(x0 + W * 0.45, top, W * 0.55, H);
  // franja en zigzag (rayo) con el segundo color
  const b = x0 + W * 0.3, bw = W * 0.13;
  const bolt = (dx: number, col: string) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(b + dx, top); ctx.lineTo(b + dx + bw * 0.62, top);
    ctx.lineTo(b + dx + bw * 0.42, top + H * 0.46); ctx.lineTo(b + dx + bw, top + H * 0.46);
    ctx.lineTo(b + dx + bw * 0.78, top + H); ctx.lineTo(b + dx + bw * 0.16, top + H);
    ctx.lineTo(b + dx + bw * 0.36, top + H * 0.56); ctx.lineTo(b + dx - bw * 0.1, top + H * 0.56);
    ctx.closePath(); ctx.fill();
  };
  bolt(bw * 0.18, mix(team.color2, "#000000", 0.25));
  bolt(0, team.color2);
  // brillo que cruza la barra de vez en cuando
  for (const at of [1.25, 2.7, 4.2]) {
    const sp = progress(tl, at, at + 0.55);
    if (sp <= 0 || sp >= 1) continue;
    const sx = x0 - W * 0.2 + sp * W * 1.4;
    const sg = ctx.createLinearGradient(sx - W * 0.08, 0, sx + W * 0.08, 0);
    sg.addColorStop(0, "rgba(255,255,255,0)"); sg.addColorStop(0.5, "rgba(255,255,255,.4)"); sg.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = sg;
    ctx.beginPath(); ctx.moveTo(sx - W * 0.06, top + H); ctx.lineTo(sx, top); ctx.lineTo(sx + W * 0.06, top); ctx.lineTo(sx, top + H); ctx.closePath(); ctx.fill();
  }
  ctx.restore();

  // siglas
  text(ctx, abbreviation(team.name, "EQU"), x0 + W * 0.155, top + H / 2, i.fonts.heading, H * 0.66, txt, { maxW: W * 0.26 });

  // GOL letra por letra (la O es un balón), luego el resultado
  const after = clamp01(o.after ?? 0);
  const gx = x0 + W * 0.74;
  const lp = H * 0.74;
  ctx.save();
  ctx.beginPath(); ctx.rect(x0 + W * 0.45, top, W * 0.55, H); ctx.clip();
  if (after < 1) {
    ctx.font = fontStr(i.fonts.heading, lp);
    const wG = ctx.measureText("G").width, wL = ctx.measureText("L").width;
    const wO = lp * 0.78;
    const gap = lp * 0.06;
    const total = wG + wO + wL + gap * 2;
    const xs = [gx - total / 2 + wG / 2, gx - total / 2 + wG + gap + wO / 2, gx + total / 2 - wL / 2];
    ["G", "O", "L"].forEach((ch, k) => {
      const p = progress(tl, 0.55 + k * 0.13, 1.05 + k * 0.13);
      if (p <= 0) return;
      const drop = (1 - easeOutBounce(p)) * -H * 1.2;
      const pulse = 1 + 0.06 * Math.sin(Math.max(0, tl - 1.5) * 6) * (tl > 1.5 ? 1 : 0);
      ctx.save();
      ctx.translate(xs[k], top + H / 2 + drop - after * H);
      ctx.scale(pulse, pulse);
      ctx.globalAlpha = 1 - after;
      // En barras claras el balón usa el color del texto para no perderse sobre el fondo.
      if (ch === "O") ball(ctx, 0, 0, wO * 0.46, tl * 5, contrastRatio(team.color, "#FFFFFF") >= 2.5 ? team.color : txt);
      else text(ctx, ch, 0, 0, i.fonts.heading, lp, txt);
      ctx.restore();
    });
  }
  if (after > 0 && o.score) {
    ctx.save(); ctx.translate(0, (1 - easeOutCubic(after)) * H);
    text(ctx, o.score, gx, top + H / 2, i.fonts.numbers, H * 0.72, txt, { maxW: W * 0.4 });
    ctx.restore();
  }
  ctx.restore();

  // escudo al centro (rebota al anotar)
  const bounce = 1 + 0.18 * Math.sin(Math.PI * progress(tl, 0.5, 0.9));
  const cs = H * 1.32 * bounce;
  const ccx = x0 + W * 0.465, ccy = top + H / 2;
  const im = team.crest ? i.images?.[team.crest] : undefined;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.25)"; ctx.shadowBlur = H * 0.2;
  if (im) contain(ctx, im, ccx, ccy, cs, cs);
  else {
    ctx.fillStyle = "#FFFFFF"; ctx.beginPath(); ctx.arc(ccx, ccy, cs * 0.44, 0, Math.PI * 2); ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.fillStyle = team.color; ctx.beginPath(); ctx.arc(ccx, ccy, cs * 0.36, 0, Math.PI * 2); ctx.fill();
    text(ctx, initials(team.name), ccx, ccy, i.fonts.heading, cs * 0.28, readableOn(team.color), { maxW: cs * 0.6 });
  }
  ctx.restore();
  ctx.restore();
}

function lightBackdrop(ctx: Ctx, i: SceneInput) {
  const g = ctx.createLinearGradient(0, 0, 0, i.h);
  g.addColorStop(0, "#F7F7F9"); g.addColorStop(1, "#E4E4EA");
  ctx.fillStyle = g; ctx.fillRect(0, 0, i.w, i.h);
  shards(ctx, i.w, i.h, i.t, inkOf(i), 0.025);
}

function liveClock(minute: number, t: number) {
  const total = Math.max(0, Math.round(minute)) * 60 + Math.floor(Math.max(0, t));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function sceneTeamGoal(ctx: Ctx, i: SceneInput) {
  const { w, h, t, data } = i;
  const u = Math.min(w, h) / 1080;
  const D = 6;
  lightBackdrop(ctx, i);
  const home = data.side === "home";
  const name = home ? data.home : data.away;
  const col = resolveTeamColors(name, home ? data.homeColor : data.awayColor, home ? data.homeColor2 : data.awayColor2);
  const team: BugTeam = { name, ...col, crest: home ? "homeLogo" : "awayLogo" };
  const W = Math.min(w * 0.86, 1250 * u);
  const outP = easeInCubic(progress(t, D - 0.6, D - 0.05));
  ctx.save();
  ctx.translate(w / 2, h * 0.45); ctx.scale(1 - outP, 1 - outP * 0.3); ctx.translate(-w / 2, -h * 0.45);
  ctx.globalAlpha = 1 - outP;
  teamBug(ctx, i, w / 2, h * 0.45 - W * 0.06, W, team, t - 0.1, {
    clock: liveClock(data.minute, t),
    score: `${data.homeScore}-${data.awayScore}`,
    after: easeInOutCubic(progress(t, 3.7, 4.2)),
  });
  ctx.restore();
}

function sceneTeamBugs(ctx: Ctx, i: SceneInput) {
  const { w, h, t, data } = i;
  const u = Math.min(w, h) / 1080;
  const D = 8;
  lightBackdrop(ctx, i);
  const teams = data.bugTeams.slice(0, 12);
  const n = Math.max(1, teams.length);
  const horizontal = w >= h;
  const logoS = (horizontal ? 150 : 170) * u;
  const topPad = h * (horizontal ? 0.06 : 0.1);
  const avail = h - topPad - h * 0.05;
  const rowH = avail / n;
  const W = Math.min(w * (horizontal ? 0.5 : 0.62), (rowH / 0.2) * 1.0, 1000 * u);
  const cx = horizontal ? w * 0.55 : w * 0.55;
  const outP = easeInCubic(progress(t, D - 0.6, D - 0.05));
  ctx.save(); ctx.globalAlpha = (1 - outP) * easeOutCubic(progress(t, 0, 0.5));
  leagueLogo(ctx, i, horizontal ? w * 0.14 : w * 0.13, topPad + logoS * 0.6, logoS);
  ctx.restore();
  teams.forEach((tm, k) => {
    const start = 0.2 + k * 0.28;
    const top = topPad + k * rowH + (rowH - W * 0.105 * 1.85) / 2;
    ctx.save(); ctx.globalAlpha = 1 - outP;
    teamBug(ctx, i, cx, top, W, tm, t - start, { clock: liveClock(data.minute, t) });
    ctx.restore();
  });
}

function sceneLineup(ctx: Ctx, i: SceneInput) {
  const ps = i.data.lineup.players.slice(0, MAX_TABLE_ROWS);
  const ink = inkOf(i);
  tableScene(ctx, i, `${i.data.lineup.team} · Alineación`, ps.length, null, (k, x, y, rw, rh) => {
    const p = ps[k];
    const cy = y + rh / 2;
    const px = Math.min(rh * 0.42, 38 * (Math.min(i.w, i.h) / 1080));
    const nx = x + rw * 0.22;
    ctx.save();
    ctx.fillStyle = ink;
    rr(ctx, nx - rh * 0.95, cy - rh * 0.34, rh * 0.68, rh * 0.68, rh * 0.14); ctx.fill();
    ctx.restore();
    text(ctx, p.number != null ? String(p.number) : "–", nx - rh * 0.61, cy, i.fonts.numbers, px, "#FFFFFF");
    text(ctx, p.name, nx, cy, i.fonts.heading, px, ink, { align: "left", maxW: rw * 0.72 });
  });
}

/* ───────────── capas sobre el video en vivo ───────────── */

export type LiveOverlay = {
  scoreboard: boolean;
  clock: string;
  goal?: { side: "home" | "away"; t: number };
  lower?: { kind: "yellow" | "red" | "sub" | "scorer"; side: "home" | "away"; t: number; text: string; minute: number };
  sponsor?: { index: number; t: number };
};

/** Dibuja marcador, barra de gol, rótulos y patrocinador encima del video (sin fondo). */
export function drawLiveOverlay(ctx: Ctx, i: SceneInput, o: LiveOverlay) {
  const { w, h, data } = i;
  const u = Math.min(w, h) / 1080;
  if (o.scoreboard) {
    const sw = Math.min(w * 0.46, 760 * u);
    scoreboard(ctx, i, { x: w * 0.03, y: h * 0.04, w: sw, h: Math.max(48 * u, sw / 13) }, { clock: o.clock });
  }
  if (o.goal) {
    const home = o.goal.side === "home";
    const name = home ? data.home : data.away;
    const col = resolveTeamColors(name, home ? data.homeColor : data.awayColor, home ? data.homeColor2 : data.awayColor2);
    const W = Math.min(w * 0.7, 1100 * u);
    const out = easeInCubic(progress(o.goal.t, 5.4, 6));
    ctx.save(); ctx.globalAlpha = 1 - out;
    teamBug(ctx, i, w / 2, h * 0.7, W, { name, ...col, crest: home ? "homeLogo" : "awayLogo" }, o.goal.t, {
      clock: o.clock, score: `${data.homeScore}-${data.awayScore}`, after: easeInOutCubic(progress(o.goal.t, 3.7, 4.2)),
    });
    ctx.restore();
  }
  if (o.lower) {
    const L = o.lower;
    const dur = L.kind === "scorer" ? 6 : 7;
    const slide = progress(L.t, 0, 0.5) * (1 - progress(L.t, dur - 0.5, dur));
    const label = L.kind === "yellow" ? "AMARILLA · " : L.kind === "red" ? "ROJA · " : L.kind === "sub" ? "CAMBIO · " : "GOL · ";
    lowerThird(ctx, i, h * 0.78, slide, label + L.text, `${L.minute}'`);
  }
  if (o.sponsor && data.sponsors.length > 0) {
    const sp = data.sponsors[o.sponsor.index % data.sponsors.length];
    const t = o.sponsor.t;
    const k = easeOutCubic(progress(t, 0, 0.5)) * (1 - easeInCubic(progress(t, 9.4, 10)));
    const cw = Math.min(w * 0.36, 560 * u), ch = 120 * u;
    const x = w - cw - w * 0.03 + (1 - k) * (cw + w * 0.05), y = h - ch - h * 0.05;
    ctx.save();
    ctx.globalAlpha = Math.min(1, k * 1.5);
    ctx.shadowColor = "rgba(0,0,0,.3)"; ctx.shadowBlur = 24 * u;
    ctx.fillStyle = "#FFFFFF"; rr(ctx, x, y, cw, ch, 16 * u); ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.fillStyle = i.colors.lowerAccent; rr(ctx, x, y, 12 * u, ch, 6 * u); ctx.fill();
    const im = sp.image ? i.images?.[sp.image] : undefined;
    const logoW = ch * 1.3;
    if (im) contain(ctx, im, x + 24 * u + logoW / 2, y + ch / 2, logoW, ch * 0.75);
    const tx = x + (im ? 40 * u + logoW : 34 * u);
    text(ctx, "PATROCINADOR", tx, y + ch * 0.32, i.fonts.body, 22 * u, "#64748B", { align: "left" });
    text(ctx, sp.name, tx, y + ch * 0.64, i.fonts.heading, 40 * u, "#0F172A", { align: "left", maxW: x + cw - tx - 20 * u });
    ctx.restore();
  }
}

export function drawScene(ctx: Ctx, id: SceneId, input: SceneInput) {
  ctx.save();
  ctx.clearRect(0, 0, input.w, input.h);
  switch (id) {
    case "ident": sceneIdent(ctx, input); break;
    case "matchday": sceneMatchday(ctx, input); break;
    case "matchup": sceneMatchup(ctx, input); break;
    case "totw": sceneTotw(ctx, input); break;
    case "potw": scenePotw(ctx, input); break;
    case "lineup": sceneLineup(ctx, input); break;
    case "teamGoal": sceneTeamGoal(ctx, input); break;
    case "teamBugs": sceneTeamBugs(ctx, input); break;
    case "results": sceneResults(ctx, input); break;
    case "standings": sceneStandings(ctx, input); break;
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
