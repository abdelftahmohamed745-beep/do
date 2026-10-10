import { db } from '../../firebase/config';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  limit,
  orderBy,
  addDoc
} from 'firebase/firestore';
import {
  ClinicMember,
  PatientRecord,
  ClinicTransaction,
  FollowUpAppointment
} from '../../types';
import { hasPermission } from '../../utils/permissions';
import { AI_TOOL_DEFINITIONS } from './aiToolRegistry';
import {
  AiToolName,
  AiToolResult,
  AiAutonomousTask,
  AiAuditLog
} from '../../types/aiAgent';
import {
  searchClinicPatientsFast,
  getPatientProfile,
  getTodayDateString,
  bookPatient,
  callNextPatient,
  updatePatientStatus,
  createFollowUpAppointment,
  recordSplitPayment,
  recordPatientMedicalOrder,
  refundClinicTransaction,
  markQueuePatientNoShow,
  updateFollowUpAppointmentStatus,
  normalizePhoneNumber,
  getPatientMedicalFile,
  savePatientMedicalFile,
  addVisitToPatientMedicalFile,
  updatePatientVitalsAndNotes
} from '../firebaseService';

export interface AiToolExecutionContext {
  clinicId: string;
  member: ClinicMember | null;
  isDoctorOwner: boolean;
  isSubscriptionActive: boolean;
  confirmedActionId?: string; // If user has confirmed this specific sensitive action
  clientIp?: string;
}

/**
 * Intelligent helper to resolve a patient in today's active queue by ticket ID, phone, sequence number, or name
 */
async function resolvePatientInTodayQueue(clinicId: string, identifier: string): Promise<PatientRecord | null> {
  if (!identifier || typeof identifier !== 'string') return null;
  const cleanId = identifier.trim();
  if (!cleanId) return null;

  const today = getTodayDateString();
  const qRef = collection(db, 'queues', clinicId, 'patients');

  // 1. Try direct ticket doc ID
  try {
    const directSnap = await getDoc(doc(db, 'queues', clinicId, 'patients', cleanId));
    if (directSnap.exists()) {
      return { id: directSnap.id, ...directSnap.data() } as PatientRecord;
    }
  } catch {}

  // 2. Fetch today's queue patients to match flexibly
  try {
    const qSnap = await getDocs(query(qRef, where('date', '==', today), limit(150)));
    if (!qSnap || qSnap.empty) return null;

    const patients: PatientRecord[] = [];
    qSnap.forEach((d) => patients.push({ id: d.id, ...d.data() } as PatientRecord));

    const cleanLower = cleanId.toLowerCase();
    const cleanPhone = normalizePhoneNumber(cleanId);

    // Exact phone match
    if (cleanPhone) {
      const byPhone = patients.find((p) => normalizePhoneNumber(p.phone) === cleanPhone);
      if (byPhone) return byPhone;
    }

    // Sequence number match
    const seqNum = Number(cleanId);
    if (!isNaN(seqNum) && seqNum > 0) {
      const bySeq = patients.find((p) => p.sequenceNumber === seqNum);
      if (bySeq) return bySeq;
    }

    // Exact or partial name match
    const byNameExact = patients.find((p) => p.name.trim().toLowerCase() === cleanLower);
    if (byNameExact) return byNameExact;

    const byNamePartial = patients.filter((p) => p.name.toLowerCase().includes(cleanLower));
    if (byNamePartial.length > 0) {
      // Prioritize patient currently in the examination room or waiting
      const active = byNamePartial.find((p) => p.status === 'called' || p.status === 'waiting');
      return active || byNamePartial[0];
    }
  } catch (err) {
    console.warn('[AI Executor] resolvePatientInTodayQueue error:', err);
  }

  return null;
}

/**
 * Execute an AI Tool call with strict authorization, isolation, and audit logging
 */
export async function executeAiToolCall(
  toolName: AiToolName,
  args: Record<string, any>,
  context: AiToolExecutionContext
): Promise<AiToolResult> {
  const { clinicId, member, isDoctorOwner, isSubscriptionActive, confirmedActionId, clientIp } = context;
  const toolDef = AI_TOOL_DEFINITIONS[toolName];

  if (!toolDef) {
    return {
      toolCallId: args._toolCallId || `tc_${Date.now()}`,
      toolName,
      status: 'failed',
      error: `الأداة المطلوبة غير معرفة في نظام دوري: ${toolName}`
    };
  }

  const toolCallId = args._toolCallId || `tc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const actorUid = member?.uid || (isDoctorOwner ? clinicId : 'UNKNOWN_ACTOR');
  const actorName = member?.displayName || (isDoctorOwner ? 'مالك العيادة' : 'مساعد ذكي');
  const actorRole = member?.role || (isDoctorOwner ? 'DOCTOR' : 'STAFF');

  // 1. Permission Check
  const isAuthorized = hasPermission(member, toolDef.requiredPermission, isDoctorOwner);
  if (!isAuthorized) {
    const errorMsg = `عفواً، تم رفض الإجراء (${toolDef.descriptionAr}): لا تملك الصلاحية الكافية [${toolDef.requiredPermission}] لإتمام هذه العملية.`;
    
    // Log Security Denial
    await logAiAction({
      clinicId,
      actorUid,
      actorName,
      actorRole,
      action: 'PERMISSION_DENIED',
      toolName,
      inputParameters: args,
      status: 'denied',
      reason: errorMsg,
      clientIp
    });

    return {
      toolCallId,
      toolName,
      status: 'denied',
      error: errorMsg
    };
  }

  // 2. Subscription Status Gate for WRITE operations
  if (toolDef.category !== 'READ' && !isSubscriptionActive) {
    const errorMsg = 'لا يمكن إجراء عمليات تعديل أو حجز جديدة لأن اشتراك العيادة غير نشط أو منتهي حالياً. يرجى تجديد الاشتراك أولاً.';
    
    await logAiAction({
      clinicId,
      actorUid,
      actorName,
      actorRole,
      action: 'SUBSCRIPTION_GATE_BLOCKED',
      toolName,
      inputParameters: args,
      status: 'denied',
      reason: errorMsg,
      clientIp
    });

    return {
      toolCallId,
      toolName,
      status: 'denied',
      error: errorMsg
    };
  }

  // 3. Confirmation Requirement for SENSITIVE Tools
  if (toolDef.requiresConfirmation && confirmedActionId !== toolCallId) {
    return {
      toolCallId,
      toolName,
      status: 'failed',
      error: `هذا الإجراء حساس (${toolDef.descriptionAr}) ويتطلب تأكيداً يدوياً صريحاً من المستخدم قبل التنفيذ.`
    };
  }

  // 4. Dispatch Tool Implementation
  try {
    let result: any = null;

    switch (toolName) {
      // ----------------------------------------------------
      // READ: search_patients
      // ----------------------------------------------------
      case 'search_patients': {
        const searchTerm = String(args.searchTerm || '').trim();
        const limitCount = Number(args.limit) || 8;
        if (!searchTerm) {
          throw new Error('يرجى تقديم كلمة بحث (اسم المريض أو رقم الهاتف)');
        }
        const patients = await searchClinicPatientsFast(clinicId, searchTerm, limitCount);
        result = {
          count: patients.length,
          patients: patients.map((p) => ({
            id: p.id,
            patientName: p.patientName,
            patientPhone: p.patientPhone,
            visitsCount: p.visitsCount,
            lastVisitDate: p.lastVisitDate,
            totalOutstandingBalance: p.totalOutstandingBalance,
            allergies: p.allergies || 'لا توجد حساسية مسجلة',
            chronicDiseases: p.chronicDiseases || 'لا توجد أمراض مزمنة',
            lastVisitDiagnosis: p.lastVisitDiagnosis || 'غير محدد'
          }))
        };
        break;
      }

      // ----------------------------------------------------
      // READ: get_patient_details
      // ----------------------------------------------------
      case 'get_patient_details': {
        const queryTerm = String(args.patientIdOrPhone || args.patientName || '').trim();
        if (!queryTerm) throw new Error('اسم المريض أو رقم هاتفه أو كوده مطلوب لعرض التفاصيل');

        let cleanPhone = normalizePhoneNumber(queryTerm);

        // If not a direct phone number, resolve from today's queue or patient archive
        if (!cleanPhone) {
          const inQueue = await resolvePatientInTodayQueue(clinicId, queryTerm);
          if (inQueue?.phone) {
            cleanPhone = normalizePhoneNumber(inQueue.phone);
          } else {
            const searchResults = await searchClinicPatientsFast(clinicId, queryTerm, 1);
            if (searchResults.length > 0 && searchResults[0].patientPhone) {
              cleanPhone = normalizePhoneNumber(searchResults[0].patientPhone);
            }
          }
        }

        let profile = await getPatientProfile(queryTerm);
        if (!profile && cleanPhone) {
          profile = await getPatientProfile(cleanPhone);
        }

        // Check doctor's comprehensive patient file
        let patientFile: any = null;
        if (cleanPhone) {
          try {
            const fSnap = await getDoc(doc(db, 'doctors', clinicId, 'patientFiles', cleanPhone));
            if (fSnap.exists()) {
              patientFile = fSnap.data();
            }
          } catch (e) {
            console.warn('Could not read doctor patient file:', e);
          }
        }

        if (!profile && !patientFile) {
          result = {
            found: false,
            message: `لم يتم العثور على مريض مسجل بالبيانات: "${queryTerm}". يمكنك البحث بالاسم أو التأكد من رقم الهاتف.`
          };
        } else {
          result = {
            found: true,
            patientName: patientFile?.patientName || profile?.name || queryTerm,
            patientPhone: patientFile?.patientPhone || profile?.phone || cleanPhone,
            patientId: profile?.patientId || profile?.id || cleanPhone,
            allergies: patientFile?.allergies || profile?.allergies || 'لا توجد حساسية مسجلة',
            chronicDiseases: patientFile?.chronicDiseases || profile?.chronicDiseases || 'لا توجد أمراض مزمنة',
            bloodGroup: patientFile?.bloodGroup || profile?.bloodGroup || 'غير مسجلة',
            totalOutstandingBalance: patientFile?.totalOutstandingBalance || 0,
            visitsCount: patientFile?.visitsCount || (patientFile?.visits ? patientFile.visits.length : 0),
            pastVisits: (patientFile?.visits || []).slice(0, 5).map((v: any) => ({
              date: v.date,
              visitType: v.visitType,
              diagnosis: v.diagnosis,
              serviceName: v.serviceName,
              prescription: v.prescription,
              notes: v.notes
            }))
          };
        }
        break;
      }

      // ----------------------------------------------------
      // READ: get_daily_queue
      // ----------------------------------------------------
      case 'get_daily_queue': {
        const targetDate = args.date ? String(args.date).trim() : getTodayDateString();
        const statusFilter = args.statusFilter ? String(args.statusFilter).trim() : 'all';

        const qRef = collection(db, 'queues', clinicId, 'patients');
        const qSnap = await getDocs(query(qRef, where('date', '==', targetDate), limit(150)));

        const allPatients: PatientRecord[] = [];
        qSnap.forEach((d) => allPatients.push({ id: d.id, ...d.data() } as PatientRecord));
        allPatients.sort((a, b) => (a.sequenceNumber || 0) - (b.sequenceNumber || 0));

        let filtered = allPatients;
        if (statusFilter !== 'all') {
          filtered = allPatients.filter((p) => p.status === statusFilter);
        }

        const waiting = allPatients.filter((p) => p.status === 'waiting');
        const called = allPatients.filter((p) => p.status === 'called');
        const done = allPatients.filter((p) => p.status === 'done');
        const currentActive = called[called.length - 1] || null;

        result = {
          date: targetDate,
          totalCount: allPatients.length,
          waitingCount: waiting.length,
          calledCount: called.length,
          doneCount: done.length,
          currentPatientInRoom: currentActive
            ? {
                patientId: currentActive.id,
                sequenceNumber: currentActive.sequenceNumber,
                name: currentActive.name,
                phone: currentActive.phone,
                calledAt: currentActive.calledAt
              }
            : null,
          nextWaitingPatient: waiting[0]
            ? {
                patientId: waiting[0].id,
                sequenceNumber: waiting[0].sequenceNumber,
                name: waiting[0].name,
                phone: waiting[0].phone
              }
            : null,
          patients: filtered.map((p) => ({
            id: p.id,
            sequenceNumber: p.sequenceNumber,
            name: p.name,
            phone: p.phone,
            status: p.status,
            bookingReference: p.bookingReference || '',
            serviceName: p.serviceName || 'كشف',
            estimatedMinutes: p.estimatedMinutes
          }))
        };
        break;
      }

      // ----------------------------------------------------
      // READ: get_follow_up_appointments
      // ----------------------------------------------------
      case 'get_follow_up_appointments': {
        const targetDate = args.date ? String(args.date).trim() : '';
        const appCol = collection(db, 'followUpAppointments');
        
        let qAppointments;
        if (targetDate) {
          qAppointments = query(
            appCol,
            where('doctorId', '==', clinicId),
            where('appointmentDate', '==', targetDate),
            limit(50)
          );
        } else {
          qAppointments = query(
            appCol,
            where('doctorId', '==', clinicId),
            where('appointmentStatus', '==', 'upcoming'),
            limit(50)
          );
        }

        const snap = await getDocs(qAppointments);
        const list: FollowUpAppointment[] = [];
        snap.forEach((d) => {
          const data = d.data();
          if (data) {
            list.push({ id: d.id, ...(data as Record<string, any>) } as FollowUpAppointment);
          }
        });
        list.sort((a, b) => new Date(`${a.appointmentDate}T${a.appointmentTime}`).getTime() - new Date(`${b.appointmentDate}T${b.appointmentTime}`).getTime());

        result = {
          totalCount: list.length,
          appointments: list.map((a) => ({
            id: a.id,
            patientName: a.patientName,
            patientPhone: a.patientPhone,
            appointmentDate: a.appointmentDate,
            appointmentTime: a.appointmentTime,
            status: a.appointmentStatus,
            reason: a.reason || 'متابعة كشف',
            notes: a.notes || ''
          }))
        };
        break;
      }

      // ----------------------------------------------------
      // READ: get_financial_summary
      // ----------------------------------------------------
      case 'get_financial_summary': {
        const targetDate = args.date ? String(args.date).trim() : getTodayDateString();
        const txCol = collection(db, 'clinic_transactions');
        const qTx = query(
          txCol,
          where('organizationId', '==', clinicId),
          where('date', '==', targetDate),
          limit(100)
        );

        const snap = await getDocs(qTx);
        let totalRevenue = 0;
        let totalCollected = 0;
        let totalRemaining = 0;
        const transactions: any[] = [];

        snap.forEach((d) => {
          const tx = d.data() as ClinicTransaction;
          totalRevenue += Number(tx.totalAmount) || 0;
          totalCollected += Number(tx.paidAmount) || 0;
          totalRemaining += Number(tx.remainingAmount) || 0;
          transactions.push({
            id: d.id,
            patientName: tx.patientName,
            serviceName: tx.serviceName,
            totalAmount: tx.totalAmount,
            paidAmount: tx.paidAmount,
            remainingAmount: tx.remainingAmount,
            paymentStatus: tx.paymentStatus,
            paymentMethod: tx.paymentMethod
          });
        });

        result = {
          date: targetDate,
          totalRevenue,
          totalCollected,
          totalRemaining,
          transactionsCount: transactions.length,
          transactions
        };
        break;
      }

      // ----------------------------------------------------
      // READ: get_active_tasks
      // ----------------------------------------------------
      case 'get_active_tasks': {
        const tasksCol = collection(db, 'doctors', clinicId, 'aiTasks');
        const snap = await getDocs(query(tasksCol, limit(50)));
        const tasks: AiAutonomousTask[] = [];
        snap.forEach((d) => tasks.push({ id: d.id, ...d.data() } as AiAutonomousTask));

        result = {
          count: tasks.length,
          tasks: tasks.map((t) => ({
            id: t.id,
            title: t.title,
            description: t.description,
            triggerType: t.triggerType,
            triggerConfig: t.triggerConfig,
            actionType: t.actionType,
            status: t.status,
            executionCount: t.executionCount || 0,
            lastExecutedAt: t.lastExecutedAt || null,
            lastExecutionStatus: t.lastExecutionStatus || null
          }))
        };
        break;
      }

      // ----------------------------------------------------
      // READ: get_audit_logs
      // ----------------------------------------------------
      case 'get_audit_logs': {
        const limitCount = Number(args.limit) || 20;
        const logsCol = collection(db, 'doctors', clinicId, 'aiAuditLogs');
        const qLogs = query(logsCol, orderBy('timestamp', 'desc'), limit(limitCount));
        
        let snap;
        try {
          snap = await getDocs(qLogs);
        } catch {
          // Fallback query without orderBy index requirement
          snap = await getDocs(query(logsCol, limit(limitCount)));
        }

        const logs: AiAuditLog[] = [];
        snap.forEach((d) => logs.push({ id: d.id, ...d.data() } as AiAuditLog));
        logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        result = {
          count: logs.length,
          logs: logs.map((l) => ({
            id: l.id,
            action: l.action,
            toolName: l.toolName,
            actorName: l.actorName,
            status: l.status,
            reason: l.reason,
            timestamp: l.timestamp
          }))
        };
        break;
      }

      // ----------------------------------------------------
      // WRITE: register_patient_ticket
      // ----------------------------------------------------
      case 'register_patient_ticket': {
        const name = String(args.patientName || '').trim();
        const phone = String(args.patientPhone || '').trim();
        const serviceName = String(args.serviceName || 'كشف جديد').trim();
        const price = Number(args.price) || 200;

        if (!name || !phone) {
          throw new Error('اسم المريض ورقم الهاتف مطلوبان لإتمام الحجز');
        }

        const bookingRes = await bookPatient(
          clinicId,
          name,
          phone,
          actorUid,
          'two_turns',
          {
            serviceId: 'srv_consultation',
            serviceName,
            price,
            visitType: 'كشف جديد'
          }
        );

        result = {
          success: true,
          ticketId: bookingRes.patientId,
          sequenceNumber: bookingRes.sequenceNumber,
          bookingReference: bookingRes.bookingReference,
          patientName: name,
          patientPhone: phone,
          message: `تم حجز تذكرة كشف جديدة بنجاح برقم دور [${bookingRes.sequenceNumber}] وكود مرجعي [${bookingRes.bookingReference}] للمريض ${name}`
        };
        break;
      }

      // ----------------------------------------------------
      // WRITE: call_next_patient
      // ----------------------------------------------------
      case 'call_next_patient': {
        const callRes = await callNextPatient(clinicId);
        if (!callRes.calledPatient) {
          result = {
            success: true,
            calledPatient: null,
            message: 'لا يوجد مرضى في طابور الانتظار حالياً، جميع المرضى تم كشفهم أو الطابور فارغ.'
          };
        } else {
          result = {
            success: true,
            calledPatient: {
              id: callRes.calledPatient.id,
              name: callRes.calledPatient.name,
              phone: callRes.calledPatient.phone,
              sequenceNumber: callRes.calledPatient.sequenceNumber,
              calledAt: callRes.calledPatient.calledAt
            },
            message: `تم النداء على المريض التالي: [${callRes.calledPatient.name}] دور رقم (${callRes.calledPatient.sequenceNumber}) ودخل العيادة الآن.`
          };
        }
        break;
      }

      // ----------------------------------------------------
      // WRITE: update_patient_status
      // ----------------------------------------------------
      case 'update_patient_status': {
        const identifier = String(args.patientRecordId || args.patientName || args.patientPhone || '').trim();
        const newStatus = String(args.newStatus || '').trim() as any;

        if (!identifier || !newStatus) {
          throw new Error('اسم المريض أو معرف التذكرة والحالة الجديدة مطلوبان');
        }

        // Resolve patient in today's active queue if not a raw doc ID
        const resolvedInQueue = await resolvePatientInTodayQueue(clinicId, identifier);
        const targetTicketId = resolvedInQueue ? resolvedInQueue.id : identifier;
        const patientDisplayName = resolvedInQueue?.name || identifier;

        await updatePatientStatus(clinicId, targetTicketId, newStatus);
        result = {
          success: true,
          patientRecordId: targetTicketId,
          patientName: patientDisplayName,
          sequenceNumber: resolvedInQueue?.sequenceNumber,
          newStatus,
          message: `تم تحديث حالة المريض [${patientDisplayName}]${resolvedInQueue?.sequenceNumber ? ' (دور ' + resolvedInQueue.sequenceNumber + ')' : ''} بنجاح إلى: ${newStatus === 'done' ? 'اكتمل الكشف (done)' : newStatus === 'called' ? 'داخل العيادة (called)' : newStatus === 'waiting' ? 'في الانتظار (waiting)' : 'ملغي (cancelled)'}`
        };
        break;
      }

      // ----------------------------------------------------
      // WRITE: schedule_follow_up
      // ----------------------------------------------------
      case 'schedule_follow_up': {
        const patientName = String(args.patientName || '').trim();
        let patientPhone = String(args.patientPhone || '').trim();
        const appointmentDate = String(args.appointmentDate || '').trim();
        const appointmentTime = String(args.appointmentTime || '').trim();
        const reason = String(args.reason || 'متابعة كشف').trim();
        const notes = String(args.notes || '').trim();

        if (!patientName || !appointmentDate || !appointmentTime) {
          throw new Error('اسم المريض وتاريخ ووقت الموعد مطلوبة لجدولة إعادة الكشف');
        }

        // Auto-resolve patient phone from queue or patient archive if missing
        if (!patientPhone) {
          const inQueue = await resolvePatientInTodayQueue(clinicId, patientName);
          if (inQueue?.phone) {
            patientPhone = inQueue.phone;
          } else {
            const searchResults = await searchClinicPatientsFast(clinicId, patientName, 1);
            if (searchResults.length > 0 && searchResults[0].patientPhone) {
              patientPhone = searchResults[0].patientPhone;
            }
          }
        }

        if (!patientPhone) {
          throw new Error(`يرجى تحديد رقم هاتف المريض [${patientName}] لإتمام حجز موعد المتابعة`);
        }

        const appointment = await createFollowUpAppointment({
          doctorId: clinicId,
          clinicId,
          patientName,
          patientPhone,
          appointmentDate,
          appointmentTime,
          reason,
          notes
        });

        result = {
          success: true,
          appointmentId: appointment.id,
          appointmentDate: appointment.appointmentDate,
          appointmentTime: appointment.appointmentTime,
          patientName: appointment.patientName,
          patientPhone,
          message: `تم جدولة موعد إعادة الكشف بنجاح للمريض [${patientName}] (${patientPhone}) يوم ${appointmentDate} الساعة ${appointmentTime}`
        };
        break;
      }

      // ----------------------------------------------------
      // WRITE: record_patient_payment
      // ----------------------------------------------------
      case 'record_patient_payment': {
        const patientName = String(args.patientName || '').trim();
        let patientPhone = String(args.patientPhone || '').trim();
        const totalAmount = Number(args.totalAmount) || 0;
        const paidAmount = Number(args.paidAmount) || 0;
        const paymentMethod = (String(args.paymentMethod || 'CASH').toUpperCase()) as any;
        const serviceName = String(args.serviceName || 'كشف عيادة').trim();
        const notes = String(args.notes || '').trim();

        if (!patientName || totalAmount <= 0) {
          throw new Error('اسم المريض وإجمالي المبلغ المطلوب على الأقل لتسجيل الدفعة');
        }

        // Auto-resolve patient phone from active queue or patient directory if omitted
        if (!patientPhone) {
          const inQueue = await resolvePatientInTodayQueue(clinicId, patientName);
          if (inQueue?.phone) {
            patientPhone = inQueue.phone;
          } else {
            const searchResults = await searchClinicPatientsFast(clinicId, patientName, 1);
            if (searchResults.length > 0 && searchResults[0].patientPhone) {
              patientPhone = searchResults[0].patientPhone;
            }
          }
        }

        if (!patientPhone) {
          throw new Error(`يرجى تحديد رقم هاتف المريض [${patientName}] لإتمام تسجيل المعاملة المالية`);
        }

        const tx = await recordSplitPayment({
          organizationId: clinicId,
          patientName,
          patientPhone,
          serviceName,
          totalAmount,
          payments: [{ method: paymentMethod, amount: paidAmount }],
          notes,
          createdBy: actorUid,
          createdByName: actorName
        });

        result = {
          success: true,
          transactionId: tx.id,
          patientName,
          patientPhone,
          totalAmount: tx.totalAmount,
          paidAmount: tx.paidAmount,
          remainingAmount: tx.remainingAmount,
          paymentStatus: tx.paymentStatus,
          message: `تم تسجيل الدفعة المالية بنجاح: مدفوع ${tx.paidAmount} ج من إجمالي ${tx.totalAmount} ج (المتبقي: ${tx.remainingAmount} ج) للمريض [${patientName}] (${patientPhone})`
        };
        break;
      }

      // ----------------------------------------------------
      // WRITE: create_medical_order
      // ----------------------------------------------------
      case 'create_medical_order': {
        const patientRecordId = String(args.patientRecordId || '').trim();
        const orderType = (String(args.orderType || 'lab').toLowerCase()) as any;
        const patientName = String(args.patientName || '').trim();
        const patientPhone = String(args.patientPhone || '').trim();

        if (!patientRecordId || !patientName) {
          throw new Error('معرف تذكرة المريض واسمه مطلوبان لتسجيل الفحص');
        }

        const orderInfo = await recordPatientMedicalOrder(
          clinicId,
          patientRecordId,
          orderType,
          patientName,
          patientPhone
        );

        result = {
          success: true,
          orderLabel: orderInfo.orderLabel,
          emoji: orderInfo.emoji,
          message: `تم تسجيل طلب الفحص الطبي (${orderInfo.orderLabel} ${orderInfo.emoji}) بنجاح للمريض ${patientName}`
        };
        break;
      }

      // ----------------------------------------------------
      // WRITE: create_autonomous_task
      // ----------------------------------------------------
      case 'create_autonomous_task': {
        const title = String(args.title || '').trim();
        const description = String(args.description || '').trim();
        const triggerType = (String(args.triggerType || 'EVENT').toUpperCase()) as any;
        const event = args.event as any;
        const condition = args.condition as any;
        const threshold = args.threshold ? Number(args.threshold) : undefined;
        const actionType = (String(args.actionType || 'ALERT_STAFF').toUpperCase()) as any;
        const messageTemplate = String(args.messageTemplate || '').trim();

        if (!title || !description) {
          throw new Error('عنوان ووصف المهمة الآلية مطلوبان');
        }

        const taskData: Omit<AiAutonomousTask, 'id'> = {
          clinicId,
          title,
          description,
          triggerType,
          triggerConfig: {
            event,
            condition,
            threshold
          },
          actionType,
          actionConfig: {
            messageTemplate,
            severity: 'info',
            autoExecution: true
          },
          status: 'active',
          createdAt: new Date().toISOString(),
          createdBy: actorUid,
          createdByName: actorName,
          executionCount: 0
        };

        const taskCol = collection(db, 'doctors', clinicId, 'aiTasks');
        const docRef = await addDoc(taskCol, taskData);

        result = {
          success: true,
          taskId: docRef.id,
          title,
          status: 'active',
          message: `تم حفظ وتفعيل القاعدة الآلية الذكية: "${title}" بنجاح في نظام العيادة.`
        };
        break;
      }

      // ----------------------------------------------------
      // WRITE: toggle_autonomous_task
      // ----------------------------------------------------
      case 'toggle_autonomous_task': {
        const taskId = String(args.taskId || '').trim();
        const status = (String(args.status || 'active').toLowerCase()) as 'active' | 'paused';
        if (!taskId) throw new Error('معرف المهمة الآلية مطلوب');

        const taskRef = doc(db, 'doctors', clinicId, 'aiTasks', taskId);
        await updateDoc(taskRef, {
          status,
          updatedAt: new Date().toISOString()
        });

        result = {
          success: true,
          taskId,
          status,
          message: `تم ${status === 'active' ? 'تفعيل' : 'إيقاف'} المهمة الآلية بنجاح.`
        };
        break;
      }

      // ----------------------------------------------------
      // WRITE: update_patient_profile
      // ----------------------------------------------------
      case 'update_patient_profile': {
        const identifier = String(args.patientPhoneOrName || args.patientName || args.patientPhone || '').trim();
        if (!identifier) {
          throw new Error('يرجى تحديد اسم المريض أو رقم هاتفه لتعديل ملفه الطبي');
        }

        // Resolve phone
        let cleanPhone = normalizePhoneNumber(identifier);
        let resolvedName = args.patientName ? String(args.patientName).trim() : '';

        if (!cleanPhone) {
          const inQueue = await resolvePatientInTodayQueue(clinicId, identifier);
          if (inQueue?.phone) {
            cleanPhone = normalizePhoneNumber(inQueue.phone);
            if (!resolvedName) resolvedName = inQueue.name;
          } else {
            const searchResults = await searchClinicPatientsFast(clinicId, identifier, 1);
            if (searchResults.length > 0 && searchResults[0].patientPhone) {
              cleanPhone = normalizePhoneNumber(searchResults[0].patientPhone);
              if (!resolvedName) resolvedName = searchResults[0].patientName;
            }
          }
        }

        if (!cleanPhone) {
          throw new Error(`تعذر العثور على ملف للمريض "${identifier}". يرجى التأكد من الاسم أو تقديم رقم الهاتف.`);
        }

        // Build updates
        const updates: any = {};
        if (args.allergies !== undefined) updates.allergies = String(args.allergies).trim();
        if (args.chronicDiseases !== undefined) updates.chronicDiseases = String(args.chronicDiseases).trim();
        if (args.bloodGroup !== undefined) updates.bloodGroup = String(args.bloodGroup).trim();
        if (args.generalNotes !== undefined) updates.generalNotes = String(args.generalNotes).trim();
        if (args.patientName && String(args.patientName).trim()) {
          updates.patientName = String(args.patientName).trim();
          resolvedName = updates.patientName;
        }

        // Apply vitals and clinical notes update
        await updatePatientVitalsAndNotes(clinicId, cleanPhone, updates);

        // If new phone requested, update base file
        if (args.newPhone) {
          const newClean = normalizePhoneNumber(String(args.newPhone).trim());
          if (newClean && newClean !== cleanPhone) {
            const existingFile = await getPatientMedicalFile(clinicId, cleanPhone);
            if (existingFile) {
              await savePatientMedicalFile(clinicId, {
                ...existingFile,
                patientPhone: newClean,
                patientName: resolvedName || existingFile.patientName
              });
            }
          }
        }

        result = {
          success: true,
          patientPhone: cleanPhone,
          patientName: resolvedName || identifier,
          updatedFields: Object.keys(updates),
          message: `تم تحديث الملف الطبي للمريض [${resolvedName || identifier}] (${cleanPhone}) بنجاح في قاعدة البيانات.`
        };
        break;
      }

      // ----------------------------------------------------
      // WRITE: add_patient_consultation_note
      // ----------------------------------------------------
      case 'add_patient_consultation_note': {
        const identifier = String(args.patientPhoneOrName || args.patientName || '').trim();
        const diagnosis = String(args.diagnosis || '').trim();
        const prescription = String(args.prescription || '').trim();
        const notes = String(args.notes || '').trim();
        const serviceName = String(args.serviceName || 'كشف عيادة').trim();

        if (!identifier || !diagnosis) {
          throw new Error('اسم أو هاتف المريض والتشخيص الطبي مطلوبان لتوثيق الكشف');
        }

        // Resolve phone
        let cleanPhone = normalizePhoneNumber(identifier);
        let resolvedName = identifier;

        if (!cleanPhone) {
          const inQueue = await resolvePatientInTodayQueue(clinicId, identifier);
          if (inQueue?.phone) {
            cleanPhone = normalizePhoneNumber(inQueue.phone);
            resolvedName = inQueue.name;
          } else {
            const searchResults = await searchClinicPatientsFast(clinicId, identifier, 1);
            if (searchResults.length > 0 && searchResults[0].patientPhone) {
              cleanPhone = normalizePhoneNumber(searchResults[0].patientPhone);
              resolvedName = searchResults[0].patientName;
            }
          }
        }

        if (!cleanPhone) {
          throw new Error(`يرجى تحديد رقم هاتف المريض [${identifier}] لحفظ الزيارة والتشخيص في ملفه الطبي`);
        }

        const visitId = `visit_${Date.now()}`;
        const today = getTodayDateString();

        await addVisitToPatientMedicalFile(clinicId, resolvedName, cleanPhone, {
          id: visitId,
          date: today,
          serviceId: 'srv_consultation',
          serviceName,
          visitType: serviceName,
          diagnosis,
          prescription,
          notes,
          price: 0,
          paidAmount: 0,
          remainingAmount: 0,
          status: 'done',
          createdAt: new Date().toISOString()
        });

        if (notes) {
          await updatePatientVitalsAndNotes(clinicId, cleanPhone, { generalNotes: notes });
        }

        result = {
          success: true,
          patientName: resolvedName,
          patientPhone: cleanPhone,
          diagnosis,
          prescription,
          visitId,
          message: `تم توثيق الكشف الطبي والتشخيص (${diagnosis}) في ملف المريض [${resolvedName}] وحفظه في الأرشيف الطبي بنجاح.`
        };
        break;
      }

      // ----------------------------------------------------
      // WRITE: cancel_queue_ticket
      // ----------------------------------------------------
      case 'cancel_queue_ticket': {
        const identifier = String(args.patientIdentifier || args.patientName || args.patientRecordId || '').trim();
        const reason = String(args.reason || 'إلغاء الحجز بناءً على طلب العيادة').trim();

        if (!identifier) {
          throw new Error('اسم المريض أو رقم هاتفه أو دوره مطلوب لإلغاء التذكرة');
        }

        const resolved = await resolvePatientInTodayQueue(clinicId, identifier);
        if (!resolved) {
          throw new Error(`لم يتم العثور على مريض مسجل في طابور اليوم يطابق: "${identifier}"`);
        }

        await updatePatientStatus(clinicId, resolved.id, 'cancelled');

        result = {
          success: true,
          patientName: resolved.name,
          sequenceNumber: resolved.sequenceNumber,
          ticketId: resolved.id,
          reason,
          message: `تم إلغاء تذكرة ودور المريض [${resolved.name}] (دور رقم ${resolved.sequenceNumber}) في طابور اليوم بنجاح.`
        };
        break;
      }

      // ----------------------------------------------------
      // SENSITIVE: cancel_appointment
      // ----------------------------------------------------
      case 'cancel_appointment': {
        const appointmentId = String(args.appointmentId || '').trim();
        const reason = String(args.reason || 'إلغاء بناءً على طلب العيادة').trim();
        if (!appointmentId) throw new Error('معرف الموعد مطلوب لإلغائه');

        await updateFollowUpAppointmentStatus(appointmentId, 'cancelled');
        result = {
          success: true,
          appointmentId,
          reason,
          message: `تم إلغاء موعد المريض بنجاح (السبب: ${reason}). السجلات السابقة محفوظة بأمان.`
        };
        break;
      }

      // ----------------------------------------------------
      // SENSITIVE: mark_patient_no_show
      // ----------------------------------------------------
      case 'mark_patient_no_show': {
        const patientRecordId = String(args.patientRecordId || '').trim();
        const patientName = String(args.patientName || 'المريض').trim();
        if (!patientRecordId) throw new Error('معرف تذكرة المريض مطلوب');

        await markQueuePatientNoShow(clinicId, patientRecordId);
        result = {
          success: true,
          patientRecordId,
          patientName,
          message: `تم تسجيل تخلف المريض [${patientName}] عن الحضور (No-Show). تم إخراجه من طابور اليوم مع الحفاظ على ملفه بالكامل.`
        };
        break;
      }

      // ----------------------------------------------------
      // SENSITIVE: refund_payment
      // ----------------------------------------------------
      case 'refund_payment': {
        const transactionId = String(args.transactionId || '').trim();
        const refundAmount = Number(args.refundAmount) || 0;
        const reason = String(args.reason || 'استرداد قيمة الكشف').trim();

        if (!transactionId || refundAmount <= 0) {
          throw new Error('معرف المعاملة ومبلغ الاسترداد مطلوبان');
        }

        await refundClinicTransaction(
          member,
          isDoctorOwner,
          clinicId,
          transactionId,
          refundAmount,
          reason
        );

        result = {
          success: true,
          transactionId,
          refundAmount,
          message: `تم استرداد مبلغ (${refundAmount} ج) بنجاح للمعاملة [${transactionId}]. تم تحديث السجلات المالية والأرصدة فوراً.`
        };
        break;
      }

      default:
        throw new Error(`الأداة ${toolName} غير مدعومة في محرك التنفيذ`);
    }

    // 5. Successful Audit Logging
    await logAiAction({
      clinicId,
      actorUid,
      actorName,
      actorRole,
      action: `TOOL_${toolName.toUpperCase()}`,
      toolName,
      inputParameters: sanitizeParameters(args),
      outputResult: result,
      status: 'success',
      clientIp
    });

    return {
      toolCallId,
      toolName,
      status: 'success',
      result
    };
  } catch (error: any) {
    const errorMsg = error?.message || 'حدث خطأ غير متوقع أثناء تنفيذ العملية في دوري.';
    console.error(`[AI Tool Executor Error] ${toolName}:`, error);

    // 6. Failed Audit Logging
    await logAiAction({
      clinicId,
      actorUid,
      actorName,
      actorRole,
      action: `TOOL_FAILED_${toolName.toUpperCase()}`,
      toolName,
      inputParameters: sanitizeParameters(args),
      status: 'failed',
      reason: errorMsg,
      clientIp
    });

    return {
      toolCallId,
      toolName,
      status: 'failed',
      error: errorMsg
    };
  }
}

/**
 * Audit Logger for AI Tool Operations
 */
async function logAiAction(entry: Omit<AiAuditLog, 'id' | 'timestamp'>): Promise<void> {
  try {
    const nowIso = new Date().toISOString();
    const logDoc: AiAuditLog = {
      id: `ai_log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: nowIso,
      ...entry
    };

    const logsCol = collection(db, 'doctors', entry.clinicId, 'aiAuditLogs');
    await addDoc(logsCol, logDoc);
  } catch (err) {
    console.warn('Could not write AI audit log to Firestore:', err);
  }
}

/**
 * Remove internal helper parameters before logging
 */
function sanitizeParameters(args: Record<string, any>): Record<string, any> {
  const clean: Record<string, any> = {};
  Object.entries(args).forEach(([k, v]) => {
    if (!k.startsWith('_')) {
      clean[k] = v;
    }
  });
  return clean;
}
