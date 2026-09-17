import React, { useState } from 'react';
import { X, Save, Eye, Edit2, User, Phone, Mail, Award, Hash, Calendar, CheckCircle2, AlertCircle } from 'lucide-react';
import type { Registration, RegistrationStatus } from '../types';

interface ViewModalProps {
  record: Registration | null;
  onClose: () => void;
  onEdit: (record: Registration) => void;
}

export const ViewRecordModal: React.FC<ViewModalProps> = ({ record, onClose, onEdit }) => {
  if (!record) return null;

  const getStatusBadge = (status: RegistrationStatus) => {
    switch (status) {
      case 'new':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800">نوێ (New)</span>;
      case 'reviewed':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">پشکنراو (Reviewed)</span>;
      case 'approved':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">پەسەندکراو (Approved)</span>;
      case 'rejected':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800">ڕەتکراو (Rejected)</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b-2 border-amber-500">
          <div className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-base">زانیاریی تەواوی تۆمار (View Registration)</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-4 text-right">
          
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <span className="text-xs text-slate-500 block">کۆدی تۆمارکردن:</span>
              <span className="font-mono font-bold text-lg text-slate-900 select-all" dir="ltr">
                {record.registration_code}
              </span>
            </div>
            <div>{getStatusBadge(record.status)}</div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm">
            
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-slate-500 flex items-center gap-1.5 mb-1">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span>ناوی سیانی:</span>
              </span>
              <span className="font-bold text-slate-900">{record.full_name}</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-slate-500 flex items-center gap-1.5 mb-1">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                <span>ژمارەی مۆبایل:</span>
              </span>
              <span className="font-mono text-slate-900 font-semibold" dir="ltr">{record.mobile_number}</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-slate-500 flex items-center gap-1.5 mb-1">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span>ئیمەیلی زانکۆ:</span>
              </span>
              <span className="font-mono text-slate-900 text-xs break-all" dir="ltr">{record.university_email}</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-slate-500 flex items-center gap-1.5 mb-1">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span>ئیمەیلی تایبەتی:</span>
              </span>
              <span className="font-mono text-slate-900 text-xs break-all" dir="ltr">{record.personal_email}</span>
            </div>

            {record.university_email_note && (
              <div className="sm:col-span-2 p-3 rounded-xl bg-amber-50/60 border border-amber-200">
                <span className="text-amber-800 text-xs font-bold block mb-1">تێبینی لەسەر ئیمەیلی زانکۆ:</span>
                <p className="text-slate-800 text-xs leading-relaxed">{record.university_email_note}</p>
              </div>
            )}

            {record.personal_email_note && (
              <div className="sm:col-span-2 p-3 rounded-xl bg-amber-50/60 border border-amber-200">
                <span className="text-amber-800 text-xs font-bold block mb-1">تێبینی لەسەر ئیمەیلی تایبەتی:</span>
                <p className="text-slate-800 text-xs leading-relaxed">{record.personal_email_note}</p>
              </div>
            )}

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-slate-500 flex items-center gap-1.5 mb-1">
                <Award className="w-3.5 h-3.5 text-slate-400" />
                <span>قۆناغ:</span>
              </span>
              <span className="font-bold text-slate-900">{record.academic_level}</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-slate-500 flex items-center gap-1.5 mb-1">
                <Hash className="w-3.5 h-3.5 text-slate-400" />
                <span>ژمارەی قوتابی:</span>
              </span>
              <span className="font-mono text-slate-900">{record.student_id || '-'}</span>
            </div>

          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-500 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>بەرواری تۆمارکردن:</span>
            </span>
            <span className="font-mono text-slate-700" dir="ltr">{record.created_at}</span>
          </div>

          {/* Action buttons */}
          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              onClick={() => {
                onClose();
                onEdit(record);
              }}
              className="px-4 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl transition flex items-center gap-1.5 shadow-sm"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>دەستکاری زانیاری</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
            >
              داخستن
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};

interface EditModalProps {
  record: Registration | null;
  adminToken?: string;
  onClose: () => void;
  onSaveSuccess: (updatedRecord: Registration) => void;
}

export const EditRecordModal: React.FC<EditModalProps> = ({ record, adminToken, onClose, onSaveSuccess }) => {
  if (!record) return null;

  const [formData, setFormData] = useState({
    full_name: record.full_name,
    mobile_number: record.mobile_number,
    university_email: record.university_email,
    university_email_note: record.university_email_note || '',
    personal_email: record.personal_email,
    personal_email_note: record.personal_email_note || '',
    academic_level: record.academic_level,
    student_id: record.student_id || '',
    status: record.status,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      const token = adminToken || (typeof window !== 'undefined' ? localStorage.getItem('epu_admin_token') : null);
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`/api/admin/registrations/${record.id}`, {
        method: 'PUT',
        headers,
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'هەڵە لە نوێکردنەوەی تۆمار.');
        setIsSaving(false);
        return;
      }

      onSaveSuccess(data.record);
      onClose();
    } catch (err) {
      console.error('Update error:', err);
      setError('پەیوەندی لەگەڵ سێرڤەر سەرکەوتوو نەبوو.');
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b-2 border-amber-500 shrink-0">
          <div className="flex items-center gap-2">
            <Edit2 className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-base">دەستکاریی تۆمار ({record.registration_code})</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 bg-red-50 border-b border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto text-right">
          
          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-700">ناوی سیانی قوتابی</label>
            <input
              type="text"
              required
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              className="w-full py-2 px-3 rounded-xl border border-slate-300 text-sm focus:border-slate-800 outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-700">ژمارەی مۆبایل</label>
            <input
              type="tel"
              required
              dir="ltr"
              value={formData.mobile_number}
              onChange={(e) => setFormData({ ...formData, mobile_number: e.target.value })}
              className="w-full py-2 px-3 text-left font-mono rounded-xl border border-slate-300 text-sm focus:border-slate-800 outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">ئیمەیلی زانکۆ</label>
              <input
                type="email"
                required
                dir="ltr"
                value={formData.university_email}
                onChange={(e) => setFormData({ ...formData, university_email: e.target.value })}
                className="w-full py-2 px-3 text-left font-mono rounded-xl border border-slate-300 text-xs sm:text-sm focus:border-slate-800 outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">تێبینی (ئیمەیلی زانکۆ)</label>
              <input
                type="text"
                value={formData.university_email_note}
                onChange={(e) => setFormData({ ...formData, university_email_note: e.target.value })}
                placeholder="تێبینی لەسەر ئیمەیلی زانکۆ..."
                className="w-full py-2 px-3 rounded-xl border border-slate-300 text-xs sm:text-sm focus:border-slate-800 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">ئیمەیلی تایبەتی</label>
              <input
                type="email"
                required
                dir="ltr"
                value={formData.personal_email}
                onChange={(e) => setFormData({ ...formData, personal_email: e.target.value })}
                className="w-full py-2 px-3 text-left font-mono rounded-xl border border-slate-300 text-xs sm:text-sm focus:border-slate-800 outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">تێبینی (ئیمەیلی تایبەتی)</label>
              <input
                type="text"
                value={formData.personal_email_note}
                onChange={(e) => setFormData({ ...formData, personal_email_note: e.target.value })}
                placeholder="تێبینی لەسەر ئیمەیلی تایبەتی..."
                className="w-full py-2 px-3 rounded-xl border border-slate-300 text-xs sm:text-sm focus:border-slate-800 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">قۆناغ</label>
              <select
                value={formData.academic_level}
                onChange={(e) => setFormData({ ...formData, academic_level: e.target.value })}
                className="w-full py-2 px-3 rounded-xl border border-slate-300 text-sm focus:border-slate-800 outline-none bg-white"
              >
                <option value="قۆناغی سێیەم">قۆناغی سێیەم</option>
                <option value="قۆناغی چوارەم">قۆناغی چوارەم</option>
                <option value="قۆناغی دووەم">قۆناغی دووەم</option>
                <option value="قۆناغی یەکەم">قۆناغی یەکەم</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">ژمارەی قوتابی (ئارەزوومەندانە)</label>
              <input
                type="text"
                dir="ltr"
                value={formData.student_id}
                onChange={(e) => setFormData({ ...formData, student_id: e.target.value })}
                className="w-full py-2 px-3 text-left font-mono rounded-xl border border-slate-300 text-sm focus:border-slate-800 outline-none"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-700">باری تۆمار (Status)</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as RegistrationStatus })}
              className="w-full py-2 px-3 rounded-xl border border-slate-300 text-sm focus:border-slate-800 outline-none bg-white font-semibold"
            >
              <option value="new">نوێ (New)</option>
              <option value="reviewed">پشکنراو (Reviewed)</option>
              <option value="approved">پەسەندکراو (Approved)</option>
              <option value="rejected">ڕەتکراو (Rejected)</option>
            </select>
          </div>

          {/* Action buttons */}
          <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
            >
              هەڵوەشاندنەوە
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-xl transition flex items-center gap-1.5 shadow-sm"
            >
              <Save className="w-4 h-4 text-amber-400" />
              <span>پاشەکەوتکردن</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
