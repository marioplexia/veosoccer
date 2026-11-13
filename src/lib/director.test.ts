import { describe, expect, it } from "vitest";
import { DURATIONS, GOAL_SECONDS, SPONSOR_SECONDS, direct, liveScore, scorersOf, matchClock, matchMinute, type DirectorState } from "./director";

const T0 = 1_000_000;
const base = (over: Partial<DirectorState> = {}): DirectorState => ({
  phase: "1T", phaseStartedAt: T0, events: [], sponsors: 2, adEveryMinutes: 8, lineups: { home: true, away: true }, ...over,
});
const at = (sec: number) => T0 + sec * 1000;

describe("reloj", () => {
  it("1T empieza en 00:00 y 2T en 45:00", () => {
    expect(matchClock("1T", T0, at(0))).toBe("00:00");
    expect(matchClock("1T", T0, at(754))).toBe("12:34");
    expect(matchClock("2T", T0, at(90))).toBe("46:30");
    expect(matchClock("descanso", T0, at(300))).toBe("45:00");
    expect(matchClock("previa", T0, at(99))).toBe("00:00");
  });
  it("el minuto del evento es el que corre", () => {
    expect(matchMinute("1T", T0, at(10))).toBe(1);
    expect(matchMinute("1T", T0, at(33 * 60 + 5))).toBe(34);
    expect(matchMinute("2T", T0, at(0))).toBe(46);
  });
});

describe("previa", () => {
  it("encadena intro, presentación, alineaciones y cámara, en bucle", () => {
    const s = base({ phase: "previa" });
    expect(direct(s, at(1)).full?.scene).toBe("ident");
    expect(direct(s, at(DURATIONS.ident + 1)).full?.scene).toBe("matchup");
    expect(direct(s, at(DURATIONS.ident + DURATIONS.matchup + 1)).full?.scene).toBe("lineupHome");
    expect(direct(s, at(DURATIONS.ident + DURATIONS.matchup + DURATIONS.lineupHome + 1)).full?.scene).toBe("lineupAway");
    const cam = direct(s, at(DURATIONS.ident + DURATIONS.matchup + 20 + 1));
    expect(cam.full).toBeUndefined();
    const cycle = DURATIONS.ident + DURATIONS.matchup + 20 + 25;
    expect(direct(s, at(cycle + 1)).full?.scene).toBe("ident");
  });
  it("sin plantillas se salta las alineaciones", () => {
    const s = base({ phase: "previa", lineups: { home: false, away: false } });
    expect(direct(s, at(DURATIONS.ident + DURATIONS.matchup + 1)).full).toBeUndefined();
  });
});

describe("en juego", () => {
  it("1T arranca con la presentación de inicio y luego deja el marcador", () => {
    expect(direct(base(), at(1)).full?.scene).toBe("kickoff");
    const s = direct(base(), at(DURATIONS.kickoff + 1));
    expect(s.full).toBeUndefined();
    expect(s.scoreboard).toBe(true);
  });
  it("un gol muestra la animación y después al goleador", () => {
    const s = base({ events: [{ kind: "goal", at: at(600), side: "away", minute: 11, player: "Pepe" }] });
    expect(direct(s, at(601)).goal).toMatchObject({ side: "away", minute: 11 });
    const after = direct(s, at(600 + GOAL_SECONDS + 1));
    expect(after.goal).toBeUndefined();
    expect(after.lower).toMatchObject({ kind: "scorer", text: "Pepe" });
    expect(direct(s, at(600 + GOAL_SECONDS + 20)).lower).toBeUndefined();
  });
  it("sin goleador no hay rótulo después del gol", () => {
    const s = base({ events: [{ kind: "goal", at: at(600), side: "home", minute: 11 }] });
    expect(direct(s, at(600 + GOAL_SECONDS + 1)).lower).toBeUndefined();
  });
  it("tarjetas y cambios salen como rótulo unos segundos", () => {
    const s = base({ events: [{ kind: "yellow", at: at(700), side: "home", minute: 12, player: "Luis" }] });
    expect(direct(s, at(702)).lower).toMatchObject({ kind: "yellow", text: "Luis" });
    const sub = base({ events: [{ kind: "sub", at: at(700), side: "away", minute: 12, playerIn: "A", playerOut: "B" }] });
    expect(direct(sub, at(701)).lower?.text).toBe("A ↔ B");
  });
  it("los anuncios rotan cada N minutos y ceden ante un gol", () => {
    const s = base({ adEveryMinutes: 8 });
    expect(direct(s, at(7 * 60)).sponsor).toBeUndefined();
    expect(direct(s, at(8 * 60 + 1)).sponsor).toMatchObject({ index: 0 });
    expect(direct(s, at(8 * 60 + SPONSOR_SECONDS + 1)).sponsor).toBeUndefined();
    expect(direct(s, at(16 * 60 + 1)).sponsor).toMatchObject({ index: 1 });
    expect(direct(s, at(24 * 60 + 1)).sponsor).toMatchObject({ index: 0 });
    const withGoal = base({ events: [{ kind: "goal", at: at(8 * 60), side: "home", minute: 9 }] });
    const sh = direct(withGoal, at(8 * 60 + 2));
    expect(sh.goal).toBeDefined();
    expect(sh.sponsor).toBeUndefined();
  });
  it("sin patrocinadores no hay anuncios", () => {
    expect(direct(base({ sponsors: 0 }), at(8 * 60 + 1)).sponsor).toBeUndefined();
  });
  it("ignora eventos con hora futura", () => {
    const s = base({ events: [{ kind: "goal", at: at(9999), side: "home", minute: 1 }] });
    expect(direct(s, at(100)).goal).toBeUndefined();
  });
});

describe("descanso y final", () => {
  it("descanso: medio tiempo, luego tabla, resultados y cámara con marcador", () => {
    const s = base({ phase: "descanso" });
    expect(direct(s, at(1)).full?.scene).toBe("halftime");
    expect(direct(s, at(DURATIONS.halftime + 1)).full?.scene).toBe("standings");
    expect(direct(s, at(DURATIONS.halftime + 11)).full?.scene).toBe("results");
    const cam = direct(s, at(DURATIONS.halftime + 21));
    expect(cam.full).toBeUndefined();
    expect(cam.scoreboard).toBe(true);
    expect(direct(s, at(DURATIONS.halftime + 46)).full?.scene).toBe("standings");
  });
  it("final: resultado final y luego el bucle de cierre", () => {
    const s = base({ phase: "final" });
    expect(direct(s, at(1)).full?.scene).toBe("fulltime");
    expect(direct(s, at(DURATIONS.fulltime + 1)).full?.scene).toBe("results");
    expect(direct(s, at(1)).clock).toBe("FINAL");
  });
});

describe("liveScore", () => {
  it("suma los goles registrados al marcador inicial", () => {
    expect(liveScore({ home: 1, away: 0 }, [
      { kind: "goal", at: 1, side: "away", minute: 3 }, { kind: "yellow", at: 2, side: "home", minute: 4 }, { kind: "goal", at: 3, side: "away", minute: 5 },
    ])).toEqual({ home: 1, away: 2 });
  });
});

describe("scorersOf", () => {
  it("agrupa los goles con nombre por jugador, en orden, y omite los que no tienen nombre", () => {
    const ev = [
      { kind: "goal" as const, at: 3, side: "home" as const, minute: 34, player: "Ana" },
      { kind: "goal" as const, at: 1, side: "home" as const, minute: 12, player: "Ana" },
      { kind: "goal" as const, at: 2, side: "away" as const, minute: 20 },
      { kind: "goal" as const, at: 4, side: "away" as const, minute: 51, player: "Luz" },
    ];
    expect(scorersOf(ev)).toEqual({ home: ["Ana 12', 34'"], away: ["Luz 51'"] });
  });
});

describe("falta", () => {
  it("muestra un rótulo con el equipo (o el jugador si se indicó) y vuelve al marcador", () => {
    const s = base({ phase: "1T", names: { home: "Leones", away: "Tigres" }, events: [{ kind: "foul", at: at(60), side: "away", minute: 1 }] });
    const shot = direct(s, at(62));
    expect(shot.lower).toMatchObject({ kind: "foul", side: "away", text: "Tigres", minute: 1 });
    expect(shot.scoreboard).toBe(true);
    const named = base({ phase: "1T", events: [{ kind: "foul", at: at(60), side: "home", minute: 1, player: "Ana" }] });
    expect(direct(named, at(62)).lower?.text).toBe("Ana");
    expect(direct(s, at(120)).lower).toBeUndefined();
  });
});
