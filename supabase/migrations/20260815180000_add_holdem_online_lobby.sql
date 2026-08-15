create table if not exists public.holdem_tables (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 3 and 32),
  owner_id uuid not null references auth.users(id) on delete cascade,
  max_players smallint not null default 4 check (max_players between 2 and 4),
  bot_count smallint not null default 0 check (bot_count between 0 and 3),
  small_blind integer not null default 10 check (small_blind > 0),
  big_blind integer not null default 20 check (big_blind = small_blind * 2),
  buy_in integer not null default 500 check (buy_in >= big_blind * 20),
  status text not null default 'waiting' check (status in ('waiting', 'playing', 'finished')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (bot_count < max_players)
);

create table if not exists public.holdem_table_seats (
  table_id uuid not null references public.holdem_tables(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  seat_number smallint not null check (seat_number between 0 and 3),
  joined_at timestamptz not null default now(),
  primary key (table_id, user_id),
  unique (table_id, seat_number)
);

alter table public.holdem_tables enable row level security;
alter table public.holdem_table_seats enable row level security;

create policy "authenticated players can browse holdem tables"
on public.holdem_tables for select to authenticated using (true);

create policy "authenticated players can browse holdem seats"
on public.holdem_table_seats for select to authenticated using (true);

grant select on public.holdem_tables to authenticated;
grant select on public.holdem_table_seats to authenticated;

create or replace function public.create_holdem_table(
  table_name text,
  requested_max_players smallint default 4,
  requested_bot_count smallint default 0,
  requested_small_blind integer default 10,
  requested_big_blind integer default 20,
  requested_buy_in integer default 500,
  player_name text default 'Player'
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  new_table_id uuid;
begin
  if caller is null then raise exception 'Sign in to create a table'; end if;
  if requested_max_players not between 2 and 4 then raise exception 'Table size must be 2 to 4'; end if;
  if requested_bot_count < 0 or requested_bot_count >= requested_max_players then raise exception 'Invalid bot count'; end if;
  if requested_small_blind <= 0 or requested_big_blind <> requested_small_blind * 2 then raise exception 'Invalid blinds'; end if;
  if requested_buy_in < requested_big_blind * 20 then raise exception 'Buy-in must be at least 20 big blinds'; end if;

  insert into public.holdem_tables(name, owner_id, max_players, bot_count, small_blind, big_blind, buy_in)
  values (left(trim(table_name), 32), caller, requested_max_players, requested_bot_count, requested_small_blind, requested_big_blind, requested_buy_in)
  returning id into new_table_id;

  insert into public.holdem_table_seats(table_id, user_id, display_name, seat_number)
  values (new_table_id, caller, left(trim(player_name), 40), 0);
  return new_table_id;
end;
$$;

create or replace function public.join_holdem_table(target_table_id uuid, player_name text default 'Player')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  target public.holdem_tables;
  next_seat smallint;
  human_count integer;
begin
  if caller is null then raise exception 'Sign in to join a table'; end if;
  select * into target from public.holdem_tables where id = target_table_id for update;
  if target.id is null or target.status <> 'waiting' then raise exception 'Table is not open'; end if;
  if exists(select 1 from public.holdem_table_seats where table_id = target_table_id and user_id = caller) then return; end if;
  select count(*) into human_count from public.holdem_table_seats where table_id = target_table_id;
  if human_count >= target.max_players - target.bot_count then raise exception 'Table is full'; end if;
  select seat into next_seat from generate_series(0, target.max_players - 1) seat
  where not exists(select 1 from public.holdem_table_seats s where s.table_id = target_table_id and s.seat_number = seat)
  order by seat limit 1;
  insert into public.holdem_table_seats(table_id, user_id, display_name, seat_number)
  values (target_table_id, caller, left(trim(player_name), 40), next_seat);
end;
$$;

create or replace function public.leave_holdem_table(target_table_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare caller uuid := auth.uid(); current_owner uuid;
begin
  if caller is null then raise exception 'Sign in to leave a table'; end if;
  select owner_id into current_owner from public.holdem_tables where id = target_table_id for update;
  delete from public.holdem_table_seats where table_id = target_table_id and user_id = caller;
  if current_owner = caller then
    delete from public.holdem_tables where id = target_table_id;
  end if;
end;
$$;

revoke all on function public.create_holdem_table(text, smallint, smallint, integer, integer, integer, text) from public, anon;
revoke all on function public.join_holdem_table(uuid, text) from public, anon;
revoke all on function public.leave_holdem_table(uuid) from public, anon;
grant execute on function public.create_holdem_table(text, smallint, smallint, integer, integer, integer, text) to authenticated;
grant execute on function public.join_holdem_table(uuid, text) to authenticated;
grant execute on function public.leave_holdem_table(uuid) to authenticated;

alter publication supabase_realtime add table public.holdem_tables;
alter publication supabase_realtime add table public.holdem_table_seats;

create index holdem_tables_owner_id_idx on public.holdem_tables(owner_id);
create index holdem_table_seats_user_id_idx on public.holdem_table_seats(user_id);
