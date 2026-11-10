"use client";

import { useState } from "react";
import { contrastRatio } from "@/lib/color";
import ColorPicker from "./ColorPicker";

/** Fila de color: muestra el color y su código; al pulsar se abre el selector. */
export default function ColorField({
  label, hint, value, onChange, against, actions, onRename,
}: {
  label: string; hint?: string; onRename?: (name: string) => void; value: string; onChange: (hex: string) => void;
  against?: { hex: string; label: string }; actions?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ratio = against ? contrastRatio(value, against.hex) : null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center gap-3 p-3">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={`${label}: ${value}. ${open ? "Cerrar" : "Editar"} color`}
          className="h-10 w-10 shrink-0 rounded-lg border border-slate-300 shadow-inner outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
          style={{ background: value }}
        />
        <div className="min-w-0 flex-1">
          {onRename ? (
            <input
              value={label}
              onChange={(e) => onRename(e.target.value)}
              maxLength={40}
              aria-label="Nombre del color"
              className="w-full rounded border border-transparent px-1 py-0.5 text-sm font-semibold text-slate-900 outline-none hover:border-slate-200 focus:border-emerald-600"
            />
          ) : (
            <p className="truncate text-sm font-semibold text-slate-900">{label}</p>
          )}
          {hint && <p className="truncate text-xs text-slate-500">{hint}</p>}
        </div>
        {ratio !== null && against && (
          <span
            title={`Contraste con ${against.label}: ${ratio.toFixed(1)}:1 (mínimo recomendado 4.5:1)`}
            className={`hidden shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold sm:inline ${ratio >= 4.5 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}
          >
            {ratio >= 4.5 ? "✓" : "⚠"} {ratio.toFixed(1)}:1
          </span>
        )}
        <code className="shrink-0 rounded bg-slate-100 px-2 py-1 font-mono text-xs text-slate-700">{value}</code>
        {actions}
      </div>
      {open && (
        <div className="border-t border-slate-100 p-3">
          <ColorPicker value={value} onChange={onChange} label={label} />
        </div>
      )}
    </div>
  );
}
