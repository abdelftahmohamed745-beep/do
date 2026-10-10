export type PatientStatus = 'waiting' | 'called' | 'done' | 'cancelled' | 'no_show';
export type SubscriptionStatus = 'trial' | 'active' | 'expired' | 'suspended' | 'cancelled' | 'lifetime';
export type SubscriptionPlan = 'monthly' | 'yearly' | 'custom' | 'lifetime';

export type SubscriptionDurationUnit =
  | 'minutes'
  | 'hours'
  | 'days'
  | 'weeks'
  | 'months'
  | 'years'
  | 'custom'
  | 'lifetime';

export type SubscriptionRenewalMode = 'extend' | 'now';

export type SubscriptionAuditAction =
  | 'SUBSCRIPTION_CREATED'
  | 'SUBSCRIPTION_EXTENDED'
  | 'SUBSCRIPTION_RENEWED'
  | 'SUBSCRIPTION_SHORTENED'
  | 'SUBSCRIPTION_CANCELLED'
  | 'SUBSCRIPTION_SUSPENDED'
  | 'SUBSCRIPTION_REACTIVATED'
  | 'SUBSCRIPTION_SET_LIFETIME'
  | 'SUBSCRIPTION_MODIFIED'
  | 'activate'
  | 'extend'
  | 'cancel';

export type VisitType =
  | 'new_consultation' // كشف جديد
  | 'follow_up' // استشارة
  | 're_examination' // إعادة كشف
  | 'continued_treatment' // متابعة علاج
  | 'urgent'; // كشف طارئ / مستعجل

export interface PaymentSplitItem {
  method: PaymentMethod;
  amount: number;
}

export interface DailySession {
  id: string; // YYYY-MM-DD
  doctorId: string;
  clinicId?: string;
  date: string; // YYYY-MM-DD
  dayName?: string; // e.g. "الأربعاء"
  status: 'active' | 'completed';
  startedAt: string; // ISO string
  completedAt?: string; // ISO string
  completedByUid?: string;
  completedByName?: string;
  
  // Operational counts
  patientsCount: number;
  waitingCount: number;
  inConsultationCount: number;
  completedCount: number;
  followUpsCount: number;
  noShowCount: number;
  cancelledCount: number;

  // Financial aggregates
  totalRevenue: number;
  totalCollected: number;
  outstandingCollected: number;
  outstandingBalance: number;

  // Breakdowns
  paymentBreakdown: {
    cash: number;
    card: number;
    transfer: number;
    other: number;
  };
  serviceBreakdown: Record<string, { count: number; revenue: number }>;
  summaryNotes?: string;
}

export type ClinicRole = 'OWNER' | 'DOCTOR' | 'SECRETARY' | 'STAFF';

export type ClinicPermission =
  | 'VIEW_CLINIC'
  | 'EDIT_CLINIC'
  | 'VIEW_PATIENTS'
  | 'CREATE_PATIENT'
  | 'EDIT_PATIENT'
  | 'VIEW_APPOINTMENTS'
  | 'CREATE_APPOINTMENT'
  | 'EDIT_APPOINTMENT'
  | 'MANAGE_QUEUE'
  | 'VIEW_DOCTORS'
  | 'MANAGE_DOCTORS'
  | 'VIEW_FINANCE'
  | 'MANAGE_FINANCE'
  | 'REFUND_PAYMENT'
  | 'EDIT_PRICES'
  | 'MANAGE_MEMBERS'
  | 'MANAGE_SETTINGS'
  | 'VIEW_REPORTS'
  | 'MANAGE_SUBSCRIPTION';

export interface ClinicMember {
  id: string; // Document ID (usually uid or orgId_uid)
  uid: string; // Firebase Auth User ID
  organizationId: string; // Clinic Doctor Profile ID / Organization ID
  role: ClinicRole;
  displayName: string;
  email: string;
  status: 'active' | 'disabled' | 'invited';
  createdAt: string; // ISO string
  updatedAt?: string;
  invitedBy?: string;
  customPermissions?: ClinicPermission[];
}

export interface ClinicInvitation {
  id: string; // Token / document ID (e.g., inv_123456)
  organizationId: string;
  clinicName: string;
  invitedEmail: string;
  invitedName: string;
  role: ClinicRole;
  customPermissions?: ClinicPermission[];
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  createdAt: string; // ISO string
  expiresAt: string; // ISO string
  invitedBy: string; // Owner UID
  invitedByName?: string;
  acceptedByUid?: string;
  acceptedAt?: string;
}

export interface ClinicAuditLog {
  id: string;
  organizationId: string;
  actorUid: string;
  actorName?: string;
  action:
    | 'member_added'
    | 'member_invited'
    | 'invitation_accepted'
    | 'invitation_revoked'
    | 'role_changed'
    | 'member_disabled'
    | 'member_enabled'
    | 'member_removed'
    | 'permission_updated'
    | 'payment_created'
    | 'payment_updated'
    | 'expense_created'
    | 'expense_updated'
    | 'expense_deleted'
    | 'refund_created'
    | 'service_created'
    | 'service_updated'
    | 'service_price_changed';
  targetUid?: string;
  targetEmail?: string;
  targetName?: string;
  details?: string;
  timestamp: string; // ISO string
}

export interface ClinicService {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  price: number;
  active: boolean;
  createdAt: string; // ISO string
  updatedAt?: string;
  createdBy: string;
}

export type PaymentStatus = 'UNPAID' | 'PARTIAL' | 'PAID' | 'REFUNDED';
export type PaymentMethod = 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'OTHER';

export interface ClinicTransaction {
  id: string;
  organizationId: string;
  dailySessionId?: string;
  patientId?: string;
  patientRecordId?: string;
  visitId?: string;
  date?: string; // YYYY-MM-DD
  patientName: string;
  patientPhone?: string;
  appointmentId?: string;
  serviceId?: string;
  serviceName: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number; // totalAmount - paidAmount
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  paymentMethodsBreakdown?: PaymentSplitItem[];
  notes?: string;
  createdBy: string;
  createdByName?: string;
  createdAt: string; // ISO string
  updatedAt?: string;
  refundDetails?: {
    refundAmount: number;
    reason: string;
    refundedBy: string;
    refundedByName?: string;
    refundedAt: string; // ISO string
  };
}

export type ExpenseCategory = 'RENT' | 'UTILITIES' | 'MEDICAL_SUPPLIES' | 'SALARIES' | 'MAINTENANCE' | 'OTHER';

export interface ClinicExpense {
  id: string;
  organizationId: string;
  title: string;
  category: ExpenseCategory;
  amount: number;
  note?: string;
  createdBy: string;
  createdByName?: string;
  createdAt: string; // ISO string
  updatedAt?: string;
}

export interface DoctorWorkHours {
  open: string; // e.g. "09:00"
  close: string; // e.g. "21:00"
  maxPatientsPerDay: number;
  daysOfWeek: string[]; // e.g. ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس"]
}

export interface ClinicServiceItem {
  serviceName: string;
  price: string;
}

export type AccountType = 'doctor' | 'laboratory';

export const MEDICAL_SPECIALTIES = [
  'طب أطفال',
  'باطنية وقلب',
  'جراحة عامة',
  'نسائية وتوليد',
  'طب وجراحة العيون',
  'أنف وأذن وحنجرة',
  'طب وجراحة العظام',
  'أمراض الجلدية والتناسلية',
  'طب الأسنان',
  'أورام',
  'أمراض الكلى والمجاري البولية',
  'مخ وأعصاب',
  'طب نفسي وعلاج نفسي',
  'علاج طبيعي وإعادة تأهيل',
  'مسالك بولية',
  'أمراض الغدد الصماء والسكري',
  'أمراض الجهاز الهضمي والكبد',
  'طب عام وأسرة',
  'معمل تحاليل طبية'
] as const;

export interface DoctorProfile {
  uid: string;
  accountType?: AccountType;
  referenceCode?: string; // Unique fixed clinic code e.g. REF-A1B2C3
  name: string;
  specialty: string;
  clinicName: string;
  qrCodeId: string;
  phone?: string;
  whatsappNumber?: string;
  address: string;
  city?: string;
  photoUrl?: string;
  description?: string;
  servicesAndPrices?: ClinicServiceItem[];
  clinicPhotos?: string[];
  subscriptionStatus: SubscriptionStatus;
  trialEndDate: string; // ISO date string
  subscriptionEndDate?: string; // Legacy field, kept in sync with subscriptionExpiresAt
  subscriptionExpiresAt?: string | null; // Authoritative expiration ISO timestamp (null for lifetime)
  isLifetime?: boolean; // Flag indicating lifetime subscription
  subscriptionStartedAt?: string; // ISO date string when active subscription started
  subscriptionDurationType?: SubscriptionDurationUnit;
  subscriptionDurationValue?: number;
  subscriptionLastModified?: string; // ISO timestamp of last admin action
  subscriptionModifiedBy?: string; // Admin UID or email
  subscriptionNotes?: string;
  avgConsultTime: number; // in minutes, e.g. 15
  consultationFee?: number;
  workHours: DoctorWorkHours;
  createdAt: string;
  isActive?: boolean; // Platform admin control: true = active, false = deactivated
  isAdmin?: boolean; // Platform administrator flag
  ratingAverage?: number; // e.g. 4.8
  ratingCount?: number; // e.g. 15
  latitude?: number;
  longitude?: number;
  googleMapsUrl?: string;
  isDeleted?: boolean;
  deletedAt?: string; // ISO string when soft-deleted
  deletedByAdminUid?: string;
}

export interface SubscriptionLog {
  id: string;
  clinicId: string;
  clinicName: string;
  doctorName: string;
  referenceCode: string;
  plan?: SubscriptionPlan | string;
  amount?: number; // Fixed or custom amount in EGP
  activatedAt: string; // ISO string
  expiresAt: string | null; // ISO string or null for lifetime
  previousExpiresAt?: string | null;
  previousStatus?: SubscriptionStatus;
  newStatus?: SubscriptionStatus;
  previousIsLifetime?: boolean;
  newIsLifetime?: boolean;
  durationType?: SubscriptionDurationUnit | string;
  durationValue?: number;
  renewalMode?: SubscriptionRenewalMode;
  adminId: string;
  adminEmail?: string;
  action: SubscriptionAuditAction;
  notes?: string;
  timestamp?: string;
}

export interface DoctorRating {
  id: string;
  doctorId: string;
  patientRecordId: string;
  patientName: string;
  patientPhone?: string;
  stars: number; // 1 to 5
  comment?: string;
  createdAt: string; // ISO string
}

export interface PatientRecord {
  id: string;
  patientId?: string; // Unified Patient ID (PID-XXXXXX)
  bookingReference?: string; // Short Human-Readable Booking Reference (e.g. D-4821)
  doctorId: string;
  clinicId?: string;
  userId?: string;
  sequenceNumber: number;
  queueNumber?: number;
  name: string;
  phone: string;
  status: PatientStatus;
  date: string; // YYYY-MM-DD
  serviceId?: string;
  serviceName?: string;
  visitType?: string;
  price?: number;
  paidAmount?: number;
  balanceAmount?: number;
  paymentStatus?: string;
  createdAt: string; // ISO string
  updatedAt?: string;
  calledAt?: string; // ISO string
  doneAt?: string; // ISO string
  cancelledAt?: string; // ISO string
  estimatedMinutes?: number;
  notificationSent?: boolean;
  notificationSentAt?: string;
  notifiedForTwoTurns?: boolean;
  notifiedForOneTurn?: boolean;
  notifiedForTenMinutes?: boolean;
  notificationPreference?: NotificationTimingPreference;
  medicalOrder?: 'xray' | 'lab' | 'xray_and_lab';
  medicalOrderLabel?: string;
  medicalOrderAt?: string;
}

export interface PatientProfile {
  id: string; // Document ID (usually patientId or phone)
  patientId: string; // Standardized PID (e.g. PID-4821)
  uid?: string; // Linked Firebase Auth User ID if registered
  name: string;
  phone: string;
  nationalId?: string;
  birthDate?: string;
  age?: number;
  gender?: 'male' | 'female';
  bloodGroup?: string;
  allergies?: string;
  chronicDiseases?: string;
  emergencyContact?: string;
  accountType?: 'patient';
  createdAt: string;
  updatedAt: string;
}

export type NotificationTimingPreference = 'two_turns' | 'one_turn' | 'ten_minutes';

export interface UserNotificationSettings {
  timingPreference: NotificationTimingPreference;
  pushEnabled: boolean;
  inAppEnabled: boolean;
  fcmToken?: string;
  updatedAt?: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: 'near_turn' | 'system' | 'queue_update' | 'followup_reminder';
  bookingId?: string;
  clinicName?: string;
  isRead: boolean;
  createdAt: string;
}

export type FollowUpAppointmentStatus = 'upcoming' | 'confirmed' | 'attended' | 'cancelled' | 'no_show';

export interface FollowUpReminderSettings {
  oneDayBefore: boolean;
  twoHoursBefore: boolean;
}

export interface FollowUpAppointment {
  id: string;
  patientId?: string;
  patientName: string;
  patientPhone: string;
  doctorId: string;
  doctorName?: string;
  clinicId: string;
  clinicName?: string;
  appointmentDate: string; // YYYY-MM-DD
  appointmentTime: string; // HH:mm
  notes?: string;
  reason?: string;
  reminderSettings: FollowUpReminderSettings;
  appointmentStatus: FollowUpAppointmentStatus;
  rescheduleRequested?: boolean;
  requestedNewDate?: string;
  requestedNewTime?: string;
  createdAt: string; // ISO string
  updatedAt?: string;
}

export interface QueueSummary {
  totalWaiting: number;
  totalCalled: number;
  totalDone: number;
  currentCallingNumber: number | null;
  avgConsultTime: number;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message?: string;
}

// ============================================================================
// DORY LABS TYPES
// ============================================================================

export interface LabWorkHours {
  open: string; // e.g. "08:00"
  close: string; // e.g. "22:00"
  workingDays: string[]; // e.g. ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"]
}

export interface LabProfile {
  uid: string; // Firebase Auth User ID / Lab ID
  accountType: 'laboratory';
  name: string; // اسم المعمل
  responsibleName: string; // اسم المسؤول
  phone: string;
  whatsappNumber?: string;
  email?: string;
  address: string;
  governorate?: string; // المحافظة
  district?: string; // المنطقة
  logoUrl?: string;
  description?: string;
  services?: string[]; // قائمة الخدمات المتاحة
  workHours: LabWorkHours;
  offersHomeCollection: boolean;
  homeCollectionFee?: number;
  homeCollectionNotes?: string;
  createdAt: string;
  isActive?: boolean;
  latitude?: number;
  longitude?: number;
  googleMapsUrl?: string;
  isDeleted?: boolean;
  deletedAt?: string;
  deletedByAdminUid?: string;
}

export interface PatientVisitEntry {
  id: string;
  date: string; // YYYY-MM-DD
  serviceId?: string;
  serviceName?: string;
  visitType?: string;
  price?: number;
  paidAmount?: number;
  remainingAmount?: number;
  paymentStatus?: string;
  notes?: string;
  diagnosis?: string;
  prescription?: string;
  status: PatientStatus;
  createdAt: string;
  vitals?: PatientVitals;
  paperPrescriptionUrl?: string;
  doctorNotesPrivate?: string;
}

export interface PatientVitals {
  bloodPressure?: string; // e.g. "120/80"
  heartRate?: number; // bpm
  temperature?: number; // °C
  weightKg?: number; // kg
  heightCm?: number; // cm
  bmi?: number; // kg/m²
  bloodSugar?: number; // mg/dL
  oxygenSaturation?: number; // %
  measuredAt?: string;
}

export interface PrescriptionMedicineItem {
  id?: string;
  name: string;
  dosage?: string;
  timing?: string;
  duration?: string;
  instructions?: string;
}

export interface PrescriptionRecord {
  id: string;
  patientId: string;
  patientName?: string;
  patientPhone?: string;
  doctorId: string;
  doctorName?: string;
  clinicName?: string;
  date: string; // YYYY-MM-DD
  type: 'paper_photo' | 'digital' | 'template';
  photoBase64?: string;
  thumbnailBase64?: string;
  diagnosis?: string;
  medicines?: PrescriptionMedicineItem[];
  manualText?: string;
  notes?: string;
  createdAt: string;
  createdByUid: string;
  createdByName?: string;
  sizeKb?: number;
}

export interface PrescriptionTemplate {
  id: string;
  doctorId: string;
  title: string; // e.g. "روشتة نزلة معوية حادة"
  category?: string; // e.g. "باطنة", "أطفال"
  diagnosis?: string;
  medicines: PrescriptionMedicineItem[];
  instructions?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface GrowthRecord {
  date: string; // YYYY-MM-DD
  ageMonths: number;
  weightKg: number;
  heightCm?: number;
  headCircumferenceCm?: number;
  notes?: string;
}

export interface PatientMedicalFile {
  id: string; // Document ID (usually phone number or auto-id)
  patientId?: string; // Standardized PID (e.g. PID-4821)
  doctorId: string;
  patientName: string;
  patientPhone: string;
  age?: number;
  gender?: 'male' | 'female';
  bloodGroup?: string;
  allergies?: string;
  chronicDiseases?: string;
  generalNotes?: string;
  lastVisitDate?: string;
  visitsCount: number;
  visits: PatientVisitEntry[];
  totalOutstandingBalance?: number;
  searchKeywords?: string[];
  nationalId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LabAdminView extends LabProfile {
  staffCount?: number;
  orderCount?: number;
}

export interface LabTestCatalogItem {
  id: string;
  labId: string;
  name: string; // e.g. "صورة دم كاملة (CBC)"
  category?: string; // e.g. "كيمياء الدم", "هرمونات", "مناعة", "أمراض الدم"
  price: number; // EGP
  estimatedTurnaroundHours: number; // e.g. 24
  sampleType: string; // e.g. "دم وريدي", "بول", "براز", "مسحة"
  requiresFasting: boolean;
  fastingHours?: number; // e.g. 8 - 12
  patientInstructions?: string; // e.g. "الصيام من 8-12 ساعة وشرب الماء فقط"
  description?: string;
  active: boolean;
  createdAt: string;
  updatedAt?: string;
}

export type LabOrderStatus =
  | 'NEW'
  | 'CONFIRMED'
  | 'SAMPLE_PENDING'
  | 'SAMPLE_RECEIVED'
  | 'PROCESSING'
  | 'UNDER_REVIEW'
  | 'READY'
  | 'COMPLETED'
  | 'CANCELLED';

export type CollectionMethod = 'IN_LAB' | 'HOME_COLLECTION';

export interface LabOrder {
  id: string; // Document ID
  labId: string;
  labName: string;
  orderNumber: string; // e.g. ORD-2026-000101
  patientName: string;
  patientPhone: string;
  patientAge?: number;
  patientGender?: 'male' | 'female';
  patientNotes?: string;
  collectionMethod: CollectionMethod;
  homeAddress?: string;
  homePreferredDate?: string;
  homePreferredTime?: string;
  testIds: string[];
  testNames: string[];
  totalPrice: number;
  paidAmount: number;
  status: LabOrderStatus;
  assignedStaffUid?: string;
  assignedStaffName?: string;
  createdAt: string;
  updatedAt?: string;
}

export type LabSampleStatus = 'pending' | 'received' | 'processing' | 'completed' | 'rejected';

export interface LabSample {
  id: string; // Document ID / Barcode e.g. LAB-2026-000124
  sampleId: string; // LAB-2026-000124
  labId: string;
  orderId: string;
  orderNumber: string;
  patientName: string;
  patientPhone: string;
  testNames: string[];
  sampleType: string;
  status: LabSampleStatus;
  collectedAt?: string;
  receivedAt?: string;
  createdAt: string;
}

export type ResultFlag = 'normal' | 'high' | 'low' | 'critical';

export interface LabTestResultItem {
  parameterName: string; // e.g. "Hemoglobin (Hb)"
  value: string; // e.g. "13.5"
  unit: string; // e.g. "g/dL"
  referenceRange: string; // e.g. "12.0 - 16.0"
  flag: ResultFlag;
  notes?: string;
}

export type ResultPublishStatus = 'draft' | 'under_review' | 'approved' | 'published';

export interface LabTestResult {
  id: string; // Document ID
  labId: string;
  orderId: string;
  orderNumber: string;
  sampleId: string;
  patientName: string;
  patientPhone: string;
  testName: string;
  testId?: string;
  items: LabTestResultItem[];
  status: ResultPublishStatus;
  technicianUid?: string;
  technicianName?: string;
  reviewerUid?: string;
  reviewerName?: string;
  approvedAt?: string;
  generalNotes?: string;
  aiNotesSummary?: string; // AI generated simple explanation for patient
  createdAt: string;
  updatedAt?: string;
}

export type LabRole = 'OWNER' | 'MANAGER' | 'RECEPTION' | 'TECHNICIAN' | 'REVIEWER';

export interface LabStaffMember {
  id: string;
  labId: string;
  uid: string;
  displayName: string;
  email: string;
  phone?: string;
  role: LabRole;
  status: 'active' | 'disabled';
  createdAt: string;
}

export type LabFinanceType = 'REVENUE' | 'EXPENSE';

export interface LabTransaction {
  id: string;
  labId: string;
  type: LabFinanceType;
  title: string;
  amount: number;
  category?: string;
  orderId?: string;
  paymentMethod?: 'CASH' | 'CARD' | 'TRANSFER';
  notes?: string;
  createdBy: string;
  createdByName?: string;
  date: string; // YYYY-MM-DD
  createdAt: string;
}

export interface LabAuditLog {
  id: string;
  labId: string;
  actorUid: string;
  actorName?: string;
  action: string;
  targetId?: string;
  details?: string;
  timestamp: string;
}

export type AnnouncementType = 'update' | 'maintenance' | 'announcement' | 'warning' | 'new_feature' | 'feature';
export type AnnouncementTarget = 'all' | 'doctors' | 'labs' | 'staff' | 'specific';

export interface AdminAnnouncement {
  id: string;
  title: string;
  message: string;
  type: AnnouncementType;
  target: AnnouncementTarget;
  targetUid?: string;
  targetName?: string;
  actionLink?: string;
  actionLabel?: string;
  isActive: boolean;
  createdAt: string; // ISO string
  createdBy: string; // Admin UID
  createdByName?: string;
  expiresAt?: string;
}


