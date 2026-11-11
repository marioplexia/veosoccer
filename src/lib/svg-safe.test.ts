import { describe, expect, it } from "vitest";
import { checkSvg } from "./svg-safe";

const ok = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs><linearGradient id="g1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#C8102E"/><stop offset="1" stop-color="#7a0a1c"/></linearGradient></defs><path d="M256 20 L470 90 V260 C470 380 370 460 256 492 C142 460 42 380 42 260 V90 Z" fill="url(#g1)" stroke="#fff" stroke-width="14"/><circle cx="256" cy="250" r="90" fill="#1D4ED8"/><text x="256" y="280" font-family="sans-serif" font-size="90" font-weight="800" text-anchor="middle" fill="#fff">LM</text></svg>`;

describe("checkSvg", () => {
  it("acepta un escudo simple con degradado y texto, y fija su tamaño", () => {
    const r = checkSvg(ok);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.svg.startsWith('<svg width="512" height="512"')).toBe(true);
      expect(r.svg.match(/ width=/g)).toHaveLength(1);
    }
  });

  it("agrega xmlns si falta y quita la declaración xml", () => {
    const r = checkSvg(`<?xml version="1.0"?>\n<svg viewBox="0 0 10 10" width="99" height="99"><rect x="0" y="0" width="10" height="10" fill="red"/></svg>`);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.svg).toContain('xmlns="http://www.w3.org/2000/svg"');
      expect(r.svg).not.toContain('width="99"');
    }
  });

  const bad: Record<string, string> = {
    script: `<svg viewBox="0 0 10 10"><script>alert(1)</script></svg>`,
    "evento onload": `<svg viewBox="0 0 10 10" onload="alert(1)"></svg>`,
    "evento en forma": `<svg viewBox="0 0 10 10"><rect onclick="x()" width="1" height="1"/></svg>`,
    foreignObject: `<svg viewBox="0 0 10 10"><foreignObject><div>x</div></foreignObject></svg>`,
    "imagen externa": `<svg viewBox="0 0 10 10"><image href="https://evil.example/x.png"/></svg>`,
    "use con href": `<svg viewBox="0 0 10 10"><use href="#a"/></svg>`,
    "estilo": `<svg viewBox="0 0 10 10"><style>@import url(https://x)</style></svg>`,
    "atributo style": `<svg viewBox="0 0 10 10"><rect style="fill:red" width="1" height="1"/></svg>`,
    "url externa en fill": `<svg viewBox="0 0 10 10"><rect fill="url(https://x/y#a)" width="1" height="1"/></svg>`,
    "javascript en valor": `<svg viewBox="0 0 10 10"><rect fill="javascript:alert(1)" width="1" height="1"/></svg>`,
    "data uri": `<svg viewBox="0 0 10 10"><rect fill="url(data:x)" width="1" height="1"/></svg>`,
    entidad: `<!DOCTYPE svg [<!ENTITY x "y">]><svg viewBox="0 0 10 10">&x;</svg>`,
    "entidad suelta": `<svg viewBox="0 0 10 10"><text>&x;</text></svg>`,
    "sin viewBox": `<svg><rect width="1" height="1"/></svg>`,
    "desbalanceado": `<svg viewBox="0 0 10 10"><g><rect width="1" height="1"/></svg>`,
    "texto con <": `<svg viewBox="0 0 10 10"><text>a < b</text></svg>`,
    "contenido extra": `<svg viewBox="0 0 10 10"></svg><script>x</script>`,
    "no svg": `<div>hola</div>`,
    "animación": `<svg viewBox="0 0 10 10"><animate attributeName="x"/></svg>`,
    "mayúsculas en script": `<svg viewBox="0 0 10 10"><SCRIPT>x</SCRIPT></svg>`,
  };
  it.each(Object.entries(bad))("rechaza %s", (_name, svg) => {
    expect(checkSvg(svg).ok).toBe(false);
  });

  it("rechaza tipos incorrectos y SVG enormes", () => {
    expect(checkSvg(null).ok).toBe(false);
    expect(checkSvg(42).ok).toBe(false);
    expect(checkSvg(`<svg viewBox="0 0 1 1">${"<g></g>".repeat(10000)}</svg>`).ok).toBe(false);
  });
});
