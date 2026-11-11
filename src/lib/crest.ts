// Estilos de escudo para la IA y conversión de SVG a PNG en el navegador.
export const CREST_STYLES: Record<string, { label: string; prompt: string }> = {
  clasico: { label: "Clásico", prompt: "escudo clásico de club de fútbol: silueta de escudo heráldico, borde marcado, símbolo central" },
  moderno: { label: "Moderno minimalista", prompt: "escudo moderno y minimalista: formas geométricas limpias, pocos elementos, estilo plano" },
  circular: { label: "Insignia circular", prompt: "insignia circular: anillo exterior con las iniciales o el nombre corto y símbolo al centro" },
  retro: { label: "Retro", prompt: "escudo retro de los años 70: formas redondeadas, franjas y aire vintage" },
};

/** Dibuja un SVG (ya validado) en un canvas y lo devuelve como PNG transparente. */
export async function svgToPng(svgDataUrl: string, size = 512): Promise<Blob> {
  const img = new Image();
  img.decoding = "async";
  await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error("No se pudo dibujar el escudo.")); img.src = svgDataUrl; });
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  canvas.getContext("2d")!.drawImage(img, 0, 0, size, size);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
  if (!blob) throw new Error("No se pudo convertir el escudo.");
  return blob;
}
