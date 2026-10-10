import {
  SubscriptionStatus,
  SubscriptionDurationUnit,
  SubscriptionAuditAction,
  DoctorProfile
} from '../types';

/**
 * Robust calendar-aware addition of months.
 * Clamps target day to the last valid day of the target month
 * (e.g. Jan 31 + 1 month => Feb 28 or 29 in leap year).
 * Preserves the exact hours, minutes, seconds and milliseconds of the base date.
 */
export function addMonthsCalendar(baseDate: Date, months: number): Date {
  const result = new Date(baseDate.getTime());
  const originalDay = result.getDate();

  // Set day to 1 to avoid accidental overflow when changing month
  result.setDate(1);
  result.setMonth(result.getMonth() + months);

  // Find max days in the resulting month (day 0 of next month is last day of current)
  const daysInTargetMonth = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(originalDay, daysInTargetMonth));
  return result;
}

/**
 * Robust calendar-aware addition of years.
 * Safely handles leap year Feb 29 (e.g. Feb 29, 2024 + 1 year => Feb 28, 2025).
 * Preserves exact hours, minutes, seconds and milliseconds.
 */
export function addYearsCalendar(baseDate: Date, years: number): Date {
  const result = new Date(baseDate.getTime());
  const originalDay = result.getDate();
  const originalMonth = result.getMonth();

  result.setFullYear(result.getFullYear() + years);

  const daysInTargetMonth = new Date(result.getFullYear(), originalMonth + 1, 0).getDate();
  result.setDate(Math.min(originalDay, daysInTargetMonth));
  return result;
}

/**
 * Calculates exact target expiration date based on base date, duration unit, and value.
 * Returns null if the unit is 'lifetime'.
 */
export function calculateExpirationDate(
  baseDate: Date,
  unit: SubscriptionDurationUnit,
  value: number,
  customDate?: string | Date | null
): Date | null {
  if (unit === 'lifetime') {
    return null;
  }

  if (unit === 'custom') {
    if (!customDate) return null;
    const d = typeof customDate === 'string' ? new Date(customDate) : customDate;
    return isNaN(d.getTime()) ? null : d;
  }

  const safeVal = Math.max(0, Number(value) || 0);

  switch (unit) {
    case 'minutes':
      return new Date(baseDate.getTime() + safeVal * 60 * 1000);

    case 'hours':
      return new Date(baseDate.getTime() + safeVal * 60 * 60 * 1000);

    case 'days':
      return new Date(baseDate.getTime() + safeVal * 24 * 60 * 60 * 1000);

    case 'weeks':
      return new Date(baseDate.getTime() + safeVal * 7 * 24 * 60 * 60 * 1000);

    case 'months':
      return addMonthsCalendar(baseDate, safeVal);

    case 'years':
      return addYearsCalendar(baseDate, safeVal);

    default:
      return new Date(baseDate.getTime() + safeVal * 24 * 60 * 60 * 1000);
  }
}

/**
 * Formats a Date or ISO string in Arabic with Egyptian / Cairo timezone (Africa/Cairo).
 * e.g.: "الخميس، 15 أكتوبر 2026 — 06:30 م"
 */
export function formatDateTimeAr(date: Date | string | null | undefined): string {
  if (!date) return 'غير محدد';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return 'تاريخ غير صالح';

  try {
    const dateFormatter = new Intl.DateTimeFormat('ar-EG', {
      timeZone: 'Africa/Cairo',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const timeFormatter = new Intl.DateTimeFormat('ar-EG', {
      timeZone: 'Africa/Cairo',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    return `${dateFormatter.format(d)} — ${timeFormatter.format(d)}`;
  } catch {
    return d.toLocaleString('ar-EG');
  }
}

/**
 * Formats date only in Arabic (Africa/Cairo timezone).
 * e.g. "15 أكتوبر 2026"
 */
export function formatDateOnlyAr(date: Date | string | null | undefined): string {
  if (!date) return 'غير محدد';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return 'تاريخ غير صالح';

  try {
    return new Intl.DateTimeFormat('ar-EG', {
      timeZone: 'Africa/Cairo',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(d);
  } catch {
    return d.toLocaleDateString('ar-EG');
  }
}

/**
 * Returns a human-friendly Arabic string representing the remaining duration
 * until the subscription expires, or status message.
 */
export function formatRemainingTimeAr(
  expiresAt: string | Date | null | undefined,
  isLifetime?: boolean,
  status?: SubscriptionStatus
): string {
  if (isLifetime || status === 'lifetime') {
    return 'اشتراك دائم — مدى الحياة (بدون انتهاء)';
  }

  if (status === 'suspended') {
    return 'الاشتراك معلق مؤقتاً';
  }

  if (status === 'cancelled') {
    return 'الاشتراك ملغى';
  }

  if (!expiresAt) {
    return 'غير محدد';
  }

  const expDate = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt;
  if (isNaN(expDate.getTime())) return 'تاريخ غير صالح';

  const diffMs = expDate.getTime() - Date.now();

  if (diffMs <= 0) {
    const overdueMinutes = Math.floor(Math.abs(diffMs) / (60 * 1000));
    if (overdueMinutes < 60) {
      return `منتهي منذ ${overdueMinutes} دقيقة`;
    }
    const overdueHours = Math.floor(overdueMinutes / 60);
    if (overdueHours < 24) {
      return `منتهي منذ ${overdueHours} ساعة`;
    }
    const overdueDays = Math.floor(overdueHours / 24);
    return `منتهي منذ ${overdueDays} يوم`;
  }

  const totalMinutes = Math.floor(diffMs / (60 * 1000));
  const totalHours = Math.floor(totalMinutes / 60);
  const totalDays = Math.floor(totalHours / 24);

  if (totalDays > 30) {
    const months = Math.floor(totalDays / 30);
    const remainingDays = totalDays % 30;
    if (remainingDays === 0) {
      return `${months} شهر متبقية`;
    }
    return `${months} شهر و ${remainingDays} يوم متبقية`;
  }

  if (totalDays >= 1) {
    const remHours = totalHours % 24;
    if (remHours === 0) {
      return `${totalDays} يوم متبقية`;
    }
    return `${totalDays} يوم و ${remHours} ساعة متبقية`;
  }

  if (totalHours >= 1) {
    const remMinutes = totalMinutes % 60;
    if (remMinutes === 0) {
      return `${totalHours} ساعة متبقية`;
    }
    return `${totalHours} ساعة و ${remMinutes} دقيقة متبقية`;
  }

  return `${Math.max(1, totalMinutes)} دقيقة متبقية`;
}

export interface EffectiveSubscriptionState {
  status: SubscriptionStatus;
  isLifetime: boolean;
  isExpired: boolean;
  isSuspended: boolean;
  isCancelled: boolean;
  isActive: boolean;
  isTrial: boolean;
  canAccessClinic: boolean;
  remainingDays: number | null;
  remainingTimeText: string;
  formattedExpiresAt: string;
  statusLabelAr: string;
  badgeClass: string;
}

/**
 * Pure function to compute the comprehensive effective subscription state for a doctor/clinic.
 */
export function getEffectiveSubscriptionState(doctor: Partial<DoctorProfile> | null | undefined): EffectiveSubscriptionState {
  if (!doctor) {
    return {
      status: 'expired',
      isLifetime: false,
      isExpired: true,
      isSuspended: false,
      isCancelled: false,
      isActive: false,
      isTrial: false,
      canAccessClinic: false,
      remainingDays: null,
      remainingTimeText: 'غير مسجل',
      formattedExpiresAt: 'غير محدد',
      statusLabelAr: 'غير مسجل',
      badgeClass: 'bg-slate-100 text-slate-700 border-slate-200'
    };
  }

  const expStr = doctor.subscriptionExpiresAt || doctor.subscriptionEndDate || doctor.trialEndDate;
  const expDate = expStr ? new Date(expStr) : null;
  const remainingDays = (expDate && !isNaN(expDate.getTime()))
    ? Math.ceil((expDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  // 1. Check suspended & cancelled
  if (doctor.subscriptionStatus === 'suspended') {
    return {
      status: 'suspended',
      isLifetime: Boolean(doctor.isLifetime),
      isExpired: true,
      isSuspended: true,
      isCancelled: false,
      isActive: false,
      isTrial: false,
      canAccessClinic: false,
      remainingDays,
      remainingTimeText: 'معلق مؤقتاً بواسطة الإدارة',
      formattedExpiresAt: doctor.subscriptionExpiresAt ? formatDateTimeAr(doctor.subscriptionExpiresAt) : 'غير محدد',
      statusLabelAr: 'معلق مؤقتاً (Suspended)',
      badgeClass: 'bg-amber-100 text-amber-900 border-amber-300'
    };
  }

  if (doctor.subscriptionStatus === 'cancelled') {
    return {
      status: 'cancelled',
      isLifetime: false,
      isExpired: true,
      isSuspended: false,
      isCancelled: true,
      isActive: false,
      isTrial: false,
      canAccessClinic: false,
      remainingDays: null,
      remainingTimeText: 'تم إلغاء الاشتراك',
      formattedExpiresAt: doctor.subscriptionExpiresAt ? formatDateTimeAr(doctor.subscriptionExpiresAt) : 'ملغى',
      statusLabelAr: 'ملغى (Cancelled)',
      badgeClass: 'bg-rose-100 text-rose-900 border-rose-300'
    };
  }

  // 2. Check lifetime
  if (doctor.isLifetime === true || doctor.subscriptionStatus === 'lifetime') {
    return {
      status: 'lifetime',
      isLifetime: true,
      isExpired: false,
      isSuspended: false,
      isCancelled: false,
      isActive: true,
      isTrial: false,
      canAccessClinic: true,
      remainingDays: null,
      remainingTimeText: 'اشتراك دائم — مدى الحياة',
      formattedExpiresAt: 'مدى الحياة (بدون تاريخ انتهاء)',
      statusLabelAr: 'مدى الحياة (Lifetime)',
      badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300 ring-1 ring-emerald-500/20'
    };
  }

  // 3. Check active subscription
  if (doctor.subscriptionStatus === 'active') {
    if (expDate && !isNaN(expDate.getTime())) {
      const isPast = Date.now() > expDate.getTime();
      if (isPast) {
        return {
          status: 'expired',
          isLifetime: false,
          isExpired: true,
          isSuspended: false,
          isCancelled: false,
          isActive: false,
          isTrial: false,
          canAccessClinic: false,
          remainingDays,
          remainingTimeText: formatRemainingTimeAr(expDate, false, 'expired'),
          formattedExpiresAt: formatDateTimeAr(expDate),
          statusLabelAr: 'منتهي (Expired)',
          badgeClass: 'bg-rose-100 text-rose-900 border-rose-300'
        };
      }

      return {
        status: 'active',
        isLifetime: false,
        isExpired: false,
        isSuspended: false,
        isCancelled: false,
        isActive: true,
        isTrial: false,
        canAccessClinic: true,
        remainingDays,
        remainingTimeText: formatRemainingTimeAr(expDate, false, 'active'),
        formattedExpiresAt: formatDateTimeAr(expDate),
        statusLabelAr: 'نشط مدفوع (Active)',
        badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300'
      };
    }

    // Active with no explicit expiration date preserved as active
    return {
      status: 'active',
      isLifetime: false,
      isExpired: false,
      isSuspended: false,
      isCancelled: false,
      isActive: true,
      isTrial: false,
      canAccessClinic: true,
      remainingDays: null,
      remainingTimeText: 'مفعل',
      formattedExpiresAt: 'غير محدد',
      statusLabelAr: 'نشط مدفوع (Active)',
      badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300'
    };
  }

  // 4. Check trial subscription
  if (doctor.subscriptionStatus === 'trial') {
    if (doctor.trialEndDate) {
      const trialDate = new Date(doctor.trialEndDate);
      const isPast = !isNaN(trialDate.getTime()) && Date.now() > trialDate.getTime();
      if (isPast) {
        return {
          status: 'expired',
          isLifetime: false,
          isExpired: true,
          isSuspended: false,
          isCancelled: false,
          isActive: false,
          isTrial: false,
          canAccessClinic: false,
          remainingDays: Math.ceil((trialDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
          remainingTimeText: formatRemainingTimeAr(trialDate, false, 'expired'),
          formattedExpiresAt: formatDateTimeAr(trialDate),
          statusLabelAr: 'انتهت الفترة التجريبية',
          badgeClass: 'bg-rose-100 text-rose-900 border-rose-300'
        };
      }

      return {
        status: 'trial',
        isLifetime: false,
        isExpired: false,
        isSuspended: false,
        isCancelled: false,
        isActive: true,
        isTrial: true,
        canAccessClinic: true,
        remainingDays: Math.ceil((trialDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
        remainingTimeText: formatRemainingTimeAr(trialDate, false, 'trial'),
        formattedExpiresAt: formatDateTimeAr(trialDate),
        statusLabelAr: 'تجريبي (Trial)',
        badgeClass: 'bg-amber-100 text-amber-900 border-amber-300'
      };
    }

    return {
      status: 'trial',
      isLifetime: false,
      isExpired: false,
      isSuspended: false,
      isCancelled: false,
      isActive: true,
      isTrial: true,
      canAccessClinic: true,
      remainingDays: null,
      remainingTimeText: 'فترة تجريبية',
      formattedExpiresAt: 'غير محدد',
      statusLabelAr: 'تجريبي (Trial)',
      badgeClass: 'bg-amber-100 text-amber-900 border-amber-300'
    };
  }

  // 5. Explicitly expired
  return {
    status: 'expired',
    isLifetime: false,
    isExpired: true,
    isSuspended: false,
    isCancelled: false,
    isActive: false,
    isTrial: false,
    canAccessClinic: false,
    remainingDays,
    remainingTimeText: expDate ? formatRemainingTimeAr(expDate, false, 'expired') : 'منتهي',
    formattedExpiresAt: expDate ? formatDateTimeAr(expDate) : 'غير محدد',
    statusLabelAr: 'منتهي (Expired)',
    badgeClass: 'bg-rose-100 text-rose-900 border-rose-300'
  };
}

export const DURATION_UNIT_OPTIONS: { value: SubscriptionDurationUnit; labelAr: string; singularAr: string }[] = [
  { value: 'minutes', labelAr: 'دقائق', singularAr: 'دقيقة' },
  { value: 'hours', labelAr: 'ساعات', singularAr: 'ساعة' },
  { value: 'days', labelAr: 'أيام', singularAr: 'يوم' },
  { value: 'weeks', labelAr: 'أسابيع', singularAr: 'أسبوع' },
  { value: 'months', labelAr: 'أشهر', singularAr: 'شهر' },
  { value: 'years', labelAr: 'سنوات', singularAr: 'سنة' },
  { value: 'custom', labelAr: 'تاريخ وساعة مخصصة', singularAr: 'مخصص' },
  { value: 'lifetime', labelAr: 'مدى الحياة (Lifetime)', singularAr: 'دائم' }
];

export const DURATION_PRESETS: { label: string; unit: SubscriptionDurationUnit; value: number; badge?: string }[] = [
  { label: '30 دقيقة (فحص سريع)', unit: 'minutes', value: 30 },
  { label: 'ساعتان', unit: 'hours', value: 2 },
  { label: 'يوم واحد (24 ساعة)', unit: 'days', value: 1 },
  { label: 'أسبوع (7 أيام)', unit: 'days', value: 7 },
  { label: 'شهر واحد (30 يوماً)', unit: 'months', value: 1, badge: 'شائع' },
  { label: '3 أشهر (ربع سنوي)', unit: 'months', value: 3 },
  { label: '6 أشهر (نصف سنوي)', unit: 'months', value: 6 },
  { label: 'سنة كاملة (12 شهراً)', unit: 'years', value: 1, badge: 'موصى به' },
  { label: 'مدى الحياة (Lifetime)', unit: 'lifetime', value: 0, badge: 'دائم' }
];

export const SUBSCRIPTION_STATUS_LABELS_AR: Record<SubscriptionStatus, string> = {
  active: 'نشط مدفوع (Active)',
  lifetime: 'مدى الحياة (Lifetime)',
  trial: 'فترة تجريبية (Trial)',
  expired: 'منتهي (Expired)',
  suspended: 'معلق مؤقتاً (Suspended)',
  cancelled: 'ملغى (Cancelled)'
};

export const SUBSCRIPTION_ACTION_LABELS_AR: Record<SubscriptionAuditAction, string> = {
  SUBSCRIPTION_CREATED: 'إنشاء اشتراك جديد',
  SUBSCRIPTION_EXTENDED: 'تمديد اشتراك نشط',
  SUBSCRIPTION_RENEWED: 'تجديد اشتراك منتهي',
  SUBSCRIPTION_SHORTENED: 'تقصير مدة الاشتراك',
  SUBSCRIPTION_CANCELLED: 'إلغاء الاشتراك',
  SUBSCRIPTION_SUSPENDED: 'تعليق الاشتراك مؤقتاً',
  SUBSCRIPTION_REACTIVATED: 'استئناف وتنشيط الاشتراك',
  SUBSCRIPTION_SET_LIFETIME: 'تحويل إلى اشتراك مدى الحياة',
  SUBSCRIPTION_MODIFIED: 'تعديل تفاصيل الاشتراك',
  activate: 'تفعيل اشتراك',
  extend: 'تمديد اشتراك',
  cancel: 'إلغاء اشتراك'
};
