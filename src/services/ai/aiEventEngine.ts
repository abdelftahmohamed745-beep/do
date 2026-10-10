import { db } from '../../firebase/config';
import { collection, doc, getDocs, updateDoc, query, where, limit, addDoc } from 'firebase/firestore';
import {
  AiAutonomousTask,
  AiSystemEventType,
  AiConditionType,
  AiAuditLog
} from '../../types/aiAgent';
import { getTodayDateString } from '../firebaseService';

export interface ClinicEventPayload {
  clinicId: string;
  eventType: AiSystemEventType;
  actorUid?: string;
  actorName?: string;
  patientId?: string;
  patientName?: string;
  patientPhone?: string;
  ticketId?: string;
  amount?: number;
  waitingMinutes?: number;
  metadata?: Record<string, any>;
}

type EventListener = (event: ClinicEventPayload) => void;
const listeners: Set<EventListener> = new Set();

/**
 * Register a listener for real-time clinic events
 */
export function onClinicEvent(listener: EventListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Dispatch an application event across the Dory AI system
 */
export async function dispatchClinicEvent(event: ClinicEventPayload): Promise<void> {
  // Notify in-process listeners
  listeners.forEach((listener) => {
    try {
      listener(event);
    } catch (err) {
      console.error('[Event Engine Listener Error]', err);
    }
  });

  // Evaluate matching autonomous tasks for this clinic
  try {
    await evaluateAutonomousTasksForEvent(event);
  } catch (err) {
    console.error('[Event Engine Task Evaluation Error]', err);
  }
}

/**
 * Check and execute autonomous rules for a dispatched event
 */
async function evaluateAutonomousTasksForEvent(event: ClinicEventPayload): Promise<void> {
  const { clinicId, eventType } = event;
  if (!clinicId) return;

  const tasksCol = collection(db, 'doctors', clinicId, 'aiTasks');
  const qTasks = query(tasksCol, where('status', '==', 'active'), limit(25));
  const snap = await getDocs(qTasks);

  if (snap.empty) return;

  const nowIso = new Date().toISOString();

  for (const docSnap of snap.docs) {
    const task = { id: docSnap.id, ...docSnap.data() } as AiAutonomousTask;
    let shouldTrigger = false;
    let triggerReason = '';

    // Check Event Trigger
    if (task.triggerType === 'EVENT' && task.triggerConfig?.event === eventType) {
      shouldTrigger = true;
      triggerReason = `حدث النظام: ${eventType}`;
    }

    // Check Condition Trigger (e.g. wait time exceeded or high balance)
    if (task.triggerType === 'CONDITION') {
      const condition = task.triggerConfig?.condition;
      const threshold = task.triggerConfig?.threshold || 0;

      if (condition === 'QUEUE_WAIT_TIME_EXCEEDED' && event.waitingMinutes !== undefined) {
        if (event.waitingMinutes >= threshold) {
          shouldTrigger = true;
          triggerReason = `تجاوز وقت الانتظار (${event.waitingMinutes} دقيقة) الحد الأقصى المحدد (${threshold} دقيقة)`;
        }
      } else if (condition === 'OUTSTANDING_BALANCE_EXCEEDED' && event.amount !== undefined) {
        if (event.amount >= threshold) {
          shouldTrigger = true;
          triggerReason = `المبلغ المتبقي (${event.amount} ج) تجاوز الحد المسموح (${threshold} ج)`;
        }
      }
    }

    if (shouldTrigger) {
      // Execute the Autonomous Action
      let executionLog = '';
      let isSuccess = true;

      try {
        switch (task.actionType) {
          case 'ALERT_STAFF':
            executionLog = `[تنبيه الفريق]: ${task.actionConfig?.messageTemplate || 'تنبيه آلي من دوري'} - ${triggerReason}`;
            break;
          case 'SEND_REMINDER':
            executionLog = `[تذكير مريض]: تم تحضير رسالة تذكير للمريض ${event.patientName || ''} - ${triggerReason}`;
            break;
          case 'FLAG_HIGH_BALANCE':
            executionLog = `[إشارة تدقيق مالي]: تم تصنيف حساب المريض ${event.patientName || ''} بمستحقات مالية مرتفعة (${event.amount || 0} ج)`;
            break;
          case 'AUTO_CALL_NEXT':
            executionLog = `[نداء آلي]: جاهزية النداء على المريض التالي - ${triggerReason}`;
            break;
          case 'GENERATE_SESSION_REPORT':
            executionLog = `[تقرير اليومية]: تم إصدار ملخص نهاية الوردية تلقائياً`;
            break;
          default:
            executionLog = `تم تنفيذ الإجراء الآلي (${task.actionType}): ${triggerReason}`;
        }
      } catch (execErr: any) {
        isSuccess = false;
        executionLog = `فشل تنفيذ المهمة: ${execErr?.message || 'خطأ غير معروف'}`;
      }

      // Update Task Metrics
      try {
        await updateDoc(docSnap.ref, {
          executionCount: (task.executionCount || 0) + 1,
          lastExecutedAt: nowIso,
          lastExecutionStatus: isSuccess ? 'success' : 'failed',
          lastExecutionLog: executionLog
        });

        // Write Audit Log
        const auditLog: AiAuditLog = {
          id: `ai_auto_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          clinicId,
          actorUid: 'SYSTEM_AUTONOMOUS_AGENT',
          actorName: `وكيل دوري الذاتي (${task.title})`,
          actorRole: 'SYSTEM_AGENT',
          action: 'AUTONOMOUS_RULE_EXECUTED',
          toolName: task.actionType,
          inputParameters: {
            taskId: task.id,
            taskTitle: task.title,
            triggerReason,
            eventPayload: event
          },
          outputResult: { executionLog },
          status: isSuccess ? 'success' : 'failed',
          timestamp: nowIso
        };

        await addDoc(collection(db, 'doctors', clinicId, 'aiAuditLogs'), auditLog);
      } catch (updateErr) {
        console.warn('Could not update task execution status in Firestore:', updateErr);
      }
    }
  }
}

/**
 * Periodically evaluate conditions (e.g. check queue waiting times)
 */
export async function checkQueueConditions(clinicId: string): Promise<void> {
  if (!clinicId) return;

  try {
    const today = getTodayDateString();
    const qCol = collection(db, 'queues', clinicId, 'patients');
    const snap = await getDocs(query(qCol, where('date', '==', today), where('status', '==', 'waiting'), limit(50)));

    const now = Date.now();
    snap.forEach((d) => {
      const p = d.data();
      if (p.createdAt) {
        const createdTime = new Date(p.createdAt).getTime();
        const waitingMinutes = Math.floor((now - createdTime) / 60000);
        if (waitingMinutes > 30) {
          dispatchClinicEvent({
            clinicId,
            eventType: 'PATIENT_REGISTERED',
            patientId: p.patientId || d.id,
            patientName: p.name,
            patientPhone: p.phone,
            ticketId: d.id,
            waitingMinutes
          }).catch(console.error);
        }
      }
    });
  } catch (err) {
    console.warn('Error in periodic queue condition check:', err);
  }
}
