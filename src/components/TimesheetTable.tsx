import React, { useState, useMemo } from 'react';
import { TimesheetEntry, Employee, Holiday } from '../types';
import { calculateEntryOT, getDayOfWeek, isHoliday, formatThaiDate, findEmployeeMatch } from '../utils/calculator';
import { 
  FileSpreadsheet, Plus, Trash2, Edit2, Check, X, FileUp, 
  Download, Filter, Search, Eye, AlertCircle, RefreshCw, BookmarkCheck
} from 'lucide-react';

interface TimesheetTableProps {
  entries: TimesheetEntry[];
  employees: Employee[];
  holidays: Holiday[];
  onAddEntry: (entry: TimesheetEntry) => void;
  onUpdateEntry: (id: string, updated: Partial<TimesheetEntry>) => void;
  onDeleteEntry: (id: string) => void;
  onBulkDeleteEntries?: (ids: string[]) => void;
  onBulkAddEntries: (entries: TimesheetEntry[]) => void;
  onClearAllEntries: () => void;
  onSyncFromDatabase?: () => void;
  isDark?: boolean;
}

function generateKeyUUID() {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
    try {
      return window.crypto.randomUUID();
    } catch {
      // fallback
    }
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export default function TimesheetTable({
  entries,
  employees,
  holidays,
  onAddEntry,
  onUpdateEntry,
  onDeleteEntry,
  onBulkDeleteEntries,
  onBulkAddEntries,
  onClearAllEntries,
  onSyncFromDatabase,
  isDark = false
}: TimesheetTableProps) {
  // Action confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    actionType: 'delete_row' | 'clear_all';
    targetId?: string;
  }>({
    isOpen: false,
    title: '',
    message: '',
    actionType: 'clear_all'
  });

  // Filters
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [startTimeFilter, setStartTimeFilter] = useState('');
  const [endTimeFilter, setEndTimeFilter] = useState('');

  // Google Sheets Style configurations for both Light / Dark theme toggles
  const sheetStyles = useMemo(() => {
    if (isDark) {
      return {
        gridContainer: 'bg-[#121212] border border-[#2d2f34] shadow-lg rounded-sm overflow-hidden text-gray-200 select-text',
        thRow: 'bg-[#1c1c1e] text-gray-300 font-bold text-[10.5px] uppercase tracking-wide border-b-2 border-[#2d2f34]',
        thCell: 'py-2 px-2.5 border-r border-[#2d2f34] text-center font-bold text-gray-400 select-none font-sans',
        thYellowCell: 'py-2 px-2.5 border-r border-[#2d2f34] text-center font-bold text-[#D4AF37] select-none font-sans',
        indexCell: 'bg-[#1c1c1e] text-gray-500 text-center font-mono text-[10.5px] border-r border-b border-[#2d2f34] p-2 select-none font-bold',
        trNormal: 'border-b border-[#2d2f34] bg-[#141416] hover:bg-[#1f1f23] transition-colors',
        trSelected: 'border-b border-[#D4AF37]/50 bg-[#222326]',
        tdCell: 'py-1.5 px-2.5 border-r border-b border-[#2d2f34] text-gray-200 font-sans truncate',
        tdMono: 'py-1.5 px-2.5 border-r border-b border-[#2d2f34] text-gray-300 font-mono text-center truncate',
        normalHours: 'py-1.5 px-1.5 text-right font-mono border-r border-b border-[#2d2f34] bg-emerald-950/40 text-emerald-400 font-bold',
        ot15: 'py-1.5 px-1.5 text-right font-mono border-r border-b border-[#2d2f34] bg-amber-950/45 text-[#D4AF37] font-bold',
        ot20: 'py-1.5 px-1.5 text-right font-mono border-r border-b border-[#2d2f34] bg-rose-955/40 text-rose-400 font-bold',
        ot30: 'py-1.5 px-1.5 text-right font-mono border-r border-b border-[#2d2f34] bg-purple-955/45 text-purple-400 font-bold'
      };
    } else {
      return {
        gridContainer: 'bg-white border border-[#bdc1c6] shadow-xs rounded-sm overflow-hidden text-slate-800 select-text',
        thRow: 'bg-[#f8f9fa] text-slate-700 font-bold text-[10.5px] uppercase tracking-wide border-b-2 border-[#bdc1c6]',
        thCell: 'py-2 px-2.5 border-r border-[#bdc1c6] text-center font-bold text-slate-600 select-none font-sans',
        thYellowCell: 'py-2 px-2.5 border-r border-[#bdc1c6] text-center font-bold text-amber-750 select-none font-sans',
        indexCell: 'bg-[#f8f9fa] text-slate-500 text-center font-mono text-[10.5px] border-r border-b border-[#bdc1c6] p-2 select-none font-bold',
        trNormal: 'border-b border-[#e0e0e0] bg-white hover:bg-slate-50 transition-colors',
        trSelected: 'border-b border-indigo-200 bg-indigo-50/40',
        tdCell: 'py-1.5 px-2.5 border-r border-b border-[#e0e0e0] text-slate-700 font-sans truncate',
        tdMono: 'py-1.5 px-2.5 border-r border-b border-[#e0e0e0] text-slate-800 font-mono text-center truncate',
        normalHours: 'py-1.5 px-1.5 text-right font-mono border-r border-b border-[#e0e0e0] bg-[#e6f4ea] text-[#137333] font-bold',
        ot15: 'py-1.5 px-1.5 text-right font-mono border-r border-b border-[#e0e0e0] bg-[#fef7e0] text-[#b06000] font-bold',
        ot20: 'py-1.5 px-1.5 text-right font-mono border-r border-b border-[#e0e0e0] bg-[#fce8e6] text-[#c5221f] font-bold',
        ot30: 'py-1.5 px-1.5 text-right font-mono border-r border-b border-[#e0e0e0] bg-[#f3e8fd] text-[#8430ce] font-bold'
      };
    }
  }, [isDark]);
  
  // Custom single entry form active row state
  const [isAdding, setIsAdding] = useState(false);
  const [newEntry, setNewEntry] = useState<Partial<TimesheetEntry>>({
    employeeName: employees[0]?.employeeName || '',
    date: '2026-03-23',
    project: '',
    timeIn: '08:00',
    timeOut: '17:00',
    lunchDeduct: 1,
    lunchOT: 0,
    customerHolidayFlag: 0,
    flatRate: false,
    remark: ''
  });

  // Bulk Import Clipboard Area State
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState('');
  const [importStatusMessage, setImportStatusMessage] = useState('');

  // Row currently being edited
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<Partial<TimesheetEntry>>({});

  // Detect duplicate entries
  const duplicateGroups = useMemo(() => {
    const map = new Map<string, TimesheetEntry[]>();
    entries.forEach(e => {
      if (!e || !e.employeeName || !e.date) return;
      // Key of exact duplicates: same employee, date, timeIn, timeOut, project, lunchOT
      const key = `${e.employeeName.trim().toUpperCase()}_${e.date}_${e.timeIn || ''}_${e.timeOut || ''}_${(e.project || '').trim().toUpperCase()}_${e.lunchOT || 0}`;
      const list = map.get(key) || [];
      list.push(e);
      map.set(key, list);
    });

    const dupes: TimesheetEntry[][] = [];
    map.forEach(list => {
      if (list.length > 1) {
        dupes.push(list);
      }
    });
    return dupes;
  }, [entries]);

  const duplicateEntryIds = useMemo(() => {
    const ids = new Set<string>();
    duplicateGroups.forEach(group => {
      group.forEach(e => ids.add(e.id));
    });
    return ids;
  }, [duplicateGroups]);

  const handleRemoveAllDuplicates = async () => {
    const idsToDelete: string[] = [];
    duplicateGroups.forEach(group => {
      // Keep the first one, delete the rest
      for (let i = 1; i < group.length; i++) {
        idsToDelete.push(group[i].id);
      }
    });

    if (idsToDelete.length === 0) return;

    if (window.confirm(`คุณต้องการลบรายการที่ซ้ำซ้อนกันทั้งหมดจำนวน ${idsToDelete.length} รายการ หรือไม่?\n(ระบบจะเก็บข้อมูลต้นฉบับไว้ 1 รายการ และลบแถวซ้ำที่เป็นส่วนเกินออกให้ทั้งหมด)`)) {
      if (onBulkDeleteEntries) {
        await onBulkDeleteEntries(idsToDelete);
      } else {
        // Fallback sequentially
        for (const id of idsToDelete) {
          onDeleteEntry(id);
        }
      }
      alert('ลบรายการที่ซ้ำซ้อนเรียบร้อยแล้ว!');
    }
  };

  // Filter lists
  const filteredEntries = useMemo(() => {
    if (!startDateFilter || !endDateFilter) {
      return [];
    }
    return entries.filter(e => {
      const matchEmp = employeeFilter ? e.employeeName === employeeFilter : true;
      const matchProj = projectFilter ? e.project.toLowerCase().includes(projectFilter.toLowerCase()) : true;
      const matchSearch = searchQuery ? (
        e.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.project.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.remark.toLowerCase().includes(searchQuery.toLowerCase())
      ) : true;
      const matchStartDate = startDateFilter ? e.date >= startDateFilter : true;
      const matchEndDate = endDateFilter ? e.date <= endDateFilter : true;
      const matchStartTime = startTimeFilter ? e.timeIn >= startTimeFilter : true;
      const matchEndTime = endTimeFilter ? e.timeOut <= endTimeFilter : true;
      return matchEmp && matchProj && matchSearch && matchStartDate && matchEndDate && matchStartTime && matchEndTime;
    });
  }, [entries, employeeFilter, projectFilter, searchQuery, startDateFilter, endDateFilter, startTimeFilter, endTimeFilter]);

  // Project List for filtering
  const allProjects = useMemo(() => {
    const set = new Set<string>();
    entries.forEach(e => {
      if (e.project) set.add(e.project);
    });
    return Array.from(set);
  }, [entries]);

  // Handle manual additions
  const handleAddNew = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEntry.employeeName || !newEntry.date || !newEntry.timeIn || !newEntry.timeOut) {
      alert('กรุณากรอกข้อมูล วันที่, ชื่อพนักงาน, เวลาเข้า-ออก ให้ครบถ้วน');
      return;
    }

    const isFlat = newEntry.flatRate || false;
    const matchedEmp = employees.find(emp => {
      const normTarget = emp.employeeName.trim().toUpperCase();
      const normInput = (newEntry.employeeName || '').trim().toUpperCase();
      return normTarget === normInput || normTarget.includes(normInput) || normInput.includes(normTarget);
    });

    // Perform dynamic OT calculation
    const calc = calculateEntryOT(
      newEntry.date,
      newEntry.timeIn,
      newEntry.timeOut,
      newEntry.lunchDeduct || 0,
      newEntry.lunchOT || 0,
      isFlat,
      holidays,
      newEntry.project || '',
      matchedEmp?.workScheduleType,
      matchedEmp?.position,
      newEntry.customerHolidayFlag
    );

    // Prevent direct duplicate adding of the exact same employee, date, timeIn, timeOut, project, lunchOT
    const isExactDuplicate = entries.some(existing => {
      const nameMatch = existing.employeeName.trim().toUpperCase() === newEntry.employeeName.trim().toUpperCase();
      const dateMatch = existing.date === newEntry.date;
      const timeInMatch = (existing.timeIn || '') === (newEntry.timeIn || '');
      const timeOutMatch = (existing.timeOut || '') === (newEntry.timeOut || '');
      const projectMatch = (existing.project || '').trim().toUpperCase() === (newEntry.project || '').trim().toUpperCase();
      const lunchOTMatch = (existing.lunchOT || 0) === (newEntry.lunchOT || 0);
      return nameMatch && dateMatch && timeInMatch && timeOutMatch && projectMatch && lunchOTMatch;
    });

    if (isExactDuplicate) {
      if (!window.confirm(`⚠️ ตรวจพบข้อมูลงานซ้ำซ้อนในระบบ!\n\nคุณได้คีย์ข้อมูลเวลาเข้างานเดียวกันของพนักงานคนนี้ วันนี้ โครงการนี้ เรียบร้อยแล้ว\n\nคุณยังยืนยันที่จะบันทึกแถวข้อมูลนี้ซ้ำอีกหรือไม่?`)) {
        return;
      }
    }

    const entry: TimesheetEntry = {
      id: generateKeyUUID(),
      employeeName: newEntry.employeeName,
      date: newEntry.date,
      project: newEntry.project || '',
      timeIn: newEntry.timeIn,
      timeOut: newEntry.timeOut,
      lunchDeduct: newEntry.lunchDeduct ?? 1,
      lunchOT: newEntry.lunchOT ?? 0,
      customerHolidayFlag: newEntry.customerHolidayFlag ?? 0,
      flatRate: isFlat,
      normalHours: calc.normalHours,
      ot15Hours: calc.ot15Hours,
      ot20Hours: calc.ot20Hours,
      ot30Hours: calc.ot30Hours,
      remark: newEntry.remark || '',
      status: 'Pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    onAddEntry(entry);
    setNewEntry({
      ...newEntry,
      remark: '' // maintain other fields for quick batch additions
    });
    setIsAdding(false);
  };

  // Turn on edit mode for existing row
  const startEdit = (e: TimesheetEntry) => {
    setEditingRowId(e.id);
    setEditingEntry({ ...e });
  };

  // Apply row modifications
  const saveRowChange = (id: string) => {
    if (!editingEntry.employeeName || !editingEntry.date || !editingEntry.timeIn || !editingEntry.timeOut) {
      alert('กรุณากรอกข้อมูลวันที่และเวลาหลักให้ครบถ้วน');
      return;
    }

    const isFlat = editingEntry.flatRate || false;
    const matchedEmp = employees.find(emp => {
      const normTarget = emp.employeeName.trim().toUpperCase();
      const normInput = (editingEntry.employeeName || '').trim().toUpperCase();
      return normTarget === normInput || normTarget.includes(normInput) || normInput.includes(normTarget);
    });

    const calc = calculateEntryOT(
      editingEntry.date,
      editingEntry.timeIn,
      editingEntry.timeOut,
      editingEntry.lunchDeduct ?? 1,
      editingEntry.lunchOT ?? 0,
      isFlat,
      holidays,
      editingEntry.project || '',
      matchedEmp?.workScheduleType,
      matchedEmp?.position,
      editingEntry.customerHolidayFlag
    );

    const finalUpdate: Partial<TimesheetEntry> = {
      ...editingEntry,
      normalHours: calc.normalHours,
      ot15Hours: calc.ot15Hours,
      ot20Hours: calc.ot20Hours,
      ot30Hours: calc.ot30Hours,
      updatedAt: new Date().toISOString()
    };

    onUpdateEntry(id, finalUpdate);
    setEditingRowId(null);
  };

  // Copy paste from Google Sheet parser
  const handleBulkParse = () => {
    if (!importText.trim()) {
      setImportStatusMessage('❌ กรุณาวางข้อความหรือตารางข้อมูลที่ก๊อปปี้มาอย่างน้อยหนึ่งแถว');
      return;
    }

    try {
      // Split into lines
      const lines = importText.split(/\r?\n/);
      const parsedEntries: TimesheetEntry[] = [];
      let successCount = 0;
      let skippedCount = 0;

      lines.forEach((line, index) => {
        if (!line.trim()) return;
        
        // Tab-separated values (direct copy from Google Sheets / Excel is tab separated)
        // If no tabs, split by commas
        let cols = line.includes('\t') ? line.split('\t') : line.split(',');
        cols = cols.map(c => c.trim());

        // Remove any leading empty columns caused by indentations/leading tabs
        while (cols.length > 0 && cols[0] === '') {
          cols.shift();
        }

        // Attempt to detect if first line is headers
        if (index === 0 && (
          line.toLowerCase().includes('employee') || 
          line.toLowerCase().includes('name') || 
          line.includes('วันที') || 
          line.toLowerCase().includes('timein') ||
          line.toLowerCase().includes('id') ||
          line.toLowerCase().includes('wage') ||
          line.toLowerCase().includes('position') ||
          line.includes('ชั่วโมงทำงานปกติ')
        )) {
          skippedCount++;
          return; // Skip header line
        }

        // Expected Column positions mapping standard user sheet dump:
        // ID | EmployeeName | Date | Project | TimeIn | TimeOut | LunchDeduct | LunchOT | NormalHours...
        if (cols.length < 3) {
          skippedCount++;
          return;
        }

        let empName = '';
        let dateStr = '';
        let project = '';
        let timeIn = '';
        let timeOut = '';
        let lunchOT = 0;
        let lunchDeduct = 1;
        let remark = '';

        // Detect user's special multi-column spreadsheet format
        // E.g., Col 0 Day label, Col 1 Date label (DD-MM-YY), Col 2 index ID counter, Col 3 EmployeeName...
        const isWeekdayFirst = /^(MON|TUE|WED|THU|FRI|SAT|SUN|จันทร์|อังคาร|พุธ|พฤหัส|ศุกร์|เสาร์|อาทิตย์|จ\.|อ\.|พ\.|พฤ\.|ศ\.|ส\.|อา\.)/i.test(cols[0]);
        const hasDateSecondClass = cols[1] && (cols[1].includes('-') || cols[1].includes('/'));

        if (isWeekdayFirst && hasDateSecondClass && cols.length >= 8) {
          dateStr = cols[1];
          empName = cols[3];
          project = cols[5] || '';
          timeIn = cols[7];
          timeOut = cols[8];

          // Search from index 9 up to index 15 for "คีย์ 1" (LunchOT indicator)
          let foundLunchOT = false;
          for (let i = 9; i < cols.length && i <= 15; i++) {
            const tempVal = (cols[i] || '').trim().toLowerCase();
            if (
              tempVal.includes('คีย์ 1') || 
              tempVal.includes('คีย์1') || 
              tempVal.includes('worked lunch') || 
              tempVal === '1' || 
              tempVal === '1.0' || 
              tempVal === 'ot'
            ) {
              foundLunchOT = true;
              break;
            }
          }
          lunchOT = foundLunchOT ? 1 : 0;
          remark = cols[14] || '';
        } else if (cols.length >= 5) {
          // If starting with numerical ID (index 1 to 24 in input)
          const firstColIsNumber = /^\d+$/.test(cols[0]);
          if (firstColIsNumber && cols.length >= 6) {
            empName = cols[1] || '';
            dateStr = cols[2] || '';
            project = cols[3] || '';
            timeIn = cols[4] || '';
            timeOut = cols[5] || '';
            
            if (cols[6] !== undefined) {
              const gVal = cols[6].trim().toLowerCase();
              lunchOT = (gVal === '1' || gVal === '1.0' || gVal.includes('คีย์') || gVal === 'ot') ? 1 : 0;
            }
            remark = cols[11] || '';
          } else {
            // No ID index in first column: ชื่อพนักงาน | วันที่ | งาน | เวลาIn | เวลาOut | คีย์(ช่วงพักคีย์ 1)
            empName = cols[0] || '';
            dateStr = cols[1] || '';
            project = cols[2] || '';
            timeIn = cols[3] || '';
            timeOut = cols[4] || '';
            
            if (cols[5] !== undefined) {
              const gVal = cols[5].trim().toLowerCase();
              lunchOT = (gVal === '1' || gVal === '1.0' || gVal.includes('คีย์') || gVal === 'ot') ? 1 : 0;
            }
            remark = cols[10] || '';
          }
        } else {
          // Fallback minimal mappings
          empName = cols[0] || '';
          dateStr = cols[1] || '';
          project = cols[2] || '';
        }

        // Normalize date (converts e.g., 21-03-26 or 23/03/2026 to YYYY-MM-DD or parse correctly)
        const dateClean = dateStr.trim().replace(/\//g, '-');
        const parts = dateClean.split('-');
        if (parts.length === 3) {
          let day = '';
          let month = '';
          let year = '';

          // Let's identify the format: e.g. YYYY-MM-DD or DD-MM-YYYY or DD-MM-YY
          if (parts[0].length === 4) {
            // YYYY-MM-DD
            year = parts[0];
            month = parts[1].padStart(2, '0');
            day = parts[2].padStart(2, '0');
          } else {
            // Either DD-MM-YYYY or DD-MM-YY
            day = parts[0].padStart(2, '0');
            month = parts[1].padStart(2, '0');
            year = parts[2];
            if (year.length === 2) {
              year = '20' + year; // Convert 26 -> 2026
            }
          }
          dateStr = `${year}-${month}-${day}`;
        }

        // Check date validity
        const dateObj = new Date(dateStr);
        if (isNaN(dateObj.getTime()) || !empName) {
          skippedCount++;
          return;
        }

        // Clean time format (8:00 -> 08:00, blank is kept blank)
        const formatTime = (ts: string) => {
          if (!ts || !ts.trim() || ts === '-') return '';
          const t = ts.trim();
          if (t.includes(':')) {
            const p = t.split(':');
            return `${p[0].padStart(2, '0')}:${p[1].padStart(2, '0')}`;
          }
          const numVal = parseInt(t, 10);
          if (!isNaN(numVal)) {
            return `${String(numVal).padStart(2, '0')}:00`;
          }
          return '';
        };

        const standardTimeIn = formatTime(timeIn);
        const standardTimeOut = formatTime(timeOut);

        // Fetch user default FlatRate if applicable
        const matchedEmp = findEmployeeMatch(empName, employees);
        const isFlat = matchedEmp?.isFlatRate || false;

        // Run calculation
        const calc = calculateEntryOT(
          dateStr,
          standardTimeIn,
          standardTimeOut,
          lunchDeduct,
          lunchOT,
          isFlat,
          holidays,
          project,
          matchedEmp?.workScheduleType,
          matchedEmp?.position
        );

        parsedEntries.push({
          id: generateKeyUUID(),
          employeeName: matchedEmp ? matchedEmp.employeeName : empName.toUpperCase(),
          date: dateStr,
          project: project || '',
          timeIn: standardTimeIn,
          timeOut: standardTimeOut,
          lunchDeduct,
          lunchOT,
          flatRate: isFlat,
          normalHours: calc.normalHours,
          ot15Hours: calc.ot15Hours,
          ot20Hours: calc.ot20Hours,
          ot30Hours: calc.ot30Hours,
          remark: remark || (lunchOT === 1 ? 'Worked through break' : ''),
          status: 'Approved', // Set directly to Approved for instant synchronization
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });

        successCount++;
      });

      if (parsedEntries.length > 0) {
        onBulkAddEntries(parsedEntries);
        setImportText('');
        setShowImportModal(false);
        setImportStatusMessage('');
        alert(`นำข้อมูลเสร็จสิ้น! บันทึกสำเร็จ: ${successCount} รายการ, ข้ามบรรทัดส่วนเกิน/ผิดพลาด: ${skippedCount} รายการ`);
      } else {
        setImportStatusMessage(`❌ ไม่สามารถดึงข้อมูลได้สำเร็จเลย มีบรรทัดที่ล้มเหลว/ข้าม ${skippedCount} รายการ`);
      }
    } catch (err: any) {
      setImportStatusMessage(`❌ เกิดข้อผิดพลาดตัวถอดรหัส: ${err.message}`);
    }
  };

  const handleApproveAllPending = async () => {
    const pendings = filteredEntries.filter(e => e.status !== 'Approved');
    if (pendings.length === 0) {
      alert('ไม่มีรายการที่ค้างอนุมัติในรอบการกรองนี้');
      return;
    }
    for (const e of pendings) {
      onUpdateEntry(e.id, { status: 'Approved' });
    }
    alert(`อนุมัติสำเร็จแล้วรวมทั้งสิ้น ${pendings.length} รายการ!`);
  };

  // Export fully computed sheet as standard CSV format matching exactly
  const exportFullTimesheetCSV = () => {
    const headers = [
      'ID',
      'EmployeeName',
      'Date',
      'Project',
      'TimeIn',
      'TimeOut',
      'LunchOT',
      'NormalHours',
      'OT15Hours',
      'OT20Hours',
      'OT30Hours',
      'Remark',
      'Status'
    ];

    const rows = filteredEntries.map((e, idx) => [
      idx + 1,
      e.employeeName,
      e.date,
      e.project,
      e.timeIn,
      e.timeOut,
      e.lunchOT,
      e.normalHours,
      e.ot15Hours,
      e.ot20Hours,
      e.ot30Hours,
      e.remark,
      e.status
    ]);

    const csvContent = "\uFEFF" + [
      headers.join(','),
      ...rows.map(r => r.map(val => `"${val}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    link.setAttribute('href', url);
    link.setAttribute('download', `Timesheet_Calculated_Export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      {/* Search & Actions Panel */}
      <div className="bg-[#0D0D0D] border border-white/10 rounded p-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="search-timesheets-input"
                type="text"
                placeholder="ค้นหารายการ..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="text-xs bg-[#141414] border border-white/10 pl-9 pr-3 py-1.5 text-white placeholder-gray-500 rounded-sm w-52 focus:bg-[#1A1A1A] focus:outline-hidden focus:border-[#D4AF37]"
              />
            </div>

            {/* Employee Filter */}
            <select
              id="filter-employee-select"
              value={employeeFilter}
              onChange={(e) => setEmployeeFilter(e.target.value)}
              className="text-xs bg-[#141414] border border-white/10 text-gray-300 rounded-sm px-2.5 py-1.5 focus:outline-hidden focus:border-[#D4AF37] cursor-pointer"
            >
              <option value="">-- กรองรายพนักงาน (All) --</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.employeeName} className="bg-[#141414]">{emp.id} - {emp.employeeName}</option>
              ))}
            </select>

            {/* Project Filter */}
            <select
              id="filter-project-select"
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="text-xs bg-[#141414] border border-white/10 text-gray-300 rounded-sm px-2.5 py-1.5 focus:outline-hidden focus:border-[#D4AF37] cursor-pointer"
            >
              <option value="">-- กรองรายโครงการ (All) --</option>
              {allProjects.map((p, idx) => (
                <option key={idx} value={p} className="bg-[#141414]">{p}</option>
              ))}
            </select>

            {(employeeFilter || projectFilter || searchQuery || startDateFilter || endDateFilter || startTimeFilter || endTimeFilter) && (
              <button
                id="clear-filters-btn"
                onClick={() => {
                  setEmployeeFilter('');
                  setProjectFilter('');
                  setSearchQuery('');
                  setStartDateFilter('');
                  setEndDateFilter('');
                  setStartTimeFilter('');
                  setEndTimeFilter('');
                }}
                className="text-xs text-red-400 font-medium hover:text-red-300 hover:underline flex items-center gap-1 cursor-pointer"
              >
                ล้างการกรอง (Clear)
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              id="toggle-add-manual"
              onClick={() => setIsAdding(!isAdding)}
              className="px-3 py-1.5 border border-[#D4AF37]/35 hover:bg-[#D4AF37] hover:text-black hover:border-transparent text-[#D4AF37] rounded-sm text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all uppercase tracking-wider"
            >
              <Plus className="w-3.5 h-3.5" />
              เพิ่มรายการ (Add Row)
            </button>
            <button
              id="open-import-modal-btn"
              onClick={() => setShowImportModal(true)}
              className="px-3 py-1.5 bg-[#D4AF37] hover:bg-amber-400 text-black rounded-sm text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md transition-all uppercase tracking-wider"
            >
              <FileUp className="w-3.5 h-3.5" />
              นำเข้าจาก Excel / Sheets
            </button>
            <button
              id="export-timesheet-btn"
              onClick={exportFullTimesheetCSV}
              disabled={filteredEntries.length === 0}
              className="px-3 py-1.5 bg-[#141414] hover:bg-[#1A1A1A] text-white border border-white/15 rounded-sm text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Download className="w-3.5 h-3.5" />
              ส่งออก CSV
            </button>
            <button
              id="approve-all-visible-btn"
              onClick={handleApproveAllPending}
              disabled={filteredEntries.filter(e => e.status !== 'Approved').length === 0}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-30 disabled:hover:bg-emerald-650 disabled:bg-emerald-900/10 text-white rounded-sm text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all uppercase tracking-wider"
              title="อนุมัติรายการที่ค้างอยู่ทั้งหมดที่กำลังแสดง"
            >
              <Check className="w-3.5 h-3.5" />
              อนุมัติทั้งหมด (Approve All)
            </button>
            {onSyncFromDatabase && (
              <button
                id="sync-database-btn"
                onClick={onSyncFromDatabase}
                className="px-3 py-1.5 bg-slate-600 hover:bg-slate-700 text-white rounded-sm text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all uppercase tracking-wider"
                title="ดึงข้อมูลย้อนหลังกลับมาแสดงผลจากฐานข้อมูล Supabase"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                ดึงข้อมูลจาก Database
              </button>
            )}
            <button
              id="clear-all-timesheets-btn"
              onClick={() => {
                setConfirmModal({
                  isOpen: true,
                  title: 'ยืนยันเคลียร์ข้อมูลบนหน้าจอ',
                  message: 'คุณแน่ใจหรือเปล่าที่จะล้าง (Clear) รายการ Timesheet บนหน้าจอ? การกระทำนี้จะเป็นเพียงการล้างการแสดงผลบนหน้าจอชั่วคราวเท่านั้น โดยข้อมูลพนักงานและประวัติการทำงานจริงทั้งหมดจะยังคงอยู่และถูกเก็บบันทึกบนฐานข้อมูลออนไลน์ (Supabase) อย่างปลอดภัย คุณสามารถกด "ดึงข้อมูลจาก Database" เพื่อเรียกข้อมูลกลับคืนมาแสดงได้ตลอดเวลา',
                  actionType: 'clear_all'
                });
              }}
              className="px-2.5 py-1.5 text-xs font-bold text-red-600 hover:text-red-700 dark:text-red-450 bg-red-50 hover:bg-red-105 border border-red-200 dark:border-red-900/40 dark:bg-[#141414] dark:hover:bg-red-950/20 rounded transition-all cursor-pointer"
              title="ล้างแดชบอร์ดรายการเพื่อบันทึกก้อนใหม่"
            >
              เคลียร์ข้อมูลทั้งหมด
            </button>
          </div>
        </div>

        {/* Date & Time Range Filters Row */}
        <div className="pt-2.5 border-t border-white/10 flex flex-wrap items-center gap-4 text-[11px] text-gray-300">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[#D4AF37] font-semibold uppercase tracking-wider text-[10px]">ช่วงวันที่:</span>
            <input
              id="filter-start-date"
              type="date"
              value={startDateFilter}
              onChange={(e) => setStartDateFilter(e.target.value)}
              className="bg-[#141414] border border-white/10 text-gray-200 rounded px-1.5 py-0.5 text-xs focus:outline-hidden focus:border-[#D4AF37] max-w-[125px]"
            />
            <span className="text-gray-500">ถึง</span>
            <input
              id="filter-end-date"
              type="date"
              value={endDateFilter}
              onChange={(e) => setEndDateFilter(e.target.value)}
              className="bg-[#141414] border border-white/10 text-gray-200 rounded px-1.5 py-0.5 text-xs focus:outline-hidden focus:border-[#D4AF37] max-w-[125px]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[#D4AF37] font-semibold uppercase tracking-wider text-[10px]">ช่วงเวลาทำงาน:</span>
            <span className="text-gray-500 text-[10px] font-mono">เข้าตั้งเเต่ (Time In ≥)</span>
            <input
              id="filter-start-time"
              type="time"
              value={startTimeFilter}
              onChange={(e) => setStartTimeFilter(e.target.value)}
              className="bg-[#141414] border border-white/10 text-gray-200 rounded px-1.5 py-0.5 text-xs w-20 focus:outline-hidden focus:border-[#D4AF37]"
            />
            <span className="text-gray-500 text-[10px] font-mono font-bold">|</span>
            <span className="text-gray-500 text-[10px] font-mono">ออกไม่เกิน (Time Out ≤)</span>
            <input
              id="filter-end-time"
              type="time"
              value={endTimeFilter}
              onChange={(e) => setEndTimeFilter(e.target.value)}
              className="bg-[#141414] border border-white/10 text-gray-200 rounded px-1.5 py-0.5 text-xs w-20 focus:outline-hidden focus:border-[#D4AF37]"
            />
          </div>

          {(startDateFilter || endDateFilter || startTimeFilter || endTimeFilter) && (
            <button
              id="clear-range-filters-btn"
              onClick={() => {
                setStartDateFilter('');
                setEndDateFilter('');
                setStartTimeFilter('');
                setEndTimeFilter('');
              }}
              className="text-[#D4AF37] hover:text-yellow-400 font-bold cursor-pointer text-[10.5px] uppercase tracking-wider underline ml-auto transition-colors"
            >
              ล้างค่าช่วงเวลา (Reset Ranges)
            </button>
          )}
        </div>
      </div>

      {/* Inline Form to Add Single Entry */}
      {isAdding && (
        <form onSubmit={handleAddNew} className="bg-[#141414] rounded border border-white/10 p-5 transition-all animate-fade-in space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[#D4AF37] flex items-center gap-1.5 font-serif">
              <Plus className="w-4 h-4 text-[#D4AF37]" />
              ระบุข้อมูลสำหรับทำงานช่องใหม่ (New Timesheet Line)
            </h4>
            <button type="button" onClick={() => setIsAdding(false)} className="text-gray-400 hover:text-white cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-8 gap-3">
            <div className="space-y-1 md:col-span-2">
              <label className="text-[9px] uppercase tracking-widest font-bold text-gray-400 block">เลือกพนักงาน (Employee)</label>
              <select
                id="add-entry-employee-select"
                value={newEntry.employeeName}
                onChange={(e) => {
                  const emp = employees.find(emp => emp.employeeName === e.target.value);
                  setNewEntry({
                    ...newEntry,
                    employeeName: e.target.value,
                    flatRate: emp?.isFlatRate || false
                  });
                }}
                className="w-full text-xs bg-[#0D0D0D] border border-white/10 text-white rounded-sm p-2 focus:outline-hidden focus:border-[#D4AF37] cursor-pointer"
              >
                {employees.map(emp => (
                  <option key={emp.id} value={emp.employeeName} className="bg-[#0D0D0D]">{emp.employeeName} ({emp.workScheduleType === 'daily_worker' ? 'รายวัน' : 'รายเดือน'})</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[9px] uppercase tracking-widest font-bold text-gray-400 block">วันที่ (Date)</label>
              <input
                id="add-entry-date-input"
                type="date"
                value={newEntry.date}
                onChange={(e) => setNewEntry({ ...newEntry, date: e.target.value })}
                className="w-full text-xs bg-[#0D0D0D] border border-white/10 text-white rounded-sm p-1.5 focus:outline-hidden focus:border-[#D4AF37]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[9px] uppercase tracking-widest font-bold text-gray-400 block">โครงการ (Project)</label>
              <input
                id="add-entry-project-input"
                type="text"
                placeholder="010-26_SK"
                value={newEntry.project}
                onChange={(e) => setNewEntry({ ...newEntry, project: e.target.value })}
                className="w-full text-xs bg-[#0D0D0D] border border-white/10 text-white rounded-sm p-1.5 focus:outline-hidden focus:border-[#D4AF37] placeholder-gray-600"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[9px] uppercase tracking-widest font-bold text-gray-400 block">เวลาเข้า (In)</label>
              <input
                id="add-entry-timein-input"
                type="text"
                placeholder="08:00"
                value={newEntry.timeIn}
                onChange={(e) => setNewEntry({ ...newEntry, timeIn: e.target.value })}
                className="w-full text-xs bg-[#0D0D0D] border border-white/10 text-white rounded-sm p-1.5 focus:outline-hidden focus:border-[#D4AF37] font-mono placeholder-gray-600"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[9px] uppercase tracking-widest font-bold text-gray-400 block">เวลาออก (Out)</label>
              <input
                id="add-entry-timeout-input"
                type="text"
                placeholder="17:00"
                value={newEntry.timeOut}
                onChange={(e) => setNewEntry({ ...newEntry, timeOut: e.target.value })}
                className="w-full text-xs bg-[#0D0D0D] border border-white/10 text-white rounded-sm p-1.5 focus:outline-hidden focus:border-[#D4AF37] font-mono placeholder-gray-600"
              />
            </div>

            {/* G column for Lunch Break Worked */}
            <div className="space-y-1 flex flex-col justify-center">
              <label className="text-[9px] uppercase tracking-widest font-bold text-[#D4AF37] block" title="พิมพ์ 1 หรือเลือกหากเป็น 1 ให้คิดเป็นโอที 1.5">
                คีย์(ช่วงพักคีย์ 1)
              </label>
              <div className="flex items-center mt-1.5">
                <input
                  id="add-entry-lunch-ot-checkbox"
                  type="checkbox"
                  checked={newEntry.lunchOT === 1}
                  onChange={(e) => setNewEntry({ ...newEntry, lunchOT: e.target.checked ? 1 : 0 })}
                  className="w-4 h-4 text-red-500 bg-[#141414] border-white/10 rounded-sm focus:ring-0 cursor-pointer"
                />
                <span className="text-[10px] text-red-400 ml-1.5 font-bold">1 (โอที 1.5)</span>
              </div>
            </div>

            {/* Customer Holiday Checkbox */}
            <div className="space-y-1 flex flex-col justify-center">
              <label className="text-[9px] uppercase tracking-widest font-bold text-[#D4AF37] block text-amber-500!" title="เลือกเมื่อทำงานในวันหยุดลูกค้า (คิดเวลาทำงานและ OT เรทวันหยุด)">
                วันหยุดลูกค้า
              </label>
              <div className="flex items-center mt-1.5">
                <input
                  id="add-entry-customer-holiday-checkbox"
                  type="checkbox"
                  checked={newEntry.customerHolidayFlag === 1}
                  onChange={(e) => setNewEntry({ ...newEntry, customerHolidayFlag: e.target.checked ? 1 : 0 })}
                  className="w-4 h-4 text-amber-500 bg-[#141414] border-white/10 rounded-sm focus:ring-0 cursor-pointer"
                />
                <span className="text-[10px] text-amber-400 ml-1.5 font-bold">วันทำงานในวันหยุด (x2.0 / x3.0)</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-4 border-t border-white/10">
            <div className="flex items-center gap-4">
              <div className="flex items-center">
                <input
                  id="add-entry-flatrate-checkbox"
                  type="checkbox"
                  checked={newEntry.flatRate === true}
                  onChange={(e) => setNewEntry({ ...newEntry, flatRate: e.target.checked })}
                  className="w-4 h-4 text-[#D4AF37] bg-[#141414] border-white/10 rounded-sm focus:ring-0 cursor-pointer"
                />
                <div className="ml-1.5">
                  <span className="text-[10px] font-bold text-[#D4AF37] uppercase tracking-wider">วันทำงานเหมาจ่าย Flat Rate (12 ชม.)</span>
                  <span className="text-[9px] text-gray-400 block">หากเป็นประเภทเหมาจ่ายจะคิดค่าแรง rate เดียวรวม ไม่มีเศษโอที</span>
                </div>
              </div>
              
              <div className="space-x-2">
                <input
                  id="add-entry-remark-input"
                  type="text"
                  placeholder="ระบุชื่อ Job หรือ Job reference เช่น Workshop, Job XXX-XX..."
                  value={newEntry.remark}
                  onChange={(e) => setNewEntry({ ...newEntry, remark: e.target.value })}
                  className="text-xs bg-[#0D0D0D] border border-white/10 text-white rounded-sm px-2.5 py-1.5 w-72 focus:outline-hidden focus:border-[#D4AF37]"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                id="cancel-add-entry-btn"
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-4 py-1.5 bg-transparent text-gray-300 border border-white/15 rounded-sm text-xs font-semibold hover:bg-white/5 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                id="submit-add-entry-btn"
                type="submit"
                className="px-5 py-1.5 bg-[#D4AF37] hover:bg-amber-400 text-black rounded-sm text-xs font-bold uppercase tracking-wider cursor-pointer"
              >
                บันทึกคำนวณแถวนี้
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Duplicate alert banner */}
      {duplicateGroups.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded p-4 text-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-fade-in shadow-xs my-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <div>
              <p className="font-bold text-amber-800 dark:text-amber-300 text-sm">พบรายการซ้ำซ้อนในระบบ ({duplicateGroups.reduce((acc, g) => acc + g.length - 1, 0)} รายการ)</p>
              <p className="text-slate-600 dark:text-gray-400 mt-1 leading-relaxed">
                ตรวจพบแถวงานที่ซ้ำกัน (มี พนักงาน, วันที่, เวลาเข้า-ออก และ โครงการ เดียวกัน) ซึ่งทำให้ผลรวมชั่วโมงการทำงานและการคำนวณโอทีคลาดเคลื่อน (เบิ้ลสะสมซ้ำซ้อน) คุณสามารถกดปุ่มลบเพื่อล้างแถวส่วนเกินออกให้เหลือเพียง 1 รายการโดยอัตโนมัติ
              </p>
            </div>
          </div>
          <button
            id="remove-all-duplicates-btn"
            type="button"
            onClick={handleRemoveAllDuplicates}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black rounded font-bold transition-all cursor-pointer select-none text-xs shrink-0 shadow-xs flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            ล้างรายการซ้ำทั้งหมด (เหลือใบเดียว)
          </button>
        </div>
      )}

      {/* Spreadsheet / Timesheet Entries Table */}
      <div className={sheetStyles.gridContainer}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse select-text table-auto md:table-fixed">
            <thead className={sheetStyles.thRow}>
              <tr>
                <th className="py-2.5 px-2 w-11 text-center border-r border-[#bdc1c6] dark:border-[#2d2f34] font-bold text-slate-500 dark:text-gray-400 select-none">ID</th>
                <th className="py-2.5 px-3 w-64 min-w-[250px] border-r border-[#bdc1c6] dark:border-[#2d2f34] text-left font-bold text-amber-600 dark:text-[#D4AF37]">ชื่อพนักงาน</th>
                <th className="py-2.5 px-3 w-28 min-w-[120px] border-r border-[#bdc1c6] dark:border-[#2d2f34] text-left font-bold">วันที่</th>
                <th className="py-2.5 px-3 w-16 min-w-[70px] border-r border-[#bdc1c6] dark:border-[#2d2f34] text-center font-bold">วัน</th>
                <th className="py-2.5 px-3 w-56 min-w-[150px] border-r border-[#bdc1c6] dark:border-[#2d2f34] text-left font-bold text-amber-600 dark:text-amber-400">Project</th>
                <th className="py-2.5 px-2 w-20 min-w-[80px] border-r border-[#bdc1c6] dark:border-[#2d2f34] text-center font-bold">เวลาเข้า</th>
                <th className="py-2.5 px-2 w-20 min-w-[80px] border-r border-[#bdc1c6] dark:border-[#2d2f34] text-center font-bold">เวลาออก</th>
                <th className="py-2.5 px-3 text-center w-20 min-w-[80px] border-r border-[#bdc1c6] dark:border-[#2d2f34] font-bold">ช่วงพัก</th>
                <th className="py-2.5 px-3 text-center w-28 min-w-[110px] border-r border-[#bdc1c6] dark:border-[#2d2f34] font-bold text-amber-600 dark:text-amber-400">วันหยุดลูกค้า</th>
                <th className="py-2.5 px-2.5 text-right bg-emerald-50/60 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-r border-[#bdc1c6] dark:border-[#2d2f34] font-bold w-14 min-w-[55px]">Normal</th>
                <th className="py-2.5 px-2.5 text-right bg-amber-50/60 dark:bg-amber-950/25 text-amber-600 dark:text-[#D4AF37] border-r border-[#bdc1c6] dark:border-[#2d2f34] font-bold w-14 min-w-[55px]">OT 1.5</th>
                <th className="py-2.5 px-2.5 text-right bg-rose-50/60 dark:bg-red-950/25 text-rose-600 dark:text-red-400 border-r border-[#bdc1c6] dark:border-[#2d2f34] font-bold w-14 min-w-[55px]">OT 2.0</th>
                <th className="py-2.5 px-2.5 text-right bg-purple-50/60 dark:bg-purple-950/25 text-purple-600 dark:text-purple-400 border-r border-[#bdc1c6] dark:border-[#2d2f34] font-bold w-14 min-w-[55px]">OT 3.0</th>
                <th className="py-2.5 px-3 text-center w-24 min-w-[95px] border-r border-[#bdc1c6] dark:border-[#2d2f34] font-bold text-sky-600 dark:text-sky-400">รีวิว</th>
                <th className="py-2.5 px-3 border-r border-[#bdc1c6] dark:border-[#2d2f34] text-left font-bold min-w-[180px]">ชื่อ Job / หมายเหตุกิจกรรม (Job Reference)</th>
                <th className="py-2.5 px-3 w-28 min-w-[110px] text-center font-bold">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.length > 0 ? (
                filteredEntries.map((e, idx) => {
                  const isEditing = editingRowId === e.id;
                  const dayOfWeek = getDayOfWeek(e.date);
                  const isSun = dayOfWeek === 0;
                  const isSat = dayOfWeek === 6;
                  const { check: isPH, name: pHName } = isHoliday(e.date, holidays);

                  let dayLabel = '';
                  let dayClass = 'text-gray-500 dark:text-gray-400';
                  if (isSun) { dayLabel = 'อาทิตย์'; dayClass = 'text-red-500 dark:text-red-400 font-bold'; }
                  else if (isSat) { dayLabel = 'เสาร์'; dayClass = 'text-[#8430ce] dark:text-purple-400 font-bold'; }
                  else if (dayOfWeek === 1) { dayLabel = 'จันทร์'; }
                  else if (dayOfWeek === 2) { dayLabel = 'อังคาร'; }
                  else if (dayOfWeek === 3) { dayLabel = 'พุธ'; }
                  else if (dayOfWeek === 4) { dayLabel = 'พฤหัสฯ'; }
                  else if (dayOfWeek === 5) { dayLabel = 'ศุกร์'; }

                  // Choose row styling
                  let rowBgClass = isEditing ? sheetStyles.trSelected : sheetStyles.trNormal;
                  if (isPH && !isEditing) {
                    rowBgClass = isDark ? 'bg-[#2E1212]/90 border-b border-[#2d2f34]' : 'bg-red-50/60 border-b border-[#e0e0e0]';
                  } else if (duplicateEntryIds.has(e.id) && !isEditing) {
                    rowBgClass = isDark ? 'bg-amber-950/10 border-b border-amber-500/20 hover:bg-amber-950/20' : 'bg-amber-50/40 border-b border-amber-200/50 hover:bg-amber-50/70';
                  }

                  return (
                    <tr 
                      key={e.id} 
                      className={`${rowBgClass} transition-colors`}
                    >
                      {/* Left Index Grid Identifier (A, B, C...) equivalent in Sheet - Row Numbers */}
                      <td className={sheetStyles.indexCell}>
                        {idx + 1}
                      </td>

                      {/* Employee Name */}
                      <td className={`${sheetStyles.tdCell} !overflow-visible whitespace-nowrap min-w-[250px]`}>
                        {isEditing ? (
                          <select
                            id={`edit-emp-${e.id}`}
                            value={editingEntry.employeeName}
                            onChange={(ev) => setEditingEntry({ ...editingEntry, employeeName: ev.target.value })}
                            className="bg-white dark:bg-[#0D0D0D] border border-slate-300 dark:border-white/15 rounded px-1.5 py-0.5 text-xs font-semibold text-slate-800 dark:text-white w-full max-w-[240px]"
                          >
                            {employees.map(emp => (
                              <option key={emp.id} value={emp.employeeName} className="bg-white dark:bg-[#0D0D0D] text-slate-800 dark:text-white">{emp.employeeName}</option>
                            ))}
                          </select>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900 dark:text-white whitespace-normal break-words">{e.employeeName}</span>
                            {duplicateEntryIds.has(e.id) && (
                              <span className="bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-400 border border-amber-200 dark:border-amber-900/30 text-[9px] px-1.5 py-0.5 rounded font-bold shrink-0 animate-pulse" title="รายการนี้มีแถวที่ซ้ำซ้อนกันอยู่ในระบบ">
                                ซ้ำ (Duplicate)
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Date */}
                      <td className={sheetStyles.tdMono}>
                        {isEditing ? (
                          <input
                            id={`edit-date-${e.id}`}
                            type="date"
                            value={editingEntry.date}
                            onChange={(ev) => setEditingEntry({ ...editingEntry, date: ev.target.value })}
                            className="bg-white dark:bg-[#0D0D0D] border border-slate-300 dark:border-white/15 text-slate-800 dark:text-white rounded px-1.5 py-0.5 text-xs font-mono"
                          />
                        ) : (
                          formatThaiDate(e.date)
                        )}
                      </td>

                      {/* Day Label with Holiday detection */}
                      <td className={sheetStyles.tdCell}>
                        <span className={dayClass}>{dayLabel}</span>
                        {isPH && (
                          <span 
                            className="block text-[8px] bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900/30 px-1 rounded-sm mt-0.5 text-center font-bold animate-pulse" 
                            title={pHName}
                          >
                            หยุดนักขัตฯ
                          </span>
                        )}
                        {e.customerHolidayFlag === 1 && (
                          <span 
                            className="block text-[8px] bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/30 px-1 rounded-sm mt-0.5 text-center font-bold animate-pulse" 
                            title="วันหยุดลูกค้า"
                          >
                            หยุดลูกค้า
                          </span>
                        )}
                      </td>

                      {/* Project */}
                      <td className={`${sheetStyles.tdCell} max-w-[220px] overflow-hidden`}>
                        {isEditing ? (
                          <input
                            id={`edit-project-${e.id}`}
                            type="text"
                            value={editingEntry.project}
                            onChange={(ev) => setEditingEntry({ ...editingEntry, project: ev.target.value })}
                            className="bg-white dark:bg-[#0D0D0D] border border-slate-300 dark:border-white/15 text-slate-850 dark:text-white rounded px-1.5 py-0.5 text-xs w-full max-w-[200px]"
                          />
                        ) : (
                          <div className="flex flex-col gap-0.5 justify-center" title={e.project || 'WORKSHOP'}>
                            <span className="font-sans font-extrabold text-[#D4AF37] dark:text-[#E2C365] bg-amber-500/5 dark:bg-amber-500/10 border border-amber-300/40 dark:border-amber-500/20 px-2 py-1 rounded text-[11px] block truncate transition-all max-w-[210px]">
                              {e.project ? e.project.toUpperCase() : 'WORKSHOP'}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Time In */}
                      <td className={sheetStyles.tdMono}>
                        {isEditing ? (
                          <input
                            id={`edit-timein-${e.id}`}
                            type="text"
                            value={editingEntry.timeIn}
                            onChange={(ev) => setEditingEntry({ ...editingEntry, timeIn: ev.target.value })}
                            className="bg-white dark:bg-[#0D0D0D] border border-slate-300 dark:border-white/15 text-slate-805 dark:text-white rounded px-1 py-0.5 text-xs font-mono text-center w-16"
                          />
                        ) : (
                          e.timeIn
                        )}
                      </td>

                      {/* Time Out */}
                      <td className={sheetStyles.tdMono}>
                        {isEditing ? (
                          <input
                            id={`edit-timeout-${e.id}`}
                            type="text"
                            value={editingEntry.timeOut}
                            onChange={(ev) => setEditingEntry({ ...editingEntry, timeOut: ev.target.value })}
                            className="bg-white dark:bg-[#0D0D0D] border border-slate-300 dark:border-white/15 text-slate-805 dark:text-white rounded px-1 py-0.5 text-xs font-mono text-center w-16"
                          />
                        ) : (
                          e.timeOut
                        )}
                      </td>

                      {/* Column G Lunch Break Work OT */}
                      <td className={sheetStyles.tdCell}>
                        <div className="flex items-center justify-center">
                          {isEditing ? (
                            <div className="flex items-center justify-center gap-1">
                              <input
                                id={`edit-lunch-ot-${e.id}`}
                                type="checkbox"
                                checked={editingEntry.lunchOT === 1}
                                onChange={(ev) => setEditingEntry({ ...editingEntry, lunchOT: ev.target.checked ? 1 : 0 })}
                                className="w-3.5 h-3.5 text-red-600 rounded-sm focus:ring-0 cursor-pointer"
                              />
                              <span className="text-[9px] text-red-600 dark:text-red-400 font-bold">คีย์ 1</span>
                            </div>
                          ) : (
                            e.lunchOT === 1 ? (
                              <span className="bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-450 font-bold px-2 py-0.5 rounded text-[9px] border border-red-200 dark:border-red-900/30">
                                ช่อง G คีย์ 1 (OT)
                              </span>
                            ) : (
                              <span className="text-slate-400 dark:text-gray-650 text-[10px]">-</span>
                            )
                          )}
                        </div>
                      </td>

                      {/* Customer Holiday Checkbox Column */}
                      <td className={sheetStyles.tdCell}>
                        <div className="flex items-center justify-center">
                          {isEditing ? (
                            <div className="flex items-center justify-center gap-1">
                              <input
                                id={`edit-customer-holiday-${e.id}`}
                                type="checkbox"
                                checked={editingEntry.customerHolidayFlag === 1}
                                onChange={(ev) => setEditingEntry({ ...editingEntry, customerHolidayFlag: ev.target.checked ? 1 : 0 })}
                                className="w-3.5 h-3.5 text-amber-500 rounded-sm focus:ring-0 cursor-pointer"
                              />
                               <span className="text-[9px] text-amber-700 dark:text-amber-400 font-bold">หยุดลูกค้า</span>
                            </div>
                          ) : (
                            e.customerHolidayFlag === 1 ? (
                              <span className="bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 font-bold px-2 py-0.5 rounded text-[9px] border border-amber-200 dark:border-amber-900/30">
                                วันหยุดลูกค้า
                              </span>
                            ) : (
                              <span className="text-slate-400 dark:text-gray-650 text-[10px]">-</span>
                            )
                          )}
                        </div>
                      </td>

                      {/* Normal Hours */}
                      <td className={sheetStyles.normalHours}>
                        {e.normalHours.toFixed(1)}
                      </td>

                      {/* OT 1.5 Rate */}
                      <td className={sheetStyles.ot15}>
                        {e.ot15Hours > 0 ? e.ot15Hours.toFixed(1) : '-'}
                      </td>

                      {/* OT 2.0 Rate */}
                      <td className={sheetStyles.ot20}>
                        {e.ot20Hours > 0 ? e.ot20Hours.toFixed(1) : '-'}
                      </td>

                      {/* OT 3.0 Rate */}
                      <td className={sheetStyles.ot30}>
                        {e.ot30Hours > 0 ? e.ot30Hours.toFixed(1) : '-'}
                      </td>

                      {/* Review Status Approval Column */}
                      <td className={sheetStyles.tdCell}>
                        <div className="flex items-center justify-center gap-1.5">
                          {e.status === 'Approved' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 font-bold px-2.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-950/15">
                              <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              Approved
                            </span>
                          ) : (
                            <button
                              id={`approve-row-btn-${e.id}`}
                              type="button"
                              onClick={() => {
                                onUpdateEntry(e.id, { status: 'Approved' });
                              }}
                              className="inline-flex items-center gap-1.5 text-[10px] bg-amber-50 hover:bg-emerald-600 hover:text-white hover:border-transparent dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 font-bold px-2 py-1 rounded border border-amber-200 dark:border-amber-900/30 transition-all cursor-pointer whitespace-nowrap"
                              title="ปรับสถานะเป็นอนุมัติจ่าย"
                            >
                              <BookmarkCheck className="w-3.5 h-3.5 text-amber-500" />
                              Approve
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Remark */}
                      <td className={sheetStyles.tdCell}>
                        {isEditing ? (
                          <input
                            id={`edit-remark-${e.id}`}
                            type="text"
                            value={editingEntry.remark}
                            onChange={(ev) => setEditingEntry({ ...editingEntry, remark: ev.target.value })}
                            className="bg-white dark:bg-[#0D0D0D] border border-slate-300 dark:border-[#2d2f34] text-slate-805 dark:text-white rounded px-1.5 py-0.5 text-xs w-full"
                          />
                        ) : (
                          <span className="text-slate-600 dark:text-gray-400 text-[11px] truncate max-w-[150px] block" title={e.remark}>
                            {e.remark || '-'}
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-1.5 px-2.5 border-b border-[#e0e0e0] dark:border-[#2d2f34] text-center">
                        {isEditing ? (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              id={`save-edit-btn-${e.id}`}
                              type="button"
                              onClick={() => saveRowChange(e.id)}
                              className="p-1 px-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded cursor-pointer"
                              title="บันทึก"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              id={`cancel-edit-btn-${e.id}`}
                              type="button"
                              onClick={() => setEditingRowId(null)}
                              className="p-1 border border-white/10 hover:bg-white/5 text-gray-400 rounded cursor-pointer"
                              title="ยกเลิก"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              id={`edit-row-btn-${e.id}`}
                              onClick={() => startEdit(e)}
                              className="text-gray-400 hover:text-[#D4AF37] p-1.5 hover:bg-white/5 rounded transition-colors cursor-pointer"
                              title="แก้ไขแถวนี้"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              id={`delete-row-btn-${e.id}`}
                              onClick={() => {
                                setConfirmModal({
                                  isOpen: true,
                                  title: 'ยืนยันการลบแถวบันทึก',
                                  message: `คุณต้องการลบรายการของ "${e.employeeName}" วันที่ ${e.date} จริงๆ ใช่หรือไม่? ข้อมูลนี้จะถูกถอนออกจากฐานข้อมูลถาวร`,
                                  actionType: 'delete_row',
                                  targetId: e.id
                                });
                              }}
                              className="text-red-400 hover:text-red-600 dark:hover:text-red-350 p-1.5 hover:bg-slate-100 dark:hover:bg-white/5 rounded transition-colors cursor-pointer"
                              title="ลบ"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={16} className="text-center py-12 text-slate-500 dark:text-gray-400">
                    <AlertCircle className="w-7 h-7 mx-auto mb-2.5 text-[#D4AF37]" />
                    {(!startDateFilter || !endDateFilter) ? (
                      <span className="font-semibold text-xs text-[#D4AF37]">
                        กรุณาระบุ "ช่วงวันที่" (วันที่เริ่มต้น และวันที่สิ้นสุด) ด้านบนให้ครบถ้วนก่อน เพื่อแสดงกล่องข้อมูลตารางรายการปฏิบัติงาน (Timesheet)
                      </span>
                    ) : (
                      <span>ไม่พบรายการบันทึกเวลาทำงานในช่วงนี้</span>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Copy Paste TSV Import Dialog Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-[#0D0D0D] rounded border border-white/10 max-w-2xl w-full p-6 flex flex-col justify-between text-gray-200">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-sm font-semibold text-[#D4AF37] flex items-center gap-1.5 font-serif uppercase tracking-wider">
                <FileSpreadsheet className="w-5 h-5 text-[#D4AF37]" />
                วางข้อมูลตารางจาก Excel / Google Sheets
              </h3>
              <button onClick={() => { setShowImportModal(false); setImportStatusMessage(''); }} className="text-gray-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 my-4">
              <div className="bg-[#141414] rounded p-4 text-gray-300 text-xs leading-relaxed space-y-1.5 border border-white/5">
                <span className="font-bold text-[#D4AF37]">💡 วิธีการนำเข้ารายรายละเอียดง่ายๆ:</span>
                <p>1. เปิดไฟล์ Google Sheet หรือ Excel หน้ารวมบันทึกเวลาของคุณ</p>
                <p>2. ก๊อปปี้คลุมแถวที่ต้องการ (เลือกตั้งแต่คอลัมน์ชื่อ, วันที่, ชื่องาน, เวลาเข้า, เวลาออก ... และคอลัมน์ คีย์(ช่วงพักคีย์ 1))</p>
                <p>3. นำมากดวาง (Paste / Ctrl+V) ลงในช่องข้อความด้านล่างนี้ และกด "นำเข้าข้อมูลชุดใหญ่"</p>
                <p className="text-[10px] text-gray-500 mt-2">
                  *ข้อมูลจะต้องเรียงลำดับ: <span className="underline font-mono">ชื่อพนักงาน | วันที่ | งาน | เวลาIn | เวลาOut | คีย์(ช่วงพักคีย์ 1)</span>
                </p>
              </div>

              <textarea
                id="clipboard-import-textarea"
                rows={8}
                placeholder="วางตารางที่คัดลอกมาจาก Google Sheet... ยิ่งหลายแถวยิ่งประหยัดเวลาอย่างยิ่ง"
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                className="w-full text-xs bg-[#141414] text-white border border-white/10 p-3 rounded font-mono focus:outline-hidden focus:border-[#D4AF37] placeholder-gray-600 focus:bg-black/40"
              />

              {importStatusMessage && (
                <div className="text-xs font-semibold p-2.5 bg-red-950/50 text-red-300 rounded border border-red-900/30 flex items-center gap-1.5 animate-pulse">
                  <AlertCircle className="w-4 h-4 text-red-400" />
                  {importStatusMessage}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-white/10">
              <div className="text-[10.5px] text-gray-500">
                ระบบจะวิเคราะห์และคำนวณ Normal & OT ให้สะดวกรวดเร็วตามเกณฑ์กฎหมายและวันหยุดให้อัตโนมัติ
              </div>
              <div className="flex gap-2">
                <button
                  id="close-import-modal-btn-cancel"
                  onClick={() => { setShowImportModal(false); setImportStatusMessage(''); }}
                  className="px-4 py-1.5 text-xs font-bold border border-white/15 text-gray-300 rounded-sm hover:bg-white/5 bg-transparent cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  id="confirm-parsed-import-btn"
                  onClick={handleBulkParse}
                  className="px-5 py-1.5 text-xs font-bold bg-[#D4AF37] hover:bg-amber-400 text-black rounded-sm shadow-md cursor-pointer flex items-center gap-1.5 uppercase tracking-wider"
                >
                  <BookmarkCheck className="w-4 h-4" />
                  นำเข้าบันทึกชุดใหญ่
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sleek Custom Confirm Dialog Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center z-50 p-4 transition-all animate-fade-in animate-duration-150">
          <div className="bg-white dark:bg-[#121212] border border-slate-200 dark:border-zinc-800 rounded-lg max-w-md w-full shadow-2xl p-6 text-slate-800 dark:text-gray-200">
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400 mb-4">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold">{confirmModal.title}</h3>
            </div>
            
            <p className="text-xs text-slate-600 dark:text-gray-400 leading-relaxed mb-6">
              {confirmModal.message}
            </p>
            
            <div className="flex gap-2 justify-end pt-3 border-t border-slate-105 dark:border-zinc-900">
              <button
                id="modal-confirm-cancel-btn"
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-1.5 text-xs font-bold border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-gray-300 rounded hover:bg-slate-55 dark:hover:bg-white/5 bg-transparent cursor-pointer transition-all"
              >
                ยกเลิก (Cancel)
              </button>
              <button
                id="modal-confirm-approve-btn"
                onClick={() => {
                  if (confirmModal.actionType === 'clear_all') {
                    onClearAllEntries();
                  } else if (confirmModal.actionType === 'delete_row' && confirmModal.targetId) {
                    onDeleteEntry(confirmModal.targetId);
                  }
                  setConfirmModal(prev => ({ ...prev, isOpen: false }));
                }}
                className="px-5 py-1.5 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded shadow cursor-pointer transition-all"
              >
                ยืนยันตกลง (Confirm)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
