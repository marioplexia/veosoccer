import { describe, expect, it } from "vitest";
import { groupByDay, sanitizeSummary, teamForm, teamUpcoming, timeOf } from "./match-view";
import type { Fixture } from "./types";

const fx = (id: string, round: number, h: string, a: string, hs: number | null, as: number | null, kickoff: string | null = null): Fixture =>
  ({ id, division_id: "d", round, home_team_id: h, away_team_id: a, venue_id: null, kickoff, home_score: hs, away_score: as, note: null });

describe("forma del equipo", () => {
  const list = [fx("1", 1, "A", "B", 2, 0), fx("2", 2, "C", "A", 1, 1), fx("3", 3, "A", "D", 0, 3), fx("4", 4, "B", "A", null, null), fx("5", 5, "A", "C", null, null)];
  it("da los últimos jugados en orden, desde la perspectiva del equipo", () => {
    expect(teamForm("A", list).map((e) => `${e.result}${e.gf}-${e.ga}${e.home ? "H" : "A"}`)).toEqual(["W2-0H", "D1-1A", "L0-3H"]);
    expect(teamForm("A", list, "3").length).toBe(2);
    expect(teamForm("A", list, undefined, 1)[0].round).toBe(3);
  });
  it("da los próximos sin jugar", () => {
    expect(teamUpcoming("A", list).map((e) => e.opponentId)).toEqual(["B", "C"]);
    expect(teamUpcoming("A", list, "4").map((e) => e.opponentId)).toEqual(["C"]);
  });
});

describe("agrupar por día", () => {
  it("ordena por fecha y deja al final los que no tienen", () => {
    const g = groupByDay([fx("1", 1, "A", "B", null, null, "2026-11-07T16:00:00"), fx("2", 1, "C", "D", null, null), fx("3", 1, "E", "F", null, null, "2026-11-06T20:00:00"), fx("4", 1, "G", "H", null, null, "2026-11-07T12:00:00")]);
    expect(g.map((x) => x.items.map((i) => i.id).join(""))).toEqual(["3", "41", "2"]);
    expect(g[2].label).toBe("Sin fecha");
    expect(timeOf("2026-11-07T16:05:00")).toBe("16:05");
    expect(timeOf("2026-11-07T00:00:00")).toBeNull();
  });
});

describe("sanitizeSummary", () => {
  it("recorta, limita y descarta lo inválido", () => {
    const s = sanitizeSummary({ headline: "  Gran   triunfo ", paragraphs: ["uno", 3, "dos"], moments: [{ minute: 12.4, text: "Gol" }, { minute: 999, text: "Raro" }, { text: "" }], closing: "Fin", social: "Post" });
    expect(s).toEqual({ headline: "Gran triunfo", paragraphs: ["uno", "dos"], moments: [{ minute: 12, text: "Gol" }, { minute: null, text: "Raro" }], closing: "Fin", social: "Post" });
    expect(sanitizeSummary({ headline: "", paragraphs: ["x"] })).toBeNull();
    expect(sanitizeSummary("texto")).toBeNull();
  });
});
