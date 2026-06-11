import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing Supabase environment variables. Please check your .env file or Vercel environment settings.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Admin client — uses service role key to create/manage auth users
// Note: Exposing the service key to the browser is a security risk in production,
// but required here to allow admin actions directly from the client application.
export const supabaseAdmin = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null

// Export useful database methods
export const db = {
  // Get all records from a table
  async getAll(table, orderBy = 'created_at', ascending = false) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order(orderBy, { ascending })
    
    if (error) throw error
    return data || []
  },

  // Get single record by ID
  async getById(table, id, idColumn = 'id') {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq(idColumn, id)
      .single()
    
    if (error) throw error
    return data
  },

  // Insert new record
  async insert(table, record) {
    const { data, error } = await supabase
      .from(table)
      .insert([record])
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  // Update record
  async update(table, id, updates, idColumn = 'id') {
    const { data, error } = await supabase
      .from(table)
      .update(updates)
      .eq(idColumn, id)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  // Delete record
  async delete(table, id, idColumn = 'id') {
    const { error } = await supabase
      .from(table)
      .delete()
      .eq(idColumn, id)
    
    if (error) throw error
    return true
  },

  // Search records
  async search(table, column, query) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .ilike(column, `%${query}%`)
    
    if (error) throw error
    return data || []
  },
}

// Auth helpers
export const auth = {
  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) throw error
    return data
  },

  async signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  },

  async getSession() {
    const { data: { session } } = await supabase.auth.getSession()
    return session
  },

  async getUser() {
    const { data: { user } } = await supabase.auth.getUser()
    return user
  },

  onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange(callback)
  },
}

export default supabase
