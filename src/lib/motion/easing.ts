// Funciones de tiempo para las animaciones. Todas reciben y devuelven valores de 0 a 1 (salvo overshoot).

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/** Progreso (0-1) de `t` entre `start` y `end`, acotado. */
export const progress = (t: number, start: number, end: number) => (end <= start ? (t >= end ? 1 : 0) : clamp01((t - start) / (end - start)));

export const easeOutCubic = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
export const easeInCubic = (x: number) => Math.pow(clamp01(x), 3);
export const easeInOutCubic = (x: number) => {
  const k = clamp01(x);
  return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
};
/** Llega pasándose un poco del destino y vuelve (efecto "golpe"). */
export const easeOutBack = (x: number) => {
  const k = clamp01(x);
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2);
};
export const easeOutBounce = (x: number) => {
  let k = clamp01(x);
  const n1 = 7.5625;
  const d1 = 2.75;
  if (k < 1 / d1) return n1 * k * k;
  if (k < 2 / d1) return n1 * (k -= 1.5 / d1) * k + 0.75;
  if (k < 2.5 / d1) return n1 * (k -= 2.25 / d1) * k + 0.9375;
  return n1 * (k -= 2.625 / d1) * k + 0.984375;
};

/** "34" -> "34:00", 90 -> "90:00". Minutos inválidos dan "00:00". */
export function clockText(minute: number): string {
  const m = Number.isFinite(minute) ? Math.max(0, Math.min(150, Math.round(minute))) : 0;
  return `${String(m).padStart(2, "0")}:00`;
}

/** Tres letras para el marcador: "Manchester City" -> "MAN"; si no hay, el respaldo. */
export function abbreviation(name: string, fallback: string): string {
  const a = name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]/g, "").slice(0, 3).toUpperCase();
  return a.length >= 2 ? a : fallback;
}
