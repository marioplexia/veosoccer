export type Tournament = { id: string; name: string; description: string | null; start_date: string | null };
export type Division = { id: string; name: string; position: number };
export type Team = { id: string; name: string; division_id: string; logo_path?: string | null; color?: string | null; color2?: string | null };
export type Player = { id: string; team_id: string; name: string; number: number | null; photo_path: string | null };
export type Venue = { id: string; name: string };
export type Fixture = {
  id: string;
  division_id: string;
  round: number;
  home_team_id: string;
  away_team_id: string;
  venue_id: string | null;
  kickoff: string | null; // "YYYY-MM-DDTHH:MM:SS" (hora local, sin zona)
  home_score: number | null;
  away_score: number | null;
  note: string | null;
};
export type Goal = { id: string; fixture_id: string; team_id: string; player_name: string; minute: number | null };
export type Sponsor = { id: string; name: string; image_path: string | null };
export type BroadcastSettingsView = { rtmp_url: string; key_hint: string | null; ad_every_minutes: number };
export type BrandRow = { kind: "tournament" | "broadcast"; settings: unknown; logo_path: string | null };
