import { notFound, redirect } from "next/navigation";
import MatchDetail from "@/components/matches/MatchDetail";
import { broadcastFromTournament, sanitizeBrand } from "@/lib/brand";
import { sanitizeSummary, teamForm, teamUpcoming } from "@/lib/match-view";
import { mediaUrl } from "@/lib/media";
import { resolveTeamColors } from "@/lib/motion/scenes";
import { computeStandings } from "@/lib/standings";
import { createClient } from "@/lib/supabase/server";
import type { Fixture, Goal, Player, Team } from "@/lib/types";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FIX = "id, division_id, round, home_team_id, away_team_id, venue_id, kickoff, home_score, away_score, note";

export default async function MatchPage({ params }: { params: Promise<{ id: string; fixtureId: string }> }) {
  const { id, fixtureId } = await params;
  if (!UUID.test(id) || !UUID.test(fixtureId)) notFound();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: tournament }, { data: fx }] = await Promise.all([
    supabase.from("tournaments").select("id, name").eq("id", id).maybeSingle(),
    supabase.from("fixtures").select(FIX).eq("id", fixtureId).eq("tournament_id", id).maybeSingle(),
  ]);
  if (!tournament || !fx) notFound();
  const fixture = fx as Fixture;

  const [teamsR, divFixturesR, playersR, goalsR, divisionR, venueR, brandR, summaryR] = await Promise.all([
    supabase.from("tournament_teams").select("id, name, division_id, logo_path, color, color2").eq("division_id", fixture.division_id),
    supabase.from("fixtures").select(FIX).eq("division_id", fixture.division_id),
    supabase.from("players").select("id, team_id, name, number, photo_path").in("team_id", [fixture.home_team_id, fixture.away_team_id]).order("number", { nullsFirst: false }),
    supabase.from("fixture_goals").select("id, fixture_id, team_id, player_name, minute").eq("fixture_id", fixture.id).order("minute", { nullsFirst: false }),
    supabase.from("divisions").select("id, name").eq("id", fixture.division_id).maybeSingle(),
    fixture.venue_id ? supabase.from("venues").select("id, name").eq("id", fixture.venue_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("brands").select("kind, settings, logo_path").eq("tournament_id", id),
    supabase.from("match_summaries").select("content").eq("fixture_id", fixture.id).maybeSingle(),
  ]);
  const teams = (teamsR.data ?? []) as Team[];
  const divFixtures = (divFixturesR.data ?? []) as Fixture[];
  const view = (tid: string, fallback: string) => {
    const t = teams.find((x) => x.id === tid);
    const name = t?.name ?? fallback;
    return { id: tid, name, crestUrl: mediaUrl(supabase, t?.logo_path), color: resolveTeamColors(name, t?.color ?? "", t?.color2 ?? "").color };
  };
  const tRow = brandR.data?.find((b) => b.kind === "tournament");
  const bRow = brandR.data?.find((b) => b.kind === "broadcast");
  const tBrand = sanitizeBrand("tournament", tRow?.settings);
  const bBrand = bRow ? sanitizeBrand("broadcast", bRow.settings) : broadcastFromTournament(tBrand);
  const logoPath = bRow?.logo_path ?? tRow?.logo_path ?? null;

  return (
    <MatchDetail
      tournamentName={tournament.name}
      divisionName={divisionR.data?.name ?? null}
      fixture={fixture}
      home={view(fixture.home_team_id, "Local")} away={view(fixture.away_team_id, "Visitante")}
      venueName={venueR.data?.name ?? null}
      goals={(goalsR.data ?? []) as Goal[]}
      players={(playersR.data ?? []) as Player[]}
      standings={computeStandings(teams, divFixtures)}
      teams={Object.fromEntries(teams.map((t) => [t.id, { name: t.name, crestUrl: mediaUrl(supabase, t.logo_path) }]))}
      form={{ home: teamForm(fixture.home_team_id, divFixtures, fixture.id), away: teamForm(fixture.away_team_id, divFixtures, fixture.id) }}
      upcoming={{ home: teamUpcoming(fixture.home_team_id, divFixtures, fixture.id), away: teamUpcoming(fixture.away_team_id, divFixtures, fixture.id) }}
      baseHref={`/panel/torneos/${id}/partidos`}
      owner={{
        liveHref: `/panel/torneos/${id}/transmitir/${fixture.id}`,
        summaryEndpoint: `/api/torneos/${id}/partidos/${fixture.id}/resumen`,
        summary: sanitizeSummary(summaryR.data?.content),
        fonts: bBrand.fonts,
        logoUrl: logoPath ? supabase.storage.from("brand-logos").getPublicUrl(logoPath).data.publicUrl : null,
      }}
    />
  );
}
