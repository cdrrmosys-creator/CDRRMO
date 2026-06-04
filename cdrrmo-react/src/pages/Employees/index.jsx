import { useState, useEffect } from 'react'
import { supabase } from '../../services/supabase'

export default function Employees() {
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadEmployees()
  }, [])

  const loadEmployees = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setEmployees(data || [])
    } catch (err) {
      console.error('Error loading employees:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this employee?')) return

    try {
      const { error } = await supabase
        .from('employees')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      
      setEmployees(employees.filter(emp => emp.id !== id))
    } catch (err) {
      console.error('Error deleting employee:', err)
      alert('Failed to delete employee: ' + err.message)
    }
  }

  if (loading) {
    return (
      <div className="loading-container">
        <i className="ri-loader-4-line loading-spinner"></i>
        <p>Loading employees...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '32px', textAlign: 'center' }}>
        <div style={{
          background: '#fee2e2',
          border: '1px solid #fecaca',
          borderRadius: 'var(--radius-md)',
          padding: '24px',
          color: '#991b1b',
          maxWidth: '500px',
          margin: '0 auto'
        }}>
          <i className="ri-error-warning-line" style={{ fontSize: '48px', marginBottom: '16px' }}></i>
          <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>Error Loading Employees</h3>
          <p>{error}</p>
          <button 
            onClick={loadEmployees}
            style={{
              marginTop: '16px',
              padding: '10px 20px',
              background: 'var(--primary)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '700'
            }}
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <h2>
          <i className="ri-team-line" style={{ marginRight: '12px' }}></i>
          Employees
        </h2>
        <button className="btn-add" onClick={() => alert('Add Employee modal - Coming soon!')}>
          <i className="ri-add-line"></i>
          Add Employee
        </button>
      </div>

      {employees.length === 0 ? (
        <div className="empty-state">
          <i className="ri-team-line"></i>
          <h3>No Employees Found</h3>
          <p>Click "Add Employee" to create your first employee record.</p>
        </div>
      ) : (
        <div className="data-table">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Designation</th>
                <th>Contact</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp.id}>
                  <td style={{ fontWeight: '700' }}>{emp.name || '-'}</td>
                  <td>{emp.email || '-'}</td>
                  <td>{emp.designation || '-'}</td>
                  <td>{emp.contact || '-'}</td>
                  <td>
                    <span style={{
                      display: 'inline-block',
                      padding: '4px 12px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: '700',
                      background: emp.duty_status === 'Active' ? '#d1fae5' : '#fee2e2',
                      color: emp.duty_status === 'Active' ? '#065f46' : '#991b1b'
                    }}>
                      {emp.duty_status || 'Unknown'}
                    </span>
                  </td>
                  <td>
                    <div className="table-actions">
                      <button 
                        className="btn-icon btn-edit"
                        onClick={() => alert('Edit employee - Coming soon!')}
                        title="Edit"
                      >
                        <i className="ri-pencil-line"></i>
                      </button>
                      <button 
                        className="btn-icon btn-delete"
                        onClick={() => handleDelete(emp.id)}
                        title="Delete"
                      >
                        <i className="ri-delete-bin-line"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{
        marginTop: '24px',
        padding: '16px',
        background: '#dbeafe',
        border: '1px solid #bfdbfe',
        borderRadius: 'var(--radius-md)',
        fontSize: '14px',
        color: '#1e40af'
      }}>
        <strong>💡 Next Steps:</strong> To add employees, you'll need to create an "Add Employee" modal component. 
        Check the original Index.html file for the form fields and structure.
      </div>
    </div>
  )
}
