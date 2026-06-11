import { supabase } from './supabase'
import { useAuthStore } from '../stores/useAuthStore'

/**
 * Logs an action to the audit_logs table.
 * @param {string} action - The action performed (e.g. 'Added', 'Updated', 'Deleted').
 * @param {string} module - The module name (e.g. 'Documentation', 'Employees').
 * @param {string} record_id - The ID of the record affected (e.g. 'DOC-2024-1234').
 * @param {string} details - Additional details about the action.
 */
export const logAudit = async (action, module, record_id = '', details = '') => {
  try {
    // Attempt to get user from auth store, fallback to checking session if not loaded
    let userEmail = 'Unknown User'
    const state = useAuthStore.getState()
    
    if (state?.user?.email) {
      userEmail = state.user.email
    } else {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user?.email) {
        userEmail = session.user.email
      }
    }

    const { error } = await supabase
      .from('audit_logs')
      .insert([{
        user_email: userEmail,
        action,
        module,
        record_id,
        details
      }])

    if (error) {
      console.error('Failed to log audit trail:', error)
    }
  } catch (err) {
    console.error('Exception while logging audit trail:', err)
  }
}
