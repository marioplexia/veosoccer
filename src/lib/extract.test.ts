import { describe, expect, it } from "vitest";
import { sanitizeExtraction } from "./extract";

describe("sanitizeExtraction", () => {
  it("descarta basura y tipos incorrectos sin lanzar", () => {
    expect(sanitizeExtraction(null)).toEqual({ teams: [], venues: [], fixtures: [], notes: "" });
    expect(sanitizeExtraction("hola")).toEqual({ teams: [], venues: [], fixtures: [], notes: "" });
    expect(sanitizeExtraction({ teams: 5, venues: {}, fixtures: "x" }).teams).toEqual([]);
  });

  it("deduplica nombres ignorando mayúsculas y acentos", () => {
    const r = sanitizeExtraction({ teams: ["Águilas", "aguilas", " Búhos  "], venues: ["Cancha 1", "cancha 1"], fixtures: [], notes: "" });
    expect(r.teams).toEqual(["Águilas", "Búhos"]);
    expect(r.venues).toEqual(["Cancha 1"]);
  });

  it("agrega a las listas los equipos y canchas que solo aparecen en partidos", () => {
    const r = sanitizeExtraction({
      teams: ["A"], venues: [], notes: "",
      fixtures: [{ home: "A", away: "B", venue: "Norte", date: "2026-12-05", time: "09:00", round: 1 }],
    });
    expect(r.teams).toEqual(["A", "B"]);
    expect(r.venues).toEqual(["Norte"]);
    expect(r.fixtures).toHaveLength(1);
  });

  it("descarta partidos de un equipo contra sí mismo o incompletos", () => {
    const r = sanitizeExtraction({
      teams: [], venues: [], notes: "",
      fixtures: [
        { home: "A", away: "a", venue: null, date: null, time: null, round: null },
        { home: "", away: "B" },
        { home: "A", away: "B", venue: null, date: null, time: null, round: null },
      ],
    });
    expect(r.fixtures).toHaveLength(1);
  });

  it("anula fechas, horas y jornadas inválidas pero conserva el partido", () => {
    const r = sanitizeExtraction({
      teams: [], venues: [], notes: "",
      fixtures: [{ home: "A", away: "B", venue: null, date: "2026-02-31", time: "25:00", round: 0 }],
    });
    expect(r.fixtures[0]).toMatchObject({ date: null, time: null, round: null });
  });

  it("limita la cantidad de elementos y la longitud de los textos", () => {
    const many = Array.from({ length: 500 }, (_, i) => `Equipo ${i}`);
    expect(sanitizeExtraction({ teams: many }).teams).toHaveLength(64);
    expect(sanitizeExtraction({ teams: ["x".repeat(1000)] }).teams[0]).toHaveLength(120);
  });
});
