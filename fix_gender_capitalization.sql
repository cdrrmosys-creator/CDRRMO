-- Fix gender capitalization across all tables
-- Convert all-caps gender values to proper case

-- Fix employees table
UPDATE employees 
SET sex = CASE 
  WHEN UPPER(sex) = 'MALE' THEN 'Male'
  WHEN UPPER(sex) = 'FEMALE' THEN 'Female'
  WHEN UPPER(sex) = 'LGBTQ+' THEN 'LGBTQ+'
  WHEN UPPER(sex) = 'PREFERRED NOT TO SAY' THEN 'Preferred Not to Say'
  ELSE sex
END
WHERE sex IS NOT NULL 
  AND sex IN ('MALE', 'FEMALE', 'LGBTQ+', 'PREFERRED NOT TO SAY', 'male', 'female', 'lgbtq+', 'preferred not to say');

-- Fix training_registrations table (uses 'gender' column)
UPDATE training_registrations 
SET gender = CASE 
  WHEN UPPER(gender) = 'MALE' THEN 'Male'
  WHEN UPPER(gender) = 'FEMALE' THEN 'Female'
  WHEN UPPER(gender) = 'LGBTQ+' THEN 'LGBTQ+'
  WHEN UPPER(gender) = 'PREFERRED NOT TO SAY' THEN 'Preferred Not to Say'
  ELSE gender
END
WHERE gender IS NOT NULL 
  AND gender IN ('MALE', 'FEMALE', 'LGBTQ+', 'PREFERRED NOT TO SAY', 'male', 'female', 'lgbtq+', 'preferred not to say');

-- Fix volunteers table (if it has gender/sex column)
UPDATE volunteers 
SET gender = CASE 
  WHEN UPPER(gender) = 'MALE' THEN 'Male'
  WHEN UPPER(gender) = 'FEMALE' THEN 'Female'
  WHEN UPPER(gender) = 'LGBTQ+' THEN 'LGBTQ+'
  WHEN UPPER(gender) = 'PREFERRED NOT TO SAY' THEN 'Preferred Not to Say'
  ELSE gender
END
WHERE gender IS NOT NULL 
  AND gender IN ('MALE', 'FEMALE', 'LGBTQ+', 'PREFERRED NOT TO SAY', 'male', 'female', 'lgbtq+', 'preferred not to say');

-- Show results
SELECT 'employees' as table_name, sex as gender, COUNT(*) as count 
FROM employees 
WHERE sex IS NOT NULL 
GROUP BY sex

UNION ALL

SELECT 'training_registrations' as table_name, gender, COUNT(*) as count 
FROM training_registrations 
WHERE gender IS NOT NULL 
GROUP BY gender

UNION ALL

SELECT 'volunteers' as table_name, gender, COUNT(*) as count 
FROM volunteers 
WHERE gender IS NOT NULL 
GROUP BY gender
ORDER BY table_name, gender;
