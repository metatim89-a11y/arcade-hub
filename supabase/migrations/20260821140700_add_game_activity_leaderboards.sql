create or replace function public.get_game_activity_leaderboard(p_game_id text)
returns table(display_name text, play_count bigint, coins_spent numeric)
language sql
security definer
set search_path = ''
as $$
  select coalesce(p.display_name, 'Player') as display_name,
         s.play_count,
         s.coins_spent
  from public.player_game_stats s
  join public.profiles p on p.id = s.user_id
  where s.game_id = p_game_id
  order by s.play_count desc, s.coins_spent desc, s.updated_at asc
  limit 10;
$$;

revoke all on function public.get_game_activity_leaderboard(text) from public, anon;
grant execute on function public.get_game_activity_leaderboard(text) to authenticated;
