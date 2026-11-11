"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { mediaUrl } from "@/lib/media";
import type { SceneImage } from "@/lib/motion/scenes";
import type { Sponsor, Team } from "@/lib/types";

export async function loadImage(url: string | null): Promise<SceneImage | null> {
  if (!url) return null;
  return new Promise((res) => {
    const img = new Image();
    if (!/^(blob:|data:)/.test(url)) img.crossOrigin = "anonymous"; // necesario para transmitir/grabar el canvas
    img.onload = () => res({ img, w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => res(null);
    img.src = url;
  });
}

/** Logo de la marca, escudos (crest:<id>, homeLogo, awayLogo) y logos de patrocinadores (sponsor:<n>). */
export function useBroadcastImages(supabase: SupabaseClient, a: { brandLogoPath: string | null; teams: Team[]; sponsors: Sponsor[]; homeId?: string; awayId?: string }) {
  const [images, setImages] = useState<Record<string, SceneImage>>({});
  const [logo, setLogo] = useState<SceneImage | null>(null);
  const key = JSON.stringify([a.brandLogoPath, a.teams.map((t) => [t.id, t.logo_path]), a.sponsors.map((s) => s.image_path), a.homeId, a.awayId]);
  useEffect(() => {
    let alive = true;
    (async () => {
      const lg = await loadImage(a.brandLogoPath ? supabase.storage.from("brand-logos").getPublicUrl(a.brandLogoPath).data.publicUrl : null);
      const entries = await Promise.all([
        ...a.teams.map(async (t) => [`crest:${t.id}`, await loadImage(mediaUrl(supabase, t.logo_path))] as const),
        ...a.sponsors.map(async (s, k) => [`sponsor:${k}`, await loadImage(mediaUrl(supabase, s.image_path))] as const),
      ]);
      if (!alive) return;
      const map: Record<string, SceneImage> = {};
      for (const [k, v] of entries) if (v) map[k] = v;
      if (a.homeId && map[`crest:${a.homeId}`]) map.homeLogo = map[`crest:${a.homeId}`];
      if (a.awayId && map[`crest:${a.awayId}`]) map.awayLogo = map[`crest:${a.awayId}`];
      setImages(map);
      setLogo(lg);
    })();
    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, key]);
  return { images, logo };
}
