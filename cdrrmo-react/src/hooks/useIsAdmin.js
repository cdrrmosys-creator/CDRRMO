import { useAuthStore } from '../stores/useAuthStore'

/**
 * Returns true if the currently logged-in user has the 'admin' role.
 * Role is stored in Supabase user_metadata.role.
 * Defaults to false (read-only) for any user without an explicit admin role.
 */
export function useIsAdmin() {
  const { user } = useAuthStore()
  return user?.user_metadata?.role === 'admin'
}
