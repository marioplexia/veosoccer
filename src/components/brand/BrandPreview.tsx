"use client";

import { readableOn } from "@/lib/color";
import type { BrandKind, BrandSettings } from "@/lib/brand";
import { fontStyle } from "./useGoogleFonts";

const abbr = (name: string, fallback: string) => {
  const a = name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]/g, "").slice(0, 3).toUpperCase();
  return a.length >= 2 ? a : fallback;
};

export default function BrandPreview({
  kind, settings, logoUrl, tournamentName, teamNames,
}: { kind: BrandKind; settings: BrandSettings; logoUrl: string | null; tournamentName: string; teamNames: string[] }) {
  return kind === "tournament"
    ? <TournamentPreview settings={settings} logoUrl={logoUrl} name={tournamentName} />
    : <BroadcastPreview settings={settings} logoUrl={logoUrl} teamNames={teamNames} />;
}

function Logo({ url, size, bg }: { url: string | null; size: number; bg: string }) {
  return (
    <div className="flex shrink-0 items-center justify-center overflow-hidden rounded-full" style={{ width: size, height: size, background: bg }}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="Logo" className="h-full w-full object-contain p-[12%]" />
      ) : (
        <span aria-hidden className="text-[10px] font-semibold uppercase opacity-40">Logo</span>
      )}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{children}</p>;
}

function TournamentPreview({ settings, logoUrl, name }: { settings: BrandSettings; logoUrl: string | null; name: string }) {
  const c = settings.colors;
  const f = settings.fonts;
  return (
    <div className="space-y-5">
      <div>
        <Label>Portada de jornada</Label>
        <div className="relative aspect-video overflow-hidden rounded-2xl p-6 sm:p-8" style={{ background: `linear-gradient(120deg, ${c.primary}, ${c.secondary})` }}>
          <div className="absolute -right-10 -top-10 h-56 w-56 rounded-full opacity-30 blur-2xl" style={{ background: c.highlight }} aria-hidden />
          <div className="relative flex h-full flex-col justify-end">
            <p className="text-[clamp(1.4rem,5vw,2.6rem)] uppercase leading-[1.05]" style={{ ...fontStyle(f.heading), color: readableOn(c.primary) }}>
              {name}
            </p>
            <span className="mt-3 inline-block self-start rounded-xl px-4 py-1.5 text-sm sm:text-base" style={{ ...fontStyle(f.body), background: c.text, color: c.highlight }}>
              Jornada 08
            </span>
            <div className="mt-4 flex items-center gap-3">
              <Logo url={logoUrl} size={44} bg={c.surface} />
              <span className="text-lg" style={{ ...fontStyle(f.heading), color: readableOn(c.primary) }}>Temporada</span>
            </div>
          </div>
        </div>
      </div>

      <div>
        <Label>Tarjeta clara</Label>
        <div className="flex items-center gap-4 rounded-2xl p-5" style={{ background: c.background }}>
          <Logo url={logoUrl} size={64} bg={c.surface} />
          <div className="min-w-0">
            <p className="truncate text-2xl" style={{ ...fontStyle(f.heading), color: c.text }}>{name}</p>
            <p className="text-sm" style={{ ...fontStyle(f.body), color: c.text }}>Resultados, calendario y estadísticas</p>
            <div className="mt-2 flex gap-2">
              <span className="rounded-full px-3 py-1 text-xs" style={{ ...fontStyle(f.body), background: c.primary, color: readableOn(c.primary) }}>Principal</span>
              <span className="rounded-full px-3 py-1 text-xs" style={{ ...fontStyle(f.body), background: c.accent, color: readableOn(c.accent) }}>Acento</span>
              <span className="rounded-full px-3 py-1 text-xs" style={{ ...fontStyle(f.body), background: c.highlight, color: readableOn(c.highlight) }}>Destacado</span>
            </div>
          </div>
        </div>
      </div>

      <div>
        <Label>Paleta</Label>
        <div className="overflow-hidden rounded-2xl border border-slate-200">
          {[...Object.entries(c).map(([k, hex]) => ({ key: k, name: roleName[k] ?? k, hex })), ...settings.palette.map((p) => ({ key: p.id, name: p.name, hex: p.hex }))].map((x) => (
            <div key={x.key} className="flex items-center justify-between px-4 py-2.5 text-sm" style={{ background: x.hex, color: readableOn(x.hex), ...fontStyle(f.heading) }}>
              <span className="truncate">{x.name}</span>
              <span className="ml-3 font-mono text-xs opacity-80">{x.hex}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const roleName: Record<string, string> = {
  primary: "Principal", secondary: "Secundario", accent: "Acento", highlight: "Destacado", background: "Fondo", surface: "Superficie", text: "Texto",
};

function BroadcastPreview({ settings, logoUrl, teamNames }: { settings: BrandSettings; logoUrl: string | null; teamNames: string[] }) {
  const c = settings.colors;
  const f = settings.fonts;
  const home = abbr(teamNames[0] ?? "", "LOC");
  const away = abbr(teamNames[1] ?? "", "VIS");
  const pitch = "linear-gradient(135deg, #14532d 0%, #3f8f2a 55%, #a3c93a 100%)";

  return (
    <div className="space-y-5">
      <div>
        <Label>Marcador en pantalla</Label>
        <div className="flex items-center overflow-hidden rounded-2xl p-4 sm:p-6" style={{ background: pitch }}>
          <div className="flex min-w-0 flex-1 items-stretch">
            <div className="z-10 -mr-5 self-center"><Logo url={logoUrl} size={64} bg="#FFFFFF" /></div>
            <div className="flex min-w-0 flex-1 items-stretch overflow-hidden rounded-r-md shadow-lg">
              <div className="flex flex-1 items-center justify-center pl-6 pr-2 text-[clamp(1rem,4vw,1.9rem)]" style={{ ...fontStyle(f.heading), background: c.barBg, color: c.barText, minHeight: 52 }}>{home}</div>
              <div className="w-3 sm:w-4" style={{ background: c.homeStripe }} />
              <div className="flex items-center justify-center px-3 text-[clamp(1.1rem,4.5vw,2.1rem)] sm:px-5" style={{ ...fontStyle(f.numbers), background: c.scoreBg, color: c.scoreText }}>4-1</div>
              <div className="w-3 sm:w-4" style={{ background: c.awayStripe }} />
              <div className="flex flex-1 items-center justify-center px-2 text-[clamp(1rem,4vw,1.9rem)]" style={{ ...fontStyle(f.heading), background: c.barBg, color: c.barText }}>{away}</div>
              <div className="flex items-center justify-center px-3 text-[clamp(1.1rem,4.5vw,2.1rem)] sm:px-5" style={{ ...fontStyle(f.numbers), background: c.clockBg, color: c.clockText }}>92:41</div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <Label>Rótulo de jugador</Label>
        <div className="rounded-2xl p-4 sm:p-6" style={{ background: pitch }}>
          <div className="flex max-w-md items-stretch overflow-hidden rounded-md shadow-lg">
            <div className="w-2.5 shrink-0" style={{ background: c.lowerAccent }} />
            <div className="flex-1 px-4 py-2.5" style={{ background: c.lowerBg, color: c.lowerText }}>
              <p className="text-xl uppercase leading-tight" style={fontStyle(f.heading)}>Nombre Apellido</p>
              <p className="text-sm opacity-80" style={fontStyle(f.body)}>Delantero · 2 goles</p>
            </div>
            <div className="flex items-center px-4 text-2xl" style={{ ...fontStyle(f.numbers), background: c.scoreBg, color: c.scoreText }}>9</div>
          </div>
        </div>
      </div>

      <div>
        <Label>Presentación del partido</Label>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-2xl p-5 text-center" style={{ background: c.scoreBg, color: c.scoreText }}>
          <div>
            <div className="mx-auto mb-2 h-1.5 w-16 rounded-full" style={{ background: c.homeStripe }} />
            <p className="text-3xl" style={fontStyle(f.heading)}>{home}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest opacity-70" style={fontStyle(f.body)}>Jornada 6</p>
            <p className="text-4xl" style={fontStyle(f.numbers)}>VS</p>
            <p className="text-xs opacity-70" style={fontStyle(f.numbers)}>14:00</p>
          </div>
          <div>
            <div className="mx-auto mb-2 h-1.5 w-16 rounded-full" style={{ background: c.awayStripe }} />
            <p className="text-3xl" style={fontStyle(f.heading)}>{away}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
