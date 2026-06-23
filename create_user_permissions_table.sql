-- ─────────────────────────────────────────────────────────────────
-- User Permissions table
-- Stores per-user, per-module CRUD permissions.
-- Run this once in Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────────

create table if not exists public.user_permissions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  module        text not null,
  can_create    boolean not null default false,
  can_read      boolean not null default true,
  can_update    boolean not null default false,
  can_delete    boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, module)
);

-- Index for fast lookup by user
create index if not exists idx_user_permissions_user_id
  on public.user_permissions (user_id);

-- Auto-update updated_at on row change
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_user_permissions_updated_at on public.user_permissions;
create trigger trg_user_permissions_updated_at
  before update on public.user_permissions
  for each row execute function public.set_updated_at();

-- RLS: only authenticated users can read their own permissions;
--      only service role (admin client) can write
alter table public.user_permissions enable row level security;

create policy "Users can read own permissions"
  on public.user_permissions for select
  using (auth.uid() = user_id);

create policy "Service role full access"
  on public.user_permissions for all
  using (true)
  with check (true);
