import React, { useState, useEffect, useRef } from 'react'

export default function Modal({ isOpen, onClose, title, children, maxWidth, confirmOnClose }) {
  const [showConfirm, setShowConfirm] = useState(false)
  const bodyRef = useRef(null)

  useEffect(() => {
    if (!isOpen) {
      setShowConfirm(false)
    }
  }, [isOpen])

  if (!isOpen) return null

  const isViewOnly = confirmOnClose === false || (typeof title === 'string' && title.toLowerCase().includes('view details'))

  // Check if any enabled form fields inside the modal have user-entered content
  const checkFormHasContent = () => {
    if (!bodyRef.current) return false
    const controls = bodyRef.current.querySelectorAll('input, textarea, select')

    for (const el of controls) {
      // Ignore disabled, readonly, hidden, or button inputs
      if (el.readOnly || el.disabled || el.type === 'hidden' || el.type === 'button' || el.type === 'submit') continue

      const val = (el.value || '').trim()

      if (el.type === 'checkbox' || el.type === 'radio') {
        if (el.checked !== el.defaultChecked) return true
      } else if (el.tagName === 'SELECT') {
        if (val !== '' && el.selectedIndex > 0) return true
      } else {
        if (val.length > 0) return true
      }
    }
    return false
  }

  const handleAttemptClose = () => {
    if (isViewOnly || !checkFormHasContent()) {
      onClose?.()
    } else {
      setShowConfirm(true)
    }
  }

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      handleAttemptClose()
    }
  }

  const handleCancelBtnCapture = (e) => {
    const btn = e.target.closest('button')
    if (btn) {
      const text = btn.textContent ? btn.textContent.trim().toLowerCase() : ''
      if (text === 'cancel' || btn.classList.contains('btn-cancel') || btn.dataset.action === 'cancel') {
        if (!isViewOnly && checkFormHasContent()) {
          e.preventDefault()
          e.stopPropagation()
          setShowConfirm(true)
        }
      }
    }
  }

  const handleConfirmDiscard = () => {
    setShowConfirm(false)
    onClose?.()
  }

  return (
    <>
      <div className="modal-backdrop" onClick={handleBackdropClick}>
        <div className="modal-content" style={maxWidth ? { width: maxWidth, maxWidth: '95%' } : {}}>
          <div className="modal-header">
            <h3>{title}</h3>
            <button className="modal-close" onClick={handleAttemptClose} aria-label="Close modal">
              <i className="ri-close-line"></i>
            </button>
          </div>
          <div
            ref={bodyRef}
            className="modal-body"
            onClickCapture={handleCancelBtnCapture}
          >
            {children}
          </div>
        </div>
      </div>

      {/* Full-Viewport Unsaved Changes Confirmation Dialog */}
      {showConfirm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            animation: 'confirmFadeIn 0.15s ease-out',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-light)',
              borderRadius: '20px',
              padding: '28px 24px 24px 24px',
              maxWidth: '400px',
              width: '100%',
              boxShadow: '0 25px 60px -10px rgba(0, 0, 0, 0.35), 0 10px 20px -5px rgba(0, 0, 0, 0.1)',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px',
              animation: 'confirmScaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                background: '#fee2e2',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '26px',
                boxShadow: '0 4px 12px rgba(220, 38, 38, 0.15)',
              }}
            >
              <i className="ri-alert-line"></i>
            </div>
            <div>
              <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-main)', marginBottom: '8px', letterSpacing: '-0.2px' }}>
                Discard Unsaved Changes?
              </div>
              <div style={{ fontSize: '13.5px', color: 'var(--text-muted)', lineHeight: '1.5', fontWeight: '500' }}>
                Are you sure you want to close this form? Any information you entered will be lost.
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', width: '100%', marginTop: '6px' }}>
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                style={{
                  flex: 1,
                  padding: '11px 16px',
                  borderRadius: '12px',
                  border: '1px solid var(--border-light)',
                  background: 'var(--bg-app)',
                  color: 'var(--text-main)',
                  fontSize: '14px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: 'all 0.18s ease',
                }}
              >
                Keep Editing
              </button>
              <button
                type="button"
                onClick={handleConfirmDiscard}
                style={{
                  flex: 1,
                  padding: '11px 16px',
                  borderRadius: '12px',
                  border: 'none',
                  background: '#dc2626',
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(220, 38, 38, 0.3)',
                  transition: 'all 0.18s ease',
                }}
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
