import type { Registration, AppSettings, DashboardStats } from '../types';
import * as XLSX from 'xlsx';
import { sendRegistrationToGoogleSheets } from './googleSheetsService';
import { APP_CONFIG } from '../config';

const SETTINGS_KEY = 'epu_mis_app_settings';
const REGISTRATIONS_KEY = 'epu_mis_all_registrations';
const ADMIN_SESSION_KEY = 'epu_admin_session';

export const DEFAULT_SETTINGS: AppSettings = {
  isRegistrationOpen: true,
  academicLevel: 'قۆناغی سێیەم',
  registrationTitle: APP_CONFIG.DEFAULT_TITLE || 'خۆتۆمارکردنی قوتابیان بۆ سمستەری سێیەم',
  instructionText: 'تکایە زانیارییەکان بە وردی و دروستی پڕبکەرەوە، پاشان فۆرمەکە بنێرە. دوای ناردن زانیارییەکان ڕاستەوخۆ دەچنە Google Sheets.',
  googleSheetScriptUrl: APP_CONFIG.GOOGLE_SHEET_SCRIPT_URL || '',
  googleSheetViewUrl: '',
  adminPassword: 'admin123456',
};

// Seed sample registrations if first time
const INITIAL_SAMPLE_REGISTRATIONS: Registration[] = [
  {
    id: 1,
    registration_code: 'MIS-2026-8492',
    full_name: 'ئاکام سامان مەحمود',
    mobile_number: '07504456789',
    university_email: 'akam.saman@epu.edu.iq',
    university_email_note: 'ئیمەیڵی فەرمی زانکۆ',
    personal_email: 'akam.personal@gmail.com',
    personal_email_note: null,
    academic_level: 'قۆناغی سێیەم',
    student_id: 'MIS-2022-104',
    status: 'approved',
    created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
    synced_to_sheet: true,
  },
  {
    id: 2,
    registration_code: 'MIS-2026-3190',
    full_name: 'سارا کاروان ڕەحمان',
    mobile_number: '07701234567',
    university_email: 'sara.karwan@epu.edu.iq',
    university_email_note: null,
    personal_email: 'sara.karwan99@gmail.com',
    personal_email_note: null,
    academic_level: 'قۆناغی سێیەم',
    student_id: 'MIS-2022-118',
    status: 'new',
    created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
    synced_to_sheet: true,
  },
];

export function getLocalSettings(): AppSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(DEFAULT_SETTINGS));
      return DEFAULT_SETTINGS;
    }
    const parsed = JSON.parse(raw);
    const effectiveSheetUrl =
      (parsed.googleSheetScriptUrl && parsed.googleSheetScriptUrl.trim().length > 10)
        ? parsed.googleSheetScriptUrl
        : APP_CONFIG.GOOGLE_SHEET_SCRIPT_URL;

    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      googleSheetScriptUrl: effectiveSheetUrl,
    };
  } catch (e) {
    return DEFAULT_SETTINGS;
  }
}

export function saveLocalSettings(settings: AppSettings): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function getLocalRegistrations(): Registration[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(REGISTRATIONS_KEY);
    if (!raw) {
      localStorage.setItem(REGISTRATIONS_KEY, JSON.stringify(INITIAL_SAMPLE_REGISTRATIONS));
      return INITIAL_SAMPLE_REGISTRATIONS;
    }
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

export function saveLocalRegistrations(list: Registration[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(REGISTRATIONS_KEY, JSON.stringify(list));
}

export function calculateStats(records: Registration[]): DashboardStats {
  const stats: DashboardStats = {
    total: records.length,
    new: 0,
    reviewed: 0,
    approved: 0,
    rejected: 0,
  };

  records.forEach((r) => {
    if (r.status === 'new') stats.new++;
    else if (r.status === 'reviewed') stats.reviewed++;
    else if (r.status === 'approved') stats.approved++;
    else if (r.status === 'rejected') stats.rejected++;
  });

  return stats;
}

export interface RegisterInput {
  full_name: string;
  mobile_number: string;
  university_email: string;
  university_email_note?: string;
  personal_email: string;
  personal_email_note?: string;
  academic_level: string;
  student_id?: string;
}

/**
 * Main registration submission logic:
 * 1. Checks duplicate email.
 * 2. Generates registration code.
 * 3. Saves locally.
 * 4. Pushes to Google Sheets Webhook if configured.
 * 5. Optionally pushes to /api/register if server is alive.
 */
export async function submitRegistration(input: RegisterInput): Promise<{
  success: boolean;
  registration?: Registration;
  error?: string;
  field?: string;
}> {
  const normalizedUniEmail = input.university_email.trim().toLowerCase();
  const currentList = getLocalRegistrations();
  const settings = getLocalSettings();

  if (!settings.isRegistrationOpen) {
    return {
      success: false,
      error: 'خۆتۆمارکردن لە ئێستادا داخراوە لەلایەن بەڕێوەبەرایەتی بەشەوە.',
    };
  }

  // Duplicate check
  const duplicate = currentList.find(
    (r) => r.university_email.trim().toLowerCase() === normalizedUniEmail
  );
  if (duplicate) {
    return {
      success: false,
      error: 'ئەم ئیمەیڵەی زانکۆ پێشتر تۆمار کراوە لە سیستەم.',
      field: 'university_email',
    };
  }

  // Generate unique registration code: MIS-2026-XXXX
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const code = `MIS-2026-${randomSuffix}`;

  const newRecord: Registration = {
    id: Date.now(),
    registration_code: code,
    full_name: input.full_name.trim(),
    mobile_number: input.mobile_number.trim(),
    university_email: normalizedUniEmail,
    university_email_note: input.university_email_note?.trim() || null,
    personal_email: input.personal_email.trim().toLowerCase(),
    personal_email_note: input.personal_email_note?.trim() || null,
    academic_level: input.academic_level || settings.academicLevel || 'قۆناغی سێیەم',
    student_id: input.student_id?.trim() || null,
    status: 'new',
    created_at: new Date().toISOString(),
    synced_to_sheet: false,
  };

  // 1. Dispatch to Google Sheets if configured
  const effectiveSheetUrl = settings.googleSheetScriptUrl || APP_CONFIG.GOOGLE_SHEET_SCRIPT_URL;
  if (effectiveSheetUrl && effectiveSheetUrl.trim().length > 10) {
    try {
      const res = await sendRegistrationToGoogleSheets(newRecord, effectiveSheetUrl);
      if (res.success) {
        newRecord.synced_to_sheet = true;
      }
    } catch (e) {
      console.warn('Google sheets async push warning:', e);
    }
  }

  // 2. Save into local storage
  const updatedList = [newRecord, ...currentList];
  saveLocalRegistrations(updatedList);

  // 3. Try server API in background if running with Node
  try {
    fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }).catch(() => {});
  } catch (e) {
    // Ignore server error in purely static environment
  }

  return {
    success: true,
    registration: newRecord,
  };
}

/**
 * Export all records to Excel (.xlsx) file
 */
export function exportRegistrationsToExcel(records: Registration[], filename = 'EPU_MIS_Registrations.xlsx') {
  const formattedData = records.map((r, index) => ({
    'ژمارە': index + 1,
    'کۆدی تۆمارکردن': r.registration_code,
    'ناوی تەواو': r.full_name,
    'ژمارەی مۆبایل': r.mobile_number,
    'ئیمەیڵی زانکۆ': r.university_email,
    'تێبینی ئیمەیڵی زانکۆ': r.university_email_note || '',
    'ئیمەیڵی کەسی': r.personal_email,
    'تێبینی ئیمەیڵی کەسی': r.personal_email_note || '',
    'قۆناغی خوێندن': r.academic_level,
    'ژمارەی ناسنامە (ID)': r.student_id || '',
    'دۆخی فۆرم':
      r.status === 'approved'
        ? 'پەسندکراو'
        : r.status === 'reviewed'
        ? 'پێداچوونەوەکراو'
        : r.status === 'rejected'
        ? 'ڕەتکراوە'
        : 'نوێ',
    'بەرواری ناردن': new Date(r.created_at).toLocaleDateString('ckb', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
    'هاوکات لە Google Sheets': r.synced_to_sheet ? 'بەڵێ' : 'نەخێر',
  }));

  const worksheet = XLSX.utils.json_to_sheet(formattedData);
  // Set right-to-left layout for Excel
  worksheet['!views'] = [{ rightToLeft: true }];

  // Column widths
  worksheet['!cols'] = [
    { wch: 6 },
    { wch: 16 },
    { wch: 25 },
    { wch: 14 },
    { wch: 26 },
    { wch: 20 },
    { wch: 26 },
    { wch: 20 },
    { wch: 14 },
    { wch: 16 },
    { wch: 14 },
    { wch: 20 },
    { wch: 15 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'قوتابیانی تۆمارکراو');
  XLSX.writeFile(workbook, filename);
}

/**
 * Export to CSV with UTF-8 BOM
 */
export function exportRegistrationsToCsv(records: Registration[], filename = 'EPU_MIS_Registrations.csv') {
  const headers = [
    'کۆدی تۆمارکردن',
    'ناوی تەواو',
    'مۆبایل',
    'ئیمەیڵی زانکۆ',
    'تێبینی ئیمەیڵی زانکۆ',
    'ئیمەیڵی کەسی',
    'تێبینی ئیمەیڵی کەسی',
    'قۆناغ',
    'ناسنامەی قوتابی',
    'دۆخ',
    'بەرواری تۆمارکردن',
  ];

  const escapeCsv = (val: string | null | undefined) => {
    if (!val) return '""';
    const clean = String(val).replace(/"/g, '""');
    return `"${clean}"`;
  };

  const rows = records.map((r) => [
    escapeCsv(r.registration_code),
    escapeCsv(r.full_name),
    escapeCsv(`'${r.mobile_number}`),
    escapeCsv(r.university_email),
    escapeCsv(r.university_email_note),
    escapeCsv(r.personal_email),
    escapeCsv(r.personal_email_note),
    escapeCsv(r.academic_level),
    escapeCsv(r.student_id),
    escapeCsv(r.status),
    escapeCsv(r.created_at),
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
