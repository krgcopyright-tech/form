import React, { useState } from 'react';
import {
  Settings,
  Save,
  CheckCircle2,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  X,
  FileSpreadsheet,
  Copy,
  Check,
  ExternalLink,
  Play,
  KeyRound,
  HelpCircle,
} from 'lucide-react';
import type { AppSettings } from '../types';
import { APPS_SCRIPT_TEMPLATE, testGoogleSheetConnection } from '../services/googleSheetsService';
import { saveLocalSettings } from '../services/storageService';

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
  const [formData, setFormData] = useState<AppSettings>({
    isRegistrationOpen: currentSettings.isRegistrationOpen,
    academicLevel: currentSettings.academicLevel || 'قۆناغی سێیەم',
    registrationTitle: currentSettings.registrationTitle || 'خۆتۆمارکردنی قوتابیان بۆ سمستەری سێیەم',
    instructionText: currentSettings.instructionText || 'تکایە زانیارییەکان بە وردی و دروستی پڕبکەرەوە، پاشان فۆرمەکە بنێرە.',
    googleSheetScriptUrl: currentSettings.googleSheetScriptUrl || '',
    googleSheetViewUrl: currentSettings.googleSheetViewUrl || '',
    adminPassword: currentSettings.adminPassword || 'admin123456',
  });

  const [activeTab, setActiveTab] = useState<'general' | 'sheets' | 'security'>('general');
  const [isSaving, setIsSaving] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [testingSheet, setTestingSheet] = useState(false);
  const [sheetTestResult, setSheetTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(APPS_SCRIPT_TEMPLATE);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleTestConnection = async () => {
    if (!formData.googleSheetScriptUrl?.trim()) {
      setSheetTestResult({ success: false, message: 'تکایە سەرەتا لینکی Web App لە خوارەوە بنووسە.' });
      return;
    }
    setTestingSheet(true);
    setSheetTestResult(null);

    const ok = await testGoogleSheetConnection(formData.googleSheetScriptUrl.trim());
    setTestingSheet(false);
    if (ok) {
      setSheetTestResult({
        success: true,
        message: 'پەیوەندی بە سەرکەوتوویی تاقیکرایەوە! ڕیزێکی تاقیکاری بۆ شیتەکە نێردرا.',
      });
    } else {
      setSheetTestResult({
        success: false,
        message: 'پەیوەندی سەرکەوتوو نەبوو. دڵنیابەرەوە لینکەکە بە دروستی کۆپی کراوە و دەسەڵاتی Anyone دراوە پێی.',
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);

    // 1. Always save in localStorage (for GitHub Pages / offline / fast loads)
    saveLocalSettings(formData);

    // 2. Try server save if available
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const token = adminToken || (typeof window !== 'undefined' ? localStorage.getItem('epu_admin_token') : null);
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      await fetch('/api/admin/settings', {
        method: 'PUT',
        headers,
        credentials: 'include',
        body: JSON.stringify(formData),
      });
    } catch (err) {
      // Gracefully continue on static / GitHub Pages
    }

    setMessage({ type: 'success', text: 'ڕێکخستنەکان بە سەرکەوتوویی پاشەکەوتکران.' });
    setIsSaving(false);
    onSaveSuccess(formData);
    setTimeout(() => {
      onClose();
    }, 700);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between border-b-2 border-amber-500">
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

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50 text-xs font-bold text-slate-600 px-4">
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`py-3 px-3 border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'general'
                ? 'border-amber-500 text-slate-900 font-extrabold bg-white'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            <Settings className="w-4 h-4 text-amber-500" />
            <span>گشتی و فۆڕم</span>
          </button>
          
          <button
            type="button"
            onClick={() => setActiveTab('sheets')}
            className={`py-3 px-3 border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'sheets'
                ? 'border-emerald-500 text-emerald-900 font-extrabold bg-white'
                : 'border-transparent hover:text-emerald-700'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>بەستنەوە بە Google Sheets</span>
            {formData.googleSheetScriptUrl && (
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`py-3 px-3 border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'security'
                ? 'border-amber-500 text-slate-900 font-extrabold bg-white'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            <KeyRound className="w-4 h-4 text-amber-500" />
            <span>وشەی نهێنی بەڕێوەبەر</span>
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

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 text-right max-h-[75vh] overflow-y-auto">
          
          {/* TAB 1: General */}
          {activeTab === 'general' && (
            <div className="space-y-4">
              {/* Open/Close Registration Toggle */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
                <div>
                  <div className="font-bold text-sm text-slate-900">
                    دۆخی خۆتۆمارکردن (Registration Status)
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {formData.isRegistrationOpen
                      ? 'تۆمارکردن کراوەیە و قوتابیان دەتوانن فۆرم پڕبکەنەوە.'
                      : 'تۆمارکردن داخراوە و قوتابیان پەیامی داخستن دەبینن.'}
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
                  دەقی ڕێنمایی سەرەوەی فۆرم (Instruction Text)
                </label>
                <textarea
                  rows={2}
                  value={formData.instructionText}
                  onChange={(e) => setFormData({ ...formData, instructionText: e.target.value })}
                  className="w-full py-2 px-3 rounded-xl border border-slate-300 text-sm focus:border-slate-800 outline-none resize-none"
                />
              </div>
            </div>
          )}

          {/* TAB 2: Google Sheets Setup */}
          {activeTab === 'sheets' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                  <span>پاشەکەوتکردنی ڕاستەوخۆ لە Google Sheets</span>
                </div>
                <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
                  هەموو قوتابییەک کاتێک فۆرمەکە پڕدەکاتەوە، زانیارییەکانی لە یەک چرکەدا دەچێتە ناو شیتەکەت! بەبێ پێویستی بە هیچ سێرڤەرێکی دەرەکی.
                </p>
              </div>

              {/* Web App URL */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  لینکی Google Apps Script Web App (Webhook URL):
                </label>
                <input
                  type="url"
                  dir="ltr"
                  placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                  value={formData.googleSheetScriptUrl || ''}
                  onChange={(e) => setFormData({ ...formData, googleSheetScriptUrl: e.target.value })}
                  className="w-full py-2.5 px-3 text-left font-mono text-xs rounded-xl border border-slate-300 focus:border-emerald-600 outline-none"
                />
              </div>

              {/* Test Button */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testingSheet}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-xs"
                >
                  {testingSheet ? (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <Play className="w-3.5 h-3.5" />
                  )}
                  <span>تاقیکردنەوەی بەستنەوە (Test Connection)</span>
                </button>
              </div>

              {sheetTestResult && (
                <div
                  className={`p-3 rounded-xl text-xs font-semibold flex items-start gap-2 ${
                    sheetTestResult.success
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-red-50 text-red-800 border border-red-200'
                  }`}
                >
                  {sheetTestResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  )}
                  <span>{sheetTestResult.message}</span>
                </div>
              )}

              {/* Optional Sheet View Link */}
              <div className="space-y-1 pt-1">
                <label className="block text-xs font-bold text-slate-700">
                  لینکی کردنەوەی شیتەکە لە وێبگەر (Google Sheet Direct Link - دڵخواز):
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    dir="ltr"
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    value={formData.googleSheetViewUrl || ''}
                    onChange={(e) => setFormData({ ...formData, googleSheetViewUrl: e.target.value })}
                    className="flex-1 py-2 px-3 text-left font-mono text-xs rounded-xl border border-slate-300 focus:border-slate-800 outline-none"
                  />
                  {formData.googleSheetViewUrl && (
                    <a
                      href={formData.googleSheetViewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 text-xs font-bold flex items-center gap-1 transition"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>کردنەوە</span>
                    </a>
                  )}
                </div>
              </div>

              {/* Step-by-step setup guide */}
              <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                    <HelpCircle className="w-4 h-4 text-amber-500" />
                    چۆن لە یەک خولەکدا Google Sheet ڕێکبخەم؟
                  </span>

                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="px-2.5 py-1 bg-slate-900 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 transition hover:bg-slate-800"
                  >
                    {copiedCode ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>کۆپیکرا!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-amber-400" />
                        <span>کۆپیکردنی کۆدەکە</span>
                      </>
                    )}
                  </button>
                </div>

                <ol className="text-xs text-slate-600 space-y-2 list-decimal list-inside pr-1 leading-relaxed">
                  <li>
                    بڕۆ بۆ <span className="font-mono font-bold text-slate-900">sheets.google.com</span> و فایلێکی بەتاڵ دروستبکە.
                  </li>
                  <li>
                    لە مینیوی سەرەوە کلیك لەسەر <span className="font-bold text-slate-800">Extensions</span> بکە، پاشان <span className="font-bold text-slate-800">Apps Script</span> هەڵبژێرە.
                  </li>
                  <li>
                    کۆدی ئامادەکراو (لە دوگمەی کۆپیکردنی سەرەوە) دابنێ لە جێگەی هەموو کۆدەکانی ناو فایلی Code.gs و Save بکە.
                  </li>
                  <li>
                    کلیك لەسەر دوگمەی شینی <span className="font-bold text-slate-800">Deploy &gt; New deployment</span> بکە.
                    جۆری هەڵبژێرە: <span className="font-bold text-slate-800">Web app</span>.
                    لە بەشی <span className="font-bold text-slate-800">Who has access</span> بیکە بە <span className="font-bold text-emerald-700">Anyone</span>.
                  </li>
                  <li>
                    لینکی Web app کۆپی بکە و لە خانەی سەرەوە دایبنێ!
                  </li>
                </ol>
              </div>
            </div>
          )}

          {/* TAB 3: Security & Password */}
          {activeTab === 'security' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                <div className="font-bold text-xs text-amber-900">
                  گۆڕینی وشەی نهێنی بۆ چوونەژوورەوەی ئەدمین
                </div>
                <div className="text-[11px] text-amber-800 mt-1">
                  دەتوانی وشەی نهێنی خۆت دابنێیت بۆ ئەوەی کەس نەتوانێت دەستکاری فۆڕم و شیتەکان بکات.
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  ئیمەیڵی ئەدمین
                </label>
                <input
                  type="text"
                  dir="ltr"
                  disabled
                  value="admin@epu.edu.iq"
                  className="w-full py-2 px-3 rounded-xl border border-slate-200 bg-slate-100 text-xs font-mono text-slate-500 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  وشەی نهێنی نوێ (Admin Password):
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={formData.adminPassword || 'admin123456'}
                  onChange={(e) => setFormData({ ...formData, adminPassword: e.target.value })}
                  placeholder="admin123456"
                  className="w-full py-2 px-3 rounded-xl border border-slate-300 text-sm font-mono focus:border-slate-800 outline-none"
                />
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
            >
              داخستن
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
