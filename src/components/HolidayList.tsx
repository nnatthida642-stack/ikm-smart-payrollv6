import React, { useState } from 'react';
import { Holiday } from '../types';
import { CalendarPlus, ShieldAlert, Trash2, Pencil, Check, X } from 'lucide-react';
import { formatThaiDate } from '../utils/calculator';

interface HolidayListProps {
  holidays: Holiday[];
  onAddHoliday: (h: Holiday) => void;
  onDeleteHoliday: (id: number) => void;
  onUpdateHoliday: (h: Holiday) => void;
  isDark?: boolean;
}

export default function HolidayList({ holidays, onAddHoliday, onDeleteHoliday, onUpdateHoliday, isDark = true }: HolidayListProps) {
  const [newHolidayName, setNewHolidayName] = useState('');
  const [newHolidayDate, setNewHolidayDate] = useState('2026-05-01');

  // Edit states
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editType, setEditType] = useState('Public');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHolidayName.trim() || !newHolidayDate) {
      alert('กรุณากรอกวันที่และชื่อวันหยุดใหม่');
      return;
    }

    if (holidays.some(h => h.holidayDate === newHolidayDate)) {
      alert('วันนี้ได้รับการบันทึกเป็นวันหยุดในระบบแล้ว!');
      return;
    }

    const created: Holiday = {
      id: Date.now(),
      holidayDate: newHolidayDate,
      holidayName: newHolidayName.toUpperCase(),
      type: 'Corporate'
    };

    onAddHoliday(created);
    setNewHolidayName('');
  };

  const handleStartEdit = (hol: Holiday) => {
    setEditingId(hol.id);
    setEditName(hol.holidayName);
    setEditDate(hol.holidayDate);
    setEditType(hol.type);
  };

  const handleSaveEdit = (id: number) => {
    if (!editName.trim() || !editDate) {
      alert('กรุณากรอกวันที่และชื่ออธิบายวันหยุด');
      return;
    }
    // Check if the date is already used by another holiday
    if (holidays.some(h => h.holidayDate === editDate && h.id !== id)) {
      alert('วันนี้ได้รับการบันทึกเป็นวันหยุดในระบบแล้ว!');
      return;
    }
    onUpdateHoliday({
      id,
      holidayDate: editDate,
      holidayName: editName.toUpperCase(),
      type: editType
    });
    setEditingId(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  // Modern eye-soothing styling classes based on theme status
  const cardBgClass = isDark ? 'bg-[#141414] border-white/10' : 'bg-white border-slate-200 shadow-xs';
  const textTitleClass = isDark ? 'text-[#D4AF37]' : 'text-amber-700';
  const textMutedClass = isDark ? 'text-gray-400' : 'text-slate-500';
  const textBodyClass = isDark ? 'text-gray-300' : 'text-slate-800';
  const inputBgClass = isDark ? 'bg-[#0D0D0D] border-white/10 text-white focus:border-[#D4AF37]' : 'bg-white border-slate-300 text-slate-800 focus:ring-1 focus:ring-amber-500 focus:border-amber-500';
  
  // Google Sheets clean grid styles
  const tableHeaderStyle = isDark ? 'bg-[#1C1C1C] text-gray-300 border-b-2 border-white/15' : 'bg-[#E8EAED] text-slate-700 font-bold border-b-2 border-slate-300';
  const sheetCellClass = isDark ? 'border-white/5 text-gray-300' : 'border-slate-200 text-slate-800';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* List of holidays */}
      <div className={`lg:col-span-8 border rounded-xs overflow-hidden ${cardBgClass}`}>
        <div className={`p-4 border-b flex items-center justify-between ${isDark ? 'border-white/10 bg-[#141414]' : 'border-slate-100 bg-[#FAFAFA]'}`}>
          <div>
            <h3 className={`text-xs font-bold uppercase tracking-widest ${textTitleClass}`}>
              ปฏิทินปูมวันหยุดพนักงาน ประจำปี 2026 ({holidays.length} วัน)
            </h3>
            <p className={`text-[10px] ${textMutedClass} mt-0.5 font-medium`}>
              วันหยุดเหล่านี้เป็นตัวแปรดึงดูดเงื่อนไขคูณสวัสดิการล่วงเวลาพิเศษตามข้อบังคับความมั่นคงสูง (เรท OT 2.0 และ 3.0)
            </p>
          </div>
        </div>

        <div className="overflow-y-auto max-h-[420px]">
          {/* Google Sheet Style Grid Table */}
          <table className="w-full text-left text-xs border-collapse">
            <thead className={`${tableHeaderStyle} uppercase text-[9px] tracking-widest sticky top-0 z-10`}>
              <tr>
                <th className="py-2 px-3 w-12 text-center border-r border-slate-300 dark:border-white/10">ID</th>
                <th className="py-2 px-3 w-40 border-r border-slate-300 dark:border-white/10">วันที่ประกาศหยุด</th>
                <th className="py-2 px-3 border-r border-slate-300 dark:border-white/10">ชื่ออธิบายวันหยุดนักขัตฤกษ์</th>
                <th className="py-2 px-3 w-48 text-center border-r border-slate-300 dark:border-white/10">ประเภทวันทำงาน</th>
                <th className="py-2 px-3 w-28 text-center">ตัวเลือกจัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dotted font-medium font-sans">
              {holidays
                .sort((a,b) => a.holidayDate.localeCompare(b.holidayDate))
                .map((hol, idx) => {
                  const isEditing = editingId === hol.id;
                  return (
                    <tr 
                      key={hol.id} 
                      className={`transition-colors text-[11px] ${isEditing ? 'bg-amber-500/10' : ''} ${
                        isDark 
                          ? 'hover:bg-white/[0.02] even:bg-[#1a1a1a]/40 bg-[#141414]' 
                          : 'hover:bg-amber-50/40 even:bg-[#F8F9FA] bg-white'
                      }`}
                    >
                      {/* Column 1: ID */}
                      <td className={`py-2 text-center font-mono text-[10px] border-r ${sheetCellClass}`}>
                        {idx + 1}
                      </td>
                      
                      {/* Column 2: Date */}
                      <td className={`py-1.5 px-2 font-mono border-r ${sheetCellClass}`}>
                        {isEditing ? (
                          <input
                            type="date"
                            value={editDate}
                            onChange={(e) => setEditDate(e.target.value)}
                            className="w-full text-[11px] font-mono px-1.5 py-0.5 bg-slate-50 dark:bg-[#0d0d0d] border border-slate-300 dark:border-white/10 rounded-sm text-slate-800 dark:text-white focus:outline-hidden focus:border-amber-500"
                          />
                        ) : (
                          <span className="font-bold">{formatThaiDate(hol.holidayDate)}</span>
                        )}
                      </td>
                      
                      {/* Column 3: Name */}
                      <td className={`py-1.5 px-3 border-r ${sheetCellClass}`}>
                        {isEditing ? (
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full text-[11px] px-1.5 py-0.5 bg-slate-50 dark:bg-[#0d0d0d] border border-slate-300 dark:border-white/10 rounded-sm text-slate-800 dark:text-white focus:outline-hidden focus:border-amber-500"
                          />
                        ) : (
                          <span className="font-semibold">{hol.holidayName}</span>
                        )}
                      </td>
                      
                      {/* Column 4: Type Badge */}
                      <td className={`py-1.5 px-2 text-center border-r ${sheetCellClass}`}>
                        {isEditing ? (
                          <select
                            value={editType}
                            onChange={(e) => setEditType(e.target.value)}
                            className="w-full text-[10px] px-1.5 py-0.5 bg-slate-50 dark:bg-[#0d0d0d] border border-slate-300 dark:border-white/10 rounded-sm text-slate-800 dark:text-white focus:outline-hidden focus:border-amber-500"
                          >
                            <option value="Public">นักขัตฤกษ์ตามกฎหมาย</option>
                            <option value="Corporate">วันหยุดบริษัทเพิ่มเติม</option>
                          </select>
                        ) : (
                          <span className={`px-2 py-0.5 rounded-xs text-[9px] font-bold inline-block border ${
                            hol.type === 'Public' 
                              ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/30' 
                              : 'bg-sky-50 text-sky-750 border-sky-200 dark:bg-sky-950/40 dark:text-sky-305 dark:border-sky-900/30'
                          }`}>
                            {hol.type === 'Public' ? 'นักขัตฤกษ์ตามกฎหมาย' : 'วันหยุดบริษัทเพิ่มเติม'}
                          </span>
                        )}
                      </td>
                      
                      {/* Column 5: Action */}
                      <td className="py-2 px-2 text-center whitespace-nowrap">
                        {isEditing ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleSaveEdit(hol.id)}
                              className="text-emerald-600 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 p-1 rounded-sm transition-colors cursor-pointer inline-flex items-center"
                              title="บันทึกแก้ไข"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={handleCancelEdit}
                              className="text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-white/5 p-1 rounded-sm transition-colors cursor-pointer inline-flex items-center"
                              title="ยกเลิก"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleStartEdit(hol)}
                              className="text-blue-500 hover:text-blue-400 hover:bg-slate-150 dark:hover:bg-white/5 p-1 rounded-sm transition-colors cursor-pointer inline-flex items-center"
                              title="แก้ไขวันหยุด"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              id={`delete-holiday-btn-${hol.id}`}
                              type="button"
                              onClick={() => onDeleteHoliday(hol.id)}
                              className="text-slate-400 hover:text-red-500 hover:bg-slate-150 dark:hover:bg-white/5 p-1 rounded-sm transition-colors cursor-pointer inline-flex items-center"
                              title="ลบวันหยุด"
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

      {/* Add Form */}
      <div className="lg:col-span-4 space-y-4">
        <form onSubmit={handleSubmit} className={`border rounded-xs p-5 space-y-4 ${cardBgClass}`}>
          <div className={`flex items-center gap-2 border-b pb-3 ${isDark ? 'border-white/10' : 'border-slate-150'}`}>
            <CalendarPlus className={`w-4 h-4 ${isDark ? 'text-[#D4AF37]' : 'text-amber-600'}`} />
            <h4 className={`text-xs font-bold uppercase tracking-widest ${textTitleClass}`}>
              เพิ่มวันหยุดบริษัทร่วม (Add Holiday)
            </h4>
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-widest font-extrabold text-slate-550 dark:text-gray-400 block pb-0.5">
                วันที่ลามหยุด (Date)
              </label>
              <input
                id="add-holiday-date"
                type="date"
                value={newHolidayDate}
                onChange={(e) => setNewHolidayDate(e.target.value)}
                className={`w-full text-xs rounded-sm p-2 focus:outline-hidden border transition-all ${inputBgClass}`}
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-widest font-extrabold text-slate-550 dark:text-gray-400 block pb-0.5">
                ชื่อแสดงวันหยุด (Holiday Label)
              </label>
              <input
                id="add-holiday-name"
                type="text"
                placeholder="วันหยุดพิเศษบริษัท หรือ วันปีใหม่สากล"
                required
                value={newHolidayName}
                onChange={(e) => setNewHolidayName(e.target.value)}
                className={`w-full text-xs rounded-sm p-2 focus:outline-hidden border transition-all ${inputBgClass}`}
              />
            </div>
          </div>

          <button
            id="submit-holiday-btn"
            type="submit"
            className="w-full py-2 bg-[#D4AF37] hover:bg-amber-500 text-black font-semibold uppercase tracking-wider text-xs rounded-sm shadow-xs cursor-pointer transition-colors"
          >
            ระบุวันสวัสดิการเพื่อคำนวณใหม่
          </button>
        </form>

        <div className={`rounded-xs p-4 border space-y-2 ${
          isDark 
            ? 'bg-amber-950/15 border-amber-900/30' 
            : 'bg-amber-50/50 border-amber-200/60'
        }`}>
          <div className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider ${isDark ? 'text-[#D4AF37]' : 'text-amber-800'}`}>
            <ShieldAlert className="w-4 h-4" />
            พระราชบัญญัติกฎหมายแรงงานไทย:
          </div>
          <p className={`text-[10px] leading-relaxed font-medium ${isDark ? 'text-gray-300' : 'text-slate-600'}`}>
            ทำหน้าที่ประมวลผลกรณีทำงานช่วงเวลานักขัตฤกษ์ โดยกำหนดให้คงอัตราค่าชดเชยอย่างน้อย **2 เท่า** (OT 2.0) ในกะปกติ และส่งต่อไปที่ **3 เท่า** (OT 3.0) ในชั่วโมงล่วงเวลาพิเศษเพิ่มเติม
          </p>
        </div>
      </div>
    </div>
  );
}
