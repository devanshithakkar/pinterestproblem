-- Reinforce AI feedback learning storage for user-specific corrections.
-- This migration is safe if 007_ai_feedback.sql already created the table.

create table if not exists public.ai_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pin_id uuid references public.pins(id) on delete set null,
  original_board_id uuid references public.boards(id) on delete set null,
  corrected_board_id uuid references public.boards(id) on delete set null,
  image_analysis jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- If an earlier local migration pointed user_id at profiles, replace that FK
-- with the direct auth.users relationship requested for feedback rows.
do $$
declare
  constraint_name text;
begin
  select conname into constraint_name
  from pg_constraint
  where conrelid = 'public.ai_feedback'::regclass
    and contype = 'f'
    and conkey = array[
      (
        select attnum
        from pg_attribute
        where attrelid = 'public.ai_feedback'::regclass
          and attname = 'user_id'
      )::smallint
    ]::smallint[];

  if constraint_name is not null then
    execute format('alter table public.ai_feedback drop constraint %I', constraint_name);
  end if;
end $$;

alter table public.ai_feedback
  add constraint ai_feedback_user_id_auth_users_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

create index if not exists ai_feedback_user_id_idx on public.ai_feedback(user_id);
create index if not exists ai_feedback_pin_id_idx on public.ai_feedback(pin_id);
create index if not exists ai_feedback_original_board_id_idx on public.ai_feedback(original_board_id);
create index if not exists ai_feedback_corrected_board_id_idx on public.ai_feedback(corrected_board_id);
create index if not exists ai_feedback_created_at_idx on public.ai_feedback(created_at desc);

alter table public.ai_feedback enable row level security;

drop policy if exists "Users can read their own AI feedback" on public.ai_feedback;
create policy "Users can read their own AI feedback"
on public.ai_feedback for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can create their own AI feedback" on public.ai_feedback;
create policy "Users can create their own AI feedback"
on public.ai_feedback for insert
to authenticated
with check (auth.uid() = user_id);
