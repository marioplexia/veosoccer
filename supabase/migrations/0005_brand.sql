-- Marca del torneo y marca de transmisión: colores, tipografías y logo, por torneo.
create table brands (
  tournament_id uuid not null references tournaments(id) on delete cascade,
  kind text not null check (kind in ('tournament', 'broadcast')),
  settings jsonb not null default '{}'::jsonb
    check (jsonb_typeof(settings) = 'object' and pg_column_size(settings) < 20000),
  logo_path text check (logo_path is null or char_length(logo_path) <= 300),
  updated_at timestamptz not null default now(),
  primary key (tournament_id, kind)
);

alter table brands enable row level security;
create policy brands_all on brands for all
  using (is_tournament_owner(tournament_id)) with check (is_tournament_owner(tournament_id));

create function touch_brand() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger brands_touch before update on brands for each row execute function touch_brand();

-- Logos: bucket público de lectura (los logos se muestran en transmisiones), escritura solo del dueño.
-- Ruta obligatoria: <id-del-torneo>/<archivo>. Máx. 1 MB; solo PNG, JPEG o WebP (sin SVG, que puede llevar scripts).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('brand-logos', 'brand-logos', true, 1048576, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy brand_logos_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'brand-logos'
    and case when (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
             then public.is_tournament_owner(((storage.foldername(name))[1])::uuid) else false end
  );
create policy brand_logos_update on storage.objects for update to authenticated
  using (
    bucket_id = 'brand-logos'
    and case when (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
             then public.is_tournament_owner(((storage.foldername(name))[1])::uuid) else false end
  );
create policy brand_logos_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'brand-logos'
    and case when (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
             then public.is_tournament_owner(((storage.foldername(name))[1])::uuid) else false end
  );
