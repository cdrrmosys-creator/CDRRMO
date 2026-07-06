import { useState, useEffect } from 'react'
import { validateForm } from '../../utils/validation'
import { supabase, supabaseAdmin } from '../../services/supabase'
import { printPDF } from '../../utils/printPDF'
import Modal from '../../components/Modal'
import { useIsAdmin } from '../../hooks/useIsAdmin'
import { usePermissions } from '../../hooks/usePermissions'
import { useToast } from '../../components/Toast'
import { useConfirm } from '../../components/ConfirmDialog'
import ModuleToolbar from '../../components/ModuleToolbar'
import ListPagination from '../../components/ListPagination'
import ExportModal from '../../components/ExportModal'
import TableGhostRows from '../../components/TableGhostRows'
import useListPagination from '../../hooks/useListPagination'
import ImageCropper from '../../components/ImageCropper'
import StatusSelect from '../../components/StatusSelect'
import { uploadFile, deleteFiles } from '../../services/storage'
import { exportEmployeeProfile } from '../../utils/exportEmployeeProfile'
import PHAddressSelect from '../../components/PHAddressSelect'

const INITIAL_FORM_STATE = {
  employee_id: '',
  name: '',
  designation: '',
  email: '',
  contact: '',
  duty_status: 'Off Duty',
  office: 'CDRRMO Headquarters',
  dob: '',
  pob: '',
  civil_status: 'Single',
  sex: '',
  blood_type: '',
  // Structured address
  address: '',           // full string (assembled for display/export)
  addr_province: '',
  addr_province_code: '',
  addr_city: '',
  addr_city_code: '',
  addr_barangay: '',
  addr_barangay_code: '',
  addr_street: '',
  height: '',
  weight: '',
  waist: '',
  shirt_size: '',
  shoe_size: '',
  tin: '',
  pagibig: '',
  sss: '',
  gsis: '',
  philhealth: '',
  emergency_contact_person: '',
  emergency_contact_no: '',
  medical_condition: '',
  elementary: '',
  highschool: '',
  college: '',
  eligibility: '',
  father_name: '',
  mother_name: '',
  spouse_name: '',
  children: [],
  work_experience: [],
  trainings_attended: [],
  remarks: '',
  system_role: 'user',
  role: 'user',
  avatar_url: ''
}

const stripListMeta = (items = []) => items.map(({ saved, ...rest }) => rest)

const entryCardStyle = (saved) => ({
  background: 'var(--bg-app)',
  borderRadius: '8px',
  padding: '12px',
  marginBottom: '10px',
  border: `1px solid ${saved ? '#bbf7d0' : 'var(--border-light)'}`,
  boxShadow: saved ? 'inset 3px 0 0 #16a34a' : 'none',
})

const entrySaveBtnStyle = {
  padding: '8px 12px',
  borderRadius: '6px',
  border: '1px solid #bbf7d0',
  background: '#f0fdf4',
  color: '#15803d',
  cursor: 'pointer',
  flexShrink: 0,
  fontSize: '12px',
  fontWeight: '700',
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  alignSelf: 'flex-end',
  marginBottom: '2px',
}

export default function Employees() {
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Toolbar states
  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState('')
  const [dateRange, setDateRange] = useState({ start: '', end: '' })

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isViewing, setIsViewing] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [formData, setFormData] = useState(INITIAL_FORM_STATE)
  const [isEditing, setIsEditing] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('personal')
  const [visitedTabs, setVisitedTabs] = useState(new Set())

  // Avatar states
  const [isCropperOpen, setIsCropperOpen] = useState(false)
  const [selectedImageSrc, setSelectedImageSrc] = useState(null)
  const [croppedBlob, setCroppedBlob] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState('')

  const isAdmin = useIsAdmin()
  const { canCreate, canUpdate, canDelete } = usePermissions('employees')
  const toast = useToast()
  const confirm = useConfirm()

  useEffect(() => {
    loadEmployees()
  }, [])

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = (emp.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (emp.employee_id?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    const matchesFilter = filter ? emp.duty_status === filter : true

    let matchesDate = true
    if (dateRange.start && dateRange.end) {
      const created = new Date(emp.created_at)
      const start = new Date(dateRange.start)
      const end = new Date(dateRange.end)
      end.setHours(23, 59, 59, 999)
      matchesDate = created >= start && created <= end
    }

    return matchesSearch && matchesFilter && matchesDate
  })

  const [isExportOpen, setIsExportOpen] = useState(false)
  const { currentPage, setCurrentPage, pageSize, setPageSize: handlePageSizeChange, totalPages, safePage, pagedRecords } = useListPagination(filteredEmployees)

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, filter, dateRange, setCurrentPage])

  const hasActiveFilters = !!(searchTerm || filter || dateRange.start || dateRange.end)

  const handleClearFilters = () => {
    setSearchTerm('')
    setFilter('')
    setDateRange({ start: '', end: '' })
    setCurrentPage(1)
  }

  const handlePrintPDF = () => {
    printPDF({
      title: 'Employees Report',
      subtitle: `${filteredRecords.length} employees`,
      columns: [
        { header: 'ID', key: 'employee_id' },
        { header: 'Name', key: 'full_name' },
        { header: 'Designation', key: 'designation' },
        { header: 'Office', key: 'office' },
        { header: 'Contact', key: 'contact_no' },
        { header: 'Email', key: 'email' },
        { header: 'Role', key: 'role' },
        { header: 'Status', key: 'status' },
      ],
      records: filteredRecords,
    })
  }

  const handleViewDetails = (emp) => {
    setSelectedEmployee(emp)
    setIsEditing(true)
    setIsViewing(true)
    setSelectedId(emp.id)
    setAvatarPreview(emp.avatar_url || '')
    setCroppedBlob(null)
    setFormData({
      employee_id: emp.employee_id || '',
      name: emp.name || '',
      designation: emp.designation || '',
      email: emp.email || '',
      contact: emp.contact || '',
      duty_status: emp.duty_status || 'Off Duty',
      office: emp.office || 'CDRRMO Headquarters',
      dob: emp.dob || '',
      pob: emp.pob || '',
      civil_status: emp.civil_status || 'Single',
      sex: emp.sex || '',
      blood_type: emp.blood_type || '',
      address: emp.address || '',
      addr_province: emp.addr_province || '',
      addr_province_code: emp.addr_province_code || '',
      addr_city: emp.addr_city || '',
      addr_city_code: emp.addr_city_code || '',
      addr_barangay: emp.addr_barangay || '',
      addr_barangay_code: emp.addr_barangay_code || '',
      addr_street: emp.addr_street || '',
      height: emp.height || '',
      weight: emp.weight || '',
      waist: emp.waist || '',
      shirt_size: emp.shirt_size || '',
      shoe_size: emp.shoe_size || '',
      tin: emp.tin || '',
      pagibig: emp.pagibig || '',
      sss: emp.sss || '',
      gsis: emp.gsis || '',
      philhealth: emp.philhealth || '',
      emergency_contact_person: emp.emergency_contact_person || '',
      emergency_contact_no: emp.emergency_contact_no || '',
      medical_condition: emp.medical_condition || '',
      elementary: emp.elementary || '',
      highschool: emp.highschool || '',
      college: emp.college || '',
      eligibility: emp.eligibility || '',
      father_name: emp.father_name || '',
      mother_name: emp.mother_name || '',
      spouse_name: emp.spouse_name || '',
      children: (emp.children || []).map(c => ({ ...c, saved: true })),
      work_experience: (emp.work_experience || []).map(w => ({ ...w, saved: true })),
      trainings_attended: (emp.trainings_attended || []).map(t => ({ ...t, saved: true })),
      remarks: emp.remarks || '',
      system_role: 'user',
      role: emp.role || 'user'
    })
    setActiveTab('personal')
    setVisitedTabs(new Set(['personal','designation','profile','family','work','training','other','remarks']))
    setIsModalOpen(true)
  }

  const handleEditFromView = (e) => { e.preventDefault(); e.stopPropagation(); setIsViewing(false) }

  const handleDeleteFromView = async () => {
    const idToDelete = selectedId
    setIsModalOpen(false)
    await handleDelete(idToDelete)
  }

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
    setIsViewing(false)
    setSelectedId(null)
    setCroppedBlob(null)
    setAvatarPreview('')
    // Generate a default unique employee ID
    const year = new Date().getFullYear()
    const rand = Math.floor(1000 + Math.random() * 9000)
    setFormData({
      ...INITIAL_FORM_STATE,
      employee_id: `EMP-${year}-${rand}`
    })
    setActiveTab('personal')
    setVisitedTabs(new Set())
    setEmailError('')
    setIsModalOpen(true)
  }

  const handleOpenEdit = (emp) => {
    setIsEditing(true)
    setIsViewing(false)
    setSelectedId(emp.id)
    setCroppedBlob(null)
    setAvatarPreview(emp.avatar_url || '')
    setFormData({
      employee_id: emp.employee_id || '',
      name: emp.name || '',
      designation: emp.designation || '',
      email: emp.email || '',
      contact: emp.contact || '',
      duty_status: emp.duty_status || 'Off Duty',
      office: emp.office || 'CDRRMO Headquarters',
      dob: emp.dob || '',
      pob: emp.pob || '',
      civil_status: emp.civil_status || 'Single',
      sex: emp.sex || '',
      blood_type: emp.blood_type || '',
      address: emp.address || '',
      addr_province: emp.addr_province || '',
      addr_province_code: emp.addr_province_code || '',
      addr_city: emp.addr_city || '',
      addr_city_code: emp.addr_city_code || '',
      addr_barangay: emp.addr_barangay || '',
      addr_barangay_code: emp.addr_barangay_code || '',
      addr_street: emp.addr_street || '',
      height: emp.height || '',
      weight: emp.weight || '',
      waist: emp.waist || '',
      shirt_size: emp.shirt_size || '',
      shoe_size: emp.shoe_size || '',
      tin: emp.tin || '',
      pagibig: emp.pagibig || '',
      sss: emp.sss || '',
      gsis: emp.gsis || '',
      philhealth: emp.philhealth || '',
      emergency_contact_person: emp.emergency_contact_person || '',
      emergency_contact_no: emp.emergency_contact_no || '',
      medical_condition: emp.medical_condition || '',
      elementary: emp.elementary || '',
      highschool: emp.highschool || '',
      college: emp.college || '',
      eligibility: emp.eligibility || '',
      father_name: emp.father_name || '',
      mother_name: emp.mother_name || '',
      spouse_name: emp.spouse_name || '',
      children: (emp.children || []).map(c => ({ ...c, saved: true })),
      work_experience: (emp.work_experience || []).map(w => ({ ...w, saved: true })),
      trainings_attended: (emp.trainings_attended || []).map(t => ({ ...t, saved: true })),
      remarks: emp.remarks || '',
      system_role: emp.system_role || 'user',
      role: emp.role || 'user',
      avatar_url: emp.avatar_url || ''
    })
    setActiveTab('personal')
    setVisitedTabs(new Set(['personal','designation','profile','family','work','training','other','remarks']))
    setIsModalOpen(true)
  }

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0]
      const reader = new FileReader()
      reader.addEventListener('load', () => {
        setSelectedImageSrc(reader.result)
        setIsCropperOpen(true)
      })
      reader.readAsDataURL(file)
      // reset input value so the same file can be selected again
      e.target.value = null
    }
  }

  const handleCropComplete = (blob) => {
    setCroppedBlob(blob)
    const previewUrl = URL.createObjectURL(blob)
    setAvatarPreview(previewUrl)
    setIsCropperOpen(false)
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const saveChildEntry = (idx) => {
    const child = formData.children?.[idx]
    if (!String(child?.name ?? '').trim()) {
      toast.warning('Enter the child\'s name before saving this entry.')
      return
    }
    const updated = [...formData.children]
    updated[idx] = { ...updated[idx], saved: true }
    setFormData(p => ({ ...p, children: updated }))
    toast.success('Child entry saved.')
  }

  const saveWorkEntry = (idx) => {
    const entry = formData.work_experience?.[idx]
    if (!String(entry?.job_description ?? '').trim()) {
      toast.warning('Enter a job description before saving this entry.')
      return
    }
    const updated = [...formData.work_experience]
    updated[idx] = { ...updated[idx], saved: true }
    setFormData(p => ({ ...p, work_experience: updated }))
    toast.success('Work experience entry saved.')
  }

  const saveTrainingEntry = (idx) => {
    const entry = formData.trainings_attended?.[idx]
    if (!String(entry?.seminar ?? '').trim()) {
      toast.warning('Enter the training / seminar name before saving this entry.')
      return
    }
    const updated = [...formData.trainings_attended]
    updated[idx] = { ...updated[idx], saved: true }
    setFormData(p => ({ ...p, trainings_attended: updated }))
    toast.success('Training entry saved.')
  }

  const markListEntryDirty = (listKey, idx, patch) => {
    setFormData(p => {
      const updated = [...(p[listKey] || [])]
      updated[idx] = { ...updated[idx], ...patch, saved: false }
      return { ...p, [listKey]: updated }
    })
  }

  // Email duplicate check — fires when user finishes typing the email
  const [emailError, setEmailError] = useState('')
  const handleEmailBlur = async () => {
    const email = (formData.email || '').trim()
    if (!email) { setEmailError(''); return }
    // Skip check when editing same employee
    const currentEmp = employees.find(e => e.id === selectedId)
    if (currentEmp?.email === email) { setEmailError(''); return }

    const { data } = await supabase
      .from('employees')
      .select('id, name')
      .eq('email', email)
      .maybeSingle()
    if (data) {
      setEmailError(`Already used by: ${data.name}`)
    } else {
      setEmailError('')
    }
  }

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault()

    // Pre-submit validation
    const errors = validateForm({
      'Employee Name':     { rule: 'name',   value: formData.name,      required: true },
      'Email':             { rule: 'email',  value: formData.email },
      'Contact No.':       { rule: 'mobile', value: formData.contact },
      'Emergency Contact': { rule: 'mobile', value: formData.emergency_contact_no },
    })
    if (Object.keys(errors).length > 0) {
      Object.values(errors).forEach(msg => toast.error(msg))
      return
    }
    if (emailError) {
      toast.error('Please fix the email error before saving.')
      return
    }

    setIsSaving(true)

    // Extract fields that should not be sent to the database
    const { system_role, username: _username, ...employeeData } = formData

    // Set empty date to null to prevent postgres syntax error
    let payload = {
      ...employeeData,
      dob: employeeData.dob || null,
      role: system_role === 'admin' ? 'admin' : 'user',
      children: stripListMeta(employeeData.children),
      work_experience: stripListMeta(employeeData.work_experience),
      trainings_attended: stripListMeta(employeeData.trainings_attended),
    }

    try {
      // 1. Upload avatar if there is a newly cropped image blob
      if (croppedBlob) {
        const ext = croppedBlob.type === 'image/png' ? 'png' : 'jpeg'
        const filename = `${payload.employee_id || Date.now()}-${Date.now()}.${ext}`
        let publicUrl
        try {
          publicUrl = await uploadFile('avatars', filename, croppedBlob)
        } catch (uploadErr) {
          console.error('Avatar upload error:', uploadErr)
          throw new Error(
            uploadErr.message?.includes('row-level security')
              ? 'Avatar upload blocked by storage permissions. Run fix_avatars_storage.sql in Supabase, or ensure VITE_SUPABASE_SERVICE_KEY is configured.'
              : `Avatar upload failed: ${uploadErr.message}`
          )
        }

        // Delete old avatar from storage bucket if it exists
        if (isEditing && formData.avatar_url) {
          try {
            // Extract path from URL: .../avatars/{path}
            const match = formData.avatar_url.match(/\/avatars\/(.+)$/)
            if (match) await deleteFiles('avatars', [match[1]])
          } catch (delErr) {
            console.warn('Old avatar deletion failed:', delErr)
          }
        }

        payload.avatar_url = publicUrl
      }

      if (isEditing) {
        // 2. Sync email change to Supabase Auth if email was updated
        const originalEmployee = employees.find(emp => emp.id === selectedId)
        if (supabaseAdmin && formData.email && originalEmployee?.email !== formData.email) {
          try {
            // Find the auth user by old email
            const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
            const authUser = (listData?.users || []).find(u => u.email === originalEmployee?.email)
            if (authUser) {
              await supabaseAdmin.auth.admin.updateUserById(authUser.id, { email: formData.email })
            }
          } catch (authErr) {
            console.warn('Auth email update failed:', authErr)
            toast.warning('Employee record updated, but failed to update login email: ' + authErr.message)
          }
        }

        const { data, error } = await supabase
          .from('employees')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', selectedId)
          .select()

        if (error) throw error
        setEmployees(employees.map(emp => emp.id === selectedId ? data[0] : emp))
        toast.success('Employee updated successfully!')
      } else {
        // ── Pre-check: block if email already exists ────────────────────────
        if (formData.email) {
          const { data: existingEmp } = await supabase
            .from('employees')
            .select('id, name')
            .eq('email', formData.email)
            .maybeSingle()

          if (existingEmp) {
            toast.error(`Email "${formData.email}" is already used by employee "${existingEmp.name}".`)
            setIsSaving(false)
            return
          }

          if (supabaseAdmin) {
            const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 }).catch(() => ({ data: null }))
            const existingAuth = (listData?.users || []).find(u => u.email === formData.email)
            if (existingAuth) {
              toast.error(`The email "${formData.email}" already has a login account. Use a different email address.`)
              setIsSaving(false)
              return
            }
          }
        }

        // ── Step 1: Insert employee DB record FIRST ─────────────────────────
        const { data: newEmpData, error: insertError } = await supabase
          .from('employees')
          .insert([payload])
          .select()

        if (insertError) throw insertError   // DB failed — no auth account made

        // ── Step 2: Create auth account. If this fails, delete the DB record ─
        let accountCreated = false
        if (formData.email && supabaseAdmin) {
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
          if (authError) {
            // Rollback: delete the DB record we just inserted
            await supabase.from('employees').delete().eq('id', newEmpData[0].id)
            console.error('Auth account creation error:', authError)
            toast.error(`Could not create login account: ${authError.message}. Employee record was NOT saved.`)
            setIsSaving(false)
            return
          }
          accountCreated = true
        }

        setEmployees([newEmpData[0], ...employees])
        toast.success(accountCreated
          ? 'Employee added! Login account created with default password: 123456'
          : 'Employee added successfully!'
        )
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
      // Find the employee record first to get their email for auth deletion
      const employeeToDelete = employees.find(emp => emp.id === id)

      // Delete the DB record
      const { error } = await supabase
        .from('employees')
        .delete()
        .eq('id', id)

      if (error) throw error

      // Also delete the Supabase auth account if one exists
      if (employeeToDelete?.email && supabaseAdmin) {
        try {
          const { data: usersData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
          const authUser = (usersData?.users || []).find(u => u.email === employeeToDelete.email)
          if (authUser) {
            await supabaseAdmin.auth.admin.deleteUser(authUser.id)
          }
        } catch (authErr) {
          // Auth deletion failed but DB record is gone — warn but don't block
          console.warn('Auth user deletion failed:', authErr)
          toast.warning('Employee record deleted, but failed to remove their login account.')
        }
      }

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

  const DUTY_STATUS_OPTIONS = [
    { value: 'On Duty',  label: 'On Duty',  icon: 'ri-checkbox-circle-fill', bg: '#d1fae5', color: '#065f46' },
    { value: 'Off Duty', label: 'Off Duty', icon: 'ri-close-circle-fill',    bg: '#fee2e2', color: '#991b1b' },
    { value: 'Standby',  label: 'Standby',  icon: 'ri-time-fill',             bg: '#dbeafe', color: '#1e40af' },
    { value: 'On Leave', label: 'On Leave', icon: 'ri-calendar-fill',         bg: '#fef3c7', color: '#92400e' },
  ]

  const renderDutyStatus = (emp) => (
    <StatusSelect
      value={emp.duty_status || 'Off Duty'}
      options={DUTY_STATUS_OPTIONS}
      onChange={(val) => handleStatusChange(emp.id, val)}
      disabled={!isAdmin}
    />
  )

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
        <button className="btn-add" onClick={handleOpenAdd} style={{ display: (isAdmin || canCreate) ? '' : 'none' }}>
          <i className="ri-add-line"></i>
          Add Employee
        </button>
      </div>

      {/* ── Status summary cards ── */}
      {employees.length > 0 && (() => {
        const counts = {
          total:    employees.length,
          onDuty:   employees.filter(e => e.duty_status === 'On Duty').length,
          offDuty:  employees.filter(e => e.duty_status === 'Off Duty').length,
          standby:  employees.filter(e => e.duty_status === 'Standby').length,
          onLeave:  employees.filter(e => e.duty_status === 'On Leave').length,
        }
        const cards = [
          { label: 'Total',    count: counts.total,   value: '',         icon: 'ri-team-line',          accent: '#2563eb' },
          { label: 'On Duty',  count: counts.onDuty,  value: 'On Duty',  icon: 'ri-user-follow-line',   accent: '#16a34a' },
          { label: 'Off Duty', count: counts.offDuty, value: 'Off Duty', icon: 'ri-user-unfollow-line', accent: '#dc2626' },
          { label: 'Standby',  count: counts.standby, value: 'Standby',  icon: 'ri-user-line',          accent: '#0891b2' },
          { label: 'On Leave', count: counts.onLeave, value: 'On Leave', icon: 'ri-user-forbid-line',   accent: '#d97706' },
        ]
        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '20px' }}>
            {cards.map(c => (
              <div
                key={c.label}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '14px 16px', borderRadius: '12px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-light)',
                  borderTop: `3px solid ${c.accent}`,
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <div style={{
                  width: '38px', height: '38px', borderRadius: '10px', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: `${c.accent}12`
                }}>
                  <i className={c.icon} style={{ fontSize: '18px', color: c.accent }} />
                </div>
                <div>
                  <div style={{ fontSize: '22px', fontWeight: '900', lineHeight: 1, color: c.accent }}>{c.count}</div>
                  <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{c.label}</div>
                </div>
              </div>
            ))}
          </div>
        )
      })()}

      {employees.length > 0 && (
        <ModuleToolbar
          onSearch={setSearchTerm}
          onFilterChange={v => { setFilter(v); setCurrentPage(1) }}
          onDateRangeChange={setDateRange}
          pageSize={pageSize}
          onPageSizeChange={handlePageSizeChange}
          onExportClick={() => setIsExportOpen(true)}
          onPrintClick={handlePrintPDF}
          onClearFilters={handleClearFilters}
          hasActiveFilters={hasActiveFilters}
          filterLabel="All Status"
          filterOptions={[
            { label: 'On Duty',  value: 'On Duty' },
            { label: 'Off Duty', value: 'Off Duty' },
            { label: 'Standby',  value: 'Standby' },
            { label: 'On Leave', value: 'On Leave' },
          ]}
          filterColorMap={{
            'On Duty':  { bg: '#d1fae5', color: '#065f46', icon: 'ri-user-follow-line' },
            'Off Duty': { bg: '#fee2e2', color: '#991b1b', icon: 'ri-user-unfollow-line' },
            'Standby':  { bg: '#dbeafe', color: '#1e40af', icon: 'ri-user-line' },
            'On Leave': { bg: '#fef3c7', color: '#92400e', icon: 'ri-user-forbid-line' },
          }}
        />
      )}

      {employees.length === 0 ? (
        <div className="empty-state">
          <i className="ri-team-line"></i>
          <h3>No Employees Found</h3>
          <p>Click "Add Employee" to create your first employee record.</p>
        </div>
      ) : filteredEmployees.length === 0 ? (
        <div className="empty-state">
          <i className="ri-filter-off-line"></i>
          <h3>No Matching Records</h3>
          <p>Try adjusting your search or filters.</p>
        </div>
      ) : (
        <div className="data-table">
          <table style={{ tableLayout: 'fixed', width: '100%' }}>
            <colgroup>
              <col style={{ width: '110px' }} />{/* ID */}
              <col style={{ width: '170px' }} />{/* Name */}
              <col style={{ width: '140px' }} />{/* Designation */}
              <col style={{ width: '130px' }} />{/* Office */}
              <col style={{ width: '120px' }} />{/* Contact */}
              <col style={{ width: '170px' }} />{/* Email */}
              <col style={{ width: '70px' }}  />{/* Role */}
              <col style={{ width: '110px' }} />{/* Status */}
            </colgroup>
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Designation</th>
                <th>Office</th>
                <th>Contact</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {pagedRecords.map((emp) => (
                <tr
                  key={emp.id}
                  onClick={() => handleViewDetails(emp)}
                  style={{ cursor: 'pointer', height: '49px' }}
                  className="table-row-clickable"
                >
                  <td><code style={{ fontWeight: '700' }}>{emp.employee_id || '-'}</code></td>
                  <td style={{ fontWeight: '700' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '32px', height: '32px', borderRadius: '50%',
                        background: 'var(--bg-app)', border: '1px solid var(--border-light)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        overflow: 'hidden', flexShrink: 0
                      }}>
                        {emp.avatar_url
                          ? <img src={emp.avatar_url} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <i className="ri-user-line" style={{ fontSize: '14px', color: 'var(--text-muted)' }}></i>
                        }
                      </div>
                      <div>
                        <div>{emp.name || '-'}</div>
                        {emp.sex && emp.sex !== 'Rather not to say' && (
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '400' }}>{emp.sex}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td style={{ fontSize: '13px' }}>{emp.designation || '-'}</td>
                  <td style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{emp.office || '-'}</td>
                  <td style={{ fontSize: '13px', fontFamily: 'monospace' }}>{emp.contact || '-'}</td>
                  <td style={{ fontSize: '13px', maxWidth: '140px' }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {emp.email || '-'}
                    </div>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {(() => {
                      const r = emp.role || 'user'
                      return (
                        <span style={{
                          padding: '3px 10px', borderRadius: '10px', fontSize: '11px', fontWeight: '700',
                          background: r === 'admin' ? '#fee2e2' : '#eff6ff',
                          color: r === 'admin' ? '#991b1b' : '#1d4ed8'
                        }}>
                          {r === 'admin' ? 'Admin' : 'User'}
                        </span>
                      )
                    })()}
                  </td>
                  <td onClick={(e) => { if (isAdmin) e.stopPropagation(); }}>{renderDutyStatus(emp)}</td>
                </tr>
              ))}
              <TableGhostRows count={Math.max(0, pageSize - pagedRecords.length)} colSpan={8} />
            </tbody>
          </table>
        </div>
      )}

      <ListPagination
        currentPage={safePage}
        totalPages={totalPages}
        pageSize={pageSize}
        totalRecords={filteredEmployees.length}
        onPageChange={setCurrentPage}
      />

      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        records={employees}
        filename="employees_report.xlsx"
        sheetName="Employees"
        dateField="created_at"
        onSuccess={(count) => toast.success(`Exported ${count} records.`)}
        onError={(msg) => toast.error(msg)}
      />

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={isViewing ? 'Employee Details' : (isEditing ? 'Edit Employee Record' : 'Add Employee Record')}
        maxWidth="1100px"
      >
        <form onSubmit={e => e.preventDefault()} className="modal-form">
          {/* ── Sidebar steps + content ─────────────────────────────────────── */}
          {(() => {
            const TABS = [
              { id: 'personal',    label: 'Personal Info',    icon: 'ri-user-line' },
              { id: 'designation', label: 'Designation',      icon: 'ri-briefcase-line' },
              { id: 'profile',     label: 'Profile',          icon: 'ri-heart-pulse-line' },
              { id: 'family',      label: 'Family',           icon: 'ri-group-line' },
              { id: 'work',        label: 'Work Experience',  icon: 'ri-building-line' },
              { id: 'training',    label: 'Training',         icon: 'ri-book-open-line' },
              { id: 'other',       label: 'Other Info',       icon: 'ri-more-line' },
              { id: 'remarks',     label: 'Remarks',          icon: 'ri-sticky-note-line' },
            ]
            const currentIdx = TABS.findIndex(t => t.id === activeTab)
            const isLast  = currentIdx === TABS.length - 1
            const isFirst = currentIdx === 0

            // Completion check per tab — green only when meaningful data is present
            const REQUIRED = {
              personal:    ['name', 'contact', 'dob', 'pob', 'sex', 'civil_status', 'blood_type', 'addr_city'],
              designation: ['email'],
            }

            const isTabComplete = (tabId) => {
              const f = formData
              switch (tabId) {
                case 'personal':
                  return ['name','contact','dob','pob','sex','civil_status','blood_type','addr_city']
                    .every(k => String(f[k] ?? '').trim() !== '')
                case 'designation':
                  return String(f.designation ?? '').trim() !== '' && String(f.email ?? '').trim() !== ''
                case 'profile':
                  return ['emergency_contact_person','emergency_contact_no']
                    .some(k => String(f[k] ?? '').trim() !== '')
                case 'family':
                  return ['father_name','mother_name','spouse_name']
                    .some(k => String(f[k] ?? '').trim() !== '')
                case 'work':
                  return Array.isArray(f.work_experience) && f.work_experience.length > 0
                    && f.work_experience.some(w => String(w.job_description ?? '').trim() !== '')
                case 'training':
                  return Array.isArray(f.trainings_attended) && f.trainings_attended.length > 0
                    && f.trainings_attended.some(t => String(t.seminar ?? '').trim() !== '')
                case 'other':
                  return ['tin','sss','philhealth','pagibig','gsis']
                    .some(k => String(f[k] ?? '').trim() !== '')
                case 'remarks':
                  return String(f.remarks ?? '').trim() !== ''
                default:
                  return false
              }
            }

            const handleNext = () => {
              // Validate required fields first — don't mark next tab as visited if blocked
              const reqs = REQUIRED[TABS[currentIdx].id]
              if (reqs) {
                const missing = reqs.filter(f => String(formData[f] ?? '').trim() === '')
                if (missing.length > 0) {
                  toast.error('Please fill in all required fields before continuing.')
                  return
                }
              }

              // Strict format validation before leaving tabs that contain formatted data
              const currentTabId = TABS[currentIdx].id
              
              let fieldsToValidate = {}
              if (currentTabId === 'personal') {
                fieldsToValidate = {
                  'Employee Name': { rule: 'name',   value: formData.name },
                  'Contact No.':   { rule: 'mobile', value: formData.contact }
                }
              } else if (currentTabId === 'designation') {
                fieldsToValidate = {
                  'Email': { rule: 'email', value: formData.email }
                }
              } else if (currentTabId === 'profile') {
                fieldsToValidate = {
                  'Emergency Contact': { rule: 'mobile', value: formData.emergency_contact_no }
                }
              }

              if (Object.keys(fieldsToValidate).length > 0) {
                const errors = validateForm(fieldsToValidate)
                if (Object.keys(errors).length > 0) {
                  Object.values(errors).forEach(msg => toast.error(msg))
                  return
                }
              }

              if (currentTabId === 'designation' && emailError) {
                toast.error('Please fix the email error before continuing.')
                return
              }
              // Only after passing validation: mark current + next as visited and advance
              setVisitedTabs(prev => new Set([...prev, TABS[currentIdx].id, TABS[currentIdx + 1].id]))
              setActiveTab(TABS[currentIdx + 1].id)
            }

            return (
              <div style={{ display: 'flex', gap: 0, minHeight: '520px' }}>
                {/* Left sidebar */}
                <div style={{
                  width: '185px', flexShrink: 0,
                  borderRight: '1px solid var(--border-light)',
                  paddingRight: '0', paddingTop: '4px',
                  display: 'flex', flexDirection: 'column', gap: '2px'
                }}>
                  {TABS.map((t, idx) => {
                    const isActive   = t.id === activeTab
                    const wasVisited = visitedTabs.has(t.id) && !isActive
                    const complete   = wasVisited && isTabComplete(t.id)
                    const incomplete = wasVisited && !isTabComplete(t.id)
                    // In add mode, only visited tabs are clickable
                    const isClickable = isEditing || isActive || visitedTabs.has(t.id)

                    let bg    = 'transparent'
                    let color = 'var(--text-muted)'
                    let badgeBg    = 'var(--border-light)'
                    let badgeColor = 'var(--text-muted)'
                    let badgeContent = String(idx + 1)

                    if (isActive) {
                      bg = 'var(--primary)'; color = '#fff'
                      badgeBg = 'rgba(255,255,255,0.25)'; badgeColor = '#fff'
                    } else if (complete) {
                      bg = '#f0fdf4'; color = '#15803d'
                      badgeBg = '#16a34a'; badgeColor = '#fff'
                      badgeContent = '✓'
                    } else if (incomplete) {
                      bg = '#fefce8'; color = '#92400e'
                      badgeBg = '#f59e0b'; badgeColor = '#fff'
                      badgeContent = '!'
                    }

                    return (
                      <button key={t.id} type="button"
                        onClick={() => {
                          if (!isClickable) return
                          setVisitedTabs(prev => new Set([...prev, t.id]))
                          setActiveTab(t.id)
                        }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '10px',
                          padding: '10px 14px', border: 'none', borderRadius: '8px',
                          cursor: isClickable ? 'pointer' : 'default',
                          textAlign: 'left', fontSize: '13px',
                          fontWeight: isActive ? '700' : '500',
                          background: bg, color,
                          transition: 'all 0.15s'
                        }}>
                        <span style={{
                          width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '11px', fontWeight: '800',
                          background: badgeBg, color: badgeColor
                        }}>
                          {badgeContent}
                        </span>
                        {t.label}
                      </button>
                    )
                  })}
                </div>

                {/* Right content */}
                <div style={{ flex: 1, paddingLeft: '24px', paddingTop: '4px', overflow: 'auto' }}>
                  <fieldset disabled={isViewing} style={{ border: 'none', padding: 0, margin: 0, minWidth: 0 }}>
                    <div style={{ minHeight: '420px' }}>
              {activeTab === 'personal' && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '24px' }}>
                    <div style={{
                      width: '80px',
                      height: '80px',
                      borderRadius: '50%',
                      background: 'var(--bg-app)',
                      border: '2px dashed var(--border-light)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      flexShrink: 0
                    }}>
                      {avatarPreview ? (
                        <img src={avatarPreview} alt="Avatar Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <i className="ri-user-line" style={{ fontSize: '32px', color: 'var(--border-light)' }}></i>
                      )}
                    </div>
                    {!isViewing && (
                      <div>
                        <label style={{
                          display: 'inline-block',
                          background: 'var(--primary-bg)',
                          color: 'var(--primary-dark)',
                          padding: '8px 16px',
                          borderRadius: '8px',
                          fontWeight: '700',
                          fontSize: '13px',
                          cursor: 'pointer',
                          border: '1px solid var(--primary-light)',
                          transition: 'all 0.2s'
                        }}>
                          <i className="ri-upload-2-line" style={{ marginRight: '6px' }}></i>
                          Upload Picture
                          <input 
                            type="file" 
                            accept="image/*" 
                            style={{ display: 'none' }} 
                            onChange={handleFileChange}
                          />
                        </label>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
                          JPEG or PNG. Max 100kb (will be resized).
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Full Name <span style={{ color: "#dc2626" }}>*</span></label>
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
                      <label>Contact Number <span style={{ color: "#dc2626" }}>*</span></label>
                      <input
                        type="tel"
                        name="contact"
                        value={formData.contact}
                        onChange={e => {
                          // Only allow digits, +, -, spaces, ()
                          const val = e.target.value.replace(/[^0-9+\-\s()]/g, '')
                          handleInputChange({ target: { name: 'contact', value: val } })
                        }}
                        placeholder="e.g. 09171234567"
                        maxLength={15}
                        required
                      />
                    </div>
                  </div>

                  {/* Philippine address selector */}
                  <div className="form-group" style={{ marginBottom: '4px' }}>
                    <label>Home Address <span style={{ color: "#dc2626" }}>*</span></label>
                  </div>
                  <PHAddressSelect
                    disabled={isViewing}
                    required
                    value={{
                      province:       formData.addr_province,
                      province_code:  formData.addr_province_code,
                      city:           formData.addr_city,
                      city_code:      formData.addr_city_code,
                      barangay:       formData.addr_barangay,
                      barangay_code:  formData.addr_barangay_code,
                      street:         formData.addr_street,
                    }}
                    onChange={addr => {
                      const full = [addr.street, addr.barangay, addr.city, addr.province].filter(Boolean).join(', ')
                      setFormData(prev => ({
                        ...prev,
                        address:            full,
                        addr_province:      addr.province      || '',
                        addr_province_code: addr.province_code || '',
                        addr_city:          addr.city          || '',
                        addr_city_code:     addr.city_code     || '',
                        addr_barangay:      addr.barangay      || '',
                        addr_barangay_code: addr.barangay_code || '',
                        addr_street:        addr.street        || '',
                      }))
                    }}
                  />

                  <div className="form-row" style={{ marginTop: '4px' }}>
                    <div className="form-group">
                      <label>Date of Birth <span style={{ color: "#dc2626" }}>*</span></label>
                      <input
                        max={new Date().toISOString().split('T')[0]} type="date"
                        name="dob"
                        value={formData.dob}
                        onChange={handleInputChange}
                       
                        required
                      />
                      {formData.dob && (() => {
                        const today = new Date()
                        const birth = new Date(formData.dob)
                        let age = today.getFullYear() - birth.getFullYear()
                        const m = today.getMonth() - birth.getMonth()
                        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
                        return age >= 0 ? (
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                            Age: <strong style={{ color: 'var(--primary)' }}>{age} years old</strong>
                          </span>
                        ) : null
                      })()}
                    </div>
                    <div className="form-group">
                      <label>Place of Birth <span style={{ color: "#dc2626" }}>*</span></label>
                      <input type="text" name="pob" value={formData.pob} onChange={handleInputChange} required placeholder="e.g. Palayan City" />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Civil Status <span style={{ color: "#dc2626" }}>*</span></label>
                      <select name="civil_status" value={formData.civil_status} onChange={handleInputChange} required>
                        <option value="Single">Single</option>
                        <option value="Married">Married</option>
                        <option value="Divorced">Divorced</option>
                        <option value="Widowed">Widowed</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Sex <span style={{ color: "#dc2626" }}>*</span></label>
                      <select name="sex" value={formData.sex} onChange={handleInputChange} required>
                        <option value="">-- Select --</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Rather not to say">Rather not to say</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Blood Type <span style={{ color: "#dc2626" }}>*</span></label>
                      <select name="blood_type" value={formData.blood_type} onChange={handleInputChange} required>
                        <option value="">-- Select --</option>
                        {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(bt => <option key={bt} value={bt}>{bt}</option>)}
                      </select>
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'designation' && (
                <>
                  {/* Row 1: Designation + Office */}
                  <div className="form-row">
                    <div className="form-group">
                      <label>Designation</label>
                      <input type="text" name="designation" value={formData.designation}
                        onChange={handleInputChange} placeholder="e.g. Responder, Radio Op" />
                    </div>
                    <div className="form-group">
                      <label>Office / Station</label>
                      <input type="text" name="office" value={formData.office} onChange={handleInputChange} />
                    </div>
                  </div>

                  {/* Row 2: Email + Duty Status */}
                  <div className="form-row">
                    <div className="form-group">
                      <label>
                        Email Address <span style={{ color: '#dc2626' }}>*</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '6px' }}>(Used for Login)</span>
                      </label>
                      <input type="email" name="email" value={formData.email}
                        onChange={e => { handleInputChange(e); setEmailError('') }}
                        onBlur={handleEmailBlur}
                        placeholder="juan@cdrrmo.gov.ph" required />
                      {emailError && (
                        <div style={{ marginTop: '4px', fontSize: '12px', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <i className="ri-error-warning-line" /> {emailError}
                        </div>
                      )}
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

                  {/* Row 3: Employee ID (edit only) + System Role (add only) */}
                  <div className="form-row">
                    {isEditing && (
                      <div className="form-group">
                        <label>Employee ID</label>
                        <input type="text" name="employee_id" value={formData.employee_id}
                          onChange={handleInputChange} disabled
                          style={{ backgroundColor: 'var(--bg-app)', cursor: 'not-allowed', color: 'var(--text-muted)' }} />
                      </div>
                    )}
                    {!isEditing && (
                      <div className="form-group">
                        <label>
                          System Role
                          <span style={{ color: 'var(--primary)', fontSize: '12px', marginLeft: '6px' }}>(Controls App Permissions)</span>
                        </label>
                        <select name="system_role" value={formData.system_role} onChange={handleInputChange}>
                          <option value="user">Standard User (Read-only)</option>
                          <option value="admin">Administrator (Full Access)</option>
                        </select>
                      </div>
                    )}
                  </div>
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

              {activeTab === 'profile' && (
                <>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Medical Condition</label>
                      <input type="text" name="medical_condition" value={formData.medical_condition} onChange={handleInputChange} placeholder="e.g. None, Asthma, Diabetes" />
                    </div>
                    <div className="form-group">
                      <label>Emergency Contact Person</label>
                      <input type="text" name="emergency_contact_person" value={formData.emergency_contact_person} onChange={handleInputChange} />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Emergency Contact No.</label>
                      <input type="text" name="emergency_contact_no" value={formData.emergency_contact_no} onChange={handleInputChange} />
                    </div>
                  </div>
                  <hr style={{ border: 'none', borderTop: '1px solid var(--border-light)', margin: '8px 0' }} />
                  <p style={{ fontWeight: '700', fontSize: '13px', marginBottom: '8px', color: 'var(--primary)' }}>Educational Background</p>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Elementary</label>
                      <input type="text" name="elementary" value={formData.elementary} onChange={handleInputChange} />
                    </div>
                    <div className="form-group">
                      <label>High School</label>
                      <input type="text" name="highschool" value={formData.highschool} onChange={handleInputChange} />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>College</label>
                      <input type="text" name="college" value={formData.college} onChange={handleInputChange} />
                    </div>
                    <div className="form-group">
                      <label>Eligibility</label>
                      <input type="text" name="eligibility" value={formData.eligibility} onChange={handleInputChange} />
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'family' && (
                <>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Father's Name</label>
                      <input type="text" name="father_name" value={formData.father_name} onChange={handleInputChange} />
                    </div>
                    <div className="form-group">
                      <label>Mother's Maiden Name</label>
                      <input type="text" name="mother_name" value={formData.mother_name} onChange={handleInputChange} />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Spouse Name</label>
                      <input type="text" name="spouse_name" value={formData.spouse_name} onChange={handleInputChange} />
                    </div>
                  </div>
                  <hr style={{ border: 'none', borderTop: '1px solid var(--border-light)', margin: '8px 0' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <p style={{ fontWeight: '700', fontSize: '13px', color: 'var(--primary)', margin: 0 }}>Children</p>
                    {!isViewing && (
                      <button type="button" onClick={() => setFormData(p => ({ ...p, children: [...(p.children || []), { name: '', dob: '', saved: false }] }))}
                        style={{ fontSize: '12px', fontWeight: '700', padding: '4px 12px', borderRadius: '6px', border: '1px solid var(--primary)', color: 'var(--primary)', background: 'transparent', cursor: 'pointer' }}>
                        + Add Child
                      </button>
                    )}
                  </div>
                  {(formData.children || []).length === 0 && <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No children added.</p>}
                  {(formData.children || []).map((child, idx) => (
                    <div key={idx} style={entryCardStyle(child.saved)}>
                      {child.saved && (
                        <div style={{ marginBottom: '8px' }}>
                          <span style={{ fontSize: '11px', fontWeight: '700', color: '#15803d', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <i className="ri-checkbox-circle-fill" /> Saved
                          </span>
                        </div>
                      )}
                      <div className="form-row" style={{ alignItems: 'flex-end', marginBottom: 0 }}>
                      <div className="form-group">
                        <label>Name</label>
                        <input type="text" value={child.name} onChange={e => markListEntryDirty('children', idx, { name: e.target.value })} />
                      </div>
                      <div className="form-group">
                        <label>Date of Birth</label>
                        <input max={new Date().toISOString().split('T')[0]} type="date" value={child.dob} onChange={e => markListEntryDirty('children', idx, { dob: e.target.value })} />
                      </div>
                      {!isViewing && (
                        <>
                          <button type="button" onClick={() => saveChildEntry(idx)} style={entrySaveBtnStyle}>
                            <i className="ri-save-line" /> Save
                          </button>
                            <button type="button" onClick={() => setFormData(p => ({ ...p, children: p.children.filter((_, i) => i !== idx) }))}
                              style={{ padding: '8px', borderRadius: '6px', border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', cursor: 'pointer', flexShrink: 0, alignSelf: 'flex-end', marginBottom: '2px' }}>
                              <i className="ri-delete-bin-line" />
                            </button>
                        </>
                      )}
                      </div>
                    </div>
                  ))}
                </>
              )}

              {activeTab === 'work' && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <p style={{ fontWeight: '700', fontSize: '13px', color: 'var(--primary)', margin: 0 }}>Work Experience</p>
                    {!isViewing && (
                      <button type="button" onClick={() => setFormData(p => ({ ...p, work_experience: [...(p.work_experience || []), { job_description: '', date_from: '', date_to: '', saved: false }] }))}
                        style={{ fontSize: '12px', fontWeight: '700', padding: '4px 12px', borderRadius: '6px', border: '1px solid var(--primary)', color: 'var(--primary)', background: 'transparent', cursor: 'pointer' }}>
                        + Add Entry
                      </button>
                    )}
                  </div>
                  {(formData.work_experience || []).length === 0 && <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No work experience added.</p>}
                  {(formData.work_experience || []).map((we, idx) => (
                    <div key={idx} style={entryCardStyle(we.saved)}>
                      {we.saved && (
                        <div style={{ marginBottom: '8px' }}>
                          <span style={{ fontSize: '11px', fontWeight: '700', color: '#15803d', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <i className="ri-checkbox-circle-fill" /> Saved
                          </span>
                        </div>
                      )}
                      <div className="form-row" style={{ marginBottom: 0 }}>
                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                          <label>Job Description</label>
                          <input type="text" value={we.job_description} onChange={e => markListEntryDirty('work_experience', idx, { job_description: e.target.value })} />
                        </div>
                        <div className="form-group">
                          <label>From</label>
                          <input max={new Date().toISOString().split('T')[0]} type="date" value={we.date_from} onChange={e => markListEntryDirty('work_experience', idx, { date_from: e.target.value })} />
                        </div>
                        <div className="form-group">
                          <label>To</label>
                          <input max={new Date().toISOString().split('T')[0]} type="date" value={we.date_to} onChange={e => markListEntryDirty('work_experience', idx, { date_to: e.target.value })} />
                        </div>
                        {!isViewing && (
                          <>
                            <button type="button" onClick={() => saveWorkEntry(idx)} style={entrySaveBtnStyle}>
                              <i className="ri-save-line" /> Save
                            </button>
                            <button type="button" onClick={() => setFormData(p => ({ ...p, work_experience: p.work_experience.filter((_, i) => i !== idx) }))}
                              style={{ padding: '8px', borderRadius: '6px', border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', cursor: 'pointer', flexShrink: 0, alignSelf: 'flex-end', marginBottom: '2px' }}>
                              <i className="ri-delete-bin-line" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </>
              )}

              {activeTab === 'training' && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <p style={{ fontWeight: '700', fontSize: '13px', color: 'var(--primary)', margin: 0 }}>Seminar / Training Attended</p>
                    {!isViewing && (
                      <button type="button" onClick={() => setFormData(p => ({ ...p, trainings_attended: [...(p.trainings_attended || []), { seminar: '', date: '', conducted_by: '', venue: '', saved: false }] }))}
                        style={{ fontSize: '12px', fontWeight: '700', padding: '4px 12px', borderRadius: '6px', border: '1px solid var(--primary)', color: 'var(--primary)', background: 'transparent', cursor: 'pointer' }}>
                        + Add Training
                      </button>
                    )}
                  </div>
                  {(formData.trainings_attended || []).length === 0 && <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No trainings added.</p>}
                  {(formData.trainings_attended || []).map((tr, idx) => (
                    <div key={idx} style={entryCardStyle(tr.saved)}>
                      {tr.saved && (
                        <div style={{ marginBottom: '8px' }}>
                          <span style={{ fontSize: '11px', fontWeight: '700', color: '#15803d', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <i className="ri-checkbox-circle-fill" /> Saved
                          </span>
                        </div>
                      )}
                      <div className="form-row" style={{ flexWrap: 'wrap', gap: '8px', marginBottom: 0 }}>
                        <div className="form-group" style={{ flex: '2 1 180px' }}>
                          <label>Training / Seminar</label>
                          <input type="text" value={tr.seminar} onChange={e => markListEntryDirty('trainings_attended', idx, { seminar: e.target.value })} />
                        </div>
                        <div className="form-group" style={{ flex: '1 1 130px' }}>
                          <label>Date of Training</label>
                          <input max={new Date().toISOString().split('T')[0]} type="date" value={tr.date} onChange={e => markListEntryDirty('trainings_attended', idx, { date: e.target.value })} />
                        </div>
                        <div className="form-group" style={{ flex: '1 1 150px' }}>
                          <label>Conducted By</label>
                          <input type="text" value={tr.conducted_by} onChange={e => markListEntryDirty('trainings_attended', idx, { conducted_by: e.target.value })} />
                        </div>
                        <div className="form-group" style={{ flex: '1 1 150px' }}>
                          <label>Training Venue</label>
                          <input type="text" value={tr.venue} onChange={e => markListEntryDirty('trainings_attended', idx, { venue: e.target.value })} />
                        </div>
                        {!isViewing && (
                          <>
                            <button type="button" onClick={() => saveTrainingEntry(idx)} style={entrySaveBtnStyle}>
                              <i className="ri-save-line" /> Save
                            </button>
                            <button type="button" onClick={() => setFormData(p => ({ ...p, trainings_attended: p.trainings_attended.filter((_, i) => i !== idx) }))}
                              style={{ padding: '8px', borderRadius: '6px', border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', cursor: 'pointer', flexShrink: 0, alignSelf: 'flex-end', marginBottom: '2px' }}>
                              <i className="ri-delete-bin-line" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
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
          </fieldset>

                  {/* ── Bottom actions ── */}
                  {(() => {
                    const TABS_LIST = ['personal','designation','profile','family','work','training','other','remarks']
                    const currentIdx = TABS_LIST.indexOf(activeTab)
                    const isLast  = currentIdx === TABS_LIST.length - 1
                    const isFirst = currentIdx === 0
                    return (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-light)' }}>
                        <div>
                          {!isViewing && isEditing && formData.email && isAdmin && (
                            <button type="button" className="btn-secondary" onClick={handleResetPassword}
                              style={{ color: '#991b1b', borderColor: '#fecaca', background: '#fef2f2' }} disabled={isSaving}>
                              <i className="ri-key-2-line" style={{ marginRight: '6px' }}></i>Reset Password
                            </button>
                          )}
                        </div>
                        {isViewing ? (
                          <div style={{ display: 'flex', gap: '10px' }}>
                            <button type="button" onClick={async () => {
                              try { await exportEmployeeProfile(formData, avatarPreview) }
                              catch (err) { console.error('Export failed:', err); toast.error('Export failed: ' + (err?.message || '')) }
                            }} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', fontWeight: '600', background: '#dc2626', color: 'white', border: 'none', cursor: 'pointer', fontSize: '13px' }}>
                              <i className="ri-file-pdf-line" style={{ fontSize: '15px' }}></i> Export PDF
                            </button>
                            {(isAdmin || canDelete) && (
                              <button type="button" className="btn-delete" onClick={handleDeleteFromView}
                                style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', padding: '8px 16px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                                <i className="ri-delete-bin-line" style={{ marginRight: '6px' }}></i>Delete
                              </button>
                            )}
                            {(isAdmin || canUpdate) && (
                              <button type="button" className="btn-edit" onClick={handleEditFromView}
                                style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>
                                <i className="ri-pencil-line" style={{ marginRight: '6px' }}></i>Edit
                              </button>
                            )}
                            {!(isAdmin || canUpdate || canDelete) && (
                              <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>Close</button>
                            )}
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: '10px' }}>
                            {!isFirst && (
                              <button type="button" className="btn-secondary"
                                onClick={() => { setVisitedTabs(prev => new Set([...prev, TABS_LIST[currentIdx - 1]])); setActiveTab(TABS_LIST[currentIdx - 1]) }}>
                                <i className="ri-arrow-left-s-line" style={{ marginRight: '4px' }}></i>Back
                              </button>
                            )}
                            <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                            {!isLast ? (
                              <button type="button" className="btn-submit" onClick={handleNext}>
                                Next <i className="ri-arrow-right-s-line" style={{ marginLeft: '4px' }}></i>
                              </button>
                            ) : (
                              <button type="button" className="btn-submit" disabled={isSaving}
                                onClick={handleSubmit}>
                                {isSaving ? 'Saving...' : <><i className="ri-save-line" style={{ marginRight: '6px' }}></i>Save Employee</>}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </div>
              </div>
            )
          })()}
        </form>
      </Modal>

      {/* Image Cropper Modal */}
      {isCropperOpen && selectedImageSrc && (
        <ImageCropper
          isOpen={isCropperOpen}
          onClose={() => {
            setIsCropperOpen(false)
            setSelectedImageSrc(null)
          }}
          imageSrc={selectedImageSrc}
          onCropComplete={handleCropComplete}
        />
      )}

    </div>
  )
}
