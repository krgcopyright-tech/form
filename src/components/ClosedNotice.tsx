import React from 'react';
import { AlertTriangle, Clock } from 'lucide-react';

interface ClosedNoticeProps {
  instruction?: string;
}

export const ClosedNotice: React.FC<ClosedNoticeProps> = ({ instruction }) => {
  return (
    <div className="max-w-xl mx-auto my-12 p-6 sm:p-8 bg-white border border-amber-200 rounded-2xl shadow-sm text-center">
      <div className="w-16 h-16 mx-auto mb-4 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center">
        <Clock className="w-8 h-8" />
      </div>
      <h2 className="text-xl sm:text-2xl font-bold text-slate-800 mb-2">
        تۆمارکردن بۆ ئێستا داخراوە.
      </h2>
      <p className="text-slate-600 text-sm sm:text-base leading-relaxed mb-6">
        ماوەی دیاریکراوی خۆتۆمارکردنی ئۆنلاین بۆ ئەم سمستەرە کۆتایی هاتووە یان بە شێوەیەکی کاتی لەلایەن بەشی تۆمارەوە راگیراوە.
      </p>
      {instruction && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs sm:text-sm text-slate-700 text-right">
          <span className="font-semibold block mb-1 text-slate-900">تێبینی سەرۆکایەتی بەش:</span>
          {instruction}
        </div>
      )}
      <div className="mt-6 text-xs text-slate-500">
        بۆ هەر پرسیارێک یان کێشەیەکی پێویست، سەردانی تۆماری کۆلێژ یان پەیمانگە بکەن.
      </div>
    </div>
  );
};
