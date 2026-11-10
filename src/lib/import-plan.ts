import { type ExtractedDivision, normName } from "@/lib/extract";

export type ImportFixtureRow = {
  tournament_id: string;
  division_id: string;
  round: number;
  home_team_id: string;
  away_team_id: string;
  venue_id: string | null;
  kickoff: string | null;
  note: string | null;
};

type ExistingFixture = { division_id: string; round: number; home_team_id: string; away_team_id: string };

/**
 * Convierte los partidos leídos por la IA en filas para guardar.
 * - Los equipos se resuelven DENTRO de su división (el mismo club puede estar en varias).
 * - Se omiten los partidos que ya existen (en cualquier orden local/visitante) y los repetidos en la imagen.
 * - Los partidos cuyos equipos no se encuentran se cuentan como "unresolved".
 * - Si hay fecha pero no hora, la hora queda en 00:00 (la interfaz no la muestra).
 */
export function buildImportFixtures(args: {
  tournamentId: string;
  divisions: ExtractedDivision[];
  divisionIds: Map<string, string>;           // normName(división) -> id
  teamIds: Map<string, string>;               // `${divisionId}|${normName(equipo)}` -> id
  venueIds: Map<string, string>;              // normName(cancha) -> id
  existing: ExistingFixture[];
  defaultRound: number;
}): { rows: ImportFixtureRow[]; duplicates: number; unresolved: number } {
  const seen = new Set(args.existing.map((f) => `${f.division_id}|${f.round}|${f.home_team_id}|${f.away_team_id}`));
  const rows: ImportFixtureRow[] = [];
  let duplicates = 0;
  let unresolved = 0;

  for (const d of args.divisions) {
    const divisionId = args.divisionIds.get(normName(d.name));
    for (const f of d.fixtures) {
      const home = divisionId ? args.teamIds.get(`${divisionId}|${normName(f.home)}`) : undefined;
      const away = divisionId ? args.teamIds.get(`${divisionId}|${normName(f.away)}`) : undefined;
      if (!divisionId || !home || !away || home === away) { unresolved++; continue; }

      const round = f.round ?? args.defaultRound;
      const key = `${divisionId}|${round}|${home}|${away}`;
      const reverse = `${divisionId}|${round}|${away}|${home}`;
      if (seen.has(key) || seen.has(reverse)) { duplicates++; continue; }
      seen.add(key);

      rows.push({
        tournament_id: args.tournamentId,
        division_id: divisionId,
        round,
        home_team_id: home,
        away_team_id: away,
        venue_id: f.venue ? args.venueIds.get(normName(f.venue)) ?? null : null,
        kickoff: f.date ? `${f.date}T${f.time ?? "00:00"}:00` : null,
        note: f.note,
      });
    }
  }
  return { rows, duplicates, unresolved };
}
