import { useState, useEffect, useRef, useCallback, createContext, useContext } from 'react'

// ── Context ──────────────────────────────────────────────────────
const ToastContext = createContext(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>')
  return ctx
}

// ── Single toast item ────────────────────────────────────────────
function ToastItem({ toast, onRemove }) {
  const [leaving, setLeaving] = useState(false)
  const duration = toast.duration || 4000
  const [isHovered, setIsHovered] = useState(false)
  const remainingRef = useRef(duration)
  const startTimeRef = useRef(null)

  const handleClose = useCallback(() => {
    setLeaving(true)
    setTimeout(() => onRemove(toast.id), 300)
  }, [onRemove, toast.id])

  useEffect(() => {
    if (leaving) return
    if (isHovered) return

    startTimeRef.current = Date.now()
    const timer = setTimeout(() => {
      handleClose()
    }, remainingRef.current)

    return () => {
      clearTimeout(timer)
      if (startTimeRef.current) {
        const elapsed = Date.now() - startTimeRef.current
        remainingRef.current = Math.max(0, remainingRef.current - elapsed)
      }
    }
  }, [isHovered, leaving, handleClose])

  const icons = {
    success: 'ri-checkbox-circle-fill',
    error: 'ri-error-warning-fill',
    warning: 'ri-alert-fill',
    info: 'ri-information-fill',
  }

  const title = toast.title || (toast.type ? toast.type.charAt(0).toUpperCase() + toast.type.slice(1) : 'Notification')

  return (
    <div
      className={`toast-item toast-${toast.type || 'info'} ${leaving ? 'toast-leaving' : ''} ${isHovered ? 'is-hovered' : ''}`}
      role="alert"
      style={{ '--duration': `${duration}ms` }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="toast-icon-wrap">
        <i className={icons[toast.type] || icons.info}></i>
      </div>
      <div className="toast-body">
        {title && <div className="toast-title">{title}</div>}
        <div className="toast-message">{toast.message}</div>
      </div>
      <button className="toast-close" onClick={handleClose} aria-label="Close notification">
        <i className="ri-close-line"></i>
      </button>
      <div className="toast-progress"></div>
    </div>
  )
}

// ── Provider ─────────────────────────────────────────────────────
let toastIdCounter = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const addToast = useCallback((message, type = 'info', options = {}) => {
    const id = ++toastIdCounter
    setToasts(prev => [...prev, { id, message, type, ...options }])
    return id
  }, [])

  const toast = useCallback((message, options = {}) => addToast(message, 'info', options), [addToast])
  toast.success = (message, options = {}) => addToast(message, 'success', options)
  toast.error = (message, options = {}) => addToast(message, 'error', options)
  toast.warning = (message, options = {}) => addToast(message, 'warning', options)
  toast.info = (message, options = {}) => addToast(message, 'info', options)

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* Toast container rendered in a portal-like fashion */}
      <div className="toast-container" aria-live="polite">
        {toasts.map(t => (
          <ToastItem key={t.id} toast={t} onRemove={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}
