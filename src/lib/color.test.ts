import { describe, expect, it } from "vitest";
import { contrastRatio, hexToHsv, hsvToHex, normalizeHex, readableOn, rgbToHex } from "./color";

describe("normalizeHex", () => {
  it("acepta 3 y 6 dígitos, con o sin #, y normaliza a mayúsculas", () => {
    expect(normalizeHex("#ff2882")).toBe("#FF2882");
    expect(normalizeHex("ff2882")).toBe("#FF2882");
    expect(normalizeHex("#f08")).toBe("#FF0088");
    expect(normalizeHex("  #00ff87 ")).toBe("#00FF87");
  });
  it("rechaza entradas inválidas", () => {
    for (const bad of ["", "#12", "#12345", "#1234567", "#GGGGGG", "rojo", "#ff28 82"]) expect(normalizeHex(bad)).toBeNull();
  });
});

describe("conversión HEX <-> HSV", () => {
  it("colores conocidos", () => {
    expect(hexToHsv("#FF0000")).toEqual({ h: 0, s: 1, v: 1 });
    expect(hexToHsv("#000000")).toEqual({ h: 0, s: 0, v: 0 });
    expect(hexToHsv("#FFFFFF")).toEqual({ h: 0, s: 0, v: 1 });
    expect(hsvToHex({ h: 120, s: 1, v: 1 })).toBe("#00FF00");
    expect(hsvToHex({ h: 240, s: 1, v: 1 })).toBe("#0000FF");
  });
  it("ida y vuelta conserva el color (paleta de ejemplo)", () => {
    for (const hex of ["#FF2882", "#FF6900", "#EBFF00", "#00FF87", "#05F0FF", "#38003C", "#808080"]) {
      expect(hsvToHex(hexToHsv(hex))).toBe(hex);
    }
  });
  it("el matiz se envuelve (360 = 0, negativos)", () => {
    expect(hsvToHex({ h: 360, s: 1, v: 1 })).toBe("#FF0000");
    expect(hsvToHex({ h: -120, s: 1, v: 1 })).toBe("#0000FF");
  });
  it("rgbToHex limita los canales", () => {
    expect(rgbToHex(300, -5, 127.6)).toBe("#FF0080");
  });
});

describe("contraste", () => {
  it("negro sobre blanco es 21 y el mismo color es 1", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 0);
    expect(contrastRatio("#336699", "#336699")).toBeCloseTo(1, 5);
  });
  it("es simétrico", () => {
    expect(contrastRatio("#FF2882", "#FFFFFF")).toBeCloseTo(contrastRatio("#FFFFFF", "#FF2882"), 8);
  });
  it("readableOn elige el texto legible", () => {
    expect(readableOn("#000000")).toBe("#FFFFFF");
    expect(readableOn("#EBFF00")).toBe("#111111");
    expect(readableOn("#38003C")).toBe("#FFFFFF");
  });
});
