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
    'gameActivity', coalesce((select jsonb_agg(jsonb_build_object('gameId', game_id, 'launches', launches) order by launches desc) from (select game_id, count(*) as launches from public.site_events where event_type = 'game_opened' and game_id is not null group by game_id limit 5) game_totals), '[]'::jsonb),
    'recentEvents', coalesce((select jsonb_agg(jsonb_build_object('eventType', event_type, 'gameId', game_id, 'createdAt', created_at) order by created_at desc) from (select event_type, game_id, created_at from public.site_events order by created_at desc limit 8) recent), '[]'::jsonb),
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

revoke all on function public.get_admin_dashboard() from public, anon;
grant execute on function public.get_admin_dashboard() to authenticated;
