-- Store user-specific correction feedback when a pin is moved to a better board.
-- This is intentionally separate from pins so existing pins/boards stay untouched.

create table if not exists public.ai_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  pin_id uuid references public.pins(id) on delete set null,
  original_board_id uuid references public.boards(id) on delete set null,
  corrected_board_id uuid references public.boards(id) on delete set null,
  image_analysis jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

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

drop policy if exists "Users can delete their own AI feedback" on public.ai_feedback;
create policy "Users can delete their own AI feedback"
on public.ai_feedback for delete
to authenticated
using (auth.uid() = user_id);
