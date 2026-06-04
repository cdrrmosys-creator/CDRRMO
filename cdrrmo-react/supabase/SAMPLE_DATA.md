# Sample Data for Supabase Tables

Copy and paste these into Supabase → Table Editor → "Paste text" when adding content to tables.

---

## 📋 TRANSPORT Table

```
record_id	vehicle	driver	destination	date_time	purpose	saved_at
TRN-001	Fire Truck Alpha	Juan Dela Cruz	Brgy. San Jose	2026-06-01 08:30:00	Fire response drill	06/01/2026 | 08:30 AM
TRN-002	Ambulance Unit 1	Maria Santos	City Hospital	2026-06-01 14:15:00	Medical emergency transport	06/01/2026 | 02:15 PM
TRN-003	Rescue Van	Pedro Garcia	Brgy. Poblacion	2026-06-02 09:00:00	Relief goods distribution	06/02/2026 | 09:00 AM
TRN-004	Mobile Command	Jose Reyes	Provincial Capitol	2026-06-02 13:30:00	Coordination meeting	06/02/2026 | 01:30 PM
TRN-005	Ambulance Unit 2	Ana Lopez	Brgy. Atate	2026-06-03 10:45:00	Patient transfer	06/03/2026 | 10:45 AM
```

---

## 🏢 VENUES Table

```
record_id	facility_name	date	start_time	end_time	purpose	booked_by	saved_at
VEN-001	CDRRMO Conference Room	2026-06-05	09:00:00	12:00:00	Emergency Response Training	Training Division	06/01/2026 | 03:00 PM
VEN-002	Multi-Purpose Hall	2026-06-08	13:00:00	17:00:00	CDRRMC Meeting	Admin Office	06/01/2026 | 03:15 PM
VEN-003	Training Center	2026-06-10	08:00:00	16:00:00	First Aid Seminar	Medical Team	06/02/2026 | 10:00 AM
VEN-004	Evacuation Center Alpha	2026-06-12	10:00:00	15:00:00	Facility Inspection	Operations	06/02/2026 | 11:30 AM
VEN-005	Command Center	2026-06-15	14:00:00	18:00:00	Disaster Simulation Exercise	Chief CDRRMO	06/03/2026 | 09:00 AM
```

---

## 🎯 ACTIVITIES Table

```
record_id	activity_title	date	location	participants	description	saved_at
ACT-001	Earthquake Drill	2026-06-10	City Hall Complex	150	Quarterly earthquake preparedness drill	06/01/2026 | 02:00 PM
ACT-002	First Aid Training	2026-06-12	Barangay San Jose	45	Basic first aid training for barangay officials	06/01/2026 | 02:30 PM
ACT-003	Fire Safety Seminar	2026-06-15	Public Market	80	Fire prevention and safety awareness campaign	06/02/2026 | 11:00 AM
ACT-004	Evacuation Drill	2026-06-18	Brgy. Poblacion	200	Community-wide evacuation exercise	06/02/2026 | 03:00 PM
ACT-005	Disaster Preparedness	2026-06-20	Elementary School	120	School disaster preparedness program	06/03/2026 | 10:00 AM
```

---

## 🎪 EVENTS_ASSISTANCE Table

```
record_id	event_name	date	location	type_of_assistance	requestor	saved_at
EVA-001	City Foundation Day	2026-06-15	Plaza Central	Medical standby, Traffic management	City Mayor's Office	06/01/2026 | 09:00 AM
EVA-002	Barangay Fiesta	2026-06-18	Brgy. San Jose	Ambulance standby	Brgy. Captain	06/01/2026 | 10:30 AM
EVA-003	Marathon Event	2026-06-22	City Sports Complex	Medical team, Water station	Sports Division	06/02/2026 | 02:00 PM
EVA-004	Religious Procession	2026-06-25	Cathedral Area	Crowd control, First aid	Parish Council	06/02/2026 | 04:00 PM
EVA-005	School Graduation	2026-06-28	High School Gym	Emergency medical standby	School Principal	06/03/2026 | 11:00 AM
```

---

## 📚 TRAINING_ATTENDED Table

```
record_id	training_title	date	venue	conducted_by	attendees	saved_at
TRA-001	Advanced Life Support	2026-05-15	Regional Training Center	DOH Region III	Juan Cruz, Maria Santos, Pedro Garcia	06/01/2026 | 01:00 PM
TRA-002	Incident Command System	2026-05-20	Provincial Capitol	OCD Nueva Ecija	Jose Reyes, Ana Lopez, Carlos Mendoza	06/01/2026 | 01:30 PM
TRA-003	Search and Rescue Operations	2026-05-25	Camp Crame	PNP SAR Unit	Ramon Torres, Linda Aquino	06/02/2026 | 09:00 AM
TRA-004	Hazardous Materials Handling	2026-05-28	Fire Academy	BFP Training Center	Miguel Santos, Rosa Cruz	06/02/2026 | 10:00 AM
TRA-005	Emergency Communications	2026-06-01	DILG Office	NDRRMC	All CDRRMO Staff	06/03/2026 | 02:00 PM
```

---

## 👨‍🏫 TRAINING_CONDUCTED Table

```
record_id	training_title	date	venue	facilitator	participants	saved_at
TRC-001	Basic Life Support	2026-06-05	CDRRMO Training Hall	Dr. Maria Santos	Barangay Health Workers (35 pax)	06/01/2026 | 03:00 PM
TRC-002	Fire Prevention & Safety	2026-06-08	Public Market	SFO2 Juan Reyes	Market vendors (50 pax)	06/01/2026 | 03:30 PM
TRC-003	Earthquake Preparedness	2026-06-12	Elementary School	CDRRMO Team	Teachers and students (120 pax)	06/02/2026 | 11:00 AM
TRC-004	First Aid for Families	2026-06-15	Barangay Hall	Nurse Ana Cruz	Community members (40 pax)	06/02/2026 | 02:00 PM
TRC-005	Flood Safety Awareness	2026-06-18	Community Center	Chief CDRRMO	Residents (80 pax)	06/03/2026 | 10:00 AM
```

---

## 🤝 VOLUNTEERS Table

```
record_id	volunteer_name	organization	accreditation_no	date	status	saved_at
VOL-001	Juan Dela Cruz	Red Cross Youth	RC-2026-001	2026-01-15	Active	06/01/2026 | 02:00 PM
VOL-002	Maria Santos	Barangay Brigade	BB-2026-045	2026-02-20	Active	06/01/2026 | 02:15 PM
VOL-003	Pedro Garcia	Rescue Volunteers	RV-2026-023	2026-03-10	Active	06/01/2026 | 02:30 PM
VOL-004	Ana Lopez	Medical Volunteers	MV-2026-067	2026-03-25	Active	06/02/2026 | 09:00 AM
VOL-005	Carlos Reyes	Community Responders	CR-2026-089	2026-04-05	Active	06/02/2026 | 09:30 AM
VOL-006	Linda Torres	Youth Volunteers	YV-2026-012	2026-04-18	Inactive	06/02/2026 | 10:00 AM
VOL-007	Ramon Santos	Emergency Response Team	ERT-2026-034	2026-05-02	Active	06/03/2026 | 11:00 AM
```

---

## 📜 CDRRMC_RESO Table

```
record_id	resolution_no	title	date_passed	description	saved_at
RES-001	CDRRMC-R-2026-001	Approval of Annual Disaster Preparedness Plan	2026-01-15	Resolution approving the comprehensive disaster preparedness plan for 2026	06/01/2026 | 01:00 PM
RES-002	CDRRMC-R-2026-002	Allocation of Calamity Fund	2026-02-10	Resolution for the proper allocation and utilization of calamity funds	06/01/2026 | 01:30 PM
RES-003	CDRRMC-R-2026-003	Establishment of New Evacuation Center	2026-03-05	Resolution authorizing the construction of evacuation center in Brgy. San Jose	06/02/2026 | 10:00 AM
RES-004	CDRRMC-R-2026-004	Disaster Risk Reduction Training Program	2026-04-12	Resolution mandating quarterly training for all barangay officials	06/02/2026 | 11:00 AM
RES-005	CDRRMC-R-2026-005	Early Warning System Enhancement	2026-05-20	Resolution for upgrading the city's early warning system infrastructure	06/03/2026 | 09:00 AM
```

---

## 📝 CDRRMC_MEETING Table

```
record_id	meeting_no	date	agenda	attendees	minutes_summary	saved_at
MTG-001	CDRRMC-2026-Q1	2026-03-15	Quarterly review, Budget presentation, Training schedule	All CDRRMC members (15 present)	Approved Q1 activities and budget allocation for disaster preparedness programs	06/01/2026 | 02:00 PM
MTG-002	CDRRMC-2026-Q2	2026-06-10	Mid-year assessment, Equipment needs, Rainy season preparation	All CDRRMC members (14 present)	Discussed preparation for rainy season and approved procurement of new equipment	06/02/2026 | 03:00 PM
MTG-003	CDRRMC-2026-Special-001	2026-05-05	Emergency session - Flooding incident response	All CDRRMC members (13 present)	Coordinated response to flooding in low-lying areas, deployed rescue teams	06/02/2026 | 04:00 PM
```

---

## 🗺️ MAPS_AVAILABLE Table

```
record_id	map_title	type	coverage_area	date_updated	file_url	saved_at
MAP-001	Flood Hazard Map	Hazard Map	Entire Palayan City	2026-01-10	https://example.com/flood-map.pdf	06/01/2026 | 11:00 AM
MAP-002	Earthquake Fault Lines	Geological Map	City and surrounding areas	2026-01-15	https://example.com/earthquake-map.pdf	06/01/2026 | 11:30 AM
MAP-003	Evacuation Routes	Navigation Map	All Barangays	2026-02-01	https://example.com/evacuation-routes.pdf	06/02/2026 | 09:00 AM
MAP-004	Critical Facilities	Infrastructure Map	Entire City	2026-02-10	https://example.com/facilities-map.pdf	06/02/2026 | 09:30 AM
MAP-005	Landslide Susceptibility	Hazard Map	Mountain Barangays	2026-03-05	https://example.com/landslide-map.pdf	06/03/2026 | 10:00 AM
```

---

## 🌳 PRUNING_TRIMMING Table

```
record_id	location	date	trees_pruned	conducted_by	remarks	saved_at
PRN-001	National Highway (Km 5-8)	2026-05-10	45	CDRRMO Tree Maintenance Team	Removed overhanging branches, improved road visibility	06/01/2026 | 10:00 AM
PRN-002	Plaza Central	2026-05-15	12	City Agriculture Office	Trimmed acacia trees, cleaned fallen branches	06/01/2026 | 10:30 AM
PRN-003	Brgy. San Jose Main Road	2026-05-20	28	CDRRMO + Barangay Volunteers	Preventive pruning before rainy season	06/02/2026 | 11:00 AM
PRN-004	School Premises (3 schools)	2026-05-25	67	City Engineering + CDRRMO	Safety pruning of old trees near classrooms	06/02/2026 | 11:30 AM
PRN-005	City Hall Complex	2026-06-01	18	CDRRMO Maintenance	Regular maintenance and aesthetic pruning	06/03/2026 | 09:00 AM
```

---

## 📖 HISTORY Table

```
record_id	event_title	date	description	category	saved_at
HIS-001	Typhoon Karding Response	2022-09-25	Category 4 typhoon hit Nueva Ecija. CDRRMO conducted rescue operations in flooded areas. 150 families evacuated.	Natural Disaster	06/01/2026 | 09:00 AM
HIS-002	Earthquake 6.1 Magnitude	2023-04-22	Strong earthquake felt in the city. CDRRMO conducted damage assessment. No major casualties reported.	Natural Disaster	06/01/2026 | 09:30 AM
HIS-003	City-Wide Fire Prevention Campaign	2024-03-15	Successfully conducted fire safety seminars in all 15 barangays. Over 500 participants.	Public Awareness	06/02/2026 | 10:00 AM
HIS-004	COVID-19 Response Operations	2020-2021	CDRRMO supported health office in pandemic response. Managed quarantine facilities and contact tracing.	Health Emergency	06/02/2026 | 10:30 AM
HIS-005	Establishment of CDRRMO	2010-06-15	Official establishment of City Disaster Risk Reduction and Management Office	Milestone	06/03/2026 | 11:00 AM
```

---

## 📁 DOCUMENTATIONS Table

```
record_id	document_title	date	type	description	file_url	saved_at
DOC-001	2026 Annual Report	2026-05-30	Annual Report	Comprehensive report of CDRRMO activities for 2026	https://example.com/annual-report-2026.pdf	06/01/2026 | 01:00 PM
DOC-002	Standard Operating Procedures	2026-01-10	SOP Manual	Updated SOP for emergency response operations	https://example.com/sop-2026.pdf	06/01/2026 | 01:30 PM
DOC-003	Training Certificates Q1	2026-03-31	Certificates	Compilation of training certificates issued in Q1	https://example.com/certs-q1.pdf	06/02/2026 | 02:00 PM
DOC-004	Equipment Inventory List	2026-04-15	Inventory Report	Updated list of all CDRRMO equipment and supplies	https://example.com/equipment-2026.pdf	06/02/2026 | 02:30 PM
DOC-005	Incident Photos May 2026	2026-05-31	Photo Archive	Photo documentation of incidents and activities	https://example.com/photos-may.zip	06/03/2026 | 03:00 PM
```

---

## 📅 CALENDAR_EVENTS Table

```
record_id	event_title	date	notes	saved_at
CAL-001	CDRRMC Quarterly Meeting	2026-06-10	Review Q2 activities and plan Q3 programs	06/01/2026 | 08:00 AM
CAL-002	Fire Prevention Month Activities	2026-03-01	March - Fire Prevention Month celebrations	06/01/2026 | 08:30 AM
CAL-003	National Disaster Consciousness Month	2026-07-01	July - NDCM activities throughout the month	06/02/2026 | 09:00 AM
CAL-004	Earthquake Drill - City Wide	2026-06-15	Simultaneous earthquake drill in all establishments	06/02/2026 | 09:30 AM
CAL-005	Equipment Maintenance Day	2026-06-20	Scheduled maintenance of all vehicles and equipment	06/03/2026 | 10:00 AM
CAL-006	Volunteer Recognition Program	2026-12-15	Annual recognition of outstanding volunteers	06/03/2026 | 10:30 AM
```

---

## 📝 USAGE INSTRUCTIONS

### Option 1: Paste as Text (Recommended)
1. Go to Supabase → Table Editor
2. Select the table (e.g., "transport")
3. Click "Insert" → "Paste text"
4. Copy the data rows (NOT the header) from above
5. Paste into the text field
6. Click "Save"

### Option 2: Manual Entry
1. Go to Supabase → Table Editor
2. Select the table
3. Click "Insert" → "Insert row"
4. Fill in each field manually
5. Click "Save"

### Option 3: Upload CSV
1. Copy the data above into Excel/Google Sheets
2. Save as CSV
3. Go to Supabase → Table Editor
4. Click "Insert" → "Upload CSV"
5. Select your CSV file

---

## ⚠️ IMPORTANT NOTES

1. **Tab-separated format**: Make sure to keep tabs between columns when pasting
2. **Date formats**: 
   - Date fields: `YYYY-MM-DD` (e.g., 2026-06-01)
   - Datetime fields: `YYYY-MM-DD HH:mm:ss` (e.g., 2026-06-01 14:30:00)
   - Time fields: `HH:mm:ss` (e.g., 14:30:00)
3. **Remove headers**: Only paste the data rows, not the column names
4. **Auto-generated fields**: Don't include `id`, `created_at` - Supabase generates these

---

## ✅ VERIFICATION

After pasting data, verify in your React app:
1. Go to http://localhost:5173
2. Login
3. Navigate to the module page
4. Data should appear immediately!

---

**These sample records will give you realistic test data to work with while developing the remaining pages!** 🎉
