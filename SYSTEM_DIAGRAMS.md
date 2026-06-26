# CDRRMO System — Technical Diagrams

> **How to view:** Open in VS Code with the Markdown Preview Enhanced extension, or paste Mermaid blocks at [mermaid.live](https://mermaid.live).

---

## 1. Entity Relationship Diagram (ERD)

Shows all Supabase tables, their columns, and relationships.

```mermaid
erDiagram

  AUTH_USERS {
    uuid id PK
    string email
    jsonb user_metadata
    timestamptz created_at
  }

  EMPLOYEES {
    uuid id PK
    string employee_id UK
    string name
    string designation
    string email
    string contact
    string duty_status
    string office
    string role
    date dob
    string pob
    string civil_status
    string sex
    string blood_type
    string address
    string addr_city
    string addr_barangay
    string addr_street
    string height
    string weight
    string tin
    string sss
    string gsis
    string pagibig
    string philhealth
    string emergency_contact_person
    string emergency_contact_no
    string medical_condition
    string elementary
    string highschool
    string college
    string eligibility
    string father_name
    string mother_name
    string spouse_name
    jsonb children
    jsonb work_experience
    jsonb trainings_attended
    string avatar_url
    string remarks
    timestamptz created_at
    timestamptz updated_at
  }

  USER_PERMISSIONS {
    uuid id PK
    uuid user_id FK
    string module
    boolean can_create
    boolean can_read
    boolean can_update
    boolean can_delete
    timestamptz created_at
    timestamptz updated_at
  }

  INCIDENTS {
    uuid id PK
    string record_id UK
    string team
    date date
    string time_of_call
    string severity
    string nature_of_incident
    string place_of_incident
    string exact_place
    string name
    int age
    string address
    string vehicle
    string vehicle_other
    string helmet
    string liquor
    string time_of_arrival_at_scene
    string time_of_departure_at_scene
    string time_of_arrival_at_hosp
    string time_of_departure_at_hosp
    string back_to_base
    string action_given
    boolean refused_transfer
    string transfer_from
    string transfer_to
    string ambulance
    string remarks
    jsonb photos
    timestamptz created_at
  }

  AUDIT_LOGS {
    uuid id PK
    string user_email
    string action
    string module
    string record_id
    string details
    timestamptz created_at
  }

  DRRM_OFFICE_TRAINING {
    uuid id PK
    string record_id UK
    timestamptz timestamp
    string first_name
    string middle_name
    string last_name
    string suffix
    string name_on_certificate
    string gender
    string contact_number
    string email_address
    string office
    string designation
    string civil_status
    date birthdate
    string present_address
    string photo_url
    timestamptz created_at
  }

  VEHICLES {
    uuid id PK
    string plate_number UK
    string type
    string status
    timestamptz created_at
  }

  VOLUNTEERS {
    uuid id PK
    string name
    string status
    timestamptz created_at
  }

  INVENTORY {
    uuid id PK
    string item_name
    boolean serviceable
    timestamptz created_at
  }

  AUTH_USERS ||--o{ USER_PERMISSIONS : "has"
  AUTH_USERS ||--o| EMPLOYEES : "linked via email"
  USER_PERMISSIONS }o--|| AUTH_USERS : "belongs to"
```

---

## 2. Data Flow Diagram (DFD)

Illustrates how data moves between the React frontend, Supabase backend, and Vercel.

```mermaid
flowchart TD
  subgraph USER["👤 End User (Browser)"]
    UI["React SPA\n(Vite + React)"]
  end

  subgraph VERCEL["☁️ Vercel (Hosting)"]
    STATIC["Static Assets\n(HTML, JS, CSS)"]
    CDN["Global CDN\nEdge Network"]
  end

  subgraph SUPABASE["🗄️ Supabase (Backend)"]
    AUTH["Auth Service\n(JWT Tokens)"]
    DB["PostgreSQL DB\n(Tables + RLS)"]
    STORAGE["Object Storage\n(avatars bucket\nincidents bucket)"]
    REALTIME["Realtime\n(PostgREST API)"]
  end

  subgraph EXTERNAL["🌐 External"]
    GSHEETS["Google Sheets\n(Form Responses)"]
    GAS["Google Apps Script\n(DrrmTrainingSync.gs)"]
  end

  %% Deploy flow
  DEV["Developer\n(Local VSCode)"] -->|"git push"| VERCEL
  VERCEL --> STATIC
  STATIC --> CDN
  CDN -->|"Serve app"| UI

  %% Auth flow
  UI -->|"signIn(email, password)"| AUTH
  AUTH -->|"JWT + user_metadata"| UI

  %% Data flow
  UI -->|"supabase.from('table').select()"| REALTIME
  REALTIME -->|"Rows (JSON)"| UI
  UI -->|"insert / update / delete"| DB
  DB -->|"RLS check → result"| UI

  %% Storage
  UI -->|"uploadFile(bucket, path, blob)"| STORAGE
  STORAGE -->|"publicUrl"| UI

  %% Admin operations
  UI -->|"supabaseAdmin.auth.admin.*"| AUTH
  AUTH -->|"User list / create / delete"| UI

  %% Google Sheets sync
  GSHEETS -->|"Form submission"| GAS
  GAS -->|"POST /rest/v1/drrm_office_training"| DB

  %% Audit
  UI -->|"logAudit(action, module, id)"| DB
```

---

## 3. System Architecture Diagram

High-level view of all system components and how they connect.

```mermaid
flowchart LR
  subgraph CLIENT["Client Layer"]
    BROWSER["Browser\nChrome / Edge / Firefox"]
    REACT["React 19 SPA\n──────────────\n• Vite bundler\n• React Router v7\n• Zustand (state)\n• Recharts (charts)\n• jsPDF (PDF export)\n• SheetJS (XLSX export)"]
  end

  subgraph HOSTING["Hosting Layer — Vercel"]
    EDGE["Edge CDN\n(Global)"]
    BUILD["Build Pipeline\n• npm run build\n• Vite output → dist/"]
  end

  subgraph BACKEND["Backend Layer — Supabase (managed)"]
    direction TB
    PG["PostgreSQL 15\n──────────────\n• employees\n• incidents\n• vehicles\n• volunteers\n• inventory\n• audit_logs\n• user_permissions\n• drrm_office_training\n• (+ 15 more tables)"]
    PGAUTH["Auth Service\n──────────────\n• Email+Password\n• JWT sessions\n• user_metadata (role)\n• Admin API"]
    PGSTORAGE["Object Storage\n──────────────\n• avatars bucket\n• incidents bucket"]
    PGAPI["PostgREST API\n──────────────\n• Auto REST from schema\n• RLS enforcement\n• Service role bypass"]
  end

  subgraph GOOGLE["Google Integration"]
    SHEETS["Google Sheets\n(DRRM Training Forms)"]
    APPSCRIPT["Apps Script\nDrrmTrainingSync.gs"]
  end

  BROWSER --> REACT
  REACT -->|"HTTPS requests"| EDGE
  EDGE -->|"Serve static bundle"| REACT
  BUILD --> EDGE

  REACT -->|"@supabase/supabase-js\nanon key (read/RLS)"| PGAPI
  REACT -->|"service role key\n(admin operations)"| PGAUTH
  REACT -->|"storage SDK"| PGSTORAGE
  PGAPI --> PG
  PGAUTH --> PG

  SHEETS -->|"Form Submit trigger"| APPSCRIPT
  APPSCRIPT -->|"REST API POST\nservice role key"| PGAPI
```

---

## 4. Component Diagram

Maps React components, pages, and their interactions.

```mermaid
flowchart TD
  subgraph APP["App.jsx (Root)"]
    ROUTER["BrowserRouter\n+ Routes"]
    PROVIDERS["Providers\n• ToastProvider\n• ConfirmProvider"]
  end

  subgraph LAYOUT["Layout.jsx"]
    SIDEBAR["Sidebar.jsx\n(Nav links, admin gates)"]
    TOPBAR["Topbar.jsx\n(Search, Profile modal, Logout)"]
    OUTLET["<Outlet />\n(Page content)"]
  end

  subgraph PAGES["Pages (src/pages/)"]
    DASH["Dashboard\n• Stat cards\n• Incident Trend chart\n• Incidents by Team\n• Recent Incidents"]
    EMP["Employees\n• List + search/filter\n• Add wizard (8 steps)\n• Edit modal\n• Export PDF"]
    INC["Incidents\n• Paginated list\n• Filters + Export XLSX\n• View/Edit modal (tabs)"]
    DOCS["Documentation\n• Archive tab\n• Training Registrations tab\n• DRRM Office Training tab"]
    PERM["UserPermissions\n• User list\n• CRUD matrix per module"]
    OTHER["Vouchers, Inventory,\nVehicles, Drivers,\nTransport, Venues,\nActivities, Events,\nTraining, Volunteers,\nMaps, Pruning,\nCalendar, History,\nCCTV, Resolutions,\nMeetings, Kloudtrack,\nAudit Trail,\nClient Satisfaction"]
  end

  subgraph COMPONENTS["Shared Components (src/components/)"]
    MODAL["Modal.jsx"]
    TOOLBAR["ModuleToolbar.jsx\n(Search, Filter, Export)"]
    IMGCROP["ImageCropper.jsx"]
    TOAST["Toast.jsx"]
    CONFIRM["ConfirmDialog.jsx"]
    PHADDR["PHAddressSelect.jsx\n(Nueva Ecija dropdowns)"]
  end

  subgraph HOOKS["Hooks (src/hooks/)"]
    ISADMIN["useIsAdmin()"]
    PERMS["usePermissions(module)"]
  end

  subgraph SERVICES["Services (src/services/)"]
    SB["supabase.js\n(anon + admin clients)"]
    STOR["storage.js\n(uploadFile, deleteFiles)"]
    AUDIT["audit.js\n(logAudit)"]
  end

  subgraph STORES["State (src/stores/)"]
    AUTHSTORE["useAuthStore\n(Zustand)\n• user, session\n• signIn, signOut"]
  end

  subgraph UTILS["Utils (src/utils/)"]
    EXPORTPDF["exportEmployeeProfile.js\n(jsPDF)"]
  end

  APP --> LAYOUT
  LAYOUT --> SIDEBAR
  LAYOUT --> TOPBAR
  LAYOUT --> OUTLET
  OUTLET --> PAGES

  EMP --> PHADDR
  EMP --> IMGCROP
  EMP --> EXPORTPDF
  EMP --> MODAL

  INC --> MODAL
  DOCS --> MODAL

  PAGES --> TOOLBAR
  PAGES --> MODAL
  PAGES --> TOAST
  PAGES --> CONFIRM

  PAGES --> ISADMIN
  PAGES --> PERMS
  TOPBAR --> AUTHSTORE
  PAGES --> SB
  PAGES --> STOR
  PAGES --> AUDIT
```

---

## 5. Workflow / Use Case Diagram

Defines all user actions and their flows through the system.

```mermaid
flowchart TD
  START(["User Opens App"])

  START --> CHECK_AUTH{Authenticated?}
  CHECK_AUTH -->|No| LOGIN["Login Page\n• Enter email + password\n• Supabase Auth validates\n• Logs Login to audit_trail"]
  LOGIN --> PWD_CHANGE{needs_password\n_change?}
  PWD_CHANGE -->|Yes| CHANGE_PWD["Change Password Page\n• Enter new password\n• Clears flag in user_metadata"]
  PWD_CHANGE -->|No| DASHBOARD
  CHANGE_PWD --> DASHBOARD

  CHECK_AUTH -->|Yes| DASHBOARD["Dashboard\n• Stat cards (6 modules)\n• Incident Trend chart\n• Incidents by Team bars\n• Recent Incidents feed"]

  DASHBOARD --> NAV["User Navigates via Sidebar"]

  NAV --> UC_VIEW["📋 VIEW Records\n(All users — canRead default)\n• List with search/filter/pagination\n• Click row → View modal\n• Export PDF (Employee profile)\n• Export XLSX (all modules)"]

  NAV --> UC_ADD["➕ ADD Record\n(Admin OR canCreate permission)\n• Fill form / wizard\n• Upload files/photos\n• Submit → INSERT to DB\n• Creates Auth account (Employees)\n• Logs Added to audit_trail"]

  NAV --> UC_EDIT["✏️ EDIT Record\n(Admin OR canUpdate permission)\n• Click Edit in view modal\n• Modify fields\n• Save → UPDATE in DB\n• Syncs email to Auth (Employees)\n• Deletes old avatar if changed\n• Logs Updated to audit_trail"]

  NAV --> UC_DELETE["🗑️ DELETE Record\n(Admin OR canDelete permission)\n• Confirm dialog\n• DELETE from DB\n• Deletes files from Storage\n• Deletes Auth account (Employees)\n• Logs Deleted to audit_trail"]

  NAV --> UC_PROFILE["👤 MY PROFILE\n(All users — own record)\n• Click name in Topbar\n• View/Edit personal info\n• Upload avatar (ImageCropper)\n• All 8 tabs (wizard)\n• Designation fields read-only\n• Save → UPDATE employees"]

  NAV --> UC_PERMS["🔑 USER PERMISSIONS\n(Admin only)\n• List all non-admin users\n• CRUD matrix per module\n• Toggle All / per row\n• Save → UPSERT user_permissions"]

  NAV --> UC_AUDIT["📜 AUDIT TRAIL\n(Admin only)\n• View all user actions\n• Filter: Login/Logout/Added/\n  Updated/Deleted\n• Export XLSX"]

  NAV --> UC_LOGOUT["🚪 LOGOUT\n• Logs Logout to audit_trail\n• Clears Zustand session\n• Redirects to /login"]

  subgraph GOOGLE_SYNC["🔄 Google Sheets Sync (Automatic)"]
    GS_FORM["User fills Google Form\n(DRRM Office Training)"]
    GS_TRIGGER["Apps Script onFormSubmit\nfires automatically"]
    GS_INSERT["POST to Supabase\ndrrm_office_training table"]
    GS_FORM --> GS_TRIGGER --> GS_INSERT
  end
```

---

## Summary Table

| Diagram | Purpose | Format |
|---|---|---|
| ERD | Database schema & relationships | Mermaid `erDiagram` |
| DFD | Data movement across layers | Mermaid `flowchart TD` |
| System Architecture | Component topology & tech stack | Mermaid `flowchart LR` |
| Component Diagram | React component tree & dependencies | Mermaid `flowchart TD` |
| Use Case / Workflow | User actions end-to-end | Mermaid `flowchart TD` |

> **Rendering tip:** All diagrams use [Mermaid](https://mermaid.js.org/) syntax. Install the **Markdown Preview Mermaid Support** extension in VS Code to render them inline.
