create or replace function public.set_admin_player_fun_coins(p_user_id uuid, p_fun_coins numeric)
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

revoke all on function public.set_admin_player_fun_coins(uuid, numeric) from public, anon;
grant execute on function public.set_admin_player_fun_coins(uuid, numeric) to authenticated;

create or replace function public.get_admin_dashboard() returns jsonb language plpgsql security invoker set search_path = '' as $$
declare dashboard jsonb;
begin
  if (select auth.uid()) is null or not exists (select 1 from public.admin_users where user_id = (select auth.uid())) then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'totals', jsonb_build_object('players', (select count(*) from public.profiles), 'events', (select count(*) from public.site_events), 'uniqueVisitors', (select count(distinct visitor_id) from public.site_events)),
    'eventsByType', coalesce((select jsonb_object_agg(event_type, event_count) from (select event_type, count(*) as event_count from public.site_events group by event_type) event_totals), '{}'::jsonb),
    'players', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'displayName', p.display_name, 'status', p.status, 'createdAt', p.created_at, 'lastSeenAt', p.last_seen_at, 'funCoins', coalesce(b.fun_coins, 0)) order by p.created_at desc) from public.profiles p left join public.player_balances b on b.user_id = p.id), '[]'::jsonb)
  ) into dashboard;
  return dashboard;
end;
$$;
