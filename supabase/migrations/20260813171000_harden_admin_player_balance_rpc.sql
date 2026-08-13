create or replace function private.set_admin_player_fun_coins(p_user_id uuid, p_fun_coins numeric)
returns numeric language plpgsql security definer set search_path = '' as $$
declare previous_balance numeric;
begin
  if (select auth.uid()) is null or not exists (select 1 from public.admin_users where user_id = (select auth.uid())) then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if p_user_id = (select auth.uid()) then raise exception 'Use your own balance controls'; end if;
  if p_fun_coins < 0 or p_fun_coins > 1000000 then raise exception 'Fun Coins must be between 0 and 1,000,000'; end if;
  select fun_coins into previous_balance from public.player_balances where user_id = p_user_id for update;
  if not found then raise exception 'Player balance not found'; end if;
  update public.player_balances set fun_coins = round(p_fun_coins, 2), updated_at = now() where user_id = p_user_id;
  if previous_balance <> round(p_fun_coins, 2) then
    insert into public.coin_transactions (user_id, currency, transaction_type, amount, reason)
    values (p_user_id, 'fun', case when p_fun_coins >= previous_balance then 'credit' else 'debit' end, abs(round(p_fun_coins, 2) - previous_balance), 'Admin-set Fun Coin balance');
  end if;
  return round(p_fun_coins, 2);
end;
$$;

revoke all on function private.set_admin_player_fun_coins(uuid, numeric) from public, anon;
grant execute on function private.set_admin_player_fun_coins(uuid, numeric) to authenticated;

create or replace function public.set_admin_player_fun_coins(p_user_id uuid, p_fun_coins numeric)
returns numeric language sql security invoker set search_path = '' as $$
  select private.set_admin_player_fun_coins(p_user_id, p_fun_coins);
$$;

revoke all on function public.set_admin_player_fun_coins(uuid, numeric) from public, anon;
grant execute on function public.set_admin_player_fun_coins(uuid, numeric) to authenticated;
