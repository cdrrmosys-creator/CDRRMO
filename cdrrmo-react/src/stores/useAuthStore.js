import { create } from 'zustand'
import { auth } from '../services/supabase'

export const useAuthStore = create((set, get) => ({
  user: null,
  session: null,
  loading: true,
  error: null,

  // Initialize auth state
  initialize: async () => {
    try {
      set({ loading: true })
      const session = await auth.getSession()
      set({ 
        user: session?.user ?? null, 
        session,
        loading: false 
      })

      // Listen for auth changes
      auth.onAuthStateChange((_event, session) => {
        set({ 
          user: session?.user ?? null, 
          session 
        })
      })
    } catch (error) {
      set({ error: error.message, loading: false })
    }
  },

  // Sign in
  signIn: async (email, password) => {
    try {
      set({ loading: true, error: null })
      const { user, session } = await auth.signIn(email, password)
      set({ user, session, loading: false })
      return { success: true }
    } catch (error) {
      set({ error: error.message, loading: false })
      return { success: false, error: error.message }
    }
  },

  // Sign out
  signOut: async () => {
    try {
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
