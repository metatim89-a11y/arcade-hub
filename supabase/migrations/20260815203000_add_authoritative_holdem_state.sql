create table public.holdem_server_games (
  table_id uuid primary key references public.holdem_tables(id) on delete cascade,
  state jsonb not null,
  version bigint not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.holdem_server_games enable row level security;
revoke all on public.holdem_server_games from public, anon, authenticated;

create table public.holdem_game_snapshots (
  table_id uuid primary key references public.holdem_tables(id) on delete cascade,
  version bigint not null default 1,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.holdem_game_snapshots enable row level security;
create policy "seated players can read holdem snapshots"
on public.holdem_game_snapshots for select to authenticated
using (exists (
  select 1 from public.holdem_table_seats s
  where s.table_id = holdem_game_snapshots.table_id and s.user_id = (select auth.uid())
));
grant select on public.holdem_game_snapshots to authenticated;
alter publication supabase_realtime add table public.holdem_game_snapshots;
