create or replace function public.lookup_login_email(p_username text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
  v_clean text;
begin
  v_clean := lower(trim(p_username));
  if v_clean is null or v_clean = '' then
    return null;
  end if;

  select u.email into v_email
  from auth.users u
  left join public.profiles p on p.id = u.id
  where lower(p.display_name) = v_clean
     or lower(coalesce(u.raw_user_meta_data->>'display_name', '')) = v_clean
  order by u.created_at desc
  limit 1;

  return v_email;
end;
$$;

grant execute on function public.lookup_login_email(text) to anon, authenticated;
