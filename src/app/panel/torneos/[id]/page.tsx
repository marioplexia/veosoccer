import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import Board from "@/components/board/Board";
import { createClient } from "@/lib/supabase/server";
import type { Division, Fixture, Goal, Team, Tournament, Venue } from "@/lib/types";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function TournamentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: tournament } = await supabase.from("tournaments").select("id, name, description, start_date").eq("id", id).maybeSingle();
  if (!tournament) notFound();

  const [divisions, teams, venues, fixtures] = await Promise.all([
    supabase.from("divisions").select("id, name, position").eq("tournament_id", id).order("position").order("created_at"),
    supabase.from("tournament_teams").select("id, name, division_id").eq("tournament_id", id).order("name"),
    supabase.from("venues").select("id, name").eq("tournament_id", id).order("name"),
    supabase.from("fixtures").select("id, division_id, round, home_team_id, away_team_id, venue_id, kickoff, home_score, away_score, note").eq("tournament_id", id).order("round").order("kickoff", { nullsFirst: false }),
  ]);
  const fixtureIds = (fixtures.data ?? []).map((f) => f.id);
  const goals = fixtureIds.length
    ? await supabase.from("fixture_goals").select("id, fixture_id, team_id, player_name, minute").in("fixture_id", fixtureIds)
    : { data: [] as Goal[] };

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <Link href="/panel" className="text-sm font-medium text-emerald-700 hover:underline">← Mis torneos</Link>
      <h1 className="mt-2 text-3xl font-bold text-slate-900">{tournament.name}</h1>
      <Board
        tournament={tournament as Tournament}
        divisions={(divisions.data ?? []) as Division[]}
        teams={(teams.data ?? []) as Team[]}
        venues={(venues.data ?? []) as Venue[]}
        fixtures={(fixtures.data ?? []) as Fixture[]}
        goals={(goals.data ?? []) as Goal[]}
      />
    </main>
  );
}
