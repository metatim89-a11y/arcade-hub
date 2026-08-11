alter table public.player_progression
  add column last_powerup_claimed_at timestamptz;

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
  update public.player_balances
  set fun_coins = fun_coins + reward_coins, updated_at = now()
  where user_id = p_user_id returning * into current_balance;
  update public.player_progression
  set last_faucet_claimed_at = now(), updated_at = now()
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
    least(5, 1 + ((current_progress.level - 1) / 5)),
    current_progress.last_faucet_claimed_at + interval '24 hours';
end;
$$;

create function private.claim_level_powerups(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  current_progress public.player_progression;
  reward_powerups integer;
begin
  if (select auth.uid()) is null or (select auth.uid()) <> p_user_id then
    raise exception 'Player access required' using errcode = '42501';
  end if;
  select * into current_progress from public.player_progression where user_id = p_user_id for update;
  if current_progress.user_id is null then raise exception 'Player progression account is missing'; end if;
  if current_progress.last_powerup_claimed_at is not null
     and current_progress.last_powerup_claimed_at + interval '4 hours' > now() then
    raise exception 'Power-up drop is still recharging';
  end if;

  reward_powerups := least(5, 1 + ((current_progress.level - 1) / 5));
  update public.player_progression
  set powerups = powerups + reward_powerups,
      last_powerup_claimed_at = now(),
      updated_at = now()
  where user_id = p_user_id
  returning * into current_progress;

  return jsonb_build_object(
    'powerups', current_progress.powerups,
    'rewardAmount', reward_powerups,
    'nextPowerupAt', current_progress.last_powerup_claimed_at + interval '4 hours'
  );
end;
$$;

revoke all on function private.claim_level_powerups(uuid) from public, anon;
grant execute on function private.claim_level_powerups(uuid) to authenticated;

create function public.claim_level_powerups(p_user_id uuid)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.claim_level_powerups(p_user_id);
$$;

revoke all on function public.claim_level_powerups(uuid) from public, anon;
grant execute on function public.claim_level_powerups(uuid) to authenticated;
