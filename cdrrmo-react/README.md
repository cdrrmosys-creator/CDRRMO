# CDRRMO Recording System - React + Vite + Supabase

## 🎯 Project Overview

Modern React conversion of the CDRRMO (City Disaster Risk Reduction and Management Office) Recording System for Palayan City, Nueva Ecija.

**Tech Stack:**
- ⚛️ React 18
- ⚡ Vite
- 🗄️ Supabase (PostgreSQL + Auth + Realtime)
- 🎨 Custom CSS (maintained from original design)
- 🧭 React Router v6
- 🐻 Zustand (State Management)
- 📅 date-fns (Date utilities)
- 🎨 Remixicon (Icons)

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm
- Supabase account (free tier works)

### Installation

1. **Clone and install dependencies:**
```bash
cd cdrrmo-react
npm install
```

2. **Setup Supabase:**
   - Create a project at [supabase.com](https://supabase.com)
   - Run the SQL in `supabase/schema.sql` in your Supabase SQL Editor
   - Copy `.env.example` to `.env` and add your Supabase credentials

3. **Start development server:**
```bash
npm run dev
```

4. **Build for production:**
```bash
npm run build
```

## 📁 Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── Layout/         # Layout components (Sidebar, Topbar)
│   ├── Modal/          # Modal components
│   ├── Table/          # Table components
│   └── Common/         # Common UI elements (Button, Input, etc.)
├── pages/              # Page components (routes)
│   ├── Auth/          # Login, ChangePassword
│   ├── Dashboard/     # Dashboard page
│   ├── Employees/     # Employee management
│   ├── Modules/       # All module pages (Incidents, Vouchers, etc.)
│   └── Fleet/         # Vehicles & Drivers
├── services/           # API services
│   ├── supabase.js    # Supabase client config
│   ├── employees.js   # Employee CRUD operations
│   ├── modules.js     # Module CRUD operations
│   └── fleet.js       # Vehicle & Driver operations
├── stores/             # Zustand state management
│   ├── useAuthStore.js    # Authentication state
│   ├── useEmployeeStore.js # Employee state
│   └── useModuleStore.js   # Module data state
├── utils/              # Utility functions
│   ├── format.js      # Date/time formatting
│   ├── validation.js  # Form validation
│   └── constants.js   # App constants
└── styles/             # CSS files
    └── index.css      # Main stylesheet
```

## 🗄️ Database Tables

The system manages 21 tables:
- Employees
- Incidents
- Vouchers
- Inventory
- Transport
- Venues
- Activities
- Events Assistance
- Training Attended/Conducted
- Volunteers
- CDRRMC Resolutions/Meetings
- Maps Available
- Pruning/Trimming
- History
- Documentations
- Calendar Events
- Vehicles
- Drivers

See `supabase/schema.sql` for complete schema.

## 🔐 Authentication

Uses Supabase Auth with email/password. Row Level Security (RLS) policies protect all data.

**Default credentials** (create in Supabase dashboard):
- Email: admin@cdrrmo.gov.ph
- Password: (set your own secure password)

## 🎨 Design System

The app maintains the original design with:
- Custom CSS properties for theming
- Responsive grid/flexbox layouts
- Remixicon icon library
- Dark/light mode support (optional)

## 📊 Key Features

✅ **Real-time Updates** - Changes sync automatically across all users  
✅ **Offline Support** - Local caching with Zustand  
✅ **Role-based Access** - Admin vs User permissions  
✅ **Export to CSV** - Download data as spreadsheets  
✅ **Search & Filter** - Quick data finding  
✅ **Notifications** - Recent activity tracking  
✅ **Responsive Design** - Works on mobile, tablet, desktop  

## 🔄 Migration from Google Sheets

| Feature | Google Sheets Version | React + Supabase Version |
|---------|----------------------|--------------------------|
| Database | Google Sheets | PostgreSQL (Supabase) |
| Backend | Apps Script | Supabase + React |
| Frontend | Vanilla JS | React 18 |
| State | Global variables | Zustand stores |
| Routing | Single page | React Router |
| Real-time | Manual refresh | Supabase Realtime |
| Auth | Custom | Supabase Auth |

## 📦 Deployment

### Vercel (Recommended)
```bash
npm run build
vercel --prod
```

### Netlify
```bash
npm run build
netlify deploy --prod
```

### Environment Variables
Add these to your deployment platform:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## 🛠️ Development

### Available Commands
```bash
npm run dev      # Start dev server (http://localhost:5173)
npm run build    # Build for production
npm run preview  # Preview production build
npm run lint     # Run ESLint
```

### Code Style
- Use functional components with hooks
- Follow React best practices
- Use Zustand for global state
- Keep components small and focused

## 📚 Learn More

- [Vite Documentation](https://vite.dev)
- [React Documentation](https://react.dev)
- [Supabase Documentation](https://supabase.com/docs)
- [Zustand](https://github.com/pmndrs/zustand)
- [React Router](https://reactrouter.com)

## 🐛 Troubleshooting

**Supabase connection fails:**
- Check `.env` file has correct URL and key
- Verify RLS policies in Supabase dashboard
- Check browser console for errors

**Build errors:**
```bash
rm -rf node_modules package-lock.json
npm install
```

**Hot reload not working:**
```bash
rm -rf .vite
npm run dev
```

## 📄 License

Internal use for Palayan City CDRRMO

---

**Original Google Sheets version:** See parent directory  
**Maintained by:** CDRRMO Palayan City IT Team
