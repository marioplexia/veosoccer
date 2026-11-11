// Guion del simulador de transmisión: un partido completo comprimido en ~2½ minutos.
// Produce, para cada segundo simulado, el estado del director y la "hora" a usar,
// de modo que el simulador usa exactamente la misma lógica que la transmisión real.
import { matchMinute, type DirectorState, type LiveEvent, type Phase } from "@/lib/director";

const T0 = 1_000_000_000_000;

type Segment = { at: number; phase: Phase; clockSec: number };
// "clockSec": tiempo de juego mostrado al empezar el tramo (saltos para mostrar distintos minutos).
const SEGMENTS: Segment[] = [
  { at: 0, phase: "previa", clockSec: 0 },
  { at: 32, phase: "1T", clockSec: 0 },
  { at: 39, phase: "1T", clockSec: 12 * 60 },
  { at: 54, phase: "1T", clockSec: 7 * 60 + 58 },   // anuncio con tarjeta a los 8:00
  { at: 67, phase: "1T", clockSec: 15 * 60 + 58 },  // anuncio en franja LED a los 16:00
  { at: 89, phase: "descanso", clockSec: 0 },
  { at: 114, phase: "2T", clockSec: 22 * 60 },
  { at: 137, phase: "final", clockSec: 0 },
];

type ScriptEvent = { at: number } & (
  | { kind: "goal"; side: "home" | "away"; playerIndex: number }
  | { kind: "yellow" | "red"; side: "home" | "away"; playerIndex: number }
  | { kind: "sub"; side: "home" | "away"; outIndex: number; inIndex: number }
);
const EVENTS: ScriptEvent[] = [
  { at: 41, kind: "goal", side: "home", playerIndex: 9 },
  { at: 81, kind: "yellow", side: "away", playerIndex: 4 },
  { at: 117, kind: "goal", side: "away", playerIndex: 8 },
  { at: 129, kind: "sub", side: "home", outIndex: 7, inIndex: 11 },
];

export const SIM_DURATION = 162;
export const SIM_CHAPTERS = [
  { label: "Previa", t: 0 }, { label: "Inicio", t: 32 }, { label: "Gol local", t: 40.5 }, { label: "Anuncio", t: 55.5 },
  { label: "Franja LED", t: 68.5 }, { label: "Tarjeta", t: 80.5 }, { label: "Medio tiempo", t: 89 }, { label: "2º tiempo", t: 114 },
  { label: "Gol visitante", t: 116.5 }, { label: "Cambio", t: 128.5 }, { label: "Final", t: 137 },
];

/** Estado del director y hora equivalente para el segundo `simT` de la simulación. */
export function simulateAt(simT: number, opts: { sponsors: number; adEveryMinutes?: number; lineups?: { home: boolean; away: boolean }; names: (side: "home" | "away", index: number) => string | undefined }) {
  const t = Math.min(Math.max(0, simT), SIM_DURATION);
  const now = T0 + t * 1000;
  const seg = [...SEGMENTS].reverse().find((s) => s.at <= t) ?? SEGMENTS[0];
  const phaseStartedAt = T0 + seg.at * 1000 - seg.clockSec * 1000;

  // Cada evento se registra con el minuto que marcaba el reloj en su tramo.
  const events: LiveEvent[] = EVENTS.filter((e) => e.at <= t).map((e) => {
    const es = [...SEGMENTS].reverse().find((s) => s.at <= e.at)!;
    const at = T0 + e.at * 1000;
    const minute = matchMinute(es.phase, T0 + es.at * 1000 - es.clockSec * 1000, at);
    if (e.kind === "sub") return { kind: "sub", at, side: e.side, minute, playerOut: opts.names(e.side, e.outIndex), playerIn: opts.names(e.side, e.inIndex) };
    if (e.kind === "goal") return { kind: "goal", at, side: e.side, minute, player: opts.names(e.side, e.playerIndex) };
    return { kind: e.kind, at, side: e.side, minute, player: opts.names(e.side, e.playerIndex) };
  });

  const state: DirectorState = {
    phase: seg.phase, phaseStartedAt, events, sponsors: opts.sponsors,
    adEveryMinutes: opts.adEveryMinutes ?? 8, lineups: opts.lineups ?? { home: true, away: true },
  };
  return { state, now };
}
