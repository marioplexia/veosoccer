import { notFound } from "next/navigation";
import MatchDetail from "@/components/matches/MatchDetail";
import { DEMO_DIVISIONS, DEMO_FIXTURES, DEMO_TEAMS } from "@/lib/demo-league";
import { teamForm, teamUpcoming } from "@/lib/match-view";
import { computeStandings } from "@/lib/standings";

export function generateStaticParams() { return DEMO_FIXTURES.map((f) => ({ fixtureId: f.id })); }

export default async function PublicMatch({ params }: { params: Promise<{ fixtureId: string }> }) {
  const { fixtureId } = await params;
  const fixture = DEMO_FIXTURES.find((f) => f.id === fixtureId);
  if (!fixture) notFound();
  const teams = DEMO_TEAMS.filter((t) => t.division_id === fixture.division_id);
  const divFixtures = DEMO_FIXTURES.filter((f) => f.division_id === fixture.division_id);
  const team = (id: string) => teams.find((t) => t.id === id)!;
  return (
    <MatchDetail
      tournamentName="Liga de ejemplo"
      divisionName={DEMO_DIVISIONS.find((d) => d.id === fixture.division_id)?.name ?? null}
      fixture={fixture} home={team(fixture.home_team_id)} away={team(fixture.away_team_id)}
      venueName={fixture.venue_id}
      goals={[]} players={[]}
      standings={computeStandings(teams, divFixtures)}
      teams={Object.fromEntries(teams.map((t) => [t.id, { name: t.name, crestUrl: null }]))}
      form={{ home: teamForm(fixture.home_team_id, divFixtures, fixture.id), away: teamForm(fixture.away_team_id, divFixtures, fixture.id) }}
      upcoming={{ home: teamUpcoming(fixture.home_team_id, divFixtures, fixture.id), away: teamUpcoming(fixture.away_team_id, divFixtures, fixture.id) }}
      baseHref="/partidos"
      cta={{ href: "/registro", label: "Crea tu torneo para transmitir y resumir con IA" }}
    />
  );
}
