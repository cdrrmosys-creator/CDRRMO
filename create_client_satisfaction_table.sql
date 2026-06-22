-- Run this in your Supabase SQL Editor

-- 1. Create the client_satisfaction table
CREATE TABLE IF NOT EXISTS public.client_satisfaction (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    record_id VARCHAR NOT NULL,
    client_name VARCHAR NOT NULL,
    gender VARCHAR,
    age INTEGER,
    contact_number VARCHAR,
    address VARCHAR,
    office_name VARCHAR,
    service_provided VARCHAR,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    
    q1_timeliness INTEGER CHECK (q1_timeliness BETWEEN 1 AND 5),
    q2_expectation INTEGER CHECK (q2_expectation BETWEEN 1 AND 5),
    q3_facilities INTEGER CHECK (q3_facilities BETWEEN 1 AND 5),
    q4_information INTEGER CHECK (q4_information BETWEEN 1 AND 5),
    q5_integrity INTEGER CHECK (q5_integrity BETWEEN 1 AND 5),
    q6_competence INTEGER CHECK (q6_competence BETWEEN 1 AND 5),
    q7_overall INTEGER CHECK (q7_overall BETWEEN 1 AND 5),
    
    feedback TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
