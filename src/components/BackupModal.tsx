import React, { useState, useEffect } from 'react';
import { 
  Download, Upload, Database, Save, RefreshCw, 
  FileSpreadsheet, ShieldCheck, CheckCircle2, Clock, 
  Calendar, X, HardDrive, Check, AlertCircle, FileJson, Sparkles
} from 'lucide-react';
import { Employee, TimesheetEntry, Holiday, SystemSettings } from '../types';

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  entries: TimesheetEntry[];
  holidays: Holiday[];
  settings: SystemSettings;
  isDark?: boolean;
  lastAutoSaveTime: Date | null;
  autoSaveEnabled: boolean;
  setAutoSaveEnabled: (enabled: boolean) => void;
  autoSaveIntervalSec: number;
  setAutoSaveIntervalSec: (sec: number) => void;
  onManualTriggerAutoSave: () => void;
  onRestoreBackup: (data: {
    employees?: Employee[];
    entries?: TimesheetEntry[];
    holidays?: Holiday[];
    settings?: SystemSettings;
    supplements?: any;
    allowances?: any;
    deductions?: any;
  }) => void;
}

export default function BackupModal({
  isOpen,
  onClose,
  employees,
  entries,
  holidays,
  settings,
  isDark = false,
  lastAutoSaveTime,
  autoSaveEnabled,
  setAutoSaveEnabled,
  autoSaveIntervalSec,
  setAutoSaveIntervalSec,
  onManualTriggerAutoSave,
  onRestoreBackup
}: BackupModalProps) {
  const [activeTab, setActiveTab] = useState<'backup' | 'scoped' | 'restore' | 'settings'>('backup');
  const [importPreview, setImportPreview] = useState<{
    valid: boolean;
    data?: any;
    error?: string;
    empCount?: number;
    entryCount?: number;
    holidayCount?: number;
    timestamp?: string;
  } | null>(null);
  const [restoreSuccess, setRestoreSuccess] = useState<string | null>(null);
  const [autoSaveToast, setAutoSaveToast] = useState<boolean>(false);

  if (!isOpen) return null;

  // Helper: Get date ranges
  const getDatesForPreset = (preset: 'weekly' | 'monthly' | 'last_week' | 'last_month') => {
    const today = new Date();
    const curr = new Date(today);
    
    if (preset === 'weekly') {
      // Last 7 days
      const past = new Date(curr);
      past.setDate(curr.getDate() - 7);
      return { start: past, end: curr };
    } else if (preset === 'monthly') {
      // Current cutoff / current month (21st of prev month to 20th of current month)
      const year = curr.getFullYear();
      const month = curr.getMonth();
      const day = curr.getDate();
      let start: Date;
      let end: Date;
      if (day >= 21) {
        start = new Date(year, month, 21);
        end = new Date(year, month + 1, 20);
      } else {
        start = new Date(year, month - 1, 21);
        end = new Date(year, month, 20);
      }
      return { start, end };
    } else if (preset === 'last_week') {
      // 7 to 14 days ago
      const end = new Date(curr);
      end.setDate(curr.getDate() - 7);
      const start = new Date(curr);
      start.setDate(curr.getDate() - 14);
      return { start, end };
    } else if (preset === 'last_month') {
      // Previous month / previous cutoff
      const day = curr.getDate();
      let monthOffset = day >= 21 ? 0 : 1;
      const start = new Date(curr.getFullYear(), curr.getMonth() - monthOffset - 1, 21);
      const end = new Date(curr.getFullYear(), curr.getMonth() - monthOffset, 20);
      return { start, end };
    }
    return { start: curr, end: curr };
  };

  const formatDateStr = (d: Date) => d.toISOString().split('T')[0];

  // Export Full JSON Backup
  const handleDownloadFullJson = () => {
    const supplementsRaw = localStorage.getItem('thai_ot_individual_supplements');
    const allowancesRaw = localStorage.getItem('payroll_allowances');
    const deductionsRaw = localStorage.getItem('payroll_deductions');
    const customTaxesRaw = localStorage.getItem('payroll_custom_taxes');
    const customStudentLoansRaw = localStorage.getItem('payroll_custom_student_loans');
    const manualLeaveDaysRaw = localStorage.getItem('thai_ot_manual_leave_days');

    const backupPayload = {
      app: 'Thai Timesheet & Payroll Calculation Engine',
      version: '6.3',
      exportDate: new Date().toISOString(),
      stats: {
        totalEmployees: employees.length,
        totalEntries: entries.length,
        totalHolidays: holidays.length,
      },
      data: {
        employees,
        entries,
        holidays,
        settings,
        supplements: supplementsRaw ? JSON.parse(supplementsRaw) : {},
        allowances: allowancesRaw ? JSON.parse(allowancesRaw) : {},
        deductions: deductionsRaw ? JSON.parse(deductionsRaw) : {},
        customTaxes: customTaxesRaw ? JSON.parse(customTaxesRaw) : {},
        customStudentLoans: customStudentLoansRaw ? JSON.parse(customStudentLoansRaw) : {},
        manualLeaveDays: manualLeaveDaysRaw ? JSON.parse(manualLeaveDaysRaw) : {}
      }
    };

    const blob = new Blob([JSON.stringify(backupPayload, null, 2)], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateTag = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.setAttribute('download', `Thai_Timesheet_Payroll_Full_Backup_${dateTag}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Scoped Backup (JSON)
  const handleDownloadScopedJson = (preset: 'weekly' | 'monthly' | 'last_week' | 'last_month') => {
    const { start, end } = getDatesForPreset(preset);
    const startStr = formatDateStr(start);
    const endStr = formatDateStr(end);

    const filteredEntries = entries.filter(e => e.date >= startStr && e.date <= endStr);

    const scopedPayload = {
      app: 'Thai Timesheet & Payroll Calculation Engine',
      scope: preset,
      dateRange: { start: startStr, end: endStr },
      exportDate: new Date().toISOString(),
      stats: {
        totalEmployees: employees.length,
        totalEntries: filteredEntries.length,
      },
      data: {
        employees,
        entries: filteredEntries,
        holidays,
        settings
      }
    };

    const blob = new Blob([JSON.stringify(scopedPayload, null, 2)], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Backup_${preset}_${startStr}_to_${endStr}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export All Data Table to Excel (CSV UTF-8 with BOM)
  const handleExportExcelAllDataTable = (preset?: 'weekly' | 'monthly' | 'last_week' | 'last_month' | 'all') => {
    let filteredEntries = [...entries];
    let fileSuffix = 'ALL_DATA';

    if (preset && preset !== 'all') {
      const { start, end } = getDatesForPreset(preset);
      const startStr = formatDateStr(start);
      const endStr = formatDateStr(end);
      filteredEntries = entries.filter(e => e.date >= startStr && e.date <= endStr);
      fileSuffix = `${preset.toUpperCase()}_${startStr}_TO_${endStr}`;
    }

    // Sort entries by date ascending then employee name
    filteredEntries.sort((a, b) => a.date.localeCompare(b.date) || a.employeeName.localeCompare(b.employeeName));

    const headers = [
      'ลำดับ (No.)',
      'รหัสพนักงาน (EMP ID)',
      'ชื่อ-นามสกุล (Employee Name)',
      'ตำแหน่ง (Position)',
      'ประเภทพนักงาน (Type)',
      'วันที่ (Date)',
      'โครงการ/งาน (Job / Project)',
      'เวลาเข้า (Time In)',
      'เวลาออก (Time Out)',
      'หักพักเที่ยง (Lunch Deduct)',
      'หักพัก OT (OT Deduct)',
      'ชั่วโมงปกติ (Normal Hrs)',
      'ชั่วโมง OT 1.5 (OT 1.5 Hrs)',
      'ชั่วโมง OT 2.0 (OT 2.0 Hrs)',
      'ชั่วโมง OT 3.0 (OT 3.0 Hrs)',
      'ชั่วโมงรวมทั้งหมด (Total Hrs)',
      'หมายเหตุ (Remark)'
    ];

    const rows = filteredEntries.map((e, idx) => {
      const emp = employees.find(emp => emp.employeeName === e.employeeName);
      const totalHrs = (e.normalHours || 0) + (e.ot15Hours || 0) + (e.ot20Hours || 0) + (e.ot30Hours || 0);
      return [
        idx + 1,
        emp?.id || '-',
        `"${e.employeeName.replace(/"/g, '""')}"`,
        `"${(emp?.position || '-').replace(/"/g, '""')}"`,
        emp?.workScheduleType === 'staff' ? 'รายเดือน' : emp?.workScheduleType === 'monthly_worker' ? 'รายเดือนช่าง' : 'รายวัน',
        e.date,
        `"${(e.project || '-').replace(/"/g, '""')}"`,
        e.timeIn || '-',
        e.timeOut || '-',
        e.lunchDeduct ? 'หัก' : 'ไม่หัก',
        e.lunchOT ? 'หัก' : 'ไม่หัก',
        e.normalHours || 0,
        e.ot15Hours || 0,
        e.ot20Hours || 0,
        e.ot30Hours || 0,
        totalHrs,
        `"${(e.remark || '').replace(/"/g, '""')}"`
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const dateTag = new Date().toISOString().slice(0, 10);
    link.setAttribute('download', `Thai_Timesheet_${fileSuffix}_${dateTag}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle JSON File Import/Restore
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result as string;
        const parsed = JSON.parse(text);

        if (!parsed || (typeof parsed !== 'object')) {
          throw new Error('รูปแบบไฟล์ JSON ไม่ถูกต้อง');
        }

        const dataObj = parsed.data || parsed;
        const empCount = Array.isArray(dataObj.employees) ? dataObj.employees.length : 0;
        const entryCount = Array.isArray(dataObj.entries) ? dataObj.entries.length : 0;
        const holidayCount = Array.isArray(dataObj.holidays) ? dataObj.holidays.length : 0;

        if (empCount === 0 && entryCount === 0) {
          throw new Error('ไม่พบข้อมูลพนักงานหรือบันทึกเวลาในไฟล์นี้');
        }

        setImportPreview({
          valid: true,
          data: dataObj,
          empCount,
          entryCount,
          holidayCount,
          timestamp: parsed.exportDate || new Date().toISOString()
        });
      } catch (err: any) {
        setImportPreview({
          valid: false,
          error: err.message || 'ไม่สามารถอ่านไฟล์ JSON ได้'
        });
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmRestore = () => {
    if (!importPreview?.data) return;
    try {
      onRestoreBackup(importPreview.data);
      setRestoreSuccess('เรียกคืนข้อมูลสำรองสำเร็จแล้ว!');
      setTimeout(() => {
        setRestoreSuccess(null);
        setImportPreview(null);
        onClose();
      }, 1500);
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการเรียกคืนข้อมูล');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fade-in font-sans">
      <div className={`w-full max-w-3xl rounded-lg border shadow-2xl flex flex-col max-h-[90vh] overflow-hidden ${
        isDark ? 'bg-[#121212] border-white/15 text-gray-100' : 'bg-white border-slate-200 text-slate-800'
      }`}>
        {/* Header */}
        <div className={`px-6 py-4 border-b flex items-center justify-between ${
          isDark ? 'bg-[#181818] border-white/10' : 'bg-slate-50 border-slate-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#D4AF37]/20 border border-[#D4AF37]/40 rounded-md text-[#D4AF37]">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold font-serif text-[#D4AF37] flex items-center gap-2">
                ศูนย์จัดการสำรองข้อมูล & ส่งออกไฟล์ (Backup & Restore Center)
              </h3>
              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                สำรองข้อมูลอัตโนมัติ (Auto Save), ดาวน์โหลดสำรองรายสัปดาห์/เดือน, และส่งออกไฟล์ Excel ตารางรวม
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className={`p-1.5 rounded-full hover:bg-black/10 transition-colors ${
              isDark ? 'text-gray-400 hover:text-white' : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Auto Save Status Strip */}
        <div className={`px-6 py-2.5 border-b flex flex-wrap items-center justify-between text-xs font-mono gap-2 ${
          isDark ? 'bg-[#1E1E1E] border-white/10' : 'bg-emerald-50/70 border-emerald-100 text-emerald-900'
        }`}>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                autoSaveEnabled ? 'bg-emerald-400' : 'bg-amber-400'
              }`}></span>
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                autoSaveEnabled ? 'bg-emerald-500' : 'bg-amber-500'
              }`}></span>
            </span>
            <span className="font-sans font-bold">
              {autoSaveEnabled ? 'ระบบ Auto-Save บันทึกอัตโนมัติเปิดใช้งานแล้ว' : 'ระบบ Auto-Save ปิดใช้งาน'}
            </span>
            <span className="text-gray-400 font-normal">|</span>
            <span className="text-gray-400 font-sans">
              บันทึกครั้งล่าสุด: <strong className="text-emerald-500 font-mono">
                {lastAutoSaveTime ? lastAutoSaveTime.toLocaleTimeString('th-TH') : 'ยังไม่ได้บันทึก'}
              </strong>
            </span>
          </div>

          <button
            onClick={() => {
              onManualTriggerAutoSave();
              setAutoSaveToast(true);
              setTimeout(() => setAutoSaveToast(false), 2000);
            }}
            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-sans font-bold rounded text-[11px] flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
          >
            <Save className="w-3.5 h-3.5" />
            {autoSaveToast ? 'บันทึกสำเร็จ ✓' : 'บันทึกลงเครื่องทันที (Save Now)'}
          </button>
        </div>

        {/* Tabs Bar */}
        <div className={`px-6 pt-3 border-b flex gap-2 overflow-x-auto ${
          isDark ? 'bg-[#151515] border-white/10' : 'bg-slate-100/60 border-slate-200'
        }`}>
          <button
            onClick={() => setActiveTab('backup')}
            className={`pb-2 px-3 text-xs font-bold font-sans border-b-2 transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'backup'
                ? 'border-[#D4AF37] text-[#D4AF37]'
                : isDark ? 'border-transparent text-gray-400 hover:text-gray-200' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            สำรองข้อมูลทั้งหมด (Manual Backup JSON)
          </button>

          <button
            onClick={() => setActiveTab('scoped')}
            className={`pb-2 px-3 text-xs font-bold font-sans border-b-2 transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'scoped'
                ? 'border-[#D4AF37] text-[#D4AF37]'
                : isDark ? 'border-transparent text-gray-400 hover:text-gray-200' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            สำรองตามช่วงเวลา & Excel (Weekly / Monthly / Excel)
          </button>

          <button
            onClick={() => setActiveTab('restore')}
            className={`pb-2 px-3 text-xs font-bold font-sans border-b-2 transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'restore'
                ? 'border-[#D4AF37] text-[#D4AF37]'
                : isDark ? 'border-transparent text-gray-400 hover:text-gray-200' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            เรียกคืนข้อมูล (Restore Backup)
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`pb-2 px-3 text-xs font-bold font-sans border-b-2 transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'settings'
                ? 'border-[#D4AF37] text-[#D4AF37]'
                : isDark ? 'border-transparent text-gray-400 hover:text-gray-200' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            ตั้งค่าบันทึกอัตโนมัติ (Auto-Save Config)
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {restoreSuccess && (
            <div className="p-4 bg-emerald-500/20 border border-emerald-500/50 rounded-lg text-emerald-300 text-sm font-bold flex items-center gap-2 animate-bounce">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              {restoreSuccess}
            </div>
          )}

          {/* TAB 1: Manual Backup Full JSON */}
          {activeTab === 'backup' && (
            <div className="space-y-6">
              <div className={`p-4 rounded-lg border ${
                isDark ? 'bg-[#181818] border-white/10' : 'bg-amber-50/50 border-amber-200/80'
              }`}>
                <h4 className="text-sm font-bold text-[#D4AF37] flex items-center gap-2 mb-2">
                  <Database className="w-4 h-4 text-[#D4AF37]" />
                  สรุปสถานะข้อมูลที่จะถูกสำรองปัจจุบัน (Current Live State)
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs mt-3">
                  <div className={`p-3 rounded border text-center ${isDark ? 'bg-black/30 border-white/10' : 'bg-white border-slate-200'}`}>
                    <span className="block text-gray-400 text-[10px] uppercase font-bold">พนักงาน</span>
                    <strong className="text-lg text-[#D4AF37] font-mono">{employees.length}</strong> คน
                  </div>
                  <div className={`p-3 rounded border text-center ${isDark ? 'bg-black/30 border-white/10' : 'bg-white border-slate-200'}`}>
                    <span className="block text-gray-400 text-[10px] uppercase font-bold">เรคคอร์ดเวลา</span>
                    <strong className="text-lg text-emerald-500 font-mono">{entries.length}</strong> รายการ
                  </div>
                  <div className={`p-3 rounded border text-center ${isDark ? 'bg-black/30 border-white/10' : 'bg-white border-slate-200'}`}>
                    <span className="block text-gray-400 text-[10px] uppercase font-bold">วันหยุด</span>
                    <strong className="text-lg text-sky-400 font-mono">{holidays.length}</strong> วัน
                  </div>
                  <div className={`p-3 rounded border text-center ${isDark ? 'bg-black/30 border-white/10' : 'bg-white border-slate-200'}`}>
                    <span className="block text-gray-400 text-[10px] uppercase font-bold">ตั้งค่าระบบ</span>
                    <strong className="text-lg text-amber-400 font-mono">สมบูรณ์</strong>
                  </div>
                </div>
              </div>

              <div className="text-center py-4 space-y-3">
                <button
                  onClick={handleDownloadFullJson}
                  className="px-6 py-3.5 bg-gradient-to-r from-[#D4AF37] to-amber-500 hover:from-amber-400 hover:to-amber-600 text-black font-bold font-sans rounded-md shadow-lg flex items-center justify-center gap-2.5 mx-auto transition-all transform hover:-translate-y-0.5 cursor-pointer text-sm"
                >
                  <FileJson className="w-5 h-5 text-black" />
                  ดาวน์โหลดไฟล์สำรองข้อมูลฉบับเต็ม (.JSON Download)
                </button>
                <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                  ไฟล์ JSON นี้ประกอบด้วยฐานข้อมูลพนักงาน ประวัติลงเวลางาน สวัสดิการ วันหยุด และการตั้งค่าระบบทั้งหมด สามารถใช้นำกลับมาฟื้นฟูข้อมูลได้ตลอดเวลา
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: Scoped Backups & Excel Export */}
          {activeTab === 'scoped' && (
            <div className="space-y-6">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#D4AF37] mb-3 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-[#D4AF37]" />
                  ตัวเลือกการสำรองข้อมูลแยกตามช่วงเวลา (Weekly, Monthly, Last Week, Last Month)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Weekly */}
                  <div className={`p-4 rounded-lg border flex flex-col justify-between space-y-3 ${
                    isDark ? 'bg-[#181818] border-white/10' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <div>
                      <h5 className="font-bold text-sm text-[#D4AF37] flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-[#D4AF37]" />
                        1. Back up weekly (สำรองประจำสัปดาห์)
                      </h5>
                      <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                        สำรองเฉพาะเรคคอร์ดลงเวลางานในช่วง 7 วันล่าสุด พร้อมข้อมูลพนักงาน
                      </p>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => handleDownloadScopedJson('weekly')}
                        className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-white rounded text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        JSON
                      </button>
                      <button
                        onClick={() => handleExportExcelAllDataTable('weekly')}
                        className="flex-1 py-2 px-3 bg-emerald-700 hover:bg-emerald-600 text-white rounded text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        Excel (.csv)
                      </button>
                    </div>
                  </div>

                  {/* Monthly */}
                  <div className={`p-4 rounded-lg border flex flex-col justify-between space-y-3 ${
                    isDark ? 'bg-[#181818] border-white/10' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <div>
                      <h5 className="font-bold text-sm text-emerald-500 flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-emerald-500" />
                        2. Monthly (สำรองประจำเดือนนี้)
                      </h5>
                      <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                        สำรองเรคคอร์ดลงเวลาตามรอบตัดบัญชีเงินเดือนปัจจุบัน
                      </p>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => handleDownloadScopedJson('monthly')}
                        className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-white rounded text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        JSON
                      </button>
                      <button
                        onClick={() => handleExportExcelAllDataTable('monthly')}
                        className="flex-1 py-2 px-3 bg-emerald-700 hover:bg-emerald-600 text-white rounded text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        Excel (.csv)
                      </button>
                    </div>
                  </div>

                  {/* To Last Week */}
                  <div className={`p-4 rounded-lg border flex flex-col justify-between space-y-3 ${
                    isDark ? 'bg-[#181818] border-white/10' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <div>
                      <h5 className="font-bold text-sm text-sky-400 flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-sky-400" />
                        3. To last week (ย้อนหลังสัปดาห์ที่แล้ว)
                      </h5>
                      <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                        สำรองเรคคอร์ดเฉพาะช่วงสัปดาห์ก่อนหน้า (7 - 14 วันย้อนหลัง)
                      </p>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => handleDownloadScopedJson('last_week')}
                        className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-white rounded text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        JSON
                      </button>
                      <button
                        onClick={() => handleExportExcelAllDataTable('last_week')}
                        className="flex-1 py-2 px-3 bg-emerald-700 hover:bg-emerald-600 text-white rounded text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        Excel (.csv)
                      </button>
                    </div>
                  </div>

                  {/* Last Month */}
                  <div className={`p-4 rounded-lg border flex flex-col justify-between space-y-3 ${
                    isDark ? 'bg-[#181818] border-white/10' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <div>
                      <h5 className="font-bold text-sm text-amber-400 flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-amber-400" />
                        4. Last month (ย้อนหลังเดือนที่แล้ว)
                      </h5>
                      <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                        สำรองเรคคอร์ดเฉพาะช่วงรอบตัดบัญชีของเดือนที่แล้ว
                      </p>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => handleDownloadScopedJson('last_month')}
                        className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-white rounded text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        JSON
                      </button>
                      <button
                        onClick={() => handleExportExcelAllDataTable('last_month')}
                        className="flex-1 py-2 px-3 bg-emerald-700 hover:bg-emerald-600 text-white rounded text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        Excel (.csv)
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* To Excel All Data Table Banner */}
              <div className={`p-5 rounded-lg border border-emerald-500/40 bg-gradient-to-r ${
                isDark ? 'from-emerald-950/40 via-[#181818] to-emerald-950/20' : 'from-emerald-50 via-white to-emerald-50/50'
              } flex flex-col md:flex-row items-center justify-between gap-4`}>
                <div className="space-y-1">
                  <h4 className="text-sm font-extrabold text-emerald-500 flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5 text-emerald-500" />
                    5. To Excel All Data table (ส่งออกตารางข้อมูลทั้งหมด)
                  </h4>
                  <p className={`text-xs ${isDark ? 'text-gray-300' : 'text-slate-600'}`}>
                    ดาวน์โหลดตารางบันทึกการทำงานช่างและพนักงานทั้งหมด ({entries.length} เรคคอร์ด) เป็นไฟล์ Excel/CSV UTF-8 รองรับภาษาไทยสมบูรณ์แบบ
                  </p>
                </div>
                <button
                  onClick={() => handleExportExcelAllDataTable('all')}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded shadow flex items-center gap-2 whitespace-nowrap cursor-pointer transition-all text-xs"
                >
                  <Download className="w-4 h-4" />
                  ส่งออก Excel All Data ({entries.length} รายการ)
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: Restore Backup */}
          {activeTab === 'restore' && (
            <div className="space-y-6">
              <div className={`p-4 rounded-lg border ${
                isDark ? 'bg-[#181818] border-white/10' : 'bg-slate-50 border-slate-200'
              }`}>
                <h4 className="text-sm font-bold text-[#D4AF37] mb-2 flex items-center gap-2">
                  <Upload className="w-4 h-4 text-[#D4AF37]" />
                  อัปโหลดไฟล์ JSON เพื่อฟื้นฟูข้อมูลระบบ (Restore JSON Backup)
                </h4>
                <p className={`text-xs mb-4 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                  เลือกไฟล์ .JSON ที่ได้เคยดาวน์โหลดสำรองไว้จากระบบ เพื่อกู้คืนฐานข้อมูลพนักงาน บันทึกเวลา และการตั้งค่ากลับมาทันที
                </p>

                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileSelect}
                  className="block w-full text-xs text-gray-400 file:mr-4 file:py-2.5 file:px-4 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-[#D4AF37] file:text-black hover:file:bg-amber-400 cursor-pointer"
                />
              </div>

              {importPreview && (
                <div className={`p-4 rounded-lg border transition-all ${
                  importPreview.valid 
                    ? isDark ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300' : 'bg-emerald-50 border-emerald-300 text-emerald-900'
                    : 'bg-rose-950/20 border-rose-500/40 text-rose-300'
                }`}>
                  {importPreview.valid ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        <h5 className="font-bold text-sm">ตรวจพบไฟล์สำรองข้อมูลที่สมบูรณ์</h5>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs text-center font-mono">
                        <div className="p-2 bg-black/20 rounded border border-emerald-500/20">
                          <span>พนักงาน: </span>
                          <strong className="text-white">{importPreview.empCount}</strong>
                        </div>
                        <div className="p-2 bg-black/20 rounded border border-emerald-500/20">
                          <span>ลงเวลา: </span>
                          <strong className="text-white">{importPreview.entryCount}</strong>
                        </div>
                        <div className="p-2 bg-black/20 rounded border border-emerald-500/20">
                          <span>วันหยุด: </span>
                          <strong className="text-white">{importPreview.holidayCount}</strong>
                        </div>
                      </div>
                      <button
                        onClick={handleConfirmRestore}
                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded shadow text-xs flex items-center justify-center gap-2 cursor-pointer transition-all"
                      >
                        <Upload className="w-4 h-4" />
                        ยืนยันการเรียกคืนข้อมูล (Confirm Restore Data)
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-rose-400" />
                      <span className="text-xs font-bold">{importPreview.error}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: Auto Save Config */}
          {activeTab === 'settings' && (
            <div className="space-y-6">
              <div className={`p-4 rounded-lg border space-y-4 ${
                isDark ? 'bg-[#181818] border-white/10' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-[#D4AF37]">เปิดใช้งานระบบบันทึกอัตโนมัติ (Auto-Save)</h4>
                    <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                      ระบบจะทำการบันทึกข้อมูลลงใน Browser Local Storage โดยอัตโนมัติตามระยะเวลาที่กำหนด
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoSaveEnabled}
                    onChange={(e) => setAutoSaveEnabled(e.target.checked)}
                    className="w-5 h-5 accent-[#D4AF37] cursor-pointer"
                  />
                </div>

                <hr className={isDark ? 'border-white/10' : 'border-slate-200'} />

                <div className="space-y-2">
                  <label className="text-xs font-bold block text-[#D4AF37]">
                    ความถี่ในการบันทึกอัตโนมัติ (Auto-Save Interval)
                  </label>
                  <select
                    value={autoSaveIntervalSec}
                    onChange={(e) => setAutoSaveIntervalSec(Number(e.target.value))}
                    disabled={!autoSaveEnabled}
                    className={`w-full p-2.5 rounded text-xs border font-mono font-bold ${
                      isDark ? 'bg-[#121212] border-white/15 text-white' : 'bg-white border-slate-300 text-slate-800'
                    }`}
                  >
                    <option value={15}>ทุกๆ 15 วินาที (15 Seconds)</option>
                    <option value={30}>ทุกๆ 30 วินาที (30 Seconds - แนะนำ)</option>
                    <option value={60}>ทุกๆ 1 นาที (1 Minute)</option>
                    <option value={300}>ทุกๆ 5 นาที (5 Minutes)</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`px-6 py-3 border-t flex justify-end ${
          isDark ? 'bg-[#181818] border-white/10' : 'bg-slate-50 border-slate-200'
        }`}>
          <button
            onClick={onClose}
            className={`px-4 py-2 rounded text-xs font-bold transition-all cursor-pointer ${
              isDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
            }`}
          >
            ปิดหน้าต่าง (Close)
          </button>
        </div>
      </div>
    </div>
  );
}
