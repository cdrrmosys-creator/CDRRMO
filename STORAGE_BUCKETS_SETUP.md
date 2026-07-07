# Storage Buckets Setup Guide

This document lists all the storage buckets needed for the CDRRMO system and provides SQL scripts to create them.

## Required Storage Buckets

| Module | Bucket Name | Purpose | SQL Script |
|--------|-------------|---------|------------|
| Incidents | `incidents` | Incident photos | `setup_storage.sql` |
| Inventory | `inventory` | Inventory item photos | `setup_storage.sql` |
| Drowning Incidents | `drowning-incidents` | Drowning incident photos | `create_drowning_incidents_bucket.sql` |
| Transport | `transport-photos` | Transport dispatch photos | `update_transport_table.sql` |
| Pruning & Trimming | `pruning-photos` | Pruning request photos | `update_pruning_table.sql` |
| Employees | `avatars` | Employee avatar photos | `supabase/UPDATE_SCHEMA_02.sql` |
| History | `history-files` | Historical document files | `update_history_doc_tables.sql` |
| Documentation | `doc-files` | Documentation files | `update_history_doc_tables.sql` |
| CDRRMC Meeting | `meeting-photos` | Meeting photos | `update_cdrrmc_tables.sql` |
| CDRRMC Resolution | `reso-files` | Resolution files | `update_cdrrmc_tables.sql` |
| Volunteers | `volunteers` | Volunteer photos | (needs script) |
| Vehicles | `vehicles` | Vehicle photos | (needs script) |

## How to Create Missing Buckets

### Option 1: Run Individual SQL Scripts
1. Open Supabase SQL Editor
2. Find and run the appropriate SQL script from the table above
3. Verify the bucket was created in Storage section

### Option 2: Create Manually via Supabase Dashboard
1. Go to Supabase Dashboard → Storage
2. Click "New bucket"
3. Enter bucket name (e.g., `drowning-incidents`)
4. Set "Public bucket" to ON
5. Click "Save"
6. Go to "Policies" tab
7. Create policies for SELECT, INSERT, and DELETE operations

## Recent Fix: Drowning Incidents Bucket

**Issue:** "Bucket not found" error when uploading photos in Drowning Incidents module

**Solution:** Run `create_drowning_incidents_bucket.sql`

```sql
-- Creates the 'drowning-incidents' bucket with public access
-- and policies for read, upload, and delete operations
```

## Verifying Buckets

To check which buckets exist in your Supabase project:

```sql
SELECT id, name, public, created_at 
FROM storage.buckets 
ORDER BY created_at DESC;
```

To check policies for a specific bucket:

```sql
SELECT * 
FROM storage.policies 
WHERE bucket_id = 'drowning-incidents';
```

## Notes

- All buckets are set to **public** for easy access (photos/files are accessible via direct URL)
- Each bucket has three policies: SELECT (read), INSERT (upload), DELETE (remove)
- Bucket names use kebab-case (lowercase with hyphens)
- File paths within buckets follow the pattern: `{bucket-name}/{timestamp}-{filename}`
