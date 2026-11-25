-- Applied to Supabase project kusebqvhwpcblfusazus
alter table public.chat_groups
  add column if not exists description text,
  add column if not exists region text,
  add column if not exists require_approval boolean not null default true,
  add column if not exists members_can_edit boolean not null default false,
  add column if not exists only_admins_post boolean not null default false;
alter table public.trips add column if not exists chat_name text;
alter table public.chat_reads add column if not exists marked_unread boolean not null default false;
