alter table public.profiles add column bio text check (char_length(bio) <= 500);
alter table public.profiles add column avatar_url text check (avatar_url is null or char_length(avatar_url) <= 2048);
