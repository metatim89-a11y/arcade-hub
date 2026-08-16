-- Keep the exposed wrapper security-invoker while the guarded private function
-- enforces self-only access and blocks client-authored virtual RC credits.
revoke all on function private.apply_coin_transaction(uuid, text, text, numeric, text) from public, anon;
grant execute on function private.apply_coin_transaction(uuid, text, text, numeric, text) to authenticated, service_role;

create or replace function public.apply_coin_transaction(
  p_user_id uuid,
  p_currency text,
  p_transaction_type text,
  p_amount numeric,
  p_reason text
)
returns table(fun_coins numeric, real_coins numeric)
language sql security invoker set search_path = '' as $$
  select * from private.apply_coin_transaction(p_user_id, p_currency, p_transaction_type, p_amount, p_reason);
$$;

revoke all on function public.apply_coin_transaction(uuid, text, text, numeric, text) from public, anon;
grant execute on function public.apply_coin_transaction(uuid, text, text, numeric, text) to authenticated, service_role;
