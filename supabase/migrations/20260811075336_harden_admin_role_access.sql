drop policy players_read_own_profile on public.profiles;
drop policy players_update_own_profile on public.profiles;

create policy players_or_admins_read_profiles on public.profiles for select to authenticated
using (
  (select auth.uid()) = id
  or exists (select 1 from public.admin_users where user_id = (select auth.uid()))
);

create policy players_or_admins_update_profiles on public.profiles for update to authenticated
using (
  (select auth.uid()) = id
  or exists (select 1 from public.admin_users where user_id = (select auth.uid()))
)
with check (
  (select auth.uid()) = id
  or exists (select 1 from public.admin_users where user_id = (select auth.uid()))
);
