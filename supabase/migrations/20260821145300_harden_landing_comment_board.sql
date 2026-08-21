create index if not exists landing_comments_user_id_idx on public.landing_comments (user_id);

revoke execute on function public.post_landing_comment(text, text) from anon;
revoke execute on function public.post_landing_comment(text, text) from public;
grant execute on function public.post_landing_comment(text, text) to authenticated;

create or replace function public.admin_delete_landing_comment(p_comment_id bigint)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_deleted integer;
begin
  if v_user_id is null or not exists (
    select 1 from public.admin_users a where a.user_id = v_user_id
  ) then
    raise exception 'Administrator access required';
  end if;

  delete from public.landing_comments where id = p_comment_id;
  get diagnostics v_deleted = row_count;
  return v_deleted > 0;
end;
$$;

revoke all on function public.admin_delete_landing_comment(bigint) from public, anon;
grant execute on function public.admin_delete_landing_comment(bigint) to authenticated;