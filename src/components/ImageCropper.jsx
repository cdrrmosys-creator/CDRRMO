import React, { useState, useCallback } from 'react'
import Cropper from 'react-easy-crop'
import getCroppedImg from '../utils/cropImage'
import Modal from './Modal'

export default function ImageCropper({ isOpen, onClose, imageSrc, onCropComplete }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const handleCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }, [])

  const handleSave = async () => {
    if (!imageSrc || !croppedAreaPixels) return
    setIsProcessing(true)
    try {
      const croppedImageBlob = await getCroppedImg(
        imageSrc,
        croppedAreaPixels,
        rotation
      )
      onCropComplete(croppedImageBlob)
    } catch (e) {
      console.error(e)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Resize Profile Picture">
      <div style={{ position: 'relative', width: '100%', height: '400px', background: '#333' }}>
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          rotation={rotation}
          aspect={1}
          cropShape="round"
          showGrid={false}
          onCropChange={setCrop}
          onCropComplete={handleCropComplete}
          onZoomChange={setZoom}
          onRotationChange={setRotation}
        />
      </div>

      <div style={{ padding: '16px 0', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <i className="ri-zoom-out-line" style={{ color: 'var(--text-muted)' }}></i>
          <input
            type="range"
            value={zoom}
            min={1}
            max={3}
            step={0.1}
            aria-labelledby="Zoom"
            onChange={(e) => setZoom(Number(e.target.value))}
            style={{ flex: 1, accentColor: 'var(--primary)' }}
          />
          <i className="ri-zoom-in-line" style={{ color: 'var(--text-muted)' }}></i>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <i className="ri-anticlockwise-2-line" style={{ color: 'var(--text-muted)' }}></i>
          <input
            type="range"
            value={rotation}
            min={0}
            max={360}
            step={1}
            aria-labelledby="Rotation"
            onChange={(e) => setRotation(Number(e.target.value))}
            style={{ flex: 1, accentColor: 'var(--primary)' }}
          />
          <i className="ri-clockwise-2-line" style={{ color: 'var(--text-muted)' }}></i>
        </div>
      </div>

      <div className="form-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-light)' }}>
        <button type="button" className="btn-secondary" onClick={onClose} disabled={isProcessing}>
          Cancel
        </button>
        <button type="button" className="btn-submit" onClick={handleSave} disabled={isProcessing}>
          {isProcessing ? 'Processing...' : 'Save as Profile Picture'}
        </button>
      </div>
    </Modal>
  )
}
