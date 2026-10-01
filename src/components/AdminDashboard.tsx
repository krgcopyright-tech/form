import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  FileCheck,
  CheckCircle,
  XCircle,
  Search,
  Filter,
  ArrowUpDown,
  Download,
  Printer,
  Settings,
  Eye,
  Edit2,
  RefreshCw,
  ChevronRight,
  ChevronLeft,
  ShieldCheck,
  Calendar,
  KeyRound,
  Clock,
  FileSpreadsheet,
  ExternalLink,
  UploadCloud,
  Check,
  AlertCircle,
} from 'lucide-react';
import type { Registration, RegistrationStatus, DashboardStats, AppSettings } from '../types';
import { ViewRecordModal, EditRecordModal } from './RecordModals';
import { AdminSettingsModal } from './AdminSettings';
import {
  getLocalRegistrations,
  saveLocalRegistrations,
  calculateStats,
  exportRegistrationsToExcel,
  exportRegistrationsToCsv,
} from '../services/storageService';
import { sendRegistrationToGoogleSheets } from '../services/googleSheetsService';

interface AdminDashboardProps {
  adminEmail: string;
  adminToken: string;
  onLogout: () => void;
  appSettings: AppSettings;
  onUpdateAppSettings: (updated: AppSettings) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  adminEmail,
  adminToken,
  onLogout,
  appSettings,
  onUpdateAppSettings,
}) => {
  const [records, setRecords] = useState<Registration[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    total: 0,
    new: 0,
    reviewed: 0,
    approved: 0,
    rejected: 0,
  });

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [levelFilter, setLevelFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'name'>('newest');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Modals state
  const [viewingRecord, setViewingRecord] = useState<Registration | null>(null);
  const [editingRecord, setEditingRecord] = useState<Registration | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Google Sheets sync state
  const [syncingSheets, setSyncingSheets] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<{ success: boolean; message: string } | null>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch registrations (hybrid: server first, fallback to local storage)
  const fetchRegistrations = useCallback(async () => {
    setLoading(true);

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        sort: sortOrder,
      });

      if (debouncedSearch.trim()) params.append('search', debouncedSearch.trim());
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (levelFilter !== 'all') params.append('academic_level', levelFilter);

      const response = await fetch(`/api/admin/registrations?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
        },
        credentials: 'include',
      });

      if (response.status === 401) {
        onLogout();
        return;
      }

      if (response.ok) {
        const data = await response.json();
        setRecords(data.records || []);
        setTotalPages(data.totalPages || 1);
        setTotalCount(data.total || 0);
        if (data.stats) {
          setStats(data.stats);
        }
        setLoading(false);
        return;
      }
    } catch (err) {
      // In static / GitHub Pages mode, network request fails or returns 404
    }

    // Local Storage Fallback (for static / GitHub Pages)
    let all = getLocalRegistrations();

    if (debouncedSearch.trim()) {
      const q = debouncedSearch.trim().toLowerCase();
      all = all.filter(
        (r) =>
          r.full_name.toLowerCase().includes(q) ||
          r.registration_code.toLowerCase().includes(q) ||
          r.university_email.toLowerCase().includes(q) ||
          r.personal_email.toLowerCase().includes(q) ||
          r.mobile_number.includes(q)
      );
    }

    if (statusFilter !== 'all') {
      all = all.filter((r) => r.status === statusFilter);
    }

    if (levelFilter !== 'all') {
      all = all.filter((r) => r.academic_level === levelFilter);
    }

    if (sortOrder === 'name') {
      all.sort((a, b) => a.full_name.localeCompare(b.full_name, 'ckb'));
    } else if (sortOrder === 'oldest') {
      all.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    } else {
      all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    setStats(calculateStats(getLocalRegistrations()));
    setTotalCount(all.length);
    setTotalPages(Math.max(1, Math.ceil(all.length / limit)));
    const startIndex = (page - 1) * limit;
    setRecords(all.slice(startIndex, startIndex + limit));
    setLoading(false);
  }, [page, limit, sortOrder, debouncedSearch, statusFilter, levelFilter, adminToken, onLogout]);

  useEffect(() => {
    fetchRegistrations();
  }, [fetchRegistrations]);

  // Quick Status change
  const handleQuickStatusChange = async (id: number, newStatus: RegistrationStatus) => {
    // 1. Update in local storage
    const currentLocal = getLocalRegistrations();
    const updated = currentLocal.map((r) => (r.id === id ? { ...r, status: newStatus } : r));
    saveLocalRegistrations(updated);

    setRecords((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r))
    );
    setStats(calculateStats(updated));

    // 2. Try server update
    try {
      await fetch(`/api/admin/registrations/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`,
        },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      });
    } catch (err) {
      // Graceful offline fallback
    }
  };

  // Direct Excel download
  const handleExportExcel = () => {
    const all = getLocalRegistrations();
    exportRegistrationsToExcel(all.length > 0 ? all : records);
  };

  // Direct CSV download
  const handleExportCsv = () => {
    const all = getLocalRegistrations();
    exportRegistrationsToCsv(all.length > 0 ? all : records);
  };

  // Sync all records to Google Sheets
  const handleSyncToSheets = async () => {
    if (!appSettings.googleSheetScriptUrl) {
      setShowSettingsModal(true);
      return;
    }

    setSyncingSheets(true);
    setSyncFeedback(null);

    const all = getLocalRegistrations();
    let sentCount = 0;

    for (const item of all) {
      if (!item.synced_to_sheet) {
        const res = await sendRegistrationToGoogleSheets(item, appSettings.googleSheetScriptUrl);
        if (res.success) {
          item.synced_to_sheet = true;
          sentCount++;
        }
      }
    }

    saveLocalRegistrations(all);
    fetchRegistrations();
    setSyncingSheets(false);

    if (sentCount > 0) {
      setSyncFeedback({
        success: true,
        message: `${sentCount} تۆمار بە سەرکەوتوویی ڕەوانەی Google Sheets کران.`,
      });
    } else {
      setSyncFeedback({
        success: true,
        message: 'هەموو تۆمارەکان لە ئێستادا هاوکاتن لەگەڵ Google Sheets.',
      });
    }

    setTimeout(() => setSyncFeedback(null), 5000);
  };

  const renderStatusBadge = (status: RegistrationStatus) => {
    switch (status) {
      case 'new':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
            نوێ
          </span>
        );
      case 'reviewed':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
            پشکنراو
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            پەسەندکراو
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">
            ڕەتکراو
          </span>
        );
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      
      {/* Top Header & Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200 print:hidden">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>بەشی سەرپەرشتیاری داتابەیس • {adminEmail}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            بەڕێوەبردنی تۆمارکردنی قوتابیان
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          
          {/* Google Sheets button */}
          {appSettings.googleSheetViewUrl ? (
            <a
              href={appSettings.googleSheetViewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition flex items-center gap-1.5 shadow-xs"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>کردنەوەی Google Sheet</span>
              <ExternalLink className="w-3.5 h-3.5 text-emerald-600" />
            </a>
          ) : (
            <button
              onClick={() => setShowSettingsModal(true)}
              className="px-3 py-2 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition flex items-center gap-1.5 shadow-xs"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>بەستنەوە بە Google Sheets</span>
            </button>
          )}

          {/* Sync to Sheet button */}
          {appSettings.googleSheetScriptUrl && (
            <button
              onClick={handleSyncToSheets}
              disabled={syncingSheets}
              className="px-3 py-2 rounded-xl text-xs font-bold bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-50 transition flex items-center gap-1.5 shadow-xs"
              title="هاوکاتکردنی هەر تۆمارێک کە لە Google Sheets دا نەبووە"
            >
              <UploadCloud className={`w-4 h-4 ${syncingSheets ? 'animate-bounce' : ''}`} />
              <span>{syncingSheets ? 'ناردن...' : 'هاوکاتکردن لەگەڵ Sheet'}</span>
            </button>
          )}

          {/* Settings button */}
          <button
            onClick={() => setShowSettingsModal(true)}
            className="px-3 py-2 rounded-xl text-xs font-bold bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 transition flex items-center gap-1.5 shadow-xs"
          >
            <Settings className="w-4 h-4 text-slate-500" />
            <span>ڕێکخستنەکان</span>
          </button>

          {/* Excel Export */}
          <button
            type="button"
            onClick={handleExportExcel}
            className="px-3 py-2 rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white transition flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>داگرتنی Excel (.xlsx)</span>
          </button>

          {/* CSV Export */}
          <button
            type="button"
            onClick={handleExportCsv}
            className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-900 text-white transition flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>داگرتنی CSV</span>
          </button>

          {/* Print button */}
          <button
            onClick={() => window.print()}
            className="px-3 py-2 rounded-xl text-xs font-bold bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 transition flex items-center gap-1.5 shadow-xs"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            <span>چاپکردن</span>
          </button>

          {/* Refresh button */}
          <button
            onClick={fetchRegistrations}
            title="نوێکردنەوە"
            className="p-2 rounded-xl text-xs bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 transition shadow-xs"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Sync feedback notification */}
      {syncFeedback && (
        <div
          className={`my-4 p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
            syncFeedback.success
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {syncFeedback.success ? (
            <CheckCircle className="w-4 h-4 text-emerald-600" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600" />
          )}
          <span>{syncFeedback.message}</span>
        </div>
      )}

      {/* Google Sheets Status Banner */}
      {!appSettings.googleSheetScriptUrl && (
        <div className="my-4 p-4 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-sm text-emerald-950">
                سیستەمی Google Sheets ئامادەیە بۆ بەستنەوە!
              </div>
              <div className="text-xs text-emerald-800 mt-0.5">
                تەنها لینکی Web App لە ڕێکخستنەکان دابنێ بۆ ئەوەی هەر قوتابییەک خۆی تۆمارکرد ڕاستەوخۆ بچێتە شیتەکەت.
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowSettingsModal(true)}
            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl transition shadow-xs shrink-0"
          >
            بەستنەوە لە ماوەی ١ خولەکدا
          </button>
        </div>
      )}

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 my-6 print:hidden">
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 block">کۆی تۆمارەکان</span>
            <span className="text-2xl sm:text-3xl font-bold font-mono text-slate-900 mt-1 block">
              {stats.total}
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-blue-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-blue-700 block">تۆمارە نوێکان</span>
            <span className="text-2xl sm:text-3xl font-bold font-mono text-blue-900 mt-1 block">
              {stats.new}
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-emerald-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-emerald-700 block">پەسەندکراوەکان</span>
            <span className="text-2xl sm:text-3xl font-bold font-mono text-emerald-900 mt-1 block">
              {stats.approved}
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-red-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-red-700 block">ڕەتکراوەکان</span>
            <span className="text-2xl sm:text-3xl font-bold font-mono text-red-900 mt-1 block">
              {stats.rejected}
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
            <XCircle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs mb-6 space-y-4 print:hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          
          {/* Search Input */}
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="گەڕان بەپێی ناو، مۆبایل، ئیمەیڵ، کۆد..."
              className="w-full py-2.5 px-3 pr-10 rounded-xl text-xs sm:text-sm border border-slate-300 focus:border-slate-800 outline-none transition"
            />
            <div className="absolute right-3 top-3 text-slate-400 pointer-events-none">
              <Search className="w-4 h-4" />
            </div>
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute left-3 top-3 text-slate-400 hover:text-slate-600 text-xs"
              >
                پاشگەزبوونەوە
              </button>
            )}
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full py-2.5 px-3 rounded-xl text-xs sm:text-sm border border-slate-300 focus:border-slate-800 outline-none bg-white font-medium"
            >
              <option value="all">هەموو بارەکان (All)</option>
              <option value="new">نوێ (New)</option>
              <option value="reviewed">پشکنراو (Reviewed)</option>
              <option value="approved">پەسەندکراو (Approved)</option>
              <option value="rejected">ڕەتکراو (Rejected)</option>
            </select>
          </div>

          {/* Academic Level Filter */}
          <div>
            <select
              value={levelFilter}
              onChange={(e) => {
                setLevelFilter(e.target.value);
                setPage(1);
              }}
              className="w-full py-2.5 px-3 rounded-xl text-xs sm:text-sm border border-slate-300 focus:border-slate-800 outline-none bg-white font-medium"
            >
              <option value="all">هەموو قۆناغەکان (All)</option>
              <option value="قۆناغی سێیەم">قۆناغی سێیەم</option>
              <option value="قۆناغی چوارەم">قۆناغی چوارەم</option>
              <option value="قۆناغی دووەم">قۆناغی دووەم</option>
              <option value="قۆناغی یەکەم">قۆناغی یەکەم</option>
            </select>
          </div>

          {/* Sorting */}
          <div>
            <select
              value={sortOrder}
              onChange={(e) => {
                setSortOrder(e.target.value as any);
                setPage(1);
              }}
              className="w-full py-2.5 px-3 rounded-xl text-xs sm:text-sm border border-slate-300 focus:border-slate-800 outline-none bg-white font-medium"
            >
              <option value="newest">ڕیزکردن: نوێترین (Newest)</option>
              <option value="oldest">ڕیزکردن: کۆنترین (Oldest)</option>
              <option value="name">ڕیزکردن: بەپێی ناو (Name)</option>
            </select>
          </div>

        </div>

        {/* Filter status summary */}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
          <div>
            نیشاندانی <span className="font-bold text-slate-800">{records.length}</span> لە کۆی{' '}
            <span className="font-bold text-slate-800">{totalCount}</span> قوتابی تۆمارکراو
          </div>

          <div className="flex items-center gap-2">
            <span>ژمارە لە هەر پەڕەیەکدا:</span>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="py-1 px-2 border border-slate-200 rounded-lg text-xs bg-white font-medium"
            >
              <option value={15}>15</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Registrations Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs sm:text-sm border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white font-semibold border-b border-slate-800">
                <th className="py-3.5 px-4">کۆدی تۆمارکردن</th>
                <th className="py-3.5 px-4">ناوی سیانی</th>
                <th className="py-3.5 px-4">ژمارەی مۆبایل</th>
                <th className="py-3.5 px-4">ئیمەیلی زانکۆ</th>
                <th className="py-3.5 px-4">ئیمەیلی تایبەتی</th>
                <th className="py-3.5 px-4">قۆناغ</th>
                <th className="py-3.5 px-4">بار</th>
                <th className="py-3.5 px-4">Google Sheet</th>
                <th className="py-3.5 px-4 text-center print:hidden">کردارەکان</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading && records.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <div className="inline-block w-6 h-6 border-2 border-slate-700 border-t-transparent rounded-full animate-spin mb-2"></div>
                    <p>لە هێنانی داتاکاندایە...</p>
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    هیچ تۆمارێک نەدۆزرایەوە بەپێی ئەم فلتەرە.
                  </td>
                </tr>
              ) : (
                records.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900 select-all" dir="ltr">
                      {r.registration_code}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      {r.full_name}
                      {r.student_id && (
                        <span className="block text-[11px] font-mono text-slate-400" dir="ltr">
                          ID: {r.student_id}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-700" dir="ltr">
                      {r.mobile_number}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-600 max-w-[170px]" dir="ltr">
                      <span className="truncate block" title={r.university_email}>{r.university_email}</span>
                      {r.university_email_note && (
                        <span className="inline-block mt-0.5 text-[10px] text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 truncate max-w-full" dir="rtl" title={r.university_email_note}>
                          تێبینی: {r.university_email_note}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-600 max-w-[170px]" dir="ltr">
                      <span className="truncate block" title={r.personal_email}>{r.personal_email}</span>
                      {r.personal_email_note && (
                        <span className="inline-block mt-0.5 text-[10px] text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 truncate max-w-full" dir="rtl" title={r.personal_email_note}>
                          تێبینی: {r.personal_email_note}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 font-medium">
                      {r.academic_level}
                    </td>
                    <td className="py-3.5 px-4">
                      {renderStatusBadge(r.status)}
                    </td>
                    <td className="py-3.5 px-4">
                      {r.synced_to_sheet ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>هاوکاتە</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600">
                          لە مۆبایل/وێب
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 print:hidden">
                      <div className="flex items-center justify-center gap-1.5">
                        
                        {/* Quick Status Dropdown */}
                        <div className="relative group">
                          <select
                            value={r.status}
                            onChange={(e) => handleQuickStatusChange(r.id, e.target.value as RegistrationStatus)}
                            title="گۆڕینی بار"
                            className="text-xs py-1 px-1.5 rounded-lg border border-slate-200 bg-white hover:border-slate-400 cursor-pointer outline-none"
                          >
                            <option value="new">نوێ</option>
                            <option value="reviewed">پشکنراو</option>
                            <option value="approved">پەسەندکراو</option>
                            <option value="rejected">ڕەتکراو</option>
                          </select>
                        </div>

                        {/* View record */}
                        <button
                          onClick={() => setViewingRecord(r)}
                          title="بینین"
                          className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {/* Edit record */}
                        <button
                          onClick={() => setEditingRecord(r)}
                          title="دەستکاری"
                          className="p-1.5 rounded-lg text-slate-600 hover:text-amber-700 hover:bg-amber-50 transition"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 print:hidden">
          <div>
            پەڕەی <span className="font-bold text-slate-900">{page}</span> لە کۆی{' '}
            <span className="font-bold text-slate-900">{totalPages}</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
              .map((p, idx, arr) => (
                <React.Fragment key={p}>
                  {idx > 0 && arr[idx - 1] !== p - 1 && (
                    <span className="px-1 text-slate-400">...</span>
                  )}
                  <button
                    onClick={() => setPage(p)}
                    className={`min-w-[28px] h-7 px-2 rounded-lg font-bold text-xs transition ${
                      page === p
                        ? 'bg-slate-900 text-white'
                        : 'border border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    {p}
                  </button>
                </React.Fragment>
              ))}

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>

      {/* Viewing Record Modal */}
      {viewingRecord && (
        <ViewRecordModal
          record={viewingRecord}
          onClose={() => setViewingRecord(null)}
          onEdit={(r) => {
            setViewingRecord(null);
            setEditingRecord(r);
          }}
        />
      )}

      {/* Editing Record Modal */}
      {editingRecord && (
        <EditRecordModal
          record={editingRecord}
          adminToken={adminToken}
          onClose={() => setEditingRecord(null)}
          onSaveSuccess={(updated) => {
            setRecords((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
            setEditingRecord(null);
            fetchRegistrations();
          }}
        />
      )}

      {/* Admin Settings Modal */}
      {showSettingsModal && (
        <AdminSettingsModal
          currentSettings={appSettings}
          adminToken={adminToken}
          onSaveSuccess={(updated) => {
            onUpdateAppSettings(updated);
            setShowSettingsModal(false);
          }}
          onClose={() => setShowSettingsModal(false)}
        />
      )}

    </div>
  );
};
