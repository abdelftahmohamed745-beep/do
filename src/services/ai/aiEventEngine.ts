import { db } from '../../firebase/config';
import { collection, doc, getDocs, updateDoc, query, where, limit, addDoc } from 'firebase/firestore';
import {
  AiAutonomousTask,
  AiSystemEventType,
  AiConditionType,
  AiAuditLog
} from '../../types/aiAgent';
import { getTodayDateString } from '../firebaseService';
import { addInAppNotification } from '../fcmService';

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

// Idempotency execution map: dedupeKey -> executionTimestamp
const recentExecutionTracker = new Map<string, number>();
const DEDUPLICATION_WINDOW_MS = 60000; // 60-second window to prevent duplicate execution

export function clearExecutionDeduplicationCache(): void {
  recentExecutionTracker.clear();
}

export function isEventRecentlyExecuted(dedupeKey: string): boolean {
  const lastTime = recentExecutionTracker.get(dedupeKey);
  if (!lastTime) return false;
  return Date.now() - lastTime < DEDUPLICATION_WINDOW_MS;
}

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
    if (task.triggerType === 'EVENT') {
      if (task.triggerConfig?.event === eventType) {
        shouldTrigger = true;
        triggerReason = `حدث النظام: ${eventType}`;
      }
    }

    // Check Condition Trigger (wait time, high balance, capacity, no-show)
    if (task.triggerType === 'CONDITION') {
      const condition = task.triggerConfig?.condition;
      const threshold = Number(task.triggerConfig?.threshold || 0);

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
      } else if (condition === 'NO_SHOW_DETECTED' && (eventType === 'NO_SHOW_DETECTED' || event.metadata?.isNoShow)) {
        shouldTrigger = true;
        triggerReason = `تم رصد تخلف المريض (${event.patientName || 'المريض'}) عن الحضور`;
      } else if (condition === 'DAILY_CAPACITY_REACHED' && event.metadata?.queueCount !== undefined) {
        if (Number(event.metadata.queueCount) >= threshold) {
          shouldTrigger = true;
          triggerReason = `بلغ إجمالي المسجلين بالطابور (${event.metadata.queueCount}) الحد الأقصى للطاقة الاستيعابية (${threshold})`;
        }
      }
    }

    if (shouldTrigger) {
      // Idempotency / Duplicate Execution Guard
      const targetEntity = event.ticketId || event.patientId || (event.amount !== undefined ? `amt_${event.amount}` : (event.waitingMinutes !== undefined ? `wait_${event.waitingMinutes}` : 'general'));
      const dedupeKey = `${task.id}:${event.eventType || 'CONDITION'}:${targetEntity}`;

      if (isEventRecentlyExecuted(dedupeKey)) {
        console.log(`[Event Engine] Duplicate trigger prevented for task [${task.id}] - already executed recently.`);
        continue;
      }
      recentExecutionTracker.set(dedupeKey, Date.now());

      // Execute the Autonomous Action
      let executionLog = '';
      let isSuccess = true;

      try {
        switch (task.actionType) {
          case 'ALERT_STAFF':
            executionLog = `[تنبيه الفريق]: ${task.actionConfig?.messageTemplate || 'تنبيه آلي من دوري'} - ${triggerReason}`;
            try {
              await addInAppNotification(
                clinicId,
                task.title,
                task.actionConfig?.messageTemplate || `${task.title} - ${triggerReason}`,
                'system',
                event.ticketId,
                clinicId
              );
            } catch (notifErr) {
              console.warn('[Event Engine] In-app notification notice:', notifErr);
            }
            break;

          case 'SEND_REMINDER':
            executionLog = `[تذكير مريض]: تم تحضير رسالة تذكير للمريض ${event.patientName || ''} - ${triggerReason}`;
            try {
              await addInAppNotification(
                clinicId,
                `تذكير مريض: ${event.patientName || ''}`,
                task.actionConfig?.messageTemplate || `تذكير للمريض بموعده أو المتابعة: ${triggerReason}`,
                'system',
                event.ticketId,
                clinicId
              );
            } catch {}
            break;

          case 'FLAG_HIGH_BALANCE':
            executionLog = `[إشارة تدقيق مالي]: تم تصنيف حساب المريض ${event.patientName || ''} بمستحقات مالية مرتفعة (${event.amount || 0} ج)`;
            if (event.ticketId) {
              try {
                const ticketRef = doc(db, 'queues', clinicId, 'patients', event.ticketId);
                await updateDoc(ticketRef, {
                  hasHighBalanceAlert: true,
                  highBalanceAmount: event.amount || 0
                });
              } catch (flagErr) {
                console.warn('[Event Engine] Flag high balance write notice:', flagErr);
              }
            }
            break;

          case 'AUTO_CALL_NEXT':
            executionLog = `[نداء آلي]: تم تفعيل النداء التلقائي للمريض التالي - ${triggerReason}`;
            try {
              await addInAppNotification(
                clinicId,
                'نداء آلي على المريض التالي',
                `قام وكيل دوري الذاتي بطلب نداء المريض التالي في الطابور: ${triggerReason}`,
                'system'
              );
            } catch {}
            break;

          case 'GENERATE_SESSION_REPORT':
            executionLog = `[تقرير اليومية]: تم إصدار وتوثيق ملخص نهاية الوردية تلقائياً`;
            try {
              await addInAppNotification(
                clinicId,
                'تقرير اليومية الآلي',
                `تم إصدار وتوثيق ملخص الوردية تلقائياً بواسطة وكيل دوري الذاتي`,
                'system'
              );
            } catch {}
            break;

          case 'SCHEDULE_REVISIT':
            executionLog = `[جدولة إعادة كشف]: تم اقتراح موعد متابعة للمريض ${event.patientName || ''}`;
            try {
              await addInAppNotification(
                clinicId,
                'مقترح موعد استشارة',
                `يوصي وكيل دوري بتسجيل موعد متابعة للمريض ${event.patientName || ''}: ${triggerReason}`,
                'system',
                event.ticketId
              );
            } catch {}
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

        // Write Audit Log with stable ID
        const auditLog: AiAuditLog = {
          id: `ai_auto_${task.id}_${Date.now()}`,
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
        if (waitingMinutes > 0) {
          dispatchClinicEvent({
            clinicId,
            eventType: 'PATIENT_CALLED',
            patientId: p.patientId || d.id,
            patientName: p.name,
            patientPhone: p.phone,
            ticketId: d.id,
            waitingMinutes,
            metadata: { isWaitingCheck: true, waitingMinutes }
          }).catch(console.error);
        }
      }
    });
  } catch (err) {
    console.warn('Error in periodic queue condition check:', err);
  }
}
