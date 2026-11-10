import { describe, expect, it } from "vitest";
import { generateMultiSchedule, generateSchedule, roundRobin, venueConflicts } from "./scheduler";

const ids = (n: number) => Array.from({ length: n }, (_, i) => `t${i + 1}`);

describe("roundRobin", () => {
  it.each([2, 3, 4, 5, 6, 8])("con %i equipos todos juegan contra todos exactamente una vez", (n) => {
    const m = roundRobin(ids(n));
    expect(m).toHaveLength((n * (n - 1)) / 2);
    const pairs = new Set(m.map((x) => [x.homeId, x.awayId].sort().join("-")));
    expect(pairs.size).toBe(m.length);
  });

  it("nadie juega dos veces en la misma jornada", () => {
    for (const n of [4, 5, 7, 8]) {
      const byRound = new Map<number, string[]>();
      for (const x of roundRobin(ids(n))) byRound.set(x.round, [...(byRound.get(x.round) ?? []), x.homeId, x.awayId]);
      for (const teams of byRound.values()) expect(new Set(teams).size).toBe(teams.length);
    }
  });

  it("ida y vuelta duplica los partidos invirtiendo la localía", () => {
    const m = roundRobin(ids(4), true);
    expect(m).toHaveLength(12);
    const first = m.find((x) => x.round === 1)!;
    expect(m.some((x) => x.round > 3 && x.homeId === first.awayId && x.awayId === first.homeId)).toBe(true);
  });

  it("devuelve vacío con menos de 2 equipos", () => {
    expect(roundRobin(["a"])).toEqual([]);
    expect(roundRobin([])).toEqual([]);
  });
});

describe("generateSchedule", () => {
  const cfg = { startDate: "2026-12-05", firstKickoff: "09:00", slotMinutes: 90, daysBetweenRounds: 7, doubleRound: false };

  it("reparte los partidos de una jornada entre canchas y horarios", () => {
    const f = generateSchedule(ids(6), ["v1", "v2"], cfg).filter((x) => x.round === 1);
    expect(f).toHaveLength(3);
    expect(f.map((x) => `${x.venueId}@${x.kickoff}`)).toEqual([
      "v1@2026-12-05T09:00:00",
      "v2@2026-12-05T09:00:00",
      "v1@2026-12-05T10:30:00",
    ]);
  });

  it("nunca programa dos partidos en la misma cancha y hora", () => {
    const f = generateSchedule(ids(8), ["v1", "v2", "v3"], cfg);
    const keys = f.map((x) => `${x.venueId}@${x.kickoff}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("avanza una semana por jornada", () => {
    const f = generateSchedule(ids(4), ["v1"], cfg);
    expect(f.find((x) => x.round === 2)!.kickoff!.startsWith("2026-12-12")).toBe(true);
  });

  it("sin canchas deja venue y hora vacíos", () => {
    const f = generateSchedule(ids(4), [], cfg);
    expect(f.every((x) => x.venueId === null && x.kickoff === null)).toBe(true);
  });

  it("pasa al día siguiente si los horarios cruzan la medianoche", () => {
    const f = generateSchedule(ids(4), ["v1"], { ...cfg, firstKickoff: "23:00", slotMinutes: 90 }).filter((x) => x.round === 1);
    expect(f[1].kickoff).toBe("2026-12-06T00:30:00");
  });
});

describe("generateMultiSchedule (divisiones que comparten canchas)", () => {
  const cfg = { startDate: "2026-12-05", firstKickoff: "10:00", slotMinutes: 120, daysBetweenRounds: 7, doubleRound: false };
  const divs = [
    { id: "premier", teamIds: ["p1", "p2", "p3", "p4"] },
    { id: "segundas", teamIds: ["s1", "s2", "s3", "s4", "s5", "s6"] },
    { id: "terceras", teamIds: ["t1", "t2"] },
  ];

  it("nunca repite cancha y hora entre divisiones", () => {
    const f = generateMultiSchedule(divs, ["cda", "taconi", "corona"], cfg);
    const keys = f.map((x) => `${x.venueId}@${x.kickoff}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("cada division juega solo contra sus propios equipos y completa su todos contra todos", () => {
    const f = generateMultiSchedule(divs, ["cda", "taconi"], cfg);
    for (const d of divs) {
      const mine = f.filter((x) => x.divisionId === d.id);
      expect(mine).toHaveLength((d.teamIds.length * (d.teamIds.length - 1)) / 2);
      for (const m of mine) expect(d.teamIds).toContain(m.homeId);
    }
  });

  it("las divisiones con menos jornadas terminan antes sin dejar huecos", () => {
    const f = generateMultiSchedule(divs, ["cda"], cfg);
    expect(Math.max(...f.filter((x) => x.divisionId === "terceras").map((x) => x.round))).toBe(1);
    expect(Math.max(...f.filter((x) => x.divisionId === "segundas").map((x) => x.round))).toBe(5);
  });

  it("una division sin equipos suficientes no genera partidos", () => {
    expect(generateMultiSchedule([{ id: "x", teamIds: ["solo"] }], ["v"], cfg)).toEqual([]);
  });
});

describe("venueConflicts", () => {
  it("marca los partidos que comparten cancha y hora", () => {
    const c = venueConflicts([
      { id: "a", venue_id: "v1", kickoff: "2026-12-05T10:00:00" },
      { id: "b", venue_id: "v1", kickoff: "2026-12-05T10:00:00" },
      { id: "c", venue_id: "v1", kickoff: "2026-12-05T12:00:00" },
      { id: "d", venue_id: null, kickoff: "2026-12-05T10:00:00" },
      { id: "e", venue_id: null, kickoff: "2026-12-05T10:00:00" },
    ]);
    expect([...c].sort()).toEqual(["a", "b"]);
  });
});
