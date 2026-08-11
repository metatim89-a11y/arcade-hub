create table public.game_aesthetics (
  id text primary key check (char_length(id) between 3 and 80),
  game_id text not null check (char_length(game_id) between 1 and 40),
  name text not null check (char_length(name) between 2 and 80),
  description text not null check (char_length(description) between 2 and 240),
  visual_key text not null check (visual_key in ('neon', 'gold', 'galaxy', 'ember', 'frost')),
  ticket_cost integer not null check (ticket_cost between 1 and 1000),
  required_experience bigint not null default 0 check (required_experience >= 0),
  value_cents integer not null check (value_cents between 0 and 255),
  reward_type text not null check (reward_type in ('coins', 'experience', 'powerup')),
  reward_amount integer not null check (reward_amount > 0),
  gradient_from text not null,
  gradient_to text not null,
  accent_color text not null,
  sort_order integer not null check (sort_order between 1 and 5),
  unique (game_id, sort_order)
);

create table public.player_aesthetics (
  user_id uuid not null references auth.users(id) on delete cascade,
  aesthetic_id text not null references public.game_aesthetics(id) on delete restrict,
  game_id text not null,
  equipped boolean not null default false,
  purchased_at timestamptz not null default now(),
  primary key (user_id, aesthetic_id)
);

create unique index player_aesthetics_one_equipped_per_game_idx
on public.player_aesthetics (user_id, game_id)
where equipped;

create index player_aesthetics_user_game_idx
on public.player_aesthetics (user_id, game_id);

create index player_aesthetics_aesthetic_id_idx
on public.player_aesthetics (aesthetic_id);

alter table public.game_aesthetics enable row level security;
alter table public.player_aesthetics enable row level security;

create policy anyone_can_browse_aesthetics on public.game_aesthetics
for select to anon, authenticated using (true);

create policy players_or_admins_read_owned_aesthetics on public.player_aesthetics
for select to authenticated
using (
  (select auth.uid()) = user_id
  or exists (select 1 from public.admin_users where user_id = (select auth.uid()))
);

revoke all on table public.game_aesthetics from public, anon, authenticated;
revoke all on table public.player_aesthetics from public, anon, authenticated;
grant select on table public.game_aesthetics to anon, authenticated;
grant select on table public.player_aesthetics to authenticated;

with games(game_id, game_label) as (
  values
    ('wheel', 'Spin Wheel'),
    ('crash', 'Crash'),
    ('blackjack', 'Blackjack'),
    ('poker', 'Holdem'),
    ('keno', 'Keno'),
    ('plinko', 'Plinko'),
    ('slots', 'Slots'),
    ('fishing', 'Ocean Hunter'),
    ('coinpusher', 'Coin Pusher'),
    ('worm', 'Worm.io'),
    ('connect4', 'Connect Four'),
    ('rubikscube', 'Color Recall'),
    ('mancala', 'Mancala'),
    ('rps', 'RPS Cards'),
    ('tictactoe', 'Tic Tac Toe')
), themes(
  visual_key, theme_name, theme_description, ticket_cost, required_experience,
  value_cents, reward_type, reward_amount, gradient_from, gradient_to, accent_color, sort_order
) as (
  values
    ('neon', 'Neon Circuit', 'Electric cyan trim, animated scanlines, and a bright arcade glow.', 5, 0, 49, 'coins', 25, '#071a2b', '#4c0b5f', '#22d3ee', 1),
    ('gold', 'Golden Crown', 'Polished gold framing with warm spotlight accents and royal shine.', 10, 250, 99, 'experience', 30, '#2a1804', '#6b3f08', '#facc15', 2),
    ('galaxy', 'Galaxy Drift', 'Deep-space purple gradients, star specks, and cosmic edge lighting.', 15, 1000, 149, 'powerup', 1, '#111334', '#431166', '#c084fc', 3),
    ('ember', 'Ember Core', 'Smoldering red borders, orange heat bloom, and ember particles.', 20, 2250, 199, 'coins', 75, '#2b0906', '#751a0c', '#fb923c', 4),
    ('frost', 'Frostbyte Elite', 'Icy blue glass, crisp white highlights, and frozen circuitry.', 25, 4000, 249, 'experience', 100, '#071c2d', '#174b69', '#bae6fd', 5)
)
insert into public.game_aesthetics (
  id, game_id, name, description, visual_key, ticket_cost, required_experience,
  value_cents, reward_type, reward_amount, gradient_from, gradient_to, accent_color, sort_order
)
select
  games.game_id || '-' || themes.visual_key,
  games.game_id,
  games.game_label || ' ' || themes.theme_name,
  themes.theme_description,
  themes.visual_key,
  themes.ticket_cost,
  themes.required_experience,
  themes.value_cents,
  themes.reward_type,
  themes.reward_amount,
  themes.gradient_from,
  themes.gradient_to,
  themes.accent_color,
  themes.sort_order
from games cross join themes;

create function private.purchase_game_aesthetic(p_user_id uuid, p_aesthetic_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  selected_aesthetic public.game_aesthetics;
  current_balance public.player_balances;
  current_progress public.player_progression;
  old_level integer;
  new_level integer;
begin
  if (select auth.uid()) is null or (select auth.uid()) <> p_user_id then
    raise exception 'Player access required' using errcode = '42501';
  end if;

  select * into selected_aesthetic
  from public.game_aesthetics
  where id = p_aesthetic_id;
  if selected_aesthetic.id is null then raise exception 'Aesthetic not found'; end if;

  select * into current_balance
  from public.player_balances
  where user_id = p_user_id
  for update;
  select * into current_progress
  from public.player_progression
  where user_id = p_user_id
  for update;

  if current_balance.user_id is null or current_progress.user_id is null then
    raise exception 'Player account is missing';
  end if;
  if exists (
    select 1 from public.player_aesthetics
    where user_id = p_user_id and aesthetic_id = selected_aesthetic.id
  ) then raise exception 'You already own this aesthetic'; end if;
  if current_balance.tickets < selected_aesthetic.ticket_cost then
    raise exception 'Not enough tickets';
  end if;
  if current_progress.experience < selected_aesthetic.required_experience then
    raise exception 'More experience is required';
  end if;

  update public.player_balances
  set tickets = tickets - selected_aesthetic.ticket_cost,
      fun_coins = fun_coins + case when selected_aesthetic.reward_type = 'coins' then selected_aesthetic.reward_amount else 0 end,
      updated_at = now()
  where user_id = p_user_id
  returning * into current_balance;

  old_level := current_progress.level;
  if selected_aesthetic.reward_type = 'experience' then
    new_level := private.level_for_experience(current_progress.experience + selected_aesthetic.reward_amount);
    update public.player_progression
    set experience = experience + selected_aesthetic.reward_amount,
        level = new_level,
        powerups = powerups + ((new_level - old_level) * 2),
        updated_at = now()
    where user_id = p_user_id
    returning * into current_progress;
  elsif selected_aesthetic.reward_type = 'powerup' then
    update public.player_progression
    set powerups = powerups + selected_aesthetic.reward_amount,
        updated_at = now()
    where user_id = p_user_id
    returning * into current_progress;
  end if;

  if selected_aesthetic.reward_type = 'coins' then
    insert into public.coin_transactions (user_id, currency, transaction_type, amount, reason)
    values (p_user_id, 'fun', 'credit', selected_aesthetic.reward_amount, 'Aesthetic Purchase Bonus');
  end if;

  insert into public.player_aesthetics (user_id, aesthetic_id, game_id, equipped)
  values (
    p_user_id,
    selected_aesthetic.id,
    selected_aesthetic.game_id,
    not exists (select 1 from public.player_aesthetics where user_id = p_user_id and game_id = selected_aesthetic.game_id and equipped)
  );

  return jsonb_build_object(
    'aestheticId', selected_aesthetic.id,
    'tickets', current_balance.tickets,
    'experience', current_progress.experience,
    'level', current_progress.level,
    'powerups', current_progress.powerups,
    'rewardType', selected_aesthetic.reward_type,
    'rewardAmount', selected_aesthetic.reward_amount
  );
end;
$$;

create function private.equip_game_aesthetic(p_user_id uuid, p_aesthetic_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare selected_purchase public.player_aesthetics;
begin
  if (select auth.uid()) is null or (select auth.uid()) <> p_user_id then
    raise exception 'Player access required' using errcode = '42501';
  end if;
  select * into selected_purchase
  from public.player_aesthetics
  where user_id = p_user_id and aesthetic_id = p_aesthetic_id
  for update;
  if selected_purchase.aesthetic_id is null then raise exception 'Purchase this aesthetic before equipping it'; end if;

  update public.player_aesthetics
  set equipped = false
  where user_id = p_user_id and game_id = selected_purchase.game_id and equipped;
  update public.player_aesthetics
  set equipped = true
  where user_id = p_user_id and aesthetic_id = p_aesthetic_id;

  return jsonb_build_object('aestheticId', p_aesthetic_id, 'gameId', selected_purchase.game_id);
end;
$$;

revoke all on function private.purchase_game_aesthetic(uuid, text) from public, anon;
revoke all on function private.equip_game_aesthetic(uuid, text) from public, anon;
grant execute on function private.purchase_game_aesthetic(uuid, text) to authenticated;
grant execute on function private.equip_game_aesthetic(uuid, text) to authenticated;

create function public.purchase_game_aesthetic(p_user_id uuid, p_aesthetic_id text)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.purchase_game_aesthetic(p_user_id, p_aesthetic_id);
$$;

create function public.equip_game_aesthetic(p_user_id uuid, p_aesthetic_id text)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.equip_game_aesthetic(p_user_id, p_aesthetic_id);
$$;

revoke all on function public.purchase_game_aesthetic(uuid, text) from public, anon;
revoke all on function public.equip_game_aesthetic(uuid, text) from public, anon;
grant execute on function public.purchase_game_aesthetic(uuid, text) to authenticated;
grant execute on function public.equip_game_aesthetic(uuid, text) to authenticated;
