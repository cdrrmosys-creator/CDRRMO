# CDRRMO System - React + Vite + Supabase Migration Guide

## 📋 Overview

This is the React + Vite conversion of the CDRRMO Recording System, now using Supabase as the database instead of Google Sheets.

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Setup Supabase

1. Go to [https://supabase.com](https://supabase.com) and create a free account
2. Create a new project
3. Copy your project URL and anon key from Settings > API
4. Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Run Database Migrations

Execute the SQL in `supabase/schema.sql` in your Supabase SQL Editor to create all tables.

### 4. Start Development Server
```bash
npm run dev
```

## 📁 Project Structure

```
cdrrmo-react/
├── src/
│   ├── components/       # Reusable UI components
│   │   ├── Layout.jsx
│   │   ├── Sidebar.jsx
│   │   ├── Topbar.jsx
│   │   ├── Modal.jsx
│   │   └── ...
│   ├── pages/           # Page components
│   │   ├── Login.jsx
│   │   ├── Dashboard.jsx
│   │   ├── Employees.jsx
│   │   ├── Incidents.jsx
│   │   └── ...
│   ├── services/        # API services
│   │   └── supabase.js
│   ├── stores/          # Zustand state management
│   │   └── useStore.js
│   ├── styles/          # CSS files
│   │   └── index.css
│   ├── utils/           # Helper functions
│   │   └── format.js
│   ├── App.jsx         # Main app component
│   └── main.jsx        # Entry point
├── supabase/
│   └── schema.sql      # Database schema
├── .env                # Environment variables
└── package.json
```

## 🗄️ Database Schema

The Supabase database includes these tables:
- `employees` - Employee records
- `incidents` - Incident reports
- `vouchers` - Voucher monitoring
- `inventory` - Inventory items
- `transport` - Transportation records
- `venues` - Training venues
- `activities` - CDRRMO activities
- `events_assistance` - Events needing assistance
- `training_attended` - Training attendance
- `training_conducted` - Training conducted
- `volunteers` - Accredited volunteers
- `cdrrmc_reso` - CDRRMC resolutions
- `cdrrmc_meeting` - CDRRMC meetings
- `maps_available` - Available maps
- `pruning_trimming` - Pruning/trimming records
- `history` - Historical records
- `documentations` - Documentation records
- `calendar_events` - Calendar events
- `vehicles` - Fleet vehicles
- `drivers` - Registered drivers

## 🔑 Key Features

- ✅ Real-time data updates with Supabase
- ✅ Row Level Security (RLS) for data protection
- ✅ Authentication with Supabase Auth
- ✅ Responsive design
- ✅ State management with Zustand
- ✅ Client-side routing with React Router
- ✅ Modern React hooks and patterns

## 🔐 Authentication

The system uses Supabase Auth with email/password authentication. Default admin account can be created through the Supabase dashboard.

## 🎨 Styling

The app maintains the same design system as the original:
- CSS custom properties for theming
- Remixicon for icons
- Responsive grid and flexbox layouts

## 📝 Migration Notes

### Changes from Google Apps Script version:
1. **Database**: Google Sheets → Supabase PostgreSQL
2. **Backend**: Apps Script → Supabase Edge Functions (if needed)
3. **State Management**: Global variables → Zustand stores
4. **Routing**: Single page → React Router
5. **API Calls**: google.script.run → Supabase client

### Advantages:
- ✅ Real-time capabilities
- ✅ Better performance
- ✅ Proper relational database
- ✅ Row-level security
- ✅ Scalable architecture
- ✅ Modern development experience

## 📦 Deployment

### Vercel (Recommended)
```bash
npm run build
vercel deploy
```

### Netlify
```bash
npm run build
netlify deploy --prod
```

### Build for production
```bash
npm run build
```

## 🛠️ Development

### Available Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## 📚 Documentation

- [React Documentation](https://react.dev)
- [Vite Documentation](https://vite.dev)
- [Supabase Documentation](https://supabase.com/docs)
- [React Router](https://reactrouter.com)
- [Zustand](https://github.com/pmndrs/zustand)

## 🐛 Troubleshooting

### Supabase Connection Issues
- Verify your environment variables are set correctly
- Check that RLS policies are configured
- Ensure your Supabase project is active

### Build Errors
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`
- Clear Vite cache: `rm -rf .vite`

## 📞 Support

For issues or questions about this migration, refer to the original requirements in the parent directory.
