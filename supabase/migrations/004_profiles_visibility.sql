-- Add public profile and board visibility controls.
-- Existing rows stay private by default so no current private boards are exposed.

alter table public.profiles
  add column if not exists username text,
  add column if not exists bio text,
  add column if not exists website_url text,
  add column if not exists location text,
  add column if not exists interests text[] not null default '{}',
  add column if not exists profile_visibility text not null default 'private';

alter table public.boards
  add column if not exists visibility text not null default 'private';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_username_lowercase_safe'
  ) then
    alter table public.profiles
      add constraint profiles_username_lowercase_safe
      check (username is null or (username = lower(username) and username ~ '^[a-z0-9_.]{3,30}$'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'profiles_visibility_valid'
  ) then
    alter table public.profiles
      add constraint profiles_visibility_valid
      check (profile_visibility in ('public', 'private'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'boards_visibility_valid'
  ) then
    alter table public.boards
      add constraint boards_visibility_valid
      check (visibility in ('public', 'private'));
  end if;
end $$;

create unique index if not exists profiles_username_unique_idx
on public.profiles (username)
where username is not null;

create index if not exists profiles_visibility_idx on public.profiles(profile_visibility);
create index if not exists boards_visibility_idx on public.boards(visibility);

alter table public.profiles enable row level security;
alter table public.boards enable row level security;
alter table public.pins enable row level security;

drop policy if exists "Users can read their own profile" on public.profiles;
drop policy if exists "Users can create their own profile" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;
drop policy if exists "Users can delete their own profile" on public.profiles;
drop policy if exists "Users can read own or public profiles" on public.profiles;
drop policy if exists "Users can insert their own profile" on public.profiles;
drop policy if exists "Users can update their own profile only" on public.profiles;

create policy "Users can read own or public profiles"
on public.profiles for select
to authenticated
using (auth.uid() = id or profile_visibility = 'public');

create policy "Users can insert their own profile"
on public.profiles for insert
to authenticated
with check (auth.uid() = id);

create policy "Users can update their own profile only"
on public.profiles for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "Users can read their own boards" on public.boards;
drop policy if exists "Users can create their own boards" on public.boards;
drop policy if exists "Users can update their own boards" on public.boards;
drop policy if exists "Users can delete their own boards" on public.boards;
drop policy if exists "Users can read own or public boards" on public.boards;
drop policy if exists "Users can insert their own boards" on public.boards;
drop policy if exists "Users can update their own boards only" on public.boards;
drop policy if exists "Users can delete their own boards only" on public.boards;

create policy "Users can read own or public boards"
on public.boards for select
to authenticated
using (
  auth.uid() = user_id
  or (
    visibility = 'public'
    and exists (
      select 1 from public.profiles
      where profiles.id = boards.user_id
        and profiles.profile_visibility = 'public'
    )
  )
);

create policy "Users can insert their own boards"
on public.boards for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their own boards only"
on public.boards for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own boards only"
on public.boards for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can read their own pins" on public.pins;
drop policy if exists "Users can create pins on their own boards" on public.pins;
drop policy if exists "Users can update their own pins" on public.pins;
drop policy if exists "Users can delete their own pins" on public.pins;
drop policy if exists "Users can read own or public board pins" on public.pins;
drop policy if exists "Users can create pins on owned boards" on public.pins;
drop policy if exists "Users can update their own pins only" on public.pins;
drop policy if exists "Users can delete their own pins only" on public.pins;

create policy "Users can read own or public board pins"
on public.pins for select
to authenticated
using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.boards
    join public.profiles on profiles.id = boards.user_id
    where boards.id = pins.board_id
      and boards.visibility = 'public'
      and profiles.profile_visibility = 'public'
  )
);

create policy "Users can create pins on owned boards"
on public.pins for insert
to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.boards
    where boards.id = pins.board_id
      and boards.user_id = auth.uid()
  )
);

create policy "Users can update their own pins only"
on public.pins for update
to authenticated
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.boards
    where boards.id = pins.board_id
      and boards.user_id = auth.uid()
  )
);

create policy "Users can delete their own pins only"
on public.pins for delete
to authenticated
using (auth.uid() = user_id);
