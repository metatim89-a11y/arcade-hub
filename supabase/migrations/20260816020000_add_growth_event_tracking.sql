alter table public.site_events
  add column if not exists source text;

alter table public.site_events
  drop constraint if exists site_events_event_type_check;

alter table public.site_events
  add constraint site_events_event_type_check
  check (event_type in ('page_view', 'game_opened', 'game_completed', 'session_start', 'referral_visit', 'share_clicked'));

create index if not exists site_events_source_created_at_idx
  on public.site_events (source, created_at desc)
  where source is not null;
