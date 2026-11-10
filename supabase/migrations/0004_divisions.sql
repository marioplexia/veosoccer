-- Divisiones (categorías) dentro de un torneo: Reservas Premier, Segundas, Terceras...
-- Cada división tiene sus equipos, partidos y tabla. Las canchas se comparten en todo el torneo.
create table divisions (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique (id, tournament_id)
);
create unique index divisions_name_uq on divisions (tournament_id, lower(btrim(name)));
create index on divisions (tournament_id, position);

alter table divisions enable row level security;
create policy divisions_all on divisions for all
  using (is_tournament_owner(tournament_id)) with check (is_tournament_owner(tournament_id));

-- Los torneos existentes reciben una división "General" con todo lo que ya tenían.
insert into divisions (tournament_id, name) select id, 'General' from tournaments;

-- Equipos: pertenecen a una división. Un mismo nombre puede repetirse entre divisiones
-- (el mismo club con equipos en varias categorías), pero no dentro de una.
alter table tournament_teams add column division_id uuid;
update tournament_teams tt set division_id = d.id from divisions d where d.tournament_id = tt.tournament_id;
alter table tournament_teams alter column division_id set not null;
alter table tournament_teams add constraint tt_division_fk
  foreign key (division_id, tournament_id) references divisions (id, tournament_id) on delete cascade;
alter table tournament_teams add constraint tt_id_division_uq unique (id, division_id);
drop index tournament_teams_name_uq;
create unique index tournament_teams_name_uq on tournament_teams (division_id, lower(btrim(name)));

-- Partidos: pertenecen a una división y solo pueden enfrentar equipos de ella.
alter table fixtures
  add column division_id uuid,
  add column note text check (char_length(note) <= 200);   -- p. ej. "Gana X por default"
update fixtures f set division_id = t.division_id from tournament_teams t where t.id = f.home_team_id;
alter table fixtures alter column division_id set not null;

do $$
declare c record;
begin
  for c in select conname from pg_constraint
           where conrelid = 'fixtures'::regclass and contype = 'f' and confrelid = 'tournament_teams'::regclass
  loop
    execute format('alter table fixtures drop constraint %I', c.conname);
  end loop;
end $$;

alter table fixtures add constraint fixtures_home_fk
  foreign key (home_team_id, division_id) references tournament_teams (id, division_id) on delete cascade;
alter table fixtures add constraint fixtures_away_fk
  foreign key (away_team_id, division_id) references tournament_teams (id, division_id) on delete cascade;
alter table fixtures add constraint fixtures_division_fk
  foreign key (division_id, tournament_id) references divisions (id, tournament_id) on delete cascade;

create index on fixtures (division_id, round);
