-- RETURNS TABLE output parameters are PL/pgSQL variables. Qualify columns that
-- share those names so PostgreSQL never has to choose between them.

create or replace function private.apply_coin_transaction(
  p_user_id uuid,
  p_currency text,
  p_transaction_type text,
  p_amount numeric,
  p_reason text
)
returns table(fun_coins numeric, real_coins numeric)
language plpgsql security definer set search_path = '' as $$
declare
  updated_balance public.player_balances;
begin
  if (select auth.uid()) is null or (select auth.uid()) <> p_user_id then
    raise exception 'Player access required' using errcode = '42501';
  end if;
  if p_currency not in ('fun', 'real') then raise exception 'Invalid currency'; end if;
  if p_transaction_type not in ('credit', 'debit') then raise exception 'Invalid transaction type'; end if;
  if p_amount <= 0 or p_amount > 1000000 then raise exception 'Invalid amount'; end if;
  if char_length(trim(p_reason)) not between 1 and 120 then raise exception 'Invalid reason'; end if;

  update public.player_balances as balance
  set fun_coins = case
        when p_currency = 'fun' and p_transaction_type = 'credit' then balance.fun_coins + p_amount
        when p_currency = 'fun' then balance.fun_coins - p_amount
        else balance.fun_coins
      end,
      real_coins = case
        when p_currency = 'real' and p_transaction_type = 'credit' then balance.real_coins + p_amount
        when p_currency = 'real' then balance.real_coins - p_amount
        else balance.real_coins
      end,
      updated_at = now()
  where balance.user_id = p_user_id
    and (
      p_transaction_type = 'credit'
      or (p_currency = 'fun' and balance.fun_coins >= p_amount)
      or (p_currency = 'real' and balance.real_coins >= p_amount)
    )
  returning balance.* into updated_balance;

  if not found then raise exception 'Insufficient balance or missing player account'; end if;

  insert into public.coin_transactions (user_id, currency, transaction_type, amount, reason)
  values (p_user_id, p_currency, p_transaction_type, p_amount, trim(p_reason));

  return query select updated_balance.fun_coins, updated_balance.real_coins;
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

  select balance.* into current_balance
  from public.player_balances as balance
  where balance.user_id = p_user_id
  for update;

  select progress.* into current_progress
  from public.player_progression as progress
  where progress.user_id = p_user_id
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

  update public.player_balances as balance
  set fun_coins = balance.fun_coins - p_coins,
      tickets = balance.tickets - p_tickets,
      updated_at = now()
  where balance.user_id = p_user_id
  returning balance.* into current_balance;

  update public.player_progression as progress
  set experience = new_experience,
      level = new_level,
      powerups = progress.powerups + (gained_levels * 2),
      updated_at = now()
  where progress.user_id = p_user_id
  returning progress.* into current_progress;

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
begin
  if (select auth.uid()) is null or (select auth.uid()) <> p_user_id then
    raise exception 'Player access required' using errcode = '42501';
  end if;

  select progress.* into current_progress
  from public.player_progression as progress
  where progress.user_id = p_user_id
  for update;

  if current_progress.user_id is null then raise exception 'Player progression account is missing'; end if;
  if current_progress.last_faucet_claimed_at is not null
     and current_progress.last_faucet_claimed_at + interval '24 hours' > now() then
    raise exception 'Daily level faucet has already been claimed';
  end if;

  reward_coins := private.daily_faucet_amount_for_level(current_progress.level);

  update public.player_balances as balance
  set fun_coins = balance.fun_coins + reward_coins,
      updated_at = now()
  where balance.user_id = p_user_id
  returning balance.* into current_balance;

  update public.player_progression as progress
  set last_faucet_claimed_at = now(),
      updated_at = now()
  where progress.user_id = p_user_id
  returning progress.* into current_progress;

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
