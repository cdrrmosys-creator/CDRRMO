-- ============================================================
-- Password Reset Requests Table
-- Run this in Supabase SQL Editor
-- ============================================================

create table if not exists public.password_reset_requests (
  id             uuid primary key default gen_random_uuid(),
  email          text not null,
  status         text not null default 'pending'
                   check (status in ('pending', 'approved', 'rejected')),
  security_token text not null,
  requested_at   timestamptz not null default now(),
  resolved_at    timestamptz,
  resolved_by    text,
  notes          text
);

-- Enable Row Level Security
alter table public.password_reset_requests enable row level security;

-- Anyone (even unauthenticated) can submit a request from the login page
create policy "Anyone can insert reset requests"
  on public.password_reset_requests
  for insert
  with check (true);

-- Only authenticated users (admins) can read all requests
create policy "Authenticated users can read reset requests"
  on public.password_reset_requests
  for select
  using (auth.role() = 'authenticated');

-- Only authenticated users (admins) can update request status
create policy "Authenticated users can update reset requests"
  on public.password_reset_requests
  for update
  using (auth.role() = 'authenticated');
