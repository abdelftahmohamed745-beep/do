import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  User,
  Phone,
  Plus,
  Edit2,
  XCircle,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Search,
  Filter,
  FileText,
  Check,
  UserX,
  Trash2,
  DollarSign
} from 'lucide-react';
import { FollowUpAppointment, FollowUpAppointmentStatus } from '../types';
import {
  subscribeToDoctorFollowUps,
  updateFollowUpAppointmentStatus,
  updateFollowUpAppointment,
  cancelFollowUpAppointment,
  markFollowUpNoShow,
  getTodayDateString
} from '../services/firebaseService';
import { CreateFollowUpModal } from './CreateFollowUpModal';

interface DoctorFollowUpManagerProps {
  doctorId: string;
  doctorName?: string;
  clinicId?: string;
  clinicName?: string;
  onShowToast?: (title: string, message?: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export const DoctorFollowUpManager: React.FC<DoctorFollowUpManagerProps> = ({
  doctorId,
  doctorName = "دكتور العيادة",
  clinicId,
  clinicName = "العيادة الطبية",
  onShowToast
}) => {
  const today = getTodayDateString();
  const [appointments, setAppointments] = useState<FollowUpAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<FollowUpAppointment | null>(null);

  // 2-Step Removal Confirmation Dialog State (Section 18)
  const [appointmentToCancel, setAppointmentToCancel] = useState<FollowUpAppointment | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeToDoctorFollowUps(doctorId, (data) => {
      setAppointments(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [doctorId]);

  // Change status
  const handleStatusChange = async (appointmentId: string, newStatus: FollowUpAppointmentStatus) => {
    try {
      await updateFollowUpAppointmentStatus(appointmentId, newStatus);
      if (onShowToast) {
        onShowToast("تم تغيير حالة الموعد بنجاح", "", "success");
      }
    } catch (err: any) {
      if (onShowToast) onShowToast("فشل تحديث الحالة", err?.message, "error");
    }
  };

  // Section 18: Confirm follow-up cancellation (preserves patient & medical file)
  const handleConfirmCancellation = async () => {
    if (!appointmentToCancel) return;
    setIsCancelling(true);
    try {
      await cancelFollowUpAppointment(appointmentToCancel.id, doctorId);
      if (onShowToast) {
        onShowToast(
          "تم إلغاء الموعد وإخراجه من القائمة النشطة",
          `تم الحفاظ على السجل الطبي للمريض ${appointmentToCancel.patientName} وبياناته بالكامل`,
          "info"
        );
      }
      setAppointmentToCancel(null);
    } catch (err: any) {
      if (onShowToast) onShowToast("فشل إلغاء الموعد", err?.message, "error");
    } finally {
      setIsCancelling(false);
    }
  };

  // Section 19: Mark No-show
  const handleMarkNoShow = async (app: FollowUpAppointment) => {
    try {
      await markFollowUpNoShow(app.id, doctorId);
      if (onShowToast) {
        onShowToast(
          "تم تسجيل تغيّب المريض (No-show)",
          `تم إخراج الموعد من القائمة النشطة مع الاحتفاظ بسجل المريض`,
          "warning"
        );
      }
    } catch (err: any) {
      if (onShowToast) onShowToast("فشل تسجيل الحالة", err?.message, "error");
    }
  };

  // Accept patient reschedule request
  const handleAcceptReschedule = async (app: FollowUpAppointment) => {
    if (!app.requestedNewDate || !app.requestedNewTime) return;

    try {
      await updateFollowUpAppointment(app.id, {
        appointmentDate: app.requestedNewDate,
        appointmentTime: app.requestedNewTime,
        rescheduleRequested: false,
        requestedNewDate: '',
        requestedNewTime: '',
        appointmentStatus: 'confirmed'
      });

      if (onShowToast) {
        onShowToast("تم قبول الموعد الجديد للتحويل بنجاح", `الموعد الجديد: ${app.requestedNewDate} الساعة ${app.requestedNewTime}`, "success");
      }
    } catch (err: any) {
      if (onShowToast) onShowToast("فشل تحديث الموعد", err?.message, "error");
    }
  };

  // Section 17: Today's Follow-ups Summary
  const todayFollowUps = appointments.filter(
    (app) => app.appointmentDate === today && app.appointmentStatus !== 'cancelled' && app.appointmentStatus !== 'no_show'
  );
  const expectedTodayRevenue = todayFollowUps.length * 200; // Default expected consultation fee

  // Filtered Appointments (hide cancelled unless explicitly chosen)
  const filteredList = appointments.filter((app) => {
    if (filterStatus === 'all') {
      if (app.appointmentStatus === 'cancelled') return false;
    } else if (app.appointmentStatus !== filterStatus) {
      return false;
    }

    const matchesSearch =
      !searchTerm ||
      app.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.patientPhone.includes(searchTerm);

    return matchesSearch;
  });

  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-xl space-y-6 text-right" dir="rtl">
      
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-sky-50 text-sky-800 rounded-full text-xs font-bold border border-sky-200 mb-2">
            <Calendar className="w-3.5 h-3.5 text-sky-600" />
            <span>إدارة مواعيد الاستشارات وإعادة الكشف</span>
          </div>
          <h3 className="text-xl font-extrabold text-slate-900 font-['Tajawal',sans-serif]">
            جدول مواعيد إعادة الكشف
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            إضافة وتعديل متابعات المرضى، تأكيد الحضور، وإلغاء أو تحويل المواعيد
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => {
              setEditingAppointment(null);
              setIsModalOpen(true);
            }}
            className="px-4 py-2.5 bg-gradient-to-r from-sky-600 to-sky-700 hover:from-sky-700 hover:to-sky-800 text-white rounded-2xl text-xs sm:text-sm font-extrabold transition shadow-md shadow-sky-500/20 flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>إنشاء موعد إعادة كشف</span>
          </button>
        </div>
      </div>

      {/* Section 17: Today's Follow-up Summary Banner */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-[#F59E0B] border border-amber-200 flex items-center justify-center font-bold text-xs shadow-xs">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-600 block">إحصائية متابعات اليوم ({today}):</span>
            <div className="flex items-baseline gap-4 mt-0.5">
              <span className="text-sm font-extrabold text-slate-900">
                متابعات اليوم: <strong className="font-mono text-base text-[#F59E0B]">{todayFollowUps.length}</strong> مرضى
              </span>
              <span className="text-sm font-extrabold text-slate-900">
                الإيراد المتوقع: <strong className="font-mono text-base text-[#10B981]">{expectedTodayRevenue}</strong> ج.م
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-600">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
          <span>تحديث فوري للمواعيد النشطة</span>
        </div>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="grid sm:grid-cols-3 gap-3">
        {/* Search */}
        <div className="relative sm:col-span-2">
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ابحث باسم المريض أو رقم الهاتف..."
            className="w-full pr-10 pl-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs text-slate-900 font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500 shadow-xs"
          />
        </div>

        {/* Status Dropdown */}
        <div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full p-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 shadow-xs"
          >
            <option value="all">المواعيد النشطة ({appointments.filter(a => a.appointmentStatus !== 'cancelled').length})</option>
            <option value="upcoming">قادم (Upcoming)</option>
            <option value="confirmed">تم التأكيد (Confirmed)</option>
            <option value="attended">تم الحضور (Attended)</option>
            <option value="no_show">لم يحضر (No Show)</option>
            <option value="cancelled">الملغاة فقط (Cancelled)</option>
          </select>
        </div>
      </div>

      {/* Appointments List */}
      {loading ? (
        <div className="py-12 text-center text-slate-400 space-y-3">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <span className="text-xs font-bold block">جاري تحميل مواعيد إعادة الكشف...</span>
        </div>
      ) : filteredList.length === 0 ? (
        <div className="text-center py-10 bg-white rounded-2xl border border-dashed border-slate-200 space-y-2 shadow-xs">
          <Calendar className="w-10 h-10 text-slate-300 mx-auto" />
          <h4 className="font-bold text-slate-700 text-sm">لا توجد مواعيد إعادة كشف مطابقة</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            اضغط على "إنشاء موعد إعادة كشف" لتسجيل موعد لمريض.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredList.map((app) => (
            <div
              key={app.id}
              className="bg-white hover:border-slate-300 border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-xs transition space-y-3"
            >
              {/* Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-[#6366F1] border border-indigo-100 flex items-center justify-center font-bold text-sm shadow-xs">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-slate-900 text-sm sm:text-base font-['Tajawal',sans-serif]">
                      {app.patientName}
                    </h4>
                    <span className="text-xs text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                      <Phone className="w-3 h-3 text-slate-400" />
                      <span>{app.patientPhone}</span>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Status Dropdown */}
                  <select
                    value={app.appointmentStatus}
                    onChange={(e) => handleStatusChange(app.id, e.target.value as FollowUpAppointmentStatus)}
                    className="p-2 bg-white border border-slate-200 rounded-xl text-xs font-extrabold text-slate-900 shadow-2xs focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="upcoming">قادم (Upcoming)</option>
                    <option value="confirmed">تم التأكيد (Confirmed)</option>
                    <option value="attended">تم الحضور (Attended)</option>
                    <option value="no_show">لم يحضر (No Show)</option>
                    <option value="cancelled">تم الإلغاء (Cancelled)</option>
                  </select>

                  {/* Section 19: No-show 1-click action */}
                  {app.appointmentStatus !== 'no_show' && app.appointmentStatus !== 'attended' && (
                    <button
                      type="button"
                      onClick={() => handleMarkNoShow(app)}
                      className="px-2.5 py-2 bg-rose-50 hover:bg-rose-100 text-[#EF4444] border border-rose-200 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                      title="تسجيل عدم الحضور"
                    >
                      <UserX className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">لم يحضر</span>
                    </button>
                  )}

                  {/* Edit button */}
                  <button
                    onClick={() => {
                      setEditingAppointment(app);
                      setIsModalOpen(true);
                    }}
                    className="p-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl transition cursor-pointer"
                    title="تعديل الموعد"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>

                  {/* Section 18: 2-Step Removal / Cancellation Trigger */}
                  <button
                    onClick={() => setAppointmentToCancel(app)}
                    className="p-2 bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-200 text-slate-400 hover:text-[#EF4444] rounded-xl transition cursor-pointer"
                    title="إلغاء الموعد"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Reschedule alert banner */}
              {app.rescheduleRequested && (
                <div className="bg-amber-50/70 border border-amber-200 p-3 rounded-xl flex items-center justify-between gap-2 text-xs text-amber-900">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-[#F59E0B] shrink-0 animate-spin" />
                    <span>
                      المريض يطلب تغيير الموعد إلى: <strong>{app.requestedNewDate}</strong> الساعة <strong>{app.requestedNewTime}</strong>
                    </span>
                  </div>
                  <button
                    onClick={() => handleAcceptReschedule(app)}
                    className="px-3 py-1 bg-[#F59E0B] hover:bg-amber-600 text-white font-bold rounded-lg transition shrink-0 cursor-pointer"
                  >
                    قبول التعديل
                  </button>
                </div>
              )}

              {/* Grid info */}
              <div className="grid sm:grid-cols-2 gap-2 text-xs bg-white p-3 rounded-xl border border-slate-200/60">
                <div className="flex items-center gap-2 font-bold text-slate-800">
                  <Calendar className="w-3.5 h-3.5 text-sky-600" />
                  <span>تاريخ الموعد:</span>
                  <span className="text-slate-950 font-extrabold">{app.appointmentDate}</span>
                </div>

                <div className="flex items-center gap-2 font-bold text-slate-800">
                  <Clock className="w-3.5 h-3.5 text-sky-600" />
                  <span>الوقت:</span>
                  <span className="text-slate-950 font-extrabold dir-ltr">{app.appointmentTime}</span>
                </div>

                {app.reason && (
                  <div className="sm:col-span-2 text-slate-700 pt-1 border-t border-slate-100">
                    <strong>السبب:</strong> {app.reason}
                  </div>
                )}

                {app.notes && (
                  <div className="sm:col-span-2 text-slate-700">
                    <strong>ملاحظات المريض:</strong> {app.notes}
                  </div>
                )}
              </div>

            </div>
          ))}
        </div>
      )}

      {/* Section 18: Two-Step Removal Confirmation Dialog */}
      {appointmentToCancel && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 text-right">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center border border-rose-200">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="text-base font-extrabold text-slate-900 font-['Tajawal',sans-serif]">
                تأكيد إلغاء موعد المتابعة
              </h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              هل أنت متأكد من رغبتك في إلغاء موعد إعادة الكشف للمريض{' '}
              <strong className="text-slate-900">{appointmentToCancel.patientName}</strong>؟
            </p>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
              <div>
                <strong>تاريخ الموعد:</strong> {appointmentToCancel.appointmentDate} الساعة {appointmentToCancel.appointmentTime}
              </div>
              <div className="text-[11px] text-emerald-700 pt-1 border-t border-slate-200 font-bold">
                ✓ لن يتم حذف المريض أو ملفه الطبي أو كشوفاته السابقة. يتم فقط تحويل حالة هذا الموعد إلى "ملغي" وإخراجه من القائمة النشطة.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAppointmentToCancel(null)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                تراجع
              </button>
              <button
                type="button"
                onClick={handleConfirmCancellation}
                disabled={isCancelling}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-extrabold shadow-sm transition cursor-pointer disabled:opacity-50"
              >
                {isCancelling ? 'جاري الإلغاء...' : 'تأكيد الإلغاء'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Form */}
      <CreateFollowUpModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingAppointment(null);
        }}
        doctorId={doctorId}
        doctorName={doctorName}
        clinicId={clinicId}
        clinicName={clinicName}
        editingAppointment={editingAppointment}
        onShowToast={onShowToast}
      />

    </div>
  );
};

