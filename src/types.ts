export interface Employee {
  id: string; // e.g. "EMP001"
  employeeName: string;
  staffSalary?: number;
  officeSalary?: number;
  transportationRate?: number;
  workshopRate?: number;
  onsiteRate?: number;
  offshoreRate?: number;
  wfhRate?: number;
  position: string;
  status: 'active' | 'inactive';
  bankName: string;
  bankAccount: string;
  studentLoan: number;
  workScheduleType: 'daily_worker' | 'staff' | 'monthly_worker';
  isFlatRate?: boolean; // Default to flat rate schedule
}

export interface Holiday {
  id: number;
  holidayDate: string; // YYYY-MM-DD
  holidayName: string;
  type: string;
}

export interface TimesheetEntry {
  id: string;
  employeeName: string;
  date: string; // YYYY-MM-DD
  project: string;
  timeIn: string; // e.g., "08:00" or "8:00"
  timeOut: string; // e.g., "17:00" or "17:00"
  lunchDeduct: number; // 0 or 1, whether to deduct 1 hr lunch/break
  lunchOT: number; // G-column: 1 if worked during lunch, 0 otherwise
  flatRate: boolean; // True if works flat 12 hrs shift
  normalHours: number;
  ot15Hours: number;
  ot20Hours: number;
  ot30Hours: number;
  remark: string;
  status: 'Pending' | 'Approved';
  createdAt: string;
  updatedAt: string;
}

export interface CalculationResult {
  normalHours: number;
  ot15Hours: number;
  ot20Hours: number;
  ot30Hours: number;
  totalHours: number;
}

export interface SystemSettings {
  ot15Rate: number;
  ot20Rate: number;
  ot30Rate: number;
  defaultDailyWage: number;
  defaultWorkHours: number;
}

