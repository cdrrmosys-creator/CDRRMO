import { useState, useEffect } from 'react'
import { supabase } from '../../services/supabase'
import { format } from 'date-fns'

export default function TrainingConducted() {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => { loadRecords() }, [])

  const loadRecords = async () => {
    try {
      setLoading(true)
      setError(null)
      const { data, error } = await supabase.from('training_conducted').select('*').order('date', { ascending: false })
      if (error) throw error
      setRecords(data || [])
    } catch (err) {
      console.error('Error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this record?')) return
    try {
      const { error } = await supabase.from('training_conducted').delete().eq('id', id)
      if (error) throw error
      setRecords(records.filter(rec => rec.id !== id))
    } catch (err) {
      alert('Failed: ' + err.message)
    }
  }

  if (loading) return (<div className="loading-container"><i className="ri-loader-4-line loading-spinner"></i><p>Loading...</p></div>)
  if (error) return (<div style={{ padding: '32px', textAlign: 'center' }}><div style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 'var(--radius-md)', padding: '24px', color: '#991b1b', maxWidth: '500px', margin: '0 auto' }}><i className="ri-error-warning-line" style={{ fontSize: '48px', marginBottom: '16px' }}></i><h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>Error</h3><p>{error}</p><button onClick={loadRecords} style={{ marginTop: '16px', padding: '10px 20px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '700' }}>Try Again</button></div></div>)

  return (
    <div>
      <div className="page-header">
        <h2><i className="ri-presentation-line" style={{ marginRight: '12px' }}></i>Training Conducted</h2>
        <button className="btn-add" onClick={() => alert('Coming soon!')}><i className="ri-add-line"></i>Add Training</button>
      </div>
      {records.length === 0 ? (
        <div className="empty-state"><i className="ri-presentation-line"></i><h3>No Records</h3><p>Click Add Training to create your first record.</p></div>
      ) : (
        <div className="data-table">
          <table>
            <thead><tr><th>Date</th><th>Training Title</th><th>Venue</th><th>Facilitator</th><th>Participants</th><th>Actions</th></tr></thead>
            <tbody>
              {records.map(r => (
                <tr key={r.id}>
                  <td style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: '600' }}>{r.date ? format(new Date(r.date), 'MMM dd, yyyy') : '-'}</td>
                  <td style={{ fontWeight: '700' }}>{r.training_title || '-'}</td>
                  <td>{r.venue || '-'}</td>
                  <td>{r.facilitator || '-'}</td>
                  <td><div style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '13px' }}>{r.participants || '-'}</div></td>
                  <td><div className="table-actions"><button className="btn-icon btn-edit" onClick={() => alert('Coming soon!')} title="View"><i className="ri-eye-line"></i></button><button className="btn-icon btn-delete" onClick={() => handleDelete(r.id)} title="Delete"><i className="ri-delete-bin-line"></i></button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div style={{ marginTop: '16px', fontSize: '14px', color: 'var(--text-muted)', textAlign: 'center' }}>Total: <strong>{records.length}</strong></div>
    </div>
  )
}
