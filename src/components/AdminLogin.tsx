import React, { useState } from 'react';
import { ShieldCheck, Mail, Lock, LogIn, AlertCircle, Info } from 'lucide-react';
import { getLocalSettings } from '../services/storageService';

interface AdminLoginProps {
  onLoginSuccess: (email: string, token: string) => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setError('تکایە ئیمەیل و وشەی نهێنی بنووسە.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: cleanEmail,
          password,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        onLoginSuccess(data.email, data.token);
        return;
      }
    } catch (err) {
      // In static / GitHub Pages mode, network request fails or returns 404
      console.log('Server not reachable, falling back to local admin check.');
    }

    // Client-side fallback check (for GitHub Pages / static mode)
    const settings = getLocalSettings();
    const validPassword = settings.adminPassword || 'admin123456';
    
    if (cleanEmail === 'admin@epu.edu.iq' && password === validPassword) {
      const clientToken = 'epu_admin_static_' + Date.now();
      localStorage.setItem('epu_admin_token', clientToken);
      localStorage.setItem('epu_admin_email', cleanEmail);
      onLoginSuccess(cleanEmail, clientToken);
    } else {
      setError('ئیمەیل یان وشەی نهێنی هەڵەیە.');
      setLoading(false);
    }
  };

  const handleFillDefaultAdmin = () => {
    setEmail('admin@epu.edu.iq');
    setPassword('admin123456');
    setError(null);
  };

  return (
    <div className="max-w-md mx-auto my-12 px-4">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 sm:p-8">
        
        {/* Shield Icon */}
        <div className="w-14 h-14 mx-auto mb-4 bg-slate-900 text-amber-400 rounded-2xl flex items-center justify-center shadow-sm">
          <ShieldCheck className="w-8 h-8" />
        </div>

        <div className="text-center mb-6">
          <h2 className="text-xl font-bold text-slate-900">
            چوونەژوورەوەی بەڕێوەبەر
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            تایبەت بە لیژنەی تۆمارکردن و بەڕێوەبەرایەتی بەش
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Email */}
          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-700">
              ئیمەیل
            </label>
            <div className="relative">
              <input
                type="email"
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@epu.edu.iq"
                disabled={loading}
                className="w-full py-2.5 px-3 pr-10 text-left font-mono text-sm rounded-xl border border-slate-300 focus:border-slate-800 focus:ring-2 focus:ring-slate-200 outline-none transition"
              />
              <div className="absolute right-3 top-3 text-slate-400 pointer-events-none">
                <Mail className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-700">
              وشەی نهێنی
            </label>
            <div className="relative">
              <input
                type="password"
                dir="ltr"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={loading}
                className="w-full py-2.5 px-3 pr-10 text-left font-mono text-sm rounded-xl border border-slate-300 focus:border-slate-800 focus:ring-2 focus:ring-slate-200 outline-none transition"
              />
              <div className="absolute right-3 top-3 text-slate-400 pointer-events-none">
                <Lock className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white font-bold text-sm transition shadow-sm flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <LogIn className="w-4 h-4 text-amber-400" />
            )}
            <span>چوونەژوورەوە</span>
          </button>
        </form>

        {/* Initial seed hint for administrators */}
        <div className="mt-6 pt-5 border-t border-slate-100 bg-slate-50 -mx-6 -mb-6 p-4 rounded-b-2xl">
          <div className="flex items-start gap-2 text-xs text-slate-600">
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-slate-800">زانیاریی سەرەتایی بۆ تاقیکردنەوە:</span>
              <div className="mt-1 font-mono text-[11px] text-slate-700 flex flex-col gap-0.5" dir="ltr">
                <span>Email: admin@epu.edu.iq</span>
                <span>Pass: admin123456</span>
              </div>
              <button
                type="button"
                onClick={handleFillDefaultAdmin}
                className="mt-2 text-[11px] font-bold text-amber-700 hover:text-amber-800 underline block"
              >
                پڕکردنەوەی خۆکارانە بۆ تاقیکردنەوە (Quick Fill)
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
