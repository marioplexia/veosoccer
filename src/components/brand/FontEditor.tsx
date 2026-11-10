"use client";

import { useState } from "react";
import { FONT_BY_FAMILY, FONTS, WEIGHT_NAMES, nearestWeight } from "@/lib/fonts";
import { FONT_SLOTS, type BrandSettings, type FontSlot, type FontSpec } from "@/lib/brand";
import { inputCls } from "@/components/ui";
import { fontStyle } from "./useGoogleFonts";

const CATEGORY: Record<string, string> = { sans: "Sans serif", condensed: "Condensadas", display: "Display", serif: "Serif" };

export default function FontEditor({ fonts, onChange }: { fonts: BrandSettings["fonts"]; onChange: (slot: FontSlot, f: FontSpec) => void }) {
  const [size, setSize] = useState(44);
  const [specimenSlot, setSpecimenSlot] = useState<FontSlot>("heading");
  const [specimenItalic, setSpecimenItalic] = useState(false);

  const spec = fonts[specimenSlot];
  const def = FONT_BY_FAMILY.get(spec.family)!;
  // Cuatro pesos representativos de la familia elegida (los más cercanos a Light, Regular, Bold y Heavy).
  const specimenWeights = [...new Set([300, 400, 700, 900].map((w) => nearestWeight(spec.family, w)))];

  return (
    <div className="space-y-4">
      {FONT_SLOTS.map((s) => {
        const f = fonts[s.key];
        const d = FONT_BY_FAMILY.get(f.family)!;
        return (
          <div key={s.key} className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <p className="text-sm font-semibold text-slate-900">{s.label}</p>
              <p className="truncate text-xs text-slate-500">{s.hint}</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-[1.4fr_1fr_auto]">
              <select
                aria-label={`Tipografía de ${s.label}`}
                className={inputCls}
                value={f.family}
                onChange={(e) => {
                  const family = e.target.value;
                  const nd = FONT_BY_FAMILY.get(family)!;
                  onChange(s.key, { family, weight: nearestWeight(family, f.weight), italic: nd.italic && f.italic });
                }}
              >
                {(Object.keys(CATEGORY) as (keyof typeof CATEGORY)[]).map((cat) => (
                  <optgroup key={cat} label={CATEGORY[cat]}>
                    {FONTS.filter((x) => x.category === cat).map((x) => <option key={x.family} value={x.family}>{x.family}</option>)}
                  </optgroup>
                ))}
              </select>
              <select aria-label={`Peso de ${s.label}`} className={inputCls} value={f.weight} onChange={(e) => onChange(s.key, { ...f, weight: Number(e.target.value) })}>
                {d.weights.map((w) => <option key={w} value={w}>{WEIGHT_NAMES[w]} ({w})</option>)}
              </select>
              <label className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${d.italic ? "border-slate-300 text-slate-700" : "border-slate-200 text-slate-400"}`}>
                <input type="checkbox" disabled={!d.italic} checked={f.italic} onChange={(e) => onChange(s.key, { ...f, italic: e.target.checked })} />
                Cursiva
              </label>
            </div>
            <p className="mt-3 truncate text-2xl text-slate-900" style={fontStyle(f)}>
              {s.key === "numbers" ? "4-1  92:41  0123456789" : s.key === "heading" ? "Gran Final del Torneo" : "Resultados y calendario de la jornada"}
            </p>
          </div>
        );
      })}

      <div className="rounded-xl bg-slate-900 p-4 text-white">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-1" role="group" aria-label="Tipografía de la muestra">
            {FONT_SLOTS.map((s) => (
              <button key={s.key} onClick={() => setSpecimenSlot(s.key)} aria-pressed={specimenSlot === s.key}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${specimenSlot === s.key ? "bg-white text-slate-900" : "text-slate-300 hover:bg-white/10"}`}>
                {s.label}
              </button>
            ))}
          </div>
          <div className="flex gap-1 rounded-full bg-white/10 p-0.5" role="group" aria-label="Estilo">
            {[false, true].map((it) => (
              <button key={String(it)} disabled={it && !def.italic} onClick={() => setSpecimenItalic(it)} aria-pressed={specimenItalic === it}
                className={`rounded-full px-3 py-1 text-xs font-semibold disabled:opacity-40 ${specimenItalic === it ? "bg-violet-500 text-white" : "text-slate-300"}`}>
                {it ? "Italic" : "Regular"}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1 overflow-hidden text-center">
          {specimenWeights.map((w) => (
            <p key={w} className="truncate leading-tight" style={{ ...fontStyle({ family: spec.family, weight: w, italic: specimenItalic && def.italic }), fontSize: size }}>
              {spec.family} {WEIGHT_NAMES[w]}
            </p>
          ))}
        </div>
        <label className="mt-4 flex items-center gap-3 text-xs text-slate-300">
          <span className="w-12 shrink-0">{size} pt</span>
          <input type="range" min={16} max={96} value={size} onChange={(e) => setSize(Number(e.target.value))} aria-label="Tamaño de la muestra" className="w-full accent-violet-400" />
        </label>
      </div>
    </div>
  );
}
