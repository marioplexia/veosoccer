import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import Board from "@/components/board/Board";
import { createClient } from "@/lib/supabase/server";
import type { BrandRow, BroadcastSettingsView, Division, Fixture, Goal, Player, Sponsor, Team, Tournament, Venue } from "@/lib/types";

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

  const [divisions, teams, venues, fixtures, brands, players, sponsors, bset] = await Promise.all([
    supabase.from("divisions").select("id, name, position").eq("tournament_id", id).order("position").order("created_at"),
    supabase.from("tournament_teams").select("id, name, division_id, logo_path, color, color2").eq("tournament_id", id).order("name"),
    supabase.from("venues").select("id, name").eq("tournament_id", id).order("name"),
    supabase.from("fixtures").select("id, division_id, round, home_team_id, away_team_id, venue_id, kickoff, home_score, away_score, note").eq("tournament_id", id).order("round").order("kickoff", { nullsFirst: false }),
    supabase.from("brands").select("kind, settings, logo_path").eq("tournament_id", id),
    supabase.from("players").select("id, team_id, name, number, photo_path").eq("tournament_id", id).order("number", { nullsFirst: false }).order("name"),
    supabase.from("sponsors").select("id, name, image_path").eq("tournament_id", id).order("created_at"),
    supabase.from("broadcast_settings").select("rtmp_url, stream_key, ad_every_minutes").eq("tournament_id", id).maybeSingle(),
  ]);
  // La clave de Facebook nunca se envía completa al navegador: solo sus últimos 4 caracteres.
  const broadcastSettings: BroadcastSettingsView = {
    rtmp_url: bset.data?.rtmp_url ?? "rtmps://live-api-s.facebook.com:443/rtmp/",
    key_hint: bset.data?.stream_key ? `…${bset.data.stream_key.slice(-4)}` : null,
    ad_every_minutes: bset.data?.ad_every_minutes ?? 8,
  };
  const fixtureIds = (fixtures.data ?? []).map((f) => f.id);
  const goals = fixtureIds.length
    ? await supabase.from("fixture_goals").select("id, fixture_id, team_id, player_name, minute").in("fixture_id", fixtureIds)
    : { data: [] as Goal[] };

  return (
    <main className="min-h-screen pb-10">
      <header className="text-white" style={{ background: "linear-gradient(90deg,#9B19FF 0%,#7B5CFF 30%,#00B4FF 70%,#05F0FF 100%)" }}>
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 pb-6 pt-5">
          <h1 className="min-w-0 text-3xl font-bold tracking-tight sm:text-5xl">{tournament.name}</h1>
          <Link href="/panel" className="rounded-full bg-[#37003C] px-4 py-2 text-sm font-medium text-white">← Mis torneos</Link>
        </div>
      </header>
      <Board
        tournament={tournament as Tournament}
        divisions={(divisions.data ?? []) as Division[]}
        teams={(teams.data ?? []) as Team[]}
        venues={(venues.data ?? []) as Venue[]}
        fixtures={(fixtures.data ?? []) as Fixture[]}
        goals={(goals.data ?? []) as Goal[]}
        brands={(brands.data ?? []) as BrandRow[]}
        players={(players.data ?? []) as Player[]}
        sponsors={(sponsors.data ?? []) as Sponsor[]}
        broadcastSettings={broadcastSettings}
      />
    </main>
  );
}
