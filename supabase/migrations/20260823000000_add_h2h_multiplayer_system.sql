-- Head-to-Head Multiplayer System with Real-Time Sync
-- Tables: h2h_matches, h2h_score_events, h2h_leaderboard, h2h_match_history

-- H2H Matches: Active and completed match records
create table public.h2h_matches (
  id uuid primary key default gen_random_uuid(),
  room_code text not null unique,
  game_id text not null,
  game_label text not null,
  host_user_id uuid not null references auth.users(id) on delete cascade,
  guest_user_id uuid references auth.users(id) on delete set null,
  stake_gc bigint not null default 0 check (stake_gc >= 0),
  status text not null default 'waiting' check (status in ('waiting', 'in_progress', 'completed', 'forfeited')),
  winner_id uuid references auth.users(id) on delete set null,
  host_final_score bigint default 0,
  guest_final_score bigint default 0,
  match_duration_seconds bigint default 60,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.h2h_matches enable row level security;

-- H2H Score Events: Real-time score updates during match
create table public.h2h_score_events (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.h2h_matches(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  score_delta bigint not null default 0,
  current_score bigint not null default 0,
  event_type text not null default 'score_update',
  game_data jsonb,
  created_at timestamptz not null default now()
);

alter table public.h2h_score_events enable row level security;

-- H2H Leaderboard: Player stats and ELO ratings
create table public.h2h_leaderboard (
  user_id uuid primary key references auth.users(id) on delete cascade,
  total_matches bigint not null default 0,
  wins bigint not null default 0,
  losses bigint not null default 0,
  elo_rating numeric(10,2) not null default 1500.00,
  total_gc_won numeric(18,2) not null default 0,
  total_gc_staked numeric(18,2) not null default 0,
  win_streak bigint not null default 0,
  last_match_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.h2h_leaderboard enable row level security;

-- H2H Match History: Archive of completed matches for replay/viewing
create table public.h2h_match_history (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.h2h_matches(id) on delete cascade,
  host_user_id uuid not null references auth.users(id) on delete set null,
  guest_user_id uuid references auth.users(id) on delete set null,
  game_id text not null,
  game_label text not null,
  stake_gc bigint not null,
  winner_id uuid references auth.users(id) on delete set null,
  host_final_score bigint not null,
  guest_final_score bigint not null,
  host_elo_before numeric(10,2),
  host_elo_after numeric(10,2),
  guest_elo_before numeric(10,2),
  guest_elo_after numeric(10,2),
  match_duration_seconds bigint,
  completed_at timestamptz not null default now()
);

alter table public.h2h_match_history enable row level security;

-- Row Level Security Policies

-- h2h_matches: Players can see their own matches and all waiting/in_progress matches
create policy "players can view own h2h matches"
on public.h2h_matches for select to authenticated
using (
  host_user_id = auth.uid()
  or guest_user_id = auth.uid()
  or status in ('waiting', 'in_progress')
);

create policy "authenticated can view waiting matches"
on public.h2h_matches for select to authenticated
using (status = 'waiting');

create policy "host can insert h2h matches"
on public.h2h_matches for insert to authenticated
with check (host_user_id = auth.uid());

create policy "match creator can update status"
on public.h2h_matches for update to authenticated
using (host_user_id = auth.uid() or guest_user_id = auth.uid())
with check (host_user_id = auth.uid() or guest_user_id = auth.uid());

-- h2h_score_events: Players in match can insert and view events
create policy "players can insert score events in their matches"
on public.h2h_score_events for insert to authenticated
with check (
  exists (
    select 1 from public.h2h_matches
    where id = match_id and (host_user_id = auth.uid() or guest_user_id = auth.uid())
  )
);

create policy "players can view score events in their matches"
on public.h2h_score_events for select to authenticated
using (
  exists (
    select 1 from public.h2h_matches m
    where m.id = match_id and (m.host_user_id = auth.uid() or m.guest_user_id = auth.uid())
  )
);

-- h2h_leaderboard: Everyone can view, only system can update
create policy "everyone can view h2h leaderboard"
on public.h2h_leaderboard for select to authenticated
using (true);

revoke update, delete on public.h2h_leaderboard from authenticated;

-- h2h_match_history: Authenticated users can view, archived data
create policy "authenticated can view h2h history"
on public.h2h_match_history for select to authenticated
using (true);

revoke insert, update, delete on public.h2h_match_history from authenticated;

-- Indexes for performance
create index idx_h2h_matches_status on public.h2h_matches(status);
create index idx_h2h_matches_host_user on public.h2h_matches(host_user_id);
create index idx_h2h_matches_guest_user on public.h2h_matches(guest_user_id);
create index idx_h2h_matches_room_code on public.h2h_matches(room_code);
create index idx_h2h_matches_created_at on public.h2h_matches(created_at desc);
create index idx_h2h_score_events_match_id on public.h2h_score_events(match_id);
create index idx_h2h_score_events_user_id on public.h2h_score_events(user_id);
create index idx_h2h_leaderboard_elo on public.h2h_leaderboard(elo_rating desc);
create index idx_h2h_leaderboard_wins on public.h2h_leaderboard(wins desc);

-- Enable Realtime for score events
alter publication supabase_realtime add table public.h2h_score_events;
alter publication supabase_realtime add table public.h2h_matches;

grant select on public.h2h_matches to authenticated;
grant insert, select on public.h2h_score_events to authenticated;
grant select on public.h2h_leaderboard to authenticated;
grant select on public.h2h_match_history to authenticated;
