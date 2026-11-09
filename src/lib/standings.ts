export type FixtureLite = {
  home_team_id: string;
  away_team_id: string;
  home_score: number | null;
  away_score: number | null;
};

export type TeamLite = { id: string; name: string };

export type StandingRow = {
  teamId: string;
  name: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
};

/** Tabla de posiciones: 3 pts victoria, 1 empate. Desempate: puntos, diferencia, goles a favor, nombre. */
export function computeStandings(teams: TeamLite[], fixtures: FixtureLite[]): StandingRow[] {
  const rows = new Map<string, StandingRow>(
    teams.map((t) => [t.id, { teamId: t.id, name: t.name, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0 }]),
  );

  for (const f of fixtures) {
    if (f.home_score == null || f.away_score == null) continue;
    const home = rows.get(f.home_team_id);
    const away = rows.get(f.away_team_id);
    if (!home || !away) continue;

    home.played++; away.played++;
    home.gf += f.home_score; home.ga += f.away_score;
    away.gf += f.away_score; away.ga += f.home_score;

    if (f.home_score > f.away_score) { home.won++; home.points += 3; away.lost++; }
    else if (f.home_score < f.away_score) { away.won++; away.points += 3; home.lost++; }
    else { home.drawn++; away.drawn++; home.points++; away.points++; }
  }

  const list = [...rows.values()];
  for (const r of list) r.gd = r.gf - r.ga;
  return list.sort(
    (a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf || a.name.localeCompare(b.name, "es"),
  );
}

export type GoalLite = { team_id: string; player_name: string };
export type ScorerRow = { player: string; teamId: string; goals: number };

/** Goleadores: agrupa por jugador y equipo (sin distinguir mayúsculas ni espacios sobrantes). */
export function computeScorers(goals: GoalLite[]): ScorerRow[] {
  const map = new Map<string, ScorerRow>();
  for (const g of goals) {
    const player = g.player_name.trim();
    const key = `${g.team_id}|${player.toLowerCase()}`;
    const row = map.get(key);
    if (row) row.goals++;
    else map.set(key, { player, teamId: g.team_id, goals: 1 });
  }
  return [...map.values()].sort((a, b) => b.goals - a.goals || a.player.localeCompare(b.player, "es"));
}
