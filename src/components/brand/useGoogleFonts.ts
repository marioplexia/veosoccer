"use client";

import { useEffect } from "react";
import { googleFontsUrl } from "@/lib/fonts";

/** Carga en la página las familias de Google Fonts indicadas (una sola vez por combinación). */
export function useGoogleFonts(families: string[]) {
  const key = [...new Set(families)].sort().join("|");
  useEffect(() => {
    const url = googleFontsUrl(key ? key.split("|") : []);
    if (!url || document.querySelector(`link[data-gf="${CSS.escape(url)}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = url;
    link.dataset.gf = url;
    document.head.appendChild(link);
  }, [key]);
}

export const fontStyle = (f: { family: string; weight: number; italic: boolean }): React.CSSProperties => ({
  fontFamily: `"${f.family}", system-ui, sans-serif`,
  fontWeight: f.weight,
  fontStyle: f.italic ? "italic" : "normal",
});
