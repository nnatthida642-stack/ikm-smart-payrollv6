import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Employee, TimesheetEntry, SystemSettings, Holiday } from '../types';
import { 
  Users, Calendar, Clock, Filter, Printer, Download, Save,
  Search, FileSpreadsheet, ChevronRight, CheckCircle, Info, ArrowRight, UserCheck, RefreshCw, Plus, Check, Database, Trash2,
  Lock, Briefcase, Coins
} from 'lucide-react';
import { calculateEntryOT, formatThaiDate, findEmployeeMatch } from '../utils/calculator';
import { dbFetchSupplements, dbSaveSupplements } from '../lib/supabaseClient';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';

interface IndividualReportProps {
  employees: Employee[];
  entries: TimesheetEntry[];
  settings: SystemSettings;
  isDark: boolean;
  holidays: Holiday[];
  onAddEntry: (entry: TimesheetEntry) => Promise<void>;
  onUpdateEntry: (id: string, updated: Partial<TimesheetEntry>) => Promise<void>;
  onDeleteEntry: (id: string) => Promise<void>;
}

interface SupplementData {
  perdiem: number;
  advance: number;
  jobBonus: number;
  confineSpace: number;
  incentive: number;
  remarkOverride: string;
}

const getThaiDayName = (enDay: string) => {
  const mapping: Record<string, string> = {
    'Monday': 'จันทร์ (Mon)',
    'Tuesday': 'อังคาร (Tue)',
    'Wednesday': 'พุธ (Wed)',
    'Thursday': 'พฤหัสบดี (Thu)',
    'Friday': 'ศุกร์ (Fri)',
    'Saturday': 'เสาร์ (Sat)',
    'Sunday': 'อาทิตย์ (Sun)'
  };
  return mapping[enDay] || enDay;
};

function SubTabPasscodeLock({ 
  onUnlock, 
  isDark,
  title = "ระบบคำนวณรายได้ทั้งหมดทั้งเดือนได้รับการคุ้มครองสิทธิ",
  description = "กรุณาใส่รหัสผ่านเพื่อเข้าสู่รายงานระเบียนเงินรายเดือนและการคำนวณเบิกจ่ายพนักงาน"
}: { 
  onUnlock: () => void; 
  isDark: boolean;
  title?: string;
  description?: string;
}) {
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');

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
    <div className="flex justify-center items-center py-16 px-4 animate-fade-in">
      <div className={`w-full max-w-md p-8 rounded-lg border shadow-2xl transition-all duration-200 ${
        isDark ? 'bg-[#0D0D0D] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'
      }`}>
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="p-4 bg-amber-500/10 text-[#D4AF37] rounded-full">
            <Lock className="w-8 h-8 animate-pulse" />
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-tight uppercase font-sans text-[#D4AF37]">{title}</h2>
            <p className="text-[11px] text-gray-500 mt-2 font-sans">
              {description}
            </p>
          </div>
          
          <form onSubmit={handleSubmit} className="w-full space-y-4 pt-4">
            <div className="space-y-1 text-left">
              <label className="text-[10px] uppercase font-bold tracking-wider text-gray-400 font-sans">ป้อนรหัสคีย์ลับพนักงาน (Passcode)</label>
              <input
                type="password"
                value={passcode}
                onChange={(e) => {
                  setPasscode(e.target.value);
                  if (error) setError('');
                }}
                placeholder="••••••••"
                className={`w-full px-3 py-2 text-sm rounded bg-black/10 border font-mono ${
                  isDark ? 'border-white/10 text-white focus:border-amber-500' : 'border-slate-300 text-slate-800 focus:border-[#D4AF37]'
                } focus:outline-hidden`}
              />
              {error && (
                <p className="text-red-500 text-[11px] mt-1 font-bold font-sans">
                  {error}
                </p>
              )}
            </div>
            
            <button
              type="submit"
              className="w-full bg-[#D4AF37] hover:bg-[#Bfa030] text-black font-extrabold text-xs uppercase tracking-wider py-2.5 rounded-sm transition-all active:scale-[0.98] cursor-pointer font-sans"
            >
              ตรวจสอบรหัสผ่าน / UNLOCK SYSTEM
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function IndividualReport({ 
  employees, 
  entries, 
  settings, 
  isDark, 
  holidays,
  onAddEntry,
  onUpdateEntry,
  onDeleteEntry
}: IndividualReportProps) {
  // Navigation tabs: "master" (aggregate overview) or "drilldown" (IKM styled monthly timesheet)
  const [activeSubTab, setActiveSubTab] = useState<'master' | 'drilldown' | 'daily-breakdown' | 'project-summary'>('drilldown');
  const [isSubTabsUnlocked, setIsSubTabsUnlocked] = useState<boolean>(false);

  // Project Summary Report States
  const [selectedProjectEmployees, setSelectedProjectEmployees] = useState<string[]>([]);
  const [selectedProjectList, setSelectedProjectList] = useState<string[]>([]);
  const [isProjEmpDropdownOpen, setIsProjEmpDropdownOpen] = useState<boolean>(false);
  const [isProjDropdownOpen, setIsProjDropdownOpen] = useState<boolean>(false);

  // Configured selected employee for drill-down
  const [selectedEmpName, setSelectedEmpName] = useState<string>('');
  
  // Date Cutoff Range
  const [startDate, setStartDate] = useState<string>('2026-04-21');
  const [endDate, setEndDate] = useState<string>('2026-05-20');

  // New states for Monthly View selector mode
  const [isMonthlyMode, setIsMonthlyMode] = useState<boolean>(true);
  const [selectedYear, setSelectedYear] = useState<number>(() => {
    return new Date().getFullYear() || 2026;
  });
  const [selectedMonth, setSelectedMonth] = useState<number>(() => {
    // 0-indexed: May is 4
    return new Date().getMonth() ?? 4;
  });

  // Master View search keywords
  const [masterSearch, setMasterSearch] = useState<string>('');

  // Metadata custom editable input states
  const [positionInput, setPositionInput] = useState<string>('');
  const [locationInput, setLocationInput] = useState<string>('IKM Office');
  const [employeeCodeInput, setEmployeeCodeInput] = useState<string>('');
  const [projectInput, setProjectInput] = useState<string>('');
  
  // Signature custom editable input states
  const [issuedByInput, setIssuedByInput] = useState<string>('Jidapa S.');
  const [checkedByInput, setCheckedByInput] = useState<string>('Upadee T.');
  const [approvedByInput, setApprovedByInput] = useState<string>('Apiyut N.');

  // Notification feedback state
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isSavingSupplements, setIsSavingSupplements] = useState<boolean>(false);
  const [showSqlHelper, setShowSqlHelper] = useState<boolean>(false);
  const [copiedSql, setCopiedSql] = useState<boolean>(false);

  // Supplements local storage mapping: keyed by `${employeeId}_${date}`
  const [supplements, setSupplements] = useState<Record<string, SupplementData>>(() => {
    try {
      const saved = localStorage.getItem('thai_ot_individual_supplements');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Draft Timesheet entries edit matrix to support typing work times without latency
  const [draftEntries, setDraftEntries] = useState<Record<string, Partial<TimesheetEntry>>>({});
  const [isBatchPrinting, setIsBatchPrinting] = useState<boolean>(false);

  // Manual overrides for "Total Day off / Take Leave (ลารวม/วันหยุดสะสม)" - keyed by `${employeeId}_${selectedYear}_${selectedMonth}`
  const [manualLeaveDays, setManualLeaveDays] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('thai_ot_manual_leave_days');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Per-employee Location and Project overrides
  const [empLocations, setEmpLocations] = useState<Record<string, string>>(() => {
    const data: Record<string, string> = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('timesheet_loc_')) {
          const empId = key.substring('timesheet_loc_'.length);
          const val = localStorage.getItem(key);
          if (val !== null) data[empId] = val;
        }
      }
    } catch {}
    return data;
  });

  const [empProjects, setEmpProjects] = useState<Record<string, string>>(() => {
    const data: Record<string, string> = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('timesheet_proj_')) {
          const empId = key.substring('timesheet_proj_'.length);
          const val = localStorage.getItem(key);
          if (val !== null) data[empId] = val;
        }
      }
    } catch {}
    return data;
  });

  // Auto select first employee if empty
  useEffect(() => {
    if (!selectedEmpName && employees.length > 0) {
      setSelectedEmpName(employees[0].employeeName);
    }
  }, [employees, selectedEmpName]);

  const activeEmployee = useMemo(() => {
    return findEmployeeMatch(selectedEmpName, employees) || null;
  }, [employees, selectedEmpName]);

  const [empSearch, setEmpSearch] = useState<string>('');
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);

  // Sync empSearch when activeEmployee changes
  useEffect(() => {
    if (activeEmployee) {
      setEmpSearch(activeEmployee.employeeName);
    }
  }, [activeEmployee]);

  const filteredEmployeesForSelect = useMemo(() => {
    const query = empSearch.toLowerCase().trim();
    if (!query) return employees;
    // If exact match to currently selected, show all on focus so they can select others
    if (activeEmployee && query === activeEmployee.employeeName.toLowerCase().trim()) {
      return employees;
    }
    return employees.filter(emp =>
      emp.employeeName.toLowerCase().includes(query) ||
      emp.id.toLowerCase().includes(query)
    );
  }, [employees, empSearch, activeEmployee]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const container = document.getElementById('employee-search-container');
      if (container && !container.contains(event.target as Node)) {
        setIsDropdownOpen(false);
        if (activeEmployee) {
          setEmpSearch(activeEmployee.employeeName);
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [activeEmployee]);

  // Sync profile metadata input fields when active employee changes
  useEffect(() => {
    if (activeEmployee) {
      setPositionInput(activeEmployee.position || '');
      setEmployeeCodeInput(activeEmployee.id || '');
      
      // Load saved Location and Project for this employee from state/localStorage
      const savedLoc = empLocations[activeEmployee.id] !== undefined 
        ? empLocations[activeEmployee.id] 
        : (localStorage.getItem(`timesheet_loc_${activeEmployee.id}`) !== null 
           ? localStorage.getItem(`timesheet_loc_${activeEmployee.id}`)! 
           : 'IKM Office');
      setLocationInput(savedLoc);
      
      const savedProj = empProjects[activeEmployee.id] !== undefined 
        ? empProjects[activeEmployee.id] 
        : (localStorage.getItem(`timesheet_proj_${activeEmployee.id}`) !== null 
           ? localStorage.getItem(`timesheet_proj_${activeEmployee.id}`)! 
           : '');
      setProjectInput(savedProj);
    }
  }, [activeEmployee, empLocations, empProjects]);

  const handleLocationChange = (val: string) => {
    setLocationInput(val);
    if (activeEmployee) {
      setEmpLocations(prev => ({ ...prev, [activeEmployee.id]: val }));
      localStorage.setItem(`timesheet_loc_${activeEmployee.id}`, val);
    }
  };

  const handleProjectChange = (val: string) => {
    setProjectInput(val);
    if (activeEmployee) {
      setEmpProjects(prev => ({ ...prev, [activeEmployee.id]: val }));
      localStorage.setItem(`timesheet_proj_${activeEmployee.id}`, val);
    }
  };

  // Synchronize Monthly View dropdowns -> startDate & endDate (21st of previous month to 20th of chosen month)
  useEffect(() => {
    if (isMonthlyMode) {
      const prevDateObj = new Date(selectedYear, selectedMonth - 1, 21);
      const startY = prevDateObj.getFullYear();
      const startM = String(prevDateObj.getMonth() + 1).padStart(2, '0');
      const startDayStr = `${startY}-${startM}-21`;

      const curDateObj = new Date(selectedYear, selectedMonth, 20);
      const endY = curDateObj.getFullYear();
      const endM = String(curDateObj.getMonth() + 1).padStart(2, '0');
      const endDayStr = `${endY}-${endM}-20`;
      
      setStartDate(startDayStr);
      setEndDate(endDayStr);
    }
  }, [isMonthlyMode, selectedYear, selectedMonth]);

  // Persist Supplements map to localStorage
  useEffect(() => {
    localStorage.setItem('thai_ot_individual_supplements', JSON.stringify(supplements));
  }, [supplements]);

  // Load supplements from Supabase if connected
  useEffect(() => {
    let active = true;
    async function loadDbSupplements() {
      try {
        const data = await dbFetchSupplements();
        if (!active) return;
        if (data && data.length > 0) {
          // Merge fetched database records into supplements
          setSupplements(prev => {
            const updated = { ...prev };
            data.forEach((item: any) => {
              // Standard key in our local state is based on actual employee code & date
              const key = item.ID || `${item.EmployeeID}_${item.Date}`;
              updated[key] = {
                perdiem: parseFloat(item.Perdiem || 0),
                advance: parseFloat(item.Advance || 0),
                jobBonus: parseFloat(item.JobBonus || 0),
                confineSpace: parseFloat(item.ConfineSpace || 0),
                incentive: parseFloat(item.Incentive || 0),
                remarkOverride: item.Remark || ''
              };
            });
            return updated;
          });
        }
      } catch (err) {
        console.warn('⚠️ Could not load supplements from Supabase:', err);
      }
    }
    loadDbSupplements();
    return () => {
      active = false;
    };
  }, [selectedEmpName, startDate, endDate, employeeCodeInput]);

  // Filtered actual entries from database for selected employee & date range
  const filteredEntries = useMemo(() => {
    if (!selectedEmpName) return [];
    return entries
      .filter(entry => {
        const matchEmp = (entry.employeeId && activeEmployee)
          ? entry.employeeId === activeEmployee.id
          : entry.employeeName.toLowerCase().trim() === selectedEmpName.toLowerCase().trim();
        const inDateRange = entry.date >= startDate && entry.date <= endDate;
        return matchEmp && inDateRange;
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [entries, selectedEmpName, activeEmployee, startDate, endDate]);

  // Generate complete physical dates day-by-day in range
  const renderedDates = useMemo(() => {
    const dates: string[] = [];
    if (!startDate || !endDate) return dates;
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    const current = new Date(start);

    let safetyCount = 0;
    while (current <= end && safetyCount < 366) {
      const year = current.getFullYear();
      const month = String(current.getMonth() + 1).padStart(2, '0');
      const day = String(current.getDate()).padStart(2, '0');
      dates.push(`${year}-${month}-${day}`);
      current.setDate(current.getDate() + 1);
      safetyCount++;
    }
    return dates;
  }, [startDate, endDate]);

  // Initialize draft entries whenever dates or source entries change
  useEffect(() => {
    if (!selectedEmpName) return;

    const initialDrafts: Record<string, Partial<TimesheetEntry>> = {};
    renderedDates.forEach(dStr => {
      const dayEntries = filteredEntries.filter(e => e.date === dStr);
      if (dayEntries.length > 0) {
        dayEntries.forEach((entry, idx) => {
          const key = entry.id || `${dStr}_${idx}`;
          initialDrafts[key] = { ...entry };
        });
      } else {
        initialDrafts[dStr] = {
          id: `draft-${dStr}`,
          employeeName: selectedEmpName,
          date: dStr,
          project: projectInput || '',
          timeIn: '',
          timeOut: '',
          lunchDeduct: 1,
          lunchOT: 0,
          flatRate: activeEmployee?.isFlatRate || false,
          normalHours: 0,
          ot15Hours: 0,
          ot20Hours: 0,
          ot30Hours: 0,
          remark: '',
          status: 'Pending'
        };
      }
    });
    setDraftEntries(initialDrafts);
  }, [selectedEmpName, startDate, endDate, filteredEntries, activeEmployee]);

  // Calculate Employee standard hourly rate
  const hourlyRate = useMemo(() => {
    if (!activeEmployee) return 0;
    const workHours = settings.defaultWorkHours || 8;
    if (activeEmployee.workScheduleType === 'staff' || activeEmployee.workScheduleType === 'monthly_worker') {
      const salary = activeEmployee.staffSalary || activeEmployee.officeSalary || 0;
      return Number((salary / 30 / workHours).toFixed(2));
    } else {
      const dayWage = activeEmployee.workshopRate || settings.defaultDailyWage || 700;
      return Number((dayWage / workHours).toFixed(2));
    }
  }, [activeEmployee, settings]);

  // MASTER VIEW REPORT: Aggregate summary metrics for everyone in range
  const masterAggregate = useMemo(() => {
    return employees.map(emp => {
      const matchEntries = entries.filter(ent => {
        const matchName = ent.employeeId 
          ? ent.employeeId === emp.id 
          : ent.employeeName.toLowerCase().trim() === emp.employeeName.toLowerCase().trim();
        const inRange = ent.date >= startDate && ent.date <= endDate;
        return matchName && inRange;
      });

      const daysWorked = matchEntries.length;
      let normal = 0;
      let ot15 = 0;
      let ot20 = 0;
      let ot30 = 0;

      matchEntries.forEach(ent => {
        normal += ent.normalHours;
        ot15 += ent.ot15Hours;
        ot20 += ent.ot20Hours;
        ot30 += ent.ot30Hours;
      });

      const otTotal = ot15 + ot20 + ot30;
      const totalHours = normal + otTotal;

      return {
        id: emp.id,
        name: emp.employeeName,
        position: emp.position || 'พนักงาน',
        scheduleType: emp.workScheduleType === 'staff' ? 'รายเดือน' : 'รายวัน',
        daysWorked,
        normalHours: Number(normal.toFixed(2)),
        ot15Hours: Number(ot15.toFixed(2)),
        ot20Hours: Number(ot20.toFixed(2)),
        ot30Hours: Number(ot30.toFixed(2)),
        otTotal: Number(otTotal.toFixed(2)),
        totalHours: Number(totalHours.toFixed(2)),
        isFlatRate: emp.isFlatRate
      };
    });
  }, [employees, entries, startDate, endDate]);

  const filteredMaster = useMemo(() => {
    return masterAggregate.filter(m => {
      return m.name.toLowerCase().includes(masterSearch.toLowerCase()) || 
             m.id.toLowerCase().includes(masterSearch.toLowerCase()) ||
             m.position.toLowerCase().includes(masterSearch.toLowerCase());
    });
  }, [masterAggregate, masterSearch]);

  const uniqueProjects = useMemo(() => {
    const projs = new Set<string>();
    entries.forEach(e => {
      if (e.project) projs.add(e.project.trim());
    });
    return Array.from(projs).filter(Boolean).sort();
  }, [entries]);

  const projectSummaryData = useMemo(() => {
    const summary: Record<string, {
      project: string;
      normalWage: number;
      otWage: number;
      combinedWageOt: number;
      perdiem: number;
      grandTotal: number;
    }> = {};

    // Get all unique matches
    entries.forEach(entry => {
      // Date range filter
      if (entry.date < startDate || entry.date > endDate) return;

      // Employee match
      const emp = employees.find(e => {
        if (entry.employeeId) return e.id === entry.employeeId;
        return e.employeeName.toLowerCase().trim() === entry.employeeName.toLowerCase().trim();
      });
      if (!emp) return;

      // Employee multi-select filter
      if (selectedProjectEmployees.length > 0 && !selectedProjectEmployees.includes(emp.id)) return;

      // Project filter
      const projectKey = (entry.project || 'Unspecified').trim();
      if (selectedProjectList.length > 0 && !selectedProjectList.includes(projectKey)) return;

      // Initialize group if not exists
      if (!summary[projectKey]) {
        summary[projectKey] = {
          project: projectKey,
          normalWage: 0,
          otWage: 0,
          combinedWageOt: 0,
          perdiem: 0,
          grandTotal: 0
        };
      }

      // Calculations
      const normHrs = entry.normalHours || 0;
      const itemOt15 = entry.ot15Hours || 0;
      const itemOt20 = entry.ot20Hours || 0;
      const itemOt30 = entry.ot30Hours || 0;

      let localDayRate = emp.workshopRate || 0;
      const projLower = projectKey.toLowerCase();
      const isOffshore = projLower.includes('offshore');
      const isWfh = projLower.includes('wfh') || projLower.includes('home');
      const isWorkshop = projLower.includes('workshop');
      const isOnsite = projLower.includes('onsite') || (projLower !== '' && !isWorkshop && !isOffshore && !isWfh);

      if (isOnsite) {
        localDayRate = emp.onsiteRate || 0;
      } else if (isOffshore) {
        localDayRate = emp.offshoreRate || 0;
      } else if (isWfh) {
        localDayRate = emp.wfhRate || 0;
      }

      const isStaff = emp.workScheduleType === 'staff' || emp.workScheduleType === 'monthly_worker';
      
      let empHourlyRate = 0;
      const workHours = settings.defaultWorkHours || 8;
      if (isStaff) {
        const salary = emp.officeSalary || emp.staffSalary || 0;
        empHourlyRate = Number((salary / 30 / workHours).toFixed(2));
      } else {
        empHourlyRate = Number((localDayRate / workHours).toFixed(2));
      }

      const ot20RateActual = isStaff ? 1.0 : (settings?.ot20Rate || 2.0);
      const normalPay = normHrs * empHourlyRate;
      const otPay = isOffshore ? 0 : (itemOt15 * 1.5 + itemOt20 * ot20RateActual + itemOt30 * 3.0) * empHourlyRate;

      summary[projectKey].normalWage += normalPay;
      summary[projectKey].otWage += otPay;
      summary[projectKey].combinedWageOt += (normalPay + otPay);
    });

    // Now, add Perdiem from supplements.
    Object.keys(supplements).forEach(key => {
      const parts = key.split('_');
      if (parts.length < 2) return;
      const empId = parts[0];
      const dateStr = parts[1];

      // Date filter
      if (dateStr < startDate || dateStr > endDate) return;

      // Employee match
      const emp = employees.find(e => e.id === empId);
      if (!emp) return;

      // Filter by selected employees
      if (selectedProjectEmployees.length > 0 && !selectedProjectEmployees.includes(emp.id)) return;

      // Find project from entries on that date
      const dayEntries = entries.filter(ent => {
        const matchEmp = ent.employeeId ? ent.employeeId === empId : ent.employeeName.toLowerCase().trim() === emp.employeeName.toLowerCase().trim();
        return matchEmp && ent.date === dateStr;
      });

      const matchedProject = dayEntries.length > 0 ? (dayEntries[0].project || 'Unspecified').trim() : 'Unspecified';

      // Project filter
      if (selectedProjectList.length > 0 && !selectedProjectList.includes(matchedProject)) return;

      const supp = supplements[key];
      const perdiemVal = Number(supp.perdiem || 0);
      if (perdiemVal > 0) {
        if (!summary[matchedProject]) {
          summary[matchedProject] = {
            project: matchedProject,
            normalWage: 0,
            otWage: 0,
            combinedWageOt: 0,
            perdiem: 0,
            grandTotal: 0
          };
        }
        summary[matchedProject].perdiem += perdiemVal;
      }
    });

    // Compute grand totals
    return Object.values(summary).map(item => {
      return {
        ...item,
        grandTotal: item.combinedWageOt + item.perdiem
      };
    });
  }, [entries, employees, startDate, endDate, selectedProjectEmployees, selectedProjectList, supplements, settings]);

  const projectTotals = useMemo(() => {
    const totalNormal = projectSummaryData.reduce((sum, item) => sum + item.normalWage, 0);
    const totalOT = projectSummaryData.reduce((sum, item) => sum + item.otWage, 0);
    const totalCombined = projectSummaryData.reduce((sum, item) => sum + item.combinedWageOt, 0);
    const totalPerdiem = projectSummaryData.reduce((sum, item) => sum + item.perdiem, 0);
    const totalGrand = projectSummaryData.reduce((sum, item) => sum + item.grandTotal, 0);
    return { totalNormal, totalOT, totalCombined, totalPerdiem, totalGrand };
  }, [projectSummaryData]);

  const projectPieData = useMemo(() => {
    if (projectSummaryData.length === 0) return [];
    const sorted = [...projectSummaryData].sort((a, b) => b.grandTotal - a.grandTotal);
    if (sorted.length <= 8) {
      return sorted.map(item => ({
        name: item.project || 'Unspecified',
        value: Math.round(item.grandTotal)
      }));
    }
    const top7 = sorted.slice(0, 7);
    const rest = sorted.slice(7);
    const restTotal = rest.reduce((sum, item) => sum + item.grandTotal, 0);
    return [
      ...top7.map(item => ({
        name: item.project || 'Unspecified',
        value: Math.round(item.grandTotal)
      })),
      {
        name: 'อื่นๆ (Others)',
        value: Math.round(restTotal)
      }
    ];
  }, [projectSummaryData]);

  const exportProjectSummaryCSV = () => {
    const headers = [
      'โครงการ (Project / Row Labels)',
      'ค่าแรงทำงานวันปกติ (บาท) (Normal Wage)',
      'รวมโอที (บาท) (Total OT)',
      'รวมค่าแรง + โอที (บาท) (Wage + OT)',
      'Perdiem (บาท)',
      'รวมค่าแรง + โอที + สวัสดิการ (บาท) (Grand Total)'
    ];

    const rows = projectSummaryData.map(item => [
      item.project,
      item.normalWage.toFixed(2),
      item.otWage.toFixed(2),
      item.combinedWageOt.toFixed(2),
      item.perdiem.toFixed(2),
      item.grandTotal.toFixed(2)
    ]);

    // Sum of everything
    const totalNormal = projectSummaryData.reduce((sum, item) => sum + item.normalWage, 0);
    const totalOT = projectSummaryData.reduce((sum, item) => sum + item.otWage, 0);
    const totalCombined = projectSummaryData.reduce((sum, item) => sum + item.combinedWageOt, 0);
    const totalPerdiem = projectSummaryData.reduce((sum, item) => sum + item.perdiem, 0);
    const totalGrand = projectSummaryData.reduce((sum, item) => sum + item.grandTotal, 0);

    const totalsRow = [
      'Grand Total',
      totalNormal.toFixed(2),
      totalOT.toFixed(2),
      totalCombined.toFixed(2),
      totalPerdiem.toFixed(2),
      totalGrand.toFixed(2)
    ];

    const csvContent = "\uFEFF" + [
      `รายงานสรุปผลจ่ายแยกตามโครงการ (Project Cost and Compensation Summary Report)`,
      `ช่วงเวลา: ${startDate} ถึง ${endDate}`,
      headers.join(','),
      ...rows.map(r => r.join(',')),
      totalsRow.join(',')
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Project_Summary_Report_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Change specific cells on grid
  const handleDraftChange = (rowId: string, field: keyof TimesheetEntry, value: any) => {
    setDraftEntries(prev => {
      const target = prev[rowId] || { id: rowId, employeeName: selectedEmpName };
      const updated = { ...target, [field]: value };
      const dateStr = updated.date || rowId;

      // Make dynamic calculation of OT and normal hours instantly if working times or lunch flags change
      if (updated.timeIn && updated.timeOut) {
        const cal = calculateEntryOT(
          dateStr,
          updated.timeIn,
          updated.timeOut,
          Number(updated.lunchDeduct ?? 1),
          Number(updated.lunchOT ?? 0),
          activeEmployee?.isFlatRate || false,
          holidays,
          updated.project || projectInput || '',
          activeEmployee?.workScheduleType,
          activeEmployee?.position,
          updated.customerHolidayFlag
        );
        updated.normalHours = cal.normalHours;
        updated.ot15Hours = cal.ot15Hours;
        updated.ot20Hours = cal.ot20Hours;
        updated.ot30Hours = cal.ot30Hours;
      } else {
        updated.normalHours = 0;
        updated.ot15Hours = 0;
        updated.ot20Hours = 0;
        updated.ot30Hours = 0;
      }

      return { ...prev, [rowId]: updated };
    });
  };

  // Change supplementary values (Perdiem, Advance, Job Bonus, RemarkOverride)
  const handleSupplementChange = (suppKeyOrDate: string, field: keyof SupplementData, value: any) => {
    const key = suppKeyOrDate.includes('_') ? suppKeyOrDate : `${employeeCodeInput}_${suppKeyOrDate}`;
    setSupplements(prev => {
      const existing = prev[key] || { perdiem: 0, advance: 0, jobBonus: 0, confineSpace: 0, incentive: 0, remarkOverride: '' };
      return {
        ...prev,
        [key]: { ...existing, [field]: value }
      };
    });
  };

  // Helper to click standard working hours shift (08:00 - 17:00, lunch deduct active)
  const handlePresetStandardShift = (rowId: string) => {
    handleDraftChange(rowId, 'timeIn', '08:00');
    handleDraftChange(rowId, 'timeOut', '17:00');
    handleDraftChange(rowId, 'lunchDeduct', 1);
    handleDraftChange(rowId, 'lunchOT', 0);
  };

  // Helper to add separate secondary job/shift row for a date
  const handleAddJobRow = (dStr: string) => {
    const newId = `split-draft-${dStr}-${Date.now()}`;
    setDraftEntries(prev => {
      return {
        ...prev,
        [newId]: {
          id: newId,
          employeeName: selectedEmpName,
          date: dStr,
          project: projectInput || '',
          timeIn: '',
          timeOut: '',
          lunchDeduct: 1,
          lunchOT: 0,
          flatRate: activeEmployee?.isFlatRate || false,
          normalHours: 0,
          ot15Hours: 0,
          ot20Hours: 0,
          ot30Hours: 0,
          remark: '',
          status: 'Pending'
        }
      };
    });
  };

  // Helper to remove any extra job row
  const handleRemoveJobRow = async (rowId: string) => {
    if (!rowId.startsWith('draft-') && !rowId.startsWith('split-draft-')) {
      if (confirm('คุณต้องการลบรายงานตัวนี้ออกจากระบบถาวรใช่หรือไม่?')) {
        await onDeleteEntry(rowId);
      } else {
        return;
      }
    }
    
    setDraftEntries(prev => {
      const updated = { ...prev };
      delete updated[rowId];
      return updated;
    });
  };

  // Bulk save current changes to Supabase
  const handleSyncToSupabase = async () => {
    if (!selectedEmpName) return;
    setIsSaving(true);
    setSaveStatus({ type: null, message: '' });

    try {
      let savedCount = 0;
      const draftList = Object.values(draftEntries) as Partial<TimesheetEntry>[];

      for (const draft of draftList) {
        if (!draft || !draft.date) continue;
        const dStr = draft.date;

        // Skip saving completely blank columns unless the entry already existed in database
        const hasTimeReg = draft.timeIn && draft.timeOut;
        const isDraftPlaceholder = draft.id?.startsWith('draft-') || draft.id?.startsWith('split-draft-');

        if (hasTimeReg) {
          if (!isDraftPlaceholder) {
            // Find existing original entry
            const original = filteredEntries.find(e => e.id === draft.id);
            if (original && (
              original.timeIn !== draft.timeIn ||
              original.timeOut !== draft.timeOut ||
              original.lunchDeduct !== draft.lunchDeduct ||
              original.lunchOT !== draft.lunchOT ||
              original.project !== draft.project ||
              original.remark !== draft.remark
            )) {
              await onUpdateEntry(original.id, {
                timeIn: draft.timeIn,
                timeOut: draft.timeOut,
                project: draft.project,
                lunchDeduct: draft.lunchDeduct,
                lunchOT: draft.lunchOT,
                normalHours: draft.normalHours,
                ot15Hours: draft.ot15Hours,
                ot20Hours: draft.ot20Hours,
                ot30Hours: draft.ot30Hours,
                remark: draft.remark
              });
              savedCount++;
            }
          } else {
            // Add new TimesheetEntry
            const newEntry: TimesheetEntry = {
              id: `ID-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
              employeeName: selectedEmpName,
              date: dStr,
              project: draft.project || projectInput || '',
              timeIn: draft.timeIn || '08:00',
              timeOut: draft.timeOut || '17:00',
              lunchDeduct: Number(draft.lunchDeduct ?? 1),
              lunchOT: Number(draft.lunchOT ?? 0),
              flatRate: activeEmployee?.isFlatRate || false,
              normalHours: draft.normalHours || 0,
              ot15Hours: draft.ot15Hours || 0,
              ot20Hours: draft.ot20Hours || 0,
              ot30Hours: draft.ot30Hours || 0,
              remark: draft.remark || '',
              status: 'Approved',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            await onAddEntry(newEntry);
            savedCount++;
          }
        } else if (!isDraftPlaceholder) {
          // If hours were completely wiped out, remove entry
          await onDeleteEntry(draft.id!);
          savedCount++;
        }
      }

      // Automatically save supplements as well during bulk sync!
      const supplementPayloads: any[] = [];
      const empId = employeeCodeInput || activeEmployee?.id || '';
      if (empId && activeEmployee) {
        Object.entries(supplements).forEach(([key, val]) => {
          const supp = val as SupplementData;
          const parts = key.split('_');
          if (parts[0] === empId && parts[1] && renderedDates.includes(parts[1])) {
            supplementPayloads.push({
              ID: key,
              EmployeeID: empId,
              EmployeeName: activeEmployee.employeeName,
              Date: parts[1],
              Perdiem: Number(supp.perdiem || 0),
              Advance: Number(supp.advance || 0),
              JobBonus: Number(supp.jobBonus || 0),
              ConfineSpace: Number(supp.confineSpace || 0),
              Incentive: Number(supp.incentive || 0),
              Remark: supp.remarkOverride || ''
            });
          }
        });
        if (supplementPayloads.length > 0) {
          await dbSaveSupplements(supplementPayloads);
        }
      }

      setSaveStatus({
        type: 'success',
        message: `✓ บันทึกรายละเอียดการทำงานและค่าเบี้ยเลี้ยงรวม ${savedCount} รายการ ลง Supabase เรียบร้อยแล้ว!`
      });
    } catch (err: any) {
      const errMsg = err?.message || '';
      const isTableError = errMsg.includes('Invalid path') || 
                           errMsg.toLowerCase().includes('not found') || 
                           errMsg.toLowerCase().includes('does not exist') || 
                           errMsg.includes('42P01') || 
                           errMsg.includes('42703') || 
                           errMsg.toLowerCase().includes('confinespace') || 
                           errMsg.toLowerCase().includes('incentive') || 
                           errMsg.includes('PGRST');
      
      if (isTableError) {
        setShowSqlHelper(true);
        setSaveStatus({
          type: 'error',
          message: `⚠️ ไม่สำเร็จ: ตาราง 'IndividualSupplements' ยังไม่ได้สร้างหรือยังไม่ได้อัปเดตคอลัมน์ใหม่บน Supabase (ข้อมูลถูกบันทึกในคอมพิวเตอร์แบบออฟไลน์แล้ว!) กรุณาใช้โค้ด SQL ด้านล่างเพื่ออัปเกรดตาราง`
        });
      } else {
        setSaveStatus({
          type: 'error',
          message: `❌ เกิดข้อผิดพลาดขณะส่งบันทึก: ${errMsg || 'โปรดตรวจสอบสิทธิ์การเชื่อมต่อ'}`
        });
      }
    } finally {
      setIsSaving(false);
      setTimeout(() => {
        setSaveStatus({ type: null, message: '' });
      }, 5000);
    }
  };

  // Dedicated save for Supplements (Perdiem, Advance, Job Bonus, Remark)
  const handleSaveSupplementsToSupabase = async () => {
    if (!activeEmployee) {
      setSaveStatus({ type: 'error', message: '❌ กรุณาเลือกพนักงานเพื่อบันทึกข้อมูลค่าเบี้ยเลี้ยง / เงินเบิก' });
      return;
    }
    const empId = employeeCodeInput || activeEmployee.id || '';
    if (!empId) {
      setSaveStatus({ type: 'error', message: '❌ ไม่พบรหัสพนักงาน สำหรับการอ้างอิงข้อมูลเบี้ยเลี้ยง' });
      return;
    }

    setIsSavingSupplements(true);
    setSaveStatus({ type: null, message: '' });

    try {
      const payloads: any[] = [];
      Object.entries(supplements).forEach(([key, val]) => {
        const supp = val as SupplementData;
        const parts = key.split('_');
        if (parts[0] === empId && parts[1] && renderedDates.includes(parts[1])) {
          payloads.push({
            ID: key,
            EmployeeID: empId,
            EmployeeName: activeEmployee.employeeName,
            Date: parts[1],
            Perdiem: Number(supp.perdiem || 0),
            Advance: Number(supp.advance || 0),
            JobBonus: Number(supp.jobBonus || 0),
            ConfineSpace: Number(supp.confineSpace || 0),
            Incentive: Number(supp.incentive || 0),
            Remark: supp.remarkOverride || ''
          });
        }
      });

      if (payloads.length === 0) {
        setSaveStatus({
          type: 'success',
          message: 'ℹ️ ไม่มีข้อมูลค่าเบี้ยเลี้ยงหรือเงินเบิกสะสมที่จะบันทึก'
        });
        setIsSavingSupplements(false);
        return;
      }

      await dbSaveSupplements(payloads);

      setSaveStatus({
        type: 'success',
        message: `✓ บันทึกเฉพาะค่าเบี้ยเลี้ยง เงินเบิกสะสม และโบนัสงานสำหรับคุณ ${activeEmployee.employeeName} รวม ${payloads.length} วัน ลง Supabase สำเร็จ!`
      });
    } catch (err: any) {
      const errMsg = err?.message || '';
      const isTableError = errMsg.includes('Invalid path') || 
                           errMsg.toLowerCase().includes('not found') || 
                           errMsg.toLowerCase().includes('does not exist') || 
                           errMsg.includes('42P01') || 
                           errMsg.includes('42703') || 
                           errMsg.toLowerCase().includes('confinespace') || 
                           errMsg.toLowerCase().includes('incentive') || 
                           errMsg.includes('PGRST');
      
      if (isTableError) {
        setShowSqlHelper(true);
        setSaveStatus({
          type: 'error',
          message: `⚠️ ไม่สำเร็จ: ตาราง 'IndividualSupplements' ยังไม่ได้สร้างหรือยังไม่ได้อัปเดตคอลัมน์ใหม่บน Supabase (ข้อมูลถูกบันทึกในคอมพิวเตอร์ของคุณแล้ว) ดูวิธีแก้ด้วยตาราง SQL ด้านล่าง`
        });
      } else {
        setSaveStatus({
          type: 'error',
          message: `❌ เกิดข้อผิดพลาดขณะบันทึกข้อมูลการเงิน: ${errMsg || 'สิทธิ์เข้าถึงฐานข้อมูลถูกปฏิเสธ'}`
        });
      }
    } finally {
      setIsSavingSupplements(false);
      setTimeout(() => {
        setSaveStatus({ type: null, message: '' });
      }, 5000);
    }
  };

  // List of all displayed rows in the spreadsheet tables
  const tableRows = useMemo(() => {
    const list: { draft: any; rowId: string; dStr: string; suppKey: string; isMulti: boolean }[] = [];
    renderedDates.forEach(dStr => {
      const dayDrafts = (Object.values(draftEntries) as Partial<TimesheetEntry>[])
        .filter(e => e.date === dStr)
        .sort((a, b) => (a.timeIn || '08:00').localeCompare(b.timeIn || '08:00'));

      if (dayDrafts.length === 0) {
        list.push({
          draft: {
            id: `draft-${dStr}`,
            employeeName: selectedEmpName,
            date: dStr,
            project: projectInput || '',
            timeIn: '',
            timeOut: '',
            lunchDeduct: 1,
            lunchOT: 0,
            flatRate: activeEmployee?.isFlatRate || false,
            normalHours: 0,
            ot15Hours: 0,
            ot20Hours: 0,
            ot30Hours: 0,
            remark: '',
            status: 'Pending'
          },
          rowId: `draft-${dStr}`,
          dStr,
          suppKey: `${employeeCodeInput}_${dStr}_draft-${dStr}`,
          isMulti: false
        });
      } else {
        const isMulti = dayDrafts.length > 1;
        dayDrafts.forEach((draft, idx) => {
          const rowId = draft.id ? (isMulti ? `${draft.id}_${idx}` : draft.id) : `${dStr}_${idx}`;
          const suppKey = `${employeeCodeInput}_${dStr}_${rowId}`;
          list.push({
            draft,
            rowId,
            dStr,
            suppKey,
            isMulti
          });
        });
      }
    });
    return list;
  }, [renderedDates, draftEntries, employeeCodeInput, projectInput, activeEmployee, selectedEmpName]);

  // Summary Metrics matching under-table blocks on the image
  const computedSheetStats = useMemo(() => {
    let daysOnDuty = 0;
    let hoursOnDuty = 0;
    let daysWorkedVal = 0;
    let hoursWorkedVal = 0;
    let leavesCount = 0;

    let ot15Sum = 0;
    let ot20Sum = 0;
    let ot30Sum = 0;

    let perdiemSum = 0;
    let advanceSum = 0;
    let jobBonusSum = 0;

    const workedDates = new Set<string>();

    tableRows.forEach(row => {
      const { draft, dStr } = row;
      const hasWork = draft && draft.timeIn && draft.timeOut;

      if (hasWork) {
        workedDates.add(dStr);
        hoursWorkedVal += (draft.normalHours || 0) + (draft.ot15Hours || 0) + (draft.ot20Hours || 0) + (draft.ot30Hours || 0);
        
        ot15Sum += draft.ot15Hours || 0;
        ot20Sum += draft.ot20Hours || 0;
        ot30Sum += draft.ot30Hours || 0;
      }

      const supp = supplements[row.suppKey] || supplements[`${employeeCodeInput}_${row.dStr}`];
      if (supp) {
        perdiemSum += Number(supp.perdiem || 0);
        advanceSum += Number(supp.advance || 0);
        jobBonusSum += Number(supp.jobBonus || 0);
      }
    });

    renderedDates.forEach(dStr => {
      const isSatOrSun = new Date(dStr).getDay() === 0 || new Date(dStr).getDay() === 6;
      const dayRows = tableRows.filter(r => r.dStr === dStr);
      const hasWorkOnDay = dayRows.some(r => r.draft && r.draft.timeIn && r.draft.timeOut);
      
      const hasLeaveRemark = dayRows.some(r => {
        const suppObj = supplements[r.suppKey] || supplements[`${employeeCodeInput}_${r.dStr}`];
        const lowerRemark = ((r.draft?.remark || '') + ' ' + (suppObj?.remarkOverride || '')).toLowerCase();
        return lowerRemark.includes('leave') || lowerRemark.includes('ลา') || lowerRemark.includes('annual');
      });

      if (hasLeaveRemark) {
        leavesCount++;
      } else if (isSatOrSun && !hasWorkOnDay) {
        leavesCount++;
      }
    });

    daysWorkedVal = workedDates.size;
    const isStaff = activeEmployee?.workScheduleType === 'staff' || activeEmployee?.workScheduleType === 'monthly_worker';
    const ot20RateActual = isStaff ? 1.0 : (settings?.ot20Rate || 2.0);
    const otValueTotal = (ot15Sum * 1.5 + ot20Sum * ot20RateActual + ot30Sum * 3.0) * hourlyRate;

    const empId = activeEmployee?.id || employeeCodeInput || '';
    const leaveKey = `${empId}_${selectedYear}_${selectedMonth}`;
    const manualVal = manualLeaveDays[leaveKey];
    const finalLeaves = (manualVal !== undefined && manualVal !== '') ? Number(manualVal) : leavesCount;

    return {
      daysInPeriod: renderedDates.length,
      daysWorked: daysWorkedVal,
      hoursWorked: Number(hoursWorkedVal.toFixed(2)),
      daysOnDuty: '—',
      hoursOnDuty: '—',
      totalDayOffOrLeaves: finalLeaves,
      otValueTotal: Number(otValueTotal.toFixed(2)),
      ot15Sum,
      ot20Sum,
      ot30Sum,
      perdiemSum,
      advanceSum,
      jobBonusSum
    };
  }, [renderedDates, tableRows, supplements, hourlyRate, manualLeaveDays, activeEmployee, employeeCodeInput, selectedYear, selectedMonth]);

  // Compute Daily Wages breakdown statistics
  const computedWagesStats = useMemo(() => {
    let grandNormalPay = 0;
    let grandOtPay = 0;
    let grandCombinedWageOt = 0;
    let grandConfineSpace = 0;
    let grandIncentive = 0;
    let grandPerdiem = 0;
    let grandWelfareTotal = 0;

    const isStaff = activeEmployee?.workScheduleType === 'staff' || activeEmployee?.workScheduleType === 'monthly_worker';

    tableRows.forEach(row => {
      const { draft, suppKey } = row;
      const supp = supplements[suppKey] || supplements[`${employeeCodeInput}_${row.dStr}`] || { perdiem: undefined, advance: 0, jobBonus: 0, confineSpace: 0, incentive: 0, remarkOverride: '' };

      const normHrs = draft.normalHours || 0;
      const itemOt15 = draft.ot15Hours || 0;
      const itemOt20 = draft.ot20Hours || 0;
      const itemOt30 = draft.ot30Hours || 0;

      // Day-specific rate determination
      let localDayRate = activeEmployee?.workshopRate || 0;
      const proj = (draft.project || '').toLowerCase().trim();
      const isOffshore = proj.includes('offshore');
      const isWfh = proj.includes('wfh') || proj.includes('home');
      const isWorkshop = proj.includes('workshop');
      const isOnsite = proj.includes('onsite') || (proj !== '' && !isWorkshop && !isOffshore && !isWfh);

      if (isOnsite) {
        localDayRate = activeEmployee?.onsiteRate || 0;
      } else if (isOffshore) {
        localDayRate = activeEmployee?.offshoreRate || 0;
      } else if (isWfh) {
        localDayRate = activeEmployee?.wfhRate || 0;
      }

      const localHourlyRate = isStaff ? hourlyRate : Number((localDayRate / (settings.defaultWorkHours || 8)).toFixed(2));

      const ot20RateActual = isStaff ? 1.0 : (settings?.ot20Rate || 2.0);
      const normalPay = normHrs * localHourlyRate;
      const otPay = isOffshore ? 0 : (itemOt15 * 1.5 + itemOt20 * ot20RateActual + itemOt30 * 3.0) * localHourlyRate;
      const combinedWageOt = normalPay + otPay;

      const confineVal = Number(supp.confineSpace || 0);
      const incentiveVal = Number(supp.incentive || 0);
      
      const perdiemVal = Number(supp.perdiem || 0);
      const welfareTotal = combinedWageOt + confineVal + incentiveVal + perdiemVal;

      grandNormalPay += normalPay;
      grandOtPay += otPay;
      grandCombinedWageOt += combinedWageOt;
      grandConfineSpace += confineVal;
      grandIncentive += incentiveVal;
      grandPerdiem += perdiemVal;
      grandWelfareTotal += welfareTotal;
    });

    return {
      grandNormalPay,
      grandOtPay,
      grandCombinedWageOt,
      grandConfineSpace,
      grandIncentive,
      grandPerdiem,
      grandWelfareTotal
    };
  }, [tableRows, supplements, hourlyRate, activeEmployee, settings]);

  // Helper to resolve timesheet entries for any employee
  const getEmployeeEntryForDate = (empName: string, dStr: string) => {
    if (empName.toLowerCase().trim() === selectedEmpName.toLowerCase().trim()) {
      const draft = (Object.values(draftEntries) as Partial<TimesheetEntry>[]).find(e => e.date === dStr);
      if (draft) return draft;
    }
    
    const dayEntries = entries.filter(e => {
      return e.employeeName.toLowerCase().trim() === empName.toLowerCase().trim() && e.date === dStr;
    });
    
    if (dayEntries.length > 0) {
      if (dayEntries.length === 1) return dayEntries[0];
      return {
        id: `agg-${empName}-${dStr}`,
        employeeName: empName,
        date: dStr,
        project: Array.from(new Set(dayEntries.map(e => e.project).filter(Boolean))).join(', '),
        timeIn: dayEntries.map(e => `${e.timeIn || '08:00'}-${e.timeOut || '17:00'}`).join(', '),
        timeOut: '',
        lunchDeduct: dayEntries[0].lunchDeduct,
        lunchOT: dayEntries[0].lunchOT,
        flatRate: false,
        normalHours: dayEntries.reduce((sum, e) => sum + (e.normalHours || 0), 0),
        ot15Hours: dayEntries.reduce((sum, e) => sum + (e.ot15Hours || 0), 0),
        ot20Hours: dayEntries.reduce((sum, e) => sum + (e.ot20Hours || 0), 0),
        ot30Hours: dayEntries.reduce((sum, e) => sum + (e.ot30Hours || 0), 0),
        remark: Array.from(new Set(dayEntries.map(e => e.remark).filter(Boolean))).join('; '),
        status: dayEntries.some(e => e.status === 'Pending') ? 'Pending' : 'Approved'
      };
    }
    
    return {
      id: `temp-${empName}-${dStr}`,
      employeeName: empName,
      date: dStr,
      project: projectInput || '',
      timeIn: '',
      timeOut: '',
      lunchDeduct: 1,
      lunchOT: 0,
      flatRate: false,
      normalHours: 0,
      ot15Hours: 0,
      ot20Hours: 0,
      ot30Hours: 0,
      remark: '',
      status: 'Pending'
    };
  };

  // Helper to resolve hourly rate for any employee
  const getEmployeeHourlyRate = (emp: Employee) => {
    const workHours = settings.defaultWorkHours || 8;
    if (emp.workScheduleType === 'staff' || emp.workScheduleType === 'monthly_worker') {
      const salary = emp.staffSalary || emp.officeSalary || 0;
      return Number((salary / 30 / workHours).toFixed(2));
    } else {
      const dayWage = emp.workshopRate || settings.defaultDailyWage || 700;
      return Number((dayWage / workHours).toFixed(2));
    }
  };

  // Helper to resolve monthly timesheet stats for any employee
  const getEmployeeSheetStats = (emp: Employee, empHourlyRate: number) => {
    let daysInPeriodVal = renderedDates.length;
    let daysWorkedVal = 0;
    let hoursWorkedVal = 0;
    let leavesCount = 0;

    let ot15Sum = 0;
    let ot20Sum = 0;
    let ot30Sum = 0;

    let perdiemSum = 0;
    let advanceSum = 0;
    let jobBonusSum = 0;

    renderedDates.forEach(dStr => {
      // Find all entries for this date
      const dayDrafts = ((emp.employeeName.toLowerCase().trim() === selectedEmpName.toLowerCase().trim()
        ? Object.values(draftEntries)
        : entries
      ) as Partial<TimesheetEntry>[]).filter(e => {
        if (!e) return false;
        const matchEmp = e.employeeId ? e.employeeId === emp.id : (e.employeeName && e.employeeName.toLowerCase().trim() === emp.employeeName.toLowerCase().trim());
        return matchEmp && e.date === dStr;
      });

      const hasWork = dayDrafts.some(draft => draft.timeIn && draft.timeOut);
      const isSatOrSun = new Date(dStr).getDay() === 0 || new Date(dStr).getDay() === 6;

      if (hasWork) {
        daysWorkedVal++;
        dayDrafts.forEach(draft => {
          if (draft.timeIn && draft.timeOut) {
            hoursWorkedVal += (draft.normalHours || 0) + (draft.ot15Hours || 0) + (draft.ot20Hours || 0) + (draft.ot30Hours || 0);
            ot15Sum += draft.ot15Hours || 0;
            ot20Sum += draft.ot20Hours || 0;
            ot30Sum += draft.ot30Hours || 0;
          }
        });
      }

      // Sum supplements for all drafts of this day or fallback to the general day supplement key
      if (dayDrafts.length === 0) {
        const rowKey = `${emp.id}_${dStr}_draft-${dStr}`;
        const supp = supplements[rowKey] || supplements[`${emp.id}_${dStr}`];
        if (supp) {
          perdiemSum += Number(supp.perdiem || 0);
          advanceSum += Number(supp.advance || 0);
          jobBonusSum += Number(supp.jobBonus || 0);
        }
      } else {
        dayDrafts.forEach(draft => {
          const rowKey = draft.id ? `${emp.id}_${dStr}_${draft.id}` : `${emp.id}_${dStr}`;
          const supp = supplements[rowKey] || supplements[`${emp.id}_${dStr}`];
          if (supp) {
            perdiemSum += Number(supp.perdiem || 0);
            advanceSum += Number(supp.advance || 0);
            jobBonusSum += Number(supp.jobBonus || 0);
          }
        });
      }

      // Check leave on first entry or override
      const firstDraft = dayDrafts[0];
      const rowKey = firstDraft && firstDraft.id ? `${emp.id}_${dStr}_${firstDraft.id}` : `${emp.id}_${dStr}`;
      const supp = supplements[rowKey] || supplements[`${emp.id}_${dStr}`];
      const lowerRemark = (((firstDraft?.remark || '') + ' ' + (supp?.remarkOverride || '')).toLowerCase());
      if (lowerRemark.includes('leave') || lowerRemark.includes('ลา') || lowerRemark.includes('annual')) {
        leavesCount++;
      } else if (isSatOrSun && !hasWork) {
        leavesCount++;
      }
    });

    const otValueTotal = (ot15Sum * 1.5 + ot20Sum * 2.0 + ot30Sum * 3.0) * empHourlyRate;

    const empId = emp.id;
    const leaveKey = `${empId}_${selectedYear}_${selectedMonth}`;
    const manualVal = manualLeaveDays[leaveKey];
    const finalLeaves = (manualVal !== undefined && manualVal !== '') ? Number(manualVal) : leavesCount;

    return {
      daysInPeriod: daysInPeriodVal,
      daysWorked: daysWorkedVal,
      hoursWorked: Number(hoursWorkedVal.toFixed(2)),
      daysOnDuty: '—',
      hoursOnDuty: '—',
      totalDayOffOrLeaves: finalLeaves,
      otValueTotal: Number(otValueTotal.toFixed(2)),
      ot15Sum,
      ot20Sum,
      ot30Sum,
      perdiemSum,
      advanceSum,
      jobBonusSum
    };
  };

  const startBatchPrint = () => {
    setIsBatchPrinting(true);
    setTimeout(() => {
      window.print();
      setIsBatchPrinting(false);
    }, 250);
  };

  // Export Specific Employee Month details to CSV
  const exportEmpCSV = () => {
    if (!activeEmployee) return;

    const headers = [
      'Day',
      'Date',
      'Start Time',
      'End Time',
      'Lunch OT',
      'Normal Hrs',
      'OT 1.5 (hrs)',
      'OT 2.0 (hrs)',
      'OT 3.0 (hrs)',
      'OT Value (THB)',
      'Perdiem Expenses',
      'Confine / Other (THB)',
      'Incentive (THB)',
      'Remark'
    ];

    const rows = tableRows.map(row => {
      const { draft, suppKey, dStr } = row;
      const supp = supplements[suppKey] || supplements[`${employeeCodeInput}_${dStr}`] || { perdiem: 0, advance: 0, jobBonus: 0, remarkOverride: '' };
      
      const dayName = new Date(dStr).toLocaleDateString('en-US', { weekday: 'long' });
      const dayNum = formatThaiDate(dStr);

      const itemOt15 = draft.ot15Hours || 0;
      const itemOt20 = draft.ot20Hours || 0;
      const itemOt30 = draft.ot30Hours || 0;
      const isStaff = activeEmployee?.workScheduleType === 'staff' || activeEmployee?.workScheduleType === 'monthly_worker';
      const ot20RateActual = isStaff ? 1.0 : (settings?.ot20Rate || 2.0);
      const otValueVal = (itemOt15 * 1.5 + itemOt20 * ot20RateActual + itemOt30 * 3.0) * hourlyRate;

      // Find public holiday
      const holidayCheck = holidays.find(h => h.holidayDate === dStr);
      let projectText = draft.project || '';
      if (projectText.toLowerCase() === 'workshop') {
        projectText = '';
      }
      if (!(draft.timeIn && draft.timeOut)) {
        projectText = '';
      }
      const remarkText = supp.remarkOverride || projectText || draft.remark || (holidayCheck ? holidayCheck.holidayName : '');

      return [
        dayName,
        dayNum,
        draft.timeIn || '',
        draft.timeOut || '',
        draft.lunchOT || 0,
        draft.normalHours || 0,
        itemOt15,
        itemOt20,
        itemOt30,
        otValueVal.toFixed(2),
        supp.perdiem || 0,
        supp.advance || 0,
        supp.jobBonus || 0,
        `"${remarkText}"`
      ];
    });

    const csvContent = "\uFEFF" + [
      `IKM TESTING (THAILAND) CO. LTD. - TIME SHEET`,
      `Employee Code: ${employeeCodeInput}, Employee Name: ${activeEmployee.employeeName}`,
      `Position: ${positionInput}, Location: ${locationInput}`,
      `Cutoff: ${startDate} to ${endDate}`,
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    link.setAttribute('href', url);
    link.setAttribute('download', `Timesheet_Report_${employeeCodeInput}_${activeEmployee.employeeName}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export Specific Employee Month Wages Breakdown to CSV
  const exportWagesCSV = () => {
    if (!activeEmployee) return;

    const headers = [
      'Day/วัน',
      'Date/วันที่',
      'Normal Wage (THB)/ค่าแรงปกติ',
      'Total OT (THB)/รวมโอที',
      'Wages + OT (THB)/รวมค่าแรง + โอที',
      'Confine Space (THB)',
      'Incentive (THB)',
      'Perdiem (THB)',
      'Total Earnings (THB)/รวมรายรับทั้งหมด',
      'Remark/หมายเหตุ'
    ];

    const rows = tableRows.map(row => {
      const { draft, suppKey, dStr } = row;
      const supp = supplements[suppKey] || supplements[`${employeeCodeInput}_${dStr}`] || { perdiem: 0, advance: 0, jobBonus: 0, confineSpace: 0, incentive: 0, remarkOverride: '' };
      
      const dayName = new Date(dStr).toLocaleDateString('en-US', { weekday: 'long' });
      const dayNum = formatThaiDate(dStr);

      const normHrs = draft.normalHours || 0;
      const itemOt15 = draft.ot15Hours || 0;
      const itemOt20 = draft.ot20Hours || 0;
      const itemOt30 = draft.ot30Hours || 0;

      // Day-specific rate determination
      let localDayRate = activeEmployee?.workshopRate || 0;
      const proj = (draft.project || '').toLowerCase().trim();
      const isOffshore = proj.includes('offshore');
      const isWfh = proj.includes('wfh') || proj.includes('home');
      const isWorkshop = proj.includes('workshop');
      const isOnsite = proj.includes('onsite') || (proj !== '' && !isWorkshop && !isOffshore && !isWfh);

      if (isOnsite) {
        localDayRate = activeEmployee?.onsiteRate || 0;
      } else if (isOffshore) {
        localDayRate = activeEmployee?.offshoreRate || 0;
      } else if (isWfh) {
        localDayRate = activeEmployee?.wfhRate || 0;
      }

      const isStaff = activeEmployee?.workScheduleType === 'staff' || activeEmployee?.workScheduleType === 'monthly_worker';
      const localHourlyRate = isStaff ? hourlyRate : Number((localDayRate / (settings.defaultWorkHours || 8)).toFixed(2));

      const ot20RateActual = isStaff ? 1.0 : (settings?.ot20Rate || 2.0);
      const normalPay = normHrs * localHourlyRate;
      const otPay = isOffshore ? 0 : (itemOt15 * 1.5 + itemOt20 * ot20RateActual + itemOt30 * 3.0) * localHourlyRate;
      const combinedWageOt = normalPay + otPay;

      const confineVal = Number(supp.confineSpace || 0);
      const incentiveVal = Number(supp.incentive || 0);
      const perdiemVal = Number(supp.perdiem || 0);

      const welfareTotal = combinedWageOt + confineVal + incentiveVal + perdiemVal;

      // Find public holiday
      const holidayCheck = holidays.find(h => h.holidayDate === dStr);
      let projectText = draft.project || '';
      if (projectText.toLowerCase() === 'workshop') {
        projectText = '';
      }
      if (!(draft.timeIn && draft.timeOut)) {
        projectText = '';
      }
      const remarkText = supp.remarkOverride || projectText || draft.remark || (holidayCheck ? holidayCheck.holidayName : '');

      return [
        dayName,
        dayNum,
        normalPay.toFixed(2),
        otPay.toFixed(2),
        combinedWageOt.toFixed(2),
        confineVal.toFixed(2),
        incentiveVal.toFixed(2),
        perdiemVal.toFixed(2),
        welfareTotal.toFixed(2),
        `"${remarkText}"`
      ];
    });

    const csvContent = "\uFEFF" + [
      `IKM TESTING (THAILAND) CO. LTD. - DAILY EARNINGS BREAKDOWN`,
      `Employee Code: ${employeeCodeInput}, Employee Name: ${activeEmployee.employeeName}`,
      `Position: ${positionInput}, Daily Rate Basis: ${(hourlyRate * (settings.defaultWorkHours || 8)).toFixed(2)} (Hourly: ${hourlyRate})`,
      `Cutoff Period: ${startDate} to ${endDate}`,
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    link.setAttribute('href', url);
    link.setAttribute('download', `Daily_Earnings_${employeeCodeInput}_${activeEmployee.employeeName}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export ENTIRE MASTER SUMMARY REPORT to CSV
  const exportMasterCSV = () => {
    const headers = [
      'รหัสพนักงาน',
      'ชื่อพนักงาน',
      'ตำแหน่ง',
      'ประเภทพนักงาน',
      'วันเข้าปฏิบัติงานจริง',
      'ชั่วโมงทำงานปกติ (Normal Hrs)',
      'OT 1.5 (ชั่วโมง)',
      'OT 2.0 (ชั่วโมง)',
      'OT 3.0 (ชั่วโมง)',
      'รวมชั่วโมงโอทีสะสม',
      'เวลารวมสะสมทั้งหมด (Grand Total)'
    ];

    const rows = masterAggregate.map(m => [
      m.id,
      m.name,
      m.position,
      m.scheduleType,
      m.daysWorked,
      m.normalHours,
      m.ot15Hours,
      m.ot20Hours,
      m.ot30Hours,
      m.otTotal,
      m.totalHours
    ]);

    const csvContent = "\uFEFF" + [
      `ตารางสรุปสรุปจำนวนชั่วโมงทำงานสะสมรายบุคคล (Individual Timesheet Core Report)`,
      `รอบคัดกรองช่วงวันที่: ${startDate} ถึง ${endDate}`,
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    link.setAttribute('href', url);
    link.setAttribute('download', `Individual_Timesheet_Core_Report_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Month labels helper
  const monthsList = [
    { value: 0, label_en: 'January', label_th: 'มกราคม' },
    { value: 1, label_en: 'February', label_th: 'กุมภาพันธ์' },
    { value: 2, label_en: 'March', label_th: 'มีนาคม' },
    { value: 3, label_en: 'April', label_th: 'เมษายน' },
    { value: 4, label_en: 'May', label_th: 'พฤษภาคม' },
    { value: 5, label_en: 'June', label_th: 'มิถุนายน' },
    { value: 6, label_en: 'July', label_th: 'กรกฎาคม' },
    { value: 7, label_en: 'August', label_th: 'สิงหาคม' },
    { value: 8, label_en: 'September', label_th: 'กันยายน' },
    { value: 9, label_en: 'October', label_th: 'ตุลาคม' },
    { value: 10, label_en: 'November', label_th: 'พฤศจิกายน' },
    { value: 11, label_en: 'December', label_th: 'ธันวาคม' }
  ];

  const activeMonthLabel = monthsList.find(m => m.value === selectedMonth)?.label_en || 'December';

  // Ensure MONTH INDICATOR always matches the month and year of active endDate (Date Submitted) - e.g. 5 corresponds to May (May-2026)
  const resolvedMonthIndicator = useMemo(() => {
    if (!endDate) return `${activeMonthLabel}-${selectedYear}`;
    const parts = endDate.split('-');
    if (parts.length === 3) {
      const yearStr = parts[0];
      const monthIndex = parseInt(parts[1], 10) - 1; // 0-indexed
      if (monthIndex >= 0 && monthIndex < 12) {
        const monthName = monthsList[monthIndex]?.label_en || 'December';
        return `${monthName}-${yearStr}`;
      }
    }
    return `${activeMonthLabel}-${selectedYear}`;
  }, [endDate, activeMonthLabel, selectedYear]);

  // Card themes
  const bgCard = isDark ? 'bg-[#141414] border-white/10 text-white' : 'bg-white border-slate-200 shadow-sm text-slate-800';
  const inputBg = isDark ? 'bg-[#0D0D0D] border-white/10 text-white focus:border-[#D4AF37]' : 'bg-white border-slate-300 text-slate-800 focus:ring-1 focus:ring-[#D4AF37]';
  const sectionTitleColor = isDark ? 'text-[#D4AF37]' : 'text-amber-600';
  const tableThStyle = isDark ? 'bg-[#1C1C1E] text-gray-400 border-white/5' : 'bg-slate-50 text-slate-500 border-slate-200';
  const tableTrStyle = isDark ? 'hover:bg-white/[0.02] border-white/5 text-gray-300' : 'hover:bg-slate-50/50 border-slate-100 text-slate-700';

  return (
    <div className="space-y-6 animate-fade-in print:bg-white print:text-black print:m-0 print:p-0">
      
      {/* 1. REPORT CONTROL CENTER (Chrome - hidden when printing) */}
      <div className={`p-5 rounded-sm border ${bgCard} print:hidden`}>
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div>
            <h2 className={`text-base font-serif uppercase tracking-wider flex items-center gap-2 ${sectionTitleColor}`}>
              <Users className="w-5 h-5 text-[#D4AF37]" />
              ปฏิทินบันทึกเจาะลึกเฉพาะสัญญารายบุคคล (Individual Drill-Down Daily Logs)
            </h2>
            <p className="text-[11px] text-gray-500 mt-1">
              สร้างตารางเวลา TIME SHEET รายเดือนตามสเป็คสัญญากลาง พัฒนารอยต่อประสานระบบรายงานสแกนสำหรับธนาคารและการพิมพ์ PDF
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveSubTab('drilldown')}
              className={`text-xs font-bold px-4 py-2.5 rounded-sm transition-all cursor-pointer ${
                activeSubTab === 'drilldown'
                  ? 'bg-[#D4AF37] text-black shadow-md border border-[#D4AF37] translate-y-[-1px]'
                  : isDark 
                    ? 'bg-[#1C1C1E] text-gray-300 hover:text-white hover:bg-[#2C2C2E] border border-white/10'
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              🗓️ ปูมรายวันเดี่ยว (IKM Time Sheet)
            </button>
            <button
              id="subtab-daily-breakdown"
              onClick={() => setActiveSubTab('daily-breakdown')}
              className={`text-xs font-bold px-4 py-2.5 rounded-sm transition-all cursor-pointer ${
                activeSubTab === 'daily-breakdown'
                  ? 'bg-[#D4AF37] text-black shadow-md border border-[#D4AF37] translate-y-[-1px]'
                  : isDark 
                    ? 'bg-[#1C1C1E] text-gray-300 hover:text-white hover:bg-[#2C2C2E] border border-white/10'
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              💰 เจาะลึกรายรับรายวัน (Daily Earnings)
            </button>
            <button
              onClick={() => setActiveSubTab('master')}
              className={`text-xs font-bold px-4 py-2.5 rounded-sm transition-all cursor-pointer ${
                activeSubTab === 'master'
                  ? 'bg-[#D4AF37] text-black shadow-md border border-[#D4AF37] translate-y-[-1px]'
                  : isDark 
                    ? 'bg-[#1C1C1E] text-gray-300 hover:text-white hover:bg-[#2C2C2E] border border-white/10'
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              📊 ตารางรวมกำลังแรงงาน (Total Staff Matrix)
            </button>
            <button
              onClick={() => setActiveSubTab('project-summary')}
              className={`text-xs font-bold px-4 py-2.5 rounded-sm transition-all cursor-pointer ${
                activeSubTab === 'project-summary'
                  ? 'bg-[#D4AF37] text-black shadow-md border border-[#D4AF37] translate-y-[-1px]'
                  : isDark 
                    ? 'bg-[#1C1C1E] text-gray-300 hover:text-white hover:bg-[#2C2C2E] border border-white/10'
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              🏢 รายงานสรุปตามโครงการ (Project Summary Matrix)
            </button>
          </div>
        </div>

        {/* Dynamic Context Filters Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-5 pt-5 border-t border-dashed border-white/10">
          <div className="relative" id="employee-search-container">
            <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">สับเปลี่ยนช่างพนักงาน (Employee)</label>
            <div className="relative">
              <input
                type="text"
                value={empSearch}
                onFocus={() => setIsDropdownOpen(true)}
                onChange={(e) => {
                  setEmpSearch(e.target.value);
                  setIsDropdownOpen(true);
                }}
                placeholder="ค้นหารหัส หรือ ชื่อพนักงาน..."
                className={`w-full text-xs rounded-sm py-2 pl-3 pr-8 focus:outline-hidden ${inputBg} font-semibold`}
              />
              <button
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="absolute right-2 top-2 text-gray-400 hover:text-white cursor-pointer"
              >
                <Search className="w-3.5 h-3.5" />
              </button>
            </div>

            {isDropdownOpen && (
              <div 
                className={`absolute z-50 left-0 right-0 mt-1 max-h-60 overflow-y-auto rounded-sm border shadow-xl ${
                  isDark ? 'bg-[#181818] border-white/10 text-white' : 'bg-white border-slate-300 text-slate-800'
                }`}
              >
                {filteredEmployeesForSelect.length > 0 ? (
                  filteredEmployeesForSelect.map(emp => {
                    const isSelected = activeEmployee && activeEmployee.id === emp.id;
                    return (
                      <button
                        key={emp.id}
                        type="button"
                        onClick={() => {
                          setSelectedEmpName(emp.employeeName);
                          setEmpSearch(emp.employeeName);
                          setIsDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs transition-colors flex items-center justify-between cursor-pointer ${
                          isSelected 
                            ? 'bg-[#D4AF37]/20 text-[#D4AF37] font-bold' 
                            : isDark ? 'hover:bg-white/5' : 'hover:bg-slate-100'
                        }`}
                      >
                        <span className="truncate">
                          [{emp.id}] - {emp.employeeName}
                        </span>
                        {isSelected && <Check className="w-3 h-3 text-[#D4AF37]" />}
                      </button>
                    );
                  })
                ) : (
                  <div className="p-3 text-xs text-gray-500 text-center">ไม่พบพนักงานที่ค้นหา</div>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1 font-mono">โหมดช่วงวันที่ประเมิน (Scope Mode)</label>
            <div className="grid grid-cols-2 gap-1 bg-black/15 p-1 rounded-sm border border-white/5">
              <button
                onClick={() => setIsMonthlyMode(true)}
                className={`text-[10px] font-bold py-1.5 rounded-sm transition-all cursor-pointer text-center ${
                  isMonthlyMode ? 'bg-[#D4AF37] text-black' : 'text-gray-400 hover:text-white'
                }`}
              >
                รายเดือนปฏิทิน
              </button>
              <button
                onClick={() => setIsMonthlyMode(false)}
                className={`text-[10px] font-bold py-1.5 rounded-sm transition-all cursor-pointer text-center ${
                  !isMonthlyMode ? 'bg-[#D4AF37] text-black' : 'text-gray-400 hover:text-white'
                }`}
              >
                ระบุช่วงวันที่เอง
              </button>
            </div>
          </div>

          {isMonthlyMode ? (
            <>
              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">เลือกปีคริสตศักราช (Year)</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className={`w-full text-xs rounded-sm py-2 px-3 focus:outline-hidden ${inputBg}`}
                >
                  <option value={2025} className={isDark ? 'bg-black' : ''}>2025</option>
                  <option value={2026} className={isDark ? 'bg-black' : ''}>2026</option>
                  <option value={2027} className={isDark ? 'bg-black' : ''}>2027</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">เลือกเดือนปฏิบัติงาน (Month)</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className={`w-full text-xs rounded-sm py-2 px-3 focus:outline-hidden ${inputBg}`}
                >
                  {monthsList.map(m => (
                    <option key={m.value} value={m.value} className={isDark ? 'bg-black text-white' : 'bg-white text-slate-800'}>
                      {m.label_th} ({m.label_en})
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">วันที่เริ่มรอบ (From Date)</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={`w-full text-xs rounded-sm py-2 px-3 focus:outline-hidden ${inputBg}`}
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">วันที่สิ้นสุด (To Date)</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className={`w-full text-xs rounded-sm py-2 px-3 focus:outline-hidden ${inputBg}`}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* 2. TAB VIEW: MASTER AGGREGATE SCREEN */}
      {activeSubTab === 'master' && (
        !isSubTabsUnlocked ? (
          <SubTabPasscodeLock
            onUnlock={() => setIsSubTabsUnlocked(true)}
            isDark={isDark}
            title="ระบบประเมินกำลังความถี่สะสมรายสัญญาได้รับการคุ้มครองสิทธิ"
            description="กรุณาใส่รหัสผ่านเพื่อเข้าสู่รายงานตารางรวมกำลังแรงงานของพนักงานทุกคน"
          />
        ) : (
          <div className="space-y-4">
            <div className={`p-4 rounded-sm border flex items-center justify-between transition-all duration-200 print:hidden ${
              isDark ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-bold font-sans">✓ สิทธิพนักงานเปิดเข้าถึงตารางรวมกำลังแรงงาน (Total Staff Matrix) เรียบร้อย (Unlocked)</span>
              </div>
              <button
                onClick={() => setIsSubTabsUnlocked(false)}
                className="bg-red-500 hover:bg-red-600 text-white font-extrabold text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-sm cursor-pointer transition-all active:scale-[0.98] font-sans"
              >
                ล็อคระบบความปลอดภัย / LOCK
              </button>
            </div>

            <div className={`rounded-sm border ${bgCard} overflow-hidden print:hidden`}>
          <div className="p-4 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-black/5">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-[#D4AF37]">
                ตารางสรุปกำลังความถี่สะสมรายสัญญา (Total Staff Aggregate Matrix)
              </h3>
              <p className="text-[10px] text-gray-500 mt-0.5">
                ปูมรอบจ่ายสรุปชั่วโมงธรรมดา (Normal) และล่วงเวลาแยก (OT 1.5, OT 2.0, OT 3.0) บันทึกรายหัว
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative">
                <input
                  type="text"
                  placeholder="ค้นหาชื่อพนักงาน..."
                  value={masterSearch}
                  onChange={(e) => setMasterSearch(e.target.value)}
                  className={`text-xs pl-8 pr-3 py-1.5 rounded-sm w-52 ${inputBg}`}
                />
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gray-505" />
              </div>
              
              <button
                onClick={exportMasterCSV}
                className="flex items-center gap-1.5 bg-[#D4AF37] hover:bg-amber-400 text-black font-extrabold text-xs py-1.5 px-3 rounded-sm transition-all shadow-xs cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                ส่งออกสรุปบัญชีพยาน
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-black/45 text-[9px] font-mono tracking-widest uppercase text-gray-400 border-b border-white/5">
                <tr>
                  <th className="py-3 px-4 w-24">รหัส</th>
                  <th className="py-3 px-4">ชื่อผู้ปฏิบัติงาน</th>
                  <th className="py-3 px-4">ตำแหน่ง</th>
                  <th className="py-3 px-4 text-center">ประเภท</th>
                  <th className="py-3 px-4 text-center w-24">รวมจำนวนวัน</th>
                  <th className="py-3 px-4 text-right">Normal Hrs</th>
                  <th className="py-3 px-4 text-right text-amber-500">OT 1.5</th>
                  <th className="py-3 px-4 text-right text-red-500">OT 2.0</th>
                  <th className="py-3 px-4 text-right text-purple-400">OT 3.0</th>
                  <th className="py-3 px-4 text-right">รวมชั่วโมงกะ</th>
                  <th className="py-3 px-4 text-center w-28">เจาะประชากร</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 bg-black/[0.05]">
                {filteredMaster.length > 0 ? (
                  filteredMaster.map((m, idx) => (
                    <tr key={idx} className="hover:bg-white/[0.01] transition-colors text-[11px]">
                      <td className="py-3 px-4 font-mono font-bold text-[#D4AF37]">{m.id}</td>
                      <td className="py-3 px-4 font-bold">
                        <span>{m.name}</span>
                        {m.isFlatRate && (
                          <span className="ml-1.5 text-[8px] bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/20 px-1 py-0.2 rounded-sm font-sans">Flat-12h</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-gray-450">{m.position}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-1.5 py-0.5 rounded-sm text-[8px] font-bold ${
                          m.scheduleType === 'รายเดือน' 
                            ? 'bg-blue-500/10 text-blue-500' 
                            : 'bg-amber-500/10 text-amber-500'
                        }`}>
                          {m.scheduleType}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-semibold text-gray-400">{m.daysWorked} วัน</td>
                      <td className="py-3 px-4 text-right font-mono text-gray-400">{m.normalHours.toFixed(1)}</td>
                      <td className="py-3 px-4 text-right font-mono text-amber-500">{m.ot15Hours.toFixed(1)}</td>
                      <td className="py-3 px-4 text-right font-mono text-red-400">{m.ot20Hours.toFixed(1)}</td>
                      <td className="py-3 px-4 text-right font-mono text-purple-400">{m.ot30Hours.toFixed(1)}</td>
                      <td className="py-3 px-4 text-right font-mono font-extrabold text-emerald-500">{m.totalHours.toFixed(1)} ชม.</td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => {
                            setSelectedEmpName(m.name);
                            setActiveSubTab('drilldown');
                          }}
                          className="px-2 py-1 bg-amber-500/10 hover:bg-amber-500 text-amber-550 hover:text-black font-semibold text-[10px] rounded transition-all cursor-pointer inline-flex items-center gap-1"
                        >
                          ดึงปฏิทินเดี่ยว <ArrowRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-gray-500 font-serif">
                      ไม่พบประวัติข้อมูลรอบปฏิบัติงานของพนักงานใดๆ
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
          </div>
        )
      )}

      {/* 3. TAB VIEW: DRILLDOWN (IKM TESTING TIME SHEET BRAND SPECIFIC) */}
      {activeSubTab === 'drilldown' && (
        <div className="space-y-4">
          
          {/* Action Header controls (Chrome - hidden in printing) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-2 bg-black/10 p-4 border rounded border-white/5 print:hidden">
            
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                onClick={exportEmpCSV}
                className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-white/5 dark:hover:bg-white/10 dark:text-gray-300 font-bold text-xs py-2 px-4 rounded-sm transition-all border border-slate-200 dark:border-white/15 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                ส่งออก CSV
              </button>
              
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-white/5 dark:hover:bg-white/10 dark:text-gray-300 font-bold text-xs py-2 px-4 rounded-sm transition-all border border-slate-200 dark:border-white/15 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                ส่งออก PDF / พิมพ์คนนี้
              </button>

              <button
                type="button"
                onClick={startBatchPrint}
                className="flex items-center gap-1.5 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white font-extrabold text-xs py-2 px-4 rounded-sm transition-all border border-purple-500/20 cursor-pointer shadow-md"
              >
                <Printer className="w-4 h-4" />
                ส่งออก PDF / พิมพ์ทุกคน
              </button>

              <button
                onClick={handleSyncToSupabase}
                disabled={isSaving}
                className="flex items-center gap-1.5 bg-[#D4AF37] hover:bg-amber-400 text-black font-extrabold text-xs py-2 px-5 rounded-sm transition-all cursor-pointer shadow-md shadow-amber-500/5 disabled:opacity-40"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    กำลังประมวลซิงก์...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    บันทึกลงฐานข้อมูล
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setShowSqlHelper(!showSqlHelper)}
                className="flex items-center gap-1.5 bg-zinc-850 hover:bg-zinc-800 text-[#D4AF37] font-bold text-xs py-2 px-4 rounded-sm transition-all border border-amber-900/20 cursor-pointer"
              >
                <Database className="w-3.5 h-3.5 text-[#D4AF37]" />
                {showSqlHelper ? 'ปิดโค้ด SQL ✕' : '📜 วิธีตั้งค่าเชื่อมต่อ SQL'}
              </button>
            </div>
          </div>

          {/* Feedback status notifications (Chrome - hidden in printing) */}
          {saveStatus.type && (
            <div className={`p-3.5 rounded-sm text-xs border print:hidden font-medium ${
              saveStatus.type === 'success' 
                ? 'bg-emerald-950/20 text-emerald-400 border-emerald-900/30' 
                : 'bg-red-950/20 text-red-400 border-red-900/30'
            }`}>
              {saveStatus.message}
            </div>
          )}

          {/* SQL database Schema helper */}
          {showSqlHelper && (
            <div className="p-5 bg-zinc-900/95 border border-amber-500/20 rounded-sm text-xs text-gray-300 space-y-3 print:hidden shadow-xl animate-fade-in max-w-[1000px] mx-auto w-full">
              <div className="flex items-center justify-between border-b border-amber-500/10 pb-2">
                <span className="font-bold text-amber-400 flex items-center gap-2 uppercase tracking-wide">
                  <Database className="w-4 h-4 text-amber-500" />
                  คำสั่งสร้างตาราง SQL (Table Schema for Supabase SQL Editor)
                </span>
                <button
                  type="button"
                  onClick={() => setShowSqlHelper(false)}
                  className="text-gray-500 hover:text-white transition-colors cursor-pointer text-[10.5px]"
                >
                  ✕ ปิดหน้านี้
                </button>
              </div>
              <p className="text-[11px] text-gray-400 leading-relaxed">
                เนื่องจากเป็นตารางใหม่สำหรับเก็บบันทึกค่าใช้จ่ายเดินทาง เงินเบิกสำรองสะสม และโบนัสงานรายบุคคล 
                กรุณาเชื่อมต่อโดยนำคิวรี่ SQL ล่างนี้ไปรันที่ <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-sky-400 underline font-bold hover:text-sky-300">Supabase Dashboard ↗</a> 
                ช่องเมนู <strong className="text-white font-mono">SQL Editor (New Query)</strong> แล้วกดโปรแกรม <strong className="text-white font-mono">Run</strong>:
              </p>
              
              <div className="relative">
                <pre className="p-4 bg-black/60 rounded-xs text-[#0D9488] font-mono text-[11px] leading-relaxed overflow-x-auto border border-white/5 select-all max-h-64 scrollbar-thin">
{`-- 1. สร้างตารางเก็บเบี้ยเลี้ยง / เงินเบิก และบันทึกเพิ่มเติมรายบุคคลรายวัน
CREATE TABLE IF NOT EXISTS public."IndividualSupplements" (
    "ID" text PRIMARY KEY,                                  -- คีย์หลักอ้างอิงรหัสผสม เช่น EMP001_2026-05-20
    "EmployeeID" text NOT NULL,                             -- รหัสพนักงาน
    "EmployeeName" text NOT NULL,                           -- ชื่อพนักงาน
    "Date" DATE NOT NULL,                                   -- วันที่ทำงาน
    "Perdiem" NUMERIC(12, 2) DEFAULT 0.00,                  -- ค่าเดินทาง / เบี้ยเลี้ยง
    "Advance" NUMERIC(12, 2) DEFAULT 0.00,                  -- เงินเบิกสำรองล่วงหน้า
    "JobBonus" NUMERIC(12, 2) DEFAULT 0.00,                 -- โบนัสจากหน้างานพิเศษ
    "ConfineSpace" NUMERIC(12, 2) DEFAULT 0.00,             -- ค่าอับอากาศ (Confine space)
    "Incentive" NUMERIC(12, 2) DEFAULT 0.00,                -- ค่าแรงจูงใจ (Incentive)
    "Remark" TEXT,                                          -- หมายเหตุเพิ่มเติมสำหรับวันนั้น
    "CreatedAt" TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    "UpdatedAt" TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. รันเสริมสำหรับอัปเกรดตารางเก่าที่มีคอลัมน์เดิมอยู่แล้ว
ALTER TABLE public."IndividualSupplements" ADD COLUMN IF NOT EXISTS "ConfineSpace" NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE public."IndividualSupplements" ADD COLUMN IF NOT EXISTS "Incentive" NUMERIC(12, 2) DEFAULT 0.00;

-- 3. ปิดการควบคุมระดับแถว (RLS) เพื่อให้รวดเร็ว
ALTER TABLE public."IndividualSupplements" DISABLE ROW LEVEL SECURITY;

-- 4. เสริมคอมเมนต์คำอธิบายตาราง
COMMENT ON TABLE public."IndividualSupplements" IS 'ตารางบันทึกค่าเบี้ยเลี้ยง เงินเบิกสำรองสะสม และโบนัสพิเศษรายบุคคลรายวัน (Confine/Incentive)';`}
                </pre>
                <div className="absolute top-2 right-2 flex gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(`-- 1. สร้างตารางเก็บเบี้ยเลี้ยง / เงินเบิก และบันทึกเพิ่มเติมรายบุคคลรายวัน
CREATE TABLE IF NOT EXISTS public."IndividualSupplements" (
    "ID" text PRIMARY KEY,
    "EmployeeID" text NOT NULL,
    "EmployeeName" text NOT NULL,
    "Date" DATE NOT NULL,
    "Perdiem" NUMERIC(12, 2) DEFAULT 0.00,
    "Advance" NUMERIC(12, 2) DEFAULT 0.00,
    "JobBonus" NUMERIC(12, 2) DEFAULT 0.00,
    "ConfineSpace" NUMERIC(12, 2) DEFAULT 0.00,
    "Incentive" NUMERIC(12, 2) DEFAULT 0.00,
    "Remark" TEXT,
    "CreatedAt" TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    "UpdatedAt" TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. รันเสริมสำหรับอัปเกรดตารางเก่าที่มีคอลัมน์เดิมอยู่แล้ว
ALTER TABLE public."IndividualSupplements" ADD COLUMN IF NOT EXISTS "ConfineSpace" NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE public."IndividualSupplements" ADD COLUMN IF NOT EXISTS "Incentive" NUMERIC(12, 2) DEFAULT 0.00;

-- 3. ปิดการควบคุมระดับแถว (RLS)
ALTER TABLE public."IndividualSupplements" DISABLE ROW LEVEL SECURITY;`);
                      setCopiedSql(true);
                      setTimeout(() => setCopiedSql(false), 2000);
                    }}
                    className={`text-white text-[10px] font-extrabold py-1 px-3 rounded-xs transition-all cursor-pointer shadow-sm ${
                      copiedSql ? 'bg-emerald-600' : 'bg-[#0D9488] hover:bg-[#0F766E]'
                    }`}
                  >
                    {copiedSql ? 'คัดลอกเรียบร้อยแล้ว! ✓' : '📄 คัดลอกคำสั่ง SQL'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* THE OFFICIAL RECORD SHEET (WHITE PAPER TYPE - PRINT FRIENDLY) */}
          {/* ======================================================== */}
          <div className="bg-white text-slate-900 rounded-sm p-6 shadow-xl border border-slate-300 font-sans print:p-0 print:border-none print:shadow-none print:text-black print:bg-white w-full max-w-[1000px] mx-auto overflow-x-auto">
            
            {/* SHEET HEADER LAYOUT */}
            <div className="flex justify-between items-start border-b-2 border-slate-800 pb-4 mb-4">
              
              {/* Logo block (IKM Testing Left aligned) */}
              <div className="flex items-center gap-3">
                <img 
                  src="https://lh3.googleusercontent.com/d/1HMZ8z-TK8bmpxuA3b4nu2ybopYiz-yGN" 
                  className="h-10 w-auto object-contain shrink-0" 
                  alt="IKM Testing Logo" 
                  referrerPolicy="no-referrer" 
                />
                <div className="text-left">
                  <h1 className="text-sm font-black tracking-wider uppercase font-sans text-black">IKM Testing (Thailand) Co., Ltd.</h1>
                  <p className="text-[9.5px] text-slate-500 leading-tight">155/167 Moo 5. Samnakthon Sub-district, Banchang District, Rayong 21130 Thailand.</p>
                </div>
              </div>

              {/* Document monthly designation label boxed */}
              <div className="text-right shrink-0">
                <div className="border-2 border-dashed border-slate-400 px-4 py-2 text-center rounded bg-slate-50 font-bold max-w-48">
                  <span className="text-xs uppercase tracking-widest text-slate-500 block font-mono">Month Indicator</span>
                  <span className="text-sm text-slate-900 font-extrabold font-serif uppercase tracking-wider">{resolvedMonthIndicator}</span>
                </div>
              </div>
            </div>

            {/* Centered Document Title */}
            <div className="text-center mb-6">
              <h2 className="text-lg font-black tracking-widest uppercase border-b border-slate-900 inline-block px-8 pb-1" style={{ letterSpacing: '0.25em' }}>
                TIME SHEET
              </h2>
            </div>

            {/* METADATA TWO COLUMN GRID */}
            <div className="grid grid-cols-2 gap-x-8 gap-y-3.5 mb-6 text-xs text-left" style={{ gridTemplateColumns: '1.2fr 1fr' }}>
              
              {/* Left-hand profiles */}
              <div className="space-y-3">
                <div className="flex items-end gap-1.5">
                  <span className="font-extrabold text-slate-500 uppercase tracking-wider w-28 shrink-0">Name-Surname :</span>
                  <span className="border-b border-dashed border-slate-900 pb-0.5 w-full font-bold text-slate-900 pl-1 text-[13px]">
                    {selectedEmpName || '—'}
                  </span>
                </div>
                <div className="flex items-end gap-1.5">
                  <span className="font-extrabold text-slate-500 uppercase tracking-wider w-28 shrink-0">Position :</span>
                  <input
                    type="text"
                    value={positionInput}
                    onChange={(e) => setPositionInput(e.target.value)}
                    className="border-b border-dashed border-slate-900 pb-0.5 w-full font-mono font-bold bg-transparent text-slate-900 text-xs focus:outline-hidden pl-1 hover:bg-slate-50 print:border-b"
                  />
                </div>
                <div className="flex items-end gap-1.5">
                  <span className="font-extrabold text-slate-500 uppercase tracking-wider w-28 shrink-0">Location :</span>
                  <input
                    type="text"
                    value={locationInput}
                    onChange={(e) => handleLocationChange(e.target.value)}
                    className="border-b border-dashed border-slate-900 pb-0.5 w-full font-bold bg-transparent text-slate-900 text-xs focus:outline-hidden pl-1 hover:bg-slate-50 print:border-b"
                  />
                </div>
              </div>

              {/* Right-hand profiles */}
              <div className="space-y-3">
                <div className="flex items-end gap-1.5">
                  <span className="font-extrabold text-slate-500 uppercase tracking-wider w-28 shrink-0">Employee Code :</span>
                  <input
                    type="text"
                    value={employeeCodeInput}
                    onChange={(e) => setEmployeeCodeInput(e.target.value)}
                    className="border-b border-dashed border-slate-900 pb-0.5 w-full font-mono font-bold bg-transparent text-slate-900 text-xs focus:outline-hidden pl-1 hover:bg-slate-50 print:border-b"
                  />
                </div>
                <div className="flex items-end gap-1.5">
                  <span className="font-extrabold text-slate-500 uppercase tracking-wider w-28 shrink-0">Date Submitted :</span>
                  <span className="border-b border-dashed border-slate-900 pb-0.5 w-full font-mono font-bold text-slate-900 pl-1">
                    {endDate.split('-').reverse().join('/')}
                  </span>
                </div>
                <div className="flex items-end gap-1.5">
                  <span className="font-extrabold text-slate-500 uppercase tracking-wider w-28 shrink-0">Project / Services :</span>
                  <input
                    type="text"
                    value={projectInput}
                    onChange={(e) => handleProjectChange(e.target.value)}
                    className="border-b border-dashed border-slate-900 pb-0.5 w-full font-bold bg-transparent text-slate-900 text-xs focus:outline-hidden pl-1 hover:bg-slate-50 print:border-b"
                  />
                </div>
              </div>
            </div>

            {/* ======================================================== */}
            {/* THE SPREADSHEET MATRIX */}
            {/* ======================================================== */}
            <div className="border border-slate-400 overflow-hidden mb-6 rounded-xs">
              <table className="w-full text-left text-xs text-slate-900 table-fixed border-collapse">
                
                {/* DOUBLE DEPTH THEAD */}
                <thead className="bg-slate-100 text-slate-700 text-[10px] uppercase font-bold text-center border-b border-slate-400 font-mono tracking-tight">
                  <tr className="border-b border-slate-400 divide-x divide-slate-400">
                    <th className="py-2.5 px-1.5 w-[100px] shrink-0" rowSpan={2}>Day</th>
                    <th className="py-2.5 px-0.5 w-[65px] shrink-0" rowSpan={2}>Date</th>
                    <th className="py-1.5 px-1 uppercase tracking-wider text-[9px] bg-slate-50" colSpan={3}>Working Time</th>
                    <th className="py-1.5 px-1 uppercase tracking-wider text-[9px] bg-slate-50" colSpan={3}>Overtime</th>
                    <th className="py-2 px-1 text-[9px] w-[75px]" rowSpan={2}>Perdiem<br/><span className="text-[7.5px] font-sans">/ Travel Exp</span></th>
                    <th className="py-2 px-1 text-[9px] w-[65px]" rowSpan={2}>Confine /<br/>Other</th>
                    <th className="py-2 px-1 text-[9px] w-[65px]" rowSpan={2}>Incentive</th>
                    <th className="py-2.5 px-2 w-[150px]" rowSpan={2}>Job Reference / Remark</th>
                  </tr>
                  <tr className="divide-x divide-slate-450 divide-slate-400 text-[9.5px]">
                    <th className="py-1 px-1 w-[48px] font-mono">Start</th>
                    <th className="py-1 px-1 w-[48px] font-mono">End</th>
                    <th className="py-1 px-1 w-[45px] text-sky-700">Total</th>
                    
                    <th className="py-1 px-1 w-[35px] text-emerald-700">1.0</th>
                    <th className="py-1 px-1 w-[35px] text-amber-700">1.5</th>
                    <th className="py-1 px-1 w-[35px] text-red-700">3.0</th>
                  </tr>
                </thead>

                {/* SPREADSHEET BODY */}
                <tbody className="divide-y divide-slate-200">
                  {tableRows.map((rowItem, idx) => {
                    const { draft, rowId, dStr, suppKey, isMulti } = rowItem;
                    const supp = supplements[suppKey] || supplements[`${employeeCodeInput}_${dStr}`] || { perdiem: 0, advance: 0, jobBonus: 0, confineSpace: 0, incentive: 0, remarkOverride: '' };

                    const dateObj = new Date(dStr);
                    const dayNum = dateObj.getDate();
                    const dayOfWeekStr = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
                    
                    const dayVal = dateObj.getDay();
                    const isSunday = dayVal === 0;
                    const isSaturday = dayVal === 6;

                    // Public Holiday matching check
                    const optHoliday = holidays.find(h => h.holidayDate === dStr);
                    const isPubHoliday = !!optHoliday;

                    // Compute specific OT Value pay
                    const itemOt15 = draft.ot15Hours || 0;
                    const itemOt20 = draft.ot20Hours || 0;
                    const itemOt30 = draft.ot30Hours || 0;
                    const isStaff = activeEmployee?.workScheduleType === 'staff' || activeEmployee?.workScheduleType === 'monthly_worker';
                    const ot20RateActual = isStaff ? 1.0 : (settings?.ot20Rate || 2.0);
                    const otDecimalEst = (itemOt15 * 1.5 + itemOt20 * ot20RateActual + itemOt30 * 3.0);
                    const otWageEstimated = otDecimalEst * hourlyRate;

                    // Styles for Saturday / Sunday / Holiday matching image perfectly
                    let rowBgClass = 'bg-white';
                    let dayTextClass = 'text-slate-700 font-medium';
                    
                    if (isPubHoliday) {
                      rowBgClass = 'bg-[#FFFEA3] print:bg-[#FFFEA3]'; // Bright Gold Canary Yellow
                      dayTextClass = 'text-amber-800 font-extrabold';
                    } else if (isSaturday) {
                      rowBgClass = 'bg-[#ECECEC]/70 print:bg-[#ECECEC]/60'; // Gray
                      dayTextClass = 'text-purple-700 font-bold';
                    } else if (isSunday) {
                      rowBgClass = 'bg-[#ECECEC]/70 print:bg-[#ECECEC]/60'; // Gray
                      dayTextClass = 'text-red-650 font-bold';
                    }

                    // Checks Leave style
                    const defaultRemark = optHoliday ? optHoliday.holidayName : '';
                    let projectText = draft.project || '';
                    if (projectText.toLowerCase() === 'workshop') {
                      projectText = '';
                    }
                    if (!(draft.timeIn && draft.timeOut)) {
                      projectText = '';
                    }
                    const finalRemark = supp.remarkOverride || projectText || draft.remark || defaultRemark;
                    const labelLower = finalRemark.toLowerCase();
                    const isLeaveDay = labelLower.includes('leave') || labelLower.includes('ลา');
                    if (isLeaveDay) {
                      rowBgClass = 'bg-[#FEEDD1]'; // Sand / Soft peach
                    }

                    // Total work hours
                    const workHoursSum = (draft.normalHours || 0) + (draft.ot15Hours || 0) + (draft.ot20Hours || 0) + (draft.ot30Hours || 0);

                    // Find how many rows belong to this dStr
                    const dayRows = tableRows.filter(r => r.dStr === dStr);
                    const isFirstRowOfDay = dayRows[0]?.rowId === rowId;

                    return (
                      <tr 
                        key={rowId} 
                        className={`divide-x divide-slate-200 text-center text-[11px] h-9 hover:bg-slate-50/50 print:hover:none ${rowBgClass}`}
                      >
                        {/* Day of Week */}
                        {isFirstRowOfDay ? (
                          <td className={`py-1 px-1.5 text-left truncate font-sans ${dayTextClass}`} rowSpan={dayRows.length}>
                            <div className="flex flex-col">
                              <span>{dayOfWeekStr}</span>
                              <button
                                type="button"
                                title="เพิ่มแถวกรอกงานโครงการที่สอง สำหรับวันนี้นะคะ (Add secondary work shift/job)"
                                onClick={() => handleAddJobRow(dStr)}
                                className="mt-1 flex items-center justify-center gap-0.5 self-start bg-sky-50 hover:bg-sky-100 text-sky-850 font-bold py-0.5 px-1 rounded-sm border border-sky-200 text-[8.5px] cursor-pointer print:hidden"
                              >
                                <Plus className="w-2 h-2" />
                                <span>แทรกงาน</span>
                              </button>
                            </div>
                          </td>
                        ) : null}

                        {/* Date Number */}
                        {isFirstRowOfDay ? (
                          <td className="py-1 px-0.5 font-bold font-mono text-center" rowSpan={dayRows.length}>
                            {formatThaiDate(dStr)}
                          </td>
                        ) : null}

                        {/* Start Input */}
                        <td className="py-1 px-0.5">
                          <input
                            type="text"
                            placeholder="——"
                            value={draft.timeIn || ''}
                            onChange={(e) => handleDraftChange(rowId, 'timeIn', e.target.value)}
                            className="w-full text-center p-0.5 bg-transparent border-0 border-b border-transparent hover:border-slate-300 focus:border-[#D4AF37] focus:outline-hidden font-mono text-[11.5px] font-bold text-slate-800 print:border-b-0 print:p-0"
                          />
                        </td>

                        {/* End Input */}
                        <td className="py-1 px-0.5">
                          <input
                            type="text"
                            placeholder="——"
                            value={draft.timeOut || ''}
                            onChange={(e) => handleDraftChange(rowId, 'timeOut', e.target.value)}
                            className="w-full text-center p-0.5 bg-transparent border-0 border-b border-transparent hover:border-slate-300 focus:border-[#D4AF37] focus:outline-hidden font-mono text-[11.5px] font-bold text-slate-800 print:border-b-0 print:p-0"
                          />
                        </td>

                        {/* Calculated Hours Column */}
                        <td className="py-1 px-0.5 font-mono font-bold text-sky-700 bg-slate-50/20 text-[11.5px]">
                          {(draft.timeIn && draft.timeOut) ? (
                            <span>{workHoursSum.toFixed(1)}</span>
                          ) : (
                            <div className="flex items-center justify-center group">
                              <span className="text-slate-300 group-hover:hidden">—</span>
                              <button
                                type="button"
                                onClick={() => handlePresetStandardShift(rowId)}
                                title="คีย์สลิปด่วน 8:00 - 17:00"
                                className="hidden group-hover:inline-flex bg-slate-100 border border-slate-300 hover:bg-slate-200 text-slate-700 font-bold px-1 rounded-sm text-[8px] cursor-pointer print:hidden"
                              >
                                <Plus className="w-2 h-2 inline" />
                              </button>
                            </div>
                          )}
                        </td>

                        {/* 1.0 Overtime Hours */}
                        <td className="py-1 px-0.5 font-mono text-center font-bold text-slate-505">
                          {(draft.timeIn && draft.timeOut) && itemOt20 > 0 ? (
                            <span>{itemOt20.toFixed(1)}</span>
                          ) : (
                            <span className="text-slate-300 font-normal">—</span>
                          )}
                        </td>

                        {/* 1.5 Overtime Hours (Standard workday list) */}
                        <td className="py-1 px-0.5 font-mono text-center font-bold text-amber-700">
                          {(draft.timeIn && draft.timeOut) && itemOt15 > 0 ? (
                            <span>{itemOt15.toFixed(1)}</span>
                          ) : (
                            <span className="text-slate-300 font-normal">—</span>
                          )}
                        </td>

                        {/* 3.0 Overtime Hours */}
                        <td className="py-1 px-0.5 font-mono text-center font-bold text-red-650">
                          {(draft.timeIn && draft.timeOut) && itemOt30 > 0 ? (
                            <span>{itemOt30.toFixed(1)}</span>
                          ) : (
                            <span className="text-slate-300 font-normal">—</span>
                          )}
                        </td>

                        {/* Perdiem Allowances Input */}
                        <td className="py-0.5 px-0.5">
                          <input
                            type="number"
                            placeholder="0"
                            value={supp.perdiem || ''}
                            onChange={(e) => handleSupplementChange(suppKey, 'perdiem', parseFloat(e.target.value) || 0)}
                            className="w-full text-right py-1 px-1 bg-transparent border-0 border-b border-transparent hover:border-slate-300 focus:border-[#D4AF37] focus:outline-hidden font-mono font-bold text-slate-800 text-[11px] print:border-none print:p-0"
                          />
                        </td>

                        {/* Advance Payments Input */}
                        <td className="py-0.5 px-0.5">
                          <input
                            type="number"
                            placeholder="0"
                            value={supp.advance || ''}
                            onChange={(e) => handleSupplementChange(suppKey, 'advance', parseFloat(e.target.value) || 0)}
                            className="w-full text-right py-1 px-1 bg-transparent border-0 border-b border-transparent hover:border-slate-300 focus:border-[#D4AF37] focus:outline-hidden font-mono font-bold text-slate-800 text-[11px] print:border-none print:p-0"
                          />
                        </td>

                        {/* Job Bonus Input */}
                        <td className="py-0.5 px-0.5">
                          <input
                            type="number"
                            placeholder="0"
                            value={supp.jobBonus || ''}
                            onChange={(e) => handleSupplementChange(suppKey, 'jobBonus', parseFloat(e.target.value) || 0)}
                            className="w-full text-right py-1 px-1 bg-transparent border-0 border-b border-transparent hover:border-slate-300 focus:border-[#D4AF37] focus:outline-hidden font-mono font-bold text-slate-800 text-[11px] print:border-none print:p-0"
                          />
                        </td>

                        {/* Remarks Input */}
                        <td className="py-0.5 px-1 text-left">
                          <div className="flex items-center gap-1.5 justify-between">
                            <input
                              type="text"
                              placeholder="เช่น Workshop, Job XXX-XX..."
                              value={finalRemark}
                              onChange={(e) => handleSupplementChange(suppKey, 'remarkOverride', e.target.value)}
                              className="flex-1 text-left p-0.5 bg-transparent border-0 border-b border-transparent hover:border-slate-305 focus:border-[#D4AF37] focus:outline-hidden font-medium text-slate-600 text-[10px] italic truncate print:border-none print:p-0"
                            />
                            {isMulti && (
                              <button
                                type="button"
                                title="ลบรายการแทรกงานนี้ (Delete duplicate job row)"
                                onClick={() => handleRemoveJobRow(rowId)}
                                className="p-1 text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-105 rounded-full transition-colors cursor-pointer print:hidden shrink-0"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                {/* SPREADSHEET FOOTER ROW TOTALS */}
                <tfoot className="bg-slate-100 text-[10.5px] font-bold border-t border-slate-400 font-mono divide-y divide-slate-400 text-slate-900">
                  <tr className="divide-x divide-slate-400">
                    <td colSpan={4} className="py-2.5 px-4 text-right uppercase tracking-wider text-[9px] text-slate-550">Row Totals:</td>
                    
                    {/* Sum of standard normal/work hours */}
                    <td className="py-2.5 px-1 text-center font-mono font-bold bg-slate-50 text-sky-800 text-[11.5px]">
                      {computedSheetStats.hoursWorked.toFixed(1)}
                    </td>

                    <td className="py-2.5 px-1 text-center font-mono">
                      {computedSheetStats.ot20Sum > 0 ? computedSheetStats.ot20Sum.toFixed(1) : '—'}
                    </td>
                    <td className="py-2.5 px-1 text-center font-mono text-amber-800">
                      {computedSheetStats.ot15Sum > 0 ? computedSheetStats.ot15Sum.toFixed(1) : '—'}
                    </td>
                    <td className="py-2.5 px-1 text-center font-mono text-red-750">
                      {computedSheetStats.ot30Sum > 0 ? computedSheetStats.ot30Sum.toFixed(1) : '—'}
                    </td>

                    {/* Total Perdiem column sum */}
                    <td className="py-2.5 px-1 text-right font-mono text-[11px] pr-1">
                      {computedSheetStats.perdiemSum > 0 ? computedSheetStats.perdiemSum.toLocaleString() : '—'}
                    </td>

                    {/* Total Advance column sum */}
                    <td className="py-2.5 px-1 text-right font-mono text-[11px] pr-1">
                      {computedSheetStats.advanceSum > 0 ? computedSheetStats.advanceSum.toLocaleString() : '—'}
                    </td>

                    {/* Total Bonus column sum */}
                    <td className="py-2.5 px-1 text-right font-mono text-[11px] pr-1">
                      {computedSheetStats.jobBonusSum > 0 ? computedSheetStats.jobBonusSum.toLocaleString() : '—'}
                    </td>

                    {/* Blank under Remark */}
                    <td className="py-2.5 px-1"></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* ======================================================== */}
            {/* UNDER-SHEET STATS SUMMARY PANEL (MATCHES THE IMAGE EXACTLY) */}
            {/* ======================================================== */}
            <div className="grid grid-cols-2 gap-x-8 gap-y-3 p-4 bg-slate-50 border border-slate-300 rounded text-xs text-slate-800 mb-6 font-medium text-left">
              <div className="space-y-2.5">
                <div className="flex justify-between border-b border-slate-250 pb-1">
                  <span className="text-slate-500 uppercase font-bold text-[9.5px]">Day per Month (จำนวนวันในประเมิน) :</span>
                  <strong className="text-slate-900 font-mono text-right border-b border-slate-800 px-3 min-w-16 block">
                    {computedSheetStats.daysInPeriod.toFixed(1)}
                  </strong>
                </div>

                <div className="flex justify-between border-b border-slate-250 pb-1">
                  <span className="text-slate-500 uppercase font-bold text-[9.5px]">No. of Day worked (วันเข้าทำงานจริง) :</span>
                  <strong className="text-slate-900 font-mono text-right border-b border-slate-800 px-3 min-w-16 block">
                    {computedSheetStats.daysWorked.toFixed(1)}
                  </strong>
                </div>

                <div className="flex justify-between border-b border-slate-250 pb-1">
                  <span className="text-slate-500 uppercase font-bold text-[9.5px]">Total of hours worked (ชั่วโมงสะสมรวม) :</span>
                  <strong className="text-slate-900 font-mono text-right border-b border-slate-800 px-3 min-w-16 block">
                    {computedSheetStats.hoursWorked.toFixed(1)}
                  </strong>
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="flex justify-between border-b border-slate-250 pb-1">
                  <span className="text-slate-500 uppercase font-bold text-[9.5px]">No. of days on duty (วันอยู่ในหน้าที่) :</span>
                  <strong className="text-slate-900 font-mono text-right border-b border-slate-800 px-3 min-w-16 block text-slate-500">
                    {computedSheetStats.daysOnDuty}
                  </strong>
                </div>

                <div className="flex justify-between border-b border-slate-250 pb-1">
                  <span className="text-slate-500 uppercase font-bold text-[9.5px]">Total of Hours on duty (ชั่วโมงอยู่เวรกะ) :</span>
                  <strong className="text-slate-900 font-mono text-right border-b border-slate-800 px-3 min-w-16 block text-slate-500">
                    {computedSheetStats.hoursOnDuty}
                  </strong>
                </div>

                <div className="flex justify-between items-center border-b border-slate-250 pb-1 h-[26px]">
                  <span className="text-[#B45309] dark:text-amber-700 uppercase font-bold text-[9.5px]">Total Day off / Take Leave (ลารวม/วันหยุดสะสม) :</span>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    placeholder="0.0"
                    className="w-20 text-right bg-amber-50 dark:bg-amber-950/20 border border-amber-300 font-mono text-[#B45309] text-xs font-bold rounded-sm px-2 py-0.5 focus:outline-hidden focus:ring-1 focus:ring-amber-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    value={(() => {
                      const empId = activeEmployee?.id || employeeCodeInput || '';
                      const key = `${empId}_${selectedYear}_${selectedMonth}`;
                      return manualLeaveDays[key] !== undefined ? manualLeaveDays[key] : computedSheetStats.totalDayOffOrLeaves;
                    })()}
                    onChange={(e) => {
                      const empId = activeEmployee?.id || employeeCodeInput || '';
                      if (!empId) return;
                      const val = e.target.value;
                      const key = `${empId}_${selectedYear}_${selectedMonth}`;
                      const updated = { ...manualLeaveDays, [key]: val };
                      setManualLeaveDays(updated);
                      localStorage.setItem('thai_ot_manual_leave_days', JSON.stringify(updated));
                    }}
                  />
                </div>
              </div>
            </div>

            {/* ======================================================== */}
            {/* AUTHENTIC SIGNATURES BLOCK */}
            {/* ======================================================== */}
            <div className="grid grid-cols-4 gap-4 pt-4 text-center text-xs text-slate-800 font-medium">
              
              {/* Box 1: Issued By */}
              <div className="border border-slate-300 p-2.5 rounded bg-slate-50/50 flex flex-col justify-between h-[115px]">
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">Issued by :</span>
                <div className="flex flex-col items-center">
                  <span className="font-serif italic text-slate-650 mb-0.5" style={{ fontFamily: 'Dancing Script, cursive' }}>{issuedByInput}</span>
                  <input
                    type="text"
                    value={issuedByInput}
                    onChange={(e) => setIssuedByInput(e.target.value)}
                    className="border-b border-slate-300 bg-transparent text-center text-slate-900 font-bold focus:outline-hidden font-sans text-[11px] w-full max-w-[120px]"
                  />
                  <div className="text-[8px] text-slate-400 mt-1 uppercase">Date: {endDate.split('-').reverse().join('/')}</div>
                </div>
              </div>

              {/* Box 2: Checked By */}
              <div className="border border-slate-300 p-2.5 rounded bg-slate-50/50 flex flex-col justify-between h-[115px]">
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">Check by :</span>
                <div className="flex flex-col items-center">
                  <span className="font-serif italic text-slate-650 mb-0.5" style={{ fontFamily: 'Dancing Script, cursive' }}>{checkedByInput}</span>
                  <input
                    type="text"
                    value={checkedByInput}
                    onChange={(e) => setCheckedByInput(e.target.value)}
                    className="border-b border-slate-300 bg-transparent text-center text-slate-900 font-bold focus:outline-hidden font-sans text-[11px] w-full max-w-[120px]"
                  />
                  <div className="text-[8px] text-slate-400 mt-1 uppercase">Date: {endDate.split('-').reverse().join('/')}</div>
                </div>
              </div>

              {/* Box 3: Approval */}
              <div className="border border-slate-300 p-2.5 rounded bg-slate-50/50 flex flex-col justify-between h-[115px]">
                <div className="flex items-center justify-center gap-1">
                  <span className="text-[10px] text-emerald-600 uppercase font-extrabold tracking-wider block">Approval :</span>
                  <span className="text-[8px] bg-emerald-100 text-emerald-700 px-1 py-0.2 rounded-sm border border-emerald-200">Corporate</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="font-serif italic text-emerald-600 font-black mb-0.5">Apiyut N.</span>
                  <input
                    type="text"
                    value={approvedByInput}
                    onChange={(e) => setApprovedByInput(e.target.value)}
                    className="border-b border-slate-300 bg-transparent text-center text-emerald-700 font-extrabold focus:outline-hidden font-sans text-[11px] w-full max-w-[120px]"
                  />
                  <div className="text-[8px] text-slate-400 mt-1 uppercase">Date: {endDate.split('-').reverse().join('/')}</div>
                </div>
              </div>

              {/* Box 4: Employee */}
              <div className="border border-slate-300 p-2.5 rounded bg-slate-50/50 flex flex-col justify-between h-[115px]">
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">Employee Signature:</span>
                <div className="flex flex-col items-center">
                  <span className="text-slate-400 select-none pb-1 font-mono text-[9px] block mb-1">Underline Signature</span>
                  <div className="border-b border-slate-300 w-full max-w-[125px] h-0"></div>
                  <div className="text-[9.5px] font-bold text-slate-700 mt-1.5 truncate max-w-[130px]" title={selectedEmpName}>
                    : {selectedEmpName}
                  </div>
                  <div className="text-[8px] text-slate-400 uppercase mt-0.5">Date: __/__/____</div>
                </div>
              </div>
            </div>

            {/* Custom sheet printing footer line */}
            <div className="mt-6 pt-2 border-t border-slate-250 text-right text-[8px] text-slate-400 font-mono uppercase tracking-widest hidden print:block">
              : {selectedEmpName} • CONFIDENTIAL TIMESHEET LOG REPORT
            </div>

          </div>
        </div>
      )}

      {/* 5. TAB VIEW: DAILY EARNINGS BREAKDOWN */}
      {activeSubTab === 'daily-breakdown' && (
        !isSubTabsUnlocked ? (
          <SubTabPasscodeLock
            onUnlock={() => setIsSubTabsUnlocked(true)}
            isDark={isDark}
            title="ระบบวิเคราะห์ผลประโยชน์รายวันได้รับการคุ้มครองสิทธิ"
            description="กรุณาใส่รหัสผ่านเพื่อเข้าสู่รายงานเจาะลึกรายรับรายวันของพนักงานทุกคน"
          />
        ) : (
          <div className="space-y-4 font-sans animate-fade-in">
            <div className={`p-4 rounded-sm border flex items-center justify-between transition-all duration-200 print:hidden ${
              isDark ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-bold font-sans">✓ สิทธิพนักงานเปิดเข้าถึงเจาะลึกรายรับรายวัน (Daily Earnings) เรียบร้อย (Unlocked)</span>
              </div>
              <button
                onClick={() => setIsSubTabsUnlocked(false)}
                className="bg-red-500 hover:bg-red-600 text-white font-extrabold text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-sm cursor-pointer transition-all active:scale-[0.98] font-sans"
              >
                ล็อคระบบความปลอดภัย / LOCK
              </button>
            </div>

            <div className="space-y-4">
          
          {/* Action Header controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-2 bg-black/10 p-4 border rounded border-white/5 print:hidden">
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                onClick={exportWagesCSV}
                className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-white/5 dark:hover:bg-white/10 dark:text-gray-300 font-bold text-xs py-2 px-4 rounded-sm transition-all border border-slate-200 dark:border-white/15 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                ส่งออก CSV รายรับ
              </button>
              
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-white/5 dark:hover:bg-white/10 dark:text-gray-300 font-bold text-xs py-2 px-4 rounded-sm transition-all border border-slate-200 dark:border-white/15 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                ส่งออก PDF / พิมพ์หน้านี้
              </button>

              <button
                onClick={handleSyncToSupabase}
                disabled={isSaving}
                className="flex items-center gap-1.5 bg-[#D4AF37] hover:bg-amber-400 text-black font-extrabold text-xs py-2 px-5 rounded-sm transition-all cursor-pointer shadow-md shadow-amber-500/5 disabled:opacity-40"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    กำลังบันทึกข้อมูล...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    บันทึกลงฐานข้อมูล
                  </>
                )}
              </button>
            </div>
          </div>

          {/* SPREADSHEET CANVAS */}
          <div className="w-full bg-white text-slate-900 border border-slate-300 shadow-sm p-4 md:p-6 rounded-xs print:p-0 print:border-none print:shadow-none font-sans">
            
            {/* Header Identity Block matching IKM header */}
            <div className="flex justify-between items-start border-b border-slate-950 pb-5 mb-5 md:flex-row flex-col gap-4">
              <div className="flex items-start gap-4 flex-1">
                <img 
                  src="https://lh3.googleusercontent.com/d/1HMZ8z-TK8bmpxuA3b4nu2ybopYiz-yGN" 
                  className="h-12 w-auto object-contain shrink-0 mt-1" 
                  alt="IKM Testing Logo" 
                  referrerPolicy="no-referrer" 
                />
                <div className="space-y-1">
                  <div className="text-[10px] font-extrabold text-[#D4AF37] tracking-wider uppercase">COMPANY REVENUE BREAKDOWN REPORT</div>
                  <h1 className="text-sm md:text-base font-serif font-black tracking-wide text-black uppercase leading-tight">
                    IKM Testing (Thailand) Co., Ltd.
                  </h1>
                  <p className="text-[9px] text-slate-500 font-medium leading-relaxed font-mono">
                    155/167 Moo 5. Samnakthon Sub-district, Banchang District, Rayong 21130 Thailand.
                  </p>
                  <div className="pt-1">
                    <span className="bg-[#D4AF37] text-black font-extrabold px-2 py-0.5 text-[8.5px] uppercase tracking-wider rounded-xs select-none">
                      DAILY EARNINGS SHEET
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Sub header employee identity cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50 border border-slate-200 p-4 mb-5 text-[11px] text-slate-900 rounded-sm font-sans">
              <div className="space-y-1.5">
                <div className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Employee Information / ข้อมูลพนักงาน</div>
                <div>รหัสพนักงาน: <strong className="font-mono text-black text-xs">{employeeCodeInput || activeEmployee?.id}</strong></div>
                <div>ชื่อ-นามสกุล : <strong className="text-black text-xs">{activeEmployee?.employeeName}</strong></div>
              </div>
              <div className="space-y-1.5">
                <div className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Position & Rates / ตำแหน่งงานและประเภทอัตรา</div>
                <div>ตำแหน่งงาน: <strong className="text-black text-xs">{positionInput}</strong></div>
                <div>ประเภทการจ้าง: <strong className="text-black text-xs">{activeEmployee?.workScheduleType === 'staff' ? 'พนักงานประจำ (Staff)' : 'ผู้รับจ้างรายวัน (Daily Worker)'}</strong></div>
              </div>
              <div className="space-y-1.5">
                <div className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Account Transfer / เลขที่บัญชีชำระเงิน</div>
                <div>ธนาคารผู้โอน: <strong className="text-black text-xs">{activeEmployee?.bankName || 'ธนาคารกสิกรไทย (K-Bank)'}</strong></div>
                <div>เลขบัญชีโอน: <strong className="font-mono text-black text-xs">{activeEmployee?.bankAccount || 'xxx-x-xx551-x'}</strong></div>
              </div>
            </div>

            {/* Earnings Sheet Table Grid */}
            <div className="border border-slate-400 overflow-hidden mb-6 rounded-xs">
              <table className="w-full text-left text-xs text-slate-900 table-fixed border-collapse">
                
                <thead className="bg-slate-100 text-slate-700 text-[10px] uppercase font-bold text-center border-b border-slate-400 font-mono tracking-tight">
                  <tr className="divide-x divide-slate-400 text-[9.5px]">
                    <th className="py-2 px-1.5 w-[110px] shrink-0">วัน (Day)</th>
                    <th className="py-2 px-0.5 w-[65px] shrink-0">วันที่ (Date)</th>
                    <th className="py-2 px-1 w-[90px] text-sky-850">ค่าแรงทำงานวันปกติ (บาท)</th>
                    <th className="py-2 px-1 w-[90px] text-emerald-850">รวมโอที (บาท)</th>
                    <th className="py-2 px-1 w-[110px] text-slate-900 font-extrabold bg-slate-50">รวมค่าแรง + โอที (บาท)</th>
                    <th className="py-2 px-1 w-[80px] text-[#8b5cf6]">Confine space</th>
                    <th className="py-2 px-1 w-[80px] text-pink-750">Incentive</th>
                    <th className="py-2 px-1 w-[80px] text-amber-750">Perdiem</th>
                    <th className="py-2 px-1 w-[125px] text-emerald-950 font-black bg-emerald-50">รวมค่าแรง + โอที + สวัสดิการ (บาท)</th>
                    <th className="py-2 px-1 w-[110px]">ชื่อ Job / หมายเหตุ (Job Reference)</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200">
                  {tableRows.map((rowItem) => {
                    const { draft, rowId, dStr, suppKey, isMulti } = rowItem;
                    const supp = supplements[suppKey] || supplements[`${employeeCodeInput}_${dStr}`] || { perdiem: 0, advance: 0, jobBonus: 0, confineSpace: 0, incentive: 0, remarkOverride: '' };

                    const dateObj = new Date(dStr);
                    const dayNum = dateObj.getDate();
                    const dayOfWeekStr = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
                    const thaiDayName = getThaiDayName(dayOfWeekStr);
                    
                    const dayVal = dateObj.getDay();
                    const isSunday = dayVal === 0;
                    const isSaturday = dayVal === 6;

                    // Public Holiday matching check
                    const optHoliday = holidays.find(h => h.holidayDate === dStr);
                    const isPubHoliday = !!optHoliday;

                    // Compute specific OT Value and daily rate pay
                    const isStaff = activeEmployee?.workScheduleType === 'staff' || activeEmployee?.workScheduleType === 'monthly_worker';
                    let localDayRate = activeEmployee?.workshopRate || 0;
                    const proj = (draft.project || '').toLowerCase().trim();
                    const isOffshore = proj.includes('offshore');
                    const isWfh = proj.includes('wfh') || proj.includes('home');
                    const isWorkshop = proj.includes('workshop');
                    const isOnsite = proj.includes('onsite') || (proj !== '' && !isWorkshop && !isOffshore && !isWfh);

                    if (isOnsite) {
                      localDayRate = activeEmployee?.onsiteRate || 0;
                    } else if (isOffshore) {
                      localDayRate = activeEmployee?.offshoreRate || 0;
                    } else if (isWfh) {
                      localDayRate = activeEmployee?.wfhRate || 0;
                    }

                    const localHourlyRate = isStaff ? hourlyRate : Number((localDayRate / (settings.defaultWorkHours || 8)).toFixed(2));

                    const itemOt15 = draft.ot15Hours || 0;
                    const itemOt20 = draft.ot20Hours || 0;
                    const itemOt30 = draft.ot30Hours || 0;
                    const ot20RateActual = isStaff ? 1.0 : (settings?.ot20Rate || 2.0);
                    const otPay = isOffshore ? 0 : (itemOt15 * 1.5 + itemOt20 * ot20RateActual + itemOt30 * 3.0) * localHourlyRate;
                    
                    const normalPay = (draft.normalHours || 0) * localHourlyRate;
                    const combWageOt = normalPay + otPay;

                    const confineVal = Number(supp.confineSpace || 0);
                    const incentiveVal = Number(supp.incentive || 0);
                    
                    const perdiemVal = Number(supp.perdiem || 0);
                    const finalTotalEarning = combWageOt + confineVal + incentiveVal + perdiemVal;

                    // Styles for Saturday / Sunday / Holiday matching image perfectly
                    let rowBgClass = 'bg-white';
                    let dayTextClass = 'text-slate-700 font-medium';
                    
                    if (isPubHoliday) {
                      rowBgClass = 'bg-[#FFFEA3] print:bg-[#FFFEA3]'; // Bright Gold Canary Yellow
                      dayTextClass = 'text-amber-800 font-extrabold';
                    } else if (isSaturday) {
                      rowBgClass = 'bg-[#ECECEC]/70 print:bg-[#ECECEC]/60'; // Gray
                      dayTextClass = 'text-purple-700 font-bold';
                    } else if (isSunday) {
                      rowBgClass = 'bg-[#ECECEC]/70 print:bg-[#ECECEC]/60'; // Gray
                      dayTextClass = 'text-red-650 font-bold';
                    }

                    // Checks Leave style
                    const defaultRemark = optHoliday ? optHoliday.holidayName : '';
                    let projectText = draft.project || '';
                    if (projectText.toLowerCase() === 'workshop') {
                      projectText = '';
                    }
                    if (!(draft.timeIn && draft.timeOut)) {
                      projectText = '';
                    }
                    const finalRemark = supp.remarkOverride || projectText || draft.remark || defaultRemark;
                    const labelLower = finalRemark.toLowerCase();
                    const isLeaveDay = labelLower.includes('leave') || labelLower.includes('ลา');
                    if (isLeaveDay) {
                      rowBgClass = 'bg-[#FEEDD1]'; // Sand / Soft peach
                    }

                    const dayRows = tableRows.filter(r => r.dStr === dStr);
                    const isFirstRowOfDay = dayRows[0]?.rowId === rowId;

                    return (
                      <tr 
                        key={rowId} 
                        className={`divide-x divide-slate-200 text-center text-[11px] h-9 hover:bg-slate-50/50 print:hover:none ${rowBgClass}`}
                      >
                        {/* Day of Week */}
                        {isFirstRowOfDay ? (
                          <td className={`py-1 px-1.5 text-left font-sans text-[10.5px] ${dayTextClass}`} rowSpan={dayRows.length}>
                            {thaiDayName}
                          </td>
                        ) : null}

                        {/* Date Number */}
                        {isFirstRowOfDay ? (
                          <td className="py-1 px-0.5 font-mono text-center font-bold text-slate-800 text-[10.5px]" rowSpan={dayRows.length}>
                            {formatThaiDate(dStr)}
                          </td>
                        ) : null}

                        {/* ค่าแรงทำงานวันปกติ */}
                        <td className="py-1 px-1 font-mono text-right text-sky-850 font-semibold pr-2">
                          {normalPay > 0 ? normalPay.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '—'}
                        </td>

                        {/* รวมโอที */}
                        <td className="py-1 px-1 font-mono text-right text-emerald-850 font-semibold pr-2">
                          {otPay > 0 ? otPay.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '—'}
                        </td>

                        {/* รวมค่าแรง + โอที */}
                        <td className="py-1 px-1 font-mono text-right font-bold text-slate-900 bg-slate-50/40 pr-2">
                          {combWageOt > 0 ? combWageOt.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '—'}
                        </td>

                        {/* Confine Space Input */}
                        <td className="py-0.5 px-0.5 bg-violet-50/10">
                          <input
                            type="number"
                            placeholder="0"
                            value={supp.confineSpace || ''}
                            onChange={(e) => handleSupplementChange(suppKey, 'confineSpace', parseFloat(e.target.value) || 0)}
                            className="w-full text-right py-1 px-1.5 bg-transparent border-0 border-b border-transparent hover:border-violet-300 focus:border-[#D4AF37] focus:outline-hidden font-mono font-bold text-violet-800 text-[11px] print:border-none print:p-0"
                          />
                        </td>

                        {/* Incentive Input */}
                        <td className="py-0.5 px-0.5 bg-pink-50/10">
                          <input
                            type="number"
                            placeholder="0"
                            value={supp.incentive || ''}
                            onChange={(e) => handleSupplementChange(suppKey, 'incentive', parseFloat(e.target.value) || 0)}
                            className="w-full text-right py-1 px-1.5 bg-transparent border-0 border-b border-transparent hover:border-pink-300 focus:border-[#D4AF37] focus:outline-hidden font-mono font-bold text-pink-750 text-[11px] print:border-none print:p-0"
                          />
                        </td>

                        {/* Perdiem Input */}
                        <td className="py-0.5 px-0.5 bg-amber-50/10">
                          <input
                            type="number"
                            placeholder="0"
                            value={supp.perdiem !== undefined ? supp.perdiem : ''}
                            onChange={(e) => {
                              const v = e.target.value === '' ? undefined : (parseFloat(e.target.value) || 0);
                              handleSupplementChange(suppKey, 'perdiem', v);
                            }}
                            className="w-full text-right py-1 px-1.5 bg-transparent border-0 border-b border-transparent hover:border-amber-300 focus:border-[#D4AF37] focus:outline-hidden font-mono font-bold text-amber-805 text-[11px] print:border-none print:p-0"
                          />
                        </td>

                        {/* รวมค่าแรง + โอที + สวัสดิการ */}
                        <td className="py-1 px-1 font-mono text-right font-black text-emerald-950 bg-emerald-50/70 pr-2.5 text-[11.5px]">
                          {finalTotalEarning > 0 ? finalTotalEarning.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '—'}
                        </td>

                        {/* Remarks Input */}
                        <td className="py-0.5 px-1 text-left">
                          <input
                            type="text"
                            placeholder="เช่น Workshop, Job XXX-XX..."
                            value={finalRemark}
                            onChange={(e) => handleSupplementChange(suppKey, 'remarkOverride', e.target.value)}
                            className="w-full text-left p-0.5 bg-transparent border-0 border-b border-transparent hover:border-slate-350 focus:border-[#D4AF37] focus:outline-hidden font-medium text-slate-700 text-[10px] italic truncate print:border-none print:p-0"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                {/* TABLE FOOTER SUM ROW */}
                <tfoot className="bg-slate-100 text-[10.5px] font-extrabold border-t border-slate-400 font-mono divide-y divide-slate-400 text-slate-900">
                  <tr className="divide-x divide-slate-400">
                    <td colSpan={2} className="py-2.5 px-4 text-right uppercase tracking-wider text-[9px] text-slate-600">รวมสะสม (Row Totals):</td>
                    
                    {/* Normal Pay sum */}
                    <td className="py-2.5 px-1 text-right text-sky-850 pr-2 font-mono font-bold bg-slate-50/40">
                      {computedWagesStats.grandNormalPay.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                    </td>

                    {/* OT Pay sum */}
                    <td className="py-2.5 px-1 text-right text-emerald-850 pr-2 font-mono font-bold bg-slate-50/40">
                      {computedWagesStats.grandOtPay.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                    </td>

                    {/* Wage + OT sum */}
                    <td className="py-2.5 px-1 text-right text-slate-950 pr-2 font-mono font-black bg-slate-100">
                      {computedWagesStats.grandCombinedWageOt.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                    </td>

                    {/* Confine Space sum */}
                    <td className="py-2.5 px-1 text-right text-violet-900 pr-2 font-mono bg-slate-50/20">
                      {computedWagesStats.grandConfineSpace.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                    </td>

                    {/* Incentive sum */}
                    <td className="py-2.5 px-1 text-right text-pink-900 pr-2 font-mono bg-slate-50/20">
                      {computedWagesStats.grandIncentive.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                    </td>

                    {/* Perdiem sum */}
                    <td className="py-2.5 px-1 text-right text-amber-900 pr-2 font-mono bg-slate-50/20">
                      {computedWagesStats.grandPerdiem.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                    </td>

                    {/* Welfare grand total */}
                    <td className="py-2.5 px-1 text-right text-emerald-950 pr-2.5 font-sans font-black bg-emerald-100 text-[12px]">
                      {computedWagesStats.grandWelfareTotal.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ฿
                    </td>

                    {/* Empty cell for remark */}
                    <td className="bg-slate-50" />
                  </tr>
                </tfoot>

              </table>
            </div>

            {/* Authentications Signature block */}
            <div className="grid grid-cols-4 gap-4 pt-4 text-center text-xs text-slate-800 font-medium">
              <div className="border border-slate-300 p-2.5 rounded bg-slate-50/50 flex flex-col justify-between h-[115px]">
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">Issued by :</span>
                <div className="flex flex-col items-center">
                  <span className="font-serif italic text-slate-650 mb-0.5" style={{ fontFamily: 'Dancing Script, cursive' }}>{issuedByInput}</span>
                  <input
                    type="text"
                    value={issuedByInput}
                    onChange={(e) => setIssuedByInput(e.target.value)}
                    className="border-b border-slate-300 bg-transparent text-center text-slate-900 font-bold focus:outline-hidden font-sans text-[11px] w-full max-w-[120px]"
                  />
                  <div className="text-[8px] text-slate-400 mt-1 uppercase">Date: {endDate.split('-').reverse().join('/')}</div>
                </div>
              </div>

              <div className="border border-slate-300 p-2.5 rounded bg-slate-50/50 flex flex-col justify-between h-[115px]">
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">Check by :</span>
                <div className="flex flex-col items-center">
                  <span className="font-serif italic text-slate-650 mb-0.5" style={{ fontFamily: 'Dancing Script, cursive' }}>{checkedByInput}</span>
                  <input
                    type="text"
                    value={checkedByInput}
                    onChange={(e) => setCheckedByInput(e.target.value)}
                    className="border-b border-slate-300 bg-transparent text-center text-slate-900 font-bold focus:outline-hidden font-sans text-[11px] w-full max-w-[120px]"
                  />
                  <div className="text-[8px] text-slate-400 mt-1 uppercase">Date: {endDate.split('-').reverse().join('/')}</div>
                </div>
              </div>

              <div className="border border-slate-300 p-2.5 rounded bg-slate-50/50 flex flex-col justify-between h-[115px]">
                <div className="flex items-center justify-center gap-1">
                  <span className="text-[10px] text-emerald-600 uppercase font-extrabold tracking-wider block">Approval :</span>
                  <span className="text-[8px] bg-emerald-100 text-emerald-700 px-1 py-0.2 rounded-sm border border-emerald-200">Corporate</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="font-serif italic text-emerald-600 font-black mb-0.5">Apiyut N.</span>
                  <input
                    type="text"
                    value={approvedByInput}
                    onChange={(e) => setApprovedByInput(e.target.value)}
                    className="border-b border-slate-300 bg-transparent text-center text-emerald-700 font-extrabold focus:outline-hidden font-sans text-[11px] w-full max-w-[120px]"
                  />
                  <div className="text-[8px] text-slate-400 mt-1 uppercase">Date: {endDate.split('-').reverse().join('/')}</div>
                </div>
              </div>

              <div className="border border-slate-300 p-2.5 rounded bg-slate-50/50 flex flex-col justify-between h-[115px]">
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">Employee Signature:</span>
                <div className="flex flex-col items-center">
                  <span className="text-slate-400 select-none pb-1 font-mono text-[9px]">Underline Signature</span>
                  <div className="border-b border-slate-300 w-full max-w-[125px] h-0"></div>
                  <div className="text-[9.5px] font-bold text-slate-700 mt-1.5 truncate max-w-[130px]" title={selectedEmpName}>
                    : {selectedEmpName}
                  </div>
                  <div className="text-[8px] text-slate-400 uppercase mt-0.5">Date: __/__/____</div>
                </div>
              </div>
            </div>

            {/* Print footer secret sign */}
            <div className="mt-6 pt-2 border-t border-slate-250 text-right text-[8px] text-slate-400 font-mono uppercase tracking-widest hidden print:block">
              : {selectedEmpName} • REVENUE AND WAGES BREAKDOWN REPORT
            </div>

          </div>
        </div>
          </div>
        )
      )}

      {activeSubTab === 'project-summary' && (
        <div className={`p-6 rounded-sm border ${bgCard} text-left space-y-6 animate-fade-in print:hidden`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-dashed border-gray-500/20 pb-4">
            <div>
              <h3 className="text-base font-serif uppercase tracking-wider text-amber-600 dark:text-[#D4AF37] flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-[#D4AF37]" />
                รายงานวิเคราะห์ต้นทุนกำลังคนและค่าตอบแทนแยกรายโครงการ (Project Summary Report)
              </h3>
              <p className="text-[11px] text-gray-400 mt-1">
                สรุปค่าแรงงานปกติ (Normal Wage), สะสมโอทีรายชิ้น (Accumulated OT) และเบี้ยเลี้ยงสะสม (Perdiem) แยกหมวดโครงการเป้าหมายในช่วงเวลา
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
              <button
                onClick={exportProjectSummaryCSV}
                disabled={projectSummaryData.length === 0}
                className="py-2 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-sm text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-xs"
              >
                <Download className="w-4 h-4" />
                ส่งออกรายงานแยกโครงการ (Excel)
              </button>
              
              <button
                onClick={() => window.print()}
                disabled={projectSummaryData.length === 0}
                className="py-2 px-4 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-sm text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-xs"
              >
                <Printer className="w-4 h-4" />
                พิมพ์รายงานแยกโครงการ (PDF)
              </button>
            </div>
          </div>

          {/* Filters Area Specific to Project Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 bg-slate-50/50 dark:bg-zinc-900/40 p-4 rounded-sm border border-slate-200/60 dark:border-white/5">
            {/* Employee selection (Multi-select) */}
            <div className="relative">
              <label className="block text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400 mb-1">
                กรองตามรายชื่อพนักงาน (Select Employees)
              </label>
              <button
                onClick={() => {
                  setIsProjEmpDropdownOpen(!isProjEmpDropdownOpen);
                  setIsProjDropdownOpen(false);
                }}
                className={`w-full text-left text-xs px-3 py-2 bg-transparent border rounded-sm flex items-center justify-between cursor-pointer focus:outline-hidden ${
                  isDark 
                    ? 'border-white/10 text-gray-150 bg-neutral-900 focus:border-[#D4AF37]' 
                    : 'border-slate-320 text-slate-800 bg-white focus:border-amber-600'
                }`}
              >
                <span className="truncate">
                  {selectedProjectEmployees.length === 0
                    ? 'เลือกพนักงานทั้งหมด'
                    : `เลือกแล้ว ${selectedProjectEmployees.length} คน`}
                </span>
                <span className="text-[10px] text-gray-400">▼</span>
              </button>

              {isProjEmpDropdownOpen && (
                <div className={`absolute left-0 right-0 mt-1 max-h-60 overflow-y-auto border rounded-xs shadow-xl z-25 p-2 ${
                  isDark ? 'bg-[#18181B] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'
                }`}>
                  <div className="flex justify-between items-center pb-2 mb-2 border-b border-dashed border-gray-500/20">
                    <button
                      onClick={() => setSelectedProjectEmployees([])}
                      className="text-[10px] font-bold text-red-500 hover:text-red-600 cursor-pointer"
                    >
                      ล้างค่าทั้งหมด (Clear)
                    </button>
                    <button
                      onClick={() => setSelectedProjectEmployees(employees.map(e => e.id))}
                      className="text-[10px] font-bold text-[#D4AF37] hover:text-amber-500 cursor-pointer"
                    >
                      เลือกทั้งหมด (Select All)
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {employees.map(emp => {
                      const isSelected = selectedProjectEmployees.includes(emp.id);
                      return (
                        <label
                          key={emp.id}
                          className={`flex items-center gap-2 px-2 py-1 rounded-sm text-xs cursor-pointer transition-all ${
                            isSelected 
                              ? 'bg-[#D4AF37]/10 text-amber-500 font-bold' 
                              : isDark ? 'hover:bg-white/5 text-gray-300' : 'hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              if (isSelected) {
                                setSelectedProjectEmployees(selectedProjectEmployees.filter(id => id !== emp.id));
                              } else {
                                setSelectedProjectEmployees([...selectedProjectEmployees, emp.id]);
                              }
                            }}
                            className="rounded-sm border-gray-300 text-amber-600 focus:ring-amber-500"
                          />
                          <span className="font-mono text-[10.5px] text-gray-500">{emp.id}</span>
                          <span className="truncate">{emp.employeeName}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Project selection (Multi-select) */}
            <div className="relative">
              <label className="block text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400 mb-1">
                กรองตามโครงการ (Select Projects)
              </label>
              <button
                onClick={() => {
                  setIsProjDropdownOpen(!isProjDropdownOpen);
                  setIsProjEmpDropdownOpen(false);
                }}
                className={`w-full text-left text-xs px-3 py-2 bg-transparent border rounded-sm flex items-center justify-between cursor-pointer focus:outline-hidden ${
                  isDark 
                    ? 'border-white/10 text-gray-150 bg-neutral-900 focus:border-[#D4AF37]' 
                    : 'border-slate-320 text-slate-800 bg-white focus:border-amber-600'
                }`}
              >
                <span className="truncate">
                  {selectedProjectList.length === 0
                    ? 'เลือกโครงการทั้งหมด'
                    : `เลือกแล้ว ${selectedProjectList.length} โครงการ`}
                </span>
                <span className="text-[10px] text-gray-400">▼</span>
              </button>

              {isProjDropdownOpen && (
                <div className={`absolute left-0 right-0 mt-1 max-h-60 overflow-y-auto border rounded-xs shadow-xl z-25 p-2 ${
                  isDark ? 'bg-[#18181B] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'
                }`}>
                  <div className="flex justify-between items-center pb-2 mb-2 border-b border-dashed border-gray-500/20">
                    <button
                      onClick={() => setSelectedProjectList([])}
                      className="text-[10px] font-bold text-red-500 hover:text-red-600 cursor-pointer"
                    >
                      ล้างค่าทั้งหมด (Clear)
                    </button>
                    <button
                      onClick={() => setSelectedProjectList([...uniqueProjects, 'Unspecified'])}
                      className="text-[10px] font-bold text-[#D4AF37] hover:text-amber-500 cursor-pointer"
                    >
                      เลือกทั้งหมด (Select All)
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {[...uniqueProjects, 'Unspecified'].map(proj => {
                      const isSelected = selectedProjectList.includes(proj);
                      return (
                        <label
                          key={proj}
                          className={`flex items-center gap-2 px-2 py-1 rounded-sm text-xs cursor-pointer transition-all ${
                            isSelected 
                              ? 'bg-[#D4AF37]/10 text-amber-500 font-bold' 
                              : isDark ? 'hover:bg-white/5 text-gray-300' : 'hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              if (isSelected) {
                                setSelectedProjectList(selectedProjectList.filter(p => p !== proj));
                              } else {
                                setSelectedProjectList([...selectedProjectList, proj]);
                              }
                            }}
                            className="rounded-sm border-gray-300 text-amber-600 focus:ring-amber-500"
                          />
                          <span className="truncate font-medium">{proj}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex items-end">
              <button
                onClick={() => {
                  setSelectedProjectEmployees([]);
                  setSelectedProjectList([]);
                }}
                className={`py-2 px-4 rounded-sm text-xs font-bold transition-all cursor-pointer border ${
                  isDark 
                    ? 'border-white/10 text-gray-400 hover:text-white bg-neutral-800 hover:bg-neutral-750' 
                    : 'border-slate-320 text-slate-600 hover:text-slate-800 bg-slate-50 hover:bg-slate-100'
                }`}
              >
                ล้างตัวกรองทั้งหมด (Clear All Filters)
              </button>
            </div>
          </div>

          {/* Executive Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Normal Wage */}
            <div className={`p-4 rounded-sm border flex items-center justify-between transition-all ${
              isDark ? 'bg-zinc-900/60 border-white/5' : 'bg-slate-50/50 border-slate-200 shadow-xs'
            }`}>
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-gray-400">ค่าแรงงานวันปกติรวม (Normal Wages)</span>
                <div className="text-lg font-mono font-bold text-blue-500">
                  {projectTotals.totalNormal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ฿
                </div>
              </div>
              <div className="p-2 bg-blue-500/10 text-blue-500 rounded-sm">
                <Clock className="w-5 h-5" />
              </div>
            </div>

            {/* Card 2: Total OT */}
            <div className={`p-4 rounded-sm border flex items-center justify-between transition-all ${
              isDark ? 'bg-zinc-900/60 border-white/5' : 'bg-slate-50/50 border-slate-200 shadow-xs'
            }`}>
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-gray-400">รวมค่าโอทีสะสม (Accumulated OT)</span>
                <div className="text-lg font-mono font-bold text-amber-500">
                  {projectTotals.totalOT.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ฿
                </div>
              </div>
              <div className="p-2 bg-amber-500/10 text-amber-500 rounded-sm">
                <Coins className="w-5 h-5" />
              </div>
            </div>

            {/* Card 3: Total Perdiem */}
            <div className={`p-4 rounded-sm border flex items-center justify-between transition-all ${
              isDark ? 'bg-zinc-900/60 border-white/5' : 'bg-slate-50/50 border-slate-200 shadow-xs'
            }`}>
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-gray-400">เบี้ยเลี้ยงสะสมรวม (Total Perdiem)</span>
                <div className="text-lg font-mono font-bold text-indigo-500">
                  {projectTotals.totalPerdiem.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ฿
                </div>
              </div>
              <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-sm">
                <Info className="w-5 h-5" />
              </div>
            </div>

            {/* Card 4: Grand Total */}
            <div className={`p-4 rounded-sm border flex items-center justify-between transition-all ${
              isDark ? 'bg-emerald-950/20 border-emerald-500/20' : 'bg-emerald-50/50 border-emerald-200 shadow-xs'
            }`}>
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-450">ค่าใช้จ่ายสุทธิโครงการรวม (Grand Total)</span>
                <div className="text-xl font-mono font-black text-emerald-600 dark:text-emerald-400">
                  {projectTotals.totalGrand.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ฿
                </div>
              </div>
              <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-sm">
                <UserCheck className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Charts area with layout */}
          {projectSummaryData.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Cost Breakdown Chart */}
              <div className={`p-5 rounded-sm border lg:col-span-7 space-y-4 ${
                isDark ? 'bg-zinc-900/30 border-white/5' : 'bg-slate-50/20 border-slate-200 shadow-xs'
              }`}>
                <div className="flex justify-between items-center pb-2 border-b border-dashed border-gray-500/10">
                  <h4 className="text-xs uppercase font-bold tracking-wider text-slate-400 dark:text-gray-300">
                    กราฟแสดงโครงสร้างค่าใช้จ่ายสะสมแยกตามโครงการ (Cost Component Breakdown)
                  </h4>
                  <span className="text-[9px] font-mono text-gray-500">STACKED BAR CHART</span>
                </div>
                <div className="overflow-x-auto">
                  <div className="min-w-[500px] h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={projectSummaryData}
                        margin={{ top: 20, right: 20, left: 10, bottom: 50 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"} />
                        <XAxis 
                          dataKey="project" 
                          stroke={isDark ? "#71717a" : "#64748b"}
                          tick={{ fontSize: 9 }}
                          angle={-25}
                          textAnchor="end"
                          interval={0}
                          height={60}
                        />
                        <YAxis 
                          stroke={isDark ? "#71717a" : "#64748b"}
                          tick={{ fontSize: 9 }}
                          tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`}
                        />
                        <Tooltip
                          contentStyle={{
                            background: isDark ? '#18181b' : '#ffffff',
                            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                            borderRadius: '2px',
                            color: isDark ? '#ffffff' : '#000000',
                            fontSize: '11px',
                            textAlign: 'left'
                          }}
                          formatter={(value: any) => [`${Number(value).toLocaleString()} ฿`]}
                        />
                        <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '10.5px' }} />
                        <Bar dataKey="normalWage" name="ค่าแรงปกติ (Normal)" stackId="a" fill="#3b82f6" />
                        <Bar dataKey="otWage" name="รวมโอที (OT)" stackId="a" fill="#f59e0b" />
                        <Bar dataKey="perdiem" name="เบี้ยเลี้ยง (Perdiem)" stackId="a" fill="#8350f2" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Pie Share Chart */}
              <div className={`p-5 rounded-sm border lg:col-span-5 space-y-4 ${
                isDark ? 'bg-zinc-900/30 border-white/5' : 'bg-slate-50/20 border-slate-200 shadow-xs'
              }`}>
                <div className="flex justify-between items-center pb-2 border-b border-dashed border-gray-500/10">
                  <h4 className="text-xs uppercase font-bold tracking-wider text-slate-400 dark:text-gray-300">
                    สัดส่วนค่าใช้จ่ายสะสมรวมโครงการ (%) (Total Budget Share)
                  </h4>
                  <span className="text-[9px] font-mono text-gray-500">DONUT PIE CHART</span>
                </div>
                <div className="flex flex-col sm:flex-row items-center justify-center h-80 gap-4">
                  <div className="w-full sm:w-1/2 h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={projectPieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {projectPieData.map((_entry, index) => (
                            <Cell key={`cell-${index}`} fill={['#3B82F6', '#10B981', '#F59E0B', '#6366F1', '#EC4899', '#8B5CF6', '#14B8A6', '#F43F5E'][index % 8]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            background: isDark ? '#18181b' : '#ffffff',
                            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                            borderRadius: '2px',
                            color: isDark ? '#ffffff' : '#000000',
                            fontSize: '11px'
                          }}
                          formatter={(value: any) => [`${Number(value).toLocaleString()} ฿`]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  {/* Custom Legend */}
                  <div className="w-full sm:w-1/2 overflow-y-auto max-h-56 space-y-2 text-[10px] pr-2">
                    {projectPieData.map((entry, index) => {
                      const totalBudget = projectTotals.totalGrand || 1;
                      const percentage = ((entry.value / totalBudget) * 100).toFixed(1);
                      return (
                        <div key={index} className="flex items-center justify-between gap-2 border-b border-dashed border-gray-500/5 pb-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span 
                              className="w-2.5 h-2.5 rounded-full shrink-0" 
                              style={{ backgroundColor: ['#3B82F6', '#10B981', '#F59E0B', '#6366F1', '#EC4899', '#8B5CF6', '#14B8A6', '#F43F5E'][index % 8] }} 
                            />
                            <span className="truncate font-semibold text-gray-600 dark:text-gray-300" title={entry.name}>
                              {entry.name}
                            </span>
                          </div>
                          <span className="font-mono font-bold text-gray-500 dark:text-gray-400 shrink-0">
                            {percentage}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Table Container */}
          <div className="overflow-x-auto border border-slate-200 dark:border-white/10 rounded-sm">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className={`${tableThStyle} uppercase text-[9.5px] font-bold tracking-widest`}>
                  <th className="py-3 px-4 font-extrabold text-[#D4AF37]">โครงการ (Project / Row Labels)</th>
                  <th className="py-3 px-4 text-right font-bold text-slate-800 dark:text-gray-300">ค่าแรงวันปกติ (Normal Wage)</th>
                  <th className="py-3 px-4 text-right font-bold text-amber-600 dark:text-amber-400">สะสมโอที (Total OT)</th>
                  <th className="py-3 px-4 text-right font-bold text-slate-705 dark:text-gray-305">รวมค่าแรง + โอที (Wage + OT)</th>
                  <th className="py-3 px-4 text-right font-bold text-indigo-500 dark:text-indigo-400">เบี้ยเลี้ยงสะสม (Perdiem)</th>
                  <th className="py-3 px-4 text-right font-black text-emerald-600 dark:text-emerald-450 bg-emerald-500/5 dark:bg-emerald-500/10 border-l border-slate-200 dark:border-white/10">รวมจ่ายสะสมสุทธิทั้งหมด (Grand Total)</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-white/5 bg-[#141414]' : 'divide-slate-100 bg-white'}`}>
                {projectSummaryData.length > 0 ? (
                  projectSummaryData.map((item, idx) => (
                    <tr key={idx} className={`${tableTrStyle} text-[11px] transition-all`}>
                      <td className="py-2.5 px-4 font-bold text-slate-850 dark:text-gray-100">{item.project}</td>
                      <td className="py-2.5 px-4 text-right font-mono text-gray-650 dark:text-gray-300">{item.normalWage.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ฿</td>
                      <td className="py-2.5 px-4 text-right font-mono text-amber-653 dark:text-[#D4AF37]">{item.otWage.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ฿</td>
                      <td className="py-2.5 px-4 text-right font-mono text-gray-650 dark:text-gray-400">{(item.normalWage + item.otWage).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ฿</td>
                      <td className="py-2.5 px-4 text-right font-mono text-indigo-600 dark:text-indigo-400 font-bold">{item.perdiem.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ฿</td>
                      <td className="py-2.5 px-4 text-right font-mono font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 dark:bg-emerald-500/10 border-l border-slate-200 dark:border-white/10">{item.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ฿</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-500">
                      ไม่พบข้อมูลโครงการในช่วงเวลา หรือไม่มีผู้ปฏิบัติงานตรงตามเงื่อนไขที่เลือก
                    </td>
                  </tr>
                )}
              </tbody>
              {projectSummaryData.length > 0 && (
                <tfoot className={`font-bold text-[10.5px] font-mono border-t ${isDark ? 'bg-black text-white border-white/10' : 'bg-slate-50 text-slate-800 border-slate-200'}`}>
                  <tr className="divide-x divide-slate-200 dark:divide-white/5">
                    <td className="py-3 px-4 text-right font-extrabold text-slate-500">รวมสุทธิทั้งหมด (Grand Totals):</td>
                    <td className="py-3 px-4 text-right font-mono text-slate-900 dark:text-white">
                      {projectSummaryData.reduce((sum, item) => sum + item.normalWage, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ฿
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-amber-653 dark:text-[#D4AF37]">
                      {projectSummaryData.reduce((sum, item) => sum + item.otWage, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ฿
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-650 dark:text-gray-400">
                      {projectSummaryData.reduce((sum, item) => sum + item.combinedWageOt, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ฿
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-indigo-600 dark:text-indigo-400">
                      {projectSummaryData.reduce((sum, item) => sum + item.perdiem, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ฿
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 dark:bg-emerald-500/10">
                      {projectSummaryData.reduce((sum, item) => sum + item.grandTotal, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ฿
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* 4. HIGH FIDELITY MULTI-EMPLOYEE BATCH PRINT / SINGLE VIEW PORTRAIT OVERLAY FOR A4 PRINTING */}
      {createPortal(
        <div id="print-backdrop-container" className="hidden print:block bg-white text-black p-0 m-0 w-full">
          {/* Style tag to enforce perfect A4 Vertical/Portrait format rules when printing */}
          <style dangerouslySetInnerHTML={{ __html: `
            @media print {
              @page {
                size: A4 portrait;
                margin: 8mm 8mm 8mm 8mm !important;
              }
              body {
                background: white !important;
                color: text-black !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              #root {
                display: none !important;
                visibility: hidden !important;
              }
              #print-backdrop-container,
              #print-backdrop-container * {
                visibility: visible !important;
              }
              #print-backdrop-container {
                display: block !important;
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                background: white !important;
                color: black !important;
                margin: 0 !important;
                padding: 0 !important;
              }
              @keyframes fade-in {
                from { opacity: 0; }
                to { opacity: 1; }
              }
              .print-page-break {
                page-break-after: always !important;
                break-after: page !important;
              display: block !important;
              margin: 0 !important;
              padding: 0 !important;
              border: none !important;
              background: white !important;
              color: black !important;
            }
            /* Styling tables to stay neat and fit on portrait */
            table {
              border-collapse: collapse !important;
              width: 100% !important;
              table-layout: fixed !important;
            }
            th, td {
              border-color: #334155 !important; /* slate-700 */
              font-size: 8px !important;
              padding: 1.5px 0.5px !important;
              color: #000000 !important;
              border-style: solid !important;
              border-width: 1px !important;
            }
            .print-project-table th, .print-project-table td {
              font-size: 8.5px !important;
              padding: 3px 2px !important;
            }
            input {
              border: none !important;
              outline: none !important;
              background: transparent !important;
              box-shadow: none !important;
              width: 100% !important;
              text-align: center !important;
              font-weight: bold !important;
              color: #000000 !important;
            }
          }
        ` }} />

        {/* If viewing project summary, render the beautiful project summary PDF page.
            Otherwise, loop for employee timesheets. */}
        {activeSubTab === 'project-summary' ? (
          <div className="bg-white text-slate-900 font-sans p-6 w-full max-w-[760px] mx-auto space-y-5" style={{ minHeight: '277mm' }}>
            {/* Header Block */}
            <div className="flex justify-between items-start border-b-2 border-slate-800 pb-2 mb-1">
              <div className="flex items-center gap-3">
                <img 
                  src="https://lh3.googleusercontent.com/d/1HMZ8z-TK8bmpxuA3b4nu2ybopYiz-yGN" 
                  className="h-10 w-auto object-contain shrink-0" 
                  alt="IKM Testing Logo" 
                  referrerPolicy="no-referrer" 
                />
                <div className="text-left">
                  <h1 className="text-xs font-black tracking-wider uppercase font-sans text-black leading-none">IKM Testing (Thailand) Co., Ltd.</h1>
                  <p className="text-[7.5px] text-slate-500 leading-tight font-semibold mt-1">155/167 Moo 5. Samnakthon Sub-district, Banchang District, Rayong 21130 Thailand.</p>
                </div>
              </div>

              <div className="text-right shrink-0">
                <div className="border border-dashed border-slate-400 px-3 py-0.5 text-center rounded bg-slate-50 font-bold max-w-44">
                  <span className="text-[7.5px] uppercase tracking-widest text-slate-500 block font-mono">Date Period</span>
                  <span className="text-[9.5px] text-slate-900 font-extrabold font-serif uppercase tracking-wider">
                    {startDate.split('-').reverse().join('/')} - {endDate.split('-').reverse().join('/')}
                  </span>
                </div>
              </div>
            </div>

            {/* Title */}
            <div className="text-center my-2">
              <h2 className="text-xs font-black tracking-widest uppercase border-b border-slate-900 inline-block px-4 pb-0.5" style={{ letterSpacing: '0.15em' }}>
                PROJECT SUMMARY COST REPORT
              </h2>
              <p className="text-[8.5px] text-slate-500 mt-0.5 font-bold">
                รายงานวิเคราะห์ต้นทุนกำลังคนและค่าตอบแทนแยกรายโครงการ
              </p>
            </div>

            {/* Financial Indicator Cards */}
            <div className="grid grid-cols-4 gap-2 text-left">
              <div className="border border-slate-300 p-2 rounded bg-slate-50/50">
                <span className="text-[7.5px] uppercase tracking-wider text-slate-500 font-bold block">Normal Wages</span>
                <span className="text-[10px] font-mono font-bold text-slate-900 block mt-0.5">
                  {projectTotals.totalNormal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ฿
                </span>
              </div>
              <div className="border border-slate-300 p-2 rounded bg-slate-50/50">
                <span className="text-[7.5px] uppercase tracking-wider text-slate-500 font-bold block">Accumulated OT</span>
                <span className="text-[10px] font-mono font-bold text-slate-900 block mt-0.5">
                  {projectTotals.totalOT.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ฿
                </span>
              </div>
              <div className="border border-slate-300 p-2 rounded bg-slate-50/50">
                <span className="text-[7.5px] uppercase tracking-wider text-slate-500 font-bold block">Total Perdiem</span>
                <span className="text-[10px] font-mono font-bold text-slate-900 block mt-0.5">
                  {projectTotals.totalPerdiem.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ฿
                </span>
              </div>
              <div className="border border-emerald-450 p-2 rounded bg-emerald-500/5">
                <span className="text-[7.5px] uppercase tracking-wider text-emerald-800 font-black block">Grand Total Cost</span>
                <span className="text-[11px] font-mono font-black text-emerald-800 block mt-0.5">
                  {projectTotals.totalGrand.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ฿
                </span>
              </div>
            </div>

            {/* Visual Charts Area */}
            {projectSummaryData.length > 0 && (
              <div className="grid grid-cols-12 gap-3 items-center">
                {/* Cost Breakdown Bar Chart */}
                <div className="col-span-7 border border-slate-200 p-2 rounded bg-slate-50/10 text-center">
                  <div className="text-[7.5px] uppercase font-bold text-slate-400 mb-1 tracking-wider">
                    Cost Component Breakdown (Top 10 Projects)
                  </div>
                  <div className="flex justify-center">
                    <BarChart
                      width={380}
                      height={120}
                      data={projectSummaryData.slice(0, 10)}
                      margin={{ top: 5, right: 10, left: 0, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="project" 
                        stroke="#475569"
                        tick={{ fontSize: 6.5 }}
                        angle={-15}
                        textAnchor="end"
                        interval={0}
                      />
                      <YAxis 
                        stroke="#475569"
                        tick={{ fontSize: 6.5 }}
                        tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`}
                      />
                      <Bar dataKey="normalWage" name="Normal" stackId="a" fill="#3b82f6" isAnimationActive={false} />
                      <Bar dataKey="otWage" name="OT" stackId="a" fill="#f59e0b" isAnimationActive={false} />
                      <Bar dataKey="perdiem" name="Perdiem" stackId="a" fill="#8350f2" isAnimationActive={false} />
                    </BarChart>
                  </div>
                </div>

                {/* Pie Share Chart */}
                <div className="col-span-5 border border-slate-200 p-2 rounded bg-slate-50/10">
                  <div className="text-[7.5px] uppercase font-bold text-slate-400 mb-1 tracking-wider text-center">
                    Total Budget Share (%)
                  </div>
                  <div className="flex items-center justify-between gap-1 h-[120px]">
                    <div className="shrink-0 flex items-center justify-center">
                      <PieChart width={110} height={110}>
                        <Pie
                          data={projectPieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={18}
                          outerRadius={38}
                          paddingAngle={2}
                          dataKey="value"
                          isAnimationActive={false}
                        >
                          {projectPieData.map((_entry, index) => (
                            <Cell key={`cell-${index}`} fill={['#3B82F6', '#10B981', '#F59E0B', '#6366F1', '#EC4899', '#8B5CF6', '#14B8A6', '#F43F5E'][index % 8]} />
                          ))}
                        </Pie>
                      </PieChart>
                    </div>
                    {/* Custom Compact Legend for Print */}
                    <div className="flex-1 overflow-hidden space-y-0.5 text-[7px] leading-none pr-1">
                      {projectPieData.slice(0, 6).map((entry, index) => {
                        const totalBudget = projectTotals.totalGrand || 1;
                        const percentage = ((entry.value / totalBudget) * 100).toFixed(1);
                        return (
                          <div key={index} className="flex items-center justify-between gap-1 border-b border-dashed border-slate-200 pb-0.5">
                            <div className="flex items-center gap-1 min-w-0">
                              <span 
                                className="w-1.5 h-1.5 rounded-full shrink-0" 
                                style={{ backgroundColor: ['#3B82F6', '#10B981', '#F59E0B', '#6366F1', '#EC4899', '#8B5CF6', '#14B8A6', '#F43F5E'][index % 8] }} 
                              />
                              <span className="truncate font-semibold text-slate-600" style={{ maxWidth: '65px' }}>
                                {entry.name}
                              </span>
                            </div>
                            <span className="font-mono font-bold text-slate-500 shrink-0">
                              {percentage}%
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Detailed Table */}
            <div className="border border-slate-400 overflow-hidden rounded-xs mt-1">
              <table className="w-full text-left text-[8px] text-slate-900 table-fixed border-collapse print-project-table">
                <thead className="bg-slate-100 text-slate-800 text-[7.5px] font-bold text-center border-b border-slate-400">
                  <tr className="divide-x divide-slate-400">
                    <th className="py-1 px-1.5 text-left font-extrabold w-[180px]">โครงการ (Project / Row Labels)</th>
                    <th className="py-1 px-1 text-right font-bold w-[90px]">ค่าแรงทำงานปกติ (Normal)</th>
                    <th className="py-1 px-1 text-right font-bold w-[80px]">สะสมโอที (OT)</th>
                    <th className="py-1 px-1 text-right font-bold w-[95px]">รวมค่าแรง + โอที (Wage+OT)</th>
                    <th className="py-1 px-1 text-right font-bold w-[80px]">เบี้ยเลี้ยง (Perdiem)</th>
                    <th className="py-1 px-1.5 text-right font-black w-[115px] bg-emerald-50 text-emerald-800">รวมสุทธิทั้งหมด (Grand Total)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {projectSummaryData.length > 0 ? (
                    projectSummaryData.map((item, idx) => (
                      <tr key={idx} className="divide-x divide-slate-200 text-[7.5px] h-5">
                        <td className="py-0.5 px-1.5 text-left font-bold text-slate-900 truncate">{item.project}</td>
                        <td className="py-0.5 px-1 text-right font-mono text-slate-800">{item.normalWage.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ฿</td>
                        <td className="py-0.5 px-1 text-right font-mono text-slate-800">{item.otWage.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ฿</td>
                        <td className="py-0.5 px-1 text-right font-mono text-slate-500">{(item.normalWage + item.otWage).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ฿</td>
                        <td className="py-0.5 px-1 text-right font-mono text-indigo-850 font-bold">{item.perdiem.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ฿</td>
                        <td className="py-0.5 px-1.5 text-right font-mono font-black text-emerald-700 bg-emerald-500/5">{item.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ฿</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-4 text-center text-slate-400">No project data available.</td>
                    </tr>
                  )}
                </tbody>
                <tfoot className="bg-slate-50 font-mono text-[7.5px] font-bold text-center border-t-2 border-slate-800">
                  <tr className="divide-x divide-slate-200">
                    <td className="py-1 px-1.5 text-right font-extrabold text-slate-600">รวมสุทธิทั้งหมด (Grand Totals):</td>
                    <td className="py-1 px-1 text-right font-mono text-slate-900">
                      {projectTotals.totalNormal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ฿
                    </td>
                    <td className="py-1 px-1 text-right font-mono text-amber-900">
                      {projectTotals.totalOT.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ฿
                    </td>
                    <td className="py-1 px-1 text-right font-mono text-slate-500">
                      {projectTotals.totalCombined.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ฿
                    </td>
                    <td className="py-1 px-1 text-right font-mono text-indigo-900">
                      {projectTotals.totalPerdiem.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ฿
                    </td>
                    <td className="py-1 px-1.5 text-right font-mono font-black text-emerald-800 bg-emerald-50">
                      {projectTotals.totalGrand.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ฿
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Symmetric Signatures Panel */}
            <div className="grid grid-cols-3 gap-2 pt-2 text-center text-[7.5px] text-slate-800 font-medium border-t border-dashed border-slate-300 mt-3 font-sans">
              <div className="border border-slate-300 p-1.5 rounded bg-slate-50/30 flex flex-col justify-between h-[80px]">
                <span className="text-[7px] text-slate-500 uppercase font-bold tracking-wider block text-left">Issued by :</span>
                <div className="flex flex-col items-center">
                  <span className="font-serif italic text-slate-600 text-[9px]" style={{ fontFamily: 'Dancing Script, cursive' }}>{issuedByInput}</span>
                  <div className="border-b border-slate-300 w-full text-center font-bold text-slate-900 text-[8.5px] pb-0.5">
                    {issuedByInput}
                  </div>
                  <div className="text-[6px] text-slate-400 mt-0.5 uppercase font-mono">Date: {endDate.split('-').reverse().join('/')}</div>
                </div>
              </div>

              <div className="border border-slate-300 p-1.5 rounded bg-slate-50/30 flex flex-col justify-between h-[80px]">
                <span className="text-[7px] text-slate-500 uppercase font-bold tracking-wider block text-left">Check by :</span>
                <div className="flex flex-col items-center">
                  <span className="font-serif italic text-slate-600 text-[9px]" style={{ fontFamily: 'Dancing Script, cursive' }}>{checkedByInput}</span>
                  <div className="border-b border-slate-300 w-full text-center font-bold text-slate-900 text-[8.5px] pb-0.5">
                    {checkedByInput}
                  </div>
                  <div className="text-[6px] text-slate-400 mt-0.5 uppercase font-mono">Date: {endDate.split('-').reverse().join('/')}</div>
                </div>
              </div>

              <div className="border border-slate-300 p-1.5 rounded bg-slate-50/30 flex flex-col justify-between h-[80px]">
                <span className="text-[7px] text-emerald-750 uppercase font-bold tracking-wider block text-left">Approved by :</span>
                <div className="flex flex-col items-center">
                  <span className="font-serif italic text-emerald-600 font-black text-[9px]" style={{ fontFamily: 'Dancing Script, cursive' }}>{approvedByInput}</span>
                  <div className="border-b border-slate-300 w-full text-center font-black text-emerald-800 text-[8.5px] pb-0.5">
                    {approvedByInput}
                  </div>
                  <div className="text-[6px] text-slate-400 mt-0.5 uppercase font-mono">Date: {endDate.split('-').reverse().join('/')}</div>
                </div>
              </div>
            </div>

            {/* Custom footer line */}
            <div className="pt-1 border-t border-slate-200 text-right text-[6px] text-slate-400 font-mono uppercase tracking-widest block">
              IKM Testing (Thailand) • CONFIDENTIAL PROJECT SUMMARY REPORT
            </div>
          </div>
        ) : (
          (isBatchPrinting ? employees : [activeEmployee]).filter(Boolean).map((emp, empIdx, arr) => {
            if (!emp) return null;
            
            const empHourlyRate = getEmployeeHourlyRate(emp);
            const stats = getEmployeeSheetStats(emp, empHourlyRate);
            const empPosition = emp.position || 'พนักงาน';
            const empId = emp.id || '';
  
            const getEmpTableRows = (empName: string, empIdVal: string) => {
              const list: { draft: any; rowId: string; dStr: string; suppKey: string; isMulti: boolean }[] = [];
            renderedDates.forEach(dStr => {
              const dayDrafts = ((empName.toLowerCase().trim() === selectedEmpName?.toLowerCase().trim()
                ? Object.values(draftEntries)
                : entries
              ) as Partial<TimesheetEntry>[])
                .filter(e => {
                  if (!e) return false;
                  const matchEmp = e.employeeId ? e.employeeId === empIdVal : (e.employeeName && e.employeeName.toLowerCase().trim() === empName.toLowerCase().trim());
                  return matchEmp && e.date === dStr;
                })
                .sort((a, b) => (a.timeIn || '08:00').localeCompare(b.timeIn || '08:00'));

              if (dayDrafts.length === 0) {
                list.push({
                  draft: {
                    id: `draft-${dStr}`,
                    employeeName: empName,
                    date: dStr,
                    project: projectInput || '',
                    timeIn: '',
                    timeOut: '',
                    lunchDeduct: 1,
                    lunchOT: 0,
                    flatRate: emp.workScheduleType === 'staff',
                    normalHours: 0,
                    ot15Hours: 0,
                    ot20Hours: 0,
                    ot30Hours: 0,
                    remark: '',
                    status: 'Pending'
                  },
                  rowId: `draft-${dStr}`,
                  dStr,
                  suppKey: `${empIdVal}_${dStr}_draft-${dStr}`,
                  isMulti: false
                });
              } else {
                const isMulti = dayDrafts.length > 1;
                dayDrafts.forEach((draft, idx) => {
                  const rowId = draft.id ? (isMulti ? `${draft.id}_${idx}` : draft.id) : `${dStr}_${idx}`;
                  const suppKey = `${empIdVal}_${dStr}_${rowId}`;
                  list.push({
                    draft,
                    rowId,
                    dStr,
                    suppKey,
                    isMulti
                  });
                });
              }
            });
            return list;
          };
          
          return (
            <div 
              key={emp.id} 
              className={`bg-white text-slate-900 font-sans p-2 w-full max-w-[760px] mx-auto ${empIdx < arr.length - 1 ? 'print-page-break' : ''}`}
              style={{ minHeight: '277mm' /* standard A4 portrait height minus margin */ }}
            >
              {/* SHEET HEADER LAYOUT */}
              <div className="flex justify-between items-start border-b-2 border-slate-800 pb-2 mb-2">
                <div className="flex items-center gap-2">
                  <img 
                    src="https://lh3.googleusercontent.com/d/1HMZ8z-TK8bmpxuA3b4nu2ybopYiz-yGN" 
                    className="h-8 w-auto object-contain shrink-0" 
                    alt="IKM Testing Logo" 
                    referrerPolicy="no-referrer" 
                  />
                  <div className="text-left">
                    <h1 className="text-[11px] font-black tracking-wider uppercase font-sans text-black">IKM Testing (Thailand) Co., Ltd.</h1>
                    <p className="text-[7.5px] text-slate-500 leading-tight font-bold">155/167 Moo 5. Samnakthon Sub-district, Banchang District, Rayong 21130 Thailand.</p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="border border-dashed border-slate-400 px-3 py-0.5 text-center rounded bg-slate-50 font-bold max-w-40">
                    <span className="text-[7.5px] uppercase tracking-widest text-slate-500 block font-mono">Month Indicator</span>
                    <span className="text-[11px] text-slate-900 font-extrabold font-serif uppercase tracking-wider">{resolvedMonthIndicator}</span>
                  </div>
                </div>
              </div>

              {/* Centered Document Title */}
              <div className="text-center mb-3">
                <h2 className="text-sm font-black tracking-widest uppercase border-b border-slate-900 inline-block px-5 pb-0.5" style={{ letterSpacing: '0.25em' }}>
                  TIME SHEET
                </h2>
              </div>

              {/* METADATA TWO COLUMN GRID */}
              <div className="grid grid-cols-2 gap-x-5 gap-y-1.5 mb-3 text-[9px] text-left" style={{ gridTemplateColumns: '1.2fr 1fr' }}>
                <div className="space-y-1">
                  <div className="flex items-end gap-1">
                    <span className="font-extrabold text-slate-600 uppercase tracking-wider w-22 shrink-0">Name-Surname:</span>
                    <span className="border-b border-dashed border-slate-900 pb-0.5 w-full font-bold text-slate-900 pl-1 text-[10px]">
                      {emp.employeeName}
                    </span>
                  </div>
                  <div className="flex items-end gap-1">
                    <span className="font-extrabold text-slate-600 uppercase tracking-wider w-22 shrink-0">Position:</span>
                    <span className="border-b border-dashed border-slate-900 pb-0.5 w-full font-bold text-slate-900 pl-1">
                      {empPosition}
                    </span>
                  </div>
                  <div className="flex items-end gap-1">
                    <span className="font-extrabold text-slate-600 uppercase tracking-wider w-22 shrink-0">Location:</span>
                    <input
                      type="text"
                      value={empLocations[emp.id] ?? 'IKM Office'}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEmpLocations(prev => ({ ...prev, [emp.id]: val }));
                        localStorage.setItem(`timesheet_loc_${emp.id}`, val);
                        if (activeEmployee && emp.id === activeEmployee.id) {
                          setLocationInput(val);
                        }
                      }}
                      className="border-b border-dashed border-slate-900 pb-0.5 w-full font-bold bg-transparent text-slate-900 text-[10px] focus:outline-hidden pl-1 hover:bg-slate-50 text-left print:border-b"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-end gap-1">
                    <span className="font-extrabold text-slate-600 uppercase tracking-wider w-22 shrink-0">Employee Code:</span>
                    <span className="border-b border-dashed border-slate-900 pb-0.5 w-full font-bold text-slate-900 pl-1 font-mono">
                      {empId}
                    </span>
                  </div>
                  <div className="flex items-end gap-1">
                    <span className="font-extrabold text-slate-600 uppercase tracking-wider w-22 shrink-0">Date Submitted:</span>
                    <span className="border-b border-dashed border-slate-900 pb-0.5 w-full font-bold text-slate-900 pl-1 font-mono">
                      {endDate.split('-').reverse().join('/')}
                    </span>
                  </div>
                  <div className="flex items-end gap-1">
                    <span className="font-extrabold text-slate-600 uppercase tracking-wider w-22 shrink-0">Project / Services:</span>
                    <input
                      type="text"
                      value={empProjects[emp.id] ?? ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEmpProjects(prev => ({ ...prev, [emp.id]: val }));
                        localStorage.setItem(`timesheet_proj_${emp.id}`, val);
                        if (activeEmployee && emp.id === activeEmployee.id) {
                          setProjectInput(val);
                        }
                      }}
                      className="border-b border-dashed border-slate-900 pb-0.5 w-full font-bold bg-transparent text-slate-900 text-[10px] focus:outline-hidden pl-1 hover:bg-slate-50 text-left print:border-b"
                    />
                  </div>
                </div>
              </div>

              {/* SPREADSHEET MATRIX */}
              <div className="border border-slate-400 overflow-hidden mb-3 rounded-xs">
                <table className="w-full text-left text-[9px] text-slate-900 table-fixed border-collapse">
                  <thead className="bg-slate-100 text-slate-700 text-[7.5px] uppercase font-bold text-center border-b border-slate-400 font-mono tracking-tight">
                    <tr className="border-b border-slate-400 divide-x divide-slate-400 font-sans text-[7.5px] select-none text-slate-800">
                      <th className="py-1 px-1 w-[40px]" rowSpan={2}>Day</th>
                      <th className="py-1 px-0.5 w-[48px]" rowSpan={2}>Date</th>
                      <th className="py-0.5 px-0.5 bg-slate-50 font-mono" colSpan={3}>Working Time</th>
                      <th className="py-0.5 px-0.5 bg-slate-50 font-mono" colSpan={3}>Overtime</th>
                      <th className="py-1 px-0.5 text-[7.5px] w-[45px]" rowSpan={2}>Perdiem</th>
                      <th className="py-1 px-0.5 text-[7.5px] w-[40px]" rowSpan={2}>Confine /<br/>Other</th>
                      <th className="py-1 px-0.5 text-[7.5px] w-[40px]" rowSpan={2}>Incentive</th>
                      <th className="py-1 px-1 w-[69px]" rowSpan={2}>Job Ref</th>
                    </tr>
                    <tr className="divide-x divide-slate-440 divide-slate-400 font-sans text-[7.5px] select-none text-slate-800">
                      <th className="py-0.5 px-0.5 w-[30px] font-mono">Start</th>
                      <th className="py-0.5 px-0.5 w-[30px] font-mono">End</th>
                      <th className="py-0.5 px-0.5 w-[25px] text-sky-700">Total</th>
                      <th className="py-0.5 px-0.5 w-[22px] text-emerald-700">1.0</th>
                      <th className="py-0.5 px-0.5 w-[22px] text-amber-700">1.5</th>
                      <th className="py-0.5 px-0.5 w-[22px] text-red-700">3.0</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-300">
                    {getEmpTableRows(emp.employeeName, empId).map((rowItem) => {
                      const { draft, rowId, dStr, suppKey, isMulti } = rowItem;
                      const supp = supplements[suppKey] || supplements[`${empId}_${dStr}`] || { perdiem: 0, advance: 0, jobBonus: 0, remarkOverride: '' };

                      const dateObj = new Date(dStr);
                      const dayNum = dateObj.getDate();
                      const dayOfWeekStr = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
                      
                      const dayVal = dateObj.getDay();
                      const isSunday = dayVal === 0;
                      const isSaturday = dayVal === 6;

                      const optHoliday = holidays.find(h => h.holidayDate === dStr);
                      const isPubHoliday = !!optHoliday;

                      const itemOt15 = draft.ot15Hours || 0;
                      const itemOt20 = draft.ot20Hours || 0;
                      const itemOt30 = draft.ot30Hours || 0;
                      const isStaff = emp.workScheduleType === 'staff' || emp.workScheduleType === 'monthly_worker';
                      const ot20RateActual = isStaff ? 1.0 : (settings?.ot20Rate || 2.0);
                      const otDecimalEst = (itemOt15 * 1.5 + itemOt20 * ot20RateActual + itemOt30 * 3.0);
                      const otWageEstimated = otDecimalEst * empHourlyRate;

                      let rowBgClass = 'bg-white';
                      let dayTextClass = 'text-slate-700 font-medium';
                      
                      if (isPubHoliday) {
                        rowBgClass = 'bg-yellow-50';
                        dayTextClass = 'text-amber-800 font-bold';
                      } else if (isSaturday) {
                        rowBgClass = 'bg-slate-50';
                        dayTextClass = 'text-purple-700 font-medium';
                      } else if (isSunday) {
                        rowBgClass = 'bg-slate-50';
                        dayTextClass = 'text-red-650 font-medium';
                      }

                      const defaultRemark = optHoliday ? optHoliday.holidayName : '';
                      let projectText = draft.project || '';
                      if (projectText.toLowerCase() === 'workshop') {
                        projectText = '';
                      }
                      if (!(draft.timeIn && draft.timeOut)) {
                        projectText = '';
                      }
                      const finalRemark = supp.remarkOverride || projectText || draft.remark || defaultRemark;
                      const isLeaveDay = finalRemark.toLowerCase().includes('leave') || finalRemark.toLowerCase().includes('ลา');
                      if (isLeaveDay) {
                        rowBgClass = 'bg-orange-50/50';
                      }

                      const workHoursSum = (draft.normalHours || 0) + (draft.ot15Hours || 0) + (draft.ot20Hours || 0) + (draft.ot30Hours || 0);

                      const dayRows = getEmpTableRows(emp.employeeName, empId).filter(r => r.dStr === dStr);
                      const isFirstRowOfDay = dayRows[0]?.rowId === rowId;

                      const isAggComp = draft.id?.startsWith('agg-');

                      return (
                        <tr key={rowId} className={`divide-x divide-slate-200 text-center text-[7.5px] h-6 ${rowBgClass}`}>
                          {isFirstRowOfDay ? (
                            <td className={`py-0.5 px-0.5 text-left truncate font-sans text-[7.5px] ${dayTextClass}`} rowSpan={dayRows.length}>
                              {dayOfWeekStr}
                            </td>
                          ) : null}
                          {isFirstRowOfDay ? (
                            <td className="py-0.5 px-0.2 font-bold font-mono text-[7.5px]" rowSpan={dayRows.length}>
                              {formatThaiDate(dStr)}
                            </td>
                          ) : null}
                          <td className="py-0.5 px-0.2 font-mono text-[7px] font-bold">
                            {draft.timeIn || '—'}
                          </td>
                          <td className="py-0.5 px-0.2 font-mono text-[7.5px] font-bold">
                            {draft.timeOut || '—'}
                          </td>
                          <td className="py-0.5 px-0.2 font-mono font-bold text-sky-850 bg-slate-50/20 text-[7.5px]">
                            {(draft.timeIn && draft.timeOut) ? workHoursSum.toFixed(1) : '—'}
                          </td>
                          <td className="py-0.5 px-0.2 font-mono font-bold text-slate-800 text-[7.5px]">
                            {(draft.timeIn && draft.timeOut) ? (itemOt20 > 0 ? itemOt20.toFixed(1) : '—') : '—'}
                          </td>
                          <td className="py-0.5 px-0.2 font-mono font-medium text-amber-800 text-[7.5px]">
                            {(draft.timeIn && draft.timeOut) ? (itemOt15 > 0 ? itemOt15.toFixed(1) : '—') : '—'}
                          </td>
                          <td className="py-0.5 px-0.2 font-mono font-medium text-red-650 text-[7.5px]">
                            {(draft.timeIn && draft.timeOut) ? (itemOt30 > 0 ? itemOt30.toFixed(1) : '—') : '—'}
                          </td>
                          <td className="py-0.5 px-0.2 text-right font-mono font-bold text-[7.5px] pr-0.5">
                            {supp.perdiem > 0 ? supp.perdiem.toLocaleString() : '—'}
                          </td>
                          <td className="py-0.5 px-0.2 text-right font-mono text-[7.5px] pr-0.5">
                            {supp.advance > 0 ? supp.advance.toLocaleString() : '—'}
                          </td>
                          <td className="py-0.5 px-0.2 text-right font-mono font-bold text-slate-800 text-[7.5px] pr-0.5">
                            {supp.jobBonus > 0 ? supp.jobBonus.toLocaleString() : '—'}
                          </td>
                          <td className="py-0.5 px-0.5 text-left text-[7.5px] truncate italic font-medium text-slate-600">
                            {finalRemark || '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>

                  {/* SPREADSHEET FOOTER ROW TOTALS */}
                  <tfoot className="bg-slate-50 font-mono text-[7.5px] font-bold text-center border-t-2 border-slate-800">
                    <tr className="divide-x divide-slate-200">
                      <td colSpan={4} className="py-1 px-1.5 text-right uppercase font-bold text-[7.5px] pr-2">
                        Actual Total:
                      </td>
                      <td className="py-1 px-0.2 text-center font-mono font-black text-sky-800 text-[7.5px] bg-sky-50/40">
                        {stats.hoursWorked.toFixed(1)}
                      </td>
                      <td className="py-1 px-0.2 text-center font-mono font-bold">
                        {stats.ot20Sum > 0 ? stats.ot20Sum.toFixed(1) : '—'}
                      </td>
                      <td className="py-1 px-0.2 text-center font-mono text-amber-800">
                        {stats.ot15Sum > 0 ? stats.ot15Sum.toFixed(1) : '—'}
                      </td>
                      <td className="py-1 px-0.2 text-center font-mono text-red-750">
                        {stats.ot30Sum > 0 ? stats.ot30Sum.toFixed(1) : '—'}
                      </td>
                      <td className="py-1 px-0.2 text-right font-mono font-bold pr-0.5 bg-slate-50/40">
                        {stats.perdiemSum > 0 ? stats.perdiemSum.toLocaleString() : '—'}
                      </td>
                      <td className="py-1 px-0.2 text-right font-mono pr-0.5">
                        {stats.advanceSum > 0 ? stats.advanceSum.toLocaleString() : '—'}
                      </td>
                      <td className="py-1 px-0.2 text-right font-mono font-bold pr-0.5">
                        {stats.jobBonusSum > 0 ? stats.jobBonusSum.toLocaleString() : '—'}
                      </td>
                      <td className="py-1 px-0.5 bg-slate-100 italic font-medium text-[7px] text-slate-500 truncate">
                        IKM SIG
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* UNDER-SHEET STATS SUMMARY PANEL */}
              <div className="grid grid-cols-2 gap-x-5 gap-y-1 p-1.5 bg-slate-50 border border-slate-300 rounded text-[8.5px] text-slate-800 mb-2 font-medium text-left">
                <div className="space-y-0.5">
                  <div className="flex justify-between border-b border-slate-200 pb-0.5">
                    <span className="text-slate-500 uppercase font-bold text-[7.5px]">Day per Month (จำนวนวันในประเมิน):</span>
                    <strong className="text-slate-900 font-mono text-right min-w-10 block">
                      {stats.daysInPeriod.toFixed(1)}
                    </strong>
                  </div>
                  <div className="flex justify-between border-b border-slate-200 pb-0.5">
                    <span className="text-slate-500 uppercase font-bold text-[7.5px]">No. of Day worked (วันเข้าทำงานจริง):</span>
                    <strong className="text-slate-900 font-mono text-right min-w-10 block">
                      {stats.daysWorked.toFixed(1)}
                    </strong>
                  </div>
                  <div className="flex justify-between border-b border-slate-200 pb-0.5">
                    <span className="text-slate-500 uppercase font-bold text-[7.5px]">Total of hours worked (ชั่วโมงสะสมรวม):</span>
                    <strong className="text-slate-900 font-mono text-right min-w-10 block">
                      {stats.hoursWorked.toFixed(1)}
                    </strong>
                  </div>
                </div>

                <div className="space-y-0.5">
                  <div className="flex justify-between border-b border-slate-200 pb-0.5">
                    <span className="text-slate-500 uppercase font-bold text-[7.5px]">No. of days on duty (วันอยู่ในหน้าที่):</span>
                    <strong className="text-slate-400 font-mono text-right min-w-10 block">
                      —
                    </strong>
                  </div>
                  <div className="flex justify-between border-b border-slate-200 pb-0.5">
                    <span className="text-slate-500 uppercase font-bold text-[7.5px]">Total of Hours on duty (ชั่วโมงอยู่เวรกะ):</span>
                    <strong className="text-slate-400 font-mono text-right min-w-10 block">
                      —
                    </strong>
                  </div>
                  <div className="flex justify-between border-b border-slate-200 pb-0.5">
                    <span className="text-slate-500 uppercase font-bold text-[7.5px]">Total Day off / Take Leave (ลารวม/วันหยุดสะสม):</span>
                    <strong className="text-amber-800 font-mono text-right min-w-10 block">
                      {stats.totalDayOffOrLeaves.toFixed(1)}
                    </strong>
                  </div>
                </div>
              </div>

              {/* AUTHENTIC SIGNATURES BLOCK */}
              <div className="grid grid-cols-4 gap-2 pt-1 text-center text-[8px] text-slate-800 font-medium">
                <div className="border border-slate-300 p-1 rounded bg-slate-50/50 flex flex-col justify-between h-[75px]">
                  <span className="text-[7.5px] text-slate-500 uppercase font-bold tracking-wider block">Issued by:</span>
                  <div className="flex flex-col items-center">
                    <span className="font-serif italic text-slate-600 text-[8.5px]">{issuedByInput}</span>
                    <div className="border-b border-slate-300 w-full text-center font-bold text-slate-900 text-[8.5px]">
                       {issuedByInput}
                    </div>
                    <div className="text-[6px] text-slate-400 mt-0.5 uppercase font-mono">Date: {endDate.split('-').reverse().join('/')}</div>
                  </div>
                </div>

                <div className="border border-slate-300 p-1 rounded bg-slate-50/50 flex flex-col justify-between h-[75px]">
                  <span className="text-[7.5px] text-slate-500 uppercase font-bold tracking-wider block">Check by:</span>
                  <div className="flex flex-col items-center">
                    <span className="font-serif italic text-slate-600 text-[8.5px]">{checkedByInput}</span>
                    <div className="border-b border-slate-300 w-full text-center font-bold text-slate-900 text-[8.5px]">
                       {checkedByInput}
                    </div>
                    <div className="text-[6px] text-slate-400 mt-0.5 uppercase font-mono">Date: {endDate.split('-').reverse().join('/')}</div>
                  </div>
                </div>

                <div className="border border-slate-300 p-1 rounded bg-slate-50/50 flex flex-col justify-between h-[75px]">
                  <div className="flex items-center justify-center gap-0.5">
                    <span className="text-[7.5px] text-emerald-600 uppercase font-extrabold tracking-wider block">Approval:</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="font-serif italic text-emerald-600 font-black text-[8.5px]">{approvedByInput}</span>
                    <div className="border-b border-slate-300 w-full text-center font-extrabold text-emerald-700 text-[8.5px]">
                       {approvedByInput}
                    </div>
                    <div className="text-[6px] text-slate-400 mt-0.5 uppercase font-mono">Date: {endDate.split('-').reverse().join('/')}</div>
                  </div>
                </div>

                <div className="border border-slate-300 p-1 rounded bg-slate-50/50 flex flex-col justify-between h-[75px]">
                  <span className="text-[7.5px] text-slate-500 uppercase font-bold tracking-wider block">Employee Signature:</span>
                  <div className="flex flex-col items-center">
                    <div className="border-b border-slate-300 w-full max-w-[75px] h-2"></div>
                    <div className="text-[8px] font-bold text-slate-700 mt-1 truncate max-w-[85px]" title={emp.employeeName}>
                      : {emp.employeeName}
                    </div>
                    <div className="text-[6px] text-slate-400 uppercase mt-0.5">Date: __/__/____</div>
                  </div>
                </div>
              </div>

              {/* Custom sheet printing footer line */}
              <div className="mt-3 pt-1 border-t border-slate-200 text-right text-[6.5px] text-slate-400 font-mono uppercase tracking-widest block">
                : {emp.employeeName} • CONFIDENTIAL TIMESHEET LOG REPORT
              </div>
            </div>
          );
        }))}
      </div>,
      document.body
    )}

    </div>
  );
}
