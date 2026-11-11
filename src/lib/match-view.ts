// Datos derivados para la pantalla de partidos y la ficha de un partido.
import type { Fixture } from "@/lib/types";

export type FormEntry = { fixtureId: string; round: number; opponentId: string; home: boolean; gf: number; ga: number; result: "W" | "D" | "L" };
export type UpcomingEntry = { fixtureId: string; round: number; opponentId: string; home: boolean; kickoff: string | null };

const played = (f: Fixture) => f.home_score != null && f.away_score != null;
const byTime = (a: Fixture, b: Fixture) => a.round - b.round || (a.kickoff ?? "").localeCompare(b.kickoff ?? "");

/** Últimos `n` partidos jugados del equipo (sin contar `exceptId`), del más antiguo al más reciente. */
export function teamForm(teamId: string, fixtures: Fixture[], exceptId?: string, n = 5): FormEntry[] {
  return fixtures
    .filter((f) => f.id !== exceptId && played(f) && (f.home_team_id === teamId || f.away_team_id === teamId))
    .sort(byTime).slice(-n)
    .map((f) => {
      const home = f.home_team_id === teamId;
      const gf = (home ? f.home_score : f.away_score) as number, ga = (home ? f.away_score : f.home_score) as number;
      return { fixtureId: f.id, round: f.round, opponentId: home ? f.away_team_id : f.home_team_id, home, gf, ga, result: gf > ga ? "W" : gf < ga ? "L" : "D" };
    });
}

/** Próximos `n` partidos sin jugar del equipo (sin contar `exceptId`). */
export function teamUpcoming(teamId: string, fixtures: Fixture[], exceptId?: string, n = 5): UpcomingEntry[] {
  return fixtures
    .filter((f) => f.id !== exceptId && !played(f) && (f.home_team_id === teamId || f.away_team_id === teamId))
    .sort(byTime).slice(0, n)
    .map((f) => {
      const home = f.home_team_id === teamId;
      return { fixtureId: f.id, round: f.round, opponentId: home ? f.away_team_id : f.home_team_id, home, kickoff: f.kickoff };
    });
}

const dayFmt = new Intl.DateTimeFormat("es", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
/** "2026-11-07T16:00:00" -> { key: "2026-11-07", label: "sáb, 7 nov" }; sin fecha -> "Sin fecha". */
export function dayOf(kickoff: string | null): { key: string; label: string } {
  const m = kickoff ? /^(\d{4})-(\d{2})-(\d{2})/.exec(kickoff) : null;
  if (!m) return { key: "9999", label: "Sin fecha" };
  return { key: m[0], label: dayFmt.format(new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))) };
}
export const timeOf = (kickoff: string | null) => {
  const m = kickoff ? /T(\d{2}):(\d{2})/.exec(kickoff) : null;
  return m && !(m[1] === "00" && m[2] === "00") ? `${m[1]}:${m[2]}` : null;
};

/** Agrupa por día, en orden; dentro de cada día por hora. */
export function groupByDay<T extends { kickoff: string | null }>(fixtures: T[]): { key: string; label: string; items: T[] }[] {
  const map = new Map<string, { key: string; label: string; items: T[] }>();
  for (const f of [...fixtures].sort((a, b) => (a.kickoff ?? "9999").localeCompare(b.kickoff ?? "9999"))) {
    const d = dayOf(f.kickoff);
    if (!map.has(d.key)) map.set(d.key, { ...d, items: [] });
    map.get(d.key)!.items.push(f);
  }
  return [...map.values()];
}

/** Resumen del partido escrito por la IA (también es el guion del video). */
export type MatchSummary = {
  headline: string;
  paragraphs: string[];
  moments: { minute: number | null; text: string }[];
  closing: string;
  social: string;
};

const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
/** Valida y recorta lo que devuelve la IA (o lo guardado). Devuelve null si no sirve. */
export function sanitizeSummary(raw: unknown): MatchSummary | null {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
  if (!r) return null;
  const headline = str(r.headline, 90);
  const paragraphs = (Array.isArray(r.paragraphs) ? r.paragraphs : []).map((p) => str(p, 700)).filter(Boolean).slice(0, 4);
  if (!headline || paragraphs.length === 0) return null;
  const moments = (Array.isArray(r.moments) ? r.moments : []).flatMap((m) => {
    const o = m && typeof m === "object" ? (m as Record<string, unknown>) : {};
    const text = str(o.text, 140);
    const minute = typeof o.minute === "number" && Number.isFinite(o.minute) && o.minute >= 0 && o.minute <= 150 ? Math.round(o.minute) : null;
    return text ? [{ minute, text }] : [];
  }).slice(0, 8);
  return { headline, paragraphs, moments, closing: str(r.closing, 140), social: str(r.social, 400) };
}
