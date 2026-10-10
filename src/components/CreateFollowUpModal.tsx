import React, { useState, useEffect } from 'react';
import { FollowUpAppointment, FollowUpReminderSettings } from '../types';
import { createFollowUpAppointment, updateFollowUpAppointment, isDateTimeInPast } from '../services/firebaseService';
import { sanitizePatientPhoneNumber, validatePatientPhoneNumber } from '../services/securityService';

interface CreateFollowUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  doctorId: string;
  doctorName?: string;
  clinicId?: string;
  clinicName?: string;
  initialPatientName?: string;
  initialPatientPhone?: string;
  initialPatientId?: string;
  editingAppointment?: FollowUpAppointment | null;
  onSuccess?: (app: FollowUpAppointment) => void;
  onShowToast?: (title: string, message?: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export const CreateFollowUpModal: React.FC<CreateFollowUpModalProps> = ({
  isOpen,
  onClose,
  doctorId,
  doctorName = "دكتور العيادة",
  clinicId,
  clinicName = "العيادة الطبية",
  initialPatientName = "",
  initialPatientPhone = "",
  initialPatientId = "",
  editingAppointment = null,
  onSuccess,
  onShowToast
}) => {
  const [patientName, setPatientName] = useState(initialPatientName);
  const [patientPhone, setPatientPhone] = useState(initialPatientPhone);
  
  // Default date = tomorrow or initial editing date
  const getTomorrowStr = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  };

  const [appointmentDate, setAppointmentDate] = useState(getTomorrowStr());
  const [appointmentTime, setAppointmentTime] = useState("17:00");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [oneDayBefore, setOneDayBefore] = useState(true);
  const [twoHoursBefore, setTwoHoursBefore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync props when modal opens or editing item changes
  useEffect(() => {
    if (editingAppointment) {
      setPatientName(editingAppointment.patientName || "");
      setPatientPhone(editingAppointment.patientPhone || "");
      setAppointmentDate(editingAppointment.appointmentDate || getTomorrowStr());
      setAppointmentTime(editingAppointment.appointmentTime || "17:00");
      setReason(editingAppointment.reason || "");
      setNotes(editingAppointment.notes || "");
      setOneDayBefore(editingAppointment.reminderSettings?.oneDayBefore ?? true);
      setTwoHoursBefore(editingAppointment.reminderSettings?.twoHoursBefore ?? true);
    } else {
      setPatientName(initialPatientName);
      setPatientPhone(initialPatientPhone);
      setAppointmentDate(getTomorrowStr());
      setAppointmentTime("17:00");
      setReason("");
      setNotes("");
      setOneDayBefore(true);
      setTwoHoursBefore(true);
    }
    setError(null);
  }, [editingAppointment, initialPatientName, initialPatientPhone, isOpen]);

  if (!isOpen) return null;

  const todayStr = new Date().toISOString().split('T')[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!patientName.trim()) {
      setError("يرجى إدخال اسم المريض");
      return;
    }

    const phoneValidation = validatePatientPhoneNumber(patientPhone);
    if (!phoneValidation.isValid) {
      setError(phoneValidation.error || "رقم الهاتف يجب أن يكون من 10 إلى 11 رقمًا.");
      return;
    }
    const cleanPhone = phoneValidation.cleanPhone;

    if (!appointmentDate || !appointmentTime) {
      setError("يرجى تحديد تاريخ ووقت الموعد");
      return;
    }

    // Check if date or time is in past
    if (isDateTimeInPast(appointmentDate, appointmentTime)) {
      setError("خطأ: لا يمكن تسجيل موعد إعادة الكشف بتاريخ أو وقت في الماضي");
      return;
    }

    setLoading(true);

    try {
      const reminderSettings: FollowUpReminderSettings = {
        oneDayBefore,
        twoHoursBefore
      };

      if (editingAppointment) {
        // Edit existing follow-up appointment
        await updateFollowUpAppointment(editingAppointment.id, {
          patientName: patientName.trim(),
          patientPhone: cleanPhone,
          appointmentDate,
          appointmentTime,
          reason: reason.trim(),
          notes: notes.trim(),
          reminderSettings
        });

        if (onShowToast) {
          onShowToast("تم تحديث موعد إعادة الكشف بنجاح", "", "success");
        }
        if (onSuccess) {
          onSuccess({
            ...editingAppointment,
            patientName: patientName.trim(),
            patientPhone: cleanPhone,
            appointmentDate,
            appointmentTime,
            reason: reason.trim(),
            notes: notes.trim(),
            reminderSettings
          });
        }
      } else {
        // Create new follow-up appointment
        const createdApp = await createFollowUpAppointment({
          patientName: patientName.trim(),
          patientPhone: cleanPhone,
          patientId: initialPatientId,
          doctorId,
          doctorName,
          clinicId: clinicId || doctorId,
          clinicName,
          appointmentDate,
          appointmentTime,
          reason: reason.trim(),
          notes: notes.trim(),
          reminderSettings
        });

        if (onShowToast) {
          onShowToast("تم تسجيل موعد إعادة الكشف بنجاح", `الموعد بتاريخ ${appointmentDate} الساعة ${appointmentTime}`, "success");
        }

        if (onSuccess) {
          onSuccess(createdApp);
        }
      }

      onClose();
    } catch (err: any) {
      console.error("Save follow-up error:", err);
      setError(err?.message || "حدث خطأ أثناء حفظ موعد إعادة الكشف");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-100 text-right my-8 relative animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold border border-sky-100">
              <span className="text-xl leading-none inline-flex items-center justify-center">📅</span>
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base sm:text-lg font-['Tajawal',sans-serif]">
                {editingAppointment ? "تعديل موعد إعادة الكشف" : "حجز موعد إعادة كشف جديد"}
              </h3>
              <p className="text-xs text-slate-500">
                تسجيل موعد استشارة جديدة للمريض مع تفعيل التنبيهات
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
          >
            <span className="text-base font-bold select-none leading-none">✕</span>
          </button>
        </div>

        {error && (
          <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-2xl flex items-center gap-2">
            <span className="text-base leading-none inline-flex items-center justify-center">⚠️</span>
            <span className="font-semibold">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Patient Name */}
          <div>
            <label className="text-xs font-bold text-slate-800 mb-1 flex items-center gap-1">
              <span className="text-xs leading-none inline-flex items-center justify-center">👤</span>
              <span>اسم المريض <span className="text-rose-500">*</span></span>
            </label>
            <input
              type="text"
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              placeholder="مثال: محمد أحمد علي"
              required
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm text-slate-900 font-semibold focus:outline-hidden focus:ring-2 focus:ring-sky-500 transition"
            />
          </div>

          {/* Patient Phone */}
          <div>
            <label className="text-xs font-bold text-slate-800 mb-1 flex items-center gap-1">
              <span className="text-xs leading-none inline-flex items-center justify-center">📞</span>
              <span>رقم هاتف المريض <span className="text-rose-500">*</span></span>
            </label>
            <input
              type="tel"
              dir="ltr"
              maxLength={11}
              value={patientPhone}
              onChange={(e) => setPatientPhone(sanitizePatientPhoneNumber(e.target.value, 11))}
              onPaste={(e) => {
                e.preventDefault();
                setPatientPhone(sanitizePatientPhoneNumber(e.clipboardData.getData('text'), 11));
              }}
              placeholder="مثال: 01012345678"
              required
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm text-slate-900 font-semibold dir-ltr text-right focus:outline-hidden focus:ring-2 focus:ring-sky-500 transition"
            />
          </div>

          {/* Date & Time Grid */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                <span className="text-xs leading-none inline-flex items-center justify-center">📅</span>
                <span>تاريخ إعادة الكشف <span className="text-rose-500">*</span></span>
              </label>
              <div className="flex items-center gap-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() + 7);
                    setAppointmentDate(d.toISOString().split('T')[0]);
                  }}
                  className="px-2 py-0.5 bg-slate-100 hover:bg-sky-100 text-slate-700 hover:text-sky-800 rounded-md font-semibold transition cursor-pointer"
                >
                  +7 أيام
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() + 14);
                    setAppointmentDate(d.toISOString().split('T')[0]);
                  }}
                  className="px-2 py-0.5 bg-slate-100 hover:bg-sky-100 text-slate-700 hover:text-sky-800 rounded-md font-semibold transition cursor-pointer"
                >
                  +أسبوعين
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() + 30);
                    setAppointmentDate(d.toISOString().split('T')[0]);
                  }}
                  className="px-2 py-0.5 bg-slate-100 hover:bg-sky-100 text-slate-700 hover:text-sky-800 rounded-md font-semibold transition cursor-pointer"
                >
                  +شهر
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <input
                  type="date"
                  min={todayStr}
                  value={appointmentDate}
                  onChange={(e) => setAppointmentDate(e.target.value)}
                  required
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-sky-500 transition"
                />
              </div>

              <div>
                <input
                  type="time"
                  value={appointmentTime}
                  onChange={(e) => setAppointmentTime(e.target.value)}
                  required
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-sky-500 transition"
                />
              </div>
            </div>
          </div>

          {/* Reason for Follow Up */}
          <div>
            <label className="text-xs font-bold text-slate-800 mb-1 flex items-center gap-1">
              <span className="text-xs leading-none inline-flex items-center justify-center">📝</span>
              <span>سبب إعادة الكشف (اختياري)</span>
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="مثال: فحص نتائج التحاليل / تقييم الجرعة"
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-sky-500 transition"
            />
          </div>

          {/* Notes / Instructions */}
          <div>
            <label className="text-xs font-bold text-slate-800 mb-1 flex items-center gap-1">
              <span className="text-xs leading-none inline-flex items-center justify-center">📋</span>
              <span>ملاحظات وتعليمات للمريض (اختياري)</span>
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="مثال: يرجى الحضور صائماً لمدة 8 ساعات وكتابة أي قياسات سابقة"
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-sky-500 transition"
            />
          </div>

          {/* Reminder Settings Options */}
          <div className="bg-sky-50/70 border border-sky-100 rounded-2xl p-4 space-y-2.5">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm leading-none inline-flex items-center justify-center">🔔</span>
              <span className="text-xs font-extrabold text-sky-950 font-['Tajawal',sans-serif]">
                مواعيد التنبيه والتذكيرات
              </span>
            </div>

            <label className="flex items-center gap-3 cursor-pointer text-xs font-semibold text-slate-700 hover:text-slate-900">
              <input
                type="checkbox"
                checked={oneDayBefore}
                onChange={(e) => setOneDayBefore(e.target.checked)}
                className="w-4 h-4 text-sky-600 rounded-md border-slate-300 focus:ring-sky-500"
              />
              <span>تنبيه وإشعار داخل الموقع قبل الموعد بيوم واحد</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer text-xs font-semibold text-slate-700 hover:text-slate-900">
              <input
                type="checkbox"
                checked={twoHoursBefore}
                onChange={(e) => setTwoHoursBefore(e.target.checked)}
                className="w-4 h-4 text-sky-600 rounded-md border-slate-300 focus:ring-sky-500"
              />
              <span>تنبيه وإشعار داخل الموقع قبل الموعد بساعتين</span>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
            >
              إلغاء
            </button>

            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-sky-600 to-sky-700 hover:from-sky-700 hover:to-sky-800 text-white font-extrabold text-xs sm:text-sm shadow-md shadow-sky-500/20 flex items-center gap-2 transition disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>جاري الحفظ...</span>
                </>
              ) : (
                <>
                  <span className="text-sm font-bold leading-none inline-flex items-center justify-center">✓</span>
                  <span>{editingAppointment ? "تحديث الموعد" : "تسجيل موعد إعادة الكشف"}</span>
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
