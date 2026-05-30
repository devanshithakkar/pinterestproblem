-- Re-assert board visibility and public-read RLS for profile pages.
-- This is idempotent so older databases and fresh databases land on the same rules.

alter table public.boards
  add column if not exists visibility text not null default 'private';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'boards_visibility_valid'
  ) then
    alter table public.boards
      add constraint boards_visibility_valid
      check (visibility in ('public', 'private'));
  end if;
end $$;

create index if not exists boards_visibility_idx on public.boards(visibility);

alter table public.profiles enable row level security;
alter table public.boards enable row level security;
alter table public.pins enable row level security;

drop policy if exists "Users can read own or public profiles" on public.profiles;
create policy "Users can read own or public profiles"
on public.profiles for select
to authenticated
using (auth.uid() = id or profile_visibility = 'public');

drop policy if exists "Users can read own or public boards" on public.boards;
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

drop policy if exists "Users can read own or public board pins" on public.pins;
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
