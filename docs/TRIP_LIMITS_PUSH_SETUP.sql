-- Group size limit, push subscriptions and expense edit tracking (already applied to the payanam project).
alter table public.trips add column if not exists max_members integer check (max_members is null or (max_members between 2 and 100));

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions(user_id);
alter table public.push_subscriptions enable row level security;

alter table public.trip_expenses add column if not exists updated_at timestamp without time zone;
