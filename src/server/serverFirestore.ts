import {
  PatientRecord,
  ClinicTransaction,
  FollowUpAppointment,
  PatientMedicalFile
} from '../types.ts';
import {
  AiAutonomousTask,
  AiAuditLog
} from '../types/aiAgent.ts';
import { normalizePhoneNumber } from '../services/firebaseService.ts';

const FIREBASE_PROJECT_ID = 'prefab-groove-502023-t4';
const FIRESTORE_DATABASE_ID = 'ai-studio-f8a934fa-e4dd-4561-8d66-6ad00154589f';
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/${FIRESTORE_DATABASE_ID}/documents`;

/**
 * Parse a Firestore REST API field value into JavaScript native type
 */
export function parseFirestoreValue(val: any): any {
  if (!val || typeof val !== 'object') return val;
  if ('stringValue' in val) return val.stringValue;
  if ('booleanValue' in val) return val.booleanValue;
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return Number(val.doubleValue);
  if ('timestampValue' in val) return val.timestampValue;
  if ('nullValue' in val) return null;
  if ('mapValue' in val) {
    const fields = val.mapValue.fields || {};
    const res: Record<string, any> = {};
    for (const [k, v] of Object.entries(fields)) {
      res[k] = parseFirestoreValue(v);
    }
    return res;
  }
  if ('arrayValue' in val) {
    const items = val.arrayValue.values || [];
    return items.map((item: any) => parseFirestoreValue(item));
  }
  return null;
}

/**
 * Parse an entire Firestore REST document object
 */
export function parseFirestoreDoc(doc: any): Record<string, any> {
  if (!doc) return {};
  const nameParts = (doc.name || '').split('/');
  const docId = nameParts[nameParts.length - 1] || '';
  const fields = doc.fields || {};
  const parsedData: Record<string, any> = { id: docId };

  for (const [key, val] of Object.entries(fields)) {
    parsedData[key] = parseFirestoreValue(val);
  }

  if (doc.createTime) parsedData._createTime = doc.createTime;
  if (doc.updateTime) parsedData._updateTime = doc.updateTime;

  return parsedData;
}

/**
 * Serialize JavaScript native data into Firestore REST fields format
 */
export function serializeToFirestoreRest(data: Record<string, any>): Record<string, any> {
  const fields: Record<string, any> = {};
  for (const [key, val] of Object.entries(data)) {
    if (val === undefined || key === 'id' || key === '_createTime' || key === '_updateTime') continue;
    if (val === null) {
      fields[key] = { nullValue: null };
    } else if (typeof val === 'string') {
      fields[key] = { stringValue: val };
    } else if (typeof val === 'boolean') {
      fields[key] = { booleanValue: val };
    } else if (typeof val === 'number') {
      if (Number.isInteger(val)) {
        fields[key] = { integerValue: String(val) };
      } else {
        fields[key] = { doubleValue: val };
      }
    } else if (Array.isArray(val)) {
      fields[key] = {
        arrayValue: {
          values: val.map((v) => {
            if (v === null || v === undefined) return { nullValue: null };
            if (typeof v === 'string') return { stringValue: v };
            if (typeof v === 'boolean') return { booleanValue: v };
            if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
            if (typeof v === 'object') return { mapValue: { fields: serializeToFirestoreRest(v) } };
            return { stringValue: String(v) };
          })
        }
      };
    } else if (typeof val === 'object') {
      fields[key] = {
        mapValue: {
          fields: serializeToFirestoreRest(val)
        }
      };
    }
  }
  return fields;
}

/**
 * Helper to build auth headers
 */
function getHeaders(idToken?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (idToken) {
    headers['Authorization'] = `Bearer ${idToken}`;
  }
  return headers;
}

/**
 * List documents in a collection via REST API
 */
export async function listCollectionRest(
  collectionPath: string,
  pageSize = 100,
  idToken?: string
): Promise<any[]> {
  try {
    const url = `${BASE_URL}/${collectionPath}?pageSize=${pageSize}`;
    const res = await fetch(url, { headers: getHeaders(idToken) });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.warn(`[ServerFirestore] listCollectionRest error (${res.status}) on ${collectionPath}:`, err);
      return [];
    }
    const data = await res.json();
    const docs = data.documents || [];
    return docs.map((d: any) => parseFirestoreDoc(d));
  } catch (error) {
    console.warn(`[ServerFirestore] Exception listing ${collectionPath}:`, error);
    return [];
  }
}

/**
 * Fetch a single document by ID via REST API
 */
export async function getDocRest(
  collectionPath: string,
  docId: string,
  idToken?: string
): Promise<any | null> {
  try {
    const url = `${BASE_URL}/${collectionPath}/${encodeURIComponent(docId)}`;
    const res = await fetch(url, { headers: getHeaders(idToken) });
    if (!res.ok) return null;
    const data = await res.json();
    return parseFirestoreDoc(data);
  } catch (error) {
    console.warn(`[ServerFirestore] Exception getting ${collectionPath}/${docId}:`, error);
    return null;
  }
}

/**
 * Run a structured query via REST API
 */
export async function runQueryRest(
  parentPath: string | null,
  structuredQuery: any,
  idToken?: string
): Promise<any[]> {
  try {
    const url = parentPath ? `${BASE_URL}/${parentPath}:runQuery` : `${BASE_URL}:runQuery`;
    const res = await fetch(url, {
      method: 'POST',
      headers: getHeaders(idToken),
      body: JSON.stringify({ structuredQuery })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.warn(`[ServerFirestore] runQueryRest error (${res.status}) on ${parentPath || 'root'}:`, err);
      return [];
    }

    const data = await res.json();
    if (!Array.isArray(data)) return [];

    const results: any[] = [];
    for (const item of data) {
      if (item.document) {
        results.push(parseFirestoreDoc(item.document));
      }
    }
    return results;
  } catch (error) {
    console.warn(`[ServerFirestore] Exception in runQueryRest:`, error);
    return [];
  }
}

/**
 * Create a new document via REST API
 */
export async function createDocRest(
  collectionPath: string,
  data: Record<string, any>,
  customDocId?: string,
  idToken?: string
): Promise<any | null> {
  try {
    let url = `${BASE_URL}/${collectionPath}`;
    if (customDocId) {
      url += `?documentId=${encodeURIComponent(customDocId)}`;
    }
    const res = await fetch(url, {
      method: 'POST',
      headers: getHeaders(idToken),
      body: JSON.stringify({ fields: serializeToFirestoreRest(data) })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.warn(`[ServerFirestore] createDocRest error (${res.status}) on ${collectionPath}:`, err);
      return null;
    }

    const resData = await res.json();
    return parseFirestoreDoc(resData);
  } catch (error) {
    console.warn(`[ServerFirestore] Exception creating doc in ${collectionPath}:`, error);
    return null;
  }
}

/**
 * Update an existing document via REST API PATCH
 */
export async function patchDocRest(
  collectionPath: string,
  docId: string,
  updates: Record<string, any>,
  idToken?: string
): Promise<boolean> {
  try {
    const keys = Object.keys(updates).filter((k) => k !== 'id');
    if (keys.length === 0) return true;

    const fieldMask = keys.map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
    const url = `${BASE_URL}/${collectionPath}/${encodeURIComponent(docId)}?${fieldMask}`;

    const res = await fetch(url, {
      method: 'PATCH',
      headers: getHeaders(idToken),
      body: JSON.stringify({ fields: serializeToFirestoreRest(updates) })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.warn(`[ServerFirestore] patchDocRest error (${res.status}) on ${collectionPath}/${docId}:`, err);
      return false;
    }

    return true;
  } catch (error) {
    console.warn(`[ServerFirestore] Exception patching ${collectionPath}/${docId}:`, error);
    return false;
  }
}

/**
 * Delete a document via REST API
 */
export async function deleteDocRest(
  collectionPath: string,
  docId: string,
  idToken?: string
): Promise<boolean> {
  try {
    const url = `${BASE_URL}/${collectionPath}/${encodeURIComponent(docId)}`;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: getHeaders(idToken)
    });
    return res.ok || res.status === 404;
  } catch (error) {
    console.warn(`[ServerFirestore] Exception deleting ${collectionPath}/${docId}:`, error);
    return false;
  }
}

// ============================================================================
// DOMAIN-SPECIFIC REPOSITORIES FOR AI TOOLS
// ============================================================================

/**
 * 1. Fetch Today's Queue Patients for Clinic
 */
export async function getClinicQueuePatientsRest(
  clinicId: string,
  targetDate: string,
  idToken?: string
): Promise<PatientRecord[]> {
  // Query queue subcollection for targetDate
  const queryResult = await runQueryRest(
    `queues/${clinicId}`,
    {
      from: [{ collectionId: 'patients' }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'date' },
          op: 'EQUAL',
          value: { stringValue: targetDate }
        }
      },
      limit: 150
    },
    idToken
  );

  let patients: PatientRecord[] = queryResult as PatientRecord[];

  // Fallback: If structured query had index issues, list collection and filter
  if (patients.length === 0) {
    const all = await listCollectionRest(`queues/${clinicId}/patients`, 150, idToken);
    patients = all.filter((p) => p.date === targetDate) as PatientRecord[];
  }

  patients.sort((a, b) => (Number(a.sequenceNumber) || 0) - (Number(b.sequenceNumber) || 0));
  return patients;
}

/**
 * 2. Fetch Follow-up Appointments for Clinic
 */
export async function getClinicFollowUpAppointmentsRest(
  clinicId: string,
  targetDate?: string,
  idToken?: string
): Promise<FollowUpAppointment[]> {
  const filters: any[] = [
    {
      fieldFilter: {
        field: { fieldPath: 'doctorId' },
        op: 'EQUAL',
        value: { stringValue: clinicId }
      }
    }
  ];

  if (targetDate) {
    filters.push({
      fieldFilter: {
        field: { fieldPath: 'appointmentDate' },
        op: 'EQUAL',
        value: { stringValue: targetDate }
      }
    });
  } else {
    filters.push({
      fieldFilter: {
        field: { fieldPath: 'appointmentStatus' },
        op: 'EQUAL',
        value: { stringValue: 'upcoming' }
      }
    });
  }

  let results = await runQueryRest(
    null,
    {
      from: [{ collectionId: 'followUpAppointments' }],
      where: {
        compositeFilter: {
          op: 'AND',
          filters
        }
      },
      limit: 50
    },
    idToken
  );

  // Fallback: list collection and filter
  if (results.length === 0) {
    const all = await listCollectionRest('followUpAppointments', 60, idToken);
    results = all.filter((a) => {
      if (a.doctorId !== clinicId) return false;
      if (targetDate) return a.appointmentDate === targetDate;
      return a.appointmentStatus === 'upcoming';
    });
  }

  results.sort((a, b) => {
    const tA = new Date(`${a.appointmentDate || '1970-01-01'}T${a.appointmentTime || '00:00'}`).getTime();
    const tB = new Date(`${b.appointmentDate || '1970-01-01'}T${b.appointmentTime || '00:00'}`).getTime();
    return tA - tB;
  });

  return results as FollowUpAppointment[];
}

/**
 * 3. Fetch Clinic Financial Transactions & Summary
 */
export async function getClinicTransactionsRest(
  clinicId: string,
  targetDate: string,
  idToken?: string
): Promise<ClinicTransaction[]> {
  let results = await runQueryRest(
    null,
    {
      from: [{ collectionId: 'clinic_transactions' }],
      where: {
        compositeFilter: {
          op: 'AND',
          filters: [
            {
              fieldFilter: {
                field: { fieldPath: 'organizationId' },
                op: 'EQUAL',
                value: { stringValue: clinicId }
              }
            },
            {
              fieldFilter: {
                field: { fieldPath: 'date' },
                op: 'EQUAL',
                value: { stringValue: targetDate }
              }
            }
          ]
        }
      },
      limit: 100
    },
    idToken
  );

  if (results.length === 0) {
    const all = await listCollectionRest('clinic_transactions', 100, idToken);
    results = all.filter((t) => t.organizationId === clinicId && t.date === targetDate);
  }

  return results as ClinicTransaction[];
}

/**
 * 4. Fetch Autonomous AI Tasks for Clinic
 */
export async function getClinicAiTasksRest(
  clinicId: string,
  idToken?: string
): Promise<AiAutonomousTask[]> {
  const docs = await listCollectionRest(`doctors/${clinicId}/aiTasks`, 50, idToken);
  return docs as AiAutonomousTask[];
}

/**
 * 5. Fetch AI Audit Logs for Clinic
 */
export async function getClinicAiAuditLogsRest(
  clinicId: string,
  limitCount = 20,
  idToken?: string
): Promise<AiAuditLog[]> {
  const docs = await listCollectionRest(`doctors/${clinicId}/aiAuditLogs`, limitCount, idToken);
  docs.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
  return docs as AiAuditLog[];
}

/**
 * 6. Fast Search Clinic Patients
 */
export async function searchClinicPatientsRest(
  clinicId: string,
  searchTerm: string,
  limitCount = 8,
  idToken?: string
): Promise<any[]> {
  const cleanTerm = searchTerm.trim().toLowerCase();
  const cleanPhone = normalizePhoneNumber(cleanTerm);

  // If phone, check direct patient file
  if (cleanPhone && cleanPhone.length >= 10) {
    const directDoc = await getDocRest(`doctors/${clinicId}/patientFiles`, cleanPhone, idToken);
    if (directDoc) {
      return [{
        id: directDoc.patientId || cleanPhone,
        patientName: directDoc.patientName,
        patientPhone: directDoc.patientPhone || cleanPhone,
        visitsCount: directDoc.visitsCount || (directDoc.visits ? directDoc.visits.length : 1),
        lastVisitDate: directDoc.lastVisitDate,
        totalOutstandingBalance: directDoc.totalOutstandingBalance || 0,
        allergies: directDoc.allergies || 'لا توجد حساسية مسجلة',
        chronicDiseases: directDoc.chronicDiseases || 'لا توجد أمراض مزمنة',
        lastVisitDiagnosis: directDoc.lastVisitDiagnosis || 'غير محدد'
      }];
    }
  }

  // Scan patient files
  const files = await listCollectionRest(`doctors/${clinicId}/patientFiles`, 100, idToken);
  const queueDocs = await listCollectionRest(`queues/${clinicId}/patients`, 100, idToken);

  const results: any[] = [];
  const seenPhones = new Set<string>();

  for (const f of files) {
    const name = String(f.patientName || '').toLowerCase();
    const phone = String(f.patientPhone || '');
    const normPhone = normalizePhoneNumber(phone);

    if (name.includes(cleanTerm) || phone.includes(cleanTerm) || (cleanPhone && normPhone.includes(cleanPhone))) {
      if (normPhone && !seenPhones.has(normPhone)) {
        seenPhones.add(normPhone);
        results.push({
          id: f.patientId || f.id || normPhone,
          patientName: f.patientName,
          patientPhone: f.patientPhone || normPhone,
          visitsCount: f.visitsCount || (f.visits ? f.visits.length : 1),
          lastVisitDate: f.lastVisitDate,
          totalOutstandingBalance: f.totalOutstandingBalance || 0,
          allergies: f.allergies || 'لا توجد حساسية مسجلة',
          chronicDiseases: f.chronicDiseases || 'لا توجد أمراض مزمنة',
          lastVisitDiagnosis: f.lastVisitDiagnosis || 'غير محدد'
        });
      }
    }
    if (results.length >= limitCount) break;
  }

  // Also check queue patients if needed
  if (results.length < limitCount) {
    for (const q of queueDocs) {
      const name = String(q.name || '').toLowerCase();
      const phone = String(q.phone || '');
      const normPhone = normalizePhoneNumber(phone);

      if (name.includes(cleanTerm) || phone.includes(cleanTerm) || (cleanPhone && normPhone.includes(cleanPhone))) {
        if (normPhone && !seenPhones.has(normPhone)) {
          seenPhones.add(normPhone);
          results.push({
            id: q.id,
            patientName: q.name,
            patientPhone: q.phone,
            visitsCount: 1,
            lastVisitDate: q.date,
            totalOutstandingBalance: 0,
            allergies: 'لا توجد حساسية مسجلة',
            chronicDiseases: 'لا توجد أمراض مزمنة',
            lastVisitDiagnosis: q.serviceName || 'كشف'
          });
        }
      }
      if (results.length >= limitCount) break;
    }
  }

  return results;
}

/**
 * 7. Resolve Patient in Today's Queue via REST
 */
export async function resolvePatientInQueueRest(
  clinicId: string,
  identifier: string,
  idToken?: string
): Promise<PatientRecord | null> {
  if (!identifier || typeof identifier !== 'string') return null;
  const cleanId = identifier.trim().toLowerCase();
  if (!cleanId) return null;

  const today = new Date().toISOString().split('T')[0];
  const patients = await getClinicQueuePatientsRest(clinicId, today, idToken);
  if (!patients || patients.length === 0) return null;

  const cleanPhone = normalizePhoneNumber(cleanId);
  if (cleanPhone) {
    const byPhone = patients.find((p) => normalizePhoneNumber(p.phone) === cleanPhone);
    if (byPhone) return byPhone;
  }

  const seqNum = Number(cleanId);
  if (!isNaN(seqNum) && seqNum > 0) {
    const bySeq = patients.find((p) => Number(p.sequenceNumber) === seqNum);
    if (bySeq) return bySeq;
  }

  // Exact doc ID match
  const byId = patients.find((p) => p.id === identifier.trim());
  if (byId) return byId;

  // Name match
  const byNameExact = patients.find((p) => (p.name || '').trim().toLowerCase() === cleanId);
  if (byNameExact) return byNameExact;

  const byNamePartial = patients.filter((p) => (p.name || '').toLowerCase().includes(cleanId));
  if (byNamePartial.length > 0) {
    const active = byNamePartial.find((p) => p.status === 'called' || p.status === 'waiting');
    return active || byNamePartial[0];
  }

  return null;
}

/**
 * 8. Call Next Patient via REST API
 */
export async function callNextPatientRest(
  clinicId: string,
  idToken?: string
): Promise<{ calledPatient: PatientRecord | null }> {
  const today = new Date().toISOString().split('T')[0];
  const nowIso = new Date().toISOString();

  const patients = await getClinicQueuePatientsRest(clinicId, today, idToken);
  patients.sort((a, b) => (Number(a.sequenceNumber) || 0) - (Number(b.sequenceNumber) || 0));

  // 1. Mark existing 'called' patient as 'done'
  const currentCalled = patients.find((p) => p.status === 'called');
  if (currentCalled && currentCalled.id) {
    await patchDocRest(
      `queues/${clinicId}/patients`,
      currentCalled.id,
      {
        status: 'done',
        doneAt: nowIso,
        updatedAt: nowIso
      },
      idToken
    );
  }

  // 2. Find next 'waiting' patient
  const nextWaiting = patients.find((p) => p.status === 'waiting');
  if (!nextWaiting || !nextWaiting.id) {
    return { calledPatient: null };
  }

  // 3. Mark next patient as 'called'
  const success = await patchDocRest(
    `queues/${clinicId}/patients`,
    nextWaiting.id,
    {
      status: 'called',
      calledAt: nowIso,
      updatedAt: nowIso
    },
    idToken
  );

  if (success) {
    return {
      calledPatient: {
        ...nextWaiting,
        status: 'called',
        calledAt: nowIso
      }
    };
  }

  return { calledPatient: null };
}

/**
 * 9. Update Patient Ticket Status via REST API
 */
export async function updatePatientStatusRest(
  clinicId: string,
  ticketId: string,
  newStatus: string,
  idToken?: string
): Promise<boolean> {
  const nowIso = new Date().toISOString();
  const updates: Record<string, any> = {
    status: newStatus,
    updatedAt: nowIso
  };

  if (newStatus === 'done') updates.doneAt = nowIso;
  if (newStatus === 'called') updates.calledAt = nowIso;
  if (newStatus === 'cancelled') updates.cancelledAt = nowIso;

  return await patchDocRest(`queues/${clinicId}/patients`, ticketId, updates, idToken);
}

/**
 * 10. Book Patient Ticket via REST API
 */
export async function bookPatientTicketRest(
  clinicId: string,
  data: {
    name: string;
    phone: string;
    serviceName?: string;
    price?: number;
    actorUid?: string;
  },
  idToken?: string
): Promise<{ patientId: string; sequenceNumber: number; bookingReference: string }> {
  const today = new Date().toISOString().split('T')[0];
  const nowIso = new Date().toISOString();

  const patients = await getClinicQueuePatientsRest(clinicId, today, idToken);
  const sequenceNumber = patients.length + 1;
  const bookingReference = `BK-${Date.now().toString(36).toUpperCase().slice(-4)}`;

  const newTicketData = {
    name: data.name,
    phone: data.phone,
    date: today,
    sequenceNumber,
    bookingReference,
    status: 'waiting',
    serviceName: data.serviceName || 'كشف جديد',
    price: data.price || 200,
    createdBy: data.actorUid || 'AI_AGENT',
    createdAt: nowIso,
    updatedAt: nowIso
  };

  const created = await createDocRest(`queues/${clinicId}/patients`, newTicketData, undefined, idToken);
  return {
    patientId: created?.id || `ticket_${Date.now()}`,
    sequenceNumber,
    bookingReference
  };
}

