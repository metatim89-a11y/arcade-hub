create or replace function private.daily_faucet_amount_for_level(p_level integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when p_level <= 1 then 535
    when p_level = 2 then 615
    when p_level = 3 then 670
    when p_level = 4 then 725
    when p_level = 5 then 875
    when p_level = 6 then 1025
    when p_level = 7 then 1243
    when p_level = 8 then 1460
    when p_level = 9 then 1960
    else 2460
  end;
$$;
