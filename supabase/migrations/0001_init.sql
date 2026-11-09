-- VeoSoccer: esquema inicial (equipos, partidos, eventos, clips, notas)
create type team_role as enum ('owner','coach','analyst','player','viewer');
create type event_type as enum ('goal','shot','corner','free_kick','foul','save','custom');

create table teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);

create table team_members (
  team_id uuid references teams(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role team_role not null default 'viewer',
  primary key (team_id, user_id)
);

create table matches (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  title text not null,
  opponent text,
  played_at timestamptz,
  video_path text,            -- ruta en Supabase Storage (bucket "matches")
  duration_seconds integer,
  created_by uuid not null references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);

create table match_events (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  type event_type not null,
  at_seconds numeric not null check (at_seconds >= 0),
  team_side text check (team_side in ('home','away')),
  player text,
  source text not null default 'manual' check (source in ('manual','ai')),
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);

create table clips (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  title text not null,
  start_seconds numeric not null,
  end_seconds numeric not null check (end_seconds > start_seconds),
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);

create table notes (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  at_seconds numeric,
  body text not null,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);

-- Función auxiliar: ¿el usuario pertenece al equipo?
create function is_team_member(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from team_members where team_id = t and user_id = auth.uid());
$$;

create function is_team_editor(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from team_members
    where team_id = t and user_id = auth.uid() and role in ('owner','coach','analyst'));
$$;

-- El creador de un equipo queda como owner
create function add_owner_member() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into team_members(team_id, user_id, role) values (new.id, new.created_by, 'owner');
  return new;
end $$;
create trigger teams_add_owner after insert on teams
  for each row execute function add_owner_member();

alter table teams enable row level security;
alter table team_members enable row level security;
alter table matches enable row level security;
alter table match_events enable row level security;
alter table clips enable row level security;
alter table notes enable row level security;

create policy teams_select on teams for select using (is_team_member(id));
create policy teams_insert on teams for insert with check (created_by = auth.uid());
create policy teams_update on teams for update using (is_team_editor(id));

create policy members_select on team_members for select using (is_team_member(team_id));
create policy members_manage on team_members for all
  using (exists (select 1 from team_members m where m.team_id = team_members.team_id
                 and m.user_id = auth.uid() and m.role = 'owner'));

create policy matches_select on matches for select using (is_team_member(team_id));
create policy matches_write on matches for all
  using (is_team_editor(team_id)) with check (is_team_editor(team_id));

create policy events_select on match_events for select
  using (exists (select 1 from matches m where m.id = match_id and is_team_member(m.team_id)));
create policy events_write on match_events for all
  using (exists (select 1 from matches m where m.id = match_id and is_team_editor(m.team_id)))
  with check (exists (select 1 from matches m where m.id = match_id and is_team_editor(m.team_id)));

create policy clips_select on clips for select
  using (exists (select 1 from matches m where m.id = match_id and is_team_member(m.team_id)));
create policy clips_write on clips for all
  using (exists (select 1 from matches m where m.id = match_id and is_team_editor(m.team_id)))
  with check (exists (select 1 from matches m where m.id = match_id and is_team_editor(m.team_id)));

create policy notes_select on notes for select
  using (exists (select 1 from matches m where m.id = match_id and is_team_member(m.team_id)));
create policy notes_write on notes for all
  using (exists (select 1 from matches m where m.id = match_id and is_team_editor(m.team_id)))
  with check (exists (select 1 from matches m where m.id = match_id and is_team_editor(m.team_id)));

create index on matches(team_id);
create index on match_events(match_id, at_seconds);
create index on clips(match_id);
create index on notes(match_id);
