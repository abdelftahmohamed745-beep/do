import React, { useState, useEffect } from 'react';
import { Globe, ArrowLeft, MessageSquare, X } from 'lucide-react';

export const CustomWebsiteSection: React.FC = () => {
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem('dory_promo_dismissed');
      if (dismissed === 'true') {
        setIsDismissed(true);
      }
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      localStorage.setItem('dory_promo_dismissed', 'true');
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }
  };

  if (isDismissed) return null;

  const customWebsiteMessage = "مرحبًا، أريد إنشاء موقع مخصص لعيادتي / معملي. أريد معرفة التفاصيل والأسعار.";
  const whatsappUrl = `https://wa.me/201032120351?text=${encodeURIComponent(customWebsiteMessage)}`;

  return (
    <div className="bg-[#122c4a] text-white rounded-2xl p-5 sm:p-6 border border-[#1b3a5c] shadow-2xs relative overflow-hidden my-6">
      
      {/* Close Button */}
      <button
        onClick={handleDismiss}
        className="absolute top-4 left-4 w-7 h-7 bg-[#0d223a] hover:bg-[#1b3a5c] text-slate-300 hover:text-white rounded-lg flex items-center justify-center transition border border-[#1b3a5c] cursor-pointer z-20 active:scale-95"
        title="إغلاق التنويه"
        aria-label="إغلاق"
      >
        <X className="w-3.5 h-3.5" />
      </button>

      <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-4 pl-6 sm:pl-10">
        <div className="text-right space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-300 font-bold text-[11px]">
            <Globe className="w-3.5 h-3.5 text-teal-400" />
            <span>خدمات المتاجر والمواقع الطبية المخصصة</span>
          </div>
          
          <h2 className="text-base sm:text-lg font-bold font-['Tajawal',sans-serif] text-white">
            تريد موقعاً إلكترونياً مخصصاً لعيادتك أو معملك؟
          </h2>
          
          <p className="text-slate-300 text-xs leading-relaxed max-w-xl">
            تصميم وتطوير موقع يتوافق مع هويتك الطبية ونظام حجز مواعيد مخصص لاحتياجات عيادتك.
          </p>
        </div>

        <div className="shrink-0 w-full sm:w-auto">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all active:scale-[0.98] group border border-emerald-500/30 shadow-2xs"
          >
            <MessageSquare className="w-3.5 h-3.5 fill-current" />
            <span>تواصل معنا عبر واتساب</span>
            <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-1" />
          </a>
        </div>
      </div>
    </div>
  );
};
