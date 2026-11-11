import { describe, expect, it } from "vitest";
import { DEFAULT_BRANDS } from "@/lib/brand";
import { DEFAULT_MATCH, FORMATS, TEMPLATES, autoTeamColors, drawLiveOverlay, paletteOf, samplePalette, drawScene, initials, parseFormation, resolveTeamColors, stageState, templateById, vividMid, vividMix, washPalette, type FormatId, type SceneInput } from "./scenes";

/** Contexto 2D falso: registra las llamadas de texto y acepta cualquier otra operación. */
function fakeCtx() {
  const texts: string[] = [];
  let ops = 0;
  const gradient = { addColorStop() {} };
  const target: Record<string, unknown> = {};
  const ctx = new Proxy(target, {
    get(_t, prop: string) {
      if (prop in target) return target[prop];
      if (prop === "measureText") return (s: string) => ({ width: s.length * 12 });
      if (prop === "createLinearGradient" || prop === "createRadialGradient") return () => gradient;
      if (prop === "fillText" || prop === "strokeText") return (s: string) => { texts.push(s); ops++; };
      return () => { ops++; };
    },
    set(_t, prop: string, value) { target[prop] = value; return true; },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, texts, ops: () => ops };
}

const brand = (kind: "tournament" | "broadcast") => DEFAULT_BRANDS[kind];

function input(kind: "tournament" | "broadcast", format: FormatId, t: number, over: Partial<SceneInput> = {}): SceneInput {
  const { w, h } = FORMATS[format];
  return { w, h, t, kind, colors: brand(kind).colors, fonts: brand(kind).fonts, logo: null, logoSize: null, tournamentName: "Liga Municipal", data: DEFAULT_MATCH, ...over };
}

describe("plantillas", () => {
  it("hay plantillas para las dos marcas y los ids son únicos", () => {
    expect(new Set(TEMPLATES.map((t) => t.id)).size).toBe(TEMPLATES.length);
    expect(TEMPLATES.some((t) => t.kind === "tournament")).toBe(true);
    for (const id of ["goal", "halftime", "fulltime", "kickoff", "yellow", "red", "substitution"]) expect(templateById(id as never).kind).toBe("broadcast");
    expect(TEMPLATES.every((t) => t.duration > 2 && t.duration <= 10)).toBe(true);
  });
});

describe("drawScene", () => {
  for (const tpl of TEMPLATES) {
    for (const format of Object.keys(FORMATS) as FormatId[]) {
      it(`${tpl.id} en ${format}: dibuja sin errores en todo su recorrido`, () => {
        for (let t = -0.5; t <= tpl.duration + 1; t += 0.1) {
          const f = fakeCtx();
          expect(() => drawScene(f.ctx, tpl.id, input(tpl.kind, format, t))).not.toThrow();
          expect(f.ops()).toBeGreaterThan(0);
        }
      });
    }
  }

  it("el gol muestra ¡GOL!, el goleador, el minuto y el marcador", () => {
    const f = fakeCtx();
    drawScene(f.ctx, "goal", input("broadcast", "horizontal", 2.5, { data: { ...DEFAULT_MATCH, player: "Pepe Pérez", minute: 77, homeScore: 3, awayScore: 1 } }));
    expect(f.texts).toContain("¡GOL!");
    expect(f.texts).toContain("PEPE PÉREZ");
    expect(f.texts).toContain("77'");
    expect(f.texts).toContain("3");
    expect(f.texts).toContain("1");
    expect(f.texts).toContain("77:00");
  });

  it("medio tiempo y final muestran el resultado y el reloj correspondiente", () => {
    const ht = fakeCtx();
    drawScene(ht.ctx, "halftime", input("broadcast", "horizontal", 2.5));
    expect(ht.texts).toContain("MEDIO TIEMPO");
    expect(ht.texts).toContain("45:00");
    const ft = fakeCtx();
    drawScene(ft.ctx, "fulltime", input("broadcast", "horizontal", 2.5));
    expect(ft.texts).toContain("FINAL");
    expect(ft.texts).toContain("90:00");
  });

  it("las tarjetas y el cambio muestran los nombres", () => {
    const y = fakeCtx(); drawScene(y.ctx, "yellow", input("broadcast", "square", 2.5));
    expect(y.texts).toContain("TARJETA AMARILLA");
    const r = fakeCtx(); drawScene(r.ctx, "red", input("broadcast", "square", 2.5));
    expect(r.texts).toContain("TARJETA ROJA");
    const s = fakeCtx(); drawScene(s.ctx, "substitution", input("broadcast", "square", 2.5));
    expect(s.texts).toContain("JUGADOR SALE");
    expect(s.texts).toContain("JUGADOR ENTRA");
  });

  it("la intro sin logo usa el nombre del torneo", () => {
    const f = fakeCtx();
    drawScene(f.ctx, "ident", input("tournament", "horizontal", 2));
    expect(f.texts).toContain("LIGA MUNICIPAL");
  });

  it("tolera textos muy largos y vacíos", () => {
    const long = "X".repeat(500);
    const f = fakeCtx();
    expect(() => drawScene(f.ctx, "goal", input("broadcast", "vertical", 2.5, { data: { ...DEFAULT_MATCH, home: long, away: "", player: long, minute: 999 } }))).not.toThrow();
  });
});

describe("washPalette", () => {
  it("usa los colores propios de cada marca", () => {
    expect(washPalette("tournament", { primary: "#1", secondary: "#2", accent: "#3", highlight: "#4", extra: "#5" })).toEqual(["#1", "#2", "#3", "#4", "#5"]);
    expect(washPalette("broadcast", { homeStripe: "#a", awayStripe: "#b", clockBg: "#c", lowerAccent: "#d", scoreBg: "#e" })).toEqual(["#a", "#b", "#c", "#d"]);
  });
});

describe("stageState (color → barrido → blanco con giro → siguiente color)", () => {
  const cfg = { D: 5.8, lead: 0, blocks: 2, white: 0.7 };
  it("mantiene un par de colores, barre al siguiente y lo mantiene", () => {
    const early = stageState(0.6, cfg), late = stageState(1.9, cfg);
    expect(early.reveal).toBe(1);
    expect(early.phase).toBeLessThan(0.2);
    expect(late.phase).toBeGreaterThan(1);
    expect(early.spin).toBe(-1);
  });
  it("pasa a blanco con el logo girando entre bloques y al final", () => {
    const mid = stageState(2.2 + 0.35, cfg);
    expect(mid.reveal).toBe(0);
    expect(mid.spin).toBeCloseTo(0.5, 1);
    expect(stageState(5.5, cfg).reveal).toBe(0);
    expect(stageState(5.5, cfg).spin).toBeGreaterThan(0);
  });
  it("el segundo bloque usa los colores siguientes de la paleta", () => {
    expect(stageState(3.3, cfg).phase).toBeGreaterThanOrEqual(2);
    expect(stageState(3.3, cfg).reveal).toBe(1);
  });
  it("fuera del video no muestra nada", () => {
    expect(stageState(-1, cfg)).toMatchObject({ reveal: 0, spin: -1 });
    expect(stageState(99, cfg)).toMatchObject({ reveal: 0, spin: -1 });
  });
});

describe("vividMid", () => {
  it("el punto medio entre colores opuestos conserva la saturación en vez de volverse gris", () => {
    const mid = vividMid("#FF2882", "#00FF87"); // rosa y verde
    const [r, g, b] = [1, 3, 5].map((k) => parseInt(mid.slice(k, k + 2), 16));
    expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeGreaterThan(150);
  });
  it("con grises usa la mezcla simple", () => {
    expect(vividMid("#000000", "#FFFFFF")).toBe("#808080");
  });
});

describe("carteles", () => {
  it("la presentación de partido muestra el torneo, los equipos y la fecha", () => {
    const f = fakeCtx();
    drawScene(f.ctx, "matchup", input("tournament", "horizontal", 4));
    expect(f.texts).toContain("Liga Municipal");
    expect(f.texts).toContain("presenta");
    expect(f.texts).toContain("Leones v Tigres");
    expect(f.texts).toContain("Domingo 8 de noviembre");
  });
  it("el equipo ideal dibuja una tarjeta por jugador según la formación", () => {
    const f = fakeCtx();
    drawScene(f.ctx, "totw", input("tournament", "portrait", 4.5));
    expect(f.texts.filter((x) => /^Jugador \d+$/.test(x))).toHaveLength(11);
    expect(f.texts).toContain("Jornada 6");
    const seven = fakeCtx();
    drawScene(seven.ctx, "totw", input("tournament", "portrait", 4.5, { data: { ...DEFAULT_MATCH, formation: "3-2-1" } }));
    expect(seven.texts.filter((x) => /^Jugador \d+$/.test(x))).toHaveLength(7);
  });
  it("el jugador de la jornada muestra título, etiqueta y nombre", () => {
    const f = fakeCtx();
    drawScene(f.ctx, "potw", input("tournament", "portrait", 4.5, { data: { ...DEFAULT_MATCH, player: "Ana Ruiz" } }));
    expect(f.texts).toContain("GANADOR");
    expect(f.texts).toContain("Ana Ruiz");
    expect(f.texts.join(" ")).toContain("JUGADOR DE LA");
  });
  it("parseFormation valida la formación", () => {
    expect(parseFormation("4-4-2")).toEqual([4, 4, 2]);
    expect(parseFormation("3-2-1")).toEqual([3, 2, 1]);
    for (const bad of ["", "abc", "9-9-9", "4-0-2", "6-3-1", "1-1-1-1-1-1"]) expect(parseFormation(bad)).toEqual([4, 3, 3]);
  });
});

describe("vividMix", () => {
  const rgb = (h: string) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16));
  it("respeta los extremos", () => {
    expect(vividMix("#EBFF00", "#963CFF", 0)).toBe("#EBFF00");
    expect(vividMix("#EBFF00", "#963CFF", 1)).toBe("#963CFF");
  });
  it("colores lejanos pasan por un tono casi blanco a mitad de camino", () => {
    const [r, g, b] = rgb(vividMix("#EBFF00", "#963CFF", 0.5));
    expect(Math.min(r, g, b)).toBeGreaterThan(200);
  });
  it("colores cercanos se mantienen vivos", () => {
    const [r, g, b] = rgb(vividMix("#EBFF00", "#00FF87", 0.5));
    expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeGreaterThan(150);
  });
});

describe("tablas animadas", () => {
  it("están en la Marca de Transmisión", () => {
    expect(templateById("results").kind).toBe("broadcast");
    expect(templateById("standings").kind).toBe("broadcast");
  });
  it("duran 10 segundos", () => {
    expect(templateById("results").duration).toBe(10);
    expect(templateById("standings").duration).toBe(10);
  });
  it("los resultados muestran cada partido y su marcador mientras se mantienen", () => {
    const f = fakeCtx();
    drawScene(f.ctx, "results", input("broadcast", "horizontal", 5));
    expect(f.texts).toContain("Leones");
    expect(f.texts).toContain("5-0");
    expect(f.texts).toContain("Rayos");
    expect(f.texts).toContain("Jornada 6");
  });
  it("un partido sin marcador se muestra como vs", () => {
    const f = fakeCtx();
    drawScene(f.ctx, "results", input("broadcast", "horizontal", 5, { data: { ...DEFAULT_MATCH, results: [{ home: "A", away: "B", homeScore: null, awayScore: null }] } }));
    expect(f.texts).toContain("vs");
  });
  it("al final ya no se ven los renglones", () => {
    const f = fakeCtx();
    drawScene(f.ctx, "results", input("broadcast", "horizontal", 9.8));
    expect(f.texts).not.toContain("Leones");
  });
  it("la tabla muestra posiciones, columnas y puntos", () => {
    const f = fakeCtx();
    drawScene(f.ctx, "standings", input("broadcast", "vertical", 5));
    expect(f.texts).toEqual(expect.arrayContaining(["PJ", "DG", "PTS", "Leones", "16", "+12"]));
  });
  it("tolera listas vacías y demasiado largas", () => {
    const empty = fakeCtx();
    expect(() => drawScene(empty.ctx, "results", input("broadcast", "square", 5, { data: { ...DEFAULT_MATCH, results: [] } }))).not.toThrow();
    const many = Array.from({ length: 40 }, (_, k) => ({ pos: k + 1, team: `E${k}`, played: 1, gd: 0, points: 0 }));
    const f = fakeCtx();
    drawScene(f.ctx, "standings", input("broadcast", "horizontal", 5, { data: { ...DEFAULT_MATCH, standings: many } }));
    expect(f.texts).toContain("E19");
    expect(f.texts).not.toContain("E20");
  });
});

describe("initials", () => {
  it("toma las iniciales de las palabras importantes", () => {
    expect(initials("Liga Municipal")).toBe("LM");
    expect(initials("Liga Municipal de Fútbol")).toBe("LMF");
    expect(initials("Águilas")).toBe("A");
    expect(initials("  ")).toBe("•");
  });
});

describe("marcadores de equipo", () => {
  it("el gol del equipo muestra siglas, el reloj corriendo y luego el resultado", () => {
    const f = fakeCtx();
    drawScene(f.ctx, "teamGoal", input("broadcast", "horizontal", 2, { data: { ...DEFAULT_MATCH, minute: 34 } }));
    expect(f.texts).toContain("LEO");
    expect(f.texts).toContain("G");
    expect(f.texts).toContain("L");
    expect(f.texts).toContain("34:02");
    const later = fakeCtx();
    drawScene(later.ctx, "teamGoal", input("broadcast", "horizontal", 4.8));
    expect(later.texts).toContain("2-1");
    expect(later.texts).not.toContain("G");
  });
  it("si anota el visitante usa sus siglas", () => {
    const f = fakeCtx();
    drawScene(f.ctx, "teamGoal", input("broadcast", "horizontal", 2, { data: { ...DEFAULT_MATCH, side: "away" } }));
    expect(f.texts).toContain("TIG");
  });
  it("la columna dibuja un marcador por equipo (máx. 12)", () => {
    const f = fakeCtx();
    drawScene(f.ctx, "teamBugs", input("broadcast", "vertical", 6));
    for (const ab of ["LEO", "TIG", "AGU", "LOB", "BUH", "HAL"]) expect(f.texts).toContain(ab);
    const many = Array.from({ length: 30 }, (_, k) => ({ name: `Equipo${String(k).padStart(2, "0")}`, color: "#112233", color2: "#FFFFFF" }));
    const g = fakeCtx();
    expect(() => drawScene(g.ctx, "teamBugs", input("broadcast", "vertical", 7, { data: { ...DEFAULT_MATCH, bugTeams: many } }))).not.toThrow();
  });
  it("los colores automáticos son estables y válidos; los inválidos se ignoran", () => {
    expect(autoTeamColors("Leones")).toEqual(autoTeamColors("Leones"));
    expect(autoTeamColors("Leones").color).toMatch(/^#[0-9A-F]{6}$/);
    expect(resolveTeamColors("Leones", "#c8102e", "")).toEqual({ color: "#C8102E", color2: autoTeamColors("Leones").color2 });
    expect(resolveTeamColors("Leones", "rojo", "#12")).toEqual(autoTeamColors("Leones"));
  });
});

describe("alineación y capas en vivo", () => {
  it("la alineación lista dorsales y nombres", () => {
    const f = fakeCtx();
    drawScene(f.ctx, "lineup", input("broadcast", "horizontal", 5));
    expect(f.texts).toEqual(expect.arrayContaining(["Leones · Alineación", "Portero Uno", "1", "9"]));
  });
  it("las capas en vivo dibujan marcador, gol, rótulo y patrocinador", () => {
    const f = fakeCtx();
    drawLiveOverlay(f.ctx, input("broadcast", "horizontal", 0), {
      scoreboard: true, clock: "12:34", goal: { side: "home", t: 2 },
      lower: { kind: "yellow", side: "away", t: 2, text: "Luis", minute: 12 }, sponsor: { index: 0, t: 3 },
    });
    expect(f.texts).toEqual(expect.arrayContaining(["12:34", "LEO", "AMARILLA · LUIS", "12'", "PATROCINADOR", "Tu patrocinador"]));
  });
  it("sin nada activo no dibuja texto", () => {
    const f = fakeCtx();
    drawLiveOverlay(f.ctx, input("broadcast", "vertical", 0), { scoreboard: false, clock: "00:00" });
    expect(f.texts).toEqual([]);
  });
});

describe("paletteOf", () => {
  it("prefiere la paleta de identidad y descarta valores inválidos", () => {
    const colors = DEFAULT_BRANDS.broadcast.colors;
    expect(paletteOf({ kind: "broadcast", colors, palette: ["#FF2882", "#008CFF", "rojo"] })).toEqual(["#FF2882", "#008CFF"]);
    expect(paletteOf({ kind: "broadcast", colors, palette: [] })).toEqual(washPalette("broadcast", colors));
    expect(paletteOf({ kind: "broadcast", colors })).toEqual(washPalette("broadcast", colors));
  });
});

describe("degradados sin tonos ajenos a la paleta", () => {
  const hue = (hex: string) => { const r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (d < 0.15) return null;
    let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; return h < 0 ? h + 360 : h; };
  const orangeIn = (pal: string[]) => {
    for (let x = 0; x < pal.length; x += 0.02) { const h = hue(samplePalette(pal, x)); if (h !== null && h >= 18 && h <= 45) return samplePalette(pal, x); }
    return null;
  };
  it("con la paleta real del usuario nunca aparece naranja", () => {
    expect(orangeIn(["#FF2882", "#008CFF", "#EBFF00", "#00FF87", "#05F0FF"])).toBeNull();
  });
  it("violeta → amarillo no pasa por naranja si la paleta no lo tiene", () => {
    expect(orangeIn(["#7C3AED", "#7C3AED", "#EBFF00", "#00FF87", "#05F0FF"])).toBeNull();
  });
  it("si la paleta sí tiene naranja, puede usarlo", () => {
    expect(orangeIn(["#FF2882", "#FF6900", "#EBFF00"])).not.toBeNull();
  });
  it("los extremos se respetan", () => {
    expect(vividMix("#FF2882", "#008CFF", 0, ["#FF2882", "#008CFF"])).toBe("#FF2882");
    expect(vividMix("#FF2882", "#008CFF", 1, ["#FF2882", "#008CFF"])).toBe("#008CFF");
  });
});
