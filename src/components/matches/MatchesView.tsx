"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { groupByDay, timeOf } from "@/lib/match-view";
import type { Division, Fixture } from "@/lib/types";

export const INK = "#37003C";
export type ViewTeam = { id: string; name: string; division_id: string; crestUrl: string | null };

export function CrestImg({ team, size = 32 }: { team?: { name: string; crestUrl: string | null }; size?: number }) {
  const name = team?.name ?? "?";
  return team?.crestUrl
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={team.crestUrl} alt="" width={size} height={size} className="shrink-0 object-contain" style={{ width: size, height: size }} />
    : <span aria-hidden className="grid shrink-0 place-items-center rounded-full font-bold text-white" style={{ width: size, height: size, background: INK, fontSize: size * 0.4 }}>{name.slice(0, 1).toUpperCase()}</span>;
}

const chip = "rounded-lg border bg-white px-3 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-purple-400";

/**
 * Pantalla de partidos: encabezado en degradado, pestañas por división, filtros,
 * navegación por jornada y la lista agrupada por día. Cada partido abre su ficha.
 */
export default function MatchesView({ title, divisions, teams, fixtures, baseHref, backHref, backLabel }: {
  title: string; divisions: Division[]; teams: ViewTeam[]; fixtures: Fixture[];
  /** La ficha de un partido está en `${baseHref}/${fixture.id}`. */
  baseHref: string; backHref?: string; backLabel?: string;
}) {
  const [division, setDivision] = useState(divisions[0]?.id ?? "");
  const inDivision = useMemo(() => fixtures.filter((f) => !division || f.division_id === division), [fixtures, division]);
  const rounds = useMemo(() => [...new Set(inDivision.map((f) => f.round))].sort((a, b) => a - b), [inDivision]);
  // Por defecto, la primera jornada con partidos sin jugar (o la última).
  const defaultRound = useMemo(() => rounds.find((r) => inDivision.some((f) => f.round === r && f.home_score == null)) ?? rounds[rounds.length - 1] ?? 1, [rounds, inDivision]);
  const [roundSel, setRoundSel] = useState<number | null>(null);
  const [team, setTeam] = useState("");
  const round = roundSel != null && rounds.includes(roundSel) ? roundSel : defaultRound;

  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const divTeams = teams.filter((t) => !division || t.division_id === division).sort((a, b) => a.name.localeCompare(b.name));
  // Con un equipo elegido se muestran todos sus partidos; si no, la jornada.
  const shown = team ? inDivision.filter((f) => f.home_team_id === team || f.away_team_id === team) : inDivision.filter((f) => f.round === round);
  const groups = groupByDay(shown);
  const dated = groups.filter((g) => g.key !== "9999");
  const range = dated.length === 0 ? "Fechas por definir" : dated.length === 1 ? dated[0].label : `${dated[0].label} – ${dated[dated.length - 1].label}`;
  const idx = rounds.indexOf(round);
  const dirty = team !== "" || roundSel != null;

  const arrow = "grid h-10 w-10 place-items-center rounded-full bg-[#EFE6F0] text-lg transition hover:bg-[#E3D3E6] disabled:opacity-40";

  return (
    <div className="min-h-screen bg-[#F9F8FA]" style={{ color: INK }}>
      <header className="text-white" style={{ background: "linear-gradient(90deg,#9B19FF 0%,#7B5CFF 30%,#00B4FF 70%,#05F0FF 100%)" }}>
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 pb-6 pt-5">
          <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">{title}</h1>
          {backHref && <Link href={backHref} className="rounded-full px-4 py-2 text-sm font-medium text-white" style={{ background: INK }}>{backLabel ?? "← Volver"}</Link>}
        </div>
        {divisions.length > 0 && (
          <div className="bg-[#37003C]/35">
            <div role="tablist" aria-label="Divisiones" className="mx-auto flex max-w-[1440px] gap-1 overflow-x-auto px-4">
              {divisions.map((d) => (
                <button key={d.id} role="tab" aria-selected={d.id === division} onClick={() => { setDivision(d.id); setRoundSel(null); setTeam(""); }}
                  className={`shrink-0 border-b-[3px] px-2 py-2.5 text-sm transition ${d.id === division ? "border-white font-semibold" : "border-transparent opacity-90 hover:opacity-100"}`}>
                  {d.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-[1440px] px-4 py-6">
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="Jornada" className={chip} style={{ borderColor: "#B79BBE" }} value={round} onChange={(e) => { setRoundSel(Number(e.target.value)); setTeam(""); }} disabled={rounds.length === 0}>
            {rounds.map((r) => <option key={r} value={r}>Jornada {r}</option>)}
          </select>
          <select aria-label="Equipo" className={chip} style={{ borderColor: "#B79BBE" }} value={team} onChange={(e) => setTeam(e.target.value)}>
            <option value="">Equipos</option>
            {divTeams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <button onClick={() => { setRoundSel(null); setTeam(""); }} disabled={!dirty} className={`${chip} disabled:opacity-50`} style={{ borderColor: "#B79BBE" }}>Restablecer ↺</button>
        </div>

        {!team && rounds.length > 0 && (
          <div className="mt-4 flex items-center justify-center gap-6">
            <button aria-label="Jornada anterior" className={arrow} disabled={idx <= 0} onClick={() => setRoundSel(rounds[idx - 1])}>‹</button>
            <div className="min-w-[10rem] text-center">
              <p className="font-semibold">Jornada {round}</p>
              <p className="text-sm opacity-70">{range}</p>
            </div>
            <button aria-label="Jornada siguiente" className={arrow} disabled={idx >= rounds.length - 1} onClick={() => setRoundSel(rounds[idx + 1])}>›</button>
          </div>
        )}

        <section className="mt-5 rounded-2xl bg-white px-4 py-2 sm:px-6">
          {groups.length === 0 && <p className="py-10 text-center text-sm opacity-70">Aún no hay partidos aquí.</p>}
          {groups.map((g) => (
            <div key={g.key} className="py-3">
              <h2 className="py-2 font-semibold">{g.label}</h2>
              <ul>
                {g.items.map((f) => {
                  const h = teamById.get(f.home_team_id), a = teamById.get(f.away_team_id);
                  const played = f.home_score != null && f.away_score != null;
                  return (
                    <li key={f.id}>
                      <Link href={`${baseHref}/${f.id}`} className="group grid grid-cols-[2.5rem_minmax(0,1fr)_auto_minmax(0,1fr)_2.5rem] items-center gap-2 rounded-lg py-3 hover:bg-[#F6F2F7] sm:gap-3">
                        <span className="text-[11px] font-bold">{played ? "FIN" : team ? `J${f.round}` : ""}</span>
                        <span className="flex min-w-0 items-center justify-end gap-2 sm:gap-3">
                          <span className="truncate text-sm font-semibold group-hover:underline sm:text-base">{h?.name ?? "?"}</span><CrestImg team={h} />
                        </span>
                        <span className="min-w-[3.6rem] rounded-md bg-[#F4F1F5] px-2 py-1.5 text-center text-sm font-bold tabular-nums sm:text-base">
                          {played ? `${f.home_score} - ${f.away_score}` : timeOf(f.kickoff) ?? "vs"}
                        </span>
                        <span className="flex min-w-0 items-center gap-2 sm:gap-3">
                          <CrestImg team={a} /><span className="truncate text-sm font-semibold group-hover:underline sm:text-base">{a?.name ?? "?"}</span>
                        </span>
                        <span aria-hidden className="text-right opacity-40 group-hover:opacity-100">›</span>
                      </Link>
                      <div className="mx-auto h-px max-w-2xl bg-black/10 last:hidden" />
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
