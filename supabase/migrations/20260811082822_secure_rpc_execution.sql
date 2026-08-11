create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create function private.apply_coin_transaction(p_user_id uuid, p_currency text, p_transaction_type text, p_amount numeric, p_reason text)
returns table(fun_coins numeric, real_coins numeric) language plpgsql security definer set search_path = '' as $$
declare updated_balance public.player_balances;
begin
  if (select auth.uid()) is null or (select auth.uid()) <> p_user_id then
    raise exception 'Player access required' using errcode = '42501';
  end if;
  if p_currency not in ('fun', 'real') then raise exception 'Invalid currency'; end if;
  if p_transaction_type not in ('credit', 'debit') then raise exception 'Invalid transaction type'; end if;
  if p_amount <= 0 or p_amount > 1000000 then raise exception 'Invalid amount'; end if;
  if char_length(trim(p_reason)) not between 1 and 120 then raise exception 'Invalid reason'; end if;
  update public.player_balances set
    fun_coins = case when p_currency = 'fun' and p_transaction_type = 'credit' then fun_coins + p_amount when p_currency = 'fun' then fun_coins - p_amount else fun_coins end,
    real_coins = case when p_currency = 'real' and p_transaction_type = 'credit' then real_coins + p_amount when p_currency = 'real' then real_coins - p_amount else real_coins end,
    updated_at = now()
  where user_id = p_user_id and (p_transaction_type = 'credit' or (p_currency = 'fun' and fun_coins >= p_amount) or (p_currency = 'real' and real_coins >= p_amount))
  returning * into updated_balance;
  if not found then raise exception 'Insufficient balance or missing player account'; end if;
  insert into public.coin_transactions (user_id, currency, transaction_type, amount, reason)
  values (p_user_id, p_currency, p_transaction_type, p_amount, trim(p_reason));
  return query select updated_balance.fun_coins, updated_balance.real_coins;
end;
$$;

revoke all on function private.apply_coin_transaction(uuid, text, text, numeric, text) from public, anon;
grant execute on function private.apply_coin_transaction(uuid, text, text, numeric, text) to authenticated;

create or replace function public.apply_coin_transaction(p_user_id uuid, p_currency text, p_transaction_type text, p_amount numeric, p_reason text)
returns table(fun_coins numeric, real_coins numeric) language sql security invoker set search_path = '' as $$
  select * from private.apply_coin_transaction(p_user_id, p_currency, p_transaction_type, p_amount, p_reason);
$$;
revoke all on function public.apply_coin_transaction(uuid, text, text, numeric, text) from public, anon;
grant execute on function public.apply_coin_transaction(uuid, text, text, numeric, text) to authenticated;

grant select on table public.site_events to authenticated;
create policy admins_read_site_events on public.site_events for select to authenticated
using (exists (select 1 from public.admin_users where user_id = (select auth.uid())));

create or replace function public.get_admin_dashboard() returns jsonb language plpgsql security invoker set search_path = '' as $$
declare dashboard jsonb;
begin
  if (select auth.uid()) is null or not exists (select 1 from public.admin_users where user_id = (select auth.uid())) then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'totals', jsonb_build_object(
      'players', (select count(*) from public.profiles),
      'events', (select count(*) from public.site_events),
      'uniqueVisitors', (select count(distinct visitor_id) from public.site_events)
    ),
    'eventsByType', coalesce((select jsonb_object_agg(event_type, event_count) from (
      select event_type, count(*) as event_count from public.site_events group by event_type
    ) event_totals), '{}'::jsonb),
    'players', coalesce((select jsonb_agg(jsonb_build_object(
      'id', id, 'displayName', display_name, 'status', status,
      'createdAt', created_at, 'lastSeenAt', last_seen_at
    ) order by created_at desc) from public.profiles), '[]'::jsonb)
  ) into dashboard;
  return dashboard;
end;
$$;
revoke all on function public.get_admin_dashboard() from public, anon;
grant execute on function public.get_admin_dashboard() to authenticated;

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;
