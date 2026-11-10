"use client";

import { useEffect, useRef, useState } from "react";
import { hexToHsv, hsvToHex, normalizeHex, type Hsv } from "@/lib/color";

type EyeDropperCtor = new () => { open: () => Promise<{ sRGBHex: string }> };

/**
 * Selector de color: cuadro de saturación/brillo, barra de matiz y código HEX.
 * También acepta teclado (flechas) y, en navegadores compatibles, un cuentagotas.
 */
export default function ColorPicker({ value, onChange, label }: { value: string; onChange: (hex: string) => void; label: string }) {
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(value));
  const [text, setText] = useState(value);
  const emitted = useRef(value);
  const area = useRef<HTMLDivElement>(null);

  // Si el color cambia desde fuera (otro control), se sincroniza; si lo emitimos nosotros, no.
  useEffect(() => {
    if (value !== emitted.current) {
      emitted.current = value;
      setHsv(hexToHsv(value));
      setText(value);
    }
  }, [value]);

  function commit(next: Hsv) {
    setHsv(next);
    const hex = hsvToHex(next);
    emitted.current = hex;
    setText(hex);
    onChange(hex);
  }

  function fromPointer(e: React.PointerEvent) {
    const r = area.current!.getBoundingClientRect();
    const s = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const v = Math.min(1, Math.max(0, 1 - (e.clientY - r.top) / r.height));
    commit({ h: hsv.h, s, v });
  }

  function onKey(e: React.KeyboardEvent) {
    const step = e.shiftKey ? 0.1 : 0.01;
    const d: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    const m = d[e.key];
    if (!m) return;
    e.preventDefault();
    commit({ h: hsv.h, s: Math.min(1, Math.max(0, hsv.s + m[0])), v: Math.min(1, Math.max(0, hsv.v + m[1])) });
  }

  function onText(v: string) {
    setText(v);
    const hex = normalizeHex(v);
    if (hex) {
      emitted.current = hex;
      setHsv((cur) => {
        const n = hexToHsv(hex);
        // Un gris o negro no tiene matiz: conserva el que había para que la barra no salte.
        return n.s === 0 || n.v === 0 ? { ...n, h: cur.h } : n;
      });
      onChange(hex);
    }
  }

  async function pipette() {
    const Ctor = (window as unknown as { EyeDropper?: EyeDropperCtor }).EyeDropper;
    if (!Ctor) return;
    try {
      const { sRGBHex } = await new Ctor().open();
      const hex = normalizeHex(sRGBHex);
      if (hex) commit(hexToHsv(hex));
    } catch {
      /* cancelado por la persona usuaria */
    }
  }

  const invalid = normalizeHex(text) === null;
  const hasPipette = typeof window !== "undefined" && "EyeDropper" in window;

  return (
    <div className="w-full max-w-xs space-y-3">
      <div
        ref={area}
        role="slider"
        tabIndex={0}
        aria-label={`${label}: saturación y brillo`}
        aria-valuetext={`Saturación ${Math.round(hsv.s * 100)} %, brillo ${Math.round(hsv.v * 100)} %`}
        aria-valuenow={Math.round(hsv.s * 100)}
        onKeyDown={onKey}
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); fromPointer(e); }}
        onPointerMove={(e) => { if (e.currentTarget.hasPointerCapture(e.pointerId)) fromPointer(e); }}
        className="relative h-40 w-full cursor-crosshair touch-none rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
        style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hsv.h} 100% 50%))` }}
      >
        <span
          className="pointer-events-none absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1.5px_rgba(0,0,0,.5)]"
          style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: hsvToHex(hsv) }}
        />
      </div>

      <input
        type="range"
        min={0}
        max={360}
        step={1}
        value={Math.round(hsv.h)}
        onChange={(e) => commit({ ...hsv, h: Number(e.target.value) })}
        aria-label={`${label}: matiz`}
        className="hue-range w-full"
      />

      <div className="flex items-center gap-2">
        <span className="h-9 w-9 shrink-0 rounded-lg border border-slate-300" style={{ background: invalid ? value : normalizeHex(text)! }} aria-hidden />
        <input
          value={text}
          onChange={(e) => onText(e.target.value)}
          onBlur={() => setText(emitted.current)}
          spellCheck={false}
          maxLength={7}
          aria-label={`${label}: código HEX`}
          aria-invalid={invalid}
          className={`w-full rounded-lg border px-3 py-2 font-mono text-sm uppercase outline-none focus:ring-2 ${invalid ? "border-red-400 focus:ring-red-200" : "border-slate-300 focus:border-emerald-600 focus:ring-emerald-600/20"}`}
        />
        {hasPipette && (
          <button type="button" onClick={pipette} title="Tomar un color de la pantalla" aria-label="Cuentagotas" className="shrink-0 rounded-lg border border-slate-300 px-2.5 py-2 text-sm hover:bg-slate-50">
            💧
          </button>
        )}
      </div>
    </div>
  );
}
