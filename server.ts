import express from 'express';
import path from 'node:path';
import crypto from 'node:crypto';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import * as XLSX from 'xlsx';
import { createServer as createViteServer } from 'vite';
import {
  initDatabase,
  getSettings,
  updateSettings,
  findAdminByEmail,
  findAdminById,
  updateAdminPassword,
  createSession,
  getSession,
  deleteSession,
  findRegistrationByUniversityEmail,
  findDuplicateEmailExcept,
  generateRegistrationCode,
  createRegistration,
  getRegistrationById,
  updateRegistration,
  updateRegistrationStatus,
  getRegistrations,
  getAllRegistrationsForExport,
  type RegistrationRecord,
  type AppSettings,
} from './server/db.ts';

// Initialize the database tables and seed
initDatabase().catch((err) => console.warn('Database initialization note:', err));

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
async function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
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
    const session = await getSession(token);
    if (!session) {
      res.status(401).json({ error: 'تکایە سەرەتا بچۆ ژوورەوە.' });
      return;
    }

    const admin = await findAdminById(session.admin_id);
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
app.get('/api/settings', async (req, res) => {
  try {
    const settings = await getSettings();
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
app.post('/api/register', async (req, res) => {
  try {
    // 1. Check if registration is open
    const settings = await getSettings();
    if (!settings || settings.is_registration_open !== 1) {
      res.status(403).json({ error: 'تۆمارکردن بۆ ئێستا داخراوە.' });
      return;
    }

    let full_name = req.body.full_name || req.body.fullName || '';
    let mobile_number = req.body.mobile_number || req.body.mobileNumber || '';
    let university_email = req.body.university_email || req.body.universityEmail || '';
    let university_email_note = req.body.university_email_note || req.body.universityEmailNote || null;
    let personal_email = req.body.personal_email || req.body.personalEmail || '';
    let personal_email_note = req.body.personal_email_note || req.body.personalEmailNote || null;
    let academic_level = req.body.academic_level || req.body.academicLevel || 'قۆناغی سێیەم';
    let student_id = req.body.student_id || req.body.studentId || null;

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

    // Mobile validation: accepts 07XXXXXXXXX (11 digits), or +9647XXXXXXXXX
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
    const existing = await findRegistrationByUniversityEmail(university_email);
    if (existing) {
      res.status(409).json({ error: 'ئەم ئیمەیڵە پێشتر تۆمار کراوە.', field: 'university_email' });
      return;
    }

    // 4. Generate unique reference code
    const registrationCode = await generateRegistrationCode();

    // 5. Insert record
    const newRecord = await createRegistration({
      registration_code: registrationCode,
      full_name,
      mobile_number: cleanedMobile,
      university_email,
      university_email_note,
      personal_email,
      personal_email_note,
      academic_level,
      student_id,
    });

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

app.post('/api/admin/login', async (req, res) => {
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
    const admin = await findAdminByEmail(email.trim());

    if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
      recordFailedLogin(clientIp);
      res.status(401).json({ error: 'ئیمەیل یان وشەی نهێنی هەڵەیە.' });
      return;
    }

    resetFailedLogin(clientIp);

    // Create session token (expires in 7 days)
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;

    await createSession(token, admin.id, expiresAt);

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

app.post('/api/admin/logout', requireAdmin, async (req, res) => {
  try {
    const token = req.cookies?.admin_token || (req.headers.authorization?.startsWith('Bearer ') && req.headers.authorization.substring(7));
    if (token) {
      await deleteSession(token);
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
app.post('/api/admin/change-password', requireAdmin, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const admin = (req as any).admin;

  if (!newPassword || newPassword.length < 6) {
    res.status(400).json({ error: 'وشەی نهێنی نوێ پێویستە بەلایەنی کەم ٦ پیت یان ژمارە بێت.' });
    return;
  }

  try {
    const freshAdmin = await findAdminById(admin.id);
    if (!freshAdmin || !bcrypt.compareSync(currentPassword, freshAdmin.password_hash)) {
      res.status(400).json({ error: 'وشەی نهێنی ئێستا هەڵەیە.' });
      return;
    }

    const newHash = bcrypt.hashSync(newPassword, 10);
    await updateAdminPassword(admin.id, newHash);
    res.json({ success: true, message: 'وشەی نهێنی بە سەرکەوتوویی گۆڕدرا.' });
  } catch (err) {
    res.status(500).json({ error: 'هەڵە لە نوێکردنەوەی وشەی نهێنی.' });
  }
});

// ==========================================
// ADMIN DASHBOARD & REGISTRATION MANAGEMENT
// ==========================================

// Get paginated registrations + summary counts
app.get('/api/admin/registrations', requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 25;
    const sort = (req.query.sort as string) || 'newest';
    const search = (req.query.search as string) || '';
    const status = (req.query.status as string) || '';
    const academic_level = (req.query.academic_level as string) || '';

    const result = await getRegistrations({
      page,
      limit,
      sort,
      search,
      status,
      academic_level,
    });

    res.json(result);
  } catch (err) {
    console.error('Error fetching registrations:', err);
    res.status(500).json({ error: 'هەڵە لە هێنانی تۆمارەکان.' });
  }
});

// View single registration
app.get('/api/admin/registrations/:id', requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const record = await getRegistrationById(id);
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
app.put('/api/admin/registrations/:id', requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    let { full_name, mobile_number, university_email, university_email_note, personal_email, personal_email_note, academic_level, student_id, status } = req.body;

    const existing = await getRegistrationById(id);
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
    const emailConflict = await findDuplicateEmailExcept(university_email, id);
    if (emailConflict) {
      res.status(409).json({ error: 'ئەم ئیمەیڵە بۆ قوتابییەکی تر تۆمارکراوە.' });
      return;
    }

    const updated = await updateRegistration(id, {
      full_name,
      mobile_number,
      university_email,
      university_email_note,
      personal_email,
      personal_email_note,
      academic_level,
      student_id,
      status,
    });

    res.json({ success: true, message: 'تۆمارەکە بە سەرکەوتوویی نوێکرایەوە.', record: updated });
  } catch (err) {
    console.error('Error updating registration:', err);
    res.status(500).json({ error: 'هەڵە لە نوێکردنەوەی تۆمار.' });
  }
});

// Fast update status only
app.patch('/api/admin/registrations/:id/status', requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { status } = req.body;

    if (!['new', 'reviewed', 'approved', 'rejected'].includes(status)) {
      res.status(400).json({ error: 'باری هەڵبژێردراو دروست نییە.' });
      return;
    }

    await updateRegistrationStatus(id, status);
    res.json({ success: true, status });
  } catch (err) {
    res.status(500).json({ error: 'هەڵە لە گۆڕینی بار.' });
  }
});

// Update system settings (Open/Close, Active level, Title, Instructions)
app.put('/api/admin/settings', requireAdmin, async (req, res) => {
  try {
    const { isRegistrationOpen, academicLevel, registrationTitle, instructionText } = req.body;

    await updateSettings({
      is_registration_open: isRegistrationOpen ? 1 : 0,
      academic_level: academicLevel || 'قۆناغی سێیەم',
      registration_title: registrationTitle || 'خۆتۆمارکردنی قوتابیان بۆ سمستەری سێیەم',
      instruction_text: instructionText || 'تکایە زانیارییەکان بە وردی و دروستی پڕبکەرەوە، پاشان فۆرمەکە بنێرە.',
    });

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
app.get('/api/admin/export/excel', requireAdmin, async (req, res) => {
  try {
    const records = await getAllRegistrationsForExport({
      search: req.query.search as string,
      status: req.query.status as string,
      academic_level: req.query.academic_level as string,
      sort: (req.query.sort as string) || 'newest',
    });

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
app.get('/api/admin/export/csv', requireAdmin, async (req, res) => {
  try {
    const records = await getAllRegistrationsForExport({
      search: req.query.search as string,
      status: req.query.status as string,
      academic_level: req.query.academic_level as string,
      sort: (req.query.sort as string) || 'newest',
    });

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

// Only listen directly if not running in a serverless environment like Vercel
if (!process.env.VERCEL) {
  start();
}

export default app;
