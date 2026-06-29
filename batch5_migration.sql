-- ============================================================
-- BATCH 5 SQL MIGRATION — Vouchers & Inventory Enhancements
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Vouchers Enhancements
ALTER TABLE public.vouchers
  ADD COLUMN IF NOT EXISTS payee             text,
  ADD COLUMN IF NOT EXISTS particular        text,
  ADD COLUMN IF NOT EXISTS check_number      text,
  ADD COLUMN IF NOT EXISTS or_number         text,
  ADD COLUMN IF NOT EXISTS account_code      text,
  ADD COLUMN IF NOT EXISTS bank_name         text;

-- 2. Inventory Enhancements
ALTER TABLE public.inventory
  ADD COLUMN IF NOT EXISTS end_user          text,
  ADD COLUMN IF NOT EXISTS estimated_life    text,
  ADD COLUMN IF NOT EXISTS fund_cluster      text;
