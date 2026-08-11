create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (char_length(display_name) between 1 and 40),
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz
);

create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.site_events (
  id bigint generated always as identity primary key,
  visitor_id uuid not null,
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in ('page_view', 'game_opened', 'game_completed')),
  game_id text check (game_id is null or char_length(game_id) between 1 and 64),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.admin_users enable row level security;
alter table public.site_events enable row level security;

create policy players_read_own_profile on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy players_update_own_profile on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy admins_read_their_assignment on public.admin_users for select to authenticated using ((select auth.uid()) = user_id);
create policy anonymous_visitors_record_events on public.site_events for insert to anon with check (user_id is null);
create policy players_record_own_events on public.site_events for insert to authenticated with check (user_id is null or user_id = (select auth.uid()));

create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 40), ''));
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create function public.set_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
