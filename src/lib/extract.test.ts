import { describe, expect, it } from "vitest";
import { sanitizeExtraction } from "./extract";

const fx = (home: string, away: string, extra: object = {}) => ({
  home, away, venue: null, date: null, time: null, round: null, note: null, ...extra,
});

describe("sanitizeExtraction", () => {
  it("descarta basura y tipos incorrectos sin lanzar", () => {
    const empty = { venues: [], divisions: [], notes: "" };
    expect(sanitizeExtraction(null)).toEqual(empty);
    expect(sanitizeExtraction("hola")).toEqual(empty);
    expect(sanitizeExtraction({ venues: 5, divisions: "x" })).toEqual(empty);
    expect(sanitizeExtraction({ divisions: [null, 3, { teams: ["A"] }] }).divisions).toEqual([]);
  });

  it("separa las divisiones y permite el mismo club en varias", () => {
    const r = sanitizeExtraction({
      venues: [], notes: "",
      divisions: [
        { name: "Reservas Premier", teams: ["Autoservicio La Playa Atlas"], fixtures: [] },
        { name: "Segundas", teams: ["Autoservicio La Playa Atlas"], fixtures: [] },
      ],
    });
    expect(r.divisions.map((d) => d.name)).toEqual(["Reservas Premier", "Segundas"]);
    expect(r.divisions.every((d) => d.teams.length === 1)).toBe(true);
  });

  it("deduplica equipos dentro de una división ignorando mayúsculas y acentos", () => {
    const r = sanitizeExtraction({ divisions: [{ name: "A", teams: ["Águilas", "aguilas", " Búhos  "], fixtures: [] }] });
    expect(r.divisions[0].teams).toEqual(["Águilas", "Búhos"]);
  });

  it("agrega a la división los equipos que solo aparecen en partidos, y las canchas a la lista global", () => {
    const r = sanitizeExtraction({
      divisions: [{ name: "Segundas", teams: ["A"], fixtures: [fx("A", "B", { venue: "Taconi", date: "2026-11-08", time: "14:00", round: 6 })] }],
    });
    expect(r.divisions[0].teams).toEqual(["A", "B"]);
    expect(r.venues).toEqual(["Taconi"]);
    expect(r.divisions[0].fixtures[0]).toMatchObject({ round: 6, date: "2026-11-08", time: "14:00" });
  });

  it("conserva la nota de partidos decididos sin jugarse", () => {
    const r = sanitizeExtraction({ divisions: [{ name: "Segundas", teams: [], fixtures: [fx("Paqueteria", "Pinzandaro", { note: "Gana: Tortilleria El Buen Maiz" })] }] });
    expect(r.divisions[0].fixtures[0].note).toBe("Gana: Tortilleria El Buen Maiz");
  });

  it("incluye equipos que solo aparecen como descanso (listados sin partido)", () => {
    const r = sanitizeExtraction({ divisions: [{ name: "Reservas Premier", teams: ["Atletico Veva"], fixtures: [] }] });
    expect(r.divisions[0].teams).toEqual(["Atletico Veva"]);
  });

  it("descarta partidos de un equipo contra sí mismo o incompletos", () => {
    const r = sanitizeExtraction({ divisions: [{ name: "A", teams: [], fixtures: [fx("A", "a"), fx("", "B"), fx("A", "B")] }] });
    expect(r.divisions[0].fixtures).toHaveLength(1);
  });

  it("anula fechas, horas y jornadas inválidas pero conserva el partido", () => {
    const r = sanitizeExtraction({ divisions: [{ name: "A", teams: [], fixtures: [fx("A", "B", { date: "2026-02-31", time: "25:00", round: 0 })] }] });
    expect(r.divisions[0].fixtures[0]).toMatchObject({ date: null, time: null, round: null });
  });

  it("fusiona divisiones repetidas y respeta los límites", () => {
    const merged = sanitizeExtraction({ divisions: [{ name: "Segundas", teams: ["A"] }, { name: "segundas", teams: ["B"] }] });
    expect(merged.divisions).toHaveLength(1);
    expect(merged.divisions[0].teams).toEqual(["A", "B"]);

    const many = Array.from({ length: 500 }, (_, i) => `Equipo ${i}`);
    expect(sanitizeExtraction({ divisions: [{ name: "A", teams: many }] }).divisions[0].teams).toHaveLength(64);
    expect(sanitizeExtraction({ divisions: Array.from({ length: 50 }, (_, i) => ({ name: `D${i}` })) }).divisions).toHaveLength(20);
    expect(sanitizeExtraction({ divisions: [{ name: "x".repeat(1000) }] }).divisions[0].name).toHaveLength(120);
  });
});
