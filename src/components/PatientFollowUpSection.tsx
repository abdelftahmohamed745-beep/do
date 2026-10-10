import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  User,
  Building2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Bell,
  RefreshCw,
  FileText,
  ChevronLeft,
  Info,
  Smartphone,
  X
} from 'lucide-react';
import { FollowUpAppointment, FollowUpAppointmentStatus } from '../types';
import {
  subscribeToPatientFollowUps,
  updateFollowUpAppointmentStatus,
  requestRescheduleFollowUp
} from '../services/firebaseService';

interface PatientFollowUpSectionProps {
  patientPhone: string;
  patientId?: string;
  onShowToast?: (title: string, message?: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export const PatientFollowUpSection: React.FC<PatientFollowUpSectionProps> = ({
  patientPhone,
  patientId,
  onShowToast
}) => {
  const [appointments, setAppointments] = useState<FollowUpAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Reschedule state modal
  const [rescheduleItem, setRescheduleItem] = useState<FollowUpAppointment | null>(null);
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('17:00');
  const [rescheduleLoading, setRescheduleLoading] = useState(false);

  // Push notification permission state
  const [pushPermission, setPushPermission] = useState<NotificationPermission>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  );

  useEffect(() => {
    if (!patientPhone && !patientId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeToPatientFollowUps({ phone: patientPhone, patientId }, (data) => {
      setAppointments(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [patientPhone, patientId]);

  // Request browser Web Push notification permission
  const handleEnablePushNotifications = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      if (onShowToast) onShowToast("المتصفح لا يدعم إشعارات الويب", "يمكنك متابعة التنبيهات دائماً من داخل الموقع", "info");
      return;
    }

    try {
      const perm = await Notification.requestPermission();
      setPushPermission(perm);
      if (perm === 'granted') {
        if (onShowToast) onShowToast("تم تفعيل إشعارات الجهاز بنجاح", "ستتلقى تذكيرات بمواعيد إعادة الكشف على جهازك", "success");
      } else if (perm === 'denied') {
        if (onShowToast) onShowToast("تم رفض إذن الإشعارات", "ستظهر التنبيهات دائماً داخل الموقع عند زيارته", "warning");
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Handle patient confirm attendance
  const handleConfirmAttendance = async (appointmentId: string) => {
    try {
      await updateFollowUpAppointmentStatus(appointmentId, 'confirmed');
      if (onShowToast) {
        onShowToast("تم تأكيد حضورك للموعد بنجاح", "نتطلع لاستقبالك في العيادة بالمعد المحدد", "success");
      }
    } catch (err: any) {
      if (onShowToast) onShowToast("فشل تأكيد الحضور", err?.message || "تعذر الاتصال", "error");
    }
  };

  // Handle patient cancel appointment
  const handleCancelAppointment = async (appointmentId: string) => {
    if (!window.confirm("هل أنت أصلًا متأكد من إلغاء موعد إعادة الكشف هذا؟")) {
      return;
    }

    try {
      await updateFollowUpAppointmentStatus(appointmentId, 'cancelled');
      if (onShowToast) {
        onShowToast("تم إلغاء موعد إعادة الكشف", "يمكنك التواصل مع العيادة لحجز موعد جديد في أي وقت", "info");
      }
    } catch (err: any) {
      if (onShowToast) onShowToast("فشل إلغاء الموعد", err?.message, "error");
    }
  };

  // Handle submit reschedule request
  const handleSubmitReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rescheduleItem || !newDate || !newTime) return;

    setRescheduleLoading(true);
    try {
      await requestRescheduleFollowUp(rescheduleItem.id, newDate, newTime);
      if (onShowToast) {
        onShowToast("تم إرسال طلب تغيير الموعد بنجاح", `التاريخ المقترح: ${newDate} - الساعة: ${newTime}`, "success");
      }
      setRescheduleItem(null);
    } catch (err: any) {
      if (onShowToast) onShowToast("فشل طلب تغيير الموعد", err?.message || "حاول مجدداً", "error");
    } finally {
      setRescheduleLoading(false);
    }
  };

  // Badge mapping for statuses
  const getStatusBadge = (status: FollowUpAppointmentStatus, rescheduleRequested?: boolean) => {
    if (rescheduleRequested) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          <span>جاري مراجعة طلب التغيير</span>
        </span>
      );
    }

    switch (status) {
      case 'upcoming':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-sky-50 text-sky-800 border border-sky-200">
            <Clock className="w-3.5 h-3.5 text-sky-600" />
            <span>قادم</span>
          </span>
        );
      case 'confirmed':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>تم التأكيد</span>
          </span>
        );
      case 'attended':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-teal-50 text-teal-800 border border-teal-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
            <span>تم الحضور</span>
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200">
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
            <span>تم الإلغاء</span>
          </span>
        );
      case 'no_show':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
            <AlertCircle className="w-3.5 h-3.5 text-slate-500" />
            <span>لم يحضر</span>
          </span>
        );
      default:
        return null;
    }
  };

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-xl space-y-6 text-right">
      
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-sky-50 text-sky-800 rounded-full text-xs font-bold border border-sky-200 mb-2">
            <Calendar className="w-3.5 h-3.5 text-sky-600" />
            <span>مواعيدي القادمة ومتابعة الاستشارات</span>
          </div>
          <h3 className="text-xl font-extrabold text-slate-900 font-['Tajawal',sans-serif]">
            مواعيد إعادة الكشف
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            جدول استشارات ومواعيد إعادة الكشف المحجوزة لك في العيادات
          </p>
        </div>

        {/* Push notification banner toggle */}
        {pushPermission !== 'granted' && (
          <button
            onClick={handleEnablePushNotifications}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-amber-50 to-orange-50 hover:from-amber-100 hover:to-orange-100 border border-amber-200 text-amber-900 rounded-2xl text-xs font-bold transition shadow-2xs cursor-pointer"
            title="تفعيل الإشعارات للتنبيه المباشر"
          >
            <Smartphone className="w-4 h-4 text-amber-600" />
            <span>تفعيل تنبيهات الهاتف والموقع</span>
          </button>
        )}
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="py-12 text-center text-slate-400 space-y-3">
          <div className="w-8 h-8 border-3 border-sky-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <span className="text-xs font-bold block">جاري تحميل مواعيد إعادة الكشف...</span>
        </div>
      ) : appointments.length === 0 ? (
        /* Empty State */
        <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
          <Calendar className="w-10 h-10 text-slate-300 mx-auto" />
          <h4 className="font-bold text-slate-700 text-sm">لا توجد مواعيد إعادة كشف مسجلة بهذا الرقم</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            عندما يسجل لك الطبيب أو العيادة موعد استشارة جديدة ستظهر مواعيدك هنا تلقائياً مع خيارات التأكيد والتغيير.
          </p>
        </div>
      ) : (
        /* List of Follow-Up Appointments */
        <div className="space-y-4">
          {appointments.map((app) => {
            const isFinishedOrCancelled = app.appointmentStatus === 'cancelled' || app.appointmentStatus === 'attended' || app.appointmentStatus === 'no_show';

            return (
              <div
                key={app.id}
                className="bg-slate-50 hover:bg-slate-50/80 border border-slate-200/90 rounded-2xl p-5 shadow-xs transition space-y-4"
              >
                {/* Header info */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/60 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl bg-sky-500 text-white flex items-center justify-center font-black text-sm shadow-xs">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-900 text-sm sm:text-base font-['Tajawal',sans-serif]">
                        {app.doctorName || "الدكتور"}
                      </h4>
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <Building2 className="w-3 h-3 text-slate-400" />
                        <span>{app.clinicName || "العيادة الطبية"}</span>
                      </p>
                    </div>
                  </div>

                  <div>
                    {getStatusBadge(app.appointmentStatus, app.rescheduleRequested)}
                  </div>
                </div>

                {/* Date, Time & Details */}
                <div className="grid sm:grid-cols-2 gap-3 text-xs bg-white p-3.5 rounded-xl border border-slate-200/70">
                  <div className="flex items-center gap-2 text-slate-800 font-bold">
                    <Calendar className="w-4 h-4 text-sky-600 shrink-0" />
                    <span>التاريخ:</span>
                    <span className="text-slate-950 font-extrabold">{app.appointmentDate}</span>
                  </div>

                  <div className="flex items-center gap-2 text-slate-800 font-bold">
                    <Clock className="w-4 h-4 text-sky-600 shrink-0" />
                    <span>الوقت:</span>
                    <span className="text-slate-950 font-extrabold dir-ltr">{app.appointmentTime}</span>
                  </div>

                  {app.reason && (
                    <div className="sm:col-span-2 text-slate-700 font-medium pt-1 border-t border-slate-100 flex items-start gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-teal-700 shrink-0 mt-0.5" />
                      <span><strong>سبب إعادة الكشف:</strong> {app.reason}</span>
                    </div>
                  )}

                  {app.notes && (
                    <div className="sm:col-span-2 text-slate-700 font-medium flex items-start gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-sky-600 shrink-0 mt-0.5" />
                      <span><strong>تعليمات العيادة:</strong> {app.notes}</span>
                    </div>
                  )}
                </div>

                {/* Reschedule Request Notice if pending */}
                {app.rescheduleRequested && (
                  <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs flex items-center gap-2 font-medium">
                    <Info className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      تم إرسال طلبك لتغيير الموعد إلى ({app.requestedNewDate} الساعة {app.requestedNewTime}). العيادة ستقوم بمراجعته وتأكيده قريبًا.
                    </span>
                  </div>
                )}

                {/* Reminder Settings Indicator */}
                <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
                  <Bell className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                  <span>
                    التنبيهات المفعلة:
                    {app.reminderSettings?.oneDayBefore && " • إشعار قبل الموعد بيوم"}
                    {app.reminderSettings?.twoHoursBefore && " • إشعار قبل الموعد بساعتين"}
                  </span>
                </div>

                {/* Patient Actions */}
                {!isFinishedOrCancelled && (
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/60">
                    
                    {app.appointmentStatus !== 'confirmed' && (
                      <button
                        onClick={() => handleConfirmAttendance(app.id)}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>تأكيد الحضور</span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setRescheduleItem(app);
                        setNewDate(app.appointmentDate);
                        setNewTime(app.appointmentTime);
                      }}
                      className="px-4 py-2 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>طلب تغيير الموعد</span>
                    </button>

                    <button
                      onClick={() => handleCancelAppointment(app.id)}
                      className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer mr-auto"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>إلغاء الموعد</span>
                    </button>

                  </div>
                )}

              </div>
            );
          })}
        </div>
      )}

      {/* Reschedule Modal */}
      {rescheduleItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 text-right animate-in fade-in zoom-in-95 duration-200 space-y-4">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="font-extrabold text-slate-900 text-base font-['Tajawal',sans-serif]">
                طلب تغيير موعد إعادة الكشف
              </h4>
              <button
                onClick={() => setRescheduleItem(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer"
                aria-label="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              حدد التاريخ والوقت الجديد الذي ترغب في نقله إليه مع دكتور {rescheduleItem.doctorName}
            </p>

            <form onSubmit={handleSubmitReschedule} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 mb-1 block">التاريخ المقترح الجديد</label>
                <input
                  type="date"
                  min={todayStr}
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  required
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 mb-1 block">الوقت المقترح الجديد</label>
                <input
                  type="time"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  required
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRescheduleItem(null)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={rescheduleLoading}
                  className="px-5 py-2 bg-sky-600 text-white rounded-xl text-xs font-bold hover:bg-sky-700 transition"
                >
                  {rescheduleLoading ? "جاري الإرسال..." : "إرسال طلب التغيير"}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
};
