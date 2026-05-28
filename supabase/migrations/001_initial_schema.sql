-- PinMind initial Supabase schema.
-- This migration adds the relational database tables that will gradually replace
-- the current JSON file in server/data/db.json. The JSON file is intentionally
-- left untouched so the app can migrate one feature at a time.

-- Supabase projects usually include pgcrypto already, but creating it here makes
-- local development repeatable. gen_random_uuid() gives every new row a UUID.
create extension if not exists "pgcrypto";

-- This function keeps updated_at fresh whenever a row changes.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- profiles stores app-specific user information.
-- The id matches auth.users.id, which is the user id Supabase Auth provides.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- boards are the user's Pinterest-style collections.
-- tags is an array because the current app already treats board tags as a list.
create table public.boards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text not null default 'A fresh AI-organized board.',
  tags text[] not null default '{}',
  aesthetic text not null default 'curated visual inspiration',
  cover_image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- pins are saved images. Each pin belongs to one board and one user.
-- Keeping user_id here makes RLS policies and common queries simpler.
create table public.pins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  board_id uuid not null references public.boards(id) on delete cascade,
  title text not null default 'Untitled inspiration',
  caption text not null default '',
  tags text[] not null default '{}',
  image_url text not null,
  source text not null default 'Upload',
  height integer not null default 560,
  corrected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ai_predictions stores the transparent "AI" scoring result.
-- pin_id is nullable because the app predicts before the user decides to save.
create table public.ai_predictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  pin_id uuid references public.pins(id) on delete set null,
  predicted_board_id uuid references public.boards(id) on delete set null,
  selected_board_id uuid references public.boards(id) on delete set null,
  confidence integer not null default 0 check (confidence >= 0 and confidence <= 100),
  signals text[] not null default '{}',
  alternatives jsonb not null default '[]'::jsonb,
  scores jsonb not null default '[]'::jsonb,
  explanation text not null default '',
  input_title text not null default '',
  input_caption text not null default '',
  input_tags text[] not null default '{}',
  input_file_name text not null default '',
  input_dominant_color text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- image_sources tracks where an image came from.
-- Examples: local_upload, image_url, unsplash, pinterest, generated.
create table public.image_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  pin_id uuid references public.pins(id) on delete cascade,
  provider text not null default 'upload',
  source_url text,
  original_file_name text,
  storage_path text,
  mime_type text,
  width integer,
  height integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- pinterest_accounts stores connection metadata for future Pinterest publishing.
-- Access tokens should be stored securely; this starter table keeps token fields
-- nullable so you can add a safer secret-management flow before production.
create table public.pinterest_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null default 'pinterest',
  provider_account_id text,
  account_name text,
  profile_url text,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  scopes text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider, provider_account_id)
);

-- updated_at triggers for every table with editable data.
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger set_boards_updated_at
before update on public.boards
for each row execute function public.set_updated_at();

create trigger set_pins_updated_at
before update on public.pins
for each row execute function public.set_updated_at();

create trigger set_ai_predictions_updated_at
before update on public.ai_predictions
for each row execute function public.set_updated_at();

create trigger set_image_sources_updated_at
before update on public.image_sources
for each row execute function public.set_updated_at();

create trigger set_pinterest_accounts_updated_at
before update on public.pinterest_accounts
for each row execute function public.set_updated_at();

-- Indexes keep the most common queries fast as the local JSON data grows into SQL.
create index profiles_created_at_idx on public.profiles(created_at desc);

create index boards_user_id_idx on public.boards(user_id);
create index boards_created_at_idx on public.boards(created_at desc);

create index pins_user_id_idx on public.pins(user_id);
create index pins_board_id_idx on public.pins(board_id);
create index pins_created_at_idx on public.pins(created_at desc);

create index ai_predictions_user_id_idx on public.ai_predictions(user_id);
create index ai_predictions_pin_id_idx on public.ai_predictions(pin_id);
create index ai_predictions_predicted_board_id_idx on public.ai_predictions(predicted_board_id);
create index ai_predictions_selected_board_id_idx on public.ai_predictions(selected_board_id);
create index ai_predictions_created_at_idx on public.ai_predictions(created_at desc);

create index image_sources_user_id_idx on public.image_sources(user_id);
create index image_sources_pin_id_idx on public.image_sources(pin_id);
create index image_sources_provider_idx on public.image_sources(provider);
create index image_sources_created_at_idx on public.image_sources(created_at desc);

create index pinterest_accounts_user_id_idx on public.pinterest_accounts(user_id);
create index pinterest_accounts_provider_idx on public.pinterest_accounts(provider);
create index pinterest_accounts_created_at_idx on public.pinterest_accounts(created_at desc);

-- Row Level Security makes sure users can only see and edit their own data.
alter table public.profiles enable row level security;
alter table public.boards enable row level security;
alter table public.pins enable row level security;
alter table public.ai_predictions enable row level security;
alter table public.image_sources enable row level security;
alter table public.pinterest_accounts enable row level security;

-- Starter RLS policies for authenticated users.
-- auth.uid() is the logged-in user's Supabase Auth id.
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

create policy "Users can delete their own profile"
on public.profiles for delete
to authenticated
using (auth.uid() = id);

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
