"use client";

import { useState } from "react";
import type { Division, Fixture, Goal, Team, Tournament, Venue } from "@/lib/types";
import CalendarTab from "./CalendarTab";
import ImportTab from "./ImportTab";
import DivisionsTab from "./DivisionsTab";
import ListTab from "./ListTab";
import OverviewTab from "./OverviewTab";
import StandingsTab from "./StandingsTab";
import TeamsTab from "./TeamsTab";

export type BoardData = {
  tournament: Tournament;
  divisions: Division[];
  teams: Team[];
  venues: Venue[];
  fixtures: Fixture[];
  goals: Goal[];
};

const TABS = [
  { id: "resumen", label: "Resumen" },
  { id: "divisiones", label: "Divisiones" },
  { id: "equipos", label: "Equipos" },
  { id: "canchas", label: "Canchas" },
  { id: "calendario", label: "Calendario" },
  { id: "posiciones", label: "Posiciones y estadísticas" },
  { id: "importar", label: "Importar con IA" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function Board(data: BoardData) {
  const [tab, setTab] = useState<TabId>("resumen");

  return (
    <div className="mt-6">
      <div role="tablist" aria-label="Secciones del torneo" className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
              tab === t.id ? "border-emerald-600 text-emerald-700" : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6" role="tabpanel">
        {tab === "resumen" && <OverviewTab {...data} goTo={setTab} />}
        {tab === "divisiones" && <DivisionsTab {...data} />}
        {tab === "equipos" && <TeamsTab {...data} goTo={setTab} />}
        {tab === "canchas" && (
          <ListTab kind="venue" table="venues" title="Canchas" tournamentId={data.tournament.id} items={data.venues} placeholder="Nombre de la cancha" />
        )}
        {tab === "calendario" && <CalendarTab {...data} />}
        {tab === "posiciones" && <StandingsTab {...data} />}
        {tab === "importar" && <ImportTab {...data} onDone={() => setTab("calendario")} />}
      </div>
    </div>
  );
}
