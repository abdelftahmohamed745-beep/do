import React, { useState } from 'react';
import {
  Clock,
  AlertTriangle,
  Copy,
  CheckCircle2,
  Phone,
  MessageCircle,
  ShieldAlert,
  ArrowLeft,
  LogOut,
  Sparkles
} from 'lucide-react';
import { DoctorProfile } from '../types';
import {
  getEffectiveSubscriptionState,
  formatDateTimeAr
} from '../utils/subscriptionUtils';
import { generateReferenceCode } from '../services/firebaseService';

interface SubscriptionGateProps {
  doctor: DoctorProfile;
  children: React.ReactNode;
  onNavigateSubscription: () => void;
  onSignOut?: () => void;
}

export const SubscriptionGate: React.FC<SubscriptionGateProps> = ({
  doctor,
  children,
  onNavigateSubscription,
  onSignOut
}) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const subState = getEffectiveSubscriptionState(doctor);

  // If subscription permits access, render the protected children immediately
  if (subState.canAccessClinic) {
    return <>{children}</>;
  }

  const refCode = doctor.referenceCode || generateReferenceCode(doctor.uid);

  const handleCopyCode = () => {
    try {
      navigator.clipboard.writeText(refCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    } catch {
      // Fallback
    }
  };

  const whatsAppMessage = `مرحباً، أود تجديد وتفعيل اشتراك عيادتي في منصة دوري.\n• كود المرجع: ${refCode}\n• اسم العيادة: ${doctor.clinicName}\n• اسم الطبيب: ${doctor.name}\n• حالة الاشتراك: ${subState.statusLabelAr}`;
  const whatsAppUrl = `https://wa.me/201032120351?text=${encodeURIComponent(whatsAppMessage)}`;

  const isSuspended = subState.status === 'suspended';
  const isCancelled = subState.status === 'cancelled';

  const titleText = isSuspended
    ? 'تم تعليق اشتراك العيادة مؤقتاً'
    : isCancelled
    ? 'تم إلغاء اشتراك العيادة'
    : 'انتهى اشتراك العيادة';

  const subtitleText = isSuspended
    ? 'تم إيقاف الاشتراك مؤقتاً بواسطة إدارة المنصة. يرجى التواصل مع الإدارة لاستئناف عمل العيادة.'
    : isCancelled
    ? 'تم إلغاء هذا الاشتراك. يمكنك التواصل مع الإدارة لإعادة التفعيل في أي وقت.'
    : 'انتهت الفترة الزمنية المخصصة لاشتراك عيادتك على منصة دوري (Clinic OS).';

  return (
    <div className="min-h-[75vh] flex items-center justify-center p-4 sm:p-6 lg:p-8" dir="rtl">
      <div className="w-full max-w-2xl bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden font-['Cairo',sans-serif]">
        
        {/* Top Visual Banner */}
        <div className={`p-6 sm:p-8 text-white relative overflow-hidden ${
          isSuspended
            ? 'bg-gradient-to-br from-amber-700 via-amber-900 to-slate-900'
            : isCancelled
            ? 'bg-gradient-to-br from-rose-700 via-rose-900 to-slate-900'
            : 'bg-gradient-to-br from-slate-900 via-sky-950 to-slate-900'
        }`}>
          <div className="flex items-start justify-between relative z-10 gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/20">
                {isSuspended ? (
                  <AlertTriangle className="w-6 h-6 text-amber-400" />
                ) : isCancelled ? (
                  <ShieldAlert className="w-6 h-6 text-rose-400" />
                ) : (
                  <Clock className="w-6 h-6 text-sky-400" />
                )}
              </div>
              <div>
                <span className="inline-block px-3 py-0.5 rounded-full text-[11px] font-black bg-white/10 border border-white/20 text-slate-200 mb-1">
                  نظام إدارة الوصول والاشتراكات
                </span>
                <h1 className="text-xl sm:text-2xl font-black font-['Tajawal',sans-serif]">
                  {titleText}
                </h1>
              </div>
            </div>

            {onSignOut && (
              <button
                onClick={onSignOut}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition border border-white/10 shrink-0"
                title="تسجيل الخروج"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">تسجيل خروج</span>
              </button>
            )}
          </div>

          <p className="text-xs sm:text-sm text-slate-200 mt-4 leading-relaxed relative z-10 max-w-xl">
            {subtitleText}
          </p>
        </div>

        {/* Clinic & Subscription Details Card */}
        <div className="p-6 sm:p-8 space-y-6">
          
          <div className="bg-slate-50 rounded-2xl p-4 sm:p-5 border border-slate-200 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-3">
              <div>
                <span className="text-[11px] text-slate-500 font-bold block">العيادة والطبيب:</span>
                <span className="text-base font-black text-slate-900 font-['Tajawal',sans-serif]">
                  {doctor.clinicName} — د. {doctor.name}
                </span>
              </div>
              <span className={`self-start sm:self-center px-3 py-1 rounded-full text-xs font-bold border ${subState.badgeClass}`}>
                {subState.statusLabelAr}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 text-xs">
              <div>
                <span className="text-slate-500 font-bold block mb-1">الكود المرجعي للعيادة:</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-black text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                    {refCode}
                  </span>
                  <button
                    onClick={handleCopyCode}
                    className="p-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded-lg border border-slate-200 transition"
                    title="نسخ الكود المرجعي"
                  >
                    {copiedCode ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <span className="text-slate-500 font-bold block mb-1">تاريخ انتهاء الصلاحية:</span>
                <span className="font-bold text-slate-800 block text-xs">
                  {subState.formattedExpiresAt}
                </span>
                <span className="text-[11px] text-rose-700 font-semibold block mt-0.5">
                  ({subState.remainingTimeText})
                </span>
              </div>
            </div>
          </div>

          {/* Safety & Data Preservation Notice */}
          <div className="bg-sky-50/70 border border-sky-200/80 rounded-2xl p-4 flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
            <div className="text-xs text-sky-950 leading-relaxed font-medium">
              <span className="font-bold block mb-0.5">بياناتك وسجلات المرضى في أمان تام:</span>
              جميع ملفات المرضى، وسجلات الكشوفات، والإعدادات المالية الخاصة بعيادتك محفوظة بالكامل في سحابة دوري المشفرة، وستكون متاحة فور تجديد الاشتراك وتفعيله.
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3 pt-2">
            <a
              href={whatsAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs sm:text-sm rounded-2xl transition shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <MessageCircle className="w-4 h-4" />
              <span>تواصل لتجديد الاشتراك فوراً عبر واتساب</span>
            </a>

            <div className="flex flex-col sm:flex-row items-center gap-3">
              <button
                type="button"
                onClick={onNavigateSubscription}
                className="w-full sm:w-1/2 py-3 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs rounded-2xl transition border border-slate-200 shadow-xs flex items-center justify-center gap-2"
              >
                <span>عرض تفاصيل الباقات والأسعار</span>
                <ArrowLeft className="w-4 h-4" />
              </button>

              <a
                href="tel:01032120351"
                className="w-full sm:w-1/2 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-2xl transition border border-slate-200 flex items-center justify-center gap-2"
              >
                <Phone className="w-4 h-4 text-slate-600" />
                <span>الاتصال بالدعم الفني (01032120351)</span>
              </a>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
