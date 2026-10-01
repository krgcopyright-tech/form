import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { StudentRegistrationForm } from './components/StudentRegistrationForm';
import { SuccessReceipt } from './components/SuccessReceipt';
import { ClosedNotice } from './components/ClosedNotice';
import { AdminLogin } from './components/AdminLogin';
import { AdminDashboard } from './components/AdminDashboard';
import type { Registration, AppSettings } from './types';
import { getLocalSettings, saveLocalSettings } from './services/storageService';

export default function App() {
  const [currentView, setCurrentView] = useState<'student' | 'admin'>(() => {
    if (typeof window !== 'undefined') {
      if (
        window.location.pathname === '/admin' ||
        window.location.pathname.endsWith('/admin') ||
        window.location.hash === '#admin'
      ) {
        return 'admin';
      }
    }
    return 'student';
  });

  const [settings, setSettings] = useState<AppSettings>(() => getLocalSettings());

  const [submittedRegistration, setSubmittedRegistration] = useState<Registration | null>(null);
  const [adminEmail, setAdminEmail] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('epu_admin_email');
    }
    return null;
  });
  const [adminToken, setAdminToken] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('epu_admin_token');
    }
    return null;
  });
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Sync route and load initial settings & session
  useEffect(() => {
    const handlePopState = () => {
      if (
        window.location.pathname === '/admin' ||
        window.location.pathname.endsWith('/admin') ||
        window.location.hash === '#admin'
      ) {
        setCurrentView('admin');
      } else {
        setCurrentView('student');
      }
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('hashchange', handlePopState);

    // Fetch settings from server if available
    fetch('/api/settings')
      .then((res) => res.json())
      .then((data) => {
        if (data && typeof data.isRegistrationOpen === 'boolean') {
          setSettings((prev) => {
            const merged = { ...prev, ...data };
            saveLocalSettings(merged);
            return merged;
          });
        }
      })
      .catch(() => {});

    // Check if admin is already logged in
    const storedToken = typeof window !== 'undefined' ? localStorage.getItem('epu_admin_token') : null;
    const storedEmail = typeof window !== 'undefined' ? localStorage.getItem('epu_admin_email') : null;

    if (storedToken && storedToken.startsWith('epu_admin_static_')) {
      setAdminToken(storedToken);
      setAdminEmail(storedEmail || 'admin@epu.edu.iq');
      setLoadingInitial(false);
      return;
    }

    if (storedToken) {
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${storedToken}`,
      };

      fetch('/api/admin/me', { headers, credentials: 'include' })
        .then((res) => {
          if (res.ok) return res.json();
          return null;
        })
        .then((data) => {
          if (data?.authenticated) {
            setAdminEmail(data.email);
          } else {
            localStorage.removeItem('epu_admin_token');
            localStorage.removeItem('epu_admin_email');
            setAdminToken(null);
            setAdminEmail(null);
          }
        })
        .catch(() => {
          // If server down but user had valid token, keep email for offline convenience
          if (storedEmail) {
            setAdminEmail(storedEmail);
          }
        })
        .finally(() => {
          setLoadingInitial(false);
        });
    } else {
      setLoadingInitial(false);
    }

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('hashchange', handlePopState);
    };
  }, []);

  const handleNavigate = (view: 'student' | 'admin') => {
    setCurrentView(view);
    if (view === 'admin') {
      window.history.pushState(null, '', '#admin');
    } else {
      window.history.pushState(null, '', window.location.pathname.replace(/#.*$/, ''));
    }
  };

  const handleLoginSuccess = (email: string, token: string) => {
    setAdminEmail(email);
    setAdminToken(token);
    if (typeof window !== 'undefined') {
      localStorage.setItem('epu_admin_token', token);
      localStorage.setItem('epu_admin_email', email);
    }
  };

  const handleLogout = async () => {
    try {
      const headers: Record<string, string> = {};
      if (adminToken) {
        headers['Authorization'] = `Bearer ${adminToken}`;
      }
      await fetch('/api/admin/logout', { method: 'POST', headers, credentials: 'include' });
    } catch (e) {
      // offline
    }
    setAdminEmail(null);
    setAdminToken(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('epu_admin_token');
      localStorage.removeItem('epu_admin_email');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-['Rabar','Noto_Sans_Arabic',sans-serif]" dir="rtl">
      
      {/* Institutional Header */}
      <Header
        currentView={currentView}
        onNavigate={handleNavigate}
        adminEmail={adminEmail}
        onLogout={handleLogout}
      />

      {/* Main Body */}
      <main className="flex-1">
        {currentView === 'student' ? (
          <div>
            {!settings.isRegistrationOpen ? (
              <ClosedNotice instruction={settings.instructionText} />
            ) : submittedRegistration ? (
              <SuccessReceipt
                registration={submittedRegistration}
                onReset={() => setSubmittedRegistration(null)}
              />
            ) : (
              <StudentRegistrationForm
                settings={settings}
                onSuccess={(reg) => setSubmittedRegistration(reg)}
              />
            )}
          </div>
        ) : (
          <div>
            {adminEmail && adminToken ? (
              <AdminDashboard
                adminEmail={adminEmail}
                adminToken={adminToken}
                onLogout={handleLogout}
                appSettings={settings}
                onUpdateAppSettings={(updated) => setSettings(updated)}
              />
            ) : (
              <AdminLogin onLoginSuccess={handleLoginSuccess} />
            )}
          </div>
        )}
      </main>

      {/* Official Institutional Footer */}
      <footer className="bg-slate-900 text-slate-400 py-6 border-t-2 border-slate-800 text-center text-xs print:hidden">
        <div className="max-w-4xl mx-auto px-4 space-y-2">
          <div className="font-bold text-slate-200">
            زانکۆی پۆلیتەکنیکی هەولێر • پەیمانگەی تەکنیکی کارگێڕی هەولێر
          </div>
          <div className="text-amber-400 font-semibold">
            بەشی سیستمی زانیاری کارگێڕی (Department of Management Information Systems)
          </div>
          <p className="text-slate-400 text-[11px] pt-1">
            سیستەمی ئەلیکترۆنی خۆتۆمارکردنی قوتابیان بۆ وەرزی خوێندنی <span dir="ltr" className="font-mono">2026 - 2027</span>
          </p>
        </div>
      </footer>

    </div>
  );
}
