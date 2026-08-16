-- Protect virtual RC from client-authored credits. Fun coins intentionally remain
-- client-settled because they have no cash value; RC settlement is service/admin only.
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
  caller_is_admin boolean;
  caller_is_service boolean := coalesce((select auth.jwt() ->> 'role'), '') = 'service_role';
begin
  caller_is_admin := exists (
    select 1 from public.admin_users where user_id = (select auth.uid())
  );
  if not caller_is_service and ((select auth.uid()) is null or (select auth.uid()) <> p_user_id) then
    raise exception 'Player access required' using errcode = '42501';
  end if;
  if p_currency not in ('fun', 'real') then raise exception 'Invalid currency'; end if;
  if p_transaction_type not in ('credit', 'debit') then raise exception 'Invalid transaction type'; end if;
  if p_currency = 'real' and p_transaction_type = 'credit' and not caller_is_service and not caller_is_admin then
    raise exception 'Virtual RC credits require verified server settlement' using errcode = '42501';
  end if;
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

revoke all on function private.apply_coin_transaction(uuid, text, text, numeric, text) from public, anon, authenticated;
grant execute on function private.apply_coin_transaction(uuid, text, text, numeric, text) to service_role;

create or replace function public.apply_coin_transaction(
  p_user_id uuid,
  p_currency text,
  p_transaction_type text,
  p_amount numeric,
  p_reason text
)
returns table(fun_coins numeric, real_coins numeric)
language sql security definer set search_path = '' as $$
  select * from private.apply_coin_transaction(p_user_id, p_currency, p_transaction_type, p_amount, p_reason);
$$;

revoke all on function public.apply_coin_transaction(uuid, text, text, numeric, text) from public, anon;
grant execute on function public.apply_coin_transaction(uuid, text, text, numeric, text) to authenticated, service_role;
