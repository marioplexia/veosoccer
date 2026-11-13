-- Video de los partidos: grabaciones en la nube (por segmentos) y clips automáticos de cada gol.
-- Todo es privado: solo el dueño del torneo sube, lee y borra.

create table recordings (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  fixture_id uuid not null references fixtures(id) on delete cascade,
  mime text not null check (mime in ('video/webm', 'video/mp4')),
  status text not null default 'recording' check (status in ('recording', 'complete')),
  created_at timestamptz not null default now()
);
create index on recordings (fixture_id);

-- Cada segmento es un archivo de video que se reproduce solo; juntos forman el partido.
create table recording_segments (
  recording_id uuid not null references recordings(id) on delete cascade,
  idx integer not null check (idx between 0 and 2000),
  path text not null check (char_length(path) <= 300),
  duration_ms integer not null check (duration_ms between 0 and 600000),
  primary key (recording_id, idx)
);

create table match_clips (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  fixture_id uuid not null references fixtures(id) on delete cascade,
  kind text not null default 'goal' check (kind in ('goal')),
  side text not null check (side in ('home', 'away')),
  minute integer check (minute is null or minute between 0 and 150),
  player text check (player is null or char_length(player) <= 120),
  path text not null check (char_length(path) <= 300),
  mime text not null check (mime in ('video/webm', 'video/mp4')),
  created_at timestamptz not null default now()
);
create index on match_clips (fixture_id);

alter table recordings enable row level security;
alter table recording_segments enable row level security;
alter table match_clips enable row level security;

create policy recordings_all on recordings for all
  using (is_tournament_owner(tournament_id)) with check (is_tournament_owner(tournament_id));
create policy recording_segments_all on recording_segments for all
  using (exists (select 1 from recordings r where r.id = recording_id and is_tournament_owner(r.tournament_id)))
  with check (exists (select 1 from recordings r where r.id = recording_id and is_tournament_owner(r.tournament_id)));
create policy match_clips_all on match_clips for all
  using (is_tournament_owner(tournament_id)) with check (is_tournament_owner(tournament_id));

-- Almacenamiento privado. Rutas: <torneo>/<partido>/rec/<grabación>/<n>.webm y <torneo>/<partido>/clips/<id>.webm
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('match-video', 'match-video', false, 52428800, array['video/webm', 'video/mp4'])
on conflict (id) do nothing;

create policy match_video_select on storage.objects for select to authenticated
  using (bucket_id = 'match-video'
    and case when (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
             then public.is_tournament_owner(((storage.foldername(name))[1])::uuid) else false end);
create policy match_video_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'match-video'
    and case when (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
             then public.is_tournament_owner(((storage.foldername(name))[1])::uuid) else false end);
create policy match_video_delete on storage.objects for delete to authenticated
  using (bucket_id = 'match-video'
    and case when (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
             then public.is_tournament_owner(((storage.foldername(name))[1])::uuid) else false end);
