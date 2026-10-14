import {
  AutomationDefinition,
  AiAutonomousTask,
  AiTriggerType,
  AiSystemEventType,
  AiConditionType,
  AiAutonomousActionType
} from '../../types/aiAgent.ts';
import { ClinicMember } from '../../types.ts';
import { hasPermission } from '../../utils/permissions.ts';

// Maximum limits for security and database hygiene
export const MAX_DEFINITION_NAME_LENGTH = 120;
export const MAX_DEFINITION_DESC_LENGTH = 500;
export const MAX_CONFIG_FIELDS_COUNT = 15;

/**
 * Built-in Trigger Definitions (Immurable, clinic-agnostic standards)
 */
export const BUILT_IN_TRIGGER_DEFINITIONS: AutomationDefinition[] = [
  {
    id: 'builtin_trig_queue_wait',
    clinicId: 'SYSTEM',
    name: 'تجاوز وقت الانتظار المحدد للطابور',
    description: 'يتحقق من وقت انتظار المرضى في غرفة الانتظار ويرسل إشعاراً عند تخطي الحد المحدد بالدقائق.',
    kind: 'TRIGGER',
    handlerId: 'QUEUE_WAIT_TIME_EXCEEDED',
    category: 'الطابور',
    isBuiltIn: true,
    status: 'active',
    supportedTriggerKind: 'CONDITION',
    schemaVersion: 1,
    configFields: [
      {
        key: 'threshold',
        labelAr: 'الحد الأقصى للانتظار (بالدقائق)',
        type: 'number',
        required: true,
        defaultValue: 30,
        min: 5,
        max: 300,
        descriptionAr: 'عدد الدقائق التي إذا تجاوزها المريض في الانتظار يتم تفعيل التنبيه'
      }
    ],
    defaultConfig: { threshold: 30 },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'builtin_trig_high_balance',
    clinicId: 'SYSTEM',
    name: 'تجاوز المتبقي المالي للحد المسموح',
    description: 'يراقب المبالغ المتبقية غير المسددة على المريض عند إنهاء الكشف أو المعاملات المالية.',
    kind: 'TRIGGER',
    handlerId: 'OUTSTANDING_BALANCE_EXCEEDED',
    category: 'المالية',
    isBuiltIn: true,
    status: 'active',
    supportedTriggerKind: 'CONDITION',
    schemaVersion: 1,
    configFields: [
      {
        key: 'threshold',
        labelAr: 'المبلغ المتبقي الحرج (بالجنيه)',
        type: 'number',
        required: true,
        defaultValue: 500,
        min: 50,
        max: 50000,
        descriptionAr: 'المبلغ المالي الذي إذا تجاوزه المتبقي يتم تفعيل الإجراء'
      }
    ],
    defaultConfig: { threshold: 500 },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'builtin_trig_patient_registered',
    clinicId: 'SYSTEM',
    name: 'تسجيل أو حجز مريض جديد في الطابور',
    description: 'يتم تفعيله فور حجز تذكرة كشف جديدة للمريض في طابور اليوم.',
    kind: 'TRIGGER',
    handlerId: 'PATIENT_REGISTERED',
    category: 'المرضى',
    isBuiltIn: true,
    status: 'active',
    supportedTriggerKind: 'EVENT',
    schemaVersion: 1,
    configFields: [],
    defaultConfig: {},
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'builtin_trig_patient_done',
    clinicId: 'SYSTEM',
    name: 'اكتمال فحص وكشف المريض',
    description: 'يتم تفعيله فور انتهاء جلسة الكشف الطبي مع الطبيب وتحديث حالة التذكرة إلى تم الكشف.',
    kind: 'TRIGGER',
    handlerId: 'PATIENT_DONE',
    category: 'المرضى',
    isBuiltIn: true,
    status: 'active',
    supportedTriggerKind: 'EVENT',
    schemaVersion: 1,
    configFields: [],
    defaultConfig: {},
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'builtin_trig_payment_recorded',
    clinicId: 'SYSTEM',
    name: 'تسجيل معاملة سداد مالي',
    description: 'يتم تفعيله عند تسجيل دفعة مالية جديدة في خزينة العيادة.',
    kind: 'TRIGGER',
    handlerId: 'PAYMENT_RECORDED',
    category: 'المالية',
    isBuiltIn: true,
    status: 'active',
    supportedTriggerKind: 'EVENT',
    schemaVersion: 1,
    configFields: [],
    defaultConfig: {},
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'builtin_trig_no_show',
    clinicId: 'SYSTEM',
    name: 'رصد عدم حضور مريض (No-Show)',
    description: 'يتم تفعيله عند تسجيل تخلف المريض عن الحضور في طابور اليوم.',
    kind: 'TRIGGER',
    handlerId: 'NO_SHOW_DETECTED',
    category: 'الطابور',
    isBuiltIn: true,
    status: 'active',
    supportedTriggerKind: 'CONDITION',
    schemaVersion: 1,
    configFields: [],
    defaultConfig: {},
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'builtin_trig_capacity_reached',
    clinicId: 'SYSTEM',
    name: 'بلوغ الحد الأقصى لطاقة الاستيعاب اليومية',
    description: 'يتم تفعيله عند وصول عدد المرضى المسجلين في الطابور إلى السعة القصوى المحددة.',
    kind: 'TRIGGER',
    handlerId: 'DAILY_CAPACITY_REACHED',
    category: 'الطابور',
    isBuiltIn: true,
    status: 'active',
    supportedTriggerKind: 'CONDITION',
    schemaVersion: 1,
    configFields: [
      {
        key: 'threshold',
        labelAr: 'العدد الأقصى للمرضى باليوم',
        type: 'number',
        required: true,
        defaultValue: 30,
        min: 1,
        max: 500,
        descriptionAr: 'عدد المرضى الذي عند بلوغه يعتبر الطابور ممتلئاً'
      }
    ],
    defaultConfig: { threshold: 30 },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  }
];

/**
 * Built-in Action Definitions (Immutable, clinic-agnostic standards)
 */
export const BUILT_IN_ACTION_DEFINITIONS: AutomationDefinition[] = [
  {
    id: 'builtin_act_alert_staff',
    clinicId: 'SYSTEM',
    name: 'إرسال تنبيه داخلي لطاقم العيادة',
    description: 'يقوم بإرسال إشعار فوري داخل نظام العيادة مع تحديد الفئة المستهدفة ومستوى الأهمية.',
    kind: 'ACTION',
    handlerId: 'ALERT_STAFF',
    category: 'الإشعارات',
    isBuiltIn: true,
    status: 'active',
    supportedActionKind: 'ALERT_STAFF',
    schemaVersion: 1,
    configFields: [
      {
        key: 'messageTemplate',
        labelAr: 'نص التنبيه الافتراضي',
        type: 'string',
        required: true,
        defaultValue: 'تنبيه آلي من وكيل دوري',
        descriptionAr: 'الرسالة التي ستظهر لطاقم العيادة'
      },
      {
        key: 'targetRole',
        labelAr: 'الفئة المستهدفة',
        type: 'select',
        required: false,
        defaultValue: 'ALL',
        options: [
          { value: 'ALL', labelAr: 'الجميع' },
          { value: 'DOCTOR', labelAr: 'الأطباء فقط' },
          { value: 'ASSISTANT', labelAr: 'المساعدين والتمريض' },
          { value: 'RECEPTIONIST', labelAr: 'موظفي الاستقبال' }
        ]
      },
      {
        key: 'severity',
        labelAr: 'مستوى الأهمية',
        type: 'select',
        required: false,
        defaultValue: 'warning',
        options: [
          { value: 'info', labelAr: 'معلومات عامة' },
          { value: 'warning', labelAr: 'تنبيه هام' },
          { value: 'urgent', labelAr: 'عاجل وحرج' }
        ]
      }
    ],
    defaultConfig: {
      messageTemplate: 'تنبيه آلي من وكيل دوري',
      targetRole: 'ALL',
      severity: 'warning'
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'builtin_act_send_reminder',
    clinicId: 'SYSTEM',
    name: 'تجهيز تذكير للمريض',
    description: 'يجهز رسالة تذكير للمريض بموعده أو المتابعة أو الإجراء المطلوب.',
    kind: 'ACTION',
    handlerId: 'SEND_REMINDER',
    category: 'المرضى',
    isBuiltIn: true,
    status: 'active',
    supportedActionKind: 'SEND_REMINDER',
    schemaVersion: 1,
    configFields: [
      {
        key: 'messageTemplate',
        labelAr: 'صيغة رسالة التذكير',
        type: 'string',
        required: true,
        defaultValue: 'عزيزي المريض، نذكرك بموعدك في العيادة.',
        descriptionAr: 'نص التذكير الذي يتم تجهيزه للمريض'
      }
    ],
    defaultConfig: { messageTemplate: 'عزيزي المريض، نذكرك بموعدك في العيادة.' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'builtin_act_flag_high_balance',
    clinicId: 'SYSTEM',
    name: 'إشارة تدقيق مالي على ملف المريض',
    description: 'يضع شارة تدقيق مالي بارزة على تذكرة المريض وملفه في الطابور لإعلام المحاسب والاستقبال.',
    kind: 'ACTION',
    handlerId: 'FLAG_HIGH_BALANCE',
    category: 'المالية',
    isBuiltIn: true,
    status: 'active',
    supportedActionKind: 'FLAG_HIGH_BALANCE',
    schemaVersion: 1,
    configFields: [],
    defaultConfig: {},
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'builtin_act_auto_call_next',
    clinicId: 'SYSTEM',
    name: 'النداء التلقائي على المريض التالي',
    description: 'يستدعي المريض الأول في قائمة الانتظار تلقائياً ويحدث حالته إلى داخل الكشف.',
    kind: 'ACTION',
    handlerId: 'AUTO_CALL_NEXT',
    category: 'الطابور',
    isBuiltIn: true,
    status: 'active',
    supportedActionKind: 'AUTO_CALL_NEXT',
    schemaVersion: 1,
    configFields: [],
    defaultConfig: {},
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'builtin_act_session_report',
    clinicId: 'SYSTEM',
    name: 'إصدار تقرير اليومية التشغيلي والمالي',
    description: 'يجمع إحصائيات الكشوفات والإيرادات والمصروفات ويسجل تقريراً ختامياً في سجلات العيادة.',
    kind: 'ACTION',
    handlerId: 'GENERATE_SESSION_REPORT',
    category: 'التقارير',
    isBuiltIn: true,
    status: 'active',
    supportedActionKind: 'GENERATE_SESSION_REPORT',
    schemaVersion: 1,
    configFields: [],
    defaultConfig: {},
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  }
];

export const ALL_BUILT_IN_DEFINITIONS: AutomationDefinition[] = [
  ...BUILT_IN_TRIGGER_DEFINITIONS,
  ...BUILT_IN_ACTION_DEFINITIONS
];

/**
 * Trusted Handlers Registry:
 * Maps stable handler IDs to their explicit runtime contracts.
 * Strictly prevents arbitrary strings from executing unauthorized code.
 */
export const TRUSTED_HANDLER_METADATA: Record<string, {
  kind: 'TRIGGER' | 'ACTION';
  labelAr: string;
  descriptionAr: string;
  supportedTriggerKind?: AiTriggerType;
  supportedActionKind?: AiAutonomousActionType;
  requiredPermission?: any;
}> = {
  // Triggers
  QUEUE_WAIT_TIME_EXCEEDED: {
    kind: 'TRIGGER',
    labelAr: 'تجاوز وقت الانتظار',
    descriptionAr: 'شرط يعتمد على حساب وقت انتظار المريض بالدقائق',
    supportedTriggerKind: 'CONDITION'
  },
  OUTSTANDING_BALANCE_EXCEEDED: {
    kind: 'TRIGGER',
    labelAr: 'تجاوز المتبقي المالي',
    descriptionAr: 'شرط يعتمد على رصد المبالغ غير المسددة',
    supportedTriggerKind: 'CONDITION'
  },
  PATIENT_REGISTERED: {
    kind: 'TRIGGER',
    labelAr: 'تسجيل مريض جديد',
    descriptionAr: 'حدث يصدر عند إضافة تذكرة مريض للطابور',
    supportedTriggerKind: 'EVENT'
  },
  PATIENT_DONE: {
    kind: 'TRIGGER',
    labelAr: 'انتهاء الكشف الطبي',
    descriptionAr: 'حدث يصدر عند إكمال كشف المريض',
    supportedTriggerKind: 'EVENT'
  },
  PAYMENT_RECORDED: {
    kind: 'TRIGGER',
    labelAr: 'تسجيل دفعة نقدية',
    descriptionAr: 'حدث يصدر عند استلام مبلغ في الخزينة',
    supportedTriggerKind: 'EVENT'
  },
  NO_SHOW_DETECTED: {
    kind: 'TRIGGER',
    labelAr: 'تخلف عن الحضور',
    descriptionAr: 'حدث أو شرط يصدر عند تصنيف المريض كـ No-Show',
    supportedTriggerKind: 'CONDITION'
  },
  DAILY_CAPACITY_REACHED: {
    kind: 'TRIGGER',
    labelAr: 'امتلاء الطاقة الاستيعابية',
    descriptionAr: 'شرط يتحقق عند وصول عدد المسجلين لسقف الطاقة اليومية',
    supportedTriggerKind: 'CONDITION'
  },

  // Actions
  ALERT_STAFF: {
    kind: 'ACTION',
    labelAr: 'تنبيه طاقم العمل',
    descriptionAr: 'إرسال إشعار فوري داخل النظام للفريق',
    supportedActionKind: 'ALERT_STAFF'
  },
  SEND_REMINDER: {
    kind: 'ACTION',
    labelAr: 'تجهيز تذكير للمريض',
    descriptionAr: 'إعداد إشعار أو رسالة تذكير للمريض',
    supportedActionKind: 'SEND_REMINDER'
  },
  FLAG_HIGH_BALANCE: {
    kind: 'ACTION',
    labelAr: 'وسم مالي بارز',
    descriptionAr: 'إضافة تنبيه بصري على تذكرة المريض بالانتظار',
    supportedActionKind: 'FLAG_HIGH_BALANCE'
  },
  AUTO_CALL_NEXT: {
    kind: 'ACTION',
    labelAr: 'استدعاء المريض التالي',
    descriptionAr: 'استدعاء آلي لأول مريض في قائمة الانتظار',
    supportedActionKind: 'AUTO_CALL_NEXT'
  },
  GENERATE_SESSION_REPORT: {
    kind: 'ACTION',
    labelAr: 'إصدار تقرير اليومية',
    descriptionAr: 'تجميع إحصائيات الوردية والتقرير المالي',
    supportedActionKind: 'GENERATE_SESSION_REPORT'
  },
  SCHEDULE_REVISIT: {
    kind: 'ACTION',
    labelAr: 'حجز موعد استشارة/إعادة كشف',
    descriptionAr: 'جدولة موعد زيارة لاحقة للمريض',
    supportedActionKind: 'SCHEDULE_REVISIT'
  }
};

/**
 * Validates a custom or updated AutomationDefinition.
 * Ensures identifier hygiene, length limits, valid handler linkage, and schema validation.
 */
export function validateAutomationDefinition(
  rawDef: any,
  clinicId: string,
  actor: { uid: string; name?: string }
): { valid: boolean; definition?: AutomationDefinition; error?: string } {
  if (!clinicId || typeof clinicId !== 'string' || !clinicId.trim()) {
    return { valid: false, error: 'معرف العيادة (clinicId) مطلوب لإنشاء القالب' };
  }

  const name = typeof rawDef?.name === 'string' ? rawDef.name.trim() : '';
  if (!name) {
    return { valid: false, error: 'اسم القالب/التعريف مطلوب' };
  }
  if (name.length < 2 || name.length > MAX_DEFINITION_NAME_LENGTH) {
    return { valid: false, error: `يجب أن يكون اسم القالب بين حرفين و${MAX_DEFINITION_NAME_LENGTH} حرفاً` };
  }

  const description = typeof rawDef?.description === 'string' ? rawDef.description.trim() : '';
  if (description.length > MAX_DEFINITION_DESC_LENGTH) {
    return { valid: false, error: `وصف القالب يجب ألا يتجاوز ${MAX_DEFINITION_DESC_LENGTH} حرفاً` };
  }

  const kind = rawDef?.kind === 'ACTION' ? 'ACTION' : 'TRIGGER';
  const handlerId = String(rawDef?.handlerId || '').trim();

  // Explicit Handler Verification: Must match a trusted implementation
  const trustedHandler = TRUSTED_HANDLER_METADATA[handlerId];
  if (!trustedHandler) {
    return {
      valid: false,
      error: `معالج التنفيذ المختار (${handlerId}) غير مدعوم في النظام الموثوق. لا يمكن إنشاء قدرات تنفيذية غير معرفة مسبقاً.`
    };
  }

  if (trustedHandler.kind !== kind) {
    return {
      valid: false,
      error: `المعالج (${handlerId}) من نوع ${trustedHandler.kind} ولا يتوافق مع نوع القالب المختار (${kind}).`
    };
  }

  // Generate stable ID
  const id = rawDef?.id && typeof rawDef.id === 'string' && rawDef.id.startsWith('def_')
    ? rawDef.id.trim()
    : `def_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  // Validate Config Fields
  const rawFields = Array.isArray(rawDef?.configFields) ? rawDef.configFields : [];
  if (rawFields.length > MAX_CONFIG_FIELDS_COUNT) {
    return { valid: false, error: `عدد حقول الإعدادات يجب ألا يتجاوز ${MAX_CONFIG_FIELDS_COUNT}` };
  }

  const cleanFields = rawFields.map((f: any) => ({
    key: String(f.key || '').trim(),
    labelAr: String(f.labelAr || '').trim() || String(f.key || ''),
    type: ['string', 'number', 'boolean', 'select', 'time'].includes(f.type) ? f.type : 'string',
    required: Boolean(f.required),
    defaultValue: f.defaultValue,
    options: Array.isArray(f.options) ? f.options : undefined,
    min: typeof f.min === 'number' ? f.min : undefined,
    max: typeof f.max === 'number' ? f.max : undefined,
    descriptionAr: f.descriptionAr ? String(f.descriptionAr).trim() : undefined
  })).filter((f: any) => f.key.length > 0);

  const cleanDefinition: AutomationDefinition = {
    id,
    clinicId: clinicId.trim(),
    name,
    description: description || `قالب ${kind === 'TRIGGER' ? 'مشغل' : 'إجراء'} مخصص`,
    kind,
    handlerId,
    category: typeof rawDef?.category === 'string' && rawDef.category.trim() ? rawDef.category.trim() : (kind === 'TRIGGER' ? 'مخصص' : 'إجراءات'),
    isBuiltIn: false,
    status: rawDef?.status === 'disabled' ? 'disabled' : 'active',
    supportedTriggerKind: trustedHandler.supportedTriggerKind,
    supportedActionKind: trustedHandler.supportedActionKind,
    schemaVersion: 1,
    configFields: cleanFields,
    defaultConfig: typeof rawDef?.defaultConfig === 'object' && rawDef.defaultConfig !== null ? rawDef.defaultConfig : {},
    createdAt: rawDef?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: actor.uid,
    createdByName: actor.name
  };

  return {
    valid: true,
    definition: cleanDefinition
  };
}
