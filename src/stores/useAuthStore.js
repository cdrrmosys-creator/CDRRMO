import { create } from 'zustand'
import { auth } from '../services/supabase'
import { supabase } from '../services/supabase'

export const useAuthStore = create((set, get) => ({
  user: null,
  session: null,
  loading: false,
  initializing: true,   // true only during the first session check
  error: null,

  // Initialize auth state
  initialize: async () => {
    try {
      set({ initializing: true })
      const session = await auth.getSession()
      set({ 
        user: session?.user ?? null, 
        session,
        initializing: false 
      })

      // Listen for auth changes
      auth.onAuthStateChange((_event, session) => {
        set({ 
          user: session?.user ?? null, 
          session 
        })
      })
    } catch (error) {
      set({ error: error.message, initializing: false })
    }
  },

  // Sign in
  signIn: async (email, password) => {
    try {
      set({ loading: true, error: null })
      const { user, session } = await auth.signIn(email, password)
      set({ user, session, loading: false })

      // Log login event — write directly to avoid circular import with logAudit
      try {
        await supabase.from('audit_logs').insert([{
          user_email: user?.email ?? email,
          action: 'Login',
          module: 'System',
          record_id: '',
          details: 'User signed in'
        }])
      } catch (_) { /* audit failure should not block login */ }

      return { success: true }
    } catch (error) {
      set({ error: error.message, loading: false })
      return { success: false, error: error.message }
    }
  },

  // Sign out
  signOut: async () => {
    try {
      // Log logout before clearing state so we still have the user email
      const { user } = get()
      if (user?.email) {
        try {
          await supabase.from('audit_logs').insert([{
            user_email: user.email,
            action: 'Logout',
            module: 'System',
            record_id: '',
            details: 'User signed out'
          }])
        } catch (_) { /* audit failure should not block logout */ }
      }

      await auth.signOut()
      set({ user: null, session: null })
      return { success: true }
    } catch (error) {
      set({ error: error.message })
      return { success: false, error: error.message }
    }
  },

  // Clear error
  clearError: () => set({ error: null }),
}))
