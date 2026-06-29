import React, { useState, useEffect } from 'react';
import { Employee, Holiday, TimesheetEntry, SystemSettings } from './types';
import { initialEmployees } from './data/employees';
import { initialHolidays } from './data/holidays';
import { initialTimesheetEntries } from './data/initialTimesheets';
import { calculateEntryOT, rebalanceTimesheetEntries, findEmployeeMatch } from './utils/calculator';

// Component Imports
import Dashboard from './components/Dashboard';
import TimesheetTable from './components/TimesheetTable';
import EmployeeManager from './components/EmployeeManager';
import HolidayList from './components/HolidayList';
import PayrollSection from './components/PayrollSection';
import IndividualReport from './components/IndividualReport';
import SettingsSection from './components/SettingsSection';
import HelpSection from './components/HelpSection';

// Supabase sync tools
import { 
  supabase, 
  dbFetchEmployees, 
  dbFetchTimesheets, 
  dbUpsertEmployee, 
  dbDeleteEmployee, 
  dbUpsertTimesheet, 
  dbDeleteTimesheet, 
  dbBulkInsertTimesheets, 
  dbClearAllTimesheets 
} from './lib/supabaseClient';

import { 
  BarChart4, FileText, Users, CalendarDays, 
  HelpCircle, Sparkles, CheckSquare, Clock, ArrowRight,
  Coins, UserCheck, Database, Sliders, CheckCircle2, Sun, Moon,
  Lock
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'ledger' | 'employees' | 'holidays' | 'payroll' | 'individual-report' | 'settings' | 'help'>('ledger');
  const [supabaseConnected, setSupabaseConnected] = useState<boolean>(true);
  const [isEmployeesUnlocked, setIsEmployeesUnlocked] = useState<boolean>(false);
  const [isPayrollUnlocked, setIsPayrollUnlocked] = useState<boolean>(false);

  // Theme Toggle: State default to 'light' for comfortable bright UI (สีโทนสว่าง สบายตา)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('thai_ot_theme');
    return (saved as 'light' | 'dark') || 'light';
  });

  // Settings State: User configurable OT Rates and Wages
  const [settings, setSettings] = useState<SystemSettings>(() => {
    const saved = localStorage.getItem('thai_ot_settings');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return {
      ot15Rate: 1.5,
      ot20Rate: 2.0,
      ot30Rate: 3.0,
      defaultDailyWage: 350,
      defaultWorkHours: 8,
    };
  });

  // Sync theme changes to local storage
  useEffect(() => {
    localStorage.setItem('thai_ot_theme', theme);
  }, [theme]);

  const handleUpdateSettings = (updated: SystemSettings) => {
    setSettings(updated);
    localStorage.setItem('thai_ot_settings', JSON.stringify(updated));
  };

  // Core State
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [entries, setEntries] = useState<TimesheetEntry[]>([]);

  // Load from Supabase (or fallback to LocalStorage/pre-seeded)
  // Load from Supabase (or fallback to LocalStorage/pre-seeded)
  useEffect(() => {
    async function loadDataAndSync() {
      try {
        // 1. Fetch Employees
        let activeEmployees: Employee[] = [];
        const dbEmps = await dbFetchEmployees();
        if (dbEmps !== null) {
          activeEmployees = dbEmps;
        } else {
          const savedEmployees = localStorage.getItem('thai_ot_employees');
          if (savedEmployees) {
            activeEmployees = JSON.parse(savedEmployees);
          } else {
            activeEmployees = initialEmployees;
            localStorage.setItem('thai_ot_employees', JSON.stringify(initialEmployees));
            // Opt-in populate Supabase so database starts with values
            initialEmployees.forEach(emp => dbUpsertEmployee(emp));
          }
        }
        setEmployees(activeEmployees);
        localStorage.setItem('thai_ot_employees', JSON.stringify(activeEmployees));

        // 2. Fetch Holidays
        let activeHolidays: Holiday[] = [];
        const savedHolidays = localStorage.getItem('thai_ot_holidays');
        if (savedHolidays) {
          let parsed = JSON.parse(savedHolidays);
          parsed = parsed.filter((h: any) => h.holidayDate !== '2026-05-04');
          activeHolidays = parsed;
        } else {
          activeHolidays = initialHolidays;
        }
        setHolidays(activeHolidays);
        localStorage.setItem('thai_ot_holidays', JSON.stringify(activeHolidays));

        // 3. Fetch Timesheets
        let activeEntries: TimesheetEntry[] = [];
        const dbTimesheets = await dbFetchTimesheets();
        if (dbTimesheets !== null) {
          activeEntries = dbTimesheets;
        } else {
          const savedEntries = localStorage.getItem('thai_ot_entries');
          if (savedEntries) {
            activeEntries = JSON.parse(savedEntries);
          } else {
            activeEntries = initialTimesheetEntries;
            localStorage.setItem('thai_ot_entries', JSON.stringify(initialTimesheetEntries));
            // Opt-in populate Supabase so database starts with values
            dbBulkInsertTimesheets(initialTimesheetEntries);
          }
        }

        // 4. Force Recalculate 2026-05-04 entries to be normal working days (excluding holiday rule)
        let updatedEntries = activeEntries.map(entry => {
          if (entry.date === '2026-05-04') {
            const matchedEmp = activeEmployees.find(emp => emp.employeeName === entry.employeeName);
            const isFlat = matchedEmp?.isFlatRate || false;
            const updatedCalc = calculateEntryOT(
              entry.date,
              entry.timeIn,
              entry.timeOut,
              entry.lunchDeduct,
              entry.lunchOT,
              isFlat,
              activeHolidays,
              entry.project,
              matchedEmp?.workScheduleType,
              matchedEmp?.position
            );
            return {
              ...entry,
              normalHours: updatedCalc.normalHours,
              ot15Hours: updatedCalc.ot15Hours,
              ot20Hours: updatedCalc.ot20Hours,
              ot30Hours: updatedCalc.ot30Hours,
              totalHours: updatedCalc.totalHours
            };
          }
          return entry;
        });

        setEntries(updatedEntries);
        // Rebalance loaded entries
        const finalBalanced = rebalanceTimesheetEntries(updatedEntries, activeEmployees, activeHolidays);
        setEntries(finalBalanced);
        localStorage.setItem('thai_ot_entries', JSON.stringify(finalBalanced));

        // Also update Supabase database for changed ones
        const changed0504Entries = finalBalanced.filter(entry => entry.date === '2026-05-04');
        if (changed0504Entries.length > 0) {
          dbBulkInsertTimesheets(changed0504Entries);
        }

        setSupabaseConnected(true);
      } catch (e) {
        setSupabaseConnected(false);
        console.warn('⚠️ Fallback to browser storage as Supabase client is configuring...', e);
      }
    }
    
    loadDataAndSync();
  }, []);

  // Sync state helpers
  const updateEmployeesAndSync = (newEmpList: Employee[]) => {
    setEmployees(newEmpList);
    localStorage.setItem('thai_ot_employees', JSON.stringify(newEmpList));
  };

  const updateHolidaysAndSync = (newHolidayList: Holiday[]) => {
    setHolidays(newHolidayList);
    localStorage.setItem('thai_ot_holidays', JSON.stringify(newHolidayList));
  };

  const updateEntriesAndSync = (newEntriesList: TimesheetEntry[]): TimesheetEntry[] => {
    const balanced = rebalanceTimesheetEntries(newEntriesList, employees, holidays);
    setEntries(balanced);
    localStorage.setItem('thai_ot_entries', JSON.stringify(balanced));
    return balanced;
  };

  // State Modification Actions (passed to subcomponents with instant Supabase push)
  // 1. Employee Managers
  const handleAddEmployee = async (emp: Employee) => {
    const list = [emp, ...employees];
    updateEmployeesAndSync(list);
    await dbUpsertEmployee(emp);
  };

  const handleBulkAddEmployees = async (newEmps: Employee[]) => {
    let updatedList = [...employees];
    for (const emp of newEmps) {
      const idx = updatedList.findIndex(e => e.id === emp.id);
      if (idx >= 0) {
        updatedList[idx] = { ...updatedList[idx], ...emp };
      } else {
        updatedList.push(emp);
      }
    }
    updateEmployeesAndSync(updatedList);
    
    // Save all to database asynchronously
    for (const emp of newEmps) {
      await dbUpsertEmployee(emp);
    }
  };

  const handleUpdateEmployee = async (id: string, updated: Partial<Employee>) => {
    const list = employees.map(emp => emp.id === id ? { ...emp, ...updated } : emp);
    updateEmployeesAndSync(list);

    const matchObj = list.find(emp => emp.id === id);
    if (matchObj) {
      await dbUpsertEmployee(matchObj);
    }

    // If name or flat rate changed, cascade updates to timesheet entries referencing this employee
    if (updated.employeeName || updated.isFlatRate !== undefined) {
      const oldEmp = employees.find(e => e.id === id);
      if (oldEmp) {
        const updatedEntries = entries.map(entry => {
          if (entry.employeeName === oldEmp.employeeName) {
            return {
              ...entry,
              employeeName: updated.employeeName || entry.employeeName,
              flatRate: updated.isFlatRate !== undefined ? updated.isFlatRate : entry.flatRate
            };
          }
          return entry;
        });
        updateEntriesAndSync(updatedEntries);
        
        // Push cascaded ones sequentially in background
        updatedEntries.forEach(entry => {
          if (entry.employeeName === (updated.employeeName || oldEmp.employeeName)) {
            dbUpsertTimesheet(entry);
          }
        });
      }
    }
  };

  const handleDeleteEmployee = async (id: string) => {
    const list = employees.filter(emp => emp.id !== id);
    updateEmployeesAndSync(list);
    await dbDeleteEmployee(id);
  };

  // 2. Holiday Managers
  const handleAddHoliday = (h: Holiday) => {
    const list = [...holidays, h];
    updateHolidaysAndSync(list);
  };

  const handleDeleteHoliday = (id: number) => {
    const matched = holidays.filter(h => h.id !== id);
    updateHolidaysAndSync(matched);
  };

  const handleUpdateHoliday = (updated: Holiday) => {
    const list = holidays.map(h => h.id === updated.id ? updated : h);
    updateHolidaysAndSync(list);
  };

  // 3. Timesheet Entries Managers
  const handleAddEntry = async (entry: TimesheetEntry) => {
    const list = [entry, ...entries];
    const balanced = updateEntriesAndSync(list);
    
    // Find all entries on the same day for this employee to sync
    const targetEmpName = entry.employeeName;
    const targetDate = entry.date;
    const groupEntries = balanced.filter(
      e => e.employeeName.trim().toUpperCase() === targetEmpName.trim().toUpperCase() && e.date === targetDate
    );
    if (groupEntries.length > 0) {
      await dbBulkInsertTimesheets(groupEntries);
    }
  };

  const handleUpdateEntry = async (id: string, updated: Partial<TimesheetEntry>) => {
    const list = entries.map(e => e.id === id ? { ...e, ...updated } : e);
    const balanced = updateEntriesAndSync(list);

    // Find the master record to see which employee/date group was affected
    const targetObj = balanced.find(e => e.id === id) || entries.find(e => e.id === id);
    if (targetObj) {
      const groupEntries = balanced.filter(
        e => e.employeeName.trim().toUpperCase() === targetObj.employeeName.trim().toUpperCase() && e.date === targetObj.date
      );
      if (groupEntries.length > 0) {
        await dbBulkInsertTimesheets(groupEntries);
      }
    }
  };

  const handleDeleteEntry = async (id: string) => {
    const targetObj = entries.find(e => e.id === id);
    const list = entries.filter(e => e.id !== id);
    const balanced = updateEntriesAndSync(list);

    await dbDeleteTimesheet(id);

    if (targetObj) {
      const groupEntries = balanced.filter(
        e => e.employeeName.trim().toUpperCase() === targetObj.employeeName.trim().toUpperCase() && e.date === targetObj.date
      );
      if (groupEntries.length > 0) {
        await dbBulkInsertTimesheets(groupEntries);
      }
    }
  };

  const handleBulkDeleteEntries = async (ids: string[]) => {
    if (ids.length === 0) return;
    const list = entries.filter(e => !ids.includes(e.id));
    const balanced = updateEntriesAndSync(list);

    // Delete in database
    for (const id of ids) {
      await dbDeleteTimesheet(id);
    }

    // Rebalance affected groups
    const affectedGroups = new Set<string>();
    ids.forEach(id => {
      const match = entries.find(e => e.id === id);
      if (match) {
        affectedGroups.add(`${match.employeeName.trim().toUpperCase()}_${match.date}`);
      }
    });

    for (const groupKey of affectedGroups) {
      const [empName, date] = groupKey.split('_');
      const groupEntries = balanced.filter(
        e => e.employeeName.trim().toUpperCase() === empName && e.date === date
      );
      if (groupEntries.length > 0) {
        await dbBulkInsertTimesheets(groupEntries);
      }
    }
  };

  const handleBulkAddEntries = async (newParsedList: TimesheetEntry[]) => {
    // 1. Identify any missing employees from the parsed entries list
    const incomingEmpNames = Array.from(new Set(newParsedList.map(e => e.employeeName.trim().toUpperCase())));
    
    let updatedEmployees = [...employees];
    const createdEmployees: Employee[] = [];

    for (const rawName of incomingEmpNames) {
      if (!rawName) continue;
      
      const match = findEmployeeMatch(rawName, updatedEmployees);
      const found = !!match;

      if (!found) {
        // Auto-create missing employee
        const baseID = "EMP";
        let numericPart = updatedEmployees.length + 1;
        let nextID = `${baseID}${String(numericPart).padStart(3, '0')}`;
        while (updatedEmployees.some(emp => emp.id === nextID) || createdEmployees.some(emp => emp.id === nextID)) {
          numericPart++;
          nextID = `${baseID}${String(numericPart).padStart(3, '0')}`;
        }

        const newEmp: Employee = {
          id: nextID,
          employeeName: rawName,
          staffSalary: 0,
          officeSalary: 0,
          transportationRate: 0,
          workshopRate: settings.defaultDailyWage || 700,
          onsiteRate: (settings.defaultDailyWage || 700) + 50,
          offshoreRate: 2500,
          wfhRate: 0,
          position: 'ช่างเทคนิค',
          status: 'active',
          bankName: '',
          bankAccount: '',
          studentLoan: 0,
          workScheduleType: 'daily_worker',
          isFlatRate: false
        };

        createdEmployees.push(newEmp);
        updatedEmployees.push(newEmp);
      }
    }

    // If new employees were created, save and sync them first
    if (createdEmployees.length > 0) {
      updateEmployeesAndSync(updatedEmployees);
      for (const newEmp of createdEmployees) {
        await dbUpsertEmployee(newEmp);
      }
    }

    // 2. Adjust the parsedEntries' names if there were slight matching deviations, using the updated list of employees
    const parsedWithCorrectNames = newParsedList.map(entry => {
      const match = findEmployeeMatch(entry.employeeName, updatedEmployees);
      return {
        ...entry,
        employeeName: match ? match.employeeName : entry.employeeName.toUpperCase()
      };
    });

    // Deduplicate parsed entries WITHIN themselves to ensure no self-duplicates in the uploaded file
    const selfDeduplicated: TimesheetEntry[] = [];
    const selfSeenKeys = new Set<string>();
    parsedWithCorrectNames.forEach(entry => {
      const key = `${entry.employeeName.trim().toUpperCase()}_${entry.date}_${entry.timeIn || ''}_${entry.timeOut || ''}_${(entry.project || '').trim().toUpperCase()}_${entry.lunchOT || 0}`;
      if (!selfSeenKeys.has(key)) {
        selfSeenKeys.add(key);
        selfDeduplicated.push(entry);
      }
    });

    // Filter out parsed entries that are exact duplicates of already existing entries in the database/system
    const incomingUnique: TimesheetEntry[] = [];
    let skippedDbDuplicateCount = 0;

    selfDeduplicated.forEach(newEntry => {
      const isDuplicateInDb = entries.some(existing => {
        const nameMatch = existing.employeeName.trim().toUpperCase() === newEntry.employeeName.trim().toUpperCase();
        const dateMatch = existing.date === newEntry.date;
        const timeInMatch = (existing.timeIn || '') === (newEntry.timeIn || '');
        const timeOutMatch = (existing.timeOut || '') === (newEntry.timeOut || '');
        const projectMatch = (existing.project || '').trim().toUpperCase() === (newEntry.project || '').trim().toUpperCase();
        const lunchOTMatch = (existing.lunchOT || 0) === (newEntry.lunchOT || 0);
        return nameMatch && dateMatch && timeInMatch && timeOutMatch && projectMatch && lunchOTMatch;
      });

      if (isDuplicateInDb) {
        skippedDbDuplicateCount++;
      } else {
        incomingUnique.push(newEntry);
      }
    });

    if (incomingUnique.length === 0) {
      alert(`⚠️ ระบบตรวจพบว่าข้อมูลการทำงานทั้งหมดที่นำเข้ามีอยู่แล้วในระบบเรียบร้อย (ข้ามรายการซ้ำซ้อน ${skippedDbDuplicateCount} รายการ)\nระบบไม่ได้นำเข้าแถวซ้ำใดๆ เพิ่มเติม เพื่อป้องกันค่าการคำนวณซ้ำซ้อน`);
      return;
    }

    // 3. Save timesheets and sync
    const list = [...incomingUnique, ...entries];
    const balanced = updateEntriesAndSync(list);

    // Save all entries on the affected dates for the affected employees
    const affectedKeys = new Set<string>();
    incomingUnique.forEach(e => {
      affectedKeys.add(`${e.employeeName.trim().toUpperCase()}_${e.date}`);
    });

    const entriesToSync = balanced.filter(e => {
      const key = `${e.employeeName.trim().toUpperCase()}_${e.date}`;
      return affectedKeys.has(key);
    });

    if (entriesToSync.length > 0) {
      await dbBulkInsertTimesheets(entriesToSync);
    }

    if (skippedDbDuplicateCount > 0) {
      alert(`นำข้อมูลสำเร็จ! บันทึกรายการใหม่สำเร็จ: ${incomingUnique.length} รายการ, ข้ามรายการซ้ำที่มีอยู่แล้วในระบบ: ${skippedDbDuplicateCount} รายการ (ป้องกันข้อมูลซ้ำซ้อนเรียบร้อย)`);
    }
  };

  const handleClearAllEntries = async () => {
    // เคลียร์ค่าเฉพาะภายในหน้าเว็บเท่านั้นโดยไม่ลบข้อมูลออกจากฐานข้อมูล (Supabase)
    updateEntriesAndSync([]);
  };

  const handleSyncFromDatabase = async () => {
    try {
      const dbTimesheets = await dbFetchTimesheets();
      if (dbTimesheets !== null) {
        updateEntriesAndSync(dbTimesheets);
      } else {
        const savedEntries = localStorage.getItem('thai_ot_entries');
        if (savedEntries) {
          updateEntriesAndSync(JSON.parse(savedEntries));
        } else {
          updateEntriesAndSync(initialTimesheetEntries);
        }
      }
    } catch (e) {
      console.warn('⚠️ Sync database error:', e);
    }
  };

  const isDark = theme === 'dark';

  return (
    <div className={`min-h-screen flex flex-col font-sans transition-colors duration-250 selection:bg-[#D4AF37]/30 selection:text-[#D4AF37] ${
      isDark ? 'bg-[#0A0A0A] text-gray-200' : 'bg-[#F4F6F9] text-slate-800'
    }`}>
      {/* Visual Navigation Header Banner */}
      <header className={`border-b shadow-md transition-colors duration-250 ${
        isDark ? 'bg-[#0D0D0D] text-white border-white/10' : 'bg-white text-slate-800 border-slate-200'
      }`}>
        <div className="max-w-full mx-auto px-4 md:px-8 xl:px-12 py-5 font-sans">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="p-1 px-1.5 bg-[#D4AF37] text-black rounded-sm text-[8px] font-extrabold uppercase tracking-widest leading-none">SYSTEM</span>
                <h1 className="text-lg md:text-xl font-serif font-extrabold tracking-wide text-[#D4AF37] flex items-center gap-1.5">
                  <Clock className="w-5 h-5 text-[#D4AF37] animate-spin-slow" />
                  ระบบบัญชีคำนวณโอที <span className={`${isDark ? 'text-white' : 'text-slate-850'} font-light font-sans`}>Thai Timesheet & Payroll</span>
                </h1>
                
                {/* Supabase connection badge notification */}
                <div className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold ${
                  isDark ? 'bg-emerald-950/50 border border-emerald-900/60 text-emerald-300' : 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                }`}>
                  <Database className="w-3 h-3 text-emerald-555" />
                  Supabase Connected
                </div>
              </div>
              <p className={`text-[11px] max-w-2xl font-normal leading-relaxed ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                คำนวณเวลาการทำงานสะสมช่างฟูลสแตก (ปกติ, ล่วงเวลา 1.5, 2.0, 3.0 เท่า) สลับอัตราบัญชีเงินรอบบิต ออกใบสลิปจ่าย ซิงค์ Supabase แบบเรียลไทม์
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 self-start md:self-auto text-xs">
              {/* Theme Toggle Button Widget */}
              <button
                onClick={() => setTheme(prev => prev === 'light' ? 'dark' : 'light')}
                className={`p-2.5 rounded-full border transition-all duration-200 flex items-center justify-center cursor-pointer ${
                  isDark 
                    ? 'bg-[#141414] border-white/10 hover:bg-white/5 text-[#D4AF37]' 
                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-amber-600 shadow-sm'
                }`}
                title={isDark ? "เปลี่ยนเป็นโหมดสว่างสบายตา" : "เปลี่ยนเป็นโหมดมืดล้ำลึก"}
                id="theme-toggler"
              >
                {isDark ? <Sun className="w-4 h-4 animate-pulse" /> : <Moon className="w-4 h-4" />}
              </button>

              <div className={`flex items-center gap-4 p-3 rounded border transition-colors duration-250 ${
                isDark ? 'bg-[#141414] border-white/10' : 'bg-slate-50 border-slate-200 shadow-xs'
              }`}>
                <div className="space-y-0.5 font-mono text-left">
                  <div className="text-[8px] text-gray-500 uppercase tracking-widest font-sans font-bold">พนักงานรวม</div>
                  <div className={`font-semibold text-xs ${isDark ? 'text-white' : 'text-slate-800'}`}>
                    <span className="text-[#D4AF37] font-extrabold">{employees.length}</span> คน
                  </div>
                </div>
                <div className={`w-px h-6 ${isDark ? 'bg-white/10' : 'bg-slate-300/60'}`} />
                <div className="space-y-0.5 font-mono text-left">
                  <div className="text-[8px] text-gray-500 uppercase tracking-widest font-sans font-bold">บันทึกกะช่าง</div>
                  <div className={`font-semibold text-xs ${isDark ? 'text-white' : 'text-slate-800'}`}>
                    <span className="text-emerald-500 font-extrabold">{entries.length}</span> เรคคอร์ด
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Level Tabs */}
        <div className={`border-t transition-colors duration-250 ${
          isDark ? 'border-white/10 bg-[#0D0D0D]/90' : 'border-slate-200 bg-slate-50'
        }`}>
          <div className="max-w-full mx-auto px-4 md:px-8 xl:px-12">
            <nav className="flex space-x-2 py-2 overflow-x-auto">
              <button
                id="tab-ledger"
                onClick={() => setActiveTab('ledger')}
                className={`py-2 px-4 rounded-sm text-xs uppercase tracking-wider font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                  activeTab === 'ledger'
                    ? 'bg-[#D4AF37] text-black shadow-md'
                    : isDark ? 'text-gray-400 hover:bg-white/5 hover:text-white' : 'text-slate-600 hover:bg-slate-200/50 hover:text-slate-800'
                }`}
              >
                <FileText className="w-4 h-4" />
                สมุดบันทึก Timesheet
              </button>

              <button
                id="tab-individual-report"
                onClick={() => setActiveTab('individual-report')}
                className={`py-2 px-4 rounded-sm text-xs uppercase tracking-wider font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                  activeTab === 'individual-report'
                    ? 'bg-[#D4AF37] text-black shadow-md'
                    : isDark ? 'text-gray-400 hover:bg-white/5 hover:text-white' : 'text-slate-600 hover:bg-slate-200/50 hover:text-slate-800'
                }`}
              >
                <UserCheck className="w-4 h-4" />
                รายงานเวลาพนักงานเดี่ยว (NEW)
              </button>

              <button
                id="tab-payroll"
                onClick={() => setActiveTab('payroll')}
                className={`py-2 px-4 rounded-sm text-xs uppercase tracking-wider font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                  activeTab === 'payroll'
                    ? 'bg-[#D4AF37] text-black shadow-md'
                    : isDark ? 'text-gray-400 hover:bg-white/5 hover:text-white' : 'text-slate-600 hover:bg-slate-200/50 hover:text-slate-800'
                }`}
              >
                <Coins className="w-4 h-4" />
                ดูคำนวนรายได้ ทั้งหมดทั้งเดือน ของพนักงาน
              </button>

              <button
                id="tab-employees"
                onClick={() => setActiveTab('employees')}
                className={`py-2 px-4 rounded-sm text-xs uppercase tracking-wider font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                  activeTab === 'employees'
                    ? 'bg-[#D4AF37] text-black shadow-md'
                    : isDark ? 'text-gray-400 hover:bg-white/5 hover:text-white' : 'text-slate-600 hover:bg-slate-200/50 hover:text-slate-800'
                }`}
              >
                <Users className="w-4 h-4" />
                ทะเบียนรายชื่อพนักงาน
              </button>

              <button
                id="tab-dashboard"
                onClick={() => setActiveTab('dashboard')}
                className={`py-2 px-4 rounded-sm text-xs uppercase tracking-wider font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                  activeTab === 'dashboard'
                    ? 'bg-[#D4AF37] text-black shadow-md'
                    : isDark ? 'text-gray-400 hover:bg-white/5 hover:text-white' : 'text-slate-600 hover:bg-slate-200/50 hover:text-slate-800'
                }`}
              >
                <BarChart4 className="w-4 h-4" />
                ภาพรวมสรุปโอที
              </button>

              <button
                id="tab-holidays"
                onClick={() => setActiveTab('holidays')}
                className={`py-2 px-4 rounded-sm text-xs uppercase tracking-wider font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                  activeTab === 'holidays'
                    ? 'bg-[#D4AF37] text-black shadow-md'
                    : isDark ? 'text-gray-400 hover:bg-white/5 hover:text-white' : 'text-slate-600 hover:bg-slate-200/50 hover:text-slate-800'
                }`}
              >
                <CalendarDays className="w-4 h-4" />
                ปฏิทินปูมวันหยุด
              </button>

              <button
                id="tab-settings"
                onClick={() => setActiveTab('settings')}
                className={`py-2 px-4 rounded-sm text-xs uppercase tracking-wider font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                  activeTab === 'settings'
                    ? 'bg-[#D4AF37] text-black shadow-md'
                    : isDark ? 'text-gray-400 hover:bg-white/5 hover:text-white' : 'text-slate-600 hover:bg-slate-200/50 hover:text-slate-800'
                }`}
              >
                <Sliders className="w-4 h-4" />
                ตั้งค่าเรทโอทีทั่วไป (⚙️)
              </button>

              <button
                id="tab-help"
                onClick={() => setActiveTab('help')}
                className={`py-2 px-4 rounded-sm text-xs uppercase tracking-wider font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                  activeTab === 'help'
                    ? 'bg-[#D4AF37] text-black shadow-md'
                    : isDark ? 'text-gray-400 hover:bg-white/5 hover:text-white' : 'text-slate-600 hover:bg-slate-200/50 hover:text-slate-800'
                }`}
              >
                <HelpCircle className="w-4 h-4" />
                คู่มือการใช้งาน (Manual)
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Workspace Frame */}
      <main className="flex-1 max-w-full w-full mx-auto px-4 md:px-8 xl:px-12 py-6 font-sans">
        {activeTab === 'ledger' && (
          <div className="space-y-4">
            <div className={`border p-4 rounded flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors duration-250 ${
              isDark 
                ? 'bg-[#141414] border-[#D4AF37]/20 text-gray-250' 
                : 'bg-white border-slate-200 shadow-xs text-slate-750'
            }`}>
              <div className="flex items-start gap-3">
                <div className="p-2 bg-[#D4AF37]/10 rounded text-[#D4AF37] mt-0.5">
                  <Sparkles className="w-4 h-4 animate-pulse" />
                </div>
                <div>
                  <h3 className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-white' : 'text-slate-850'}`}>เทคนิคประหยัดความจำ: นำเข้าตารางงานจาก Excel / Sheets ได้ทันที!</h3>
                  <p className="text-[11px] text-gray-400 font-light mt-0.5">
                    ก๊อปปี้คลิปบอร์ดแบบกลุ่มแถวตารางจาก Google Sheet เข้ามาวางได้ทันที ทุกอย่างจะถูกอัปโหลดขึ้น Supabase และลงรายละเอียดสมบูรณ์
                  </p>
                </div>
              </div>
              <button 
                id="quick-start-import-assistant"
                onClick={() => {
                  const el = document.getElementById('open-import-modal-btn');
                  if (el) el.click();
                }}
                className="bg-[#D4AF37] hover:bg-amber-400 text-black text-xs font-bold uppercase tracking-wider py-1.5 px-3.5 rounded-sm transition-colors cursor-pointer shrink-0"
              >
                นำเข้าข้อมูลด่วน
              </button>
            </div>
            
            <TimesheetTable
              entries={entries}
              employees={employees}
              holidays={holidays}
              onAddEntry={handleAddEntry}
              onUpdateEntry={handleUpdateEntry}
              onDeleteEntry={handleDeleteEntry}
              onBulkDeleteEntries={handleBulkDeleteEntries}
              onBulkAddEntries={handleBulkAddEntries}
              onClearAllEntries={handleClearAllEntries}
              onSyncFromDatabase={handleSyncFromDatabase}
              isDark={isDark}
            />
          </div>
        )}

        {activeTab === 'payroll' && (
          isPayrollUnlocked ? (
            <div className="space-y-4">
              <div className={`p-3 rounded border flex items-center justify-between transition-all duration-200 ${
                isDark ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
              }`}>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-bold font-sans">✓ สิทธิการคำนวณเงินเดือนเปิดเข้าถึงเรียบร้อย (Unlocked)</span>
                </div>
                <button
                  onClick={() => setIsPayrollUnlocked(false)}
                  className="bg-red-500 hover:bg-red-600 text-white font-extrabold text-[10px] uppercase tracking-widest px-3 py-1 rounded-sm cursor-pointer transition-all active:scale-[0.98]"
                >
                  ล็อคระบบความปลอดภัย / LOCK
                </button>
              </div>
              <PayrollSection
                employees={employees}
                entries={entries}
                settings={settings}
                isDark={isDark}
              />
            </div>
          ) : (
            <EmployeePasscodeLock
              onUnlock={() => setIsPayrollUnlocked(true)}
              isDark={isDark}
              title="ระบบคำนวณรายได้ทั้งหมดทั้งเดือนได้รับการคุ้มครองสิทธิ"
              description="กรุณาใส่รหัสผ่านเพื่อเข้าสู่รายงานระเบียนเงินรายเดือนและการคำนวณเบิกจ่ายพนักงาน"
            />
          )
        )}

        {activeTab === 'individual-report' && (
          <IndividualReport
            employees={employees}
            entries={entries}
            settings={settings}
            isDark={isDark}
            holidays={holidays}
            onAddEntry={handleAddEntry}
            onUpdateEntry={handleUpdateEntry}
            onDeleteEntry={handleDeleteEntry}
          />
        )}

        {activeTab === 'dashboard' && (
          <Dashboard
            entries={entries}
            employees={employees}
            holidays={holidays}
            isDark={isDark}
          />
        )}

        {activeTab === 'employees' && (
          isEmployeesUnlocked ? (
            <div className="space-y-4">
              <div className={`p-3 rounded border flex items-center justify-between transition-all duration-200 ${
                isDark ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
              }`}>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-bold">✓ สิทธิพนักงานเปิดเข้าถึงแก้ไขข้อมูลได้เรียบร้อย (Unlocked)</span>
                </div>
                <button
                  onClick={() => setIsEmployeesUnlocked(false)}
                  className="bg-red-500 hover:bg-red-600 text-white font-extrabold text-[10px] uppercase tracking-widest px-3 py-1 rounded-sm cursor-pointer transition-all active:scale-[0.98]"
                >
                  ล็อคระบบความปลอดภัย / LOCK
                </button>
              </div>
              <EmployeeManager
                employees={employees}
                onAddEmployee={handleAddEmployee}
                onBulkAddEmployees={handleBulkAddEmployees}
                onUpdateEmployee={handleUpdateEmployee}
                onDeleteEmployee={handleDeleteEmployee}
                isDark={isDark}
              />
            </div>
          ) : (
            <EmployeePasscodeLock
              onUnlock={() => setIsEmployeesUnlocked(true)}
              isDark={isDark}
            />
          )
        )}

        {activeTab === 'holidays' && (
          <HolidayList
            holidays={holidays}
            onAddHoliday={handleAddHoliday}
            onDeleteHoliday={handleDeleteHoliday}
            onUpdateHoliday={handleUpdateHoliday}
            isDark={isDark}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsSection
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            isDark={isDark}
          />
        )}

        {activeTab === 'help' && (
          <HelpSection
            isDark={isDark}
          />
        )}
      </main>

      {/* Humble Footer */}
      <footer className={`border-t py-6 text-center text-xs font-light font-mono transition-colors duration-250 ${
        isDark ? 'bg-[#0D0D0D] border-white/10 text-gray-500' : 'bg-slate-100 border-slate-200 text-slate-500'
      }`}>
        <div className="max-w-full mx-auto px-4 md:px-8 xl:px-12 space-y-1">
          <p>© 2026 Thai Timesheet & OT Calculation Engine with Supabase. All Rights Reserved.</p>
          <p className="text-[10px] text-gray-400">
            ระบบคำนวณอัตราทำงานและวันจ่ายเงินเดือนแบบ Real-time เชื่อมโยงฐานข้อมูลคลาวด์ สอดคล้องตามเกณฑ์มาตรฐานความปลอดภัยสูง
          </p>
        </div>
      </footer>
    </div>
  );
}

function EmployeePasscodeLock({ 
  onUnlock, 
  isDark,
  title = "ระบบนี้ได้รับการคุ้มครองสิทธิ",
  description = "ส่วนของ ทะเบียนพนักงาน จำเป็นต้องใช้รหัสผ่านเฉพาะก่อนเปิดดูและแก้ไขข้อมูล"
}: { 
  onUnlock: () => void; 
  isDark: boolean;
  title?: string;
  description?: string;
}) {
  const [passcode, setPasscode] = React.useState('');
  const [error, setError] = React.useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passcode === '4144284312') {
      onUnlock();
      setError('');
    } else {
      setError('❌ รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง');
    }
  };

  return (
    <div className="flex justify-center items-center py-16 px-4">
      <div className={`w-full max-w-md p-8 rounded-lg border shadow-2xl transition-all duration-200 ${
        isDark ? 'bg-[#0D0D0D] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'
      }`}>
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="p-4 bg-amber-500/10 text-[#D4AF37] rounded-full">
            <Lock className="w-8 h-8 animate-pulse" />
          </div>
          <div>
            <h2 className="text-base font-bold tracking-tight uppercase">{title}</h2>
            <p className="text-[11px] text-gray-400 mt-1">
              {description}
            </p>
          </div>
          
          <form onSubmit={handleSubmit} className="w-full space-y-4 pt-4">
            <div className="space-y-1 text-left">
              <label className="text-[10px] uppercase font-bold tracking-wider text-gray-400">ป้อนรหัสคีย์ลับพนักงาน (Passcode)</label>
              <input
                type="password"
                value={passcode}
                onChange={(e) => {
                  setPasscode(e.target.value);
                  if (error) setError('');
                }}
                placeholder="••••••••"
                className={`w-full px-4 py-2.5 rounded border text-center font-mono tracking-widest text-lg focus:outline-hidden ${
                  isDark 
                    ? 'bg-[#141414] border-white/10 text-white focus:border-[#D4AF37]' 
                    : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-amber-500'
                }`}
                autoFocus
              />
            </div>

            {error && (
              <p className="text-[11px] text-red-500 font-medium">{error}</p>
            )}

            <button
              type="submit"
              className="w-full bg-[#D4AF37] hover:bg-amber-400 active:scale-[0.98] text-black font-bold text-xs uppercase tracking-wider py-3 rounded transition-all cursor-pointer"
            >
              ตรวจสอบรหัสผ่าน / UNLOOK REGISTRY
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
