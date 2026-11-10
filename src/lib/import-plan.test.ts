import { describe, expect, it } from "vitest";
import { buildImportFixtures } from "./import-plan";

// Datos como los del rol de juegos de la Jornada 6 de una liga con 3 divisiones.
const fx = (home: string, away: string, extra: object = {}) => ({
  home, away, venue: null, date: "2026-11-08", time: null, round: 6, note: null, ...extra,
});

const base = () => ({
  tournamentId: "T",
  divisionIds: new Map([["reservas premier", "D1"], ["segundas", "D2"]]),
  teamIds: new Map([
    ["D1|autoservicio la playa atlas", "p-atlas"], ["D1|niltepec taconi", "p-niltepec"],
    ["D2|autoservicio la playa atlas", "s-atlas"], ["D2|girasoles", "s-giras"],
    ["D2|paqueteria y tortilleria f.c.", "s-paq"], ["D2|pinzandaro f.c.", "s-pinz"],
  ]),
  venueIds: new Map([["taconi", "V-taconi"], ["cda", "V-cda"]]),
  existing: [] as { division_id: string; round: number; home_team_id: string; away_team_id: string }[],
  defaultRound: 1,
});

describe("buildImportFixtures", () => {
  it("resuelve el mismo club por separado en cada división", () => {
    const { rows } = buildImportFixtures({
      ...base(),
      divisions: [
        { name: "Reservas Premier", teams: [], fixtures: [fx("Autoservicio La Playa Atlas", "Niltepec Taconi", { venue: "Taconi", time: "16:00" })] },
        { name: "Segundas", teams: [], fixtures: [fx("Autoservicio La Playa Atlas", "Girasoles", { venue: "CDA", time: "12:00" })] },
      ],
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ division_id: "D1", home_team_id: "p-atlas", venue_id: "V-taconi", kickoff: "2026-11-08T16:00:00", round: 6 });
    expect(rows[1]).toMatchObject({ division_id: "D2", home_team_id: "s-atlas", venue_id: "V-cda", kickoff: "2026-11-08T12:00:00" });
  });

  it("guarda el partido decidido por default con su nota y sin cancha ni hora", () => {
    const { rows } = buildImportFixtures({
      ...base(),
      divisions: [{ name: "Segundas", teams: [], fixtures: [fx("Paquetería y Tortillería F.C.", "Pinzandaro F.C.", { note: "Gana: Tortillería El Buen Maíz" })] }],
    });
    expect(rows[0]).toMatchObject({ venue_id: null, kickoff: "2026-11-08T00:00:00", note: "Gana: Tortillería El Buen Maíz" });
  });

  it("omite los partidos que ya existen, aunque estén invertidos, y los repetidos en la imagen", () => {
    const r = buildImportFixtures({
      ...base(),
      existing: [{ division_id: "D2", round: 6, home_team_id: "s-giras", away_team_id: "s-atlas" }],
      divisions: [{ name: "Segundas", teams: [], fixtures: [
        fx("Autoservicio La Playa Atlas", "Girasoles"),
        fx("Paquetería y Tortillería F.C.", "Pinzandaro F.C."),
        fx("Paquetería y Tortillería F.C.", "Pinzandaro F.C."),
      ] }],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.duplicates).toBe(2);
  });

  it("deja la misma pareja en jornadas distintas como partidos distintos", () => {
    const r = buildImportFixtures({
      ...base(),
      existing: [{ division_id: "D2", round: 5, home_team_id: "s-atlas", away_team_id: "s-giras" }],
      divisions: [{ name: "Segundas", teams: [], fixtures: [fx("Autoservicio La Playa Atlas", "Girasoles", { round: 6 })] }],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.duplicates).toBe(0);
  });

  it("cuenta como no resueltos los equipos desconocidos o de otra división", () => {
    const r = buildImportFixtures({
      ...base(),
      divisions: [
        { name: "Reservas Premier", teams: [], fixtures: [fx("Autoservicio La Playa Atlas", "Girasoles")] }, // Girasoles es de Segundas
        { name: "División Fantasma", teams: [], fixtures: [fx("A", "B")] },
      ],
    });
    expect(r.rows).toHaveLength(0);
    expect(r.unresolved).toBe(2);
  });

  it("usa la jornada por defecto cuando la imagen no la indica y respeta fecha vacía", () => {
    const r = buildImportFixtures({
      ...base(),
      defaultRound: 9,
      divisions: [{ name: "Segundas", teams: [], fixtures: [fx("Autoservicio La Playa Atlas", "Girasoles", { round: null, date: null })] }],
    });
    expect(r.rows[0]).toMatchObject({ round: 9, kickoff: null });
  });

  it("ignora diferencias de mayúsculas, acentos y espacios al buscar equipos y canchas", () => {
    const r = buildImportFixtures({
      ...base(),
      divisions: [{ name: "SEGUNDAS", teams: [], fixtures: [fx("  AUTOSERVICIO la playa  ATLAS ", "girasoles", { venue: "  TACONI " })] }],
    });
    expect(r.rows[0]).toMatchObject({ venue_id: "V-taconi" });
  });
});
