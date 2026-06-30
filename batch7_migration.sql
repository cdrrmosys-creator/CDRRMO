-- Add status column to transport table
ALTER TABLE public.transport
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Scheduled';
