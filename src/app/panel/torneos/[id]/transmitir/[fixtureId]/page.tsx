import { notFound, redirect } from "next/navigation";
import LiveStudio from "@/components/live/LiveStudio";
import { broadcastFromTournament, identityPalette, sanitizeBrand } from "@/lib/brand";
import { createClient } from "@/lib/supabase/server";
import type { Fixture, Player, Sponsor, Team } from "@/lib/types";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function LivePage({ params }: { params: Promise<{ id: string; fixtureId: string }> }) {
  const { id, fixtureId } = await params;
  if (!UUID.test(id) || !UUID.test(fixtureId)) notFound();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: tournament }, { data: fixture }] = await Promise.all([
    supabase.from("tournaments").select("id, name").eq("id", id).maybeSingle(),
    supabase.from("fixtures").select("id, division_id, round, home_team_id, away_team_id, venue_id, kickoff, home_score, away_score, note").eq("id", fixtureId).eq("tournament_id", id).maybeSingle(),
  ]);
  if (!tournament || !fixture) notFound();

  const [teams, divFixtures, players, brand, sponsors, settings] = await Promise.all([
    supabase.from("tournament_teams").select("id, name, division_id, logo_path, color, color2").eq("division_id", fixture.division_id),
    supabase.from("fixtures").select("id, division_id, round, home_team_id, away_team_id, venue_id, kickoff, home_score, away_score, note").eq("division_id", fixture.division_id),
    supabase.from("players").select("id, team_id, name, number, photo_path").in("team_id", [fixture.home_team_id, fixture.away_team_id]).order("number", { nullsFirst: false }),
    supabase.from("brands").select("kind, settings, logo_path").eq("tournament_id", id),
    supabase.from("sponsors").select("id, name, image_path").eq("tournament_id", id).order("created_at"),
    supabase.from("broadcast_settings").select("ad_every_minutes, stream_key").eq("tournament_id", id).maybeSingle(),
  ]);

  const tRow = brand.data?.find((b) => b.kind === "tournament");
  const bRow = brand.data?.find((b) => b.kind === "broadcast");
  const tBrand = sanitizeBrand("tournament", tRow?.settings);

  return (
    <LiveStudio
      tournament={{ id: tournament.id, name: tournament.name }}
      fixture={fixture as Fixture}
      teams={(teams.data ?? []) as Team[]}
      divisionFixtures={(divFixtures.data ?? []) as Fixture[]}
      players={(players.data ?? []) as Player[]}
      brand={bRow ? sanitizeBrand("broadcast", bRow.settings) : sanitizeBrand("broadcast", broadcastFromTournament(tBrand))}
      brandLogoPath={bRow?.logo_path ?? tRow?.logo_path ?? null}
      palette={identityPalette(tBrand)}
      sponsors={(sponsors.data ?? []) as Sponsor[]}
      adEveryMinutes={settings.data?.ad_every_minutes ?? 8}
      hasStreamKey={!!settings.data?.stream_key}
    />
  );
}
