import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Ticket,
  Clock,
  Users,
  CheckCircle2,
  XCircle,
  Volume2,
  Share2,
  X,
  Stethoscope,
  Bell,
  Phone,
  QrCode,
  AlertTriangle,
  RotateCcw,
  Copy,
  Check,
  KeyRound
} from 'lucide-react';
import { PatientRecord, DoctorProfile } from '../types';
import { subscribeToPatientTicket, updatePatientStatus } from '../services/firebaseService';
import { playTurnNotificationSound, speakText } from '../utils/audio';
import { StarRatingComponent } from './StarRatingComponent';
import { PatientFollowUpSection } from './PatientFollowUpSection';

interface PatientTicketProps {
  doctorId: string;
  patientId: string;
  onNewBooking: () => void;
  onShowToast: (title: string, message?: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export const PatientTicket: React.FC<PatientTicketProps> = ({
  doctorId,
  patientId,
  onNewBooking,
  onShowToast
}) => {
  const [patient, setPatient] = useState<PatientRecord | null>(null);
  const [doctor, setDoctor] = useState<DoctorProfile | null>(null);
  const [allPatients, setAllPatients] = useState<PatientRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);
  const [copiedRef, setCopiedRef] = useState(false);

  // Audio trigger guards
  const previousStatusRef = useRef<string | null>(null);
  const playedUpcomingSoundRef = useRef(false);

  // Live Firestore listener for ticket & queue
  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeToPatientTicket(doctorId, patientId, (data) => {
      setPatient(data.patient);
      setDoctor(data.doctor);
      setAllPatients(data.allTodayPatients);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [doctorId, patientId]);

  // Audio and Speech Notifications on turn changes
  useEffect(() => {
    if (!patient) return;

    // Check status change
    if (previousStatusRef.current && previousStatusRef.current !== patient.status) {
      if (patient.status === 'called') {
        playTurnNotificationSound('turn');
        speakText(`دورك الآن يا ${patient.name}، تفضل بالدخول للطبيب`);
        onShowToast("دورك الآن!", "تفضل بالدخول لغرفة الطبيب فوراً", "success");
      } else if (patient.status === 'done') {
        playTurnNotificationSound('success');
        onShowToast("شفاك الله وعافاك", "تم إنهاء الكشف بنجاح", "info");
      }
    }
    previousStatusRef.current = patient.status;

    // Check if in last 2 patients
    const waitingAheadCount = allPatients.filter(
      p => p.status === 'waiting' && p.sequenceNumber < patient.sequenceNumber
    ).length;

    if (patient.status === 'waiting' && waitingAheadCount <= 2 && !playedUpcomingSoundRef.current) {
      playTurnNotificationSound('upcoming');
      playedUpcomingSoundRef.current = true;
      onShowToast("اقترب دورك!", "يرجى التواجد بالقرب من صالة الانتظار", "warning");
    }
  }, [patient, allPatients]);

  const handleCancelBooking = async () => {
    if (!patient || !doctor) return;
    if (!window.confirm("هل أنت تأكد من رغبتك في إلغاء حجزك في العيادة؟")) return;

    setIsCancelling(true);
    try {
      await updatePatientStatus(doctor.uid, patient.id, 'cancelled');
      setIsCancelling(false);
      onShowToast("تم إلغاء الحجز", "تم تحرير مكانك في الطابور", "info");
    } catch (err) {
      console.error("Cancel error:", err);
      setIsCancelling(false);
      onShowToast("خطأ في الإلغاء", "تعذر إلغاء الحجز حالياً", "error");
    }
  };

  const handleShareTicket = () => {
    const refText = patient?.bookingReference ? `\nرمز الحجز السريع: ${patient.bookingReference}` : '';
    const shareText = `تذكرتي في ${doctor?.clinicName || 'العيادة'}:\nرقم الدور: #${patient?.sequenceNumber}${refText}\nالاسم: ${patient?.name}\nالتاريخ: ${patient?.date}`;
    if (navigator.share) {
      navigator.share({
        title: `تذكرة دوري - ${patient?.name}`,
        text: shareText,
        url: window.location.href
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText(shareText);
      onShowToast("تم نسخ بيانات التذكرة", "يمكنك إرسالها أو فتحها من أي جهاز", "success");
    }
  };

  const handleCopyBookingReference = () => {
    if (!patient?.bookingReference) return;
    navigator.clipboard.writeText(patient.bookingReference);
    setCopiedRef(true);
    onShowToast("تم نسخ رمز الحجز السريع", `${patient.bookingReference} - يمكنك استخدامه للاسترجاع من أي جهاز`, "success");
    setTimeout(() => setCopiedRef(false), 2000);
  };

  if (loading) {
    return (
      <div className="max-w-md mx-auto px-4 py-12 text-center space-y-4">
        <div className="w-16 h-16 bg-sky-100 rounded-3xl animate-pulse mx-auto" />
        <div className="h-64 bg-slate-100 rounded-3xl animate-pulse" />
      </div>
    );
  }

  if (!patient || !doctor) {
    return (
      <div className="max-w-md mx-auto px-4 py-12 text-center">
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-md">
          <XCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-slate-900 font-['Tajawal',sans-serif]">
            التذكرة غير موجودة
          </h2>
          <p className="text-xs text-slate-500 mt-2 mb-6">
            قد تكون هذه التذكرة أُلغيت أو انتهت مدتها.
          </p>
          <button
            onClick={onNewBooking}
            className="w-full py-3 bg-sky-600 text-white font-bold text-xs rounded-xl hover:bg-sky-700 transition"
          >
            حجز دور جديد
          </button>
        </div>
      </div>
    );
  }

  // Calculate dynamic position
  const activeWaitingAhead = allPatients.filter(
    p => p.status === 'waiting' && p.sequenceNumber < patient.sequenceNumber
  );
  const peopleAhead = activeWaitingAhead.length;

  const currentCalledPatient = allPatients.find(p => p.status === 'called');
  const avgTime = doctor.avgConsultTime || 12;
  const estimatedWaitMinutes = peopleAhead * avgTime;

  // Calculate progress bar
  const totalInFrontOriginal = patient.sequenceNumber - 1;
  const progressPercent = totalInFrontOriginal > 0
    ? Math.min(100, Math.max(10, Math.round(((totalInFrontOriginal - peopleAhead) / totalInFrontOriginal) * 100)))
    : 100;

  const isCalled = patient.status === 'called';
  const isWaiting = patient.status === 'waiting';
  const isDone = patient.status === 'done';
  const isCancelled = patient.status === 'cancelled';

  return (
    <div className="max-w-md mx-auto px-4 py-6 sm:py-10">
      
      {/* Dynamic Status Alert Top Banner */}
      {isCalled && (
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-amber-500 text-slate-950 p-4 rounded-3xl mb-4 font-bold text-center shadow-lg border-2 border-amber-300 animate-pulse flex items-center justify-center gap-2"
        >
          <Volume2 className="w-6 h-6 shrink-0" />
          <span className="text-base font-['Tajawal',sans-serif]">
            دورك الآن! تفضل بالدخول لغرفة الطبيب فوراً
          </span>
        </motion.div>
      )}

      {isWaiting && peopleAhead <= 2 && (
        <motion.div
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-amber-50 text-amber-900 border border-amber-300 p-3.5 rounded-2xl mb-4 text-xs font-bold text-center flex items-center justify-center gap-2 shadow-xs"
        >
          <Bell className="w-4 h-4 text-amber-600 animate-bounce" />
          <span>اقترب دورك! يرجى التواجد في صالة الانتظار بالعيادة</span>
        </motion.div>
      )}

      {isDone && (
        <div className="bg-emerald-50 text-emerald-900 border border-emerald-300 p-4 rounded-3xl mb-4 text-xs font-bold text-center flex items-center justify-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          <span>تم إنهاء كشفك بنجاح. نتمنى لك دوام الصحة والعافية!</span>
        </div>
      )}

      {isCancelled && (
        <div className="bg-rose-50 text-rose-900 border border-rose-300 p-4 rounded-3xl mb-4 text-xs font-bold text-center flex items-center justify-center gap-2">
          <XCircle className="w-5 h-5 text-rose-600" />
          <span>تم إلغاء هذا الحجز بناءً على طلبك أو بقرار العيادة.</span>
        </div>
      )}

      {/* Main Interactive Ticket Box */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[#fdfcf9] rounded-3xl border border-[#e7e3da] shadow-2xl overflow-hidden relative"
      >
        
        {/* Ticket Header */}
        <div className="bg-[#122c4a] text-white p-6 text-center relative">
          <div className="flex items-center justify-between text-xs text-slate-300 mb-2">
            <span className="bg-white/10 px-3 py-1 rounded-full font-mono text-slate-200">
              تذكرة دوري المباشرة
            </span>
            <span className="flex items-center gap-1 text-emerald-300 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              تحديث مباشر (Live)
            </span>
          </div>

          <h2 className="text-xl font-bold font-['Tajawal',sans-serif] text-white">
            {doctor.clinicName}
          </h2>
          <p className="text-xs text-slate-200 mt-0.5">
            {doctor.name} - {doctor.specialty}
          </p>
        </div>

        {/* Ticket Body */}
        <div className="p-6 sm:p-8 text-center space-y-5">
          
          {/* Patient Details & Quick Booking Reference */}
          <div className="space-y-2">
            <div>
              <span className="text-xs text-slate-400 font-medium">اسم المريض</span>
              <h3 className="text-lg font-bold text-[#122c4a] font-['Tajawal',sans-serif] mt-0.5">
                {patient.name}
              </h3>
              <span className="text-xs text-slate-500 font-mono dir-ltr inline-block mt-0.5">
                {patient.phone}
              </span>
            </div>

            {/* Quick Booking Reference Code Pill */}
            {patient.bookingReference && (
              <div className="inline-flex items-center gap-2 bg-sky-50 border border-sky-200 px-3 py-1.5 rounded-2xl">
                <KeyRound className="w-3.5 h-3.5 text-sky-700" />
                <span className="text-[11px] font-bold text-sky-900">رمز الحجز:</span>
                <span className="font-mono font-black text-xs text-sky-950 tracking-wider">
                  {patient.bookingReference}
                </span>
                <button
                  onClick={handleCopyBookingReference}
                  className="p-1 hover:bg-sky-100 text-sky-700 rounded-md transition cursor-pointer"
                  title="نسخ رمز الحجز للاسترجاع السريع"
                >
                  {copiedRef ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            )}

            {/* Unified Patient ID */}
            {patient.patientId && (
              <div className="text-[10px] text-slate-400 font-mono">
                الهوية الطبية: {patient.patientId}
              </div>
            )}
          </div>

          {/* Sequence Number Highlight */}
          <div className="bg-[#edf3fa] rounded-3xl p-6 border border-[#d1dfed] shadow-inner">
            <div className="text-xs font-bold text-[#122c4a] uppercase tracking-wider mb-1">
              رقم دورك الثابت
            </div>
            <div className="text-6xl font-black text-[#122c4a] font-['Tajawal',sans-serif] tracking-tight my-1">
              #{patient.sequenceNumber}
            </div>
            {(patient.visitType || patient.serviceName) && (
              <div className="mt-2 pt-2 border-t border-sky-200/60 flex flex-wrap items-center justify-center gap-2 text-xs text-[#122c4a] font-bold">
                <span className="truncate max-w-[200px]">نوع الزيارة: {patient.visitType || patient.serviceName}</span>
                {typeof patient.price === 'number' && (
                  <span className="bg-sky-100 text-sky-900 px-2.5 py-0.5 rounded-full font-mono shrink-0">
                    {patient.price} جنيه
                  </span>
                )}
              </div>
            )}
            <div className="text-[11px] text-slate-500 font-medium mt-1">
              تاريخ الحجز: {patient.date}
            </div>
          </div>

          {/* Live Queue Progress Indicators (If Waiting) */}
          {isWaiting && (
            <div className="space-y-4 pt-2">
              
              {/* Progress Bar */}
              <div>
                <div className="flex items-center justify-between text-xs font-bold text-[#122c4a] mb-1.5">
                  <span>التقدم نحو العيادة:</span>
                  <span className="text-sky-700">{progressPercent}%</span>
                </div>
                <div className="w-full bg-[#f4efe6] rounded-full h-3 overflow-hidden p-0.5 border border-[#e7e3da]">
                  <div
                    className="bg-[#122c4a] h-full rounded-full transition-all duration-500 shadow-2xs"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Waiting Stats */}
              <div className="grid grid-cols-2 gap-3 text-right">
                
                {/* People Ahead */}
                <div className="bg-[#faf8f5] p-4 rounded-2xl border border-[#e7e3da]">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold mb-1">
                    <Users className="w-4 h-4 text-[#1b3a5c]" />
                    <span>المتبقين قبلك</span>
                  </div>
                  <div className="text-2xl font-black text-[#122c4a] font-['Tajawal',sans-serif]">
                    {peopleAhead === 0 ? 'أنت التالي!' : `${peopleAhead} أشخاص`}
                  </div>
                </div>

                {/* Estimated Time */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold mb-1">
                    <Clock className="w-4 h-4 text-teal-600" />
                    <span>وقت الانتظار المتوقع</span>
                  </div>
                  <div className="text-2xl font-black text-slate-900 font-['Tajawal',sans-serif]">
                    {estimatedWaitMinutes === 0 ? 'أقل من دقيقة' : `~${estimatedWaitMinutes} دقيقة`}
                  </div>
                </div>

              </div>

              {/* Currently Called Patient in Clinic */}
              <div className="bg-slate-900 text-white p-3 rounded-2xl text-xs flex items-center justify-between gap-2">
                <span className="text-slate-400 font-medium shrink-0">داخل غرفة الكشف الآن:</span>
                <span className="font-extrabold text-amber-400 font-['Tajawal',sans-serif] text-sm truncate max-w-[60%] text-left">
                  {currentCalledPatient ? `#${currentCalledPatient.sequenceNumber} - ${currentCalledPatient.name}` : 'لا يوجد أحد'}
                </span>
              </div>

            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 space-y-2">
            
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleShareTicket}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5"
              >
                <Share2 className="w-4 h-4" />
                <span>مشاركة التذكرة</span>
              </button>

              <button
                onClick={onNewBooking}
                className="py-2.5 px-4 bg-sky-50 hover:bg-sky-100 text-sky-700 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="w-4 h-4" />
                <span>حجز دور آخر</span>
              </button>
            </div>

            {(isWaiting || isCalled) && (
              <button
                onClick={handleCancelBooking}
                disabled={isCancelling}
                className="w-full py-2.5 text-rose-600 hover:bg-rose-50 font-bold text-xs rounded-xl transition border border-rose-200"
              >
                {isCancelling ? 'جاري الإلغاء...' : 'إلغاء هذا الحجز'}
              </button>
            )}

          </div>

        </div>

      </motion.div>

      {/* Patient Star Rating & Review Section (Only rendered when status is 'done') */}
      {isDone && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6"
        >
          <StarRatingComponent
            doctorId={doctor.uid}
            patientRecordId={patient.id}
            patientName={patient.name}
            patientPhone={patient.phone}
            onShowToast={onShowToast}
          />
        </motion.div>
      )}

      {/* Patient Follow-Up Appointments Section */}
      {(patient.phone || patient.patientId) && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6"
        >
          <PatientFollowUpSection
            patientPhone={patient.phone}
            patientId={patient.patientId}
            onShowToast={onShowToast}
          />
        </motion.div>
      )}

    </div>
  );
};
