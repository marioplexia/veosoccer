"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { DEFAULT_BRANDS, MAX_PALETTE, ROLES, brandToCssVars, sanitizeBrand, type BrandKind, type BrandSettings } from "@/lib/brand";
import { createClient } from "@/lib/supabase/client";
import type { Division, Fixture, Player, Team } from "@/lib/types";
import { btnDanger, btnGhost, btnPrimary, Card, ErrorMsg } from "@/components/ui";
import ColorField from "@/components/ColorField";
import BrandPreview from "./BrandPreview";
import FontEditor from "./FontEditor";
import MotionStudio, { type MatchOption } from "./MotionStudio";
import { useGoogleFonts } from "./useGoogleFonts";

const MAX_LOGO = 1024 * 1024;
const LOGO_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

type Props = {
  tournamentId: string;
  tournamentName: string;
  kind: BrandKind;
  initial: BrandSettings;
  initialLogoPath: string | null;
  teamNames: string[];
  matches: MatchOption[];
  teams?: Team[];
  players?: Player[];
  fixtures?: Fixture[];
  divisions?: Division[];
};

export default function BrandEditor({ tournamentId, tournamentName, kind, initial, initialLogoPath, teamNames, matches, teams = [], players = [], fixtures = [], divisions = [] }: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [settings, setSettings] = useState<BrandSettings>(initial);
  const [saved, setSaved] = useState({ settings: JSON.stringify(initial), logoPath: initialLogoPath });
  const [logoPath, setLogoPath] = useState<string | null>(initialLogoPath);
  const [pending, setPending] = useState<{ file: File; url: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useGoogleFonts(Object.values(settings.fonts).map((f) => f.family));

  const savedLogoUrl = logoPath ? supabase.storage.from("brand-logos").getPublicUrl(logoPath).data.publicUrl : null;
  const logoUrl = pending?.url ?? savedLogoUrl;
  const dirty = JSON.stringify(settings) !== saved.settings || logoPath !== saved.logoPath || pending !== null;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  useEffect(() => () => { if (pending) URL.revokeObjectURL(pending.url); }, [pending]);

  const setColor = (key: string, hex: string) => setSettings((s) => ({ ...s, colors: { ...s.colors, [key]: hex } }));

  function pickLogo(file: File | null) {
    setError(null);
    if (!file) return;
    if (!LOGO_TYPES[file.type]) return setError("El logo debe ser PNG, JPG o WebP.");
    if (file.size > MAX_LOGO) return setError("El logo no puede pesar más de 1 MB.");
    setPending({ file, url: URL.createObjectURL(file) });
  }

  async function save() {
    setError(null);
    setNotice(null);
    setBusy(true);
    const clean = sanitizeBrand(kind, settings);
    let nextPath = logoPath;
    let uploaded: string | null = null;
    try {
      if (pending) {
        const path = `${tournamentId}/${kind}-${Date.now()}.${LOGO_TYPES[pending.file.type]}`;
        const up = await supabase.storage.from("brand-logos").upload(path, pending.file, { contentType: pending.file.type, upsert: false });
        if (up.error) throw new Error(`No se pudo subir el logo: ${up.error.message}`);
        uploaded = path;
        nextPath = path;
      }
      const { error } = await supabase.from("brands").upsert(
        { tournament_id: tournamentId, kind, settings: clean, logo_path: nextPath },
        { onConflict: "tournament_id,kind" },
      );
      if (error) throw new Error(error.message);

      // Solo tras guardar bien se elimina el logo anterior.
      if (saved.logoPath && saved.logoPath !== nextPath) await supabase.storage.from("brand-logos").remove([saved.logoPath]);

      setSettings(clean);
      setLogoPath(nextPath);
      setPending(null);
      setSaved({ settings: JSON.stringify(clean), logoPath: nextPath });
      setNotice("Cambios guardados.");
      router.refresh();
    } catch (e) {
      if (uploaded) await supabase.storage.from("brand-logos").remove([uploaded]);
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    if (!window.confirm("¿Restablecer colores y tipografías a los valores originales? Se conserva el logo.")) return;
    setSettings(clone(DEFAULT_BRANDS[kind]));
    setNotice(null);
  }

  const css = brandToCssVars(kind, settings);
  async function copyCss() {
    try {
      await navigator.clipboard.writeText(css);
      setNotice("Variables CSS copiadas.");
    } catch {
      setNotice("No se pudo copiar automáticamente; selecciona el texto de “Ver variables CSS”.");
    }
  }

  const groups = [...new Set(ROLES[kind].map((r) => r.group))];
  const addColor = () =>
    setSettings((s) => s.palette.length >= MAX_PALETTE ? s : { ...s, palette: [...s.palette, { id: `c${Date.now().toString(36)}`, name: `Color ${s.palette.length + 1}`, hex: "#6366F1" }] });

  return (
    <div className="space-y-6">
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="min-w-0 space-y-6">
        <div className="sticky top-0 z-10 -mx-1 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
          <button onClick={save} disabled={busy || !dirty} className={btnPrimary}>{busy ? "Guardando…" : "Guardar cambios"}</button>
          <button onClick={reset} disabled={busy} className={btnGhost}>Restablecer</button>
          <button onClick={copyCss} className={btnGhost}>Copiar variables CSS</button>
          <span role="status" className={`text-sm ${dirty ? "font-medium text-amber-700" : "text-slate-500"}`}>
            {dirty ? "● Cambios sin guardar" : notice ?? "Todo guardado"}
          </span>
        </div>
        <ErrorMsg message={error} />

        <Card title="Logo">
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-50">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="Logo actual" className="h-full w-full object-contain p-2" />
              ) : (
                <span className="text-xs text-slate-400">Sin logo</span>
              )}
            </div>
            <div className="min-w-0 space-y-2">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => { pickLogo(e.target.files?.[0] ?? null); e.target.value = ""; }}
                aria-label="Subir logo"
                className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-full file:border-0 file:bg-emerald-50 file:px-4 file:py-2 file:font-semibold file:text-emerald-700 hover:file:bg-emerald-100"
              />
              <p className="text-xs text-slate-500">PNG, JPG o WebP · máximo 1 MB. Mejor con fondo transparente.</p>
              {(logoUrl) && (
                <button onClick={() => { setPending(null); setLogoPath(null); }} className={btnDanger}>Quitar logo</button>
              )}
            </div>
          </div>
        </Card>

        {groups.map((g) => (
          <Card key={g} title={`Colores · ${g}`}>
            <div className="space-y-2">
              {ROLES[kind].filter((r) => r.group === g).map((r) => (
                <ColorField
                  key={r.key}
                  label={r.label}
                  hint={r.hint}
                  value={settings.colors[r.key]}
                  onChange={(hex) => setColor(r.key, hex)}
                  against={r.pair ? { hex: settings.colors[r.pair], label: ROLES[kind].find((x) => x.key === r.pair)!.label } : undefined}
                />
              ))}
            </div>
          </Card>
        ))}

        <Card title={`Paleta personalizada (${settings.palette.length}/${MAX_PALETTE})`} action={<button onClick={addColor} disabled={settings.palette.length >= MAX_PALETTE} className={btnGhost}>+ Agregar color</button>}>
          {settings.palette.length === 0 ? (
            <p className="text-sm text-slate-500">Agrega los colores con nombre y código de tu identidad (por ejemplo “Rosa liga” #FF2882).</p>
          ) : (
            <div className="space-y-2">
              {settings.palette.map((p) => (
                <ColorField
                  key={p.id}
                  label={p.name}
                  value={p.hex}
                  onRename={(name) => setSettings((s) => ({ ...s, palette: s.palette.map((x) => (x.id === p.id ? { ...x, name } : x)) }))}
                  onChange={(hex) => setSettings((s) => ({ ...s, palette: s.palette.map((x) => (x.id === p.id ? { ...x, hex } : x)) }))}
                  actions={
                    <button onClick={() => setSettings((s) => ({ ...s, palette: s.palette.filter((x) => x.id !== p.id) }))} aria-label={`Eliminar ${p.name}`} className="shrink-0 rounded-full px-2 py-1 text-slate-400 hover:bg-red-50 hover:text-red-600">✕</button>
                  }
                />
              ))}
            </div>
          )}
        </Card>

        <Card title="Tipografías">
          <FontEditor fonts={settings.fonts} onChange={(slot, f) => setSettings((s) => ({ ...s, fonts: { ...s.fonts, [slot]: f } }))} />
        </Card>

        <details className="rounded-2xl border border-slate-200 bg-white p-5">
          <summary className="cursor-pointer text-sm font-semibold text-slate-900">Ver variables CSS</summary>
          <pre className="mt-3 max-h-72 overflow-auto rounded-lg bg-slate-900 p-4 text-xs text-slate-100">{css}</pre>
        </details>
      </div>

      <div className="min-w-0">
        <div className="lg:sticky lg:top-4">
          <Card title="Vista previa en vivo">
            <BrandPreview kind={kind} settings={settings} logoUrl={logoUrl} tournamentName={tournamentName} teamNames={teamNames} />
          </Card>
        </div>
      </div>
    </div>
    <MotionStudio kind={kind} settings={settings} logoUrl={logoUrl} tournamentName={tournamentName} matches={matches} teams={teams} players={players} fixtures={fixtures} divisions={divisions} />
    </div>
  );
}
