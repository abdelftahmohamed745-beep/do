import type {
  AiAutonomousTask,
  AiTriggerType,
  AiSystemEventType,
  AiConditionType,
  AiAutonomousActionType,
  ClinicRole
} from '../../types/aiAgent.ts';

const VALID_TRIGGER_TYPES: AiTriggerType[] = ['EVENT', 'SCHEDULE', 'CONDITION'];
const VALID_ACTION_TYPES: AiAutonomousActionType[] = [
  'SEND_REMINDER',
  'ALERT_STAFF',
  'FLAG_HIGH_BALANCE',
  'AUTO_CALL_NEXT',
  'GENERATE_SESSION_REPORT',
  'SCHEDULE_REVISIT'
];

/**
 * Deep sanitization function to guarantee that NO unsupported 'undefined' values
 * reach Firestore, while preserving intentional 'null' semantics, arrays, and nested structures.
 */
export function sanitizeFirestorePayload<T extends Record<string, any>>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj
      .filter((item) => item !== undefined)
      .map((item) => (item !== null && typeof item === 'object' && !(item instanceof Date) ? sanitizeFirestorePayload(item) : item)) as unknown as T;
  }

  const clean: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val === undefined) {
      continue; // Drop undefined values
    }
    if (val !== null && typeof val === 'object' && !(val instanceof Date)) {
      clean[key] = sanitizeFirestorePayload(val);
    } else {
      clean[key] = val; // Preserves intentional null, strings, numbers, booleans, Dates
    }
  }
  return clean as T;
}

export interface TaskValidationResult {
  valid: boolean;
  task?: Omit<AiAutonomousTask, 'id'>;
  error?: string;
  fieldErrors?: Record<string, string>;
}

/**
 * Authoritative, centralized validator and normalizer for autonomous clinic tasks.
 * Validates required business fields and strips unsupported undefined values.
 */
export function validateAndNormalizeTask(
  rawTask: any,
  clinicId: string,
  actor: { uid: string; name?: string }
): TaskValidationResult {
  const fieldErrors: Record<string, string> = {};

  if (!clinicId || typeof clinicId !== 'string' || !clinicId.trim()) {
    fieldErrors.clinicId = 'معرف العيادة (clinicId) مطلوب';
  }

  const title = typeof rawTask?.title === 'string' ? rawTask.title.trim() : '';
  if (!title) {
    fieldErrors.title = 'عنوان المهمة الآلية مطلوب';
  } else if (title.length < 2) {
    fieldErrors.title = 'عنوان المهمة قصير جداً (حرفان على الأقل)';
  } else if (title.length > 200) {
    fieldErrors.title = 'عنوان المهمة طويل جداً (الحد الأقصى 200 حرف)';
  }

  const description = typeof rawTask?.description === 'string' && rawTask.description.trim()
    ? rawTask.description.trim()
    : 'قاعدة آلية مخصصة للعيادة';

  // Normalize Trigger Type
  const rawTrigger = (String(rawTask?.triggerType || 'EVENT')).toUpperCase() as AiTriggerType;
  const triggerType: AiTriggerType = VALID_TRIGGER_TYPES.includes(rawTrigger) ? rawTrigger : 'EVENT';

  // Normalize Trigger Config (omitting absent optional properties completely)
  const rawTriggerCfg = rawTask?.triggerConfig || {};
  const triggerConfig: AiAutonomousTask['triggerConfig'] = {};

  if (rawTriggerCfg.event && typeof rawTriggerCfg.event === 'string' && rawTriggerCfg.event.trim()) {
    triggerConfig.event = rawTriggerCfg.event.trim() as AiSystemEventType;
  }
  if (rawTriggerCfg.condition && typeof rawTriggerCfg.condition === 'string' && rawTriggerCfg.condition.trim()) {
    triggerConfig.condition = rawTriggerCfg.condition.trim() as AiConditionType;
  }
  if (rawTriggerCfg.threshold !== undefined && rawTriggerCfg.threshold !== null && rawTriggerCfg.threshold !== '') {
    const num = Number(rawTriggerCfg.threshold);
    if (!isNaN(num) && isFinite(num)) {
      triggerConfig.threshold = num;
    }
  }
  if (rawTriggerCfg.scheduleTime && typeof rawTriggerCfg.scheduleTime === 'string' && rawTriggerCfg.scheduleTime.trim()) {
    triggerConfig.scheduleTime = rawTriggerCfg.scheduleTime.trim();
  }

  // Normalize Action Type
  const rawAction = (String(rawTask?.actionType || 'ALERT_STAFF')).toUpperCase() as AiAutonomousActionType;
  const actionType: AiAutonomousActionType = VALID_ACTION_TYPES.includes(rawAction) ? rawAction : 'ALERT_STAFF';

  // Normalize Action Config (omitting absent optional properties completely)
  const rawActionCfg = rawTask?.actionConfig || {};
  const actionConfig: AiAutonomousTask['actionConfig'] = {
    severity: (rawActionCfg.severity === 'info' || rawActionCfg.severity === 'urgent' ? rawActionCfg.severity : 'warning'),
    autoExecution: rawActionCfg.autoExecution !== false
  };

  if (rawActionCfg.messageTemplate && typeof rawActionCfg.messageTemplate === 'string' && rawActionCfg.messageTemplate.trim()) {
    actionConfig.messageTemplate = rawActionCfg.messageTemplate.trim();
  }
  if (rawActionCfg.targetRole && typeof rawActionCfg.targetRole === 'string' && rawActionCfg.targetRole.trim()) {
    actionConfig.targetRole = rawActionCfg.targetRole.trim() as ClinicRole | 'ALL';
  }

  // Status
  const rawStatus = String(rawTask?.status || 'active').toLowerCase();
  const status: 'active' | 'paused' | 'completed' =
    rawStatus === 'paused' ? 'paused' : rawStatus === 'completed' ? 'completed' : 'active';

  const actorUid = actor?.uid || rawTask?.createdBy || 'system';
  const actorName = actor?.name || rawTask?.createdByName || undefined;

  if (Object.keys(fieldErrors).length > 0) {
    const firstMsg = Object.values(fieldErrors)[0];
    return {
      valid: false,
      error: firstMsg,
      fieldErrors
    };
  }

  const taskPayload: Omit<AiAutonomousTask, 'id'> = {
    clinicId: clinicId.trim(),
    title,
    description,
    triggerType,
    triggerConfig,
    actionType,
    actionConfig,
    status,
    createdAt: new Date().toISOString(),
    createdBy: actorUid,
    executionCount: 0,
    schemaVersion: 1
  };

  if (rawTask?.definitionId && typeof rawTask.definitionId === 'string' && rawTask.definitionId.trim()) {
    taskPayload.definitionId = rawTask.definitionId.trim();
  }

  if (actorName) {
    taskPayload.createdByName = actorName;
  }

  // Deep sanitize payload
  const cleanTask = sanitizeFirestorePayload(taskPayload);

  return {
    valid: true,
    task: cleanTask
  };
}
