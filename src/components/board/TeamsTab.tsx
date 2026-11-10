"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { dbError } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { Division, Team } from "@/lib/types";
import { btnDanger, btnPrimary, Card, Empty, ErrorMsg, inputCls } from "@/components/ui";
import type { BoardData } from "./Board";

export default function TeamsTab({ tournament, divisions, teams, goTo }: BoardData & { goTo: (t: "divisiones") => void }) {
  if (divisions.length === 0) {
    return (
      <Empty>
        Primero crea al menos una división.{" "}
        <button onClick={() => goTo("divisiones")} className="font-semibold text-emerald-700 hover:underline">Ir a Divisiones</button>
      </Empty>
    );
  }
  return (
    <div className="space-y-6">
      {divisions.map((d) => (
        <DivisionTeams key={d.id} tournamentId={tournament.id} division={d} teams={teams.filter((t) => t.division_id === d.id)} />
      ))}
    </div>
  );
}

function DivisionTeams({ tournamentId, division, teams }: { tournamentId: string; division: Division; teams: Team[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error } = await createClient().from("tournament_teams").insert({ tournament_id: tournamentId, division_id: division.id, name: name.trim() });
    setBusy(false);
    if (error) return setError(dbError(error));
    setName("");
    router.refresh();
  }

  async function remove(t: Team) {
    if (!window.confirm(`¿Eliminar "${t.name}" de ${division.name}? También se borrarán sus partidos y goles.`)) return;
    setError(null);
    setBusy(true);
    const { error } = await createClient().from("tournament_teams").delete().eq("id", t.id);
    setBusy(false);
    if (error) return setError(dbError(error));
    router.refresh();
  }

  return (
    <Card title={`${division.name} (${teams.length} equipos)`}>
      <form onSubmit={add} className="mb-3 flex gap-3">
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre del equipo" required maxLength={120} aria-label={`Nuevo equipo en ${division.name}`} />
        <button disabled={busy} className={btnPrimary}>Agregar</button>
      </form>
      <ErrorMsg message={error} />
      {teams.length === 0 ? (
        <Empty>Esta división aún no tiene equipos.</Empty>
      ) : (
        <ul className="mt-2 divide-y divide-slate-100">
          {teams.map((t) => (
            <li key={t.id} className="flex items-center justify-between py-2.5">
              <span className="font-medium text-slate-900">{t.name}</span>
              <button onClick={() => remove(t)} disabled={busy} className={btnDanger}>Eliminar</button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
