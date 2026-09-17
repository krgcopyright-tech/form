import React from 'react';
import { Building2, ShieldCheck, UserCheck, GraduationCap, LogOut } from 'lucide-react';

interface HeaderProps {
  currentView: 'student' | 'admin';
  onNavigate: (view: 'student' | 'admin') => void;
  adminEmail?: string | null;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onNavigate,
  adminEmail,
  onLogout,
}) => {
  return (
    <header className="bg-slate-900 text-white border-b-4 border-amber-500 shadow-sm print:hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          
          {/* Institution Identity & Logo Placeholder */}
          <div className="flex items-center gap-4 text-right">
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-slate-800 to-slate-950 border border-slate-700 flex items-center justify-center text-amber-400 shrink-0 shadow-inner group cursor-pointer" title="جێگەی لۆگۆی فەرمی زانکۆ (Logo Placeholder)">
              {/* Official Crest Placeholder: can be replaced by placing logo in public/logo.png */}
              <div className="text-center flex flex-col items-center">
                <GraduationCap className="w-8 h-8 text-amber-400" />
                <span className="text-[9px] text-slate-400 font-sans tracking-wider uppercase">EPU • MIS</span>
              </div>
            </div>

            <div>
              <div className="text-sm sm:text-base font-bold text-amber-400">
                زانکۆی پۆلیتەکنیکی هەولێر
              </div>
              <div className="text-xs sm:text-sm font-semibold text-slate-200">
                پەیمانگەی تەکنیکی کارگێڕی هەولێر
              </div>
              <div className="text-xs sm:text-xs text-slate-300 font-medium">
                بەشی سیستمی زانیاری کارگێڕی (MIS)
              </div>
            </div>
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigate('student')}
              className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all flex items-center gap-1.5 ${
                currentView === 'student'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow'
                  : 'bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              <span>فۆرمی قوتابیان</span>
            </button>

            <button
              onClick={() => onNavigate('admin')}
              className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all flex items-center gap-1.5 ${
                currentView === 'admin'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow'
                  : 'bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>بەشی بەڕێوەبەر {adminEmail ? '(داخڵبوو)' : ''}</span>
            </button>

            {adminEmail && currentView === 'admin' && onLogout && (
              <button
                onClick={onLogout}
                title="دەرچوون لە ئەدمین"
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-900/40 text-red-300 hover:bg-red-800/60 hover:text-white transition flex items-center gap-1 border border-red-800/50"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">دەرچوون</span>
              </button>
            )}
          </div>

        </div>
      </div>
    </header>
  );
};
