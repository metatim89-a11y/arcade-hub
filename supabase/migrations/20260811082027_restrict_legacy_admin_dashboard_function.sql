revoke all on function public.get_admin_dashboard() from public, anon;
grant execute on function public.get_admin_dashboard() to authenticated;
