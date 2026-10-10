import React, { useState, useEffect } from 'react';
import {
  Monitor,
  Maximize2,
  Minimize2,
  X,
  Volume2,
  Users,
  Clock,
  Building2,
  ShieldCheck,
  Stethoscope
} from 'lucide-react';
import { PatientRecord } from '../types';

interface TVQueueDisplayProps {
  clinicName: string;
  doctorName: string;
  specialty: string;
  patients: PatientRecord[];
  onClose: () => void;
}

export const TVQueueDisplay: React.FC<TVQueueDisplayProps> = ({
  clinicName,
  doctorName,
  specialty,
  patients,
  onClose
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(console.error);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().then(() => setIsFullscreen(false)).catch(console.error);
      }
    }
  };

  const calledPatient = patients.find((p) => p.status === 'called');
  const waitingPatients = patients.filter((p) => p.status === 'waiting');
  const nextPatient = waitingPatients[0];
  const upcomingPatients = waitingPatients.slice(1, 6);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col font-['Tajawal',sans-serif] overflow-hidden dir-rtl select-none">
      
      {/* Top TV Bar */}
      <header className="bg-slate-900/90 border-b border-slate-800 px-4 sm:px-10 py-3 sm:py-5 flex flex-wrap sm:flex-nowrap items-center justify-between shadow-2xl shrink-0 gap-3">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-teal-600 flex items-center justify-center text-white shadow-lg shadow-teal-900/50 shrink-0">
            <Stethoscope className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-2xl font-black tracking-tight text-white truncate">{clinicName}</h1>
            <p className="text-xs sm:text-sm font-semibold text-slate-400 mt-0.5 truncate">
              {doctorName} • <span className="text-teal-400">{specialty}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-6 shrink-0">
          {/* Live Clock */}
          <div className="text-left font-mono">
            <div className="text-base sm:text-2xl font-black text-teal-400 dir-ltr">
              {currentTime.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <div className="text-[10px] sm:text-xs text-slate-400 font-medium dir-ltr">
              {currentTime.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })}
            </div>
          </div>

          {/* Full Screen & Close Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleFullscreen}
              className="p-2 sm:p-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-2xl transition border border-slate-700 flex items-center gap-2 text-xs font-bold cursor-pointer"
              title="ملء الشاشة للتلفزيون"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4 sm:w-5 sm:h-5" /> : <Maximize2 className="w-4 h-4 sm:w-5 sm:h-5" />}
              <span className="hidden sm:inline">{isFullscreen ? 'إنهاء ملء الشاشة' : 'ملء الشاشة'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 sm:p-3 bg-rose-950 hover:bg-rose-900 text-rose-200 rounded-2xl transition border border-rose-800 cursor-pointer"
              title="إغلاق الشاشة"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main TV Display Stage */}
      <div className="flex-1 p-6 sm:p-10 grid lg:grid-cols-12 gap-8 items-stretch min-h-0 overflow-y-auto">
        
        {/* CURRENT TURN CARD (HERO) */}
        <div className="lg:col-span-7 bg-gradient-to-b from-slate-900 to-slate-900/95 border-2 border-teal-500/80 rounded-3xl p-8 sm:p-12 flex flex-col justify-between shadow-2xl relative overflow-hidden">
          
          <div className="flex items-center justify-between mb-6">
            <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-teal-500/20 border border-teal-400/40 text-teal-300 font-extrabold text-sm sm:text-base">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-teal-500"></span>
              </span>
              <span>الدور الحالي داخل العيادة</span>
            </div>

            <div className="text-slate-400 text-sm font-bold flex items-center gap-2 bg-slate-800/80 px-4 py-2 rounded-2xl border border-slate-700">
              <Users className="w-4 h-4 text-teal-400" />
              <span>إجمالي المتبقين: {waitingPatients.length} مريض</span>
            </div>
          </div>

          {calledPatient ? (
            <div className="my-auto text-center space-y-6 py-6">
              <div className="text-sm sm:text-lg font-bold text-slate-400 tracking-wider">
                يرجى التفضل بالدخول للطبيب
              </div>

              {/* HUGE TURN NUMBER */}
              <div className="text-8xl sm:text-9xl font-black text-amber-400 font-mono tracking-tighter drop-shadow-[0_10px_25px_rgba(251,191,36,0.25)]">
                #{calledPatient.sequenceNumber}
              </div>

              {/* PATIENT NAME */}
              <div className="text-3xl sm:text-5xl font-black text-white font-['Tajawal',sans-serif] tracking-tight break-words px-2">
                {calledPatient.name}
              </div>
            </div>
          ) : (
            <div className="my-auto text-center py-16 space-y-4">
              <Clock className="w-20 h-20 text-slate-600 mx-auto animate-pulse" />
              <h2 className="text-2xl sm:text-4xl font-black text-slate-300">لا يوجد مريض داخل العيادة حالياً</h2>
              <p className="text-sm text-slate-500">سيتم استدعاء الرقم التالي فور جاهزية الطبيب</p>
            </div>
          )}

          {/* Bottom Bar inside Hero */}
          <div className="pt-6 border-t border-slate-800 flex items-center justify-between text-xs sm:text-sm text-slate-400">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-teal-400" />
              <span>نظام دوري الرقمي لحجز العيادات</span>
            </div>
            <div className="font-mono text-slate-500">
              شاشة العرض المباشرة V2.0
            </div>
          </div>

        </div>

        {/* UPCOMING QUEUE SIDEBAR */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          
          {/* NEXT UP CARD */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 flex items-center justify-between shadow-xl gap-3">
            <div className="min-w-0">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                المريض القادم (التالي)
              </span>
              {nextPatient ? (
                <div>
                  <div className="text-2xl sm:text-3xl font-black text-teal-400 font-['Tajawal',sans-serif] break-words">
                    {nextPatient.name}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    يرجى الاستعداد للدخول
                  </div>
                </div>
              ) : (
                <div className="text-base font-bold text-slate-500">
                  لا يوجد مريض قادم
                </div>
              )}
            </div>

            {nextPatient && (
              <div className="w-20 h-20 bg-teal-950 border border-teal-800 text-teal-300 font-mono font-black text-3xl rounded-2xl flex items-center justify-center shadow-lg shrink-0">
                #{nextPatient.sequenceNumber}
              </div>
            )}
          </div>

          {/* QUEUE LIST */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 flex-1 flex flex-col min-h-0 shadow-xl">
            <h3 className="text-sm font-black text-slate-300 mb-4 flex items-center gap-2 pb-3 border-b border-slate-800">
              <Users className="w-4 h-4 text-teal-400" />
              <span>أدوار الانتظار القادمة</span>
            </h3>

            {upcomingPatients.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-500 space-y-2">
                <p className="text-xs font-bold">لا توجد منتظرون إضافيون في الطابور</p>
              </div>
            ) : (
              <div className="space-y-3 overflow-y-auto pr-1">
                {upcomingPatients.map((p, idx) => (
                  <div
                    key={p.id}
                    className="bg-slate-950 border border-slate-800/80 p-4 rounded-2xl flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-7 h-7 rounded-xl bg-slate-800 text-slate-400 text-xs font-bold flex items-center justify-center font-mono shrink-0">
                        {idx + 2}
                      </span>
                      <span className="font-bold text-slate-200 text-sm sm:text-base truncate">{p.name}</span>
                    </div>

                    <span className="font-mono font-bold text-teal-400 bg-teal-950/80 px-3 py-1 rounded-xl border border-teal-900 text-sm shrink-0">
                      #{p.sequenceNumber}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
};
