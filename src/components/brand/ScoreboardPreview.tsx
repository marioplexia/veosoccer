"use client";

import { useEffect, useRef, useState } from "react";
import type { BrandSettings } from "@/lib/brand";
import { DEFAULT_MATCH, MATCH_THEMES, drawScoreboardSample, type SceneInput } from "@/lib/motion/scenes";

const W = 1200, H = 420;

/** Cómo se ven el marcador del partido y la barra de medio tiempo / final en los tres temas de color. */
export default function ScoreboardPreview({ settings, logoUrl, tournamentName, teamNames }: { settings: BrandSettings; logoUrl: string | null; tournamentName: string; teamNames: string[] }) {
  const refs = useRef<(HTMLCanvasElement | null)[]>([]);
  const [logo, setLogo] = useState<{ img: HTMLImageElement; w: number; h: number } | null>(null);

  useEffect(() => {
    if (!logoUrl) return;
    let alive = true;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => { if (alive) setLogo({ img, w: img.naturalWidth, h: img.naturalHeight }); };
    img.src = logoUrl;
    return () => { alive = false; };
  }, [logoUrl]);
  const shownLogo = logoUrl ? logo : null;

  useEffect(() => {
    const data = { ...DEFAULT_MATCH, home: teamNames[0] ?? DEFAULT_MATCH.home, away: teamNames[1] ?? DEFAULT_MATCH.away };
    const draw = () => MATCH_THEMES.forEach((_, theme) => {
      const ctx = refs.current[theme]?.getContext("2d");
      if (!ctx) return;
      const input: SceneInput = {
        w: W, h: H, t: 0, kind: "broadcast", colors: settings.colors, fonts: settings.fonts,
        logo: shownLogo?.img ?? null, logoSize: shownLogo ? { w: shownLogo.w, h: shownLogo.h } : null,
        tournamentName, data, theme, scoreStyle: settings.scoreboard,
      };
      drawScoreboardSample(ctx, input);
    });
    draw();
    let alive = true;
    document.fonts.ready.then(() => { if (alive) draw(); });
    return () => { alive = false; };
  }, [settings, shownLogo, tournamentName, teamNames]);

  return (
    <div className="space-y-4">
      {MATCH_THEMES.map((th, k) => (
        <figure key={th.id}>
          <figcaption className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Tema {th.label.toLowerCase()}</figcaption>
          <canvas ref={(el) => { refs.current[k] = el; }} width={W} height={H} className="block w-full rounded-xl" role="img" aria-label={`Marcador y barra de resultado con el tema ${th.label.toLowerCase()}`} />
        </figure>
      ))}
      <p className="text-xs text-slate-500">Arriba, el marcador durante el partido; abajo, la barra de medio tiempo y final. Cada partido usa uno de los tres temas; los colores son fijos.</p>
    </div>
  );
}
