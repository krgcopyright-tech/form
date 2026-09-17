import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import bcrypt from 'bcryptjs';

// Ensure data directory exists
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'registration.db');
export const db = new DatabaseSync(dbPath);

// Initialize schema
export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS registrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      registration_code TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      mobile_number TEXT NOT NULL,
      university_email TEXT UNIQUE NOT NULL,
      university_email_note TEXT,
      personal_email TEXT NOT NULL,
      personal_email_note TEXT,
      academic_level TEXT NOT NULL,
      student_id TEXT,
      status TEXT NOT NULL DEFAULT 'new',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_reg_email ON registrations(university_email);
    CREATE INDEX IF NOT EXISTS idx_reg_code ON registrations(registration_code);
    CREATE INDEX IF NOT EXISTS idx_reg_status ON registrations(status);
  `);

  // Run column migrations safely if table already exists
  try {
    db.exec(`ALTER TABLE registrations ADD COLUMN university_email_note TEXT;`);
  } catch (_) {}
  try {
    db.exec(`ALTER TABLE registrations ADD COLUMN personal_email_note TEXT;`);
  } catch (_) {}

  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      is_registration_open INTEGER NOT NULL DEFAULT 1,
      academic_level TEXT NOT NULL DEFAULT 'قۆناغی سێیەم',
      registration_title TEXT NOT NULL DEFAULT 'خۆتۆمارکردنی قوتابیان بۆ سمستەری سێیەم',
      instruction_text TEXT NOT NULL DEFAULT 'تکایە زانیارییەکان بە وردی و دروستی پڕبکەرەوە، پاشان فۆرمەکە بنێرە.'
    );

    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      admin_id INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Initialize default settings if not already present
  const checkSettings = db.prepare('SELECT COUNT(*) as count FROM settings WHERE id = 1').get() as { count: number };
  if (checkSettings.count === 0) {
    db.prepare(`
      INSERT INTO settings (id, is_registration_open, academic_level, registration_title, instruction_text)
      VALUES (1, 1, 'قۆناغی سێیەم', 'خۆتۆمارکردنی قوتابیان بۆ سمستەری سێیەم', 'تکایە زانیارییەکان بە وردی و دروستی پڕبکەرەوە، پاشان فۆرمەکە بنێرە.')
    `).run();
  }

  // Initialize default admin if not already present
  const adminEmail = process.env.ADMIN_DEFAULT_EMAIL || 'admin@epu.edu.iq';
  const adminPassword = process.env.ADMIN_DEFAULT_PASSWORD || 'admin123456';
  const checkAdmin = db.prepare('SELECT COUNT(*) as count FROM admins WHERE email = ?').get(adminEmail) as { count: number };
  
  if (checkAdmin.count === 0) {
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(adminPassword, salt);
    db.prepare('INSERT INTO admins (email, password_hash) VALUES (?, ?)').run(adminEmail, hash);
    console.log(`[Database] Default admin seeded: ${adminEmail}`);
  }
}

// Generate random unique registration code like REG-8F42K1
export function generateRegistrationCode(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let attempts = 0;
  while (attempts < 50) {
    let randomPart = '';
    for (let i = 0; i < 6; i++) {
      randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const code = `REG-${randomPart}`;
    const existing = db.prepare('SELECT id FROM registrations WHERE registration_code = ?').get(code);
    if (!existing) {
      return code;
    }
    attempts++;
  }
  return `REG-${Date.now().toString(36).toUpperCase()}`;
}

export interface RegistrationRecord {
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
  status: 'new' | 'reviewed' | 'approved' | 'rejected';
  created_at: string;
}

export interface AppSettings {
  id: number;
  is_registration_open: number; // 1 or 0
  academic_level: string;
  registration_title: string;
  instruction_text: string;
}
