import { useState, useCallback, createContext, useContext } from 'react'

// ── Context ──────────────────────────────────────────────────────
const ConfirmContext = createContext(null)

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used within <ConfirmProvider>')
  return ctx
}

// ── Provider ─────────────────────────────────────────────────────
export function ConfirmProvider({ children }) {
  const [dialog, setDialog] = useState(null)

  const confirm = useCallback((message, options = {}) => {
    return new Promise((resolve) => {
      setDialog({
        message,
        title: options.title || 'Confirm Action',
        confirmText: options.confirmText || 'Delete',
        cancelText: options.cancelText || 'Cancel',
        variant: options.variant || 'danger',
        icon: options.icon || 'ri-delete-bin-line',
        resolve,
      })
    })
  }, [])

  const handleConfirm = () => {
    dialog?.resolve(true)
    setDialog(null)
  }

  const handleCancel = () => {
    dialog?.resolve(false)
    setDialog(null)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}

      {dialog && (
        <div className="confirm-backdrop" onClick={handleCancel}>
          <div className="confirm-dialog" onClick={e => e.stopPropagation()}>
            {/* Icon */}
            <div className={`confirm-icon-wrap confirm-icon-${dialog.variant}`}>
              <i className={dialog.icon}></i>
            </div>

            {/* Content */}
            <div className="confirm-content">
              <h3 className="confirm-title">{dialog.title}</h3>
              <p className="confirm-message">{dialog.message}</p>
            </div>

            {/* Actions */}
            <div className="confirm-actions">
              <button className="confirm-btn-cancel" onClick={handleCancel}>
                {dialog.cancelText}
              </button>
              <button
                className={`confirm-btn-confirm confirm-btn-${dialog.variant}`}
                onClick={handleConfirm}
                autoFocus
              >
                {dialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}
