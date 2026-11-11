"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { dbError, formatKickoff, fromInputValue, toInputValue } from "@/lib/format";
import { generateMultiSchedule, venueConflicts } from "@/lib/scheduler";
import { createClient } from "@/lib/supabase/client";
import type { Division, Fixture, Goal, Team, Venue } from "@/lib/types";
import { btnDanger, btnGhost, btnPrimary, Card, Empty, ErrorMsg, inputCls } from "@/components/ui";
import type { BoardData } from "./Board";

const today = () => new Date().toISOString().slice(0, 10);

export default function CalendarTab({ tournament, divisions, teams, venues, fixtures, goals }: BoardData) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<string>("all");

  const [startDate, setStartDate] = useState(tournament.start_date ?? today());
  const [firstKickoff, setFirstKickoff] = useState("09:00");
  const [slotMinutes, setSlotMinutes] = useState(90);
  const [daysBetween, setDaysBetween] = useState(7);
  const [doubleRound, setDoubleRound] = useState(false);

  const scope = filter === "all" ? divisions : divisions.filter((d) => d.id === filter);
  const scopeIds = scope.map((d) => d.id);
  const scopeFixtures = fixtures.filter((f) => scopeIds.includes(f.division_id));
  const conflicts = venueConflicts(fixtures);
  const divName = (id: string) => divisions.find((d) => d.id === id)?.name ?? "?";

  async function generate() {
    setError(null);
    const inputs = scope
      .map((d) => ({ id: d.id, teamIds: teams.filter((t) => t.division_id === d.id).map((t) => t.id) }))
      .filter((d) => d.teamIds.length >= 2);
    if (inputs.length === 0) return setError("Necesitas al menos 2 equipos en una división para generar su calendario.");
    if (scopeFixtures.length > 0 && !window.confirm(`Ya hay ${scopeFixtures.length} partidos en ${filter === "all" ? "las divisiones" : "esta división"}. Generar un calendario nuevo los reemplazará, junto con sus marcadores y goles. ¿Continuar?`)) return;

    const plan = generateMultiSchedule(inputs, venues.map((v) => v.id), {
      startDate, firstKickoff, slotMinutes, daysBetweenRounds: daysBetween, doubleRound,
    });
    setBusy(true);
    const supabase = createClient();
    if (scopeFixtures.length > 0) {
      const { error } = await supabase.from("fixtures").delete().eq("tournament_id", tournament.id).in("division_id", scopeIds);
      if (error) { setBusy(false); return setError(dbError(error)); }
    }
    const rows = plan.map((p) => ({
      tournament_id: tournament.id, division_id: p.divisionId, round: p.round,
      home_team_id: p.homeId, away_team_id: p.awayId, venue_id: p.venueId, kickoff: p.kickoff,
    }));
    const { error } = await supabase.from("fixtures").insert(rows);
    setBusy(false);
    if (error) return setError(dbError(error));
    router.refresh();
  }

  async function clearAll() {
    if (!window.confirm(`¿Borrar ${scopeFixtures.length} partidos con sus marcadores y goles${filter === "all" ? " de todas las divisiones" : ""}?`)) return;
    setBusy(true);
    const { error } = await createClient().from("fixtures").delete().eq("tournament_id", tournament.id).in("division_id", scopeIds);
    setBusy(false);
    if (error) return setError(dbError(error));
    router.refresh();
  }

  const visible = filter === "all" ? fixtures : fixtures.filter((f) => f.division_id === filter);
  const rounds = [...new Set(visible.map((f) => f.round))].sort((a, b) => a - b);
  const nextRound = fixtures.length ? Math.max(...fixtures.map((f) => f.round)) : 1;

  if (divisions.length === 0) {
    return <Empty>Primero crea una división y agrega equipos para armar el calendario.</Empty>;
  }

  return (
    <div className="space-y-6">
      {divisions.length > 1 && (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtrar por división">
          {[{ id: "all", name: "Todas las divisiones" }, ...divisions].map((d) => (
            <button
              key={d.id}
              onClick={() => setFilter(d.id)}
              aria-pressed={filter === d.id}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${filter === d.id ? "bg-emerald-600 text-white" : "border border-slate-300 text-slate-700 hover:bg-slate-50"}`}
            >
              {d.name}
            </button>
          ))}
        </div>
      )}

      <Card title="Generar calendario automático">
        <p className="mb-4 text-sm text-slate-600">
          Crea todos contra todos en {filter === "all" ? `las ${divisions.length} divisiones` : `la división ${divName(filter)}`} y reparte los partidos entre {venues.length || "0"} canchas y horarios
          {filter === "all" ? ", sin que dos divisiones coincidan en la misma cancha y hora" : ""}. Podrás editar cada partido después.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm font-medium text-slate-700">Primera jornada
            <input type="date" className={`${inputCls} mt-1`} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
          <label className="text-sm font-medium text-slate-700">Primer horario
            <input type="time" className={`${inputCls} mt-1`} value={firstKickoff} onChange={(e) => setFirstKickoff(e.target.value)} />
          </label>
          <label className="text-sm font-medium text-slate-700">Minutos entre partidos
            <input type="number" min={30} max={240} step={5} className={`${inputCls} mt-1`} value={slotMinutes} onChange={(e) => setSlotMinutes(Math.max(30, Number(e.target.value) || 90))} />
          </label>
          <label className="text-sm font-medium text-slate-700">Días entre jornadas
            <input type="number" min={1} max={30} className={`${inputCls} mt-1`} value={daysBetween} onChange={(e) => setDaysBetween(Math.max(1, Number(e.target.value) || 7))} />
          </label>
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={doubleRound} onChange={(e) => setDoubleRound(e.target.checked)} /> Ida y vuelta
        </label>
        <div className="mt-4 flex flex-wrap gap-3">
          <button onClick={generate} disabled={busy} className={btnPrimary}>{busy ? "Generando…" : "Generar calendario"}</button>
          {scopeFixtures.length > 0 && <button onClick={clearAll} disabled={busy} className={btnDanger}>Borrar {scopeFixtures.length} partidos</button>}
        </div>
        <div className="mt-3"><ErrorMsg message={error} /></div>
      </Card>

      {conflicts.size > 0 && (
        <p role="status" className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
          ⚠ Hay {conflicts.size} partidos que comparten cancha y horario con otro. Están marcados abajo para que los reprogrames.
        </p>
      )}

      <Link href={`/panel/torneos/${tournament.id}/partidos`} className="flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-white" style={{ background: "linear-gradient(90deg,#9B19FF,#7B5CFF,#00B4FF)" }}>
        <span>Ver la pantalla de partidos: abre uno para transmitirlo o generar su resumen con IA</span><span aria-hidden>→</span>
      </Link>

      <AddFixture tournamentId={tournament.id} divisions={divisions} teams={teams} venues={venues} nextRound={nextRound} defaultDivision={filter === "all" ? divisions[0].id : filter} />

      {visible.length === 0 ? (
        <Empty>Aún no hay partidos. Genera el calendario, impórtalo desde una imagen o agrega uno a mano.</Empty>
      ) : (
        rounds.map((r) => {
          const inRound = visible.filter((f) => f.round === r);
          const divIds = divisions.filter((d) => inRound.some((f) => f.division_id === d.id));
          return (
            <Card key={r} title={`Jornada ${r}`}>
              {divIds.map((d) => (
                <div key={d.id} className="mb-2 last:mb-0">
                  {filter === "all" && divisions.length > 1 && (
                    <h3 className="mt-2 rounded-lg bg-emerald-50 px-3 py-1.5 text-sm font-bold text-emerald-800">{d.name}</h3>
                  )}
                  <ul className="divide-y divide-slate-100">
                    {inRound.filter((f) => f.division_id === d.id).map((f) => (
                      <FixtureRow
                        key={`${f.id}-${f.kickoff}-${f.venue_id}-${f.home_score}-${f.away_score}-${f.note}`}
                        tournamentId={tournament.id} fixture={f} teams={teams} venues={venues}
                        goals={goals.filter((g) => g.fixture_id === f.id)}
                        conflict={conflicts.has(f.id)}
                      />
                    ))}
                  </ul>
                </div>
              ))}
            </Card>
          );
        })
      )}
    </div>
  );
}

function AddFixture({ tournamentId, divisions, teams, venues, nextRound, defaultDivision }: {
  tournamentId: string; divisions: Division[]; teams: Team[]; venues: Venue[]; nextRound: number; defaultDivision: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [division, setDivision] = useState(defaultDivision);
  const [round, setRound] = useState(nextRound);
  const [home, setHome] = useState("");
  const [away, setAway] = useState("");
  const [venue, setVenue] = useState("");
  const [kickoff, setKickoff] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const divTeams = teams.filter((t) => t.division_id === division);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (home === away) return setError("Elige dos equipos distintos.");
    setBusy(true);
    const { error } = await createClient().from("fixtures").insert({
      tournament_id: tournamentId, division_id: division, round, home_team_id: home, away_team_id: away,
      venue_id: venue || null, kickoff: fromInputValue(kickoff),
    });
    setBusy(false);
    if (error) return setError(dbError(error));
    setHome(""); setAway(""); setKickoff("");
    router.refresh();
  }

  if (!open) return <button onClick={() => setOpen(true)} className={btnGhost}>+ Agregar partido a mano</button>;

  return (
    <Card title="Agregar partido" action={<button onClick={() => setOpen(false)} className={btnGhost}>Cerrar</button>}>
      <form onSubmit={add} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm font-medium text-slate-700">División
          <select className={`${inputCls} mt-1`} value={division} onChange={(e) => { setDivision(e.target.value); setHome(""); setAway(""); }}>
            {divisions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700">Jornada
          <input type="number" min={1} className={`${inputCls} mt-1`} value={round} onChange={(e) => setRound(Math.max(1, Number(e.target.value) || 1))} />
        </label>
        <label className="text-sm font-medium text-slate-700">Local
          <select className={`${inputCls} mt-1`} value={home} onChange={(e) => setHome(e.target.value)} required>
            <option value="">Elegir…</option>{divTeams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700">Visitante
          <select className={`${inputCls} mt-1`} value={away} onChange={(e) => setAway(e.target.value)} required>
            <option value="">Elegir…</option>{divTeams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700">Cancha
          <select className={`${inputCls} mt-1`} value={venue} onChange={(e) => setVenue(e.target.value)}>
            <option value="">Sin asignar</option>{venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700 lg:col-span-2">Fecha y hora
          <input type="datetime-local" className={`${inputCls} mt-1`} value={kickoff} onChange={(e) => setKickoff(e.target.value)} />
        </label>
        <div className="flex items-end"><button disabled={busy} className={btnPrimary}>Agregar</button></div>
        <div className="sm:col-span-2 lg:col-span-4"><ErrorMsg message={error} /></div>
      </form>
    </Card>
  );
}

function FixtureRow({ tournamentId, fixture, teams, venues, goals, conflict }: { tournamentId: string; fixture: Fixture; teams: Team[]; venues: Venue[]; goals: Goal[]; conflict: boolean }) {
  const router = useRouter();
  const name = (id: string) => teams.find((t) => t.id === id)?.name ?? "?";
  const [venue, setVenue] = useState(fixture.venue_id ?? "");
  const [kickoff, setKickoff] = useState(toInputValue(fixture.kickoff));
  const [hs, setHs] = useState(fixture.home_score?.toString() ?? "");
  const [as, setAs] = useState(fixture.away_score?.toString() ?? "");
  const [note, setNote] = useState(fixture.note ?? "");
  const [showGoals, setShowGoals] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    if ((hs === "") !== (as === "")) return setError("Completa los dos marcadores o deja ambos vacíos.");
    setBusy(true);
    const { error } = await createClient().from("fixtures").update({
      venue_id: venue || null,
      kickoff: fromInputValue(kickoff),
      home_score: hs === "" ? null : Number(hs),
      away_score: as === "" ? null : Number(as),
      note: note.trim() || null,
    }).eq("id", fixture.id);
    setBusy(false);
    if (error) return setError(dbError(error));
    router.refresh();
  }

  async function remove() {
    if (!window.confirm("¿Eliminar este partido?")) return;
    setBusy(true);
    const { error } = await createClient().from("fixtures").delete().eq("id", fixture.id);
    setBusy(false);
    if (error) return setError(dbError(error));
    router.refresh();
  }

  const played = fixture.home_score != null;

  return (
    <li className="py-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-[14rem] flex-1">
          <Link href={`/panel/torneos/${tournamentId}/partidos/${fixture.id}`} className="font-semibold text-slate-900 hover:text-emerald-700 hover:underline" title="Ver el partido a pantalla completa">
            {name(fixture.home_team_id)} <span className="font-normal text-slate-400">vs</span> {name(fixture.away_team_id)} <span aria-hidden className="text-slate-400">↗</span>
          </Link>
          <p className="text-xs text-slate-500">
            {formatKickoff(fixture.kickoff)}{played ? " · Finalizado" : ""}
            {fixture.note ? <span className="ml-1 font-medium text-amber-700">· {fixture.note}</span> : null}
            {conflict ? <span className="ml-1 font-medium text-amber-700">· ⚠ Cancha ocupada a esa hora</span> : null}
          </p>
        </div>
        <select aria-label="Cancha" className={`${inputCls} w-40!`} value={venue} onChange={(e) => setVenue(e.target.value)}>
          <option value="">Sin cancha</option>{venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
        <input aria-label="Fecha y hora" type="datetime-local" className={`${inputCls} w-52!`} value={kickoff} onChange={(e) => setKickoff(e.target.value)} />
        <div className="flex items-center gap-1">
          <input aria-label="Goles local" type="number" min={0} className={`${inputCls} w-16! text-center`} value={hs} onChange={(e) => setHs(e.target.value)} />
          <span className="text-slate-400">–</span>
          <input aria-label="Goles visitante" type="number" min={0} className={`${inputCls} w-16! text-center`} value={as} onChange={(e) => setAs(e.target.value)} />
        </div>
        <button onClick={save} disabled={busy} className={btnPrimary}>Guardar</button>
        <button onClick={() => setShowGoals((v) => !v)} className={btnGhost}>Goles ({goals.length})</button>
        <button onClick={remove} disabled={busy} className={btnDanger}>Eliminar</button>
      </div>
      <input
        aria-label="Nota del partido"
        className={`${inputCls} mt-2 max-w-md`}
        placeholder="Nota (ej. Gana X por default)"
        maxLength={200}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="mt-2"><ErrorMsg message={error} /></div>
      {showGoals && <GoalsPanel fixture={fixture} teams={teams} goals={goals} />}
    </li>
  );
}

function GoalsPanel({ fixture, teams, goals }: { fixture: Fixture; teams: Team[]; goals: Goal[] }) {
  const router = useRouter();
  const sides = [fixture.home_team_id, fixture.away_team_id];
  const name = (id: string) => teams.find((t) => t.id === id)?.name ?? "?";
  const [team, setTeam] = useState(sides[0]);
  const [player, setPlayer] = useState("");
  const [minute, setMinute] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error } = await createClient().from("fixture_goals").insert({
      fixture_id: fixture.id, team_id: team, player_name: player.trim(), minute: minute === "" ? null : Number(minute),
    });
    setBusy(false);
    if (error) return setError(dbError(error));
    setPlayer(""); setMinute("");
    router.refresh();
  }

  async function remove(id: string) {
    const { error } = await createClient().from("fixture_goals").delete().eq("id", id);
    if (error) return setError(dbError(error));
    router.refresh();
  }

  return (
    <div className="mt-3 rounded-xl bg-slate-50 p-4">
      {goals.length > 0 && (
        <ul className="mb-3 space-y-1 text-sm">
          {[...goals].sort((a, b) => (a.minute ?? 999) - (b.minute ?? 999)).map((g) => (
            <li key={g.id} className="flex items-center justify-between">
              <span>{g.minute != null ? `${g.minute}' ` : ""}<strong>{g.player_name}</strong> <span className="text-slate-500">({name(g.team_id)})</span></span>
              <button onClick={() => remove(g.id)} className={btnDanger}>Quitar</button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={add} className="flex flex-wrap items-end gap-2">
        <select aria-label="Equipo del gol" className={`${inputCls} w-44!`} value={team} onChange={(e) => setTeam(e.target.value)}>
          {sides.map((id) => <option key={id} value={id}>{name(id)}</option>)}
        </select>
        <input className={`${inputCls} w-48!`} placeholder="Jugador" value={player} onChange={(e) => setPlayer(e.target.value)} required maxLength={120} />
        <input className={`${inputCls} w-24!`} type="number" min={0} max={150} placeholder="Minuto" value={minute} onChange={(e) => setMinute(e.target.value)} />
        <button disabled={busy} className={btnPrimary}>Agregar gol</button>
      </form>
      <p className="mt-2 text-xs text-slate-500">Los goles alimentan la tabla de goleadores; el marcador del partido se escribe aparte.</p>
      <div className="mt-2"><ErrorMsg message={error} /></div>
    </div>
  );
}
