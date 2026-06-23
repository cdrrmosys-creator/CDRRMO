import { useState, useEffect } from 'react'
import { useAuthStore } from '../stores/useAuthStore'
import { supabase } from '../services/supabase'

/**
 * Returns the CRUD permissions for the current user on a given module.
 * Admins always get full access regardless of DB rows.
 *
 * Usage:
 *   const { canCreate, canRead, canUpdate, canDelete, loading } = usePermissions('incidents')
 */
export function usePermissions(module) {
  const { user } = useAuthStore()
  const isAdmin = user?.user_metadata?.role === 'admin'

  const [perms, setPerms] = useState({
    canCreate: false,
    canRead: true,   // default: can always view
    canUpdate: false,
    canDelete: false,
    loading: true,
  })

  useEffect(() => {
    if (!user) {
      setPerms({ canCreate: false, canRead: false, canUpdate: false, canDelete: false, loading: false })
      return
    }

    // Admins bypass permission checks entirely
    if (isAdmin) {
      setPerms({ canCreate: true, canRead: true, canUpdate: true, canDelete: true, loading: false })
      return
    }

    if (!module) {
      setPerms({ canCreate: false, canRead: true, canUpdate: false, canDelete: false, loading: false })
      return
    }

    supabase
      .from('user_permissions')
      .select('can_create, can_read, can_update, can_delete')
      .eq('user_id', user.id)
      .eq('module', module)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setPerms({
            canCreate: data.can_create,
            canRead:   data.can_read,
            canUpdate: data.can_update,
            canDelete: data.can_delete,
            loading: false,
          })
        } else {
          // No row = read-only by default
          setPerms({ canCreate: false, canRead: true, canUpdate: false, canDelete: false, loading: false })
        }
      })
  }, [user, module, isAdmin])

  return perms
}
