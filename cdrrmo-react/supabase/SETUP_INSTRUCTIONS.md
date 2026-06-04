# 🚀 Supabase Database Setup Instructions

## Step 1: Open Supabase SQL Editor

1. Go to https://supabase.com
2. Open your project: **bakohorlnjuvqgwslzfm**
3. Click **SQL Editor** in the left sidebar
4. Click **New Query**

## Step 2: Run Database Migrations

Copy the **ENTIRE** contents of `schema.sql` and paste into the SQL Editor, then click **Run**.

This will create:
- ✅ All 21 tables
- ✅ Proper indexes for performance
- ✅ Row Level Security (RLS) policies
- ✅ Timestamps (created_at, updated_at)

## Step 3: Create Your First User

1. Click **Authentication** in the left sidebar
2. Click **Add User** → **Create new user**
3. Enter:
   - **Email**: admin@cdrrmo.gov (or your email)
   - **Password**: Choose a strong password
   - **Auto Confirm User**: ✅ Check this box
4. Click **Create User**

## Step 4: Test the Application

```bash
# In your terminal, navigate to cdrrmo-react folder:
cd c:\Users\rosel\CDRRMO\cdrrmo-react

# Start the development server:
npm run dev
```

Visit: **http://localhost:5173**

Login with the email and password you just created!

## Step 5: Verify Tables Were Created

1. In Supabase, click **Table Editor**
2. You should see all these tables:
   - employees
   - incidents
   - vouchers
   - inventory
   - transport
   - venues
   - activities
   - events_assistance
   - training_attended
   - training_conducted
   - volunteers
   - cdrrmc_reso
   - cdrrmc_meeting
   - maps_available
   - pruning_trimming
   - history
   - documentations
   - calendar_events
   - vehicles
   - drivers

## Troubleshooting

### Error: "Missing Supabase environment variables"
- Make sure `.env` file exists in `cdrrmo-react/` folder
- Restart your dev server after creating `.env`

### Error: "Invalid API key"
- Double-check your VITE_SUPABASE_ANON_KEY in `.env`
- Make sure there are no extra spaces or line breaks

### Can't login
- Make sure you created a user in Authentication
- Make sure "Auto Confirm User" was checked
- Check browser console for error messages

### Tables not showing
- Make sure you ran the ENTIRE schema.sql file
- Check for errors in SQL Editor
- Try running it again (it's safe to re-run)

## Next Steps After Setup

1. ✅ Login to the system
2. ✅ Explore the Dashboard
3. ✅ Test the Employees page
4. ✅ Add your first employee
5. ✅ Implement remaining pages (follow IMPLEMENTATION_STATUS.md)

---

**Need Help?** Check the console output for detailed error messages.
