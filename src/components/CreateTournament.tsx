"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { dbError } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { btnPrimary, ErrorMsg, inputCls } from "@/components/ui";

export default function CreateTournament() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { data, error } = await createClient()
      .from("tournaments")
      .insert({ name: name.trim(), start_date: startDate || null })
      .select("id")
      .single();
    setBusy(false);
    if (error) return setError(dbError(error));
    router.push(`/panel/torneos/${data.id}`);
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
      <label className="block text-sm font-medium text-slate-700">
        Nombre del torneo
        <input className={`${inputCls} mt-1`} value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Inicio (opcional)
        <input type="date" className={`${inputCls} mt-1`} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
      </label>
      <button disabled={busy} className={btnPrimary}>{busy ? "Creando…" : "Crear torneo"}</button>
      <div className="sm:col-span-3"><ErrorMsg message={error} /></div>
    </form>
  );
}
