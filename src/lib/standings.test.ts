import { describe, expect, it } from "vitest";
import { computeScorers, computeStandings } from "./standings";

const teams = [
  { id: "a", name: "Águilas" },
  { id: "b", name: "Búhos" },
  { id: "c", name: "Cóndores" },
];

describe("computeStandings", () => {
  it("suma 3 por victoria, 1 por empate y calcula diferencia", () => {
    const t = computeStandings(teams, [
      { home_team_id: "a", away_team_id: "b", home_score: 2, away_score: 0 },
      { home_team_id: "b", away_team_id: "c", home_score: 1, away_score: 1 },
      { home_team_id: "c", away_team_id: "a", home_score: 0, away_score: 0 },
    ]);
    const a = t.find((r) => r.teamId === "a")!;
    expect(a).toMatchObject({ played: 2, won: 1, drawn: 1, points: 4, gf: 2, ga: 0, gd: 2 });
    expect(t[0].teamId).toBe("a");
    expect(t.map((r) => r.points)).toEqual([4, 2, 1]);
  });

  it("ignora partidos sin marcador y desempata por diferencia de goles", () => {
    const t = computeStandings(teams, [
      { home_team_id: "a", away_team_id: "b", home_score: null, away_score: null },
      { home_team_id: "b", away_team_id: "c", home_score: 3, away_score: 0 },
      { home_team_id: "c", away_team_id: "a", home_score: 1, away_score: 0 },
    ]);
    expect(t.map((r) => r.teamId)).toEqual(["b", "c", "a"]);
    expect(t.find((r) => r.teamId === "a")!.played).toBe(1);
  });

  it("ignora equipos desconocidos", () => {
    const t = computeStandings(teams, [{ home_team_id: "x", away_team_id: "a", home_score: 1, away_score: 0 }]);
    expect(t.every((r) => r.played === 0)).toBe(true);
  });
});

describe("computeScorers", () => {
  it("agrupa por jugador sin distinguir mayúsculas ni espacios", () => {
    const s = computeScorers([
      { team_id: "a", player_name: "Pepe" },
      { team_id: "a", player_name: " pepe " },
      { team_id: "b", player_name: "Luis" },
    ]);
    expect(s[0]).toMatchObject({ player: "Pepe", goals: 2, teamId: "a" });
    expect(s).toHaveLength(2);
  });
});
