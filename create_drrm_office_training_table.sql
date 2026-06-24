-- ─────────────────────────────────────────────────────────────────
-- DRRM Office Training registrations table
-- Run this once in Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────────

create table if not exists public.drrm_office_training (
  id                   uuid primary key default gen_random_uuid(),
  record_id            text,
  timestamp            timestamptz,
  first_name           text not null,
  middle_name          text,
  last_name            text not null,
  suffix               text,
  name_on_certificate  text,
  gender               text,
  contact_number       text,
  email_address        text,
  office               text,
  designation          text,
  civil_status         text,
  birthdate            date,
  present_address      text,
  photo_url            text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists idx_drrm_office_training_last_name
  on public.drrm_office_training (last_name);

-- Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists trg_drrm_office_training_updated_at on public.drrm_office_training;
create trigger trg_drrm_office_training_updated_at
  before update on public.drrm_office_training
  for each row execute function public.set_updated_at();

-- RLS: authenticated users can read/write
alter table public.drrm_office_training enable row level security;

create policy "Authenticated full access"
  on public.drrm_office_training for all
  to authenticated
  using (true) with check (true);
