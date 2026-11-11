// Datos que necesitan los gráficos de la transmisión (real o simulada).
import { formatKickoff } from "@/lib/format";
import { DEFAULT_MATCH, resolveTeamColors, type MatchData } from "@/lib/motion/scenes";
import type { Lineups } from "@/lib/motion/broadcast-frame";
import { computeStandings } from "@/lib/standings";
import type { Fixture, Player, Sponsor, Team } from "@/lib/types";

export function buildBroadcastData(a: {
  fixture: Fixture; teams: Team[]; divisionFixtures: Fixture[]; sponsors: Sponsor[];
  score: { home: number; away: number }; started: boolean; scorers?: MatchData["scorers"];
}): MatchData {
  const { fixture, teams } = a;
  const home = teams.find((t) => t.id === fixture.home_team_id);
  const away = teams.find((t) => t.id === fixture.away_team_id);
  const homeName = home?.name ?? "Local", awayName = away?.name ?? "Visitante";
  const fx = a.divisionFixtures.map((f) => (f.id === fixture.id && a.started ? { ...f, home_score: a.score.home, away_score: a.score.away } : f));
  const nm = (id: string) => teams.find((t) => t.id === id)?.name ?? "?";
  const hc = resolveTeamColors(homeName, home?.color ?? "", home?.color2 ?? "");
  const ac = resolveTeamColors(awayName, away?.color ?? "", away?.color2 ?? "");
  const divTeams = teams.filter((t) => t.division_id === fixture.division_id);
  return {
    ...DEFAULT_MATCH,
    home: homeName, away: awayName, homeScore: a.score.home, awayScore: a.score.away,
    homeColor: hc.color, homeColor2: hc.color2, awayColor: ac.color, awayColor2: ac.color2,
    round: fixture.round, subtitle: formatKickoff(fixture.kickoff), tableTitle: `Jornada ${fixture.round}`,
    results: fx.filter((f) => f.round === fixture.round).map((f) => ({
      home: nm(f.home_team_id), away: nm(f.away_team_id), homeScore: f.home_score, awayScore: f.away_score,
      homeCrest: `crest:${f.home_team_id}`, awayCrest: `crest:${f.away_team_id}`,
    })),
    standings: computeStandings(divTeams.length ? divTeams : teams, fx).map((r, k) => ({ pos: k + 1, team: r.name, played: r.played, gd: r.gd, points: r.points, crest: `crest:${r.teamId}` })),
    sponsors: a.sponsors.map((s, k) => ({ name: s.name, image: s.image_path ? `sponsor:${k}` : undefined })),
    lineup: { team: homeName, players: [] },
    scorers: a.scorers ?? { home: [], away: [] },
  };
}

export function buildLineups(fixture: Fixture, teams: Team[], players: Player[]): Lineups {
  const side = (teamId: string) => ({
    team: teams.find((t) => t.id === teamId)?.name ?? "",
    players: players.filter((x) => x.team_id === teamId).slice(0, 18).map((x) => ({ number: x.number, name: x.name })),
  });
  return { home: side(fixture.home_team_id), away: side(fixture.away_team_id) };
}
