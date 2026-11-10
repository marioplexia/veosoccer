"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { dbError } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { btnDanger, btnGhost, btnPrimary, Card, Empty, ErrorMsg, inputCls } from "@/components/ui";
import type { BoardData } from "./Board";

export default function DivisionsTab({ tournament, divisions, teams, fixtures }: BoardData) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const position = divisions.length ? Math.max(...divisions.map((d) => d.position)) + 1 : 0;
    const { error } = await createClient().from("divisions").insert({ tournament_id: tournament.id, name: name.trim(), position });
    setBusy(false);
    if (error) return setError(dbError(error));
    setName("");
    router.refresh();
  }

  async function rename(id: string) {
    setError(null);
    setBusy(true);
    const { error } = await createClient().from("divisions").update({ name: draft.trim() }).eq("id", id);
    setBusy(false);
    if (error) return setError(dbError(error));
    setEditing(null);
    router.refresh();
  }

  async function remove(id: string, label: string) {
    const t = teams.filter((x) => x.division_id === id).length;
    const f = fixtures.filter((x) => x.division_id === id).length;
    if (!window.confirm(`¿Eliminar la división "${label}"? Se borrarán sus ${t} equipos y ${f} partidos, con sus marcadores y goles.`)) return;
    setError(null);
    setBusy(true);
    const { error } = await createClient().from("divisions").delete().eq("id", id);
    setBusy(false);
    if (error) return setError(dbError(error));
    router.refresh();
  }

  return (
    <Card title={`Divisiones (${divisions.length})`}>
      <p className="mb-4 text-sm text-slate-600">
        Cada división tiene sus propios equipos, calendario y tabla de posiciones. Las canchas se comparten entre todas.
      </p>
      <form onSubmit={add} className="mb-4 flex gap-3">
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre de la división (ej. Segundas)" required maxLength={120} aria-label="Nombre de la división" />
        <button disabled={busy} className={btnPrimary}>Agregar</button>
      </form>
      <ErrorMsg message={error} />
      {divisions.length === 0 ? (
        <Empty>Aún no hay divisiones. Crea la primera para poder agregar equipos.</Empty>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100">
          {divisions.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              {editing === d.id ? (
                <form onSubmit={(e) => { e.preventDefault(); rename(d.id); }} className="flex flex-1 gap-2">
                  <input className={inputCls} value={draft} onChange={(e) => setDraft(e.target.value)} required maxLength={120} autoFocus aria-label="Nuevo nombre" />
                  <button disabled={busy} className={btnPrimary}>Guardar</button>
                  <button type="button" onClick={() => setEditing(null)} className={btnGhost}>Cancelar</button>
                </form>
              ) : (
                <>
                  <div>
                    <p className="font-medium text-slate-900">{d.name}</p>
                    <p className="text-xs text-slate-500">
                      {teams.filter((t) => t.division_id === d.id).length} equipos · {fixtures.filter((f) => f.division_id === d.id).length} partidos
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setEditing(d.id); setDraft(d.name); }} className={btnGhost}>Renombrar</button>
                    <button onClick={() => remove(d.id, d.name)} disabled={busy} className={btnDanger}>Eliminar</button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
