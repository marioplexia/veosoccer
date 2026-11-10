"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { dbError } from "@/lib/format";
import { normName } from "@/lib/extract";
import { createClient } from "@/lib/supabase/client";
import { btnPrimary, ErrorMsg, inputCls } from "@/components/ui";

/** "Reservas Premier, Segundas\nTerceras" -> ["Reservas Premier", "Segundas", "Terceras"] (sin repetidos, máx. 20). */
export function parseDivisionNames(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of text.split(/[,\n;]/)) {
    const name = part.replace(/\s+/g, " ").trim().slice(0, 120);
    const key = normName(name);
    if (name && !seen.has(key)) { seen.add(key); out.push(name); }
  }
  return out.slice(0, 20);
}

export default function CreateTournament() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [divisions, setDivisions] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("tournaments")
      .insert({ name: name.trim(), start_date: startDate || null })
      .select("id")
      .single();
    if (error) { setBusy(false); return setError(dbError(error)); }

    const names = parseDivisionNames(divisions);
    const rows = (names.length ? names : ["General"]).map((n, i) => ({ tournament_id: data.id, name: n, position: i }));
    const { error: divError } = await supabase.from("divisions").insert(rows);
    setBusy(false);
    if (divError) setError(`El torneo se creó, pero no las divisiones: ${dbError(divError)}`);
    router.push(`/panel/torneos/${data.id}`);
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
      <label className="block text-sm font-medium text-slate-700">
        Nombre del torneo o liga
        <input className={`${inputCls} mt-1`} value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Inicio (opcional)
        <input type="date" className={`${inputCls} mt-1`} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
      </label>
      <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
        Divisiones o categorías (opcional)
        <input
          className={`${inputCls} mt-1`}
          value={divisions}
          onChange={(e) => setDivisions(e.target.value)}
          placeholder="Reservas Premier, Segundas, Terceras"
        />
        <span className="mt-1 block text-xs text-slate-500">Sepáralas con comas. Si lo dejas vacío, se crea una división “General”. Podrás agregar más después.</span>
      </label>
      <div className="sm:col-span-2"><button disabled={busy} className={btnPrimary}>{busy ? "Creando…" : "Crear torneo"}</button></div>
      <div className="sm:col-span-2"><ErrorMsg message={error} /></div>
    </form>
  );
}
