// Resultado de leer una imagen (planilla, cartel, captura) con IA.
// Lo que devuelve el modelo es DATO no confiable: se valida y se limita antes de usarlo.

export type ExtractedFixture = {
  home: string;
  away: string;
  venue: string | null;
  date: string | null; // YYYY-MM-DD
  time: string | null; // HH:MM
  round: number | null;
  note: string | null; // p. ej. "Gana Tortillería El Buen Maíz"
};

export type ExtractedDivision = {
  name: string;
  teams: string[];
  fixtures: ExtractedFixture[];
};

export type Extraction = {
  venues: string[];
  divisions: ExtractedDivision[];
  notes: string;
};

const FIXTURE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["home", "away", "venue", "date", "time", "round", "note"],
  properties: {
    home: { type: "string" },
    away: { type: "string" },
    venue: { type: ["string", "null"] },
    date: { type: ["string", "null"] },
    time: { type: ["string", "null"] },
    round: { type: ["integer", "null"] },
    note: { type: ["string", "null"] },
  },
} as const;

export const EXTRACTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["venues", "divisions", "notes"],
  properties: {
    venues: { type: "array", items: { type: "string" } },
    divisions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "teams", "fixtures"],
        properties: {
          name: { type: "string" },
          teams: { type: "array", items: { type: "string" } },
          fixtures: { type: "array", items: FIXTURE_SCHEMA },
        },
      },
    },
    notes: { type: "string" },
  },
} as const;

const MAX_DIVISIONS = 20;
const MAX_TEAMS = 64;
const MAX_VENUES = 40;
const MAX_FIXTURES_PER_DIVISION = 300;

const clean = (s: unknown, max = 120): string =>
  typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, max) : "";

export const normName = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

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

  const venues: string[] = [];
  const venueKeys = new Set<string>();
  const addVenue = (v: unknown) => {
    const name = clean(v);
    const key = normName(name);
    if (name && !venueKeys.has(key) && venues.length < MAX_VENUES) { venues.push(name); venueKeys.add(key); }
  };
  if (Array.isArray(obj.venues)) obj.venues.forEach(addVenue);

  // Las divisiones con el mismo nombre se fusionan.
  const divisions = new Map<string, ExtractedDivision & { teamKeys: Set<string> }>();
  const rawDivisions = Array.isArray(obj.divisions) ? obj.divisions : [];

  for (const rd of rawDivisions) {
    if (!rd || typeof rd !== "object") continue;
    const d = rd as Record<string, unknown>;
    const name = clean(d.name);
    if (!name) continue;
    const key = normName(name);
    if (!divisions.has(key)) {
      if (divisions.size >= MAX_DIVISIONS) continue;
      divisions.set(key, { name, teams: [], fixtures: [], teamKeys: new Set() });
    }
    const div = divisions.get(key)!;

    const addTeam = (t: unknown) => {
      const tn = clean(t);
      const tk = normName(tn);
      if (tn && !div.teamKeys.has(tk) && div.teams.length < MAX_TEAMS) { div.teams.push(tn); div.teamKeys.add(tk); }
    };
    if (Array.isArray(d.teams)) d.teams.forEach(addTeam);

    if (Array.isArray(d.fixtures)) {
      for (const f of d.fixtures) {
        if (div.fixtures.length >= MAX_FIXTURES_PER_DIVISION) break;
        if (!f || typeof f !== "object") continue;
        const r = f as Record<string, unknown>;
        const home = clean(r.home);
        const away = clean(r.away);
        if (!home || !away || normName(home) === normName(away)) continue;

        // Equipos y canchas que solo aparecen en partidos también se registran.
        addTeam(home);
        addTeam(away);
        const venue = clean(r.venue) || null;
        if (venue) addVenue(venue);

        div.fixtures.push({
          home,
          away,
          venue,
          date: typeof r.date === "string" && validDate(r.date.trim()) ? r.date.trim() : null,
          time: typeof r.time === "string" && TIME_RE.test(r.time.trim()) ? r.time.trim() : null,
          round: typeof r.round === "number" && Number.isInteger(r.round) && r.round >= 1 && r.round <= 200 ? r.round : null,
          note: clean(r.note, 200) || null,
        });
      }
    }
  }

  return {
    venues,
    divisions: [...divisions.values()].map(({ name, teams, fixtures }) => ({ name, teams, fixtures })),
    notes: clean(obj.notes, 500),
  };
}
