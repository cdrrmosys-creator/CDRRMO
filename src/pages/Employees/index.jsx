import { useState, useEffect } from 'react'
import { supabase, supabaseAdmin } from '../../services/supabase'
import Modal from '../../components/Modal'
import { useIsAdmin } from '../../hooks/useIsAdmin'
import { useToast } from '../../components/Toast'
import { useConfirm } from '../../components/ConfirmDialog'

const INITIAL_FORM_STATE = {
  employee_id: '',
  name: '',
  username: '',
  designation: '',
  email: '',
  contact: '',
  duty_status: 'Off Duty',
  office: 'CDRRMO Headquarters',
  dob: '',
  pob: '',
  civil_status: 'Single',
  blood_type: '',
  address: '',
  height: '',
  weight: '',
  waist: '',
  shirt_size: '',
  shoe_size: '',
  father_name: '',
  mother_name: '',
  spouse_name: '',
  tin: '',
  pagibig: '',
  sss: '',
  gsis: '',
  philhealth: '',
  remarks: '',
  system_role: 'user'
}

export default function Employees() {
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [formData, setFormData] = useState(INITIAL_FORM_STATE)
  const [isEditing, setIsEditing] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('personal')
  const isAdmin = useIsAdmin()
  const toast = useToast()
  const confirm = useConfirm()

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

  const handleOpenAdd = () => {
    setIsEditing(false)
    setSelectedId(null)
    // Generate a default unique employee ID
    const year = new Date().getFullYear()
    const rand = Math.floor(1000 + Math.random() * 9000)
    setFormData({
      ...INITIAL_FORM_STATE,
      employee_id: `EMP-${year}-${rand}`
    })
    setActiveTab('personal')
    setIsModalOpen(true)
  }

  const handleOpenEdit = (emp) => {
    setIsEditing(true)
    setSelectedId(emp.id)
    setFormData({
      employee_id: emp.employee_id || '',
      name: emp.name || '',
      username: emp.username || '',
      designation: emp.designation || '',
      email: emp.email || '',
      contact: emp.contact || '',
      duty_status: emp.duty_status || 'Off Duty',
      office: emp.office || 'CDRRMO Headquarters',
      dob: emp.dob || '',
      pob: emp.pob || '',
      civil_status: emp.civil_status || 'Single',
      blood_type: emp.blood_type || '',
      address: emp.address || '',
      height: emp.height || '',
      weight: emp.weight || '',
      waist: emp.waist || '',
      shirt_size: emp.shirt_size || '',
      shoe_size: emp.shoe_size || '',
      father_name: emp.father_name || '',
      mother_name: emp.mother_name || '',
      spouse_name: emp.spouse_name || '',
      tin: emp.tin || '',
      pagibig: emp.pagibig || '',
      sss: emp.sss || '',
      gsis: emp.gsis || '',
      philhealth: emp.philhealth || '',
      remarks: emp.remarks || '',
      system_role: 'user'
    })
    setActiveTab('personal')
    setIsModalOpen(true)
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSaving(true)
    
    // Extract system_role to keep it out of the database insert/update payload
    const { system_role, ...employeeData } = formData
    
    // Set empty date to null to prevent postgres syntax error
    const payload = {
      ...employeeData,
      dob: employeeData.dob || null
    }
    
    try {
      if (isEditing) {
        const { data, error } = await supabase
          .from('employees')
          .update({
            ...payload,
            updated_at: new Date().toISOString()
          })
          .eq('id', selectedId)
          .select()

        if (error) throw error
        setEmployees(employees.map(emp => emp.id === selectedId ? data[0] : emp))
        toast.success('Employee updated successfully!')
      } else {
        // If email is provided, auto-create a Supabase Auth login account
        if (formData.email) {
          if (!supabaseAdmin) {
            toast.warning('VITE_SUPABASE_SERVICE_KEY is not set in .env. Login account was NOT created. Please add the service key and try again.')
          } else {
            const { error: authError } = await supabaseAdmin.auth.admin.createUser({
              email: formData.email,
              password: '123456',
              email_confirm: true,
              user_metadata: { 
                needs_password_change: true,
                role: system_role === 'admin' ? 'admin' : undefined,
                created_via_app: 'true'
              }
            })
            if (authError && !authError.message.toLowerCase().includes('already registered')) {
              console.warn('Auth account warning:', authError.message)
              toast.warning(`Employee record will be saved, but login account could not be created: ${authError.message}`)
            }
          }
        }

        const { data, error } = await supabase
          .from('employees')
          .insert([payload])
          .select()

        if (error) throw error
        setEmployees([data[0], ...employees])
        toast.success(formData.email ? 'Employee added! Login account created with default password: 123456' : 'Employee added successfully!')
      }
      setIsModalOpen(false)
    } catch (err) {
      console.error('Error saving employee:', err)
      toast.error('Error saving employee: ' + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id) => {
    const ok = await confirm('This employee record will be permanently removed. This action cannot be undone.', { title: 'Delete Employee' })
    if (!ok) return

    try {
      const { error } = await supabase
        .from('employees')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      
      setEmployees(employees.filter(emp => emp.id !== id))
      toast.success('Employee record deleted successfully!')
    } catch (err) {
      console.error('Error deleting employee:', err)
      toast.error('Failed to delete employee: ' + err.message)
    }
  }

  const handleResetPassword = async () => {
    if (!formData.email) {
      toast.warning('This employee has no email address configured.')
      return
    }
    const ok = await confirm(`The password for ${formData.email} will be reset to "123456". The user will be required to change it on next login.`, { title: 'Reset Password', confirmText: 'Reset', icon: 'ri-key-2-line', variant: 'warning' })
    if (!ok) return
    
    try {
      setIsSaving(true)
      const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers()
      if (listError) throw listError
      
      const authUser = usersData.users.find(u => u.email === formData.email)
      if (!authUser) {
        throw new Error('No login account found for this email address in the authentication system.')
      }

      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        authUser.id,
        { 
          password: '123456',
          user_metadata: { ...authUser.user_metadata, needs_password_change: true }
        }
      )
      
      if (updateError) throw updateError
      toast.success('Password reset to "123456". User will be forced to change it on next login.')
    } catch (err) {
      console.error('Error resetting password:', err)
      toast.error('Failed to reset password: ' + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleStatusChange = async (id, newStatus) => {
    try {
      const { error } = await supabase
        .from('employees')
        .update({
          duty_status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)

      if (error) throw error
      setEmployees(employees.map(emp => emp.id === id ? { ...emp, duty_status: newStatus } : emp))
    } catch (err) {
      console.error('Error updating status:', err)
      toast.error('Failed to update status: ' + err.message)
    }
  }

  const renderDutyStatus = (emp) => {
    const status = emp.duty_status
    const colors = {
      'On Duty': { bg: '#d1fae5', color: '#065f46' },
      'Off Duty': { bg: '#fee2e2', color: '#991b1b' },
      'Standby': { bg: '#dbeafe', color: '#1e40af' },
      'On Leave': { bg: '#fef3c7', color: '#92400e' }
    }
    const style = colors[status] || { bg: '#e5e7eb', color: '#374151' }
    
    if (isAdmin) {
      return (
        <select 
          value={status} 
          onChange={(e) => handleStatusChange(emp.id, e.target.value)}
          style={{
            padding: '4px 24px 4px 12px',
            borderRadius: '12px',
            fontSize: '12px',
            fontWeight: '700',
            background: style.bg,
            color: style.color,
            border: `1px solid ${style.color}40`,
            cursor: 'pointer',
            outline: 'none',
            appearance: 'none',
            backgroundImage: `url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23${style.color.replace('#', '')}%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 8px top 50%',
            backgroundSize: '8px auto'
          }}
        >
          <option value="On Duty">On Duty</option>
          <option value="Off Duty">Off Duty</option>
          <option value="Standby">Standby</option>
          <option value="On Leave">On Leave</option>
        </select>
      )
    }

    return (
      <span style={{
        display: 'inline-block',
        padding: '4px 12px',
        borderRadius: '12px',
        fontSize: '12px',
        fontWeight: '700',
        background: style.bg,
        color: style.color
      }}>
        {status}
      </span>
    )
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
        <button className="btn-add" onClick={handleOpenAdd} style={{ display: isAdmin ? '' : 'none' }}>
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
                <th>ID</th>
                <th>Name</th>
                <th>Username</th>
                <th>Designation</th>
                <th>Contact</th>
                <th>Status</th>
                {isAdmin && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp.id}>
                  <td><code style={{ fontWeight: '700' }}>{emp.employee_id || '-'}</code></td>
                  <td style={{ fontWeight: '700' }}>{emp.name || '-'}</td>
                  <td>{emp.username || '-'}</td>
                  <td>{emp.designation || '-'}</td>
                  <td>{emp.contact || '-'}</td>
                  <td>{renderDutyStatus(emp)}</td>
                  {isAdmin && (
                  <td>
                    <div className="table-actions">
                      <button 
                        className="btn-icon btn-edit"
                        onClick={() => handleOpenEdit(emp)}
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
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{
        marginTop: '16px',
        fontSize: '14px',
        color: 'var(--text-muted)',
        textAlign: 'center'
      }}>
        Total Employees: <strong>{employees.length}</strong>
      </div>

      {/* Add/Edit Modal */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={isEditing ? 'Edit Employee Record' : 'Add Employee Record'}
      >
        <form onSubmit={handleSubmit} className="modal-form">
          <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1px solid var(--border-light)', overflowX: 'auto' }}>
            <button 
              type="button"
              onClick={() => setActiveTab('personal')}
              style={{
                padding: '8px 16px',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === 'personal' ? '2px solid var(--primary)' : '2px solid transparent',
                color: activeTab === 'personal' ? 'var(--primary)' : 'var(--text-muted)',
                fontWeight: '700',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              Personal Info
            </button>
            <button 
              type="button"
              onClick={() => setActiveTab('designation')}
              style={{
                padding: '8px 16px',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === 'designation' ? '2px solid var(--primary)' : '2px solid transparent',
                color: activeTab === 'designation' ? 'var(--primary)' : 'var(--text-muted)',
                fontWeight: '700',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              Designation
            </button>
            <button 
              type="button"
              onClick={() => setActiveTab('other')}
              style={{
                padding: '8px 16px',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === 'other' ? '2px solid var(--primary)' : '2px solid transparent',
                color: activeTab === 'other' ? 'var(--primary)' : 'var(--text-muted)',
                fontWeight: '700',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              Other Info
            </button>
            <button 
              type="button"
              onClick={() => setActiveTab('remarks')}
              style={{
                padding: '8px 16px',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === 'remarks' ? '2px solid var(--primary)' : '2px solid transparent',
                color: activeTab === 'remarks' ? 'var(--primary)' : 'var(--text-muted)',
                fontWeight: '700',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              Remarks
            </button>
          </div>

          <div style={{ minHeight: '300px' }}>
            {activeTab === 'personal' && (
              <>
                <div className="form-row">
                  <div className="form-group">
                    <label>Full Name *</label>
                    <input 
                      type="text" 
                      name="name" 
                      value={formData.name} 
                      onChange={handleInputChange} 
                      required 
                      placeholder="e.g. Juan dela Cruz"
                    />
                  </div>
                  <div className="form-group">
                    <label>Contact Number</label>
                    <input 
                      type="text" 
                      name="contact" 
                      value={formData.contact} 
                      onChange={handleInputChange} 
                      placeholder="e.g. 0917-XXX-XXXX"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Home Address</label>
                  <textarea 
                    name="address" 
                    value={formData.address} 
                    onChange={handleInputChange} 
                    rows={2} 
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Date of Birth</label>
                    <input 
                      type="date" 
                      name="dob" 
                      value={formData.dob} 
                      onChange={handleInputChange} 
                    />
                  </div>
                  <div className="form-group">
                    <label>Place of Birth</label>
                    <input 
                      type="text" 
                      name="pob" 
                      value={formData.pob} 
                      onChange={handleInputChange} 
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Civil Status</label>
                    <select name="civil_status" value={formData.civil_status} onChange={handleInputChange}>
                      <option value="Single">Single</option>
                      <option value="Married">Married</option>
                      <option value="Divorced">Divorced</option>
                      <option value="Widowed">Widowed</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Blood Type</label>
                    <input 
                      type="text" 
                      name="blood_type" 
                      value={formData.blood_type} 
                      onChange={handleInputChange} 
                      placeholder="e.g. O+, A-"
                    />
                  </div>
                </div>
              </>
            )}

            {activeTab === 'designation' && (
              <>
                <div className="form-row">
                  <div className="form-group">
                    <label>Employee ID *</label>
                    <input 
                      type="text" 
                      name="employee_id" 
                      value={formData.employee_id} 
                      onChange={handleInputChange} 
                      required 
                     disabled style={{ backgroundColor: '#f3f4f6', cursor: 'not-allowed', color: '#6b7280' }} />
                  </div>
                  <div className="form-group">
                    <label>Username *</label>
                    <input 
                      type="text" 
                      name="username" 
                      value={formData.username} 
                      onChange={handleInputChange} 
                      required 
                      placeholder="Unique username"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Designation</label>
                    <input 
                      type="text" 
                      name="designation" 
                      value={formData.designation} 
                      onChange={handleInputChange} 
                      placeholder="e.g. Responder, Radio Op"
                    />
                  </div>
                  <div className="form-group">
                    <label>Office / Station</label>
                    <input 
                      type="text" 
                      name="office" 
                      value={formData.office} 
                      onChange={handleInputChange} 
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Email Address {isEditing ? '' : '(Used for Login)'}</label>
                    <input 
                      type="email" 
                      name="email" 
                      value={formData.email} 
                      onChange={handleInputChange} 
                      placeholder="juan@cdrrmo.gov.ph"
                    />
                  </div>
                  <div className="form-group">
                    <label>Duty Status</label>
                    <select name="duty_status" value={formData.duty_status} onChange={handleInputChange}>
                      <option value="On Duty">On Duty</option>
                      <option value="Off Duty">Off Duty</option>
                      <option value="Standby">Standby</option>
                      <option value="On Leave">On Leave</option>
                    </select>
                  </div>
                </div>

                {!isEditing && (
                  <div className="form-row">
                    <div className="form-group">
                      <label>System Role <span style={{ color: 'var(--primary)', fontSize: '12px' }}>(Controls App Permissions)</span></label>
                      <select name="system_role" value={formData.system_role} onChange={handleInputChange}>
                        <option value="user">Standard User (Read-only)</option>
                        <option value="admin">Administrator (Full Access)</option>
                      </select>
                    </div>
                  </div>
                )}
              </>
            )}

            {activeTab === 'other' && (
              <>
                <div className="form-row">
                  <div className="form-group">
                    <label>Height</label>
                    <input type="text" name="height" value={formData.height} onChange={handleInputChange} />
                  </div>
                  <div className="form-group">
                    <label>Weight</label>
                    <input type="text" name="weight" value={formData.weight} onChange={handleInputChange} />
                  </div>
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label>Shirt Size</label>
                    <input type="text" name="shirt_size" value={formData.shirt_size} onChange={handleInputChange} />
                  </div>
                  <div className="form-group">
                    <label>Shoe Size</label>
                    <input type="text" name="shoe_size" value={formData.shoe_size} onChange={handleInputChange} />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>TIN</label>
                    <input type="text" name="tin" value={formData.tin} onChange={handleInputChange} />
                  </div>
                  <div className="form-group">
                    <label>SSS</label>
                    <input type="text" name="sss" value={formData.sss} onChange={handleInputChange} />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>PhilHealth</label>
                    <input type="text" name="philhealth" value={formData.philhealth} onChange={handleInputChange} />
                  </div>
                  <div className="form-group">
                    <label>Pag-IBIG</label>
                    <input type="text" name="pagibig" value={formData.pagibig} onChange={handleInputChange} />
                  </div>
                </div>
              </>
            )}

            {activeTab === 'remarks' && (
              <div className="form-group">
                <label>Remarks / Notes</label>
                <textarea 
                  name="remarks" 
                  value={formData.remarks} 
                  onChange={handleInputChange} 
                  rows={4} 
                  placeholder="Additional notes about this employee..."
                />
              </div>
            )}
          </div>

          <div className="form-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              {isEditing && formData.email && isAdmin && (
                <button 
                  type="button" 
                  className="btn-secondary" 
                  onClick={handleResetPassword}
                  style={{ color: '#991b1b', borderColor: '#fecaca', background: '#fef2f2' }}
                  disabled={isSaving}
                >
                  <i className="ri-key-2-line" style={{ marginRight: '6px' }}></i>
                  Reset Password
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-submit" disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Employee'}
              </button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  )
}
