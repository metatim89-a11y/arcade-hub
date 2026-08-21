-- Migration: 20260821055500_add_email_to_admin_dashboard.sql
-- Description: Update get_admin_dashboard to include email in player records and grant execute to anon/authenticated

create or replace function public.get_admin_dashboard()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  dashboard jsonb;
begin
  select jsonb_build_object(
    'totals', jsonb_build_object(
      'players', (select count(*) from public.profiles),
      'events', (select count(*) from public.site_events),
      'uniqueVisitors', (select count(distinct visitor_id) from public.site_events)
    ),
    'eventsByType', coalesce(
      (select jsonb_object_agg(event_type, event_count) from (select event_type, count(*) as event_count from public.site_events group by event_type) event_totals),
      '{}'::jsonb
    ),
    'players', coalesce(
      (select jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'displayName', p.display_name,
          'email', u.email,
          'status', coalesce(p.status, 'active'),
          'createdAt', p.created_at,
          'lastSeenAt', p.last_seen_at,
          'funCoins', coalesce(b.fun_coins, 0)
        )
        order by p.created_at desc
      )
      from public.profiles p
      left join auth.users u on u.id = p.id
      left join public.player_balances b on b.user_id = p.id),
      '[]'::jsonb
    )
  ) into dashboard;
  return dashboard;
end;
$$;

revoke all on function public.get_admin_dashboard() from public;
grant execute on function public.get_admin_dashboard() to anon, authenticated;
