-- =========================================================================
-- RUN THIS SQL IN YOUR SUPABASE SQL EDITOR TO CREATE THE NEW USER TRIGGER
-- =========================================================================

-- Function to handle auto-creation of employee when user registers
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_emp_id TEXT;
  base_username TEXT;
  final_username TEXT;
  username_suffix INT := 1;
BEGIN
  -- Generate a unique employee_id in the format: EMP-YYYY-XXXX (where XXXX is a random 4-digit number)
  LOOP
    new_emp_id := 'EMP-' || to_char(now(), 'YYYY') || '-' || floor(random() * 9000 + 1000)::text;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.employees WHERE employee_id = new_emp_id);
  END LOOP;

  -- Generate a unique username from email
  base_username := COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1));
  final_username := base_username;
  LOOP
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.employees WHERE username = final_username);
    final_username := base_username || username_suffix::text;
    username_suffix := username_suffix + 1;
  END LOOP;

  -- Only create employee if not created via app form to avoid duplicates
  IF COALESCE(new.raw_user_meta_data->>'created_via_app', 'false') <> 'true' THEN
    INSERT INTO public.employees (
      id,
      employee_id,
      name,
      username,
      email,
      designation,
      duty_status,
      created_at,
      updated_at
    )
    VALUES (
      new.id,
      new_emp_id,
      COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
      final_username,
      new.email,
      COALESCE(new.raw_user_meta_data->>'designation', 'Staff'),
      'Off Duty',
      NOW(),
      NOW()
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to execute the function on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
