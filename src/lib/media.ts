// Imágenes de equipos y jugadores: se reducen en el navegador y se guardan en el bucket "team-media".
import type { SupabaseClient } from "@supabase/supabase-js";

export const MEDIA_BUCKET = "team-media";
export const ACCEPTED_IMAGES = ["image/png", "image/jpeg", "image/webp"];
export const MAX_SOURCE_BYTES = 15 * 1024 * 1024;

/** Medidas para que la imagen quepa en `max` px por lado sin deformarse (nunca la agranda). */
export function fitWithin(w: number, h: number, max: number): { w: number; h: number } {
  if (!(w > 0 && h > 0)) return { w: 0, h: 0 };
  const k = Math.min(1, max / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}

export function mediaUrl(supabase: SupabaseClient, path: string | null | undefined): string | null {
  return path ? supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl : null;
}

/**
 * Reduce la imagen: escudos a PNG (conservan la transparencia), fotos a JPEG.
 * Devuelve el archivo listo para subir.
 */
export async function prepareImage(file: File, kind: "crest" | "photo"): Promise<Blob> {
  if (!ACCEPTED_IMAGES.includes(file.type)) throw new Error("La imagen debe ser PNG, JPG o WebP.");
  if (file.size > MAX_SOURCE_BYTES) throw new Error("La imagen no puede pesar más de 15 MB.");
  const bmp = await createImageBitmap(file).catch(() => { throw new Error("No se pudo leer esa imagen."); });
  const { w, h } = fitWithin(bmp.width, bmp.height, kind === "crest" ? 512 : 900);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  if (kind === "photo") { ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, w, h); }
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const type = kind === "crest" ? "image/png" : "image/jpeg";
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, type, 0.86));
  if (!blob) throw new Error("No se pudo procesar la imagen.");
  if (blob.size > 2 * 1024 * 1024) throw new Error("La imagen sigue siendo muy pesada; prueba con otra.");
  return blob;
}

/** Sube la imagen a la carpeta del torneo y devuelve su ruta. Borra la anterior si se indica. */
export async function uploadMedia(
  supabase: SupabaseClient, tournamentId: string, prefix: string, blob: Blob, previous?: string | null,
): Promise<string> {
  const ext = blob.type === "image/png" ? "png" : "jpg";
  const path = `${tournamentId}/${prefix}-${Date.now().toString(36)}.${ext}`;
  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, blob, { contentType: blob.type, upsert: false });
  if (error) throw new Error(`No se pudo subir la imagen: ${error.message}`);
  if (previous) await supabase.storage.from(MEDIA_BUCKET).remove([previous]);
  return path;
}

export async function removeMedia(supabase: SupabaseClient, path: string | null | undefined) {
  if (path) await supabase.storage.from(MEDIA_BUCKET).remove([path]);
}
