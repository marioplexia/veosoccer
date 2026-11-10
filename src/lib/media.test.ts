import { describe, expect, it } from "vitest";
import { fitWithin } from "./media";

describe("fitWithin", () => {
  it("reduce manteniendo la proporción", () => {
    expect(fitWithin(4000, 3000, 900)).toEqual({ w: 900, h: 675 });
    expect(fitWithin(3000, 4000, 900)).toEqual({ w: 675, h: 900 });
  });
  it("no agranda imágenes pequeñas", () => {
    expect(fitWithin(300, 200, 900)).toEqual({ w: 300, h: 200 });
  });
  it("tolera medidas inválidas y extremas", () => {
    expect(fitWithin(0, 100, 900)).toEqual({ w: 0, h: 0 });
    expect(fitWithin(NaN, 100, 900)).toEqual({ w: 0, h: 0 });
    expect(fitWithin(10000, 1, 512)).toEqual({ w: 512, h: 1 });
  });
});
