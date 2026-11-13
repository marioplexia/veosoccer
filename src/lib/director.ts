// Director automático de la transmisión: decide qué gráfico se ve en cada instante.
// Es una función pura (estado + hora actual -> plano), así se puede probar y es predecible.

export type Phase = "previa" | "1T" | "descanso" | "2T" | "final";
export type Side = "home" | "away";

export type LiveEvent =
  | { kind: "goal"; at: number; side: Side; minute: number; player?: string }
  | { kind: "yellow" | "red" | "foul"; at: number; side: Side; minute: number; player?: string }
  | { kind: "sub"; at: number; side: Side; minute: number; playerOut?: string; playerIn?: string };

export type DirectorState = {
  phase: Phase;
  phaseStartedAt: number; // ms
  events: LiveEvent[];
  sponsors: number;       // cantidad de patrocinadores con logo
  adEveryMinutes: number;
  lineups: { home: boolean; away: boolean };
  /** Nombres de los equipos, para rótulos sin jugador (por ejemplo una falta). */
  names?: { home: string; away: string };
};

export type FullScene = "ident" | "matchup" | "lineupHome" | "lineupAway" | "kickoff" | "halftime" | "fulltime" | "results" | "standings";

export type Shot = {
  full?: { scene: FullScene; t: number };
  scoreboard: boolean;
  clock: string;
  goal?: { side: Side; t: number; player?: string; minute: number };
  lower?: { kind: "yellow" | "red" | "foul" | "sub" | "scorer"; side: Side; t: number; text: string; minute: number };
  sponsor?: { index: number; t: number; slot: number }; // slot par: tarjeta; impar: franja LED
};

export const DURATIONS: Record<FullScene, number> = {
  ident: 5.8, matchup: 6, lineupHome: 10, lineupAway: 10, kickoff: 6.8, halftime: 6, fulltime: 6, results: 10, standings: 10,
};
export const GOAL_SECONDS = 6;
export const SCORER_SECONDS = 6;
export const LOWER_SECONDS = 7;
export const SPONSOR_SECONDS = 10;
const CAMERA_GAP = 25; // segundos de cámara entre bucles de gráficos en previa/descanso/final

/** Reloj del partido: 1T desde 00:00, 2T desde 45:00 (minutos:segundos). */
export function matchClock(phase: Phase, phaseStartedAt: number, now: number): string {
  const fmt = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
  const el = Math.max(0, (now - phaseStartedAt) / 1000);
  switch (phase) {
    case "previa": return "00:00";
    case "1T": return fmt(el);
    case "descanso": return "45:00";
    case "2T": return fmt(45 * 60 + el);
    case "final": return "FINAL";
  }
}

/** Minuto actual (para registrar eventos). */
export function matchMinute(phase: Phase, phaseStartedAt: number, now: number): number {
  const el = Math.max(0, (now - phaseStartedAt) / 60000);
  if (phase === "1T") return Math.floor(el) + 1;
  if (phase === "2T") return 45 + Math.floor(el) + 1;
  if (phase === "descanso") return 45;
  if (phase === "final") return 90;
  return 0;
}

/** Recorre una lista de segmentos en bucle y devuelve el activo y su tiempo local. */
function loop(segments: { scene: FullScene | "camera"; d: number }[], el: number) {
  const total = segments.reduce((s, x) => s + x.d, 0);
  let k = total > 0 ? el % total : 0;
  for (const seg of segments) {
    if (k < seg.d) return { scene: seg.scene, t: k };
    k -= seg.d;
  }
  return { scene: "camera" as const, t: 0 };
}

export function direct(s: DirectorState, now: number): Shot {
  const el = Math.max(0, (now - s.phaseStartedAt) / 1000);
  const clock = matchClock(s.phase, s.phaseStartedAt, now);
  const shot: Shot = { scoreboard: false, clock };

  // Patrocinador: rota por cada aparición.
  const sponsorAt = (sinceSec: number, every: number) => {
    if (s.sponsors <= 0) return undefined;
    const slot = Math.floor(sinceSec / every);
    const t = sinceSec - slot * every;
    return t < SPONSOR_SECONDS ? { index: slot % s.sponsors, t, slot } : undefined;
  };

  const breakLoop = (opening: FullScene, cycle: (FullScene | "camera")[]) => {
    const first = DURATIONS[opening];
    if (el < first) return { scene: opening as FullScene | "camera", t: el };
    return loop(cycle.map((sc) => ({ scene: sc, d: sc === "camera" ? CAMERA_GAP : DURATIONS[sc] })), el - first);
  };

  if (s.phase === "previa" || s.phase === "descanso" || s.phase === "final") {
    let cur: { scene: FullScene | "camera"; t: number };
    if (s.phase === "previa") {
      const cycle: (FullScene | "camera")[] = ["ident", "matchup"];
      if (s.lineups.home) cycle.push("lineupHome");
      if (s.lineups.away) cycle.push("lineupAway");
      cycle.push("camera");
      cur = loop(cycle.map((sc) => ({ scene: sc, d: sc === "camera" ? CAMERA_GAP : DURATIONS[sc] })), el);
    } else if (s.phase === "descanso") {
      cur = breakLoop("halftime", ["standings", "results", "camera"]);
    } else {
      cur = breakLoop("fulltime", ["results", "standings", "ident", "camera"]);
    }
    if (cur.scene !== "camera") shot.full = { scene: cur.scene, t: cur.t };
    else {
      shot.scoreboard = s.phase !== "previa";
      const sp = sponsorAt(cur.t, CAMERA_GAP);
      if (sp) shot.sponsor = sp;
    }
    return shot;
  }

  // En juego (1T / 2T)
  if (s.phase === "1T" && el < DURATIONS.kickoff) {
    shot.full = { scene: "kickoff", t: el };
    return shot;
  }
  shot.scoreboard = true;

  // El evento más reciente que siga en pantalla tiene prioridad sobre los anuncios.
  const recent = [...s.events].filter((e) => e.at <= now).sort((a, b) => b.at - a.at)[0];
  if (recent) {
    const t = (now - recent.at) / 1000;
    if (recent.kind === "goal") {
      if (t < GOAL_SECONDS) { shot.goal = { side: recent.side, t, player: recent.player, minute: recent.minute }; return shot; }
      if (recent.player && t < GOAL_SECONDS + SCORER_SECONDS) {
        shot.lower = { kind: "scorer", side: recent.side, t: t - GOAL_SECONDS, text: recent.player, minute: recent.minute };
        return shot;
      }
    } else if (t < LOWER_SECONDS) {
      const text = recent.kind === "sub"
        ? `${recent.playerIn ?? "Entra"} ↔ ${recent.playerOut ?? "Sale"}`
        : recent.player ?? (recent.kind === "yellow" ? "Tarjeta amarilla" : recent.kind === "red" ? "Tarjeta roja" : s.names?.[recent.side] ?? "Falta");
      shot.lower = { kind: recent.kind, side: recent.side, t, text, minute: recent.minute };
      return shot;
    }
  }

  const every = Math.max(2, s.adEveryMinutes) * 60;
  if (el >= every) {
    const sp = sponsorAt(el - every, every);
    if (sp) shot.sponsor = sp;
  }
  return shot;
}

/** Marcador actual a partir de los goles registrados en la transmisión. */
export function liveScore(base: { home: number; away: number }, events: LiveEvent[]) {
  return events.reduce((acc, e) => (e.kind === "goal" ? { ...acc, [e.side]: acc[e.side] + 1 } : acc), { ...base });
}

/** Goleadores por equipo para la barra de resultado: "Nombre 12', 40'". Los goles sin nombre no aparecen. */
export function scorersOf(events: LiveEvent[]): { home: string[]; away: string[] } {
  const out = { home: [] as string[], away: [] as string[] };
  for (const side of ["home", "away"] as const) {
    const by = new Map<string, number[]>();
    for (const e of [...events].sort((a, b) => a.at - b.at)) {
      if (e.kind !== "goal" || e.side !== side || !e.player) continue;
      by.set(e.player, [...(by.get(e.player) ?? []), e.minute]);
    }
    out[side] = [...by].map(([name, mins]) => `${name} ${mins.map((m) => `${m}'`).join(", ")}`);
  }
  return out;
}
