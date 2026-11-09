-- Tablero del torneo: equipos, canchas, partidos, goles y registro de importaciones con IA.
alter table tournaments
  add column description text,
  add column start_date date;

create table tournament_teams (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  created_at timestamptz not null default now(),
  unique (id, tournament_id)
);
create unique index tournament_teams_name_uq on tournament_teams (tournament_id, lower(btrim(name)));

create table venues (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  created_at timestamptz not null default now(),
  unique (id, tournament_id)
);
create unique index venues_name_uq on venues (tournament_id, lower(btrim(name)));

create table fixtures (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  round integer not null default 1 check (round >= 1),
  home_team_id uuid not null,
  away_team_id uuid not null,
  venue_id uuid,
  kickoff timestamp,                      -- hora local "de pared", sin zona horaria
  home_score integer check (home_score >= 0),
  away_score integer check (away_score >= 0),
  created_at timestamptz not null default now(),
  check (home_team_id <> away_team_id),
  check ((home_score is null) = (away_score is null)),
  unique (id, tournament_id),
  foreign key (home_team_id, tournament_id) references tournament_teams (id, tournament_id) on delete cascade,
  foreign key (away_team_id, tournament_id) references tournament_teams (id, tournament_id) on delete cascade,
  foreign key (venue_id, tournament_id) references venues (id, tournament_id)
);

create table fixture_goals (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid not null references fixtures(id) on delete cascade,
  team_id uuid not null references tournament_teams(id) on delete cascade,
  player_name text not null check (char_length(btrim(player_name)) between 1 and 120),
  minute integer check (minute between 0 and 150),
  created_at timestamptz not null default now()
);

create table ai_import_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now()
);

create function is_tournament_owner(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from tournaments where id = t and owner_id = auth.uid());
$$;
revoke execute on function is_tournament_owner(uuid) from public, anon;
grant execute on function is_tournament_owner(uuid) to authenticated;

alter table tournament_teams enable row level security;
alter table venues enable row level security;
alter table fixtures enable row level security;
alter table fixture_goals enable row level security;
alter table ai_import_log enable row level security;

create policy tt_all on tournament_teams for all
  using (is_tournament_owner(tournament_id)) with check (is_tournament_owner(tournament_id));
create policy venues_all on venues for all
  using (is_tournament_owner(tournament_id)) with check (is_tournament_owner(tournament_id));
create policy fixtures_all on fixtures for all
  using (is_tournament_owner(tournament_id)) with check (is_tournament_owner(tournament_id));
create policy goals_all on fixture_goals for all
  using (exists (select 1 from fixtures f where f.id = fixture_id and is_tournament_owner(f.tournament_id)))
  with check (exists (select 1 from fixtures f where f.id = fixture_id and is_tournament_owner(f.tournament_id)));
create policy ai_log_select on ai_import_log for select using (user_id = auth.uid());
create policy ai_log_insert on ai_import_log for insert with check (user_id = auth.uid());

create index on tournament_teams (tournament_id);
create index on venues (tournament_id);
create index on fixtures (tournament_id, round);
create index on fixture_goals (fixture_id);
create index on ai_import_log (user_id, created_at);
