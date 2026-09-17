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
  ChevronDown,
  ShieldCheck,
  Calendar,
  KeyRound,
  Clock,
} from 'lucide-react';
import type { Registration, RegistrationStatus, DashboardStats, AppSettings } from '../types';
import { ViewRecordModal, EditRecordModal } from './RecordModals';
import { AdminSettingsModal } from './AdminSettings';

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
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // Reset to first page on new search
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch registrations
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

      const data = await response.json();
      if (response.ok) {
        setRecords(data.records || []);
        setTotalPages(data.totalPages || 1);
        setTotalCount(data.total || 0);
        if (data.stats) {
          setStats(data.stats);
        }
      }
    } catch (err) {
      console.error('Failed to fetch registrations:', err);
    } finally {
      setLoading(false);
    }
  }, [page, limit, sortOrder, debouncedSearch, statusFilter, levelFilter, onLogout]);

  useEffect(() => {
    fetchRegistrations();
  }, [fetchRegistrations]);

  // Quick Status change
  const handleQuickStatusChange = async (id: number, newStatus: RegistrationStatus) => {
    try {
      const response = await fetch(`/api/admin/registrations/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`,
        },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        setRecords((prev) =>
          prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r))
        );
        fetchRegistrations(); // Refresh stats
      }
    } catch (err) {
      console.error('Status update failed:', err);
    }
  };

  // Export files respecting active filters
  const getExportUrl = (type: 'excel' | 'csv') => {
    const params = new URLSearchParams({
      sort: sortOrder,
    });
    if (adminToken) params.append('token', adminToken);
    if (debouncedSearch.trim()) params.append('search', debouncedSearch.trim());
    if (statusFilter !== 'all') params.append('status', statusFilter);
    if (levelFilter !== 'all') params.append('academic_level', levelFilter);
    return `/api/admin/export/${type}?${params.toString()}`;
  };

  // Status badges & text
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
          {/* Settings button */}
          <button
            onClick={() => setShowSettingsModal(true)}
            className="px-3 py-2 rounded-xl text-xs font-bold bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 transition flex items-center gap-1.5 shadow-xs"
          >
            <Settings className="w-4 h-4 text-slate-500" />
            <span>ڕێکخستنەکان</span>
          </button>

          {/* Change password button */}
          <button
            onClick={() => setShowPasswordModal(true)}
            className="px-3 py-2 rounded-xl text-xs font-bold bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 transition flex items-center gap-1.5 shadow-xs"
          >
            <KeyRound className="w-4 h-4 text-slate-500" />
            <span>گۆڕینی وشەی نهێنی</span>
          </button>

          {/* Print button */}
          <button
            onClick={() => window.print()}
            className="px-3 py-2 rounded-xl text-xs font-bold bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 transition flex items-center gap-1.5 shadow-xs"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            <span>چاپکردن</span>
          </button>

          {/* Excel Export */}
          <a
            href={getExportUrl('excel')}
            download
            className="px-3 py-2 rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white transition flex items-center gap-1.5 shadow-xs"
          >
            <Download className="w-4 h-4" />
            <span>داگرتنی Excel</span>
          </a>

          {/* CSV Export */}
          <a
            href={getExportUrl('csv')}
            download
            className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-900 text-white transition flex items-center gap-1.5 shadow-xs"
          >
            <Download className="w-4 h-4" />
            <span>داگرتنی CSV</span>
          </a>

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

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 my-6 print:hidden">
        
        {/* Total Card */}
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

        {/* New Card */}
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

        {/* Approved Card */}
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

        {/* Rejected Card */}
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

      {/* Print-only Header */}
      <div className="hidden print:block mb-6 text-center border-b-2 border-slate-900 pb-4">
        <h2 className="text-xl font-bold">زانکۆی پۆلیتەکنیکی هەولێر • پەیمانگەی تەکنیکی کارگێڕی</h2>
        <h3 className="text-lg font-semibold mt-1">بەشی سیستمی زانیاری کارگێڕی (MIS) - لیستی تۆمارکراوان</h3>
        <p className="text-xs text-slate-600 mt-1">
          بەرواری چاپ: {new Date().toLocaleDateString('ku-IQ')} | کۆی تۆمارەکان: {totalCount}
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs mb-6 space-y-4 print:hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          
          {/* Search Box */}
          <div className="lg:col-span-2 relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="گەڕان لە تۆمارەکان... (ناو، ئیمەیل، مۆبایل، کۆد)"
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
              className="py-1 px-2 rounded-lg border border-slate-200 text-xs bg-slate-50"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>
      </div>

      {/* Registrations Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden print:border-none print:shadow-none">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs sm:text-sm divide-y divide-slate-200">
            <thead className="bg-slate-900 text-white font-semibold">
              <tr>
                <th className="py-3.5 px-4">کۆدی تۆمارکردن</th>
                <th className="py-3.5 px-4">ناوی سیانی</th>
                <th className="py-3.5 px-4">ژمارەی مۆبایل</th>
                <th className="py-3.5 px-4">ئیمەیلی زانکۆ</th>
                <th className="py-3.5 px-4">ئیمەیلی تایبەتی</th>
                <th className="py-3.5 px-4">قۆناغ</th>
                <th className="py-3.5 px-4">بار</th>
                <th className="py-3.5 px-4">بەروار</th>
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
                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap" dir="ltr">
                      {r.created_at}
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

        {/* Pagination Controls */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 print:hidden">
          <div>
            پەڕەی <span className="font-bold text-slate-900">{page}</span> لە کۆی{' '}
            <span className="font-bold text-slate-900">{totalPages}</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-medium flex items-center gap-1 transition"
            >
              <ChevronRight className="w-3.5 h-3.5" />
              <span>پێشووتر</span>
            </button>

            {Array.from({ length: Math.min(5, totalPages) }, (_, idx) => {
              let pageNum = idx + 1;
              if (totalPages > 5 && page > 3) {
                pageNum = page - 3 + idx;
                if (pageNum > totalPages) pageNum = totalPages - (4 - idx);
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={`w-8 h-8 rounded-lg font-bold transition ${
                    page === pageNum
                      ? 'bg-slate-900 text-white'
                      : 'bg-white border border-slate-200 hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-medium flex items-center gap-1 transition"
            >
              <span>دواتر</span>
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
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

      {editingRecord && (
        <EditRecordModal
          record={editingRecord}
          adminToken={adminToken}
          onClose={() => setEditingRecord(null)}
          onSaveSuccess={(updated) => {
            setRecords((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
            fetchRegistrations();
          }}
        />
      )}

      {showSettingsModal && (
        <AdminSettingsModal
          currentSettings={appSettings}
          adminToken={adminToken}
          onClose={() => setShowSettingsModal(false)}
          onSaveSuccess={(updated) => {
            onUpdateAppSettings(updated);
          }}
        />
      )}

      {showPasswordModal && (
        <ChangePasswordModal adminToken={adminToken} onClose={() => setShowPasswordModal(false)} />
      )}

    </div>
  );
};

// Modal to change admin password securely
const ChangePasswordModal: React.FC<{ adminToken: string; onClose: () => void }> = ({ adminToken, onClose }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatusMsg(null);

    try {
      const response = await fetch('/api/admin/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`,
        },
        credentials: 'include',
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await response.json();
      if (!response.ok) {
        setStatusMsg({ type: 'error', text: data.error || 'هەڵە لە گۆڕینی وشەی نهێنی.' });
        setLoading(false);
        return;
      }

      setStatusMsg({ type: 'success', text: 'وشەی نهێنی بە سەرکەوتوویی نوێکرایەوە.' });
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err) {
      setStatusMsg({ type: 'error', text: 'پەیوەندی لەگەڵ سێرڤەر سەرکەوتوو نەبوو.' });
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden text-right">
        <div className="bg-slate-900 text-white p-4 flex items-center justify-between border-b-2 border-amber-500">
          <h3 className="font-bold text-sm">گۆڕینی وشەی نهێنی بەڕێوەبەر</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        {statusMsg && (
          <div
            className={`p-3 text-xs font-semibold ${
              statusMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'
            }`}
          >
            {statusMsg.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-700">وشەی نهێنی ئێستا</label>
            <input
              type="password"
              dir="ltr"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full py-2 px-3 text-left rounded-xl border border-slate-300 text-sm focus:border-slate-800 outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-700">وشەی نهێنی نوێ (بەلایەنی کەم ٦ پیت/ژمارە)</label>
            <input
              type="password"
              dir="ltr"
              required
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full py-2 px-3 text-left rounded-xl border border-slate-300 text-sm focus:border-slate-800 outline-none"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              هەڵوەشاندنەوە
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-xs font-bold bg-slate-900 text-white rounded-xl hover:bg-slate-800 shadow-sm"
            >
              پاشەکەوتکردن
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
