import { describe, expect, it } from "vitest";
import { DEFAULT_BRANDS } from "@/lib/brand";
import { DEFAULT_MATCH, FORMATS, TEMPLATES, drawScene, templateById, washPalette, type FormatId, type SceneInput } from "./scenes";

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
    expect(TEMPLATES.every((t) => t.duration > 2 && t.duration < 8)).toBe(true);
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
    expect(washPalette("broadcast", { homeStripe: "#a", awayStripe: "#b", clockBg: "#c", lowerAccent: "#d", scoreBg: "#e" })).toEqual(["#a", "#b", "#c", "#d", "#e"]);
  });
});
