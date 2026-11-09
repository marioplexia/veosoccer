"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { dbError } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { btnDanger, btnPrimary, Card, Empty, ErrorMsg, inputCls } from "@/components/ui";

type Props = {
  kind: "team" | "venue";
  table: "tournament_teams" | "venues";
  title: string;
  tournamentId: string;
  items: { id: string; name: string }[];
  placeholder: string;
};

export default function ListTab({ kind, table, title, tournamentId, items, placeholder }: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error } = await createClient().from(table).insert({ tournament_id: tournamentId, name: name.trim() });
    setBusy(false);
    if (error) return setError(dbError(error));
    setName("");
    router.refresh();
  }

  async function remove(item: { id: string; name: string }) {
    const warning =
      kind === "team"
        ? `¿Eliminar "${item.name}"? También se borrarán sus partidos y goles.`
        : `¿Eliminar la cancha "${item.name}"? Sus partidos quedarán sin cancha asignada.`;
    if (!window.confirm(warning)) return;
    setError(null);
    setBusy(true);
    const supabase = createClient();
    if (kind === "venue") await supabase.from("fixtures").update({ venue_id: null }).eq("venue_id", item.id);
    const { error } = await supabase.from(table).delete().eq("id", item.id);
    setBusy(false);
    if (error) return setError(dbError(error));
    router.refresh();
  }

  return (
    <Card title={`${title} (${items.length})`}>
      <form onSubmit={add} className="mb-4 flex gap-3">
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder={placeholder} required maxLength={120} aria-label={placeholder} />
        <button disabled={busy} className={btnPrimary}>Agregar</button>
      </form>
      <ErrorMsg message={error} />
      {items.length === 0 ? (
        <Empty>{kind === "team" ? "Aún no hay equipos. Agrégalos aquí o impórtalos desde una imagen." : "Aún no hay canchas. Agrégalas aquí o impórtalas desde una imagen."}</Empty>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100">
          {items.map((i) => (
            <li key={i.id} className="flex items-center justify-between py-2.5">
              <span className="font-medium text-slate-900">{i.name}</span>
              <button onClick={() => remove(i)} disabled={busy} className={btnDanger}>Eliminar</button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
