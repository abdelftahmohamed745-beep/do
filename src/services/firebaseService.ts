import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  query,
  where,
  getDocs,
  onSnapshot,
  orderBy,
  limit,
  runTransaction,
  increment,
  writeBatch
} from "firebase/firestore";
import { db } from "../firebase/config.ts";
import {
  DoctorProfile,
  PatientRecord,
  PatientStatus,
  SubscriptionStatus,
  SubscriptionPlan,
  SubscriptionLog,
  SubscriptionDurationUnit,
  SubscriptionRenewalMode,
  SubscriptionAuditAction,
  NotificationTimingPreference,
  DoctorRating,
  FollowUpAppointment,
  FollowUpAppointmentStatus,
  FollowUpReminderSettings,
  PatientMedicalFile,
  PatientVisitEntry,
  DailySession,
  VisitType,
  PaymentSplitItem,
  ClinicMember,
  ClinicRole,
  ClinicPermission,
  ClinicInvitation,
  ClinicAuditLog,
  ClinicService,
  ClinicTransaction,
  ClinicExpense,
  PaymentStatus,
  PaymentMethod,
  ExpenseCategory,
  LabProfile,
  LabAdminView,
  AdminAnnouncement,
  AnnouncementType,
  AnnouncementTarget,
  PatientProfile,
  PrescriptionRecord,
  PrescriptionTemplate,
  PatientVitals,
  PrescriptionMedicineItem,
  GrowthRecord
} from "../types.ts";
import { hasPermission } from "../utils/permissions.ts";
import { calculateExpirationDate } from "../utils/subscriptionUtils.ts";
import {
  sanitizeInput,
  isValidPhoneNumber,
  validatePatientPhoneNumber,
  sanitizePatientPhoneNumber,
  isValidUrl,
  checkBookingRateLimit,
  recordBookingSuccess,
  writeAuditLog
} from "./securityService.ts";

export const DEMO_DOCTOR_ID = "demo-doctor-123";

// Official Subscription Prices (Server-Side Enforced)
export const OFFICIAL_SUBSCRIPTION_PRICES = {
  monthly: 200, // 200 EGP per month
  yearly: 1500  // 1500 EGP per year
} as const;

export function generateReferenceCode(uid: string): string {
  if (!uid) return 'REF-000000';
  const clean = uid.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const code = clean.length >= 6 ? clean.slice(-6) : clean.padEnd(6, '0');
  return `REF-${code}`;
}

// Generate short, human-friendly 6-character booking recovery reference (e.g., D-4821 or D-7923)
export function generateBookingReference(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // Exclude ambiguous 0/O, 1/I
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `D-${code}`;
}

// Strip all undefined fields recursively to protect Firestore setDoc/updateDoc
export function removeUndefinedFields<T extends Record<string, any>>(obj: T): T {
  const clean: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val === undefined) continue;
    if (val !== null && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date)) {
      clean[key] = removeUndefinedFields(val);
    } else if (Array.isArray(val)) {
      clean[key] = val.map((item) =>
        item !== null && typeof item === 'object' && !(item instanceof Date)
          ? removeUndefinedFields(item)
          : item
      );
    } else {
      clean[key] = val;
    }
  }
  return clean as T;
}

// Generate unified, permanent Patient Identity ID (e.g., PID-849201)
export function generatePatientId(phone?: string): string {
  const cleanPhone = phone ? normalizePhoneNumber(phone) : '';
  if (cleanPhone && cleanPhone.length >= 4) {
    const lastDigits = cleanPhone.slice(-4);
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return `PID-${lastDigits}${randomSuffix}`;
  }
  const randomNum = Math.floor(100000 + Math.random() * 900000);
  return `PID-${randomNum}`;
}

// Unified Patient Identity Profile Management
export async function getOrCreatePatientProfile(
  name: string,
  phone: string,
  additionalData?: Partial<PatientProfile>
): Promise<PatientProfile> {
  const cleanName = sanitizeInput(name);
  const phoneValidation = validatePatientPhoneNumber(phone);
  if (!phoneValidation.isValid) {
    throw new Error(phoneValidation.error || "رقم الهاتف يجب أن يكون من 10 إلى 11 رقمًا.");
  }
  const cleanPhone = phoneValidation.cleanPhone;
  const nowIso = new Date().toISOString();

  try {
    // 1. Check if patient profile already exists by phone in 'patients' collection
    const q = query(collection(db, "patients"), where("phone", "==", cleanPhone), limit(1));
    const snap = await getDocs(q);

    if (!snap.empty) {
      const existingDoc = snap.docs[0];
      const existingData = existingDoc.data() as PatientProfile;
      const docId = existingDoc.id;

      // Update name/details if newly provided
      const updates: Partial<PatientProfile> = {
        updatedAt: nowIso
      };
      if (cleanName && cleanName !== existingData.name) {
        updates.name = cleanName;
      }
      if (additionalData) {
        if (additionalData.gender) updates.gender = additionalData.gender;
        if (additionalData.bloodGroup) updates.bloodGroup = additionalData.bloodGroup;
        if (additionalData.allergies) updates.allergies = additionalData.allergies;
        if (additionalData.chronicDiseases) updates.chronicDiseases = additionalData.chronicDiseases;
        if (additionalData.birthDate) updates.birthDate = additionalData.birthDate;
        if (additionalData.age) updates.age = additionalData.age;
        if (additionalData.nationalId) updates.nationalId = additionalData.nationalId;
        if (additionalData.emergencyContact) updates.emergencyContact = additionalData.emergencyContact;
        if (additionalData.uid) updates.uid = additionalData.uid;
      }

      const safeUpdates = removeUndefinedFields(updates);
      if (Object.keys(safeUpdates).length > 0) {
        await updateDoc(doc(db, "patients", docId), safeUpdates);
      }
      return {
        ...existingData,
        ...safeUpdates,
        id: docId,
        patientId: existingData.patientId || docId
      };
    }

    // 2. Create brand new unified patient profile
    const pid = generatePatientId(cleanPhone);
    const newProfile: Partial<PatientProfile> = {
      id: pid,
      patientId: pid,
      name: cleanName || "مريض",
      phone: cleanPhone,
      accountType: 'patient',
      bloodGroup: additionalData?.bloodGroup || '',
      allergies: additionalData?.allergies || '',
      chronicDiseases: additionalData?.chronicDiseases || '',
      nationalId: additionalData?.nationalId || '',
      emergencyContact: additionalData?.emergencyContact || '',
      uid: additionalData?.uid || '',
      createdAt: nowIso,
      updatedAt: nowIso
    };

    if (additionalData?.gender) newProfile.gender = additionalData.gender;
    if (additionalData?.birthDate) newProfile.birthDate = additionalData.birthDate;
    if (additionalData?.age !== undefined) newProfile.age = additionalData.age;

    const safeProfile = removeUndefinedFields(newProfile as PatientProfile);
    await setDoc(doc(db, "patients", pid), safeProfile);
    return safeProfile;
  } catch (err) {
    console.error("Error creating or getting patient profile:", err);
    // Fallback in-memory patient profile to prevent blocking booking flow
    const fallbackPid = generatePatientId(cleanPhone);
    return {
      id: fallbackPid,
      patientId: fallbackPid,
      name: cleanName || "مريض",
      phone: cleanPhone,
      accountType: 'patient',
      createdAt: nowIso,
      updatedAt: nowIso
    };
  }
}

// Get Patient Profile by Phone or PatientID
export async function getPatientProfile(patientIdOrPhone: string): Promise<PatientProfile | null> {
  const cleanTerm = patientIdOrPhone.trim();
  if (!cleanTerm) return null;

  try {
    // Check direct doc ID
    const docRef = doc(db, "patients", cleanTerm);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() } as PatientProfile;
    }

    // Check by normalized phone
    const cleanPhone = normalizePhoneNumber(cleanTerm);
    if (cleanPhone) {
      const qPhone = query(collection(db, "patients"), where("phone", "==", cleanPhone), limit(1));
      const snapPhone = await getDocs(qPhone);
      if (!snapPhone.empty) {
        const d = snapPhone.docs[0];
        return { id: d.id, ...d.data() } as PatientProfile;
      }
    }

    // Check by patientId field
    const qPid = query(collection(db, "patients"), where("patientId", "==", cleanTerm), limit(1));
    const snapPid = await getDocs(qPid);
    if (!snapPid.empty) {
      const d = snapPid.docs[0];
      return { id: d.id, ...d.data() } as PatientProfile;
    }

    return null;
  } catch (err) {
    console.error("Error fetching patient profile:", err);
    return null;
  }
}

// Quick Booking Ticket Recovery & Search by Reference Code or Phone
export async function findTicketByReferenceOrPhone(
  doctorId: string,
  queryTerm: string
): Promise<PatientRecord | null> {
  const cleanTerm = queryTerm.trim().toUpperCase();
  if (!cleanTerm || !doctorId) return null;

  const today = getTodayDateString();
  const queueColRef = collection(db, "queues", doctorId, "patients");

  try {
    // 1. Match by Booking Reference (e.g. D-4821)
    const qRef = query(
      queueColRef,
      where("date", "==", today),
      where("bookingReference", "==", cleanTerm),
      limit(1)
    );
    const snapRef = await getDocs(qRef);
    if (!snapRef.empty) {
      const d = snapRef.docs[0];
      return { id: d.id, ...d.data() } as PatientRecord;
    }

    // 2. Match by Normalized Phone Number
    const normalizedPhone = normalizePhoneNumber(queryTerm);
    if (normalizedPhone) {
      const qPhone = query(
        queueColRef,
        where("date", "==", today),
        where("phone", "==", normalizedPhone),
        limit(1)
      );
      const snapPhone = await getDocs(qPhone);
      if (!snapPhone.empty) {
        const d = snapPhone.docs[0];
        return { id: d.id, ...d.data() } as PatientRecord;
      }
    }

    // 3. Match by direct Patient Record ID or Patient ID
    const docRef = doc(db, "queues", doctorId, "patients", queryTerm.trim());
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as PatientRecord;
    }

    return null;
  } catch (err) {
    console.error("Error searching ticket by reference/phone:", err);
    return null;
  }
}

export function normalizePhoneNumber(phone: string): string {
  if (!phone) return "";
  return sanitizePatientPhoneNumber(phone, 0) || phone.trim();
}

export function getTodayDateString(): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Cairo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return formatter.format(new Date());
  } catch {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

// Check doctor subscription state dynamically
export function evaluateSubscriptionStatus(docData: DoctorProfile): SubscriptionStatus {
  if (!docData) return 'expired';

  if (docData.subscriptionStatus === 'suspended') {
    return 'suspended';
  }

  if (docData.subscriptionStatus === 'cancelled') {
    return 'cancelled';
  }

  if (docData.isLifetime === true || docData.subscriptionStatus === 'lifetime') {
    return 'lifetime';
  }

  if (docData.subscriptionStatus === 'active') {
    const expStr = docData.subscriptionExpiresAt || docData.subscriptionEndDate;
    if (expStr) {
      const end = new Date(expStr);
      if (!isNaN(end.getTime()) && new Date() > end) return 'expired';
    }
    return 'active';
  }
  
  if (docData.subscriptionStatus === 'trial') {
    if (docData.trialEndDate) {
      const trialEnd = new Date(docData.trialEndDate);
      if (!isNaN(trialEnd.getTime()) && new Date() > trialEnd) return 'expired';
    }
    return 'trial';
  }

  if (docData.subscriptionStatus === 'expired') {
    return 'expired';
  }

  // Graceful fallback for older profiles
  const fallbackEnd = docData.subscriptionExpiresAt || docData.subscriptionEndDate;
  if (fallbackEnd) {
    const end = new Date(fallbackEnd);
    if (!isNaN(end.getTime()) && new Date() <= end) return 'active';
  }

  if (docData.trialEndDate) {
    const trialEnd = new Date(docData.trialEndDate);
    if (!isNaN(trialEnd.getTime()) && new Date() <= trialEnd) return 'trial';
  }

  return 'expired';
}

// Helper to sanitize phone numbers for tel: and https://wa.me/ links
export function formatPhoneNumberForUrl(phone?: string): string {
  if (!phone) return "";
  // Strip +, spaces, dashes, parentheses
  return phone.replace(/[+\s\-()]/g, '');
}

// Fetch all active doctors for public directory listing
export async function getAllDoctors(): Promise<DoctorProfile[]> {
  try {
    const querySnap = await getDocs(collection(db, "doctors"));
    const doctors: DoctorProfile[] = [];
    querySnap.forEach((docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as DoctorProfile;
        data.referenceCode = data.referenceCode || generateReferenceCode(data.uid);
        data.subscriptionStatus = evaluateSubscriptionStatus(data);
        // Only include active and non-deleted clinics for public directory
        if (data.isActive !== false && !data.isDeleted) {
          doctors.push(data);
        }
      }
    });
    return doctors;
  } catch (error) {
    console.error("Error fetching doctors list:", error);
    return [];
  }
}

// Fetch all doctors for Platform Admin view (excludes soft deleted)
export async function getAllDoctorsAdmin(): Promise<DoctorProfile[]> {
  try {
    const querySnap = await getDocs(collection(db, "doctors"));
    const doctors: DoctorProfile[] = [];
    querySnap.forEach((docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as DoctorProfile;
        data.referenceCode = data.referenceCode || generateReferenceCode(data.uid);
        data.subscriptionStatus = evaluateSubscriptionStatus(data);
        if (!data.isDeleted) {
          doctors.push(data);
        }
      }
    });
    return doctors;
  } catch (error) {
    console.error("Error fetching admin doctors list:", error);
    return [];
  }
}

// Admin action: Toggle Doctor account active/deactivated status
export async function toggleDoctorStatus(doctorId: string, isActive: boolean): Promise<void> {
  const docRef = doc(db, "doctors", doctorId);
  await updateDoc(docRef, { isActive });
}

// Fetch all laboratories for Platform Admin view
export async function getAllLabsAdmin(): Promise<LabAdminView[]> {
  try {
    const querySnap = await getDocs(collection(db, "labs"));
    const labs: LabAdminView[] = [];

    const labPromises = querySnap.docs.map(async (docSnap) => {
      if (!docSnap.exists()) return null;
      const data = docSnap.data() as LabProfile;
      data.uid = docSnap.id;
      let staffCount = 0;
      let orderCount = 0;
      let email = data.email || "";

      try {
        const [staffSnap, orderSnap] = await Promise.all([
          getDocs(collection(db, "labs", docSnap.id, "staff")),
          getDocs(collection(db, "labs", docSnap.id, "orders"))
        ]);
        staffCount = staffSnap.size;
        orderCount = orderSnap.size;

        if (!email) {
          staffSnap.forEach((sDoc) => {
            const sData = sDoc.data();
            if (sData.email && (!email || sData.role === 'OWNER')) {
              email = sData.email;
            }
          });
        }

        if (!email) {
          const vSnap = await getDoc(doc(db, "email_verifications", docSnap.id));
          if (vSnap.exists() && vSnap.data()?.email) {
            email = vSnap.data().email;
          }
        }
      } catch (err) {
        console.warn(`Could not load subcollections for lab ${docSnap.id}:`, err);
      }

      const labView: LabAdminView = {
        ...data,
        email,
        staffCount,
        orderCount
      };
      return labView;
    });

    const results = await Promise.all(labPromises);
    results.forEach((res) => {
      if (res && !res.isDeleted) labs.push(res);
    });
    return labs;
  } catch (error) {
    console.error("Error fetching admin labs list:", error);
    return [];
  }
}

// Admin action: Toggle Laboratory account active/deactivated status
export async function toggleLabStatusAdmin(labId: string, isActive: boolean): Promise<void> {
  const docRef = doc(db, "labs", labId);
  await updateDoc(docRef, {
    isActive,
    updatedAt: new Date().toISOString()
  });
}

export interface AdminSubscriptionUpdateParams {
  clinicId: string;
  adminId: string;
  adminEmail?: string;
  action: SubscriptionAuditAction;
  durationType: SubscriptionDurationUnit;
  durationValue: number;
  customExpiresAt?: string | null;
  renewalMode?: SubscriptionRenewalMode;
  notes?: string;
  plan?: SubscriptionPlan | string;
  amount?: number;
}

// Authoritative transactional subscription update engine
export async function updateClinicSubscriptionByAdmin(
  params: AdminSubscriptionUpdateParams
): Promise<{
  success: boolean;
  newStatus: SubscriptionStatus;
  expiresAt: string | null;
  isLifetime: boolean;
  referenceCode: string;
}> {
  const {
    clinicId,
    adminId,
    adminEmail,
    action,
    durationType,
    durationValue,
    customExpiresAt,
    renewalMode = 'extend',
    notes,
    plan,
    amount
  } = params;

  if (!clinicId) {
    throw new Error("معرّف العيادة مطلوب لإتمام العملية");
  }

  const clinicRef = doc(db, "doctors", clinicId);

  const result = await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(clinicRef);
    if (!snap.exists()) {
      throw new Error("عذراً، العيادة غير موجودة في قاعدة البيانات");
    }

    const doctor = snap.data() as DoctorProfile;
    const previousStatus: SubscriptionStatus = evaluateSubscriptionStatus(doctor);
    const previousExpiresAt: string | null = doctor.subscriptionExpiresAt || doctor.subscriptionEndDate || null;
    const previousIsLifetime: boolean = Boolean(doctor.isLifetime || doctor.subscriptionStatus === 'lifetime');
    const refCode = doctor.referenceCode || generateReferenceCode(doctor.uid);
    const now = new Date();
    const nowIso = now.toISOString();

    let newStatus: SubscriptionStatus = 'active';
    let newIsLifetime = false;
    let newExpiresAt: string | null = null;

    if (action === 'SUBSCRIPTION_CANCELLED' || action === 'cancel') {
      newStatus = 'cancelled';
      newIsLifetime = false;
      newExpiresAt = null;
    } else if (action === 'SUBSCRIPTION_SUSPENDED') {
      newStatus = 'suspended';
      newIsLifetime = previousIsLifetime;
      // Preserve existing expiration date so clinic does not forfeit their purchased time
      newExpiresAt = previousExpiresAt;
    } else if (action === 'SUBSCRIPTION_SET_LIFETIME' || durationType === 'lifetime') {
      newStatus = 'lifetime';
      newIsLifetime = true;
      newExpiresAt = null;
    } else if (action === 'SUBSCRIPTION_REACTIVATED') {
      // If resuming a suspended subscription
      if (previousIsLifetime) {
        newStatus = 'lifetime';
        newIsLifetime = true;
        newExpiresAt = null;
      } else if (previousExpiresAt && new Date(previousExpiresAt).getTime() > now.getTime()) {
        // Still has active remaining time
        newStatus = 'active';
        newIsLifetime = false;
        newExpiresAt = previousExpiresAt;
      } else {
        // Was expired prior to resumption, calculate from now using provided duration
        const targetDate = calculateExpirationDate(now, durationType, durationValue, customExpiresAt);
        if (!targetDate || isNaN(targetDate.getTime())) {
          throw new Error("تاريخ انتهاء الاشتراك غير صالح");
        }
        newStatus = 'active';
        newIsLifetime = false;
        newExpiresAt = targetDate.toISOString();
      }
    } else {
      // Active, Renewal, Extension, Shortening or Modification
      newStatus = 'active';
      newIsLifetime = false;

      let baseDate = now;
      if (
        renewalMode === 'extend' &&
        previousExpiresAt &&
        !previousIsLifetime &&
        new Date(previousExpiresAt).getTime() > now.getTime()
      ) {
        baseDate = new Date(previousExpiresAt);
      }

      const targetDate = calculateExpirationDate(baseDate, durationType, durationValue, customExpiresAt);
      if (!targetDate || isNaN(targetDate.getTime())) {
        throw new Error("تاريخ انتهاء الاشتراك المحسوب غير صالح");
      }
      newExpiresAt = targetDate.toISOString();
    }

    const updatePayload: Record<string, any> = {
      subscriptionStatus: newStatus,
      isLifetime: newIsLifetime,
      subscriptionLastModified: nowIso,
      subscriptionModifiedBy: adminEmail || adminId || 'admin',
      subscriptionDurationType: durationType,
      subscriptionDurationValue: durationValue,
      referenceCode: refCode
    };

    if (newIsLifetime) {
      updatePayload.subscriptionExpiresAt = null;
      updatePayload.subscriptionEndDate = null;
    } else if (newExpiresAt) {
      updatePayload.subscriptionExpiresAt = newExpiresAt;
      updatePayload.subscriptionEndDate = newExpiresAt; // Maintain backward compatibility
    } else if (newStatus === 'cancelled') {
      updatePayload.subscriptionExpiresAt = null;
      updatePayload.subscriptionEndDate = null;
    }

    if (!doctor.subscriptionStartedAt && newStatus === 'active') {
      updatePayload.subscriptionStartedAt = nowIso;
    }

    if (notes !== undefined) {
      updatePayload.subscriptionNotes = notes.trim();
    }

    transaction.update(clinicRef, updatePayload);

    // Create persistent audit log entry
    const logRef = doc(collection(db, "subscription_logs"));
    const calculatedAmount = amount !== undefined
      ? amount
      : (durationType === 'years'
          ? OFFICIAL_SUBSCRIPTION_PRICES.yearly
          : (durationType === 'months' && durationValue === 1
              ? OFFICIAL_SUBSCRIPTION_PRICES.monthly
              : 0));

    const logData: SubscriptionLog = {
      id: logRef.id,
      clinicId: doctor.uid,
      clinicName: doctor.clinicName,
      doctorName: doctor.name,
      referenceCode: refCode,
      plan: plan || (durationType === 'years' ? 'yearly' : durationType === 'lifetime' ? 'lifetime' : 'monthly'),
      amount: calculatedAmount,
      activatedAt: nowIso,
      expiresAt: newExpiresAt,
      previousExpiresAt,
      previousStatus,
      newStatus,
      previousIsLifetime,
      newIsLifetime,
      durationType,
      durationValue,
      renewalMode,
      adminId,
      adminEmail: adminEmail || 'admin',
      action,
      notes: notes || '',
      timestamp: nowIso
    };

    transaction.set(logRef, logData);

    return {
      success: true,
      newStatus,
      expiresAt: newExpiresAt,
      isLifetime: newIsLifetime,
      referenceCode: refCode,
      clinicName: doctor.clinicName
    };
  });

  // Secondary central audit log
  try {
    await writeAuditLog(action, adminId, clinicId, {
      newStatus: result.newStatus,
      expiresAt: result.expiresAt,
      isLifetime: result.isLifetime,
      durationType,
      durationValue,
      notes: notes || ''
    });
  } catch (err) {
    console.warn("Secondary audit log write failed:", err);
  }

  return {
    success: true,
    newStatus: result.newStatus,
    expiresAt: result.expiresAt,
    isLifetime: result.isLifetime,
    referenceCode: result.referenceCode
  };
}

// Suspend Clinic Subscription
export async function suspendClinicSubscriptionByAdmin(params: {
  clinicId: string;
  adminId: string;
  adminEmail?: string;
  notes?: string;
}) {
  return updateClinicSubscriptionByAdmin({
    clinicId: params.clinicId,
    adminId: params.adminId,
    adminEmail: params.adminEmail,
    action: 'SUBSCRIPTION_SUSPENDED',
    durationType: 'custom',
    durationValue: 0,
    notes: params.notes || 'تم تعليق الاشتراك مؤقتاً بواسطة الإدارة'
  });
}

// Reactivate / Resume Clinic Subscription
export async function reactivateClinicSubscriptionByAdmin(params: {
  clinicId: string;
  adminId: string;
  adminEmail?: string;
  durationType?: SubscriptionDurationUnit;
  durationValue?: number;
  notes?: string;
}) {
  return updateClinicSubscriptionByAdmin({
    clinicId: params.clinicId,
    adminId: params.adminId,
    adminEmail: params.adminEmail,
    action: 'SUBSCRIPTION_REACTIVATED',
    durationType: params.durationType || 'months',
    durationValue: params.durationValue || 1,
    renewalMode: 'now',
    notes: params.notes || 'تم استئناف وتنشيط الاشتراك بواسطة الإدارة'
  });
}

// Grant Lifetime Subscription
export async function setClinicLifetimeSubscriptionByAdmin(params: {
  clinicId: string;
  adminId: string;
  adminEmail?: string;
  notes?: string;
}) {
  return updateClinicSubscriptionByAdmin({
    clinicId: params.clinicId,
    adminId: params.adminId,
    adminEmail: params.adminEmail,
    action: 'SUBSCRIPTION_SET_LIFETIME',
    durationType: 'lifetime',
    durationValue: 0,
    plan: 'lifetime',
    notes: params.notes || 'تم منح اشتراك دائم مدى الحياة بواسطة الإدارة'
  });
}

// Admin action: Activate or Extend Subscription (Backwards-compatible wrapper)
export async function activateSubscriptionByAdmin(params: {
  clinicId: string;
  plan: SubscriptionPlan;
  adminId: string;
  isExtension?: boolean;
  notes?: string;
}): Promise<{ success: boolean; expiresAt: string; referenceCode: string }> {
  const { clinicId, plan, adminId, isExtension, notes } = params;
  const isYearly = plan === 'yearly';

  const res = await updateClinicSubscriptionByAdmin({
    clinicId,
    adminId,
    action: isExtension ? 'SUBSCRIPTION_EXTENDED' : 'SUBSCRIPTION_CREATED',
    durationType: isYearly ? 'years' : 'months',
    durationValue: 1,
    renewalMode: isExtension ? 'extend' : 'now',
    plan,
    amount: isYearly ? OFFICIAL_SUBSCRIPTION_PRICES.yearly : OFFICIAL_SUBSCRIPTION_PRICES.monthly,
    notes
  });

  return {
    success: true,
    expiresAt: res.expiresAt || '',
    referenceCode: res.referenceCode
  };
}

// Admin action: Cancel Subscription (Backwards-compatible wrapper)
export async function cancelSubscriptionByAdmin(params: {
  clinicId: string;
  adminId: string;
  notes?: string;
}): Promise<void> {
  await updateClinicSubscriptionByAdmin({
    clinicId: params.clinicId,
    adminId: params.adminId,
    action: 'SUBSCRIPTION_CANCELLED',
    durationType: 'custom',
    durationValue: 0,
    notes: params.notes || 'تم إلغاء الاشتراك من لوحة الإدارة'
  });
}

// Fetch all subscription logs for Admin view
export async function getAllSubscriptionLogs(): Promise<SubscriptionLog[]> {
  try {
    const q = query(
      collection(db, "subscription_logs"),
      orderBy("activatedAt", "desc"),
      limit(100)
    );
    const snap = await getDocs(q);
    const logs: SubscriptionLog[] = [];
    snap.forEach((d) => {
      logs.push({ id: d.id, ...d.data() } as SubscriptionLog);
    });
    return logs;
  } catch (err) {
    console.error("Error fetching subscription logs:", err);
    return [];
  }
}

// Admin action: Modify doctor subscription (Legacy wrapper)
export async function updateDoctorSubscriptionByAdmin(
  doctorId: string,
  status: SubscriptionStatus,
  monthsCount: number = 1
): Promise<void> {
  const docRef = doc(db, "doctors", doctorId);
  const now = new Date();
  const endDate = new Date(now.getTime() + monthsCount * 30 * 24 * 60 * 60 * 1000);

  await updateDoc(docRef, {
    subscriptionStatus: status,
    subscriptionEndDate: endDate.toISOString()
  });
}

// Admin action: Delete doctor profile
export async function deleteDoctorAccount(doctorId: string): Promise<void> {
  const docRef = doc(db, "doctors", doctorId);
  await deleteDoc(docRef);
}

// Verify Admin Status against Firebase Auth & Firestore
export async function verifyAdminStatus(user: any): Promise<{ isAdmin: boolean; doctor?: DoctorProfile; error?: string }> {
  if (!user || !user.uid) return { isAdmin: false, error: "غير مسجل الدخول" };

  try {
    // 1. Check Auth Token Custom Claims
    try {
      if (typeof user.getIdTokenResult === 'function') {
        const idTokenResult = await user.getIdTokenResult();
        if (idTokenResult && idTokenResult.claims && idTokenResult.claims.admin === true) {
          return { isAdmin: true };
        }
      }
    } catch (e) {
      console.warn("Token claim check warning:", e);
    }

    // 2. Check Firestore /admins/{uid} document (Secure Admin Identity Record)
    try {
      const adminRef = doc(db, "admins", user.uid);
      const adminSnap = await getDoc(adminRef);
      if (adminSnap.exists()) {
        const adminData = adminSnap.data();
        if (adminData?.isAdmin !== false) {
          return { isAdmin: true };
        }
      }
    } catch (e) {
      console.warn("Admins collection check warning:", e);
    }

    // 3. Authorized Bootstrap Admin Emails check (abdelftahmohamed745@gmail.com)
    const normalizedEmail = user.email ? user.email.toLowerCase().trim() : '';
    const AUTHORIZED_ADMIN_EMAILS = [
      'abdelftahmohamed745@gmail.com',
      'admin@dawry.app'
    ];

    if (normalizedEmail && AUTHORIZED_ADMIN_EMAILS.includes(normalizedEmail)) {
      try {
        await setDoc(doc(db, "admins", user.uid), {
          uid: user.uid,
          email: user.email,
          isAdmin: true,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } catch (e) {
        console.warn("Could not write admin bootstrap doc:", e);
      }
      return { isAdmin: true };
    }

    return {
      isAdmin: false,
      error: "الحساب الحالي غير مصرح له بالوصول للوحة تحكم إدارة المنصة"
    };
  } catch (err: any) {
    console.error("Error verifying admin status:", err);
    return { isAdmin: false, error: "فشل التحقق من صلاحيات الحساب" };
  }
}

// In-memory cache for doctor profiles to drastically minimize getDoc reads
const doctorProfileCache = new Map<string, { profile: DoctorProfile; timestamp: number }>();
const DOCTOR_CACHE_TTL = 3 * 60 * 1000; // 3 minutes

export function clearDoctorProfileCache(doctorId?: string): void {
  if (doctorId) {
    doctorProfileCache.delete(doctorId);
  } else {
    doctorProfileCache.clear();
  }
}

// Fetch Doctor Profile with in-memory caching
export async function getDoctorProfile(doctorId: string, bypassCache = false): Promise<DoctorProfile | null> {
  try {
    if (!bypassCache) {
      const cached = doctorProfileCache.get(doctorId);
      if (cached && Date.now() - cached.timestamp < DOCTOR_CACHE_TTL) {
        return cached.profile;
      }
    }

    const docRef = doc(db, "doctors", doctorId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data() as DoctorProfile;
      data.referenceCode = data.referenceCode || generateReferenceCode(data.uid);
      const computedStatus = evaluateSubscriptionStatus(data);
      if (computedStatus !== data.subscriptionStatus) {
        data.subscriptionStatus = computedStatus;
      }
      doctorProfileCache.set(doctorId, { profile: data, timestamp: Date.now() });
      return data;
    }
    return null;
  } catch (error) {
    console.error("Error fetching doctor profile:", error);
    return null;
  }
}

// Create or initialize doctor profile
export async function createDoctorProfile(doctorId: string, name: string, specialty: string, clinicName: string): Promise<DoctorProfile> {
  const now = new Date();
  const trialEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days free trial

  const newProfile: DoctorProfile = {
    uid: doctorId,
    referenceCode: generateReferenceCode(doctorId),
    name,
    specialty,
    clinicName: clinicName || `عيادة ${name}`,
    qrCodeId: `QR-${doctorId.slice(0, 8)}`,
    phone: "", // Doctor adds phone manually in settings
    whatsappNumber: "",
    address: "بغداد، العراق",
    city: "بغداد",
    photoUrl: "",
    description: `عيادة ${specialty} متخصصة بتقديم أفضل خدمات الرعاية الطبية.`,
    subscriptionStatus: "trial",
    trialEndDate: trialEnd.toISOString(),
    avgConsultTime: 12, // Default 12 minutes per patient
    workHours: {
      open: "09:00",
      close: "21:00",
      maxPatientsPerDay: 50,
      daysOfWeek: ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس"]
    },
    createdAt: now.toISOString(),
    isActive: true
  };

  await setDoc(doc(db, "doctors", doctorId), newProfile);
  return newProfile;
}

// Update doctor profile/settings with field protection and sanitization
export async function updateDoctorSettings(doctorId: string, updates: Partial<DoctorProfile>): Promise<void> {
  // Strip administrative / system fields to satisfy Firestore security rules
  const safeUpdates: Record<string, any> = { ...updates };
  delete safeUpdates.isAdmin;
  delete safeUpdates.isActive;
  delete safeUpdates.subscriptionStatus;
  delete safeUpdates.subscriptionEndDate;
  delete safeUpdates.createdAt;
  delete safeUpdates.ownerId;

  // Sanitize text inputs to prevent XSS
  if (safeUpdates.name) safeUpdates.name = sanitizeInput(safeUpdates.name);
  if (safeUpdates.clinicName) safeUpdates.clinicName = sanitizeInput(safeUpdates.clinicName);
  if (safeUpdates.specialty) safeUpdates.specialty = sanitizeInput(safeUpdates.specialty);
  if (safeUpdates.address) safeUpdates.address = sanitizeInput(safeUpdates.address);
  if (safeUpdates.city) safeUpdates.city = sanitizeInput(safeUpdates.city);
  if (safeUpdates.description) safeUpdates.description = sanitizeInput(safeUpdates.description);

  // Validate URLs if present
  if (safeUpdates.photoUrl && !isValidUrl(safeUpdates.photoUrl)) {
    throw new Error("رابط الصورة غير صالح أو غير آمن (يجب أن يبدأ بـ https:// أو يكون صورة مدعومة)");
  }
  if (Array.isArray(safeUpdates.clinicPhotos)) {
    for (const photo of safeUpdates.clinicPhotos) {
      if (photo && !isValidUrl(photo)) {
        throw new Error("أحد روابط صور العيادة غير صالح أو غير آمن");
      }
    }
  }

  const cleanUpdates = removeUndefinedFields(safeUpdates);
  const docRef = doc(db, "doctors", doctorId);
  await updateDoc(docRef, cleanUpdates);

  // Write Audit Log
  writeAuditLog("UPDATE_DOCTOR_SETTINGS", doctorId, doctorId, { updatedFields: Object.keys(cleanUpdates) });
}

// Check for active duplicate booking for phone number today
export async function checkActiveBooking(doctorId: string, phone: string): Promise<PatientRecord | null> {
  const normalizedPhone = normalizePhoneNumber(phone);
  if (!normalizedPhone) return null;
  const today = getTodayDateString();
  const q = query(
    collection(db, "queues", doctorId, "patients"),
    where("date", "==", today),
    where("phone", "==", normalizedPhone)
  );

  const snapshot = await getDocs(q);
  const activeDoc = snapshot.docs
    .map(d => ({ id: d.id, ...d.data() } as PatientRecord))
    .find(p => p.status === 'waiting' || p.status === 'called');

  return activeDoc || null;
}

// Add Patient to Queue with rate limiting, subscription checks, and atomic sequence numbers
export async function bookPatient(
  doctorId: string,
  name: string,
  phone: string,
  userId?: string,
  notificationPreference: NotificationTimingPreference = 'two_turns',
  selectedService?: { serviceId?: string; serviceName: string; visitType?: string; price: number }
): Promise<{ patientId: string; sequenceNumber: number; isExisting?: boolean; bookingReference?: string; patientProfileId?: string }> {
  // 1. Sanitize & Validate Inputs
  const cleanName = sanitizeInput(name);
  const phoneValidation = validatePatientPhoneNumber(phone);

  if (!cleanName || cleanName.length < 2) {
    throw new Error("يرجى إدخال اسم صحيح لا يقل عن حرفين");
  }

  if (cleanName.length > 100) {
    throw new Error("الاسم أطول من الحد المسموح به (100 حرف)");
  }

  if (!phoneValidation.isValid) {
    throw new Error(phoneValidation.error || "رقم الهاتف يجب أن يكون من 10 إلى 11 رقمًا.");
  }
  const normalizedPhone = phoneValidation.cleanPhone;

  // 2. Check for active duplicate booking today first (idempotent ticket recovery)
  const existingBooking = await checkActiveBooking(doctorId, normalizedPhone);
  if (existingBooking) {
    return {
      patientId: existingBooking.id,
      sequenceNumber: existingBooking.sequenceNumber,
      isExisting: true,
      bookingReference: existingBooking.bookingReference,
      patientProfileId: existingBooking.patientId
    };
  }

  // 3. Resolve / Create Unified Patient Profile
  let patientProfile: PatientProfile | null = null;
  try {
    patientProfile = await getOrCreatePatientProfile(cleanName, normalizedPhone, { uid: userId });
  } catch (e) {
    console.warn("Patient profile auto-provision error:", e);
  }
  const pid = patientProfile?.patientId || generatePatientId(normalizedPhone);
  const bookingRef = generateBookingReference();

  // 4. Anti-Spam Rate Limiting Check for NEW bookings (applies ONLY to public patient bookings, never clinic staff or doctor)
  const isClinicStaff = Boolean(userId && userId !== 'PATIENT_PUBLIC');
  if (!isClinicStaff) {
    const rateCheck = checkBookingRateLimit(normalizedPhone);
    if (!rateCheck.allowed) {
      throw new Error(`يرجى الانتظار ${rateCheck.remainingSeconds} ثانية قبل محاولة الحجز مرة أخرى`);
    }
  }

  // 5. Verify doctor subscription status & active account (cached in memory)
  const doctor = await getDoctorProfile(doctorId);
  if (!doctor) {
    throw new Error("الطبيب غير موجود في النظام");
  }

  if (doctor.isActive === false) {
    throw new Error("عذراً، هذه العيادة متوقفة حالياً عن استقبال الحجوزات");
  }

  const effectiveSubStatus = evaluateSubscriptionStatus(doctor);
  if (effectiveSubStatus === 'expired' || effectiveSubStatus === 'suspended' || effectiveSubStatus === 'cancelled') {
    throw new Error("عذراً، نظام الحجز غير متاح حالياً لدى هذه العيادة لانتهاء أو توقف فترة الاشتراك. يرجى مراجعة موظف الاستقبال أو إدارة العيادة.");
  }

  // 6. Atomic Queue Sequence Number Generation via Transaction (Zero extra getDocs queries needed!)
  const today = getTodayDateString();
  const counterRef = doc(db, "queues", doctorId, "dailyCounters", today);
  const now = new Date().toISOString();

  // Deterministic booking document reference based on date + normalized phone
  const bookingDocId = `${today}_${normalizedPhone}`;
  const deterministicPatientRef = doc(db, "queues", doctorId, "patients", bookingDocId);

  const transactionResult = await runTransaction(db, async (transaction) => {
    // A. Read deterministic patient doc inside transaction to prevent parallel race condition duplicates
    const patientSnap = await transaction.get(deterministicPatientRef);
    let targetPatientRef = deterministicPatientRef;

    if (patientSnap.exists()) {
      const existingData = patientSnap.data() as PatientRecord;
      if (existingData.status === 'waiting' || existingData.status === 'called') {
        return {
          patientId: patientSnap.id,
          sequenceNumber: existingData.sequenceNumber,
          isExisting: true,
          bookingReference: existingData.bookingReference,
          patientProfileId: existingData.patientId || pid
        };
      }
      // If previous ticket today was completed/cancelled, allocate new auto-ID doc
      targetPatientRef = doc(collection(db, "queues", doctorId, "patients"));
    }

    // B. Read atomic daily counter inside transaction
    const counterSnap = await transaction.get(counterRef);
    let currentMaxSeq = 0;

    if (counterSnap.exists()) {
      const recordedSeq = counterSnap.data().lastSequenceNumber;
      if (typeof recordedSeq === 'number' && recordedSeq > 0) {
        currentMaxSeq = recordedSeq;
      }
    }

    const nextSeq = currentMaxSeq + 1;

    if (doctor.workHours?.maxPatientsPerDay && nextSeq > doctor.workHours.maxPatientsPerDay) {
      throw new Error(`عذراً، اكتمل الحد الأقصى لحجوزات اليوم (${doctor.workHours.maxPatientsPerDay} مريض).`);
    }

    const estMins = Math.max(0, (nextSeq - 1) * (doctor.avgConsultTime || 12));

    const patientData: Omit<PatientRecord, 'id'> = {
      patientId: pid,
      bookingReference: bookingRef,
      doctorId,
      clinicId: doctorId,
      userId: userId || '',
      sequenceNumber: nextSeq,
      queueNumber: nextSeq,
      name: cleanName,
      phone: normalizedPhone,
      status: 'waiting',
      date: today,
      serviceId: selectedService?.serviceId || '',
      serviceName: selectedService?.serviceName || 'كشف',
      visitType: selectedService?.visitType || selectedService?.serviceName || 'كشف جديد',
      price: typeof selectedService?.price === 'number' ? selectedService.price : (doctor.consultationFee || 200),
      createdAt: now,
      updatedAt: now,
      estimatedMinutes: estMins,
      notificationSent: false,
      notifiedForTwoTurns: false,
      notifiedForOneTurn: false,
      notifiedForTenMinutes: false,
      notificationPreference
    };

    transaction.set(counterRef, {
      lastSequenceNumber: nextSeq,
      date: today,
      updatedAt: now
    }, { merge: true });

    transaction.set(targetPatientRef, removeUndefinedFields(patientData));

    return {
      patientId: targetPatientRef.id,
      sequenceNumber: nextSeq,
      isExisting: false,
      bookingReference: bookingRef,
      patientProfileId: pid
    };
  });

  // Record rate limiting timestamp ONLY on successful transaction completion for public bookings
  if (!transactionResult.isExisting && !isClinicStaff) {
    recordBookingSuccess(normalizedPhone);
  }

    // Update active daily session metrics at write time
    try {
      const sessionRef = doc(db, "doctors", doctorId, "dailySessions", today);
      await updateDoc(sessionRef, {
        patientsCount: increment(1),
        waitingCount: increment(1)
      });
    } catch {
      // Non-blocking if session doc not yet created
    }

    // Link visit to Patient Medical File
    try {
      await addVisitToPatientMedicalFile(doctorId, cleanName, normalizedPhone, {
        id: `visit_${Date.now()}`,
        date: today,
        serviceId: selectedService?.serviceId || '',
        serviceName: selectedService?.serviceName || 'كشف',
        visitType: selectedService?.visitType || selectedService?.serviceName || 'كشف جديد',
        price: typeof selectedService?.price === 'number' ? selectedService.price : 200,
        paidAmount: 0,
        remainingAmount: typeof selectedService?.price === 'number' ? selectedService.price : 200,
        status: 'waiting',
        createdAt: now
      }, pid);
    } catch (e) {
      console.warn("Could not auto-link visit to patient medical file:", e);
    }

  // Write Audit Log
  writeAuditLog("BOOK_PATIENT_TICKET", userId || "PATIENT_PUBLIC", doctorId, {
    sequenceNumber: transactionResult.sequenceNumber,
    ticketId: transactionResult.patientId,
    bookingReference: transactionResult.bookingReference || bookingRef,
    patientId: pid,
    isExisting: transactionResult.isExisting || false
  });

  return {
    patientId: transactionResult.patientId,
    sequenceNumber: transactionResult.sequenceNumber,
    isExisting: transactionResult.isExisting,
    bookingReference: transactionResult.bookingReference || bookingRef,
    patientProfileId: pid
  };
}

// Live Queue Listener for Doctor Dashboard (strictly scoped to active session date)
export function subscribeToDoctorQueue(
  doctorId: string,
  sessionDateOrCallback: string | ((patients: PatientRecord[]) => void),
  optionalCallback?: (patients: PatientRecord[]) => void
): () => void {
  let sessionDate: string;
  let callback: (patients: PatientRecord[]) => void;

  if (typeof sessionDateOrCallback === 'function') {
    sessionDate = getTodayDateString();
    callback = sessionDateOrCallback;
  } else {
    sessionDate = sessionDateOrCallback || getTodayDateString();
    callback = optionalCallback || (() => {});
  }

  if (!doctorId) {
    callback([]);
    return () => {};
  }

  const q = query(
    collection(db, "queues", doctorId, "patients"),
    where("date", "==", sessionDate)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const list: PatientRecord[] = [];
      snapshot.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as PatientRecord);
      });
      // Sort by sequence number ascending
      list.sort((a, b) => a.sequenceNumber - b.sequenceNumber);
      callback(list);
    },
    (err) => {
      console.error("Queue listener error:", err);
      callback([]);
    }
  );
}

// Live Single Patient Ticket Listener with Dual Snapshot Sync Guard
export function subscribeToPatientTicket(
  doctorId: string,
  patientId: string,
  callback: (data: { patient: PatientRecord | null; doctor: DoctorProfile | null; allTodayPatients: PatientRecord[] }) => void
) {
  const today = getTodayDateString();
  const doctorRef = doc(db, "doctors", doctorId);
  const queueColRef = collection(db, "queues", doctorId, "patients");
  const directTicketRef = doc(db, "queues", doctorId, "patients", patientId);

  let currentDoctor: DoctorProfile | null = null;
  let allPatients: PatientRecord[] = [];
  let directPatient: PatientRecord | null = null;
  let doctorLoaded = false;
  let queueLoaded = false;

  const unsubDoctor = onSnapshot(doctorRef, (docSnap) => {
    if (docSnap.exists()) {
      currentDoctor = docSnap.data() as DoctorProfile;
      currentDoctor.subscriptionStatus = evaluateSubscriptionStatus(currentDoctor);
    }
    doctorLoaded = true;
    emit();
  }, (err) => {
    console.error("Doctor ticket snapshot error:", err);
    doctorLoaded = true;
    emit();
  });

  // Direct ticket listener for privacy & instant resolution
  const unsubDirect = onSnapshot(directTicketRef, (snap) => {
    if (snap.exists()) {
      directPatient = { id: snap.id, ...snap.data() } as PatientRecord;
    }
    emit();
  }, () => {
    emit();
  });

  const q = query(queueColRef, where("date", "==", today));
  const unsubQueue = onSnapshot(q, (snap) => {
    const list: PatientRecord[] = [];
    snap.forEach((d) => {
      list.push({ id: d.id, ...d.data() } as PatientRecord);
    });
    list.sort((a, b) => a.sequenceNumber - b.sequenceNumber);
    allPatients = list;
    queueLoaded = true;
    emit();
  }, (err) => {
    // If batch queue query is restricted by security rules for unauthenticated visitors, proceed with direct ticket
    queueLoaded = true;
    emit();
  });

  function emit() {
    // Emit as soon as doctor is loaded or direct ticket is available
    if (!doctorLoaded && !directPatient) return;
    const normalizedTarget = normalizePhoneNumber(patientId);
    const upperTarget = (patientId || '').trim().toUpperCase();

    let myPatient = directPatient || allPatients.find(p => 
      p.id === patientId ||
      (p.bookingReference && p.bookingReference.toUpperCase() === upperTarget) ||
      (p.patientId && p.patientId.toUpperCase() === upperTarget) ||
      (normalizedTarget && p.phone === normalizedTarget)
    ) || null;

    callback({
      patient: myPatient,
      doctor: currentDoctor,
      allTodayPatients: allPatients
    });
  }

  return () => {
    unsubDoctor();
    unsubDirect();
    unsubQueue();
  };
}

// Call Next Patient Action with Atomic Transaction
export async function callNextPatient(doctorId: string): Promise<{ calledPatient: PatientRecord | null }> {
  const today = getTodayDateString();
  const nowIso = new Date().toISOString();
  let nextCalledPatient: PatientRecord | null = null;

  await runTransaction(db, async (transaction) => {
    const queueColRef = collection(db, "queues", doctorId, "patients");
    const q = query(queueColRef, where("date", "==", today));
    const snap = await getDocs(q);

    const patients: PatientRecord[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as PatientRecord));
    patients.sort((a, b) => a.sequenceNumber - b.sequenceNumber);

    // 1. If there's an existing 'called' patient, mark them 'done'
    const currentCalled = patients.find(p => p.status === 'called');
    if (currentCalled) {
      const currentRef = doc(db, "queues", doctorId, "patients", currentCalled.id);
      transaction.update(currentRef, {
        status: 'done',
        doneAt: nowIso,
        updatedAt: nowIso
      });
    }

    // 2. Find next 'waiting' patient
    const nextWaiting = patients.find(p => p.status === 'waiting');
    if (nextWaiting) {
      const nextRef = doc(db, "queues", doctorId, "patients", nextWaiting.id);
      transaction.update(nextRef, {
        status: 'called',
        calledAt: nowIso,
        updatedAt: nowIso
      });
      nextCalledPatient = { ...nextWaiting, status: 'called', calledAt: nowIso };
    }
  });

  // Update active daily session metrics at write-time
  try {
    const sessionRef = doc(db, "doctors", doctorId, "dailySessions", today);
    const sessionUpdates: Record<string, any> = {};
    if (nextCalledPatient) {
      sessionUpdates.inConsultationCount = increment(1);
      sessionUpdates.waitingCount = increment(-1);
    }
    if (Object.keys(sessionUpdates).length > 0) {
      await updateDoc(sessionRef, sessionUpdates);
    }
  } catch {
    // Non-blocking
  }

  // 3. Recalculate average consultation time in background
  recalculateDoctorAvgConsultTime(doctorId).catch(console.error);

  return { calledPatient: nextCalledPatient };
}

// Update single patient status
export async function updatePatientStatus(
  doctorId: string,
  patientId: string,
  newStatus: PatientStatus,
  currentStatusKnown?: PatientStatus
): Promise<void> {
  const ticketRef = doc(db, "queues", doctorId, "patients", patientId);

  // Check existence and resolve previous status
  let previousStatus: PatientStatus = currentStatusKnown || 'waiting';
  try {
    const snap = await getDoc(ticketRef);
    if (!snap.exists()) {
      throw new Error("سجل المريض غير موجود في طابور اليوم أو تم أرشفته مسبقاً.");
    }
    const data = snap.data() as PatientRecord;
    previousStatus = currentStatusKnown || data.status;
  } catch (readErr: any) {
    if (readErr.message?.includes("غير موجود في طابور اليوم")) {
      throw readErr;
    }
    // Proceed to updateDoc if offline cache error
  }

  const nowIso = new Date().toISOString();
  const updates: Partial<PatientRecord> = { status: newStatus };

  if (newStatus === 'called') updates.calledAt = nowIso;
  if (newStatus === 'done') updates.doneAt = nowIso;
  if (newStatus === 'cancelled') updates.cancelledAt = nowIso;

  try {
    await updateDoc(ticketRef, updates);
  } catch (err: any) {
    if (err?.code === 'not-found' || err?.message?.includes('No document to update')) {
      throw new Error("سجل المريض غير موجود في طابور اليوم أو تم أرشفته مسبقاً.");
    }
    throw err;
  }

  // Write-time session aggregation for status change with precise transition balancing
  try {
    if (previousStatus !== newStatus) {
      const today = getTodayDateString();
      const sessionRef = doc(db, "doctors", doctorId, "dailySessions", today);
      const sessionUpdates: Record<string, any> = {};

      // Decrement old status count
      if (previousStatus === 'waiting') sessionUpdates.waitingCount = increment(-1);
      else if (previousStatus === 'called') sessionUpdates.inConsultationCount = increment(-1);
      else if (previousStatus === 'done') sessionUpdates.completedCount = increment(-1);
      else if (previousStatus === 'cancelled') sessionUpdates.cancelledCount = increment(-1);
      else if (previousStatus === 'no_show') sessionUpdates.noShowCount = increment(-1);

      // Increment new status count
      if (newStatus === 'waiting') sessionUpdates.waitingCount = increment(1);
      else if (newStatus === 'called') sessionUpdates.inConsultationCount = increment(1);
      else if (newStatus === 'done') sessionUpdates.completedCount = increment(1);
      else if (newStatus === 'cancelled') sessionUpdates.cancelledCount = increment(1);
      else if (newStatus === 'no_show') sessionUpdates.noShowCount = increment(1);

      if (Object.keys(sessionUpdates).length > 0) {
        await updateDoc(sessionRef, sessionUpdates);
      }
    }
  } catch {
    // Non-blocking
  }

  if (newStatus === 'done') {
    recalculateDoctorAvgConsultTime(doctorId).catch(console.error);
  }
}

export async function recordPatientMedicalOrder(
  doctorId: string,
  patientId: string,
  orderType: 'xray' | 'lab' | 'xray_and_lab',
  patientName: string,
  patientPhone?: string
): Promise<{ orderLabel: string; emoji: string }> {
  const labels: Record<string, { orderLabel: string; emoji: string }> = {
    xray: { orderLabel: 'أشعة', emoji: '🩻' },
    lab: { orderLabel: 'تحليل', emoji: '🧪' },
    xray_and_lab: { orderLabel: 'أشعة وتحليل', emoji: '🔬' }
  };
  const { orderLabel, emoji } = labels[orderType] || { orderLabel: 'فحص طبي', emoji: '🔬' };
  const nowIso = new Date().toISOString();

  await updateDoc(doc(db, "queues", doctorId, "patients", patientId), {
    medicalOrder: orderType,
    medicalOrderLabel: orderLabel,
    medicalOrderAt: nowIso
  });

  if (patientPhone) {
    try {
      await addVisitToPatientMedicalFile(doctorId, patientName, patientPhone, {
        id: `order_${Date.now()}`,
        date: getTodayDateString(),
        serviceId: '',
        serviceName: `طلب فحص: ${orderLabel}`,
        visitType: 'كشف جديد',
        price: 0,
        paidAmount: 0,
        remainingAmount: 0,
        status: 'waiting',
        notes: `تم طلب ${orderLabel} (${emoji}) أثناء الكشف بالعيادة`,
        createdAt: nowIso
      });
    } catch (e) {
      console.warn("Could not append medical order to patient file:", e);
    }
  }

  return { orderLabel, emoji };
}

// Auto-recalculate doctor avg consult time from last 10 done patients
export async function recalculateDoctorAvgConsultTime(doctorId: string): Promise<number> {
  try {
    const today = getTodayDateString();
    const q = query(
      collection(db, "queues", doctorId, "patients"),
      where("date", "==", today),
      where("status", "==", "done")
    );

    const snap = await getDocs(q);
    const donePatients = snap.docs.map(d => d.data() as PatientRecord);

    const validDurations: number[] = [];
    donePatients.forEach(p => {
      const startTimeStr = p.calledAt || p.createdAt;
      const endTimeStr = p.doneAt;
      if (startTimeStr && endTimeStr) {
        const start = new Date(startTimeStr).getTime();
        const end = new Date(endTimeStr).getTime();
        const diffMinutes = Math.round((end - start) / (1000 * 60));
        // Ignore unreasonable outliers (< 1 min or > 120 mins)
        if (diffMinutes >= 1 && diffMinutes <= 120) {
          validDurations.push(diffMinutes);
        }
      }
    });

    if (validDurations.length > 0) {
      // average of last 10
      const recent = validDurations.slice(-10);
      const sum = recent.reduce((acc, curr) => acc + curr, 0);
      const avg = Math.max(3, Math.round(sum / recent.length)); // minimum 3 mins

      await updateDoc(doc(db, "doctors", doctorId), { avgConsultTime: avg });
      return avg;
    }
  } catch (err) {
    console.error("Error recalculating avg consult time:", err);
  }
  return 12; // fallback default
}

// Delete doctor account securely via Backend/Admin function
export async function deleteDoctorAccountByAdmin(doctorId: string, adminUid: string): Promise<{ success: boolean; message: string }> {
  try {
    // Audit Log
    writeAuditLog("DELETE_DOCTOR_ACCOUNT_REQUEST", adminUid, doctorId, { targetDoctorId: doctorId });

    // Call server API / Firebase Callable Cloud Function
    const response = await fetch("/api/admin/delete-doctor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ doctorId, adminUid })
    });

    if (!response.ok) {
      // Fallback direct delete if server route unavailable and auth is admin
      await updateDoc(doc(db, "doctors", doctorId), { isActive: false });
      return { success: true, message: "تم تعطيل حساب العيادة بنجاح" };
    }

    const data = await response.json();
    return { success: true, message: data.message || "تم حذف حساب الطبيب بنجاح" };
  } catch (err: any) {
    console.error("Error deleting doctor account:", err);
    throw new Error(err.message || "فشلت عملية حذف حساب الطبيب");
  }
}

// Purge all test accounts and demo data from database securely
export async function purgeTestAccounts(): Promise<{ success: boolean; deletedCount: number }> {
  try {
    let deletedCount = 0;
    
    // 1. Delete default demo doctor doc
    const demoDocRef = doc(db, "doctors", DEMO_DOCTOR_ID);
    const demoSnap = await getDoc(demoDocRef);
    if (demoSnap.exists()) {
      await deleteDoc(demoDocRef);
      deletedCount++;
    }

    // 2. Query any doctors marked as test/demo
    const querySnap = await getDocs(collection(db, "doctors"));
    for (const docSnap of querySnap.docs) {
      if (docSnap.exists()) {
        const data = docSnap.data() as DoctorProfile;
        if (
          docSnap.id === DEMO_DOCTOR_ID ||
          data.uid === DEMO_DOCTOR_ID ||
          data.name?.includes("تجريبي") ||
          data.name?.includes("أسامة عبد الرحمن") ||
          data.qrCodeId?.includes("DEMO")
        ) {
          // Delete patients in subcollection queue
          try {
            const patientsSnap = await getDocs(collection(db, "queues", docSnap.id, "patients"));
            for (const pDoc of patientsSnap.docs) {
              await deleteDoc(pDoc.ref);
            }
          } catch (e) {
            console.error("Error deleting queue patients:", e);
          }

          // Delete doctor document
          await deleteDoc(docSnap.ref);
          deletedCount++;
        }
      }
    }

    // 3. Delete demo follow up appointments
    try {
      const followUpsSnap = await getDocs(
        query(collection(db, "followUpAppointments"), where("doctorId", "==", DEMO_DOCTOR_ID))
      );
      for (const fDoc of followUpsSnap.docs) {
        await deleteDoc(fDoc.ref);
      }
    } catch (e) {
      console.error("Error purging demo follow-up appointments:", e);
    }

    console.log(`Purged ${deletedCount} test accounts from database.`);
    return { success: true, deletedCount };
  } catch (err) {
    console.error("Error purging test accounts:", err);
    return { success: false, deletedCount: 0 };
  }
}

// Check if a patient ticket has already been rated
export async function checkTicketRated(patientRecordId: string): Promise<DoctorRating | null> {
  try {
    const q = query(
      collection(db, "ratings"),
      where("patientRecordId", "==", patientRecordId)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const docSnap = snap.docs[0];
      return { id: docSnap.id, ...docSnap.data() } as DoctorRating;
    }
    return null;
  } catch (err) {
    console.error("Error checking ticket rating:", err);
    return null;
  }
}

// Submit a new doctor rating and update average stats
export async function addDoctorRating(params: {
  doctorId: string;
  patientRecordId: string;
  patientName: string;
  patientPhone?: string;
  stars: number;
  comment?: string;
}): Promise<DoctorRating> {
  const { doctorId, patientRecordId, patientName, patientPhone, stars, comment } = params;

  if (stars < 1 || stars > 5) {
    throw new Error("التقييم يجب أن يكون بين 1 و 5 نجوم");
  }

  // 1. Prevent double rating for same booking
  const existingRating = await checkTicketRated(patientRecordId);
  if (existingRating) {
    throw new Error("لقد قمت بإرسال تقييمك لهذه الزيارة من قبل. شكرًا لك!");
  }

  const cleanName = sanitizeInput(patientName || "مريض");
  const cleanComment = comment ? sanitizeInput(comment) : "";
  const nowIso = new Date().toISOString();

  const ratingData: Omit<DoctorRating, 'id'> = {
    doctorId,
    patientRecordId,
    patientName: cleanName,
    patientPhone: patientPhone ? patientPhone.trim() : "",
    stars: Math.round(stars),
    comment: cleanComment,
    createdAt: nowIso
  };

  // 2. Save to 'ratings' collection
  const docRef = await addDoc(collection(db, "ratings"), ratingData);
  const newRating: DoctorRating = { id: docRef.id, ...ratingData };

  // 3. Recalculate average rating & total count for the doctor
  await recalculateDoctorRatingStats(doctorId).catch((err) => {
    console.error("Warning: Failed to update doctor rating stats:", err);
  });

  // Write audit log
  writeAuditLog("ADD_DOCTOR_RATING", "PATIENT_PUBLIC", doctorId, {
    stars,
    ratingId: docRef.id
  });

  return newRating;
}

// Fetch all ratings for a given doctor
export async function getDoctorRatings(doctorId: string): Promise<DoctorRating[]> {
  try {
    const q = query(
      collection(db, "ratings"),
      where("doctorId", "==", doctorId)
    );
    const snap = await getDocs(q);
    const list: DoctorRating[] = [];
    snap.forEach((d) => {
      list.push({ id: d.id, ...d.data() } as DoctorRating);
    });
    // Sort by createdAt descending
    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return list;
  } catch (err) {
    console.error("Error fetching doctor ratings:", err);
    return [];
  }
}

// Recalculate doctor rating average and count
export async function recalculateDoctorRatingStats(doctorId: string): Promise<{ avg: number; count: number }> {
  try {
    const ratings = await getDoctorRatings(doctorId);
    const count = ratings.length;
    if (count === 0) {
      await updateDoc(doc(db, "doctors", doctorId), { ratingAverage: 0, ratingCount: 0 });
      return { avg: 0, count: 0 };
    }

    const totalStars = ratings.reduce((acc, r) => acc + (Number(r.stars) || 0), 0);
    const avg = parseFloat((totalStars / count).toFixed(1));

    await updateDoc(doc(db, "doctors", doctorId), { ratingAverage: avg, ratingCount: count });
    return { avg, count };
  } catch (err) {
    console.error("Error recalculating rating stats:", err);
    return { avg: 0, count: 0 };
  }
}

// ==========================================
// FOLLOW-UP APPOINTMENTS (مواعيد إعادة الكشف)
// ==========================================

// Validate date and time are not in the past
export function isDateTimeInPast(dateStr: string, timeStr: string): boolean {
  try {
    const appointmentDateTime = new Date(`${dateStr}T${timeStr}:00`);
    const now = new Date();
    return appointmentDateTime.getTime() < now.getTime() - 60000; // allow 1 min margin
  } catch {
    return false;
  }
}

// Create a new follow-up appointment
export async function createFollowUpAppointment(params: {
  patientName: string;
  patientPhone: string;
  patientId?: string;
  doctorId: string;
  doctorName?: string;
  clinicId?: string;
  clinicName?: string;
  appointmentDate: string; // YYYY-MM-DD
  appointmentTime: string; // HH:mm
  notes?: string;
  reason?: string;
  reminderSettings?: FollowUpReminderSettings;
}): Promise<FollowUpAppointment> {
  const {
    patientName,
    patientPhone,
    patientId,
    doctorId,
    doctorName,
    clinicId,
    clinicName,
    appointmentDate,
    appointmentTime,
    notes,
    reason,
    reminderSettings
  } = params;

  if (!patientName || !patientName.trim()) {
    throw new Error("اسم المريض مطلوب لحجز موعد إعادة الكشف");
  }

  const phoneValidation = validatePatientPhoneNumber(patientPhone);
  if (!phoneValidation.isValid) {
    throw new Error(phoneValidation.error || "رقم الهاتف يجب أن يكون من 10 إلى 11 رقمًا.");
  }

  if (!appointmentDate || !appointmentTime) {
    throw new Error("يرجى تحديد تاريخ ووقت موعد إعادة الكشف");
  }

  if (isDateTimeInPast(appointmentDate, appointmentTime)) {
    throw new Error("لا يمكن إنشاء موعد إعادة كشف بتاريخ أو وقت في الماضي");
  }

  const cleanName = sanitizeInput(patientName);
  const cleanPhone = phoneValidation.cleanPhone;
  const cleanNotes = notes ? sanitizeInput(notes) : "";
  const cleanReason = reason ? sanitizeInput(reason) : "";
  const nowIso = new Date().toISOString();

  let resolvedPid = patientId || "";
  if (!resolvedPid && cleanPhone) {
    try {
      const pProfile = await getOrCreatePatientProfile(cleanName, cleanPhone);
      resolvedPid = pProfile.patientId || pProfile.id;
    } catch {
      resolvedPid = generatePatientId(cleanPhone);
    }
  }

  const appointmentData: Omit<FollowUpAppointment, 'id'> = {
    patientId: resolvedPid || "",
    patientName: cleanName,
    patientPhone: cleanPhone,
    doctorId,
    doctorName: doctorName || "الطبيب",
    clinicId: clinicId || doctorId,
    clinicName: clinicName || "العيادة",
    appointmentDate,
    appointmentTime,
    notes: cleanNotes,
    reason: cleanReason,
    reminderSettings: reminderSettings || { oneDayBefore: true, twoHoursBefore: true },
    appointmentStatus: 'upcoming',
    createdAt: nowIso
  };

  const docRef = await addDoc(collection(db, "followUpAppointments"), appointmentData);
  const newAppointment: FollowUpAppointment = { id: docRef.id, ...appointmentData };

  writeAuditLog("CREATE_FOLLOWUP_APPOINTMENT", "DOCTOR", doctorId, {
    appointmentId: docRef.id,
    patientName: cleanName,
    patientPhone: cleanPhone,
    patientId: resolvedPid,
    appointmentDate,
    appointmentTime
  });

  return newAppointment;
}

// Subscribe to doctor's follow-up appointments
export function subscribeToDoctorFollowUps(
  doctorId: string,
  callback: (appointments: FollowUpAppointment[]) => void
) {
  const q = query(
    collection(db, "followUpAppointments"),
    where("doctorId", "==", doctorId)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const list: FollowUpAppointment[] = [];
      snapshot.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as FollowUpAppointment);
      });
      list.sort((a, b) => {
        const dtA = new Date(`${a.appointmentDate}T${a.appointmentTime}`).getTime();
        const dtB = new Date(`${b.appointmentDate}T${b.appointmentTime}`).getTime();
        return dtA - dtB;
      });
      callback(list);
    },
    (err) => {
      console.error("Error subscribing to doctor follow-ups:", err);
      callback([]);
    }
  );
}

// Get patient follow-up appointments by phone or patientId
export async function getPatientFollowUpAppointments(
  queryTarget: string | { phone?: string; patientId?: string }
): Promise<FollowUpAppointment[]> {
  try {
    let cleanPhone = '';
    let targetPid = '';

    if (typeof queryTarget === 'string') {
      const trimmed = queryTarget.trim();
      if (trimmed.startsWith('PID-')) {
        targetPid = trimmed;
      } else {
        cleanPhone = trimmed;
      }
    } else if (queryTarget) {
      cleanPhone = (queryTarget.phone || '').trim();
      targetPid = (queryTarget.patientId || '').trim();
    }

    if (!cleanPhone && !targetPid) return [];

    const map = new Map<string, FollowUpAppointment>();

    if (cleanPhone) {
      const qPhone = query(
        collection(db, "followUpAppointments"),
        where("patientPhone", "==", cleanPhone)
      );
      const snapPhone = await getDocs(qPhone);
      snapPhone.forEach((d) => {
        map.set(d.id, { id: d.id, ...d.data() } as FollowUpAppointment);
      });
    }

    if (targetPid) {
      const qPid = query(
        collection(db, "followUpAppointments"),
        where("patientId", "==", targetPid)
      );
      const snapPid = await getDocs(qPid);
      snapPid.forEach((d) => {
        map.set(d.id, { id: d.id, ...d.data() } as FollowUpAppointment);
      });
    }

    const list = Array.from(map.values());
    list.sort((a, b) => {
      const dtA = new Date(`${a.appointmentDate}T${a.appointmentTime}`).getTime();
      const dtB = new Date(`${b.appointmentDate}T${b.appointmentTime}`).getTime();
      return dtA - dtB;
    });

    return list;
  } catch (err) {
    console.error("Error getting patient follow-ups:", err);
    return [];
  }
}

// Real-time subscriber for patient follow-up appointments by phone or patientId
export function subscribeToPatientFollowUps(
  queryTarget: string | { phone?: string; patientId?: string },
  callback: (appointments: FollowUpAppointment[]) => void
) {
  let cleanPhone = '';
  let targetPid = '';

  if (typeof queryTarget === 'string') {
    const trimmed = queryTarget.trim();
    if (trimmed.startsWith('PID-')) {
      targetPid = trimmed;
    } else {
      cleanPhone = trimmed;
    }
  } else if (queryTarget) {
    cleanPhone = (queryTarget.phone || '').trim();
    targetPid = (queryTarget.patientId || '').trim();
  }

  if (!cleanPhone && !targetPid) {
    callback([]);
    return () => {};
  }

  const phoneMap = new Map<string, FollowUpAppointment>();
  const pidMap = new Map<string, FollowUpAppointment>();

  const emitCombined = () => {
    const combined = new Map<string, FollowUpAppointment>();
    phoneMap.forEach((val, key) => combined.set(key, val));
    pidMap.forEach((val, key) => combined.set(key, val));
    const list = Array.from(combined.values());
    list.sort((a, b) => {
      const dtA = new Date(`${a.appointmentDate}T${a.appointmentTime}`).getTime();
      const dtB = new Date(`${b.appointmentDate}T${b.appointmentTime}`).getTime();
      return dtA - dtB;
    });
    callback(list);
  };

  const unsubs: (() => void)[] = [];

  if (cleanPhone) {
    const qPhone = query(
      collection(db, "followUpAppointments"),
      where("patientPhone", "==", cleanPhone)
    );
    const unsubPhone = onSnapshot(
      qPhone,
      (snapshot) => {
        phoneMap.clear();
        snapshot.forEach((d) => {
          phoneMap.set(d.id, { id: d.id, ...d.data() } as FollowUpAppointment);
        });
        emitCombined();
      },
      (err) => {
        console.error("Error subscribing to phone follow-ups:", err);
      }
    );
    unsubs.push(unsubPhone);
  }

  if (targetPid) {
    const qPid = query(
      collection(db, "followUpAppointments"),
      where("patientId", "==", targetPid)
    );
    const unsubPid = onSnapshot(
      qPid,
      (snapshot) => {
        pidMap.clear();
        snapshot.forEach((d) => {
          pidMap.set(d.id, { id: d.id, ...d.data() } as FollowUpAppointment);
        });
        emitCombined();
      },
      (err) => {
        console.error("Error subscribing to PID follow-ups:", err);
      }
    );
    unsubs.push(unsubPid);
  }

  return () => {
    unsubs.forEach(unsub => unsub());
  };
}

// Update follow-up appointment status (Doctor / Patient)
export async function updateFollowUpAppointmentStatus(
  appointmentId: string,
  status: FollowUpAppointmentStatus
): Promise<void> {
  const docRef = doc(db, "followUpAppointments", appointmentId);
  await updateDoc(docRef, {
    appointmentStatus: status,
    updatedAt: new Date().toISOString()
  });
}

// Update full follow-up appointment details (Doctor)
export async function updateFollowUpAppointment(
  appointmentId: string,
  updates: Partial<FollowUpAppointment>
): Promise<void> {
  if (updates.appointmentDate && updates.appointmentTime) {
    if (isDateTimeInPast(updates.appointmentDate, updates.appointmentTime)) {
      throw new Error("لا يمكن تعديل الموعد إلى تاريخ أو وقت في الماضي");
    }
  }

  if (updates.patientPhone) {
    const phoneValidation = validatePatientPhoneNumber(updates.patientPhone);
    if (!phoneValidation.isValid) {
      throw new Error(phoneValidation.error || "رقم الهاتف يجب أن يكون من 10 إلى 11 رقمًا.");
    }
    updates.patientPhone = phoneValidation.cleanPhone;
  }

  const docRef = doc(db, "followUpAppointments", appointmentId);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: new Date().toISOString()
  });
}

// Patient requests a reschedule
export async function requestRescheduleFollowUp(
  appointmentId: string,
  newDate: string,
  newTime: string
): Promise<void> {
  if (isDateTimeInPast(newDate, newTime)) {
    throw new Error("التاريخ والوقت المقترحان يجب أن يكونا في المستقبل");
  }

  const docRef = doc(db, "followUpAppointments", appointmentId);
  await updateDoc(docRef, {
    rescheduleRequested: true,
    requestedNewDate: newDate,
    requestedNewTime: newTime,
    updatedAt: new Date().toISOString()
  });
}

// =========================================================
// CLINIC ORGANIZATION, MEMBERSHIP & PERMISSIONS API
// =========================================================

// Get active clinic member record for current authenticated user
export async function getUserClinicMember(user: any): Promise<{ member: ClinicMember | null; isPrimaryOwner: boolean }> {
  if (!user || !user.uid) return { member: null, isPrimaryOwner: false };

  try {
    // 1. Direct check by UID
    const memberDocRef = doc(db, "clinic_members", user.uid);
    const memberSnap = await getDoc(memberDocRef);

    if (memberSnap.exists()) {
      const data = memberSnap.data() as ClinicMember;
      if (data.status === 'invited') {
        return { member: null, isPrimaryOwner: false };
      }
      return { member: data, isPrimaryOwner: data.role === 'OWNER' };
    }

    // 2. Fallback check: Is user an existing Doctor profile owner?
    const docRef = doc(db, "doctors", user.uid);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const docData = docSnap.data();
      const ownerMember: ClinicMember = {
        id: user.uid,
        uid: user.uid,
        organizationId: user.uid,
        role: 'OWNER',
        displayName: docData.name || user.displayName || user.email || "مالك العيادة",
        email: user.email ? user.email.toLowerCase().trim() : "",
        status: 'active',
        createdAt: docData.createdAt || new Date().toISOString()
      };

      // Bootstrap clinic member document for smooth sync
      try {
        await setDoc(doc(db, "clinic_members", user.uid), ownerMember, { merge: true });
        await setDoc(doc(db, `organizations/${user.uid}/members`, user.uid), ownerMember, { merge: true });
        await setDoc(doc(db, "organizations", user.uid), {
          organizationId: user.uid,
          clinicName: docData.clinicName || "العيادة",
          ownerUid: user.uid,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } catch (e) {
        console.warn("Auto-bootstrap member doc error:", e);
      }

      return { member: ownerMember, isPrimaryOwner: true };
    }

    return { member: null, isPrimaryOwner: false };
  } catch (err) {
    console.error("Error fetching user clinic member info:", err);
    return { member: null, isPrimaryOwner: false };
  }
}

// Real-time subscription to clinic members list
export function subscribeToClinicMembers(
  organizationId: string,
  callback: (members: ClinicMember[]) => void
): () => void {
  if (!organizationId) {
    callback([]);
    return () => {};
  }

  const q = query(
    collection(db, "clinic_members"),
    where("organizationId", "==", organizationId)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const members: ClinicMember[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as ClinicMember;
        // Do not include unaccepted invitations in members list
        if (data.status === 'invited') return;
        members.push({ id: docSnap.id, ...data });
      });

      // Sort: OWNER first, then DOCTOR, SECRETARY, STAFF
      const roleOrder: Record<string, number> = { OWNER: 1, DOCTOR: 2, SECRETARY: 3, STAFF: 4 };
      members.sort((a, b) => (roleOrder[a.role] || 5) - (roleOrder[b.role] || 5));

      callback(members);
    },
    (err) => {
      console.error("Error subscribing to clinic members:", err);
      callback([]);
    }
  );
}

// Create secure clinic invitation
export async function createClinicInvitation(
  actorMember: ClinicMember,
  clinicName: string,
  data: {
    displayName: string;
    email: string;
    role: ClinicRole;
    customPermissions?: ClinicPermission[];
  }
): Promise<ClinicInvitation> {
  const cleanEmail = data.email.toLowerCase().trim();
  const orgId = actorMember.organizationId;

  if (!cleanEmail) throw new Error("يرجى إدخال البريد الإلكتروني للموظف");
  if (!data.displayName.trim()) throw new Error("يرجى إدخال اسم الموظف");
  if (data.role === 'OWNER') throw new Error("لا يمكن إرسال دعوة بدور المالك");

  // SERVER-SIDE DUPLICATE CHECKS (BUG #3)
  
  // 1. Check existing members in clinic_members for same org + email
  const membersQuery = query(
    collection(db, "clinic_members"),
    where("organizationId", "==", orgId)
  );
  const membersSnap = await getDocs(membersQuery);
  const existingMember = membersSnap.docs
    .map(d => d.data() as ClinicMember)
    .find(m => m.email && m.email.toLowerCase().trim() === cleanEmail && m.status !== 'invited');

  if (existingMember) {
    if (existingMember.status === 'active') {
      throw new Error(`البريد الإلكتروني (${cleanEmail}) ينتمي لعضو نشط بالفعل في العيادة.`);
    }
    if (existingMember.status === 'disabled') {
      throw new Error(`البريد الإلكتروني (${cleanEmail}) ينتمي لعضو معطل في العيادة. يمكنك إعادة تفعيل حسابه من قائمة الأعضاء بدلاً من إرسال دعوة جديدة.`);
    }
  }

  // 2. Check existing pending invitations in clinic_invitations for same org + email
  const invQuery = query(
    collection(db, "clinic_invitations"),
    where("organizationId", "==", orgId)
  );
  const invSnap = await getDocs(invQuery);
  const now = new Date();
  
  const existingPendingInv = invSnap.docs
    .map(d => ({ id: d.id, ...d.data() } as ClinicInvitation))
    .find(inv => {
      const invEmail = inv.invitedEmail ? inv.invitedEmail.toLowerCase().trim() : '';
      if (invEmail !== cleanEmail) return false;
      if (inv.status === 'pending') {
        const isExpired = inv.expiresAt && new Date(inv.expiresAt) < now;
        return !isExpired;
      }
      return false;
    });

  if (existingPendingInv) {
    throw new Error(`توجد دعوة معلقة بالفعل لهذا البريد الإلكتروني (${cleanEmail}). يمكنك نسخ رابط الدعوة الحالية أو إلغاؤها قبل إرسال دعوة جديدة.`);
  }

  const existingAcceptedInv = invSnap.docs
    .map(d => ({ id: d.id, ...d.data() } as ClinicInvitation))
    .find(inv => {
      const invEmail = inv.invitedEmail ? inv.invitedEmail.toLowerCase().trim() : '';
      return invEmail === cleanEmail && inv.status === 'accepted';
    });

  if (existingAcceptedInv && existingMember) {
    throw new Error(`هذا البريد الإلكتروني ينتمي لعضو في العيادة بالفعل.`);
  }

  // Generate invitation token
  const token = `inv_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const invitation: ClinicInvitation = {
    id: token,
    organizationId: orgId,
    clinicName: clinicName || "العيادة",
    invitedEmail: cleanEmail,
    invitedName: data.displayName.trim(),
    role: data.role,
    customPermissions: data.customPermissions || [],
    status: 'pending',
    createdAt: new Date().toISOString(),
    expiresAt,
    invitedBy: actorMember.uid,
    invitedByName: actorMember.displayName
  };

  // Store ONLY in clinic_invitations! (Do NOT create unaccepted clinic_members doc)
  await setDoc(doc(db, "clinic_invitations", token), invitation);

  await logClinicAction({
    organizationId: orgId,
    actorUid: actorMember.uid,
    actorName: actorMember.displayName,
    action: 'member_invited',
    targetUid: token,
    targetEmail: cleanEmail,
    targetName: data.displayName.trim(),
    details: `تم إنشاء دعوة انضمام بدور ${data.role}`
  });

  return invitation;
}

// Get Clinic Invitation by token/ID
export async function getClinicInvitation(invitationId: string): Promise<ClinicInvitation | null> {
  if (!invitationId) return null;
  try {
    const snap = await getDoc(doc(db, "clinic_invitations", invitationId));
    if (!snap.exists()) return null;
    const inv = snap.data() as ClinicInvitation;

    // Check if expired dynamically
    if (inv.status === 'pending' && inv.expiresAt && new Date(inv.expiresAt) < new Date()) {
      return { ...inv, status: 'expired' };
    }

    return inv;
  } catch (err) {
    console.error("Error fetching invitation:", err);
    return null;
  }
}

// Accept Clinic Invitation
export async function acceptClinicInvitation(
  invitationId: string,
  currentUser: { uid: string; email: string; displayName?: string }
): Promise<ClinicMember> {
  if (!invitationId) throw new Error("معرّف الدعوة غير صالح");
  if (!currentUser || !currentUser.uid || !currentUser.email) {
    throw new Error("يرجى تسجيل الدخول أولاً لقبول الدعوة");
  }

  const invitationRef = doc(db, "clinic_invitations", invitationId);
  const snap = await getDoc(invitationRef);
  if (!snap.exists()) throw new Error("الدعوة غير موجودة أو تم حذفها");

  const invitation = snap.data() as ClinicInvitation;

  if (invitation.status === 'accepted') {
    throw new Error("تم قبول هذه الدعوة سابقاً");
  }
  if (invitation.status === 'revoked') {
    throw new Error("تم إلغاء هذه الدعوة من قبل إدارة العيادة");
  }
  if (invitation.expiresAt && new Date(invitation.expiresAt) < new Date()) {
    throw new Error("عفواً، انتهت صلاحية هذه الدعوة");
  }

  const cleanUserEmail = currentUser.email.toLowerCase().trim();
  const cleanInvitedEmail = invitation.invitedEmail.toLowerCase().trim();

  if (cleanUserEmail !== cleanInvitedEmail) {
    throw new Error(`حسابك الحالي (${cleanUserEmail}) لا يطابق البريد الإلكتروني المدعو (${cleanInvitedEmail}). يرجى تسجيل الدخول بالبريد الإلكتروني الصحيح.`);
  }

  if (invitation.role === 'OWNER') {
    throw new Error("غير مسموح بإنشاء حساب مالك عبر الدعوات العادية");
  }

  const newMember: ClinicMember = {
    id: currentUser.uid,
    uid: currentUser.uid,
    organizationId: invitation.organizationId,
    role: invitation.role,
    displayName: currentUser.displayName || invitation.invitedName || currentUser.email,
    email: cleanUserEmail,
    status: 'active',
    createdAt: new Date().toISOString(),
    invitedBy: invitation.invitedBy,
    customPermissions: invitation.customPermissions || []
  };

  // 1. Create active member documents securely
  await setDoc(doc(db, "clinic_members", currentUser.uid), newMember);
  await setDoc(doc(db, `organizations/${invitation.organizationId}/members`, currentUser.uid), newMember);

  // 2. Mark invitation document as accepted
  await updateDoc(invitationRef, {
    status: 'accepted',
    acceptedByUid: currentUser.uid,
    acceptedAt: new Date().toISOString()
  });

  // 3. Clean up temp doc ID if present
  const tempDocId = `${invitation.organizationId}_${cleanUserEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
  try {
    await deleteDoc(doc(db, "clinic_members", tempDocId));
    await deleteDoc(doc(db, `organizations/${invitation.organizationId}/members`, tempDocId));
  } catch (e) { /* ignore */ }

  // 4. Audit Log
  await logClinicAction({
    organizationId: invitation.organizationId,
    actorUid: currentUser.uid,
    actorName: newMember.displayName,
    action: 'invitation_accepted',
    targetUid: currentUser.uid,
    targetEmail: cleanUserEmail,
    targetName: newMember.displayName,
    details: `تم قبول الدعوة والانضمام للعيادة بدور ${invitation.role}`
  });

  return newMember;
}

// Revoke a pending invitation
export async function revokeClinicInvitation(
  actorMember: ClinicMember,
  invitationId: string
): Promise<void> {
  const orgId = actorMember.organizationId;
  const invitationRef = doc(db, "clinic_invitations", invitationId);
  const snap = await getDoc(invitationRef);
  if (!snap.exists()) throw new Error("الدعوة غير موجودة");

  const inv = snap.data() as ClinicInvitation;

  await updateDoc(invitationRef, {
    status: 'revoked',
    updatedAt: new Date().toISOString()
  });

  const tempDocId = `${orgId}_${inv.invitedEmail.toLowerCase().trim().replace(/[^a-zA-Z0-9]/g, '_')}`;
  try {
    await deleteDoc(doc(db, "clinic_members", tempDocId));
    await deleteDoc(doc(db, `organizations/${orgId}/members`, tempDocId));
  } catch (e) { /* ignore */ }

  await logClinicAction({
    organizationId: orgId,
    actorUid: actorMember.uid,
    actorName: actorMember.displayName,
    action: 'invitation_revoked',
    targetUid: invitationId,
    targetEmail: inv.invitedEmail,
    targetName: inv.invitedName,
    details: `تم إلغاء دعوة الانضمام`
  });
}

// Real-time subscription to pending clinic invitations
export function subscribeToPendingInvitations(
  organizationId: string,
  callback: (invitations: ClinicInvitation[]) => void
): () => void {
  if (!organizationId) {
    callback([]);
    return () => {};
  }

  const q = query(
    collection(db, "clinic_invitations"),
    where("organizationId", "==", organizationId)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const invitations: ClinicInvitation[] = [];
      const now = new Date();
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as ClinicInvitation;
        let status = data.status;
        if (status === 'pending' && data.expiresAt && new Date(data.expiresAt) < now) {
          status = 'expired';
        }
        invitations.push({ ...data, id: docSnap.id, status });
      });

      invitations.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      callback(invitations);
    },
    (err) => {
      console.error("Error subscribing to invitations:", err);
      callback([]);
    }
  );
}

// Add/Invite a new clinic member
export async function inviteClinicMember(
  actorMember: ClinicMember,
  data: {
    displayName: string;
    email: string;
    role: ClinicRole;
    customPermissions?: ClinicPermission[];
  },
  clinicName?: string
): Promise<ClinicInvitation> {
  return createClinicInvitation(actorMember, clinicName || "العيادة", data);
}

// Update member role
export async function updateClinicMemberRole(
  actorMember: ClinicMember,
  targetMemberId: string,
  newRole: ClinicRole
): Promise<void> {
  const orgId = actorMember.organizationId;

  const targetDocRef = doc(db, "clinic_members", targetMemberId);
  const targetSnap = await getDoc(targetDocRef);
  if (!targetSnap.exists()) throw new Error("العضو غير موجود");

  const targetData = targetSnap.data() as ClinicMember;

  if (targetData.role === 'OWNER' && newRole !== 'OWNER' && targetMemberId === actorMember.uid) {
    throw new Error("لا يمكنك إلغاء صلاحية المالك عن نفسك بنفسك");
  }

  const updates = {
    role: newRole,
    updatedAt: new Date().toISOString()
  };

  await updateDoc(targetDocRef, updates);
  try {
    await updateDoc(doc(db, `organizations/${orgId}/members`, targetMemberId), updates);
  } catch (e) { /* ignore */ }

  await logClinicAction({
    organizationId: orgId,
    actorUid: actorMember.uid,
    actorName: actorMember.displayName,
    action: 'role_changed',
    targetUid: targetMemberId,
    targetEmail: targetData.email,
    targetName: targetData.displayName,
    details: `تغيير الدور من ${targetData.role} إلى ${newRole}`
  });
}

// Update member custom permissions
export async function updateClinicMemberPermissions(
  actorMember: ClinicMember,
  targetMemberId: string,
  customPermissions: ClinicPermission[]
): Promise<void> {
  const orgId = actorMember.organizationId;

  const targetDocRef = doc(db, "clinic_members", targetMemberId);
  const targetSnap = await getDoc(targetDocRef);
  if (!targetSnap.exists()) throw new Error("العضو غير موجود");

  const targetData = targetSnap.data() as ClinicMember;

  if (targetMemberId === actorMember.uid && targetData.role === 'OWNER') {
    throw new Error("مالك العيادة يملك جميع الصلاحيات دائماً بشكل تلقائي");
  }

  const updates = {
    customPermissions,
    updatedAt: new Date().toISOString()
  };

  await updateDoc(targetDocRef, updates);
  try {
    await updateDoc(doc(db, `organizations/${orgId}/members`, targetMemberId), updates);
  } catch (e) { /* ignore */ }

  await logClinicAction({
    organizationId: orgId,
    actorUid: actorMember.uid,
    actorName: actorMember.displayName,
    action: 'permission_updated',
    targetUid: targetMemberId,
    targetEmail: targetData.email,
    targetName: targetData.displayName,
    details: `تم تحديث الصلاحيات المخصصة للعضو (${customPermissions.length} صلاحيات مفعلة)`
  });
}


// Enable / Disable a member
export async function setClinicMemberStatus(
  actorMember: ClinicMember,
  targetMemberId: string,
  newStatus: 'active' | 'disabled'
): Promise<void> {
  const orgId = actorMember.organizationId;

  if (targetMemberId === actorMember.uid && newStatus === 'disabled') {
    throw new Error("لا يمكنك تعطيل حسابك الشخصي");
  }

  const targetDocRef = doc(db, "clinic_members", targetMemberId);
  const targetSnap = await getDoc(targetDocRef);
  if (!targetSnap.exists()) throw new Error("العضو غير موجود");

  const targetData = targetSnap.data() as ClinicMember;

  // Prevent activating unaccepted pending invitations
  if (targetData.status === 'invited') {
    throw new Error("لا يمكن تفعيل عضو لم يقم بقبول الدعوة بعد. يجب على الموظف قبول الدعوة أولاً.");
  }

  const updates = {
    status: newStatus,
    updatedAt: new Date().toISOString()
  };

  await updateDoc(targetDocRef, updates);
  try {
    await updateDoc(doc(db, `organizations/${orgId}/members`, targetMemberId), updates);
  } catch (e) { /* ignore */ }

  await logClinicAction({
    organizationId: orgId,
    actorUid: actorMember.uid,
    actorName: actorMember.displayName,
    action: newStatus === 'disabled' ? 'member_disabled' : 'member_enabled',
    targetUid: targetMemberId,
    targetEmail: targetData.email,
    targetName: targetData.displayName,
    details: newStatus === 'disabled' ? 'تم تعطيل صلاحيات وصول العضو' : 'تم إعادة تفعيل العضو'
  });
}

// Remove member completely
export async function removeClinicMember(
  actorMember: ClinicMember,
  targetMemberId: string
): Promise<void> {
  const orgId = actorMember.organizationId;

  if (targetMemberId === actorMember.uid) {
    throw new Error("لا يمكنك حذف حسابك الخاص بصفتك مالك العيادة");
  }

  const targetDocRef = doc(db, "clinic_members", targetMemberId);
  const targetSnap = await getDoc(targetDocRef);
  const targetData = targetSnap.exists() ? (targetSnap.data() as ClinicMember) : null;

  // 1. Delete main member document
  await deleteDoc(targetDocRef);
  try {
    await deleteDoc(doc(db, `organizations/${orgId}/members`, targetMemberId));
  } catch (e) { /* ignore */ }

  // 2. Clean up any invitations or temp records for this email in this organization
  if (targetData?.email) {
    const cleanEmail = targetData.email.toLowerCase().trim();

    try {
      const invQ = query(
        collection(db, "clinic_invitations"),
        where("organizationId", "==", orgId)
      );
      const invSnap = await getDocs(invQ);
      for (const invDoc of invSnap.docs) {
        const inv = invDoc.data() as ClinicInvitation;
        if (inv.invitedEmail && inv.invitedEmail.toLowerCase().trim() === cleanEmail) {
          await deleteDoc(doc(db, "clinic_invitations", invDoc.id));
        }
      }
    } catch (e) {
      console.warn("Error cleaning up invitations on member removal:", e);
    }

    const tempDocId = `${orgId}_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
    try {
      await deleteDoc(doc(db, "clinic_members", tempDocId));
      await deleteDoc(doc(db, `organizations/${orgId}/members`, tempDocId));
    } catch (e) { /* ignore */ }
  }

  // 3. Write audit log
  await logClinicAction({
    organizationId: orgId,
    actorUid: actorMember.uid,
    actorName: actorMember.displayName,
    action: 'member_removed',
    targetUid: targetMemberId,
    targetEmail: targetData?.email,
    targetName: targetData?.displayName,
    details: 'تم حذف العضو وسحب كافة صلاحيات وصول العيادة'
  });
}

// Internal Audit Logger
export async function logClinicAction(params: {
  organizationId: string;
  actorUid: string;
  actorName?: string;
  action: ClinicAuditLog['action'];
  targetUid: string;
  targetEmail?: string;
  targetName?: string;
  details?: string;
}): Promise<void> {
  try {
    const logId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const logData: ClinicAuditLog = {
      id: logId,
      organizationId: params.organizationId,
      actorUid: params.actorUid,
      actorName: params.actorName || "",
      action: params.action,
      targetUid: params.targetUid,
      targetEmail: params.targetEmail || "",
      targetName: params.targetName || "",
      details: params.details || "",
      timestamp: new Date().toISOString()
    };

    await setDoc(doc(db, `organizations/${params.organizationId}/audit_logs`, logId), logData);
  } catch (err) {
    console.warn("Failed to write clinic audit log:", err);
  }
}

// Fetch Audit Logs for Clinic Organization
export async function getClinicAuditLogs(organizationId: string): Promise<ClinicAuditLog[]> {
  if (!organizationId) return [];

  try {
    const q = query(
      collection(db, `organizations/${organizationId}/audit_logs`),
      orderBy("timestamp", "desc"),
      limit(50)
    );
    const snap = await getDocs(q);
    const logs: ClinicAuditLog[] = [];
    snap.forEach((docSnap) => {
      logs.push({ id: docSnap.id, ...docSnap.data() } as ClinicAuditLog);
    });
    return logs;
  } catch (err) {
    console.error("Error fetching audit logs:", err);
    return [];
  }
}

// ==========================================
// CLINIC FINANCE SYSTEM SERVICES
// ==========================================

// --- Services & Pricing ---

export function subscribeToClinicServices(
  organizationId: string,
  callback: (services: ClinicService[]) => void
): () => void {
  if (!organizationId) {
    callback([]);
    return () => {};
  }

  const servicesRef = collection(db, `organizations/${organizationId}/services`);
  return onSnapshot(
    servicesRef,
    (snapshot) => {
      const list: ClinicService[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as ClinicService);
      });
      // Sort active first then by name
      list.sort((a, b) => {
        if (a.active !== b.active) return a.active ? -1 : 1;
        return a.name.localeCompare(b.name, "ar");
      });
      callback(list);
    },
    (error) => {
      console.error("Error subscribing to services:", error);
      callback([]);
    }
  );
}

// Cache for clinic services (5 min TTL)
const clinicServicesCache = new Map<string, { data: ClinicService[]; timestamp: number }>();

export async function getClinicServicesPublic(organizationId: string): Promise<ClinicService[]> {
  try {
    const cached = clinicServicesCache.get(organizationId);
    if (cached && Date.now() - cached.timestamp < 300000) {
      return cached.data;
    }

    const srvRef = collection(db, `organizations/${organizationId}/services`);
    const snap = await getDocs(query(srvRef, where("active", "==", true)));
    const list: ClinicService[] = [];
    snap.forEach((docSnap) => {
      list.push({ id: docSnap.id, ...docSnap.data() } as ClinicService);
    });

    clinicServicesCache.set(organizationId, { data: list, timestamp: Date.now() });
    return list;
  } catch (err) {
    console.error("Error fetching public clinic services:", err);
    return [];
  }
}

export async function createClinicService(
  actorMember: ClinicMember | null,
  isOwnerFallback: boolean,
  data: {
    organizationId: string;
    name: string;
    description?: string;
    price: number;
  }
): Promise<ClinicService> {
  const orgId = data.organizationId;
  if (!hasPermission(actorMember, 'EDIT_PRICES', isOwnerFallback)) {
    throw new Error("لا تملك صلاحية إضافة أو تعديل أسعار الخدمات.");
  }

  if (!data.name.trim()) throw new Error("يرجى إدخال اسم الخدمة.");
  if (data.price < 0 || isNaN(data.price)) throw new Error("يرجى إدخال سعر صحيح للخدمة.");

  const serviceId = `srv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const actorUid = actorMember ? actorMember.uid : orgId;

  const newService: ClinicService = {
    id: serviceId,
    organizationId: orgId,
    name: data.name.trim(),
    description: data.description?.trim() || "",
    price: Number(data.price),
    active: true,
    createdAt: new Date().toISOString(),
    createdBy: actorUid
  };

  await setDoc(doc(db, `organizations/${orgId}/services`, serviceId), newService);

  await logClinicAction({
    organizationId: orgId,
    actorUid,
    actorName: actorMember?.displayName || "مالك العيادة",
    action: 'service_created',
    targetUid: serviceId,
    targetName: data.name,
    details: `تم إضافة خدمة جديدة (${data.name}) بسعر ${data.price} ج`
  });

  return newService;
}

export async function updateClinicService(
  actorMember: ClinicMember | null,
  isOwnerFallback: boolean,
  serviceId: string,
  organizationId: string,
  updates: Partial<{
    name: string;
    description: string;
    price: number;
    active: boolean;
  }>
): Promise<void> {
  if (!hasPermission(actorMember, 'EDIT_PRICES', isOwnerFallback)) {
    throw new Error("لا تملك صلاحية تعديل أسعار الخدمات.");
  }

  const srvRef = doc(db, `organizations/${organizationId}/services`, serviceId);
  const srvSnap = await getDoc(srvRef);
  if (!srvSnap.exists()) throw new Error("الخدمة غير موجودة.");

  const oldData = srvSnap.data() as ClinicService;
  const isPriceChanged = updates.price !== undefined && updates.price !== oldData.price;

  const payload: Partial<ClinicService> = {
    ...updates,
    updatedAt: new Date().toISOString()
  };

  await updateDoc(srvRef, payload);

  const actorUid = actorMember ? actorMember.uid : organizationId;
  await logClinicAction({
    organizationId,
    actorUid,
    actorName: actorMember?.displayName || "مالك العيادة",
    action: isPriceChanged ? 'service_price_changed' : 'service_updated',
    targetUid: serviceId,
    targetName: updates.name || oldData.name,
    details: isPriceChanged
      ? `تغيير سعر الخدمة (${oldData.name}) من ${oldData.price} ج إلى ${updates.price} ج`
      : `تحديث بيانات الخدمة (${oldData.name})`
  });
}

export async function seedDefaultServicesIfEmpty(
  organizationId: string,
  currentDoctor?: DoctorProfile
): Promise<void> {
  if (!organizationId) return;

  try {
    const servicesRef = collection(db, `organizations/${organizationId}/services`);
    const snap = await getDocs(servicesRef);
    if (!snap.empty) return; // Services already initialized

    // Seed defaults or profile services
    const defaultList: { name: string; price: number }[] = [];

    if (currentDoctor?.servicesAndPrices && currentDoctor.servicesAndPrices.length > 0) {
      currentDoctor.servicesAndPrices.forEach((sp) => {
        const numPrice = parseFloat(sp.price.replace(/[^0-9.]/g, "")) || 200;
        defaultList.push({ name: sp.serviceName, price: numPrice });
      });
    } else {
      defaultList.push(
        { name: "كشف أطفال", price: 300 },
        { name: "كشف باطنة", price: 350 },
        { name: "متابعة", price: 200 },
        { name: "استشارة", price: 150 }
      );
    }

    for (const item of defaultList) {
      const srvId = `srv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const newSrv: ClinicService = {
        id: srvId,
        organizationId,
        name: item.name,
        description: "خدمة طبية في العيادة",
        price: item.price,
        active: true,
        createdAt: new Date().toISOString(),
        createdBy: organizationId
      };
      await setDoc(doc(db, `organizations/${organizationId}/services`, srvId), newSrv);
    }
  } catch (err) {
    console.warn("Error seeding default services:", err);
  }
}

// --- Transactions & Payments ---

export function subscribeToClinicTransactions(
  organizationId: string,
  callback: (transactions: ClinicTransaction[]) => void
): () => void {
  if (!organizationId) {
    callback([]);
    return () => {};
  }

  const txRef = collection(db, `organizations/${organizationId}/transactions`);
  const q = query(txRef, orderBy("createdAt", "desc"), limit(200));

  return onSnapshot(
    q,
    (snapshot) => {
      const list: ClinicTransaction[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as ClinicTransaction);
      });
      callback(list);
    },
    (error) => {
      console.error("Error subscribing to transactions:", error);
      callback([]);
    }
  );
}

/**
 * Highly scoped patient transactions listener (reduces reads significantly compared to querying all clinic transactions)
 */
export function subscribeToPatientTransactions(
  organizationId: string,
  patientPhone: string,
  callback: (transactions: ClinicTransaction[]) => void
): () => void {
  if (!organizationId || !patientPhone) {
    callback([]);
    return () => {};
  }

  const clean = normalizePhoneNumber(patientPhone);
  const txRef = collection(db, `organizations/${organizationId}/transactions`);
  const phonesToMatch = Array.from(new Set([patientPhone, clean].filter(Boolean)));
  const q = query(
    txRef,
    where("patientPhone", "in", phonesToMatch.slice(0, 10)),
    limit(30)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const list: ClinicTransaction[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as ClinicTransaction);
      });
      list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      callback(list);
    },
    () => {
      // Fallback in case composite index is not deployed: fetch bounded recent transactions and filter locally
      const fallbackQ = query(txRef, orderBy("createdAt", "desc"), limit(50));
      return onSnapshot(
        fallbackQ,
        (snap) => {
          const list: ClinicTransaction[] = [];
          snap.forEach((docSnap) => {
            const tx = { id: docSnap.id, ...docSnap.data() } as ClinicTransaction;
            if (tx.patientPhone && (tx.patientPhone === patientPhone || normalizePhoneNumber(tx.patientPhone) === clean)) {
              list.push(tx);
            }
          });
          callback(list);
        },
        () => callback([])
      );
    }
  );
}

export async function createClinicTransaction(
  actorMember: ClinicMember | null,
  isOwnerFallback: boolean,
  data: {
    organizationId: string;
    patientId?: string;
    patientName: string;
    patientPhone?: string;
    appointmentId?: string;
    serviceId?: string;
    serviceName: string;
    totalAmount: number;
    paidAmount: number;
    paymentMethod: PaymentMethod;
    dailySessionId?: string;
    notes?: string;
  }
): Promise<ClinicTransaction> {
  const orgId = data.organizationId;
  if (!hasPermission(actorMember, 'MANAGE_FINANCE', isOwnerFallback)) {
    throw new Error("لا تملك صلاحية تسجيل أو إدارة المدفوعات.");
  }

  if (!data.patientName.trim()) throw new Error("يرجى إدخال اسم المريض.");
  if (!data.serviceName.trim()) throw new Error("يرجى اختيار أو كتابة الخدمة المقدمة.");
  if (data.totalAmount < 0 || isNaN(data.totalAmount)) throw new Error("يرجى إدخال إجمالي مبلغ الخدمة بشكل صحيح.");
  if (data.paidAmount < 0 || isNaN(data.paidAmount)) throw new Error("يرجى إدخال المبلغ المدفوع بشكل صحيح.");
  
  if (data.paidAmount > data.totalAmount) {
    throw new Error("المبلغ المدفوع أكبر من قيمة الخدمة الإجمالية.");
  }

  const totalAmount = Number(data.totalAmount);
  const paidAmount = Number(data.paidAmount);
  const remainingAmount = Math.max(0, totalAmount - paidAmount);

  let paymentStatus: PaymentStatus = 'UNPAID';
  if (paidAmount >= totalAmount && totalAmount > 0) {
    paymentStatus = 'PAID';
  } else if (paidAmount > 0) {
    paymentStatus = 'PARTIAL';
  }

  const txId = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const actorUid = actorMember ? actorMember.uid : orgId;
  const actorName = actorMember ? actorMember.displayName : "مالك العيادة";

  const newTx: ClinicTransaction = {
    id: txId,
    organizationId: orgId,
    dailySessionId: data.dailySessionId || "",
    patientId: data.patientId || "",
    patientName: data.patientName.trim(),
    patientPhone: data.patientPhone?.trim() || "",
    appointmentId: data.appointmentId || "",
    serviceId: data.serviceId || "",
    serviceName: data.serviceName.trim(),
    totalAmount,
    paidAmount,
    remainingAmount,
    paymentStatus,
    paymentMethod: data.paymentMethod,
    notes: data.notes?.trim() || "",
    createdBy: actorUid,
    createdByName: actorName,
    createdAt: new Date().toISOString()
  };

  await setDoc(doc(db, `organizations/${orgId}/transactions`, txId), newTx);

  // Write-time aggregation: update active daily session financial metrics
  try {
    const today = getTodayDateString();
    const sessionRef = doc(db, "doctors", orgId, "dailySessions", today);
    const snap = await getDoc(sessionRef);
    if (snap.exists()) {
      const sData = snap.data() as DailySession;
      const pb = sData.paymentBreakdown || { cash: 0, card: 0, transfer: 0, other: 0 };
      if (data.paymentMethod === 'CASH') pb.cash = (pb.cash || 0) + paidAmount;
      else if (data.paymentMethod === 'CARD') pb.card = (pb.card || 0) + paidAmount;
      else if (data.paymentMethod === 'BANK_TRANSFER') pb.transfer = (pb.transfer || 0) + paidAmount;
      else pb.other = (pb.other || 0) + paidAmount;

      const sb = sData.serviceBreakdown || {};
      const sKey = newTx.serviceName || "خدمة";
      if (!sb[sKey]) sb[sKey] = { count: 0, revenue: 0 };
      sb[sKey].count += 1;
      sb[sKey].revenue += paidAmount;

      await updateDoc(sessionRef, {
        totalRevenue: (sData.totalRevenue || 0) + totalAmount,
        totalCollected: (sData.totalCollected || 0) + paidAmount,
        outstandingBalance: (sData.outstandingBalance || 0) + remainingAmount,
        paymentBreakdown: pb,
        serviceBreakdown: sb
      });
    }
  } catch (err) {
    console.warn("Could not update daily session for transaction:", err);
  }

  await logClinicAction({
    organizationId: orgId,
    actorUid,
    actorName,
    action: 'payment_created',
    targetUid: txId,
    targetName: data.patientName,
    details: `تسجيل معاملة دَفْع جديدة للمريض (${data.patientName}) بقيمة مدفوعة ${paidAmount} ج من إجمالي ${totalAmount} ج (${paymentStatus})`
  });

  return newTx;
}

export async function recordAdditionalPayment(
  actorMember: ClinicMember | null,
  isOwnerFallback: boolean,
  organizationId: string,
  transactionId: string,
  additionalAmount: number,
  paymentMethod: PaymentMethod,
  notes?: string
): Promise<void> {
  if (!hasPermission(actorMember, 'MANAGE_FINANCE', isOwnerFallback)) {
    throw new Error("لا تملك صلاحية تسديد المبالغ المستحقة.");
  }

  const txRef = doc(db, `organizations/${organizationId}/transactions`, transactionId);
  const txSnap = await getDoc(txRef);
  if (!txSnap.exists()) throw new Error("المعاملة غير موجودة.");

  const txData = txSnap.data() as ClinicTransaction;

  if (txData.paymentStatus === 'REFUNDED') {
    throw new Error("لا يمكن إضافة دفعات لمعاملة تم استرداد أموالها.");
  }

  if (additionalAmount <= 0 || isNaN(additionalAmount)) {
    throw new Error("يرجى إدخال مبلغ دفع صحيح.");
  }

  if (additionalAmount > txData.remainingAmount) {
    throw new Error(`المبلغ المدفوع (${additionalAmount} ج) أكبر من المتبقي المستحق (${txData.remainingAmount} ج).`);
  }

  const newPaidAmount = txData.paidAmount + additionalAmount;
  const newRemainingAmount = Math.max(0, txData.totalAmount - newPaidAmount);
  const newStatus: PaymentStatus = newRemainingAmount === 0 ? 'PAID' : 'PARTIAL';

  const actorUid = actorMember ? actorMember.uid : organizationId;
  const actorName = actorMember ? actorMember.displayName : "مالك العيادة";

  const updates = {
    paidAmount: newPaidAmount,
    remainingAmount: newRemainingAmount,
    paymentStatus: newStatus,
    paymentMethod,
    notes: notes ? `${txData.notes || ''}\n[سداد جديد ${new Date().toLocaleDateString('ar-EG')}]: ${notes}`.trim() : txData.notes,
    updatedAt: new Date().toISOString()
  };

  await updateDoc(txRef, updates);

  // Write-time aggregation: update active daily session for additional collected balance
  try {
    const today = getTodayDateString();
    const sessionRef = doc(db, "doctors", organizationId, "dailySessions", today);
    await updateDoc(sessionRef, {
      outstandingCollected: increment(additionalAmount),
      totalCollected: increment(additionalAmount),
      outstandingBalance: increment(-additionalAmount)
    });
  } catch {
    // Non-blocking
  }

  await logClinicAction({
    organizationId,
    actorUid,
    actorName,
    action: 'payment_updated',
    targetUid: transactionId,
    targetName: txData.patientName,
    details: `سداد مبلغ مستحق إضافي (${additionalAmount} ج) للمريض (${txData.patientName}). المتبقي الحالي: ${newRemainingAmount} ج`
  });
}

export async function refundClinicTransaction(
  actorMember: ClinicMember | null,
  isOwnerFallback: boolean,
  organizationId: string,
  transactionId: string,
  refundAmount: number,
  reason: string
): Promise<void> {
  if (!hasPermission(actorMember, 'REFUND_PAYMENT', isOwnerFallback)) {
    throw new Error("لا تملك صلاحية إجراء استرداد أموال الكشف.");
  }

  if (!reason.trim()) throw new Error("يرجى ذكر سبب استرداد المبلغ.");

  const txRef = doc(db, `organizations/${organizationId}/transactions`, transactionId);
  const txSnap = await getDoc(txRef);
  if (!txSnap.exists()) throw new Error("المعاملة غير موجودة.");

  const txData = txSnap.data() as ClinicTransaction;

  if (refundAmount <= 0 || isNaN(refundAmount)) {
    throw new Error("يرجى إدخال مبلغ استرداد صحيح.");
  }

  if (refundAmount > txData.paidAmount) {
    throw new Error(`مبلغ الاسترداد (${refundAmount} ج) أكبر من المبلغ المدفوع الفعلي (${txData.paidAmount} ج).`);
  }

  const actorUid = actorMember ? actorMember.uid : organizationId;
  const actorName = actorMember ? actorMember.displayName : "مالك العيادة";

  const updates = {
    paymentStatus: 'REFUNDED' as PaymentStatus,
    paidAmount: Math.max(0, txData.paidAmount - refundAmount),
    remainingAmount: txData.totalAmount - Math.max(0, txData.paidAmount - refundAmount),
    refundDetails: {
      refundAmount: Number(refundAmount),
      reason: reason.trim(),
      refundedBy: actorUid,
      refundedByName: actorName,
      refundedAt: new Date().toISOString()
    },
    updatedAt: new Date().toISOString()
  };

  await updateDoc(txRef, updates);

  await logClinicAction({
    organizationId,
    actorUid,
    actorName,
    action: 'refund_created',
    targetUid: transactionId,
    targetName: txData.patientName,
    details: `إجراء استرداد مبلغ (${refundAmount} ج) للمريض (${txData.patientName}). السبب: ${reason}`
  });
}

// --- Expense Management ---

export function subscribeToClinicExpenses(
  organizationId: string,
  callback: (expenses: ClinicExpense[]) => void
): () => void {
  if (!organizationId) {
    callback([]);
    return () => {};
  }

  const expRef = collection(db, `organizations/${organizationId}/expenses`);
  const q = query(expRef, orderBy("createdAt", "desc"), limit(200));

  return onSnapshot(
    q,
    (snapshot) => {
      const list: ClinicExpense[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as ClinicExpense);
      });
      callback(list);
    },
    (error) => {
      console.error("Error subscribing to expenses:", error);
      callback([]);
    }
  );
}

export async function createClinicExpense(
  actorMember: ClinicMember | null,
  isOwnerFallback: boolean,
  data: {
    organizationId: string;
    title: string;
    category: ExpenseCategory;
    amount: number;
    note?: string;
  }
): Promise<ClinicExpense> {
  const orgId = data.organizationId;
  if (!hasPermission(actorMember, 'MANAGE_FINANCE', isOwnerFallback)) {
    throw new Error("لا تملك صلاحية إضافة أو إدارة المصروفات.");
  }

  if (!data.title.trim()) throw new Error("يرجى إدخال عنوان أو بيان المصروف.");
  if (data.amount <= 0 || isNaN(data.amount)) throw new Error("يرجى إدخال قيمة مصروف صحيحة.");

  const expenseId = `exp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const actorUid = actorMember ? actorMember.uid : orgId;
  const actorName = actorMember ? actorMember.displayName : "مالك العيادة";

  const newExp: ClinicExpense = {
    id: expenseId,
    organizationId: orgId,
    title: data.title.trim(),
    category: data.category,
    amount: Number(data.amount),
    note: data.note?.trim() || "",
    createdBy: actorUid,
    createdByName: actorName,
    createdAt: new Date().toISOString()
  };

  await setDoc(doc(db, `organizations/${orgId}/expenses`, expenseId), newExp);

  await logClinicAction({
    organizationId: orgId,
    actorUid,
    actorName,
    action: 'expense_created',
    targetUid: expenseId,
    targetName: data.title,
    details: `تسجيل مصروف جديد (${data.title}) بقيمة ${data.amount} ج`
  });

  return newExp;
}

export async function updateClinicExpense(
  actorMember: ClinicMember | null,
  isOwnerFallback: boolean,
  organizationId: string,
  expenseId: string,
  updates: Partial<{
    title: string;
    category: ExpenseCategory;
    amount: number;
    note: string;
  }>
): Promise<void> {
  if (!hasPermission(actorMember, 'MANAGE_FINANCE', isOwnerFallback)) {
    throw new Error("لا تملك صلاحية تعديل المصروفات.");
  }

  const expRef = doc(db, `organizations/${organizationId}/expenses`, expenseId);
  const expSnap = await getDoc(expRef);
  if (!expSnap.exists()) throw new Error("المصروف غير موجود.");

  const oldData = expSnap.data() as ClinicExpense;

  const payload: Partial<ClinicExpense> = {
    ...updates,
    updatedAt: new Date().toISOString()
  };

  await updateDoc(expRef, payload);

  const actorUid = actorMember ? actorMember.uid : organizationId;
  await logClinicAction({
    organizationId,
    actorUid,
    actorName: actorMember?.displayName || "مالك العيادة",
    action: 'expense_updated',
    targetUid: expenseId,
    targetName: updates.title || oldData.title,
    details: `تحديث بيانات المصروف (${oldData.title})`
  });
}

export async function deleteClinicExpense(
  actorMember: ClinicMember | null,
  isOwnerFallback: boolean,
  organizationId: string,
  expenseId: string
): Promise<void> {
  if (!hasPermission(actorMember, 'MANAGE_FINANCE', isOwnerFallback)) {
    throw new Error("لا تملك صلاحية حذف المصروفات.");
  }

  const expRef = doc(db, `organizations/${organizationId}/expenses`, expenseId);
  const expSnap = await getDoc(expRef);
  const oldData = expSnap.exists() ? (expSnap.data() as ClinicExpense) : null;

  await deleteDoc(expRef);

  const actorUid = actorMember ? actorMember.uid : organizationId;
  await logClinicAction({
    organizationId,
    actorUid,
    actorName: actorMember?.displayName || "مالك العيادة",
    action: 'expense_deleted',
    targetUid: expenseId,
    targetName: oldData?.title || expenseId,
    details: `حذف المصروف (${oldData?.title || expenseId}) بقيمة ${oldData?.amount || 0} ج`
  });
}

// ============================================================================
// PATIENT MEDICAL FILES MANAGEMENT (MULTI-TENANT ISOLATION)
// ============================================================================

export async function getPatientMedicalFile(doctorId: string, phone: string): Promise<PatientMedicalFile | null> {
  try {
    const cleanPhone = normalizePhoneNumber(phone);
    if (!cleanPhone) return null;
    const fileRef = doc(db, "doctors", doctorId, "patientFiles", cleanPhone);
    const snap = await getDoc(fileRef);
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() } as PatientMedicalFile;
    }
    return null;
  } catch (err) {
    console.error("Error fetching patient medical file:", err);
    return null;
  }
}

export async function savePatientMedicalFile(
  doctorId: string,
  fileData: Partial<PatientMedicalFile> & { patientPhone: string; patientName: string; patientId?: string }
): Promise<PatientMedicalFile> {
  const phoneValidation = validatePatientPhoneNumber(fileData.patientPhone);
  if (!phoneValidation.isValid) {
    throw new Error(phoneValidation.error || "رقم الهاتف يجب أن يكون من 10 إلى 11 رقمًا.");
  }
  const cleanPhone = phoneValidation.cleanPhone;
  const nowIso = new Date().toISOString();
  const fileRef = doc(db, "doctors", doctorId, "patientFiles", cleanPhone);

  const existingSnap = await getDoc(fileRef);
  let updatedFile: PatientMedicalFile;

  // Clean visits array to remove any undefined values
  const cleanVisits = (fileData.visits || []).map((v) =>
    removeUndefinedFields({
      ...v,
      serviceId: v.serviceId || "",
      notes: v.notes || "",
      diagnosis: v.diagnosis || "",
      prescription: v.prescription || ""
    })
  );

  if (existingSnap.exists()) {
    const prev = existingSnap.data() as PatientMedicalFile;
    updatedFile = removeUndefinedFields({
      ...prev,
      ...fileData,
      patientId: fileData.patientId || prev.patientId,
      patientPhone: cleanPhone,
      visits: cleanVisits.length > 0 ? cleanVisits : prev.visits || [],
      updatedAt: nowIso
    });
    await setDoc(fileRef, updatedFile, { merge: true });
  } else {
    updatedFile = removeUndefinedFields({
      id: cleanPhone,
      doctorId,
      patientId: fileData.patientId || "",
      patientName: sanitizeInput(fileData.patientName),
      patientPhone: cleanPhone,
      age: fileData.age || 0,
      gender: fileData.gender || "male",
      bloodGroup: fileData.bloodGroup || '',
      allergies: fileData.allergies || '',
      chronicDiseases: fileData.chronicDiseases || '',
      generalNotes: fileData.generalNotes || '',
      lastVisitDate: fileData.lastVisitDate || getTodayDateString(),
      visitsCount: fileData.visitsCount || 1,
      visits: cleanVisits,
      createdAt: nowIso,
      updatedAt: nowIso
    });
    await setDoc(fileRef, updatedFile);
  }
  return updatedFile;
}

export async function addVisitToPatientMedicalFile(
  doctorId: string,
  patientName: string,
  patientPhone: string,
  visitEntry: PatientVisitEntry,
  patientId?: string
): Promise<void> {
  try {
    const cleanPhone = normalizePhoneNumber(patientPhone);
    if (!cleanPhone) return;
    const existing = await getPatientMedicalFile(doctorId, cleanPhone);

    const safeVisitEntry: PatientVisitEntry = removeUndefinedFields({
      ...visitEntry,
      serviceId: visitEntry.serviceId || "",
      serviceName: visitEntry.serviceName || "كشف",
      visitType: visitEntry.visitType || "كشف جديد",
      notes: visitEntry.notes || "",
      diagnosis: visitEntry.diagnosis || "",
      prescription: visitEntry.prescription || ""
    });

    if (existing) {
      const visits = existing.visits || [];
      const existsIndex = visits.findIndex(v => v.id === safeVisitEntry.id);
      if (existsIndex >= 0) {
        visits[existsIndex] = { ...visits[existsIndex], ...safeVisitEntry };
      } else {
        visits.unshift(safeVisitEntry);
      }
      await savePatientMedicalFile(doctorId, {
        patientId: patientId || existing.patientId,
        patientPhone: cleanPhone,
        patientName: patientName || existing.patientName,
        lastVisitDate: safeVisitEntry.date || getTodayDateString(),
        visitsCount: visits.length,
        visits
      });
    } else {
      await savePatientMedicalFile(doctorId, {
        patientId,
        patientPhone: cleanPhone,
        patientName,
        lastVisitDate: safeVisitEntry.date || getTodayDateString(),
        visitsCount: 1,
        visits: [safeVisitEntry]
      });
    }
  } catch (err) {
    console.error("Error linking visit to patient file:", err);
  }
}

export async function searchPatientsForDoctor(doctorId: string, searchTerm: string, limitCount = 20): Promise<PatientMedicalFile[]> {
  try {
    const rawTerm = searchTerm.trim();
    if (!rawTerm) return [];

    const normQuery = normalizeArabicSearchText(rawTerm);
    const cleanPhoneQuery = normalizePhoneNumber(rawTerm);
    const isPhone = /^[0-9+]+$/.test(rawTerm);

    const colRef = collection(db, "doctors", doctorId, "patientFiles");

    // Fast-path: Direct phone document lookup (O(1) read instead of full collection scan)
    if (isPhone && cleanPhoneQuery && cleanPhoneQuery.length >= 10) {
      try {
        const directSnap = await getDoc(doc(colRef, cleanPhoneQuery));
        if (directSnap.exists()) {
          return [{ id: directSnap.id, ...directSnap.data() } as PatientMedicalFile];
        }
      } catch {
        // Fall through to query
      }

      // Query by phone field with exact filter
      try {
        const phoneSnap = await getDocs(query(colRef, where("patientPhone", "==", cleanPhoneQuery), limit(limitCount)));
        if (!phoneSnap.empty) {
          const results: PatientMedicalFile[] = [];
          phoneSnap.forEach((d) => results.push({ id: d.id, ...d.data() } as PatientMedicalFile));
          return results;
        }
      } catch {
        // Fall through to bounded search
      }
    }

    // Name search with bounded limit
    const snap = await getDocs(query(colRef, limit(60)));
    const results: PatientMedicalFile[] = [];

    snap.forEach((docSnap) => {
      const data = { id: docSnap.id, ...docSnap.data() } as PatientMedicalFile;
      const normName = normalizeArabicSearchText(data.patientName || "");
      const phone = data.patientPhone || "";
      const cleanPhone = normalizePhoneNumber(phone);

      const nameMatch = normName.includes(normQuery);
      const phoneMatch = cleanPhoneQuery ? (phone.includes(cleanPhoneQuery) || cleanPhone.includes(cleanPhoneQuery)) : phone.includes(rawTerm);

      if (nameMatch || phoneMatch) {
        results.push(data);
      }
    });

    return results.slice(0, limitCount);
  } catch (err) {
    console.error("Error searching patients for doctor:", err);
    return [];
  }
}

export async function getAllPatientFilesForDoctor(doctorId: string, limitCount = 50): Promise<PatientMedicalFile[]> {
  try {
    const colRef = collection(db, "doctors", doctorId, "patientFiles");
    const q = query(colRef, limit(limitCount));
    const snap = await getDocs(q);
    const list: PatientMedicalFile[] = [];
    snap.forEach(d => list.push({ id: d.id, ...d.data() } as PatientMedicalFile));
    return list;
  } catch (err) {
    console.error("Error fetching patient files:", err);
    return [];
  }
}

// ============================================================================
// PLATFORM ADMIN SOFT DELETE & RECYCLE BIN MANAGEMENT (3-DAY POLICY)
// ============================================================================

export async function softDeleteDoctorAccountByAdmin(doctorId: string, adminUid: string): Promise<void> {
  const nowIso = new Date().toISOString();
  await updateDoc(doc(db, "doctors", doctorId), {
    isDeleted: true,
    deletedAt: nowIso,
    deletedByAdminUid: adminUid,
    isActive: false
  });
  writeAuditLog("SOFT_DELETE_DOCTOR", adminUid, doctorId, { deletedAt: nowIso });
}

export async function softDeleteLabAccountByAdmin(labId: string, adminUid: string): Promise<void> {
  const nowIso = new Date().toISOString();
  await updateDoc(doc(db, "labs", labId), {
    isDeleted: true,
    deletedAt: nowIso,
    deletedByAdminUid: adminUid,
    isActive: false
  });
  writeAuditLog("SOFT_DELETE_LAB", adminUid, labId, { deletedAt: nowIso });
}

export async function restoreDoctorAccountByAdmin(doctorId: string, adminUid: string): Promise<void> {
  await updateDoc(doc(db, "doctors", doctorId), {
    isDeleted: false,
    deletedAt: null,
    deletedByAdminUid: null,
    isActive: true
  });
  writeAuditLog("RESTORE_DOCTOR", adminUid, doctorId);
}

export async function restoreLabAccountByAdmin(labId: string, adminUid: string): Promise<void> {
  await updateDoc(doc(db, "labs", labId), {
    isDeleted: false,
    deletedAt: null,
    deletedByAdminUid: null,
    isActive: true
  });
  writeAuditLog("RESTORE_LAB", adminUid, labId);
}

export interface DeletedAccountItem {
  id: string;
  name: string;
  type: 'doctor' | 'laboratory';
  deletedAt: string;
  deletedByAdminUid?: string;
  originalData: any;
}

export async function getDeletedAccountsAdmin(): Promise<DeletedAccountItem[]> {
  const deletedItems: DeletedAccountItem[] = [];

  try {
    const docSnap = await getDocs(collection(db, "doctors"));
    docSnap.forEach((d) => {
      const data = d.data();
      if (data.isDeleted === true) {
        deletedItems.push({
          id: d.id,
          name: data.clinicName || data.name || 'عيادة',
          type: 'doctor',
          deletedAt: data.deletedAt || new Date().toISOString(),
          deletedByAdminUid: data.deletedByAdminUid || '',
          originalData: data
        });
      }
    });

    const labSnap = await getDocs(collection(db, "labs"));
    labSnap.forEach((l) => {
      const data = l.data();
      if (data.isDeleted === true) {
        deletedItems.push({
          id: l.id,
          name: data.name || 'معمل تحاليل',
          type: 'laboratory',
          deletedAt: data.deletedAt || new Date().toISOString(),
          deletedByAdminUid: data.deletedByAdminUid || '',
          originalData: data
        });
      }
    });
  } catch (err) {
    console.error("Error fetching deleted accounts:", err);
  }

  deletedItems.sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());
  return deletedItems;
}

export async function hardDeleteAccountByAdmin(id: string, type: 'doctor' | 'laboratory', adminUid: string): Promise<void> {
  if (type === 'doctor') {
    try {
      const queueSnap = await getDocs(collection(db, "queues", id, "patients"));
      for (const p of queueSnap.docs) {
        await deleteDoc(p.ref);
      }
    } catch (e) {
      console.warn("Error purging queue patients:", e);
    }
    await deleteDoc(doc(db, "doctors", id));
  } else {
    await deleteDoc(doc(db, "labs", id));
  }
  writeAuditLog("HARD_DELETE_ACCOUNT", adminUid, id, { accountType: type });
}

// ============================================================================
// ADMIN ANNOUNCEMENTS & NOTIFICATION CENTER SERVICES
// ============================================================================

export async function createAnnouncementAdmin(
  adminUid: string,
  announcement: {
    title: string;
    message: string;
    type: AnnouncementType;
    target: AnnouncementTarget;
    targetUid?: string;
    targetName?: string;
    actionLink?: string;
    actionLabel?: string;
    expiresAt?: string;
  }
): Promise<string> {
  const annId = `ann_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const ref = doc(db, "announcements", annId);
  const data: AdminAnnouncement = {
    id: annId,
    title: announcement.title.trim(),
    message: announcement.message.trim(),
    type: announcement.type,
    target: announcement.target,
    targetUid: announcement.targetUid || '',
    targetName: announcement.targetName || '',
    actionLink: announcement.actionLink?.trim() || '',
    actionLabel: announcement.actionLabel?.trim() || '',
    isActive: true,
    createdAt: new Date().toISOString(),
    createdBy: adminUid,
    expiresAt: announcement.expiresAt || ''
  };

  await setDoc(ref, data);
  writeAuditLog("CREATE_ANNOUNCEMENT", adminUid, annId, { title: data.title, type: data.type });
  return annId;
}

export async function updateAnnouncementAdmin(
  adminUid: string,
  announcementId: string,
  updates: Partial<AdminAnnouncement>
): Promise<void> {
  const ref = doc(db, "announcements", announcementId);
  await updateDoc(ref, updates);
  writeAuditLog("UPDATE_ANNOUNCEMENT", adminUid, announcementId, updates);
}

export async function deleteAnnouncementAdmin(
  adminUid: string,
  announcementId: string
): Promise<void> {
  const ref = doc(db, "announcements", announcementId);
  await deleteDoc(ref);
  writeAuditLog("DELETE_ANNOUNCEMENT", adminUid, announcementId);
}

export async function getAllAnnouncementsAdmin(): Promise<AdminAnnouncement[]> {
  try {
    const snap = await getDocs(collection(db, "announcements"));
    const list: AdminAnnouncement[] = [];
    snap.forEach((d) => {
      list.push(d.data() as AdminAnnouncement);
    });
    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return list;
  } catch (err) {
    console.error("Error fetching announcements for admin:", err);
    return [];
  }
}

export function subscribeAnnouncementsForUser(
  userRole: 'visitor' | 'doctor' | 'laboratory' | 'staff' | 'admin' | 'guest' | string,
  userUid: string | null | undefined,
  callback: (announcements: AdminAnnouncement[]) => void
): () => void {
  const q = collection(db, "announcements");

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const list: AdminAnnouncement[] = [];
      const now = Date.now();

      snapshot.forEach((docSnap) => {
        const item = docSnap.data() as AdminAnnouncement;
        if (!item.isActive) return;

        if (item.expiresAt) {
          const expTime = new Date(item.expiresAt).getTime();
          if (now > expTime) return;
        }

        // Filter based on target and user profile
        if (item.target === 'all') {
          list.push(item);
        } else if (item.target === 'doctors' && (userRole === 'doctor' || userRole === 'admin')) {
          list.push(item);
        } else if (item.target === 'labs' && (userRole === 'laboratory' || userRole === 'lab' || userRole === 'admin')) {
          list.push(item);
        } else if (item.target === 'staff' && (userRole === 'staff' || userRole === 'doctor' || userRole === 'laboratory' || userRole === 'lab' || userRole === 'admin')) {
          list.push(item);
        } else if (item.target === 'specific' && (Boolean(userUid && item.targetUid === userUid) || userRole === 'admin')) {
          list.push(item);
        }
      });

      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      callback(list);
    },
    (err) => {
      console.warn("Announcements subscription error:", err);
      callback([]);
    }
  );

  return unsubscribe;
}

/**
 * Persists read announcement IDs across devices for authenticated accounts
 */
export async function fetchUserReadAnnouncements(userId: string): Promise<string[]> {
  if (!userId) return [];
  try {
    const prefDoc = await getDoc(doc(db, "user_preferences", userId));
    if (prefDoc.exists()) {
      const data = prefDoc.data();
      return Array.isArray(data?.readAnnouncements) ? data.readAnnouncements : [];
    }
    return [];
  } catch (err) {
    console.warn("Could not fetch remote user preferences:", err);
    return [];
  }
}

export async function saveUserReadAnnouncements(userId: string, readIds: string[]): Promise<void> {
  if (!userId || !Array.isArray(readIds)) return;
  try {
    await setDoc(
      doc(db, "user_preferences", userId),
      {
        readAnnouncements: readIds,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn("Could not sync read announcements to remote cloud:", err);
  }
}

// ============================================================================
// DAILY OPERATING SYSTEM & ARCHIVE (SECTIONS 4, 5, 6, 7)
// ============================================================================

export function normalizeArabicSearchText(text: string): string {
  if (!text) return "";
  return text
    .trim()
    .toLowerCase()
    .replace(/[أإآء]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/[ىي]/g, "ي")
    .replace(/[\u064B-\u065F\u0670]/g, "") // tashkeel
    .replace(/\u0640/g, "") // tatweel (kashida)
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))) // Hindi/Arabic numerals
    .replace(/\s+/g, " ");
}

export const normalizeArabicText = normalizeArabicSearchText;

/**
 * Lightweight real-time listener for today's clinic operating session summary
 */
export function subscribeToTodayDailySession(
  doctorId: string,
  date: string,
  callback: (session: DailySession | null) => void
): () => void {
  if (!doctorId || !date) {
    callback(null);
    return () => {};
  }
  const sessionRef = doc(db, "doctors", doctorId, "dailySessions", date);
  return onSnapshot(
    sessionRef,
    (snap) => {
      if (snap.exists()) {
        callback({ id: snap.id, ...snap.data() } as DailySession);
      } else {
        callback(null);
      }
    },
    (err) => {
      console.warn("Error subscribing to daily session:", err);
      callback(null);
    }
  );
}

/**
 * Start a new clinic day session
 */
export async function startNewDaySession(doctorId: string, date?: string): Promise<DailySession> {
  const sessionDate = date || getTodayDateString();
  const sessionRef = doc(db, "doctors", doctorId, "dailySessions", sessionDate);
  const existingSnap = await getDoc(sessionRef);

  if (existingSnap.exists() && existingSnap.data()?.status === "active") {
    return { id: existingSnap.id, ...existingSnap.data() } as DailySession;
  }

  const daysOfWeekAr = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  const dayName = daysOfWeekAr[new Date().getDay()] || "";

  const newSession: DailySession = {
    id: sessionDate,
    doctorId,
    date: sessionDate,
    dayName,
    status: "active",
    startedAt: new Date().toISOString(),
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
    paymentBreakdown: {
      cash: 0,
      card: 0,
      transfer: 0,
      other: 0
    },
    serviceBreakdown: {}
  };

  await setDoc(sessionRef, newSession, { merge: true });
  return newSession;
}

/**
 * Update daily session metrics dynamically
 */
export async function updateDailySessionStats(
  doctorId: string,
  date: string,
  updates: Partial<DailySession>
): Promise<void> {
  try {
    const sessionRef = doc(db, "doctors", doctorId, "dailySessions", date);
    await setDoc(sessionRef, { ...updates, date }, { merge: true });
  } catch (err) {
    console.warn("Failed to update daily session stats:", err);
  }
}

/**
 * Complete and archive today's clinic operating day with comprehensive summary
 */
export async function completeDaySession(
  doctorId: string,
  date: string,
  summary: Partial<DailySession>,
  patientsToArchive: PatientRecord[] = [],
  userUid?: string,
  userName?: string
): Promise<void> {
  const sessionRef = doc(db, "doctors", doctorId, "dailySessions", date);
  const nowIso = new Date().toISOString();

  // Ensure all queue patients are swept so no orphaned tickets remain
  let allPatients = [...patientsToArchive];
  try {
    const queueCol = collection(db, "queues", doctorId, "patients");
    const qSnap = await getDocs(query(queueCol, limit(200)));
    const existingIds = new Set(allPatients.map((p) => p.id));
    qSnap.forEach((d) => {
      if (!existingIds.has(d.id)) {
        allPatients.push({ id: d.id, ...d.data() } as PatientRecord);
      }
    });
  } catch (e) {
    console.warn("Could not sweep remaining queue docs:", e);
  }

  // 1. Process patient archive and deletion in chunks (max 150 patients per batch to remain safely below Firestore's 500 limit)
  const BATCH_CHUNK_SIZE = 150;
  for (let i = 0; i < allPatients.length; i += BATCH_CHUNK_SIZE) {
    const chunk = allPatients.slice(i, i + BATCH_CHUNK_SIZE);
    const batch = writeBatch(db);

    chunk.forEach((p) => {
      const patientId = p.id;
      const archiveRef = doc(db, "doctors", doctorId, "dailySessions", date, "archivedPatients", patientId);
      const queueRef = doc(db, "queues", doctorId, "patients", patientId);

      batch.set(archiveRef, removeUndefinedFields({
        ...p,
        archivedAt: nowIso,
        archivedDate: date
      }));
      batch.delete(queueRef);
    });

    await batch.commit();
  }

  // 2. Atomically finalize daily session document and reset daily counter
  const finalBatch = writeBatch(db);
  finalBatch.set(
    sessionRef,
    removeUndefinedFields({
      ...summary,
      status: "completed",
      completedAt: nowIso,
      completedByUid: userUid || "",
      completedByName: userName || ""
    }),
    { merge: true }
  );

  const counterRef = doc(db, "queues", doctorId, "dailyCounters", date);
  finalBatch.set(counterRef, {
    lastSequenceNumber: 0,
    date,
    updatedAt: nowIso
  }, { merge: true });

  await finalBatch.commit();
}

/**
 * Fetch archived days history (one-time fetch, no heavy real-time listeners)
 */
export async function getArchivedDays(doctorId: string, limitCount = 30): Promise<DailySession[]> {
  try {
    const colRef = collection(db, "doctors", doctorId, "dailySessions");
    const q = query(
      colRef,
      where("status", "==", "completed"),
      orderBy("date", "desc"),
      limit(limitCount)
    );
    const snap = await getDocs(q);
    const list: DailySession[] = [];
    snap.forEach((d) => {
      list.push({ id: d.id, ...d.data() } as DailySession);
    });
    return list;
  } catch (err) {
    console.warn("Error fetching archived days, falling back to simple query:", err);
    try {
      const colRef = collection(db, "doctors", doctorId, "dailySessions");
      const snap = await getDocs(query(colRef, limit(limitCount)));
      const list: DailySession[] = [];
      snap.forEach((d) => {
        const data = d.data() as DailySession;
        if (data.status === "completed") {
          list.push({ id: d.id, ...data });
        }
      });
      return list.sort((a, b) => b.date.localeCompare(a.date));
    } catch (fallbackErr) {
      console.error("Failed to fetch archived days:", fallbackErr);
      return [];
    }
  }
}

/**
 * Get one-time archived day full details (patients, summary, transactions)
 */
export async function getArchivedDayDetails(
  doctorId: string,
  date: string
): Promise<{
  session: DailySession | null;
  patients: PatientRecord[];
  transactions: ClinicTransaction[];
}> {
  try {
    const sessionSnap = await getDoc(doc(db, "doctors", doctorId, "dailySessions", date));
    const session = sessionSnap.exists()
      ? ({ id: sessionSnap.id, ...sessionSnap.data() } as DailySession)
      : null;

    // 1. Get patients from dedicated archivedPatients subcollection first
    const archivedCol = collection(db, "doctors", doctorId, "dailySessions", date, "archivedPatients");
    const arcSnap = await getDocs(query(archivedCol, limit(150)));
    let patients: PatientRecord[] = [];
    arcSnap.forEach((d) => patients.push({ id: d.id, ...d.data() } as PatientRecord));

    // 2. Legacy fallback to queues/{doctorId}/patients if archive subcollection was not used
    if (patients.length === 0) {
      const patientsCol = collection(db, "queues", doctorId, "patients");
      const pSnap = await getDocs(query(patientsCol, where("date", "==", date), limit(150)));
      pSnap.forEach((d) => patients.push({ id: d.id, ...d.data() } as PatientRecord));
    }

    // Sort patients by sequenceNumber
    patients.sort((a, b) => (a.sequenceNumber || 0) - (b.sequenceNumber || 0));

    // 3. Get transactions for that date
    const txCol = collection(db, "clinic_transactions");
    const txSnap = await getDocs(
      query(txCol, where("organizationId", "==", doctorId), where("date", "==", date), limit(150))
    );
    const transactions: ClinicTransaction[] = [];
    txSnap.forEach((d) => transactions.push({ id: d.id, ...d.data() } as ClinicTransaction));

    return { session, patients, transactions };
  } catch (err) {
    console.error("Error fetching archived day details:", err);
    return { session: null, patients: [], transactions: [] };
  }
}

// ============================================================================
// ENHANCED PATIENT SEARCH & REUSE & DEDUPLICATION (SECTIONS 8, 9, 10, 11)
// ============================================================================

export interface FastPatientSearchResult {
  id: string;
  patientId?: string;
  patientName: string;
  patientPhone: string;
  visitsCount: number;
  lastVisitDate?: string;
  totalOutstandingBalance: number;
  allergies?: string;
  chronicDiseases?: string;
  lastVisitDiagnosis?: string;
}

// Fast patient search cache (2 min TTL) to avoid querying dozens of documents on every keystroke
const patientSearchCache = new Map<string, { files: PatientMedicalFile[]; queue: PatientRecord[]; timestamp: number }>();

/**
 * Fast search for existing clinic patients (debounced, bounded, cached)
 */
export async function searchClinicPatientsFast(
  doctorId: string,
  searchTerm: string,
  limitCount = 8
): Promise<FastPatientSearchResult[]> {
  try {
    const rawTerm = searchTerm.trim();
    if (!rawTerm || rawTerm.length < 2) return [];

    const normTerm = normalizeArabicText(rawTerm);
    const isPhone = /^[0-9+]+$/.test(rawTerm);

    // Fast-path: Direct O(1) patient file lookup by normalized phone
    if (isPhone && rawTerm.length >= 10) {
      const cleanTargetPhone = normalizePhoneNumber(rawTerm);
      if (cleanTargetPhone && cleanTargetPhone.length >= 10) {
        try {
          const directFileRef = doc(db, "doctors", doctorId, "patientFiles", cleanTargetPhone);
          const directSnap = await getDoc(directFileRef);
          if (directSnap.exists()) {
            const d = directSnap.data() as PatientMedicalFile;
            const lastVisit = d.visits && d.visits.length > 0 ? d.visits[0] : undefined;
            return [{
              id: d.patientId || cleanTargetPhone,
              patientId: d.patientId,
              patientName: d.patientName,
              patientPhone: d.patientPhone || cleanTargetPhone,
              visitsCount: d.visitsCount || (d.visits ? d.visits.length : 1),
              lastVisitDate: d.lastVisitDate || lastVisit?.date,
              totalOutstandingBalance: d.totalOutstandingBalance || 0,
              allergies: d.allergies,
              chronicDiseases: d.chronicDiseases,
              lastVisitDiagnosis: lastVisit?.diagnosis
            }];
          }
        } catch {
          // Fall through to standard cached search
        }
      }
    }

    const results: FastPatientSearchResult[] = [];
    const seenPhones = new Set<string>();

    let cached = patientSearchCache.get(doctorId);
    if (!cached || Date.now() - cached.timestamp > 120000) {
      const files: PatientMedicalFile[] = [];
      const queue: PatientRecord[] = [];

      try {
        const colRef = collection(db, "doctors", doctorId, "patientFiles");
        const snap = await getDocs(query(colRef, limit(100)));
        snap.forEach((docSnap) => files.push({ id: docSnap.id, patientId: (docSnap.data() as any).patientId || docSnap.id, ...docSnap.data() } as PatientMedicalFile));
      } catch (e) {
        console.warn("Could not query patientFiles for search:", e);
      }

      try {
        const queueColRef = collection(db, "queues", doctorId, "patients");
        const queueSnap = await getDocs(query(queueColRef, limit(120)));
        queueSnap.forEach((docSnap) => queue.push({ id: docSnap.id, ...docSnap.data() } as PatientRecord));
      } catch (e) {
        console.warn("Could not query queues for search:", e);
      }

      cached = { files, queue, timestamp: Date.now() };
      patientSearchCache.set(doctorId, cached);
    }

    // Filter in-memory from cached dataset
    cached.files.forEach((data) => {
      const normName = normalizeArabicText(data.patientName || "");
      const phone = data.patientPhone || "";
      const cleanPhone = normalizePhoneNumber(phone);

      let matched = false;
      if (isPhone && (phone.includes(rawTerm) || cleanPhone.includes(rawTerm))) {
        matched = true;
      } else if (normName.includes(normTerm)) {
        matched = true;
      }

      if (matched && cleanPhone && !seenPhones.has(cleanPhone)) {
        seenPhones.add(cleanPhone);
        const lastVisit = data.visits && data.visits.length > 0 ? data.visits[0] : undefined;
        const resultId = data.patientId || data.id || cleanPhone || generatePatientId(cleanPhone);
        results.push({
          id: resultId,
          patientId: data.patientId || resultId,
          patientName: data.patientName,
          patientPhone: data.patientPhone || cleanPhone,
          visitsCount: data.visitsCount || (data.visits ? data.visits.length : 1),
          lastVisitDate: data.lastVisitDate || lastVisit?.date,
          totalOutstandingBalance: data.totalOutstandingBalance || 0,
          allergies: data.allergies,
          chronicDiseases: data.chronicDiseases,
          lastVisitDiagnosis: lastVisit?.diagnosis
        });
      }
    });

    cached.queue.forEach((p) => {
      const normName = normalizeArabicText(p.name || "");
      const phone = p.phone || "";
      const cleanPhone = normalizePhoneNumber(phone);

      let matched = false;
      if (isPhone && (phone.includes(rawTerm) || cleanPhone.includes(rawTerm))) {
        matched = true;
      } else if (normName.includes(normTerm)) {
        matched = true;
      }

      if (matched && cleanPhone && !seenPhones.has(cleanPhone)) {
        seenPhones.add(cleanPhone);
        const resultId = p.patientId || p.id || cleanPhone || generatePatientId(cleanPhone);
        results.push({
          id: resultId,
          patientId: p.patientId || resultId,
          patientName: p.name,
          patientPhone: p.phone || cleanPhone,
          visitsCount: 1,
          lastVisitDate: p.date,
          totalOutstandingBalance: 0
        });
      }
    });

    return results.slice(0, limitCount);
  } catch (err) {
    console.error("Fast patient search error:", err);
    return [];
  }
}

/**
 * Get patient's accumulated outstanding balance from transactions
 */
export async function getPatientAccumulatedBalance(
  doctorId: string,
  patientPhone: string
): Promise<number> {
  try {
    const cleanPhone = normalizePhoneNumber(patientPhone);
    if (!cleanPhone) return 0;

    const txCol = collection(db, "clinic_transactions");
    const q = query(
      txCol,
      where("organizationId", "==", doctorId),
      where("patientPhone", "==", cleanPhone),
      limit(50)
    );
    const snap = await getDocs(q);
    let balance = 0;
    snap.forEach((d) => {
      const tx = d.data() as ClinicTransaction;
      if (tx.remainingAmount && tx.remainingAmount > 0) {
        balance += tx.remainingAmount;
      }
    });
    return balance;
  } catch (err) {
    console.warn("Error calculating patient balance:", err);
    return 0;
  }
}

// ============================================================================
// DOCTOR CONSULTATION COMPLETION & VISIT RECORDING (SECTIONS 13, 14, 15)
// ============================================================================

export interface CompleteConsultationParams {
  doctorId: string;
  patientRecordId: string; // queue patient ID
  patientName: string;
  patientPhone: string;
  visitType: VisitType;
  diagnosis: string;
  notes?: string;
  prescription?: string;
  followUpDate?: string;
  followUpTime?: string;
  followUpReason?: string;
  followUpFee?: number;
  doctorName?: string;
  clinicName?: string;
  serviceName?: string;
}

/**
 * Complete a patient consultation:
 * 1. Updates queue status to 'done' (notifies secretary in real time)
 * 2. Saves clinical details to patient's permanent medical file
 * 3. Auto-schedules follow-up if requested
 * 4. Updates daily session counters
 */
export async function completePatientConsultation(
  params: CompleteConsultationParams
): Promise<void> {
  const {
    doctorId,
    patientRecordId,
    patientName,
    patientPhone,
    visitType,
    diagnosis,
    notes,
    prescription,
    followUpDate,
    followUpTime,
    followUpReason,
    followUpFee = 0,
    doctorName = "دكتور العيادة",
    clinicName = "العيادة",
    serviceName
  } = params;

  const today = getTodayDateString();
  const nowIso = new Date().toISOString();
  const cleanPhone = normalizePhoneNumber(patientPhone);

  // 1. Update queue ticket
  const ticketRef = doc(db, "queues", doctorId, "patients", patientRecordId);
  await updateDoc(ticketRef, {
    status: "done" as PatientStatus,
    doneAt: nowIso,
    visitType,
    diagnosisSummary: diagnosis || ""
  });

  // 2. Build Visit Entry
  const visitEntry: PatientVisitEntry = {
    id: `visit_${Date.now()}`,
    date: today,
    visitType,
    serviceName: serviceName || (visitType === "follow_up" ? "استشارة" : "كشف"),
    diagnosis: diagnosis || "",
    notes: notes || "",
    prescription: prescription || "",
    status: "done",
    createdAt: nowIso
  };

  // 3. Save to patient file
  if (cleanPhone) {
    await addVisitToPatientMedicalFile(
      doctorId,
      patientName,
      cleanPhone,
      visitEntry
    );
  }

  // 4. Auto-schedule follow-up if date is provided
  if (followUpDate && followUpTime && cleanPhone) {
    await createFollowUpAppointment({
      doctorId,
      doctorName,
      clinicId: doctorId,
      clinicName,
      patientName,
      patientPhone: cleanPhone,
      appointmentDate: followUpDate,
      appointmentTime: followUpTime,
      reason: followUpReason || `متابعة ${visitType === "follow_up" ? "استشارة" : "كشف"}`,
      notes: `تم تحديد الموعد تلقائيًا أثناء الكشف. الرسوم المتوقعة: ${followUpFee} ج.م`,
      reminderSettings: {
        oneDayBefore: true,
        twoHoursBefore: true
      }
    });
  }

  // 5. Update daily session counts
  try {
    const sessionRef = doc(db, "doctors", doctorId, "dailySessions", today);
    await updateDoc(sessionRef, {
      completedCount: increment(1),
      inConsultationCount: increment(-1),
      followUpsCount: followUpDate ? increment(1) : increment(0)
    });
  } catch (err) {
    // Session might not be initialized yet; non-blocking
  }
}

// ============================================================================
// NO-SHOW & 2-STEP FOLLOW-UP REMOVAL (SECTIONS 16, 17, 18, 19)
// ============================================================================

/**
 * Mark a queue patient as No-show.
 * Patient is removed from active queue, but historical record and patient file are preserved!
 */
export async function markQueuePatientNoShow(
  doctorId: string,
  patientRecordId: string
): Promise<void> {
  const today = getTodayDateString();
  const ticketRef = doc(db, "queues", doctorId, "patients", patientRecordId);

  let prevStatus: PatientStatus = 'waiting';
  try {
    const snap = await getDoc(ticketRef);
    if (!snap.exists()) {
      throw new Error("سجل المريض غير موجود في طابور اليوم أو تم أرشفته مسبقاً.");
    }
    prevStatus = (snap.data() as PatientRecord).status;
  } catch (readErr: any) {
    if (readErr.message?.includes("غير موجود في طابور اليوم")) {
      throw readErr;
    }
  }

  try {
    await updateDoc(ticketRef, {
      status: "no_show" as PatientStatus,
      noShowAt: new Date().toISOString()
    });
  } catch (err: any) {
    if (err?.code === 'not-found' || err?.message?.includes('No document to update')) {
      throw new Error("سجل المريض غير موجود في طابور اليوم أو تم أرشفته مسبقاً.");
    }
    throw err;
  }

  try {
    const sessionRef = doc(db, "doctors", doctorId, "dailySessions", today);
    const sessionUpdates: Record<string, any> = {
      noShowCount: increment(1)
    };
    if (prevStatus === 'waiting') {
      sessionUpdates.waitingCount = increment(-1);
    } else if (prevStatus === 'called') {
      sessionUpdates.inConsultationCount = increment(-1);
    }
    await updateDoc(sessionRef, sessionUpdates);
  } catch (err) {
    // Non-blocking
  }
}

/**
 * 2-Step cancellation of follow-up appointment:
 * Marks status as 'cancelled'. Preserves patient, past visits, and billing records!
 */
export async function cancelFollowUpAppointment(
  appointmentId: string,
  doctorId: string,
  cancellationReason?: string
): Promise<void> {
  const appRef = doc(db, "followUpAppointments", appointmentId);
  await updateDoc(appRef, {
    appointmentStatus: "cancelled" as FollowUpAppointmentStatus,
    cancelledAt: new Date().toISOString(),
    cancellationReason: cancellationReason || "تم إلغاء الموعد بناءً على طلب العيادة"
  });
}

/**
 * Mark follow-up appointment as 'no_show'.
 * Preserves patient record, but removes from active follow-up agenda.
 */
export async function markFollowUpNoShow(
  appointmentId: string,
  doctorId: string
): Promise<void> {
  const appRef = doc(db, "followUpAppointments", appointmentId);
  await updateDoc(appRef, {
    appointmentStatus: "no_show" as FollowUpAppointmentStatus,
    noShowAt: new Date().toISOString()
  });
}

// ============================================================================
// SPLIT PAYMENTS & FINANCIAL RECORDING (SECTIONS 20, 21, 22, 23, 24, 25)
// ============================================================================

export interface RecordSplitPaymentParams {
  organizationId: string;
  patientName: string;
  patientPhone: string;
  patientRecordId?: string;
  serviceId?: string;
  serviceName: string;
  totalAmount: number;
  payments: PaymentSplitItem[];
  notes?: string;
  createdBy: string;
  createdByName?: string;
}

/**
 * Record a transaction supporting multiple payment methods in one receipt
 * and updating patient's outstanding balance
 */
export async function recordSplitPayment(
  params: RecordSplitPaymentParams
): Promise<ClinicTransaction> {
  const {
    organizationId,
    patientName,
    patientPhone,
    patientRecordId,
    serviceId,
    serviceName,
    totalAmount,
    payments,
    notes,
    createdBy,
    createdByName
  } = params;

  const today = getTodayDateString();
  const nowIso = new Date().toISOString();
  const cleanPhone = normalizePhoneNumber(patientPhone);

  const totalPaid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const remaining = Math.max(0, totalAmount - totalPaid);

  let paymentStatus: PaymentStatus = "UNPAID";
  if (remaining === 0 && totalPaid > 0) {
    paymentStatus = "PAID";
  } else if (totalPaid > 0) {
    paymentStatus = "PARTIAL";
  }

  // Primary method for backward compatibility
  const primaryMethod = payments.length > 0 ? payments[0].method : "CASH";

  const txData: Omit<ClinicTransaction, "id"> = {
    organizationId,
    patientName: sanitizeInput(patientName),
    patientPhone: cleanPhone,
    patientRecordId: patientRecordId || "",
    date: today,
    serviceId: serviceId || "",
    serviceName: sanitizeInput(serviceName || "كشف"),
    totalAmount: Number(totalAmount) || 0,
    paidAmount: totalPaid,
    remainingAmount: remaining,
    paymentStatus,
    paymentMethod: primaryMethod,
    paymentMethodsBreakdown: payments,
    notes: notes ? sanitizeInput(notes) : "",
    createdBy: createdBy || "",
    createdByName: createdByName || "",
    createdAt: nowIso,
    updatedAt: nowIso
  };

  const txCol = collection(db, "clinic_transactions");
  const orgTxRef = doc(db, `organizations/${organizationId}/transactions`, `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
  
  const [docRef] = await Promise.all([
    addDoc(txCol, removeUndefinedFields(txData)),
    setDoc(orgTxRef, removeUndefinedFields({ id: orgTxRef.id, ...txData })).catch(() => {})
  ]);
  const newTx: ClinicTransaction = { id: docRef.id, ...txData };

  // Atomically adjust patient's outstanding balance in patient file without heavy 50-doc scan
  if (cleanPhone && remaining > 0) {
    const fileRef = doc(db, "doctors", organizationId, "patientFiles", cleanPhone);
    setDoc(fileRef, { totalOutstandingBalance: increment(remaining) }, { merge: true }).catch((err) => {
      console.warn("Could not sync balance to patient file:", err);
    });
  }

  // Atomically update daily session revenue & metrics (non-blocking, zero extra read roundtrips)
  try {
    const sessionRef = doc(db, "doctors", organizationId, "dailySessions", today);
    updateDoc(sessionRef, {
      totalRevenue: increment(totalAmount),
      totalCollected: increment(totalPaid),
      outstandingBalance: increment(remaining)
    }).catch(() => {
      // Fallback if session doc not yet created
    });
  } catch {
    // Non-blocking
  }

  return newTx;
}

// ============================================================================
// PRESCRIPTION SYSTEM (PAPER PHOTO & DIGITAL RX) & TEMPLATES
// ============================================================================

/**
 * Save a new prescription (Paper photo or Digital) for a patient.
 * Persists to both unified patient collection and doctor's patientFiles for fast offline/online lookup.
 */
export async function savePatientPrescription(
  patientIdOrPhone: string,
  prescriptionData: {
    patientId?: string;
    patientName?: string;
    patientPhone?: string;
    doctorId: string;
    doctorName?: string;
    clinicName?: string;
    date: string;
    type: 'paper_photo' | 'digital' | 'template';
    photoBase64?: string;
    thumbnailBase64?: string;
    diagnosis?: string;
    medicines?: PrescriptionMedicineItem[];
    manualText?: string;
    notes?: string;
    createdByUid?: string;
    createdByName?: string;
    sizeKb?: number;
  }
): Promise<PrescriptionRecord> {
  const cleanPhone = normalizePhoneNumber(patientIdOrPhone) || patientIdOrPhone;
  const nowIso = new Date().toISOString();
  const rxCol = collection(db, "patients", cleanPhone, "prescriptions");
  const newDocRef = doc(rxCol);
  const rxId = newDocRef.id;

  const record: PrescriptionRecord = {
    id: rxId,
    patientId: cleanPhone,
    patientName: prescriptionData.patientName || "",
    patientPhone: cleanPhone,
    doctorId: prescriptionData.doctorId,
    doctorName: prescriptionData.doctorName || "",
    clinicName: prescriptionData.clinicName || "",
    date: prescriptionData.date || getTodayDateString(),
    type: prescriptionData.type,
    photoBase64: prescriptionData.photoBase64 || "",
    thumbnailBase64: prescriptionData.thumbnailBase64 || "",
    diagnosis: prescriptionData.diagnosis || "",
    medicines: prescriptionData.medicines || [],
    manualText: prescriptionData.manualText || "",
    notes: prescriptionData.notes || "",
    createdAt: nowIso,
    createdByUid: prescriptionData.createdByUid || prescriptionData.doctorId,
    createdByName: prescriptionData.createdByName || "",
    sizeKb: prescriptionData.sizeKb || 0
  };

  const safeData = removeUndefinedFields(record);

  // 1. Primary write to patients/{cleanPhone}/prescriptions/{rxId}
  await setDoc(newDocRef, safeData);

  // 2. Also save to doctors/{doctorId}/patientFiles/{cleanPhone}/prescriptions/{rxId}
  try {
    const docFileRxRef = doc(db, "doctors", prescriptionData.doctorId, "patientFiles", cleanPhone, "prescriptions", rxId);
    await setDoc(docFileRxRef, safeData);
  } catch (err) {
    console.warn("Could not mirror prescription to doctor patientFile:", err);
  }

  // 3. Link last prescription info in patient medical file
  try {
    const fileRef = doc(db, "doctors", prescriptionData.doctorId, "patientFiles", cleanPhone);
    await setDoc(fileRef, removeUndefinedFields({
      updatedAt: nowIso,
      lastPrescriptionDate: record.date,
      lastPrescriptionType: record.type
    }), { merge: true });
  } catch (err) {
    console.warn("Could not update lastPrescriptionDate on patientFile:", err);
  }

  return record;
}

/**
 * Retrieve all prescriptions (photos and digital) for a patient.
 */
export async function getPatientPrescriptions(
  patientIdOrPhone: string,
  doctorId?: string
): Promise<PrescriptionRecord[]> {
  const cleanPhone = normalizePhoneNumber(patientIdOrPhone) || patientIdOrPhone;
  const list: PrescriptionRecord[] = [];
  const seenIds = new Set<string>();

  // 1. Try unified patient collection
  try {
    const rxCol = collection(db, "patients", cleanPhone, "prescriptions");
    const snap = await getDocs(query(rxCol, orderBy("createdAt", "desc"), limit(50)));
    snap.forEach((d) => {
      seenIds.add(d.id);
      list.push({ id: d.id, ...d.data() } as PrescriptionRecord);
    });
  } catch (err) {
    console.warn("Could not read from patients/{phone}/prescriptions:", err);
  }

  // 2. Fallback / merge from doctors/{doctorId}/patientFiles/{cleanPhone}/prescriptions
  if (doctorId) {
    try {
      const docRxCol = collection(db, "doctors", doctorId, "patientFiles", cleanPhone, "prescriptions");
      const docSnap = await getDocs(query(docRxCol, orderBy("createdAt", "desc"), limit(50)));
      docSnap.forEach((d) => {
        if (!seenIds.has(d.id)) {
          seenIds.add(d.id);
          list.push({ id: d.id, ...d.data() } as PrescriptionRecord);
        }
      });
    } catch (err) {
      console.warn("Could not read from doctor patientFiles prescriptions:", err);
    }
  }

  // Sort descending by date / createdAt
  list.sort((a, b) => (b.createdAt || b.date).localeCompare(a.createdAt || a.date));
  return list;
}

/**
 * Delete a prescription (both paper photo or digital)
 */
export async function deletePatientPrescription(
  patientIdOrPhone: string,
  prescriptionId: string,
  doctorId?: string
): Promise<void> {
  const cleanPhone = normalizePhoneNumber(patientIdOrPhone) || patientIdOrPhone;
  try {
    const rxRef = doc(db, "patients", cleanPhone, "prescriptions", prescriptionId);
    await deleteDoc(rxRef);
  } catch (err) {
    console.warn("Could not delete from patients prescriptions:", err);
  }

  if (doctorId) {
    try {
      const docRxRef = doc(db, "doctors", doctorId, "patientFiles", cleanPhone, "prescriptions", prescriptionId);
      await deleteDoc(docRxRef);
    } catch (err) {
      console.warn("Could not delete from doctor patientFiles prescriptions:", err);
    }
  }
}

/**
 * Save or update a reusable prescription template for a doctor.
 */
export async function savePrescriptionTemplate(
  doctorId: string,
  templateData: {
    id?: string;
    title: string;
    category?: string;
    diagnosis?: string;
    medicines: PrescriptionMedicineItem[];
    instructions?: string;
  }
): Promise<PrescriptionTemplate> {
  const nowIso = new Date().toISOString();
  const colRef = collection(db, "doctors", doctorId, "templates");
  const docRef = templateData.id ? doc(colRef, templateData.id) : doc(colRef);

  const template: PrescriptionTemplate = {
    id: docRef.id,
    doctorId,
    title: templateData.title.trim(),
    category: templateData.category?.trim() || "عام",
    diagnosis: templateData.diagnosis?.trim() || "",
    medicines: templateData.medicines || [],
    instructions: templateData.instructions?.trim() || "",
    createdAt: nowIso,
    updatedAt: nowIso
  };

  await setDoc(docRef, removeUndefinedFields(template), { merge: true });
  return template;
}

/**
 * Fetch all prescription templates for a doctor.
 */
export async function getDoctorPrescriptionTemplates(doctorId: string): Promise<PrescriptionTemplate[]> {
  try {
    const colRef = collection(db, "doctors", doctorId, "templates");
    const snap = await getDocs(query(colRef, orderBy("createdAt", "desc"), limit(50)));
    const list: PrescriptionTemplate[] = [];
    snap.forEach((d) => list.push({ id: d.id, ...d.data() } as PrescriptionTemplate));
    return list;
  } catch (err) {
    console.error("Error fetching prescription templates:", err);
    return [];
  }
}

/**
 * Delete a prescription template.
 */
export async function deletePrescriptionTemplate(doctorId: string, templateId: string): Promise<void> {
  const docRef = doc(db, "doctors", doctorId, "templates", templateId);
  await deleteDoc(docRef);
}

/**
 * Update patient vitals and clinical summary notes in patient file.
 */
export async function updatePatientVitalsAndNotes(
  doctorId: string,
  patientPhone: string,
  updateData: {
    vitals?: PatientVitals;
    allergies?: string;
    chronicDiseases?: string;
    generalNotes?: string;
    bloodGroup?: string;
    age?: number;
    gender?: 'male' | 'female';
    nationalId?: string;
  }
): Promise<void> {
  const cleanPhone = normalizePhoneNumber(patientPhone);
  if (!cleanPhone) return;
  const fileRef = doc(db, "doctors", doctorId, "patientFiles", cleanPhone);
  await setDoc(
    fileRef,
    removeUndefinedFields({
      ...updateData,
      updatedAt: new Date().toISOString()
    }),
    { merge: true }
  );
}
