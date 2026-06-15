import React, { useState, useEffect } from 'react';
import { SystemSettings } from '../types';
import { Sliders, Save, CheckCircle, RotateCcw, AlertTriangle, Coins, ShieldCheck, HelpCircle, Database, RefreshCw, Server, CheckCircle2, XCircle } from 'lucide-react';
import { getSupabaseCredentials, updateSupabaseClient, dbCheckTablesStatus } from '../lib/supabaseClient';

interface SettingsSectionProps {
  settings: SystemSettings;
  onUpdateSettings: (updated: SystemSettings) => void;
  isDark: boolean;
}

export default function SettingsSection({ settings, onUpdateSettings, isDark }: SettingsSectionProps) {
  const [ot15, setOt15] = useState(settings.ot15Rate);
  const [ot20, setOt20] = useState(settings.ot20Rate);
  const [ot30, setOt30] = useState(settings.ot30Rate);
  const [dailyWage, setDailyWage] = useState(settings.defaultDailyWage);
  const [workHours, setWorkHours] = useState(settings.defaultWorkHours);
  
  const [showStatus, setShowStatus] = useState<boolean>(false);

  // Supabase dynamic states
  const { url: initialUrl, key: initialKey } = getSupabaseCredentials();
  const [supabaseUrlInput, setSupabaseUrlInput] = useState(initialUrl);
  const [supabaseKeyInput, setSupabaseKeyInput] = useState(initialKey);
  const [isTestingSupa, setIsTestingSupa] = useState(false);
  const [supaStatus, setSupaStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [showSupaSuccessMsg, setShowSupaSuccessMsg] = useState(false);
  const [supaErrMsg, setSupaErrMsg] = useState('');
  const [showSqlHelper, setShowSqlHelper] = useState(false);
  const [tableStatus, setTableStatus] = useState<Record<string, boolean>>({
    EmployeeRates: false,
    TIMESHEET: false,
    RateCalulate: false,
    'Sumary-Mount': false,
    IndividualSupplements: false
  });

  // Verify connection immediately on mount
  useEffect(() => {
    checkDatabaseConnection(initialUrl, initialKey);
  }, []);

  const checkDatabaseConnection = async (url: string, key: string) => {
    if (!url || !key) return;
    setIsTestingSupa(true);
    setSupaStatus('idle');
    setSupaErrMsg('');
    try {
      updateSupabaseClient(url, key);
      const status = await dbCheckTablesStatus();
      setTableStatus(status);
      
      const anyTableSuccess = Object.values(status).some(v => v === true);
      setSupaStatus('success');
    } catch (err: any) {
      setSupaStatus('error');
      setSupaErrMsg(err?.message || 'ไม่สามารถเชื่อมต่อได้ ตรวจสอบ URL หรือคีย์ของคุณ');
    } finally {
      setIsTestingSupa(false);
    }
  };

  const handleSupaSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await checkDatabaseConnection(supabaseUrlInput, supabaseKeyInput);
    setShowSupaSuccessMsg(true);
    setTimeout(() => setShowSupaSuccessMsg(false), 3000);
  };

  const resetToDefault = () => {
    setOt15(1.5);
    setOt20(2.0);
    setOt30(3.0);
    setDailyWage(350);
    setWorkHours(8);
    
    onUpdateSettings({
      ot15Rate: 1.5,
      ot20Rate: 2.0,
      ot30Rate: 3.0,
      defaultDailyWage: 350,
      defaultWorkHours: 8
    });
    
    setShowStatus(true);
    setTimeout(() => setShowStatus(false), 2500);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings({
      ot15Rate: Number(ot15),
      ot20Rate: Number(ot20),
      ot30Rate: Number(ot30),
      defaultDailyWage: Number(dailyWage),
      defaultWorkHours: Number(workHours)
    });
    setShowStatus(true);
    setTimeout(() => setShowStatus(false), 2500);
  };

  const bgCard = isDark ? 'bg-[#141414] border-white/10' : 'bg-white border-slate-200 shadow-sm';
  const labelText = isDark ? 'text-gray-450 font-mono text-[10px]' : 'text-slate-600 font-bold text-[10px]';
  const inputBg = isDark ? 'bg-[#0D0D0D] border-white/10 text-white focus:border-[#D4AF37]' : 'bg-white border-slate-300 text-slate-800 focus:ring-2 focus:ring-[#D4AF37]/40 focus:border-[#D4AF37]';
  const textTitle = isDark ? 'text-white' : 'text-slate-850';
  const textSub = isDark ? 'text-gray-400' : 'text-slate-500';

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-fade-in">
      <div className={`p-5 rounded-sm border ${bgCard}`}>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-base font-serif uppercase tracking-wider text-[#D4AF37] flex items-center gap-2">
              <Sliders className="w-5 h-5 text-[#D4AF37]" />
              หน้าปรับแต่งตัวเลือกคำนวณเงินค่าแรงและเรทโอที (Calculate Preferences & Policy Configurator)
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              แก้ไขตัวคูณและค่าแรงขั้นต่ำเริ่มต้นของระบบ (Multipliers Setup) อัปเดตแบบเรียลไทม์ไม่ต้องเขียนโค้ดซ้ำซาก
            </p>
          </div>
          
          <button
            onClick={resetToDefault}
            className={`flex items-center gap-1.5 bg-transparent border border-amber-500/25 hover:bg-amber-500/5 text-amber-500 font-bold text-xs py-2 px-3.5 rounded-sm transition-all cursor-pointer`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            คืนค่าเริ่มต้นโรงงาน (Reset)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Policy variables forms */}
        <form onSubmit={handleSave} className={`md:col-span-2 p-6 rounded-sm border ${bgCard} space-y-6`}>
          <div className="border-b border-dashed border-white/10 pb-4">
            <h3 className={`text-xs font-bold uppercase tracking-wider ${textTitle} flex items-center gap-2`}>
              <Coins className="w-4 h-4 text-[#D4AF37]" />
              ค่าสัมประสิทธิ์ตัวคูณเงินล่วงเวลา (Overtime Multiplying Coefficients)
            </h3>
            <p className="text-[11px] text-gray-400 mt-0.5">
              ตั้งค่าเรทคูณเงินต่อชั่วโมงของแต่ละช่องตามกฎหมายแรงงานหรือสัญญารับเหมา
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className={`block uppercase tracking-wider ${labelText}`}>เรทโอที 1.5 เท่า (ปกติวันทำงาน)</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  min="1"
                  max="5"
                  value={ot15}
                  onChange={(e) => setOt15(Number(e.target.value))}
                  className={`w-full text-xs rounded-sm py-2 px-3 font-semibold ${inputBg}`}
                  required
                />
                <span className="absolute right-3 top-2.5 text-[9px] font-mono text-gray-500">x</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className={`block uppercase tracking-wider ${labelText}`}>เรทโอที 2.0 เท่า (วันหยุดทำงานปกติ)</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  min="1"
                  max="5"
                  value={ot20}
                  onChange={(e) => setOt20(Number(e.target.value))}
                  className={`w-full text-xs rounded-sm py-2 px-3 font-semibold ${inputBg}`}
                  required
                />
                <span className="absolute right-3 top-2.5 text-[9px] font-mono text-gray-500">x</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className={`block uppercase tracking-wider ${labelText}`}>เรทโอที 3.0 เท่า (ล่วงเวลาวันหยุด)</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  min="1"
                  max="5"
                  value={ot30}
                  onChange={(e) => setOt30(Number(e.target.value))}
                  className={`w-full text-xs rounded-sm py-2 px-3 font-semibold ${inputBg}`}
                  required
                />
                <span className="absolute right-3 top-2.5 text-[9px] font-mono text-gray-500">x</span>
              </div>
            </div>
          </div>

          <div className="border-b border-dashed border-white/10 pb-4 pt-2">
            <h3 className={`text-xs font-bold uppercase tracking-wider ${textTitle} flex items-center gap-2`}>
              <ShieldCheck className="w-4 h-4 text-[#D4AF37]" />
              ฐานเกณฑ์พนักงานรายวันเริ่มต้น (Daily Workers Default Wage Policies)
            </h3>
            <p className="text-[11px] text-gray-400 mt-0.5">
              ตัวสำรองเมื่อไม่พบการระบุค่าจ้างเฉพาะของช่างในประวัติ เพื่อใช้เป็นพารามิเตอร์คำนวณเบ็ดเสร็จ
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className={`block uppercase tracking-wider ${labelText}`}>ค่าจ้างรายวันพื้นฐานเริ่มต้น (Default Daily Wage)</label>
              <div className="relative">
                <input
                  type="number"
                  step="1"
                  min="100"
                  max="5000"
                  value={dailyWage}
                  onChange={(e) => setDailyWage(Number(e.target.value))}
                  className={`w-full text-xs rounded-sm py-2 px-3 pl-8 font-semibold ${inputBg}`}
                  required
                />
                <span className="absolute left-3 top-2.5 text-[9px] font-bold text-[#D4AF37]">฿</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className={`block uppercase tracking-wider ${labelText}`}>จำนวนชั่วโมงทำงานต่อวันปกติ (Hours / Day)</label>
              <div className="relative">
                <input
                  type="number"
                  step="1"
                  min="4"
                  max="12"
                  value={workHours}
                  onChange={(e) => setWorkHours(Number(e.target.value))}
                  className={`w-full text-xs rounded-sm py-2 px-3 font-semibold ${inputBg}`}
                  required
                />
                <span className="absolute right-3 top-2.5 text-[9px] font-mono text-gray-500">ชม.</span>
              </div>
            </div>
          </div>

          <div className="pt-4 flex items-center justify-between">
            {showStatus ? (
              <div className="flex items-center gap-1.5 text-emerald-500 font-bold text-xs animate-pulse bg-emerald-500/10 py-1.5 px-3 rounded-full">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                ✓ บันทึกการอัปเดตนโยบายคำนวณลงเบราว์เซอร์สัมฤทธิ์ผลแล้ว!
              </div>
            ) : <div />}

            <button
              id="save-settings-btn"
              type="submit"
              className="flex items-center gap-2 bg-[#D4AF37] hover:bg-amber-400 text-black font-extrabold text-xs py-2.5 px-6 rounded-sm uppercase tracking-wider transition-all shadow-md transform active:scale-95 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              บันทึกการเปลี่ยนแปลง (Save Configurations)
            </button>
          </div>
        </form>

        {/* Sidebar Info Card */}
        <div className="space-y-4">
          <div className={`p-5 rounded-sm border ${bgCard} space-y-4`}>
            <div className="flex items-center gap-2 text-[#D4AF37] text-xs font-bold uppercase tracking-wider">
              <AlertTriangle className="w-4 h-4 text-[#D4AF37]" />
              ข้อควรระวังทางกฎหมาย
            </div>
            <div className="text-[11px] text-gray-400 space-y-2.5 leading-relaxed">
              <p>
                ตาม <strong className="text-white">พระราชบัญญัติคุ้มครองแรงงานของไทย</strong> การจ่ายเงินค่าทำงานล่วงเวลา (Overtime Pay) มีเกณฑ์ควบคุมขั้นต่ำ:
              </p>
              <ul className="list-disc pl-4 space-y-1 text-gray-500">
                <li>ล่วงเวลาในวันทำงานปกติ: <strong className="text-gray-300">ไม่น้อยกว่า 1.5 เท่า</strong> ของอัตราปกติ</li>
                <li>ทำงานในวันหยุด (เวลาทำงานปกติ): <strong className="text-gray-300">ไม่น้อยกว่า 1 เท่า (สำหรับรายเดือน) หรือ 2 เท่า (สำหรับรายวัน)</strong></li>
                <li>ล่วงเวลาทำงานในวันหยุด: <strong className="text-gray-300">ไม่น้อยกว่า 3 เท่า</strong></li>
              </ul>
              <p className="border-t border-white/5 pt-2.5">
                การตั้งค่าตัวคูณต่ำกว่ามาตรฐานกฎหมายอาจส่งผลให้เกิดความขัดแย้งด้านคดีแรงงานได้ โปรดตรวจสอบกับฝ่ายกฎหมายก่อนปรับลดค่าเรท
              </p>
            </div>
          </div>

          <div className={`p-4 rounded-sm border ${bgCard} flex items-start gap-3`}>
            <HelpCircle className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
            <div>
              <h4 className={`text-xs font-bold ${textTitle}`}>สูตรคำนวณเรทต่อชั่วโมง</h4>
              <p className="text-[10.5px] text-gray-400 leading-normal mt-1">
                - **พนักงานประจำ**: <br/> HourlyRate = (เงินเดือนประจำ / 30 / 8)<br/>
                - **พนักงานชั่วคราว/รายวัน**: <br/> HourlyRate = (ค่าเรทไซส์งานหน้างาน / 8)<br/>
                *(และจะคูณต่อด้วยเกณฑ์ OT ที่คุณตั้งไว้)*
              </p>
            </div>
          </div>
        </div>

        {/* Supabase Connection Widget */}
        <div className={`md:col-span-3 p-6 rounded-sm border ${bgCard} space-y-6`}>
          <div className="border-b border-dashed border-white/10 pb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h3 className={`text-xs font-bold uppercase tracking-wider ${textTitle} flex items-center gap-2`}>
                <Database className="w-4 h-4 text-[#D4AF37]" />
                หน้าเชื่อมต่อระบบคลาวด์ฐานข้อมูล Supabase (Live Database Control Panel)
              </h3>
              <p className="text-[11px] text-gray-400 mt-0.5">
                เชื่อมต่อกับโปรเจกต์ Supabase ส่วนตัวของคุณแบบ Dynamic ทุกครั้งที่บันทึกหรือดึงตารางทำงานรายชื่อพนักงานจะดำเนินการบน Supabase เป็นสำคัญ
              </p>
            </div>
            
            {/* Connection Status Badge */}
            <div>
              {isTestingSupa ? (
                <span className="flex items-center gap-1.5 text-sky-400 text-xs font-bold font-mono bg-sky-950/40 px-3 py-1 rounded-full border border-sky-900/30">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  กำลังตรวจสอบ...
                </span>
              ) : supaStatus === 'success' ? (
                <span className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold font-mono bg-emerald-950/40 px-3 py-1 rounded-full border border-emerald-900/30 animate-pulse">
                  <Server className="w-3.5 h-3.5 text-emerald-400" />
                  เชื่อมต่อระบบคลาวด์แล้ว (Live)
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-red-500 text-xs font-bold font-mono bg-red-950/40 px-3 py-1 rounded-full border border-red-900/30">
                  <XCircle className="w-3.5 h-3.5 text-red-500" />
                  ไม่พบฐานข้อมูลหรือยังไม่ได้ตั้งค่า
                </span>
              )}
            </div>
          </div>

          <form onSubmit={handleSupaSave} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className={`block uppercase tracking-wider ${labelText}`}>Supabase API URL</label>
              <input
                type="url"
                value={supabaseUrlInput}
                onChange={(e) => setSupabaseUrlInput(e.target.value)}
                placeholder="https://your-project.supabase.co"
                className={`w-full text-xs rounded-sm py-2 px-3 focus:outline-none ${inputBg}`}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className={`block uppercase tracking-wider ${labelText}`}>Supabase Secret Service/Anon Key</label>
              <input
                type="password"
                value={supabaseKeyInput}
                onChange={(e) => setSupabaseKeyInput(e.target.value)}
                placeholder="eyJhbGciOiJIUzI1NiIs..."
                className={`w-full text-xs rounded-sm py-2 px-3 focus:outline-none ${inputBg}`}
                required
              />
            </div>

            <div className="md:col-span-2 pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex flex-col gap-1">
                {showSupaSuccessMsg && (
                  <span className="text-emerald-500 font-bold text-xs animate-fade-in bg-emerald-500/10 py-1 px-2.5 rounded-full">
                     เชื่อมต่อสำเร็จ! ตรวจสอบตารางและบันทึกคีย์เรียบร้อย
                  </span>
                )}
                {supaErrMsg && (
                  <span className="text-red-400 font-bold text-xs animate-fade-in bg-red-500/10 py-1 px-2.5 rounded-full">
                    ⚠️ {supaErrMsg}
                  </span>
                )}
              </div>

              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setShowSqlHelper(!showSqlHelper)}
                  className="flex items-center justify-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-[#D4AF37] font-semibold text-xs py-2 px-4 rounded-sm border border-amber-900/20 cursor-pointer w-full sm:w-auto"
                >
                  📜 {showSqlHelper ? 'ปิดโค้ด SQL' : 'ดูคำสั่งสร้างตาราง SQL'}
                </button>
                <button
                  type="submit"
                  disabled={isTestingSupa}
                  className="flex items-center justify-center gap-2 bg-[#D4AF37] hover:bg-amber-400 text-black font-extrabold text-xs py-2 px-5 rounded-sm transition-all shadow-md cursor-pointer disabled:opacity-50 w-full sm:w-auto"
                >
                  <Save className="w-4 h-4" />
                  {isTestingSupa ? 'กำลังบันทึก...' : 'บันทึกเชื่อมต่อ & ตรวจสุขภาพระบบ'}
                </button>
              </div>
            </div>
          </form>

          {/* Table Health Diagnostics */}
          <div className="bg-slate-900/10 dark:bg-slate-950/20 p-4 rounded-sm border border-slate-300 dark:border-white/5 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
              📊 สถานะความสมบูรณ์ของโครงสร้างตารางระบบ (Database Table Integrity Checker)
            </h4>
            <p className="text-[10.5px] text-slate-500">
              ระบบตรวจสอบความสมบูรณ์ของการติดตั้ง ทั้ง 5 ตารางหลักเพื่อความมั่นใจในการจัดเก็บข้อมูลอย่างถาวร
            </p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5 pt-1.5">
              {Object.entries(tableStatus).map(([name, status]) => (
                <div key={name} className={`p-2.5 rounded border text-center flex flex-col items-center justify-center gap-1 transition-all ${
                  status 
                    ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold shadow-xs' 
                    : 'bg-amber-500/5 border-amber-500/20 text-amber-600 dark:text-amber-500'
                }`}>
                  <span className="text-[10px] font-mono whitespace-nowrap truncate max-w-full" title={name}>{name}</span>
                  {status ? (
                    <span className="text-[9px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 font-extrabold py-0.5 px-2 rounded-full border border-emerald-500/10">สมบูรณ์</span>
                  ) : (
                    <span className="text-[9px] bg-amber-500/10 text-amber-700 dark:text-amber-300 font-extrabold py-0.5 px-2 rounded-full border border-amber-500/15 animate-pulse">ไม่พบตาราง</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Full copyable SQL Schema script box directly inside settings */}
          {showSqlHelper && (
            <div className="p-4 bg-zinc-900 border border-[#D4AF37]/20 rounded-sm text-xs text-slate-300 space-y-3 max-w-[1000px] animate-fade-in">
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <span className="font-extrabold text-amber-400 flex items-center gap-2 text-[11px] font-serif tracking-wider uppercase">
                  📜 สคริปต์ SQL สำหรับสร้างตารางทั้ง 5 ตัว (Execute in your Supabase SQL Editor)
                </span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(`-- SUPABASE ALL TABLES SCHEMA
-- 1. EmployeeRates
create table if not exists public."EmployeeRates" (
    "ID" uuid default uuid_generate_v4() primary key,
    "EmployeeID" text unique not null,
    "EmployeeName" text not null,
    "StaffSalary" numeric(12, 2) default 0.00,
    "OfficeSalary" numeric(12, 2) default 0.00,
    "TransportationRate" numeric(12, 2) default 0.00,
    "WorkshopRate" numeric(12, 2) default 0.00,
    "OnsiteRate" numeric(12, 2) default 0.00,
    "OffshoreRate" numeric(12, 2) default 0.00,
    "WFHRate" numeric(12, 2) default 0.00,
    "Position" text default 'Technician',
    "Status" text default 'active',
    "BankName" text,
    "BankAccount" text,
    "StudentLoan" numeric(12, 2) default 0.00,
    "WorkScheduleType" text default 'daily_worker',
    "isFlatRate" boolean default false,
    "CreatedAt" timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public."EmployeeRates" disable row level security;

-- 2. TIMESHEET
create table if not exists public."TIMESHEET" (
    "ID" uuid default uuid_generate_v4() primary key,
    "EmployeeName" text not null,
    "Date" date not null,
    "Project" text default 'workshop',
    "TimeIn" text default '08:00',
    "TimeOut" text default '17:00',
    "LunchDeduct" integer default 1,
    "LunchOT" integer default 0,
    "NormalHours" numeric(5, 2) default 0.00,
    "OT15Hours" numeric(5, 2) default 0.00,
    "OT20Hours" numeric(5, 2) default 0.00,
    "OT30Hours" numeric(5, 2) default 0.00,
    "Remark" text,
    "Status" text default 'Pending',
    "CreatedAt" timestamp with time zone default timezone('utc'::text, now()) not null,
    "UpdatedAt" timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public."TIMESHEET" disable row level security;

-- 3. RateCalulate
create table if not exists public."RateCalulate" (
    "ID" uuid default uuid_generate_v4() primary key,
    "EmployeeName" text not null,
    "Date" date not null,
    "Project" text not null,
    "RATE" numeric(12, 2) default 0.00,
    "LunchOT" integer default 0,
    "NormalHours" numeric(5, 2) default 0.00,
    "OT15Hours" numeric(5, 2) default 0.00,
    "OT20Hours" numeric(5, 2) default 0.00,
    "OT30Hours" numeric(5, 2) default 0.00,
    "Remark" text,
    "OTCalculated" numeric(12, 2) default 0.00,
    "Sumtotal" numeric(12, 2) default 0.00,
    "CreatedAt" timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public."RateCalulate" disable row level security;

-- 4. Sumary-Mount
create table if not exists public."Sumary-Mount" (
    "ID" uuid default uuid_generate_v4() primary key,
    "EmployeeName" text not null,
    "StartDate" date not null,
    "EndDate" date not null,
    "TotalTime" numeric(8, 2) default 0.00,
    "TotalDays" integer default 0,
    "NetNormal" numeric(12, 2) default 0.00,
    "OT15Wage" numeric(12, 2) default 0.00,
    "OT20Wage" numeric(12, 2) default 0.00,
    "OT30Wage" numeric(12, 2) default 0.00,
    "OtherIncome" numeric(12, 2) default 0.00,
    "OtherDeductions" numeric(12, 2) default 0.00,
    "TaxDeduct" numeric(12, 2) default 0.00,
    "SocialSecurity" numeric(12, 2) default 0.00,
    "StudentLoan" numeric(12, 2) default 0.00,
    "TotalIncome" numeric(12, 2) default 0.00,
    "NetIncome" numeric(12, 2) default 0.00,
    "CreatedAt" timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public."Sumary-Mount" disable row level security;

-- 5. IndividualSupplements
create table if not exists public."IndividualSupplements" (
    "ID" text primary key,
    "EmployeeID" text not null,
    "EmployeeName" text not null,
    "Date" date not null,
    "Perdiem" numeric(12, 2) default 0.00,
    "Advance" numeric(12, 2) default 0.00,
    "JobBonus" numeric(12, 2) default 0.00,
    "ConfineSpace" numeric(12, 2) default 0.00,
    "Incentive" numeric(12, 2) default 0.00,
    "Remark" text,
    "CreatedAt" timestamp with time zone default timezone('utc'::text, now()) not null,
    "UpdatedAt" timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public."IndividualSupplements" disable row level security;`);
                    alert('คัดลอกโค้ด SQL ตารางระบบไปยังคลิปบอร์ดแล้ว! นำไปรันหน้า SQL Editor ใน Supabase ได้ทันที');
                  }}
                  className="text-amber-400 font-bold text-xs underline cursor-pointer hover:text-amber-300"
                >
                  📋 คัดลอก SQL ทั้ง 5 ตาราง
                </button>
              </div>
              <p className="text-[11px] text-gray-400">
                เนื่องจากเป็นการซิงโครไนซ์แบบสองทิศทาง (Real-time Cloud Integration) กรุณานำสคริปต์ SQL นี้ไปรันที่ <strong className="text-white">Supabase Console ↗</strong> ช่องเมนู <strong className="text-white font-mono">SQL Editor (New Query)</strong> แล้วกด <strong className="text-white font-mono">Run</strong>:
              </p>
              <pre className="p-3 bg-black/60 text-[10px] font-mono text-emerald-400 border border-white/5 rounded max-h-56 overflow-y-auto select-all scrollbar-thin">
{`-- SUPABASE ALL TABLES SCHEMA
-- 1. EmployeeRates Table
create table if not exists public."EmployeeRates" (
    "ID" uuid default uuid_generate_v4() primary key,
    "EmployeeID" text unique not null,
    "EmployeeName" text not null,
    "StaffSalary" numeric(12, 2) default 0.00,
    "OfficeSalary" numeric(12, 2) default 0.00,
    "TransportationRate" numeric(12, 2) default 0.00,
    "WorkshopRate" numeric(12, 2) default 0.00,
    "OnsiteRate" numeric(12, 2) default 0.00,
    "OffshoreRate" numeric(12, 2) default 0.00,
    "WFHRate" numeric(12, 2) default 0.00,
    "Position" text default 'Technician',
    "Status" text default 'active',
    "BankName" text,
    "BankAccount" text,
    "StudentLoan" numeric(12, 2) default 0.00,
    "WorkScheduleType" text default 'daily_worker',
    "isFlatRate" boolean default false,
    "CreatedAt" timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public."EmployeeRates" disable row level security;

-- 2. TIMESHEET Table
create table if not exists public."TIMESHEET" (
    "ID" uuid default uuid_generate_v4() primary key,
    "EmployeeName" text not null,
    "Date" date not null,
    "Project" text default 'workshop',
    "TimeIn" text default '08:00',
    "TimeOut" text default '17:00',
    "LunchDeduct" integer default 1,
    "LunchOT" integer default 0,
    "NormalHours" numeric(5, 2) default 0.00,
    "OT15Hours" numeric(5, 2) default 0.00,
    "OT20Hours" numeric(5, 2) default 0.00,
    "OT30Hours" numeric(5, 2) default 0.00,
    "Remark" text,
    "Status" text default 'Pending',
    "CreatedAt" timestamp with time zone default timezone('utc'::text, now()) not null,
    "UpdatedAt" timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public."TIMESHEET" disable row level security;

-- 3. RateCalulate
create table if not exists public."RateCalulate" (
    "ID" uuid default uuid_generate_v4() primary key,
    "EmployeeName" text not null,
    "Date" date not null,
    "Project" text not null,
    "RATE" numeric(12, 2) default 0.00,
    "LunchOT" integer default 0,
    "NormalHours" numeric(5, 2) default 0.00,
    "OT15Hours" numeric(5, 2) default 0.00,
    "OT20Hours" numeric(5, 2) default 0.00,
    "OT30Hours" numeric(5, 2) default 0.00,
    "Remark" text,
    "OTCalculated" numeric(12, 2) default 0.00,
    "Sumtotal" numeric(12, 2) default 0.00,
    "CreatedAt" timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public."RateCalulate" disable row level security;

-- 4. Sumary-Mount
create table if not exists public."Sumary-Mount" (
    "ID" uuid default uuid_generate_v4() primary key,
    "EmployeeName" text not null,
    "StartDate" date not null,
    "EndDate" date not null,
    "TotalTime" numeric(8, 2) default 0.00,
    "TotalDays" integer default 0,
    "NetNormal" numeric(12, 2) default 0.00,
    "OT15Wage" numeric(12, 2) default 0.00,
    "OT20Wage" numeric(12, 2) default 0.00,
    "OT30Wage" numeric(12, 2) default 0.00,
    "OtherIncome" numeric(12, 2) default 0.00,
    "OtherDeductions" numeric(12, 2) default 0.00,
    "TaxDeduct" numeric(12, 2) default 0.00,
    "SocialSecurity" numeric(12, 2) default 0.00,
    "StudentLoan" numeric(12, 2) default 0.00,
    "TotalIncome" numeric(12, 2) default 0.00,
    "NetIncome" numeric(12, 2) default 0.00,
    "CreatedAt" timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public."Sumary-Mount" disable row level security;

-- 5. IndividualSupplements Table
create table if not exists public."IndividualSupplements" (
    "ID" text primary key,
    "EmployeeID" text not null,
    "EmployeeName" text not null,
    "Date" date not null,
    "Perdiem" numeric(12, 2) default 0.00,
    "Advance" numeric(12, 2) default 0.00,
    "JobBonus" numeric(12, 2) default 0.00,
    "ConfineSpace" numeric(12, 2) default 0.00,
    "Incentive" numeric(12, 2) default 0.00,
    "Remark" text,
    "CreatedAt" timestamp with time zone default timezone('utc'::text, now()) not null,
    "UpdatedAt" timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public."IndividualSupplements" disable row level security;`}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
