-- ====================================================================
-- SUPABASE INITIALIZATION DATABASE SCHEMA
-- Execute this script directly in the Supabase SQL Editor (SQL editor -> New Query)
-- ====================================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. EmployeeRates Table
-- Stores base salary rates, workshop/onsite rates, bank info, and student loans
create table if not exists public."EmployeeRates" (
    "ID" uuid default uuid_generate_v4() primary key,
    "EmployeeID" text unique not null,                      -- Unique Employee Code e.g. EMP001
    "EmployeeName" text not null,                           -- Full english name
    "StaffSalary" numeric(12, 2) default 0.00,             -- Base salary (Staff)
    "OfficeSalary" numeric(12, 2) default 0.00,            -- Base salary (Office)
    "TransportationRate" numeric(12, 2) default 0.00,      -- Car rent/transport allowance daily rate
    "WorkshopRate" numeric(12, 2) default 0.00,            -- Workshop work daily rate
    "OnsiteRate" numeric(12, 2) default 0.00,              -- Onsite work daily rate
    "OffshoreRate" numeric(12, 2) default 0.00,            -- Offshore work daily rate
    "WFHRate" numeric(12, 2) default 0.00,                 -- Work From Home daily rate
    "Position" text default 'Technician',                  -- Job Title
    "Status" text default 'active',                         -- 'active' | 'inactive'
    "BankName" text,                                       -- Primary bank for payroll
    "BankAccount" text,                                    -- Bank account number
    "StudentLoan" numeric(12, 2) default 0.00,             -- Monthly student loan (กยศ.) deduction
    "WorkScheduleType" text default 'daily_worker',        -- 'daily_worker' | 'staff'
    "isFlatRate" boolean default false,                    -- True if this employee has flat 12-hour schedule
    "CreatedAt" timestamp with time zone default timezone('utc'::text, now()) not null
);

comment on table public."EmployeeRates" is 'ตารางจัดเก็บข้อมูลอัตราพนักงาน เงินเดือน และเรททำงานสถานที่ต่างๆ';


-- 2. TIMESHEET Table
-- Stores daily time records synced from the system
create table if not exists public."TIMESHEET" (
    "ID" uuid default uuid_generate_v4() primary key,
    "EmployeeName" text not null,                           -- References EmployeeRates("EmployeeName")
    "Date" date not null,                                   -- YYYY-MM-DD
    "Project" text default 'workshop',                      -- Project or cost center code
    "TimeIn" text default '08:00',
    "TimeOut" text default '17:00',
    "LunchDeduct" integer default 1,                        -- 1: deduct 1 hr lunch, 0: no deduct
    "LunchOT" integer default 0,                            -- 1: worked through lunch (earns extra 1hr OT)
    "Customer_Holiday_Flag" integer default 0,              -- 1: customer holiday, 0: normal day
    "NormalHours" numeric(5, 2) default 0.00,               -- Computed normal hours worked
    "OT15Hours" numeric(5, 2) default 0.00,                 -- Computed OT 1.5 rate hours
    "OT20Hours" numeric(5, 2) default 0.00,                 -- Computed OT 2.0 rate hours (Holiday normal)
    "OT30Hours" numeric(5, 2) default 0.00,                 -- Computed OT 3.0 rate hours (Holiday OT)
    "Remark" text,
    "Status" text default 'Pending',                        -- 'Pending' | 'Approved'
    "ApprovedAt" timestamp with time zone,
    "ApprovedBy" text,
    "CreatedAt" timestamp with time zone default timezone('utc'::text, now()) not null,
    "UpdatedAt" timestamp with time zone default timezone('utc'::text, now()) not null
);

comment on table public."TIMESHEET" is 'ตารางเก็บรายการลงเวลาทำงานรายวันของพนักงาน (Timesheet Main Record)';


-- 3. RateCalulate (Detailed calculation breakdown per entry)
-- This stores or displays computed earnings per timesheet entry
create table if not exists public."RateCalulate" (
    "ID" uuid default uuid_generate_v4() primary key,
    "EmployeeName" text not null,
    "Date" date not null,
    "Project" text not null,
    "RATE" numeric(12, 2) default 0.00,                    -- Base hourly/daily rate applied
    "LunchOT" integer default 0,
    "NormalHours" numeric(5, 2) default 0.00,
    "OT15Hours" numeric(5, 2) default 0.00,                 -- Map to OT1.5Hours
    "OT20Hours" numeric(5, 2) default 0.00,                 -- Map to OT2.0Hours
    "OT30Hours" numeric(5, 2) default 0.00,                 -- Map to OT3.0Hours
    "Remark" text,
    "OTCalculated" numeric(12, 2) default 0.00,            -- Summed OT cash earnings (OT1.5 * Rate * 1.5 + ...)
    "Sumtotal" numeric(12, 2) default 0.00,                -- Normal pay + transport pay + OT pay
    "CreatedAt" timestamp with time zone default timezone('utc'::text, now()) not null
);

comment on table public."RateCalulate" is 'ตารางคำนวณเงินสะสมรายวันแยกตามเรทและโอทีในแต่ละวัน';


-- 4. Sumary-Mount (Sumary Month / Payroll)
-- Compiles the final gross and net payroll per employee for a selected cutoff cycle
create table if not exists public."Sumary-Mount" (
    "ID" uuid default uuid_generate_v4() primary key,
    "EmployeeName" text not null,
    "StartDate" date not null,                              -- Start range (e.g. 2026-03-21)
    "EndDate" date not null,                                -- End range (e.g. 2026-04-20)
    "TotalTime" numeric(8, 2) default 0.00,                 -- Total hours worked
    "TotalDays" integer default 0,                          -- Days worked
    "NetNormal" numeric(12, 2) default 0.00,                -- Normal hours base pay
    "OT15Wage" numeric(12, 2) default 0.00,                 -- OT 1.5 Wage earned
    "OT20Wage" numeric(12, 2) default 0.00,                 -- OT 2.0 Wage earned
    "OT30Wage" numeric(12, 2) default 0.00,                 -- OT 3.0 Wage earned
    "OtherIncome" numeric(12, 2) default 0.00,              -- Allowance, transportation total
    "OtherDeductions" numeric(12, 2) default 0.00,          -- Leave deductions or others
    "TaxDeduct" numeric(12, 2) default 0.00,                -- Estimated Withholding Tax
    "SocialSecurity" numeric(12, 2) default 0.00,           -- SSO (ประกันสังคม)
    "StudentLoan" numeric(12, 2) default 0.00,              -- Student Loan (กยศ.)
    "TotalIncome" numeric(12, 2) default 0.00,              -- Gross earnings (NetNormal + OT wagers + inputs)
    "NetIncome" numeric(12, 2) default 0.00,                -- Net payout (TotalIncome - deductions)
    "CreatedAt" timestamp with time zone default timezone('utc'::text, now()) not null
);

comment on table public."Sumary-Mount" is 'ตารางเก็บยอดสะสมเงินเดือนและรายได้รายล่วงหลังหักภาษี ประกันสังคม กยศ. (Payroll Summary)';


-- 5. IndividualSupplements Table
-- Stores travel/perdiem, advance, job bonus, and custom remarks for specific employee and date
create table if not exists public."IndividualSupplements" (
    "ID" text primary key,                                  -- Composite string ID e.g. "EMP001_2026-05-20"
    "EmployeeID" text not null,                             -- Employee Code (EMP001)
    "EmployeeName" text not null,                           -- English Name (matches EmployeeRates EmployeeName)
    "Date" date not null,                                   -- YYYY-MM-DD
    "Perdiem" numeric(12, 2) default 0.00,                 -- Perdiem / Travel Exp
    "Advance" numeric(12, 2) default 0.00,                 -- Cash Advance
    "JobBonus" numeric(12, 2) default 0.00,                -- Job Bonus
    "Remark" text,                                          -- Supplement/override Remark
    "CreatedAt" timestamp with time zone default timezone('utc'::text, now()) not null,
    "UpdatedAt" timestamp with time zone default timezone('utc'::text, now()) not null
);

comment on table public."IndividualSupplements" is 'ตารางเก็บค่าเบี้ยเลี้ยง/ค่าเดินทาง เงินเบิกสำรองล่วงหน้า โบนัสงาน และหมายเหตุรายบุคคลรายวัน';


-- ====================================================================
-- ROW LEVEL SECURITY RULES (BYPASSING BY DEFAULT FOR RAPID PROTOTYPE)
-- ====================================================================
alter table public."EmployeeRates" disable row level security;
alter table public."TIMESHEET" disable row level security;
alter table public."RateCalulate" disable row level security;
alter table public."Sumary-Mount" disable row level security;
alter table public."IndividualSupplements" disable row level security;
