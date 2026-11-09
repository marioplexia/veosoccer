const fmt = new Intl.DateTimeFormat("es", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

/** "2026-12-05T09:00:00" -> "sáb, 5 dic · 09:00" (la hora es local, no se convierte de zona). */
export function formatKickoff(k: string | null): string {
  if (!k) return "Sin fecha";
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(k);
  if (!m) return "Sin fecha";
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return `${fmt.format(d)} · ${m[4]}:${m[5]}`;
}

export const toInputValue = (k: string | null) => (k ? k.slice(0, 16) : "");
export const fromInputValue = (v: string) => (v ? `${v}:00` : null);

export function dbError(e: { code?: string; message: string }): string {
  if (e.code === "23505") return "Ya existe un elemento con ese nombre.";
  if (e.code === "23503") return "Ese elemento está en uso y no se puede borrar.";
  if (e.code === "23514") return "Algún dato no es válido (revisa marcadores y nombres).";
  return e.message;
}
