import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Bot,
  User,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Play,
  Pause,
  Plus,
  RefreshCw,
  Clock,
  ShieldAlert,
  Terminal,
  Zap,
  Activity,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  History,
  Trash2,
  Pencil,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { DoctorProfile, ClinicMember } from '../../types';
import {
  AiAgentMessage,
  AiToolCall,
  AiAutonomousTask,
  AiAuditLog,
  AiConversation,
  AutomationDefinition,
  AiRequestLifecycleState
} from '../../types/aiAgent';
import {
  sendAiMessage,
  executeDirectTool,
  fetchAiStatus,
  getClinicAiTasks,
  saveClinicAiTask,
  updateClinicAiTask,
  deleteClinicAiTask,
  toggleClinicAiTaskStatus,
  getClinicAutomationDefinitions,
  saveClinicAutomationDefinition,
  updateClinicAutomationDefinition,
  toggleClinicAutomationDefinitionStatus,
  deleteClinicAutomationDefinition,
  getClinicAiAuditLogs,
  getClinicAiConversations,
  getAiConversation,
  createAiConversation,
  saveAiMessages,
  deleteAiConversation,
  getActiveConversationId,
  setActiveConversationId,
  getLocalConversations
} from '../../services/ai/aiAgentClient';
import { TRUSTED_HANDLER_METADATA } from '../../services/ai/automationRegistry';

interface AiAgentControlCenterProps {
  doctor: DoctorProfile;
  currentMember: ClinicMember | null;
  isDoctorOwner: boolean;
  isSubscriptionActive: boolean;
  onClose?: () => void;
  onShowToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

export const AiAgentControlCenter: React.FC<AiAgentControlCenterProps> = ({
  doctor,
  currentMember,
  isDoctorOwner,
  isSubscriptionActive,
  onClose,
  onShowToast
}) => {
  const [activeTab, setActiveTab] = useState<'chat' | 'tasks' | 'definitions' | 'audit'>('chat');
  const [inputMessage, setInputMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [requestLifecycleState, setRequestLifecycleState] = useState<AiRequestLifecycleState>('idle');
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);

  const [aiStatus, setAiStatus] = useState<{ provider: string; status: string; hasApiKey: boolean }>({
    provider: 'checking...',
    status: 'checking',
    hasApiKey: false
  });

  // Persistent Conversation State with immediate local hydration
  const [conversations, setConversations] = useState<AiConversation[]>(() => {
    return getLocalConversations(doctor.uid);
  });
  const [activeConversationId, setActiveConvId] = useState<string | null>(() => {
    return getActiveConversationId(doctor.uid);
  });
  const [activeConversation, setActiveConv] = useState<AiConversation | null>(() => {
    const list = getLocalConversations(doctor.uid);
    const savedId = getActiveConversationId(doctor.uid);
    return list.find((c) => c.id === savedId) || list[0] || null;
  });
  const [loadingConversations, setLoadingConversations] = useState<boolean>(() => {
    const list = getLocalConversations(doctor.uid);
    return list.length === 0;
  });
  const [messages, setMessages] = useState<AiAgentMessage[]>(() => {
    const list = getLocalConversations(doctor.uid);
    const savedId = getActiveConversationId(doctor.uid);
    const active = list.find((c) => c.id === savedId) || list[0];
    return active?.messages || [];
  });
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);

  // Pending Confirmation state for sensitive tools
  const [pendingConfirmation, setPendingConfirmation] = useState<{
    toolCall: AiToolCall;
    onConfirm: () => void;
    onCancel: () => void;
  } | null>(null);

  // Autonomous Tasks state
  const [tasks, setTasks] = useState<AiAutonomousTask[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskTrigger, setNewTaskTrigger] = useState<'QUEUE_WAIT_TIME_EXCEEDED' | 'OUTSTANDING_BALANCE_EXCEEDED' | 'PATIENT_REGISTERED'>('QUEUE_WAIT_TIME_EXCEEDED');
  const [newTaskThreshold, setNewTaskThreshold] = useState<number>(30);
  const [newTaskAction, setNewTaskAction] = useState<'ALERT_STAFF' | 'SEND_REMINDER' | 'FLAG_HIGH_BALANCE'>('ALERT_STAFF');
  const [selectedTriggerDefId, setSelectedTriggerDefId] = useState<string>('');
  const [selectedActionDefId, setSelectedActionDefId] = useState<string>('');

  // Automation Definitions State
  const [definitions, setDefinitions] = useState<AutomationDefinition[]>([]);
  const [loadingDefinitions, setLoadingDefinitions] = useState(false);
  const [defSearchQuery, setDefSearchQuery] = useState('');
  const [defTypeFilter, setDefTypeFilter] = useState<'all' | 'TRIGGER' | 'ACTION'>('all');
  const [isDefModalOpen, setIsDefModalOpen] = useState(false);
  const [editingDef, setEditingDef] = useState<AutomationDefinition | null>(null);
  const [defName, setDefName] = useState('');
  const [defDesc, setDefDesc] = useState('');
  const [defKind, setDefKind] = useState<'TRIGGER' | 'ACTION'>('TRIGGER');
  const [defHandlerId, setDefHandlerId] = useState<string>('QUEUE_WAIT_TIME_EXCEEDED');
  const [defThreshold, setDefThreshold] = useState<number>(30);
  const [defMessageTemplate, setDefMessageTemplate] = useState<string>('تنبيه آلي من وكيل دوري');
  const [defTargetRole, setDefTargetRole] = useState<string>('ALL');
  const [defSeverity, setDefSeverity] = useState<'info' | 'warning' | 'urgent'>('warning');

  // Audit Logs state
  const [auditLogs, setAuditLogs] = useState<AiAuditLog[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  // Expanded tool call steps map
  const [expandedSteps, setExpandedSteps] = useState<Record<string, boolean>>({});

  // Editing existing task state
  const [editingTask, setEditingTask] = useState<AiAutonomousTask | null>(null);

  // Request Lifecycle & Superseding references
  const currentAbortControllerRef = useRef<AbortController | null>(null);
  const currentRequestIdRef = useRef<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Cleanup in-flight foreground AI requests on unmount
  useEffect(() => {
    return () => {
      if (currentAbortControllerRef.current) {
        currentAbortControllerRef.current.abort('unmount');
      }
    };
  }, []);

  // 1. Initial Load: Status & Persistent Conversations
  useEffect(() => {
    fetchAiStatus().then(setAiStatus);

    let isMounted = true;
    async function initChat() {
      try {
        const convList = await getClinicAiConversations(doctor.uid);
        if (!isMounted) return;
        
        if (convList.length > 0) {
          setConversations(convList);

          const savedActiveId = getActiveConversationId(doctor.uid);
          let selectedConv = convList.find((c) => c.id === savedActiveId);

          if (!selectedConv && convList.length > 0) {
            selectedConv = convList[0];
          }

          if (selectedConv) {
            setActiveConvId(selectedConv.id);
            setActiveConv(selectedConv);
            setActiveConversationId(doctor.uid, selectedConv.id);
            if (selectedConv.messages && selectedConv.messages.length > 0) {
              setMessages(selectedConv.messages);
            } else {
              // Load full conversation if messages were omitted
              const full = await getAiConversation(doctor.uid, selectedConv.id);
              if (isMounted && full && full.messages && full.messages.length > 0) {
                setMessages(full.messages);
                setActiveConv(full);
              }
            }
          }
        } else {
          // If Firestore query returned empty, check local cache first before creating new
          const localExisting = getLocalConversations(doctor.uid);
          if (localExisting.length > 0) {
            const savedActiveId = getActiveConversationId(doctor.uid);
            const selected = localExisting.find((c) => c.id === savedActiveId) || localExisting[0];
            setConversations(localExisting);
            setActiveConvId(selected.id);
            setActiveConv(selected);
            setMessages(selected.messages || []);
          } else {
            const freshConv = await createAiConversation(
              doctor.uid,
              currentMember?.uid || doctor.uid,
              currentMember?.name || doctor.name
            );
            if (!isMounted) return;
            setConversations([freshConv]);
            setActiveConvId(freshConv.id);
            setActiveConv(freshConv);
            setMessages(freshConv.messages || []);
          }
        }
      } catch (err) {
        console.error('Failed to initialize AI conversations:', err);
      } finally {
        if (isMounted) setLoadingConversations(false);
      }
    }

    initChat();

    return () => {
      isMounted = false;
    };
  }, [doctor.uid]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (activeTab === 'chat') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeTab, isProcessing]);

  // Load Tasks / Definitions / Audit when corresponding tab active
  useEffect(() => {
    if (activeTab === 'tasks') {
      loadTasks();
    } else if (activeTab === 'definitions') {
      loadDefinitions();
    } else if (activeTab === 'audit') {
      loadAudit();
    }
  }, [activeTab, doctor.uid]);

  // Pre-load definitions for Task creator
  useEffect(() => {
    loadDefinitions();
  }, [doctor.uid]);

  async function loadTasks() {
    setLoadingTasks(true);
    const data = await getClinicAiTasks(doctor.uid);
    setTasks(data);
    setLoadingTasks(false);
  }

  async function loadDefinitions() {
    setLoadingDefinitions(true);
    try {
      const data = await getClinicAutomationDefinitions(doctor.uid);
      setDefinitions(data);
    } catch (err) {
      console.error('Failed to load definitions:', err);
    } finally {
      setLoadingDefinitions(false);
    }
  }

  async function loadAudit() {
    setLoadingAudit(true);
    const data = await getClinicAiAuditLogs(doctor.uid);
    setAuditLogs(data);
    setLoadingAudit(false);
  }

  // Definition CRUD Handlers
  async function handleSaveDefinition() {
    const cleanName = defName.trim();
    if (!cleanName) {
      if (onShowToast) onShowToast('اسم القالب مطلوب', 'warning');
      return;
    }

    try {
      const configFields: any[] = [];
      const defaultConfig: Record<string, any> = {};

      if (defKind === 'TRIGGER') {
        if (defHandlerId === 'QUEUE_WAIT_TIME_EXCEEDED' || defHandlerId === 'OUTSTANDING_BALANCE_EXCEEDED' || defHandlerId === 'DAILY_CAPACITY_REACHED') {
          configFields.push({
            key: 'threshold',
            labelAr: defHandlerId === 'QUEUE_WAIT_TIME_EXCEEDED' ? 'الحد بالدقائق' : (defHandlerId === 'DAILY_CAPACITY_REACHED' ? 'سقف المرضى' : 'المبلغ بالجنيه'),
            type: 'number',
            required: true,
            defaultValue: defThreshold
          });
          defaultConfig.threshold = defThreshold;
        }
      } else {
        if (defHandlerId === 'ALERT_STAFF' || defHandlerId === 'SEND_REMINDER') {
          configFields.push({
            key: 'messageTemplate',
            labelAr: 'نص التنبيه الافتراضي',
            type: 'string',
            required: true,
            defaultValue: defMessageTemplate
          });
          defaultConfig.messageTemplate = defMessageTemplate;
        }
        if (defHandlerId === 'ALERT_STAFF') {
          configFields.push({
            key: 'targetRole',
            labelAr: 'الفئة المستهدفة',
            type: 'select',
            defaultValue: defTargetRole,
            options: [
              { value: 'ALL', labelAr: 'الجميع' },
              { value: 'DOCTOR', labelAr: 'الأطباء' },
              { value: 'ASSISTANT', labelAr: 'التمريض' },
              { value: 'RECEPTIONIST', labelAr: 'الاستقبال' }
            ]
          });
          defaultConfig.targetRole = defTargetRole;
          defaultConfig.severity = defSeverity;
        }
      }

      if (editingDef) {
        await updateClinicAutomationDefinition(doctor.uid, editingDef.id, {
          name: cleanName,
          description: defDesc.trim() || cleanName,
          configFields,
          defaultConfig
        });
        if (onShowToast) onShowToast('تم تحديث القالب المخصص بنجاح', 'success');
      } else {
        await saveClinicAutomationDefinition(doctor.uid, {
          name: cleanName,
          description: defDesc.trim() || cleanName,
          kind: defKind,
          handlerId: defHandlerId,
          configFields,
          defaultConfig,
          status: 'active'
        }, {
          uid: currentMember?.uid || doctor.uid,
          name: currentMember?.name || doctor.name
        });
        if (onShowToast) onShowToast('تم حفظ القالب المخصص بنجاح في نظام العيادة', 'success');
      }

      setIsDefModalOpen(false);
      setEditingDef(null);
      setDefName('');
      setDefDesc('');
      loadDefinitions();
    } catch (err: any) {
      if (onShowToast) onShowToast(err.message || 'فشل حفظ القالب', 'error');
    }
  }

  async function handleToggleDefStatus(def: AutomationDefinition) {
    if (def.isBuiltIn) {
      if (onShowToast) onShowToast('لا يمكن تعديل حالة القوالب المدمجة الأساسية للنظام', 'info');
      return;
    }
    const next = def.status === 'active' ? 'disabled' : 'active';
    try {
      await toggleClinicAutomationDefinitionStatus(doctor.uid, def.id, next);
      setDefinitions((prev) => prev.map((d) => (d.id === def.id ? { ...d, status: next } : d)));
      if (onShowToast) onShowToast(`تم ${next === 'active' ? 'تفعيل' : 'تعطيل'} القالب`, 'info');
    } catch (err: any) {
      if (onShowToast) onShowToast(err.message || 'فشل تحديث حالة القالب', 'error');
    }
  }

  async function handleDeleteDef(def: AutomationDefinition) {
    if (def.isBuiltIn) {
      if (onShowToast) onShowToast('لا يمكن حذف القوالب المدمجة الأساسية للنظام', 'warning');
      return;
    }
    if (!confirm(`هل أنت متأكد من حذف القالب المخصص "${def.name}"؟`)) return;

    try {
      const outcome = await deleteClinicAutomationDefinition(doctor.uid, def.id);
      if (outcome.deleted) {
        setDefinitions((prev) => prev.filter((d) => d.id !== def.id));
        if (onShowToast) onShowToast('تم حذف القالب المخصص نهائياً', 'success');
      } else if (outcome.notice) {
        setDefinitions((prev) => prev.map((d) => (d.id === def.id ? { ...d, status: 'disabled' } : d)));
        if (onShowToast) onShowToast(outcome.notice, 'warning');
      }
    } catch (err: any) {
      if (onShowToast) onShowToast(err.message || 'فشل حذف القالب', 'error');
    }
  }

  // Handle Switching to a different conversation
  async function handleSelectConversation(convId: string) {
    if (convId === activeConversationId) {
      setShowHistoryDrawer(false);
      return;
    }

    // Persist current active conversation messages before switching
    if (activeConversationId && messages.length > 0) {
      await saveAiMessages(doctor.uid, activeConversationId, messages);
    }

    setShowHistoryDrawer(false);
    setActiveConvId(convId);
    setActiveConversationId(doctor.uid, convId);

    // Look up in current list
    const found = conversations.find((c) => c.id === convId);
    if (found && Array.isArray(found.messages) && found.messages.length > 0) {
      setActiveConv(found);
      setMessages(found.messages);
    } else {
      // Fetch full conversation document
      const full = await getAiConversation(doctor.uid, convId);
      if (full) {
        setActiveConv(full);
        setMessages(full.messages || []);
        setConversations((prev) => prev.map((c) => (c.id === convId ? full : c)));
      }
    }
  }

  // Handle Creating a New Conversation
  async function handleNewConversation() {
    setShowHistoryDrawer(false);
    try {
      const freshConv = await createAiConversation(
        doctor.uid,
        currentMember?.uid || doctor.uid,
        currentMember?.name || doctor.name
      );
      setConversations((prev) => [freshConv, ...prev.filter((c) => c.id !== freshConv.id)]);
      setActiveConvId(freshConv.id);
      setActiveConv(freshConv);
      setMessages(freshConv.messages || []);
      if (onShowToast) onShowToast('تم بدء محادثة جديدة مع الوكيل الذكي', 'info');
    } catch (err: any) {
      if (onShowToast) onShowToast(err?.message || 'فشل إنشاء محادثة جديدة', 'error');
    }
  }

  // Handle Deleting a Conversation
  async function handleDeleteConversation(convId: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm('هل تريد حذف هذه المحادثة بشكل نهائي؟')) return;

    try {
      await deleteAiConversation(doctor.uid, convId);
      const remaining = conversations.filter((c) => c.id !== convId);
      setConversations(remaining);

      // If active conversation was deleted, switch to next or create new
      if (activeConversationId === convId) {
        if (remaining.length > 0) {
          handleSelectConversation(remaining[0].id);
        } else {
          handleNewConversation();
        }
      }
      if (onShowToast) onShowToast('تم حذف المحادثة', 'info');
    } catch (err: any) {
      if (onShowToast) onShowToast(err?.message || 'فشل حذف المحادثة', 'error');
    }
  }

  // Handle Cancel Current In-Flight Request
  function handleCancelCurrentRequest() {
    if (currentAbortControllerRef.current) {
      currentAbortControllerRef.current.abort('user_cancelled');
      currentAbortControllerRef.current = null;
    }
    currentRequestIdRef.current = null;
    setActiveRequestId(null);
    setIsProcessing(false);
    setRequestLifecycleState('cancelled');
    if (onShowToast) onShowToast('تم إيقاف الطلب الحالي', 'info');
  }

  // Handle Send Message & Persist
  async function handleSendMessage(customPrompt?: string) {
    const textToSend = customPrompt || inputMessage;
    if (!textToSend.trim() || isProcessing) return; // Prevent duplicate rapid submission

    // If an older foreground request is still active, abort it and supersede with this fresh command
    if (currentAbortControllerRef.current) {
      console.log('[AI Control Center] Superseding previous request with new user command');
      currentAbortControllerRef.current.abort('superseded');
    }

    const thisRequestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    currentRequestIdRef.current = thisRequestId;
    setActiveRequestId(thisRequestId);
    setRequestLifecycleState('submitting');

    const abortCtrl = new AbortController();
    currentAbortControllerRef.current = abortCtrl;

    // Ensure we have an active conversation
    let currentConvId = activeConversationId;
    if (!currentConvId) {
      const freshConv = await createAiConversation(
        doctor.uid,
        currentMember?.uid || doctor.uid,
        currentMember?.name || doctor.name
      );
      currentConvId = freshConv.id;
      setActiveConvId(freshConv.id);
      setActiveConv(freshConv);
      setConversations((prev) => [freshConv, ...prev]);
    }

    const userMsg: AiAgentMessage = {
      id: `msg_u_${Date.now()}`,
      role: 'user',
      content: textToSend.trim(),
      timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
    };

    const messagesWithUser = [...messages, userMsg];
    setMessages(messagesWithUser);
    if (!customPrompt) setInputMessage('');
    setIsProcessing(true);
    setRequestLifecycleState('waiting_ai');

    // Save user message immediately to storage
    await saveAiMessages(doctor.uid, currentConvId, messagesWithUser);

    try {
      const response = await sendAiMessage({
        clinicId: doctor.uid,
        messages: messagesWithUser,
        userMember: currentMember,
        isDoctorOwner,
        isSubscriptionActive,
        signal: abortCtrl.signal,
        requestId: thisRequestId
      });

      // Stale / Cancelled / Superseded Guard:
      // If a newer request was dispatched while this was in-flight, or if aborted, discard late result
      if (currentRequestIdRef.current !== thisRequestId || abortCtrl.signal.aborted) {
        console.log('[AI Control Center] Discarding response from superseded request:', thisRequestId);
        return;
      }

      const assistantMsg: AiAgentMessage = {
        id: `msg_a_${Date.now()}`,
        role: 'assistant',
        content: response.reply,
        toolCalls: response.toolCalls,
        toolResults: response.toolResults,
        status: response.status,
        timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
      };

      const finalMessages = [...messagesWithUser, assistantMsg];
      setMessages(finalMessages);

      // Persist assistant message and update conversation metadata
      await saveAiMessages(doctor.uid, currentConvId, finalMessages);
      setActiveConv((prev) => (prev ? { ...prev, messages: finalMessages, messageCount: finalMessages.length } : null));

      // Update conversations list state to reflect new title/counts
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id === currentConvId) {
            let updatedTitle = c.title;
            if (updatedTitle === 'محادثة جديدة') {
              updatedTitle = textToSend.trim().slice(0, 36);
              if (textToSend.trim().length > 36) updatedTitle += '...';
            }
            return {
              ...c,
              title: updatedTitle,
              messageCount: finalMessages.length,
              lastMessagePreview: response.reply.slice(0, 60),
              updatedAt: new Date().toISOString(),
              messages: finalMessages
            };
          }
          return c;
        })
      );

      // Check if any tool requires confirmation
      const pendingTool = response.toolCalls?.find(
        (tc) => tc.status === 'awaiting_confirmation' || (tc.error && tc.error.includes('تأكيداً'))
      );

      if (pendingTool) {
        setPendingConfirmation({
          toolCall: pendingTool,
          onConfirm: async () => {
            const confirmedCallId = pendingTool.id;
            setPendingConfirmation(null);
            setIsProcessing(true);

            // Execute the confirmed tool
            const toolResult = await executeDirectTool({
              clinicId: doctor.uid,
              toolName: pendingTool.toolName,
              args: pendingTool.arguments,
              userMember: currentMember,
              isDoctorOwner,
              isSubscriptionActive,
              confirmedActionId: confirmedCallId
            });

            // Append confirmation response
            const confirmMsg: AiAgentMessage = {
              id: `msg_confirm_${Date.now()}`,
              role: 'assistant',
              content: toolResult.status === 'success'
                ? `تم تنفيذ العملية الحساسة بنجاح: ${toolResult.result?.message || 'تم الإجراء'}`
                : `تعذر إتمام العملية: ${toolResult.error}`,
              toolResults: [toolResult],
              status: toolResult.status === 'success' ? 'done' : 'failed',
              timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
            };

            const confirmedFull = [...finalMessages, confirmMsg];
            setMessages(confirmedFull);
            await saveAiMessages(doctor.uid, currentConvId!, confirmedFull);
            setActiveConv((prev) => (prev ? { ...prev, messages: confirmedFull, messageCount: confirmedFull.length } : null));
            setConversations((prev) =>
              prev.map((c) =>
                c.id === currentConvId
                  ? { ...c, messages: confirmedFull, messageCount: confirmedFull.length, updatedAt: new Date().toISOString() }
                  : c
              )
            );

            setIsProcessing(false);
            if (onShowToast) {
              onShowToast(
                toolResult.status === 'success' ? 'تم تنفيذ الإجراء بنجاح' : (toolResult.error || 'فشل الإجراء'),
                toolResult.status === 'success' ? 'success' : 'error'
              );
            }
          },
          onCancel: async () => {
            setPendingConfirmation(null);
            const cancelMsg: AiAgentMessage = {
              id: `msg_cancel_${Date.now()}`,
              role: 'assistant',
              content: 'تم إلغاء الإجراء الحساس بناءً على طلبك ولم يتم تعديل أي بيانات في العيادة.',
              timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
            };
            const cancelledFull = [...finalMessages, cancelMsg];
            setMessages(cancelledFull);
            await saveAiMessages(doctor.uid, currentConvId!, cancelledFull);
            setActiveConv((prev) => (prev ? { ...prev, messages: cancelledFull, messageCount: cancelledFull.length } : null));
            setConversations((prev) =>
              prev.map((c) =>
                c.id === currentConvId
                  ? { ...c, messages: cancelledFull, messageCount: cancelledFull.length, updatedAt: new Date().toISOString() }
                  : c
              )
            );
          }
        });
      }
    } catch (err: any) {
      if (currentRequestIdRef.current !== thisRequestId || abortCtrl.signal.aborted) {
        return;
      }
      const rawMsg = err instanceof Error
        ? err.message
        : (typeof err === 'string' ? err : (typeof err?.message === 'string' ? err.message : ''));
      let safeMsg = (rawMsg && rawMsg !== '[object Object]') ? rawMsg : 'تعذر إكمال العملية حالياً';
      if (safeMsg.includes('[object Object]')) {
        safeMsg = safeMsg.replace(/\[object Object\]/g, 'خطأ في استجابة الخادم').trim();
      }
      const errMsg: AiAgentMessage = {
        id: `msg_err_${Date.now()}`,
        role: 'assistant',
        content: safeMsg.startsWith('عفواً') || safeMsg.startsWith('تعذر') || safeMsg.startsWith('حدث') || safeMsg.startsWith('غير مصرح')
          ? safeMsg
          : `عفواً، واجهت مشكلة أثناء المعالجة: ${safeMsg}.`,
        status: 'failed',
        timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
      };
      const errorFull = [...messagesWithUser, errMsg];
      setMessages(errorFull);
      await saveAiMessages(doctor.uid, currentConvId, errorFull);
      setActiveConv((prev) => (prev ? { ...prev, messages: errorFull, messageCount: errorFull.length } : null));
    } finally {
      if (currentRequestIdRef.current === thisRequestId) {
        setIsProcessing(false);
      }
    }
  }

  // Handle Toggle Autonomous Task
  async function handleToggleTask(taskId: string, currentStatus: 'active' | 'paused') {
    const nextStatus = currentStatus === 'active' ? 'paused' : 'active';
    try {
      await toggleClinicAiTaskStatus(doctor.uid, taskId, nextStatus);
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: nextStatus } : t))
      );
      if (onShowToast) onShowToast(`تم ${nextStatus === 'active' ? 'تفعيل' : 'إيقاف'} القاعدة بنجاح`, 'info');
    } catch (err: any) {
      if (onShowToast) onShowToast(err.message || 'فشل تحديث حالة القاعدة', 'error');
    }
  }

  // Handle Save (Create or Update) Autonomous Task
  async function handleSaveTask() {
    const cleanTitle = newTaskTitle.trim();
    if (!cleanTitle) {
      if (onShowToast) onShowToast('عنوان المهمة مطلوب', 'يرجى كتابة عنوان واضح للمهمة الآلية الذكية', 'warning');
      return;
    }

    try {
      const triggerCfg: { event?: any; condition?: any; threshold?: number } = {};
      if (newTaskTrigger === 'PATIENT_REGISTERED') {
        triggerCfg.event = 'PATIENT_REGISTERED';
      } else if (newTaskTrigger) {
        triggerCfg.condition = newTaskTrigger as any;
      }
      if (newTaskThreshold !== undefined && newTaskThreshold !== null && !isNaN(Number(newTaskThreshold))) {
        triggerCfg.threshold = Number(newTaskThreshold);
      }

      if (editingTask) {
        await updateClinicAiTask(doctor.uid, editingTask.id, {
          title: cleanTitle,
          description: newTaskDesc.trim() || 'قاعدة آلية مخصصة للعيادة',
          triggerType: newTaskTrigger === 'PATIENT_REGISTERED' ? 'EVENT' : 'CONDITION',
          triggerConfig: triggerCfg,
          actionType: newTaskAction,
          actionConfig: {
            severity: 'warning',
            autoExecution: true,
            messageTemplate: newTaskDesc.trim() || cleanTitle
          }
        });
        if (onShowToast) onShowToast('تم تحديث المهمة الآلية بنجاح', 'success');
      } else {
        await saveClinicAiTask(doctor.uid, {
          clinicId: doctor.uid,
          title: cleanTitle,
          description: newTaskDesc.trim() || 'قاعدة آلية مخصصة للعيادة',
          triggerType: newTaskTrigger === 'PATIENT_REGISTERED' ? 'EVENT' : 'CONDITION',
          triggerConfig: triggerCfg,
          actionType: newTaskAction,
          actionConfig: {
            severity: 'warning',
            autoExecution: true,
            messageTemplate: newTaskDesc.trim() || cleanTitle
          },
          status: 'active',
          createdBy: currentMember?.uid || doctor.uid,
          createdByName: currentMember?.name || doctor.name
        });
        if (onShowToast) onShowToast('تم إنشاء وتفعيل المهمة الآلية بنجاح', 'القاعدة تعمل الآن تلقائياً مع أحداث العيادة', 'success');
      }

      setIsNewTaskModalOpen(false);
      setEditingTask(null);
      setNewTaskTitle('');
      setNewTaskDesc('');
      loadTasks();
    } catch (e: any) {
      console.error('Task save error:', e);
      if (onShowToast) onShowToast('فشل حفظ المهمة الآلية', e.message || 'يرجى التأكد من البيانات والمحاولة ثانية', 'error');
    }
  }

  // Handle Delete Autonomous Task
  async function handleDeleteTask(taskId: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm('هل تريد حذف هذه القاعدة الآلية بشكل نهائي من العيادة؟')) return;

    try {
      await deleteClinicAiTask(doctor.uid, taskId);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      if (onShowToast) onShowToast('تم حذف القاعدة الآلية بنجاح', 'info');
    } catch (err: any) {
      if (onShowToast) onShowToast(err?.message || 'فشل حذف القاعدة', 'error');
    }
  }

  // Open Edit Task Modal
  function handleOpenEditTask(task: AiAutonomousTask, e: React.MouseEvent) {
    e.stopPropagation();
    setEditingTask(task);
    setNewTaskTitle(task.title);
    setNewTaskDesc(task.description);
    if (task.triggerConfig?.event === 'PATIENT_REGISTERED') {
      setNewTaskTrigger('PATIENT_REGISTERED');
    } else if (task.triggerConfig?.condition) {
      setNewTaskTrigger(task.triggerConfig.condition as any);
    }
    setNewTaskThreshold(task.triggerConfig?.threshold || 30);
    setNewTaskAction(task.actionType as any);
    setIsNewTaskModalOpen(true);
  }

  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xl overflow-hidden flex flex-col h-[750px] max-h-[85vh] relative text-right" dir="rtl">
      {/* Header bar */}
      <div className="bg-[#122c4a] text-white px-3 sm:px-5 py-3 sm:py-4 flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-700/80 shrink-0">
        <div className="flex items-center justify-between w-full md:w-auto">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-slate-900/90 flex items-center justify-center text-emerald-400 shadow-md border border-slate-700/80 shrink-0">
              <span className="text-lg sm:text-xl leading-none inline-flex items-center justify-center">🤖</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-lg font-black font-['Tajawal',sans-serif] tracking-tight text-white">
                  وكيل دوري الذكي (AI Agent)
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  <span>نشط</span>
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-300 truncate max-w-[200px] sm:max-w-xs">
                المساعد التشغيلي الذكي • عيادة: {doctor.clinicName}
              </p>
            </div>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="md:hidden w-8 h-8 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 flex items-center justify-center transition cursor-pointer border border-slate-700/60"
              title="إغلاق"
            >
              ✕
            </button>
          )}
        </div>

        {/* Tab Switcher & Desktop Close */}
        <div className="flex items-center justify-between sm:justify-end gap-2 w-full md:w-auto">
          <div className="bg-slate-900/80 p-1 rounded-xl flex items-center gap-1 text-xs font-bold border border-slate-700/60 overflow-x-auto no-scrollbar w-full sm:w-auto">
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex-1 sm:flex-initial px-2.5 sm:px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center justify-center gap-1 sm:gap-1.5 whitespace-nowrap ${
                activeTab === 'chat' ? 'bg-[#1b3a5c] text-white shadow-xs border border-slate-600/50' : 'text-slate-300 hover:text-white'
              }`}
            >
              <span className="text-xs leading-none inline-flex items-center justify-center">💬</span>
              <span>المحادثة</span>
            </button>

            <button
              onClick={() => setActiveTab('tasks')}
              className={`flex-1 sm:flex-initial px-2.5 sm:px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center justify-center gap-1 sm:gap-1.5 whitespace-nowrap ${
                activeTab === 'tasks' ? 'bg-[#1b3a5c] text-white shadow-xs border border-slate-600/50' : 'text-slate-300 hover:text-white'
              }`}
            >
              <span className="text-xs leading-none inline-flex items-center justify-center">⚡</span>
              <span>المهام ({tasks.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('audit')}
              className={`flex-1 sm:flex-initial px-2.5 sm:px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center justify-center gap-1 sm:gap-1.5 whitespace-nowrap ${
                activeTab === 'audit' ? 'bg-[#1b3a5c] text-white shadow-xs border border-slate-600/50' : 'text-slate-300 hover:text-white'
              }`}
            >
              <span className="text-xs leading-none inline-flex items-center justify-center">📊</span>
              <span>التدقيق</span>
            </button>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="hidden md:flex w-8 h-8 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 items-center justify-center transition cursor-pointer border border-slate-700/60 shrink-0"
              title="إغلاق"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Subscription Alert if Inactive */}
      {!isSubscriptionActive && (
        <div className="bg-amber-500/10 border-b border-amber-200 px-4 py-2 text-xs text-amber-800 font-bold flex items-center gap-2">
          <span className="text-base leading-none inline-flex items-center justify-center">⚠️</span>
          <span>تنبيه: اشتراك العيادة غير نشط حالياً. يمكن للوكيل قراءة البيانات فقط دون تعديل أو حجز كشوفات جديدة.</span>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 1: CHAT & COMMAND EXECUTION */}
      {/* ============================================================== */}
      {activeTab === 'chat' && (
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-50/50 relative">
          
          {/* Conversation Bar: Current Topic + New Chat + History Drawer Toggle */}
          <div className="px-3 sm:px-4 py-2 sm:py-2.5 bg-white border-b border-slate-200/90 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <span className="text-sm leading-none inline-flex items-center justify-center text-emerald-600">💬</span>
              <span className="font-extrabold text-slate-900 truncate max-w-[140px] sm:max-w-md">
                {activeConversation?.title || 'محادثة جارية'}
              </span>
              <span className="text-[10px] sm:text-[11px] text-slate-400 bg-slate-100 px-1.5 sm:px-2 py-0.5 rounded-full font-bold shrink-0">
                {messages.length} رسائل
              </span>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <button
                onClick={handleNewConversation}
                className="px-2.5 sm:px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200/80 rounded-xl font-bold transition flex items-center gap-1 cursor-pointer shadow-2xs text-[11px] sm:text-xs"
                title="بدء جلسة محادثة جديدة وحفظ السابقة"
              >
                <span className="text-xs leading-none inline-flex items-center justify-center">➕</span>
                <span>جديدة</span>
              </button>

              <button
                onClick={() => setShowHistoryDrawer(!showHistoryDrawer)}
                className={`px-2.5 sm:px-3 py-1.5 rounded-xl font-bold border transition flex items-center gap-1 cursor-pointer text-[11px] sm:text-xs ${
                  showHistoryDrawer
                    ? 'bg-[#122c4a] text-white border-[#122c4a]'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                }`}
                title="عرض أرشيف المحادثات السابقة"
              >
                <span className="text-xs leading-none inline-flex items-center justify-center">📜</span>
                <span>الأرشيف ({conversations.length})</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${showHistoryDrawer ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </div>

          {/* Previous Conversations Dropdown / Drawer Panel */}
          {showHistoryDrawer && (
            <div className="absolute top-11 right-0 left-0 z-30 bg-white border-b border-slate-300 shadow-xl p-4 max-h-72 overflow-y-auto animate-in slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                <div className="font-extrabold text-xs text-slate-800 flex items-center gap-1.5">
                  <span className="text-sm leading-none inline-flex items-center justify-center">🗂️</span>
                  <span>أرشيف محادثاتك السابقة مع الوكيل الذكي:</span>
                </div>
                <button
                  onClick={() => setShowHistoryDrawer(false)}
                  className="text-slate-400 hover:text-slate-700 text-xs font-bold cursor-pointer"
                >
                  إغلاق ✕
                </button>
              </div>

              {conversations.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-400">
                  لا توجد محادثات سابقة بعد.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {conversations.map((conv) => {
                    const isActive = conv.id === activeConversationId;
                    return (
                      <div
                        key={conv.id}
                        onClick={() => handleSelectConversation(conv.id)}
                        className={`p-3 rounded-2xl border text-right cursor-pointer transition flex items-start justify-between gap-3 ${
                          isActive
                            ? 'bg-sky-50/80 border-sky-300 shadow-xs ring-1 ring-sky-200'
                            : 'bg-slate-50/60 hover:bg-slate-100/80 border-slate-200'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="font-bold text-xs text-slate-900 truncate">
                              {conv.title}
                            </span>
                            {isActive && (
                              <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[9px] font-bold rounded-md shrink-0">
                                الحالية
                              </span>
                            )}
                          </div>
                          {conv.lastMessagePreview && (
                            <p className="text-[11px] text-slate-500 truncate">
                              {conv.lastMessagePreview}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-1.5 text-[10px] text-slate-400">
                            <span>{new Date(conv.updatedAt).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                            <span>•</span>
                            <span>{conv.messageCount} رسائل</span>
                          </div>
                        </div>

                        <button
                          onClick={(e) => handleDeleteConversation(conv.id, e)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer shrink-0"
                          title="حذف المحادثة"
                        >
                          <span className="text-xs leading-none inline-flex items-center justify-center">🗑️</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Quick Action Chips */}
          <div className="p-2.5 bg-white border-b border-slate-100 flex items-center gap-2 overflow-x-auto scrollbar-none shrink-0">
            <span className="text-[11px] text-slate-400 font-bold shrink-0">أوامر سريعة:</span>
            {[
              { label: '📢 نادِ المريض التالي', prompt: 'نادِ على المريض التالي في طابور الانتظار' },
              { label: '👥 مين في الطابور دلوقتي؟', prompt: 'استعرض طابور اليوم وحالات المرضى' },
              { label: '💰 ملخص إيرادات اليوم', prompt: 'اعملي كشف حساب وملخص مالي لليوم' },
              { label: '📅 مواعيد إعادة الكشف', prompt: 'استعرض مواعيد إعادة الكشف القادمة' },
              { label: '⏱️ نبهني لو زاد الانتظار عن 30 دقيقة', prompt: 'نبهني لو وقت الانتظار في العيادة زاد عن 30 دقيقة' }
            ].map((chip, idx) => (
              <button
                key={idx}
                disabled={isProcessing}
                onClick={() => handleSendMessage(chip.prompt)}
                className="shrink-0 text-xs px-3 py-1 rounded-full bg-slate-100 hover:bg-sky-50 hover:text-sky-700 text-slate-700 font-medium border border-slate-200/70 transition cursor-pointer whitespace-nowrap disabled:opacity-50"
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {loadingConversations ? (
              <div className="py-20 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-sky-600" />
                <span className="text-xs font-bold">جاري استرجاع محادثاتك وسجلات الأوامر...</span>
              </div>
            ) : messages.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-xs font-medium">
                لا توجد رسائل في هذه المحادثة حتى الآن. ابدأ بكتابة استفسار أو أمر تشغيلي.
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 max-w-[85%] ${
                    msg.role === 'user' ? 'mr-auto flex-row-reverse' : 'ml-auto'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      msg.role === 'user'
                        ? 'bg-slate-900 text-white'
                        : 'bg-[#122c4a] text-emerald-400 border border-slate-700 shadow-xs'
                    }`}
                  >
                    {msg.role === 'user' ? (
                      <span className="text-base leading-none inline-flex items-center justify-center">👤</span>
                    ) : (
                      <span className="text-base leading-none inline-flex items-center justify-center">🤖</span>
                    )}
                  </div>

                  <div
                    className={`rounded-2xl p-4 shadow-2xs border ${
                      msg.role === 'user'
                        ? 'bg-[#122c4a] text-white border-[#122c4a]'
                        : 'bg-white text-slate-800 border-slate-200/90'
                    }`}
                  >
                    {/* Tool Execution Details Badge */}
                    {msg.toolCalls && msg.toolCalls.length > 0 && (
                      <div className="mb-3 space-y-2">
                        {msg.toolCalls.map((tc, idx) => {
                          const isExpanded = expandedSteps[tc.id || String(idx)];
                          return (
                            <div
                              key={idx}
                              className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-700"
                            >
                              <div
                                onClick={() =>
                                  setExpandedSteps((prev) => ({
                                    ...prev,
                                    [tc.id || String(idx)]: !isExpanded
                                  }))
                                }
                                className="flex items-center justify-between cursor-pointer font-bold select-none"
                              >
                                <div className="flex items-center gap-1.5">
                                  <Terminal className="w-3.5 h-3.5 text-sky-600" />
                                  <span>استدعاء أداة: {tc.toolName}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  {tc.status === 'success' && (
                                    <span className="text-emerald-600 flex items-center gap-1 font-bold">
                                      <span className="text-xs leading-none inline-flex items-center justify-center">✅</span>
                                      <span>ناجح</span>
                                    </span>
                                  )}
                                  {tc.status === 'failed' && (
                                    <span className="text-rose-600 flex items-center gap-1 font-bold">
                                      <span className="text-xs leading-none inline-flex items-center justify-center">❌</span>
                                      <span>فشل</span>
                                    </span>
                                  )}
                                  {tc.status === 'denied' && (
                                    <span className="text-amber-600 flex items-center gap-1 font-bold">
                                      <span className="text-xs leading-none inline-flex items-center justify-center">⚠️</span>
                                      <span>مرفوض</span>
                                    </span>
                                  )}
                                  {isExpanded ? (
                                    <ChevronUp className="w-3.5 h-3.5" />
                                  ) : (
                                    <ChevronDown className="w-3.5 h-3.5" />
                                  )}
                                </div>
                              </div>

                              {/* Collapsible Tool Arguments & Result */}
                              {isExpanded && (
                                <div className="mt-2 pt-2 border-t border-slate-200 space-y-1 font-mono text-[11px] text-slate-600">
                                  <div>
                                    <span className="font-bold text-slate-800">المعطيات:</span>{' '}
                                    {JSON.stringify(tc.arguments)}
                                  </div>
                                  {tc.result && (
                                    <div className="text-emerald-700 bg-emerald-50 p-1.5 rounded">
                                      <span className="font-bold">النتيجة:</span>{' '}
                                      {typeof tc.result === 'object'
                                        ? JSON.stringify(tc.result, null, 1)
                                        : String(tc.result)}
                                    </div>
                                  )}
                                  {tc.error && (
                                    <div className="text-rose-700 bg-rose-50 p-1.5 rounded">
                                      <span className="font-bold">السبب:</span> {tc.error}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Main Message Text */}
                    <div className="text-sm leading-relaxed whitespace-pre-wrap font-sans">
                      {msg.content}
                    </div>

                    <div
                      className={`text-[10px] mt-2 flex items-center justify-end gap-1 ${
                        msg.role === 'user' ? 'text-slate-300' : 'text-slate-400'
                      }`}
                    >
                      <span>{msg.timestamp}</span>
                    </div>
                  </div>
                </div>
              ))
            )}

            {/* Processing Indicator */}
            {isProcessing && (
              <div className="flex gap-3 max-w-[80%] ml-auto">
                <div className="w-8 h-8 rounded-xl bg-[#122c4a] text-emerald-400 border border-slate-700 flex items-center justify-center animate-pulse">
                  <span className="text-base leading-none inline-flex items-center justify-center">🤖</span>
                </div>
                <div className="bg-white rounded-2xl p-3.5 border border-slate-200/90 shadow-2xs flex items-center gap-2 text-xs text-slate-600 font-bold">
                  <RefreshCw className="w-4 h-4 animate-spin text-sky-600" />
                  <span>الوكيل يفكر ويستعلم عن أدوات العيادة...</span>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Sensitive Action Confirmation Modal */}
          {pendingConfirmation && (
            <div className="p-4 bg-amber-50 border-t border-amber-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-amber-950">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <span className="text-xl leading-none inline-flex items-center justify-center">⚠️</span>
                </div>
                <div>
                  <div className="font-bold text-xs">تأكيد عملية حساسة في النظام</div>
                  <div className="text-xs text-amber-800">
                    العملية: <span className="font-mono font-bold">{pendingConfirmation.toolCall.toolName}</span>{' '}
                    بالمعطيات: {JSON.stringify(pendingConfirmation.toolCall.arguments)}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={pendingConfirmation.onConfirm}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  تأكيد وتنفيذ
                </button>
                <button
                  onClick={pendingConfirmation.onCancel}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </div>
          )}

          {/* Input Box */}
          <div className="p-3 bg-white border-t border-slate-200/80">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={inputMessage}
                disabled={isProcessing}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="اكتب أمراً أو استفساراً للوكيل الذكي (مثال: نادِ على المريض التالي، أو احجز كشف جديد)..."
                className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!inputMessage.trim() || isProcessing}
                className="px-5 py-3 bg-[#122c4a] hover:bg-[#0f243c] text-white rounded-2xl font-bold text-xs transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shrink-0 shadow-xs"
              >
                <span>إرسال</span>
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: AUTONOMOUS TASKS & TRIGGERS */}
      {/* ============================================================== */}
      {activeTab === 'tasks' && (
        <div className="flex-1 p-5 overflow-y-auto bg-slate-50 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-slate-900 font-['Tajawal',sans-serif]">
                المهام الذاتية والقواعد الآلية (Autonomous Tasks)
              </h3>
              <p className="text-xs text-slate-500">
                قواعد ذكية ينفذها الوكيل تلقائياً في الخلفية عند حدوث شروط محددة بالعيادة
              </p>
            </div>
            <button
              onClick={() => setIsNewTaskModalOpen(true)}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة قاعدة جديدة</span>
            </button>
          </div>

          {loadingTasks ? (
            <div className="py-12 text-center text-slate-400 flex items-center justify-center gap-2">
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span>جاري تحميل المهام...</span>
            </div>
          ) : tasks.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center border border-slate-200">
              <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl leading-none inline-flex items-center justify-center">⚡</span>
              </div>
              <h4 className="font-bold text-slate-800 text-sm mb-1">لا توجد قواعد آلية نشطة</h4>
              <p className="text-xs text-slate-500 mb-4 max-w-sm mx-auto">
                يمكنك إنشاء قواعد لمراقبة وقت الانتظار أو تنبيه الفريق أو إدارة الطابور تلقائياً.
              </p>
              <button
                onClick={() => setIsNewTaskModalOpen(true)}
                className="px-4 py-2 bg-sky-600 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                إنشاء أول مهمة ذاتية
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className={`bg-white rounded-2xl p-4 border transition ${
                    task.status === 'active'
                      ? 'border-emerald-200 shadow-2xs'
                      : 'border-slate-200 opacity-75'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <div className="font-bold text-slate-900 text-sm font-['Tajawal',sans-serif] flex items-center gap-2">
                        <span>{task.title}</span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            task.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {task.status === 'active' ? 'نشطة' : 'متوقفة'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                        {task.description}
                      </p>
                    </div>

                    <button
                      onClick={() => handleToggleTask(task.id, task.status as any)}
                      className={`p-2 rounded-xl transition cursor-pointer ${
                        task.status === 'active'
                          ? 'bg-amber-50 hover:bg-amber-100 text-amber-700'
                          : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
                      }`}
                      title={task.status === 'active' ? 'إيقاف مؤقت' : 'تفعيل'}
                    >
                      {task.status === 'active' ? (
                        <Pause className="w-4 h-4" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                    <div>
                      المشغل: <span className="font-bold">{task.triggerConfig?.condition || task.triggerConfig?.event || task.triggerType}</span>
                    </div>
                    <div>
                      عدد مرات التنفيذ: <span className="font-bold text-slate-800">{task.executionCount || 0}</span>
                    </div>
                  </div>

                  {task.lastExecutionLog && (
                    <div className="mt-2 text-[10px] bg-slate-50 text-slate-600 p-2 rounded-lg font-mono">
                      آخر تنفيذ: {task.lastExecutionLog}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* New Task Creation Modal */}
          {isNewTaskModalOpen && (
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-3xl p-6 w-full max-w-md border border-slate-200 shadow-2xl text-right">
                <h4 className="text-base font-bold text-slate-900 mb-4 font-['Tajawal',sans-serif]">
                  إضافة قاعدة آلية ذكية جديدة
                </h4>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">عنوان القاعدة:</label>
                    <input
                      type="text"
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      placeholder="مثال: تنبيه عند انتظار المريض أكثر من 30 دقيقة"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">وصف المهمة:</label>
                    <textarea
                      value={newTaskDesc}
                      onChange={(e) => setNewTaskDesc(e.target.value)}
                      placeholder="تفاصيل ما ستقوم به المهمة..."
                      rows={2}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">شرط المشغل (Trigger):</label>
                    <select
                      value={newTaskTrigger}
                      onChange={(e) => setNewTaskTrigger(e.target.value as any)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-sky-500"
                    >
                      <option value="QUEUE_WAIT_TIME_EXCEEDED">تجاوز وقت الانتظار بالعيادة</option>
                      <option value="OUTSTANDING_BALANCE_EXCEEDED">تجاوز المتبقي المالي حداً معيناً</option>
                      <option value="PATIENT_REGISTERED">عند حجز مريض جديد في الطابور</option>
                    </select>
                  </div>

                  {newTaskTrigger !== 'PATIENT_REGISTERED' && (
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">
                        {newTaskTrigger === 'QUEUE_WAIT_TIME_EXCEEDED' ? 'الحد الأقصى بالدقائق:' : 'الحد المالي (ج):'}
                      </label>
                      <input
                        type="number"
                        value={newTaskThreshold}
                        onChange={(e) => setNewTaskThreshold(Number(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-sky-500"
                      />
                    </div>
                  )}

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">الإجراء التلقائي:</label>
                    <select
                      value={newTaskAction}
                      onChange={(e) => setNewTaskAction(e.target.value as any)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-sky-500"
                    >
                      <option value="ALERT_STAFF">إرسال تنبيه لفريق العمل</option>
                      <option value="FLAG_HIGH_BALANCE">إشارة تدقيق مالي على ملف المريض</option>
                      <option value="SEND_REMINDER">تجهيز رسالة تذكير للمريض</option>
                    </select>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-end gap-2">
                  <button
                    onClick={() => setIsNewTaskModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    onClick={handleSaveTask}
                    disabled={!newTaskTitle.trim()}
                    className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-xl transition cursor-pointer disabled:opacity-50"
                  >
                    حفظ وتفعيل
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 3: AUDIT TRAIL & LOGS */}
      {/* ============================================================== */}
      {activeTab === 'audit' && (
        <div className="flex-1 p-5 overflow-y-auto bg-slate-50 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-slate-900 font-['Tajawal',sans-serif]">
                سجل تدقيق الذكاء الاصطناعي (AI Audit Trail)
              </h3>
              <p className="text-xs text-slate-500">
                تسجيل رقابي كامل وغير قابل للتعديل لكافة استدعاءات الأدوات وتفويضات المستخدمين
              </p>
            </div>
            <button
              onClick={loadAudit}
              className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer hover:bg-slate-50"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>تحديث</span>
            </button>
          </div>

          {loadingAudit ? (
            <div className="py-12 text-center text-slate-400 flex items-center justify-center gap-2">
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span>جاري تحميل سجل التدقيق...</span>
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center border border-slate-200 text-slate-500 text-xs">
              لا توجد عمليات مسجلة في سجل التدقيق حتى الآن.
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[550px] text-right text-xs">
                <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">الوقت</th>
                    <th className="p-3">العملية / الأداة</th>
                    <th className="p-3">المستخدم / الفاعل</th>
                    <th className="p-3">الحالة</th>
                    <th className="p-3">التفاصيل / السبب</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/50">
                      <td className="p-3 text-[11px] text-slate-400 whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleTimeString('ar-EG', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td className="p-3 font-mono font-bold text-slate-800 text-[11px]">
                        {log.toolName}
                      </td>
                      <td className="p-3 text-slate-700">
                        {log.actorName} ({log.actorRole})
                      </td>
                      <td className="p-3">
                        {log.status === 'success' && (
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full font-bold text-[10px]">
                            ناجح
                          </span>
                        )}
                        {log.status === 'failed' && (
                          <span className="px-2 py-0.5 bg-rose-50 text-rose-700 rounded-full font-bold text-[10px]">
                            فشل
                          </span>
                        )}
                        {log.status === 'denied' && (
                          <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full font-bold text-[10px]">
                            مرفوض
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-[11px] text-slate-600 max-w-xs truncate">
                        {log.reason || (log.outputResult ? JSON.stringify(log.outputResult) : 'تم بنجاح')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
