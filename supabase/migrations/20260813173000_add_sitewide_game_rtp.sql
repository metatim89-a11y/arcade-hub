create table public.game_rtp_settings (
  game_id text primary key check (char_length(game_id) between 1 and 64),
  rtp numeric(5,2) not null check (rtp between 0 and 200),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

insert into public.game_rtp_settings (game_id, rtp)
values
  ('wheel', 100), ('crash', 100), ('blackjack', 100), ('poker', 100), ('keno', 100),
  ('plinko', 100), ('slots', 100), ('fishing', 100), ('coinpusher', 100), ('worm', 100),
  ('connect4', 100), ('rubikscube', 100), ('mancala', 100), ('rps', 100), ('tictactoe', 100)
on conflict (game_id) do nothing;

alter table public.game_rtp_settings enable row level security;
create policy everyone_can_read_game_rtp on public.game_rtp_settings for select to anon, authenticated using (true);

create or replace function private.set_game_rtp(p_game_id text, p_rtp numeric)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or not exists (select 1 from public.admin_users where user_id = (select auth.uid())) then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if char_length(trim(p_game_id)) not between 1 and 64 or p_rtp < 0 or p_rtp > 200 then raise exception 'Invalid game RTP setting'; end if;
  insert into public.game_rtp_settings (game_id, rtp, updated_at, updated_by)
  values (trim(p_game_id), round(p_rtp, 2), now(), (select auth.uid()))
  on conflict (game_id) do update set rtp = excluded.rtp, updated_at = excluded.updated_at, updated_by = excluded.updated_by;
end;
$$;

create or replace function public.set_game_rtp(p_game_id text, p_rtp numeric)
returns void language sql security invoker set search_path = '' as $$ select private.set_game_rtp(p_game_id, p_rtp); $$;

create or replace function private.set_all_game_rtp(p_rtp numeric)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or not exists (select 1 from public.admin_users where user_id = (select auth.uid())) then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if p_rtp < 0 or p_rtp > 200 then raise exception 'RTP must be between 0 and 200'; end if;
  update public.game_rtp_settings set rtp = round(p_rtp, 2), updated_at = now(), updated_by = (select auth.uid());
end;
$$;

create or replace function public.set_all_game_rtp(p_rtp numeric)
returns void language sql security invoker set search_path = '' as $$ select private.set_all_game_rtp(p_rtp); $$;

revoke all on function private.set_game_rtp(text, numeric) from public, anon;
revoke all on function private.set_all_game_rtp(numeric) from public, anon;
revoke all on function public.set_game_rtp(text, numeric) from public, anon;
revoke all on function public.set_all_game_rtp(numeric) from public, anon;
grant execute on function private.set_game_rtp(text, numeric) to authenticated;
grant execute on function private.set_all_game_rtp(numeric) to authenticated;
grant execute on function public.set_game_rtp(text, numeric) to authenticated;
grant execute on function public.set_all_game_rtp(numeric) to authenticated;
