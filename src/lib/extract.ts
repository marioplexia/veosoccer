// Resultado de leer una imagen (planilla, cartel, captura) con IA.
// Lo que devuelve el modelo es DATO no confiable: se valida y se limita antes de usarlo.

export type ExtractedFixture = {
  home: string;
  away: string;
  venue: string | null;
  date: string | null; // YYYY-MM-DD
  time: string | null; // HH:MM
  round: number | null;
};

export type Extraction = {
  teams: string[];
  venues: string[];
  fixtures: ExtractedFixture[];
  notes: string;
};

export const EXTRACTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["teams", "venues", "fixtures", "notes"],
  properties: {
    teams: { type: "array", items: { type: "string" } },
    venues: { type: "array", items: { type: "string" } },
    fixtures: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["home", "away", "venue", "date", "time", "round"],
        properties: {
          home: { type: "string" },
          away: { type: "string" },
          venue: { type: ["string", "null"] },
          date: { type: ["string", "null"] },
          time: { type: ["string", "null"] },
          round: { type: ["integer", "null"] },
        },
      },
    },
    notes: { type: "string" },
  },
} as const;

const MAX_TEAMS = 64;
const MAX_VENUES = 20;
const MAX_FIXTURES = 500;

const clean = (s: unknown, max = 120): string =>
  typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, max) : "";

export const normName = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

function uniqueNames(list: unknown, limit: number): string[] {
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of list) {
    const name = clean(item);
    const key = normName(name);
    if (!name || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
    if (out.length >= limit) break;
  }
  return out;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function validDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Valida y normaliza la respuesta del modelo. Cualquier elemento inválido se descarta. */
export function sanitizeExtraction(raw: unknown): Extraction {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;

  const teams = uniqueNames(obj.teams, MAX_TEAMS);
  const venues = uniqueNames(obj.venues, MAX_VENUES);

  const fixtures: ExtractedFixture[] = [];
  const teamKeys = new Set(teams.map(normName));
  const venueKeys = new Set(venues.map(normName));

  if (Array.isArray(obj.fixtures)) {
    for (const f of obj.fixtures.slice(0, MAX_FIXTURES)) {
      if (!f || typeof f !== "object") continue;
      const r = f as Record<string, unknown>;
      const home = clean(r.home);
      const away = clean(r.away);
      if (!home || !away || normName(home) === normName(away)) continue;

      // Equipos/canchas que aparecen en partidos pero no en la lista: se agregan.
      for (const t of [home, away]) {
        if (!teamKeys.has(normName(t)) && teams.length < MAX_TEAMS) { teams.push(t); teamKeys.add(normName(t)); }
      }
      const venue = clean(r.venue) || null;
      if (venue && !venueKeys.has(normName(venue)) && venues.length < MAX_VENUES) { venues.push(venue); venueKeys.add(normName(venue)); }

      const date = typeof r.date === "string" && validDate(r.date.trim()) ? r.date.trim() : null;
      const time = typeof r.time === "string" && TIME_RE.test(r.time.trim()) ? r.time.trim() : null;
      const round = typeof r.round === "number" && Number.isInteger(r.round) && r.round >= 1 && r.round <= 200 ? r.round : null;
      fixtures.push({ home, away, venue, date, time, round });
    }
  }

  return { teams, venues, fixtures, notes: clean(obj.notes, 500) };
}
