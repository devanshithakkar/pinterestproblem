-- PinMind multi-user auth hardening.
-- These policies keep each user's boards, pins, predictions, profiles, and
-- source metadata private to their own Supabase Auth user id.

alter table public.profiles enable row level security;
alter table public.boards enable row level security;
alter table public.pins enable row level security;
alter table public.ai_predictions enable row level security;
alter table public.image_sources enable row level security;
alter table public.pinterest_accounts enable row level security;

drop policy if exists "Users can read their own profile" on public.profiles;
drop policy if exists "Users can create their own profile" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;
drop policy if exists "Users can delete their own profile" on public.profiles;

create policy "Users can read their own profile"
on public.profiles for select
to authenticated
using (auth.uid() = id);

create policy "Users can create their own profile"
on public.profiles for insert
to authenticated
with check (auth.uid() = id);

create policy "Users can update their own profile"
on public.profiles for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "Users can read their own boards" on public.boards;
drop policy if exists "Users can create their own boards" on public.boards;
drop policy if exists "Users can update their own boards" on public.boards;
drop policy if exists "Users can delete their own boards" on public.boards;

create policy "Users can read their own boards"
on public.boards for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can create their own boards"
on public.boards for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their own boards"
on public.boards for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own boards"
on public.boards for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can read their own pins" on public.pins;
drop policy if exists "Users can create pins on their own boards" on public.pins;
drop policy if exists "Users can update their own pins" on public.pins;
drop policy if exists "Users can delete their own pins" on public.pins;

create policy "Users can read their own pins"
on public.pins for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can create pins on their own boards"
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

create policy "Users can update their own pins"
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

create policy "Users can delete their own pins"
on public.pins for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can read their own AI predictions" on public.ai_predictions;
drop policy if exists "Users can create their own AI predictions" on public.ai_predictions;
drop policy if exists "Users can update their own AI predictions" on public.ai_predictions;
drop policy if exists "Users can delete their own AI predictions" on public.ai_predictions;

create policy "Users can read their own AI predictions"
on public.ai_predictions for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can create their own AI predictions"
on public.ai_predictions for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their own AI predictions"
on public.ai_predictions for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own AI predictions"
on public.ai_predictions for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can read their own image sources" on public.image_sources;
drop policy if exists "Users can create their own image sources" on public.image_sources;
drop policy if exists "Users can update their own image sources" on public.image_sources;
drop policy if exists "Users can delete their own image sources" on public.image_sources;

create policy "Users can read their own image sources"
on public.image_sources for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can create their own image sources"
on public.image_sources for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their own image sources"
on public.image_sources for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own image sources"
on public.image_sources for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can read their own Pinterest accounts" on public.pinterest_accounts;
drop policy if exists "Users can create their own Pinterest accounts" on public.pinterest_accounts;
drop policy if exists "Users can update their own Pinterest accounts" on public.pinterest_accounts;
drop policy if exists "Users can delete their own Pinterest accounts" on public.pinterest_accounts;

create policy "Users can read their own Pinterest accounts"
on public.pinterest_accounts for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can create their own Pinterest accounts"
on public.pinterest_accounts for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their own Pinterest accounts"
on public.pinterest_accounts for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own Pinterest accounts"
on public.pinterest_accounts for delete
to authenticated
using (auth.uid() = user_id);

-- Optional compatibility: if a future ai_decisions table exists, lock it down too.
do $$
begin
  if to_regclass('public.ai_decisions') is not null then
    execute 'alter table public.ai_decisions enable row level security';
  end if;
end $$;
