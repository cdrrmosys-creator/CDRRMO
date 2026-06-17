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

/**
 * Deletes multiple files from a Supabase Storage bucket.
 * @param {string} bucket - The bucket name
 * @param {string[]} filePaths - Array of file paths to delete
 */
export async function deleteFiles(bucket, filePaths) {
  if (!filePaths || filePaths.length === 0) return
  
  const { data, error } = await supabase.storage
    .from(bucket)
    .remove(filePaths)

  if (error) {
    throw error
  }
  
  return data
}
