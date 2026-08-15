alter table public.holdem_tables
  add column small_blind integer not null default 10 check (small_blind > 0),
  add column big_blind integer not null default 20,
  add column buy_in integer not null default 500;

alter table public.holdem_tables
  add constraint holdem_tables_blinds_check check (big_blind = small_blind * 2),
  add constraint holdem_tables_buy_in_check check (buy_in >= big_blind * 20);

drop function if exists public.create_holdem_table(text, smallint, smallint, text);

create function public.create_holdem_table(
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
declare caller uuid := auth.uid(); new_table_id uuid;
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

revoke all on function public.create_holdem_table(text, smallint, smallint, integer, integer, integer, text) from public, anon;
grant execute on function public.create_holdem_table(text, smallint, smallint, integer, integer, integer, text) to authenticated;

create index if not exists holdem_tables_owner_id_idx on public.holdem_tables(owner_id);
create index if not exists holdem_table_seats_user_id_idx on public.holdem_table_seats(user_id);
