export type RegistrationStatus = 'new' | 'reviewed' | 'approved' | 'rejected';

export interface Registration {
  id: number;
  registration_code: string;
  full_name: string;
  mobile_number: string;
  university_email: string;
  university_email_note?: string | null;
  personal_email: string;
  personal_email_note?: string | null;
  academic_level: string;
  student_id: string | null;
  status: RegistrationStatus;
  created_at: string;
}

export interface AppSettings {
  isRegistrationOpen: boolean;
  academicLevel: string;
  registrationTitle: string;
  instructionText: string;
}

export interface DashboardStats {
  total: number;
  new: number;
  reviewed: number;
  approved: number;
  rejected: number;
}

export interface RegistrationListResponse {
  records: Registration[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  stats: DashboardStats;
}
