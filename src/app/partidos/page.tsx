import type { Metadata } from "next";
import MatchesView from "@/components/matches/MatchesView";
import { DEMO_DIVISIONS, DEMO_FIXTURES, DEMO_TEAMS } from "@/lib/demo-league";

export const metadata: Metadata = { title: "Partidos · VeoSoccer", description: "Así se ve el rol de juegos de tu torneo en VeoSoccer (liga de ejemplo)." };

export default function PublicMatches() {
  return <MatchesView title="Liga de ejemplo · Partidos" divisions={DEMO_DIVISIONS} teams={DEMO_TEAMS} fixtures={DEMO_FIXTURES} baseHref="/partidos" backHref="/" backLabel="← Inicio" />;
}
