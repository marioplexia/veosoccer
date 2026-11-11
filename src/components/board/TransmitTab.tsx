"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { dbError, formatKickoff } from "@/lib/format";
import { ACCEPTED_IMAGES, mediaUrl, prepareImage, removeMedia, uploadMedia } from "@/lib/media";
import { createClient } from "@/lib/supabase/client";
import { btnDanger, btnGhost, btnPrimary, Card, Empty, ErrorMsg, inputCls } from "@/components/ui";
import type { BoardData } from "./Board";
import BroadcastSimulator from "@/components/live/BroadcastSimulator";
import { sanitizeBrand } from "@/lib/brand";

export default function TransmitTab({ tournament, divisions, teams, fixtures, players, sponsors, broadcastSettings, brands }: BoardData) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [server, setServer] = useState(broadcastSettings.rtmp_url);
  const [key, setKey] = useState("");
  const [every, setEvery] = useState(broadcastSettings.ad_every_minutes);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [spName, setSpName] = useState("");
  const [spFile, setSpFile] = useState<File | null>(null);

  const name = (id: string) => teams.find((t) => t.id === id)?.name ?? "?";
  const divName = (id: string) => divisions.find((d) => d.id === id)?.name ?? "";
  const pending = fixtures.filter((f) => f.home_score == null).sort((a, b) => (a.kickoff ?? "9999").localeCompare(b.kickoff ?? "9999") || a.round - b.round);
  const played = fixtures.filter((f) => f.home_score != null);

  async function run(fn: () => Promise<void>) {
    setError(null); setSaved(null); setBusy(true);
    try { await fn(); router.refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Algo salió mal."); } finally { setBusy(false); }
  }

  const saveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      const row: Record<string, unknown> = { tournament_id: tournament.id, rtmp_url: server.trim(), ad_every_minutes: every };
      if (key.trim()) row.stream_key = key.trim();
      const { error } = await supabase.from("broadcast_settings").upsert(row, { onConflict: "tournament_id" });
      if (error) throw new Error(error.code === "23514" ? "La URL o la clave no tienen un formato válido." : dbError(error));
      setKey("");
      setSaved("Configuración guardada.");
    });
  };

  const addSponsor = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      let path: string | null = null;
      if (spFile) path = await uploadMedia(supabase, tournament.id, "sponsor", await prepareImage(spFile, "crest"));
      const { error } = await supabase.from("sponsors").insert({ tournament_id: tournament.id, name: spName.trim(), image_path: path });
      if (error) { await removeMedia(supabase, path); throw new Error(dbError(error)); }
      setSpName(""); setSpFile(null);
    });
  };

  const removeSponsor = (id: string, path: string | null) => run(async () => {
    const { error } = await supabase.from("sponsors").delete().eq("id", id);
    if (error) throw new Error(dbError(error));
    await removeMedia(supabase, path);
  });

  const row = (f: (typeof fixtures)[number]) => (
    <li key={f.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div>
        <p className="font-semibold text-slate-900">{name(f.home_team_id)} vs {name(f.away_team_id)}</p>
        <p className="text-xs text-slate-500">{divisions.length > 1 ? `${divName(f.division_id)} · ` : ""}Jornada {f.round} · {formatKickoff(f.kickoff)}{f.home_score != null ? ` · ${f.home_score}-${f.away_score}` : ""}</p>
      </div>
      <Link href={`/panel/torneos/${tournament.id}/transmitir/${f.id}`} className={btnPrimary}>Iniciar ▶</Link>
    </li>
  );

  return (
    <div className="space-y-6">
      <Card title="1. Elige el partido">
        <p className="mb-3 text-sm text-slate-600">
          Abre esta pestaña en el celular que grabará el partido, elige el partido y pulsa <strong>Iniciar</strong>. El director automático pone el marcador, las alineaciones, los anuncios y las animaciones; tú solo tocas <strong>GOL</strong> cuando haya uno.
        </p>
        {pending.length === 0 && played.length === 0 ? <Empty>Aún no hay partidos en el calendario.</Empty> : (
          <>
            {pending.length > 0 && <ul className="divide-y divide-slate-100">{pending.map(row)}</ul>}
            {played.length > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-medium text-slate-600">Partidos ya jugados ({played.length})</summary>
                <ul className="divide-y divide-slate-100">{played.map(row)}</ul>
              </details>
            )}
          </>
        )}
      </Card>

      <Card title="Simulador de la transmisión">
        <BroadcastSimulator
          tournamentName={tournament.name}
          brand={sanitizeBrand("broadcast", brands.find((b) => b.kind === "broadcast")?.settings)}
          brandLogoPath={brands.find((b) => b.kind === "broadcast")?.logo_path ?? null}
          teams={teams} fixtures={fixtures} players={players} sponsors={sponsors} adEveryMinutes={broadcastSettings.ad_every_minutes}
        />
      </Card>

      <Card title="2. Facebook (una sola vez)">
        <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm text-slate-600">
          <li>En Facebook, entra a <strong>Live Producer</strong> (Crear video en vivo) desde tu página.</li>
          <li>Elige <strong>Software de transmisión</strong> y activa <strong>clave de transmisión persistente</strong>.</li>
          <li>Copia la <strong>URL del servidor</strong> y la <strong>clave de transmisión</strong> y pégalas aquí.</li>
        </ol>
        <form onSubmit={saveSettings} className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium text-slate-700 sm:col-span-2">URL del servidor
            <input className={`${inputCls} mt-1 font-mono`} value={server} onChange={(e) => setServer(e.target.value)} required />
          </label>
          <label className="text-sm font-medium text-slate-700">Clave de transmisión
            <input className={`${inputCls} mt-1 font-mono`} type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)}
              placeholder={broadcastSettings.key_hint ? `Guardada (${broadcastSettings.key_hint}); escribe otra para cambiarla` : "FB-…"} />
          </label>
          <label className="text-sm font-medium text-slate-700">Anuncio de patrocinador cada (min)
            <input className={`${inputCls} mt-1`} type="number" min={2} max={45} value={every} onChange={(e) => setEvery(Math.min(45, Math.max(2, Number(e.target.value) || 8)))} />
          </label>
          <div className="flex items-center gap-3 sm:col-span-2">
            <button disabled={busy} className={btnPrimary}>Guardar</button>
            {saved && <span className="text-sm text-emerald-700">{saved}</span>}
            {!broadcastSettings.key_hint && <span className="text-sm text-amber-700">Falta la clave de transmisión.</span>}
          </div>
        </form>
        <p className="mt-3 text-xs text-slate-500">La clave es secreta: solo la usa el servidor para enviar el video a Facebook y aquí solo se muestran sus últimos 4 caracteres.</p>
      </Card>

      <Card title={`3. Patrocinadores (${sponsors.length})`}>
        <p className="mb-3 text-sm text-slate-600">Sus logos aparecen durante el partido en la esquina inferior derecha, por turnos.</p>
        <form onSubmit={addSponsor} className="flex flex-wrap items-center gap-2">
          <input className={`${inputCls} min-w-[12rem] flex-1`} value={spName} onChange={(e) => setSpName(e.target.value)} placeholder="Nombre del patrocinador" required maxLength={60} aria-label="Nombre del patrocinador" />
          <label className={`${btnGhost} cursor-pointer`}>
            {spFile ? `✓ ${spFile.name.slice(0, 16)}` : "Logo"}
            <input type="file" accept={ACCEPTED_IMAGES.join(",")} className="sr-only" onChange={(e) => setSpFile(e.target.files?.[0] ?? null)} />
          </label>
          <button disabled={busy} className={btnPrimary}>Agregar</button>
        </form>
        <ErrorMsg message={error} />
        {sponsors.length > 0 && (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {sponsors.map((s) => {
              const url = mediaUrl(supabase, s.image_path);
              return (
                <li key={s.id} className="flex items-center gap-3 rounded-lg p-2 ring-1 ring-slate-200">
                  <span className="flex h-10 w-16 items-center justify-center overflow-hidden rounded bg-slate-50">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {url ? <img src={url} alt={`Logo de ${s.name}`} className="h-full w-full object-contain" /> : <span className="text-[10px] text-slate-400">Sin logo</span>}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{s.name}</span>
                  <button onClick={() => removeSponsor(s.id, s.image_path)} disabled={busy} className={btnDanger}>Quitar</button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
