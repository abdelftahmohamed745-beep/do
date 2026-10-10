import React, { useState, useEffect, useRef } from 'react';
import {
  ClinicService,
  PaymentMethod,
  PaymentSplitItem,
  PatientRecord
} from '../types';
import {
  searchClinicPatientsFast,
  FastPatientSearchResult,
  bookPatient,
  recordSplitPayment,
  getClinicServicesPublic,
  getTodayDateString
} from '../services/firebaseService';
import {
  sanitizePatientPhoneNumber,
  validatePatientPhoneNumber
} from '../services/securityService';

interface FastPatientRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  doctorId: string;
  doctorName?: string;
  defaultConsultationPrice?: number;
  currentUserId?: string;
  currentUserName?: string;
  onPatientAdded?: (newPatient: PatientRecord) => void;
  onSuccess?: () => void;
  onShowToast?: (title: string, message?: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export const FastPatientRegistrationModal: React.FC<FastPatientRegistrationModalProps> = ({
  isOpen,
  onClose,
  doctorId,
  doctorName = 'دكتور العيادة',
  defaultConsultationPrice = 300,
  currentUserId = 'secretary',
  currentUserName = 'السكرتارية',
  onPatientAdded,
  onSuccess,
  onShowToast
}) => {
  // Input fields
  const [patientName, setPatientName] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [selectedPatientVisits, setSelectedPatientVisits] = useState<number>(0);
  const [selectedPatientBalance, setSelectedPatientBalance] = useState<number>(0);

  // Autocomplete suggestions
  const [suggestions, setSuggestions] = useState<FastPatientSearchResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // Services
  const [services, setServices] = useState<ClinicService[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<string>('default_consultation');
  const [customServiceName, setCustomServiceName] = useState('');
  const [totalAmount, setTotalAmount] = useState<number>(defaultConsultationPrice);

  // Split Payments
  const [payments, setPayments] = useState<PaymentSplitItem[]>([
    { method: 'CASH', amount: defaultConsultationPrice }
  ]);

  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const debounceTimeout = useRef<any>(null);

  // Load clinic services
  useEffect(() => {
    if (!isOpen || !doctorId) return;
    const fetchServices = async () => {
      try {
        const list = await getClinicServicesPublic(doctorId);
        setServices(list.filter((s) => s.active));
      } catch (err) {
        console.warn('Error fetching services:', err);
      }
    };
    fetchServices();
  }, [isOpen, doctorId]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setPatientName('');
      setPatientPhone('');
      setSelectedPatientId(null);
      setSelectedPatientVisits(0);
      setSelectedPatientBalance(0);
      setSuggestions([]);
      setSelectedServiceId('default_consultation');
      setTotalAmount(defaultConsultationPrice);
      setPayments([{ method: 'CASH', amount: defaultConsultationPrice }]);
      setNotes('');
    }
  }, [isOpen, defaultConsultationPrice]);

  // Autocomplete search on typing name or phone
  const handleQueryChange = (val: string, type: 'name' | 'phone') => {
    let effectiveVal = val;
    if (type === 'name') {
      setPatientName(val);
    } else {
      effectiveVal = sanitizePatientPhoneNumber(val, 11);
      setPatientPhone(effectiveVal);
    }
    setSelectedPatientId(null);

    const term = effectiveVal.trim();
    if (term.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    debounceTimeout.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchClinicPatientsFast(doctorId, term, 6);
        setSuggestions(results);
        setShowSuggestions(results.length > 0);
      } catch (err) {
        console.warn('Error searching:', err);
      } finally {
        setIsSearching(false);
      }
    }, 250);
  };

  // Select an existing patient from suggestions
  const handleSelectPatient = (p: FastPatientSearchResult) => {
    setPatientName(p.patientName);
    setPatientPhone(p.patientPhone);
    setSelectedPatientId(p.id);
    setSelectedPatientVisits(p.visitsCount || 1);
    setSelectedPatientBalance(p.totalOutstandingBalance || 0);
    setShowSuggestions(false);
  };

  // Service Selection Change
  const handleServiceChange = (serviceId: string) => {
    setSelectedServiceId(serviceId);
    if (serviceId === 'default_consultation') {
      setTotalAmount(defaultConsultationPrice);
      setPayments([{ method: 'CASH', amount: defaultConsultationPrice }]);
    } else if (serviceId === 'custom') {
      setTotalAmount(0);
      setPayments([{ method: 'CASH', amount: 0 }]);
    } else {
      const s = services.find((x) => x.id === serviceId);
      if (s) {
        setTotalAmount(s.price);
        setPayments([{ method: 'CASH', amount: s.price }]);
      }
    }
  };

  // Split payment helpers
  const handleAddPaymentRow = () => {
    const currentTotalPaid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const diff = Math.max(0, totalAmount - currentTotalPaid);
    setPayments([...payments, { method: 'CARD', amount: diff }]);
  };

  const handleRemovePaymentRow = (index: number) => {
    if (payments.length <= 1) return;
    setPayments(payments.filter((_, i) => i !== index));
  };

  const handlePaymentAmountChange = (index: number, amt: number) => {
    const updated = [...payments];
    updated[index].amount = Math.max(0, amt);
    setPayments(updated);
  };

  const handlePaymentMethodChange = (index: number, method: PaymentMethod) => {
    const updated = [...payments];
    updated[index].method = method;
    setPayments(updated);
  };

  const totalPaid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const remainingAmount = Math.max(0, totalAmount - totalPaid);

  // Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientName.trim()) {
      if (onShowToast) onShowToast('يرجى إدخال اسم المريض', '', 'warning');
      return;
    }
    const phoneValidation = validatePatientPhoneNumber(patientPhone);
    if (!phoneValidation.isValid) {
      if (onShowToast) onShowToast(phoneValidation.error || 'رقم الهاتف يجب أن يكون من 10 إلى 11 رقمًا.', '', 'warning');
      return;
    }
    const cleanPhone = phoneValidation.cleanPhone;

    setIsSubmitting(true);
    try {
      // 1. Determine service name
      let finalServiceName = 'كشف بعيادة الطبيب';
      if (selectedServiceId === 'custom') {
        finalServiceName = customServiceName.trim() || 'خدمة خاصة';
      } else if (selectedServiceId !== 'default_consultation') {
        const s = services.find((x) => x.id === selectedServiceId);
        if (s) finalServiceName = s.name;
      }

      // 2. Book patient in queue (atomic sequence numbering)
      const cleanServiceId = selectedServiceId !== 'custom' && selectedServiceId !== 'default_consultation' ? selectedServiceId : '';
      const bookingResult = await bookPatient(
        doctorId,
        patientName.trim(),
        cleanPhone,
        currentUserId,
        'two_turns',
        {
          serviceId: cleanServiceId,
          serviceName: finalServiceName,
          price: totalAmount
        }
      );

      // Optimistic record for instant UI insertion
      const nowIso = new Date().toISOString();
      const newPatientRecord: PatientRecord = {
        id: bookingResult.patientId,
        patientId: bookingResult.patientId,
        name: patientName.trim(),
        phone: cleanPhone,
        sequenceNumber: bookingResult.sequenceNumber,
        queueNumber: bookingResult.sequenceNumber,
        status: 'waiting',
        date: getTodayDateString(),
        createdAt: nowIso,
        doctorId: doctorId,
        clinicId: doctorId,
        visitType: 'كشف عيادة',
        serviceId: cleanServiceId,
        serviceName: finalServiceName,
        price: totalAmount,
        paidAmount: totalPaid,
        balanceAmount: remainingAmount,
        paymentStatus: remainingAmount <= 0 ? 'paid' : totalPaid > 0 ? 'partial' : 'pending'
      };

      if (onPatientAdded) {
        onPatientAdded(newPatientRecord);
      }

      // 3. Record transaction with multi-payment split
      try {
        await recordSplitPayment({
          organizationId: doctorId,
          patientName: patientName.trim(),
          patientPhone: cleanPhone,
          patientRecordId: bookingResult.patientId,
          serviceId: cleanServiceId,
          serviceName: finalServiceName,
          totalAmount,
          payments,
          notes: notes.trim() || '',
          createdBy: currentUserId,
          createdByName: currentUserName
        });
      } catch (payErr) {
        console.warn('Transaction split payment logged with warning:', payErr);
      }

      if (onShowToast) {
        onShowToast(
          'تم تسجيل المريض وحجز التذكرة بنجاح',
          `تذكرة رقم #${bookingResult.sequenceNumber} • المبلغ المحصل: ${totalPaid} ج.م`,
          'success'
        );
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Registration error:', err);
      if (onShowToast) onShowToast('فشل تسجيل المريض', err?.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      id="fast-patient-registration-modal"
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      dir="rtl"
    >
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-sky-600 to-sky-800 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
              <span className="text-xl leading-none inline-flex items-center justify-center">🧑‍⚕️</span>
            </div>
            <div>
              <h3 className="text-lg font-extrabold font-['Tajawal',sans-serif]">
                تسجيل مريض جديد أو استدعاء ملف سابق
              </h3>
              <p className="text-xs text-sky-100">
                تسجيل الحضور في الطابور والتحصيل وربط الملف الطبي في خطوة واحدة
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer text-base leading-none font-bold"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 text-right">

          {/* Patient Search & Deduplication Alert */}
          {selectedPatientId && (
            <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-2xl flex items-center justify-between gap-3 text-xs text-emerald-900">
              <div className="flex items-center gap-2">
                <span className="text-sm leading-none inline-flex items-center justify-center text-emerald-600">✅</span>
                <span>
                  تم التعرف على المريض: <strong>{patientName}</strong> • الزيارة رقم <strong>{selectedPatientVisits + 1}</strong>
                </span>
              </div>
              {selectedPatientBalance > 0 && (
                <span className="px-2.5 py-1 bg-rose-100 border border-rose-300 rounded-lg text-rose-800 font-extrabold font-mono shrink-0">
                  مستحق سابق: {selectedPatientBalance} ج.م
                </span>
              )}
            </div>
          )}

          {/* Patient Inputs with autocomplete */}
          <div className="grid sm:grid-cols-2 gap-3 relative">
            
            {/* Patient Name */}
            <div>
              <label className="block text-xs font-extrabold text-slate-800 mb-1">
                اسم المريض: *
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={patientName}
                  onChange={(e) => handleQueryChange(e.target.value, 'name')}
                  placeholder="اكتب اسم المريض (مثال: محمد أحمد)..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-sky-500 focus:bg-white"
                />
                {isSearching && (
                  <span className="absolute left-2.5 top-3 text-[10px] text-slate-400">بحث...</span>
                )}
              </div>
            </div>

            {/* Patient Phone */}
            <div>
              <label className="block text-xs font-extrabold text-slate-800 mb-1">
                رقم الهاتف (مفتاح الملف الموحد): *
              </label>
              <input
                type="tel"
                required
                dir="ltr"
                maxLength={11}
                value={patientPhone}
                onChange={(e) => handleQueryChange(e.target.value, 'phone')}
                onPaste={(e) => {
                  e.preventDefault();
                  const pasted = e.clipboardData.getData('text');
                  const sanitized = sanitizePatientPhoneNumber(pasted, 11);
                  handleQueryChange(sanitized, 'phone');
                }}
                placeholder="01012345678"
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-sky-500 focus:bg-white text-right"
              />
            </div>

            {/* Suggestions Dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="sm:col-span-2 bg-white border-2 border-sky-400 rounded-2xl shadow-xl p-2.5 space-y-1.5 max-h-56 overflow-y-auto z-40">
                <div className="flex items-center justify-between text-[11px] text-sky-800 px-2 py-1 font-extrabold border-b border-sky-100 bg-sky-50/60 rounded-lg">
                  <span>مرضى مسجلين سابقًا في العيادة (اضغط للتعبئة التلقائية للبيانات):</span>
                  <button
                    type="button"
                    onClick={() => setShowSuggestions(false)}
                    className="text-slate-400 hover:text-slate-700 font-bold px-1.5 py-0.5 rounded cursor-pointer"
                  >
                    إغلاق ✕
                  </button>
                </div>
                {suggestions.map((s, idx) => (
                  <div
                    key={s.id ? `suggestion-${s.id}-${idx}` : `suggestion-${s.patientPhone || idx}-${idx}`}
                    onClick={() => handleSelectPatient(s)}
                    className="p-2.5 rounded-xl bg-slate-50 hover:bg-sky-50 border border-slate-200 hover:border-sky-300 transition cursor-pointer flex items-center justify-between text-xs active:scale-[0.99]"
                  >
                    <div>
                      <span className="font-black text-slate-900 block text-sm">{s.patientName}</span>
                      <span className="text-xs text-slate-600 font-mono font-bold" dir="ltr">{s.patientPhone}</span>
                    </div>
                    <div className="text-left font-mono space-y-1">
                      <span className="px-2.5 py-0.5 bg-sky-100/70 text-sky-800 rounded-md text-[10px] font-extrabold block">
                        {s.visitsCount} زيارات سابقة
                      </span>
                      {s.totalOutstandingBalance > 0 && (
                        <span className="px-2 py-0.5 bg-rose-100 text-rose-700 rounded-md text-[10px] font-extrabold block">
                          متبقي: {s.totalOutstandingBalance} ج.م
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

          </div>

          {/* Service & Package Selection (Section 11) */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
            <label className="block text-xs font-extrabold text-slate-800">
              الخدمة / الكشف المطلوب:
            </label>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <select
                  value={selectedServiceId}
                  onChange={(e) => handleServiceChange(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-sky-500"
                >
                  <option value="default_consultation">كشف عادي ({defaultConsultationPrice} ج.م)</option>
                  {services.map((s, idx) => (
                    <option key={s.id ? `srv-${s.id}` : `srv-opt-${idx}`} value={s.id}>
                      {s.name} ({s.price} ج.م)
                    </option>
                  ))}
                  <option value="custom">+ خدمة مخصصة / باقة أخرى</option>
                </select>
              </div>

              {selectedServiceId === 'custom' && (
                <div>
                  <input
                    type="text"
                    value={customServiceName}
                    onChange={(e) => setCustomServiceName(e.target.value)}
                    placeholder="اسم الخدمة المخصصة..."
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900"
                  />
                </div>
              )}
            </div>

            {/* Total Service Amount */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
              <span className="text-xs font-bold text-slate-700">قيمة الخدمة الإجمالية (ج.م):</span>
              <input
                type="number"
                min="0"
                value={totalAmount}
                onChange={(e) => {
                  const val = Number(e.target.value) || 0;
                  setTotalAmount(val);
                  if (payments.length === 1) {
                    setPayments([{ ...payments[0], amount: val }]);
                  }
                }}
                className="w-32 p-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-black text-slate-900 text-left"
              />
            </div>
          </div>

          {/* Split Payment Section (Sections 20, 21, 22) */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-extrabold text-slate-900 block">
                  طرق الدفع والتحصيل (Multiple Payment Methods)
                </span>
                <span className="text-[11px] text-slate-500">
                  يمكن تقسيم الدفع بين نقدًا وفيزا وتحويل بنكي
                </span>
              </div>
              <button
                type="button"
                onClick={handleAddPaymentRow}
                className="px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg text-xs font-bold text-sky-700 flex items-center gap-1 cursor-pointer"
              >
                <span className="text-xs leading-none inline-flex items-center justify-center">➕</span>
                <span>إضافة وسيلة دفع</span>
              </button>
            </div>

            {/* Payment Rows */}
            <div className="space-y-2">
              {payments.map((row, idx) => (
                <div key={`split-pay-row-${idx}`} className="flex items-center gap-2">
                  <select
                    value={row.method}
                    onChange={(e) => handlePaymentMethodChange(idx, e.target.value as PaymentMethod)}
                    className="p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 shrink-0"
                  >
                    <option value="CASH">نقدًا (Cash)</option>
                    <option value="CARD">بطاقة / فيزا (Card)</option>
                    <option value="BANK_TRANSFER">تحويل بنكي / إنستاباي</option>
                    <option value="OTHER">أخرى / محفظة إلكترونية</option>
                  </select>

                  <div className="relative flex-1">
                    <input
                      type="number"
                      min="0"
                      value={row.amount}
                      onChange={(e) => handlePaymentAmountChange(idx, Number(e.target.value) || 0)}
                      className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 pl-8 text-left"
                    />
                    <span className="absolute left-2.5 top-2.5 text-[10px] text-slate-400">ج.م</span>
                  </div>

                  {payments.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemovePaymentRow(idx)}
                      className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition cursor-pointer text-xs leading-none font-bold"
                    >
                      <span className="text-xs leading-none inline-flex items-center justify-center">🗑️</span>
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Payment Calculation Summary */}
            <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-200/80 text-center font-mono text-xs">
              <div className="bg-white p-2 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-400 block font-sans">الإجمالي</span>
                <strong className="text-slate-900">{totalAmount} ج.م</strong>
              </div>
              <div className="bg-emerald-50 p-2 rounded-xl border border-emerald-200">
                <span className="text-[10px] text-emerald-600 block font-sans">المدفوع الآن</span>
                <strong className="text-emerald-800">{totalPaid} ج.م</strong>
              </div>
              <div className={`p-2 rounded-xl border ${remainingAmount > 0 ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-200'}`}>
                <span className="text-[10px] text-slate-400 block font-sans">المتبقي</span>
                <strong className={remainingAmount > 0 ? 'text-rose-700' : 'text-slate-700'}>
                  {remainingAmount} ج.م
                </strong>
              </div>
            </div>

          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              ملاحظات السكرتارية (اختياري):
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="أي ملاحظات خاصة عن المريض أو التحصيل..."
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900"
            />
          </div>

          {/* Submit Button */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-extrabold shadow-md shadow-sky-500/20 transition cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'جاري التسجيل...' : 'تأكيد الحجز وإضافة للطابور'}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
