"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { dbError } from "@/lib/format";
import { ACCEPTED_IMAGES, mediaUrl, prepareImage, removeMedia, uploadMedia } from "@/lib/media";
import { autoTeamColors } from "@/lib/motion/scenes";
import { createClient } from "@/lib/supabase/client";
import type { Division, Player, Team } from "@/lib/types";
import { btnDanger, btnGhost, btnPrimary, Card, Empty, ErrorMsg, inputCls } from "@/components/ui";
import type { BoardData } from "./Board";

export default function TeamsTab({ tournament, divisions, teams, players, goTo }: BoardData & { goTo: (t: "divisiones") => void }) {
  if (divisions.length === 0) {
    return (
      <Empty>
        Primero crea al menos una división.{" "}
        <button onClick={() => goTo("divisiones")} className="font-semibold text-emerald-700 hover:underline">Ir a Divisiones</button>
      </Empty>
    );
  }
  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-600">
        Sube el escudo de cada equipo y su plantilla. Se usan solos en el estudio de videos: al elegir un partido aparecen los escudos, y en “Equipo ideal” y “Jugador de la jornada” eliges jugadores de la lista con su foto.
      </p>
      {divisions.map((d) => (
        <DivisionTeams key={d.id} tournamentId={tournament.id} division={d} teams={teams.filter((t) => t.division_id === d.id)} players={players} />
      ))}
    </div>
  );
}

function DivisionTeams({ tournamentId, division, teams, players }: { tournamentId: string; division: Division; teams: Team[]; players: Player[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error } = await createClient().from("tournament_teams").insert({ tournament_id: tournamentId, division_id: division.id, name: name.trim() });
    setBusy(false);
    if (error) return setError(dbError(error));
    setName("");
    router.refresh();
  }

  return (
    <Card title={`${division.name} (${teams.length} equipos)`}>
      <form onSubmit={add} className="mb-3 flex gap-3">
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre del equipo" required maxLength={120} aria-label={`Nuevo equipo en ${division.name}`} />
        <button disabled={busy} className={btnPrimary}>Agregar</button>
      </form>
      <ErrorMsg message={error} />
      {teams.length === 0 ? (
        <Empty>Esta división aún no tiene equipos.</Empty>
      ) : (
        <ul className="mt-2 divide-y divide-slate-100">
          {teams.map((t) => (
            <TeamRow key={t.id} tournamentId={tournamentId} divisionName={division.name} team={t} players={players.filter((p) => p.team_id === t.id)} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function Thumb({ url, alt, round }: { url: string | null; alt: string; round?: boolean }) {
  return (
    <span className={`flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden border border-slate-200 bg-slate-50 ${round ? "rounded-full" : "rounded-lg"}`}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={alt} className={round ? "h-full w-full object-cover" : "h-full w-full object-contain p-1"} />
      ) : (
        <span className="text-[10px] text-slate-400">{round ? "Foto" : "Escudo"}</span>
      )}
    </span>
  );
}

function FileButton({ text, onPick, disabled }: { text: string; onPick: (f: File) => void; disabled?: boolean }) {
  return (
    <label className={`${btnGhost} cursor-pointer ${disabled ? "pointer-events-none opacity-60" : ""}`}>
      {text}
      <input type="file" accept={ACCEPTED_IMAGES.join(",")} className="sr-only" disabled={disabled} onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = ""; }} />
    </label>
  );
}

function TeamRow({ tournamentId, divisionName, team, players }: { tournamentId: string; divisionName: string; team: Team; players: Player[] }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const auto = autoTeamColors(team.name);
  const [c1, setC1] = useState(team.color ?? auto.color);
  const [c2, setC2] = useState(team.color2 ?? auto.color2);
  const colorsDirty = c1 !== (team.color ?? auto.color) || c2 !== (team.color2 ?? auto.color2);

  async function run(fn: () => Promise<void>) {
    setError(null);
    setBusy(true);
    try { await fn(); router.refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : dbError(e as { message: string })); }
    finally { setBusy(false); }
  }

  const setCrest = (file: File) => run(async () => {
    const blob = await prepareImage(file, "crest");
    const path = await uploadMedia(supabase, tournamentId, `crest-${team.id}`, blob);
    const { error } = await supabase.from("tournament_teams").update({ logo_path: path }).eq("id", team.id);
    if (error) { await removeMedia(supabase, path); throw new Error(dbError(error)); }
    await removeMedia(supabase, team.logo_path);
  });

  const clearCrest = () => run(async () => {
    const { error } = await supabase.from("tournament_teams").update({ logo_path: null }).eq("id", team.id);
    if (error) throw new Error(dbError(error));
    await removeMedia(supabase, team.logo_path);
  });

  const saveColors = () => run(async () => {
    const { error } = await supabase.from("tournament_teams").update({ color: c1.toUpperCase(), color2: c2.toUpperCase() }).eq("id", team.id);
    if (error) throw new Error(dbError(error));
  });

  const removeTeam = () => {
    if (!window.confirm(`¿Eliminar "${team.name}" de ${divisionName}? También se borrarán sus partidos, goles y jugadores.`)) return;
    run(async () => {
      const { error } = await supabase.from("tournament_teams").delete().eq("id", team.id);
      if (error) throw new Error(dbError(error));
      await supabase.storage.from("team-media").remove([team.logo_path, ...players.map((p) => p.photo_path)].filter((x): x is string => !!x));
    });
  };

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center gap-3">
        <Thumb url={mediaUrl(supabase, team.logo_path)} alt={`Escudo de ${team.name}`} />
        <span className="min-w-0 flex-1 font-medium text-slate-900">{team.name}</span>
        <span className="flex items-center gap-1" title="Colores del equipo (marcadores animados)">
          <input type="color" value={c1} onChange={(e) => setC1(e.target.value.toUpperCase())} aria-label={`Color principal de ${team.name}`} className="h-8 w-8 cursor-pointer rounded border border-slate-300 p-0.5" />
          <input type="color" value={c2} onChange={(e) => setC2(e.target.value.toUpperCase())} aria-label={`Color secundario de ${team.name}`} className="h-8 w-8 cursor-pointer rounded border border-slate-300 p-0.5" />
          {colorsDirty && <button onClick={saveColors} disabled={busy} className={btnPrimary}>Guardar colores</button>}
          {!team.color && !colorsDirty && <span className="text-xs text-slate-400">auto</span>}
        </span>
        <FileButton text={team.logo_path ? "Cambiar escudo" : "Subir escudo"} onPick={setCrest} disabled={busy} />
        {team.logo_path && <button onClick={clearCrest} disabled={busy} className={btnDanger}>Quitar escudo</button>}
        <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className={btnGhost}>Plantilla ({players.length})</button>
        <button onClick={removeTeam} disabled={busy} className={btnDanger}>Eliminar</button>
      </div>
      <div className="mt-2"><ErrorMsg message={error} /></div>
      {open && <Roster tournamentId={tournamentId} team={team} players={players} />}
    </li>
  );
}

function Roster({ tournamentId, team, players }: { tournamentId: string; team: Team; players: Player[] }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<void>) {
    setError(null);
    setBusy(true);
    try { await fn(); router.refresh(); return true; }
    catch (e) { setError(e instanceof Error ? e.message : "Algo salió mal."); return false; }
    finally { setBusy(false); }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const ok = await run(async () => {
      let path: string | null = null;
      if (photo) path = await uploadMedia(supabase, tournamentId, `player-${team.id}`, await prepareImage(photo, "photo"));
      const { error } = await supabase.from("players").insert({
        tournament_id: tournamentId, team_id: team.id, name: name.trim(), number: number === "" ? null : Number(number), photo_path: path,
      });
      if (error) { await removeMedia(supabase, path); throw new Error(dbError(error)); }
    });
    if (ok) { setName(""); setNumber(""); setPhoto(null); }
  }

  const setPlayerPhoto = (p: Player, file: File) => run(async () => {
    const path = await uploadMedia(supabase, tournamentId, `player-${team.id}`, await prepareImage(file, "photo"));
    const { error } = await supabase.from("players").update({ photo_path: path }).eq("id", p.id);
    if (error) { await removeMedia(supabase, path); throw new Error(dbError(error)); }
    await removeMedia(supabase, p.photo_path);
  });

  const removePlayer = (p: Player) => {
    if (!window.confirm(`¿Quitar a ${p.name} de la plantilla?`)) return;
    run(async () => {
      const { error } = await supabase.from("players").delete().eq("id", p.id);
      if (error) throw new Error(dbError(error));
      await removeMedia(supabase, p.photo_path);
    });
  };

  return (
    <div className="mt-3 rounded-xl bg-slate-50 p-4">
      <form onSubmit={add} className="flex flex-wrap items-center gap-2">
        <input className={`${inputCls} w-20!`} type="number" min={0} max={99} placeholder="Nº" value={number} onChange={(e) => setNumber(e.target.value)} aria-label="Dorsal" />
        <input className={`${inputCls} min-w-[10rem] flex-1`} placeholder="Nombre del jugador" value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} aria-label="Nombre del jugador" />
        <FileButton text={photo ? `✓ ${photo.name.slice(0, 16)}` : "Foto (opcional)"} onPick={setPhoto} disabled={busy} />
        <button disabled={busy} className={btnPrimary}>{busy ? "Guardando…" : "Agregar jugador"}</button>
      </form>
      <div className="mt-2"><ErrorMsg message={error} /></div>
      {players.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">Aún no hay jugadores en {team.name}.</p>
      ) : (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {players.map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded-lg bg-white p-2 ring-1 ring-slate-200">
              <Thumb url={mediaUrl(supabase, p.photo_path)} alt={`Foto de ${p.name}`} round />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">
                {p.number != null && <span className="mr-1 text-slate-400">{p.number}</span>}{p.name}
              </span>
              <FileButton text={p.photo_path ? "Cambiar foto" : "Foto"} onPick={(f) => setPlayerPhoto(p, f)} disabled={busy} />
              <button onClick={() => removePlayer(p)} disabled={busy} aria-label={`Quitar a ${p.name}`} className="rounded-full px-2 py-1 text-slate-400 hover:bg-red-50 hover:text-red-600">✕</button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-slate-500">Las fotos se reducen antes de subirlas. Se ven mejor recortadas a medio cuerpo, con la cara arriba.</p>
    </div>
  );
}
