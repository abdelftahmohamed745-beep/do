import React, { useState, useEffect } from 'react';
import { Stethoscope, CheckCircle2, UserX, Clock, Users, Calendar } from 'lucide-react';
import { DailySession, PatientRecord, ClinicTransaction } from '../types';
import {
  getTodayDateString,
  subscribeToTodayDailySession,
  startNewDaySession,
  completeDaySession,
  getArchivedDays,
  getArchivedDayDetails
} from '../services/firebaseService';

interface DailySessionManagerProps {
  doctorId: string;
  doctorName?: string;
  clinicName?: string;
  currentUserId?: string;
  currentUserName?: string;
  todayPatients?: PatientRecord[];
  onSessionChange?: (session: DailySession | null) => void;
  onDayCompleted?: () => void;
  onShowToast?: (title: string, message?: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export const DailySessionManager: React.FC<DailySessionManagerProps> = ({
  doctorId,
  doctorName = 'دكتور العيادة',
  clinicName = 'العيادة',
  currentUserId,
  currentUserName,
  todayPatients = [],
  onSessionChange,
  onDayCompleted,
  onShowToast
}) => {
  const today = getTodayDateString();
  const [session, setSession] = useState<DailySession | null>(null);
  const [loading, setLoading] = useState(true);

  // Complete Day Modal State
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  // Archive View State with pagination
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [archivedDays, setArchivedDays] = useState<DailySession[]>([]);
  const [archiveLimit, setArchiveLimit] = useState(15);
  const [hasMoreArchive, setHasMoreArchive] = useState(true);
  const [loadingArchive, setLoadingArchive] = useState(false);
  const [loadingMoreArchive, setLoadingMoreArchive] = useState(false);
  const [selectedArchivedDay, setSelectedArchivedDay] = useState<{
    session: DailySession | null;
    patients: PatientRecord[];
    transactions: ClinicTransaction[];
  } | null>(null);
  const [loadingArchivedDetails, setLoadingArchivedDetails] = useState(false);

  // Subscribe to today's session
  useEffect(() => {
    if (!doctorId) return;
    setLoading(true);
    const unsubscribe = subscribeToTodayDailySession(doctorId, today, (sess) => {
      setSession(sess);
      setLoading(false);
      onSessionChange?.(sess);
    });
    return () => unsubscribe();
  }, [doctorId, today]);

  // Handle Start New Day
  const handleStartDay = async () => {
    try {
      const newSess = await startNewDaySession(doctorId, today);
      setSession(newSess);
      onSessionChange?.(newSess);
      if (onShowToast) {
        onShowToast('تم بدء يوم عمل جديد بنجاح', `تاريخ الجلسة: ${today} • يمكنك الآن استقبال المرضى`, 'success');
      }
    } catch (err: any) {
      if (onShowToast) onShowToast('تعذر بدء اليوم', err?.message, 'error');
    }
  };

  const isCompletedToday = session?.status === 'completed';

  // Compute live aggregates from queue (or strictly zero if day is ended)
  const waitingCount = isCompletedToday ? 0 : todayPatients.filter((p) => p.status === 'waiting').length;
  const inConsultCount = isCompletedToday ? 0 : todayPatients.filter((p) => p.status === 'called').length;
  const completedCount = isCompletedToday ? 0 : todayPatients.filter((p) => p.status === 'done').length;
  const noShowCount = isCompletedToday ? 0 : todayPatients.filter((p) => p.status === 'no_show').length;
  const totalPatientsCount = isCompletedToday ? 0 : todayPatients.length;
  const totalRevenue = isCompletedToday ? 0 : (session?.totalRevenue || 0);
  const totalCollected = isCompletedToday ? 0 : (session?.totalCollected || 0);
  const outstandingBalance = isCompletedToday ? 0 : (session?.outstandingBalance || 0);

  // Handle Complete Day & Archive atomically
  const handleConfirmCompleteDay = async () => {
    setIsCompleting(true);
    try {
      const summaryToSave: Partial<DailySession> = {
        patientsCount: todayPatients.length,
        waitingCount: todayPatients.filter((p) => p.status === 'waiting').length,
        inConsultationCount: todayPatients.filter((p) => p.status === 'called').length,
        completedCount: todayPatients.filter((p) => p.status === 'done').length,
        noShowCount: todayPatients.filter((p) => p.status === 'no_show').length,
        totalRevenue: session?.totalRevenue || 0,
        totalCollected: session?.totalCollected || 0,
        outstandingBalance: session?.outstandingBalance || 0,
        paymentBreakdown: session?.paymentBreakdown || { cash: 0, card: 0, transfer: 0, other: 0 },
        serviceBreakdown: session?.serviceBreakdown || {}
      };

      await completeDaySession(
        doctorId,
        today,
        summaryToSave,
        todayPatients,
        currentUserId,
        currentUserName || doctorName
      );

      const zeroedSession: DailySession = {
        id: today,
        date: today,
        doctorId,
        status: 'completed',
        startedAt: session?.startedAt || new Date().toISOString(),
        patientsCount: 0,
        waitingCount: 0,
        inConsultationCount: 0,
        completedCount: 0,
        followUpsCount: 0,
        noShowCount: 0,
        cancelledCount: 0,
        totalRevenue: 0,
        totalCollected: 0,
        outstandingCollected: 0,
        outstandingBalance: 0,
        completedAt: new Date().toISOString(),
        paymentBreakdown: { cash: 0, card: 0, transfer: 0, other: 0 },
        serviceBreakdown: {}
      };

      setSession(zeroedSession);
      onSessionChange?.(zeroedSession);
      if (onDayCompleted) onDayCompleted();

      setShowCompleteModal(false);
      if (onShowToast) {
        onShowToast('تم إنهاء اليوم وأرشفته بنجاح', 'تم تصفير العدادات وإخلاء الطابور وحفظ السجلات في الأرشيف', 'success');
      }
    } catch (err: any) {
      if (onShowToast) onShowToast('تعذر إنهاء اليوم', err?.message, 'error');
    } finally {
      setIsCompleting(false);
    }
  };

  // Load Archive List with pagination
  const handleOpenArchive = async () => {
    setShowArchiveModal(true);
    setSelectedArchivedDay(null);
    setLoadingArchive(true);
    setArchiveLimit(15);
    try {
      const days = await getArchivedDays(doctorId, 15);
      setArchivedDays(days);
      setHasMoreArchive(days.length >= 15);
    } catch (err) {
      console.warn('Error loading archive:', err);
    } finally {
      setLoadingArchive(false);
    }
  };

  const handleLoadMoreArchive = async () => {
    const nextLimit = archiveLimit + 15;
    setLoadingMoreArchive(true);
    try {
      const days = await getArchivedDays(doctorId, nextLimit);
      setArchivedDays(days);
      setArchiveLimit(nextLimit);
      setHasMoreArchive(days.length >= nextLimit);
    } catch (err) {
      console.warn('Error loading more archive:', err);
    } finally {
      setLoadingMoreArchive(false);
    }
  };

  // View specific archived day details
  const handleViewArchivedDay = async (dateStr: string) => {
    setLoadingArchivedDetails(true);
    try {
      const details = await getArchivedDayDetails(doctorId, dateStr);
      setSelectedArchivedDay(details);
    } catch (err) {
      console.error('Error fetching day details:', err);
    } finally {
      setLoadingArchivedDetails(false);
    }
  };

  const isActive = session?.status === 'active';

  return (
    <div id="daily-session-manager" className="space-y-4 text-right" dir="rtl">
      
      {/* Session Header Card */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Status & Date */}
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
                isActive
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                  : isCompletedToday
                  ? 'bg-blue-50 border-blue-200 text-blue-600'
                  : 'bg-amber-50 border-amber-200 text-amber-600'
              }`}
            >
              <span className="text-2xl leading-none inline-flex items-center justify-center">📅</span>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold border ${
                    isActive
                      ? 'bg-emerald-100/70 border-emerald-300 text-emerald-800'
                      : isCompletedToday
                      ? 'bg-blue-100/70 border-blue-300 text-blue-800'
                      : 'bg-amber-100/70 border-amber-300 text-amber-800'
                  }`}
                >
                  {isActive
                    ? 'جلسة اليوم نشطة (Active Day)'
                    : isCompletedToday
                    ? 'تم إنهاء يوم العمل وأرشفته'
                    : 'يوم جديد — بانتظار البدء'}
                </span>
                <span className="text-xs text-slate-500 font-mono">{today}</span>
              </div>
              <h3 className="text-lg sm:text-xl font-black text-slate-900 font-['Tajawal',sans-serif]">
                إدارة يوم العمل وجلسة العيادة
              </h3>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Archive Button */}
            <button
              type="button"
              onClick={handleOpenArchive}
              className="px-3.5 py-2 min-h-[40px] rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <span className="text-base leading-none inline-flex items-center justify-center">🗂️</span>
              <span>أرشيف الأيام السابقة</span>
            </button>

            {/* Start Day Button - remains accessible when session is not currently active, even after completing day */}
            {!isActive && (
              <button
                type="button"
                onClick={handleStartDay}
                className="px-4 sm:px-5 py-2 sm:py-2.5 min-h-[40px] bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-2xl text-xs sm:text-sm font-extrabold transition shadow-md shadow-emerald-600/20 flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <span className="text-base leading-none inline-flex items-center justify-center">▶️</span>
                <span>بدء يوم عمل جديد</span>
              </button>
            )}

            {/* Complete Day Button */}
            {isActive && (
              <button
                type="button"
                onClick={() => setShowCompleteModal(true)}
                className="px-3.5 sm:px-4 py-2 sm:py-2.5 min-h-[40px] bg-gradient-to-r from-slate-800 to-slate-900 hover:from-slate-900 hover:to-black text-white rounded-2xl text-xs sm:text-sm font-extrabold transition shadow-md shadow-slate-900/20 flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <span className="text-base leading-none inline-flex items-center justify-center">✅</span>
                <span className="hidden sm:inline">إنهاء اليوم وحفظ التقرير (Complete Day)</span>
                <span className="sm:hidden">إنهاء اليوم</span>
              </button>
            )}
          </div>
        </div>

        {/* Real-time KPI Counters Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 sm:gap-2.5 lg:gap-3 mt-4 sm:mt-5 pt-4 border-t border-slate-100">
          
          {/* Total Patients (Indigo #6366F1: patients, visits, primary operational statistics) */}
          <div className="bg-white p-2.5 sm:p-3 rounded-2xl border border-slate-200/80 shadow-xs">
            <span className="text-[11px] text-slate-500 font-bold flex items-center gap-1 mb-1">
              <span className="text-sm leading-none inline-flex items-center justify-center">👥</span>
              <span>إجمالي الحالات</span>
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-lg sm:text-xl font-black text-[#6366F1] font-mono">{totalPatientsCount}</span>
              <span className="text-[10px] text-indigo-400">حالة</span>
            </div>
          </div>

          {/* In Waiting (Orange #F59E0B: pending actions, attention-required states) */}
          <div className="bg-white p-2.5 sm:p-3 rounded-2xl border border-slate-200/80 shadow-xs">
            <span className="text-[11px] text-slate-500 font-bold flex items-center gap-1 mb-1">
              <span className="text-sm leading-none inline-flex items-center justify-center">⏳</span>
              <span>في الانتظار</span>
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-lg sm:text-xl font-black text-[#F59E0B] font-mono">{waitingCount}</span>
              <span className="text-[10px] text-amber-500">ينتظر</span>
            </div>
          </div>

          {/* In Consultation */}
          <div className="bg-white p-2.5 sm:p-3 rounded-2xl border border-slate-200/80 shadow-xs">
            <span className="text-[11px] text-slate-500 font-bold flex items-center gap-1 mb-1">
              <Stethoscope className="w-3.5 h-3.5 text-sky-600 shrink-0" />
              <span>في الكشف</span>
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-lg sm:text-xl font-black text-sky-700 font-mono">{inConsultCount}</span>
              <span className="text-[10px] text-slate-400">حالة</span>
            </div>
          </div>

          {/* Completed */}
          <div className="bg-white p-2.5 sm:p-3 rounded-2xl border border-slate-200/80 shadow-xs">
            <span className="text-[11px] text-slate-500 font-bold flex items-center gap-1 mb-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>تم الكشف</span>
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-lg sm:text-xl font-black text-emerald-600 font-mono">{completedCount}</span>
              <span className="text-[10px] text-emerald-500">كشف</span>
            </div>
          </div>

          {/* No Show */}
          <div className="bg-white p-2.5 sm:p-3 rounded-2xl border border-slate-200/80 shadow-xs">
            <span className="text-[11px] text-slate-500 font-bold flex items-center gap-1 mb-1">
              <UserX className="w-3.5 h-3.5 text-rose-500 shrink-0" />
              <span>لم يحضر</span>
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-lg sm:text-xl font-black text-[#EF4444] font-mono">{noShowCount}</span>
              <span className="text-[10px] text-rose-400">تغيّب</span>
            </div>
          </div>

          {/* Total Revenue (Green #10B981: revenue, payments, collected money) */}
          <div className="bg-white p-2.5 sm:p-3 rounded-2xl border border-slate-200/80 shadow-xs">
            <span className="text-[11px] text-slate-500 font-bold flex items-center gap-1 mb-1">
              <span className="text-sm leading-none inline-flex items-center justify-center">💰</span>
              <span>إيراد اليوم</span>
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-lg sm:text-xl font-black text-[#10B981] font-mono">
                {totalCollected}
              </span>
              <span className="text-[10px] text-emerald-500">ج.م</span>
            </div>
          </div>

          {/* Outstanding (Red #EF4444: expenses, outgoing money, negative financial results) */}
          <div className="bg-white p-2.5 sm:p-3 rounded-2xl border border-slate-200/80 shadow-xs col-span-2 sm:col-span-1">
            <span className="text-[11px] text-slate-500 font-bold flex items-center gap-1 mb-1">
              <span className="text-sm leading-none inline-flex items-center justify-center">💵</span>
              <span>المتبقي المطلوب</span>
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-lg sm:text-xl font-black text-[#EF4444] font-mono">
                {outstandingBalance}
              </span>
              <span className="text-[10px] text-rose-400">ج.م</span>
            </div>
          </div>

        </div>
      </div>

      {/* Complete Day Confirmation Modal */}
      {showCompleteModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-bold mb-1 inline-block">
                  تقرير إغلاق يوم العمل
                </span>
                <h3 className="text-xl font-extrabold text-slate-900 font-['Tajawal',sans-serif]">
                  تأكيد إنهاء يوم العمل — {today}
                </h3>
              </div>
              <button
                onClick={() => setShowCompleteModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer text-base leading-none font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              سيتم أرشفة إحصائيات جلسة اليوم وتجميد اليوم كجلسة منتهية. يمكنك مراجعة البيانات في أي وقت من خلال الأرشيف.
            </p>

            {/* Summary Breakdown Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
                <span className="text-slate-500 block mb-0.5">إجمالي الحالات</span>
                <strong className="text-lg font-black text-[#6366F1] font-mono">{totalPatientsCount}</strong>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
                <span className="text-slate-500 block mb-0.5">الكشوفات المكتملة</span>
                <strong className="text-lg font-black text-[#8B5CF6] font-mono">{completedCount}</strong>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
                <span className="text-slate-500 block mb-0.5">المرضى المتغيبين</span>
                <strong className="text-lg font-black text-[#EF4444] font-mono">{noShowCount}</strong>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
                <span className="text-slate-500 block mb-0.5">إجمالي الإيرادات</span>
                <strong className="text-lg font-black text-[#10B981] font-mono">
                  {session?.totalRevenue || 0} ج.م
                </strong>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
                <span className="text-slate-500 block mb-0.5">المحصل نقدًا وبطاقات</span>
                <strong className="text-lg font-black text-[#10B981] font-mono">
                  {session?.totalCollected || 0} ج.م
                </strong>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
                <span className="text-slate-500 block mb-0.5">المتبقي على الحسابات</span>
                <strong className="text-lg font-black text-[#EF4444] font-mono">
                  {session?.outstandingBalance || 0} ج.م
                </strong>
              </div>
            </div>

            {/* Payment Methods Breakdown */}
            {session?.paymentBreakdown && (
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                <span className="font-bold text-slate-800 block mb-2">توزيع وسائل الدفع اليوم:</span>
                <div className="grid grid-cols-3 gap-2 text-center font-mono">
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">كاش</span>
                    <strong className="text-slate-900">{session.paymentBreakdown.cash || 0} ج.م</strong>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">فيزا / كارت</span>
                    <strong className="text-slate-900">{session.paymentBreakdown.card || 0} ج.م</strong>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">تحويل بنكي</span>
                    <strong className="text-slate-900">{session.paymentBreakdown.transfer || 0} ج.م</strong>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowCompleteModal(false)}
                className="px-4 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmCompleteDay}
                disabled={isCompleting}
                className="px-6 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-extrabold shadow-md transition cursor-pointer disabled:opacity-50"
              >
                {isCompleting ? 'جاري الأرشفة...' : 'تأكيد إغلاق اليوم والأرشفة'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Archived Days Modal */}
      {showArchiveModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-4xl w-full p-6 space-y-5 animate-in fade-in max-h-[90vh] flex flex-col">
            
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-bold mb-1 inline-block">
                  الأيام السابقة المؤرشفة
                </span>
                <h3 className="text-xl font-extrabold text-slate-900 font-['Tajawal',sans-serif]">
                  سجل أرشيف أيام العمل
                </h3>
              </div>
              <button
                onClick={() => setShowArchiveModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer text-base leading-none font-bold"
              >
                ✕
              </button>
            </div>

            {/* Archive Content */}
            <div className="flex-1 overflow-y-auto space-y-4">
              {selectedArchivedDay ? (
                <div className="space-y-4">
                  <button
                    type="button"
                    onClick={() => setSelectedArchivedDay(null)}
                    className="text-xs font-bold text-sky-600 hover:underline flex items-center gap-1.5 cursor-pointer"
                  >
                    <span className="text-sm leading-none inline-flex items-center justify-center">➡️</span>
                    <span>العودة إلى قائمة الأيام</span>
                  </button>

                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs space-y-3">
                    <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2">
                      <h4 className="text-base font-black text-slate-900">
                        تقرير يوم {selectedArchivedDay.session?.date} ({selectedArchivedDay.session?.dayName || ''})
                      </h4>
                      <span className="text-slate-500 font-mono text-xs">
                        مغلق بواسطة: {selectedArchivedDay.session?.completedByName || 'طبيب العيادة'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center font-mono pt-2 border-t border-slate-200">
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-xs">
                        <span className="text-slate-500 block text-[10px]">إجمالي الحالات</span>
                        <strong className="text-[#6366F1] text-sm">
                          {selectedArchivedDay.session?.patientsCount || selectedArchivedDay.patients.length}
                        </strong>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-xs">
                        <span className="text-slate-500 block text-[10px]">الكشوفات المكتملة</span>
                        <strong className="text-[#8B5CF6] text-sm">
                          {selectedArchivedDay.session?.completedCount || 0}
                        </strong>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-xs">
                        <span className="text-slate-500 block text-[10px]">الإيراد المحصل</span>
                        <strong className="text-[#10B981] text-sm">
                          {selectedArchivedDay.session?.totalCollected || 0} ج.م
                        </strong>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-xs">
                        <span className="text-slate-500 block text-[10px]">المتبقي المطلوب</span>
                        <strong className="text-[#EF4444] text-sm">
                          {selectedArchivedDay.session?.outstandingBalance || 0} ج.م
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Patient list of that archived day */}
                  <div>
                    <h5 className="font-bold text-slate-800 text-xs mb-2">قائمة المرضى في هذا اليوم:</h5>
                    <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                      {selectedArchivedDay.patients.map((p) => (
                        <div
                          key={p.id}
                          className="bg-white p-2.5 rounded-xl border border-slate-200 text-xs flex flex-wrap sm:flex-nowrap items-center justify-between gap-2"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center font-bold text-slate-700 font-mono text-[11px] shrink-0">
                              #{p.sequenceNumber}
                            </span>
                            <span className="font-bold text-slate-900 truncate">{p.name}</span>
                            <span className="text-slate-400 font-mono text-[11px] shrink-0">{p.phone}</span>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[11px] font-bold shrink-0 ${
                              p.status === 'done'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : p.status === 'no_show'
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}
                          >
                            {p.status === 'done' ? 'تم الكشف' : p.status === 'no_show' ? 'لم يحضر' : p.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : loadingArchive ? (
                <div className="py-12 text-center text-xs text-slate-400">جاري تحميل الأرشيف...</div>
              ) : archivedDays.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500 bg-slate-50 rounded-2xl border border-slate-200">
                  لا توجد أيام مؤرشفة حتى الآن. عندما تقوم بـ "إنهاء اليوم" سيتم حفظه هنا تلقائيًا.
                </div>
              ) : (
                <div className="space-y-2">
                  {archivedDays.map((d) => (
                    <div
                      key={d.id}
                      onClick={() => handleViewArchivedDay(d.date)}
                      className="bg-white hover:bg-slate-50 p-4 rounded-2xl border border-slate-200 transition flex items-center justify-between gap-3 cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 font-mono text-xs font-bold shrink-0">
                          <span className="text-lg leading-none inline-flex items-center justify-center">📅</span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-slate-900 text-sm font-mono">{d.date}</span>
                            {d.dayName && <span className="text-xs text-slate-500">({d.dayName})</span>}
                          </div>
                          <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5 font-mono">
                            <span>الحالات: {d.patientsCount || 0}</span>
                            <span>الكشوفات: {d.completedCount || 0}</span>
                            <span>المتحصل: {d.totalCollected || 0} ج.م</span>
                          </div>
                        </div>
                      </div>

                      <span className="text-base text-slate-400 leading-none inline-flex items-center justify-center">⬅️</span>
                    </div>
                  ))}

                  {hasMoreArchive && (
                    <div className="pt-2 text-center">
                      <button
                        type="button"
                        onClick={handleLoadMoreArchive}
                        disabled={loadingMoreArchive}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer disabled:opacity-50"
                      >
                        {loadingMoreArchive ? 'جاري تحميل المزيد...' : 'تحميل المزيد من الأيام 📜'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
