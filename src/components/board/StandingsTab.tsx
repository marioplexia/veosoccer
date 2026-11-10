"use client";

import { useState } from "react";
import { computeScorers, computeStandings } from "@/lib/standings";
import { Card, Empty } from "@/components/ui";
import type { BoardData } from "./Board";

export default function StandingsTab({ divisions, teams, fixtures, goals }: BoardData) {
  const [selected, setSelected] = useState<string>(divisions[0]?.id ?? "");
  if (divisions.length === 0) return <Empty>Crea una división y agrega equipos para ver la tabla.</Empty>;

  const division = divisions.find((d) => d.id === selected) ?? divisions[0];
  const divTeams = teams.filter((t) => t.division_id === division.id);
  const divFixtures = fixtures.filter((f) => f.division_id === division.id);
  const fixtureIds = new Set(divFixtures.map((f) => f.id));
  const rows = computeStandings(divTeams, divFixtures);
  const scorers = computeScorers(goals.filter((g) => fixtureIds.has(g.fixture_id)));
  const name = (id: string) => divTeams.find((t) => t.id === id)?.name ?? "?";
  const cols = ["PJ", "G", "E", "P", "GF", "GC", "DG", "Pts"];

  return (
    <div className="space-y-6">
      {divisions.length > 1 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="División">
          {divisions.map((d) => (
            <button
              key={d.id}
              onClick={() => setSelected(d.id)}
              aria-pressed={division.id === d.id}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${division.id === d.id ? "bg-emerald-600 text-white" : "border border-slate-300 text-slate-700 hover:bg-slate-50"}`}
            >
              {d.name}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card title={`Tabla de posiciones · ${division.name}`}>
          {rows.length === 0 ? (
            <Empty>Esta división aún no tiene equipos.</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-2">#</th>
                    <th className="py-2 pr-4">Equipo</th>
                    {cols.map((c) => <th key={c} className="px-2 py-2 text-right">{c}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.teamId} className="border-b border-slate-100">
                      <td className="py-2.5 pr-2 text-slate-500">{i + 1}</td>
                      <td className="py-2.5 pr-4 font-medium text-slate-900">{r.name}</td>
                      {[r.played, r.won, r.drawn, r.lost, r.gf, r.ga, r.gd > 0 ? `+${r.gd}` : r.gd].map((v, j) => (
                        <td key={j} className="px-2 py-2.5 text-right text-slate-700">{v}</td>
                      ))}
                      <td className="px-2 py-2.5 text-right font-bold text-slate-900">{r.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-3 text-xs text-slate-500">Victoria 3 pts, empate 1. Desempate: diferencia de goles, goles a favor y nombre.</p>
        </Card>

        <Card title="Goleadores">
          {scorers.length === 0 ? (
            <Empty>Registra goles en el calendario para ver a los goleadores.</Empty>
          ) : (
            <ol className="divide-y divide-slate-100">
              {scorers.slice(0, 15).map((s, i) => (
                <li key={`${s.teamId}-${s.player}`} className="flex items-center justify-between py-2.5">
                  <span><span className="mr-2 text-slate-400">{i + 1}</span><span className="font-medium text-slate-900">{s.player}</span> <span className="text-sm text-slate-500">{name(s.teamId)}</span></span>
                  <span className="font-bold text-slate-900">{s.goals}</span>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </div>
  );
}
