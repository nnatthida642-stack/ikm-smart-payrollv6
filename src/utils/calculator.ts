import { Holiday, CalculationResult, TimesheetEntry, Employee } from '../types';

export function findEmployeeMatch(inputName: string, employees: Employee[]): Employee | undefined {
  if (!inputName) return undefined;

  const cleanInput = inputName.trim().toUpperCase().replace(/\s+/g, ' ');
  if (!cleanInput) return undefined;

  // 1. Try exact ID match (e.g. "EMP032" or "EMP-032")
  const idMatch = employees.find(emp => {
    const cleanId = emp.id.trim().toUpperCase();
    return cleanId === cleanInput || cleanId === cleanInput.replace(/[-_]/g, '');
  });
  if (idMatch) return idMatch;

  // 2. Try exact name match (normalized spaces)
  const exactNameMatch = employees.find(emp => {
    const cleanTarget = emp.employeeName.trim().toUpperCase().replace(/\s+/g, ' ');
    return cleanTarget === cleanInput;
  });
  if (exactNameMatch) return exactNameMatch;

  // 3. Try checking if ID is embedded in the input (e.g., "EMP032 ANAN KHOTSOMBAT" or "EMP032 - ANAN")
  const idEmbeddedMatch = employees.find(emp => {
    const cleanId = emp.id.trim().toUpperCase();
    return cleanInput.includes(cleanId);
  });
  if (idEmbeddedMatch) return idEmbeddedMatch;

  // 4. Try matching first name AND last name parts with word boundaries
  const inputWords = cleanInput.split(' ').filter(w => w.length > 0);
  if (inputWords.length > 0) {
    // Score each employee based on how well their name matches the input words
    let bestMatch: Employee | undefined = undefined;
    let highestScore = 0;

    for (const emp of employees) {
      const targetWords = emp.employeeName.trim().toUpperCase().replace(/\s+/g, ' ').split(' ');
      
      // Calculate how many input words match target words exactly or as prefixes
      let score = 0;
      let matchedAll = true;

      for (const inWord of inputWords) {
        let wordMatched = false;
        for (const tWord of targetWords) {
          if (tWord === inWord) {
            score += 10; // Exact word match
            wordMatched = true;
          } else if (tWord.startsWith(inWord) || inWord.startsWith(tWord)) {
            score += 5; // Prefix or partial word match
            wordMatched = true;
          }
        }
        if (!wordMatched) {
          matchedAll = false;
        }
      }

      // Bonus if first word (first name) matches exactly
      if (targetWords[0] === inputWords[0]) {
        score += 8;
      } else if (targetWords[0] && inputWords[0] && (targetWords[0].startsWith(inputWords[0]) || inputWords[0].startsWith(targetWords[0]))) {
        score += 3;
      }

      // Bonus for name length similarity or exact matching count
      if (matchedAll) {
        score += 4;
      }

      if (score > highestScore) {
        highestScore = score;
        bestMatch = emp;
      } else if (score === highestScore && score > 0) {
        // Tie-breaker: favor exact first-word match
        if (bestMatch) {
          const prevFirstWord = bestMatch.employeeName.trim().toUpperCase().split(' ')[0];
          const currFirstWord = emp.employeeName.trim().toUpperCase().split(' ')[0];
          if (currFirstWord === inputWords[0] && prevFirstWord !== inputWords[0]) {
            bestMatch = emp;
          }
        }
      }
    }

    // Only return if we have a reasonably strong match (e.g., score >= 5)
    if (highestScore >= 5) {
      return bestMatch;
    }
  }

  // 5. Ultimate fallback - loose substring match
  return employees.find(emp => {
    const normTarget = emp.employeeName.trim().toUpperCase();
    return normTarget.includes(cleanInput) || cleanInput.includes(normTarget);
  });
}

export function parseTimeToDecimal(timeStr: string): number {
  if (!timeStr || !timeStr.trim()) return 0;
  const parts = timeStr.trim().split(':');
  if (parts.length < 2) {
    // Try simple number parsing if format is e.g. "8" or "17"
    const val = parseFloat(timeStr);
    return isNaN(val) ? 0 : val;
  }
  const hrs = parseInt(parts[0], 10) || 0;
  const mins = parseInt(parts[1], 10) || 0;
  return hrs + mins / 60;
}

export function formatDecimalToTime(decimal: number): string {
  if (decimal <= 0) return '00:00';
  const hrs = Math.floor(decimal);
  const mins = Math.round((decimal - hrs) * 60);
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

export function formatThaiDate(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.trim().split('-');
  if (parts.length !== 3) {
    const slashParts = dateStr.trim().split('/');
    if (slashParts.length === 3) {
      let year = parseInt(slashParts[0], 10);
      if (!isNaN(year) && year > 1000) {
        const month = slashParts[1];
        const day = slashParts[2];
        const ceTwoDigits = String(year % 100).padStart(2, '0');
        return `${day}/${month}/${ceTwoDigits}`;
      }
      year = parseInt(slashParts[2], 10);
      if (!isNaN(year) && year > 1000) {
        const month = slashParts[1];
        const day = slashParts[0];
        const ceTwoDigits = String(year % 100).padStart(2, '0');
        return `${day}/${month}/${ceTwoDigits}`;
      }
    }
    return dateStr;
  }
  const year = parseInt(parts[0], 10);
  const month = parts[1];
  const day = parts[2];
  if (isNaN(year)) return dateStr;
  const ceTwoDigits = String(year % 100).padStart(2, '0');
  return `${day}/${month}/${ceTwoDigits}`;
}

export function isHoliday(dateStr: string, holidays: Holiday[]): { check: boolean; name: string } {
  if (!dateStr) return { check: false, name: '' };
  const targetDate = dateStr.trim();
  if (targetDate === '2026-05-04') {
    return { check: false, name: '' };
  }
  const found = holidays.find(h => h.holidayDate === targetDate);
  if (found) {
    return { check: true, name: found.holidayName };
  }
  return { check: false, name: '' };
}

export function getDayOfWeek(dateStr: string): number {
  // Returns 0 for Sunday, 1 for Monday, ..., 6 for Saturday
  if (!dateStr) return -1;
  const d = new Date(dateStr);
  return d.getDay();
}

export function calculateEntryOT(
  dateStr: string,
  timeInStr: string,
  timeOutStr: string,
  lunchDeductFlag: number, // 1 to deduct lunch, 0 otherwise
  lunchOTFlag: number, // G-column: 1 if worked during lunch
  isFlatRateEmployee: boolean,
  holidays: Holiday[],
  projectName?: string,
  workScheduleType?: string,
  position?: string,
  customerHolidayFlag?: number
): CalculationResult {
  if (!dateStr || !timeInStr || !timeOutStr) {
    return { normalHours: 0, ot15Hours: 0, ot20Hours: 0, ot30Hours: 0, totalHours: 0 };
  }

  const timeIn = parseTimeToDecimal(timeInStr);
  let timeOut = parseTimeToDecimal(timeOutStr);

  // If timeOut is less than timeIn, the shift crossed midnight (overnight shift)
  if (timeOut < timeIn) {
    timeOut += 24;
  }

  let totalElapsed = timeOut - timeIn;
  if (totalElapsed < 0) totalElapsed = 0;

  // Standard break subtraction
  let breakHours = 0;
  // If the total elapsed hours is 5.0 or more, we automatically deduct a 1-hour lunch break.
  // This removes the need for a manual "lunchDeduct" checkbox and handles Saturday half-days perfectly.
  if (totalElapsed >= 5.0) {
    breakHours = 1.0;
  }

  // Work hours without break
  let actualWorkHours = Math.max(0, totalElapsed - breakHours);

  // G-Column (Working lunch): If they worked through lunch
  // That means we add lunch OT hour back, or rather, the worked hour during lunch is extra OT
  let addedLunchOT = lunchOTFlag === 1 ? 1.0 : 0.0;

  // Let's identify the day status
  const { check: isPubHoliday, name: holidayName } = isHoliday(dateStr, holidays);
  const dayOfWeek = getDayOfWeek(dateStr);
  const isSunday = dayOfWeek === 0;
  const isSaturday = dayOfWeek === 6;
  const isOffshore = projectName ? projectName.toLowerCase().includes('offshore') : false;
  const isHolidayDay = isPubHoliday || isSunday || customerHolidayFlag === 1;

  // New strict rule: If project is Offshore, it has fixed daily rate, OT is never calculated or shown
  if (isOffshore) {
    const defaultHours = actualWorkHours > 0 ? 8.0 : 0.0;
    return {
      normalHours: defaultHours,
      ot15Hours: 0,
      ot20Hours: 0,
      ot30Hours: 0,
      totalHours: defaultHours
    };
  }

  // 1. Flat Rate rule:
  // Flat rate means work 12 hours/day for one single rate.
  // No OT is counted for flat rate.
  if (isFlatRateEmployee) {
    const hours = Math.min(12, actualWorkHours + addedLunchOT);
    return {
      normalHours: Number(hours.toFixed(2)),
      ot15Hours: 0,
      ot20Hours: 0,
      ot30Hours: 0,
      totalHours: Number(hours.toFixed(2))
    };
  }

  // Define outputs
  let normalHours = 0;
  let ot15Hours = 0;
  let ot20Hours = 0;
  let ot30Hours = 0;

  const isDailyWorker =
    workScheduleType === 'daily_worker' ||
    (position && position.toLowerCase().includes('daily'));

  // 2. Holiday or Sunday calculation rules (bypassed if offshore)
  if (isHolidayDay && !isOffshore) {
    // Normal hours are 0 for holidays, but they do work and get holiday pay rates.
    // Under standard Thai labor law:
    // First 8 hours on Sunday / Public Holiday are paid as OT 2.0 (for daily workers) or OT 1.0 (for monthly)
    // We will allocate the first 8 hours to OT 2.0 (which is the Holiday Normal rate column)
    // Hours beyond 8 hours are paid as Holiday Overtime at OT 3.0
    const mainWorkHours = actualWorkHours;
    
    const limit = 8.0;
    const baseHolidayHours = Math.min(limit, mainWorkHours);
    const excessHolidayHours = Math.max(0, mainWorkHours - limit);

    ot20Hours = baseHolidayHours;
    ot30Hours = excessHolidayHours;

    // Adjust for Lunch OT
    if (addedLunchOT > 0) {
      // Worked lunch counts as holiday overtime. Since lunch is during the primary shift,
      // if total hours <= 8, it can be paid as OT 2.0. If above, it's OT 3.0.
      // Usually, work during break is considered extra OT, so we add it to OT 3.0 to be safe,
      // or if they didn't exceed 8 hours, it's OT 2.0.
      if (ot20Hours + addedLunchOT <= 8.0) {
        ot20Hours += addedLunchOT;
      } else {
        const spaceLeft = Math.max(0, 8.0 - ot20Hours);
        ot20Hours += spaceLeft;
        ot30Hours += (addedLunchOT - spaceLeft);
      }
    }

    normalHours = 0; // Holidays have no weekday "normal hours"
  } 
  // 3. Saturday calculation rules (bypassed if offshore)
  else if (isSaturday && !isOffshore) {
    if (isDailyWorker) {
      // "พนักงานที่มีตำแหน่ง Daily Worker ปรับวันทำจันทร์ - เสาร์ เป็นวันทำงานปกติ"
      // Normal hours are up to 8.0, and after-hours are OT 1.5.
      const mainWorkHours = actualWorkHours;
      normalHours = Math.min(8.0, mainWorkHours);
      ot15Hours = Math.max(0, mainWorkHours - 8.0);

      // Keyed lunch break worked (Lunch OT Flag = 1):
      // Calculated as 1.0 hour of OT 1.5.
      if (addedLunchOT > 0) {
        ot15Hours += addedLunchOT;
      }
    } else {
      // "ส่วนตำแหน่งอื่นๆ วันเสาร์ 08:00-12:00 นับ 4 ชั่วโมง หลังจาก 4 ชั่วโมง คือโอที 1.5"
      const mainWorkHours = actualWorkHours;
      normalHours = Math.min(4.0, mainWorkHours);
      ot15Hours = Math.max(0, mainWorkHours - 4.0);

      // If Lunch OT (คีย์ 1): Worked during break (which on Saturday is 12:00-13:00).
      // This adds 1.0 hour to OT 1.5.
      if (addedLunchOT > 0) {
        ot15Hours += addedLunchOT;
      }
    }
  } 
  // 4. Normal Weekday (Mon-Fri) rules
  else {
    // Weekday: 8 Normal hours, and after-hours are OT 1.5.
    // Lunch break worked (LunchOT = 1) counts as OT 1.5.
    
    // Let's handle night shift overtime first or standard daytime overtime
    // Under night shift: e.g. 20:00 to 05:00 is normal 8 hours.
    // If they work beyond 05:00 (e.g. until 07:00), the 2 hours after 05:00 are OT 1.5.
    const mainWorkHours = actualWorkHours;
    
    normalHours = Math.min(8.0, mainWorkHours);
    ot15Hours = Math.max(0, mainWorkHours - 8.0);

    // Add Lunch OT to OT 1.5
    if (addedLunchOT > 0) {
      ot15Hours += addedLunchOT;
    }
  }

  // Format calculations to 2 decimal places to prevent float rounding errors
  normalHours = Number(normalHours.toFixed(2));
  ot15Hours = Number(ot15Hours.toFixed(2));
  ot20Hours = Number(ot20Hours.toFixed(2));
  ot30Hours = Number(ot30Hours.toFixed(2));
  const total = Number((normalHours + ot15Hours + ot20Hours + ot30Hours).toFixed(2));

  return {
    normalHours,
    ot15Hours,
    ot20Hours,
    ot30Hours,
    totalHours: total
  };
}

export function rebalanceTimesheetEntries(
  allEntries: TimesheetEntry[],
  employees: Employee[],
  holidays: Holiday[]
): TimesheetEntry[] {
  // Deduplicate entries by ID to avoid duplicates in state
  const uniqueInput: TimesheetEntry[] = [];
  const seenIds = new Set<string>();
  allEntries.forEach(entry => {
    if (!entry) return;
    const entryId = entry.id || `${entry.employeeName}_${entry.date}_${entry.timeIn}_${entry.timeOut}_${Math.random().toString(36).substring(2, 9)}`;
    if (!seenIds.has(entryId)) {
      seenIds.add(entryId);
      uniqueInput.push({
        ...entry,
        id: entryId
      });
    }
  });

  // Group entries by employeeName (case-insensitive) and date
  const groups: Record<string, TimesheetEntry[]> = {};
  uniqueInput.forEach(entry => {
    if (!entry.employeeName || !entry.date) return;
    const key = `${entry.employeeName.trim().toUpperCase()}_${entry.date}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(entry);
  });

  const rebalancedList: TimesheetEntry[] = [];

  // For each employee + date group
  Object.keys(groups).forEach(key => {
    const dayEntries = groups[key];
    if (dayEntries.length <= 1) {
      // Direct pass-through if only 0 or 1 entries on this date, since it's already computed correctly
      rebalancedList.push(...dayEntries);
      return;
    }

    // Sort entries chronologically by timeIn, so the first shift is processed first
    const sorted = [...dayEntries].sort((a, b) => {
      return (a.timeIn || '08:00').localeCompare(b.timeIn || '08:00');
    });

    const firstEntry = sorted[0];
    const employee = findEmployeeMatch(firstEntry.employeeName, employees);

    const isFlat = employee?.isFlatRate || false;
    const workType = employee?.workScheduleType;
    const pos = employee?.position;

    // Daily normal limit based on the calendar day status
    const hasCustomerHoliday = dayEntries.some(e => e.customerHolidayFlag === 1);
    const { check: isPubHoliday } = isHoliday(firstEntry.date, holidays);
    const dayOfWeek = getDayOfWeek(firstEntry.date);
    const isSunday = dayOfWeek === 0;
    const isSaturday = dayOfWeek === 6;

    let maxNormalHoursAllowed = 8.0;
    if (isPubHoliday || isSunday || hasCustomerHoliday) {
      maxNormalHoursAllowed = 0.0;
    } else if (isSaturday) {
      const isDailyWorker = workType === 'daily_worker' || (pos && pos.toLowerCase().includes('daily'));
      maxNormalHoursAllowed = isDailyWorker ? 8.0 : 4.0;
    }

    let usedNormalHours = 0.0;
    let usedOt20Hours = 0.0; // Sunday / Holiday base OT 2.0 hours limit (8.0 limit)

    const processed = sorted.map(entry => {
      // Standard independent calculation first
      const calc = calculateEntryOT(
        entry.date,
        entry.timeIn,
        entry.timeOut,
        entry.lunchDeduct ?? 1,
        entry.lunchOT ?? 0,
        isFlat,
        holidays,
        entry.project,
        workType,
        pos,
        entry.customerHolidayFlag
      );

      let normal = calc.normalHours;
      let ot15 = calc.ot15Hours;
      let ot20 = calc.ot20Hours;
      let ot30 = calc.ot30Hours;

      if (isFlat) {
        // Flat rate just uses the standard flat calculation up to 12.0 hours
        return {
          ...entry,
          normalHours: normal,
          ot15Hours: ot15,
          ot20Hours: ot20,
          ot30Hours: ot30,
          totalHours: calc.totalHours
        };
      }

      // Rebalance normal hours on Weekday or Saturday
      if (maxNormalHoursAllowed > 0) {
        const availableNormal = Math.max(0, maxNormalHoursAllowed - usedNormalHours);
        if (normal > availableNormal) {
          const excess = normal - availableNormal;
          normal = availableNormal;
          ot15 += excess; // Shift converted excess normal hours to OT 1.5
        }
        usedNormalHours += normal;
      }

      // Rebalance Sunday/Holiday OT 2.0 / OT 3.0 (First 8 hours OT 2.0, excess OT 3.0)
      if (isPubHoliday || isSunday || hasCustomerHoliday) {
        const maxOt20Allowed = 8.0;
        const availableOt20 = Math.max(0, maxOt20Allowed - usedOt20Hours);
        if (ot20 > availableOt20) {
          const excess = ot20 - availableOt20;
          ot20 = availableOt20;
          ot30 += excess;
        }
        usedOt20Hours += ot20;
      }

      return {
        ...entry,
        normalHours: Number(normal.toFixed(2)),
        ot15Hours: Number(ot15.toFixed(2)),
        ot20Hours: Number(ot20.toFixed(2)),
        ot30Hours: Number(ot30.toFixed(2)),
        totalHours: Number((normal + ot15 + ot20 + ot30).toFixed(2))
      };
    });

    rebalancedList.push(...processed);
  });

  return rebalancedList;
}
