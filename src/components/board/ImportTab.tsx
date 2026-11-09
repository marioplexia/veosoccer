"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { dbError } from "@/lib/format";
import { type Extraction, normName } from "@/lib/extract";
import { generateSchedule } from "@/lib/scheduler";
import { createClient } from "@/lib/supabase/client";
import { btnGhost, btnPrimary, Card, ErrorMsg, inputCls } from "@/components/ui";
import type { BoardData } from "./Board";

const MAX_BYTES = 5 * 1024 * 1024;

export default function ImportTab({ tournament, teams, venues, fixtures, onDone }: BoardData & { onDone: () => void }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [data, setData] = useState<Extraction | null>(null);
  const [auto, setAuto] = useState(true);
  const [startDate, setStartDate] = useState(tournament.start_date ?? new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState<"read" | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);

  function pick(f: File | null) {
    setError(null);
    setData(null);
    if (preview) URL.revokeObjectURL(preview);
    if (!f) { setFile(null); setPreview(null); return; }
    if (f.size > MAX_BYTES) { setError("La imagen supera los 5 MB."); setFile(null); setPreview(null); return; }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function analyze() {
    if (!file) return;
    setError(null);
    setBusy("read");
    try {
      const body = new FormData();
      body.set("imagen", file);
      const res = await fetch(`/api/torneos/${tournament.id}/importar`, { method: "POST", body });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "No se pudo analizar la imagen.");
      setData(json.extraction as Extraction);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo analizar la imagen.");
    } finally {
      setBusy(null);
    }
  }

  const removeAt = (key: "teams" | "venues", i: number) =>
    setData((d) => (d ? { ...d, [key]: d[key].filter((_, j) => j !== i) } : d));
  const removeFixture = (i: number) => setData((d) => (d ? { ...d, fixtures: d.fixtures.filter((_, j) => j !== i) } : d));

  async function apply() {
    if (!data) return;
    setError(null);
    setBusy("save");
    const supabase = createClient();
    const tid = tournament.id;
    try {
      // 1. Equipos y canchas nuevos (los ya existentes se reutilizan).
      const haveTeams = new Set(teams.map((t) => normName(t.name)));
      const haveVenues = new Set(venues.map((v) => normName(v.name)));
      const newTeams = data.teams.filter((n) => !haveTeams.has(normName(n)));
      const newVenues = data.venues.filter((n) => !haveVenues.has(normName(n)));
      if (newTeams.length) {
        const { error } = await supabase.from("tournament_teams").insert(newTeams.map((name) => ({ tournament_id: tid, name })));
        if (error) throw error;
      }
      if (newVenues.length) {
        const { error } = await supabase.from("venues").insert(newVenues.map((name) => ({ tournament_id: tid, name })));
        if (error) throw error;
      }

      // 2. Releer los ids reales.
      const [t, v] = await Promise.all([
        supabase.from("tournament_teams").select("id, name").eq("tournament_id", tid),
        supabase.from("venues").select("id, name").eq("tournament_id", tid),
      ]);
      if (t.error) throw t.error;
      if (v.error) throw v.error;
      const teamId = new Map((t.data ?? []).map((x) => [normName(x.name), x.id]));
      const venueId = new Map((v.data ?? []).map((x) => [normName(x.name), x.id]));

      // 3. Partidos: los de la imagen, o un calendario automático si no hay.
      let rows: { tournament_id: string; round: number; home_team_id: string; away_team_id: string; venue_id: string | null; kickoff: string | null }[] = [];
      if (data.fixtures.length > 0) {
        rows = data.fixtures.flatMap((f) => {
          const h = teamId.get(normName(f.home));
          const a = teamId.get(normName(f.away));
          if (!h || !a || h === a) return [];
          return [{
            tournament_id: tid, round: f.round ?? 1, home_team_id: h, away_team_id: a,
            venue_id: f.venue ? venueId.get(normName(f.venue)) ?? null : null,
            kickoff: f.date ? `${f.date}T${f.time ?? "09:00"}:00` : null,
          }];
        });
      } else if (auto && (t.data?.length ?? 0) >= 2) {
        rows = generateSchedule([...teamId.values()], [...venueId.values()], {
          startDate, firstKickoff: "09:00", slotMinutes: 90, daysBetweenRounds: 7, doubleRound: false,
        }).map((p) => ({
          tournament_id: tid, round: p.round, home_team_id: p.homeId, away_team_id: p.awayId, venue_id: p.venueId, kickoff: p.kickoff,
        }));
      }
      if (rows.length > 0) {
        if (fixtures.length > 0 && !window.confirm(`Ya hay ${fixtures.length} partidos. ¿Reemplazarlos por los ${rows.length} importados? Se perderán sus marcadores y goles.`)) {
          setBusy(null);
          router.refresh();
          return;
        }
        if (fixtures.length > 0) {
          const { error } = await supabase.from("fixtures").delete().eq("tournament_id", tid);
          if (error) throw error;
        }
        const { error } = await supabase.from("fixtures").insert(rows);
        if (error) throw error;
      }
      router.refresh();
      onDone();
    } catch (e) {
      setError(dbError(e as { code?: string; message: string }));
    } finally {
      setBusy(null);
    }
  }

  const noFixtures = data && data.fixtures.length === 0;

  return (
    <div className="space-y-6">
      <Card title="Sube una imagen de tu torneo">
        <p className="mb-4 text-sm text-slate-600">
          Una foto de la planilla, un cartel, una captura de WhatsApp o una pizarra. La IA lee los equipos, las canchas y los partidos; tú revisas antes de guardar nada.
        </p>
        <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-start">
          <div>
            <input
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={(e) => pick(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-slate-700 file:mr-4 file:rounded-full file:border-0 file:bg-emerald-50 file:px-4 file:py-2 file:font-semibold file:text-emerald-700 hover:file:bg-emerald-100"
              aria-label="Imagen del torneo"
            />
            <p className="mt-2 text-xs text-slate-500">JPG, PNG, GIF o WebP · máximo 5 MB. Se envía a un servicio de IA externo (Anthropic) solo para leerla.</p>
          </div>
          <button onClick={analyze} disabled={!file || busy !== null} className={btnPrimary}>
            {busy === "read" ? "Analizando…" : "Analizar con IA"}
          </button>
        </div>
        {preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Vista previa de la imagen seleccionada" className="mt-4 max-h-72 rounded-xl border border-slate-200 object-contain" />
        )}
        <div className="mt-3"><ErrorMsg message={error} /></div>
      </Card>

      {data && (
        <Card title="Revisa lo que encontró la IA">
          {data.notes && <p className="mb-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">{data.notes}</p>}
          <div className="grid gap-6 md:grid-cols-2">
            <ChipList title={`Equipos (${data.teams.length})`} items={data.teams} existing={new Set(teams.map((t) => normName(t.name)))} onRemove={(i) => removeAt("teams", i)} />
            <ChipList title={`Canchas (${data.venues.length})`} items={data.venues} existing={new Set(venues.map((v) => normName(v.name)))} onRemove={(i) => removeAt("venues", i)} />
          </div>

          {data.fixtures.length > 0 ? (
            <div className="mt-6">
              <h3 className="mb-2 text-sm font-semibold text-slate-900">Partidos ({data.fixtures.length})</h3>
              <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
                {data.fixtures.map((f, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span><strong>{f.home}</strong> vs <strong>{f.away}</strong>
                      <span className="text-slate-500">{f.round ? ` · J${f.round}` : ""}{f.venue ? ` · ${f.venue}` : ""}{f.date ? ` · ${f.date}` : ""}{f.date ? ` ${f.time ?? "09:00"}` : ""}</span>
                    </span>
                    <button onClick={() => removeFixture(i)} className="text-slate-400 hover:text-red-600" aria-label="Quitar partido">✕</button>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-slate-500">Los partidos sin hora se guardan a las 09:00; sin fecha, quedan “Sin fecha”. Puedes editarlos después.</p>
            </div>
          ) : (
            <div className="mt-6 rounded-xl border border-slate-200 p-4">
              <label className="flex items-start gap-2 text-sm text-slate-700">
                <input type="checkbox" className="mt-0.5" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
                <span><strong>Distribuir automáticamente en el tablero.</strong> La imagen no trae partidos: genero un todos contra todos y lo reparto entre las canchas y horarios.</span>
              </label>
              {auto && (
                <label className="mt-3 block max-w-xs text-sm font-medium text-slate-700">Primera jornada
                  <input type="date" className={`${inputCls} mt-1`} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </label>
              )}
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button onClick={apply} disabled={busy !== null || (data.teams.length === 0 && data.venues.length === 0 && data.fixtures.length === 0)} className={btnPrimary}>
              {busy === "save" ? "Guardando…" : noFixtures && auto ? "Guardar y distribuir" : "Guardar en el torneo"}
            </button>
            <button onClick={() => setData(null)} disabled={busy !== null} className={btnGhost}>Descartar</button>
          </div>
        </Card>
      )}
    </div>
  );
}

function ChipList({ title, items, existing, onRemove }: { title: string; items: string[]; existing: Set<string>; onRemove: (i: number) => void }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-slate-900">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-slate-500">No se encontró ninguno.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {items.map((n, i) => (
            <li key={`${n}-${i}`} className="flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-sm text-emerald-900">
              {n}
              {existing.has(normName(n)) && <span className="text-xs text-emerald-700/70">(ya existe)</span>}
              <button onClick={() => onRemove(i)} className="text-emerald-700/60 hover:text-red-600" aria-label={`Quitar ${n}`}>✕</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
