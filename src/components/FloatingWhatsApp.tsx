import React, { useState, useEffect } from 'react';

export const FloatingWhatsApp: React.FC = () => {
  const [status, setStatus] = useState<{
    isOnline: boolean;
    label: string;
    subtext: string;
    bgDot: string;
  }>({
    isOnline: true,
    label: 'متصل الأن',
    subtext: 'رد فوري',
    bgDot: 'bg-emerald-400',
  });

  useEffect(() => {
    const checkStatus = () => {
      const currentHour = new Date().getHours();
      // Active support hours: 9 AM (09:00) to 11 PM (23:00)
      const online = currentHour >= 9 && currentHour < 23;
      if (online) {
        setStatus({
          isOnline: true,
          label: 'متصل الأن',
          subtext: 'رد فوري واستجابة سريعة',
          bgDot: 'bg-emerald-400',
        });
      } else {
        setStatus({
          isOnline: false,
          label: 'مشغول حالياً',
          subtext: 'خارج ساعات العمل - قد يتأخر الرد',
          bgDot: 'bg-amber-400',
        });
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 60000);
    return () => clearInterval(interval);
  }, []);

  const whatsappUrl = `https://wa.me/201032120351?text=${encodeURIComponent('مرحبًا، أريد التواصل والاستفسار عن نظام دوري للعيادات')}`;

  return (
    <a
      href={whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-4 left-4 sm:bottom-6 sm:left-6 z-40 flex items-center gap-2.5 px-3.5 py-2 sm:px-4 sm:py-2.5 bg-emerald-700/95 hover:bg-emerald-600 text-white font-bold rounded-full shadow-xl shadow-emerald-950/30 border border-emerald-400/30 backdrop-blur-md transition-all duration-300 hover:scale-105 active:scale-95 group select-none"
      aria-label="تواصل معنا عبر واتساب"
    >
      <div className="relative flex items-center justify-center shrink-0">
        <span className="text-xl sm:text-2xl leading-none inline-flex items-center justify-center">💬</span>
        <span className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 ${status.bgDot} rounded-full animate-ping opacity-75`} />
        <span className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 ${status.bgDot} rounded-full border-2 border-emerald-800`} />
      </div>

      <div className="flex flex-col text-right font-['Tajawal',sans-serif]">
        <div className="flex items-center gap-1.5 leading-tight">
          <span className="text-xs sm:text-sm font-extrabold text-white">الدعم الفني</span>
          <span
            className={`text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full ${
              status.isOnline
                ? 'bg-emerald-500/30 text-emerald-200 border border-emerald-400/40'
                : 'bg-amber-500/30 text-amber-200 border border-amber-400/40'
            }`}
          >
            {status.label}
          </span>
        </div>
        <span className="text-[10px] sm:text-[11px] font-medium text-emerald-100/90 flex items-center gap-1 mt-0.5">
          <span className="text-[11px] leading-none inline-flex items-center justify-center">
            {status.isOnline ? '⚡' : '⏱️'}
          </span>
          <span className="hidden sm:inline">{status.subtext}</span>
          <span className="sm:hidden">{status.isOnline ? 'رد فوري' : 'خارج العمل'}</span>
        </span>
      </div>
    </a>
  );
};


