// Tipografías de Google Fonts disponibles para las marcas.
// Cada una declara los pesos que existen de verdad (verificado contra la API de Google Fonts).

export type FontDef = {
  family: string;
  weights: number[];
  italic: boolean;
  category: "sans" | "display" | "condensed" | "serif";
};

const W = (from: number, to: number) => Array.from({ length: (to - from) / 100 + 1 }, (_, i) => from + i * 100);

export const FONTS: FontDef[] = [
  { family: "Montserrat", weights: W(100, 900), italic: true, category: "sans" },
  { family: "Poppins", weights: W(100, 900), italic: true, category: "sans" },
  { family: "Inter", weights: W(100, 900), italic: true, category: "sans" },
  { family: "DM Sans", weights: W(100, 900), italic: true, category: "sans" },
  { family: "Work Sans", weights: W(100, 900), italic: true, category: "sans" },
  { family: "Raleway", weights: W(100, 900), italic: true, category: "sans" },
  { family: "Rubik", weights: W(300, 900), italic: true, category: "sans" },
  { family: "Archivo", weights: W(100, 900), italic: true, category: "sans" },
  { family: "Outfit", weights: W(100, 900), italic: false, category: "sans" },
  { family: "Space Grotesk", weights: W(300, 700), italic: false, category: "sans" },
  { family: "Open Sans", weights: W(300, 800), italic: true, category: "sans" },
  { family: "Lato", weights: [100, 300, 400, 700, 900], italic: true, category: "sans" },
  { family: "Barlow Condensed", weights: W(100, 900), italic: true, category: "condensed" },
  { family: "Roboto Condensed", weights: W(100, 900), italic: true, category: "condensed" },
  { family: "Oswald", weights: W(200, 700), italic: false, category: "condensed" },
  { family: "Teko", weights: W(300, 700), italic: false, category: "condensed" },
  { family: "Anton", weights: [400], italic: false, category: "display" },
  { family: "Bebas Neue", weights: [400], italic: false, category: "display" },
  { family: "Playfair Display", weights: W(400, 900), italic: true, category: "serif" },
];

export const FONT_BY_FAMILY = new Map(FONTS.map((f) => [f.family, f]));

export const WEIGHT_NAMES: Record<number, string> = {
  100: "Thin", 200: "ExtraLight", 300: "Light", 400: "Regular", 500: "Medium",
  600: "SemiBold", 700: "Bold", 800: "ExtraBold", 900: "Heavy",
};

/** Peso válido más cercano que la fuente realmente ofrece. */
export function nearestWeight(family: string, weight: number): number {
  const def = FONT_BY_FAMILY.get(family);
  if (!def) return 400;
  return def.weights.reduce((best, w) => (Math.abs(w - weight) < Math.abs(best - weight) ? w : best), def.weights[0]);
}

/**
 * URL de Google Fonts (CSS2) para cargar las familias indicadas con todos sus pesos
 * (y cursivas si existen). Ignora familias desconocidas.
 */
export function googleFontsUrl(families: string[]): string | null {
  const parts = [...new Set(families)].flatMap((family) => {
    const def = FONT_BY_FAMILY.get(family);
    if (!def) return [];
    const name = encodeURIComponent(family).replace(/%20/g, "+");
    if (!def.italic) {
      return [def.weights.length === 1 && def.weights[0] === 400 ? `family=${name}` : `family=${name}:wght@${def.weights.join(";")}`];
    }
    const tuples = [0, 1].flatMap((i) => def.weights.map((w) => `${i},${w}`));
    return [`family=${name}:ital,wght@${tuples.join(";")}`];
  });
  return parts.length ? `https://fonts.googleapis.com/css2?${parts.join("&")}&display=swap` : null;
}
