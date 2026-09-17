import React, { useState } from 'react';
import { CheckCircle2, Copy, Check, Printer, RefreshCw, BookmarkCheck } from 'lucide-react';
import type { Registration } from '../types';

interface SuccessReceiptProps {
  registration: Registration;
  onReset: () => void;
}

export const SuccessReceipt: React.FC<SuccessReceiptProps> = ({ registration, onReset }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(registration.registration_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-xl mx-auto my-8 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden print:border-none print:shadow-none">
      {/* Top Banner */}
      <div className="bg-emerald-600 text-white p-6 text-center">
        <div className="w-14 h-14 mx-auto mb-3 bg-white/20 backdrop-blur rounded-full flex items-center justify-center">
          <CheckCircle2 className="w-9 h-9 text-white" />
        </div>
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
          فۆرمەکەت بە سەرکەوتوویی نێردرا.
        </h2>
        <p className="text-emerald-100 text-xs sm:text-sm mt-1">
          زانیارییەکانت بە سەرکەوتوویی لە داتابەیسی تۆماردا پاشەکەوتکران.
        </p>
      </div>

      <div className="p-6 sm:p-8 space-y-6">
        {/* Registration Code Card */}
        <div className="bg-amber-50 border-2 border-dashed border-amber-300 rounded-xl p-5 text-center relative">
          <div className="text-xs font-semibold text-amber-900 mb-1">
            کۆدی تۆمارکردن (Registration Code)
          </div>
          <div className="text-2xl sm:text-3xl font-mono font-bold text-slate-900 tracking-wider my-1 select-all" dir="ltr">
            {registration.registration_code}
          </div>
          <div className="text-xs text-amber-800 mt-1">
            تکایە ئەم کۆدە لای خۆت بپارێزە بۆ پێداچوونەوە و بەدواداچوونی فۆرمەکەت.
          </div>

          <div className="mt-3 flex items-center justify-center gap-2 print:hidden">
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 transition shadow-sm"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>کۆپیکرا!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>کۆپیکردنی کۆد</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Student Summary Info */}
        <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden text-xs sm:text-sm">
          <div className="p-3 bg-slate-50 font-bold text-slate-800 flex items-center gap-1.5">
            <BookmarkCheck className="w-4 h-4 text-slate-600" />
            <span>پوختەی زانیارییە تۆمارکراوەکان:</span>
          </div>

          <div className="p-3.5 flex justify-between items-center">
            <span className="text-slate-500 font-medium">ناوی سیانی:</span>
            <span className="font-semibold text-slate-900">{registration.full_name}</span>
          </div>

          <div className="p-3.5 flex justify-between items-center">
            <span className="text-slate-500 font-medium">ژمارەی مۆبایل:</span>
            <span className="font-mono text-slate-900" dir="ltr">{registration.mobile_number}</span>
          </div>

          <div className="p-3.5 flex justify-between items-center">
            <span className="text-slate-500 font-medium">ئیمەیلی زانکۆ:</span>
            <span className="font-mono text-slate-900" dir="ltr">{registration.university_email}</span>
          </div>

          {registration.university_email_note && (
            <div className="p-3.5 flex justify-between items-center bg-amber-50/40">
              <span className="text-amber-800 font-medium text-xs">تێبینیی ئیمەیلی زانکۆ:</span>
              <span className="text-slate-800 text-xs font-medium">{registration.university_email_note}</span>
            </div>
          )}

          <div className="p-3.5 flex justify-between items-center">
            <span className="text-slate-500 font-medium">ئیمەیلی تایبەتی:</span>
            <span className="font-mono text-slate-900" dir="ltr">{registration.personal_email}</span>
          </div>

          {registration.personal_email_note && (
            <div className="p-3.5 flex justify-between items-center bg-amber-50/40">
              <span className="text-amber-800 font-medium text-xs">تێبینیی ئیمەیلی تایبەتی:</span>
              <span className="text-slate-800 text-xs font-medium">{registration.personal_email_note}</span>
            </div>
          )}

          <div className="p-3.5 flex justify-between items-center">
            <span className="text-slate-500 font-medium">قۆناغ:</span>
            <span className="font-semibold text-slate-900">{registration.academic_level}</span>
          </div>

          {registration.student_id && (
            <div className="p-3.5 flex justify-between items-center">
              <span className="text-slate-500 font-medium">ژمارەی قوتابی:</span>
              <span className="font-mono text-slate-900" dir="ltr">{registration.student_id}</span>
            </div>
          )}

          <div className="p-3.5 flex justify-between items-center bg-slate-50/50">
            <span className="text-slate-500 font-medium">بەرواری تۆمارکردن:</span>
            <span className="font-mono text-slate-700 text-xs" dir="ltr">{registration.created_at}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2 print:hidden">
          <button
            onClick={handlePrint}
            className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold transition shadow-sm"
          >
            <Printer className="w-4 h-4" />
            <span>چاپکردنی وەسڵەکە (Print)</span>
          </button>

          <button
            onClick={onReset}
            className="inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold transition"
          >
            <RefreshCw className="w-4 h-4" />
            <span>پڕکردنەوەی فۆرمێکی تر</span>
          </button>
        </div>
      </div>
    </div>
  );
};
