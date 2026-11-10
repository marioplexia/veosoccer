"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { dbError } from "@/lib/format";
import { type Extraction, normName } from "@/lib/extract";
import { buildImportFixtures, type ImportFixtureRow } from "@/lib/import-plan";
import { generateMultiSchedule } from "@/lib/scheduler";
import { createClient } from "@/lib/supabase/client";
import { btnGhost, btnPrimary, Card, ErrorMsg, inputCls } from "@/components/ui";
import type { BoardData } from "./Board";

const MAX_BYTES = 5 * 1024 * 1024;

type Summary = { divisions: number; teams: number; fixtures: number; duplicates: number; unresolved: number; scheduled: number };

export default function ImportTab({ tournament, divisions, teams, venues, fixtures, onDone }: BoardData & { onDone: () => void }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [data, setData] = useState<Extraction | null>(null);
  const [auto, setAuto] = useState(true);
  const [startDate, setStartDate] = useState(tournament.start_date ?? new Date().toISOString().slice(0, 10));
  const [defaultRound, setDefaultRound] = useState(fixtures.length ? Math.max(...fixtures.map((f) => f.round)) + 1 : 1);
  const [busy, setBusy] = useState<"read" | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);

  function pick(f: File | null) {
    setError(null);
    setData(null);
    setSummary(null);
    if (preview) URL.revokeObjectURL(preview);
    if (!f) { setFile(null); setPreview(null); return; }
    if (f.size > MAX_BYTES) { setError("La imagen supera los 5 MB."); setFile(null); setPreview(null); return; }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function analyze() {
    if (!file) return;
    setError(null);
    setSummary(null);
    setBusy("read");
    try {
      const body = new FormData();
      body.set("imagen", file);
      const res = await fetch(`/api/torneos/${tournament.id}/importar`, { method: "POST", body });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "No se pudo analizar la imagen.");
      const ex = json.extraction as Extraction;
      setData(ex);
      const rounds = ex.divisions.flatMap((d) => d.fixtures.map((f) => f.round)).filter((r): r is number => r != null);
      if (rounds.length === 0 && fixtures.length) setDefaultRound(Math.max(...fixtures.map((f) => f.round)) + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo analizar la imagen.");
    } finally {
      setBusy(null);
    }
  }

  const patchDivision = (i: number, fn: (d: Extraction["divisions"][number]) => Extraction["divisions"][number]) =>
    setData((d) => (d ? { ...d, divisions: d.divisions.map((x, j) => (j === i ? fn(x) : x)) } : d));
  const removeDivision = (i: number) => setData((d) => (d ? { ...d, divisions: d.divisions.filter((_, j) => j !== i) } : d));
  const removeVenue = (i: number) => setData((d) => (d ? { ...d, venues: d.venues.filter((_, j) => j !== i) } : d));

  // Divisiones sin partidos (ni en la imagen ni ya guardados) con 2+ equipos: se les puede generar calendario.
  const autoCandidates = (data?.divisions ?? []).filter((d) => {
    if (d.fixtures.length > 0) return false;
    const existing = divisions.find((x) => normName(x.name) === normName(d.name));
    const haveFixtures = existing ? fixtures.some((f) => f.division_id === existing.id) : false;
    const haveTeams = existing ? teams.filter((t) => t.division_id === existing.id).map((t) => normName(t.name)) : [];
    const all = new Set([...haveTeams, ...d.teams.map(normName)]);
    return !haveFixtures && all.size >= 2;
  });

  async function apply() {
    if (!data) return;
    setError(null);
    setBusy("save");
    const supabase = createClient();
    const tid = tournament.id;
    try {
      // 1. Divisiones nuevas.
      const haveDivs = new Set(divisions.map((d) => normName(d.name)));
      const newDivs = data.divisions.filter((d) => !haveDivs.has(normName(d.name)));
      if (newDivs.length) {
        const start = divisions.length ? Math.max(...divisions.map((d) => d.position)) + 1 : 0;
        const { error } = await supabase.from("divisions").insert(newDivs.map((d, i) => ({ tournament_id: tid, name: d.name, position: start + i })));
        if (error) throw error;
      }
      const divRes = await supabase.from("divisions").select("id, name").eq("tournament_id", tid);
      if (divRes.error) throw divRes.error;
      const divId = new Map((divRes.data ?? []).map((d) => [normName(d.name), d.id]));

      // 2. Canchas nuevas (se comparten entre divisiones).
      const haveVenues = new Set(venues.map((v) => normName(v.name)));
      const newVenues = data.venues.filter((n) => !haveVenues.has(normName(n)));
      if (newVenues.length) {
        const { error } = await supabase.from("venues").insert(newVenues.map((name) => ({ tournament_id: tid, name })));
        if (error) throw error;
      }

      // 3. Equipos nuevos, por división (el mismo nombre puede existir en varias).
      const teamRows: { tournament_id: string; division_id: string; name: string }[] = [];
      for (const d of data.divisions) {
        const id = divId.get(normName(d.name));
        if (!id) continue;
        const have = new Set(teams.filter((t) => t.division_id === id).map((t) => normName(t.name)));
        for (const name of d.teams) if (!have.has(normName(name))) teamRows.push({ tournament_id: tid, division_id: id, name });
      }
      if (teamRows.length) {
        const { error } = await supabase.from("tournament_teams").insert(teamRows);
        if (error) throw error;
      }

      // 4. Releer ids reales.
      const [t, v] = await Promise.all([
        supabase.from("tournament_teams").select("id, name, division_id").eq("tournament_id", tid),
        supabase.from("venues").select("id, name").eq("tournament_id", tid),
      ]);
      if (t.error) throw t.error;
      if (v.error) throw v.error;
      const teamId = new Map((t.data ?? []).map((x) => [`${x.division_id}|${normName(x.name)}`, x.id]));
      const venueId = new Map((v.data ?? []).map((x) => [normName(x.name), x.id]));

      // 5. Partidos de la imagen: se AGREGAN (no se borra nada) y se omiten los que ya existen.
      const built = buildImportFixtures({
        tournamentId: tid, divisions: data.divisions, divisionIds: divId, teamIds: teamId, venueIds: venueId,
        existing: fixtures, defaultRound,
      });
      const rows: ImportFixtureRow[] = built.rows;
      const { duplicates, unresolved } = built;

      // 6. Divisiones sin partidos: calendario automático repartido entre las canchas.
      let scheduled = 0;
      if (auto) {
        const inputs = autoCandidates.flatMap((d) => {
          const id = divId.get(normName(d.name));
          if (!id) return [];
          const ids = (t.data ?? []).filter((x) => x.division_id === id).map((x) => x.id);
          return ids.length >= 2 ? [{ id, teamIds: ids }] : [];
        });
        if (inputs.length) {
          const plan = generateMultiSchedule(inputs, [...venueId.values()], {
            startDate, firstKickoff: "09:00", slotMinutes: 90, daysBetweenRounds: 7, doubleRound: false,
          });
          scheduled = plan.length;
          for (const p of plan) {
            rows.push({
              tournament_id: tid, division_id: p.divisionId, round: p.round, home_team_id: p.homeId, away_team_id: p.awayId,
              venue_id: p.venueId, kickoff: p.kickoff, note: null,
            });
          }
        }
      }

      for (let i = 0; i < rows.length; i += 200) {
        const { error } = await supabase.from("fixtures").insert(rows.slice(i, i + 200));
        if (error) throw error;
      }

      setSummary({ divisions: newDivs.length, teams: teamRows.length, fixtures: rows.length, duplicates, unresolved, scheduled });
      setData(null);
      router.refresh();
    } catch (e) {
      setError(dbError(e as { code?: string; message: string }));
    } finally {
      setBusy(null);
    }
  }

  const totalFixtures = data?.divisions.reduce((s, d) => s + d.fixtures.length, 0) ?? 0;
  const totalTeams = data?.divisions.reduce((s, d) => s + d.teams.length, 0) ?? 0;

  return (
    <div className="space-y-6">
      <Card title="Sube una imagen de tu torneo o liga">
        <p className="mb-4 text-sm text-slate-600">
          Un rol de juegos, una planilla, un cartel o una captura de WhatsApp. La IA detecta las divisiones, los equipos, las canchas y los partidos de la jornada; tú revisas antes de guardar nada. Los partidos se <strong>agregan</strong> al calendario: no se borra lo que ya tienes.
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

      {summary && (
        <Card title="Importación lista">
          <ul className="space-y-1 text-sm text-slate-700">
            <li>✔ {summary.fixtures} partidos agregados{summary.scheduled ? ` (${summary.scheduled} generados automáticamente)` : ""}</li>
            <li>✔ {summary.divisions} divisiones nuevas · {summary.teams} equipos nuevos</li>
            {summary.duplicates > 0 && <li className="text-slate-500">{summary.duplicates} partidos ya existían y se omitieron</li>}
            {summary.unresolved > 0 && <li className="text-amber-700">⚠ {summary.unresolved} partidos no se pudieron asociar a sus equipos y se omitieron</li>}
          </ul>
          <div className="mt-4 flex gap-3">
            <button onClick={onDone} className={btnPrimary}>Ver calendario</button>
            <button onClick={() => pick(null)} className={btnGhost}>Importar otra imagen</button>
          </div>
        </Card>
      )}

      {data && (
        <Card title="Revisa lo que encontró la IA">
          {data.notes && <p className="mb-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">{data.notes}</p>}

          <ChipList title={`Canchas (${data.venues.length})`} items={data.venues} existing={new Set(venues.map((v) => normName(v.name)))} onRemove={removeVenue} />

          {data.divisions.length === 0 && <p className="mt-4 text-sm text-slate-500">No se encontraron divisiones, equipos ni partidos.</p>}

          <div className="mt-6 space-y-5">
            {data.divisions.map((d, i) => {
              const existing = divisions.find((x) => normName(x.name) === normName(d.name));
              const haveTeams = new Set(teams.filter((t) => t.division_id === existing?.id).map((t) => normName(t.name)));
              return (
                <section key={`${d.name}-${i}`} className="rounded-xl border border-slate-200 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="font-semibold text-slate-900">
                      {d.name} <span className="text-xs font-normal text-slate-500">{existing ? "(ya existe)" : "(nueva)"}</span>
                    </h3>
                    <button onClick={() => removeDivision(i)} className="text-sm text-slate-400 hover:text-red-600">Quitar división</button>
                  </div>
                  <ChipList title={`Equipos (${d.teams.length})`} items={d.teams} existing={haveTeams} onRemove={(j) => patchDivision(i, (x) => ({ ...x, teams: x.teams.filter((_, k) => k !== j) }))} />
                  {d.fixtures.length > 0 && (
                    <div className="mt-4">
                      <h4 className="mb-2 text-sm font-semibold text-slate-900">Partidos ({d.fixtures.length})</h4>
                      <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
                        {d.fixtures.map((f, j) => (
                          <li key={j} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                            <span>
                              <strong>{f.home}</strong> vs <strong>{f.away}</strong>
                              <span className="text-slate-500">
                                {f.round ? ` · J${f.round}` : ""}{f.venue ? ` · ${f.venue}` : ""}{f.date ? ` · ${f.date}` : ""}{f.time ? ` ${f.time}` : ""}
                              </span>
                              {f.note && <span className="ml-1 font-medium text-amber-700">· {f.note}</span>}
                            </span>
                            <button onClick={() => patchDivision(i, (x) => ({ ...x, fixtures: x.fixtures.filter((_, k) => k !== j) }))} className="text-slate-400 hover:text-red-600" aria-label="Quitar partido">✕</button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </section>
              );
            })}
          </div>

          {totalFixtures > 0 && (
            <label className="mt-5 block max-w-xs text-sm font-medium text-slate-700">
              Jornada para los partidos que no indican una
              <input type="number" min={1} className={`${inputCls} mt-1`} value={defaultRound} onChange={(e) => setDefaultRound(Math.max(1, Number(e.target.value) || 1))} />
              <span className="mt-1 block text-xs font-normal text-slate-500">Los partidos sin hora se guardan a las 00:00 y se muestran sin hora.</span>
            </label>
          )}

          {autoCandidates.length > 0 && (
            <div className="mt-5 rounded-xl border border-slate-200 p-4">
              <label className="flex items-start gap-2 text-sm text-slate-700">
                <input type="checkbox" className="mt-0.5" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
                <span>
                  <strong>Distribuir automáticamente en el tablero.</strong>{" "}
                  {autoCandidates.map((d) => d.name).join(", ")} no trae{autoCandidates.length > 1 ? "n" : ""} partidos: genero un todos contra todos y lo reparto entre las canchas y horarios, sin choques entre divisiones.
                </span>
              </label>
              {auto && (
                <label className="mt-3 block max-w-xs text-sm font-medium text-slate-700">Primera jornada
                  <input type="date" className={`${inputCls} mt-1`} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </label>
              )}
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button onClick={apply} disabled={busy !== null || (totalFixtures === 0 && totalTeams === 0 && data.venues.length === 0)} className={btnPrimary}>
              {busy === "save" ? "Guardando…" : `Guardar en el torneo`}
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
      <h4 className="mb-2 text-sm font-semibold text-slate-900">{title}</h4>
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
