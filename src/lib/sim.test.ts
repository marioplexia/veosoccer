import { describe, expect, it } from "vitest";
import { direct, liveScore } from "./director";
import { SIM_CHAPTERS, SIM_DURATION, simulateAt } from "./sim";

const opts = { sponsors: 2, names: (side: "home" | "away", k: number) => `${side === "home" ? "Loc" : "Vis"} ${k}` };
const shotAt = (t: number) => { const s = simulateAt(t, opts); return direct(s.state, s.now); };

describe("simulador", () => {
  it("cada capítulo muestra lo que promete", () => {
    expect(shotAt(1).full?.scene).toBe("ident");
    expect(shotAt(33).full?.scene).toBe("kickoff");
    expect(shotAt(42).goal?.side).toBe("home");
    expect(shotAt(49).lower).toMatchObject({ kind: "scorer", text: "Loc 9", minute: 13 });
    expect(shotAt(57).sponsor).toMatchObject({ slot: 0 });
    expect(shotAt(70).sponsor).toMatchObject({ slot: 1 });
    expect(shotAt(82).lower).toMatchObject({ kind: "yellow", text: "Vis 4" });
    expect(shotAt(90).full?.scene).toBe("halftime");
    expect(shotAt(100).full?.scene).toBe("standings");
    expect(shotAt(118).goal?.side).toBe("away");
    expect(shotAt(130).lower).toMatchObject({ kind: "sub", text: "Loc 11 ↔ Loc 7" });
    expect(shotAt(138).full?.scene).toBe("fulltime");
  });
  it("el reloj refleja los minutos del tramo", () => {
    expect(shotAt(39).clock).toBe("12:00");
    expect(shotAt(56).clock).toBe("08:00");
    expect(shotAt(116).clock).toBe("67:02");
  });
  it("el marcador final es 1-1", () => {
    const s = simulateAt(SIM_DURATION, opts);
    expect(liveScore({ home: 0, away: 0 }, s.state.events)).toEqual({ home: 1, away: 1 });
  });
  it("los capítulos están en orden y dentro de la duración", () => {
    const ts = SIM_CHAPTERS.map((c) => c.t);
    expect([...ts].sort((a, b) => a - b)).toEqual(ts);
    expect(Math.max(...ts)).toBeLessThan(SIM_DURATION);
  });
  it("acota tiempos fuera de rango", () => {
    expect(() => simulateAt(-5, opts)).not.toThrow();
    expect(() => simulateAt(9999, opts)).not.toThrow();
  });
});
