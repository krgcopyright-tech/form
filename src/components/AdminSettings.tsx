import React, { useState } from 'react';
import { Settings, Save, CheckCircle2, AlertCircle, ToggleLeft, ToggleRight, X } from 'lucide-react';
import type { AppSettings } from '../types';

interface AdminSettingsProps {
  currentSettings: AppSettings;
  adminToken?: string;
  onSaveSuccess: (updated: AppSettings) => void;
  onClose: () => void;
}

export const AdminSettingsModal: React.FC<AdminSettingsProps> = ({
  currentSettings,
  adminToken,
  onSaveSuccess,
  onClose,
}) => {
  const [formData, setFormData] = useState({
    isRegistrationOpen: currentSettings.isRegistrationOpen,
    academicLevel: currentSettings.academicLevel || 'قۆناغی سێیەم',
    registrationTitle: currentSettings.registrationTitle || 'خۆتۆمارکردنی قوتابیان بۆ سمستەری سێیەم',
    instructionText: currentSettings.instructionText || 'تکایە زانیارییەکان بە وردی و دروستی پڕبکەرەوە، پاشان فۆرمەکە بنێرە.',
  });

  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const token = adminToken || (typeof window !== 'undefined' ? localStorage.getItem('epu_admin_token') : null);
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers,
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      if (!response.ok) {
        setMessage({ type: 'error', text: data.error || 'هەڵە لە پاشەکەوتکردن.' });
        setIsSaving(false);
        return;
      }

      setMessage({ type: 'success', text: 'ڕێکخستنەکان بە سەرکەوتوویی پاشەکەوتکران.' });
      onSaveSuccess(formData);
      setTimeout(() => {
        onClose();
      }, 800);
    } catch (err) {
      setMessage({ type: 'error', text: 'پەیوەندی لەگەڵ سێرڤەر سەرکەوتوو نەبوو.' });
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b-2 border-amber-500">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-base">ڕێکخستنەکانی سیستەم (Admin Settings)</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Message Banner */}
        {message && (
          <div
            className={`p-3 text-xs font-semibold flex items-center gap-2 ${
              message.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-b border-emerald-200'
                : 'bg-red-50 text-red-800 border-b border-red-200'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-5 text-right">
          
          {/* Open/Close Registration Toggle */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
            <div>
              <div className="font-bold text-sm text-slate-900">
                دۆخی خۆتۆمارکردن (Registration Status)
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                {formData.isRegistrationOpen
                  ? 'تۆمارکردن کراوەیە و فۆرمەکە بەردەستە بۆ قوتابیان.'
                  : 'تۆمارکردن داخراوە و قوتابیان ناتوانن فۆرم بنێرن.'}
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                setFormData((prev) => ({ ...prev, isRegistrationOpen: !prev.isRegistrationOpen }))
              }
              className={`p-1.5 rounded-xl flex items-center gap-2 px-3 text-xs font-bold transition shadow-sm ${
                formData.isRegistrationOpen
                  ? 'bg-emerald-600 text-white'
                  : 'bg-red-600 text-white'
              }`}
            >
              {formData.isRegistrationOpen ? (
                <>
                  <ToggleRight className="w-5 h-5" />
                  <span>کراوەیە</span>
                </>
              ) : (
                <>
                  <ToggleLeft className="w-5 h-5" />
                  <span>داخراوە</span>
                </>
              )}
            </button>
          </div>

          {/* Active Academic Level */}
          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-700">
              قۆناغی بنەڕەتی (Active Academic Level)
            </label>
            <input
              type="text"
              value={formData.academicLevel}
              onChange={(e) => setFormData({ ...formData, academicLevel: e.target.value })}
              placeholder="قۆناغی سێیەم"
              className="w-full py-2 px-3 rounded-xl border border-slate-300 text-sm focus:border-slate-800 outline-none"
            />
          </div>

          {/* Title */}
          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-700">
              ناونیشانی فۆرم (Form Title)
            </label>
            <input
              type="text"
              value={formData.registrationTitle}
              onChange={(e) => setFormData({ ...formData, registrationTitle: e.target.value })}
              className="w-full py-2 px-3 rounded-xl border border-slate-300 text-sm focus:border-slate-800 outline-none"
            />
          </div>

          {/* Short Instruction Text */}
          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-700">
              دەقی ڕێنمایی (Instruction Text)
            </label>
            <textarea
              rows={3}
              value={formData.instructionText}
              onChange={(e) => setFormData({ ...formData, instructionText: e.target.value })}
              className="w-full py-2 px-3 rounded-xl border border-slate-300 text-sm focus:border-slate-800 outline-none resize-none"
            />
          </div>

          {/* Action buttons */}
          <div className="pt-2 flex items-center justify-end gap-2">
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
