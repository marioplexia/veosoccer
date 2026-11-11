// Video resumen del partido: la IA escribe el guion (titular, momentos, cierre) y aquí se "edita" en gráficos.
import type { MatchSummary } from "@/lib/match-view";
import { clamp01, easeInCubic, easeOutBack, easeOutCubic, progress } from "./easing";
import { MATCH_THEMES, THEME_INK, fontStr, matchThemeIndex, resultBar, rr, text, type SceneInput } from "./scenes";

type Ctx = CanvasRenderingContext2D;
const TITLE = 3.6, RESULT = 4.6, MOMENT = 3.4, CLOSING = 4;

export type RecapSegment = { kind: "title" | "result" | "moment" | "closing"; start: number; d: number; index: number };

/** Línea de tiempo del video: titular → resultado → un tramo por momento → cierre. */
export function recapTimeline(s: MatchSummary): RecapSegment[] {
  const out: RecapSegment[] = [];
  let at = 0;
  const push = (kind: RecapSegment["kind"], d: number, index = 0) => { out.push({ kind, start: at, d, index }); at += d; };
  push("title", TITLE);
  push("result", RESULT);
  s.moments.forEach((_, k) => push("moment", MOMENT, k));
  push("closing", CLOSING);
  return out;
}
export const recapDuration = (s: MatchSummary) => recapTimeline(s).reduce((a, x) => a + x.d, 0);

/** Parte el texto en renglones que quepan en `maxW`. */
function wrap(ctx: Ctx, s: string, font: string, maxW: number, maxLines: number): string[] {
  ctx.font = font;
  const lines: string[] = [];
  let cur = "";
  for (const word of s.split(/\s+/)) {
    const next = cur ? `${cur} ${word}` : word;
    if (ctx.measureText(next).width <= maxW || !cur) cur = next;
    else { lines.push(cur); cur = word; }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) { lines.length = maxLines; lines[maxLines - 1] = lines[maxLines - 1].replace(/[\s.,;:]*$/, "…"); }
  return lines;
}

function themeFill(ctx: Ctx, i: SceneInput, x: number, y: number, w: number, h: number, t: number) {
  const stops = MATCH_THEMES[matchThemeIndex(i)].stops;
  const g = ctx.createLinearGradient(x, y, x + w, y + h * 0.6);
  stops.forEach((c, k) => g.addColorStop(k / (stops.length - 1), c));
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  // rayos diagonales que se deslizan
  ctx.fillStyle = "#FFFFFF";
  for (let k = 0; k < 5; k++) {
    const bx = x + (((k / 5 + t * 0.03) % 1) * (w + h)) - h * 0.6;
    ctx.globalAlpha = k % 2 ? 0.1 : 0.16;
    ctx.beginPath(); ctx.moveTo(bx, y + h); ctx.lineTo(bx + h * 0.6, y); ctx.lineTo(bx + h * 0.6 + w * 0.06, y); ctx.lineTo(bx + w * 0.06, y + h); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

function logo(ctx: Ctx, i: SceneInput, cx: number, cy: number, size: number) {
  if (!i.logo || !i.logoSize) return;
  const k = Math.min(size / i.logoSize.w, size / i.logoSize.h);
  ctx.drawImage(i.logo, cx - (i.logoSize.w * k) / 2, cy - (i.logoSize.h * k) / 2, i.logoSize.w * k, i.logoSize.h * k);
}

/** Dibuja el cuadro del video en el instante `t`. */
export function drawRecap(ctx: Ctx, i: SceneInput, s: MatchSummary, t: number) {
  const { w, h } = i;
  const u = Math.min(w, h) / 1080;
  const seg = recapTimeline(s).find((x) => t >= x.start && t < x.start + x.d) ?? recapTimeline(s).at(-1)!;
  const tl = t - seg.start;
  const io = easeOutCubic(progress(tl, 0, 0.45)) * (1 - easeInCubic(progress(tl, seg.d - 0.4, seg.d)));
  ctx.save();
  ctx.clearRect(0, 0, w, h);

  if (seg.kind === "title") {
    themeFill(ctx, i, 0, 0, w, h, t);
    ctx.globalAlpha = io;
    logo(ctx, i, w / 2, h * 0.2, 170 * u);
    text(ctx, "RESUMEN DEL PARTIDO", w / 2, h * 0.36, i.fonts.body, 36 * u, THEME_INK);
    const px = 92 * u;
    const lines = wrap(ctx, s.headline, fontStr(i.fonts.heading, px), w * 0.84, 3);
    lines.forEach((ln, k) => {
      const p = easeOutCubic(progress(tl, 0.25 + k * 0.12, 0.75 + k * 0.12));
      ctx.save(); ctx.globalAlpha = io * p;
      text(ctx, ln, w / 2, h * 0.5 + (k - (lines.length - 1) / 2) * px * 1.12 + (1 - p) * 40 * u, i.fonts.heading, px, THEME_INK);
      ctx.restore();
    });
    text(ctx, `${i.tournamentName} · Jornada ${i.data.round}`, w / 2, h * 0.86, i.fonts.body, 34 * u, THEME_INK);
  } else if (seg.kind === "result") {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, "#0B0F19"); g.addColorStop(1, "#1E2536");
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    resultBar(ctx, i, w / 2, h * 0.44, Math.min(w * 0.88, h * 2.2), tl - 0.15, seg.d - 0.9, "Final");
  } else if (seg.kind === "moment") {
    const m = s.moments[seg.index];
    ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, w, h);
    const horizontal = w >= h;
    const pw = horizontal ? w * 0.34 : w, ph = horizontal ? h : h * 0.3;
    const slide = easeOutCubic(progress(tl, 0, 0.5)) * (1 - easeInCubic(progress(tl, seg.d - 0.4, seg.d)));
    ctx.save();
    if (horizontal) ctx.translate((slide - 1) * pw, 0); else ctx.translate(0, (slide - 1) * ph);
    themeFill(ctx, i, 0, 0, pw, ph, t);
    const pop = easeOutBack(progress(tl, 0.25, 0.75));
    ctx.save(); ctx.translate(pw / 2, ph / 2); ctx.scale(pop, pop);
    text(ctx, m.minute != null ? `${m.minute}'` : "★", 0, 0, i.fonts.numbers, (horizontal ? 250 : 200) * u, THEME_INK, { maxW: pw * 0.8 });
    ctx.restore();
    ctx.restore();
    const tx = horizontal ? pw + w * 0.06 : w * 0.08, tw = horizontal ? w - pw - w * 0.12 : w * 0.84;
    const cy = horizontal ? h / 2 : ph + (h - ph) / 2;
    const px = 66 * u;
    const lines = wrap(ctx, m.text, fontStr(i.fonts.heading, px), tw, 5);
    ctx.globalAlpha = io;
    text(ctx, `MOMENTO ${seg.index + 1} DE ${s.moments.length}`, tx, cy - (lines.length * px * 1.2) / 2 - 50 * u, i.fonts.body, 30 * u, THEME_INK, { align: "left", alpha: 0.6 });
    lines.forEach((ln, k) => {
      const p = easeOutCubic(progress(tl, 0.35 + k * 0.1, 0.8 + k * 0.1));
      ctx.save(); ctx.globalAlpha = io * p;
      text(ctx, ln, tx + (1 - p) * 60 * u, cy + (k - (lines.length - 1) / 2) * px * 1.2, i.fonts.heading, px, THEME_INK, { align: "left" });
      ctx.restore();
    });
    ctx.fillStyle = THEME_INK; ctx.globalAlpha = io;
    rr(ctx, tx, cy + (lines.length * px * 1.2) / 2 + 26 * u, 120 * u * clamp01(tl / 0.8), 10 * u, 5 * u); ctx.fill();
  } else {
    themeFill(ctx, i, 0, 0, w, h, t);
    ctx.globalAlpha = io;
    logo(ctx, i, w / 2, h * 0.3, 240 * u * easeOutBack(progress(tl, 0, 0.6)));
    const px = 64 * u;
    const lines = wrap(ctx, s.closing || `${i.data.home} ${i.data.homeScore}-${i.data.awayScore} ${i.data.away}`, fontStr(i.fonts.heading, px), w * 0.8, 3);
    lines.forEach((ln, k) => text(ctx, ln, w / 2, h * 0.58 + k * px * 1.15, i.fonts.heading, px, THEME_INK));
    text(ctx, i.tournamentName, w / 2, h * 0.88, i.fonts.body, 36 * u, THEME_INK);
  }
  ctx.restore();
}
