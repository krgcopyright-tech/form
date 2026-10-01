-- Erbil Polytechnic University - MIS Registration Database Schema for Supabase

-- 1. Registrations Table
CREATE TABLE IF NOT EXISTS public.registrations (
  id BIGSERIAL PRIMARY KEY,
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
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast searching and filtering
CREATE INDEX IF NOT EXISTS idx_reg_email ON public.registrations(university_email);
CREATE INDEX IF NOT EXISTS idx_reg_code ON public.registrations(registration_code);
CREATE INDEX IF NOT EXISTS idx_reg_status ON public.registrations(status);

-- 2. Settings Table
CREATE TABLE IF NOT EXISTS public.settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  is_registration_open INT NOT NULL DEFAULT 1,
  academic_level TEXT NOT NULL DEFAULT 'قۆناغی سێیەم',
  registration_title TEXT NOT NULL DEFAULT 'خۆتۆمارکردنی قوتابیان بۆ سمستەری سێیەم',
  instruction_text TEXT NOT NULL DEFAULT 'تکایە زانیارییەکان بە وردی و دروستی پڕبکەرەوە، پاشان فۆرمەکە بنێرە.'
);

-- Default Settings Seed
INSERT INTO public.settings (id, is_registration_open, academic_level, registration_title, instruction_text)
VALUES (1, 1, 'قۆناغی سێیەم', 'خۆتۆمارکردنی قوتابیان بۆ سمستەری سێیەم', 'تکایە زانیارییەکان بە وردی و دروستی پڕبکەرەوە، پاشان فۆرمەکە بنێرە.')
ON CONFLICT (id) DO NOTHING;

-- 3. Admins Table
CREATE TABLE IF NOT EXISTS public.admins (
  id BIGSERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default Admin Seed (email: admin@epu.edu.iq, pass: admin123456)
INSERT INTO public.admins (email, password_hash)
VALUES ('admin@epu.edu.iq', '$2b$10$DojxrvjgD1D52LfmWDrFmu8cmoBTkDf5s/2msvKUXn1c2qpMXK/mK')
ON CONFLICT (email) DO NOTHING;

-- 4. Sessions Table
CREATE TABLE IF NOT EXISTS public.sessions (
  token TEXT PRIMARY KEY,
  admin_id BIGINT NOT NULL,
  expires_at BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
DROP POLICY IF EXISTS "Service role full access on registrations" ON public.registrations;
CREATE POLICY "Service role full access on registrations" ON public.registrations FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on settings" ON public.settings;
CREATE POLICY "Service role full access on settings" ON public.settings FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on admins" ON public.admins;
CREATE POLICY "Service role full access on admins" ON public.admins FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on sessions" ON public.sessions;
CREATE POLICY "Service role full access on sessions" ON public.sessions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Allow public read access on settings
DROP POLICY IF EXISTS "Public read access on settings" ON public.settings;
CREATE POLICY "Public read access on settings" ON public.settings FOR SELECT TO anon, authenticated USING (true);
