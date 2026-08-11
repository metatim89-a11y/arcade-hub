revoke all on table public.profiles from anon, authenticated;
revoke all on table public.admin_users from anon, authenticated;
revoke all on table public.site_events from anon, authenticated;

grant select, update on table public.profiles to authenticated;
grant select on table public.admin_users to authenticated;
grant insert on table public.site_events to anon, authenticated;
grant usage, select on sequence public.site_events_id_seq to anon, authenticated;

create function public.get_admin_dashboard() returns jsonb language plpgsql security definer set search_path = '' as $$
declare dashboard jsonb;
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.admin_users where user_id = (select auth.uid())
  ) then
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
