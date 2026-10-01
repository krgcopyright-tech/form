import React from 'react';
import { UserCheck, LogOut } from 'lucide-react';

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
          
          {/* Institution Identity & Logo */}
          <div className="flex items-center gap-4 text-right">
            <div
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white p-1.5 shadow-md border-2 border-amber-400/40 flex items-center justify-center shrink-0 hover:scale-105 transition-transform"
              title="لۆگۆی فەرمی زانکۆی پۆلیتەکنیکی هەولێر"
            >
              <img
                src="/epu-logo.png"
                alt="لۆگۆی فەرمی زانکۆی پۆلیتەکنیکی هەولێر (EPU)"
                className="w-full h-full object-contain"
              />
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

          {/* Navigation Controls (Only shown if navigating admin mode via #admin) */}
          {currentView === 'admin' && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => onNavigate('student')}
                className="px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium bg-amber-500 text-slate-950 font-bold shadow flex items-center gap-1.5 transition-all hover:bg-amber-400"
              >
                <UserCheck className="w-4 h-4" />
                <span>گەڕانەوە بۆ فۆڕمی قوتابیان</span>
              </button>

              {adminEmail && onLogout && (
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
          )}

        </div>
      </div>
    </header>
  );
};
