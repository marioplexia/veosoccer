import { describe, expect, it } from "vitest";
import { abbreviation, clamp01, clockText, easeInOutCubic, easeOutBack, easeOutBounce, easeOutCubic, progress } from "./easing";

describe("progress", () => {
  it("acota entre 0 y 1", () => {
    expect(progress(0, 1, 3)).toBe(0);
    expect(progress(2, 1, 3)).toBe(0.5);
    expect(progress(9, 1, 3)).toBe(1);
  });
  it("un intervalo vacío salta de 0 a 1 sin dividir por cero", () => {
    expect(progress(1, 2, 2)).toBe(0);
    expect(progress(2, 2, 2)).toBe(1);
  });
});

describe("curvas de easing", () => {
  const curves = { easeOutCubic, easeInOutCubic, easeOutBounce };
  it.each(Object.entries(curves))("%s empieza en 0 y termina en 1", (_n, f) => {
    expect(f(0)).toBeCloseTo(0, 6);
    expect(f(1)).toBeCloseTo(1, 6);
  });
  it("las curvas son monótonas (salvo rebote)", () => {
    for (const f of [easeOutCubic, easeInOutCubic]) {
      let prev = -1;
      for (let i = 0; i <= 100; i++) { const v = f(i / 100); expect(v).toBeGreaterThanOrEqual(prev); prev = v; }
    }
  });
  it("easeOutBack se pasa de 1 y vuelve", () => {
    expect(easeOutBack(0)).toBeCloseTo(0, 6);
    expect(easeOutBack(1)).toBeCloseTo(1, 6);
    expect(Math.max(...Array.from({ length: 101 }, (_, i) => easeOutBack(i / 100)))).toBeGreaterThan(1.05);
  });
  it("ignoran valores fuera de rango", () => {
    expect(easeOutCubic(-5)).toBe(0);
    expect(easeOutCubic(5)).toBe(1);
    expect(clamp01(NaN)).toBeNaN(); // NaN se propaga: los llamadores validan antes
  });
});

describe("clockText", () => {
  it("formatea minutos y acota valores inválidos", () => {
    expect(clockText(34)).toBe("34:00");
    expect(clockText(5)).toBe("05:00");
    expect(clockText(90)).toBe("90:00");
    expect(clockText(-3)).toBe("00:00");
    expect(clockText(999)).toBe("150:00");
    expect(clockText(NaN)).toBe("00:00");
  });
});

describe("abbreviation", () => {
  it("toma 3 letras sin acentos ni símbolos", () => {
    expect(abbreviation("Manchester City", "LOC")).toBe("MAN");
    expect(abbreviation("Águilas F.C.", "LOC")).toBe("AGU");
    expect(abbreviation("  ", "LOC")).toBe("LOC");
    expect(abbreviation("A", "VIS")).toBe("VIS");
  });
});
