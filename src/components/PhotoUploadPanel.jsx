import { useState } from 'react'

export default function PhotoUploadPanel({
  title = 'Photos',
  emptyMessage = 'No photos uploaded yet.',
  photos = [],
  pendingPhotos = [],
  isViewing = false,
  isUploading = false,
  isSaving = false,
  onFileUpload,
  onRemoveExisting,
  onRemovePending,
  minHeight = '350px',
  addButtonLabel = 'Add Photos',
}) {
  const [isDragging, setIsDragging] = useState(false)
  const busy = isUploading || isSaving
  const hasPhotos = (photos?.length ?? 0) > 0 || pendingPhotos.length > 0

  const handleDragOver = (e) => {
    if (isViewing) return
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    if (isViewing) return
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e) => {
    if (isViewing) return
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    if (e.dataTransfer.files?.length > 0) {
      onFileUpload?.({ target: { files: e.dataTransfer.files } })
    }
  }

  const fileInputProps = {
    type: 'file',
    multiple: true,
    accept: 'image/*',
    onChange: onFileUpload,
    disabled: busy,
  }

  const hiddenInputStyle = {
    position: 'absolute',
    inset: 0,
    opacity: 0,
    cursor: isDragging ? 'copy' : 'pointer',
    zIndex: 10,
  }

  const removeBtnStyle = {
    position: 'absolute',
    top: '6px',
    right: '6px',
    background: 'rgba(239, 68, 68, 0.9)',
    color: 'white',
    border: 'none',
    borderRadius: '50%',
    width: '24px',
    height: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
  }

  return (
    <div style={{ minHeight, display: 'flex', flexDirection: 'column', height: '100%' }}>
      <h4 style={{ margin: '0 0 12px 0', color: 'var(--primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {title}
        {!isViewing && (
          <div style={{ position: 'relative' }}>
            <input {...fileInputProps} style={{ ...hiddenInputStyle, cursor: 'pointer' }} />
            <button
              type="button"
              className="btn-primary"
              disabled={busy}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              {busy ? <i className="ri-loader-4-line ri-spin" style={{ fontSize: '16px' }} /> : <i className="ri-camera-line" style={{ fontSize: '16px' }} />}
              {busy ? 'Uploading...' : addButtonLabel}
            </button>
          </div>
        )}
      </h4>

      {!hasPhotos ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px 20px',
            textAlign: 'center',
            background: isDragging ? 'var(--primary-bg)' : 'var(--bg-app)',
            borderRadius: '8px',
            border: `2px dashed ${isDragging ? 'var(--primary)' : 'var(--border-light)'}`,
            color: isDragging ? 'var(--primary)' : 'var(--text-muted)',
            transition: 'all 0.2s',
            position: 'relative',
          }}
        >
          {!isViewing && <input {...fileInputProps} style={hiddenInputStyle} />}
          <i className="ri-image-line" style={{ fontSize: '48px', color: isDragging ? 'var(--primary)' : 'var(--border-light)', transition: 'all 0.2s' }} />
          <p style={{ marginTop: '12px', fontWeight: '600' }}>{isDragging ? 'Drop photos here' : emptyMessage}</p>
          {!isViewing && <p style={{ fontSize: '12px', marginTop: '4px', opacity: 0.7 }}>Drag and drop or click to upload</p>}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '12px' }}>
          {photos?.map((url, idx) => (
            <div
              key={`existing-${idx}`}
              style={{ position: 'relative', aspectRatio: '1', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-light)' }}
            >
              <a href={url} target="_blank" rel="noopener noreferrer">
                <img src={url} alt={`Photo ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </a>
              {!isViewing && (
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); onRemoveExisting?.(idx) }}
                  style={removeBtnStyle}
                >
                  <i className="ri-close-line" style={{ fontSize: '14px' }} />
                </button>
              )}
            </div>
          ))}

          {pendingPhotos.map((file, idx) => {
            const objectUrl = URL.createObjectURL(file)
            return (
              <div
                key={`pending-${idx}`}
                style={{
                  position: 'relative',
                  aspectRatio: '1',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  border: '1px solid var(--primary)',
                  opacity: isUploading ? 0.6 : 1,
                }}
              >
                <img
                  src={objectUrl}
                  alt={`Pending photo ${idx + 1}`}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onLoad={() => URL.revokeObjectURL(objectUrl)}
                />
                {!isViewing && !isUploading && (
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); onRemovePending?.(idx) }}
                    style={removeBtnStyle}
                  >
                    <i className="ri-close-line" style={{ fontSize: '14px' }} />
                  </button>
                )}
                {isUploading && (
                  <div style={{
                    position: 'absolute', inset: 0, display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(255,255,255,0.5)',
                  }}
                  >
                    <i className="ri-loader-4-line ri-spin" style={{ fontSize: '24px', color: 'var(--primary)' }} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
