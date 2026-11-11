import { describe, expect, it } from "vitest";
import { DEFAULT_BRANDS } from "@/lib/brand";
import { direct } from "@/lib/director";
import { SIM_DURATION, simulateAt } from "@/lib/sim";
import { renderBroadcastFrame } from "./broadcast-frame";
import { DEFAULT_MATCH, type SceneInput } from "./scenes";
import { drawLedBand, drawLedBoard, drawStadium } from "./stadium";

function fakeCtx() {
  const texts: string[] = [];
  const target: Record<string, unknown> = {};
  const gradient = { addColorStop() {} };
  const ctx = new Proxy(target, {
    get(_t, prop: string) {
      if (prop in target) return target[prop];
      if (prop === "measureText") return (s: string) => ({ width: s.length * 12 });
      if (prop === "createLinearGradient" || prop === "createRadialGradient") return () => gradient;
      if (prop === "fillText" || prop === "strokeText") return (s: string) => { texts.push(s); };
      return () => undefined;
    },
    set(_t, prop: string, v) { target[prop] = v; return true; },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, texts };
}

const input = (over: Partial<SceneInput> = {}): SceneInput => ({
  w: 1280, h: 720, t: 0, kind: "broadcast", colors: DEFAULT_BRANDS.broadcast.colors, fonts: DEFAULT_BRANDS.broadcast.fonts,
  logo: null, logoSize: null, tournamentName: "Liga Municipal",
  data: { ...DEFAULT_MATCH, sponsors: [{ name: "Refaccionaria Polo" }, { name: "Tortillería" }] }, ...over,
});

describe("vallas LED y estadio", () => {
  it("la valla muestra al patrocinador del turno y rota cada 6 s", () => {
    const a = fakeCtx(); drawLedBoard(a.ctx, input(), 0, 0, 1000, 60, 1);
    expect(a.texts).toContain("REFACCIONARIA POLO");
    const b = fakeCtx(); drawLedBoard(b.ctx, input(), 0, 0, 1000, 60, 7);
    expect(b.texts).toContain("TORTILLERÍA");
  });
  it("sin patrocinadores muestra el nombre del torneo", () => {
    const f = fakeCtx(); drawLedBoard(f.ctx, input({ data: { ...DEFAULT_MATCH, sponsors: [] } }), 0, 0, 800, 50, 2);
    expect(f.texts).toContain("LIGA MUNICIPAL");
  });
  it("el estadio y la franja se dibujan sin errores en todo momento", () => {
    for (let t = 0; t < 60; t += 0.7) {
      expect(() => drawStadium(fakeCtx().ctx, input(), t)).not.toThrow();
      expect(() => drawLedBand(fakeCtx().ctx, input(), t % 10)).not.toThrow();
    }
  });
});

describe("cuadro de transmisión", () => {
  it("los anuncios alternan entre tarjeta y franja LED", () => {
    const opts = { sponsors: 2, names: () => "X" };
    const card = fakeCtx(); const s1 = simulateAt(57, opts);
    renderBroadcastFrame(card.ctx, direct(s1.state, s1.now), input(), { home: DEFAULT_MATCH.lineup, away: DEFAULT_MATCH.lineup }, () => undefined);
    expect(card.texts).toContain("PATROCINADOR");
    const led = fakeCtx(); const s2 = simulateAt(70, opts);
    renderBroadcastFrame(led.ctx, direct(s2.state, s2.now), input(), { home: DEFAULT_MATCH.lineup, away: DEFAULT_MATCH.lineup }, () => undefined);
    expect(led.texts).not.toContain("PATROCINADOR");
    expect(led.texts.some((x) => x === "REFACCIONARIA POLO" || x === "TORTILLERÍA")).toBe(true);
  });
  it("la simulación completa se dibuja sin errores cuadro a cuadro", () => {
    const opts = { sponsors: 2, names: (_s: "home" | "away", k: number) => `J${k}` };
    for (let t = 0; t <= SIM_DURATION; t += 0.5) {
      const s = simulateAt(t, opts);
      expect(() => renderBroadcastFrame(fakeCtx().ctx, direct(s.state, s.now), input(), { home: DEFAULT_MATCH.lineup, away: { team: "Tigres", players: [] } }, (c) => drawStadium(c, input(), t))).not.toThrow();
    }
  });
});
