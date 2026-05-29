-- PinMind Pinterest publishing metadata.
-- These columns let each PinMind board point to a Pinterest board and each
-- saved pin track whether it was published to Pinterest.

alter table public.boards
add column if not exists pinterest_board_id text;

alter table public.pins
add column if not exists pinterest_pin_id text,
add column if not exists pinterest_published_at timestamptz,
add column if not exists pinterest_publish_status text not null default 'not_published',
add column if not exists pinterest_publish_error text;

create index if not exists boards_pinterest_board_id_idx
on public.boards(pinterest_board_id);

create index if not exists pins_pinterest_publish_status_idx
on public.pins(pinterest_publish_status);
