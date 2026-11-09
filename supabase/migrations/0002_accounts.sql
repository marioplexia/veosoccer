-- Tipos de cuenta: dueño de club o dueño de torneo.
create type account_type as enum ('club_owner','tournament_owner');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  account_type account_type not null,
  created_at timestamptz not null default now()
);

create table tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;
alter table tournaments enable row level security;

create policy profiles_select_own on profiles for select using (id = auth.uid());
create policy profiles_update_own on profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

create policy tournaments_select_own on tournaments for select using (owner_id = auth.uid());
create policy tournaments_insert_own on tournaments for insert with check (owner_id = auth.uid());
create policy tournaments_update_own on tournaments for update
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy tournaments_delete_own on tournaments for delete using (owner_id = auth.uid());

create index on tournaments(owner_id);

-- Al registrarse: crea el perfil y la primera entidad (club o torneo).
-- Lee los datos que envía el formulario en raw_user_meta_data.
create function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_type account_type;
  v_org text;
begin
  v_type := case new.raw_user_meta_data->>'account_type'
    when 'tournament_owner' then 'tournament_owner'::account_type
    else 'club_owner'::account_type
  end;
  v_org := nullif(btrim(coalesce(new.raw_user_meta_data->>'org_name', '')), '');

  insert into profiles(id, full_name, account_type)
  values (new.id, left(coalesce(new.raw_user_meta_data->>'full_name', ''), 120), v_type);

  if v_org is not null then
    if v_type = 'club_owner' then
      insert into teams(name, created_by) values (left(v_org, 120), new.id);
    else
      insert into tournaments(name, owner_id) values (left(v_org, 120), new.id);
    end if;
  end if;

  return new;
end $$;

revoke execute on function handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
