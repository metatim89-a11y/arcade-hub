alter table public.player_balances
  alter column fun_coins set default 1000,
  alter column real_coins set default 5;

comment on column public.player_balances.fun_coins is
  'Game Coin balance. Registered accounts receive 1000 GC at signup.';
comment on column public.player_balances.real_coins is
  'Virtual RC balance. Registered accounts receive 5 RC at signup; RC has no cash value.';
