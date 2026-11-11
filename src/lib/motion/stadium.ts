// Estadio virtual para el simulador y vallas LED de patrocinadores.
import { hexToRgb } from "@/lib/color";
import { contain, fontStr, rr, text, type SceneInput } from "./scenes";

type Ctx = CanvasRenderingContext2D;

/** Pseudoaleatorio determinista (mismo resultado en cada cuadro). */
const rand = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

const SEGMENT = 6; // segundos por patrocinador en la valla

/**
 * Valla LED: fondo negro, logos y nombres que desfilan, cambio de patrocinador con barrido
 * y textura de puntos LED. Sin patrocinadores muestra el nombre del torneo.
 */
export function drawLedBoard(ctx: Ctx, i: SceneInput, x: number, y: number, w: number, h: number, t: number) {
  const sponsors = i.data.sponsors.length ? i.data.sponsors : [{ name: i.tournamentName }];
  const seg = Math.floor(t / SEGMENT);
  const local = t - seg * SEGMENT;
  const sp = sponsors[seg % sponsors.length];
  const accents = [i.colors.homeStripe, i.colors.awayStripe, i.colors.clockBg, i.colors.lowerAccent].filter(Boolean);
  const accent = accents[seg % accents.length] ?? "#22D3EE";

  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = "#05070C"; ctx.fillRect(x, y, w, h);

  // contenido: mosaico [logo + NOMBRE] desplazándose
  const im = sp.image ? i.images?.[sp.image] : undefined;
  const px = h * 0.5;
  ctx.font = fontStr(i.fonts.heading, px);
  const nameW = ctx.measureText(sp.name.toUpperCase()).width;
  const tile = (im ? h * 1.6 : 0) + nameW + h * 1.6;
  const speed = h * 2.2;
  const offset = ((local * speed) % tile + tile) % tile;
  for (let tx = x - offset; tx < x + w + tile; tx += tile) {
    let cx = tx + h * 0.4;
    if (im) {
      ctx.save(); ctx.fillStyle = "#FFFFFF"; rr(ctx, cx, y + h * 0.12, h * 1.3, h * 0.76, h * 0.08); ctx.fill(); ctx.restore();
      contain(ctx, im, cx + h * 0.65, y + h / 2, h * 1.2, h * 0.66);
      cx += h * 1.6;
    }
    text(ctx, sp.name.toUpperCase(), cx, y + h / 2, i.fonts.heading, px, "#FFFFFF", { align: "left" });
    ctx.fillStyle = accent;
    ctx.fillRect(cx + nameW + h * 0.45, y + h * 0.3, h * 0.4, h * 0.4);
  }

  // barrido de color al cambiar de patrocinador
  const wipe = local < 0.45 ? 1 - local / 0.45 : local > SEGMENT - 0.35 ? (local - (SEGMENT - 0.35)) / 0.35 : 0;
  if (wipe > 0) { ctx.globalAlpha = wipe; ctx.fillStyle = accent; ctx.fillRect(x, y, w, h); ctx.globalAlpha = 1; }

  // brillo y textura de puntos LED
  const [r, g, b] = hexToRgb(accent);
  const glow = ctx.createLinearGradient(x, y, x, y + h);
  glow.addColorStop(0, `rgba(${r},${g},${b},.22)`); glow.addColorStop(0.5, "rgba(255,255,255,0)"); glow.addColorStop(1, `rgba(${r},${g},${b},.18)`);
  ctx.fillStyle = glow; ctx.fillRect(x, y, w, h);
  const step = Math.max(2, Math.round(h / 16));
  ctx.fillStyle = "rgba(0,0,0,.38)";
  for (let gy = y; gy < y + h; gy += step) ctx.fillRect(x, gy, w, Math.max(1, step * 0.35));
  for (let gx = x; gx < x + w; gx += step) ctx.fillRect(gx, y, Math.max(1, step * 0.35), h);
  ctx.restore();
}

/** Franja LED inferior para la transmisión real (alterna con la tarjeta del patrocinador). */
export function drawLedBand(ctx: Ctx, i: SceneInput, t: number) {
  const h = i.h * 0.075;
  const k = Math.min(1, t / 0.4) * Math.min(1, Math.max(0, (10 - t) / 0.4));
  const y = i.h - h * k;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.4)"; ctx.shadowBlur = h * 0.4;
  ctx.fillStyle = "#000"; ctx.fillRect(0, y - 2, i.w, h + 2);
  ctx.shadowColor = "transparent";
  drawLedBoard(ctx, i, 0, y, i.w, h, t);
  ctx.restore();
}

/**
 * Estadio virtual visto desde la cámara principal: tribuna con público, vallas LED,
 * cancha en perspectiva con líneas, jugadores con los colores de cada equipo y balón.
 */
export function drawStadium(ctx: Ctx, i: SceneInput, t: number) {
  const { w, h, data } = i;
  const pan = Math.sin(t * 0.11) * 0.12 + Math.sin(t * 0.37) * 0.02; // paneo suave de cámara
  const yBoard = h * 0.3, boardH = h * 0.065, y0 = yBoard + boardH; // borde lejano de la cancha

  // tribuna
  const sky = ctx.createLinearGradient(0, 0, 0, yBoard);
  sky.addColorStop(0, "#0B1220"); sky.addColorStop(1, "#1E293B");
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, yBoard);
  const crowdColors = ["#E2E8F0", "#F87171", "#60A5FA", "#FBBF24", "#34D399", "#A78BFA", data.homeColor || "#C8102E", data.awayColor || "#1D4ED8"];
  const cs = Math.max(3, Math.round(w / 260));
  for (let row = 0; row < 14; row++) {
    const ry = yBoard * 0.12 + row * (yBoard * 0.85 / 14);
    for (let col = 0; col < 90; col++) {
      const n = row * 131 + col;
      const cx = ((col / 90 + pan * 0.4) % 1 + 1) % 1 * w;
      const bob = Math.sin(t * (2 + rand(n) * 3) + n) * cs * 0.3;
      ctx.fillStyle = crowdColors[Math.floor(rand(n) * crowdColors.length)];
      ctx.globalAlpha = 0.55 + 0.35 * rand(n + 7);
      ctx.fillRect(cx, ry + bob, cs, cs * 1.4);
    }
  }
  ctx.globalAlpha = 1;
  // luces del estadio
  for (const lx of [0.15, 0.5, 0.85]) {
    const gx = ((lx + pan * 0.4) % 1 + 1) % 1 * w;
    const lg = ctx.createRadialGradient(gx, h * 0.02, 0, gx, h * 0.02, w * 0.18);
    lg.addColorStop(0, "rgba(255,255,240,.35)"); lg.addColorStop(1, "rgba(255,255,240,0)");
    ctx.fillStyle = lg; ctx.fillRect(0, 0, w, yBoard);
  }

  // vallas LED a lo largo de la banda (sincronizadas, como en un estadio)
  const bw = w * 1.4;
  const bx = -w * 0.2 - pan * w * 0.5;
  drawLedBoard(ctx, i, bx, yBoard, bw, boardH, t);
  // separaciones verticales entre módulos de la valla
  ctx.fillStyle = "rgba(0,0,0,.55)";
  for (let k = 1; k < 8; k++) ctx.fillRect(bx + (bw * k) / 8, yBoard, Math.max(2, w / 640), boardH);

  // proyección de la cancha: u (largo, 0..1) y v (0 = lado lejano, 1 = cerca de la cámara)
  const farL = -w * 0.35, farR = w * 1.35, nearL = -w * 1.6, nearR = w * 2.6, y1 = h * 1.25;
  const P = (u: number, v: number): [number, number] => {
    const uu = u - pan;
    const vv = Math.pow(v, 1.25);
    const xl = farL + (nearL - farL) * vv, xr = farR + (nearR - farR) * vv;
    return [xl + (xr - xl) * uu, y0 + (y1 - y0) * vv];
  };
  // césped con franjas
  for (let k = 0; k < 18; k++) {
    const a0 = P(k / 18, 0), a1 = P((k + 1) / 18, 0), b1 = P((k + 1) / 18, 1), b0 = P(k / 18, 1);
    ctx.fillStyle = k % 2 ? "#2F8F3A" : "#3AA046";
    ctx.beginPath(); ctx.moveTo(a0[0], a0[1]); ctx.lineTo(a1[0], a1[1]); ctx.lineTo(b1[0], b1[1]); ctx.lineTo(b0[0], b0[1]); ctx.closePath(); ctx.fill();
  }
  const shade = ctx.createLinearGradient(0, y0, 0, h);
  shade.addColorStop(0, "rgba(0,0,0,.25)"); shade.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = shade; ctx.fillRect(0, y0, w, h - y0);

  // líneas
  ctx.strokeStyle = "rgba(255,255,255,.85)"; ctx.lineWidth = Math.max(2, w / 640);
  const line = (pts: [number, number][]) => { ctx.beginPath(); pts.forEach(([u, v], k) => { const [px, py] = P(u, v); if (k) ctx.lineTo(px, py); else ctx.moveTo(px, py); }); ctx.stroke(); };
  line([[0, 0.04], [1, 0.04]]);
  line([[0.5, 0.04], [0.5, 1]]);
  line([[0, 0.04], [0, 1]]); line([[1, 0.04], [1, 1]]);
  line([[0, 0.25], [0.14, 0.25], [0.14, 0.95], [0, 0.95]]);
  line([[1, 0.25], [0.86, 0.25], [0.86, 0.95], [1, 0.95]]);
  const circle: [number, number][] = Array.from({ length: 41 }, (_, k) => [0.5 + 0.075 * Math.cos((k / 40) * Math.PI * 2), 0.48 + 0.2 * Math.sin((k / 40) * Math.PI * 2)]);
  line(circle);

  // balón y jugadores
  const ballU = 0.5 + Math.sin(t * 0.23) * 0.22 + Math.sin(t * 0.9) * 0.04, ballV = 0.45 + Math.sin(t * 0.31 + 1) * 0.22;
  const people: { u: number; v: number; color: string; gk?: boolean }[] = [];
  for (let k = 0; k < 20; k++) {
    const home = k < 10;
    const baseU = home ? 0.18 + (k % 5) * 0.08 : 0.5 + (k % 5) * 0.08;
    const baseV = 0.15 + (Math.floor((k % 10) / 5)) * 0.4 + rand(k) * 0.2;
    const pull = 0.35;
    const u = baseU + (ballU - baseU) * pull + Math.sin(t * (0.6 + rand(k) * 0.6) + k) * 0.03;
    const v = baseV + (ballV - baseV) * pull + Math.cos(t * (0.5 + rand(k + 3) * 0.6) + k) * 0.04;
    people.push({ u, v, color: home ? (data.homeColor || "#C8102E") : (data.awayColor || "#1D4ED8") });
  }
  people.push({ u: 0.04, v: 0.5 + Math.sin(t * 0.4) * 0.08, color: "#FACC15", gk: true }, { u: 0.96, v: 0.5 + Math.cos(t * 0.4) * 0.08, color: "#A3E635", gk: true });
  const drawables = [...people.map((p) => ({ ...p, ball: false })), { u: ballU, v: ballV, color: "#FFFFFF", ball: true }].sort((a, b) => a.v - b.v);
  for (const d of drawables) {
    const [px, py] = P(d.u, d.v);
    if (px < -50 || px > w + 50 || py > h + 50) continue;
    const s = (h * 0.035) * (0.55 + Math.pow(d.v, 1.25) * 1.3);
    ctx.fillStyle = "rgba(0,0,0,.3)";
    ctx.beginPath(); ctx.ellipse(px, py, s * 0.45, s * 0.14, 0, 0, Math.PI * 2); ctx.fill();
    if (d.ball) { ctx.fillStyle = "#FFFFFF"; ctx.beginPath(); ctx.arc(px, py - s * 0.25, s * 0.22, 0, Math.PI * 2); ctx.fill(); continue; }
    ctx.fillStyle = d.color; rr(ctx, px - s * 0.22, py - s * 1.25, s * 0.44, s * 0.62, s * 0.1); ctx.fill();
    ctx.fillStyle = "#111827"; ctx.fillRect(px - s * 0.2, py - s * 0.65, s * 0.4, s * 0.3);
    ctx.fillStyle = "#E7C29A"; ctx.beginPath(); ctx.arc(px, py - s * 1.42, s * 0.17, 0, Math.PI * 2); ctx.fill();
  }
}
