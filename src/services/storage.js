import { supabase } from './supabase'

/**
 * Uploads a file (Blob or File) to a Supabase Storage bucket.
 * Returns the public URL of the uploaded file.
 */
export async function uploadFile(bucket, filePath, file) {
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: true, // Overwrite if exists
    })

  if (error) {
    throw error
  }

  // Get the public URL
  const { data: publicUrlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(filePath)

  return publicUrlData.publicUrl
}
