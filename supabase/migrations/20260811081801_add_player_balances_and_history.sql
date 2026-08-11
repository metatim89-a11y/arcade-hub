create table public.player_balances (
  user_id uuid primary key references auth.users(id) on delete cascade,
  fun_coins numeric not null default 1000 check (fun_coins >= 0),
  real_coins numeric not null default 0 check (real_coins >= 0),
  updated_at timestamptz not null default now()
);

create table public.coin_transactions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  currency text not null check (currency in ('fun', 'real')),
  transaction_type text not null check (transaction_type in ('credit', 'debit')),
  amount numeric not null check (amount > 0),
  reason text not null check (char_length(reason) between 1 and 120),
  created_at timestamptz not null default now()
);

alter table public.player_balances enable row level security;
alter table public.coin_transactions enable row level security;

create policy players_or_admins_read_balances on public.player_balances for select to authenticated
using ((select auth.uid()) = user_id or exists (select 1 from public.admin_users where user_id = (select auth.uid())));
create policy players_or_admins_read_transactions on public.coin_transactions for select to authenticated
using ((select auth.uid()) = user_id or exists (select 1 from public.admin_users where user_id = (select auth.uid())));

create index coin_transactions_user_created_at_idx on public.coin_transactions (user_id, created_at desc);
create index site_events_created_at_idx on public.site_events (created_at desc);
create index site_events_event_type_created_at_idx on public.site_events (event_type, created_at desc);
create index site_events_user_id_created_at_idx on public.site_events (user_id, created_at desc) where user_id is not null;

insert into public.player_balances (user_id) select id from auth.users on conflict (user_id) do nothing;

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 40), ''));
  insert into public.player_balances (user_id) values (new.id);
  return new;
end;
$$;

create function public.apply_coin_transaction(p_user_id uuid, p_currency text, p_transaction_type text, p_amount numeric, p_reason text)
returns table(fun_coins numeric, real_coins numeric) language plpgsql security definer set search_path = '' as $$
declare updated_balance public.player_balances;
begin
  if p_currency not in ('fun', 'real') then raise exception 'Invalid currency'; end if;
  if p_transaction_type not in ('credit', 'debit') then raise exception 'Invalid transaction type'; end if;
  if p_amount <= 0 or p_amount > 1000000 then raise exception 'Invalid amount'; end if;
  if char_length(trim(p_reason)) not between 1 and 120 then raise exception 'Invalid reason'; end if;
  update public.player_balances set
    fun_coins = case when p_currency = 'fun' and p_transaction_type = 'credit' then fun_coins + p_amount when p_currency = 'fun' then fun_coins - p_amount else fun_coins end,
    real_coins = case when p_currency = 'real' and p_transaction_type = 'credit' then real_coins + p_amount when p_currency = 'real' then real_coins - p_amount else real_coins end,
    updated_at = now()
  where user_id = p_user_id and (p_transaction_type = 'credit' or (p_currency = 'fun' and fun_coins >= p_amount) or (p_currency = 'real' and real_coins >= p_amount))
  returning * into updated_balance;
  if not found then raise exception 'Insufficient balance or missing player account'; end if;
  insert into public.coin_transactions (user_id, currency, transaction_type, amount, reason)
  values (p_user_id, p_currency, p_transaction_type, p_amount, trim(p_reason));
  return query select updated_balance.fun_coins, updated_balance.real_coins;
end;
$$;
