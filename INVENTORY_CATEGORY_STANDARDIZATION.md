# Inventory & Vehicles Category Standardization - Complete

## Summary
Standardized both the Inventory and Vehicles modules to use dropdowns with predefined categories, ensuring consistency across the system. The Incidents module now properly filters vehicles from the Inventory module based on the "VEHICLES" category.

## Changes Made

### 1. Inventory Module (`src/pages/Inventory/index.jsx`)

#### Category Field Update
- **Changed from**: Text input (free-form entry)
- **Changed to**: Dropdown select with predefined options
- **Available Categories**:
  - ICT AND AUDIO VISUAL EQUIPMENT
  - OFFICE SUPPLIES
  - JANITORIAL SUPPLIES
  - MEDICAL SUPPLIES
  - OXYGEN
  - PPE (WASAR, CSSR, EXTRICATION, HIGH ANGLE)
  - RESCUE TOOLS (WASAR, CSSR, EXTRICATION, HIGH ANGLE)
  - VEHICLES
  - GENERATOR SET
  - AIRCONDITIONING
  - UMBRELLA
  - AM/FM RADIO
  - Early warning device/system
  - Two way radio
  - Command Center
  - Other

#### Conditional "Specify Category" Field
- Appears on the right side when "Other" is selected
- Field name: `category_other`
- Required when "Other" is selected
- Allows users to specify custom categories not in the predefined list

#### Form State Updates
- Added `category_other` to INITIAL_FORM_STATE
- Updated `handleOpenEdit` to load `category_other` from database records
- Conditional rendering ensures field only appears when needed

### 2. Vehicles Module (`src/pages/Vehicles/index.jsx`)

#### Type/Classification Field Update
- **Changed from**: Text input (free-form entry)
- **Changed to**: Dropdown select with predefined options
- **Available Types**:
  - Ambulance
  - Rescue Vehicle
  - Fire Truck
  - Emergency Response Vehicle
  - Support Vehicle
  - Other

#### Conditional "Specify Type" Field
- Appears on the right side when "Other" is selected
- Field name: `type_other`
- Required when "Other" is selected
- Allows users to specify custom vehicle types not in the predefined list

#### Form State Updates
- Added `type_other` to INITIAL_FORM_STATE
- Updated `handleOpenEdit` to load `type_other` from database records

### 3. Incidents Module (`src/pages/Incidents/index.jsx`)

#### Vehicle Loading Query Update
- **Changed from**: `.in('category', ['Ambulance', 'Rescue Vehicle'])`
- **Changed to**: `.eq('category', 'VEHICLES')`
- Now specifically filters inventory items with category "VEHICLES"
- More reliable and consistent vehicle filtering from inventory

### 4. Database Migrations

**Inventory Table** (`add_inventory_category_other.sql`):
```sql
ALTER TABLE inventory
ADD COLUMN IF NOT EXISTS category_other TEXT;

COMMENT ON COLUMN inventory.category_other IS 'Custom category specification when category is set to Other';
```

**Vehicles Table** (`add_vehicles_type_other.sql`):
```sql
ALTER TABLE vehicles
ADD COLUMN IF NOT EXISTS type_other TEXT;

COMMENT ON COLUMN vehicles.type_other IS 'Custom vehicle type specification when type is set to Other';
```

## User Instructions

### To Apply Database Changes
1. Open Supabase SQL Editor
2. Run both migration files:
   - `add_inventory_category_other.sql`
   - `add_vehicles_type_other.sql`
3. Verify the columns were added successfully

### Using the Updated Inventory Module
1. When adding/editing inventory items, select a category from the dropdown
2. If your category isn't listed, select "Other" and specify it in the field that appears on the right
3. Items that should be used as ambulances/vehicles in incidents should be categorized as "VEHICLES"

### Using the Updated Vehicles Module
1. When adding/editing vehicles, select a type from the dropdown
2. If your vehicle type isn't listed, select "Other" and specify it in the field that appears on the right
3. The type field is required for all vehicles

### Updating Existing Records
- Existing inventory items with free-form categories will need to be updated
- Existing vehicles with free-form types will need to be updated
- Open each record and select the appropriate predefined category/type
- If the category/type doesn't match any predefined option, select "Other" and specify it

### Using Ambulance Dropdown in Incidents
- Once inventory items are categorized as "VEHICLES", they will appear in the incidents ambulance dropdown
- The "Other" option is still available for ad-hoc ambulance entries
- This pulls from the Inventory module, not the Vehicles module

## Benefits
✅ Consistent categorization across both modules
✅ Reliable vehicle filtering for incidents module from inventory
✅ Better data quality and reporting
✅ Flexibility with "Other" option for edge cases
✅ Standardized dropdown UI/UX
✅ Prevents data entry errors and inconsistencies

## Testing Checklist
- [ ] Run both database migrations successfully
- [ ] Add new inventory item with "VEHICLES" category
- [ ] Add new inventory item with "Other" category and specify custom text
- [ ] Edit existing inventory item and change category
- [ ] Add new vehicle with "Ambulance" type
- [ ] Add new vehicle with "Other" type and specify custom text
- [ ] Edit existing vehicle and change type
- [ ] Verify inventory items with "VEHICLES" category appear in incidents ambulance dropdown
- [ ] Verify "Other" option works in incidents ambulance field
