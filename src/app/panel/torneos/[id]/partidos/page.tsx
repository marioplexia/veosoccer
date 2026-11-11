import { notFound, redirect } from "next/navigation";
import MatchesView from "@/components/matches/MatchesView";
import { mediaUrl } from "@/lib/media";
import { createClient } from "@/lib/supabase/server";
import type { Division, Fixture, Team } from "@/lib/types";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function MatchesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: tournament } = await supabase.from("tournaments").select("id, name").eq("id", id).maybeSingle();
  if (!tournament) notFound();
  const [divisions, teams, fixtures] = await Promise.all([
    supabase.from("divisions").select("id, name, position").eq("tournament_id", id).order("position"),
    supabase.from("tournament_teams").select("id, name, division_id, logo_path").eq("tournament_id", id),
    supabase.from("fixtures").select("id, division_id, round, home_team_id, away_team_id, venue_id, kickoff, home_score, away_score, note").eq("tournament_id", id),
  ]);

  return (
    <MatchesView
      title={`${tournament.name} · Partidos`}
      divisions={(divisions.data ?? []) as Division[]}
      teams={((teams.data ?? []) as Team[]).map((t) => ({ id: t.id, name: t.name, division_id: t.division_id, crestUrl: mediaUrl(supabase, t.logo_path) }))}
      fixtures={(fixtures.data ?? []) as Fixture[]}
      baseHref={`/panel/torneos/${id}/partidos`}
      backHref={`/panel/torneos/${id}`} backLabel="← Tablero del torneo"
    />
  );
}
