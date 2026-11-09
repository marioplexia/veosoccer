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

/**
 * Genera el calendario completo: reparte los partidos de cada jornada entre las canchas
 * y los horarios disponibles ese día (primero llenando todas las canchas en el primer horario).
 */
export function generateSchedule(teamIds: string[], venueIds: string[], cfg: ScheduleConfig): GeneratedFixture[] {
  const matches = roundRobin(teamIds, cfg.doubleRound);
  const byRound = new Map<number, typeof matches>();
  for (const m of matches) byRound.set(m.round, [...(byRound.get(m.round) ?? []), m]);

  const out: GeneratedFixture[] = [];
  const rounds = [...byRound.keys()].sort((a, b) => a - b);

  rounds.forEach((round, idx) => {
    const day = addDays(cfg.startDate, idx * cfg.daysBetweenRounds);
    byRound.get(round)!.forEach((m, i) => {
      if (venueIds.length === 0) {
        out.push({ ...m, venueId: null, kickoff: null });
        return;
      }
      const slot = Math.floor(i / venueIds.length);
      const venueId = venueIds[i % venueIds.length];
      const { time, dayOffset } = addMinutes(cfg.firstKickoff, slot * cfg.slotMinutes);
      out.push({ ...m, venueId, kickoff: `${addDays(day, dayOffset)}T${time}:00` });
    });
  });
  return out;
}
