// Dibuja un cuadro de la transmisión (real o simulada) a partir del plano del director.
import type { FullScene, Shot } from "@/lib/director";
import { drawLiveOverlay, drawScene, type MatchData, type SceneId, type SceneInput } from "./scenes";
import { drawLedBand } from "./stadium";

export const SCENE_OF: Record<FullScene, SceneId> = {
  ident: "ident", matchup: "matchup", lineupHome: "lineup", lineupAway: "lineup", kickoff: "kickoff",
  halftime: "halftime", fulltime: "fulltime", results: "results", standings: "standings",
};

export type Lineups = { home: MatchData["lineup"]; away: MatchData["lineup"] };

/**
 * - Plano completo (intro, presentación, alineación, tabla…): ocupa toda la pantalla.
 * - En cámara: dibuja la imagen (`drawCamera`) y encima marcador, gol, rótulos y anuncios.
 *   Los anuncios alternan: turnos pares, tarjeta del patrocinador; impares, franja LED.
 */
export function renderBroadcastFrame(ctx: CanvasRenderingContext2D, shot: Shot, input: SceneInput, lineups: Lineups, drawCamera: (ctx: CanvasRenderingContext2D) => void) {
  if (shot.full) {
    const lineup = shot.full.scene === "lineupHome" ? lineups.home : shot.full.scene === "lineupAway" ? lineups.away : input.data.lineup;
    drawScene(ctx, SCENE_OF[shot.full.scene], { ...input, t: shot.full.t, data: { ...input.data, lineup } });
    return;
  }
  drawCamera(ctx);
  const led = shot.sponsor && shot.sponsor.slot % 2 === 1;
  drawLiveOverlay(ctx, input, { scoreboard: shot.scoreboard, clock: shot.clock, goal: shot.goal, lower: shot.lower, sponsor: led ? undefined : shot.sponsor });
  if (led && shot.sponsor) drawLedBand(ctx, input, shot.sponsor.t);
}
