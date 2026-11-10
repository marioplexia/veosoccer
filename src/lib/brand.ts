import { normalizeHex } from "@/lib/color";
import { FONT_BY_FAMILY, nearestWeight } from "@/lib/fonts";

export type BrandKind = "tournament" | "broadcast";

export type RoleDef = { key: string; label: string; hint: string; group: string; pair?: string }; // pair: color de fondo contra el que se mide el contraste

/** Colores con función fija (los usan las piezas gráficas). Cada marca tiene los suyos. */
export const ROLES: Record<BrandKind, RoleDef[]> = {
  tournament: [
    { key: "primary", label: "Principal", hint: "Color de marca: botones, titulares, fondos de portada", group: "Marca" },
    { key: "secondary", label: "Secundario", hint: "Segundo color de la degradación y fondos oscuros", group: "Marca" },
    { key: "accent", label: "Acento", hint: "Etiquetas, píldoras y detalles destacados", group: "Marca" },
    { key: "highlight", label: "Destacado", hint: "Resaltes y datos importantes", group: "Marca" },
    { key: "extra", label: "Adicional", hint: "Quinto color de marca: fondos y detalles complementarios", group: "Marca" },
    { key: "background", label: "Fondo", hint: "Fondo general de las piezas claras", group: "Superficies" },
    { key: "surface", label: "Superficie", hint: "Tarjetas y paneles", group: "Superficies" },
    { key: "text", label: "Texto", hint: "Texto principal sobre fondo claro", group: "Superficies", pair: "surface" },
  ],
  broadcast: [
    { key: "barBg", label: "Fondo de equipos", hint: "Barras donde van las siglas de cada equipo", group: "Marcador" },
    { key: "barText", label: "Texto de equipos", hint: "Siglas (por ejemplo TOT, MCI)", group: "Marcador", pair: "barBg" },
    { key: "homeStripe", label: "Franja local", hint: "Franja de color junto al equipo local", group: "Marcador" },
    { key: "awayStripe", label: "Franja visitante", hint: "Franja de color junto al equipo visitante", group: "Marcador" },
    { key: "scoreBg", label: "Fondo del resultado", hint: "Caja central con el marcador", group: "Marcador" },
    { key: "scoreText", label: "Texto del resultado", hint: "Números del marcador", group: "Marcador", pair: "scoreBg" },
    { key: "clockBg", label: "Fondo del reloj", hint: "Caja con el minuto del partido", group: "Marcador" },
    { key: "clockText", label: "Texto del reloj", hint: "Números del reloj", group: "Marcador", pair: "clockBg" },
    { key: "lowerBg", label: "Fondo del rótulo", hint: "Rótulo con el nombre de un jugador o dato", group: "Rótulo" },
    { key: "lowerText", label: "Texto del rótulo", hint: "Texto del rótulo", group: "Rótulo", pair: "lowerBg" },
    { key: "lowerAccent", label: "Acento del rótulo", hint: "Barra lateral del rótulo", group: "Rótulo" },
  ],
};

export type FontSpec = { family: string; weight: number; italic: boolean };

export const FONT_SLOTS = [
  { key: "heading", label: "Titulares", hint: "Títulos y nombres de torneo" },
  { key: "body", label: "Texto", hint: "Párrafos, tablas y subtítulos" },
  { key: "numbers", label: "Números y marcador", hint: "Resultados, reloj y estadísticas" },
] as const;
export type FontSlot = (typeof FONT_SLOTS)[number]["key"];

export type CustomColor = { id: string; name: string; hex: string };

export type BrandSettings = {
  colors: Record<string, string>;
  palette: CustomColor[];
  fonts: Record<FontSlot, FontSpec>;
};

export const MAX_PALETTE = 24;

export const DEFAULT_BRANDS: Record<BrandKind, BrandSettings> = {
  tournament: {
    colors: { primary: "#059669", secondary: "#0F172A", accent: "#F59E0B", highlight: "#22D3EE", extra: "#8B5CF6", background: "#F8FAFC", surface: "#FFFFFF", text: "#0F172A" },
    palette: [
      { id: "verde", name: "Verde cancha", hex: "#059669" },
      { id: "noche", name: "Azul noche", hex: "#0F172A" },
      { id: "ambar", name: "Ámbar", hex: "#F59E0B" },
      { id: "cielo", name: "Cian", hex: "#22D3EE" },
    ],
    fonts: {
      heading: { family: "Montserrat", weight: 800, italic: false },
      body: { family: "Inter", weight: 400, italic: false },
      numbers: { family: "Barlow Condensed", weight: 700, italic: false },
    },
  },
  broadcast: {
    colors: {
      barBg: "#FFFFFF", barText: "#0F172A", homeStripe: "#22D3EE", awayStripe: "#F59E0B",
      scoreBg: "#1E1B4B", scoreText: "#FFFFFF", clockBg: "#E11D48", clockText: "#FFFFFF",
      lowerBg: "#0F172A", lowerText: "#FFFFFF", lowerAccent: "#22D3EE",
    },
    palette: [],
    fonts: {
      heading: { family: "Montserrat", weight: 800, italic: false },
      body: { family: "Inter", weight: 500, italic: false },
      numbers: { family: "Barlow Condensed", weight: 700, italic: false },
    },
  },
};

const clampText = (s: unknown, max: number) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, max) : "");

function sanitizeFont(raw: unknown, fallback: FontSpec): FontSpec {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const family = typeof r.family === "string" && FONT_BY_FAMILY.has(r.family) ? r.family : fallback.family;
  const def = FONT_BY_FAMILY.get(family)!;
  const weight = nearestWeight(family, typeof r.weight === "number" ? r.weight : fallback.weight);
  return { family, weight, italic: def.italic && r.italic === true };
}

/** Valida cualquier JSON guardado (o recibido) y lo completa con los valores por defecto. */
export function sanitizeBrand(kind: BrandKind, raw: unknown): BrandSettings {
  const base = DEFAULT_BRANDS[kind];
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;

  const rawColors = (r.colors && typeof r.colors === "object" ? r.colors : {}) as Record<string, unknown>;
  const colors: Record<string, string> = {};
  for (const role of ROLES[kind]) {
    const v = typeof rawColors[role.key] === "string" ? normalizeHex(rawColors[role.key] as string) : null;
    colors[role.key] = v ?? base.colors[role.key];
  }

  const palette: CustomColor[] = [];
  const ids = new Set<string>();
  if (Array.isArray(r.palette)) {
    for (const p of r.palette) {
      if (palette.length >= MAX_PALETTE) break;
      if (!p || typeof p !== "object") continue;
      const hex = normalizeHex(String((p as Record<string, unknown>).hex ?? ""));
      if (!hex) continue;
      const name = clampText((p as Record<string, unknown>).name, 40) || hex;
      let id = clampText((p as Record<string, unknown>).id, 40).toLowerCase().replace(/[^a-z0-9-]/g, "");
      if (!id || ids.has(id)) id = `c${palette.length + 1}-${hex.slice(1).toLowerCase()}`;
      while (ids.has(id)) id += "x";
      ids.add(id);
      palette.push({ id, name, hex });
    }
  } else {
    palette.push(...base.palette);
  }

  const rawFonts = (r.fonts && typeof r.fonts === "object" ? r.fonts : {}) as Record<string, unknown>;
  const fonts = Object.fromEntries(FONT_SLOTS.map((s) => [s.key, sanitizeFont(rawFonts[s.key], base.fonts[s.key])])) as Record<FontSlot, FontSpec>;

  return { colors, palette, fonts };
}

const slug = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "color";

/** Variables CSS listas para pegar en tu sitio o en tu software de transmisión (p. ej. OBS). */
export function brandToCssVars(kind: BrandKind, b: BrandSettings): string {
  const lines: string[] = [];
  for (const role of ROLES[kind]) lines.push(`  --brand-${role.key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}: ${b.colors[role.key]};`);
  const used = new Set<string>();
  for (const c of b.palette) {
    let name = slug(c.name);
    while (used.has(name)) name += "-2";
    used.add(name);
    lines.push(`  --brand-color-${name}: ${c.hex};`);
  }
  for (const s of FONT_SLOTS) {
    const f = b.fonts[s.key];
    lines.push(`  --brand-font-${s.key}: "${f.family}", sans-serif;`);
    lines.push(`  --brand-weight-${s.key}: ${f.weight};`);
    lines.push(`  --brand-style-${s.key}: ${f.italic ? "italic" : "normal"};`);
  }
  return `:root {\n${lines.join("\n")}\n}`;
}

export const BRAND_LABEL: Record<BrandKind, string> = {
  tournament: "Marca del Torneo",
  broadcast: "Marca de Transmisión",
};
