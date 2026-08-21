create or replace function private.set_admin_player_tickets(p_user_id uuid, p_tickets bigint)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_balance bigint;
begin
  if (select auth.uid()) is null or not exists (select 1 from public.admin_users where user_id = (select auth.uid())) then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if p_user_id = (select auth.uid()) then raise exception 'Use your own account controls'; end if;
  if p_tickets < 0 or p_tickets > 10000000 then raise exception 'Tickets must be between 0 and 10,000,000'; end if;

  select tickets into previous_balance from public.player_balances where user_id = p_user_id for update;
  if not found then raise exception 'Player balance not found'; end if;

  update public.player_balances set tickets = p_tickets, updated_at = now() where user_id = p_user_id;
  return p_tickets;
end;
$$;

create or replace function public.set_admin_player_tickets(p_user_id uuid, p_tickets bigint)
returns bigint
language sql
set search_path = ''
as $$
  select private.set_admin_player_tickets(p_user_id, p_tickets);
$$;

revoke all on function public.set_admin_player_tickets(uuid, bigint) from public, anon;
grant execute on function public.set_admin_player_tickets(uuid, bigint) to authenticated;

create or replace function private.redeem_ticket_package(p_user_id uuid, p_package_id text)
returns table(fun_coins numeric, real_coins numeric, tickets bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  package_cost bigint;
  fun_reward numeric;
  real_reward numeric;
  package_name text;
  current_tickets bigint;
begin
  if (select auth.uid()) is null or (select auth.uid()) <> p_user_id then
    raise exception 'You can only redeem packages for your own account' using errcode = '42501';
  end if;

  select
    case p_package_id when 'pkg1' then 250 when 'pkg2' then 500 when 'pkg3' then 1000 when 'pkg4' then 1500 when 'pkg5' then 2500 else null end,
    case p_package_id when 'pkg1' then 1000 when 'pkg2' then 2500 when 'pkg3' then 5000 when 'pkg4' then 8500 when 'pkg5' then 15000 else null end,
    case p_package_id when 'pkg1' then 10 when 'pkg2' then 25 when 'pkg3' then 50 when 'pkg4' then 85 when 'pkg5' then 150 else null end,
    case p_package_id when 'pkg1' then 'Micro Tip' when 'pkg2' then 'Snack Pack' when 'pkg3' then 'Starter Stack' when 'pkg4' then 'Arcade Boost' when 'pkg5' then 'Fan Supporter' else null end
  into package_cost, fun_reward, real_reward, package_name;

  if package_cost is null then raise exception 'Unknown ticket package'; end if;

  select pb.tickets into current_tickets from public.player_balances pb where pb.user_id = p_user_id for update;
  if not found then raise exception 'Player balance not found'; end if;
  if current_tickets < package_cost then raise exception 'Not enough tickets'; end if;

  update public.player_balances pb
  set tickets = pb.tickets - package_cost,
      fun_coins = pb.fun_coins + fun_reward,
      real_coins = pb.real_coins + real_reward,
      updated_at = now()
  where pb.user_id = p_user_id;

  insert into public.coin_transactions (user_id, currency, transaction_type, amount, reason)
  values
    (p_user_id, 'fun', 'credit', fun_reward, left('Ticket Shop: ' || package_name, 120)),
    (p_user_id, 'real', 'credit', real_reward, left('Ticket Shop: ' || package_name, 120));

  return query select pb.fun_coins, pb.real_coins, pb.tickets from public.player_balances pb where pb.user_id = p_user_id;
end;
$$;

create or replace function public.redeem_ticket_package(p_user_id uuid, p_package_id text)
returns table(fun_coins numeric, real_coins numeric, tickets bigint)
language sql
set search_path = ''
as $$
  select * from private.redeem_ticket_package(p_user_id, p_package_id);
$$;

revoke all on function public.redeem_ticket_package(uuid, text) from public, anon;
grant execute on function public.redeem_ticket_package(uuid, text) to authenticated;

create or replace function public.get_admin_dashboard()
returns jsonb
language plpgsql
set search_path = ''
as $$
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
    'eventsByType', coalesce((select jsonb_object_agg(event_type, event_count) from (select event_type, count(*) as event_count from public.site_events group by event_type) event_totals), '{}'::jsonb),
    'players', coalesce((select jsonb_agg(jsonb_build_object(
      'id', p.id,
      'displayName', p.display_name,
      'status', p.status,
      'createdAt', p.created_at,
      'lastSeenAt', p.last_seen_at,
      'funCoins', coalesce(b.fun_coins, 0),
      'tickets', coalesce(b.tickets, 0)
    ) order by p.created_at desc) from public.profiles p left join public.player_balances b on b.user_id = p.id), '[]'::jsonb)
  ) into dashboard;

  return dashboard;
end;
$$;
