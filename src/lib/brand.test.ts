import { describe, expect, it } from "vitest";
import { DEFAULT_BRANDS, ROLES, brandToCssVars, broadcastFromTournament, identityPalette, sanitizeBrand } from "./brand";
import { FONTS, googleFontsUrl, nearestWeight } from "./fonts";

describe("sanitizeBrand", () => {
  it("devuelve los valores por defecto con entradas inválidas", () => {
    for (const kind of ["tournament", "broadcast"] as const) {
      for (const bad of [null, undefined, "x", 5, [], {}]) {
        const b = sanitizeBrand(kind, bad);
        expect(Object.keys(b.colors).sort()).toEqual(ROLES[kind].map((r) => r.key).sort());
        expect(b.fonts.heading.family).toBe(DEFAULT_BRANDS[kind].fonts.heading.family);
      }
    }
  });

  it("normaliza colores y descarta los inválidos usando el color por defecto", () => {
    const b = sanitizeBrand("tournament", { colors: { primary: "ff2882", secondary: "no-es-color", accent: "#f60" } });
    expect(b.colors.primary).toBe("#FF2882");
    expect(b.colors.secondary).toBe(DEFAULT_BRANDS.tournament.colors.secondary);
    expect(b.colors.accent).toBe("#FF6600");
  });

  it("ignora colores de roles que no existen y no inyecta claves ajenas", () => {
    const b = sanitizeBrand("tournament", { colors: { __proto__: "#000000", hack: "#111111", barBg: "#222222" } });
    expect(Object.keys(b.colors)).not.toContain("hack");
    expect(Object.keys(b.colors)).not.toContain("barBg");
  });

  it("valida la paleta: límites, hex, nombres e ids únicos", () => {
    const palette = [
      { id: "a", name: "  Rosa   fuerte ", hex: "#ff2882" },
      { id: "a", name: "Repetido", hex: "#ff6900" },
      { id: "b", name: "Malo", hex: "zzz" },
      null,
      { id: "c", name: "x".repeat(200), hex: "#00ff87" },
    ];
    const p = sanitizeBrand("tournament", { palette }).palette;
    expect(p.map((c) => c.hex)).toEqual(["#FF2882", "#FF6900", "#00FF87"]);
    expect(p[0].name).toBe("Rosa fuerte");
    expect(new Set(p.map((c) => c.id)).size).toBe(3);
    expect(p[2].name).toHaveLength(40);
    const many = Array.from({ length: 100 }, (_, i) => ({ id: `i${i}`, name: `c${i}`, hex: "#123456" }));
    expect(sanitizeBrand("tournament", { palette: many }).palette).toHaveLength(24);
  });

  it("una paleta vacía explícita se respeta; sin paleta usa la de ejemplo", () => {
    expect(sanitizeBrand("tournament", { palette: [] }).palette).toEqual([]);
    expect(sanitizeBrand("tournament", {}).palette.length).toBeGreaterThan(0);
  });

  it("solo admite tipografías conocidas y ajusta pesos e itálica a lo que existe", () => {
    const b = sanitizeBrand("tournament", {
      fonts: {
        heading: { family: "Comic Sans", weight: 800, italic: true },
        body: { family: "Anton", weight: 300, italic: true },
        numbers: { family: "Oswald", weight: 680, italic: true },
      },
    });
    expect(b.fonts.heading.family).toBe(DEFAULT_BRANDS.tournament.fonts.heading.family);
    expect(b.fonts.body).toEqual({ family: "Anton", weight: 400, italic: false });
    expect(b.fonts.numbers.family).toBe("Oswald");
    expect(b.fonts.numbers.weight).toBe(700);
    expect(b.fonts.numbers.italic).toBe(false);
  });
});

describe("colores de marca del torneo", () => {
  it("incluye cinco colores de marca y completa el quinto en marcas guardadas antes de que existiera", () => {
    const marca = ROLES.tournament.filter((r) => r.group === "Marca").map((r) => r.key);
    expect(marca).toEqual(["primary", "secondary", "accent", "highlight", "extra"]);
    // Una marca guardada con solo los cuatro colores anteriores conserva sus valores y recibe el nuevo por defecto.
    const b = sanitizeBrand("tournament", { colors: { primary: "#FF2882", secondary: "#FF6900", accent: "#EBFF00", highlight: "#00FF87" } });
    expect(b.colors).toMatchObject({ primary: "#FF2882", secondary: "#FF6900", accent: "#EBFF00", highlight: "#00FF87" });
    expect(b.colors.extra).toBe(DEFAULT_BRANDS.tournament.colors.extra);
    expect(brandToCssVars("tournament", b)).toContain("--brand-extra: ");
  });
});

describe("tipografías", () => {
  it("nearestWeight elige un peso existente", () => {
    expect(nearestWeight("Lato", 600)).toBe(700);
    expect(nearestWeight("Anton", 900)).toBe(400);
    expect(nearestWeight("Inexistente", 700)).toBe(400);
  });

  it("googleFontsUrl genera URLs válidas y omite familias desconocidas", () => {
    expect(googleFontsUrl(["Nada"])).toBeNull();
    expect(googleFontsUrl(["Anton"])).toBe("https://fonts.googleapis.com/css2?family=Anton&display=swap");
    const u = googleFontsUrl(["Barlow Condensed", "Barlow Condensed", "Oswald"])!;
    expect(u).toContain("family=Barlow+Condensed:ital,wght@0,100;");
    expect(u).toContain("family=Oswald:wght@200;300;400;500;600;700");
    expect(u.match(/family=Barlow/g)).toHaveLength(1);
  });

  it("todas las fuentes declaran al menos un peso y pesos válidos", () => {
    for (const f of FONTS) {
      expect(f.weights.length).toBeGreaterThan(0);
      expect(f.weights.every((w) => w >= 100 && w <= 900 && w % 100 === 0)).toBe(true);
    }
  });
});

describe("brandToCssVars", () => {
  it("exporta colores, paleta y tipografías como variables CSS", () => {
    const css = brandToCssVars("broadcast", sanitizeBrand("broadcast", { palette: [{ id: "x", name: "Verde Ñandú", hex: "#00ff87" }, { id: "y", name: "Verde nandu", hex: "#111111" }] }));
    expect(css.startsWith(":root {")).toBe(true);
    expect(css).toContain("--brand-bar-bg: #FFFFFF;");
    expect(css).toContain("--brand-color-verde-nandu: #00FF87;");
    expect(css).toContain("--brand-color-verde-nandu-2: #111111;");
    expect(css).toContain('--brand-font-numbers: "Barlow Condensed", sans-serif;');
    expect(css).toContain("--brand-weight-heading: 800;");
  });
});

describe("marca de transmisión derivada del torneo", () => {
  const t = sanitizeBrand("tournament", { colors: { primary: "#FF2882", secondary: "#008CFF", accent: "#EBFF00", highlight: "#00FF87", extra: "#05F0FF", text: "#38003C" } });
  it("usa los colores de identidad y no los de fábrica", () => {
    const b = sanitizeBrand("broadcast", broadcastFromTournament(t));
    expect(b.colors.awayStripe).toBe("#FF2882");
    expect(b.colors.homeStripe).toBe("#05F0FF");
    expect(b.colors.clockBg).toBe("#FF2882");
    expect(b.colors.scoreBg).toBe("#38003C");
    expect(Object.values(b.colors)).not.toContain("#F59E0B");
    expect(b.fonts).toEqual(t.fonts);
  });
  it("la paleta de identidad son los 5 colores de marca en orden", () => {
    expect(identityPalette(t)).toEqual(["#FF2882", "#008CFF", "#EBFF00", "#00FF87", "#05F0FF"]);
  });
});
