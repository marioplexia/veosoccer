// Validación estricta de SVG generado por IA (contenido no confiable).
// Solo se aceptan formas simples, degradados y texto; nada de scripts, enlaces, estilos,
// referencias externas ni entidades. Se valida (no se intenta "arreglar"): si algo no está
// permitido, el SVG se rechaza entero.

const TAGS = new Set([
  "svg", "g", "path", "circle", "ellipse", "rect", "polygon", "polyline", "line",
  "defs", "lineargradient", "radialgradient", "stop", "clippath", "text", "tspan", "title",
]);

const ATTRS = new Set([
  "xmlns", "viewbox", "width", "height", "x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "ry",
  "d", "points", "fill", "fill-rule", "fill-opacity", "clip-rule", "stroke", "stroke-width", "stroke-linejoin",
  "stroke-linecap", "stroke-opacity", "stroke-miterlimit", "opacity", "transform", "id", "clip-path",
  "offset", "stop-color", "stop-opacity", "gradientunits", "gradienttransform", "fx", "fy",
  "font-family", "font-size", "font-weight", "text-anchor", "dominant-baseline", "letter-spacing",
]);

export const MAX_SVG_BYTES = 40_000;

// Valores de color/pintura permitidos: hex, palabras simples, none, url(#id) interna.
const PAINT = /^(#[0-9a-fA-F]{3,8}|none|transparent|currentColor|[a-zA-Z]{3,20}|url\(#[A-Za-z][\w-]{0,40}\))$/;
const SAFE_VALUE = /^[\w\s#.,%()+\-:'"/]*$/;

export type SvgCheck = { ok: true; svg: string } | { ok: false; reason: string };

export function checkSvg(input: unknown): SvgCheck {
  if (typeof input !== "string") return { ok: false, reason: "no es texto" };
  let svg = input.trim().replace(/^<\?xml[^>]*\?>\s*/i, "");
  if (svg.length === 0) return { ok: false, reason: "vacío" };
  if (new TextEncoder().encode(svg).length > MAX_SVG_BYTES) return { ok: false, reason: "demasiado grande" };
  if (/<!|<\?|&(?!(amp|lt|gt|quot|apos|#\d{1,5});)/i.test(svg)) return { ok: false, reason: "declaraciones o entidades no permitidas" };
  if (/javascript:|data:|https?:|\/\/|@import|expression\(/i.test(svg.replace(/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/, ""))) return { ok: false, reason: "referencia externa" };
  if (!/^<svg[\s>]/i.test(svg) || !/<\/svg>\s*$/i.test(svg)) return { ok: false, reason: "no es un SVG" };

  const tagRe = /<\/?([a-zA-Z][\w:-]*)((?:\s+[^\s=>/]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*\/?>/g;
  let last = 0;
  let m: RegExpExecArray | null;
  const stack: string[] = [];
  while ((m = tagRe.exec(svg))) {
    const between = svg.slice(last, m.index);
    if (between.includes("<") || between.includes(">")) return { ok: false, reason: "marcado mal formado" };
    last = tagRe.lastIndex;
    const raw = m[0];
    const name = m[1].toLowerCase();
    if (!TAGS.has(name)) return { ok: false, reason: `etiqueta no permitida: ${m[1]}` };
    const closing = raw.startsWith("</");
    const selfClosing = raw.endsWith("/>");
    if (closing) {
      if (stack.pop() !== name) return { ok: false, reason: "etiquetas desbalanceadas" };
      continue;
    }
    const attrRe = /([^\s=>/]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
    let a: RegExpExecArray | null;
    while ((a = attrRe.exec(m[2]))) {
      const key = a[1].toLowerCase();
      const val = a[3] ?? a[4] ?? "";
      if (!ATTRS.has(key)) return { ok: false, reason: `atributo no permitido: ${a[1]}` };
      if (!SAFE_VALUE.test(val)) return { ok: false, reason: `valor no permitido en ${a[1]}` };
      if ((key === "fill" || key === "stroke" || key === "stop-color") && !PAINT.test(val.trim())) return { ok: false, reason: `color no permitido en ${a[1]}` };
      if (key === "clip-path" && !/^url\(#[A-Za-z][\w-]{0,40}\)$/.test(val.trim())) return { ok: false, reason: "clip-path no permitido" };
      if (/url\(/i.test(val) && !/^url\(#[A-Za-z][\w-]{0,40}\)$/.test(val.trim())) return { ok: false, reason: "url no permitida" };
    }
    if (!selfClosing) stack.push(name);
  }
  if (svg.slice(last).trim() !== "") return { ok: false, reason: "contenido tras el SVG" };
  if (stack.length !== 0) return { ok: false, reason: "etiquetas sin cerrar" };
  if (!/viewBox\s*=/.test(svg)) return { ok: false, reason: "falta viewBox" };
  // Tamaño fijo para rasterizar de forma predecible.
  svg = svg.replace(/^<svg\b/i, '<svg width="512" height="512"').replace(/^(<svg width="512" height="512"[^>]*?)\s(width|height)="[^"]*"/i, "$1").replace(/^(<svg width="512" height="512"[^>]*?)\s(width|height)="[^"]*"/i, "$1");
  if (!/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/.test(svg)) svg = svg.replace(/^<svg\b/, '<svg xmlns="http://www.w3.org/2000/svg"');
  return { ok: true, svg };
}

export const svgDataUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
