import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users,
  Calendar,
  Wallet,
  Bot,
  UserCheck,
  Volume2,
  Search,
  Tv,
  QrCode,
  Plus,
  AlertTriangle,
  Clock,
  Activity,
  CheckCircle2,
  Camera,
  Stethoscope,
  CreditCard,
  RotateCcw,
  X,
  Phone,
  FileText,
  ChevronDown,
  Sparkles,
  Star,
  Layers,
  Building2
} from 'lucide-react';
import { CustomWebsiteSection } from './CustomWebsiteSection';
import { TVQueueDisplay } from './TVQueueDisplay';
import { DoctorProfile, PatientRecord, PatientStatus, DoctorRating, FollowUpAppointment, ClinicMember, DailySession } from '../types';
import {
  subscribeToDoctorQueue,
  callNextPatient,
  updatePatientStatus,
  bookPatient,
  getDoctorRatings,
  recalculateDoctorRatingStats,
  getUserClinicMember,
  markQueuePatientNoShow,
  getTodayDateString,
  recordPatientMedicalOrder
} from '../services/firebaseService';
import { playTurnNotificationSound, speakText } from '../utils/audio';
import { DoctorFollowUpManager } from './DoctorFollowUpManager';
import { CreateFollowUpModal } from './CreateFollowUpModal';
import { ClinicTeamManager } from './ClinicTeamManager';
import { ClinicFinanceManager } from './ClinicFinanceManager';
import { DoctorConsultationModal } from './DoctorConsultationModal';
import { DailySessionManager } from './DailySessionManager';
import { FastPatientRegistrationModal } from './FastPatientRegistrationModal';
import { PatientFileSidePanel } from './PatientFileSidePanel';
import { AiAgentControlCenter } from './ai/AiAgentControlCenter';
import { AiFloatingCopilotButton } from './ai/AiFloatingCopilotButton';
import { dispatchClinicEvent, checkQueueConditions } from '../services/ai/aiEventEngine';
import { hasPermission } from '../utils/permissions';
import { auth } from '../firebase/config';
import { sanitizePatientPhoneNumber, validatePatientPhoneNumber } from '../services/securityService';
import { getEffectiveSubscriptionState } from '../utils/subscriptionUtils';

interface DoctorDashboardProps {
  doctor: DoctorProfile;
  onOpenQRModal: () => void;
  onOpenScannerModal: () => void;
  onOpenSettingsModal: () => void;
  onNavigateSubscription: () => void;
  onShowToast: (title: string, message?: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export const DoctorDashboard: React.FC<DoctorDashboardProps> = ({
  doctor,
  onOpenQRModal,
  onOpenScannerModal,
  onOpenSettingsModal,
  onNavigateSubscription,
  onShowToast
}) => {
  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'all' | PatientStatus>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isCallingNext, setIsCallingNext] = useState(false);
  const subState = getEffectiveSubscriptionState(doctor);

  // Dashboard section mode: 'queue', 'followups', 'team', 'finance', or 'ai_agent'
  const [activeSection, setActiveSection] = useState<'queue' | 'followups' | 'team' | 'finance' | 'ai_agent'>('queue');
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [selectedPatientForPayment, setSelectedPatientForPayment] = useState<PatientRecord | null>(null);

  // Clinic Member & Permissions State
  const [currentMember, setCurrentMember] = useState<ClinicMember | null>(null);
  const [isDoctorOwnerFallback, setIsDoctorOwnerFallback] = useState(false);

  // Periodic AI condition checks for queue waiting time
  useEffect(() => {
    checkQueueConditions(doctor.uid);
    const interval = setInterval(() => {
      checkQueueConditions(doctor.uid);
    }, 60000);
    return () => clearInterval(interval);
  }, [doctor.uid]);

  useEffect(() => {
    async function loadMemberInfo() {
      if (auth.currentUser) {
        const { member, isPrimaryOwner } = await getUserClinicMember(auth.currentUser);
        setCurrentMember(member);
        setIsDoctorOwnerFallback(isPrimaryOwner);
      } else {
        // Fallback for single-doctor clinic viewing
        setIsDoctorOwnerFallback(true);
      }
    }
    loadMemberInfo();
  }, [doctor.uid]);

  // TV Queue Fullscreen Display state
  const [showTVQueue, setShowTVQueue] = useState(false);

  // Quick follow-up modal for queue patient
  const [quickFollowUpPatient, setQuickFollowUpPatient] = useState<{ name: string; phone: string } | null>(null);

  // Doctor Consultation Modal state
  const [selectedPatientForConsultation, setSelectedPatientForConsultation] = useState<PatientRecord | null>(null);

  // Patient File Side Panel Drawer state
  const [isPatientFileOpen, setIsPatientFileOpen] = useState(false);
  const [selectedPatientForFile, setSelectedPatientForFile] = useState<PatientRecord | null>(null);
  const [patientFileInitialTab, setPatientFileInitialTab] = useState<'overview' | 'consultation' | 'prescriptions' | 'investigations' | 'history' | 'payments' | 'growth'>('overview');

  // Fast Patient Registration & Split Payment Modal state
  const [isFastRegistrationOpen, setIsFastRegistrationOpen] = useState(false);

  // Manual Walk-In Registration Modal state
  const [isManualAddOpen, setIsManualAddOpen] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [isSubmittingManual, setIsSubmittingManual] = useState(false);

  // Ratings & Reviews state for Doctor
  const [doctorRatings, setDoctorRatings] = useState<DoctorRating[]>([]);
  const [showReviewsModal, setShowReviewsModal] = useState(false);

  // Load Doctor Ratings
  useEffect(() => {
    async function loadRatings() {
      const rList = await getDoctorRatings(doctor.uid);
      setDoctorRatings(rList);
      if (rList.length > 0) {
        const calculatedAvg = parseFloat((rList.reduce((acc, r) => acc + (Number(r.stars) || 0), 0) / rList.length).toFixed(1));
        if (doctor.ratingAverage !== calculatedAvg || doctor.ratingCount !== rList.length) {
          recalculateDoctorRatingStats(doctor.uid).catch(console.error);
        }
      }
    }
    loadRatings();
  }, [doctor.uid]);

  // Dynamic Rating Average Calculation
  const activeRatingAvg = doctorRatings.length > 0
    ? (doctorRatings.reduce((acc, r) => acc + (Number(r.stars) || 0), 0) / doctorRatings.length).toFixed(1)
    : (doctor.ratingAverage ? Number(doctor.ratingAverage).toFixed(1) : "0.0");
  const activeRatingCount = doctorRatings.length > 0 ? doctorRatings.length : (doctor.ratingCount || 0);

  // Active Daily Session Context
  const [activeDailySession, setActiveDailySession] = useState<DailySession | null>(null);

  // Real-time Firestore Queue Subscription (strictly scoped to active session date)
  useEffect(() => {
    setLoading(true);
    const sessionDate = activeDailySession?.date || getTodayDateString();
    const unsubscribe = subscribeToDoctorQueue(doctor.uid, sessionDate, (data) => {
      setPatients(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [doctor.uid, activeDailySession?.date]);

  const [updatingPatientId, setUpdatingPatientId] = useState<string | null>(null);

  // Derived Statistics
  const waitingPatients = patients.filter(p => p.status === 'waiting');
  const calledPatient = patients.find(p => p.status === 'called');
  const donePatients = patients.filter(p => p.status === 'done');
  const cancelledPatients = patients.filter(p => p.status === 'cancelled');
  const noShowPatients = patients.filter(p => p.status === 'no_show');

  // Filtered Queue
  const displayedPatients = patients.filter(p => {
    if (filterStatus !== 'all' && p.status !== filterStatus) return false;
    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      return (
        p.name.toLowerCase().includes(term) ||
        p.phone.includes(term) ||
        p.sequenceNumber.toString() === term
      );
    }
    return true;
  });

  // Call Next Patient (Optimistic UI)
  const handleCallNext = async () => {
    if (activeDailySession?.status === 'completed') {
      onShowToast("يوم العمل مكتمل", "تم إنهاء وتوثيق هذا اليوم، لبدء طابور جديد يرجى بدء يوم عمل جديد.", "warning");
      return;
    }

    const nextPatient = waitingPatients[0];
    if (!nextPatient && !calledPatient) {
      onShowToast("لا يوجد مرضى في الانتظار", "الطابور فارغ حالياً", "info");
      return;
    }

    if (!nextPatient) {
      onShowToast("تم إكمال جميع الكشوفات اليوم!", "لا يوجد مرضى آخرون في الانتظار", "success");
      return;
    }

    // Optimistic UI state update immediately
    const prevPatients = patients;
    const nowIso = new Date().toISOString();
    setPatients((prev) =>
      prev.map((p) => {
        if (p.id === calledPatient?.id) return { ...p, status: 'done' as PatientStatus, doneAt: nowIso };
        if (p.id === nextPatient.id) return { ...p, status: 'called' as PatientStatus, calledAt: nowIso };
        return p;
      })
    );

    playTurnNotificationSound('turn');
    speakText(`مريض رقم ${nextPatient.sequenceNumber}، ${nextPatient.name}، تفضل بالدخول للطبيب`);
    onShowToast(`تم استدعاء المريض رقم #${nextPatient.sequenceNumber}`, `${nextPatient.name} - ${nextPatient.phone}`, "success");

    setIsCallingNext(true);
    try {
      await callNextPatient(doctor.uid);
      dispatchClinicEvent({
        clinicId: doctor.uid,
        eventType: 'PATIENT_CALLED',
        patientId: nextPatient.patientId || nextPatient.id,
        patientName: nextPatient.name,
        patientPhone: nextPatient.phone,
        ticketId: nextPatient.id
      }).catch(console.error);
    } catch (err) {
      console.error("Error calling next patient:", err);
      setPatients(prevPatients); // Revert on failure
      onShowToast("خطأ في الاستدعاء", "تعذر تحديث حالة المريض في قاعدة البيانات", "error");
    } finally {
      setIsCallingNext(false);
    }
  };

  // Action: Single Patient Status Change (Optimistic UI)
  const handleStatusChange = async (patient: PatientRecord, newStatus: PatientStatus) => {
    if (updatingPatientId === patient.id || patient.status === newStatus) return;
    setUpdatingPatientId(patient.id);

    const prevPatients = patients;
    const nowIso = new Date().toISOString();

    // Optimistic UI update
    setPatients((prev) =>
      prev.map((p) => {
        if (p.id === patient.id) {
          return {
            ...p,
            status: newStatus,
            calledAt: newStatus === 'called' ? nowIso : p.calledAt,
            doneAt: newStatus === 'done' ? nowIso : p.doneAt
          };
        }
        return p;
      })
    );

    if (newStatus === 'called') {
      playTurnNotificationSound('turn');
      speakText(`مريض رقم ${patient.sequenceNumber}، ${patient.name}`);
      onShowToast(`تم استدعاء ${patient.name}`, `دور رقم #${patient.sequenceNumber}`, "info");
    } else if (newStatus === 'done') {
      playTurnNotificationSound('success');
      onShowToast(`تم إنهاء كشف ${patient.name}`, "تم إكمال الكشف بنجاح", "success");
    } else if (newStatus === 'cancelled') {
      onShowToast(`تم إلغاء حجز ${patient.name}`, "تمت إزالته من الطابور النشط", "warning");
    } else if (newStatus === 'waiting') {
      onShowToast(`تمت إعادة ${patient.name} للطابور`, `المريض في قائمة الانتظار بدور رقم #${patient.sequenceNumber}`, "info");
    }

    try {
      await updatePatientStatus(doctor.uid, patient.id, newStatus, patient.status);
      if (newStatus === 'called' || newStatus === 'done') {
        dispatchClinicEvent({
          clinicId: doctor.uid,
          eventType: newStatus === 'called' ? 'PATIENT_CALLED' : 'PATIENT_DONE',
          patientId: patient.patientId || patient.id,
          patientName: patient.name,
          patientPhone: patient.phone,
          ticketId: patient.id
        }).catch(console.error);
      }
    } catch (err: any) {
      console.error("Status update error:", err);
      setPatients(prevPatients); // Revert on failure
      const errorMsg = err?.message || "تعذر تغيير حالة الحجز في قاعدة البيانات";
      onShowToast("خطأ في التحديث", errorMsg, "error");
    } finally {
      setUpdatingPatientId(null);
    }
  };

  // Action: Order Medical Test (X-ray, Lab, X-ray + Lab)
  const handleQuickMedicalOrder = async (patient: PatientRecord, orderType: 'xray' | 'lab' | 'xray_and_lab') => {
    try {
      const { orderLabel, emoji } = await recordPatientMedicalOrder(
        doctor.uid,
        patient.id,
        orderType,
        patient.name,
        patient.phone
      );
      onShowToast(`تم تسجيل طلب ${orderLabel} ${emoji}`, `تم إرفاق طلب ${orderLabel} لملف ${patient.name}`, 'success');
    } catch (err: any) {
      console.error('Error ordering medical test:', err);
      onShowToast('تعذر تسجيل الطلب', err?.message, 'error');
    }
  };

  // Action: Walk-In Manual Patient Add (Optimistic UI)
  const handleManualAddPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = manualName.trim();
    if (!cleanName) {
      onShowToast("يرجى إدخال اسم المريض", "", "warning");
      return;
    }
    const phoneValidation = validatePatientPhoneNumber(manualPhone);
    if (!phoneValidation.isValid) {
      onShowToast(phoneValidation.error || "رقم الهاتف يجب أن يكون من 10 إلى 11 رقمًا.", "", "warning");
      return;
    }
    const cleanPhone = phoneValidation.cleanPhone;

    const nextSeq = patients.length > 0 ? Math.max(...patients.map((p) => p.sequenceNumber || 0)) + 1 : 1;
    const tempId = `temp_${Date.now()}`;
    const optimisticPatient: PatientRecord = {
      id: tempId,
      patientId: `pid_${Date.now()}`,
      name: cleanName,
      phone: cleanPhone,
      sequenceNumber: nextSeq,
      queueNumber: nextSeq,
      status: 'waiting',
      date: activeDailySession?.date || getTodayDateString(),
      createdAt: new Date().toISOString(),
      doctorId: doctor.uid,
      clinicId: doctor.uid,
      visitType: 'كشف عيادة',
      serviceName: 'كشف',
      price: doctor.consultationFee || 200
    };

    // Optimistic UI update immediately
    setPatients((prev) => [...prev, optimisticPatient]);
    setIsManualAddOpen(false);
    setManualName('');
    setManualPhone('');
    playTurnNotificationSound('success');
    onShowToast("تم إضافة المريض بنجاح", `تم تخصيص رقم الدور #${nextSeq}`, "success");

    setIsSubmittingManual(true);
    try {
      const res = await bookPatient(doctor.uid, cleanName, cleanPhone, doctor.uid);
      setIsSubmittingManual(false);

      if (res.isExisting) {
        onShowToast("لديه حجز نشط بالفعل", `المريض مسجل برقم دور #${res.sequenceNumber}`, "warning");
      } else {
        // Swap tempId with actual patientId from Firestore
        setPatients((prev) =>
          prev.map((p) => (p.id === tempId ? { ...p, id: res.patientId, sequenceNumber: res.sequenceNumber } : p))
        );
      }
    } catch (err: unknown) {
      setIsSubmittingManual(false);
      // Revert optimistic addition on failure
      setPatients((prev) => prev.filter((p) => p.id !== tempId));
      const errMsg = err instanceof Error ? err.message : "تعذر إضافة المريض";
      onShowToast("خطأ في إضافة المريض", errMsg, "error");
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6">

      {/* Subscription Banners */}
      {subState.isSuspended && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-amber-900 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 font-bold">
              <span className="text-xl leading-none inline-flex items-center justify-center">⏸️</span>
            </div>
            <div>
              <div className="font-bold text-sm font-['Tajawal',sans-serif]">
                اشتراك العيادة معلق مؤقتاً
              </div>
              <p className="text-xs text-amber-800">
                {doctor.subscriptionSuspendedReason || 'تم تعليق الاشتراك مؤقتاً من قبل إدارة المنصة. يرجى التواصل مع الإدارة لإعادة التفعيل.'}
              </p>
            </div>
          </div>
          <button
            onClick={onNavigateSubscription}
            className="shrink-0 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl transition shadow-xs cursor-pointer"
          >
            تفاصيل الاشتراك
          </button>
        </div>
      )}

      {subState.isExpired && (
        <div className="bg-rose-50 border border-rose-200/90 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-rose-900 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 font-bold">
              <span className="text-xl leading-none inline-flex items-center justify-center">⚠️</span>
            </div>
            <div>
              <div className="font-bold text-sm font-['Tajawal',sans-serif]">
                اشتراك العيادة منتهي حالياً!
              </div>
              <p className="text-xs text-rose-700">
                لا يمكن للمرضى الجدد حجز أدوار جديدة عبر QR Code حتى يتم تجديد الاشتراك. المرضى الحاليون يستطيعون متابعة دورهم.
              </p>
            </div>
          </div>
          <button
            onClick={onNavigateSubscription}
            className="shrink-0 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition shadow-xs cursor-pointer"
          >
            تجديد الاشتراك الآن
          </button>
        </div>
      )}

      {!subState.isLifetime && subState.remainingDays !== null && subState.remainingDays <= 3 && subState.remainingDays > 0 && (
        <div className="bg-amber-50/90 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-amber-900 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 font-bold">
              <span className="text-xl leading-none inline-flex items-center justify-center">⏳</span>
            </div>
            <div>
              <div className="font-bold text-sm font-['Tajawal',sans-serif]">
                تنبيه: اقترب موعد انتهاء الاشتراك ({subState.remainingTimeText})
              </div>
              <p className="text-xs text-amber-800">
                سينتهي الاشتراك في {subState.formattedExpiresAt}. جدد اشتراكك الآن لتجنب توقف حجوزات المرضى.
              </p>
            </div>
          </div>
          <button
            onClick={onNavigateSubscription}
            className="shrink-0 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl transition shadow-xs cursor-pointer"
          >
            تجديد الاشتراك الآن
          </button>
        </div>
      )}

      {/* Clinic Management Grid Layout */}
      <div className="flex flex-col lg:flex-row gap-5 xl:gap-6 items-start">
        
        {/* Desktop Sidebar (RTL Right side) */}
        <aside className="hidden lg:flex flex-col w-64 xl:w-72 shrink-0 bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-4 sticky top-20">
          {/* Clinic Identity & Quick Info */}
          <div className="border-b border-slate-100 pb-3.5">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-[#0d5c58] text-white flex items-center justify-center font-bold shrink-0 shadow-2xs">
                <Stethoscope className="w-5 h-5 text-teal-200" />
              </div>
              <div className="min-w-0">
                <h2 className="font-black text-sm text-slate-900 truncate font-['Tajawal',sans-serif]">{doctor.clinicName}</h2>
                <p className="text-[11px] text-slate-500 truncate">{doctor.name} • {doctor.specialty}</p>
              </div>
            </div>
            
            {/* Active Daily Session status badge */}
            <div className="mt-3 flex items-center justify-between text-xs px-2.5 py-1.5 bg-slate-50 rounded-lg border border-slate-200/60">
              <span className="text-slate-500 font-medium">جلسة اليوم:</span>
              <span className="flex items-center gap-1.5 font-bold text-teal-800">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                {activeDailySession?.sessionName || 'الدوام الفعلي'}
              </span>
            </div>
          </div>

          {/* Main Section Navigation */}
          <div className="space-y-1">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 px-2 mb-1.5">
              أقسام العيادة
            </div>

            <button
              onClick={() => setActiveSection('queue')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer min-h-[40px] ${
                activeSection === 'queue'
                  ? 'bg-[#0d5c58] text-white shadow-xs'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Users className="w-4 h-4" />
                <span>طابور اليوم</span>
              </div>
              <span className={`px-2 py-0.5 rounded-md text-[11px] font-black ${
                activeSection === 'queue' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700 border border-slate-200'
              }`}>
                {patients.length}
              </span>
            </button>

            <button
              onClick={() => setActiveSection('followups')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer min-h-[40px] ${
                activeSection === 'followups'
                  ? 'bg-[#0d5c58] text-white shadow-xs'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Calendar className="w-4 h-4" />
                <span>إعادة الكشف</span>
              </div>
            </button>

            <button
              onClick={() => setActiveSection('team')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer min-h-[40px] ${
                activeSection === 'team'
                  ? 'bg-[#0d5c58] text-white shadow-xs'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <UserCheck className="w-4 h-4" />
                <span>فريق العمل</span>
              </div>
            </button>

            {hasPermission(currentMember, 'VIEW_FINANCE', isDoctorOwnerFallback) && (
              <button
                onClick={() => setActiveSection('finance')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer min-h-[40px] ${
                  activeSection === 'finance'
                    ? 'bg-[#0d5c58] text-white shadow-xs'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Wallet className="w-4 h-4" />
                  <span>الخزينة والمالية</span>
                </div>
              </button>
            )}

            <button
              onClick={() => setActiveSection('ai_agent')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer min-h-[40px] ${
                activeSection === 'ai_agent'
                  ? 'bg-[#0d5c58] text-white shadow-xs'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Bot className="w-4 h-4 text-teal-400" />
                <span>المساعد الذكي</span>
              </div>
              <span className="text-[10px] font-bold text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200">AI</span>
            </button>
          </div>

          {/* Quick Operations Shortcuts */}
          <div className="border-t border-slate-100 pt-3 space-y-1">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 px-2 mb-1.5">
              أدوات التشغيل
            </div>

            <button
              onClick={() => setShowTVQueue(true)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            >
              <Tv className="w-4 h-4 text-teal-600 shrink-0" />
              <span>شاشة TV للانتظار</span>
            </button>

            <button
              onClick={onOpenQRModal}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            >
              <QrCode className="w-4 h-4 text-teal-600 shrink-0" />
              <span>رمز QR للحجز</span>
            </button>

            <button
              onClick={onOpenScannerModal}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            >
              <Camera className="w-4 h-4 text-teal-600 shrink-0" />
              <span>ماسح التذاكر السريع</span>
            </button>

            <button
              onClick={() => setIsFastRegistrationOpen(true)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-teal-800 bg-teal-50 hover:bg-teal-100 transition cursor-pointer border border-teal-200/60 mt-2"
            >
              <Plus className="w-4 h-4 text-teal-700 shrink-0" />
              <span>إضافة مريض يدوي</span>
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 min-w-0 w-full space-y-5">
          {/* Mobile Navigation Tabs */}
          <div className="lg:hidden flex items-center gap-1.5 bg-slate-100/90 p-1.5 rounded-xl w-full overflow-x-auto scrollbar-none">
            <button
              onClick={() => setActiveSection('queue')}
              className={`flex-1 min-w-[90px] py-2 px-2.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer min-h-[38px] whitespace-nowrap ${
                activeSection === 'queue'
                  ? 'bg-[#0d5c58] text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5 shrink-0" />
              <span>الطابور ({patients.length})</span>
            </button>

            <button
              onClick={() => setActiveSection('followups')}
              className={`flex-1 min-w-[90px] py-2 px-2.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer min-h-[38px] whitespace-nowrap ${
                activeSection === 'followups'
                  ? 'bg-[#0d5c58] text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 shrink-0" />
              <span>المتابعات</span>
            </button>

            <button
              onClick={() => setActiveSection('team')}
              className={`flex-1 min-w-[90px] py-2 px-2.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer min-h-[38px] whitespace-nowrap ${
                activeSection === 'team'
                  ? 'bg-[#0d5c58] text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5 shrink-0" />
              <span>الفريق</span>
            </button>

            {hasPermission(currentMember, 'VIEW_FINANCE', isDoctorOwnerFallback) && (
              <button
                onClick={() => setActiveSection('finance')}
                className={`flex-1 min-w-[90px] py-2 px-2.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer min-h-[38px] whitespace-nowrap ${
                  activeSection === 'finance'
                    ? 'bg-[#0d5c58] text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Wallet className="w-3.5 h-3.5 shrink-0" />
                <span>المالية</span>
              </button>
            )}

            <button
              onClick={() => setActiveSection('ai_agent')}
              className={`flex-1 min-w-[100px] py-2 px-2.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer min-h-[38px] whitespace-nowrap ${
                activeSection === 'ai_agent'
                  ? 'bg-[#0d5c58] text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Bot className="w-3.5 h-3.5 shrink-0 text-teal-400" />
              <span>الوكيل AI</span>
            </button>
          </div>

          {/* Header Info & Hero Controls */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 md:p-6 border border-slate-200/80 shadow-2xs relative overflow-hidden">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-5 relative z-10">
              
              {/* Clinic & Doctor Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span className="text-xs font-semibold text-teal-800 bg-teal-50 px-2.5 py-0.5 rounded-md border border-teal-200">
                    {doctor.specialty}
                  </span>
                  <span className="text-xs text-slate-500 font-medium">
                    • {doctor.clinicName}
                  </span>
                  <button
                    onClick={onNavigateSubscription}
                    className={`px-2.5 py-0.5 rounded-md text-xs font-bold border transition flex items-center gap-1 cursor-pointer ${subState.badgeClass}`}
                    title={`حالة الاشتراك: ${subState.statusLabelAr} - ينتهي: ${subState.formattedExpiresAt}`}
                  >
                    <span>⚡</span>
                    <span>{subState.statusLabelAr}</span>
                    <span className="text-[10px] opacity-80">({subState.remainingTimeText})</span>
                  </button>
                  <button
                    onClick={() => setShowReviewsModal(true)}
                    className="px-2.5 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-md text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                    title="عرض تقييمات وآراء المرضى"
                  >
                    <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                    <span>{activeRatingAvg} ({activeRatingCount})</span>
                  </button>
                </div>
                <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 font-['Tajawal',sans-serif] tracking-tight">
                  {doctor.name}
                </h1>
                <p className="text-xs text-slate-500 mt-1 flex items-center gap-2 sm:gap-3 flex-wrap">
                  <span>ساعات العمل: {doctor.workHours.open} - {doctor.workHours.close}</span>
                  <span>•</span>
                  <span>الحد اليومي: {doctor.workHours.maxPatientsPerDay} مريض</span>
                </p>
              </div>

              {/* Call Next Patient Big Action Box */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-[#0d5c58] p-3.5 sm:p-4 rounded-xl text-white shadow-xs border border-teal-850 w-full lg:w-auto shrink-0">
                <div className="text-right flex-1 min-w-[150px]">
                  <div className="text-[11px] text-teal-100 font-semibold">المريض الحالي داخل العيادة:</div>
                  <div className="text-base sm:text-lg font-black text-teal-200 font-['Tajawal',sans-serif] truncate max-w-[220px]">
                    {calledPatient ? `#${calledPatient.sequenceNumber} - ${calledPatient.name}` : 'لا يوجد مريض حالياً'}
                  </div>
                  <div className="text-[10px] text-teal-100 mt-0.5">
                    المتبقي في الانتظار: <span className="text-amber-300 font-bold">{waitingPatients.length}</span> مريض
                  </div>
                </div>

                <button
                  onClick={handleCallNext}
                  disabled={isCallingNext || (waitingPatients.length === 0 && !calledPatient)}
                  className={`w-full sm:w-auto px-5 sm:px-6 py-2.5 sm:py-3 rounded-lg font-black text-xs sm:text-sm transition shadow-sm flex items-center justify-center gap-2 shrink-0 min-h-[44px] cursor-pointer ${
                    waitingPatients.length > 0 || calledPatient
                      ? 'bg-white hover:bg-teal-50 text-[#0d5c58] active:scale-95'
                      : 'bg-teal-900/60 text-teal-300/60 cursor-not-allowed border border-teal-700/50'
                  }`}
                >
                  <Volume2 className="w-4 h-4 text-[#0d5c58] shrink-0" />
                  <span>{isCallingNext ? 'جاري الاستدعاء...' : 'استدعاء التالي'}</span>
                </button>
              </div>

            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-4 mt-4 border-t border-slate-100">
              <div className="p-2.5 bg-amber-50/70 border border-amber-200/60 rounded-xl">
                <div className="text-[11px] font-semibold text-amber-800">في الانتظار</div>
                <div className="text-lg font-black text-amber-900">{waitingPatients.length}</div>
              </div>
              <div className="p-2.5 bg-teal-50/70 border border-teal-200/60 rounded-xl">
                <div className="text-[11px] font-semibold text-teal-800">داخل الكشف</div>
                <div className="text-lg font-black text-teal-900">{calledPatient ? 1 : 0}</div>
              </div>
              <div className="p-2.5 bg-slate-50 border border-slate-200/70 rounded-xl">
                <div className="text-[11px] font-semibold text-slate-600">تم الكشف</div>
                <div className="text-lg font-black text-slate-800">{donePatients.length}</div>
              </div>
              <div className="p-2.5 bg-slate-50 border border-slate-200/70 rounded-xl">
                <div className="text-[11px] font-semibold text-slate-600">إجمالي الحجوزات</div>
                <div className="text-lg font-black text-slate-800">{patients.length}</div>
              </div>
            </div>
          </div>

          {/* Active Module Routing */}
          {activeSection === 'ai_agent' ? (
            <AiAgentControlCenter
              doctor={doctor}
              currentMember={currentMember}
              isDoctorOwner={isDoctorOwnerFallback}
              isSubscriptionActive={subState.isActive}
              onShowToast={(msg, type) => onShowToast('الوكيل الذكي', msg, type)}
            />
          ) : activeSection === 'finance' ? (
            <ClinicFinanceManager
              currentMember={currentMember}
              organizationId={doctor.uid}
              isDoctorOwnerFallback={isDoctorOwnerFallback}
              doctor={doctor}
              patientsList={patients}
              initialPatientForPayment={selectedPatientForPayment}
              activeDailySession={activeDailySession}
              onShowToast={onShowToast}
            />
          ) : activeSection === 'team' ? (
            <ClinicTeamManager
              currentMember={currentMember}
              organizationId={doctor.uid}
              isDoctorOwnerFallback={isDoctorOwnerFallback}
              onShowToast={onShowToast}
            />
          ) : activeSection === 'followups' ? (
            <DoctorFollowUpManager
              doctorId={doctor.uid}
              doctorName={doctor.name}
              clinicId={doctor.uid}
              clinicName={doctor.clinicName}
              onShowToast={onShowToast}
            />
          ) : (
            /* Main Queue Management Section */
            <div className="space-y-5">
              {/* Daily Operating System & Past Days Archive */}
              <DailySessionManager
                doctorId={doctor.uid}
                doctorName={doctor.name}
                clinicName={doctor.clinicName}
                currentUserId={currentMember?.uid || doctor.uid}
                currentUserName={currentMember?.name || doctor.name}
                todayPatients={patients}
                onSessionChange={setActiveDailySession}
                onDayCompleted={() => {
                  setPatients([]);
                }}
                onShowToast={onShowToast}
              />

              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
              
              {/* Controls Toolbar */}
              <div className="p-3 sm:p-4 border-b border-slate-100 bg-slate-50/60 flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3">
                
                {/* Status Filter Tabs */}
                <div className="flex items-center gap-1 overflow-x-auto w-full xl:w-auto pb-1 xl:pb-0 scrollbar-none">
                  <button
                    onClick={() => setFilterStatus('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition shrink-0 cursor-pointer min-h-[36px] ${
                      filterStatus === 'all'
                        ? 'bg-[#0d5c58] text-white shadow-2xs'
                        : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                    }`}
                  >
                    الكل ({patients.length})
                  </button>
                  <button
                    onClick={() => setFilterStatus('waiting')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition shrink-0 cursor-pointer min-h-[36px] ${
                      filterStatus === 'waiting'
                        ? 'bg-[#d97706] text-white shadow-2xs'
                        : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                    }`}
                  >
                    في الانتظار ({waitingPatients.length})
                  </button>
                  <button
                    onClick={() => setFilterStatus('called')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition shrink-0 cursor-pointer min-h-[36px] ${
                      filterStatus === 'called'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                    }`}
                  >
                    في الكشف ({calledPatient ? 1 : 0})
                  </button>
                  <button
                    onClick={() => setFilterStatus('done')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition shrink-0 cursor-pointer min-h-[36px] ${
                      filterStatus === 'done'
                        ? 'bg-slate-700 text-white shadow-2xs'
                        : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                    }`}
                  >
                    مكتمل ({donePatients.length})
                  </button>
                  <button
                    onClick={() => setFilterStatus('no_show')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition shrink-0 cursor-pointer min-h-[36px] ${
                      filterStatus === 'no_show'
                        ? 'bg-rose-600 text-white shadow-2xs'
                        : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                    }`}
                  >
                    غائب ({noShowPatients.length})
                  </button>
                  <button
                    onClick={() => setFilterStatus('cancelled')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition shrink-0 cursor-pointer min-h-[36px] ${
                      filterStatus === 'cancelled'
                        ? 'bg-slate-600 text-white shadow-2xs'
                        : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                    }`}
                  >
                    ملغي ({cancelledPatients.length})
                  </button>
                </div>

                {/* Action Tools & Search */}
                <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full xl:w-auto">
                  {/* Search Input */}
                  <div className="relative flex-1 sm:w-64 min-w-[140px]">
                    <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="بحث بالموبايل أو الاسم أو الدور..."
                      className="w-full pl-3 pr-9 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-[#0d5c58] min-h-[36px]"
                    />
                  </div>

                  {/* TV Queue Display */}
                  <button
                    onClick={() => setShowTVQueue(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0d5c58] hover:bg-[#084d49] text-white font-bold text-xs rounded-lg transition shadow-2xs shrink-0 cursor-pointer min-h-[36px]"
                    title="شاشة الانتظار للتلفزيون (TV Queue Display)"
                  >
                    <Tv className="w-4 h-4 shrink-0 text-teal-200" />
                    <span className="hidden sm:inline">شاشة TV</span>
                  </button>

                  {/* Quick Scanner */}
                  <button
                    onClick={onOpenScannerModal}
                    className="p-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg transition shadow-2xs cursor-pointer min-h-[36px] flex items-center justify-center shrink-0"
                    title="ماسح الكاميرا للتذاكر"
                    aria-label="ماسح الكاميرا للتذاكر"
                  >
                    <QrCode className="w-4 h-4 shrink-0 text-slate-600" />
                  </button>

                  {/* Add Walk-In Patient */}
                  <button
                    onClick={() => setIsFastRegistrationOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0d5c58] hover:bg-[#084d49] text-white font-bold text-xs rounded-lg transition shadow-2xs shrink-0 cursor-pointer min-h-[36px]"
                  >
                    <Plus className="w-4 h-4 shrink-0 text-teal-200" />
                    <span>إضافة مريض</span>
                  </button>
                </div>

              </div>

            {/* Patients Queue List */}
            <div className="p-3 sm:p-4 md:p-5">
              {loading ? (
                <div className="space-y-2.5 py-6">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : displayedPatients.length === 0 ? (
                <div className="text-center py-12 bg-slate-50/50 rounded-xl border border-dashed border-slate-200 p-4">
                  <Users className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                  <h3 className="font-bold text-slate-700 text-base font-['Tajawal',sans-serif]">
                    لا يوجد مرضى في القائمة حالياً
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    اطبع رمز QR وشاركه مع المرضى للحجز التلقائي، أو اضغط "إضافة مريض" لتسجيل حجز يدوي.
                  </p>
                  <button
                    onClick={onOpenQRModal}
                    className="mt-4 px-4 py-2 bg-[#0d5c58] hover:bg-[#084d49] text-white font-semibold text-xs rounded-lg transition cursor-pointer min-h-[38px]"
                  >
                    عرض رمز QR للطباعة
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <AnimatePresence>
                    {displayedPatients.map((patient) => {
                      const isCalled = patient.status === 'called';
                      const isWaiting = patient.status === 'waiting';
                      const isDone = patient.status === 'done';
                      const isCancelled = patient.status === 'cancelled';
                      const isNoShow = patient.status === 'no_show';

                      return (
                        <motion.div
                          key={patient.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.98 }}
                          className={`p-3 sm:p-3.5 rounded-xl border transition-all flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 ${
                            isCalled
                              ? 'bg-teal-50/50 border-teal-300 ring-2 ring-teal-400/20 shadow-xs'
                              : isWaiting
                              ? 'bg-white border-slate-200 hover:border-amber-300 shadow-2xs'
                              : isDone
                              ? 'bg-white border-slate-200/60 opacity-85'
                              : isNoShow
                              ? 'bg-rose-50/40 border-rose-200 shadow-2xs'
                              : 'bg-slate-50/80 border-slate-200 opacity-60'
                          }`}
                        >
                          {/* Left side info */}
                          <div className="flex items-center gap-3 w-full lg:w-auto">
                            
                            {/* Sequence Badge */}
                            <div
                              onClick={() => {
                                setSelectedPatientForFile(patient);
                                setPatientFileInitialTab('overview');
                                setIsPatientFileOpen(true);
                              }}
                              className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl font-black text-sm sm:text-base flex items-center justify-center shrink-0 shadow-2xs font-['Tajawal',sans-serif] cursor-pointer hover:opacity-90 transition ${
                                isCalled ? 'bg-[#0d5c58] text-white animate-pulse' :
                                isWaiting ? 'bg-[#d97706] text-white' :
                                isDone ? 'bg-slate-700 text-white' :
                                isNoShow ? 'bg-rose-600 text-white' : 'bg-slate-400 text-white'
                              }`}
                              title="فتح الملف الطبي للمريض"
                            >
                              #{patient.sequenceNumber}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4
                                  onClick={() => {
                                    setSelectedPatientForFile(patient);
                                    setPatientFileInitialTab('overview');
                                    setIsPatientFileOpen(true);
                                  }}
                                  className="font-bold text-slate-900 text-sm sm:text-base font-['Tajawal',sans-serif] whitespace-normal break-words cursor-pointer hover:text-[#0d5c58] transition"
                                  title="انقر لفتح الملف الطبي الشامل والروشتات"
                                >
                                  {patient.name}
                                </h4>

                                {/* Status Badge */}
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                  isCalled ? 'bg-teal-100 text-teal-900 border border-teal-200' :
                                  isWaiting ? 'bg-amber-100 text-amber-900 border border-amber-200' :
                                  isDone ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
                                  isNoShow ? 'bg-rose-50 text-rose-800 border border-rose-200' :
                                  'bg-slate-100 text-slate-600 border border-slate-200'
                                }`}>
                                  {isCalled ? 'داخل الكشف الآن' :
                                   isWaiting ? 'في الانتظار' :
                                   isDone ? 'تم الكشف' :
                                   isNoShow ? 'غائب (لم يحضر)' : 'ملغي'}
                                </span>

                                {/* Medical Order Badge */}
                                {patient.medicalOrderLabel && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-teal-50 text-teal-900 border border-teal-200">
                                    <Activity className="w-3 h-3 text-teal-600" />
                                    <span>{patient.medicalOrderLabel}</span>
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-2 sm:gap-3 text-xs text-slate-500 mt-0.5 flex-wrap">
                                <span className="flex items-center gap-1 font-mono dir-ltr">
                                  <Phone className="w-3 h-3 text-slate-400" />
                                  {patient.phone}
                                </span>
                                <span>•</span>
                                <span>
                                  وقت الحجز: {new Date(patient.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            </div>

                          </div>

                          {/* Right side actions */}
                          <div className="grid grid-cols-3 sm:flex sm:flex-wrap items-center gap-1.5 w-full lg:w-auto justify-start lg:justify-end border-t lg:border-0 pt-2 lg:pt-0 border-slate-100">
                            {/* 1. Primary Action */}
                            {(isWaiting || isNoShow) && (
                              <button
                                onClick={() => handleStatusChange(patient, 'called')}
                                disabled={updatingPatientId === patient.id}
                                className="flex items-center justify-center gap-1 px-3 py-1.5 min-h-[36px] bg-[#d97706] hover:bg-amber-600 text-white font-black text-xs rounded-lg transition shadow-2xs active:scale-95 cursor-pointer whitespace-nowrap disabled:opacity-50"
                                title={isNoShow ? 'استدعاء المريض الغائب لدخول الكشف فور حضوره' : 'استدعاء المريض'}
                              >
                                <Volume2 className="w-3.5 h-3.5" />
                                <span>{isNoShow ? 'استدعاء (حضر)' : 'استدعاء'}</span>
                              </button>
                            )}

                            {(isWaiting || isCalled) && (
                              <button
                                onClick={() => handleStatusChange(patient, 'done')}
                                disabled={updatingPatientId === patient.id}
                                className="flex items-center justify-center gap-1 px-3 py-1.5 min-h-[36px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition shadow-2xs active:scale-95 cursor-pointer whitespace-nowrap disabled:opacity-50"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>تم الكشف</span>
                              </button>
                            )}

                            {/* 2. Clinical Consultation */}
                            <button
                              onClick={() => {
                                setSelectedPatientForFile(patient);
                                setPatientFileInitialTab('consultation');
                                setIsPatientFileOpen(true);
                              }}
                              className="flex items-center justify-center gap-1 px-2.5 py-1.5 min-h-[36px] bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 font-bold text-xs rounded-lg transition shadow-2xs active:scale-95 cursor-pointer whitespace-nowrap"
                              title="بدء الكشف الطبي وتوثيق التشخيص"
                            >
                              <Stethoscope className="w-3.5 h-3.5 text-teal-700" />
                              <span>كشف</span>
                            </button>

                            {/* 3. Open Patient File */}
                            <button
                              onClick={() => {
                                setSelectedPatientForFile(patient);
                                setPatientFileInitialTab('overview');
                                setIsPatientFileOpen(true);
                              }}
                              className="flex items-center justify-center gap-1 px-2.5 py-1.5 min-h-[36px] bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 font-bold text-xs rounded-lg transition shadow-2xs active:scale-95 cursor-pointer whitespace-nowrap"
                              title="فتح الملف الطبي الشامل للمريض"
                            >
                              <FileText className="w-3.5 h-3.5 text-slate-700" />
                              <span>الملف</span>
                            </button>

                            {/* 4. Prescription Photo Shortcut */}
                            <button
                              onClick={() => {
                                setSelectedPatientForFile(patient);
                                setPatientFileInitialTab('prescriptions');
                                setIsPatientFileOpen(true);
                              }}
                              className="flex items-center justify-center gap-1 px-2 py-1.5 min-h-[36px] bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-bold text-xs rounded-lg transition shadow-2xs active:scale-95 cursor-pointer whitespace-nowrap"
                              title="تصوير روشتة ورقية أو عرض الروشتات"
                            >
                              <Camera className="w-3.5 h-3.5 text-slate-600" />
                              <span>روشتة</span>
                            </button>

                            {/* 5. Quick Payment Registration */}
                            {hasPermission(currentMember, 'VIEW_FINANCE', isDoctorOwnerFallback) && (
                              <button
                                onClick={() => {
                                  setSelectedPatientForPayment(patient);
                                  setActiveSection('finance');
                                }}
                                className="flex items-center justify-center gap-1 px-2.5 py-1.5 min-h-[36px] bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold text-xs rounded-lg transition cursor-pointer active:scale-95 whitespace-nowrap"
                                title="تسجيل دفع رسوم الكشف"
                              >
                                <CreditCard className="w-3.5 h-3.5 text-emerald-700" />
                                <span>الدفع</span>
                              </button>
                            )}

                            {/* 6. Quick Medical Order (X-ray / Lab) */}
                            <button
                              onClick={() => handleQuickMedicalOrder(patient, 'xray_and_lab')}
                              className="flex items-center justify-center gap-1 px-2 py-1.5 min-h-[36px] bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 font-bold text-xs rounded-lg transition cursor-pointer active:scale-95 whitespace-nowrap"
                              title="طلب فحص أشعة وتحليل للمريض"
                            >
                              <Activity className="w-3.5 h-3.5 text-teal-700" />
                              <span>فحص</span>
                            </button>

                            {/* 7. Re-queue */}
                            {(isDone || isCancelled || isNoShow) && (
                              <button
                                onClick={() => handleStatusChange(patient, 'waiting')}
                                disabled={updatingPatientId === patient.id}
                                className="flex items-center justify-center gap-1 px-2.5 py-1.5 min-h-[36px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition cursor-pointer whitespace-nowrap disabled:opacity-50"
                                title={isNoShow ? 'إعادة المريض الغائب إلى قائمة الانتظار' : 'إعادة المريض إلى الطابور'}
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>إعادة</span>
                              </button>
                            )}

                            {/* 8. Cancel */}
                            {(isWaiting || isCalled || isNoShow) && (
                              <button
                                onClick={() => handleStatusChange(patient, 'cancelled')}
                                disabled={updatingPatientId === patient.id}
                                className="flex items-center justify-center gap-1 px-2 py-1.5 min-h-[36px] bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs rounded-lg transition cursor-pointer whitespace-nowrap active:scale-95 disabled:opacity-50"
                                title="إلغاء حجز المريض"
                              >
                                <X className="w-3.5 h-3.5" />
                                <span>إلغاء</span>
                              </button>
                            )}

                            {/* 9. No-show */}
                            {(isWaiting || isCalled) && (
                              <button
                                disabled={updatingPatientId === patient.id}
                                onClick={async () => {
                                  if (updatingPatientId === patient.id) return;
                                  setUpdatingPatientId(patient.id);
                                  try {
                                    await markQueuePatientNoShow(doctor.uid, patient.id);
                                    onShowToast('تم تسجيل تغيب المريض (No-show)', `تم تحويل حالة ${patient.name} إلى غائب`, 'info');
                                  } catch (err: any) {
                                    console.error('markQueuePatientNoShow error:', err);
                                    const errMsg = err?.message || 'تعذر تسجيل حالة الغياب في قاعدة البيانات';
                                    onShowToast('فشل التحديث', errMsg, 'error');
                                  } finally {
                                    setUpdatingPatientId(null);
                                  }
                                }}
                                className="flex items-center justify-center gap-1 px-2 py-1.5 min-h-[36px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition cursor-pointer whitespace-nowrap active:scale-95 disabled:opacity-50"
                                title="لم يحضر (No-show)"
                              >
                                <Clock className="w-3.5 h-3.5" />
                                <span>غائب</span>
                              </button>
                            )}
                          </div>

                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </div>

          </div>
          </div>
          )}

        </div>
      </div>

      {/* Custom Website Agency Section */}
      <CustomWebsiteSection />

      {/* Manual Walk-In Patient Registration Modal */}
      {isManualAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-100 text-right animate-in fade-in zoom-in-95 duration-200">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-slate-900 text-lg font-['Tajawal',sans-serif]">
                إضافة حجز مريض يدوي
              </h3>
              <button
                onClick={() => setIsManualAddOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                إلغاء
              </button>
            </div>

            <form onSubmit={handleManualAddPatient} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم المريض بالكامل</label>
                <input
                  type="text"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder="مثال: أحمد محمد علي"
                  required
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">رقم الموبايل</label>
                <input
                  type="tel"
                  dir="ltr"
                  maxLength={11}
                  value={manualPhone}
                  onChange={(e) => setManualPhone(sanitizePatientPhoneNumber(e.target.value, 11))}
                  onPaste={(e) => {
                    e.preventDefault();
                    setManualPhone(sanitizePatientPhoneNumber(e.clipboardData.getData('text'), 11));
                  }}
                  placeholder="01012345678"
                  required
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-sky-500 font-mono text-right"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmittingManual}
                  className="w-full py-3 bg-sky-600 hover:bg-sky-700 text-white font-bold text-sm rounded-xl transition shadow-xs"
                >
                  {isSubmittingManual ? 'جاري الإضافة...' : 'تأكيد الحجز وإصدار الرقم'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* Doctor Patient Reviews & Ratings Modal */}
      {showReviewsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-100 text-right animate-in fade-in zoom-in-95 duration-200">
            
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center font-bold">
                  <span className="text-base leading-none inline-flex items-center justify-center">⭐</span>
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base font-['Tajawal',sans-serif]">
                    تقييمات وآراء المرضى
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    التقييم العام: {activeRatingAvg} / 5 (إجمالي {activeRatingCount} تقييم)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowReviewsModal(false)}
                className="text-slate-400 hover:text-slate-700 text-xs font-bold px-3 py-1 bg-slate-100 rounded-lg"
              >
                إغلاق
              </button>
            </div>

            {/* Ratings List */}
            {doctorRatings.length === 0 ? (
              <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <span className="text-3xl block mx-auto mb-2 leading-none">💬</span>
                <p className="text-xs text-slate-500 font-medium">لا يوجد تقييمات حتى الآن من المرضى</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto pl-1">
                {doctorRatings.map((rev) => (
                  <div key={rev.id} className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 text-xs font-['Tajawal',sans-serif]">
                        {rev.patientName || "مريض"}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {rev.createdAt ? new Date(rev.createdAt).toLocaleDateString('ar-EG') : ''}
                      </span>
                    </div>

                    <div className="flex items-center gap-0.5 dir-ltr">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <span key={s} className="text-sm">
                          {s <= rev.stars ? '⭐' : '☆'}
                        </span>
                      ))}
                    </div>

                    {rev.comment && (
                      <p className="text-xs text-slate-700 bg-white p-2.5 rounded-xl border border-slate-100 font-medium">
                        "{rev.comment}"
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 pt-3 border-t border-slate-100 text-left">
              <button
                onClick={() => setShowReviewsModal(false)}
                className="px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition"
              >
                إغلاق
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Quick Follow-up Modal for patient from queue */}
      {quickFollowUpPatient && (
        <CreateFollowUpModal
          isOpen={!!quickFollowUpPatient}
          onClose={() => setQuickFollowUpPatient(null)}
          doctorId={doctor.uid}
          doctorName={doctor.name}
          clinicId={doctor.uid}
          clinicName={doctor.clinicName}
          initialPatientName={quickFollowUpPatient.name}
          initialPatientPhone={quickFollowUpPatient.phone}
          initialPatientId={quickFollowUpPatient.patientId || quickFollowUpPatient.id}
          onShowToast={onShowToast}
        />
      )}

      {/* Fullscreen TV Queue Display Overlay */}
      {showTVQueue && (
        <TVQueueDisplay
          clinicName={doctor.clinicName}
          doctorName={doctor.name}
          specialty={doctor.specialty}
          patients={patients}
          onClose={() => setShowTVQueue(false)}
        />
      )}

      {/* Doctor Consultation Workspace Modal (Section 12, 13, 14, 15) */}
      <DoctorConsultationModal
        isOpen={!!selectedPatientForConsultation}
        onClose={() => setSelectedPatientForConsultation(null)}
        patient={selectedPatientForConsultation}
        doctorId={doctor.uid}
        doctorName={doctor.name}
        clinicName={doctor.clinicName}
        onShowToast={onShowToast}
      />

      {/* Fast Patient Registration with Deduplication & Split Payment (Section 8, 9, 10, 11, 20, 21, 22) */}
      <FastPatientRegistrationModal
        isOpen={isFastRegistrationOpen}
        onClose={() => setIsFastRegistrationOpen(false)}
        doctorId={doctor.uid}
        doctorName={doctor.name}
        defaultConsultationPrice={doctor.consultationFee || 300}
        currentUserId={currentMember?.uid || doctor.uid}
        currentUserName={currentMember?.name || doctor.name}
        onPatientAdded={(newPatient) => {
          setPatients((prev) => {
            const exists = prev.some((p) => p.id === newPatient.id || (p.phone === newPatient.phone && p.status === 'waiting'));
            if (exists) return prev;
            return [...prev, newPatient];
          });
        }}
        onShowToast={onShowToast}
      />

      {/* Mobile Floating Action Button (FAB) for Walk-in Patient Registration */}
      <div className="fixed bottom-5 right-4 z-40 sm:hidden">
        <button
          onClick={() => setIsFastRegistrationOpen(true)}
          className="w-14 h-14 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl flex items-center justify-center font-bold text-2xl transition active:scale-90 cursor-pointer ring-4 ring-indigo-200/50"
          title="تسجيل مريض جديد"
        >
          ➕
        </button>
      </div>

      {/* Floating AI Copilot Action Button */}
      {activeSection !== 'ai_agent' && (
        <AiFloatingCopilotButton
          isOpen={isAiModalOpen}
          onClick={() => setIsAiModalOpen(!isAiModalOpen)}
        />
      )}

      {/* Floating AI Agent Modal / Drawer */}
      {isAiModalOpen && activeSection !== 'ai_agent' && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-end sm:items-center justify-center sm:p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-6 duration-300">
            <AiAgentControlCenter
              doctor={doctor}
              currentMember={currentMember}
              isDoctorOwner={isDoctorOwnerFallback}
              isSubscriptionActive={subState.isActive}
              onClose={() => setIsAiModalOpen(false)}
              onShowToast={(msg, type) => onShowToast('الوكيل الذكي', msg, type)}
            />
          </div>
        </div>
      )}

      {/* Comprehensive Patient Medical File Side Panel Drawer */}
      {selectedPatientForFile && (
        <PatientFileSidePanel
          isOpen={isPatientFileOpen}
          onClose={() => setIsPatientFileOpen(false)}
          doctorId={doctor.uid}
          doctorName={doctor.name}
          clinicName={doctor.clinicName}
          patientPhone={selectedPatientForFile.phone}
          patientName={selectedPatientForFile.name}
          patientRecord={selectedPatientForFile}
          initialTab={patientFileInitialTab}
          onShowToast={onShowToast}
          onConsultationComplete={() => {
            handleStatusChange(selectedPatientForFile, 'done');
          }}
        />
      )}

    </div>
  );
};
