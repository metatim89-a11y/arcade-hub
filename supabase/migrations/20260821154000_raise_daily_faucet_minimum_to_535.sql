create or replace function private.daily_faucet_amount_for_level(p_level integer)
returns integer
language sql
immutable
set search_path to ''
as $$
  select case
    when p_level <= 5 then 535
    when p_level = 6 then 565
    when p_level = 7 then 783
    when p_level = 8 then 1000
    when p_level = 9 then 1500
    else 2000
  end;
$$;
