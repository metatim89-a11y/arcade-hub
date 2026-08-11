create table public.player_game_stats (
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id text not null check (game_id in (
    'wheel', 'crash', 'blackjack', 'poker', 'keno', 'plinko', 'slots', 'fishing', 'coinpusher',
    'worm', 'connect4', 'rubikscube', 'mancala', 'rps', 'tictactoe'
  )),
  play_count bigint not null default 0 check (play_count >= 0),
  coins_spent numeric not null default 0 check (coins_spent >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, game_id)
);

alter table public.player_game_stats enable row level security;

create policy players_or_admins_read_game_stats on public.player_game_stats
for select to authenticated
using (
  (select auth.uid()) = user_id
  or exists (select 1 from public.admin_users where user_id = (select auth.uid()))
);

revoke all on table public.player_game_stats from public, anon, authenticated;
grant select on table public.player_game_stats to authenticated;

create index player_game_stats_game_id_idx on public.player_game_stats (game_id);

create function private.game_id_from_transaction_reason(p_reason text)
returns text language sql immutable security invoker set search_path = '' as $$
  select case
    when lower(p_reason) like '%coin pusher%' then 'coinpusher'
    when lower(p_reason) like '%blackjack%' or lower(p_reason) in ('dealer bust', 'win', 'push') then 'blackjack'
    when lower(p_reason) like '%wheel%' then 'wheel'
    when lower(p_reason) like '%crash%' then 'crash'
    when lower(p_reason) like '%holdem%' or lower(p_reason) like '%poker%' then 'poker'
    when lower(p_reason) like '%keno%' then 'keno'
    when lower(p_reason) like '%plinko%' then 'plinko'
    when lower(p_reason) like '%slot%' then 'slots'
    when lower(p_reason) like '%ocean%' or lower(p_reason) like '%fishing%' then 'fishing'
    when lower(p_reason) like '%worm%' then 'worm'
    when lower(p_reason) like '%connect four%' then 'connect4'
    when lower(p_reason) like '%color recall%' or lower(p_reason) like '%rubik%' then 'rubikscube'
    when lower(p_reason) like '%mancala%' then 'mancala'
    when lower(p_reason) like '%rps%' then 'rps'
    when lower(p_reason) like '%tic tac toe%' then 'tictactoe'
    else null
  end;
$$;

create function private.track_game_opened()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.event_type = 'game_opened'
     and new.user_id is not null
     and new.game_id in (
       'wheel', 'crash', 'blackjack', 'poker', 'keno', 'plinko', 'slots', 'fishing', 'coinpusher',
       'worm', 'connect4', 'rubikscube', 'mancala', 'rps', 'tictactoe'
     ) then
    insert into public.player_game_stats (user_id, game_id, play_count)
    values (new.user_id, new.game_id, 1)
    on conflict (user_id, game_id) do update
    set play_count = public.player_game_stats.play_count + 1,
        updated_at = now();
  end if;
  return new;
end;
$$;

create trigger track_game_opened_after_insert
after insert on public.site_events
for each row execute function private.track_game_opened();

create function private.track_game_coin_spend()
returns trigger language plpgsql security definer set search_path = '' as $$
declare tracked_game_id text;
begin
  if new.transaction_type <> 'debit' or new.currency <> 'fun' then return new; end if;
  tracked_game_id := private.game_id_from_transaction_reason(new.reason);
  if tracked_game_id is not null then
    insert into public.player_game_stats (user_id, game_id, coins_spent)
    values (new.user_id, tracked_game_id, new.amount)
    on conflict (user_id, game_id) do update
    set coins_spent = public.player_game_stats.coins_spent + new.amount,
        updated_at = now();
  end if;
  return new;
end;
$$;

create trigger track_game_coin_spend_after_insert
after insert on public.coin_transactions
for each row execute function private.track_game_coin_spend();

insert into public.player_game_stats (user_id, game_id, play_count)
select user_id, game_id, count(*)
from public.site_events
where event_type = 'game_opened' and user_id is not null and game_id in (
  'wheel', 'crash', 'blackjack', 'poker', 'keno', 'plinko', 'slots', 'fishing', 'coinpusher',
  'worm', 'connect4', 'rubikscube', 'mancala', 'rps', 'tictactoe'
)
group by user_id, game_id
on conflict (user_id, game_id) do update
set play_count = excluded.play_count,
    updated_at = now();

insert into public.player_game_stats (user_id, game_id, coins_spent)
select user_id, private.game_id_from_transaction_reason(reason), sum(amount)
from public.coin_transactions
where transaction_type = 'debit'
  and currency = 'fun'
  and private.game_id_from_transaction_reason(reason) is not null
group by user_id, private.game_id_from_transaction_reason(reason)
on conflict (user_id, game_id) do update
set coins_spent = excluded.coins_spent,
    updated_at = now();

revoke all on function private.game_id_from_transaction_reason(text) from public, anon, authenticated;
revoke all on function private.track_game_opened() from public, anon, authenticated;
revoke all on function private.track_game_coin_spend() from public, anon, authenticated;
