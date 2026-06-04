import React from 'react'

export default function Modal({ isOpen, onClose, title, children }) {
  if (!isOpen) return null

  // Close when clicking the backdrop
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="modal-content">
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close modal">
            <i className="ri-close-line"></i>
          </button>
        </div>
        <div className="modal-body">
          {children}
        </div>
      </div>
    </div>
  )
}
