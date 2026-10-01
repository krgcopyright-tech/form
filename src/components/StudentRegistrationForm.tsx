import React, { useState } from 'react';
import { User, Phone, Mail, AtSign, AlertCircle, Send, CheckCircle2, KeyRound } from 'lucide-react';
import type { Registration, AppSettings } from '../types';
import { submitRegistration } from '../services/storageService';

interface StudentRegistrationFormProps {
  settings: AppSettings;
  onSuccess: (registration: Registration) => void;
}

interface FormErrors {
  full_name?: string;
  mobile_number?: string;
  university_email?: string;
  personal_email?: string;
  academic_level?: string;
  general?: string;
}

export const StudentRegistrationForm: React.FC<StudentRegistrationFormProps> = ({
  settings,
  onSuccess,
}) => {
  const [formData, setFormData] = useState({
    full_name: '',
    mobile_number: '',
    university_email: '',
    university_email_note: '',
    personal_email: '',
    personal_email_note: '',
    academic_level: settings.academicLevel || 'قۆناغی سێیەم',
    student_id: '',
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Validate form on frontend before sending
  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.full_name.trim() || formData.full_name.trim().length < 3) {
      newErrors.full_name = 'تکایە ئەم خانەیە پڕبکەرەوە.';
    }

    // Iraqi phone number validation: 07XXXXXXXXX (11 digits) or +9647XXXXXXXXX
    const cleanPhone = formData.mobile_number.replace(/[\s\-\(\)]/g, '');
    const phoneRegex = /^(07[3-9]\d{8}|07\d{9}|\+?9647\d{9})$/;
    if (!formData.mobile_number.trim()) {
      newErrors.mobile_number = 'تکایە ئەم خانەیە پڕبکەرەوە.';
    } else if (!phoneRegex.test(cleanPhone)) {
      newErrors.mobile_number = 'تکایە ژمارەی مۆبایل بە شێوەیەکی دروست بنووسە.';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!formData.university_email.trim()) {
      newErrors.university_email = 'تکایە ئەم خانەیە پڕبکەرەوە.';
    } else if (!emailRegex.test(formData.university_email.trim())) {
      newErrors.university_email = 'تکایە ئیمەیڵێکی دروست بنووسە.';
    }

    if (!formData.personal_email.trim()) {
      newErrors.personal_email = 'تکایە ئەم خانەیە پڕبکەرەوە.';
    } else if (!emailRegex.test(formData.personal_email.trim())) {
      newErrors.personal_email = 'تکایە ئیمەیڵێکی دروست بنووسە.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Clear specific error on change
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({
        ...prev,
        [name]: undefined,
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmitting) return;

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      const result = await submitRegistration(formData);

      if (!result.success) {
        if (result.field === 'university_email') {
          setErrors({
            university_email: result.error || 'ئەم ئیمەیڵە پێشتر تۆمار کراوە.',
            general: result.error,
          });
        } else {
          setErrors({
            general: result.error || 'هەڵەیەک لە ناردنی فۆرم ڕوویدا.',
          });
        }
        setIsSubmitting(false);
        return;
      }

      // Success
      if (result.registration) {
        onSuccess(result.registration);
      }
    } catch (err: any) {
      console.error('Submission error:', err);
      setErrors({
        general: 'هەڵەیەک ڕوویدا لە کاتی ناردنی فۆرم. تکایە دووبارە هەوڵبدەرەوە.',
      });
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto my-6 sm:my-10 px-4">
      {/* Registration Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        
        {/* Header Ribbon */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-6 sm:p-8 text-white text-center border-b-2 border-amber-500">
          <span className="inline-block px-3 py-1 bg-amber-500/20 text-amber-300 rounded-full text-xs font-semibold mb-3 border border-amber-400/30">
            ساڵی خوێندنی <span dir="ltr" className="font-mono">2026 - 2027</span>
          </span>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white leading-tight">
            {settings.registrationTitle || 'خۆتۆمارکردنی قوتابیان بۆ سمستەری سێیەم'}
          </h1>
          <p className="text-slate-300 text-xs sm:text-sm mt-3 max-w-lg mx-auto leading-relaxed">
            {settings.instructionText || 'تکایە زانیارییەکان بە وردی و دروستی پڕبکەرەوە، پاشان فۆرمەکە بنێرە.'}
          </p>
        </div>

        {/* Global Error Banner */}
        {errors.general && (
          <div className="m-6 p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-red-800 text-sm">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">{errors.general}</p>
            </div>
          </div>
        )}

        {/* Registration Form */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
          
          {/* 1. Full Name */}
          <div className="space-y-1.5">
            <label htmlFor="full_name" className="block text-sm font-bold text-slate-800">
              ناوی سیانی قوتابی <span className="text-red-500 font-bold">*</span>
            </label>
            <div className="relative">
              <input
                id="full_name"
                name="full_name"
                type="text"
                value={formData.full_name}
                onChange={handleChange}
                placeholder="ناوی سیانی خۆت بنووسە"
                disabled={isSubmitting}
                className={`w-full py-3 px-4 pr-11 rounded-xl text-sm sm:text-base border transition-colors outline-none ${
                  errors.full_name
                    ? 'border-red-400 bg-red-50/40 focus:border-red-500 focus:ring-2 focus:ring-red-200'
                    : 'border-slate-300 bg-white focus:border-slate-800 focus:ring-2 focus:ring-slate-200'
                }`}
              />
              <div className="absolute right-3.5 top-3.5 text-slate-400 pointer-events-none">
                <User className="w-5 h-5" />
              </div>
            </div>
            {errors.full_name && (
              <p className="text-xs text-red-600 font-medium flex items-center gap-1 mt-1">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{errors.full_name}</span>
              </p>
            )}
          </div>

          {/* 2. Mobile Number */}
          <div className="space-y-1.5">
            <label htmlFor="mobile_number" className="block text-sm font-bold text-slate-800">
              ژمارەی مۆبایل <span className="text-red-500 font-bold">*</span>
            </label>
            <div className="relative">
              <input
                id="mobile_number"
                name="mobile_number"
                type="tel"
                dir="ltr"
                value={formData.mobile_number}
                onChange={handleChange}
                placeholder="07XXXXXXXXX"
                disabled={isSubmitting}
                className={`w-full py-3 px-4 pr-11 text-left font-mono rounded-xl text-sm sm:text-base border transition-colors outline-none ${
                  errors.mobile_number
                    ? 'border-red-400 bg-red-50/40 focus:border-red-500 focus:ring-2 focus:ring-red-200'
                    : 'border-slate-300 bg-white focus:border-slate-800 focus:ring-2 focus:ring-slate-200'
                }`}
              />
              <div className="absolute right-3.5 top-3.5 text-slate-400 pointer-events-none">
                <Phone className="w-5 h-5" />
              </div>
            </div>
            {errors.mobile_number ? (
              <p className="text-xs text-red-600 font-medium flex items-center gap-1 mt-1">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{errors.mobile_number}</span>
              </p>
            ) : (
              <p className="text-[11px] text-slate-500">
                نموونە: 07501234567 یان 07701234567
              </p>
            )}
          </div>

          {/* Grid for emails */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* 3. University Email & Note */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label htmlFor="university_email" className="block text-sm font-bold text-slate-800">
                  ئیمەیلی زانکۆ <span className="text-red-500 font-bold">*</span>
                </label>
                <div className="relative">
                  <input
                    id="university_email"
                    name="university_email"
                    type="email"
                    dir="ltr"
                    value={formData.university_email}
                    onChange={handleChange}
                    placeholder="student@epu.edu.iq"
                    disabled={isSubmitting}
                    className={`w-full py-3 px-4 pr-11 text-left font-mono text-xs sm:text-sm rounded-xl border transition-colors outline-none ${
                      errors.university_email
                        ? 'border-red-400 bg-red-50/40 focus:border-red-500 focus:ring-2 focus:ring-red-200'
                        : 'border-slate-300 bg-white focus:border-slate-800 focus:ring-2 focus:ring-slate-200'
                    }`}
                  />
                  <div className="absolute right-3.5 top-3.5 text-slate-400 pointer-events-none">
                    <Mail className="w-5 h-5" />
                  </div>
                </div>
                {errors.university_email && (
                  <p className="text-xs text-red-600 font-medium flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{errors.university_email}</span>
                  </p>
                )}
              </div>

              {/* University Email Note */}
              <div className="space-y-1.5">
                <label htmlFor="university_email_note" className="block text-xs font-bold text-slate-700">
                  پاسۆوردی ئیمەیلی زانکۆ
                </label>
                <div className="relative">
                  <input
                    id="university_email_note"
                    name="university_email_note"
                    type="text"
                    value={formData.university_email_note}
                    onChange={handleChange}
                    placeholder="پاسۆورد..."
                    disabled={isSubmitting}
                    className="w-full py-2.5 px-3 pr-9 rounded-xl border border-slate-300 text-xs sm:text-sm focus:border-slate-800 focus:ring-2 focus:ring-slate-200 outline-none"
                  />
                  <div className="absolute right-3 top-3 text-slate-400 pointer-events-none">
                    <KeyRound className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </div>

            {/* 4. Personal Email & Note */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label htmlFor="personal_email" className="block text-sm font-bold text-slate-800">
                  ئیمەیلی تایبەتی <span className="text-red-500 font-bold">*</span>
                </label>
                <div className="relative">
                  <input
                    id="personal_email"
                    name="personal_email"
                    type="email"
                    dir="ltr"
                    value={formData.personal_email}
                    onChange={handleChange}
                    placeholder="example@gmail.com"
                    disabled={isSubmitting}
                    className={`w-full py-3 px-4 pr-11 text-left font-mono text-xs sm:text-sm rounded-xl border transition-colors outline-none ${
                      errors.personal_email
                        ? 'border-red-400 bg-red-50/40 focus:border-red-500 focus:ring-2 focus:ring-red-200'
                        : 'border-slate-300 bg-white focus:border-slate-800 focus:ring-2 focus:ring-slate-200'
                    }`}
                  />
                  <div className="absolute right-3.5 top-3.5 text-slate-400 pointer-events-none">
                    <AtSign className="w-5 h-5" />
                  </div>
                </div>
                {errors.personal_email && (
                  <p className="text-xs text-red-600 font-medium flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{errors.personal_email}</span>
                  </p>
                )}
              </div>

              {/* Personal Email Note */}
              <div className="space-y-1.5">
                <label htmlFor="personal_email_note" className="block text-xs font-bold text-slate-700">
                  پاسۆوردی ئیمەیلی تایبەتی
                </label>
                <div className="relative">
                  <input
                    id="personal_email_note"
                    name="personal_email_note"
                    type="text"
                    value={formData.personal_email_note}
                    onChange={handleChange}
                    placeholder="پاسۆورد..."
                    disabled={isSubmitting}
                    className="w-full py-2.5 px-3 pr-9 rounded-xl border border-slate-300 text-xs sm:text-sm focus:border-slate-800 focus:ring-2 focus:ring-slate-200 outline-none"
                  />
                  <div className="absolute right-3 top-3 text-slate-400 pointer-events-none">
                    <KeyRound className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-4">
            <button
              id="submit_registration_btn"
              type="submit"
              disabled={isSubmitting}
              className={`w-full py-3.5 px-6 rounded-xl font-bold text-base transition shadow-sm flex items-center justify-center gap-2 ${
                isSubmitting
                  ? 'bg-slate-700 text-slate-300 cursor-not-allowed'
                  : 'bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 hover:shadow-md'
              }`}
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
                  <span>لە پڕۆسەدایە...</span>
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  <span>ناردنی فۆرم</span>
                </>
              )}
            </button>
          </div>

          <div className="text-center pt-2">
            <p className="text-xs text-slate-400">
              دڵنیابەرەوە لە دروستی تەواوی زانیارییەکان پێش کلیک کردن لەسەر ناردنی فۆرم.
            </p>
          </div>

        </form>
      </div>
    </div>
  );
};
