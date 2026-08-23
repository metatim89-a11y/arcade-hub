-- H2H Backend RPC Functions
-- Provides secure server-side operations for match creation, joining, scoring, and completion

-- Function to create a new H2H match room
create or replace function public.create_h2h_match(
  p_game_id text,
  p_game_label text,
  p_stake_gc bigint,
  p_match_duration_seconds bigint default 60
)
returns table(id uuid, room_code text, status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_fun_coins numeric;
  v_room_code text;
  v_match_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  -- Validate stake
  if p_stake_gc < 0 or p_stake_gc > 10000 then
    raise exception 'Stake must be between 0 and 10000 GC' using errcode = '22003';
  end if;

  -- Check player has sufficient funds
  select fun_coins into v_fun_coins from public.player_balances where user_id = v_user_id;
  if not found or v_fun_coins < p_stake_gc then
    raise exception 'Insufficient GC balance' using errcode = '22003';
  end if;

  -- Generate unique room code
  loop
    v_room_code := 'HUB-' || lpad(floor(random() * 10000)::text, 4, '0');
    exit when not exists (select 1 from public.h2h_matches where room_code = v_room_code);
  end loop;

  -- Create match
  insert into public.h2h_matches (
    room_code, game_id, game_label, host_user_id, stake_gc, 
    status, match_duration_seconds
  ) values (
    v_room_code, p_game_id, p_game_label, v_user_id, p_stake_gc,
    'waiting', p_match_duration_seconds
  )
  returning h2h_matches.id into v_match_id;

  return query select v_match_id, v_room_code, 'waiting'::text;
end;
$$;

grant execute on function public.create_h2h_match(text, text, bigint, bigint) to authenticated;

-- Function to join an existing H2H match
create or replace function public.join_h2h_match(p_match_id uuid)
returns table(id uuid, status text, host_user_id uuid, guest_user_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_stake_gc bigint;
  v_fun_coins numeric;
  v_host_user_id uuid;
  v_status text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  -- Lock and validate match
  select host_user_id, stake_gc, status into v_host_user_id, v_stake_gc, v_status
  from public.h2h_matches where id = p_match_id for update;

  if not found then
    raise exception 'Match not found' using errcode = '42P01';
  end if;

  if v_status <> 'waiting' then
    raise exception 'Match is not available to join' using errcode = '22003';
  end if;

  if v_host_user_id = v_user_id then
    raise exception 'Host cannot join their own match' using errcode = '22003';
  end if;

  -- Check guest has sufficient funds
  select fun_coins into v_fun_coins from public.player_balances where user_id = v_user_id;
  if not found or v_fun_coins < v_stake_gc then
    raise exception 'Insufficient GC balance' using errcode = '22003';
  end if;

  -- Update match with guest and start it
  update public.h2h_matches
  set guest_user_id = v_user_id, status = 'in_progress', started_at = now(), updated_at = now()
  where id = p_match_id;

  return query select p_match_id, 'in_progress'::text, v_host_user_id, v_user_id;
end;
$$;

grant execute on function public.join_h2h_match(uuid) to authenticated;

-- Function to submit score during active match
create or replace function public.submit_h2h_score(
  p_match_id uuid,
  p_score bigint,
  p_game_data jsonb default null
)
returns table(match_id uuid, current_score bigint, status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_match_status text;
  v_is_player boolean;
  v_previous_score bigint;
  v_score_delta bigint;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  -- Validate match exists and user is player
  select status into v_match_status
  from public.h2h_matches
  where id = p_match_id
    and (host_user_id = v_user_id or guest_user_id = v_user_id)
  for update;

  if not found then
    raise exception 'Match not found or access denied' using errcode = '42P01';
  end if;

  if v_match_status <> 'in_progress' then
    raise exception 'Match is not in progress' using errcode = '22003';
  end if;

  -- Get previous score for delta calculation
  select coalesce(max(current_score), 0) into v_previous_score
  from public.h2h_score_events
  where match_id = p_match_id and user_id = v_user_id;

  v_score_delta := p_score - v_previous_score;

  -- Insert score event
  insert into public.h2h_score_events (match_id, user_id, score_delta, current_score, game_data)
  values (p_match_id, v_user_id, v_score_delta, p_score, p_game_data);

  return query select p_match_id, p_score, v_match_status;
end;
$$;

grant execute on function public.submit_h2h_score(uuid, bigint, jsonb) to authenticated;

-- Function to finalize match and distribute rewards
create or replace function public.finish_h2h_match(p_match_id uuid, p_forfeit boolean default false)
returns table(
  winner_id uuid,
  host_final_score bigint,
  guest_final_score bigint,
  host_reward_gc bigint,
  guest_reward_gc bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_host_id uuid;
  v_guest_id uuid;
  v_status text;
  v_stake_gc bigint;
  v_host_score bigint;
  v_guest_score bigint;
  v_winner_id uuid;
  v_loser_id uuid;
  v_host_elo_before numeric;
  v_guest_elo_before numeric;
  v_host_elo_after numeric;
  v_guest_elo_after numeric;
  v_elo_delta numeric;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  -- Lock match and validate
  select host_user_id, guest_user_id, status, stake_gc
  into v_host_id, v_guest_id, v_status, v_stake_gc
  from public.h2h_matches where id = p_match_id for update;

  if not found then
    raise exception 'Match not found' using errcode = '42P01';
  end if;

  if v_status <> 'in_progress' then
    raise exception 'Match is not in progress' using errcode = '22003';
  end if;

  if v_host_id <> v_user_id and v_guest_id <> v_user_id then
    raise exception 'Not a participant in this match' using errcode = '42501';
  end if;

  -- Get final scores
  select coalesce(max(current_score), 0) into v_host_score
  from public.h2h_score_events where match_id = p_match_id and user_id = v_host_id;

  select coalesce(max(current_score), 0) into v_guest_score
  from public.h2h_score_events where match_id = p_match_id and user_id = v_guest_id;

  -- Determine winner
  if p_forfeit then
    v_winner_id := case when v_user_id = v_host_id then v_guest_id else v_host_id end;
  else
    if v_host_score >= v_guest_score then
      v_winner_id := v_host_id;
      v_loser_id := v_guest_id;
    else
      v_winner_id := v_guest_id;
      v_loser_id := v_host_id;
    end if;
  end if;

  -- Get current ELO ratings
  select coalesce(elo_rating, 1500) into v_host_elo_before
  from public.h2h_leaderboard where user_id = v_host_id;

  select coalesce(elo_rating, 1500) into v_guest_elo_before
  from public.h2h_leaderboard where user_id = v_guest_id;

  -- Calculate new ELO (simplified K-factor of 32)
  v_elo_delta := 32 * (case when v_winner_id = v_host_id then 1 else 0 end - 1.0 / (1.0 + power(10, (v_guest_elo_before - v_host_elo_before) / 400)));
  v_host_elo_after := round((v_host_elo_before + v_elo_delta)::numeric, 2);
  v_guest_elo_after := round((v_guest_elo_before - v_elo_delta)::numeric, 2);

  -- Update leaderboard for both players
  insert into public.h2h_leaderboard (user_id, total_matches, wins, elo_rating, last_match_at)
  values (v_host_id, 1, case when v_winner_id = v_host_id then 1 else 0 end, v_host_elo_after, now())
  on conflict (user_id) do update set
    total_matches = total_matches + 1,
    wins = wins + (case when v_winner_id = v_host_id then 1 else 0 end),
    losses = losses + (case when v_winner_id <> v_host_id then 1 else 0 end),
    elo_rating = v_host_elo_after,
    total_gc_staked = total_gc_staked + v_stake_gc,
    total_gc_won = total_gc_won + (case when v_winner_id = v_host_id then v_stake_gc * 2 else 0 end),
    win_streak = case when v_winner_id = v_host_id then win_streak + 1 else 0 end,
    last_match_at = now(),
    updated_at = now();

  insert into public.h2h_leaderboard (user_id, total_matches, wins, elo_rating, last_match_at)
  values (v_guest_id, 1, case when v_winner_id = v_guest_id then 1 else 0 end, v_guest_elo_after, now())
  on conflict (user_id) do update set
    total_matches = total_matches + 1,
    wins = wins + (case when v_winner_id = v_guest_id then 1 else 0 end),
    losses = losses + (case when v_winner_id <> v_guest_id then 1 else 0 end),
    elo_rating = v_guest_elo_after,
    total_gc_staked = total_gc_staked + v_stake_gc,
    total_gc_won = total_gc_won + (case when v_winner_id = v_guest_id then v_stake_gc * 2 else 0 end),
    win_streak = case when v_winner_id = v_guest_id then win_streak + 1 else 0 end,
    last_match_at = now(),
    updated_at = now();

  -- Archive to history
  insert into public.h2h_match_history (
    match_id, host_user_id, guest_user_id, game_id, game_label,
    stake_gc, winner_id, host_final_score, guest_final_score,
    host_elo_before, host_elo_after, guest_elo_before, guest_elo_after,
    match_duration_seconds
  ) select
    id, host_user_id, guest_user_id, game_id, game_label,
    stake_gc, v_winner_id, v_host_score, v_guest_score,
    v_host_elo_before, v_host_elo_after, v_guest_elo_before, v_guest_elo_after,
    match_duration_seconds
  from public.h2h_matches where id = p_match_id;

  -- Update match record
  update public.h2h_matches
  set
    status = 'completed',
    winner_id = v_winner_id,
    host_final_score = v_host_score,
    guest_final_score = v_guest_score,
    completed_at = now(),
    updated_at = now()
  where id = p_match_id;

  -- Award rewards and experience
  update public.player_balances
  set fun_coins = fun_coins + (v_stake_gc * 2)
  where user_id = v_winner_id;

  -- Award experience
  perform private.award_level_experience(v_winner_id, 150);
  perform private.award_level_experience(v_loser_id, 30);

  return query select v_winner_id, v_host_score, v_guest_score,
    (case when v_winner_id = v_host_id then v_stake_gc * 2 else 0 end)::bigint,
    (case when v_winner_id = v_guest_id then v_stake_gc * 2 else 0 end)::bigint;
end;
$$;

grant execute on function public.finish_h2h_match(uuid, boolean) to authenticated;

-- Function to get active matches for lobby
create or replace function public.get_h2h_active_matches()
returns table(
  id uuid,
  room_code text,
  game_id text,
  game_label text,
  host_user_id uuid,
  host_username text,
  host_avatar text,
  guest_user_id uuid,
  guest_username text,
  stake_gc bigint,
  status text,
  created_at timestamptz
)
language sql
security definer
set search_path = ''
as $$
select
  m.id,
  m.room_code,
  m.game_id,
  m.game_label,
  m.host_user_id,
  u1.raw_user_meta_data->>'username',
  u1.raw_user_meta_data->>'avatar',
  m.guest_user_id,
  u2.raw_user_meta_data->>'username',
  m.stake_gc,
  m.status,
  m.created_at
from public.h2h_matches m
join auth.users u1 on m.host_user_id = u1.id
left join auth.users u2 on m.guest_user_id = u2.id
where m.status in ('waiting', 'in_progress')
order by m.created_at desc
limit 50;
$$;

grant execute on function public.get_h2h_active_matches() to authenticated;

-- Function to get H2H leaderboard
create or replace function public.get_h2h_leaderboard(p_limit int default 50)
returns table(
  rank bigint,
  user_id uuid,
  username text,
  avatar text,
  elo_rating numeric,
  total_matches bigint,
  wins bigint,
  win_percentage numeric,
  total_gc_won numeric
)
language sql
security definer
set search_path = ''
as $$
select
  row_number() over (order by l.elo_rating desc),
  l.user_id,
  u.raw_user_meta_data->>'username',
  u.raw_user_meta_data->>'avatar',
  l.elo_rating,
  l.total_matches,
  l.wins,
  round(100.0 * l.wins / nullif(l.total_matches, 0), 2),
  l.total_gc_won
from public.h2h_leaderboard l
join auth.users u on l.user_id = u.id
order by l.elo_rating desc
limit p_limit;
$$;

grant execute on function public.get_h2h_leaderboard(int) to authenticated;

-- Function to get player H2H history
create or replace function public.get_h2h_player_history(p_user_id uuid, p_limit int default 20)
returns table(
  id uuid,
  match_id uuid,
  opponent_id uuid,
  opponent_username text,
  game_label text,
  result text,
  player_score bigint,
  opponent_score bigint,
  stake_gc bigint,
  reward_gc bigint,
  elo_change numeric,
  completed_at timestamptz
)
language sql
security definer
set search_path = ''
as $$
select
  h.id,
  h.match_id,
  case when h.host_user_id = p_user_id then h.guest_user_id else h.host_user_id end,
  coalesce(u.raw_user_meta_data->>'username', 'Unknown'),
  h.game_label,
  case when h.winner_id = p_user_id then 'WIN' else 'LOSS' end,
  case when h.host_user_id = p_user_id then h.host_final_score else h.guest_final_score end,
  case when h.host_user_id = p_user_id then h.guest_final_score else h.host_final_score end,
  h.stake_gc,
  case when h.winner_id = p_user_id then h.stake_gc * 2 else 0 end,
  case when h.host_user_id = p_user_id then h.host_elo_after - h.host_elo_before else h.guest_elo_after - h.guest_elo_before end,
  h.completed_at
from public.h2h_match_history h
left join auth.users u on (case when h.host_user_id = p_user_id then h.guest_user_id else h.host_user_id end) = u.id
where h.host_user_id = p_user_id or h.guest_user_id = p_user_id
order by h.completed_at desc
limit p_limit;
$$;

grant execute on function public.get_h2h_player_history(uuid, int) to authenticated;

-- Function to get player H2H stats
create or replace function public.get_h2h_player_stats(p_user_id uuid)
returns table(
  elo_rating numeric,
  total_matches bigint,
  wins bigint,
  losses bigint,
  win_percentage numeric,
  total_gc_won numeric,
  total_gc_staked numeric,
  win_streak bigint,
  rank bigint
)
language sql
security definer
set search_path = ''
as $$
select
  l.elo_rating,
  l.total_matches,
  l.wins,
  l.total_matches - l.wins,
  round(100.0 * l.wins / nullif(l.total_matches, 0), 2),
  l.total_gc_won,
  l.total_gc_staked,
  l.win_streak,
  row_number() over (order by l.elo_rating desc)
from public.h2h_leaderboard l
where l.user_id = p_user_id;
$$;

grant execute on function public.get_h2h_player_stats(uuid) to authenticated;
