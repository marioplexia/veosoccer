export type GeneratedFixture = {
  round: number;
  homeId: string;
  awayId: string;
  venueId: string | null;
  kickoff: string | null; // "YYYY-MM-DDTHH:MM:00", hora local sin zona
};

/** Todos contra todos (método del círculo). Con número impar de equipos, uno descansa cada jornada. */
export function roundRobin(teamIds: string[], doubleRound = false): { round: number; homeId: string; awayId: string }[] {
  const ids: (string | null)[] = [...teamIds];
  if (ids.length < 2) return [];
  if (ids.length % 2 === 1) ids.push(null); // descanso

  const n = ids.length;
  const rounds = n - 1;
  const out: { round: number; homeId: string; awayId: string }[] = [];
  let ring = [...ids];

  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < n / 2; i++) {
      const a = ring[i];
      const b = ring[n - 1 - i];
      if (a == null || b == null) continue;
      // alterna localía para que nadie juegue siempre de local
      const flip = (r + i) % 2 === 1;
      out.push({ round: r + 1, homeId: flip ? b : a, awayId: flip ? a : b });
    }
    // rota todos menos el primero
    ring = [ring[0], ring[n - 1], ...ring.slice(1, n - 1)];
  }

  if (doubleRound) {
    const second = out.map((m) => ({ round: m.round + rounds, homeId: m.awayId, awayId: m.homeId }));
    return [...out, ...second];
  }
  return out;
}

export type ScheduleConfig = {
  startDate: string;          // YYYY-MM-DD, primera jornada
  firstKickoff: string;       // HH:MM, primer horario del día
  slotMinutes: number;        // separación entre partidos en una misma cancha
  daysBetweenRounds: number;  // p. ej. 7 = una jornada por semana
  doubleRound: boolean;
};

function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

function addMinutes(time: string, minutes: number): { time: string; dayOffset: number } {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const dayOffset = Math.floor(total / 1440);
  const t = ((total % 1440) + 1440) % 1440;
  return { time: `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`, dayOffset };
}

export type DivisionInput = { id: string; teamIds: string[] };
export type MultiFixture = GeneratedFixture & { divisionId: string };

/**
 * Genera el calendario de varias divisiones a la vez. Las canchas se comparten: en cada jornada
 * los partidos de todas las divisiones se reparten entre las canchas y horarios disponibles,
 * de modo que nunca coinciden dos partidos en la misma cancha y hora.
 */
export function generateMultiSchedule(divisions: DivisionInput[], venueIds: string[], cfg: ScheduleConfig): MultiFixture[] {
  const perDivision = divisions.map((d) => {
    const byRound = new Map<number, { round: number; homeId: string; awayId: string }[]>();
    for (const m of roundRobin(d.teamIds, cfg.doubleRound)) byRound.set(m.round, [...(byRound.get(m.round) ?? []), m]);
    return { id: d.id, byRound };
  });
  const maxRound = Math.max(0, ...perDivision.flatMap((d) => [...d.byRound.keys()]));

  const out: MultiFixture[] = [];
  for (let round = 1; round <= maxRound; round++) {
    const day = addDays(cfg.startDate, (round - 1) * cfg.daysBetweenRounds);
    const matches = perDivision.flatMap((d) => (d.byRound.get(round) ?? []).map((m) => ({ ...m, divisionId: d.id })));
    matches.forEach((m, i) => {
      if (venueIds.length === 0) {
        out.push({ ...m, venueId: null, kickoff: null });
        return;
      }
      const slot = Math.floor(i / venueIds.length);
      const { time, dayOffset } = addMinutes(cfg.firstKickoff, slot * cfg.slotMinutes);
      out.push({ ...m, venueId: venueIds[i % venueIds.length], kickoff: `${addDays(day, dayOffset)}T${time}:00` });
    });
  }
  return out;
}

/** Una sola división (atajo de generateMultiSchedule). */
export function generateSchedule(teamIds: string[], venueIds: string[], cfg: ScheduleConfig): GeneratedFixture[] {
  return generateMultiSchedule([{ id: "", teamIds }], venueIds, cfg).map(({ round, homeId, awayId, venueId, kickoff }) => ({ round, homeId, awayId, venueId, kickoff }));
}

/** Ids de partidos que comparten cancha y horario con otro (en cualquier división). */
export function venueConflicts(fixtures: { id: string; venue_id: string | null; kickoff: string | null }[]): Set<string> {
  const seen = new Map<string, string[]>();
  for (const f of fixtures) {
    if (!f.venue_id || !f.kickoff) continue;
    const key = `${f.venue_id}|${f.kickoff.slice(0, 16)}`;
    seen.set(key, [...(seen.get(key) ?? []), f.id]);
  }
  return new Set([...seen.values()].filter((ids) => ids.length > 1).flat());
}
