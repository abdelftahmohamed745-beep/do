import React, { useState, useEffect } from 'react';
import {
  PatientRecord,
  PatientMedicalFile,
  VisitType,
  PatientVisitEntry
} from '../types';
import {
  getPatientMedicalFile,
  completePatientConsultation,
  getPatientAccumulatedBalance
} from '../services/firebaseService';

interface DoctorConsultationModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: PatientRecord | null;
  doctorId: string;
  doctorName?: string;
  clinicName?: string;
  onSuccess?: () => void;
  onShowToast?: (title: string, message?: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export const DoctorConsultationModal: React.FC<DoctorConsultationModalProps> = ({
  isOpen,
  onClose,
  patient,
  doctorId,
  doctorName = 'دكتور العيادة',
  clinicName = 'العيادة',
  onSuccess,
  onShowToast
}) => {
  const [patientFile, setPatientFile] = useState<PatientMedicalFile | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [outstandingBalance, setOutstandingBalance] = useState<number>(0);

  // Form State
  const [visitType, setVisitType] = useState<VisitType>('new_consultation');
  const [diagnosis, setDiagnosis] = useState('');
  const [notes, setNotes] = useState('');
  const [prescription, setPrescription] = useState('');
  
  // Follow-up scheduling
  const [scheduleFollowUp, setScheduleFollowUp] = useState(false);
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpTime, setFollowUpTime] = useState('18:00');
  const [followUpFee, setFollowUpFee] = useState<number>(200);
  const [followUpReason, setFollowUpReason] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showHistoryDetails, setShowHistoryDetails] = useState(true);

  // Fetch patient medical file & outstanding balance when patient changes
  useEffect(() => {
    if (!isOpen || !patient || !doctorId) return;

    // Default follow-up date to 7 days from now
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const yyyy = nextWeek.getFullYear();
    const mm = String(nextWeek.getMonth() + 1).padStart(2, '0');
    const dd = String(nextWeek.getDate()).padStart(2, '0');
    setFollowUpDate(`${yyyy}-${mm}-${dd}`);

    setDiagnosis('');
    setNotes('');
    setPrescription('');
    setScheduleFollowUp(false);
    setVisitType(patient.sequenceNumber > 1 ? 'new_consultation' : 'new_consultation');

    const loadHistory = async () => {
      setLoadingHistory(true);
      try {
        if (patient.phone) {
          const [file, balance] = await Promise.all([
            getPatientMedicalFile(doctorId, patient.phone),
            getPatientAccumulatedBalance(doctorId, patient.phone)
          ]);
          setPatientFile(file);
          setOutstandingBalance(balance);
        }
      } catch (err) {
        console.warn('Error loading patient context:', err);
      } finally {
        setLoadingHistory(false);
      }
    };

    loadHistory();
  }, [isOpen, patient, doctorId]);

  if (!isOpen || !patient) return null;

  const currentVisitNumber = (patientFile?.visitsCount || 0) + 1;

  const handleComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!diagnosis.trim()) {
      if (onShowToast) onShowToast('يرجى كتابة التشخيص الطبي للكشف', '', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      await completePatientConsultation({
        doctorId,
        patientRecordId: patient.id,
        patientName: patient.name,
        patientPhone: patient.phone,
        visitType,
        diagnosis: diagnosis.trim(),
        notes: notes.trim(),
        prescription: prescription.trim(),
        followUpDate: scheduleFollowUp ? followUpDate : undefined,
        followUpTime: scheduleFollowUp ? followUpTime : undefined,
        followUpFee: scheduleFollowUp ? followUpFee : undefined,
        followUpReason: scheduleFollowUp ? followUpReason : undefined,
        doctorName,
        clinicName
      });

      if (onShowToast) {
        onShowToast(
          'تم إنهاء الكشف بنجاح',
          scheduleFollowUp ? `تم حفظ الملف وتحديد موعد إعادة الكشف في ${followUpDate}` : 'تم حفظ الزيارة في السجل الطبي للمريض',
          'success'
        );
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error completing consultation:', err);
      if (onShowToast) onShowToast('حدث خطأ أثناء إنهاء الكشف', err?.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="doctor-consultation-modal"
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      dir="rtl"
    >
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header Bar */}
        <div className="bg-gradient-to-r from-sky-700 via-sky-800 to-indigo-900 text-white p-5 sm:p-6 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shrink-0">
              <span className="text-2xl leading-none inline-flex items-center justify-center">🩺</span>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="px-2.5 py-0.5 rounded-full bg-sky-500/30 border border-sky-400/40 text-sky-100 text-xs font-bold">
                  كشف في العيادة • تذكرة #{patient.sequenceNumber}
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 text-xs font-extrabold">
                  الزيارة رقم {currentVisitNumber} للعيادة
                </span>
                {outstandingBalance > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full bg-rose-500/30 border border-rose-400/40 text-rose-200 text-xs font-extrabold flex items-center gap-1">
                    <span className="text-xs leading-none inline-flex items-center justify-center">💳</span>
                    مستحق سابق: {outstandingBalance} ج.م
                  </span>
                )}
              </div>
              <h2 className="text-xl sm:text-2xl font-black font-['Tajawal',sans-serif] tracking-tight">
                {patient.name}
              </h2>
              <div className="flex items-center gap-4 text-xs text-sky-200 font-mono mt-0.5">
                <span className="flex items-center gap-1">
                  <span className="text-xs leading-none inline-flex items-center justify-center">📞</span>
                  {patient.phone}
                </span>
                {patientFile?.age && <span>العمر: {patientFile.age} سنة</span>}
                {patientFile?.bloodGroup && <span>الفصيلة: {patientFile.bloodGroup}</span>}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer"
          >
            <span className="text-base font-bold select-none leading-none">✕</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">

          {/* Section 13: Instant Patient Medical History Context */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                <span className="text-base leading-none inline-flex items-center justify-center">📜</span>
                <span>سجل الزيارات السابقة للمريض ({patientFile?.visits?.length || 0} زيارات سابقة)</span>
              </div>
              <button
                type="button"
                onClick={() => setShowHistoryDetails(!showHistoryDetails)}
                className="text-xs text-sky-600 font-extrabold flex items-center gap-1 hover:underline cursor-pointer"
              >
                <span>{showHistoryDetails ? 'طي السجل' : 'عرض السجل بالتفصيل'}</span>
                <span className="text-[10px]">{showHistoryDetails ? '▲' : '▼'}</span>
              </button>
            </div>

            {loadingHistory ? (
              <div className="py-4 text-center text-xs text-slate-400">جاري تحميل السجل الطبي...</div>
            ) : !patientFile || !patientFile.visits || patientFile.visits.length === 0 ? (
              <div className="text-xs text-slate-500 bg-white p-3 rounded-xl border border-slate-100">
                هذه أول زيارة مسجلة للمريض في هذه العيادة. سيتم حفظ جميع بيانات الكشف تلقائيًا في ملفه الطبي الدائم.
              </div>
            ) : showHistoryDetails ? (
              <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                {patientFile.visits.slice(0, 4).map((v, idx) => (
                  <div key={v.id || idx} className="bg-white p-3 rounded-xl border border-slate-200 text-xs text-right space-y-1">
                    <div className="flex items-center justify-between text-slate-500 font-mono">
                      <span className="font-bold text-sky-700 flex items-center gap-1">
                        <span className="text-xs leading-none inline-flex items-center justify-center">📅</span>
                        {v.date}
                      </span>
                      <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-700 font-sans font-bold">
                        {v.serviceName || v.visitType || 'كشف'}
                      </span>
                    </div>
                    {v.diagnosis && (
                      <div className="text-slate-800">
                        <strong className="text-slate-600">التشخيص:</strong> {v.diagnosis}
                      </div>
                    )}
                    {v.prescription && (
                      <div className="text-emerald-800">
                        <strong className="text-emerald-700">العلاج الموصوف:</strong> {v.prescription}
                      </div>
                    )}
                    {v.notes && (
                      <div className="text-slate-500">
                        <strong className="text-slate-600">ملاحظات:</strong> {v.notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-slate-600">
                آخر زيارة: <span className="font-bold text-slate-800">{patientFile.lastVisitDate || 'غير محدد'}</span> — التشخيص السابق: <span className="font-bold text-slate-800">{patientFile.visits[0]?.diagnosis || 'لا يوجد'}</span>
              </div>
            )}
          </div>

          {/* Section 14: Visit Type Selection */}
          <div>
            <label className="block text-xs font-extrabold text-slate-800 mb-2">
              نوع الزيارة الحالية:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {[
                { id: 'new_consultation', label: 'كشف جديد' },
                { id: 'follow_up', label: 'استشارة' },
                { id: 're_examination', label: 'إعادة كشف' },
                { id: 'continued_treatment', label: 'متابعة علاج' },
                { id: 'urgent', label: 'كشف طارئ' }
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setVisitType(t.id as VisitType)}
                  className={`py-2.5 px-3 rounded-2xl text-xs font-extrabold border transition cursor-pointer text-center ${
                    visitType === t.id
                      ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Clinical Inputs */}
          <div className="space-y-4">
            {/* Diagnosis */}
            <div>
              <label className="block text-xs font-extrabold text-slate-800 mb-1.5 flex items-center justify-between">
                <span>التشخيص الطبي (Clinical Diagnosis) *</span>
                <span className="text-[10px] text-slate-400 font-normal">مطلوب</span>
              </label>
              <textarea
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                placeholder="اكتب التشخيص الطبي والأعراض الرئيسية..."
                rows={2}
                required
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-sky-500 focus:bg-white resize-none"
              />
            </div>

            {/* Prescription */}
            <div>
              <label className="block text-xs font-extrabold text-slate-800 mb-1.5 flex items-center gap-1.5">
                <span className="text-sm leading-none inline-flex items-center justify-center">💊</span>
                <span>الروشتة والعلاج الموصوف (Prescription / Rx)</span>
              </label>
              <textarea
                value={prescription}
                onChange={(e) => setPrescription(e.target.value)}
                placeholder="الأدوية، الجرعات، مدة العلاج..."
                rows={3}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-sky-500 focus:bg-white resize-none font-mono"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-extrabold text-slate-800 mb-1.5">
                ملاحظات الطبيب وسير الحالة (Doctor Notes)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="أي توصيات إضافية، تحاليل مطلوبة، أو تعليمات خاصة للمريض..."
                rows={2}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-sky-500 focus:bg-white resize-none"
              />
            </div>
          </div>

          {/* Schedule Follow-up Option */}
          <div className="bg-sky-50/70 border border-sky-100 rounded-2xl p-4 space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={scheduleFollowUp}
                onChange={(e) => setScheduleFollowUp(e.target.checked)}
                className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-slate-300"
              />
              <div className="text-right">
                <span className="text-xs font-extrabold text-slate-900 block">
                  تحديد موعد إعادة كشف / استشارة قادمة للمريض
                </span>
                <span className="text-[11px] text-slate-500">
                  سيتم تسجيل الموعد في جدول المتابعات وإرسال التذكيرات تلقائيًا
                </span>
              </div>
            </label>

            {scheduleFollowUp && (
              <div className="grid sm:grid-cols-3 gap-3 pt-2 border-t border-sky-200/60">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">تاريخ الموعد:</label>
                  <input
                    type="date"
                    value={followUpDate}
                    onChange={(e) => setFollowUpDate(e.target.value)}
                    className="w-full p-2 bg-white border border-sky-200 rounded-xl text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">الوقت:</label>
                  <input
                    type="time"
                    value={followUpTime}
                    onChange={(e) => setFollowUpTime(e.target.value)}
                    className="w-full p-2 bg-white border border-sky-200 rounded-xl text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">الرسوم المتوقعة (ج.م):</label>
                  <input
                    type="number"
                    value={followUpFee}
                    onChange={(e) => setFollowUpFee(Number(e.target.value) || 0)}
                    className="w-full p-2 bg-white border border-sky-200 rounded-xl text-xs font-bold"
                  />
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Section 15: Primary Action - Consultation Completion */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-2xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            إغلاق دون حفظ
          </button>

          <button
            type="button"
            onClick={handleComplete}
            disabled={isSubmitting}
            className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-2xl text-xs sm:text-sm font-extrabold shadow-lg shadow-emerald-600/25 flex items-center gap-2 transition disabled:opacity-50 cursor-pointer"
          >
            <span className="text-base leading-none inline-flex items-center justify-center font-bold">✓</span>
            <span>{isSubmitting ? 'جاري الحفظ...' : 'إنهاء الكشف وحفظ الزيارة (Exam Completed)'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
