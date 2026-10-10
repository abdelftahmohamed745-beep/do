import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Check, ShieldCheck, Clock, AlertTriangle, MessageSquare, ArrowRight, Info, Copy, CheckCircle2 } from 'lucide-react';
import { DoctorProfile } from '../types';
import { CustomWebsiteSection } from './CustomWebsiteSection';
import { generateReferenceCode, OFFICIAL_SUBSCRIPTION_PRICES } from '../services/firebaseService';
import { getEffectiveSubscriptionState } from '../utils/subscriptionUtils';

interface SubscriptionPageProps {
  doctor: DoctorProfile;
  onBackToDashboard: () => void;
  onShowToast: (title: string, message?: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export const SubscriptionPage: React.FC<SubscriptionPageProps> = ({
  doctor,
  onBackToDashboard,
  onShowToast
}) => {
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('monthly');
  const [copiedCode, setCopiedCode] = useState(false);

  const refCode = doctor.referenceCode || generateReferenceCode(doctor.uid);
  const subState = getEffectiveSubscriptionState(doctor);

  const handleCopyRefCode = () => {
    navigator.clipboard.writeText(refCode);
    setCopiedCode(true);
    onShowToast("تم نسخ كود المرجع بنجاح", refCode, "success");
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const getWhatsAppSubscriptionLink = (planName: string, price: number) => {
    const text = `مرحبًا، أريد تفعيل اشتراك منصة دوري.\n• كود المرجع (Reference Code): ${refCode}\n• اسم العيادة: ${doctor.clinicName}\n• اسم الطبيب: ${doctor.name}\n• الباقة المطلوبة: ${planName} (${price} EGP)`;
    return `https://wa.me/201032120351?text=${encodeURIComponent(text)}`;
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      
      {/* Back Button */}
      <button
        onClick={onBackToDashboard}
        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 mb-6 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-2xs transition"
      >
        <ArrowRight className="w-4 h-4" />
        <span>العودة للوحة التحكم</span>
      </button>

      {/* Header Banner */}
      <div className="text-center max-w-2xl mx-auto mb-10">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-teal-50 text-teal-800 font-bold text-xs mb-3 border border-teal-200">
          <ShieldCheck className="w-4 h-4 text-teal-700" />
          <span>اشتراكات عيادات دوري الرسمية</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-['Tajawal',sans-serif]">
          اختر الباقة المناسبة لعيادتك
        </h1>
        <p className="text-slate-600 text-xs sm:text-sm mt-2">
          نظام حجز وتتبع دور ذكي ومباشر مع تجربة مجانية لمدة 7 أيام
        </p>
      </div>

      {/* Unique Clinic Reference Code Card */}
      <div className="mb-8 p-6 bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 text-white rounded-3xl border border-slate-800 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <span className="text-xs text-sky-300 font-bold block mb-1">كود المرجع الثابت لعيادتك (Reference Code):</span>
          <div className="flex items-center gap-3">
            <span className="text-2xl font-black text-amber-400 font-mono tracking-wider">{refCode}</span>
            <button
              onClick={handleCopyRefCode}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl transition border border-white/10"
            >
              {copiedCode ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copiedCode ? 'تم النسخ' : 'نسخ الكود'}</span>
            </button>
          </div>
          <p className="text-[11px] text-slate-300 mt-1">
            استخدم هذا الكود المرجعي عند التواصل مع الإدارة لتفعيل أو تمديد اشتراكك بسرعة.
          </p>
        </div>

        <div className="text-left sm:text-right shrink-0 space-y-1">
          <span className="text-xs text-slate-300 font-medium block">الحالة الحالية:</span>
          <span className={`inline-block px-3 py-1 rounded-full text-xs font-extrabold border ${
            subState.isLifetime || subState.isActive ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30' :
            subState.isTrial ? 'bg-amber-500/20 text-amber-300 border-amber-400/30' :
            subState.isSuspended ? 'bg-amber-500/20 text-amber-300 border-amber-400/30' :
            'bg-rose-500/20 text-rose-300 border-rose-400/30'
          }`}>
            {subState.statusLabelAr} ({subState.remainingTimeText})
          </span>
          <span className="block text-[11px] text-slate-400 font-medium">
            الانتهاء: {subState.formattedExpiresAt}
          </span>
        </div>
      </div>

      {/* Important Instructions Banner */}
      <div className="mb-10 p-5 bg-sky-50 border border-sky-200/80 rounded-2xl flex items-start gap-3 text-right">
        <Info className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
        <div className="text-xs sm:text-sm text-sky-900 leading-relaxed font-medium">
          <span className="font-bold block mb-1">طريقة تفعيل الاشتراك:</span>
          تواصل معنا عبر واتساب برقم المرجع <strong className="text-sky-950 underline">{refCode}</strong> وحدد الباقة المطلوبة. يتم تفعيل الاشتراك فوراً من قبل لوحة الإدارة.
        </div>
      </div>

      {/* Pricing Cards Grid */}
      <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-12">
        
        {/* Monthly Plan */}
        <div className={`bg-white rounded-3xl p-8 border transition-all ${
          selectedPlan === 'monthly'
            ? 'border-sky-500 ring-2 ring-sky-500/20 shadow-lg'
            : 'border-slate-200 hover:border-slate-300 shadow-sm'
        }`}>
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-bold text-slate-500">الباقة الشهرية</span>
            <span className="text-xs bg-sky-50 text-sky-700 px-3 py-1 rounded-full font-bold">Monthly Plan</span>
          </div>

          <div className="flex items-baseline gap-1.5 my-4">
            <span className="text-4xl font-extrabold text-slate-900 font-['Tajawal',sans-serif]">
              {OFFICIAL_SUBSCRIPTION_PRICES.monthly}
            </span>
            <span className="text-sm font-bold text-slate-500">EGP / شهرياً</span>
          </div>

          <p className="text-xs text-slate-500 mb-6">تفعيل لمدة شهر كامل (30 يوماً)</p>

          <ul className="space-y-3 text-xs sm:text-sm text-slate-700 mb-8">
            <li className="flex items-center gap-2.5">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>عدد غير محدود من حجوزات المرضى يومياً</span>
            </li>
            <li className="flex items-center gap-2.5">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>شاشة تتبع حية (Live Realtime) لكل مريض</span>
            </li>
            <li className="flex items-center gap-2.5">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>توليد ورسم QR Code قابل للطباعة</span>
            </li>
            <li className="flex items-center gap-2.5">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>حساب تلقائي لمتوسط زمن الكشف الفعلي</span>
            </li>
            <li className="flex items-center gap-2.5">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>تنبيهات صوتية وبصرية عند اقتراب دور المريض</span>
            </li>
          </ul>

          <a
            href={getWhatsAppSubscriptionLink("الباقة الشهرية", OFFICIAL_SUBSCRIPTION_PRICES.monthly)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setSelectedPlan('monthly')}
            className="w-full inline-flex items-center justify-center gap-2 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl transition shadow-sm"
          >
            <MessageSquare className="w-4 h-4 fill-current" />
            <span>طلب تفعيل الباقة الشهرية (200 EGP)</span>
          </a>
        </div>

        {/* Yearly Plan (Best Value) */}
        <div className={`bg-slate-900 text-white rounded-3xl p-8 border relative transition-all ${
          selectedPlan === 'yearly'
            ? 'border-sky-400 ring-4 ring-sky-500/30 shadow-2xl scale-[1.02]'
            : 'border-slate-800 hover:border-slate-700 shadow-xl'
        }`}>
          <div className="absolute -top-3.5 right-6 bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 px-3.5 py-1 rounded-full text-xs font-black shadow-md">
            الأكثر توفيراً (توفير 37.5%)
          </div>

          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-bold text-sky-400">الباقة السنوية</span>
            <span className="text-xs bg-slate-800 text-slate-300 px-3 py-1 rounded-full font-bold">Yearly Plan</span>
          </div>

          <div className="flex items-baseline gap-1.5 my-4">
            <span className="text-4xl font-extrabold text-white font-['Tajawal',sans-serif]">
              {OFFICIAL_SUBSCRIPTION_PRICES.yearly}
            </span>
            <span className="text-sm font-bold text-slate-400">EGP / سنوياً</span>
          </div>

          <p className="text-xs text-slate-400 mb-6">تفعيل لمدة سنة كاملة (12 شهراً)</p>

          <ul className="space-y-3 text-xs sm:text-sm text-slate-300 mb-8">
            <li className="flex items-center gap-2.5">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>جميع ميزات الباقة الشهرية كاملة</span>
            </li>
            <li className="flex items-center gap-2.5">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>توفير 900 EGP مقارنة بالدفع الشهري</span>
            </li>
            <li className="flex items-center gap-2.5">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>أولوية الدعم الفني المباشر</span>
            </li>
            <li className="flex items-center gap-2.5">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>خصومات وإضافات حصرية على تحديثات النظام</span>
            </li>
          </ul>

          <a
            href={getWhatsAppSubscriptionLink("الباقة السنوية", OFFICIAL_SUBSCRIPTION_PRICES.yearly)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setSelectedPlan('yearly')}
            className="w-full inline-flex items-center justify-center gap-2 py-3.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-sm rounded-xl transition shadow-lg"
          >
            <MessageSquare className="w-4 h-4 fill-current" />
            <span>طلب تفعيل الباقة السنوية (1500 EGP)</span>
          </a>
        </div>

      </div>

      {/* Standalone Section: Want a custom website? */}
      <CustomWebsiteSection />

    </div>
  );
};
