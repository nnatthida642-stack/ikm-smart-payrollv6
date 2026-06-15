import React, { useState, useMemo } from 'react';
import { Employee } from '../types';
import { 
  Search, UserPlus, Edit3, Check, X, 
  Trash2, CreditCard, Download, Upload, 
  FileSpreadsheet, CheckCircle2, AlertCircle, FileText
} from 'lucide-react';

interface EmployeeManagerProps {
  employees: Employee[];
  onAddEmployee: (emp: Employee) => void;
  onBulkAddEmployees?: (newEmps: Employee[]) => void;
  onUpdateEmployee: (id: string, updated: Partial<Employee>) => void;
  onDeleteEmployee: (id: string) => void;
  isDark?: boolean;
}

export default function EmployeeManager({
  employees,
  onAddEmployee,
  onBulkAddEmployees,
  onUpdateEmployee,
  onDeleteEmployee,
  isDark = true
}: EmployeeManagerProps) {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'daily_worker' | 'staff'>('all');
  
  // Edit mode state
  const [editingEmpId, setEditingEmpId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Employee>>({});

  // Add new employee state
  const [isAdding, setIsAdding] = useState(false);
  const [newEmp, setNewEmp] = useState<Partial<Employee>>({
    id: '',
    employeeName: '',
    workScheduleType: 'daily_worker',
    position: 'Daily Worker',
    status: 'active',
    bankName: '',
    bankAccount: '',
    studentLoan: 0,
    isFlatRate: false,
    workshopRate: 0,
    onsiteRate: 0,
    offshoreRate: 0,
    transportationRate: 0
  });

  // Excel Excel Import & Export features state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState('');
  const [importStatusMessage, setImportStatusMessage] = useState('');
  const [parsedEmployees, setParsedEmployees] = useState<Employee[]>([]);

  // Parser: Auto detect delimiter and convert Excel/TSV text to Employee objects
  const parsePasteData = (text: string): Employee[] => {
    if (!text.trim()) return [];
    
    // Split into lines
    const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
    if (lines.length === 0) return [];

    // Auto-detect CSV/TSV Delimiter
    const firstLine = lines[0];
    let delimiter = '\t';
    if (firstLine.includes(',')) delimiter = ',';
    else if (firstLine.includes(';')) delimiter = ';';

    const rawRows = lines.map(line => line.split(delimiter).map(cell => cell.trim().replace(/^["']|["']$/g, '')));
    
    // Determine if the first row is header row
    const isHeaderRow = (rowCells: string[]) => {
      const sampleHeaders = ['id', 'name', 'รหัส', 'ชื่อ', 'fullName', 'position', 'ตำแหน่ง'];
      return rowCells.some(cell => 
        sampleHeaders.some(sh => cell.toLowerCase().includes(sh))
      );
    };

    const hasHeader = isHeaderRow(rawRows[0]);
    const dataRows = hasHeader ? rawRows.slice(1) : rawRows;
    
    // Convert to target employee array structure
    const parsed: Employee[] = dataRows.map((row): Employee | null => {
      if (row.length < 2 || !row[0] || !row[1]) return null;
      
      const id = row[0].toUpperCase().replace(/\s+/g, '');
      const employeeName = row[1].toUpperCase();
      
      const scheduleRaw = (row[3] || '').toLowerCase();
      let workScheduleType: 'daily_worker' | 'staff' = 'daily_worker';
      if (scheduleRaw.includes('staff') || scheduleRaw.includes('เดือน') || scheduleRaw.includes('monthly') || scheduleRaw === 'staff') {
        workScheduleType = 'staff';
      }

      const position = row[2] || (workScheduleType === 'staff' ? 'Technician' : 'Daily Worker');

      const officeSalary = parseFloat(row[4]?.replace(/,/g, '')) || 0;
      const workshopRate = parseFloat(row[5]?.replace(/,/g, '')) || 0;
      const onsiteRate = parseFloat(row[6]?.replace(/,/g, '')) || 0;
      const offshoreRate = parseFloat(row[7]?.replace(/,/g, '')) || 0;
      const transportationRate = parseFloat(row[8]?.replace(/,/g, '')) || 0;
      const bankName = row[9] || '';
      const bankAccount = row[10] || '';
      const studentLoan = parseFloat(row[11]?.replace(/,/g, '')) || 0;
      
      const flatRaw = (row[12] || '').toLowerCase();
      const isFlatRate = flatRaw === 'yes' || flatRaw === 'true' || flatRaw.includes('ใช่') || flatRaw === 'y' || flatRaw === '1';

      return {
        id,
        employeeName,
        position,
        workScheduleType,
        officeSalary,
        staffSalary: officeSalary,
        workshopRate,
        onsiteRate,
        offshoreRate,
        transportationRate,
        bankName,
        bankAccount,
        studentLoan,
        isFlatRate,
        status: 'active' as const
      };
    }).filter((emp): emp is Employee => emp !== null);

    return parsed;
  };

  // Trigger preview on raw text box modifications
  const handlePasteChange = (text: string) => {
    setImportText(text);
    const parsed = parsePasteData(text);
    setParsedEmployees(parsed);
    if (parsed.length > 0) {
      setImportStatusMessage(`✨ ตรวจพบพนักงานทั้งหมด ${parsed.length} คน ถูกวิเคราะห์พร้อมลงทะเบียนเรียบร้อย`);
    } else {
      setImportStatusMessage('');
    }
  };

  // Upload spreadsheet CSV/TXT file picker
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        handlePasteChange(text);
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  // Submit parsed batch to application
  const handleConfirmBatchImport = () => {
    if (parsedEmployees.length === 0) {
      alert('ไม่พบข้อมูลพนักงานสำหรับนำเข้า กรุณาวางหรืออัปโหลดข้อมูลงามๆ ก่อนครับ');
      return;
    }

    if (onBulkAddEmployees) {
      onBulkAddEmployees(parsedEmployees);
      alert(`🎉 ประสบความสำเร็จ! ทำการนำเข้าทะเบียนข้อมูลพนักงานใหม่คราวละ ${parsedEmployees.length} คนปลอดภัยเรียบร้อย`);
      setShowImportModal(false);
      setImportText('');
      setParsedEmployees([]);
      setImportStatusMessage('');
    } else {
      alert('ขออภัย ฟีเจอร์ bulk นำเข้ายังไม่พร้อมทำงาน ปรึกษาผู้ดูแลระบบ');
    }
  };

  // Export Template Excel-compliant UTF8 CSV containing instruction headers + dummy rows
  const handleExportTemplate = () => {
    const headers = [
      'รหัสพนักงาน (ID)',
      'ชื่อ-นามสกุลอังกฤษ (FullName)',
      'ตำแหน่ง (Position)',
      'ประเภทพนักงาน (daily_worker หรือ staff)',
      'ฐานเงินเดือน (Office Salary)',
      'ค่าจ้างปกติ/วัน (Workshop Rate)',
      'Onsite Rate (บาท/วัน)',
      'Offshore Rate (บาท/วัน)',
      'ค่าขนส่งสวัสดิการ/วัน (Transportation Rate)',
      'ชื่อธนาคารหลัก',
      'เลขที่บัญชี',
      'ยอดหัก กยศ. (Student Loan)',
      'พนักงานควงกะ 12ชม. (yes หรือ no)'
    ];

    const sampleRows = [
      ['EMP101', 'SOMCHAI DEEJA', 'Technician Service Eng', 'daily_worker', '0', '700', '750', '2500', '250', 'Kasikorn Bank', '123-4-56789-0', '0', 'no'],
      ['EMP102', 'SARAWOOT KLAHAN', 'Project Supervisor', 'staff', '28000', '0', '0', '2800', '250', 'Siam Commercial Bank', '987-6-54321-0', '450', 'yes']
    ];

    const csvContent = [
      headers.join(','),
      ...sampleRows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // pre-prepend UTF-8 Byte Order Mark for Thai and formatting support direct in MS Excel!
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'thai_ot_employee_import_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export CURRENT employee register to backup spreadsheet CSV
  const handleExportCurrent = () => {
    const headers = [
      'รหัสพนักงาน (ID)',
      'ชื่อ-นามสกุลอังกฤษ (FullName)',
      'ตำแหน่ง (Position)',
      'ประเภทพนักงาน (daily_worker หรือ staff)',
      'ฐานเงินเดือน (Office Salary)',
      'ค่าจ้างปกติ/วัน (Workshop Rate)',
      'Onsite Rate (บาท/วัน)',
      'Offshore Rate (บาท/วัน)',
      'ค่าขนส่งสวัสดิการ/วัน (Transportation Rate)',
      'ชื่อธนาคารหลัก',
      'เลขที่บัญชี',
      'ยอดหัก กยศ. (Student Loan)',
      'พนักงานควงกะ 12ชม. (yes หรือ no)'
    ];

    const rows = employees.map(emp => [
      emp.id,
      emp.employeeName,
      emp.position || '',
      emp.workScheduleType || 'daily_worker',
      (emp.officeSalary || emp.staffSalary || 0).toString(),
      (emp.workshopRate || 0).toString(),
      (emp.onsiteRate || 0).toString(),
      (emp.offshoreRate || 0).toString(),
      (emp.transportationRate || 0).toString(),
      emp.bankName || '',
      emp.bankAccount || '',
      (emp.studentLoan || 0).toString(),
      emp.isFlatRate ? 'yes' : 'no'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `thai_ot_employees_register_export_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered List
  const filtered = useMemo(() => {
    return employees.filter(emp => {
      const matchSearch = emp.employeeName.toLowerCase().includes(search.toLowerCase()) || 
                          emp.id.toLowerCase().includes(search.toLowerCase()) ||
                          (emp.position && emp.position.toLowerCase().includes(search.toLowerCase()));
      const matchType = filterType === 'all' ? true : emp.workScheduleType === filterType;
      return matchSearch && matchType;
    });
  }, [employees, search, filterType]);

  // Set up Add Form Submit
  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmp.id || !newEmp.employeeName) {
      alert('กรุณากรอกรหัสพนักงานและชื่อพนักงานให้ครบถ้วน');
      return;
    }

    // Check duplicate ID
    if (employees.some(emp => emp.id === newEmp.id)) {
      alert('รหัสพนักงานนี้มีในระบบแล้ว!');
      return;
    }

    const created: Employee = {
      id: newEmp.id,
      employeeName: newEmp.employeeName.toUpperCase(),
      staffSalary: newEmp.staffSalary,
      officeSalary: newEmp.officeSalary,
      workshopRate: newEmp.workshopRate,
      onsiteRate: newEmp.onsiteRate,
      transportationRate: newEmp.transportationRate,
      wfhRate: newEmp.wfhRate,
      offshoreRate: newEmp.offshoreRate,
      position: newEmp.position || 'พนักงาน',
      status: 'active',
      bankName: newEmp.bankName || '',
      bankAccount: newEmp.bankAccount || '',
      studentLoan: Number(newEmp.studentLoan) || 0,
      workScheduleType: (newEmp.workScheduleType as any) || 'daily_worker',
      isFlatRate: newEmp.isFlatRate || false
    };

    onAddEmployee(created);
    setIsAdding(false);
    // Reset
    setNewEmp({
      id: '',
      employeeName: '',
      workScheduleType: 'daily_worker',
      position: 'Daily Worker',
      status: 'active',
      bankName: '',
      bankAccount: '',
      studentLoan: 0,
      isFlatRate: false,
      workshopRate: 0,
      onsiteRate: 0,
      offshoreRate: 0,
      transportationRate: 0
    });
  };

  const handleStartEdit = (emp: Employee) => {
    setEditingEmpId(emp.id);
    setEditForm({ ...emp });
  };

  const handleSaveEdit = (id: string) => {
    onUpdateEmployee(id, editForm);
    setEditingEmpId(null);
  };

  // Theme support styles
  const cardBgClass = isDark ? 'bg-[#141414] border-white/10' : 'bg-white border-slate-205 shadow-xs';
  const textTitleClass = isDark ? 'text-[#D4AF37]' : 'text-amber-700';
  const textMutedClass = isDark ? 'text-gray-400' : 'text-slate-500';
  const textLabelClass = isDark ? 'text-gray-400 font-bold' : 'text-slate-600 font-bold';
  const textGeneralClass = isDark ? 'text-white' : 'text-slate-850';
  const inputBgClass = isDark ? 'bg-[#0D0D0D] border-white/10 text-white focus:border-[#D4AF37]' : 'bg-white border-slate-300 text-slate-800 focus:ring-1 focus:ring-amber-500 focus:border-amber-500';
  const selectBgClass = isDark ? 'bg-[#0D0D0D] border-white/10 text-white' : 'bg-white border-slate-300 text-slate-800';

  // Google Sheet Style Variables
  const tableHeaderStyle = isDark ? 'bg-[#1C1C1C] text-gray-300 border-b-2 border-white/15' : 'bg-[#E8EAED] text-slate-700 font-bold border-b-2 border-slate-300';
  const sheetCellClass = isDark ? 'border-white/5 text-gray-300' : 'border-slate-200 text-slate-800';

  return (
    <div className="space-y-4">
      {/* Controls Header */}
      <div className={`border rounded-xs p-4 ${cardBgClass}`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="search-employee-manager-input"
                type="text"
                placeholder="ค้นพนักงานด้วยชื่อ หรือ ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={`text-xs pl-9 pr-3 py-1.5 rounded-sm w-56 focus:outline-hidden border transition-all ${inputBgClass}`}
              />
            </div>

            <select
              id="employee-type-filter-select"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className={`text-xs rounded-sm px-2.5 py-1.5 border focus:outline-hidden ${selectBgClass}`}
            >
              <option value="all">แสดงทั้งหมดพนักงาน (All Types)</option>
              <option value="daily_worker">กลุ่มพนักงานรายวัน (Daily Workers)</option>
              <option value="staff">กลุ่มพนักงานประจำรายเดือน (Staff)</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              id="export-template-btn"
              type="button"
              onClick={handleExportTemplate}
              className={`px-3 py-1.5 border rounded-sm text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-colors ${
                isDark ? 'border-white/10 hover:bg-white/5 text-gray-300' : 'border-slate-300 hover:bg-slate-100 text-slate-700'
              }`}
              title="ดาวน์โหลดไฟล์ Template Excel (.csv) ไปกรอกข้อมูลเพื่อสำหรับนำมาอัปโหลดล้างการป้อนพิกัดข้อมูลได้ทันที"
            >
              <Download className="w-3.5 h-3.5 text-[#D4AF37]" />
              ดาวน์โหลด Template Excel
            </button>

            <button
              id="export-employees-btn"
              type="button"
              onClick={handleExportCurrent}
              className={`px-3 py-1.5 border rounded-sm text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-colors ${
                isDark ? 'border-white/10 hover:bg-white/5 text-gray-300' : 'border-slate-300 hover:bg-slate-100 text-slate-700'
              }`}
              title="ส่งออกบัญชีรายชื่อพนักงานทั้งหมดปัจจุบันเป็นไฟล์ Excel/CSV สำหรับคัดสำเนารายชื่อได้ตรงกัน"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
              ส่งออกรายชื่อพนักงาน
            </button>

            <button
              id="open-excel-import-btn"
              type="button"
              onClick={() => {
                setShowImportModal(true);
                setImportText('');
                setParsedEmployees([]);
                setImportStatusMessage('');
              }}
              className={`px-3 py-1.5 border rounded-sm text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-colors ${
                isDark ? 'border-emerald-500/25 bg-emerald-950/20 hover:bg-emerald-950/40 text-emerald-300' : 'border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800'
              }`}
              title="นำเข้าอัตราค่าจ้างพนักงานพิกัด หรือข้อมูลธนาคารคราวละจำนวนจำกัด หรือจำนวนร้อยคนพร้อมกันได้โดนตรง"
            >
              <Upload className="w-3.5 h-3.5" />
              นำเข้าจาก Excel / CSV
            </button>

            <button
              id="toggle-add-employee-form"
              onClick={() => setIsAdding(!isAdding)}
              className="px-3.5 py-1.5 bg-[#D4AF37] hover:bg-amber-500 text-black rounded-sm text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
            >
              <UserPlus className="w-4 h-4" />
              {isAdding ? 'ปิดฟอร์มลงทะเบียน' : 'ลงทะเบียนรายคน'}
            </button>
          </div>
        </div>
      </div>

      {/* Register Form */}
      {isAdding && (
        <form onSubmit={handleAddSubmit} className={`border border-amber-500/30 rounded-xs p-5 transition-all animate-fade-in space-y-4 ${cardBgClass}`}>
          <div className={`flex items-center justify-between pb-3 border-b ${isDark ? 'border-white/10' : 'border-slate-150'}`}>
            <h4 className={`text-xs font-bold ${textTitleClass} flex items-center gap-1.5 uppercase tracking-wider`}>
              <UserPlus className="w-4 h-4" />
              ลงทะเบียนข้อมูลพนักงานใหม่
            </h4>
            <button type="button" onClick={() => setIsAdding(false)} className="text-gray-400 hover:text-red-500 cursor-pointer transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <div className="space-y-1">
              <label className={`text-[10px] uppercase tracking-widest block ${textLabelClass}`}>รหัสพนักงาน (ID)*</label>
              <input
                id="add-emp-id"
                type="text"
                placeholder="EMP121"
                required
                value={newEmp.id}
                onChange={(e) => setNewEmp({ ...newEmp, id: e.target.value.toUpperCase() })}
                className={`w-full text-xs rounded-sm p-2 focus:outline-hidden border transition-all font-mono ${inputBgClass}`}
              />
            </div>

            <div className="space-y-1 md:col-span-2">
              <label className={`text-[10px] uppercase tracking-widest block ${textLabelClass}`}>ชื่อ-นามสกุลอังกฤษ (FullName)*</label>
              <input
                id="add-emp-name"
                type="text"
                placeholder="SOMCHAI DEEJA"
                required
                value={newEmp.employeeName}
                onChange={(e) => setNewEmp({ ...newEmp, employeeName: e.target.value })}
                className={`w-full text-xs rounded-sm p-2 focus:outline-hidden border transition-all ${inputBgClass}`}
              />
            </div>

            <div className="space-y-1">
              <label className={`text-[10px] uppercase tracking-widest block ${textLabelClass}`}>ตำแหน่ง (Position)</label>
              <input
                id="add-emp-pos"
                type="text"
                placeholder="Technician"
                value={newEmp.position}
                onChange={(e) => setNewEmp({ ...newEmp, position: e.target.value })}
                className={`w-full text-xs rounded-sm p-2 focus:outline-hidden border transition-all ${inputBgClass}`}
              />
            </div>

            <div className="space-y-1">
              <label className={`text-[10px] uppercase tracking-widest block ${textLabelClass}`}>ประเภทค่าจ้าง</label>
              <select
                id="add-emp-schedule-type"
                value={newEmp.workScheduleType}
                onChange={(e) => setNewEmp({ 
                  ...newEmp, 
                  workScheduleType: e.target.value as any,
                  position: e.target.value === 'daily_worker' ? 'Daily Worker' : 'Technician'
                })}
                className={`w-full text-xs rounded-sm p-2 focus:outline-hidden border ${selectBgClass}`}
              >
                <option value="daily_worker">รายวัน (Daily)</option>
                <option value="staff">รายเดือน (Monthly Staff)</option>
              </select>
            </div>

            <div className="space-y-1 flex flex-col justify-center">
              <label className={`text-[10px] block ${textLabelClass}`}>เกณฑ์การคำนวณ</label>
              <label className={`flex items-center gap-1.5 text-xs mt-1.5 cursor-pointer ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>
                <input
                  id="add-emp-flatrate-checkbox-default"
                  type="checkbox"
                  checked={newEmp.isFlatRate || false}
                  onChange={(e) => setNewEmp({ ...newEmp, isFlatRate: e.target.checked })}
                  className="w-3.5 h-3.5 text-amber-500 rounded-sm focus:ring-0 cursor-pointer"
                />
                <span className="text-[10.5px]">เป็นพนักงาน Flat Rate 12 ชม.</span>
              </label>
            </div>
          </div>

          <div className={`grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-3 pt-3 border-t ${isDark ? 'border-white/10' : 'border-slate-150'}`}>
            <div className="space-y-1">
              <label className={`text-[10px] uppercase tracking-widest block ${textLabelClass}`}>ฐานเงินเดือนหลัก (Staff/Office)</label>
              <input
                id="add-emp-salary"
                type="number"
                placeholder="0"
                value={newEmp.officeSalary || ''}
                onChange={(e) => setNewEmp({ ...newEmp, officeSalary: parseFloat(e.target.value) || 0 })}
                className={`w-full text-xs rounded-sm p-2 focus:outline-hidden border transition-all ${inputBgClass}`}
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-widest font-bold text-sky-500 block">Workshop Rate (บาท/วัน)</label>
              <input
                id="add-emp-workshop-rate"
                type="number"
                placeholder="700"
                value={newEmp.workshopRate || ''}
                onChange={(e) => setNewEmp({ ...newEmp, workshopRate: parseFloat(e.target.value) || 0 })}
                className={`w-full text-xs rounded-sm p-2 focus:outline-hidden border transition-all ${inputBgClass}`}
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-widest font-bold text-purple-500 block">Onsite Rate (บาท/วัน)</label>
              <input
                id="add-emp-onsite-rate"
                type="number"
                placeholder="750"
                value={newEmp.onsiteRate || ''}
                onChange={(e) => setNewEmp({ ...newEmp, onsiteRate: parseFloat(e.target.value) || 0 })}
                className={`w-full text-xs rounded-sm p-2 focus:outline-hidden border transition-all ${inputBgClass}`}
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-widest font-bold text-amber-500 block">Offshore Rate (บาท/วัน)</label>
              <input
                id="add-emp-offshore-rate"
                type="number"
                placeholder="2500"
                value={newEmp.offshoreRate || ''}
                onChange={(e) => setNewEmp({ ...newEmp, offshoreRate: parseFloat(e.target.value) || 0 })}
                className={`w-full text-xs rounded-sm p-2 focus:outline-hidden border transition-all ${inputBgClass}`}
              />
            </div>

            <div className="space-y-1">
              <label className={`text-[10px] uppercase tracking-widest block ${textLabelClass}`}>ค่ารถส่วนตัว (บาท/วัน)</label>
              <input
                id="add-emp-transport-rate"
                type="number"
                placeholder="250"
                value={newEmp.transportationRate || ''}
                onChange={(e) => setNewEmp({ ...newEmp, transportationRate: parseFloat(e.target.value) || 0 })}
                className={`w-full text-xs rounded-sm p-2 focus:outline-hidden border transition-all ${inputBgClass}`}
              />
            </div>

            <div className="space-y-1">
              <label className={`text-[10px] uppercase tracking-widest block ${textLabelClass}`}>ชื่อธนาคารหลัก</label>
              <input
                id="add-emp-bank-name"
                type="text"
                placeholder="ธนาคารกสิกรไทย"
                value={newEmp.bankName}
                onChange={(e) => setNewEmp({ ...newEmp, bankName: e.target.value })}
                className={`w-full text-xs rounded-sm p-2 focus:outline-hidden border transition-all ${inputBgClass}`}
              />
            </div>

            <div className="space-y-1">
              <label className={`text-[10px] uppercase tracking-widest block ${textLabelClass}`}>เลขที่บัญชี</label>
              <input
                id="add-emp-bank-acc"
                type="text"
                placeholder="xxx-xxx-xxxx"
                value={newEmp.bankAccount}
                onChange={(e) => setNewEmp({ ...newEmp, bankAccount: e.target.value })}
                className={`w-full text-xs rounded-sm p-2 focus:outline-hidden border transition-all ${inputBgClass}`}
              />
            </div>
          </div>

          <div className={`flex justify-end gap-2 pt-3 border-t ${isDark ? 'border-white/10' : 'border-slate-150'}`}>
            <button
              id="cancel-add-emp"
              type="button"
              onClick={() => setIsAdding(false)}
              className={`px-4 py-1.5 border rounded-sm text-xs font-semibold cursor-pointer transition-colors ${
                isDark ? 'border-white/15 text-gray-300 hover:bg-white/5 bg-transparent' : 'border-slate-300 text-slate-700 hover:bg-slate-100 bg-white'
              }`}
            >
              ยกเลิก
            </button>
            <button
              id="submit-add-emp"
              type="submit"
              className="px-5 py-1.5 bg-[#D4AF37] hover:bg-amber-500 text-black rounded-sm text-xs font-bold uppercase tracking-wider cursor-pointer shadow-xs"
            >
              ยืนยันเพิ่มพนักงานใหม่
            </button>
          </div>
        </form>
      )}

      {/* Directory Grid View */}
      <div className={`border rounded-xs overflow-hidden ${cardBgClass}`}>
        <div className={`p-4 border-b flex items-center justify-between ${isDark ? 'border-white/10 bg-[#141414]' : 'border-slate-100 bg-[#FAFAFA]'}`}>
          <div>
            <h3 className={`text-xs font-bold uppercase tracking-widest ${textTitleClass}`}>
              ข้อมูลพิกัดสวัสดิการและอัตราค่าจ้างพนักงาน ({filtered.length} จาก {employees.length} คน)
            </h3>
            <p className={`text-[10px] ${textMutedClass} mt-0.5 font-medium`}>
              ควบคุมข้อมูลพิกัด Workshop / Onsite เกณฑ์ควบคุมรายบุคคล และสมุดธนาคารผู้รับสำหรับรายงานรอบบัญชี
            </p>
          </div>
        </div>

        <div className="overflow-x-auto max-h-[480px]">
          {/* Google Sheet Grid Style */}
          <table className="w-full text-left text-xs border-collapse">
            <thead className={`${tableHeaderStyle} uppercase text-[9px] tracking-widest sticky top-0 z-10`}>
              <tr>
                <th className="py-2 px-2.5 border-r border-slate-300 dark:border-white/10">รหัส</th>
                <th className="py-2 px-2.5 border-r border-slate-300 dark:border-white/10">ชื่อ-นามสกุลอังกฤษ</th>
                <th className="py-2 px-2.5 border-r border-slate-300 dark:border-white/10">ตำแหน่ง</th>
                <th className="py-2 px-2.5 border-r border-slate-300 dark:border-white/10 text-center">ประเภทกฎหมาย</th>
                <th className="py-2 px-2.5 border-r border-slate-300 dark:border-white/10 text-right">เงินเดือนปจพ.</th>
                <th className="py-2 px-2.5 border-r border-slate-300 dark:border-white/10 text-right text-sky-650 dark:text-sky-400">Workshop Rate</th>
                <th className="py-2 px-2.5 border-r border-slate-300 dark:border-white/10 text-right text-purple-650 dark:text-purple-450">Onsite Rate</th>
                <th className="py-2 px-2.5 border-r border-slate-300 dark:border-white/10 text-right text-amber-653 dark:text-amber-400">Offshore Rate</th>
                <th className="py-2 px-2.5 border-r border-slate-300 dark:border-white/10 text-right">ค่ารถ / วัน</th>
                <th className="py-2 px-2.5 border-r border-slate-300 dark:border-white/10 text-center">กฎโอที 12ชม.</th>
                <th className="py-2 px-2.5 border-r border-slate-300 dark:border-white/10">บัญชีธนาคารผู้รับ</th>
                <th className="py-2 px-2 text-center">สิทธิ์จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dotted font-medium">
              {filtered.map(emp => {
                const isEditing = editingEmpId === emp.id;

                return (
                  <tr 
                    key={emp.id} 
                    className={`transition-colors text-[11px] ${
                      isDark 
                        ? 'hover:bg-white/[0.02] even:bg-[#1a1a1a]/40 bg-[#141414]' 
                        : 'hover:bg-amber-50/45 even:bg-[#F8F9FA] bg-white'
                    }`}
                  >
                    {/* Column 1: ID */}
                    <td className={`py-2 px-2.5 font-mono font-bold text-gray-500 text-[10px] border-r ${sheetCellClass}`}>
                      {emp.id}
                    </td>
                    
                    {/* Column 2: Name */}
                    <td className={`py-2 px-2.5 font-bold border-r ${sheetCellClass}`}>
                      {isEditing ? (
                        <input
                          id={`edit-empname-input-${emp.id}`}
                          type="text"
                          value={editForm.employeeName}
                          onChange={(e) => setEditForm({ ...editForm, employeeName: e.target.value.toUpperCase() })}
                          className={`border rounded px-1.5 py-0.5 text-xs font-bold w-full focus:outline-hidden ${inputBgClass}`}
                        />
                      ) : (
                        <span className={isDark ? 'text-white' : 'text-slate-900'}>{emp.employeeName}</span>
                      )}
                    </td>

                    {/* Column 3: Position */}
                    <td className={`py-2 px-2.5 border-r ${sheetCellClass}`}>
                      {isEditing ? (
                        <input
                          id={`edit-emppos-input-${emp.id}`}
                          type="text"
                          value={editForm.position}
                          onChange={(e) => setEditForm({ ...editForm, position: e.target.value })}
                          className={`border rounded px-1.5 py-0.5 text-xs w-full focus:outline-hidden ${inputBgClass}`}
                        />
                      ) : (
                        emp.position || '-'
                      )}
                    </td>

                    {/* Column 4: Schedule Type */}
                    <td className={`py-2 px-2.5 text-center border-r ${sheetCellClass}`}>
                      {isEditing ? (
                        <select
                          id={`edit-empschedule-select-${emp.id}`}
                          value={editForm.workScheduleType}
                          onChange={(e) => setEditForm({ ...editForm, workScheduleType: e.target.value as any })}
                          className={`border rounded px-1 py-0.5 text-xs w-full ${selectBgClass}`}
                        >
                          <option value="daily_worker">รายวัน (Daily)</option>
                          <option value="staff">รายเดือน (Staff)</option>
                        </select>
                      ) : (
                        <span className={`px-2 py-0.5 rounded-xs text-[9px] font-bold border inline-block ${
                          emp.workScheduleType === 'staff' 
                            ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/30' 
                            : 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-305 dark:border-indigo-900/30'
                        }`}>
                          {emp.workScheduleType === 'staff' ? 'รายเดือน' : 'รายวัน'}
                        </span>
                      )}
                    </td>

                    {/* Column 5: Staff Salary */}
                    <td className={`py-2 px-2.5 text-right font-mono font-bold border-r ${sheetCellClass}`}>
                      {isEditing ? (
                        <input
                          id={`edit-empsalary-input-${emp.id}`}
                          type="number"
                          value={editForm.officeSalary ?? editForm.staffSalary ?? 0}
                          onChange={(e) => setEditForm({ ...editForm, officeSalary: parseFloat(e.target.value) || 0 })}
                          className={`border rounded px-1 py-0.5 text-xs text-right w-16 focus:outline-hidden ${inputBgClass}`}
                        />
                      ) : (
                        (emp.officeSalary || emp.staffSalary) ? (
                          (emp.officeSalary || emp.staffSalary)?.toLocaleString() + ' ฿'
                        ) : '—'
                      )}
                    </td>

                    {/* Column 6: Workshop Rate */}
                    <td className={`py-2 px-2.5 text-right font-mono font-bold border-r text-sky-650 dark:text-sky-400 ${sheetCellClass}`}>
                      {isEditing ? (
                        <input
                          id={`edit-empwork-input-${emp.id}`}
                          type="number"
                          value={editForm.workshopRate ?? 0}
                          onChange={(e) => setEditForm({ ...editForm, workshopRate: parseFloat(e.target.value) || 0 })}
                          className={`border rounded px-1 py-0.5 text-xs text-right w-16 focus:outline-hidden ${inputBgClass}`}
                        />
                      ) : (
                        emp.workshopRate ? `${emp.workshopRate.toLocaleString()} ฿` : '—'
                      )}
                    </td>

                    {/* Column 7: Onsite Rate */}
                    <td className={`py-2 px-2.5 text-right font-mono font-bold border-r text-purple-650 dark:text-purple-450 ${sheetCellClass}`}>
                      {isEditing ? (
                        <input
                          id={`edit-emponsite-input-${emp.id}`}
                          type="number"
                          value={editForm.onsiteRate ?? 0}
                          onChange={(e) => setEditForm({ ...editForm, onsiteRate: parseFloat(e.target.value) || 0 })}
                          className={`border rounded px-1 py-0.5 text-xs text-right w-16 focus:outline-hidden ${inputBgClass}`}
                        />
                      ) : (
                        emp.onsiteRate ? `${emp.onsiteRate.toLocaleString()} ฿` : '—'
                      )}
                    </td>

                    {/* Column 8: Offshore Rate */}
                    <td className={`py-2 px-2.5 text-right font-mono font-bold border-r text-amber-653 dark:text-amber-400 ${sheetCellClass}`}>
                      {isEditing ? (
                        <input
                          id={`edit-empoffshore-input-${emp.id}`}
                          type="number"
                          value={editForm.offshoreRate ?? 0}
                          onChange={(e) => setEditForm({ ...editForm, offshoreRate: parseFloat(e.target.value) || 0 })}
                          className={`border rounded px-1 py-0.5 text-xs text-right w-16 focus:outline-hidden ${inputBgClass}`}
                        />
                      ) : (
                        emp.offshoreRate ? `${emp.offshoreRate.toLocaleString()} ฿` : '—'
                      )}
                    </td>

                    {/* Column 9: Transportation Rate */}
                    <td className={`py-2 px-2.5 text-right font-mono font-semibold border-r ${sheetCellClass}`}>
                      {isEditing ? (
                        <input
                          id={`edit-emptrans-input-${emp.id}`}
                          type="number"
                          value={editForm.transportationRate ?? 0}
                          onChange={(e) => setEditForm({ ...editForm, transportationRate: parseFloat(e.target.value) || 0 })}
                          className={`border rounded px-1 py-0.5 text-xs text-right w-16 focus:outline-hidden ${inputBgClass}`}
                        />
                      ) : (
                        emp.transportationRate ? `${emp.transportationRate.toLocaleString()} ฿` : '—'
                      )}
                    </td>

                    {/* Column 10: FlatRate Constraint */}
                    <td className={`py-2 px-2.5 text-center border-r ${sheetCellClass}`}>
                      {isEditing ? (
                        <label className="flex items-center justify-center gap-1 cursor-pointer">
                          <input
                            id={`edit-empflat-checkbox-${emp.id}`}
                            type="checkbox"
                            checked={editForm.isFlatRate || false}
                            onChange={(e) => setEditForm({ ...editForm, isFlatRate: e.target.checked })}
                            className="w-3.5 h-3.5 text-amber-500 rounded focus:ring-0 cursor-pointer"
                          />
                          <span className="text-[9px] text-gray-400">Flat</span>
                        </label>
                      ) : (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-xs font-bold border inline-block ${
                          emp.isFlatRate 
                            ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-305 dark:border-amber-900/30' 
                            : 'bg-transparent text-gray-400 dark:text-gray-600 border-transparent'
                        }`}>
                          {emp.isFlatRate ? 'Flat (12ชม.)' : 'Normal'}
                        </span>
                      )}
                    </td>

                    {/* Column 11: Bank Details */}
                    <td className={`py-2 px-2.5 border-r ${sheetCellClass}`}>
                      {isEditing ? (
                        <div className="space-y-1">
                          <input
                            id={`edit-empbank-input-${emp.id}`}
                            type="text"
                            placeholder="ธนาคาร"
                            value={editForm.bankName}
                            onChange={(e) => setEditForm({ ...editForm, bankName: e.target.value })}
                            className={`border rounded px-1.5 py-0.5 text-[10px] w-full focus:outline-hidden ${inputBgClass}`}
                          />
                          <input
                            id={`edit-empbankacc-input-${emp.id}`}
                            type="text"
                            placeholder="เลขบัญชี"
                            value={editForm.bankAccount}
                            onChange={(e) => setEditForm({ ...editForm, bankAccount: e.target.value })}
                            className={`border rounded px-1.5 py-0.5 text-[10px] w-full focus:outline-hidden ${inputBgClass}`}
                          />
                        </div>
                      ) : (
                        emp.bankName ? (
                          <span className="inline-flex items-center gap-1 text-[10.5px]">
                            <CreditCard className="w-3 h-3 text-slate-400 dark:text-gray-500" />
                            <strong>{emp.bankName}</strong> / <span className="underline font-mono text-gray-500 dark:text-gray-400">{emp.bankAccount || 'N/A'}</span>
                          </span>
                        ) : '—'
                      )}
                    </td>

                    {/* Column 12: Actions */}
                    <td className="py-2 px-2 text-center">
                      {isEditing ? (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            id={`save-emp-btn-${emp.id}`}
                            onClick={() => handleSaveEdit(emp.id)}
                            className="p-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xs cursor-pointer shadow-xs"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            id={`cancel-emp-btn-${emp.id}`}
                            onClick={() => setEditingEmpId(null)}
                            className={`p-1 border rounded-xs cursor-pointer ${
                              isDark ? 'border-white/10 hover:bg-white/5 text-gray-400' : 'border-slate-300 hover:bg-slate-100 text-slate-700'
                            }`}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            id={`edit-emp-btn-${emp.id}`}
                            onClick={() => handleStartEdit(emp)}
                            className={`p-1.5 rounded-sm transition-colors cursor-pointer ${
                              isDark ? 'text-gray-400 hover:text-[#D4AF37] hover:bg-white/5' : 'text-slate-500 hover:text-amber-700 hover:bg-slate-100'
                            }`}
                            title="แก้ไขอัตราจ้างพนักงาน"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            id={`delete-emp-btn-${emp.id}`}
                            onClick={() => {
                              if (window.confirm(`คุณแน่ใจว่าต้องการลบ ${emp.employeeName} ออกจากฐานข้อมูลพนักงานจริงหรือไม่?`)) {
                                onDeleteEmployee(emp.id);
                              }
                            }}
                            className={`p-1.5 rounded-sm transition-colors cursor-pointer ${
                              isDark ? 'text-red-400 hover:text-red-300 hover:bg-white/5' : 'text-slate-500 hover:text-red-600 hover:bg-red-50'
                            }`}
                            title="ลบพนักงาน"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Excel/CSV Import Modal popup */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className={`w-full max-w-4xl border rounded-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-fade-in ${
            isDark ? 'bg-[#141414] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'
          }`}>
            {/* Modal Header */}
            <div className={`px-5 py-4 border-b flex items-center justify-between ${
              isDark ? 'border-white/10 bg-[#1C1C1C]' : 'border-slate-100 bg-[#FAFAFA]'
            }`}>
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-[#D4AF37]" />
                <div>
                  <h3 className={`text-sm font-bold uppercase tracking-wider ${textTitleClass}`}>
                    นำเข้าข้อมูลพนักงานจาก Excel / Spreadsheet
                  </h3>
                  <p className="text-[10px] text-gray-500 font-medium">
                    คัดลอกทั้งแถวจาก Excel แล้ววางที่ช่องด้านล่าง หรืออัปโหลดไฟล์ CSV เพื่อเพิ่มข้อมูลระดับความแม่นยำสูงพร้อมกัน
                  </p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setShowImportModal(false)}
                className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded-sm cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <span className={`text-[11px] font-bold block ${textLabelClass}`}>
                    ขั้นตอนที่ 1: วางข้อมูล (Clipboard) หรือเลือกไฟล์ (.csv, .tsv, .txt)
                  </span>
                  
                  {/* File Upload Box */}
                  <div className={`border-2 border-dashed rounded-md p-3 text-center transition-all ${
                    isDark ? 'border-white/10 hover:border-[#D4AF37]/45 bg-[#0D0D0D]' : 'border-slate-300 hover:border-amber-500 bg-slate-50'
                  }`}>
                    <label className="cursor-pointer block space-y-1">
                      <Upload className="w-6 h-6 mx-auto text-[#D4AF37]/75" />
                      <span className="text-xs font-semibold block">คลิกที่นี่เพื่ออัปโหลดไฟล์ Excel / CSV</span>
                      <span className="text-[10px] text-gray-500 block">รองรับไฟล์ชนิด UTF-8 Comma-separated เท่านั้น</span>
                      <input 
                        type="file" 
                        accept=".csv,.txt,.tsv" 
                        onChange={handleFileSelect} 
                        className="hidden" 
                      />
                    </label>
                  </div>

                  {/* Clipboard Text Area */}
                  <div className="space-y-1">
                    <label className={`text-[10px] font-bold block ${textLabelClass}`}>หรือ คัดลอกข้อมูลพนักงานจากโปรแกรม Excel แล้วกดยิงวาง (Ctrl+V) ด้านล่าง:</label>
                    <textarea
                      id="excel-import-textarea"
                      placeholder="เช่น:&#10;EMP101&#9;SOMCHAI DEEJA&#9;Technician&#9;daily_worker&#9;0&#9;700&#9;750&#9;2500&#9;250&#9;Kasikorn&#9;123-4-56789-0&#9;0&#9;no"
                      value={importText}
                      onChange={(e) => handlePasteChange(e.target.value)}
                      className={`w-full h-44 text-xs font-mono p-3 rounded-md border focus:outline-hidden transition-all ${inputBgClass}`}
                    />
                  </div>
                </div>

                {/* System Specs instructions */}
                <div className={`p-4 rounded-md border ${
                  isDark ? 'bg-[#0D0D0D] border-white/5' : 'bg-slate-50 border-slate-200'
                } space-y-3`}>
                  <h4 className="text-xs font-bold text-[#D4AF37] uppercase tracking-wider flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4" />
                    ลำดับคอลัมน์มาตรฐานสำหรับนำเข้า
                  </h4>
                  <p className="text-[10px] leading-relaxed text-gray-400">
                    ในการนำเข้าข้อมูลที่สมบูรณ์ กรุณาจัดแถวคอลัมน์ใน Excel ให้ตรงตามลำดับดังต่อไปนี้ (จากซ้ายไปขวา):
                  </p>
                  
                  <ol className="text-[10.5px] list-decimal list-inside space-y-1 text-gray-500 font-medium">
                    <li><strong className={isDark ? "text-gray-300" : "text-slate-800"}>รหัสพนักงาน (ID)</strong> *จำเป็น (เช่น EMP101)</li>
                    <li><strong className={isDark ? "text-gray-300" : "text-slate-800"}>ชื่อ-สกุลอังกฤษ (FullName)</strong> *จำเป็น</li>
                    <li><strong>ตำแหน่ง (Position)</strong> (เช่น Daily Worker, Admin)</li>
                    <li><strong>ประเภทกฎหมาย (WorkScheduleType)</strong> (ระบุ: <code className="font-mono bg-white/5 px-1 rounded text-amber-500">daily_worker</code> หรือ <code className="font-mono bg-white/5 px-1 rounded text-amber-500">staff</code>)</li>
                    <li><strong>ฐานเงินเดือน (OfficeSalary)</strong> (ใส่ค่าเฉพาะรายเดือน)</li>
                    <li><strong>Workshop Rate</strong> (บาท/วัน)</li>
                    <li><strong>Onsite Rate</strong> (บาท/วัน)</li>
                    <li><strong>Offshore Rate</strong> (บาท/วัน)</li>
                    <li><strong>ค่ารถพิกัดสวัสดิการ</strong> (บาท/วัน)</li>
                    <li><strong>ชื่อธนาคาร</strong> (เช่น Kasikorn Bank)</li>
                    <li><strong>เลขบัญชีธนาคาร</strong> (เช่น 123-xxx-xxxx)</li>
                    <li><strong>ยอดหักเงินกู้ กยศ.</strong> (ถ้ามีเช่น 500)</li>
                    <li><strong>สิทธิ์ OT 12 ชม. (isFlatRate)</strong> (ระบุ: <code className="font-mono bg-white/5 px-1 rounded text-sky-400">yes</code> หรือ <code className="font-mono bg-white/5 px-1 rounded text-sky-400 font-bold">no</code>)</li>
                  </ol>
                  
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleExportTemplate}
                      className="text-[10px] font-bold text-sky-500 hover:underline flex items-center gap-1"
                    >
                      <Download className="w-3 h-3" /> ดาวน์โหลดข้อมูลตัวอย่าง Template เปล่าเพื่อดูรูปแบบโครงสร้าง
                    </button>
                  </div>
                </div>
              </div>

              {/* Status Message */}
              {importStatusMessage && (
                <div className={`p-3 rounded-md border text-xs flex items-center gap-2 ${
                  parsedEmployees.length > 0 
                  ? 'bg-emerald-950/20 border-emerald-500/20 text-emerald-400'
                  : 'bg-red-950/20 border-red-500/20 text-red-400'
                }`}>
                  {parsedEmployees.length > 0 ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                  )}
                  <span>{importStatusMessage}</span>
                </div>
              )}

              {/* Mapping Preview */}
              {parsedEmployees.length > 0 && (
                <div className="space-y-1.5">
                  <span className={`text-[11px] font-bold block ${textLabelClass}`}>
                    ขั้นตอนที่ 2: ตารางวิเคราะห์แสดงรายการพนักงานที่ตรวจพบ ({parsedEmployees.length} คน)
                  </span>
                  
                  <div className="border rounded-md overflow-hidden max-h-56 overflow-y-auto">
                    <table className="w-full text-left text-[10px] border-collapse font-medium">
                      <thead className={`${tableHeaderStyle} sticky top-0`}>
                        <tr>
                          <th className="py-1.5 px-2">รหัส</th>
                          <th className="py-1.5 px-2">ชื่ออังกฤษ</th>
                          <th className="py-1.5 px-2">ตำแหน่ง</th>
                          <th className="py-1.5 px-2">ประเภท</th>
                          <th className="py-1.5 px-2 text-right">เงินเดือน</th>
                          <th className="py-1.5 px-2 text-right">Workshop</th>
                          <th className="py-1.5 px-2 text-right">Onsite</th>
                          <th className="py-1.5 px-2 text-right">Offshore</th>
                          <th className="py-1.5 px-2 text-right">ค่ารถ</th>
                          <th className="py-1.5 px-2 text-center">สิทธิ์ 12ชม.</th>
                          <th className="py-1.5 px-2">ธนาคารหลัก / บัญชี</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-dotted">
                        {parsedEmployees.map((emp, i) => (
                          <tr key={i} className={isDark ? 'bg-white/[0.01]' : 'bg-slate-50'}>
                            <td className="py-1.5 px-2 font-mono font-bold text-amber-500">{emp.id}</td>
                            <td className="py-1.5 px-2 font-bold text-slate-800 dark:text-gray-300">{emp.employeeName}</td>
                            <td className="py-1.5 px-2 text-gray-400">{emp.position}</td>
                            <td className="py-1.5 px-2">
                              <span className={`px-1 py-0.5 rounded text-[8.5px] font-bold text-white border ${
                                emp.workScheduleType === 'staff' ? 'bg-blue-600/80' : 'bg-indigo-600/80'
                              }`}>
                                {emp.workScheduleType === 'staff' ? 'รายเดือน' : 'รายวัน'}
                              </span>
                            </td>
                            <td className="py-1.5 px-2 text-right font-mono text-gray-300">
                              {emp.officeSalary ? emp.officeSalary.toLocaleString() + ' ฿' : '-'}
                            </td>
                            <td className="py-1.5 px-2 text-right font-mono text-sky-400">
                              {emp.workshopRate ? emp.workshopRate.toLocaleString() : '-'}
                            </td>
                            <td className="py-1.5 px-2 text-right font-mono text-purple-400">
                              {emp.onsiteRate ? emp.onsiteRate.toLocaleString() : '-'}
                            </td>
                            <td className="py-1.5 px-2 text-right font-mono text-amber-500">
                              {emp.offshoreRate ? emp.offshoreRate.toLocaleString() : '-'}
                            </td>
                            <td className="py-1.5 px-2 text-right font-mono text-gray-400">
                              {emp.transportationRate ? emp.transportationRate.toLocaleString() : '-'}
                            </td>
                            <td className="py-1.5 px-2 text-center">
                              {emp.isFlatRate ? (
                                <span className="text-emerald-500 text-[10px] font-bold font-mono">Yes</span>
                              ) : (
                                <span className="text-gray-600 dark:text-gray-400 text-[9px]">Normal</span>
                              )}
                            </td>
                            <td className="py-1.5 px-2 text-gray-400 max-w-xs truncate">
                              {emp.bankName ? `${emp.bankName} (${emp.bankAccount})` : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className={`px-5 py-4 border-t flex justify-end gap-2 ${
              isDark ? 'border-white/10 bg-[#1C1C1C]' : 'border-slate-100 bg-[#FAFAFA]'
            }`}>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className={`px-4 py-1.5 border rounded-sm text-xs font-semibold cursor-pointer transition-colors ${
                  isDark ? 'border-white/10 text-gray-300 hover:bg-white/5 bg-transparent' : 'border-slate-300 text-slate-700 hover:bg-slate-100 bg-white'
                }`}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={parsedEmployees.length === 0}
                onClick={handleConfirmBatchImport}
                className="px-5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-sm text-xs font-bold uppercase tracking-wider cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
              >
                ยืนยันนำเข้าข้อมูลพนักงานทั้งหมดเข้าระบบ ({parsedEmployees.length} คน)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
