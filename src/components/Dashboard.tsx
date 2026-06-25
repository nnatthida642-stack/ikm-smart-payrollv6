import React, { useState, useMemo } from 'react';
import { TimesheetEntry, Employee, Holiday } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { 
  Users, Clock, Calendar, Download, Search, AlertCircle, Coins
} from 'lucide-react';

interface DashboardProps {
  entries: TimesheetEntry[];
  employees: Employee[];
  holidays: Holiday[];
  isDark?: boolean;
}

export default function Dashboard({ entries, employees, holidays, isDark = true }: DashboardProps) {
  // Report period options
  const [reportType, setReportType] = useState<'monthly' | 'custom'>('monthly');
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-03'); // YYYY-MM format
  
  // Custom cycle options
  const [startDate, setStartDate] = useState<string>('2026-03-21');
  const [endDate, setEndDate] = useState<string>('2026-04-20');
  
  const [searchQuery, setSearchQuery] = useState('');

  // Filter entries based on timeframe
  const periodEntries = useMemo(() => {
    return entries.filter(entry => {
      if (!entry.date) return false;
      
      if (reportType === 'monthly') {
        return entry.date.startsWith(selectedMonth);
      } else {
        return entry.date >= startDate && entry.date <= endDate;
      }
    });
  }, [entries, reportType, selectedMonth, startDate, endDate]);

  // Aggregate stats per employee
  const employeeSummaries = useMemo(() => {
    const summaryMap: Record<string, {
      employeeName: string;
      id: string;
      position: string;
      scheduleType: string;
      entriesCount: number;
      normalHours: number;
      ot15Hours: number;
      ot20Hours: number;
      ot30Hours: number;
      totalOTHours: number;
      totalHours: number;
    }> = {};

    // Initialize all active employees
    employees.forEach(emp => {
      summaryMap[emp.employeeName] = {
        employeeName: emp.employeeName,
        id: emp.id,
        position: emp.position || 'พนักงาน',
        scheduleType: emp.workScheduleType === 'daily_worker' ? 'รายวัน' : 'รายเดือน',
        entriesCount: 0,
        normalHours: 0,
        ot15Hours: 0,
        ot20Hours: 0,
        ot30Hours: 0,
        totalOTHours: 0,
        totalHours: 0
      };
    });

    // Populate with entries
    periodEntries.forEach(entry => {
      const name = entry.employeeName;
      const proj = (entry.project || '').toLowerCase();
      const isOffshore = proj.includes('offshore');

      if (!summaryMap[name]) {
        summaryMap[name] = {
          employeeName: name,
          id: 'N/A',
          position: 'ทั่วไป',
          scheduleType: 'รายวัน',
          entriesCount: 0,
          normalHours: 0,
          ot15Hours: 0,
          ot20Hours: 0,
          ot30Hours: 0,
          totalOTHours: 0,
          totalHours: 0
        };
      }

      const summary = summaryMap[name];
      summary.entriesCount += 1;
      summary.normalHours += entry.normalHours;
      summary.ot15Hours += isOffshore ? 0 : entry.ot15Hours;
      summary.ot20Hours += isOffshore ? 0 : entry.ot20Hours;
      summary.ot30Hours += isOffshore ? 0 : entry.ot30Hours;
      summary.totalOTHours += (isOffshore ? 0 : (entry.ot15Hours + entry.ot20Hours + entry.ot30Hours));
      summary.totalHours += entry.normalHours + (isOffshore ? 0 : (entry.ot15Hours + entry.ot20Hours + entry.ot30Hours));
    });

    // Filter by search queries
    return Object.values(summaryMap)
      .map(s => ({
        ...s,
        normalHours: Number(s.normalHours.toFixed(2)),
        ot15Hours: Number(s.ot15Hours.toFixed(2)),
        ot20Hours: Number(s.ot20Hours.toFixed(2)),
        ot30Hours: Number(s.ot30Hours.toFixed(2)),
        totalOTHours: Number(s.totalOTHours.toFixed(2)),
        totalHours: Number(s.totalHours.toFixed(2))
      }))
      .filter(s => {
        const matchesSearch = s.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                              s.id.toLowerCase().includes(searchQuery.toLowerCase());
        const hasTime = s.entriesCount > 0;
        
        if (searchQuery) {
          return matchesSearch;
        }
        return hasTime;
      });
  }, [periodEntries, employees, searchQuery]);

  // Overall calculations
  const totalStats = useMemo(() => {
    let totalNormal = 0;
    let totalOT15 = 0;
    let totalOT20 = 0;
    let totalOT30 = 0;
    let activePersons = new Set<string>();

    // Load local storage states for accurate financial estimations
    let settings = {
      ot15Rate: 1.5,
      ot20Rate: 2.0,
      ot30Rate: 3.0,
      defaultDailyWage: 700,
      defaultWorkHours: 8
    };
    try {
      const saved = localStorage.getItem('thai_ot_settings');
      if (saved) settings = JSON.parse(saved);
    } catch (e) {}

    let allowances: Record<string, number> = {};
    try {
      const saved = localStorage.getItem('payroll_allowances');
      if (saved) allowances = JSON.parse(saved);
    } catch (e) {}

    let supplements: Record<string, any> = {};
    try {
      const saved = localStorage.getItem('thai_ot_individual_supplements');
      if (saved) supplements = JSON.parse(saved);
    } catch (e) {}

    let customTaxes: Record<string, number> = {};
    try {
      const saved = localStorage.getItem('payroll_custom_taxes');
      if (saved) customTaxes = JSON.parse(saved);
    } catch (e) {}

    let customStudentLoans: Record<string, number> = {};
    try {
      const saved = localStorage.getItem('payroll_custom_student_loans');
      if (saved) customStudentLoans = JSON.parse(saved);
    } catch (e) {}

    let deductions: Record<string, number> = {};
    try {
      const saved = localStorage.getItem('payroll_deductions');
      if (saved) deductions = JSON.parse(saved);
    } catch (e) {}

    let grandGrossIncome = 0;
    let grandNetIncome = 0;

    // Loop through each active employee to compute their gross income for this period
    employees.forEach(emp => {
      const empEntries = periodEntries.filter(e => e.employeeName.toLowerCase().trim() === emp.employeeName.toLowerCase().trim());
      if (empEntries.length === 0) return;

      activePersons.add(emp.employeeName);

      // Replicate PayrollSection calculations
      let baseNormalPay = 0;
      let transportAllowanceTotal = 0;
      let ot15Pay = 0;
      let ot20Pay = 0;
      let ot30Pay = 0;
      let hourlyRate = 0;

      const isStaff = emp.workScheduleType === 'staff';

      if (isStaff) {
        const salary = emp.officeSalary || emp.staffSalary || 0;
        baseNormalPay = salary;
        hourlyRate = Number((salary / 30 / settings.defaultWorkHours).toFixed(2));

        let runningOt15Pay = 0;
        let runningOt20Pay = 0;
        let runningOt30Pay = 0;

        empEntries.forEach(ent => {
          const proj = (ent.project || '').toLowerCase();
          const isOffshore = proj.includes('offshore');
          if (!isOffshore) {
            runningOt15Pay += ent.ot15Hours * hourlyRate * settings.ot15Rate;
            runningOt20Pay += ent.ot20Hours * hourlyRate * 1.0;
            runningOt30Pay += ent.ot30Hours * hourlyRate * settings.ot30Rate;
          }
        });

        ot15Pay = runningOt15Pay;
        ot20Pay = runningOt20Pay;
        ot30Pay = runningOt30Pay;
      } else {
        let dailyWorkerSum = 0;
        let runningOt15Pay = 0;
        let runningOt20Pay = 0;
        let runningOt30Pay = 0;
        let runningTransportAllowance = 0;

        empEntries.forEach(ent => {
          let dayRate = emp.workshopRate || 0;
          const proj = (ent.project || '').toLowerCase().trim();
          const isOffshore = proj.includes('offshore');
          const isWfh = proj.includes('wfh') || proj.includes('home');
          const isWorkshop = proj.includes('workshop');
          const isOnsite = proj.includes('onsite') || (proj !== '' && !isWorkshop && !isOffshore && !isWfh);
          
          if (isOnsite) {
            dayRate = emp.onsiteRate || 0;
          } else if (isOffshore) {
            dayRate = emp.offshoreRate || 0;
          } else if (isWfh) {
            dayRate = emp.wfhRate || 0;
          }

          dailyWorkerSum += dayRate * (ent.normalHours / settings.defaultWorkHours);

          if (!isOffshore) {
            const dayHourlyRate = Number((dayRate / settings.defaultWorkHours).toFixed(2));
            runningOt15Pay += ent.ot15Hours * dayHourlyRate * settings.ot15Rate;
            runningOt20Pay += ent.ot20Hours * dayHourlyRate * settings.ot20Rate;
            runningOt30Pay += ent.ot30Hours * dayHourlyRate * settings.ot30Rate;
          }
        });

        baseNormalPay = dailyWorkerSum;
        ot15Pay = runningOt15Pay;
        ot20Pay = runningOt20Pay;
        ot30Pay = runningOt30Pay;
      }

      let totalConfineSpace = 0;
      let totalIncentive = 0;
      let totalPerdiem = 0;

      // Generate the physical dates within range
      const periodDates: string[] = [];
      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const current = new Date(start);
        let safetyCount = 0;
        while (current <= end && safetyCount < 366) {
          const year = current.getFullYear();
          const month = String(current.getMonth() + 1).padStart(2, '0');
          const day = String(current.getDate()).padStart(2, '0');
          periodDates.push(`${year}-${month}-${day}`);
          current.setDate(current.getDate() + 1);
          safetyCount++;
        }
      }

      // Sum supplements over all physical dates in the period for this employee
      periodDates.forEach(dStr => {
        // Find if there are any drafts/entries for this employee on this day
        const dayDrafts = empEntries.filter(ent => ent.date === dStr);
        if (dayDrafts.length === 0) {
          const rowKey = `${emp.id}_${dStr}_draft-${dStr}`;
          const supp = supplements[rowKey] || supplements[`${emp.id}_${dStr}`];
          if (supp) {
            totalConfineSpace += Number(supp.confineSpace || 0);
            totalIncentive += Number(supp.incentive || 0);
            totalPerdiem += Number(supp.perdiem || 0);
          }
        } else {
          dayDrafts.forEach(draft => {
            const rowKey = draft.id ? `${emp.id}_${dStr}_${draft.id}` : `${emp.id}_${dStr}`;
            const supp = supplements[rowKey] || supplements[`${emp.id}_${dStr}`];
            if (supp) {
              totalConfineSpace += Number(supp.confineSpace || 0);
              totalIncentive += Number(supp.incentive || 0);
              totalPerdiem += Number(supp.perdiem || 0);
            }
          });
        }
      });

      const extraAllowance = allowances[emp.id] || 0;
      const otherDeduction = deductions[emp.id] || 0;
      const grossIncome = baseNormalPay + transportAllowanceTotal + ot15Pay + ot20Pay + ot30Pay + extraAllowance + totalConfineSpace + totalIncentive + totalPerdiem;
      
      let ssoDeduction = 0;
      const ssoBaseSalary = baseNormalPay;
      if (ssoBaseSalary > 0) {
        const adjustedBase = Math.max(1650, Math.min(17500, ssoBaseSalary));
        ssoDeduction = Math.round(adjustedBase * 0.05);
      }

      const defaultTax = 0;
      const calculatedTax = customTaxes[emp.id] !== undefined ? customTaxes[emp.id] : defaultTax;

      const defaultStudentLoan = emp.studentLoan || 0;
      const studentLoanDeduct = customStudentLoans[emp.id] !== undefined ? customStudentLoans[emp.id] : defaultStudentLoan;

      const totalDeductionVal = ssoDeduction + calculatedTax + studentLoanDeduct + otherDeduction;
      const netPayment = grossIncome - totalDeductionVal;

      grandGrossIncome += grossIncome;
      grandNetIncome += netPayment;
    });

    // Also calculate basic totals for hours
    periodEntries.forEach(e => {
      const proj = (e.project || '').toLowerCase();
      const isOffshore = proj.includes('offshore');
      
      totalNormal += e.normalHours;
      totalOT15 += isOffshore ? 0 : e.ot15Hours;
      totalOT20 += isOffshore ? 0 : e.ot20Hours;
      totalOT30 += isOffshore ? 0 : e.ot30Hours;
    });

    const totalOT = totalOT15 + totalOT20 + totalOT30;
    const grandTotal = totalNormal + totalOT;

    return {
      normal: Number(totalNormal.toFixed(2)),
      ot15: Number(totalOT15.toFixed(2)),
      ot20: Number(totalOT20.toFixed(2)),
      ot30: Number(totalOT30.toFixed(2)),
      totalOT: Number(totalOT.toFixed(2)),
      grandTotal: Number(grandTotal.toFixed(2)),
      activeCount: activePersons.size,
      grandGrossIncome: Number(grandGrossIncome.toFixed(2)),
      grandNetIncome: Number(grandNetIncome.toFixed(2))
    };
  }, [periodEntries, employees]);

  // Chart data
  const chartData = useMemo(() => {
    return [...employeeSummaries]
      .sort((a, b) => b.totalOTHours - a.totalOTHours)
      .slice(0, 8)
      .map(e => ({
        name: e.employeeName.split(' ')[0],
        'Normal hrs': e.normalHours,
        'OT 1.5': e.ot15Hours,
        'OT 2.0': e.ot20Hours,
        'OT 3.0': e.ot30Hours,
      }));
  }, [employeeSummaries]);

  const pieData = [
    { name: 'เวลาปกติ (Normal)', value: totalStats.normal, color: '#3182CE' },
    { name: 'โอที 1.5 เท่า (OT 1.5)', value: totalStats.ot15, color: '#D4AF37' },
    { name: 'โอที 2.0 เท่า (OT 2.0)', value: totalStats.ot20, color: '#E53E3E' },
    { name: 'โอที 3.0 เท่า (OT 3.0)', value: totalStats.ot30, color: '#805AD5' }
  ].filter(d => d.value > 0);

  // Export summary as CSV
  const exportSummaryCSV = () => {
    const headers = [
      'ID รหัสพนักงาน',
      'ชื่อพนักงาน',
      'ตำแหน่ง',
      'ประเภทการจ้าง',
      'จำนวนวันที่มีรายการ',
      'ชั่วโมงทำงานปกติ (Normal)',
      'โอที 1.5 เท่า (OT 1.5)',
      'โอที 2.0 เท่า (OT 2.0)',
      'โอที 3.0 เท่า (OT 3.0)',
      'รวมชั่วโมงโอทีทั้งหมด (Total OT)',
      'รวมชั่วโมงทำงานทั้งหมด (Grand Total)'
    ];

    const rows = employeeSummaries.map(s => [
      s.id,
      s.employeeName,
      s.position,
      s.scheduleType,
      s.entriesCount,
      s.normalHours,
      s.ot15Hours,
      s.ot20Hours,
      s.ot30Hours,
      s.totalOTHours,
      s.totalHours
    ]);

    const csvContent = "\uFEFF" + [
      headers.join(','),
      ...rows.map(r => r.map(val => `"${val}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    const periodName = reportType === 'monthly' ? selectedMonth : `${startDate}_to_${endDate}`;
    link.setAttribute('href', url);
    link.setAttribute('download', `Timesheet_Summary_Report_${periodName}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Modern eye-soothing theme variables
  const cardBgStyle = isDark ? 'bg-[#141414] border-white/10' : 'bg-white border-slate-205 shadow-xs';
  const textTitleStyle = isDark ? 'text-[#D4AF37]' : 'text-amber-700';
  const textBodyStyle = isDark ? 'text-gray-300' : 'text-slate-800';
  const textMutedStyle = isDark ? 'text-gray-400' : 'text-slate-500';
  const inputStyle = isDark ? 'bg-[#0D0D0D] border-white/10 text-white focus:border-[#D4AF37]' : 'bg-white border-slate-300 text-slate-800 focus:ring-1 focus:ring-amber-500 focus:border-amber-500';
  
  // Google Sheets tabular variables
  const tableThStyle = isDark ? 'bg-[#1C1C1C] text-gray-300 border-b-2 border-white/15' : 'bg-[#E8EAED] text-slate-700 font-bold border-b-2 border-slate-300';
  const sheetCellClass = isDark ? 'border-white/5 text-gray-300' : 'border-slate-200 text-slate-800';

  return (
    <div className="space-y-6">
      {/* Filters Panel */}
      <div className={`border rounded-xs p-5 ${cardBgStyle}`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className={`text-sm font-bold uppercase tracking-widest flex items-center gap-2 ${textTitleStyle}`}>
              <Calendar className="w-4 h-4 text-[#D4AF37]" />
              กำหนดช่วงเวลาตัดรอบรายงานสะสม (Select Cycle)
            </h2>
            <p className={`text-[10.5px] ${textMutedStyle} mt-1 font-medium`}>
              ดึงคำนวณตรวจสอบและประเมินสรุปจำนวนชั่วโมงสะสมรวมรายบุคคล สอดคล้องตามเกณฑ์ Offshore / Onsite ปราศจากความซับซ้อน
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <button
              id="report-type-monthly"
              onClick={() => setReportType('monthly')}
              className={`px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider rounded-sm transition-colors cursor-pointer ${
                reportType === 'monthly'
                  ? 'bg-[#D4AF37] text-black shadow-xs'
                  : isDark 
                    ? 'bg-transparent text-gray-300 border border-white/15 hover:bg-white/5' 
                    : 'bg-white text-slate-750 border border-slate-300 hover:bg-slate-50'
              }`}
            >
              รายเดือนปฏิทิน (Monthly)
            </button>
            <button
              id="report-type-custom"
              onClick={() => setReportType('custom')}
              className={`px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider rounded-sm transition-colors cursor-pointer ${
                reportType === 'custom'
                  ? 'bg-[#D4AF37] text-black shadow-xs'
                  : isDark 
                    ? 'bg-transparent text-gray-300 border border-white/15 hover:bg-white/5' 
                    : 'bg-white text-slate-750 border border-slate-300 hover:bg-slate-50'
              }`}
            >
              รายช่วงตัดรอบกำหนดเอง (Custom Period)
            </button>
          </div>
        </div>

        <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 mt-5 pt-5 border-t ${isDark ? 'border-white/5' : 'border-slate-150'}`}>
          {reportType === 'monthly' ? (
            <div className="space-y-1">
              <label className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-slate-600'}`}>
                เลือกช่วงเดือน (Choose Month)
              </label>
              <input
                id="select-month-input"
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className={`w-full text-xs rounded-sm py-1.5 px-3 border focus:outline-hidden ${inputStyle}`}
              />
            </div>
          ) : (
            <>
              <div className="space-y-1">
                <label className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-slate-600'}`}>
                  วันเริ่มต้นรอบ (Start Date)
                </label>
                <input
                  id="start-date-input"
                  type="date"
                  value={startDate}
                  onChange={(e) => setNewEmp => setStartDate(e.target.value)}
                  className={`w-full text-xs rounded-sm py-1.5 px-3 border focus:outline-hidden ${inputStyle}`}
                />
              </div>
              <div className="space-y-1">
                <label className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-slate-600'}`}>
                  วันสิ้นสุดรอบ (End Date)
                </label>
                <input
                  id="end-date-input"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className={`w-full text-xs rounded-sm py-1.5 px-3 border focus:outline-hidden ${inputStyle}`}
                />
              </div>
            </>
          )}

          <div className="md:col-span-1 flex items-end">
            <button
              id="export-summary-btn"
              onClick={exportSummaryCSV}
              disabled={employeeSummaries.length === 0}
              className="w-full h-[34px] flex items-center justify-center gap-2 bg-[#D4AF37] hover:bg-amber-500 text-black font-semibold uppercase tracking-wider text-xs px-4 rounded-sm shadow-xs cursor-pointer transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Download className="w-3.5 h-3.5" />
              ส่งออกสรุปรายบุคคล (Export CSV)
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className={`border rounded-xs p-4 flex items-center gap-4 ${cardBgStyle}`}>
          <div className={`w-10 h-10 rounded-sm flex items-center justify-center border ${
            isDark ? 'bg-[#0D0D0D] border-white/5 text-[#D4AF37]' : 'bg-amber-50 border-amber-200 text-amber-700'
          }`}>
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className={`text-[10px] uppercase tracking-widest ${textMutedStyle}`}>พนักงานที่มีชั่วโมง</div>
            <div className={`text-lg font-bold mt-0.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>{totalStats.activeCount} คน</div>
            <div className="text-[9px] text-gray-500 font-mono">จากทั้งหมด {employees.length} คน</div>
          </div>
        </div>

        <div className={`border rounded-xs p-4 flex items-center gap-4 ${cardBgStyle}`}>
          <div className={`w-10 h-10 rounded-sm flex items-center justify-center border ${
            isDark ? 'bg-[#0D0D0D] border-white/5 text-sky-450' : 'bg-sky-50 border-sky-200 text-sky-700'
          }`}>
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className={`text-[10px] uppercase tracking-widest ${textMutedStyle}`}>ชั่วโมงปกติรวม (Normal)</div>
            <div className="text-lg font-bold mt-0.5 text-sky-650 dark:text-[#38BDF8]">{totalStats.normal.toLocaleString()} ชม.</div>
            <div className="text-[9px] text-gray-500 font-mono">ฐานอัตราปกติเรท 1.0</div>
          </div>
        </div>

        <div className={`border rounded-xs p-4 flex items-center gap-4 ${cardBgStyle}`}>
          <div className={`w-10 h-10 rounded-sm flex items-center justify-center border ${
            isDark ? 'bg-[#0D0D0D] border-white/5 text-amber-500' : 'bg-amber-50 border-amber-250 text-amber-700'
          }`}>
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className={`text-[10px] uppercase tracking-widest ${textMutedStyle}`}>ชั่วโมงล่วงเวลารวม (OT)</div>
            <div className="text-lg font-bold mt-0.5 text-amber-653 dark:text-[#D4AF37]">{totalStats.totalOT.toLocaleString()} ชม.</div>
            <div className="text-[9px] text-gray-500 font-mono">นับรวมสะสมเรท 1.5, 2.0, 3.0</div>
          </div>
        </div>

        <div className={`border rounded-xs p-4 flex items-center gap-4 ${cardBgStyle}`}>
          <div className={`w-10 h-10 rounded-sm flex items-center justify-center border ${
            isDark ? 'bg-[#0D0D0D] border-white/5 text-[#E53E3E]' : 'bg-rose-50 border-rose-200 text-rose-700'
          }`}>
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className={`text-[10px] uppercase tracking-widest ${textMutedStyle}`}>รวมเวลาระบบทั้งหมด</div>
            <div className={`text-lg font-bold mt-0.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>{totalStats.grandTotal.toLocaleString()} ชม.</div>
            <div className="text-[9px] text-gray-500 font-mono">ยอดชั่วโมงสะสมรวมสุทธิ</div>
          </div>
        </div>

        <div className={`border rounded-xs p-4 flex items-center gap-4 ${cardBgStyle}`}>
          <div className={`w-10 h-10 rounded-sm flex items-center justify-center border ${
            isDark ? 'bg-[#0D0D0D] border-white/5 text-emerald-400' : 'bg-emerald-50 border-emerald-250 text-emerald-700'
          }`}>
            <Coins className="w-5 h-5" />
          </div>
          <div>
            <div className={`text-[10px] uppercase tracking-widest ${textMutedStyle}`}>รายได้รวมก่อนหัก</div>
            <div className="text-lg font-bold mt-0.5 text-emerald-600 dark:text-emerald-400">{totalStats.grandGrossIncome.toLocaleString()} ฿</div>
            <div className="text-[9px] text-gray-500 font-mono">เงินรวมสุทธิก่อนหักภาษี/สปส.</div>
          </div>
        </div>

        <div className={`border rounded-xs p-4 flex items-center gap-4 ${cardBgStyle}`}>
          <div className={`w-10 h-10 rounded-sm flex items-center justify-center border ${
            isDark ? 'bg-[#0D0D0D] border-white/5 text-[#D4AF37]' : 'bg-amber-50 border-amber-205 text-[#B45309]'
          }`}>
            <Coins className="w-5 h-5" />
          </div>
          <div>
            <div className={`text-[10px] uppercase tracking-widest ${textMutedStyle}`}>รายได้สุทธิรวมหลังหัก</div>
            <div className="text-lg font-bold mt-0.5 text-amber-700 dark:text-[#D4AF37]">{totalStats.grandNetIncome.toLocaleString()} ฿</div>
            <div className="text-[9px] text-gray-500 font-mono">เงินจ่ายสุทธิพนักงานทั้งหมด</div>
          </div>
        </div>
      </div>

      {/* Visual Analytics Charts */}
      {periodEntries.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Bar Chart */}
          <div className={`lg:col-span-8 border rounded-xs p-5 flex flex-col justify-between ${cardBgStyle}`}>
            <div>
              <h3 className={`text-xs font-bold uppercase tracking-widest ${textTitleStyle}`}>
                กราฟแท่งวิเคราะห์ชั่วโมงการปฏิบัติงานรายบุคคล (Top 8 Employee OTs)
              </h3>
              <p className={`text-[10px] ${textMutedStyle} mt-1 font-serif`}>
                จำลองแสดงสัดส่วนระหว่างชั่วโมงการจ้างฐานปกติ และการสะสมล่วงเวลาตามโควตาชั่วโมงกฎหมายไทย
              </p>
            </div>
            
            <div className="h-64 mt-6 font-mono text-[10px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid 
                    strokeDasharray="3 3" 
                    vertical={false} 
                    stroke={isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"} 
                  />
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: isDark ? '#A1A1AA' : '#4B5563' }} />
                  <YAxis tick={{ fontSize: 10, fill: isDark ? '#A1A1AA' : '#4B5563' }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: isDark ? '#141414' : '#FFFFFF', 
                      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', 
                      color: isDark ? '#FFF' : '#334155' 
                    }}
                    itemStyle={{ fontSize: 11 }}
                    labelStyle={{ fontWeight: 'bold', color: isDark ? '#D4AF37' : '#B45309' }}
                    formatter={(value) => [`${value} ชม.`]} 
                  />
                  <Legend wrapperStyle={{ fontSize: 10, paddingTop: 12, color: isDark ? '#A1A1AA' : '#374151' }} />
                  <Bar dataKey="Normal hrs" stackId="a" fill="#1E3A8A" name="ปกติ 1.0" />
                  <Bar dataKey="OT 1.5" stackId="a" fill="#D4AF37" name="โอที 1.5" />
                  <Bar dataKey="OT 2.0" stackId="a" fill="#DC2626" name="โอที 2.0 (วันหยุด)" />
                  <Bar dataKey="OT 3.0" stackId="a" fill="#7C3AED" name="โอที 3.0" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Breakdown Pie Chart */}
          <div className={`lg:col-span-4 border rounded-xs p-5 flex flex-col justify-between ${cardBgStyle}`}>
            <div>
              <h3 className={`text-xs font-bold uppercase tracking-widest ${textTitleStyle}`}>
                สัดส่วนชั่วโมงรวมตามข้อกฎหมายคุ้มครอง
              </h3>
              <p className={`text-[10px] ${textMutedStyle} mt-1 font-serif`}>สัดส่วนสรุปรวบยอดสะสมเพื่อประเมินงบประมาณเงินเดือนและโอที</p>
            </div>
            
            {pieData.length > 0 ? (
              <div className="h-44 flex items-center justify-center mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: isDark ? '#141414' : '#FFFFFF', 
                        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', 
                        color: isDark ? '#FFF' : '#334155' 
                      }}
                      formatter={(value) => [`${value} ชม.`]} 
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-44 flex items-center justify-center text-gray-500 text-xs">
                ไม่มีข้อมูลชั่วโมงทำงานในช่วงเวลานี้
              </div>
            )}

            <div className="space-y-1.5 mt-4 font-mono">
              {pieData.map((item, index) => {
                const pct = ((item.value / totalStats.grandTotal) * 100).toFixed(1);
                return (
                  <div key={index} className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: item.color }} />
                      <span className={isDark ? 'text-gray-305' : 'text-slate-600'}>{item.name}</span>
                    </div>
                    <span className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{item.value} ชม. ({pct}%)</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className={`rounded-sm p-8 text-center border ${
          isDark ? 'bg-[#2A1818] border-red-900/30' : 'bg-red-50 border-red-200'
        }`}>
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
          <div className="text-sm font-bold text-red-600 uppercase tracking-wider">ไม่พบรายการบันทึกเวลาปฏิบัติงาน (Timesheet) ในรอบเวลานี้</div>
          <div className="text-xs text-red-500 mt-1 font-medium">กรุณาลองเปลี่ยนรอบเดือนปฏิทิน หรือตรวจเช็คข้อมูลนําเข้าแบบ Batch ถัดไป</div>
        </div>
      )}

      {/* Structured Summary Table */}
      <div className={`border rounded-xs overflow-hidden ${cardBgStyle}`}>
        <div className={`p-4 border-b flex flex-col md:flex-row md:items-center justify-between gap-3 ${
          isDark ? 'bg-[#141414] border-white/10' : 'bg-[#FAFAFA] border-slate-100'
        }`}>
          <div>
            <h3 className={`text-xs font-bold uppercase tracking-widest ${textTitleStyle}`}>
              แผ่นบัญชีสรุปจำนวนชั่วโมงสะสมรายบุคคล (Individual Timesheet Core Report)
            </h3>
            <p className={`text-[10px] ${textMutedStyle} mt-0.5`}>
              สะท้อนชั่วโมง Normal ยอดสะสมโอทีคิดแยกตามแต่ละเรทคูณ เพื่อเทียบเคียงฐานบัญชีเงินเดือนและโอนเข้าสู่โปรแกรม Excel / Sheets ได้ทันที
            </p>
          </div>
          
          <div className="flex items-center justify-end">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="search-by-name-summaries"
                type="text"
                placeholder="ค้นหาชื่อพนักงาน..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`text-xs pl-9 pr-3 py-1.5 rounded-sm w-48 focus:outline-hidden border ${inputStyle}`}
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          {/* Google Sheet Grid Style Table */}
          <table className="w-full text-xs border-collapse text-left">
            <thead className={`${tableThStyle} uppercase text-[9px] tracking-widest sticky top-0 z-10`}>
              <tr>
                <th className="py-2.5 px-3 border-r border-slate-300 dark:border-white/10 text-gray-400">รหัส</th>
                <th className="py-2.5 px-3 border-r border-slate-300 dark:border-white/10 text-amber-700 dark:text-[#D4AF37]">ชื่อพนักงาน</th>
                <th className="py-2.5 px-3 border-r border-slate-300 dark:border-white/10">ตำแหน่งงาน</th>
                <th className="py-2.5 px-3 border-r border-slate-300 dark:border-white/10">ลักษณะจ้าง</th>
                <th className="py-2.5 px-3 border-r border-slate-300 dark:border-white/10 text-center">วันทำ</th>
                <th className="py-2.5 px-3 border-r border-slate-300 dark:border-white/10 text-right text-sky-700 bg-sky-50 dark:bg-sky-950/20">Normal Hrs (1.0)</th>
                <th className="py-2.5 px-3 border-r border-slate-300 dark:border-white/10 text-right text-amber-700 bg-amber-50 dark:bg-amber-950/25">OT 1.5 (ชม.)</th>
                <th className="py-2.5 px-3 border-r border-slate-300 dark:border-white/10 text-right text-red-700 bg-rose-50 dark:bg-red-950/20">OT 2.0 (ชม.)</th>
                <th className="py-2.5 px-3 border-r border-slate-300 dark:border-white/10 text-right text-purple-750 bg-purple-50 dark:bg-purple-950/20">OT 3.0 (ชม.)</th>
                <th className="py-2.5 px-3 border-r border-slate-300 dark:border-white/10 text-right font-bold text-amber-700 dark:text-[#D4AF37] bg-amber-50/30 dark:bg-[#1A1A1A]">สะสม OT</th>
                <th className="py-2.5 px-3 text-right font-bold text-slate-850 dark:text-white bg-slate-100 dark:bg-white/5">กะรวมสุทธิ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dotted font-medium font-sans text-slate-800 dark:text-gray-300">
              {employeeSummaries.length > 0 ? (
                employeeSummaries.map((s, idx) => (
                  <tr 
                    key={idx} 
                    className={`transition-colors text-[11px] ${
                      isDark 
                        ? 'hover:bg-white/[0.02] even:bg-[#1a1a1a]/45 bg-[#141414]' 
                        : 'hover:bg-amber-50/40 even:bg-[#F8F9FA] bg-white'
                    }`}
                  >
                    {/* Column 1: ID */}
                    <td className={`py-2 px-3 font-mono text-gray-500 border-r ${sheetCellClass}`}>
                      {s.id}
                    </td>
                    
                    {/* Column 2: Name */}
                    <td className={`py-2 px-3 font-bold border-r text-slate-900 dark:text-white ${sheetCellClass}`}>
                      {s.employeeName}
                    </td>
                    
                    {/* Column 3: Position */}
                    <td className={`py-2 px-3 border-r text-gray-500 ${sheetCellClass}`}>
                      {s.position}
                    </td>
                    
                    {/* Column 4: Schedule Type */}
                    <td className={`py-2 px-3 border-r ${sheetCellClass}`}>
                      <span className={`px-2 py-0.5 rounded-xs text-[9px] font-bold border inline-block ${
                        s.scheduleType === 'รายเดือน' 
                          ? 'bg-blue-50 text-blue-700 border-blue-150 dark:bg-blue-950/45 dark:text-blue-305 dark:border-blue-900/30' 
                          : 'bg-indigo-50 text-indigo-700 border-indigo-150 dark:bg-indigo-950/45 dark:text-indigo-305 dark:border-indigo-900/30'
                      }`}>
                        {s.scheduleType}
                      </span>
                    </td>
                    
                    {/* Column 5: Day count */}
                    <td className={`py-2 px-3 text-center font-mono border-r text-gray-500 dark:text-gray-400 ${sheetCellClass}`}>
                      {s.entriesCount} วัน
                    </td>
                    
                    {/* Column 6: Normal hours */}
                    <td className={`py-2 px-3 text-right font-mono border-r bg-sky-50/20 dark:bg-sky-950/10 text-sky-700 dark:text-sky-305 ${sheetCellClass}`}>
                      {s.normalHours > 0 ? s.normalHours.toFixed(2) : '—'}
                    </td>
                    
                    {/* Column 7: OT 1.5 */}
                    <td className={`py-2 px-3 text-right font-mono border-r bg-amber-55/20 dark:bg-amber-955/15 text-amber-700 dark:text-amber-400 ${sheetCellClass}`}>
                      {s.ot15Hours > 0 ? s.ot15Hours.toFixed(2) : '—'}
                    </td>
                    
                    {/* Column 8: OT 2.0 */}
                    <td className={`py-2 px-3 text-right font-mono border-r bg-rose-55/20 dark:bg-rose-955/15 text-rose-700 dark:text-rose-400 ${sheetCellClass}`}>
                      {s.ot20Hours > 0 ? s.ot20Hours.toFixed(2) : '—'}
                    </td>
                    
                    {/* Column 9: OT 3.0 */}
                    <td className={`py-2 px-3 text-right font-mono border-r bg-purple-55/20 dark:bg-purple-955/15 text-purple-700 dark:text-purple-400 ${sheetCellClass}`}>
                      {s.ot30Hours > 0 ? s.ot30Hours.toFixed(2) : '—'}
                    </td>
                    
                    {/* Column 10: Sum OT */}
                    <td className={`py-2 px-3 text-right font-mono font-bold border-r bg-amber-50/15 dark:bg-[#1C1C1C] text-amber-750 dark:text-[#D4AF37] ${sheetCellClass}`}>
                      {s.totalOTHours > 0 ? s.totalOTHours.toFixed(2) : '—'}
                    </td>
                    
                    {/* Column 11: Grand total hours */}
                    <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 dark:text-white bg-slate-100/40 dark:bg-white/[0.03]">
                      {s.totalHours.toFixed(2)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={11} className="text-center py-8 text-gray-400">
                    ไม่พบบันทึกการทำงานตรงตามเงื่อนไขที่เลือก
                  </td>
                </tr>
              )}
            </tbody>
            {employeeSummaries.length > 0 && (
              <tfoot className={`font-bold text-[10px] border-t-2 uppercase tracking-wider font-mono ${
                isDark ? 'bg-[#0D0D0D] text-gray-305 border-white/20' : 'bg-[#E8EAED] text-slate-800 border-slate-350'
              }`}>
                <tr>
                  <td colSpan={5} className="py-2.5 px-3 text-right text-gray-500 border-r border-[#D2D2D2] dark:border-white/10 font-bold">ผลรวมสะสมรอบระบบ (Totals):</td>
                  <td className="py-2.5 px-3 text-right font-mono text-[#0284C7] dark:text-[#38BDF8] border-r border-[#D2D2D2] dark:border-white/10 bg-sky-50 dark:bg-sky-950/20">{totalStats.normal.toFixed(2)}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-amber-750 dark:text-[#D4AF37] border-r border-[#D2D2D2] dark:border-white/10 bg-amber-50 dark:bg-amber-950/30">{totalStats.ot15.toFixed(2)}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-rose-700 dark:text-red-400 border-r border-[#D2D2D2] dark:border-white/10 bg-rose-50 dark:bg-rose-955/20">{totalStats.ot20.toFixed(2)}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-purple-700 dark:text-purple-400 border-r border-[#D2D2D2] dark:border-white/10 bg-purple-50 dark:bg-purple-955/20">{totalStats.ot30.toFixed(2)}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-amber-700 dark:text-[#D4AF37] border-r border-[#D2D2D2] dark:border-white/10 bg-amber-50/50 dark:bg-white/[0.01]">{totalStats.totalOT.toFixed(2)}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-900 dark:text-white bg-slate-200 dark:bg-white/5">{totalStats.grandTotal.toFixed(2)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
