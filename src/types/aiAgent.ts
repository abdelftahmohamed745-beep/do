import { ClinicPermission, ClinicRole, PatientRecord, ClinicTransaction, FollowUpAppointment, DailySession } from '../types';

export type AiToolName =
  // READ tools
  | 'search_patients'
  | 'get_patient_details'
  | 'get_daily_queue'
  | 'get_follow_up_appointments'
  | 'get_financial_summary'
  | 'get_active_tasks'
  | 'get_audit_logs'
  // WRITE tools (Safe)
  | 'register_patient_ticket'
  | 'call_next_patient'
  | 'update_patient_status'
  | 'schedule_follow_up'
  | 'record_patient_payment'
  | 'create_medical_order'
  | 'create_autonomous_task'
  | 'toggle_autonomous_task'
  | 'update_patient_profile'
  | 'add_patient_consultation_note'
  | 'cancel_queue_ticket'
  // SENSITIVE WRITE tools (Require confirmation or high privilege)
  | 'cancel_appointment'
  | 'mark_patient_no_show'
  | 'refund_payment';

export interface AiToolParameterSchema {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required?: boolean;
  enum?: string[];
}

export interface AiToolDefinition {
  name: AiToolName;
  descriptionAr: string;
  descriptionEn: string;
  category: 'READ' | 'WRITE' | 'SENSITIVE';
  requiredPermission: ClinicPermission;
  requiresConfirmation?: boolean;
  parameters: Record<string, AiToolParameterSchema>;
}

export interface AiToolCall {
  id: string;
  toolName: AiToolName;
  arguments: Record<string, any>;
  status: 'pending' | 'executing' | 'success' | 'failed' | 'denied' | 'awaiting_confirmation';
  error?: string;
  result?: any;
  executedAt?: string;
}

export interface AiToolResult {
  toolCallId: string;
  toolName: AiToolName;
  result?: any;
  error?: string;
  status: 'success' | 'failed' | 'denied';
}

export interface AiAgentMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  timestamp: string;
  toolCalls?: AiToolCall[];
  toolResults?: AiToolResult[];
  status?: 'thinking' | 'executing' | 'done' | 'failed' | 'needs_confirmation';
  actionSummary?: string;
}

export interface AiConversation {
  id: string;
  clinicId: string;
  userId: string;
  userName?: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  lastMessagePreview?: string;
  messages: AiAgentMessage[];
}

export type AiTriggerType = 'EVENT' | 'SCHEDULE' | 'CONDITION';

export type AiSystemEventType =
  | 'PATIENT_REGISTERED'
  | 'PATIENT_CALLED'
  | 'PATIENT_DONE'
  | 'PAYMENT_RECORDED'
  | 'SESSION_COMPLETED'
  | 'FOLLOWUP_SCHEDULED';

export type AiConditionType =
  | 'QUEUE_WAIT_TIME_EXCEEDED'
  | 'OUTSTANDING_BALANCE_EXCEEDED'
  | 'DAILY_CAPACITY_REACHED'
  | 'NO_SHOW_DETECTED';

export type AiAutonomousActionType =
  | 'SEND_REMINDER'
  | 'ALERT_STAFF'
  | 'FLAG_HIGH_BALANCE'
  | 'AUTO_CALL_NEXT'
  | 'GENERATE_SESSION_REPORT'
  | 'SCHEDULE_REVISIT';

export interface AiAutonomousTask {
  id: string;
  clinicId: string;
  title: string;
  description: string;
  triggerType: AiTriggerType;
  triggerConfig: {
    event?: AiSystemEventType;
    condition?: AiConditionType;
    threshold?: number; // e.g. 30 minutes, or 500 EGP
    scheduleTime?: string; // e.g. "21:00"
  };
  actionType: AiAutonomousActionType;
  actionConfig: {
    messageTemplate?: string;
    targetRole?: ClinicRole | 'ALL';
    severity?: 'info' | 'warning' | 'urgent';
    autoExecution?: boolean;
    [key: string]: any;
  };
  status: 'active' | 'paused' | 'completed';
  createdAt: string;
  createdBy: string;
  createdByName?: string;
  lastExecutedAt?: string;
  executionCount: number;
  lastExecutionStatus?: 'success' | 'failed';
  lastExecutionLog?: string;
}

export interface AiAuditLog {
  id: string;
  clinicId: string;
  actorUid: string;
  actorName: string;
  actorRole: ClinicRole | 'DOCTOR' | 'SYSTEM_AGENT';
  action: string;
  toolName: AiToolName | string;
  inputParameters: Record<string, any>;
  outputResult?: any;
  status: 'success' | 'failed' | 'denied';
  reason?: string;
  timestamp: string;
  clientIp?: string;
}

export interface AiAgentExecutionPlan {
  userIntent: string;
  detectedDialect?: 'egyptian_arabic' | 'standard_arabic' | 'english';
  requiredTools: AiToolName[];
  steps: {
    stepNumber: number;
    description: string;
    toolName: AiToolName;
    suggestedArguments: Record<string, any>;
    requiresConfirmation: boolean;
  }[];
}
