import {
  AiAgentMessage,
  AiToolCall,
  AiToolResult,
  AiAutonomousTask,
  AiAuditLog,
  AiToolName,
  AiConversation
} from '../../types/aiAgent';
import { ClinicMember } from '../../types';
import { collection, getDocs, query, orderBy, limit, doc, addDoc, updateDoc, setDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../firebase/config';
import { dispatchClinicEvent, ClinicEventPayload } from './aiEventEngine';

export interface SendAiMessageParams {
  clinicId: string;
  messages: AiAgentMessage[];
  userMember: ClinicMember | null;
  isDoctorOwner: boolean;
  isSubscriptionActive: boolean;
  confirmedActionId?: string;
}

/**
 * Deep sanitization to eliminate any unsupported `undefined` values before Firestore storage
 */
export function sanitizeDocData(obj: any): any {
  if (obj === undefined) return null;
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map(sanitizeDocData);
  }
  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      clean[k] = sanitizeDocData(v);
    }
  }
  return clean;
}

/**
 * Clean and serialize messages ensuring no undefined properties break storage
 */
export function cleanMessageForStorage(msg: AiAgentMessage): AiAgentMessage {
  const clean: any = {
    id: msg.id || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    role: msg.role === 'assistant' ? 'assistant' : 'user',
    content: msg.content || '',
    timestamp: msg.timestamp || new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
  };

  if (Array.isArray(msg.toolCalls) && msg.toolCalls.length > 0) {
    clean.toolCalls = sanitizeDocData(msg.toolCalls);
  }
  if (Array.isArray(msg.toolResults) && msg.toolResults.length > 0) {
    clean.toolResults = sanitizeDocData(msg.toolResults);
  }
  if (msg.status) {
    clean.status = msg.status;
  }

  return clean;
}

/**
 * Send natural language message to the Dory AI Agent backend
 */
export async function sendAiMessage(params: SendAiMessageParams): Promise<{
  reply: string;
  toolCalls?: AiToolCall[];
  toolResults?: AiToolResult[];
  status: 'done' | 'failed' | 'needs_confirmation';
}> {
  try {
    const user = auth.currentUser;
    const token = user ? await user.getIdToken().catch(() => null) : null;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers,
      body: JSON.stringify(params)
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `خطأ في استجابة الخادم (${response.status})`);
    }

    return await response.json();
  } catch (error: any) {
    console.error('[AI Client Error]:', error);
    return {
      reply: `تعذر الاتصال بخادم الذكاء الاصطناعي: ${error.message || 'خطأ في الشبكة'}`,
      status: 'failed'
    };
  }
}

/**
 * Directly execute a tool call from the UI (e.g. after manual user confirmation)
 */
export async function executeDirectTool(params: {
  clinicId: string;
  toolName: AiToolName;
  args: Record<string, any>;
  userMember: ClinicMember | null;
  isDoctorOwner: boolean;
  isSubscriptionActive: boolean;
  confirmedActionId?: string;
}): Promise<AiToolResult> {
  try {
    const user = auth.currentUser;
    const token = user ? await user.getIdToken().catch(() => null) : null;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch('/api/ai/execute-tool', {
      method: 'POST',
      headers,
      body: JSON.stringify(params)
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `فشل استدعاء الأداة (${response.status})`);
    }

    return await response.json();
  } catch (error: any) {
    return {
      toolCallId: params.confirmedActionId || `tc_err_${Date.now()}`,
      toolName: params.toolName,
      status: 'failed',
      error: error.message || 'فشل الاتصال بالخادم'
    };
  }
}

/**
 * Fetch AI Engine Status & Provider
 */
export async function fetchAiStatus(): Promise<{
  status: string;
  provider: string;
  hasApiKey: boolean;
  agentVersion: string;
}> {
  try {
    const res = await fetch('/api/ai/status');
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // Non-blocking fallback
  }
  return {
    status: 'ready',
    provider: 'deterministic-intent-engine',
    hasApiKey: false,
    agentVersion: 'Dory-Agent-v1.0'
  };
}

/**
 * Fetch autonomous tasks for a clinic from Firestore
 */
export async function getClinicAiTasks(clinicId: string): Promise<AiAutonomousTask[]> {
  try {
    const colRef = collection(db, 'doctors', clinicId, 'aiTasks');
    const snap = await getDocs(query(colRef, limit(50)));
    const tasks: AiAutonomousTask[] = [];
    snap.forEach((d) => tasks.push({ id: d.id, ...d.data() } as AiAutonomousTask));
    return tasks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (err) {
    console.error('Error fetching AI tasks:', err);
    return [];
  }
}

/**
 * Save a new autonomous AI task
 */
export async function saveClinicAiTask(
  clinicId: string,
  task: Omit<AiAutonomousTask, 'id' | 'createdAt' | 'executionCount'>
): Promise<string> {
  const colRef = collection(db, 'doctors', clinicId, 'aiTasks');
  const nowIso = new Date().toISOString();
  const docRef = await addDoc(colRef, {
    ...task,
    createdAt: nowIso,
    executionCount: 0
  });
  return docRef.id;
}

/**
 * Toggle an autonomous task between active and paused
 */
export async function toggleClinicAiTaskStatus(
  clinicId: string,
  taskId: string,
  status: 'active' | 'paused'
): Promise<void> {
  const taskRef = doc(db, 'doctors', clinicId, 'aiTasks', taskId);
  await updateDoc(taskRef, {
    status,
    updatedAt: new Date().toISOString()
  });
}

/**
 * Fetch AI Audit Logs for a clinic
 */
export async function getClinicAiAuditLogs(clinicId: string, limitCount = 30): Promise<AiAuditLog[]> {
  try {
    const logsCol = collection(db, 'doctors', clinicId, 'aiAuditLogs');
    let snap;
    try {
      snap = await getDocs(query(logsCol, orderBy('timestamp', 'desc'), limit(limitCount)));
    } catch {
      snap = await getDocs(query(logsCol, limit(limitCount)));
    }
    const logs: AiAuditLog[] = [];
    snap.forEach((d) => logs.push({ id: d.id, ...d.data() } as AiAuditLog));
    return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  } catch (err) {
    console.error('Error fetching AI audit logs:', err);
    return [];
  }
}

/**
 * Trigger an application event to evaluate AI rules
 */
export async function emitClinicEvent(payload: ClinicEventPayload): Promise<void> {
  await dispatchClinicEvent(payload);
}

// ============================================================================
// AI CONVERSATION PERSISTENCE & HISTORY (FIRESTORE + LOCAL STORAGE FALLBACK)
// ============================================================================

const CONV_LOCAL_KEY_PREFIX = 'dory_ai_conversations_';
const ACTIVE_CONV_KEY_PREFIX = 'dory_ai_active_conv_';

export function getLocalConversations(clinicId: string): AiConversation[] {
  try {
    const raw = localStorage.getItem(`${CONV_LOCAL_KEY_PREFIX}${clinicId}`);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.warn('[AI Client] Failed reading local conversations:', err);
    return [];
  }
}

export function saveLocalConversations(clinicId: string, convs: AiConversation[]): void {
  try {
    localStorage.setItem(`${CONV_LOCAL_KEY_PREFIX}${clinicId}`, JSON.stringify(convs));
  } catch (err) {
    console.warn('[AI Client] Failed saving local conversations:', err);
  }
}

export function getActiveConversationId(clinicId: string): string | null {
  try {
    return localStorage.getItem(`${ACTIVE_CONV_KEY_PREFIX}${clinicId}`);
  } catch {
    return null;
  }
}

export function setActiveConversationId(clinicId: string, conversationId: string): void {
  try {
    localStorage.setItem(`${ACTIVE_CONV_KEY_PREFIX}${clinicId}`, conversationId);
  } catch {}
}

/**
 * Fetch all saved conversations for a clinic from Firestore and local cache
 */
export async function getClinicAiConversations(clinicId: string): Promise<AiConversation[]> {
  const localList = getLocalConversations(clinicId);

  try {
    const colRef = collection(db, 'doctors', clinicId, 'aiConversations');
    const snap = await getDocs(query(colRef, limit(50)));
    const remoteList: AiConversation[] = [];

    snap.forEach((d) => {
      const data = d.data();
      remoteList.push({
        id: d.id,
        clinicId: data.clinicId || clinicId,
        userId: data.userId || '',
        userName: data.userName || '',
        title: data.title || 'محادثة سابقة',
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || new Date().toISOString(),
        messageCount: data.messageCount || (Array.isArray(data.messages) ? data.messages.length : 0),
        lastMessagePreview: data.lastMessagePreview || '',
        messages: Array.isArray(data.messages) ? data.messages : []
      });
    });

    if (remoteList.length > 0) {
      // Smart merging: NEVER overwrite a local conversation that has more messages with an older remote version
      const mergedMap = new Map<string, AiConversation>();
      // 1. Seed with local conversations
      localList.forEach((local) => {
        mergedMap.set(local.id, local);
      });

      // 2. Merge each remote conversation
      remoteList.forEach((remote) => {
        const local = mergedMap.get(remote.id);
        if (!local) {
          mergedMap.set(remote.id, remote);
        } else {
          const remoteCount = Array.isArray(remote.messages) ? remote.messages.length : (remote.messageCount || 0);
          const localCount = Array.isArray(local.messages) ? local.messages.length : (local.messageCount || 0);
          const remoteTime = new Date(remote.updatedAt || 0).getTime();
          const localTime = new Date(local.updatedAt || 0).getTime();

          if (remoteCount > localCount || (remoteCount === localCount && remoteTime >= localTime)) {
            // Remote has richer or equal messages and is newer
            mergedMap.set(remote.id, remote);
          } else {
            // Local has MORE messages! Preserve local and sync missing messages back to Firestore
            mergedMap.set(remote.id, local);
            try {
              const docRef = doc(db, 'doctors', clinicId, 'aiConversations', local.id);
              setDoc(docRef, sanitizeDocData(local), { merge: true }).catch(() => {});
            } catch {}
          }
        }
      });

      const merged = Array.from(mergedMap.values()).sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
      saveLocalConversations(clinicId, merged);
      return merged;
    }
  } catch (err) {
    console.warn('[AI Client] Could not read conversations from Firestore, using local fallback:', err);
  }

  return localList.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

/**
 * Fetch a single conversation with all its messages
 */
export async function getAiConversation(
  clinicId: string,
  conversationId: string
): Promise<AiConversation | null> {
  const localList = getLocalConversations(clinicId);
  const localMatch = localList.find((c) => c.id === conversationId);

  try {
    const docRef = doc(db, 'doctors', clinicId, 'aiConversations', conversationId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      const remoteConv: AiConversation = {
        id: snap.id,
        clinicId: data.clinicId || clinicId,
        userId: data.userId || '',
        userName: data.userName || '',
        title: data.title || 'محادثة سابقة',
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || new Date().toISOString(),
        messageCount: data.messageCount || (Array.isArray(data.messages) ? data.messages.length : 0),
        lastMessagePreview: data.lastMessagePreview || '',
        messages: Array.isArray(data.messages) ? data.messages : []
      };

      // Check if local copy has more messages
      if (localMatch && (localMatch.messages?.length || 0) > (remoteConv.messages?.length || 0)) {
        // Local has more messages; re-sync to Firestore in background
        setDoc(docRef, sanitizeDocData(localMatch), { merge: true }).catch(() => {});
        return localMatch;
      }

      // Update local storage
      const updatedList = [remoteConv, ...localList.filter((c) => c.id !== conversationId)];
      saveLocalConversations(clinicId, updatedList);
      return remoteConv;
    }
  } catch (err) {
    console.warn('[AI Client] Error fetching conversation from Firestore, falling back to local:', err);
  }

  return localMatch || null;
}

/**
 * Create a brand new conversation
 */
export async function createAiConversation(
  clinicId: string,
  userId: string,
  userName?: string,
  title?: string
): Promise<AiConversation> {
  const newId = `conv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const nowIso = new Date().toISOString();

  const welcomeMessage: AiAgentMessage = {
    id: `msg_welcome_${Date.now()}`,
    role: 'assistant',
    content: `مرحباً بك! أنا **وكيل دوري الذكي** (Dory AI Agent).\n\nأنا وكيل تشغيلي حقيقي مدمج في عيادتك. أستطيع تنفيذ الأوامر، النداء على المرضى، البحث في السجلات الطبية، تسجيل المدفوعات، وإدارة القواعد الآلية.\n\nكيف يمكنني مساعدتك الآن؟`,
    timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
  };

  const cleanWelcome = cleanMessageForStorage(welcomeMessage);

  const newConv: AiConversation = {
    id: newId,
    clinicId,
    userId,
    userName: userName || 'طبيب العيادة',
    title: title || 'محادثة جديدة',
    createdAt: nowIso,
    updatedAt: nowIso,
    messageCount: 1,
    lastMessagePreview: 'مرحباً بك! أنا وكيل دوري الذكي...',
    messages: [cleanWelcome]
  };

  // 1. Immediately save to local storage
  const localList = getLocalConversations(clinicId);
  saveLocalConversations(clinicId, [newConv, ...localList.filter((c) => c.id !== newId)]);
  setActiveConversationId(clinicId, newId);

  // 2. Persist to Firestore with sanitized payload
  try {
    const docRef = doc(db, 'doctors', clinicId, 'aiConversations', newId);
    await setDoc(docRef, sanitizeDocData(newConv));
  } catch (err) {
    console.warn('[AI Client] Firestore write failed for new conversation, retained locally:', err);
  }

  return newConv;
}

/**
 * Persist messages array for a conversation
 */
export async function saveAiMessages(
  clinicId: string,
  conversationId: string,
  messages: AiAgentMessage[],
  customTitle?: string
): Promise<void> {
  const nowIso = new Date().toISOString();
  const localList = getLocalConversations(clinicId);
  const current = localList.find((c) => c.id === conversationId);

  // Auto-generate title from first user message if title is still default
  let finalTitle = customTitle || current?.title || 'محادثة جديدة';
  if ((!current?.title || current.title === 'محادثة جديدة') && !customTitle) {
    const firstUserMsg = messages.find((m) => m.role === 'user');
    if (firstUserMsg && firstUserMsg.content) {
      finalTitle = firstUserMsg.content.slice(0, 36).trim();
      if (firstUserMsg.content.length > 36) finalTitle += '...';
    }
  }

  const cleanMessages = messages.map(cleanMessageForStorage);
  const lastMsg = cleanMessages[cleanMessages.length - 1];
  const lastPreview = lastMsg ? lastMsg.content.slice(0, 60).trim() : '';

  const updatedConv: AiConversation = {
    id: conversationId,
    clinicId,
    userId: current?.userId || '',
    userName: current?.userName || '',
    title: finalTitle,
    createdAt: current?.createdAt || nowIso,
    updatedAt: nowIso,
    messageCount: cleanMessages.length,
    lastMessagePreview: lastPreview,
    messages: cleanMessages
  };

  // 1. Save synchronously to local storage
  const updatedList = [updatedConv, ...localList.filter((c) => c.id !== conversationId)];
  saveLocalConversations(clinicId, updatedList);

  // 2. Persist asynchronously to Firestore
  try {
    const docRef = doc(db, 'doctors', clinicId, 'aiConversations', conversationId);
    await setDoc(docRef, sanitizeDocData(updatedConv), { merge: true });
  } catch (err) {
    console.warn('[AI Client] Firestore update failed for messages, saved in local cache:', err);
  }
}

/**
 * Delete a conversation
 */
export async function deleteAiConversation(clinicId: string, conversationId: string): Promise<void> {
  // 1. Remove from local storage
  const localList = getLocalConversations(clinicId);
  saveLocalConversations(clinicId, localList.filter((c) => c.id !== conversationId));

  const activeId = getActiveConversationId(clinicId);
  if (activeId === conversationId) {
    localStorage.removeItem(`${ACTIVE_CONV_KEY_PREFIX}${clinicId}`);
  }

  // 2. Delete from Firestore
  try {
    const docRef = doc(db, 'doctors', clinicId, 'aiConversations', conversationId);
    await deleteDoc(docRef);
  } catch (err) {
    console.warn('[AI Client] Failed to delete conversation from Firestore:', err);
  }
}
