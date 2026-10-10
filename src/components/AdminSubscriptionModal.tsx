import React, { useState, useMemo } from 'react';
import {
  X,
  Clock,
  Calendar,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Infinity as InfinityIcon,
  PauseCircle,
  PlayCircle,
  XCircle,
  PlusCircle,
  ArrowRight,
  ShieldCheck,
  RotateCcw,
  FileText
} from 'lucide-react';
import {
  DoctorProfile,
  SubscriptionDurationUnit,
  SubscriptionRenewalMode,
  SubscriptionAuditAction,
  SubscriptionLog
} from '../types';
import {
  calculateExpirationDate,
  formatDateTimeAr,
  formatRemainingTimeAr,
  getEffectiveSubscriptionState,
  DURATION_UNIT_OPTIONS,
  DURATION_PRESETS,
  SUBSCRIPTION_ACTION_LABELS_AR
} from '../utils/subscriptionUtils';
import {
  updateClinicSubscriptionByAdmin,
  generateReferenceCode,
  OFFICIAL_SUBSCRIPTION_PRICES
} from '../services/firebaseService';

interface AdminSubscriptionModalProps {
  clinic: DoctorProfile;
  adminId: string;
  adminEmail?: string;
  existingLogs?: SubscriptionLog[];
  onClose: () => void;
  onSuccess: (updatedClinic: Partial<DoctorProfile>) => void;
}

export const AdminSubscriptionModal: React.FC<AdminSubscriptionModalProps> = ({
  clinic,
  adminId,
  adminEmail,
  existingLogs = [],
  onClose,
  onSuccess
}) => {
  const currentSubState = useMemo(() => getEffectiveSubscriptionState(clinic), [clinic]);
  const refCode = clinic.referenceCode || generateReferenceCode(clinic.uid);

  // Tab: 'edit' or 'history'
  const [activeTab, setActiveTab] = useState<'edit' | 'history'>('edit');

  // Form states
  const [actionType, setActionType] = useState<SubscriptionAuditAction>('SUBSCRIPTION_EXTENDED');
  const [durationUnit, setDurationUnit] = useState<SubscriptionDurationUnit>('months');
  const [durationValue, setDurationValue] = useState<number>(1);
  const [renewalMode, setRenewalMode] = useState<SubscriptionRenewalMode>('extend');
  const [customDateTime, setCustomDateTime] = useState<string>('');
  const [amount, setAmount] = useState<number>(OFFICIAL_SUBSCRIPTION_PRICES.monthly);
  const [notes, setNotes] = useState<string>('');

  // Processing & Error
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmStep, setConfirmStep] = useState(false);

  // Calculate live preview of expiration date
  const previewState = useMemo(() => {
    if (actionType === 'SUBSCRIPTION_CANCELLED') {
      return {
        status: 'cancelled' as const,
        isLifetime: false,
        expiresAt: null,
        formattedExpiresAt: 'سيتم إلغاء الاشتراك فوراً',
        remainingText: 'ملغى'
      };
    }

    if (actionType === 'SUBSCRIPTION_SUSPENDED') {
      return {
        status: 'suspended' as const,
        isLifetime: currentSubState.isLifetime,
        expiresAt: clinic.subscriptionExpiresAt || clinic.subscriptionEndDate || null,
        formattedExpiresAt: 'تجميد مؤقت (الرصيد محفوظ)',
        remainingText: 'معلق'
      };
    }

    if (actionType === 'SUBSCRIPTION_SET_LIFETIME' || durationUnit === 'lifetime') {
      return {
        status: 'lifetime' as const,
        isLifetime: true,
        expiresAt: null,
        formattedExpiresAt: 'اشتراك دائم — مدى الحياة (بدون تاريخ انتهاء)',
        remainingText: 'مدى الحياة'
      };
    }

    // Active, Extended, Renewed or Reactivated
    const now = new Date();
    let baseDate = now;

    if (
      renewalMode === 'extend' &&
      actionType !== 'SUBSCRIPTION_SHORTENED' &&
      clinic.subscriptionExpiresAt &&
      !currentSubState.isLifetime
    ) {
      const curExp = new Date(clinic.subscriptionExpiresAt);
      if (curExp.getTime() > now.getTime()) {
        baseDate = curExp;
      }
    }

    const calculated = calculateExpirationDate(baseDate, durationUnit, durationValue, customDateTime);
    if (!calculated || isNaN(calculated.getTime())) {
      return {
        status: 'active' as const,
        isLifetime: false,
        expiresAt: null,
        formattedExpiresAt: 'تاريخ غير صالح أو غير مكتمل',
        remainingText: 'غير محدد'
      };
    }

    return {
      status: 'active' as const,
      isLifetime: false,
      expiresAt: calculated.toISOString(),
      formattedExpiresAt: formatDateTimeAr(calculated),
      remainingText: formatRemainingTimeAr(calculated, false, 'active')
    };
  }, [
    actionType,
    durationUnit,
    durationValue,
    renewalMode,
    customDateTime,
    clinic,
    currentSubState
  ]);

  // Apply a quick preset
  const handleApplyPreset = (preset: typeof DURATION_PRESETS[0]) => {
    setDurationUnit(preset.unit);
    setDurationValue(preset.value);

    if (preset.unit === 'lifetime') {
      setActionType('SUBSCRIPTION_SET_LIFETIME');
      setAmount(0);
    } else {
      setActionType(currentSubState.isExpired ? 'SUBSCRIPTION_RENEWED' : 'SUBSCRIPTION_EXTENDED');
      if (preset.unit === 'years' && preset.value === 1) {
        setAmount(OFFICIAL_SUBSCRIPTION_PRICES.yearly);
      } else if (preset.unit === 'months' && preset.value === 1) {
        setAmount(OFFICIAL_SUBSCRIPTION_PRICES.monthly);
      } else {
        setAmount(0);
      }
    }
  };

  // Submit subscription update to Firestore
  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      const res = await updateClinicSubscriptionByAdmin({
        clinicId: clinic.uid,
        adminId,
        adminEmail,
        action: actionType,
        durationType: durationUnit,
        durationValue,
        customExpiresAt: durationUnit === 'custom' ? customDateTime : null,
        renewalMode,
        notes,
        amount,
        plan: durationUnit === 'years' ? 'yearly' : durationUnit === 'lifetime' ? 'lifetime' : 'monthly'
      });

      onSuccess({
        subscriptionStatus: res.newStatus,
        subscriptionExpiresAt: res.expiresAt,
        subscriptionEndDate: res.expiresAt || undefined,
        isLifetime: res.isLifetime,
        subscriptionNotes: notes
      });

      onClose();
    } catch (err: any) {
      console.error("Failed to update subscription:", err);
      setErrorMessage(err?.message || "حدث خطأ أثناء تحديث بيانات الاشتراك");
      setConfirmStep(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter logs for this clinic
  const clinicLogs = useMemo(() => {
    return existingLogs
      .filter((l) => l.clinicId === clinic.uid)
      .sort((a, b) => new Date(b.activatedAt || b.timestamp || 0).getTime() - new Date(a.activatedAt || a.timestamp || 0).getTime());
  }, [existingLogs, clinic.uid]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs overflow-y-auto" dir="rtl">
      <div className="relative w-full max-w-3xl bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden font-['Cairo',sans-serif] my-8">
        
        {/* Modal Top Bar */}
        <div className="bg-slate-900 text-white p-5 sm:p-6 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-400">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black font-['Tajawal',sans-serif]">
                  إدارة وتفعيل اشتراك العيادة
                </h2>
                <span className="text-[11px] px-2.5 py-0.5 rounded-md bg-white/10 font-mono text-slate-300">
                  {refCode}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                {clinic.clinicName} — د. {clinic.name} ({clinic.specialty})
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center border-b border-slate-200 bg-slate-50 px-6 pt-3 gap-3">
          <button
            type="button"
            onClick={() => setActiveTab('edit')}
            className={`pb-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition ${
              activeTab === 'edit'
                ? 'border-sky-600 text-sky-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            <span>تعديل وتفعيل الاشتراك</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`pb-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition ${
              activeTab === 'history'
                ? 'border-sky-600 text-sky-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>سجل العمليات والتدقيق ({clinicLogs.length})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 max-h-[75vh] overflow-y-auto space-y-6">
          
          {/* Current State Summary Banner */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-[11px] text-slate-500 font-bold block">الحالة الراهنة للاشتراك:</span>
              <div className="flex items-center gap-2 mt-1">
                <span className={`px-2.5 py-1 rounded-full text-xs font-black border ${currentSubState.badgeClass}`}>
                  {currentSubState.statusLabelAr}
                </span>
                {currentSubState.isLifetime && (
                  <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-300 text-[11px] font-bold flex items-center gap-1">
                    <InfinityIcon className="w-3.5 h-3.5" />
                    مدى الحياة
                  </span>
                )}
              </div>
            </div>

            <div className="sm:text-left text-xs">
              <span className="text-slate-500 font-bold block">تاريخ الانتهاء الحالي:</span>
              <span className="font-bold text-slate-800 block text-xs mt-0.5">
                {currentSubState.formattedExpiresAt}
              </span>
              <span className="text-[11px] text-slate-500 block">
                ({currentSubState.remainingTimeText})
              </span>
            </div>
          </div>

          {activeTab === 'history' ? (
            /* AUDIT HISTORY TAB */
            <div className="space-y-3">
              <h3 className="text-sm font-black text-slate-900 font-['Tajawal',sans-serif]">
                سجل كافة التعديلات والتفعيلات السابقة لهذه العيادة:
              </h3>

              {clinicLogs.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-slate-500 text-xs">
                  لا توجد عمليات سابقة مسجلة لهذه العيادة حتى الآن.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {clinicLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-3.5 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200 transition text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-900">
                          {SUBSCRIPTION_ACTION_LABELS_AR[log.action] || log.action}
                        </span>
                        <span className="text-[11px] text-slate-500 font-mono">
                          {formatDateTimeAr(log.activatedAt || log.timestamp)}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-slate-600 text-[11px]">
                        {log.amount !== undefined && (
                          <span>المبلغ: <strong className="text-slate-900">{log.amount} ج.م</strong></span>
                        )}
                        {log.expiresAt ? (
                          <span>الانتهاء: <strong className="text-slate-900">{formatDateTimeAr(log.expiresAt)}</strong></span>
                        ) : log.newIsLifetime ? (
                          <span className="text-emerald-700 font-bold">مدى الحياة</span>
                        ) : null}
                        <span>بواسطة: <strong className="text-slate-800">{log.adminEmail || log.adminId}</strong></span>
                      </div>

                      {log.notes && (
                        <p className="text-slate-500 bg-white p-2 rounded-lg border border-slate-200 text-[11px]">
                          {log.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* EDIT SUBSCRIPTION TAB */
            <div className="space-y-6">

              {/* Quick Preset Buttons */}
              <div>
                <label className="text-xs font-black text-slate-900 block mb-2 font-['Tajawal',sans-serif]">
                  خيارات سريعة للمدد الشائعة:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {DURATION_PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleApplyPreset(preset)}
                      className={`p-2.5 rounded-xl border text-right transition flex items-center justify-between text-xs font-bold ${
                        durationUnit === preset.unit && durationValue === preset.value
                          ? 'border-sky-500 bg-sky-50 text-sky-900 ring-1 ring-sky-400'
                          : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <span>{preset.label}</span>
                      {preset.badge && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 font-normal">
                          {preset.badge}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Mode Selector */}
              <div>
                <label className="text-xs font-black text-slate-900 block mb-2 font-['Tajawal',sans-serif]">
                  نوع الإجراء المطلوب:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setActionType('SUBSCRIPTION_EXTENDED');
                      if (durationUnit === 'lifetime') setDurationUnit('months');
                    }}
                    className={`p-2.5 rounded-xl border text-xs font-bold text-center transition flex flex-col items-center gap-1 ${
                      actionType === 'SUBSCRIPTION_EXTENDED'
                        ? 'border-sky-500 bg-sky-50 text-sky-900 ring-1 ring-sky-400'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <PlusCircle className="w-4 h-4 text-sky-600" />
                    <span>تفعيل / تمديد</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActionType('SUBSCRIPTION_SET_LIFETIME');
                      setDurationUnit('lifetime');
                    }}
                    className={`p-2.5 rounded-xl border text-xs font-bold text-center transition flex flex-col items-center gap-1 ${
                      actionType === 'SUBSCRIPTION_SET_LIFETIME' || durationUnit === 'lifetime'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-400'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <InfinityIcon className="w-4 h-4 text-emerald-600" />
                    <span>مدى الحياة</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (currentSubState.status === 'suspended') {
                        setActionType('SUBSCRIPTION_REACTIVATED');
                      } else {
                        setActionType('SUBSCRIPTION_SUSPENDED');
                      }
                    }}
                    className={`p-2.5 rounded-xl border text-xs font-bold text-center transition flex flex-col items-center gap-1 ${
                      actionType === 'SUBSCRIPTION_SUSPENDED' || actionType === 'SUBSCRIPTION_REACTIVATED'
                        ? 'border-amber-500 bg-amber-50 text-amber-900 ring-1 ring-amber-400'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {currentSubState.status === 'suspended' ? (
                      <>
                        <PlayCircle className="w-4 h-4 text-emerald-600" />
                        <span>استئناف الاشتراك</span>
                      </>
                    ) : (
                      <>
                        <PauseCircle className="w-4 h-4 text-amber-600" />
                        <span>تعليق مؤقت</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setActionType('SUBSCRIPTION_CANCELLED')}
                    className={`p-2.5 rounded-xl border text-xs font-bold text-center transition flex flex-col items-center gap-1 ${
                      actionType === 'SUBSCRIPTION_CANCELLED'
                        ? 'border-rose-500 bg-rose-50 text-rose-900 ring-1 ring-rose-400'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <XCircle className="w-4 h-4 text-rose-600" />
                    <span>إلغاء الاشتراك</span>
                  </button>
                </div>
              </div>

              {/* Duration Inputs (Hidden if Lifetime, Suspended or Cancelled) */}
              {actionType !== 'SUBSCRIPTION_CANCELLED' &&
               actionType !== 'SUBSCRIPTION_SUSPENDED' &&
               actionType !== 'SUBSCRIPTION_SET_LIFETIME' &&
               durationUnit !== 'lifetime' && (
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    
                    {/* Duration Value */}
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        العدد / القيمة:
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="1000"
                        value={durationValue}
                        onChange={(e) => setDurationValue(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                        disabled={durationUnit === 'custom'}
                      />
                    </div>

                    {/* Unit Select */}
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        الوحدة الزمنية:
                      </label>
                      <select
                        value={durationUnit}
                        onChange={(e) => setDurationUnit(e.target.value as SubscriptionDurationUnit)}
                        className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                      >
                        {DURATION_UNIT_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.labelAr}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Calculation Mode */}
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        طريقة الحساب:
                      </label>
                      <select
                        value={renewalMode}
                        onChange={(e) => setRenewalMode(e.target.value as SubscriptionRenewalMode)}
                        className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                      >
                        <option value="extend">إضافة للمدة المتبقية الحالية</option>
                        <option value="now">بدء الحساب من هذه اللحظة</option>
                      </select>
                    </div>
                  </div>

                  {/* Custom DateTime picker */}
                  {durationUnit === 'custom' && (
                    <div className="pt-2 border-t border-slate-200">
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        تحديد تاريخ ووقت الانتهاء بدقة:
                      </label>
                      <input
                        type="datetime-local"
                        value={customDateTime}
                        onChange={(e) => setCustomDateTime(e.target.value)}
                        className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* LIVE PREVIEW BOX */}
              <div className="bg-sky-50/80 rounded-2xl p-4 border border-sky-200 space-y-2">
                <div className="flex items-center gap-2 text-sky-900 font-bold text-xs">
                  <Sparkles className="w-4 h-4 text-sky-600" />
                  <span>معاينة النتيجة المباشرة بعد تطبيق هذا التعديل:</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs">
                  <div>
                    <span className="text-slate-600 block text-[11px]">تاريخ الانتهاء الجديد:</span>
                    <strong className="text-slate-900 block text-xs mt-0.5">
                      {previewState.formattedExpiresAt}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-600 block text-[11px]">الحالة والمدة المتبقية:</span>
                    <strong className="text-sky-950 block text-xs mt-0.5">
                      {previewState.remainingText}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Amount and Admin Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    المبلغ المحصل (ج.م):
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    value={amount}
                    onChange={(e) => setAmount(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                    placeholder="0"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    ملاحظات الإدارة / كود الإيداع / السبب:
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                    placeholder="مثال: تجديد سنوي - تحويل فودافون كاش أو إعفاء إداري"
                  />
                </div>
              </div>

              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-800 text-xs font-bold">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Confirmation Step or Action Buttons */}
              {confirmStep ? (
                <div className="bg-amber-50 rounded-2xl p-4 border border-amber-300 space-y-3">
                  <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>تأكيد تطبيق التعديل الإداري على اشتراك العيادة:</span>
                  </div>

                  <p className="text-xs text-amber-950 leading-relaxed font-medium">
                    أنت على وشك تنفيذ <strong>{SUBSCRIPTION_ACTION_LABELS_AR[actionType]}</strong> لعيادة{' '}
                    <strong>{clinic.clinicName}</strong> بحيث ينتهي في: <strong>{previewState.formattedExpiresAt}</strong>.
                    سيتم تدوين هذه العملية فوراً في سجل التدقيق الموثق للمنصة.
                  </p>

                  <div className="flex items-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={isSubmitting}
                      className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black rounded-xl transition flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <span>جارٍ الحفظ الآمن...</span>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span>نعم، تأكيد وتطبيق الآن</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setConfirmStep(false)}
                      disabled={isSubmitting}
                      className="px-4 py-2.5 bg-white text-slate-700 hover:bg-slate-100 text-xs font-bold rounded-xl border border-slate-200 transition"
                    >
                      تراجع وتعديل
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
                  >
                    إلغاء
                  </button>

                  <button
                    type="button"
                    onClick={() => setConfirmStep(true)}
                    className="px-5 py-2.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-black rounded-xl transition flex items-center gap-2 shadow-sm cursor-pointer"
                  >
                    <span>متابعة وتأكيد الإجراء</span>
                    <ArrowRight className="w-4 h-4 rotate-180" />
                  </button>
                </div>
              )}

            </div>
          )}

        </div>

      </div>
    </div>
  );
};
