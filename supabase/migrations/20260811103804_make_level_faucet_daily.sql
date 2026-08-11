create function private.daily_faucet_amount_for_level(p_level integer)
returns integer language sql immutable security invoker set search_path = '' as $$
  select case
    when p_level <= 1 then 75
    when p_level = 2 then 155
    when p_level = 3 then 210
    when p_level = 4 then 265
    when p_level = 5 then 415
    when p_level = 6 then 565
    when p_level = 7 then 783
    when p_level = 8 then 1000
    when p_level = 9 then 1500
    else 2000
  end;
$$;

create or replace function private.sacrifice_for_experience(
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

  select * into current_balance from public.player_balances where user_id = p_user_id for update;
  select * into current_progress from public.player_progression where user_id = p_user_id for update;
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
  set fun_coins = fun_coins - p_coins, tickets = tickets - p_tickets, updated_at = now()
  where user_id = p_user_id returning * into current_balance;

  update public.player_progression
  set experience = new_experience,
      level = new_level,
      powerups = powerups + (gained_levels * 2),
      updated_at = now()
  where user_id = p_user_id returning * into current_progress;

  if p_coins > 0 then
    insert into public.coin_transactions (user_id, currency, transaction_type, amount, reason)
    values (p_user_id, 'fun', 'debit', p_coins, 'XP Sacrifice');
  end if;
  insert into public.progression_events (
    user_id, coins_sacrificed, tickets_sacrificed, experience_gained, level_before, level_after
  ) values (p_user_id, p_coins, p_tickets, gained_experience, new_level - gained_levels, new_level);

  return query select
    current_balance.fun_coins,
    current_balance.tickets,
    current_progress.experience,
    current_progress.level,
    current_progress.powerups,
    gained_experience,
    gained_levels,
    (250::bigint * current_progress.level * current_progress.level),
    private.daily_faucet_amount_for_level(current_progress.level),
    least(5, 1 + ((current_progress.level - 1) / 5)),
    case when current_progress.last_faucet_claimed_at is null then now()
         else current_progress.last_faucet_claimed_at + interval '24 hours' end;
end;
$$;

create or replace function private.claim_level_faucet(p_user_id uuid)
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

  select * into current_progress from public.player_progression where user_id = p_user_id for update;
  if current_progress.user_id is null then raise exception 'Player progression account is missing'; end if;
  if current_progress.last_faucet_claimed_at is not null
     and current_progress.last_faucet_claimed_at + interval '24 hours' > now() then
    raise exception 'Daily level faucet has already been claimed';
  end if;

  reward_coins := private.daily_faucet_amount_for_level(current_progress.level);
  reward_powerups := least(5, 1 + ((current_progress.level - 1) / 5));

  update public.player_balances
  set fun_coins = fun_coins + reward_coins, updated_at = now()
  where user_id = p_user_id returning * into current_balance;
  update public.player_progression
  set powerups = powerups + reward_powerups, last_faucet_claimed_at = now(), updated_at = now()
  where user_id = p_user_id returning * into current_progress;

  insert into public.coin_transactions (user_id, currency, transaction_type, amount, reason)
  values (p_user_id, 'fun', 'credit', reward_coins, 'Daily Level Faucet');

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
    current_progress.last_faucet_claimed_at + interval '24 hours';
end;
$$;

revoke all on function private.daily_faucet_amount_for_level(integer) from public, anon, authenticated;
revoke all on function private.sacrifice_for_experience(uuid, bigint, bigint) from public, anon;
revoke all on function private.claim_level_faucet(uuid) from public, anon;
grant execute on function private.sacrifice_for_experience(uuid, bigint, bigint) to authenticated;
grant execute on function private.claim_level_faucet(uuid) to authenticated;
