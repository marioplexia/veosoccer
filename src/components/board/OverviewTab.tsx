"use client";

import { formatKickoff } from "@/lib/format";
import { computeScorers, computeStandings } from "@/lib/standings";
import { Card, Empty } from "@/components/ui";
import type { BoardData } from "./Board";

type Props = BoardData & { goTo: (t: "equipos" | "canchas" | "calendario" | "posiciones" | "importar") => void };

export default function OverviewTab({ teams, venues, fixtures, goals, goTo }: Props) {
  const name = (id: string) => teams.find((t) => t.id === id)?.name ?? "?";
  const venueName = (id: string | null) => venues.find((v) => v.id === id)?.name;
  const played = fixtures.filter((f) => f.home_score != null);
  const totalGoals = played.reduce((s, f) => s + (f.home_score ?? 0) + (f.away_score ?? 0), 0);
  const standings = computeStandings(teams, fixtures);
  const leader = played.length > 0 ? standings[0] : null;
  const topScorer = computeScorers(goals)[0];
  const upcoming = fixtures
    .filter((f) => f.home_score == null)
    .sort((a, b) => (a.kickoff ?? "9999").localeCompare(b.kickoff ?? "9999") || a.round - b.round)
    .slice(0, 5);

  const stats = [
    ["Equipos", teams.length],
    ["Canchas", venues.length],
    ["Partidos", fixtures.length],
    ["Jugados", played.length],
    ["Goles", totalGoals],
    ["Promedio por partido", played.length ? (totalGoals / played.length).toFixed(1) : "—"],
  ];

  const empty = teams.length === 0 && venues.length === 0;

  return (
    <div className="space-y-6">
      {empty && (
        <Card>
          <h2 className="text-lg font-semibold text-slate-900">Empieza a montar tu torneo</h2>
          <p className="mt-1 text-slate-600">Sube una foto o captura de tu planilla y la IA cargará equipos y canchas, o agrégalos a mano.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button onClick={() => goTo("importar")} className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">Importar con IA</button>
            <button onClick={() => goTo("equipos")} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Agregar equipos</button>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-2xl font-bold text-slate-900">{value}</p>
            <p className="mt-1 text-xs text-slate-500">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Próximos partidos" action={<button onClick={() => goTo("calendario")} className="text-sm font-medium text-emerald-700 hover:underline">Ver calendario</button>}>
          {upcoming.length === 0 ? (
            <Empty>No hay partidos pendientes.</Empty>
          ) : (
            <ul className="divide-y divide-slate-100">
              {upcoming.map((f) => (
                <li key={f.id} className="py-3">
                  <p className="font-medium text-slate-900">{name(f.home_team_id)} vs {name(f.away_team_id)}</p>
                  <p className="text-sm text-slate-500">Jornada {f.round} · {formatKickoff(f.kickoff)}{venueName(f.venue_id) ? ` · ${venueName(f.venue_id)}` : ""}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Destacados">
          {!leader && !topScorer ? (
            <Empty>Los líderes aparecerán cuando registres resultados.</Empty>
          ) : (
            <dl className="space-y-4">
              {leader && (
                <div>
                  <dt className="text-sm text-slate-500">Líder de la tabla</dt>
                  <dd className="font-semibold text-slate-900">{leader.name} · {leader.points} pts</dd>
                </div>
              )}
              {topScorer && (
                <div>
                  <dt className="text-sm text-slate-500">Máximo goleador</dt>
                  <dd className="font-semibold text-slate-900">{topScorer.player} ({name(topScorer.teamId)}) · {topScorer.goals} {topScorer.goals === 1 ? "gol" : "goles"}</dd>
                </div>
              )}
            </dl>
          )}
        </Card>
      </div>
    </div>
  );
}
