// Liga de ejemplo para la página pública de partidos (no son datos reales).
import type { Division, Fixture } from "@/lib/types";

export const DEMO_DIVISIONS: Division[] = [{ id: "premier", name: "Primera", position: 0 }, { id: "segunda", name: "Segunda", position: 1 }];
const NAMES: Record<string, string[]> = {
  premier: ["Leones", "Tigres", "Águilas", "Halcones", "Lobos", "Toros", "Búhos", "Pumas"],
  segunda: ["Cóndores", "Jaguares", "Delfines", "Osos", "Zorros", "Panteras"],
};
const COLORS = ["#C8102E", "#FDB913", "#1D4ED8", "#0F766E", "#4B5563", "#7C2D12", "#6D28D9", "#0EA5E9"];
const VENUES = ["Cancha Central", "Deportivo Norte", "Unidad Sur"];

export const DEMO_TEAMS = Object.entries(NAMES).flatMap(([division_id, names]) =>
  names.map((name, k) => ({ id: `${division_id}-${k}`, name, division_id, crestUrl: null as string | null, color: COLORS[k % COLORS.length] })));

/** Todos contra todos (método del círculo); las primeras 4 jornadas ya se jugaron. */
function schedule(division: string, n: number): Fixture[] {
  const ids = Array.from({ length: n }, (_, k) => `${division}-${k}`);
  const out: Fixture[] = [];
  const rot = [...ids];
  for (let r = 0; r < n - 1; r++) {
    for (let k = 0; k < n / 2; k++) {
      const a = rot[k], b = rot[n - 1 - k];
      const [home, away] = r % 2 ? [b, a] : [a, b];
      const seed = (r * 7 + k * 13 + division.length) % 11;
      const done = r < 4;
      const date = new Date(Date.UTC(2026, 9, 3 + r * 7 + (k % 2))).toISOString().slice(0, 10);
      out.push({
        id: `${division}-j${r + 1}-${k}`, division_id: division, round: r + 1, home_team_id: home, away_team_id: away,
        venue_id: VENUES[k % VENUES.length], kickoff: `${date}T${10 + (k % 4) * 2}:00:00`,
        home_score: done ? seed % 4 : null, away_score: done ? (seed * 3) % 3 : null, note: null,
      });
    }
    rot.splice(1, 0, rot.pop()!);
  }
  return out;
}
export const DEMO_FIXTURES: Fixture[] = [...schedule("premier", 8), ...schedule("segunda", 6)];
