"use client";

import { computeScorers, computeStandings } from "@/lib/standings";
import { Card, Empty } from "@/components/ui";
import type { BoardData } from "./Board";

export default function StandingsTab({ teams, fixtures, goals }: BoardData) {
  const rows = computeStandings(teams, fixtures);
  const scorers = computeScorers(goals);
  const name = (id: string) => teams.find((t) => t.id === id)?.name ?? "?";
  const cols = ["PJ", "G", "E", "P", "GF", "GC", "DG", "Pts"];

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <Card title="Tabla de posiciones">
        {rows.length === 0 ? (
          <Empty>Agrega equipos para ver la tabla.</Empty>
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
  );
}
