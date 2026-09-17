import express from 'express';
import path from 'node:path';
import crypto from 'node:crypto';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import * as XLSX from 'xlsx';
import { createServer as createViteServer } from 'vite';
import {
  db,
  initDatabase,
  generateRegistrationCode,
  type RegistrationRecord,
  type AppSettings,
} from './server/db.ts';

// Initialize the database tables and seed
initDatabase();

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(cookieParser());

// Simple in-memory rate limiter for login
const loginAttempts = new Map<string, { count: number; lockedUntil: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry) return true;
  if (entry.lockedUntil > now) return false;
  if (now > entry.lockedUntil) {
    loginAttempts.delete(ip);
    return true;
  }
  return entry.count < 5;
}

function recordFailedLogin(ip: string) {
  const now = Date.now();
  const entry = loginAttempts.get(ip) || { count: 0, lockedUntil: 0 };
  entry.count += 1;
  if (entry.count >= 5) {
    entry.lockedUntil = now + 15 * 60 * 1000; // lock for 15 minutes
  }
  loginAttempts.set(ip, entry);
}

function resetFailedLogin(ip: string) {
  loginAttempts.delete(ip);
}

// Authentication middleware
function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  let token = req.cookies?.admin_token;
  if (!token && authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }
  if (!token && typeof req.query?.token === 'string') {
    token = req.query.token;
  }

  if (!token) {
    res.status(401).json({ error: 'تکایە سەرەتا بچۆ ژوورەوە.' });
    return;
  }

  try {
    const session = db
      .prepare('SELECT * FROM sessions WHERE token = ? AND expires_at > ?')
      .get(token, Date.now()) as { token: string; admin_id: number; expires_at: number } | undefined;

    if (!session) {
      res.status(401).json({ error: 'تکایە سەرەتا بچۆ ژوورەوە.' });
      return;
    }

    const admin = db.prepare('SELECT id, email FROM admins WHERE id = ?').get(session.admin_id) as { id: number; email: string } | undefined;
    if (!admin) {
      res.status(401).json({ error: 'بەکارهێنەر نەدۆزرایەوە.' });
      return;
    }

    (req as any).admin = admin;
    next();
  } catch (err) {
    console.error('Auth verification error:', err);
    res.status(500).json({ error: 'هەڵەیەک ڕوویدا لە پشتڕاستکردنەوەدا.' });
  }
}

// ==========================================
// PUBLIC API ENDPOINTS
// ==========================================

// Get current public settings
app.get('/api/settings', (req, res) => {
  try {
    const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get() as unknown as AppSettings;
    res.json({
      isRegistrationOpen: Boolean(settings.is_registration_open),
      academicLevel: settings.academic_level,
      registrationTitle: settings.registration_title,
      instructionText: settings.instruction_text,
    });
  } catch (err) {
    console.error('Error fetching settings:', err);
    res.status(500).json({ error: 'هەڵە لە وەرگرتنی ڕێکخستنەکان.' });
  }
});

// Student registration submission
app.post('/api/register', (req, res) => {
  try {
    // 1. Check if registration is open
    const settings = db.prepare('SELECT is_registration_open FROM settings WHERE id = 1').get() as { is_registration_open: number };
    if (!settings || settings.is_registration_open !== 1) {
      res.status(403).json({ error: 'تۆمارکردن بۆ ئێستا داخراوە.' });
      return;
    }

    let { full_name, mobile_number, university_email, university_email_note, personal_email, personal_email_note, academic_level, student_id } = req.body;

    // Sanitize and trim
    full_name = typeof full_name === 'string' ? full_name.trim() : '';
    mobile_number = typeof mobile_number === 'string' ? mobile_number.trim() : '';
    university_email = typeof university_email === 'string' ? university_email.trim().toLowerCase() : '';
    university_email_note = typeof university_email_note === 'string' ? university_email_note.trim() : null;
    personal_email = typeof personal_email === 'string' ? personal_email.trim().toLowerCase() : '';
    personal_email_note = typeof personal_email_note === 'string' ? personal_email_note.trim() : null;
    academic_level = typeof academic_level === 'string' ? academic_level.trim() : 'قۆناغی سێیەم';
    student_id = typeof student_id === 'string' ? student_id.trim() : null;

    // 2. Field Validation
    if (!full_name || full_name.length < 3) {
      res.status(400).json({ error: 'تکایە ناوی سیانی خۆت بە دروستی بنووسە.', field: 'full_name' });
      return;
    }

    // Iraqi mobile regex: accepts 07XXXXXXXXX (11 digits), or +9647XXXXXXXXX
    const cleanedMobile = mobile_number.replace(/[\s\-\(\)]/g, '');
    const mobileRegex = /^(07[3-9]\d{8}|07\d{9}|\+?9647\d{9})$/;
    if (!mobileRegex.test(cleanedMobile)) {
      res.status(400).json({ error: 'تکایە ژمارەی مۆبایل بە شێوەیەکی دروست بنووسە.', field: 'mobile_number' });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(university_email)) {
      res.status(400).json({ error: 'تکایە ئیمەیڵێکی دروست بنووسە.', field: 'university_email' });
      return;
    }

    if (!emailRegex.test(personal_email)) {
      res.status(400).json({ error: 'تکایە ئیمەیڵێکی دروست بنووسە.', field: 'personal_email' });
      return;
    }

    if (!academic_level) {
      res.status(400).json({ error: 'تکایە قۆناغ هەڵبژێرە.', field: 'academic_level' });
      return;
    }

    // 3. Duplicate check on university email
    const existing = db
      .prepare('SELECT id FROM registrations WHERE LOWER(university_email) = LOWER(?)')
      .get(university_email);

    if (existing) {
      res.status(409).json({ error: 'ئەم ئیمەیڵە پێشتر تۆمار کراوە.', field: 'university_email' });
      return;
    }

    // 4. Generate unique reference code
    const registrationCode = generateRegistrationCode();

    // 5. Insert record
    const insertStmt = db.prepare(`
      INSERT INTO registrations (
        registration_code, full_name, mobile_number, university_email, university_email_note, personal_email, personal_email_note, academic_level, student_id, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', datetime('now', 'localtime'))
    `);

    const result = insertStmt.run(
      registrationCode,
      full_name,
      cleanedMobile,
      university_email,
      university_email_note || null,
      personal_email,
      personal_email_note || null,
      academic_level,
      student_id || null
    );

    const newRecord = db.prepare('SELECT * FROM registrations WHERE id = ?').get(result.lastInsertRowid) as unknown as RegistrationRecord;

    res.status(201).json({
      success: true,
      message: 'فۆرمەکەت بە سەرکەوتوویی نێردرا.',
      registrationCode,
      registration: newRecord,
    });
  } catch (err) {
    console.error('Registration submission error:', err);
    res.status(500).json({ error: 'هەڵەیەک لە سێرڤەر ڕوویدا، تکایە دووبارە هەوڵبدەرەوە.' });
  }
});

// ==========================================
// ADMIN AUTHENTICATION
// ==========================================

app.post('/api/admin/login', (req, res) => {
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
  if (!checkRateLimit(clientIp)) {
    res.status(429).json({ error: 'هەوڵی زۆر دراوە. تکایە دوای ١٥ خولەک هەوڵبدەرەوە.' });
    return;
  }

  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: 'تکایە ئیمەیل و وشەی نهێنی بنووسە.' });
    return;
  }

  try {
    const admin = db.prepare('SELECT * FROM admins WHERE LOWER(email) = LOWER(?)').get(email.trim()) as { id: number; email: string; password_hash: string } | undefined;

    if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
      recordFailedLogin(clientIp);
      res.status(401).json({ error: 'ئیمەیل یان وشەی نهێنی هەڵەیە.' });
      return;
    }

    resetFailedLogin(clientIp);

    // Create session token (expires in 7 days)
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;

    db.prepare('INSERT INTO sessions (token, admin_id, expires_at) VALUES (?, ?, ?)').run(token, admin.id, expiresAt);

    // Set cookie (support both modern browsers and iframe embedding)
    res.cookie('admin_token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      success: true,
      token,
      email: admin.email,
    });
  } catch (err) {
    console.error('Admin login error:', err);
    res.status(500).json({ error: 'هەڵەی سێرڤەر لە چوونەژوورەوە.' });
  }
});

app.post('/api/admin/logout', requireAdmin, (req, res) => {
  try {
    const token = req.cookies?.admin_token || (req.headers.authorization?.startsWith('Bearer ') && req.headers.authorization.substring(7));
    if (token) {
      db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    }
    res.clearCookie('admin_token');
    res.json({ success: true, message: 'بە سەرکەوتوویی دەرچوویت.' });
  } catch (err) {
    res.status(500).json({ error: 'هەڵە لە دەرچوون.' });
  }
});

app.get('/api/admin/me', requireAdmin, (req, res) => {
  const admin = (req as any).admin;
  res.json({ authenticated: true, email: admin.email });
});

// Change admin password
app.post('/api/admin/change-password', requireAdmin, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const admin = (req as any).admin;

  if (!newPassword || newPassword.length < 6) {
    res.status(400).json({ error: 'وشەی نهێنی نوێ پێویستە بەلایەنی کەم ٦ پیت یان ژمارە بێت.' });
    return;
  }

  try {
    const row = db.prepare('SELECT password_hash FROM admins WHERE id = ?').get(admin.id) as { password_hash: string };
    if (!bcrypt.compareSync(currentPassword, row.password_hash)) {
      res.status(400).json({ error: 'وشەی نهێنی ئێستا هەڵەیە.' });
      return;
    }

    const newHash = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE admins SET password_hash = ? WHERE id = ?').run(newHash, admin.id);
    res.json({ success: true, message: 'وشەی نهێنی بە سەرکەوتوویی گۆڕدرا.' });
  } catch (err) {
    res.status(500).json({ error: 'هەڵە لە نوێکردنەوەی وشەی نهێنی.' });
  }
});

// ==========================================
// ADMIN DASHBOARD & REGISTRATION MANAGEMENT
// ==========================================

// Helper to build filter queries
function buildFilterQuery(queryParams: any) {
  const { search, status, academic_level } = queryParams;
  let whereClauses: string[] = ['1=1'];
  let params: any[] = [];

  if (status && status !== 'all') {
    whereClauses.push('status = ?');
    params.push(status);
  }

  if (academic_level && academic_level !== 'all') {
    whereClauses.push('academic_level = ?');
    params.push(academic_level);
  }

  if (search && search.trim()) {
    const q = `%${search.trim()}%`;
    whereClauses.push(`(
      full_name LIKE ? OR 
      university_email LIKE ? OR 
      university_email_note LIKE ? OR 
      personal_email LIKE ? OR 
      personal_email_note LIKE ? OR 
      mobile_number LIKE ? OR 
      registration_code LIKE ? OR 
      student_id LIKE ?
    )`);
    params.push(q, q, q, q, q, q, q, q);
  }

  return { where: whereClauses.join(' AND '), params };
}

// Get paginated registrations + summary counts
app.get('/api/admin/registrations', requireAdmin, (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(10, parseInt(req.query.limit as string) || 25));
    const offset = (page - 1) * limit;
    const sort = (req.query.sort as string) || 'newest';

    const { where, params } = buildFilterQuery(req.query);

    let orderBy = 'created_at DESC';
    if (sort === 'oldest') {
      orderBy = 'created_at ASC';
    } else if (sort === 'name') {
      orderBy = 'full_name ASC';
    }

    // Count filtered records
    const countSql = `SELECT COUNT(*) as total FROM registrations WHERE ${where}`;
    const countRes = db.prepare(countSql).get(...params) as { total: number };
    const total = countRes.total;

    // Fetch records
    const listSql = `SELECT * FROM registrations WHERE ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`;
    const records = db.prepare(listSql).all(...params, limit, offset) as unknown as RegistrationRecord[];

    // Calculate overall stats
    const stats = {
      total: (db.prepare('SELECT COUNT(*) as c FROM registrations').get() as any).c,
      new: (db.prepare("SELECT COUNT(*) as c FROM registrations WHERE status = 'new'").get() as any).c,
      reviewed: (db.prepare("SELECT COUNT(*) as c FROM registrations WHERE status = 'reviewed'").get() as any).c,
      approved: (db.prepare("SELECT COUNT(*) as c FROM registrations WHERE status = 'approved'").get() as any).c,
      rejected: (db.prepare("SELECT COUNT(*) as c FROM registrations WHERE status = 'rejected'").get() as any).c,
    };

    res.json({
      records,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      stats,
    });
  } catch (err) {
    console.error('Error fetching registrations:', err);
    res.status(500).json({ error: 'هەڵە لە هێنانی تۆمارەکان.' });
  }
});

// View single registration
app.get('/api/admin/registrations/:id', requireAdmin, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const record = db.prepare('SELECT * FROM registrations WHERE id = ?').get(id) as unknown as RegistrationRecord | undefined;
    if (!record) {
      res.status(404).json({ error: 'تۆمارەکە نەدۆزرایەوە.' });
      return;
    }
    res.json(record);
  } catch (err) {
    res.status(500).json({ error: 'هەڵە لە هێنانی زانیاریی تۆمار.' });
  }
});

// Update registration details
app.put('/api/admin/registrations/:id', requireAdmin, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    let { full_name, mobile_number, university_email, university_email_note, personal_email, personal_email_note, academic_level, student_id, status } = req.body;

    const existing = db.prepare('SELECT * FROM registrations WHERE id = ?').get(id) as unknown as RegistrationRecord | undefined;
    if (!existing) {
      res.status(404).json({ error: 'تۆمارەکە نەدۆزرایەوە.' });
      return;
    }

    full_name = full_name?.trim() || existing.full_name;
    mobile_number = mobile_number?.trim() || existing.mobile_number;
    university_email = university_email?.trim().toLowerCase() || existing.university_email;
    university_email_note = university_email_note !== undefined ? (university_email_note ? university_email_note.trim() : null) : existing.university_email_note;
    personal_email = personal_email?.trim().toLowerCase() || existing.personal_email;
    personal_email_note = personal_email_note !== undefined ? (personal_email_note ? personal_email_note.trim() : null) : existing.personal_email_note;
    academic_level = academic_level?.trim() || existing.academic_level;
    student_id = student_id !== undefined ? (student_id ? student_id.trim() : null) : existing.student_id;
    status = ['new', 'reviewed', 'approved', 'rejected'].includes(status) ? status : existing.status;

    // Check duplicate email with another record
    const emailConflict = db
      .prepare('SELECT id FROM registrations WHERE LOWER(university_email) = LOWER(?) AND id != ?')
      .get(university_email, id);

    if (emailConflict) {
      res.status(409).json({ error: 'ئەم ئیمەیڵە بۆ قوتابییەکی تر تۆمارکراوە.' });
      return;
    }

    db.prepare(`
      UPDATE registrations SET
        full_name = ?,
        mobile_number = ?,
        university_email = ?,
        university_email_note = ?,
        personal_email = ?,
        personal_email_note = ?,
        academic_level = ?,
        student_id = ?,
        status = ?
      WHERE id = ?
    `).run(full_name, mobile_number, university_email, university_email_note, personal_email, personal_email_note, academic_level, student_id, status, id);

    const updated = db.prepare('SELECT * FROM registrations WHERE id = ?').get(id);
    res.json({ success: true, message: 'تۆمارەکە بە سەرکەوتوویی نوێکرایەوە.', record: updated });
  } catch (err) {
    console.error('Error updating registration:', err);
    res.status(500).json({ error: 'هەڵە لە نوێکردنەوەی تۆمار.' });
  }
});

// Fast update status only
app.patch('/api/admin/registrations/:id/status', requireAdmin, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { status } = req.body;

    if (!['new', 'reviewed', 'approved', 'rejected'].includes(status)) {
      res.status(400).json({ error: 'باری هەڵبژێردراو دروست نییە.' });
      return;
    }

    db.prepare('UPDATE registrations SET status = ? WHERE id = ?').run(status, id);
    res.json({ success: true, status });
  } catch (err) {
    res.status(500).json({ error: 'هەڵە لە گۆڕینی بار.' });
  }
});

// Update system settings (Open/Close, Active level, Title, Instructions)
app.put('/api/admin/settings', requireAdmin, (req, res) => {
  try {
    const { isRegistrationOpen, academicLevel, registrationTitle, instructionText } = req.body;

    db.prepare(`
      UPDATE settings SET
        is_registration_open = ?,
        academic_level = ?,
        registration_title = ?,
        instruction_text = ?
      WHERE id = 1
    `).run(
      isRegistrationOpen ? 1 : 0,
      academicLevel || 'قۆناغی سێیەم',
      registrationTitle || 'خۆتۆمارکردنی قوتابیان بۆ سمستەری سێیەم',
      instructionText || 'تکایە زانیارییەکان بە وردی و دروستی پڕبکەرەوە، پاشان فۆرمەکە بنێرە.'
    );

    res.json({ success: true, message: 'ڕێکخستنەکان بە سەرکەوتوویی پاشەکەوتکران.' });
  } catch (err) {
    console.error('Error updating settings:', err);
    res.status(500).json({ error: 'هەڵە لە پاشەکەوتکردنی ڕێکخستنەکان.' });
  }
});

// Kurdish status label mapper
function getKurdishStatus(status: string): string {
  switch (status) {
    case 'new':
      return 'نوێ';
    case 'reviewed':
      return 'پشکنراو';
    case 'approved':
      return 'پەسەندکراو';
    case 'rejected':
      return 'ڕەتکراو';
    default:
      return status;
  }
}

// Export to Excel (.xlsx) preserving Kurdish Sorani characters
app.get('/api/admin/export/excel', requireAdmin, (req, res) => {
  try {
    const { where, params } = buildFilterQuery(req.query);
    const sort = (req.query.sort as string) || 'newest';
    let orderBy = 'created_at DESC';
    if (sort === 'oldest') orderBy = 'created_at ASC';
    else if (sort === 'name') orderBy = 'full_name ASC';

    const records = db.prepare(`SELECT * FROM registrations WHERE ${where} ORDER BY ${orderBy}`).all(...params) as unknown as RegistrationRecord[];

    const excelData = records.map((r, index) => ({
      'زنجیرە': index + 1,
      'کۆدی تۆمارکردن': r.registration_code,
      'ناوی سیانی': r.full_name,
      'ژمارەی مۆبایل': r.mobile_number,
      'ئیمەیلی زانکۆ': r.university_email,
      'تێبینیی ئیمەیلی زانکۆ': r.university_email_note || '-',
      'ئیمەیلی تایبەتی': r.personal_email,
      'تێبینیی ئیمەیلی تایبەتی': r.personal_email_note || '-',
      'قۆناغ': r.academic_level,
      'ژمارەی قوتابی': r.student_id || '-',
      'بار': getKurdishStatus(r.status),
      'بەروار': r.created_at,
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    // RTL sheet view setting
    if (!worksheet['!views']) {
      worksheet['!views'] = [{ rightToLeft: true }];
    }
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'قوتابیانی تۆمارکراو');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="EPU_MIS_Registrations_${new Date().toISOString().slice(0, 10)}.xlsx"`);
    res.send(buffer);
  } catch (err) {
    console.error('Excel export error:', err);
    res.status(500).json({ error: 'هەڵە لە دروستکردنی فایلی ئێکزڵ.' });
  }
});

// Export to CSV with UTF-8 BOM so Excel opens Kurdish characters correctly
app.get('/api/admin/export/csv', requireAdmin, (req, res) => {
  try {
    const { where, params } = buildFilterQuery(req.query);
    const sort = (req.query.sort as string) || 'newest';
    let orderBy = 'created_at DESC';
    if (sort === 'oldest') orderBy = 'created_at ASC';
    else if (sort === 'name') orderBy = 'full_name ASC';

    const records = db.prepare(`SELECT * FROM registrations WHERE ${where} ORDER BY ${orderBy}`).all(...params) as unknown as RegistrationRecord[];

    const headers = ['زنجیرە', 'کۆدی تۆمارکردن', 'ناوی سیانی', 'ژمارەی مۆبایل', 'ئیمەیلی زانکۆ', 'تێبینیی ئیمەیلی زانکۆ', 'ئیمەیلی تایبەتی', 'تێبینیی ئیمەیلی تایبەتی', 'قۆناغ', 'ژمارەی قوتابی', 'بار', 'بەروار'];
    const rows = records.map((r, i) => [
      i + 1,
      r.registration_code,
      `"${(r.full_name || '').replace(/"/g, '""')}"`,
      `"${r.mobile_number}"`,
      `"${r.university_email}"`,
      `"${(r.university_email_note || '').replace(/"/g, '""')}"`,
      `"${r.personal_email}"`,
      `"${(r.personal_email_note || '').replace(/"/g, '""')}"`,
      `"${r.academic_level}"`,
      `"${r.student_id || ''}"`,
      `"${getKurdishStatus(r.status)}"`,
      `"${r.created_at}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((row) => row.join(','))].join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="EPU_MIS_Registrations_${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csvContent);
  } catch (err) {
    console.error('CSV export error:', err);
    res.status(500).json({ error: 'هەڵە لە دروستکردنی فایلی CSV.' });
  }
});

// ==========================================
// VITE MIDDLEWARE / STATIC ASSETS
// ==========================================

async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[EPU MIS Registration System] Server running on http://0.0.0.0:${PORT}`);
  });
}

start();
