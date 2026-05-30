-- Remove the optional Pinterest publishing metadata from PinMind.
-- This keeps the rest of the app schema intact.

drop index if exists public.boards_pinterest_board_id_idx;
drop index if exists public.pins_pinterest_publish_status_idx;

alter table public.boards
  drop column if exists pinterest_board_id;

alter table public.pins
  drop column if exists pinterest_pin_id,
  drop column if exists pinterest_published_at,
  drop column if exists pinterest_publish_status,
  drop column if exists pinterest_publish_error;

drop table if exists public.pinterest_accounts;
