import React, { useState, useEffect, useMemo } from 'react';
import {
  Wallet,
  CheckCircle2,
  Clock,
  TrendingDown,
  TrendingUp,
  Receipt,
  Hourglass,
  FileText,
  CreditCard,
  Search,
  AlertCircle,
  Calendar,
  Layers,
  Tag,
  ArrowDownRight,
  ArrowUpRight
} from 'lucide-react';
import {
  ClinicMember,
  DoctorProfile,
  ClinicService,
  ClinicTransaction,
  ClinicExpense,
  PaymentMethod,
  ExpenseCategory,
  PatientRecord,
  DailySession
} from '../types';
import {
  subscribeToClinicServices,
  createClinicService,
  updateClinicService,
  seedDefaultServicesIfEmpty,
  subscribeToClinicTransactions,
  createClinicTransaction,
  recordAdditionalPayment,
  refundClinicTransaction,
  subscribeToClinicExpenses,
  createClinicExpense,
  updateClinicExpense,
  deleteClinicExpense,
  searchPatientsForDoctor,
  subscribeToTodayDailySession,
  getTodayDateString
} from '../services/firebaseService';
import { hasPermission } from '../utils/permissions';
import { PaymentReceiptModal } from './PaymentReceiptModal';
import { PatientFileModal } from './PatientFileModal';
import { sanitizePatientPhoneNumber, validatePatientPhoneNumber } from '../services/securityService';

interface ClinicFinanceManagerProps {
  currentMember: ClinicMember | null;
  organizationId: string;
  isDoctorOwnerFallback: boolean;
  doctor: DoctorProfile | null;
  patientsList?: PatientRecord[];
  initialPatientForPayment?: PatientRecord | null;
  activeDailySession?: DailySession | null;
  onShowToast: (title: string, message?: string, type?: "success" | "error" | "info" | "warning") => void;
}

export const ClinicFinanceManager: React.FC<ClinicFinanceManagerProps> = ({
  currentMember,
  organizationId,
  isDoctorOwnerFallback,
  doctor,
  patientsList = [],
  initialPatientForPayment = null,
  activeDailySession,
  onShowToast
}) => {
  // Session tracking to ensure End Day resets active financial state while preserving historical records
  const [internalSession, setInternalSession] = useState<DailySession | null>(activeDailySession || null);

  useEffect(() => {
    if (activeDailySession !== undefined) {
      setInternalSession(activeDailySession);
    }
  }, [activeDailySession]);

  useEffect(() => {
    const today = getTodayDateString();
    const unsub = subscribeToTodayDailySession(organizationId, today, (sess) => {
      setInternalSession(sess);
    });
    return () => unsub();
  }, [organizationId]);

  const currentSession = activeDailySession !== undefined ? activeDailySession : internalSession;
  // Permissions
  const canView = hasPermission(currentMember, 'VIEW_FINANCE', isDoctorOwnerFallback);
  const canManage = hasPermission(currentMember, 'MANAGE_FINANCE', isDoctorOwnerFallback);
  const canRefund = hasPermission(currentMember, 'REFUND_PAYMENT', isDoctorOwnerFallback);
  const canEditPrices = hasPermission(currentMember, 'EDIT_PRICES', isDoctorOwnerFallback);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'register' | 'balances' | 'history' | 'expenses' | 'services'>('register');

  // Realtime States
  const [services, setServices] = useState<ClinicService[]>([]);
  const [transactions, setTransactions] = useState<ClinicTransaction[]>([]);
  const [expenses, setExpenses] = useState<ClinicExpense[]>([]);

  // Selected Receipt Modal
  const [selectedReceiptTx, setSelectedReceiptTx] = useState<ClinicTransaction | null>(null);

  // Patient Auto-Fill & Suggestions state
  const [patientSearchTerm, setPatientSearchTerm] = useState('');
  const [patientSuggestions, setPatientSuggestions] = useState<Array<{ id: string; name: string; phone: string; lastVisit?: string; serviceName?: string }>>([]);
  const [showPatientSuggestions, setShowPatientSuggestions] = useState(false);

  // Patient File Modal state
  const [activeFileModal, setActiveFileModal] = useState<{ phone: string; name: string } | null>(null);

  // Register Payment Form State
  const [patientNameInput, setPatientNameInput] = useState('');
  const [patientPhoneInput, setPatientPhoneInput] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [customServiceName, setCustomServiceName] = useState('');
  const [totalAmountInput, setTotalAmountInput] = useState<number | ''>('');
  const [paidAmountInput, setPaidAmountInput] = useState<number | ''>('');
  const [paymentMethodInput, setPaymentMethodInput] = useState<PaymentMethod>('CASH');
  const [notesInput, setNotesInput] = useState('');
  const [isSubmittingTx, setIsSubmittingTx] = useState(false);

  // Additional Payment Modal State
  const [payBalanceModalTx, setPayBalanceModalTx] = useState<ClinicTransaction | null>(null);
  const [additionalPayAmount, setAdditionalPayAmount] = useState<number | ''>('');
  const [additionalPayMethod, setAdditionalPayMethod] = useState<PaymentMethod>('CASH');
  const [additionalPayNotes, setAdditionalPayNotes] = useState('');
  const [isSubmittingBalance, setIsSubmittingBalance] = useState(false);

  // Refund Modal State
  const [refundModalTx, setRefundModalTx] = useState<ClinicTransaction | null>(null);
  const [refundAmountInput, setRefundAmountInput] = useState<number | ''>('');
  const [refundReasonInput, setRefundReasonInput] = useState('');
  const [isSubmittingRefund, setIsSubmittingRefund] = useState(false);

  // Expense Modal State
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ClinicExpense | null>(null);
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseCategory, setExpenseCategory] = useState<ExpenseCategory>('MEDICAL_SUPPLIES');
  const [expenseAmount, setExpenseAmount] = useState<number | ''>('');
  const [expenseNote, setExpenseNote] = useState('');
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false);

  // Service Modal State
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<ClinicService | null>(null);
  const [serviceName, setServiceName] = useState('');
  const [serviceDescription, setServiceDescription] = useState('');
  const [servicePrice, setServicePrice] = useState<number | ''>('');
  const [isSubmittingService, setIsSubmittingService] = useState(false);

  // History Filters
  const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | 'week' | 'month' | 'all'>('today');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [methodFilter, setMethodFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Helper for Smart Auto-Fill of Payment Form
  const autoFillFormForPatient = (p: {
    id: string;
    name: string;
    phone?: string;
    serviceName?: string;
    visitType?: string;
    serviceId?: string;
    price?: number;
  }) => {
    setPatientNameInput(p.name);
    setPatientPhoneInput(p.phone || '');
    setSelectedPatientId(p.id);
    setPatientSearchTerm(p.name);
    setShowPatientSuggestions(false);

    // 1. Look for current booking/queue item for this patient
    const cleanPhone = p.phone ? p.phone.replace(/\D/g, '') : '';
    const currentBooking = patientsList.find(b =>
      b.id === p.id || (cleanPhone && b.phone && b.phone.replace(/\D/g, '') === cleanPhone)
    );

    let targetServiceName = currentBooking?.serviceName || currentBooking?.visitType || p.serviceName || p.visitType;
    let targetServiceId = currentBooking?.serviceId || p.serviceId;
    let targetPrice = typeof currentBooking?.price === 'number' ? currentBooking.price : p.price;

    // 2. Check if patient has any existing transaction with outstanding balance
    const existingTx = transactions.find(tx => {
      if (tx.paymentStatus === 'REFUNDED') return false;
      const sameId = Boolean(tx.patientId && p.id && tx.patientId === p.id);
      const samePhone = Boolean(cleanPhone && tx.patientPhone && tx.patientPhone.replace(/\D/g, '') === cleanPhone);
      return sameId || samePhone;
    });

    if (existingTx && existingTx.remainingAmount > 0) {
      if (!targetServiceName) targetServiceName = existingTx.serviceName;
      if (!targetServiceId) targetServiceId = existingTx.serviceId;

      setTotalAmountInput(existingTx.remainingAmount);
      setPaidAmountInput(existingTx.remainingAmount);

      if (targetServiceId) {
        const matchedSrv = services.find(s => s.id === targetServiceId);
        if (matchedSrv) setSelectedServiceId(matchedSrv.id);
      } else if (targetServiceName) {
        const matchedSrv = services.find(s => s.name.trim() === targetServiceName?.trim());
        if (matchedSrv) setSelectedServiceId(matchedSrv.id);
      }

      setCustomServiceName(targetServiceName || existingTx.serviceName || 'كشف عيادة');
      setNotesInput(`سداد المبلغ المتبقي (${existingTx.remainingAmount} ج)`);
      return;
    }

    // 3. Match with clinic service catalog
    let matchedService: ClinicService | undefined;
    if (targetServiceId) {
      matchedService = services.find(s => s.id === targetServiceId);
    }
    if (!matchedService && targetServiceName) {
      matchedService = services.find(s => s.name.trim() === targetServiceName?.trim());
    }

    if (matchedService) {
      setSelectedServiceId(matchedService.id);
      setCustomServiceName(matchedService.name);
      const finalPrice = typeof targetPrice === 'number' ? targetPrice : matchedService.price;
      setTotalAmountInput(finalPrice);
      setPaidAmountInput(finalPrice);
    } else if (targetServiceName) {
      setSelectedServiceId('');
      setCustomServiceName(targetServiceName);
      if (typeof targetPrice === 'number') {
        setTotalAmountInput(targetPrice);
        setPaidAmountInput(targetPrice);
      } else if (services.length > 0) {
        const defaultSrv = services.find(s => s.active) || services[0];
        setTotalAmountInput(defaultSrv.price);
        setPaidAmountInput(defaultSrv.price);
      }
    } else if (typeof targetPrice === 'number') {
      setCustomServiceName('كشف عيادة');
      setTotalAmountInput(targetPrice);
      setPaidAmountInput(targetPrice);
    } else if (services.length > 0) {
      const defaultSrv = services.find(s => s.active) || services[0];
      setSelectedServiceId(defaultSrv.id);
      setCustomServiceName(defaultSrv.name);
      setTotalAmountInput(defaultSrv.price);
      setPaidAmountInput(defaultSrv.price);
    }
  };

  // Auto-fill form if initialPatientForPayment is passed
  useEffect(() => {
    if (initialPatientForPayment) {
      autoFillFormForPatient(initialPatientForPayment);
      setActiveTab('register');
    }
  }, [initialPatientForPayment, services, transactions]);

  // Debounced Patient Search Suggestions Effect
  useEffect(() => {
    if (!patientSearchTerm.trim() || patientSearchTerm.length < 2) {
      setPatientSuggestions([]);
      setShowPatientSuggestions(false);
      return;
    }

    const timer = setTimeout(async () => {
      // 1. Local filter from today's patients list
      const q = patientSearchTerm.toLowerCase();
      const localMatches = patientsList.filter(
        p => p.name.toLowerCase().includes(q) || p.phone?.includes(q)
      ).map(p => ({
        id: p.id,
        name: p.name,
        phone: p.phone || '',
        lastVisit: 'حجز اليوم',
        serviceName: p.visitType || p.serviceName,
        price: p.price
      }));

      // 2. Fetch from medical files in DB
      let remoteMatches: any[] = [];
      if (organizationId) {
        remoteMatches = await searchPatientsForDoctor(organizationId, patientSearchTerm);
      }

      // Merge and remove duplicates by phone
      const combined = [...localMatches];
      remoteMatches.forEach(rm => {
        if (!combined.some(c => c.phone && rm.phone && c.phone.replace(/\D/g, '') === rm.phone.replace(/\D/g, ''))) {
          combined.push({
            id: rm.id,
            name: rm.name,
            phone: rm.phone || '',
            lastVisit: rm.lastVisitDate ? `آخر زيارة: ${rm.lastVisitDate}` : 'سجل سابق',
            serviceName: undefined,
            price: undefined
          });
        }
      });

      setPatientSuggestions(combined);
      setShowPatientSuggestions(combined.length > 0);
    }, 300);

    return () => clearTimeout(timer);
  }, [patientSearchTerm, patientsList, organizationId]);

  // Select patient suggestion handler
  const handleSelectPatientSuggestion = (p: { id: string; name: string; phone: string; serviceName?: string; price?: number }) => {
    autoFillFormForPatient(p);
  };

  // Subscribe to Realtime Firebase Data (stable per organizationId)
  useEffect(() => {
    if (!organizationId) return;

    // Seed default services if empty (runs once per organization mount)
    seedDefaultServicesIfEmpty(organizationId, doctor || undefined);

    const unsubServices = subscribeToClinicServices(organizationId, (data) => setServices(data));
    const unsubTx = subscribeToClinicTransactions(organizationId, (data) => setTransactions(data));
    const unsubExp = subscribeToClinicExpenses(organizationId, (data) => setExpenses(data));

    return () => {
      unsubServices();
      unsubTx();
      unsubExp();
    };
  }, [organizationId]);

  // Calculate Today's Summary Metrics (Strictly synchronized with Daily Session Lifecycle)
  const todaySummary = useMemo(() => {
    // If daily session is completed or not active, the active shift's financial summary is clean (zeroed)
    // All historical data remains fully visible and intact in the "سجل المعاملات" (Transactions History) tab
    if (!currentSession || currentSession.status === 'completed') {
      return {
        totalChargedToday: 0,
        totalPaidToday: 0,
        totalOutstandingToday: 0,
        totalExpensesToday: 0,
        netRevenueToday: 0,
        isSessionCompleted: currentSession?.status === 'completed',
        hasActiveSession: false
      };
    }

    const sessionStart = currentSession.startedAt ? new Date(currentSession.startedAt).getTime() : 0;
    const todayStr = new Date().toISOString().split('T')[0];

    const todayTxs = transactions.filter(tx => {
      if (!tx.createdAt) return false;
      if (tx.paymentStatus === 'REFUNDED') return false;

      // If transaction is tagged with a session ID, strictly match active session
      if (tx.dailySessionId) {
        return tx.dailySessionId === currentSession.id;
      }

      // Otherwise ensure it was created during this active session
      const txTime = new Date(tx.createdAt).getTime();
      return tx.createdAt.startsWith(todayStr) && (!sessionStart || txTime >= sessionStart);
    });

    const todayExps = expenses.filter(exp => {
      if (!exp.createdAt) return false;
      const expTime = new Date(exp.createdAt).getTime();
      return exp.createdAt.startsWith(todayStr) && (!sessionStart || expTime >= sessionStart);
    });

    const totalChargedToday = todayTxs.reduce((sum, tx) => sum + (tx.totalAmount || 0), 0);
    const totalPaidToday = todayTxs.reduce((sum, tx) => sum + (tx.paidAmount || 0), 0);
    const totalOutstandingToday = todayTxs.reduce((sum, tx) => sum + (tx.remainingAmount || 0), 0);
    const totalExpensesToday = todayExps.reduce((sum, exp) => sum + (exp.amount || 0), 0);
    const netRevenueToday = totalPaidToday - totalExpensesToday;

    return {
      totalChargedToday,
      totalPaidToday,
      totalOutstandingToday,
      totalExpensesToday,
      netRevenueToday,
      isSessionCompleted: false,
      hasActiveSession: true
    };
  }, [transactions, expenses, currentSession]);

  // Handle Selecting a Patient from Dropdown
  const handleSelectPatientDropdown = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const pId = e.target.value;
    setSelectedPatientId(pId);
    if (!pId) return;

    const found = patientsList.find(p => p.id === pId);
    if (found) {
      autoFillFormForPatient(found);
    }
  };

  // Handle Selecting Service from Dropdown
  const handleServiceSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const sId = e.target.value;
    setSelectedServiceId(sId);
    if (!sId) {
      setCustomServiceName('');
      setTotalAmountInput('');
      setPaidAmountInput('');
      return;
    }

    const srv = services.find(s => s.id === sId);
    if (srv) {
      setCustomServiceName(srv.name);
      setTotalAmountInput(srv.price);
      setPaidAmountInput(srv.price);
    }
  };

  // Submit New Payment Transaction
  const handleRegisterPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) {
      onShowToast("لا تملك صلاحية", "لا تملك صلاحية تسجيل المدفوعات في العيادة", "error");
      return;
    }

    if (!patientNameInput.trim()) {
      onShowToast("خطأ في البيانات", "يرجى إدخال اسم المريض", "warning");
      return;
    }

    const serviceName = selectedServiceId ? (services.find(s => s.id === selectedServiceId)?.name || customServiceName) : customServiceName;
    if (!serviceName.trim()) {
      onShowToast("خطأ في البيانات", "يرجى اختيار أو كتابة نوع الخدمة", "warning");
      return;
    }

    const numTotal = Number(totalAmountInput);
    const numPaid = Number(paidAmountInput);

    if (isNaN(numTotal) || numTotal < 0) {
      onShowToast("خطأ في القيمة", "يرجى إدخال مبلغ إجمالي صحيح", "warning");
      return;
    }

    if (isNaN(numPaid) || numPaid < 0) {
      onShowToast("خطأ في القيمة", "يرجى إدخال المبلغ المدفوع بشكل صحيح", "warning");
      return;
    }

    if (numPaid > numTotal) {
      onShowToast("خطأ في القيمة", "المبلغ المدفوع أكبر من إجمالي قيمة الخدمة", "error");
      return;
    }

    let validatedPhone: string | undefined = undefined;
    if (patientPhoneInput.trim()) {
      const phoneValidation = validatePatientPhoneNumber(patientPhoneInput);
      if (!phoneValidation.isValid) {
        onShowToast("خطأ في رقم الهاتف", phoneValidation.error || "رقم الهاتف يجب أن يكون من 10 إلى 11 رقمًا.", "warning");
        return;
      }
      validatedPhone = phoneValidation.cleanPhone;
    }

    setIsSubmittingTx(true);
    try {
      const newTx = await createClinicTransaction(currentMember, isDoctorOwnerFallback, {
        organizationId,
        dailySessionId: currentSession?.id || undefined,
        patientId: selectedPatientId || undefined,
        patientName: patientNameInput.trim(),
        patientPhone: validatedPhone,
        serviceId: selectedServiceId || undefined,
        serviceName,
        totalAmount: numTotal,
        paidAmount: numPaid,
        paymentMethod: paymentMethodInput,
        notes: notesInput.trim() || undefined
      });

      onShowToast("تم تسجيل الدفع بنجاح", `تم إنشاء إيصال دَفْع للمريض ${patientNameInput}`, "success");
      
      // Reset form
      setPatientNameInput('');
      setPatientPhoneInput('');
      setSelectedPatientId('');
      setSelectedServiceId('');
      setCustomServiceName('');
      setTotalAmountInput('');
      setPaidAmountInput('');
      setNotesInput('');

      // Open printable receipt modal
      setSelectedReceiptTx(newTx);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "تعذر تسجيل الدفع";
      onShowToast("خطأ في التسجيل", msg, "error");
    } finally {
      setIsSubmittingTx(false);
    }
  };

  // Submit Additional Balance Payment
  const handleAdditionalPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payBalanceModalTx) return;

    const numAmt = Number(additionalPayAmount);
    if (isNaN(numAmt) || numAmt <= 0) {
      onShowToast("خطأ في البيانات", "يرجى إدخال مبلغ سداد صحيح", "warning");
      return;
    }

    if (numAmt > payBalanceModalTx.remainingAmount) {
      onShowToast("خطأ في القيمة", `المبلغ المدفوع أكبر من المتبقي المستحق (${payBalanceModalTx.remainingAmount} ج)`, "error");
      return;
    }

    setIsSubmittingBalance(true);
    try {
      await recordAdditionalPayment(
        currentMember,
        isDoctorOwnerFallback,
        organizationId,
        payBalanceModalTx.id,
        numAmt,
        additionalPayMethod,
        additionalPayNotes
      );

      onShowToast("تم السداد بنجاح", `تم تحديث الحساب المالي للمريض ${payBalanceModalTx.patientName}`, "success");
      setPayBalanceModalTx(null);
      setAdditionalPayAmount('');
      setAdditionalPayNotes('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "تعذر تسجيل السداد";
      onShowToast("خطأ في السداد", msg, "error");
    } finally {
      setIsSubmittingBalance(false);
    }
  };

  // Submit Refund Action
  const handleRefundSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundModalTx) return;

    const numRef = Number(refundAmountInput);
    if (isNaN(numRef) || numRef <= 0) {
      onShowToast("خطأ في المبلغ", "يرجى إدخال مبلغ استرداد صحيح", "warning");
      return;
    }

    if (!refundReasonInput.trim()) {
      onShowToast("بيان مطلوب", "يرجى توضيح سبب استرداد المبلغ", "warning");
      return;
    }

    if (numRef > refundModalTx.paidAmount) {
      onShowToast("خطأ في القيمة", `مبلغ الاسترداد أكبر من المدفوع الفعلي (${refundModalTx.paidAmount} ج)`, "error");
      return;
    }

    setIsSubmittingRefund(true);
    try {
      await refundClinicTransaction(
        currentMember,
        isDoctorOwnerFallback,
        organizationId,
        refundModalTx.id,
        numRef,
        refundReasonInput.trim()
      );

      onShowToast("تم الاسترداد بنجاح", `تم استرداد مبلغ ${numRef} ج وتحديث السجل المالي`, "success");
      setRefundModalTx(null);
      setRefundAmountInput('');
      setRefundReasonInput('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "تعذر استرداد المبلغ";
      onShowToast("خطأ في الاسترداد", msg, "error");
    } finally {
      setIsSubmittingRefund(false);
    }
  };

  // Submit Expense (Create or Edit)
  const handleExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseTitle.trim()) {
      onShowToast("بيان مطلوب", "يرجى إدخال عنوان المصروف", "warning");
      return;
    }

    const numAmt = Number(expenseAmount);
    if (isNaN(numAmt) || numAmt <= 0) {
      onShowToast("قيمة خاطئة", "يرجى إدخال قيمة مصروف صحيحة", "warning");
      return;
    }

    setIsSubmittingExpense(true);
    try {
      if (editingExpense) {
        await updateClinicExpense(currentMember, isDoctorOwnerFallback, organizationId, editingExpense.id, {
          title: expenseTitle.trim(),
          category: expenseCategory,
          amount: numAmt,
          note: expenseNote.trim()
        });
        onShowToast("تم تعديل المصروف", `تم تحديث مصروف ${expenseTitle}`, "success");
      } else {
        await createClinicExpense(currentMember, isDoctorOwnerFallback, {
          organizationId,
          title: expenseTitle.trim(),
          category: expenseCategory,
          amount: numAmt,
          note: expenseNote.trim()
        });
        onShowToast("تم إضافة المصروف", `تم تسجيل مصروف ${expenseTitle} بقيمة ${numAmt} ج`, "success");
      }

      setIsExpenseModalOpen(false);
      setEditingExpense(null);
      setExpenseTitle('');
      setExpenseAmount('');
      setExpenseNote('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "تعذر حفظ المصروف";
      onShowToast("خطأ في الحفظ", msg, "error");
    } finally {
      setIsSubmittingExpense(false);
    }
  };

  // Delete Expense
  const handleDeleteExpenseClick = async (exp: ClinicExpense) => {
    if (!window.confirm(`هل أنت تأكد من حذف المصروف (${exp.title}) بقيمة ${exp.amount} ج؟`)) return;

    try {
      await deleteClinicExpense(currentMember, isDoctorOwnerFallback, organizationId, exp.id);
      onShowToast("تم حذف المصروف", `تمت إزالة المصروف ${exp.title}`, "success");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "تعذر حذف المصروف";
      onShowToast("خطأ في الحذف", msg, "error");
    }
  };

  // Submit Service (Create or Edit)
  const handleServiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceName.trim()) {
      onShowToast("اسم مطلوب", "يرجى إدخال اسم الخدمة", "warning");
      return;
    }

    const numPrice = Number(servicePrice);
    if (isNaN(numPrice) || numPrice < 0) {
      onShowToast("سعر خاطئ", "يرجى إدخال سعر خدمة صحيح", "warning");
      return;
    }

    setIsSubmittingService(true);
    try {
      if (editingService) {
        await updateClinicService(currentMember, isDoctorOwnerFallback, editingService.id, organizationId, {
          name: serviceName.trim(),
          description: serviceDescription.trim(),
          price: numPrice
        });
        onShowToast("تم تعديل الخدمة", `تم تحديث سعر خدمة ${serviceName}`, "success");
      } else {
        await createClinicService(currentMember, isDoctorOwnerFallback, {
          organizationId,
          name: serviceName.trim(),
          description: serviceDescription.trim(),
          price: numPrice
        });
        onShowToast("تم إضافة الخدمة", `تم إضافة خدمة جديدة ${serviceName} بسعر ${numPrice} ج`, "success");
      }

      setIsServiceModalOpen(false);
      setEditingService(null);
      setServiceName('');
      setServiceDescription('');
      setServicePrice('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "تعذر حفظ الخدمة";
      onShowToast("خطأ في الحفظ", msg, "error");
    } finally {
      setIsSubmittingService(false);
    }
  };

  // Filter Transactions History
  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      // Date Filter
      if (dateFilter !== 'all' && tx.createdAt) {
        const txDate = new Date(tx.createdAt);
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        if (dateFilter === 'today') {
          if (txDate < todayStart) return false;
        } else if (dateFilter === 'yesterday') {
          const yestStart = new Date(todayStart);
          yestStart.setDate(yestStart.getDate() - 1);
          if (txDate < yestStart || txDate >= todayStart) return false;
        } else if (dateFilter === 'week') {
          const weekAgo = new Date(todayStart);
          weekAgo.setDate(weekAgo.getDate() - 7);
          if (txDate < weekAgo) return false;
        } else if (dateFilter === 'month') {
          const monthAgo = new Date(todayStart);
          monthAgo.setMonth(monthAgo.getMonth() - 1);
          if (txDate < monthAgo) return false;
        }
      }

      // Status Filter
      if (statusFilter !== 'ALL' && tx.paymentStatus !== statusFilter) {
        return false;
      }

      // Method Filter
      if (methodFilter !== 'ALL' && tx.paymentMethod !== methodFilter) {
        return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = tx.patientName.toLowerCase().includes(q);
        const matchesPhone = tx.patientPhone?.toLowerCase().includes(q);
        const matchesId = tx.id.toLowerCase().includes(q);
        const matchesService = tx.serviceName.toLowerCase().includes(q);
        if (!matchesName && !matchesPhone && !matchesId && !matchesService) {
          return false;
        }
      }

      return true;
    });
  }, [transactions, dateFilter, statusFilter, methodFilter, searchQuery]);

  // Filter Outstanding Balances Transactions
  const outstandingTransactions = useMemo(() => {
    return transactions.filter(tx => tx.remainingAmount > 0 && tx.paymentStatus !== 'REFUNDED');
  }, [transactions]);

  // Access Guard
  if (!canView) {
    return (
      <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-xs text-center font-['Tajawal',sans-serif] space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
          <span className="text-2xl leading-none inline-flex items-center justify-center">🛡️</span>
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">قسم المالية الحسابية مغلق</h2>
          <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
            لا تملك صلاحية عرض أو إدارة الحسابات والتقرير المالي الخاص بهذه العيادة. يرجى التواصل مع مالك العيادة لتفعيل صلاحية <b>VIEW_FINANCE</b>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-['Tajawal',sans-serif]">
      
      {/* Active Session Status Notification when Ended */}
      {todaySummary.isSessionCompleted && (
        <div className="bg-slate-900 text-white p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-xs border border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-sm block text-emerald-300">تم إنهاء وتوثيق يوم العمل السابق بنجاح</span>
              <span className="text-slate-400 text-xs">
                الحسابات المباشرة للوردية الحالية نظيفة ومؤرشفة. سجل المعاملات التاريخية والمستحقات متاح بالكامل في التبويبات أدناه.
              </span>
            </div>
          </div>
          <span className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 font-mono text-[11px] border border-slate-700 font-bold shrink-0">
            مؤرشف رسميًا
          </span>
        </div>
      )}

      {/* 1. Header Overview Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        
        {/* Today's Total Charged Revenue */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-bold">إيرادات اليوم (المسجلة)</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-[#10B981] border border-emerald-100 flex items-center justify-center font-bold">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-[#10B981]">
              {todaySummary.totalChargedToday} <span className="text-xs text-slate-400 font-normal">جنيه</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">مجموع قيمة الكشوفات للوردية</div>
          </div>
        </div>

        {/* Total Paid Today */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-bold">المدفوع الكاش والفيزا</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-[#10B981] border border-emerald-100 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-[#10B981]">
              {todaySummary.totalPaidToday} <span className="text-xs text-slate-400 font-normal">جنيه</span>
            </div>
            <div className="text-[10px] text-emerald-600 font-medium mt-0.5">داخل الصندوق فعلياً</div>
          </div>
        </div>

        {/* Outstanding Balances */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-bold">المستحقات المتبقية</span>
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-[#EF4444] border border-rose-100 flex items-center justify-center font-bold">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-[#EF4444]">
              {todaySummary.totalOutstandingToday} <span className="text-xs text-slate-400 font-normal">جنيه</span>
            </div>
            <div className="text-[10px] text-rose-600 font-medium mt-0.5">آجل / غير مسدد اليوم</div>
          </div>
        </div>

        {/* Today's Expenses */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-bold">مصروفات العيادة</span>
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-[#EF4444] border border-rose-100 flex items-center justify-center font-bold">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-[#EF4444]">
              {todaySummary.totalExpensesToday} <span className="text-xs text-slate-400 font-normal">جنيه</span>
            </div>
            <div className="text-[10px] text-rose-600 font-medium mt-0.5">إيجار، مرافق، مستلزمات</div>
          </div>
        </div>

        {/* Net Revenue Today */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-bold">صافي أرباح الوردية</span>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold border ${
              todaySummary.netRevenueToday >= 0 
                ? 'bg-emerald-50 text-[#10B981] border-emerald-100' 
                : 'bg-rose-50 text-[#EF4444] border-rose-100'
            }`}>
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className={`text-2xl font-black ${todaySummary.netRevenueToday >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
              {todaySummary.netRevenueToday} <span className="text-xs text-slate-400 font-normal">جنيه</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">(المدفوع اليوم - المصروفات)</div>
          </div>
        </div>

      </div>

      {/* 2. Sub-Navigation Tabs */}
      <div className="bg-white rounded-3xl p-3 border border-slate-200/80 shadow-xs flex items-center gap-2 overflow-x-auto scrollbar-none">
        
        <button
          onClick={() => setActiveTab('register')}
          className={`flex-1 min-w-[130px] py-3 px-4 rounded-2xl text-xs sm:text-sm font-extrabold transition flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'register'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Receipt className="w-4 h-4 shrink-0" />
          <span>تسجيل دفعة</span>
        </button>

        <button
          onClick={() => setActiveTab('balances')}
          className={`flex-1 min-w-[130px] py-3 px-4 rounded-2xl text-xs sm:text-sm font-extrabold transition flex items-center justify-center gap-2 relative cursor-pointer ${
            activeTab === 'balances'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Hourglass className="w-4 h-4 shrink-0" />
          <span>المستحقات</span>
          {outstandingTransactions.length > 0 && (
            <span className="bg-amber-500 text-slate-950 font-black text-[10px] px-2 py-0.5 rounded-full">
              {outstandingTransactions.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 min-w-[130px] py-3 px-4 rounded-2xl text-xs sm:text-sm font-extrabold transition flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'history'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <FileText className="w-4 h-4 shrink-0" />
          <span>سجل المعاملات</span>
        </button>

        <button
          onClick={() => setActiveTab('expenses')}
          className={`flex-1 min-w-[130px] py-3 px-4 rounded-2xl text-xs sm:text-sm font-extrabold transition flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'expenses'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <CreditCard className="w-4 h-4 shrink-0" />
          <span>المصروفات</span>
        </button>

        <button
          onClick={() => setActiveTab('services')}
          className={`flex-1 min-w-[130px] py-3 px-4 rounded-2xl text-xs sm:text-sm font-extrabold transition flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'services'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Tag className="w-4 h-4 shrink-0" />
          <span>الخدمات والأسعار</span>
        </button>

      </div>

      {/* 3. TAB 1: REGISTER PAYMENT FORM */}
      {activeTab === 'register' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-xl font-black text-slate-900">تسجيل دفع رسوم كشف أو خدمة</h2>
              <p className="text-xs text-slate-500 mt-1">
                اختر المريض من القائمة أو أدخل الاسم يدوياً، حدد الخدمة وطريقة الدفع لإنشاء إيصال تحصيل فورياً.
              </p>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shrink-0">
              <span className="text-xl leading-none inline-flex items-center justify-center">👛</span>
            </div>
          </div>

          <form onSubmit={handleRegisterPaymentSubmit} className="space-y-6">
            
            {/* Patient Picker or Live Search & Auto-fill */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/70 p-5 rounded-2xl border border-slate-200/60 relative">
              
              {/* Search Patient Auto-Fill */}
              <div className="md:col-span-2 relative">
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <span className="text-base leading-none inline-flex items-center justify-center">🔍</span>
                  <span>بحث عن مريض للتعبئة التلقائية (بالاسم أو رقم الموبايل):</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="ابحث باسم المريض أو هاتفه للتعبئة التلقائية..."
                    value={patientSearchTerm}
                    onChange={e => {
                      setPatientSearchTerm(e.target.value);
                      setShowPatientSuggestions(true);
                    }}
                    onFocus={() => {
                      if (patientSuggestions.length > 0) setShowPatientSuggestions(true);
                    }}
                    className="w-full bg-white border border-emerald-300/80 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
                  />

                  {/* Suggestions Floating Menu */}
                  {showPatientSuggestions && patientSuggestions.length > 0 && (
                    <div className="absolute z-30 top-full right-0 left-0 mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl max-h-56 overflow-y-auto divide-y divide-slate-100">
                      {patientSuggestions.map(sug => (
                        <div
                          key={sug.id + sug.phone}
                          onClick={() => handleSelectPatientSuggestion(sug)}
                          className="p-3 hover:bg-emerald-50/80 transition cursor-pointer flex items-center justify-between text-xs"
                        >
                          <div>
                            <div className="font-extrabold text-slate-900">{sug.name}</div>
                            <div className="text-[11px] text-slate-500 font-mono dir-ltr text-right">
                              {sug.phone || 'بدون رقم'}
                            </div>
                          </div>
                          <div className="text-left">
                            <span className="inline-block bg-emerald-100 text-emerald-900 text-[10px] font-bold px-2 py-0.5 rounded-full">
                              {sug.serviceName || sug.lastVisit}
                            </span>
                            {typeof sug.price === 'number' && (
                              <div className="text-[11px] font-mono text-slate-600 font-bold mt-0.5">
                                {sug.price} ج
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  أو اختر مريضاً من طابور اليوم:
                </label>
                <select
                  value={selectedPatientId}
                  onChange={handleSelectPatientDropdown}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-sky-500 transition"
                >
                  <option value="">-- اختر مريض اليوم --</option>
                  {patientsList.map(p => (
                    <option key={p.id} value={p.id}>
                      #{p.sequenceNumber} - {p.name} ({p.phone || 'بدون هاتف'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  اسم المريض <span className="text-rose-500">*</span>:
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: أحمد محمد علي"
                  value={patientNameInput}
                  onChange={e => {
                    setPatientNameInput(e.target.value);
                    if (selectedPatientId) setSelectedPatientId('');
                  }}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-sky-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  رقم الهاتف (اختياري):
                </label>
                <input
                  type="tel"
                  dir="ltr"
                  maxLength={11}
                  placeholder="مثال: 01012345678"
                  value={patientPhoneInput}
                  onChange={e => setPatientPhoneInput(sanitizePatientPhoneNumber(e.target.value, 11))}
                  onPaste={e => {
                    e.preventDefault();
                    setPatientPhoneInput(sanitizePatientPhoneNumber(e.clipboardData.getData('text'), 11));
                  }}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-sky-500 transition dir-ltr text-right"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  اختر الخدمة الطبية المسجلة:
                </label>
                <select
                  value={selectedServiceId}
                  onChange={handleServiceSelect}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-sky-500 transition"
                >
                  <option value="">-- أو ادخل خدمة مخصصة --</option>
                  {services.filter(s => s.active).map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} - ({s.price} جنيه)
                    </option>
                  ))}
                </select>
              </div>

            </div>

            {/* Service & Financial Amounts */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  اسم الخدمة / بيان الكشف <span className="text-rose-500">*</span>:
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: كشف أطفال"
                  value={customServiceName}
                  onChange={e => setCustomServiceName(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-sky-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  إجمالي المبلغ المطلوب (جنيه) <span className="text-rose-500">*</span>:
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="1"
                  placeholder="300"
                  value={totalAmountInput}
                  onChange={e => {
                    const val = e.target.value === '' ? '' : Number(e.target.value);
                    setTotalAmountInput(val);
                    if (paidAmountInput === '' || Number(paidAmountInput) > Number(val)) {
                      setPaidAmountInput(val);
                    }
                  }}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-sky-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  المبلغ المدفوع الآن (جنيه) <span className="text-rose-500">*</span>:
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="1"
                  placeholder="300"
                  value={paidAmountInput}
                  onChange={e => setPaidAmountInput(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-sky-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  طريقة الدفع:
                </label>
                <select
                  value={paymentMethodInput}
                  onChange={e => setPaymentMethodInput(e.target.value as PaymentMethod)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-sky-500 transition"
                >
                  <option value="CASH">نقداً (كاش)</option>
                  <option value="CARD">بطاقة ائتمان / فيزا</option>
                  <option value="BANK_TRANSFER">تحويل بنكي / فودافون كاش</option>
                  <option value="OTHER">طريقة أخرى</option>
                </select>
              </div>

            </div>

            {/* Calculated Remaining Preview */}
            <div className="bg-slate-900 rounded-2xl p-4 text-white flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs space-y-1 text-center sm:text-right">
                <div className="text-slate-300 font-medium">ملخص تحصيل المعاملة:</div>
                <div className="font-extrabold text-sm">
                  المطلوب: <span className="text-white">{totalAmountInput || 0} ج</span> | المدفوع: <span className="text-emerald-400">{paidAmountInput || 0} ج</span>
                </div>
              </div>

              <div className="text-center sm:text-left bg-slate-800 px-4 py-2 rounded-xl border border-slate-700 shrink-0">
                <div className="text-[10px] text-slate-400 font-semibold">المتبقي كآجل / مستحق:</div>
                <div className={`text-base font-black ${
                  (Number(totalAmountInput || 0) - Number(paidAmountInput || 0)) > 0 ? 'text-amber-400' : 'text-slate-300'
                }`}>
                  {Math.max(0, Number(totalAmountInput || 0) - Number(paidAmountInput || 0))} جنيه
                </div>
              </div>
            </div>

            {/* Optional Notes */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                ملاحظات إضافية على الإيصال (اختياري):
              </label>
              <input
                type="text"
                placeholder="مثال: خصم 50 جنيه بناء على توصية الدكتور"
                value={notesInput}
                onChange={e => setNotesInput(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-medium text-slate-800 focus:outline-none focus:border-sky-500 transition"
              />
            </div>

            {/* Submit Button */}
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isSubmittingTx || !canManage}
                className={`px-8 py-3.5 rounded-2xl font-black text-sm transition flex items-center gap-2 shadow-md cursor-pointer ${
                  canManage
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-600 hover:to-teal-500 text-slate-950 scale-100 hover:scale-102 active:scale-98'
                    : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                }`}
              >
                <span className="text-base leading-none inline-flex items-center justify-center">✔️</span>
                <span>{isSubmittingTx ? 'جاري التحصيل وإنشاء الإيصال...' : 'تأكيد الدفع وطباعة الإيصال'}</span>
              </button>
            </div>

          </form>
        </div>
      )}

      {/* 4. TAB 2: OUTSTANDING BALANCES */}
      {activeTab === 'balances' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-xl font-black text-slate-900">المبالغ المستحقة المتبقية (الديون والآجل)</h2>
              <p className="text-xs text-slate-500 mt-1">
                قائمة بالمعاملات التي تحتوي على مبالغ متبقية غير مسددة. يمكنك سداد المتبقي كلياً أو جزئياً.
              </p>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold shrink-0">
              <span className="text-xl leading-none inline-flex items-center justify-center">⏰</span>
            </div>
          </div>

          {outstandingTransactions.length === 0 ? (
            <div className="text-center py-12 text-slate-400 space-y-2">
              <span className="text-4xl leading-none inline-flex items-center justify-center mx-auto opacity-80">✅</span>
              <div className="font-bold text-slate-700 text-sm">لا توجد مبالغ مستحقة حالياً!</div>
              <p className="text-xs text-slate-400">جميع كشوفات ومدفوعات العيادة مسددة بالكامل.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {outstandingTransactions.map(tx => (
                <div key={tx.id} className="bg-amber-50/40 border border-amber-200/80 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition hover:border-amber-300">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-slate-900 text-sm">{tx.patientName}</span>
                      {tx.patientPhone && (
                        <span className="text-xs text-slate-500 font-bold dir-ltr">({tx.patientPhone})</span>
                      )}
                      <span className="text-[10px] bg-amber-100 text-amber-800 font-extrabold px-2 py-0.5 rounded-full border border-amber-200">
                        متبقي: {tx.remainingAmount} جنيه
                      </span>
                    </div>
                    <div className="text-xs text-slate-600 flex items-center gap-3">
                      <span>الخدمة: <b>{tx.serviceName}</b></span>
                      <span>•</span>
                      <span>الإجمالي: {tx.totalAmount} ج</span>
                      <span>•</span>
                      <span>المدفوع: {tx.paidAmount} ج</span>
                    </div>
                    <div className="text-[10px] text-slate-400">
                      التاريخ: {new Date(tx.createdAt).toLocaleString('ar-EG')}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                    <button
                      onClick={() => setSelectedReceiptTx(tx)}
                      className="flex-1 sm:flex-initial px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <span className="text-base leading-none inline-flex items-center justify-center">🧾</span>
                      <span>عرض الإيصال</span>
                    </button>

                    <button
                      onClick={() => {
                        setPayBalanceModalTx(tx);
                        setAdditionalPayAmount(tx.remainingAmount);
                      }}
                      disabled={!canManage}
                      className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-black transition flex items-center justify-center gap-1 shadow-xs cursor-pointer ${
                        canManage
                          ? 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                          : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      <span className="text-base leading-none inline-flex items-center justify-center">➕</span>
                      <span>سداد المتبقي</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 5. TAB 3: TRANSACTION HISTORY & FILTERS */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-xl font-black text-slate-900">سجل المعاملات والمدفوعات</h2>
              <p className="text-xs text-slate-500 mt-1">
                عرض كامل لكافة العمليات المالية، مع إمكانية التصفية، البحث، طباعة الإيصالات، أو استرداد المبالغ.
              </p>
            </div>

            {/* Search Box */}
            <div className="relative w-full md:w-64">
              <span className="text-base leading-none inline-flex items-center justify-center absolute right-3.5 top-2.5 pointer-events-none">🔍</span>
              <input
                type="text"
                placeholder="بحث باسم المريض أو الهاتف..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-10 pl-3.5 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-sky-500 transition"
              />
            </div>
          </div>

          {/* Filters Bar */}
          <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200/60 text-xs">
            
            <div className="flex items-center gap-1 text-slate-500 font-bold shrink-0">
              <span className="text-base leading-none inline-flex items-center justify-center">🔍</span>
              <span>التصفية:</span>
            </div>

            {/* Date filter buttons */}
            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200">
              <button
                onClick={() => setDateFilter('today')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition cursor-pointer ${
                  dateFilter === 'today' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                اليوم
              </button>
              <button
                onClick={() => setDateFilter('yesterday')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition cursor-pointer ${
                  dateFilter === 'yesterday' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                الأمس
              </button>
              <button
                onClick={() => setDateFilter('week')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition cursor-pointer ${
                  dateFilter === 'week' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                هذا الأسبوع
              </button>
              <button
                onClick={() => setDateFilter('month')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition cursor-pointer ${
                  dateFilter === 'month' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                هذا الشهر
              </button>
              <button
                onClick={() => setDateFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition cursor-pointer ${
                  dateFilter === 'all' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                الكل
              </button>
            </div>

            {/* Status Dropdown */}
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl px-2.5 py-1 text-xs font-bold text-slate-700"
            >
              <option value="ALL">جميع الحالات</option>
              <option value="PAID">مدفوع بالكامل</option>
              <option value="PARTIAL">مدفوع جزئياً (آجل)</option>
              <option value="UNPAID">غير مدفوع</option>
              <option value="REFUNDED">مسترد (ملغاة)</option>
            </select>

            {/* Method Dropdown */}
            <select
              value={methodFilter}
              onChange={e => setMethodFilter(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl px-2.5 py-1 text-xs font-bold text-slate-700"
            >
              <option value="ALL">جميع طرق الدفع</option>
              <option value="CASH">كاش</option>
              <option value="CARD">بطاقة / فيزا</option>
              <option value="BANK_TRANSFER">تحويل بنكي / محفظة</option>
            </select>

          </div>

          {/* Table / List */}
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-12 text-slate-400 space-y-2">
              <span className="text-4xl leading-none inline-flex items-center justify-center mx-auto">📄</span>
              <div className="font-bold text-slate-700 text-sm">لا توجد معاملات مطابقة للتصفية</div>
              <p className="text-xs text-slate-400">حاول تغيير معايير التصفية أو البحث بالأعلى.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                    <th className="p-3 rounded-r-xl">المريض</th>
                    <th className="p-3">الخدمة</th>
                    <th className="p-3">الإجمالي</th>
                    <th className="p-3">المدفوع</th>
                    <th className="p-3">المتبقي</th>
                    <th className="p-3">الحالة</th>
                    <th className="p-3">التاريخ</th>
                    <th className="p-3 rounded-l-xl text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredTransactions.map(tx => (
                    <tr key={tx.id} className="hover:bg-slate-50/80 transition">
                      
                      <td className="p-3">
                        <div className="font-black text-slate-900">{tx.patientName}</div>
                        {tx.patientPhone && <div className="text-[10px] text-slate-400 dir-ltr">{tx.patientPhone}</div>}
                      </td>

                      <td className="p-3 font-bold text-[#8B5CF6]">{tx.serviceName}</td>

                      <td className="p-3 font-bold text-slate-800">{tx.totalAmount} ج</td>

                      <td className="p-3 font-bold text-[#10B981]">{tx.paidAmount} ج</td>

                      <td className="p-3 font-bold text-[#EF4444]">{tx.remainingAmount} ج</td>

                      <td className="p-3">
                        {tx.paymentStatus === 'PAID' ? (
                          <span className="inline-block px-2.5 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-50 text-[#10B981] border border-emerald-200">
                            مدفوع
                          </span>
                        ) : tx.paymentStatus === 'PARTIAL' ? (
                          <span className="inline-block px-2.5 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-50 text-[#F59E0B] border border-amber-200">
                            جزئي
                          </span>
                        ) : tx.paymentStatus === 'REFUNDED' ? (
                          <span className="inline-block px-2.5 py-0.5 rounded-md text-[10px] font-extrabold bg-slate-100 text-[#64748B] border border-slate-200">
                            مسترد
                          </span>
                        ) : (
                          <span className="inline-block px-2.5 py-0.5 rounded-md text-[10px] font-extrabold bg-rose-50 text-[#EF4444] border border-rose-200">
                            غير مدفوع
                          </span>
                        )}
                      </td>

                      <td className="p-3 text-[10px] text-slate-400">
                        {new Date(tx.createdAt).toLocaleDateString('ar-EG')}
                      </td>

                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setSelectedReceiptTx(tx)}
                            title="عرض وطباعة الإيصال"
                            className="p-1.5 bg-sky-50 text-sky-700 hover:bg-sky-100 rounded-lg transition cursor-pointer"
                          >
                            <span className="text-base leading-none inline-flex items-center justify-center">🧾</span>
                          </button>

                          {tx.paymentStatus !== 'REFUNDED' && (
                            <button
                              onClick={() => {
                                setRefundModalTx(tx);
                                setRefundAmountInput(tx.paidAmount);
                              }}
                              disabled={!canRefund}
                              title="استرداد مبلغ المعاملة"
                              className={`p-1.5 rounded-lg transition cursor-pointer ${
                                canRefund
                                  ? 'bg-rose-50 text-rose-600 hover:bg-rose-100'
                                  : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                              }`}
                            >
                              <span className="text-base leading-none inline-flex items-center justify-center">↩️</span>
                            </button>
                          )}
                        </div>
                      </td>

                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 6. TAB 4: EXPENSES MANAGEMENT */}
      {activeTab === 'expenses' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-xl font-black text-slate-900">إدارة مصروفات العيادة</h2>
              <p className="text-xs text-slate-500 mt-1">
                تسجيل ومتابعة المصروفات التشغيلية (إيجار، مرافق، مستلزمات طبية، مرتبات) لحساب أرباح العيادة بدقة.
              </p>
            </div>

            <button
              onClick={() => {
                setEditingExpense(null);
                setExpenseTitle('');
                setExpenseAmount('');
                setExpenseNote('');
                setIsExpenseModalOpen(true);
              }}
              disabled={!canManage}
              className={`px-4 py-2.5 rounded-xl font-black text-xs transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer ${
                canManage
                  ? 'bg-rose-600 hover:bg-rose-700 text-white'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <span className="text-base leading-none inline-flex items-center justify-center">➕</span>
              <span>إضافة مصروف جديد</span>
            </button>
          </div>

          {expenses.length === 0 ? (
            <div className="text-center py-12 text-slate-400 space-y-2">
              <span className="text-4xl leading-none inline-flex items-center justify-center mx-auto">💸</span>
              <div className="font-bold text-slate-700 text-sm">لا توجد مصروفات مسجلة حتى الآن</div>
              <p className="text-xs text-slate-400">انقر على "إضافة مصروف جديد" لبدء تتبع المصروفات.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {expenses.map(exp => (
                <div key={exp.id} className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:border-slate-300 transition">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-slate-900 text-sm">{exp.title}</span>
                      <span className="text-[10px] bg-rose-100 text-rose-800 font-extrabold px-2.5 py-0.5 rounded-full">
                        {exp.amount} جنيه
                      </span>
                    </div>
                    {exp.note && <p className="text-xs text-slate-500">{exp.note}</p>}
                    <div className="text-[10px] text-slate-400">
                      بواسطة: {exp.createdByName || 'موظف'} • {new Date(exp.createdAt).toLocaleString('ar-EG')}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => {
                        setEditingExpense(exp);
                        setExpenseTitle(exp.title);
                        setExpenseCategory(exp.category);
                        setExpenseAmount(exp.amount);
                        setExpenseNote(exp.note || '');
                        setIsExpenseModalOpen(true);
                      }}
                      disabled={!canManage}
                      className="p-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl transition cursor-pointer"
                    >
                      <span className="text-base leading-none inline-flex items-center justify-center">✏️</span>
                    </button>

                    <button
                      onClick={() => handleDeleteExpenseClick(exp)}
                      disabled={!canManage}
                      className="p-2 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-xl transition cursor-pointer"
                    >
                      <span className="text-base leading-none inline-flex items-center justify-center">🗑️</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 7. TAB 5: SERVICES & PRICING */}
      {activeTab === 'services' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-xl font-black text-slate-900">الخدمات والأسعار الطبية</h2>
              <p className="text-xs text-slate-500 mt-1">
                تحديد قائمة الخدمات الطبية التي تقدمها العيادة مع تحديد تسعيرة كل خدمة للتسهيل عند تحصيل الرسوم.
              </p>
            </div>

            <button
              onClick={() => {
                setEditingService(null);
                setServiceName('');
                setServiceDescription('');
                setServicePrice('');
                setIsServiceModalOpen(true);
              }}
              disabled={!canEditPrices}
              className={`px-4 py-2.5 rounded-xl font-black text-xs transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer ${
                canEditPrices
                  ? 'bg-[#8B5CF6] hover:bg-violet-700 text-white'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <span className="text-base leading-none inline-flex items-center justify-center">➕</span>
              <span>إضافة خدمة / سعر جديد</span>
            </button>
          </div>

          {services.length === 0 ? (
            <div className="text-center py-12 text-slate-400 space-y-2">
              <span className="text-4xl leading-none inline-flex items-center justify-center mx-auto">🏷️</span>
              <div className="font-bold text-slate-700 text-sm">لا توجد خدمات معرفة حتى الآن</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {services.map(srv => (
                <div
                  key={srv.id}
                  className={`p-5 rounded-2xl border transition space-y-3 ${
                    srv.active ? 'bg-white border-slate-200 shadow-xs' : 'bg-slate-50 border-slate-200 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-extrabold text-slate-900 text-sm">{srv.name}</h3>
                      {srv.description && <p className="text-xs text-slate-500 mt-0.5">{srv.description}</p>}
                    </div>
                    <span className="text-xs font-black text-[#8B5CF6] bg-violet-50 px-2.5 py-1 rounded-lg border border-violet-200 shrink-0">
                      {srv.price} جنيه
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                    <span className={`font-bold text-[10px] ${srv.active ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {srv.active ? 'نشطة في العيادة' : 'معطلة'}
                    </span>

                    {canEditPrices && (
                      <button
                        onClick={() => {
                          setEditingService(srv);
                          setServiceName(srv.name);
                          setServiceDescription(srv.description || '');
                          setServicePrice(srv.price);
                          setIsServiceModalOpen(true);
                        }}
                        className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition cursor-pointer flex items-center gap-1 text-[11px]"
                      >
                        <span className="text-base leading-none inline-flex items-center justify-center">✏️</span>
                        <span>تعديل</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: PRINT RECEIPT MODAL */}
      <PaymentReceiptModal
        transaction={selectedReceiptTx}
        doctor={doctor}
        onClose={() => setSelectedReceiptTx(null)}
      />

      {/* MODAL 2: PAY OUTSTANDING BALANCE MODAL */}
      {payBalanceModalTx && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-slate-200 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-black text-slate-900 text-base">سداد المبلغ المتبقي المستحق</h3>
              <button
                onClick={() => setPayBalanceModalTx(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer"
                aria-label="إغلاق"
              >
                <span className="text-base font-bold select-none leading-none">✕</span>
              </button>
            </div>

            <div className="bg-amber-50 p-3.5 rounded-2xl border border-amber-200 text-xs text-amber-900 space-y-1">
              <div>المريض: <b>{payBalanceModalTx.patientName}</b></div>
              <div>المبلغ المتبقي المستحق: <b className="text-amber-800 text-sm">{payBalanceModalTx.remainingAmount} جنيه</b></div>
            </div>

            <form onSubmit={handleAdditionalPaymentSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">المبلغ المراد سداده الآن (جنيه):</label>
                <input
                  type="number"
                  required
                  min="1"
                  max={payBalanceModalTx.remainingAmount}
                  value={additionalPayAmount}
                  onChange={e => setAdditionalPayAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">طريقة الدفع:</label>
                <select
                  value={additionalPayMethod}
                  onChange={e => setAdditionalPayMethod(e.target.value as PaymentMethod)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-900"
                >
                  <option value="CASH">نقداً (كاش)</option>
                  <option value="CARD">بطاقة / فيزا</option>
                  <option value="BANK_TRANSFER">تحويل بنكي / محفظة</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">ملاحظات سداد (اختياري):</label>
                <input
                  type="text"
                  placeholder="ملاحظة على الدفعة"
                  value={additionalPayNotes}
                  onChange={e => setAdditionalPayNotes(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPayBalanceModalTx(null)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingBalance}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl cursor-pointer"
                >
                  {isSubmittingBalance ? 'جاري السداد...' : 'تأكيد السداد'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: REFUND MODAL */}
      {refundModalTx && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-slate-200 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-black text-slate-900 text-base text-rose-600">إجراء استرداد أموال (Refund)</h3>
              <button
                onClick={() => setRefundModalTx(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer"
                aria-label="إغلاق"
              >
                <span className="text-base font-bold select-none leading-none">✕</span>
              </button>
            </div>

            <div className="bg-rose-50 p-3.5 rounded-2xl border border-rose-200 text-xs text-rose-900 space-y-1">
              <div>المريض: <b>{refundModalTx.patientName}</b></div>
              <div>المدفوع الفعلي السابق: <b>{refundModalTx.paidAmount} جنيه</b></div>
            </div>

            <form onSubmit={handleRefundSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">المبلغ المراد استرداده (جنيه):</label>
                <input
                  type="number"
                  required
                  min="1"
                  max={refundModalTx.paidAmount}
                  value={refundAmountInput}
                  onChange={e => setRefundAmountInput(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">سبب الاسترداد <span className="text-rose-500">*</span>:</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: عدم حضور المريض للكشف وتأجيل الموعد"
                  value={refundReasonInput}
                  onChange={e => setRefundReasonInput(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRefundModalTx(null)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRefund}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl cursor-pointer"
                >
                  {isSubmittingRefund ? 'جاري الاسترداد...' : 'تأكيد الاسترداد'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: EXPENSE ADD/EDIT MODAL */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-slate-200 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-black text-slate-900 text-base">
                {editingExpense ? 'تعديل بيانات المصروف' : 'تسجيل مصروف جديد'}
              </h3>
              <button
                onClick={() => setIsExpenseModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer"
                aria-label="إغلاق"
              >
                <span className="text-base font-bold select-none leading-none">✕</span>
              </button>
            </div>

            <form onSubmit={handleExpenseSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">بيان المصروف <span className="text-rose-500">*</span>:</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: فاتورة كهرباء العيادة"
                  value={expenseTitle}
                  onChange={e => setExpenseTitle(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">تصنيف المصروف:</label>
                <select
                  value={expenseCategory}
                  onChange={e => setExpenseCategory(e.target.value as ExpenseCategory)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-900"
                >
                  <option value="MEDICAL_SUPPLIES">مستلزمات طبية وأدوية</option>
                  <option value="RENT">إيجار المقر</option>
                  <option value="UTILITIES">مرافق (كهرباء، مياه، إنترنت)</option>
                  <option value="SALARIES">مرتبات وحوافز</option>
                  <option value="MAINTENANCE">صيانة وتطوير</option>
                  <option value="OTHER">مصروفات أخرى</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">قيمة المصروف (جنيه) <span className="text-rose-500">*</span>:</label>
                <input
                  type="number"
                  required
                  min="1"
                  placeholder="500"
                  value={expenseAmount}
                  onChange={e => setExpenseAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">ملاحظات (اختياري):</label>
                <input
                  type="text"
                  placeholder="تفاصيل إضافية"
                  value={expenseNote}
                  onChange={e => setExpenseNote(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingExpense}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl cursor-pointer"
                >
                  {isSubmittingExpense ? 'جاري الحفظ...' : 'حفظ المصروف'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: SERVICE ADD/EDIT MODAL */}
      {isServiceModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-slate-200 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-black text-slate-900 text-base">
                {editingService ? 'تعديل سعر خدمة' : 'إضافة خدمة طبية جديدة'}
              </h3>
              <button
                onClick={() => setIsServiceModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer"
                aria-label="إغلاق"
              >
                <span className="text-base font-bold select-none leading-none">✕</span>
              </button>
            </div>

            <form onSubmit={handleServiceSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">اسم الخدمة <span className="text-rose-500">*</span>:</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: كشف أسنان شامل"
                  value={serviceName}
                  onChange={e => setServiceName(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">سعر الخدمة (جنيه) <span className="text-rose-500">*</span>:</label>
                <input
                  type="number"
                  required
                  min="0"
                  placeholder="300"
                  value={servicePrice}
                  onChange={e => setServicePrice(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">وصف الخدمة (اختياري):</label>
                <input
                  type="text"
                  placeholder="تفاصيل الخدمة المقدمة"
                  value={serviceDescription}
                  onChange={e => setServiceDescription(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsServiceModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingService}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-black rounded-xl cursor-pointer"
                >
                  {isSubmittingService ? 'جاري الحفظ...' : 'حفظ الخدمة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 6: PATIENT MEDICAL & FINANCIAL FILE MODAL */}
      {activeFileModal && (
        <PatientFileModal
          doctorId={organizationId}
          patientPhone={activeFileModal.phone}
          patientName={activeFileModal.name}
          isOpen={!!activeFileModal}
          onClose={() => setActiveFileModal(null)}
        />
      )}

    </div>
  );
};
