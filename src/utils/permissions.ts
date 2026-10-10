import { ClinicRole, ClinicPermission, ClinicMember } from '../types';

export const ALL_CLINIC_PERMISSIONS: { key: ClinicPermission; labelAr: string; category: string }[] = [
  { key: 'VIEW_CLINIC', labelAr: 'عرض بيانات العيادة', category: 'العيادة' },
  { key: 'EDIT_CLINIC', labelAr: 'تعديل بيانات وإعدادات العيادة', category: 'العيادة' },
  { key: 'VIEW_PATIENTS', labelAr: 'عرض قائمة وسجل المرضى', category: 'المرضى' },
  { key: 'CREATE_PATIENT', labelAr: 'إضافة مريض جديد', category: 'المرضى' },
  { key: 'EDIT_PATIENT', labelAr: 'تعديل بيانات المرضى', category: 'المرضى' },
  { key: 'VIEW_APPOINTMENTS', labelAr: 'عرض حجز المواعيد والكشوفات', category: 'المواعيد والطابور' },
  { key: 'CREATE_APPOINTMENT', labelAr: 'حجز موعد كشف أو إعادة كشف', category: 'المواعيد والطابور' },
  { key: 'EDIT_APPOINTMENT', labelAr: 'تعديل وإلغاء المواعيد', category: 'المواعيد والطابور' },
  { key: 'MANAGE_QUEUE', labelAr: 'إدارة الطابور والنداء الآلي', category: 'المواعيد والطابور' },
  { key: 'VIEW_DOCTORS', labelAr: 'عرض طاقم الأطباء', category: 'الأطباء والكادر' },
  { key: 'MANAGE_DOCTORS', labelAr: 'إدارة وتعديل بيانات الأطباء', category: 'الأطباء والكادر' },
  { key: 'VIEW_FINANCE', labelAr: 'عرض الحسابات والتقرير المالي', category: 'المالية والاشتراكات' },
  { key: 'MANAGE_FINANCE', labelAr: 'إدارة المدفوعات والاشتراكات', category: 'المالية والاشتراكات' },
  { key: 'REFUND_PAYMENT', labelAr: 'إجراء استرداد أموال الكشف', category: 'المالية والاشتراكات' },
  { key: 'EDIT_PRICES', labelAr: 'تعديل أسعار الكشوفات والخدمات', category: 'المالية والاشتراكات' },
  { key: 'MANAGE_MEMBERS', labelAr: 'إدارة الأعضاء والصلاحيات', category: 'الإدارة العليا' },
  { key: 'MANAGE_SETTINGS', labelAr: 'تعديل إعدادات العيادة المتقدمة', category: 'الإدارة العليا' },
  { key: 'VIEW_REPORTS', labelAr: 'عرض التقارير والإحصائيات العامة', category: 'الإدارة العليا' },
  { key: 'MANAGE_SUBSCRIPTION', labelAr: 'إدارة اشتراك العيادة بالمنصة', category: 'المالية والاشتراكات' }
];

export const ROLE_PERMISSIONS: Record<ClinicRole, ClinicPermission[]> = {
  OWNER: ALL_CLINIC_PERMISSIONS.map(p => p.key),
  DOCTOR: [
    'VIEW_CLINIC',
    'VIEW_PATIENTS', 'CREATE_PATIENT', 'EDIT_PATIENT',
    'VIEW_APPOINTMENTS', 'CREATE_APPOINTMENT', 'EDIT_APPOINTMENT',
    'MANAGE_QUEUE',
    'VIEW_DOCTORS', 'VIEW_REPORTS'
  ],
  SECRETARY: [
    'VIEW_CLINIC',
    'VIEW_PATIENTS', 'CREATE_PATIENT', 'EDIT_PATIENT',
    'VIEW_APPOINTMENTS', 'CREATE_APPOINTMENT', 'EDIT_APPOINTMENT',
    'MANAGE_QUEUE',
    'VIEW_DOCTORS'
  ],
  STAFF: [
    'VIEW_CLINIC',
    'VIEW_PATIENTS',
    'VIEW_APPOINTMENTS',
    'MANAGE_QUEUE'
  ]
};

export const ROLE_LABELS_AR: Record<ClinicRole, string> = {
  OWNER: 'مالك العيادة / المدير العام (Owner)',
  DOCTOR: 'طبيب العيادة (Doctor)',
  SECRETARY: 'سكرتارية / استقبال (Secretary)',
  STAFF: 'كادر إداري (Staff)'
};

export const ROLE_DESCRIPTIONS_AR: Record<ClinicRole, string> = {
  OWNER: 'صلاحيات كاملة لإدارة العيادة والأعضاء والاشتراكات والإعدادات',
  DOCTOR: 'إدارة المرضى والكشوفات والمواعيد والتقارير الطبية الخاصة بالعيادة',
  SECRETARY: 'إدارة استقبال المرضى وحجز وتنسيق الطابور والمواعيد اليومية',
  STAFF: 'الاطلاع على قائمة الانتظار والمواعيد وإدارة حركة الطابور المباشر'
};

/**
 * Checks if a member has a specific permission.
 * If member is null/undefined but isDoctorOwnerFallback is true (legacy doctor owner), returns true.
 */
export function hasPermission(
  member: ClinicMember | { role?: ClinicRole; customPermissions?: ClinicPermission[]; status?: string } | null | undefined,
  permission: ClinicPermission,
  isDoctorOwnerFallback: boolean = false
): boolean {
  if (isDoctorOwnerFallback) return true;
  if (!member) return false;

  if (member.status === 'disabled') return false;
  if (member.role === 'OWNER') return true;

  // If customPermissions are explicitly defined on the member document, use them as authoritative
  if (Array.isArray(member.customPermissions)) {
    return member.customPermissions.includes(permission);
  }

  // Fallback to role default permissions matrix
  const rolePerms = ROLE_PERMISSIONS[member.role as ClinicRole];
  return rolePerms ? rolePerms.includes(permission) : false;
}

