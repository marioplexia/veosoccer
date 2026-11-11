"use client";

import Link from "next/link";
import { useState } from "react";
import { formatKickoff } from "@/lib/format";
import { dayOf, timeOf, type FormEntry, type MatchSummary, type UpcomingEntry } from "@/lib/match-view";
import type { StandingRow } from "@/lib/standings";
import type { BrandSettings } from "@/lib/brand";
import type { Fixture, Goal, Player } from "@/lib/types";
import { CrestImg, INK } from "./MatchesView";
import SummaryPanel from "./SummaryPanel";

export type DetailTeam = { id: string; name: string; crestUrl: string | null; color: string };
export type OwnerTools = { liveHref: string; summaryEndpoint: string; summary: MatchSummary | null; fonts: BrandSettings["fonts"]; logoUrl: string | null };

type Props = {
  tournamentName: string; divisionName: string | null; fixture: Fixture;
  home: DetailTeam; away: DetailTeam; venueName: string | null;
  goals: Goal[]; players: Player[]; standings: StandingRow[];
  teams: Record<string, { name: string; crestUrl: string | null }>;
  form: { home: FormEntry[]; away: FormEntry[] }; upcoming: { home: UpcomingEntry[]; away: UpcomingEntry[] };
  /** Lista de partidos; la ficha de otro partido está en `${baseHref}/${id}`. */
  baseHref: string;
  /** Solo para el dueño del torneo: transmitir y resumen con IA. */
  owner?: OwnerTools;
  /** En la página pública de ejemplo: invitación a crear cuenta. */
  cta?: { href: string; label: string };
};

/** Negro o blanco, el que se lea mejor sobre `hex`. */
function onColor(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const l = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return l > 0.6 ? INK : "#FFFFFF";
}
const abbr = (name: string) => name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]/g, "").slice(0, 3).toUpperCase() || "?";
const RESULT_BG = { W: "#2E7D32", L: "#E53935", D: "#EFEDF0" } as const;

export default function MatchDetail(p: Props) {
  const { fixture: f, home, away } = p;
  const played = f.home_score != null && f.away_score != null;
  const TABS = [
    { id: "previa", label: played ? "Resumen" : "Previa" },
    { id: "equipos", label: "Equipos" },
    { id: "estadisticas", label: "Estadísticas" },
    { id: "tabla", label: "Tabla de clasificación" },
    { id: "info", label: "Información del partido" },
    ...(p.owner ? [{ id: "ia", label: "✨ Resumen con IA" }] : []),
  ];
  const [tab, setTab] = useState("previa");
  const [formMode, setFormMode] = useState<"prev" | "next">("prev");
  const card = "rounded-2xl bg-white p-4 sm:p-5";
  const stat = (v: number | string, label: string) => (
    <div className="rounded-xl bg-[#F6F2F7] px-3 py-3 text-center"><p className="text-2xl font-bold tabular-nums">{v}</p><p className="text-xs opacity-70">{label}</p></div>
  );
  const row = (teamId: string) => p.standings.find((r) => r.teamId === teamId);
  const pos = (teamId: string) => p.standings.findIndex((r) => r.teamId === teamId) + 1;

  const FormBlock = ({ team, side }: { team: DetailTeam; side: "home" | "away" }) => {
    const prev = p.form[side], next = p.upcoming[side];
    const empty = formMode === "prev" ? prev.length === 0 : next.length === 0;
    return (
      <div className="min-w-0 flex-1">
        <p className="mb-4 flex items-center gap-2 text-sm font-semibold"><CrestImg team={team} size={24} />{team.name}</p>
        {empty && <p className="text-sm opacity-60">{formMode === "prev" ? "Aún no ha jugado otros partidos." : "No tiene más partidos programados."}</p>}
        <ul className="grid grid-cols-5 gap-2">
          {(formMode === "prev" ? prev : next).map((e) => {
            const opp = p.teams[e.opponentId];
            const res = "result" in e ? e : null;
            return (
              <li key={e.fixtureId} className="min-w-0 text-center">
                <Link href={`${p.baseHref}/${e.fixtureId}`} className="block rounded-lg pb-1 hover:bg-[#F6F2F7]">
                  <span className="block text-[11px] opacity-70">J{e.round}</span>
                  <span className="my-2 flex justify-center"><CrestImg team={opp} size={40} /></span>
                  <span className="block truncate text-[11px] font-semibold">{abbr(opp?.name ?? "?")} ({e.home ? "L" : "V"})</span>
                  {res
                    ? <span className="mt-1.5 block rounded-t-md py-0.5 text-xs font-bold" style={{ background: RESULT_BG[res.result], color: res.result === "D" ? INK : "#fff" }}>{res.gf} - {res.ga}</span>
                    : <span className="mt-1.5 block rounded-md bg-[#EFEDF0] py-0.5 text-[11px] font-semibold">{timeOf((e as UpcomingEntry).kickoff) ?? dayOf((e as UpcomingEntry).kickoff).label.split(",").pop()?.trim() ?? "—"}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  const Squad = ({ team }: { team: DetailTeam }) => {
    const list = p.players.filter((x) => x.team_id === team.id);
    return (
      <div className="min-w-0">
        <p className="mb-3 flex items-center gap-2 font-semibold"><CrestImg team={team} size={24} />{team.name}</p>
        {list.length === 0 ? <p className="text-sm opacity-60">Sin plantilla guardada.</p> : (
          <ul className="space-y-1.5 text-sm">
            {list.map((x) => (
              <li key={x.id} className="flex items-center gap-2">
                <span className="grid h-6 w-7 shrink-0 place-items-center rounded text-xs font-bold text-white" style={{ background: INK }}>{x.number ?? "–"}</span>
                <span className="truncate">{x.name}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#F9F8FA]" style={{ color: INK }}>
      <div className="mx-auto grid max-w-[1440px] gap-4 px-3 py-4 sm:px-4 lg:grid-cols-[minmax(0,460px)_minmax(0,1fr)]">
        {/* tarjeta del partido */}
        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <div className="overflow-hidden rounded-2xl bg-white">
            <div className="relative grid grid-cols-2">
              {[home, away].map((t) => (
                <div key={t.id} className="relative flex flex-col items-center gap-2 overflow-hidden px-3 pb-8 pt-5" style={{ background: t.color, color: onColor(t.color) }}>
                  <span aria-hidden className="absolute -right-6 top-0 h-full w-16 -skew-x-[24deg] bg-white/10" />
                  <span className="relative grid h-16 w-16 place-items-center rounded-full bg-white/95 p-1.5"><CrestImg team={t} size={50} /></span>
                  <span className="relative max-w-full truncate text-base font-bold">{t.name}</span>
                </div>
              ))}
              <span className="absolute left-1/2 top-[38%] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white px-5 py-2.5 text-3xl font-bold tabular-nums shadow-lg">
                {played ? `${f.home_score} - ${f.away_score}` : timeOf(f.kickoff) ?? "VS"}
              </span>
            </div>
            <div className="-mt-4 rounded-t-2xl bg-white px-4 pb-5 pt-6 text-center text-sm relative">
              <p className="opacity-80">{p.tournamentName}{p.divisionName ? ` • ${p.divisionName}` : ""} • Jornada {f.round}</p>
              <p className="mt-1 opacity-80">{formatKickoff(f.kickoff)}{p.venueName ? ` • ${p.venueName}` : ""}</p>
              <p className="mt-2 inline-block rounded-md px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white" style={{ background: INK }}>{played ? "Finalizado" : "Por jugar"}</p>
              {p.goals.length > 0 && (
                <div className="mt-4 grid grid-cols-2 gap-4 text-left text-[13px]">
                  {[home, away].map((t, k) => (
                    <ul key={t.id} className={k === 0 ? "text-right" : ""}>
                      {p.goals.filter((g) => g.team_id === t.id).map((g) => <li key={g.id}>{g.player_name}{g.minute != null ? <b> {g.minute}&apos;</b> : null}</li>)}
                    </ul>
                  ))}
                </div>
              )}
              {f.note && <p className="mt-3 text-xs font-medium text-amber-700">{f.note}</p>}
            </div>
          </div>

          {p.owner && (
            <div className="grid gap-2">
              <Link href={p.owner.liveHref} className="rounded-xl px-4 py-3.5 text-center font-bold text-white transition hover:brightness-125" style={{ background: INK }}>📡 Transmitir este partido</Link>
              <button onClick={() => setTab("ia")} className="rounded-xl px-4 py-3.5 text-center font-bold transition hover:brightness-105" style={{ background: "linear-gradient(90deg,#0BEDFE,#843EFF)", color: INK }}>✨ Generar resumen con IA</button>
            </div>
          )}
          {p.cta && <Link href={p.cta.href} className="block rounded-xl px-4 py-3.5 text-center font-bold text-white" style={{ background: INK }}>{p.cta.label}</Link>}
          <Link href={p.baseHref} className="block rounded-xl bg-[#EFE6F0] px-4 py-3 text-center text-sm font-medium hover:bg-[#E3D3E6]">☰ Todos los partidos</Link>
        </aside>

        {/* contenido */}
        <div className="min-w-0 space-y-4">
          <div role="tablist" aria-label="Secciones del partido" className="flex gap-5 overflow-x-auto px-1 text-[15px]">
            {TABS.map((t) => (
              <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
                className={`shrink-0 border-b-[3px] pb-2 pt-1 transition ${tab === t.id ? "font-semibold" : "border-transparent opacity-70 hover:opacity-100"}`} style={tab === t.id ? { borderColor: INK } : undefined}>
                {t.label}
              </button>
            ))}
          </div>

          {tab === "previa" && (
            <section className={card}>
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Forma del equipo</h2>
                <div className="flex rounded-lg bg-[#EFE6F0] p-1 text-sm">
                  {([["prev", "Anterior"], ["next", "Próximamente"]] as const).map(([id, label]) => (
                    <button key={id} onClick={() => setFormMode(id)} aria-pressed={formMode === id} className={`rounded-md px-3 py-1.5 ${formMode === id ? "bg-white font-medium shadow-sm" : "opacity-80"}`}>{label}</button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-8 md:flex-row md:gap-6">
                <FormBlock team={home} side="home" />
                <div aria-hidden className="hidden w-px bg-black/10 md:block" />
                <FormBlock team={away} side="away" />
              </div>
            </section>
          )}

          {tab === "equipos" && (
            <section className={card}>
              <h2 className="mb-4 text-lg font-semibold">Plantillas</h2>
              <div className="grid gap-8 sm:grid-cols-2"><Squad team={home} /><Squad team={away} /></div>
            </section>
          )}

          {tab === "estadisticas" && (
            <section className={card}>
              <h2 className="mb-4 text-lg font-semibold">Estadísticas de la temporada</h2>
              <div className="grid gap-6 sm:grid-cols-2">
                {[home, away].map((t) => {
                  const r = row(t.id);
                  return (
                    <div key={t.id}>
                      <p className="mb-3 flex items-center gap-2 font-semibold"><CrestImg team={t} size={24} />{t.name}</p>
                      <div className="grid grid-cols-3 gap-2">
                        {stat(pos(t.id) || "–", "Posición")}{stat(r?.points ?? 0, "Puntos")}{stat(r?.played ?? 0, "Jugados")}
                        {stat(r?.won ?? 0, "Ganados")}{stat(r?.drawn ?? 0, "Empatados")}{stat(r?.lost ?? 0, "Perdidos")}
                        {stat(r?.gf ?? 0, "Goles a favor")}{stat(r?.ga ?? 0, "Goles en contra")}{stat(r ? (r.gd > 0 ? `+${r.gd}` : r.gd) : 0, "Diferencia")}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {tab === "tabla" && (
            <section className={card}>
              <h2 className="mb-4 text-lg font-semibold">Tabla de clasificación</h2>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[26rem] text-sm">
                  <thead>
                    <tr className="border-b border-black/10 text-left text-xs opacity-60">
                      <th className="py-2 pl-2 font-medium">Pos</th><th className="font-medium">Equipo</th>
                      {["PJ", "G", "E", "P", "DG", "Pts"].map((h) => <th key={h} className="text-center font-medium">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {p.standings.map((r, k) => {
                      const mine = r.teamId === home.id || r.teamId === away.id;
                      return (
                        <tr key={r.teamId} className={`border-b border-black/5 last:border-0 ${mine ? "bg-[#F1E7FF] font-bold" : ""}`}>
                          <td className="py-2.5 pl-2">{k + 1}</td>
                          <td><span className="flex items-center gap-2"><CrestImg team={p.teams[r.teamId]} size={22} /><span className="truncate">{r.name}</span></span></td>
                          <td className="text-center">{r.played}</td><td className="text-center">{r.won}</td><td className="text-center">{r.drawn}</td><td className="text-center">{r.lost}</td>
                          <td className="text-center">{r.gd > 0 ? `+${r.gd}` : r.gd}</td><td className="text-center font-bold">{r.points}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {tab === "info" && (
            <section className={card}>
              <h2 className="mb-4 text-lg font-semibold">Información del partido</h2>
              <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 text-sm">
                <dt className="opacity-60">Torneo</dt><dd className="font-semibold">{p.tournamentName}</dd>
                {p.divisionName && (<><dt className="opacity-60">División</dt><dd className="font-semibold">{p.divisionName}</dd></>)}
                <dt className="opacity-60">Jornada</dt><dd className="font-semibold">{f.round}</dd>
                <dt className="opacity-60">Fecha y hora</dt><dd className="font-semibold">{formatKickoff(f.kickoff)}</dd>
                <dt className="opacity-60">Cancha</dt><dd className="font-semibold">{p.venueName ?? "Sin cancha asignada"}</dd>
                <dt className="opacity-60">Estado</dt><dd className="font-semibold">{played ? `Finalizado ${f.home_score}-${f.away_score}` : "Por jugar"}</dd>
                {f.note && (<><dt className="opacity-60">Nota</dt><dd className="font-semibold text-amber-700">{f.note}</dd></>)}
              </dl>
            </section>
          )}

          {tab === "ia" && p.owner && (
            <section className={card}>
              <SummaryPanel
                owner={p.owner} played={played} tournamentName={p.tournamentName} fixture={f} home={home} away={away}
                scorers={{
                  home: p.goals.filter((g) => g.team_id === home.id).map((g) => `${g.player_name}${g.minute != null ? ` ${g.minute}'` : ""}`),
                  away: p.goals.filter((g) => g.team_id === away.id).map((g) => `${g.player_name}${g.minute != null ? ` ${g.minute}'` : ""}`),
                }}
              />
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
