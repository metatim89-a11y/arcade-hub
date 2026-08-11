alter table public.player_balances
  add column tickets bigint not null default 25 check (tickets >= 0);

create table public.player_progression (
  user_id uuid primary key references auth.users(id) on delete cascade,
  experience bigint not null default 0 check (experience >= 0),
  level integer not null default 1 check (level between 1 and 1000),
  powerups integer not null default 0 check (powerups >= 0),
  last_faucet_claimed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.progression_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  coins_sacrificed bigint not null default 0 check (coins_sacrificed >= 0),
  tickets_sacrificed bigint not null default 0 check (tickets_sacrificed >= 0),
  experience_gained bigint not null check (experience_gained > 0),
  level_before integer not null check (level_before >= 1),
  level_after integer not null check (level_after >= level_before),
  created_at timestamptz not null default now()
);

alter table public.player_progression enable row level security;
alter table public.progression_events enable row level security;

create policy players_or_admins_read_progression on public.player_progression
for select to authenticated
using (
  (select auth.uid()) = user_id
  or exists (select 1 from public.admin_users where user_id = (select auth.uid()))
);

create policy players_or_admins_read_progression_events on public.progression_events
for select to authenticated
using (
  (select auth.uid()) = user_id
  or exists (select 1 from public.admin_users where user_id = (select auth.uid()))
);

revoke all on table public.player_progression from public, anon, authenticated;
revoke all on table public.progression_events from public, anon, authenticated;
grant select on table public.player_progression to authenticated;
grant select on table public.progression_events to authenticated;

create index progression_events_user_created_at_idx
on public.progression_events (user_id, created_at desc);

insert into public.player_progression (user_id)
select id from auth.users
on conflict (user_id) do nothing;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 40), ''));
  insert into public.player_balances (user_id) values (new.id);
  insert into public.player_progression (user_id) values (new.id);
  return new;
end;
$$;

create function private.level_for_experience(p_experience bigint)
returns integer language sql immutable security invoker set search_path = '' as $$
  select least(1000, floor(sqrt(greatest(p_experience, 0)::numeric / 250))::integer + 1);
$$;

create function private.sacrifice_for_experience(
  p_user_id uuid,
  p_coins bigint,
  p_tickets bigint
)
returns table(
  fun_coins numeric,
  tickets bigint,
  experience bigint,
  level integer,
  powerups integer,
  experience_gained bigint,
  levels_gained integer,
  next_level_experience bigint,
  faucet_amount integer,
  faucet_powerups integer,
  next_faucet_at timestamptz
)
language plpgsql security definer set search_path = '' as $$
declare
  current_balance public.player_balances;
  current_progress public.player_progression;
  gained_experience bigint;
  new_experience bigint;
  new_level integer;
  gained_levels integer;
begin
  if (select auth.uid()) is null or (select auth.uid()) <> p_user_id then
    raise exception 'Player access required' using errcode = '42501';
  end if;
  if p_coins < 0 or p_tickets < 0 or (p_coins = 0 and p_tickets = 0) then
    raise exception 'Choose coins or tickets to sacrifice';
  end if;
  if p_coins > 1000000 or p_tickets > 10000 then
    raise exception 'Sacrifice is above the allowed limit';
  end if;

  gained_experience := (p_coins / 10) + (p_tickets * 50);
  if gained_experience < 1 then
    raise exception 'Sacrifice at least 10 coins or 1 ticket';
  end if;

  select * into current_balance
  from public.player_balances
  where user_id = p_user_id
  for update;
  select * into current_progress
  from public.player_progression
  where user_id = p_user_id
  for update;

  if current_balance.user_id is null or current_progress.user_id is null then
    raise exception 'Player progression account is missing';
  end if;
  if current_balance.fun_coins < p_coins or current_balance.tickets < p_tickets then
    raise exception 'Not enough coins or tickets';
  end if;

  new_experience := current_progress.experience + gained_experience;
  new_level := private.level_for_experience(new_experience);
  gained_levels := greatest(0, new_level - current_progress.level);

  update public.player_balances
  set fun_coins = fun_coins - p_coins,
      tickets = tickets - p_tickets,
      updated_at = now()
  where user_id = p_user_id
  returning * into current_balance;

  update public.player_progression
  set experience = new_experience,
      level = new_level,
      powerups = powerups + (gained_levels * 2),
      updated_at = now()
  where user_id = p_user_id
  returning * into current_progress;

  if p_coins > 0 then
    insert into public.coin_transactions (user_id, currency, transaction_type, amount, reason)
    values (p_user_id, 'fun', 'debit', p_coins, 'XP Sacrifice');
  end if;

  insert into public.progression_events (
    user_id, coins_sacrificed, tickets_sacrificed, experience_gained, level_before, level_after
  ) values (
    p_user_id, p_coins, p_tickets, gained_experience, new_level - gained_levels, new_level
  );

  return query select
    current_balance.fun_coins,
    current_balance.tickets,
    current_progress.experience,
    current_progress.level,
    current_progress.powerups,
    gained_experience,
    gained_levels,
    (250::bigint * current_progress.level * current_progress.level),
    least(1000, 100 + ((current_progress.level - 1) * 25)),
    least(5, 1 + ((current_progress.level - 1) / 5)),
    case when current_progress.last_faucet_claimed_at is null then now()
         else current_progress.last_faucet_claimed_at + interval '4 hours' end;
end;
$$;

create function private.claim_level_faucet(p_user_id uuid)
returns table(
  fun_coins numeric,
  tickets bigint,
  experience bigint,
  level integer,
  powerups integer,
  experience_gained bigint,
  levels_gained integer,
  next_level_experience bigint,
  faucet_amount integer,
  faucet_powerups integer,
  next_faucet_at timestamptz
)
language plpgsql security definer set search_path = '' as $$
declare
  current_balance public.player_balances;
  current_progress public.player_progression;
  reward_coins integer;
  reward_powerups integer;
begin
  if (select auth.uid()) is null or (select auth.uid()) <> p_user_id then
    raise exception 'Player access required' using errcode = '42501';
  end if;

  select * into current_progress
  from public.player_progression
  where user_id = p_user_id
  for update;
  if current_progress.user_id is null then raise exception 'Player progression account is missing'; end if;
  if current_progress.last_faucet_claimed_at is not null
     and current_progress.last_faucet_claimed_at + interval '4 hours' > now() then
    raise exception 'Level faucet is still refilling';
  end if;

  reward_coins := least(1000, 100 + ((current_progress.level - 1) * 25));
  reward_powerups := least(5, 1 + ((current_progress.level - 1) / 5));

  update public.player_balances
  set fun_coins = fun_coins + reward_coins, updated_at = now()
  where user_id = p_user_id
  returning * into current_balance;

  update public.player_progression
  set powerups = powerups + reward_powerups,
      last_faucet_claimed_at = now(),
      updated_at = now()
  where user_id = p_user_id
  returning * into current_progress;

  insert into public.coin_transactions (user_id, currency, transaction_type, amount, reason)
  values (p_user_id, 'fun', 'credit', reward_coins, 'Level Faucet');

  return query select
    current_balance.fun_coins,
    current_balance.tickets,
    current_progress.experience,
    current_progress.level,
    current_progress.powerups,
    0::bigint,
    0,
    (250::bigint * current_progress.level * current_progress.level),
    reward_coins,
    reward_powerups,
    current_progress.last_faucet_claimed_at + interval '4 hours';
end;
$$;

revoke all on function private.level_for_experience(bigint) from public, anon;
revoke all on function private.sacrifice_for_experience(uuid, bigint, bigint) from public, anon;
revoke all on function private.claim_level_faucet(uuid) from public, anon;
grant execute on function private.sacrifice_for_experience(uuid, bigint, bigint) to authenticated;
grant execute on function private.claim_level_faucet(uuid) to authenticated;

create function public.sacrifice_for_experience(p_user_id uuid, p_coins bigint, p_tickets bigint)
returns table(
  fun_coins numeric, tickets bigint, experience bigint, level integer, powerups integer,
  experience_gained bigint, levels_gained integer, next_level_experience bigint,
  faucet_amount integer, faucet_powerups integer, next_faucet_at timestamptz
)
language sql security invoker set search_path = '' as $$
  select * from private.sacrifice_for_experience(p_user_id, p_coins, p_tickets);
$$;

create function public.claim_level_faucet(p_user_id uuid)
returns table(
  fun_coins numeric, tickets bigint, experience bigint, level integer, powerups integer,
  experience_gained bigint, levels_gained integer, next_level_experience bigint,
  faucet_amount integer, faucet_powerups integer, next_faucet_at timestamptz
)
language sql security invoker set search_path = '' as $$
  select * from private.claim_level_faucet(p_user_id);
$$;

revoke all on function public.sacrifice_for_experience(uuid, bigint, bigint) from public, anon;
revoke all on function public.claim_level_faucet(uuid) from public, anon;
grant execute on function public.sacrifice_for_experience(uuid, bigint, bigint) to authenticated;
grant execute on function public.claim_level_faucet(uuid) to authenticated;

revoke all on function public.handle_new_user() from public, anon, authenticated;
