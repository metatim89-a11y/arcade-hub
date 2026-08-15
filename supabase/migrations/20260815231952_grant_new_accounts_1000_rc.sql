alter table public.player_balances
  alter column real_coins set default 1000;

comment on column public.player_balances.real_coins is
  'Virtual RC balance. New accounts receive a one-time 1000 RC starting balance through the auth user creation trigger.';
