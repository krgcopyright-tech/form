import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import bcrypt from 'bcryptjs';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

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

export interface AdminRecord {
  id: number;
  email: string;
  password_hash: string;
  created_at?: string;
}

export interface SessionRecord {
  token: string;
  admin_id: number;
  expires_at: number;
  created_at?: string;
}

// ----------------------------------------------------
// 1. SUPABASE CLIENT & CIRCUIT BREAKER
// ----------------------------------------------------
const supabaseUrl = process.env.SUPABASE_URL || 'https://knwxjgjlxyxapamqelcd.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'sb_secret_sl3oPI__qpuEQSiIcVIvHg_sPkEOoPr';

let supabaseFails = 0;
let supabaseDisabledUntil = 0;

export function canUseSupabase(): boolean {
  if (!supabase) return false;
  if (Date.now() < supabaseDisabledUntil) return false;
  return true;
}

function recordSupabaseSuccess() {
  supabaseFails = 0;
  supabaseDisabledUntil = 0;
}

function recordSupabaseFailure() {
  supabaseFails++;
  if (supabaseFails >= 2) {
    supabaseDisabledUntil = Date.now() + 60 * 1000; // 60s cooldown
    console.warn('[Supabase] Connection issue detected. Suspended for 60s; using local SQLite/memory.');
  }
}

// Custom fetch wrapper with a strict 2-second timeout to avoid long hangs in sandboxed or offline environments
const fetchWithTimeout: typeof fetch = async (input, init) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2000);
  try {
    const res = await fetch(input, {
      ...init,
      signal: init?.signal ? AbortSignal.any([init.signal, controller.signal]) : controller.signal,
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
};

export let supabase: SupabaseClient | null = null;
if (supabaseUrl && supabaseKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
      global: {
        fetch: fetchWithTimeout,
      },
    });
    console.log('[Supabase] Initialized client for:', supabaseUrl);
  } catch (err) {
    console.error('[Supabase] Initialization error:', err);
  }
}

// ----------------------------------------------------
// 2. IN-MEMORY FAILSAFE STORE (BULLETPROOF FALLBACK)
// ----------------------------------------------------
interface MemoryStore {
  settings: AppSettings;
  admins: AdminRecord[];
  sessions: SessionRecord[];
  registrations: RegistrationRecord[];
  nextRegistrationId: number;
}

const defaultAdminEmail = (process.env.ADMIN_DEFAULT_EMAIL || 'admin@epu.edu.iq').toLowerCase();
const defaultAdminPassword = process.env.ADMIN_DEFAULT_PASSWORD || 'admin123456';

const memoryStore: MemoryStore = {
  settings: {
    id: 1,
    is_registration_open: 1,
    academic_level: 'قۆناغی سێیەم',
    registration_title: 'خۆتۆمارکردنی قوتابیان بۆ سمستەری سێیەم',
    instruction_text: 'تکایە زانیارییەکان بە وردی و دروستی پڕبکەرەوە، پاشان فۆرمەکە بنێرە.',
  },
  admins: [
    {
      id: 1,
      email: defaultAdminEmail,
      password_hash: bcrypt.hashSync(defaultAdminPassword, 10),
      created_at: new Date().toISOString(),
    },
  ],
  sessions: [],
  registrations: [],
  nextRegistrationId: 1,
};

// ----------------------------------------------------
// 3. SQLITE LOCAL FALLBACK (SAFE FOR VERCEL READ-ONLY FS & ESM)
// ----------------------------------------------------
let sqliteDb: any = null;

function getSqliteDb() {
  if (sqliteDb) return sqliteDb;

  try {
    let DatabaseSyncClass: any = null;
    try {
      const nodeRequire = createRequire(import.meta.url);
      const sqliteModule = nodeRequire('node:sqlite');
      DatabaseSyncClass = sqliteModule?.DatabaseSync;
    } catch {
      DatabaseSyncClass = null;
    }

    if (!DatabaseSyncClass) {
      return null;
    }

    // Attempt persistent data directory first, fallback to /tmp, then :memory:
    let db: any = null;
    const pathsToTry = [
      () => {
        const dataDir = path.join(process.cwd(), 'data');
        if (!fs.existsSync(dataDir)) {
          fs.mkdirSync(dataDir, { recursive: true });
        }
        return path.join(dataDir, 'registration.db');
      },
      () => path.join('/tmp', 'registration.db'),
      () => ':memory:',
    ];

    for (const getPath of pathsToTry) {
      try {
        const p = getPath();
        db = new DatabaseSyncClass(p);
        break;
      } catch {
        // try next candidate path
      }
    }

    if (!db) {
      db = new DatabaseSyncClass(':memory:');
    }

    sqliteDb = db;
    initSqliteSchema(sqliteDb);
    console.log('[SQLite] Local SQLite database initialized successfully.');
    return sqliteDb;
  } catch (err) {
    console.warn('[SQLite] SQLite unavailable or read-only filesystem:', err);
    return null;
  }
}

function initSqliteSchema(db: any) {
  try {
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

    // Migrations
    try { db.exec(`ALTER TABLE registrations ADD COLUMN university_email_note TEXT;`); } catch (_) {}
    try { db.exec(`ALTER TABLE registrations ADD COLUMN personal_email_note TEXT;`); } catch (_) {}

    // Seed settings
    const checkSettings = db.prepare('SELECT COUNT(*) as count FROM settings WHERE id = 1').get() as { count: number };
    if (checkSettings.count === 0) {
      db.prepare(`
        INSERT INTO settings (id, is_registration_open, academic_level, registration_title, instruction_text)
        VALUES (1, 1, 'قۆناغی سێیەم', 'خۆتۆمارکردنی قوتابیان بۆ سمستەری سێیەم', 'تکایە زانیارییەکان بە وردی و دروستی پڕبکەرەوە، پاشان فۆرمەکە بنێرە.')
      `).run();
    }

    // Seed admin
    const adminEmail = (process.env.ADMIN_DEFAULT_EMAIL || 'admin@epu.edu.iq').toLowerCase();
    const adminPassword = process.env.ADMIN_DEFAULT_PASSWORD || 'admin123456';
    const checkAdmin = db.prepare('SELECT COUNT(*) as count FROM admins WHERE LOWER(email) = LOWER(?)').get(adminEmail) as { count: number };
    if (checkAdmin.count === 0) {
      const salt = bcrypt.genSaltSync(10);
      const hash = bcrypt.hashSync(adminPassword, salt);
      db.prepare('INSERT INTO admins (email, password_hash) VALUES (?, ?)').run(adminEmail, hash);
    }
  } catch (err) {
    console.error('[SQLite] Schema init error:', err);
  }
}

// ----------------------------------------------------
// 4. DATABASE INITIALIZATION
// ----------------------------------------------------
export async function initDatabase() {
  if (supabase) {
    try {
      const { data, error } = await supabase.from('settings').select('*').limit(1);
      if (error && error.code === 'PGRST205') {
        console.warn('⚠️ [Supabase] Tables not created yet in Supabase. Please run supabase_schema.sql in the Supabase SQL editor.');
        recordSupabaseFailure();
      } else if (!error) {
        console.log('✅ [Supabase] Connected and verified tables successfully.');
        recordSupabaseSuccess();
      } else {
        recordSupabaseFailure();
      }
    } catch (err) {
      console.warn('[Supabase] Connection check warning:', err);
      recordSupabaseFailure();
    }
  }
  getSqliteDb();
}

// ----------------------------------------------------
// 5. SETTINGS HELPERS
// ----------------------------------------------------
export async function getSettings(): Promise<AppSettings> {
  if (canUseSupabase()) {
    try {
      const { data, error } = await supabase!.from('settings').select('*').eq('id', 1).maybeSingle();
      if (!error && data) {
        recordSupabaseSuccess();
        return {
          id: 1,
          is_registration_open: Number(data.is_registration_open ?? 1),
          academic_level: data.academic_level || 'قۆناغی سێیەم',
          registration_title: data.registration_title || 'خۆتۆمارکردنی قوتابیان بۆ سمستەری سێیەم',
          instruction_text: data.instruction_text || 'تکایە زانیارییەکان بە وردی و دروستی پڕبکەرەوە، پاشان فۆرمەکە بنێرە.',
        };
      }
      recordSupabaseFailure();
    } catch (err) {
      recordSupabaseFailure();
      console.warn('[getSettings] Supabase fallback:', err);
    }
  }

  const sdb = getSqliteDb();
  if (sdb) {
    try {
      const row = sdb.prepare('SELECT * FROM settings WHERE id = 1').get() as any;
      if (row) return row;
    } catch (_) {}
  }

  return memoryStore.settings;
}

export async function updateSettings(data: {
  is_registration_open: number;
  academic_level: string;
  registration_title: string;
  instruction_text: string;
}): Promise<void> {
  memoryStore.settings = {
    ...memoryStore.settings,
    ...data,
  };

  if (canUseSupabase()) {
    try {
      const { error } = await supabase!.from('settings').upsert({
        id: 1,
        is_registration_open: data.is_registration_open,
        academic_level: data.academic_level,
        registration_title: data.registration_title,
        instruction_text: data.instruction_text,
      });
      if (!error) {
        recordSupabaseSuccess();
        return;
      }
      recordSupabaseFailure();
    } catch (err) {
      recordSupabaseFailure();
      console.warn('[updateSettings] Supabase error:', err);
    }
  }

  const sdb = getSqliteDb();
  if (sdb) {
    try {
      sdb.prepare(`
        UPDATE settings SET
          is_registration_open = ?,
          academic_level = ?,
          registration_title = ?,
          instruction_text = ?
        WHERE id = 1
      `).run(
        data.is_registration_open,
        data.academic_level,
        data.registration_title,
        data.instruction_text
      );
    } catch (_) {}
  }
}

// ----------------------------------------------------
// 6. ADMIN AUTHENTICATION HELPERS
// ----------------------------------------------------
export async function findAdminByEmail(email: string): Promise<AdminRecord | null> {
  if (canUseSupabase()) {
    try {
      const { data, error } = await supabase!
        .from('admins')
        .select('*')
        .ilike('email', email.trim())
        .maybeSingle();
      if (!error && data) {
        recordSupabaseSuccess();
        return data as AdminRecord;
      }
      if (error) recordSupabaseFailure();
    } catch (err) {
      recordSupabaseFailure();
      console.warn('[findAdminByEmail] Supabase error:', err);
    }
  }

  const sdb = getSqliteDb();
  if (sdb) {
    try {
      const row = sdb.prepare('SELECT * FROM admins WHERE LOWER(email) = LOWER(?)').get(email.trim()) as AdminRecord | undefined;
      if (row) return row;
    } catch (_) {}
  }

  const inMem = memoryStore.admins.find(a => a.email.toLowerCase() === email.trim().toLowerCase());
  return inMem || null;
}

export async function findAdminById(id: number): Promise<AdminRecord | null> {
  if (canUseSupabase()) {
    try {
      const { data, error } = await supabase!
        .from('admins')
        .select('id, email, password_hash, created_at')
        .eq('id', id)
        .maybeSingle();
      if (!error && data) {
        recordSupabaseSuccess();
        return data as AdminRecord;
      }
      if (error) recordSupabaseFailure();
    } catch (err) {
      recordSupabaseFailure();
      console.warn('[findAdminById] Supabase error:', err);
    }
  }

  const sdb = getSqliteDb();
  if (sdb) {
    try {
      const row = sdb.prepare('SELECT id, email, password_hash, created_at FROM admins WHERE id = ?').get(id) as AdminRecord | undefined;
      if (row) return row;
    } catch (_) {}
  }

  const inMem = memoryStore.admins.find(a => a.id === id);
  return inMem || null;
}

export async function updateAdminPassword(id: number, passwordHash: string): Promise<void> {
  const inMem = memoryStore.admins.find(a => a.id === id);
  if (inMem) inMem.password_hash = passwordHash;

  if (canUseSupabase()) {
    try {
      const { error } = await supabase!.from('admins').update({ password_hash: passwordHash }).eq('id', id);
      if (!error) {
        recordSupabaseSuccess();
        return;
      }
      recordSupabaseFailure();
    } catch (err) {
      recordSupabaseFailure();
      console.warn('[updateAdminPassword] Supabase error:', err);
    }
  }

  const sdb = getSqliteDb();
  if (sdb) {
    try {
      sdb.prepare('UPDATE admins SET password_hash = ? WHERE id = ?').run(passwordHash, id);
    } catch (_) {}
  }
}

export async function createSession(token: string, adminId: number, expiresAt: number): Promise<void> {
  memoryStore.sessions.push({
    token,
    admin_id: adminId,
    expires_at: expiresAt,
    created_at: new Date().toISOString(),
  });

  if (canUseSupabase()) {
    try {
      const { error } = await supabase!.from('sessions').insert({
        token,
        admin_id: adminId,
        expires_at: expiresAt,
      });
      if (!error) {
        recordSupabaseSuccess();
        return;
      }
      recordSupabaseFailure();
    } catch (err) {
      recordSupabaseFailure();
      console.warn('[createSession] Supabase error:', err);
    }
  }

  const sdb = getSqliteDb();
  if (sdb) {
    try {
      sdb.prepare('INSERT INTO sessions (token, admin_id, expires_at) VALUES (?, ?, ?)').run(token, adminId, expiresAt);
    } catch (_) {}
  }
}

export async function getSession(token: string): Promise<SessionRecord | null> {
  const now = Date.now();
  if (canUseSupabase()) {
    try {
      const { data, error } = await supabase!
        .from('sessions')
        .select('*')
        .eq('token', token)
        .gt('expires_at', now)
        .maybeSingle();
      if (!error && data) {
        recordSupabaseSuccess();
        return data as SessionRecord;
      }
      if (error) recordSupabaseFailure();
    } catch (err) {
      recordSupabaseFailure();
      console.warn('[getSession] Supabase error:', err);
    }
  }

  const sdb = getSqliteDb();
  if (sdb) {
    try {
      const row = sdb.prepare('SELECT * FROM sessions WHERE token = ? AND expires_at > ?').get(token, now) as SessionRecord | undefined;
      if (row) return row;
    } catch (_) {}
  }

  const inMem = memoryStore.sessions.find(s => s.token === token && s.expires_at > now);
  return inMem || null;
}

export async function deleteSession(token: string): Promise<void> {
  memoryStore.sessions = memoryStore.sessions.filter(s => s.token !== token);

  if (canUseSupabase()) {
    try {
      await supabase!.from('sessions').delete().eq('token', token);
      recordSupabaseSuccess();
    } catch (_) {
      recordSupabaseFailure();
    }
  }

  const sdb = getSqliteDb();
  if (sdb) {
    try {
      sdb.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    } catch (_) {}
  }
}

// ----------------------------------------------------
// 7. REGISTRATION HELPERS
// ----------------------------------------------------
export async function generateRegistrationCode(): Promise<string> {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  for (let attempt = 0; attempt < 30; attempt++) {
    let randomPart = '';
    for (let i = 0; i < 6; i++) {
      randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const code = `REG-${randomPart}`;
    const existing = await findRegistrationByCode(code);
    if (!existing) {
      return code;
    }
  }
  return `REG-${Date.now().toString(36).toUpperCase()}`;
}

export async function findRegistrationByCode(code: string): Promise<RegistrationRecord | null> {
  if (canUseSupabase()) {
    try {
      const { data, error } = await supabase!
        .from('registrations')
        .select('*')
        .eq('registration_code', code)
        .maybeSingle();
      if (!error && data) {
        recordSupabaseSuccess();
        return data as RegistrationRecord;
      }
      if (error) recordSupabaseFailure();
    } catch (_) {
      recordSupabaseFailure();
    }
  }

  const sdb = getSqliteDb();
  if (sdb) {
    try {
      const row = sdb.prepare('SELECT * FROM registrations WHERE registration_code = ?').get(code) as RegistrationRecord | undefined;
      if (row) return row;
    } catch (_) {}
  }

  const inMem = memoryStore.registrations.find(r => r.registration_code === code);
  return inMem || null;
}

export async function findRegistrationByUniversityEmail(email: string): Promise<RegistrationRecord | null> {
  if (canUseSupabase()) {
    try {
      const { data, error } = await supabase!
        .from('registrations')
        .select('*')
        .ilike('university_email', email.trim())
        .maybeSingle();
      if (!error && data) {
        recordSupabaseSuccess();
        return data as RegistrationRecord;
      }
      if (error) recordSupabaseFailure();
    } catch (_) {
      recordSupabaseFailure();
    }
  }

  const sdb = getSqliteDb();
  if (sdb) {
    try {
      const row = sdb.prepare('SELECT * FROM registrations WHERE LOWER(university_email) = LOWER(?)').get(email.trim()) as RegistrationRecord | undefined;
      if (row) return row;
    } catch (_) {}
  }

  const inMem = memoryStore.registrations.find(r => r.university_email.toLowerCase() === email.trim().toLowerCase());
  return inMem || null;
}

export async function findDuplicateEmailExcept(email: string, excludeId: number): Promise<boolean> {
  if (canUseSupabase()) {
    try {
      const { data, error } = await supabase!
        .from('registrations')
        .select('id')
        .ilike('university_email', email.trim())
        .neq('id', excludeId)
        .maybeSingle();
      if (!error && data) {
        recordSupabaseSuccess();
        return true;
      }
      if (error) recordSupabaseFailure();
    } catch (_) {
      recordSupabaseFailure();
    }
  }

  const sdb = getSqliteDb();
  if (sdb) {
    try {
      const row = sdb.prepare('SELECT id FROM registrations WHERE LOWER(university_email) = LOWER(?) AND id != ?').get(email.trim(), excludeId);
      if (row) return Boolean(row);
    } catch (_) {}
  }

  return memoryStore.registrations.some(r => r.university_email.toLowerCase() === email.trim().toLowerCase() && r.id !== excludeId);
}

export async function createRegistration(data: {
  registration_code: string;
  full_name: string;
  mobile_number: string;
  university_email: string;
  university_email_note?: string | null;
  personal_email: string;
  personal_email_note?: string | null;
  academic_level: string;
  student_id?: string | null;
}): Promise<RegistrationRecord> {
  if (canUseSupabase()) {
    try {
      const { data: created, error } = await supabase!
        .from('registrations')
        .insert({
          registration_code: data.registration_code,
          full_name: data.full_name,
          mobile_number: data.mobile_number,
          university_email: data.university_email,
          university_email_note: data.university_email_note || null,
          personal_email: data.personal_email,
          personal_email_note: data.personal_email_note || null,
          academic_level: data.academic_level,
          student_id: data.student_id || null,
          status: 'new',
        })
        .select()
        .single();
      if (!error && created) {
        recordSupabaseSuccess();
        return created as RegistrationRecord;
      }
      recordSupabaseFailure();
    } catch (err) {
      recordSupabaseFailure();
      console.warn('[createRegistration] Supabase error:', err);
    }
  }

  const sdb = getSqliteDb();
  if (sdb) {
    try {
      const insertStmt = sdb.prepare(`
        INSERT INTO registrations (
          registration_code, full_name, mobile_number, university_email, university_email_note, personal_email, personal_email_note, academic_level, student_id, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', datetime('now', 'localtime'))
      `);

      const res = insertStmt.run(
        data.registration_code,
        data.full_name,
        data.mobile_number,
        data.university_email,
        data.university_email_note || null,
        data.personal_email,
        data.personal_email_note || null,
        data.academic_level,
        data.student_id || null
      );

      return sdb.prepare('SELECT * FROM registrations WHERE id = ?').get(res.lastInsertRowid) as RegistrationRecord;
    } catch (sqlErr) {
      console.warn('[createRegistration] SQLite insert error, falling back to memory store:', sqlErr);
    }
  }

  // Failsafe in-memory store
  const newRecord: RegistrationRecord = {
    id: memoryStore.nextRegistrationId++,
    registration_code: data.registration_code,
    full_name: data.full_name,
    mobile_number: data.mobile_number,
    university_email: data.university_email,
    university_email_note: data.university_email_note || null,
    personal_email: data.personal_email,
    personal_email_note: data.personal_email_note || null,
    academic_level: data.academic_level,
    student_id: data.student_id || null,
    status: 'new',
    created_at: new Date().toISOString(),
  };
  memoryStore.registrations.unshift(newRecord);
  return newRecord;
}

export async function getRegistrationById(id: number): Promise<RegistrationRecord | null> {
  if (canUseSupabase()) {
    try {
      const { data, error } = await supabase!
        .from('registrations')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (!error && data) {
        recordSupabaseSuccess();
        return data as RegistrationRecord;
      }
      if (error) recordSupabaseFailure();
    } catch (_) {
      recordSupabaseFailure();
    }
  }

  const sdb = getSqliteDb();
  if (sdb) {
    try {
      const row = sdb.prepare('SELECT * FROM registrations WHERE id = ?').get(id) as RegistrationRecord | undefined;
      if (row) return row;
    } catch (_) {}
  }

  const inMem = memoryStore.registrations.find(r => r.id === id);
  return inMem || null;
}

export async function updateRegistration(id: number, data: Partial<RegistrationRecord>): Promise<RegistrationRecord | null> {
  if (canUseSupabase()) {
    try {
      const updatePayload: Record<string, any> = {};
      if (data.full_name !== undefined) updatePayload.full_name = data.full_name;
      if (data.mobile_number !== undefined) updatePayload.mobile_number = data.mobile_number;
      if (data.university_email !== undefined) updatePayload.university_email = data.university_email;
      if (data.university_email_note !== undefined) updatePayload.university_email_note = data.university_email_note;
      if (data.personal_email !== undefined) updatePayload.personal_email = data.personal_email;
      if (data.personal_email_note !== undefined) updatePayload.personal_email_note = data.personal_email_note;
      if (data.academic_level !== undefined) updatePayload.academic_level = data.academic_level;
      if (data.student_id !== undefined) updatePayload.student_id = data.student_id;
      if (data.status !== undefined) updatePayload.status = data.status;

      const { data: updated, error } = await supabase!
        .from('registrations')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();
      if (!error && updated) {
        recordSupabaseSuccess();
        return updated as RegistrationRecord;
      }
      if (error) recordSupabaseFailure();
    } catch (_) {
      recordSupabaseFailure();
    }
  }

  const sdb = getSqliteDb();
  if (sdb) {
    try {
      sdb.prepare(`
        UPDATE registrations SET
          full_name = COALESCE(?, full_name),
          mobile_number = COALESCE(?, mobile_number),
          university_email = COALESCE(?, university_email),
          university_email_note = ?,
          personal_email = COALESCE(?, personal_email),
          personal_email_note = ?,
          academic_level = COALESCE(?, academic_level),
          student_id = ?,
          status = COALESCE(?, status)
        WHERE id = ?
      `).run(
        data.full_name,
        data.mobile_number,
        data.university_email,
        data.university_email_note,
        data.personal_email,
        data.personal_email_note,
        data.academic_level,
        data.student_id,
        data.status,
        id
      );
      return sdb.prepare('SELECT * FROM registrations WHERE id = ?').get(id) as RegistrationRecord;
    } catch (_) {}
  }

  const inMem = memoryStore.registrations.find(r => r.id === id);
  if (inMem) {
    if (data.full_name !== undefined) inMem.full_name = data.full_name;
    if (data.mobile_number !== undefined) inMem.mobile_number = data.mobile_number;
    if (data.university_email !== undefined) inMem.university_email = data.university_email;
    if (data.university_email_note !== undefined) inMem.university_email_note = data.university_email_note;
    if (data.personal_email !== undefined) inMem.personal_email = data.personal_email;
    if (data.personal_email_note !== undefined) inMem.personal_email_note = data.personal_email_note;
    if (data.academic_level !== undefined) inMem.academic_level = data.academic_level;
    if (data.student_id !== undefined) inMem.student_id = data.student_id;
    if (data.status !== undefined) inMem.status = data.status;
    return inMem;
  }

  return null;
}

export async function updateRegistrationStatus(id: number, status: string): Promise<void> {
  if (canUseSupabase()) {
    try {
      const { error } = await supabase!.from('registrations').update({ status }).eq('id', id);
      if (!error) {
        recordSupabaseSuccess();
        return;
      }
      recordSupabaseFailure();
    } catch (_) {
      recordSupabaseFailure();
    }
  }

  const sdb = getSqliteDb();
  if (sdb) {
    try {
      sdb.prepare('UPDATE registrations SET status = ? WHERE id = ?').run(status, id);
      return;
    } catch (_) {}
  }

  const inMem = memoryStore.registrations.find(r => r.id === id);
  if (inMem) {
    inMem.status = status as any;
  }
}

export interface RegistrationQueryOptions {
  search?: string;
  status?: string;
  academic_level?: string;
  sort?: string;
  page?: number;
  limit?: number;
}

export async function getRegistrations(options: RegistrationQueryOptions): Promise<{
  records: RegistrationRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  stats: { total: number; new: number; reviewed: number; approved: number; rejected: number };
}> {
  const page = Math.max(1, options.page || 1);
  const limit = Math.min(100, Math.max(10, options.limit || 25));
  const offset = (page - 1) * limit;

  if (canUseSupabase()) {
    try {
      let query = supabase!.from('registrations').select('*', { count: 'exact' });

      if (options.status && options.status !== 'all') {
        query = query.eq('status', options.status);
      }
      if (options.academic_level && options.academic_level !== 'all') {
        query = query.eq('academic_level', options.academic_level);
      }
      if (options.search && options.search.trim()) {
        const s = options.search.trim();
        query = query.or(`full_name.ilike.%${s}%,university_email.ilike.%${s}%,personal_email.ilike.%${s}%,mobile_number.ilike.%${s}%,registration_code.ilike.%${s}%,student_id.ilike.%${s}%`);
      }

      if (options.sort === 'oldest') {
        query = query.order('created_at', { ascending: true });
      } else if (options.sort === 'name') {
        query = query.order('full_name', { ascending: true });
      } else {
        query = query.order('created_at', { ascending: false });
      }

      const { data, count, error } = await query.range(offset, offset + limit - 1);

      if (!error && data) {
        const [tCount, nCount, revCount, appCount, rejCount] = await Promise.all([
          supabase!.from('registrations').select('id', { count: 'exact', head: true }),
          supabase!.from('registrations').select('id', { count: 'exact', head: true }).eq('status', 'new'),
          supabase!.from('registrations').select('id', { count: 'exact', head: true }).eq('status', 'reviewed'),
          supabase!.from('registrations').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
          supabase!.from('registrations').select('id', { count: 'exact', head: true }).eq('status', 'rejected'),
        ]);

        recordSupabaseSuccess();
        const total = count ?? 0;
        return {
          records: data as RegistrationRecord[],
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1,
          stats: {
            total: tCount.count ?? 0,
            new: nCount.count ?? 0,
            reviewed: revCount.count ?? 0,
            approved: appCount.count ?? 0,
            rejected: rejCount.count ?? 0,
          },
        };
      }
      recordSupabaseFailure();
    } catch (err) {
      recordSupabaseFailure();
      console.warn('[getRegistrations] Supabase error, falling back to SQLite:', err);
    }
  }

  const sdb = getSqliteDb();
  if (sdb) {
    try {
      let whereClauses: string[] = ['1=1'];
      let params: any[] = [];

      if (options.status && options.status !== 'all') {
        whereClauses.push('status = ?');
        params.push(options.status);
      }
      if (options.academic_level && options.academic_level !== 'all') {
        whereClauses.push('academic_level = ?');
        params.push(options.academic_level);
      }
      if (options.search && options.search.trim()) {
        const q = `%${options.search.trim()}%`;
        whereClauses.push(`(
          full_name LIKE ? OR 
          university_email LIKE ? OR 
          personal_email LIKE ? OR 
          mobile_number LIKE ? OR 
          registration_code LIKE ? OR 
          student_id LIKE ?
        )`);
        params.push(q, q, q, q, q, q);
      }

      const where = whereClauses.join(' AND ');
      let orderBy = 'created_at DESC';
      if (options.sort === 'oldest') orderBy = 'created_at ASC';
      else if (options.sort === 'name') orderBy = 'full_name ASC';

      const countRes = sdb.prepare(`SELECT COUNT(*) as total FROM registrations WHERE ${where}`).get(...params) as { total: number };
      const total = countRes?.total || 0;

      const records = sdb.prepare(`SELECT * FROM registrations WHERE ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`).all(...params, limit, offset) as RegistrationRecord[];

      const stats = {
        total: (sdb.prepare('SELECT COUNT(*) as c FROM registrations').get() as any)?.c || 0,
        new: (sdb.prepare("SELECT COUNT(*) as c FROM registrations WHERE status = 'new'").get() as any)?.c || 0,
        reviewed: (sdb.prepare("SELECT COUNT(*) as c FROM registrations WHERE status = 'reviewed'").get() as any)?.c || 0,
        approved: (sdb.prepare("SELECT COUNT(*) as c FROM registrations WHERE status = 'approved'").get() as any)?.c || 0,
        rejected: (sdb.prepare("SELECT COUNT(*) as c FROM registrations WHERE status = 'rejected'").get() as any)?.c || 0,
      };

      return {
        records,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
        stats,
      };
    } catch (sqlErr) {
      console.warn('[getRegistrations] SQLite error, falling back to memory store:', sqlErr);
    }
  }

  // Memory fallback query
  let filtered = [...memoryStore.registrations];
  if (options.status && options.status !== 'all') {
    filtered = filtered.filter(r => r.status === options.status);
  }
  if (options.academic_level && options.academic_level !== 'all') {
    filtered = filtered.filter(r => r.academic_level === options.academic_level);
  }
  if (options.search && options.search.trim()) {
    const s = options.search.trim().toLowerCase();
    filtered = filtered.filter(r =>
      r.full_name.toLowerCase().includes(s) ||
      r.university_email.toLowerCase().includes(s) ||
      r.personal_email.toLowerCase().includes(s) ||
      r.mobile_number.toLowerCase().includes(s) ||
      r.registration_code.toLowerCase().includes(s) ||
      (r.student_id && r.student_id.toLowerCase().includes(s))
    );
  }
  if (options.sort === 'oldest') {
    filtered.sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
  } else if (options.sort === 'name') {
    filtered.sort((a, b) => a.full_name.localeCompare(b.full_name));
  } else {
    filtered.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  }

  const total = filtered.length;
  const records = filtered.slice(offset, offset + limit);
  const stats = {
    total: memoryStore.registrations.length,
    new: memoryStore.registrations.filter(r => r.status === 'new').length,
    reviewed: memoryStore.registrations.filter(r => r.status === 'reviewed').length,
    approved: memoryStore.registrations.filter(r => r.status === 'approved').length,
    rejected: memoryStore.registrations.filter(r => r.status === 'rejected').length,
  };

  return {
    records,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
    stats,
  };
}

export async function getAllRegistrationsForExport(options: {
  search?: string;
  status?: string;
  academic_level?: string;
  sort?: string;
}): Promise<RegistrationRecord[]> {
  if (canUseSupabase()) {
    try {
      let query = supabase!.from('registrations').select('*');

      if (options.status && options.status !== 'all') {
        query = query.eq('status', options.status);
      }
      if (options.academic_level && options.academic_level !== 'all') {
        query = query.eq('academic_level', options.academic_level);
      }
      if (options.search && options.search.trim()) {
        const s = options.search.trim();
        query = query.or(`full_name.ilike.%${s}%,university_email.ilike.%${s}%,personal_email.ilike.%${s}%,mobile_number.ilike.%${s}%,registration_code.ilike.%${s}%,student_id.ilike.%${s}%`);
      }

      if (options.sort === 'oldest') {
        query = query.order('created_at', { ascending: true });
      } else if (options.sort === 'name') {
        query = query.order('full_name', { ascending: true });
      } else {
        query = query.order('created_at', { ascending: false });
      }

      const { data, error } = await query;
      if (!error && data) {
        recordSupabaseSuccess();
        return data as RegistrationRecord[];
      }
      recordSupabaseFailure();
    } catch (_) {
      recordSupabaseFailure();
    }
  }

  const sdb = getSqliteDb();
  if (sdb) {
    try {
      let whereClauses: string[] = ['1=1'];
      let params: any[] = [];

      if (options.status && options.status !== 'all') {
        whereClauses.push('status = ?');
        params.push(options.status);
      }
      if (options.academic_level && options.academic_level !== 'all') {
        whereClauses.push('academic_level = ?');
        params.push(options.academic_level);
      }
      if (options.search && options.search.trim()) {
        const q = `%${options.search.trim()}%`;
        whereClauses.push(`(
          full_name LIKE ? OR 
          university_email LIKE ? OR 
          personal_email LIKE ? OR 
          mobile_number LIKE ? OR 
          registration_code LIKE ? OR 
          student_id LIKE ?
        )`);
        params.push(q, q, q, q, q, q);
      }

      const where = whereClauses.join(' AND ');
      let orderBy = 'created_at DESC';
      if (options.sort === 'oldest') orderBy = 'created_at ASC';
      else if (options.sort === 'name') orderBy = 'full_name ASC';

      return sdb.prepare(`SELECT * FROM registrations WHERE ${where} ORDER BY ${orderBy}`).all(...params) as RegistrationRecord[];
    } catch (_) {}
  }

  // Memory fallback export
  let filtered = [...memoryStore.registrations];
  if (options.status && options.status !== 'all') {
    filtered = filtered.filter(r => r.status === options.status);
  }
  if (options.academic_level && options.academic_level !== 'all') {
    filtered = filtered.filter(r => r.academic_level === options.academic_level);
  }
  if (options.search && options.search.trim()) {
    const s = options.search.trim().toLowerCase();
    filtered = filtered.filter(r =>
      r.full_name.toLowerCase().includes(s) ||
      r.university_email.toLowerCase().includes(s) ||
      r.personal_email.toLowerCase().includes(s) ||
      r.mobile_number.toLowerCase().includes(s) ||
      r.registration_code.toLowerCase().includes(s) ||
      (r.student_id && r.student_id.toLowerCase().includes(s))
    );
  }
  if (options.sort === 'oldest') {
    filtered.sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
  } else if (options.sort === 'name') {
    filtered.sort((a, b) => a.full_name.localeCompare(b.full_name));
  } else {
    filtered.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  }
  return filtered;
}
