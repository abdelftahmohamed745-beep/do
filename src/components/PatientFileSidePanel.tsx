import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  User,
  Phone,
  Calendar,
  DollarSign,
  FileText,
  Activity,
  Camera,
  Printer,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  Send,
  AlertTriangle,
  Heart,
  TrendingUp,
  Stethoscope,
  ClipboardList,
  Maximize2,
  Edit3,
  Save,
  RotateCw,
  Eye,
  FileSpreadsheet
} from 'lucide-react';
import {
  PatientMedicalFile,
  PatientRecord,
  PatientVisitEntry,
  PatientVitals,
  PrescriptionRecord,
  PrescriptionTemplate,
  PrescriptionMedicineItem,
  ClinicTransaction,
  VisitType
} from '../types';
import {
  getPatientMedicalFile,
  savePatientMedicalFile,
  subscribeToPatientTransactions,
  savePatientPrescription,
  getPatientPrescriptions,
  deletePatientPrescription,
  savePrescriptionTemplate,
  getDoctorPrescriptionTemplates,
  deletePrescriptionTemplate,
  updatePatientVitalsAndNotes,
  completePatientConsultation,
  recordSplitPayment,
  getTodayDateString,
  normalizePhoneNumber
} from '../services/firebaseService';
import { compressPrescriptionPhoto } from '../utils/imageCompressor';

interface PatientFileSidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  doctorId: string;
  doctorName?: string;
  clinicName?: string;
  patientPhone: string;
  patientName?: string;
  patientRecord?: PatientRecord | null;
  initialTab?: 'overview' | 'consultation' | 'prescriptions' | 'investigations' | 'history' | 'payments' | 'growth';
  onShowToast?: (title: string, message?: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  onConsultationComplete?: () => void;
}

export const PatientFileSidePanel: React.FC<PatientFileSidePanelProps> = ({
  isOpen,
  onClose,
  doctorId,
  doctorName = 'دكتور العيادة',
  clinicName = 'العيادة',
  patientPhone,
  patientName = 'مريض',
  patientRecord,
  initialTab = 'overview',
  onShowToast,
  onConsultationComplete
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'consultation' | 'prescriptions' | 'investigations' | 'history' | 'payments' | 'growth'>(initialTab);
  const [loading, setLoading] = useState(true);
  const [medicalFile, setMedicalFile] = useState<PatientMedicalFile | null>(null);
  const [transactions, setTransactions] = useState<ClinicTransaction[]>([]);
  const [prescriptions, setPrescriptions] = useState<PrescriptionRecord[]>([]);
  const [templates, setTemplates] = useState<PrescriptionTemplate[]>([]);

  // Editing Overview State
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editAge, setEditAge] = useState<number | ''>('');
  const [editGender, setEditGender] = useState<'male' | 'female'>('male');
  const [editBloodGroup, setEditBloodGroup] = useState('');
  const [editAllergies, setEditAllergies] = useState('');
  const [editChronicDiseases, setEditChronicDiseases] = useState('');
  const [editGeneralNotes, setEditGeneralNotes] = useState('');
  const [editNationalId, setEditNationalId] = useState('');

  // Active Consultation State
  const [consultVisitType, setConsultVisitType] = useState<VisitType>('new_consultation');
  const [consultChiefComplaint, setConsultChiefComplaint] = useState('');
  const [consultDiagnosis, setConsultDiagnosis] = useState('');
  const [consultNotes, setConsultNotes] = useState('');
  const [consultScheduleFollowUp, setConsultScheduleFollowUp] = useState(false);
  const [consultFollowUpDate, setConsultFollowUpDate] = useState('');
  const [consultFollowUpFee, setConsultFollowUpFee] = useState<number>(150);
  const [consultFollowUpReason, setConsultFollowUpReason] = useState('');
  const [isSubmittingConsult, setIsSubmittingConsult] = useState(false);

  // Vitals State
  const [vitalBpSystolic, setVitalBpSystolic] = useState('');
  const [vitalBpDiastolic, setVitalBpDiastolic] = useState('');
  const [vitalHeartRate, setVitalHeartRate] = useState('');
  const [vitalTemp, setVitalTemp] = useState('');
  const [vitalWeight, setVitalWeight] = useState('');
  const [vitalHeight, setVitalHeight] = useState('');
  const [vitalBloodSugar, setVitalBloodSugar] = useState('');
  const [vitalSpO2, setVitalSpO2] = useState('');

  // Paper Prescription Upload State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isCompressingPhoto, setIsCompressingPhoto] = useState(false);
  const [stagedPhotoBase64, setStagedPhotoBase64] = useState<string | null>(null);
  const [stagedPhotoSizeKb, setStagedPhotoSizeKb] = useState<number>(0);
  const [stagedPhotoDiagnosis, setStagedPhotoDiagnosis] = useState('');
  const [stagedPhotoNotes, setStagedPhotoNotes] = useState('');
  const [isSavingPrescription, setIsSavingPrescription] = useState(false);

  // Lightbox / Image Preview Modal
  const [viewingPhotoUrl, setViewingPhotoUrl] = useState<string | null>(null);

  // Prescription Templates & Digital Rx State
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [newTemplateTitle, setNewTemplateTitle] = useState('');
  const [newTemplateCategory, setNewTemplateCategory] = useState('عام');
  const [newTemplateDiagnosis, setNewTemplateDiagnosis] = useState('');
  const [newTemplateInstructions, setNewTemplateInstructions] = useState('');
  const [templateModalMedicines, setTemplateModalMedicines] = useState<PrescriptionMedicineItem[]>([
    { name: '', dosage: '', timing: '', duration: '', instructions: '' }
  ]);
  const [digitalMedicines, setDigitalMedicines] = useState<PrescriptionMedicineItem[]>([
    { name: '', dosage: '', timing: '', duration: '', instructions: '' }
  ]);

  // Active Staged Prescription Review from Template
  const [activePrescriptionReview, setActivePrescriptionReview] = useState<{
    templateId?: string;
    templateTitle: string;
    diagnosis: string;
    notes: string;
    medicines: PrescriptionMedicineItem[];
  } | null>(null);
  const [isSavingDigitalPrescription, setIsSavingDigitalPrescription] = useState(false);

  // Quick Payment Collection Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<number>(200);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'WALLET' | 'TRANSFER'>('CASH');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  // Clean Normalized Phone
  const cleanPhone = normalizePhoneNumber(patientPhone) || patientPhone.replace(/\D/g, '');

  // Calculate BMI dynamically
  const calculatedBmi = (() => {
    const w = parseFloat(vitalWeight);
    const h = parseFloat(vitalHeight);
    if (w > 0 && h > 0) {
      const hMeters = h / 100;
      const bmi = w / (hMeters * hMeters);
      return Math.round(bmi * 10) / 10;
    }
    return null;
  })();

  const getBmiCategory = (bmi: number) => {
    if (bmi < 18.5) return { label: 'نقص وزن', color: 'text-amber-600 bg-amber-50 border-amber-200' };
    if (bmi < 25) return { label: 'وزن مثالي', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
    if (bmi < 30) return { label: 'زيادة وزن', color: 'text-orange-600 bg-orange-50 border-orange-200' };
    return { label: 'سمنة', color: 'text-rose-700 bg-rose-50 border-rose-200' };
  };

  // Sync initial tab when changed externally
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Load patient file, prescriptions, templates & transactions
  useEffect(() => {
    if (!isOpen || !doctorId || !cleanPhone) return;

    let isMounted = true;
    setLoading(true);

    const loadAll = async () => {
      try {
        const [file, rxList, tplList] = await Promise.all([
          getPatientMedicalFile(doctorId, cleanPhone),
          getPatientPrescriptions(cleanPhone, doctorId),
          getDoctorPrescriptionTemplates(doctorId)
        ]);

        if (isMounted) {
          setMedicalFile(file);
          setPrescriptions(rxList);
          setTemplates(tplList);

          if (file) {
            setEditAge(file.age || '');
            setEditGender(file.gender || 'male');
            setEditBloodGroup(file.bloodGroup || '');
            setEditAllergies(file.allergies || '');
            setEditChronicDiseases(file.chronicDiseases || '');
            setEditGeneralNotes(file.generalNotes || '');
            setEditNationalId(file.nationalId || '');

            // Populate initial vitals from last visit if available
            const lastVisit = file.visits && file.visits[0];
            if (lastVisit?.vitals) {
              const v = lastVisit.vitals;
              if (v.bloodPressure) {
                const parts = v.bloodPressure.split('/');
                setVitalBpSystolic(parts[0] || '');
                setVitalBpDiastolic(parts[1] || '');
              }
              if (v.heartRate) setVitalHeartRate(String(v.heartRate));
              if (v.temperature) setVitalTemp(String(v.temperature));
              if (v.weightKg) setVitalWeight(String(v.weightKg));
              if (v.heightCm) setVitalHeight(String(v.heightCm));
              if (v.bloodSugar) setVitalBloodSugar(String(v.bloodSugar));
              if (v.oxygenSaturation) setVitalSpO2(String(v.oxygenSaturation));
            }
          }
          setLoading(false);
        }
      } catch (err) {
        console.error('Error loading patient context in side panel:', err);
        if (isMounted) setLoading(false);
      }
    };

    loadAll();

    // Default follow-up date to +7 days
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const yyyy = nextWeek.getFullYear();
    const mm = String(nextWeek.getMonth() + 1).padStart(2, '0');
    const dd = String(nextWeek.getDate()).padStart(2, '0');
    setConsultFollowUpDate(`${yyyy}-${mm}-${dd}`);

    const unsubTx = subscribeToPatientTransactions(doctorId, cleanPhone || patientPhone, (txList) => {
      if (!isMounted) return;
      setTransactions(txList);
    });

    return () => {
      isMounted = false;
      unsubTx();
    };
  }, [isOpen, doctorId, cleanPhone]);

  // Handle Save Profile updates
  const handleSaveProfile = async () => {
    try {
      await updatePatientVitalsAndNotes(doctorId, cleanPhone, {
        age: editAge ? Number(editAge) : undefined,
        gender: editGender,
        bloodGroup: editBloodGroup.trim(),
        allergies: editAllergies.trim(),
        chronicDiseases: editChronicDiseases.trim(),
        generalNotes: editGeneralNotes.trim(),
        nationalId: editNationalId.trim()
      });

      // Update local state
      setMedicalFile((prev) =>
        prev
          ? {
              ...prev,
              age: editAge ? Number(editAge) : undefined,
              gender: editGender,
              bloodGroup: editBloodGroup.trim(),
              allergies: editAllergies.trim(),
              chronicDiseases: editChronicDiseases.trim(),
              generalNotes: editGeneralNotes.trim(),
              nationalId: editNationalId.trim(),
              updatedAt: new Date().toISOString()
            }
          : null
      );

      setIsEditingProfile(false);
      onShowToast?.('تم حفظ البيانات', 'تم تحديث الملف الطبي للمريض بنجاح', 'success');
    } catch (err: any) {
      onShowToast?.('خطأ في الحفظ', err?.message || 'تعذر تحديث البيانات', 'error');
    }
  };

  // Handle Photo Capture / Selection
  const handlePhotoSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCompressingPhoto(true);
    try {
      const compressed = await compressPrescriptionPhoto(file);
      setStagedPhotoBase64(compressed.dataUrl);
      setStagedPhotoSizeKb(compressed.sizeKb);
      onShowToast?.(
        'تم تجهيز وضغط الصورة',
        `حجم الصورة: ${compressed.sizeKb} كيلوبايت - دقة ممتازة للقراءة`,
        'success'
      );
    } catch (err: any) {
      console.error('Compression error:', err);
      onShowToast?.('فشل معالجة الصورة', err?.message || 'تأكد من اختيار صورة صالحة', 'error');
    } finally {
      setIsCompressingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Save Staged Paper Prescription
  const handleSavePaperPrescription = async () => {
    if (!stagedPhotoBase64) return;
    setIsSavingPrescription(true);

    try {
      const rxRecord = await savePatientPrescription(cleanPhone, {
        patientName: medicalFile?.patientName || patientName,
        patientPhone: cleanPhone,
        doctorId,
        doctorName,
        clinicName,
        date: getTodayDateString(),
        type: 'paper_photo',
        photoBase64: stagedPhotoBase64,
        sizeKb: stagedPhotoSizeKb,
        diagnosis: stagedPhotoDiagnosis.trim(),
        notes: stagedPhotoNotes.trim()
      });

      setPrescriptions((prev) => [rxRecord, ...prev]);
      setStagedPhotoBase64(null);
      setStagedPhotoDiagnosis('');
      setStagedPhotoNotes('');
      setStagedPhotoSizeKb(0);
      onShowToast?.('تم حفظ الروشتة', 'تمت إضافة صورة الروشتة الورقية إلى ملف المريض', 'success');
    } catch (err: any) {
      console.error('Error saving prescription:', err);
      onShowToast?.('خطأ في الحفظ', err?.message || 'تعذر حفظ الروشتة', 'error');
    } finally {
      setIsSavingPrescription(false);
    }
  };

  // Delete Prescription
  const handleDeletePrescription = async (rxId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذه الروشتة من ملف المريض؟')) return;
    try {
      await deletePatientPrescription(cleanPhone, rxId, doctorId);
      setPrescriptions((prev) => prev.filter((r) => r.id !== rxId));
      onShowToast?.('تم الحذف', 'تم حذف الروشتة من السجل', 'info');
    } catch (err: any) {
      onShowToast?.('خطأ في الحذف', err?.message, 'error');
    }
  };

  // Insert Template into Active Consultation / Prescription Review
  const handleApplyTemplate = (tpl: PrescriptionTemplate) => {
    const meds = tpl.medicines && tpl.medicines.length > 0
      ? tpl.medicines.map((m) => ({ ...m }))
      : [{ name: '', dosage: '', timing: '', duration: '', instructions: '' }];

    setActivePrescriptionReview({
      templateId: tpl.id,
      templateTitle: tpl.title,
      diagnosis: tpl.diagnosis || consultDiagnosis || '',
      notes: tpl.instructions || '',
      medicines: meds
    });

    // Also populate consultation medicines so live consultation stays in sync
    setDigitalMedicines(tpl.medicines.map((m) => ({ ...m })));
    if (tpl.diagnosis && !consultDiagnosis) {
      setConsultDiagnosis(tpl.diagnosis);
    }
    setActiveTab('prescriptions');
    onShowToast?.('تم إدراج القالب', `قالب "${tpl.title}" معروض الآن للمراجعة والتعديل قبل الاعتماد`, 'info');
  };

  // Save Staged Digital Prescription to Patient File
  const handleSaveDigitalPrescription = async () => {
    if (!activePrescriptionReview) return;

    const validMedicines = activePrescriptionReview.medicines.filter((m) => m.name && m.name.trim().length > 0);
    if (validMedicines.length === 0) {
      onShowToast?.('تنبيه', 'يرجى كتابة اسم دواء واحد على الأقل في الروشتة', 'warning');
      return;
    }

    setIsSavingDigitalPrescription(true);
    try {
      const rxRecord = await savePatientPrescription(cleanPhone, {
        patientName: medicalFile?.patientName || patientName,
        patientPhone: cleanPhone,
        doctorId,
        doctorName,
        clinicName,
        date: getTodayDateString(),
        type: 'digital',
        diagnosis: activePrescriptionReview.diagnosis.trim(),
        notes: activePrescriptionReview.notes.trim(),
        medicines: validMedicines
      });

      setPrescriptions((prev) => [rxRecord, ...prev]);
      setActivePrescriptionReview(null);
      onShowToast?.('تم اعتماد الروشتة', 'تم حفظ الروشتة الرقمية بنجاح في ملف المريض', 'success');
    } catch (err: any) {
      console.error('Error saving digital prescription:', err);
      onShowToast?.('خطأ في الحفظ', err?.message || 'تعذر حفظ الروشتة الرقمية', 'error');
    } finally {
      setIsSavingDigitalPrescription(false);
    }
  };

  // Save New Template
  const handleCreateTemplate = async () => {
    if (!newTemplateTitle.trim()) {
      onShowToast?.('تنبيه', 'يرجى إدخال اسم القالب', 'warning');
      return;
    }

    try {
      const created = await savePrescriptionTemplate(doctorId, {
        title: newTemplateTitle,
        category: newTemplateCategory,
        diagnosis: newTemplateDiagnosis,
        instructions: newTemplateInstructions,
        medicines: templateModalMedicines.filter((m) => m.name.trim().length > 0)
      });

      setTemplates((prev) => [created, ...prev]);
      setShowTemplateModal(false);
      setNewTemplateTitle('');
      setNewTemplateDiagnosis('');
      setNewTemplateInstructions('');
      setTemplateModalMedicines([{ name: '', dosage: '', timing: '', duration: '', instructions: '' }]);
      onShowToast?.('تم حفظ القالب', 'يمكنك الآن استخدامه بنقرة واحدة مع أي مريض', 'success');
    } catch (err: any) {
      onShowToast?.('خطأ', err?.message, 'error');
    }
  };

  // Delete Template
  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('هل تريد حذف هذا القالب؟')) return;
    try {
      await deletePrescriptionTemplate(doctorId, templateId);
      setTemplates((prev) => prev.filter((t) => t.id !== templateId));
      onShowToast?.('تم الحذف', 'تم حذف القالب', 'info');
    } catch (err: any) {
      onShowToast?.('خطأ', err?.message, 'error');
    }
  };

  // Complete Active Consultation
  const handleSaveConsultation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consultDiagnosis.trim()) {
      onShowToast?.('بيانات ناقصة', 'يرجى كتابة التشخيص الطبي للكشف', 'warning');
      return;
    }

    setIsSubmittingConsult(true);

    // Build vitals payload
    const bp =
      vitalBpSystolic && vitalBpDiastolic
        ? `${vitalBpSystolic}/${vitalBpDiastolic}`
        : vitalBpSystolic || undefined;

    const vitalsPayload: PatientVitals = {
      bloodPressure: bp,
      heartRate: vitalHeartRate ? Number(vitalHeartRate) : undefined,
      temperature: vitalTemp ? Number(vitalTemp) : undefined,
      weightKg: vitalWeight ? Number(vitalWeight) : undefined,
      heightCm: vitalHeight ? Number(vitalHeight) : undefined,
      bmi: calculatedBmi || undefined,
      bloodSugar: vitalBloodSugar ? Number(vitalBloodSugar) : undefined,
      oxygenSaturation: vitalSpO2 ? Number(vitalSpO2) : undefined,
      measuredAt: new Date().toISOString()
    };

    // Format digital medicines if present
    const validMedicines = digitalMedicines.filter((m) => m.name.trim().length > 0);
    const rxText = validMedicines.length > 0
      ? validMedicines.map((m) => `• ${m.name} ${m.dosage || ''} - ${m.timing || ''} (${m.duration || ''})`).join('\n')
      : '';

    try {
      const patientIdForComplete = patientRecord?.id || cleanPhone;
      await completePatientConsultation({
        doctorId,
        patientRecordId: patientIdForComplete,
        patientName: medicalFile?.patientName || patientName,
        patientPhone: cleanPhone,
        visitType: consultVisitType,
        diagnosis: consultDiagnosis.trim(),
        prescription: rxText,
        notes: [
          consultChiefComplaint ? `الشكوى: ${consultChiefComplaint}` : '',
          consultNotes ? `ملاحظات: ${consultNotes}` : ''
        ]
          .filter(Boolean)
          .join(' | '),
        followUpDate: consultScheduleFollowUp ? consultFollowUpDate : undefined,
        followUpTime: '18:00',
        followUpFee: consultScheduleFollowUp ? consultFollowUpFee : undefined,
        followUpReason: consultScheduleFollowUp ? consultFollowUpReason : undefined,
        doctorName,
        clinicName
      });

      // Also persist vitals in medical file
      await updatePatientVitalsAndNotes(doctorId, cleanPhone, {
        vitals: vitalsPayload
      });

      // If there were digital medicines, save as a digital prescription record
      if (validMedicines.length > 0) {
        await savePatientPrescription(cleanPhone, {
          patientName: medicalFile?.patientName || patientName,
          patientPhone: cleanPhone,
          doctorId,
          doctorName,
          clinicName,
          date: getTodayDateString(),
          type: 'digital',
          diagnosis: consultDiagnosis.trim(),
          medicines: validMedicines,
          notes: consultNotes
        });
      }

      onShowToast?.('تم تسجيل الكشف بنجاح', 'تم حفظ الكشف والتشخيص والروشتة في الملف الطبي للمريض', 'success');
      onConsultationComplete?.();
      setActiveTab('history');
    } catch (err: any) {
      console.error('Error completing consultation:', err);
      onShowToast?.('فشل الحفظ', err?.message || 'تعذر إتمام الكشف', 'error');
    } finally {
      setIsSubmittingConsult(false);
    }
  };

  // Submit Quick Payment
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (paymentAmount <= 0) {
      onShowToast?.('تنبيه', 'يرجى إدخال مبلغ صحيح', 'warning');
      return;
    }

    setIsSubmittingPayment(true);
    try {
      await recordSplitPayment({
        organizationId: doctorId,
        patientName: medicalFile?.patientName || patientName,
        patientPhone: cleanPhone,
        patientRecordId: patientRecord?.id,
        serviceName: 'كشف عيادة',
        totalAmount: paymentAmount,
        payments: [{ method: paymentMethod, amount: paymentAmount }],
        notes: paymentNotes || 'سداد رسوم كشف من الملف الطبي',
        createdBy: doctorId,
        createdByName: doctorName
      });

      setShowPaymentModal(false);
      onShowToast?.('تم تسجيل الدفعة', `تم تحصيل ${paymentAmount} ج.م بنجاح`, 'success');
    } catch (err: any) {
      onShowToast?.('خطأ', err?.message, 'error');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // Quick WhatsApp Message
  const handleOpenWhatsApp = () => {
    const rawDigits = cleanPhone.startsWith('0') ? '2' + cleanPhone : cleanPhone.startsWith('20') ? cleanPhone : '20' + cleanPhone;
    const msg = encodeURIComponent(
      `مرحباً أ/ ${medicalFile?.patientName || patientName}،\nمعك عيادة ${doctorName}.\nنرسل إليك متابعة لحالتك والملف الطبي الخاص بك.\nدمتم بصحة وعافية.`
    );
    window.open(`https://wa.me/${rawDigits}?text=${msg}`, '_blank');
  };

  // Print Prescription Handler (A5 / A4 standard layout)
  const handlePrintPrescription = (rx?: PrescriptionRecord) => {
    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (!printWindow) {
      onShowToast?.('تنبيه', 'يرجى السماح بالنوافذ المنبثقة لطباعة الروشتة', 'warning');
      return;
    }

    const medRows = rx?.medicines?.length
      ? rx.medicines
          .map(
            (m, i) => `
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 12px; font-weight: bold; font-size: 16px;">${i + 1}. ${m.name}</td>
            <td style="padding: 12px; color: #334155;">${m.dosage || '-'}</td>
            <td style="padding: 12px; color: #334155;">${m.timing || '-'}</td>
            <td style="padding: 12px; color: #334155;">${m.duration || '-'}</td>
            <td style="padding: 12px; color: #64748b; font-size: 13px;">${m.instructions || ''}</td>
          </tr>
        `
          )
          .join('')
      : '';

    const htmlContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8" />
        <title>روشتة علاجية - ${medicalFile?.patientName || patientName}</title>
        <style>
          @page { size: A5; margin: 15mm; }
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; color: #0f172a; direction: rtl; }
          .header { border-bottom: 2px solid #0f766e; padding-bottom: 15px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
          .clinic-name { font-size: 22px; font-weight: 800; color: #0f766e; }
          .doctor-name { font-size: 16px; font-weight: bold; color: #334155; }
          .patient-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; font-size: 14px; }
          .rx-symbol { font-size: 28px; font-weight: 900; color: #0f766e; font-family: serif; margin-bottom: 10px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th { text-align: right; background: #f1f5f9; padding: 10px; font-size: 13px; color: #475569; }
          .footer { margin-top: 40px; padding-top: 20px; border-top: 1px dashed #cbd5e1; display: flex; justify-content: space-between; font-size: 13px; color: #64748b; }
          .signature { border-top: 1px solid #94a3b8; width: 180px; text-align: center; padding-top: 5px; margin-top: 40px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="clinic-name">${clinicName}</div>
            <div class="doctor-name">د. ${doctorName}</div>
          </div>
          <div style="text-align: left; font-size: 12px; color: #64748b;">
            التاريخ: ${rx?.date || getTodayDateString()}
          </div>
        </div>

        <div class="patient-box">
          <div><strong>اسم المريض:</strong> ${medicalFile?.patientName || patientName}</div>
          <div><strong>السن:</strong> ${medicalFile?.age ? medicalFile.age + ' سنة' : '-'}</div>
          <div><strong>كود المريض:</strong> ${medicalFile?.patientId || cleanPhone}</div>
        </div>

        ${rx?.diagnosis ? `<div style="margin-bottom: 16px; font-size: 14px;"><strong>التشخيص:</strong> ${rx.diagnosis}</div>` : ''}

        <div class="rx-symbol">℞</div>

        ${
          rx?.type === 'paper_photo' && rx.photoBase64
            ? `<div style="text-align: center; margin: 20px 0;"><img src="${rx.photoBase64}" style="max-width: 100%; max-height: 480px; border-radius: 8px; border: 1px solid #cbd5e1;" /></div>`
            : `
          <table>
            <thead>
              <tr>
                <th>الدواء والعلاج</th>
                <th>الجرعة</th>
                <th>المواعيد</th>
                <th>المدة</th>
                <th>إرشادات</th>
              </tr>
            </thead>
            <tbody>
              ${medRows}
            </tbody>
          </table>
          `
        }

        ${rx?.notes ? `<div style="margin-top: 20px; padding: 10px; background: #fffbeb; border-radius: 6px; font-size: 13px; color: #92400e;"><strong>ملاحظات:</strong> ${rx.notes}</div>` : ''}

        <div class="footer">
          <div>نتمنى لكم دوام الصحة والعافية</div>
          <div class="signature">توقيع وخاتم الطبيب</div>
        </div>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  if (!isOpen) return null;

  const visits: PatientVisitEntry[] = medicalFile?.visits || [];
  const totalBilled = transactions.reduce((sum, tx) => sum + (Number(tx.totalAmount) || 0), 0);
  const totalPaid = transactions.reduce((sum, tx) => sum + (Number(tx.paidAmount) || 0), 0);
  const outstandingBalance = Math.max(0, totalBilled - totalPaid);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur-xs font-['Tajawal',sans-serif]">
        {/* Backdrop click to close */}
        <div className="absolute inset-0" onClick={onClose} />

        {/* Responsive Side Panel / Drawer */}
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 280 }}
          className="relative w-full sm:w-[680px] lg:w-[780px] h-full bg-white shadow-2xl flex flex-col z-10 overflow-hidden text-right border-l border-slate-200"
        >
          {/* Header */}
          <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between border-b border-slate-800 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-teal-500/20 text-teal-300 border border-teal-500/30 flex items-center justify-center shrink-0">
                <User className="w-6 h-6 text-teal-400" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base sm:text-lg font-bold text-white truncate max-w-[200px] sm:max-w-[280px]">
                    {medicalFile?.patientName || patientName}
                  </h2>
                  {medicalFile?.patientId && (
                    <span className="px-2 py-0.5 bg-slate-800 text-teal-300 text-[11px] font-mono font-bold rounded-lg border border-slate-700">
                      {medicalFile.patientId}
                    </span>
                  )}
                  {medicalFile?.age && (
                    <span className="text-xs text-slate-400">({medicalFile.age} سنة)</span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                  <span className="font-mono dir-ltr flex items-center gap-1 text-slate-300">
                    <Phone className="w-3.5 h-3.5 text-teal-400" />
                    {cleanPhone}
                  </span>
                  <span>•</span>
                  <span>{visits.length} زيارات مسجلة</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleOpenWhatsApp}
                title="مراسلة واتساب"
                className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Send className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">واتساب</span>
              </button>

              <button
                onClick={onClose}
                className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Navigation Tabs Bar */}
          <div className="bg-slate-50 border-b border-slate-200 px-3 py-2 flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar shrink-0">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === 'overview'
                  ? 'bg-white text-teal-700 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:bg-slate-200/60'
              }`}
            >
              <User className="w-4 h-4" />
              <span>نظرة عامة</span>
            </button>

            <button
              onClick={() => setActiveTab('consultation')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === 'consultation'
                  ? 'bg-white text-teal-700 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:bg-slate-200/60'
              }`}
            >
              <Stethoscope className="w-4 h-4" />
              <span>الكشف الحالي</span>
            </button>

            <button
              onClick={() => setActiveTab('prescriptions')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer relative ${
                activeTab === 'prescriptions'
                  ? 'bg-white text-teal-700 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:bg-slate-200/60'
              }`}
            >
              <Camera className="w-4 h-4" />
              <span>📄 الروشتات</span>
              {prescriptions.length > 0 && (
                <span className="w-4 h-4 rounded-full bg-teal-600 text-white text-[10px] flex items-center justify-center font-bold">
                  {prescriptions.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === 'history'
                  ? 'bg-white text-teal-700 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:bg-slate-200/60'
              }`}
            >
              <ClipboardList className="w-4 h-4" />
              <span>سجل الزيارات</span>
              {visits.length > 0 && (
                <span className="text-[10px] text-slate-400">({visits.length})</span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('payments')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === 'payments'
                  ? 'bg-white text-teal-700 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:bg-slate-200/60'
              }`}
            >
              <DollarSign className="w-4 h-4" />
              <span>المدفوعات</span>
              {outstandingBalance > 0 && (
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('growth')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === 'growth'
                  ? 'bg-white text-teal-700 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:bg-slate-200/60'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              <span>منحنى النمو</span>
            </button>
          </div>

          {/* Tab Content Area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            {loading ? (
              <div className="py-24 text-center">
                <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-xs text-slate-500 font-semibold">جارٍ تحميل الملف الطبي الشامل...</p>
              </div>
            ) : (
              <>
                {/* ======================================================== */}
                {/* 1. OVERVIEW TAB */}
                {/* ======================================================== */}
                {activeTab === 'overview' && (
                  <div className="space-y-6">
                    {/* Top KPI Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80">
                        <span className="text-[11px] font-bold text-slate-500 block mb-1">عدد الزيارات</span>
                        <div className="text-xl font-black text-slate-900">{visits.length}</div>
                      </div>

                      <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80">
                        <span className="text-[11px] font-bold text-slate-500 block mb-1">آخر زيارة</span>
                        <div className="text-sm font-bold text-slate-900 truncate">
                          {medicalFile?.lastVisitDate || (visits[0] ? visits[0].date : 'اليوم')}
                        </div>
                      </div>

                      <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80">
                        <span className="text-[11px] font-bold text-slate-500 block mb-1">إجمالي المدفوع</span>
                        <div className="text-base font-black text-emerald-700">{totalPaid} ج.م</div>
                      </div>

                      <div className={`p-3.5 rounded-2xl border ${
                        outstandingBalance > 0 ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-200/80'
                      }`}>
                        <span className="text-[11px] font-bold text-slate-500 block mb-1">المتبقي</span>
                        <div className={`text-base font-black ${
                          outstandingBalance > 0 ? 'text-rose-700' : 'text-slate-900'
                        }`}>
                          {outstandingBalance} ج.م
                        </div>
                      </div>
                    </div>

                    {/* Medical Alerts (Allergies & Chronic Diseases) */}
                    <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
                          <AlertTriangle className="w-4 h-4 text-amber-600" />
                          <span>التنبيهات والمحاذير الطبية</span>
                        </div>
                        <button
                          onClick={() => setIsEditingProfile(!isEditingProfile)}
                          className="text-xs font-bold text-amber-800 hover:text-amber-950 flex items-center gap-1 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>{isEditingProfile ? 'إلغاء التعديل' : 'تعديل البيانات'}</span>
                        </button>
                      </div>

                      {isEditingProfile ? (
                        <div className="space-y-3 pt-2">
                          <div>
                            <label className="text-xs font-bold text-slate-700 block mb-1">حساسية الأدوية والمواد:</label>
                            <input
                              type="text"
                              value={editAllergies}
                              onChange={(e) => setEditAllergies(e.target.value)}
                              placeholder="مثال: حساسية البنسلين، الأسبرين..."
                              className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-teal-500"
                            />
                          </div>

                          <div>
                            <label className="text-xs font-bold text-slate-700 block mb-1">الأمراض المزمنة:</label>
                            <input
                              type="text"
                              value={editChronicDiseases}
                              onChange={(e) => setEditChronicDiseases(e.target.value)}
                              placeholder="مثال: السكري، ضغط الدم، ربو شعبي..."
                              className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-teal-500"
                            />
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            <div>
                              <label className="text-xs font-bold text-slate-700 block mb-1">العمر:</label>
                              <input
                                type="number"
                                value={editAge}
                                onChange={(e) => setEditAge(e.target.value ? Number(e.target.value) : '')}
                                className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 text-xs"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-bold text-slate-700 block mb-1">النوع:</label>
                              <select
                                value={editGender}
                                onChange={(e) => setEditGender(e.target.value as any)}
                                className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 text-xs"
                              >
                                <option value="male">ذكر</option>
                                <option value="female">أنثى</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-xs font-bold text-slate-700 block mb-1">فصيلة الدم:</label>
                              <input
                                type="text"
                                value={editBloodGroup}
                                onChange={(e) => setEditBloodGroup(e.target.value)}
                                placeholder="A+, O-..."
                                className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 text-xs"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-xs font-bold text-slate-700 block mb-1">ملاحظات عامة:</label>
                            <textarea
                              rows={2}
                              value={editGeneralNotes}
                              onChange={(e) => setEditGeneralNotes(e.target.value)}
                              placeholder="أي ملاحظات خاصة بصحة المريض..."
                              className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-teal-500"
                            />
                          </div>

                          <div className="flex justify-end gap-2 pt-2">
                            <button
                              onClick={handleSaveProfile}
                              className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                            >
                              <Save className="w-3.5 h-3.5" />
                              <span>حفظ التعديلات</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          <div className="bg-white/80 p-3 rounded-xl border border-amber-200/80">
                            <span className="font-bold text-slate-700 block mb-0.5">الحساسية:</span>
                            <span className="text-slate-800">
                              {medicalFile?.allergies || 'لا توجد حساسية مسجلة'}
                            </span>
                          </div>
                          <div className="bg-white/80 p-3 rounded-xl border border-amber-200/80">
                            <span className="font-bold text-slate-700 block mb-0.5">الأمراض المزمنة:</span>
                            <span className="text-slate-800">
                              {medicalFile?.chronicDiseases || 'لا توجد أمراض مزمنة مسجلة'}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Vitals Summary Card */}
                    <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                          <Activity className="w-4 h-4 text-teal-600" />
                          <span>المؤشرات الحيوية الأخيرة</span>
                        </div>
                        <button
                          onClick={() => setActiveTab('consultation')}
                          className="text-xs font-bold text-teal-700 hover:text-teal-900 cursor-pointer"
                        >
                          تحديث في الكشف الحالي ←
                        </button>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                          <span className="text-[10px] text-slate-500 block mb-1 font-bold">ضغط الدم</span>
                          <span className="font-black text-slate-800 text-sm">
                            {vitalBpSystolic && vitalBpDiastolic
                              ? `${vitalBpSystolic}/${vitalBpDiastolic}`
                              : '—'}
                          </span>
                        </div>

                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                          <span className="text-[10px] text-slate-500 block mb-1 font-bold">النبض</span>
                          <span className="font-black text-slate-800 text-sm">
                            {vitalHeartRate ? `${vitalHeartRate} bpm` : '—'}
                          </span>
                        </div>

                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                          <span className="text-[10px] text-slate-500 block mb-1 font-bold">الحرارة</span>
                          <span className="font-black text-slate-800 text-sm">
                            {vitalTemp ? `${vitalTemp} °C` : '—'}
                          </span>
                        </div>

                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                          <span className="text-[10px] text-slate-500 block mb-1 font-bold">الوزن / BMI</span>
                          <span className="font-black text-slate-800 text-sm">
                            {vitalWeight ? `${vitalWeight} كجم` : '—'}
                            {calculatedBmi && (
                              <span className="text-[11px] block font-normal text-slate-500">
                                BMI: {calculatedBmi}
                              </span>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Quick Action Shortcuts */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      <button
                        onClick={() => setActiveTab('consultation')}
                        className="p-3.5 bg-teal-50 hover:bg-teal-100 text-teal-900 border border-teal-200 rounded-2xl font-bold text-xs flex flex-col items-center justify-center gap-1.5 transition cursor-pointer"
                      >
                        <Stethoscope className="w-5 h-5 text-teal-700" />
                        <span>بدء كشف طبي</span>
                      </button>

                      <button
                        onClick={() => {
                          setActiveTab('prescriptions');
                          if (fileInputRef.current) fileInputRef.current.click();
                        }}
                        className="p-3.5 bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 rounded-2xl font-bold text-xs flex flex-col items-center justify-center gap-1.5 transition cursor-pointer"
                      >
                        <Camera className="w-5 h-5 text-purple-700" />
                        <span>تصوير روشتة ورقية</span>
                      </button>

                      <button
                        onClick={() => setShowPaymentModal(true)}
                        className="p-3.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 rounded-2xl font-bold text-xs flex flex-col items-center justify-center gap-1.5 transition cursor-pointer col-span-2 sm:col-span-1"
                      >
                        <DollarSign className="w-5 h-5 text-emerald-700" />
                        <span>تسجيل دفعة نقدية</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* ======================================================== */}
                {/* 2. CONSULTATION TAB */}
                {/* ======================================================== */}
                {activeTab === 'consultation' && (
                  <form onSubmit={handleSaveConsultation} className="space-y-5">
                    {/* Visit Type Selector */}
                    <div className="flex items-center gap-2 p-1.5 bg-slate-100 rounded-xl">
                      <button
                        type="button"
                        onClick={() => setConsultVisitType('new_consultation')}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                          consultVisitType === 'new_consultation'
                            ? 'bg-white text-teal-700 shadow-xs'
                            : 'text-slate-600'
                        }`}
                      >
                        كشف جديد
                      </button>
                      <button
                        type="button"
                        onClick={() => setConsultVisitType('follow_up')}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                          consultVisitType === 'follow_up'
                            ? 'bg-white text-teal-700 shadow-xs'
                            : 'text-slate-600'
                        }`}
                      >
                        إعادة واستشارة
                      </button>
                    </div>

                    {/* Vitals Form Inputs */}
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                        <div className="flex items-center gap-1.5">
                          <Activity className="w-4 h-4 text-teal-600" />
                          <span>المؤشرات الحيوية للكشف الحالي</span>
                        </div>
                        {calculatedBmi && (
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                              getBmiCategory(calculatedBmi).color
                            }`}
                          >
                            BMI: {calculatedBmi} ({getBmiCategory(calculatedBmi).label})
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                        <div>
                          <label className="text-[11px] font-bold text-slate-600 block mb-1">الضغط (انقباضي):</label>
                          <input
                            type="text"
                            placeholder="120"
                            value={vitalBpSystolic}
                            onChange={(e) => setVitalBpSystolic(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white rounded-lg border border-slate-200 text-center font-mono"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-600 block mb-1">الضغط (انبساطي):</label>
                          <input
                            type="text"
                            placeholder="80"
                            value={vitalBpDiastolic}
                            onChange={(e) => setVitalBpDiastolic(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white rounded-lg border border-slate-200 text-center font-mono"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-600 block mb-1">النبض (HR):</label>
                          <input
                            type="number"
                            placeholder="75"
                            value={vitalHeartRate}
                            onChange={(e) => setVitalHeartRate(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white rounded-lg border border-slate-200 text-center font-mono"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-600 block mb-1">الحرارة (°C):</label>
                          <input
                            type="text"
                            placeholder="37.0"
                            value={vitalTemp}
                            onChange={(e) => setVitalTemp(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white rounded-lg border border-slate-200 text-center font-mono"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-600 block mb-1">الوزن (كجم):</label>
                          <input
                            type="number"
                            placeholder="70"
                            value={vitalWeight}
                            onChange={(e) => setVitalWeight(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white rounded-lg border border-slate-200 text-center font-mono"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-600 block mb-1">الطول (سم):</label>
                          <input
                            type="number"
                            placeholder="175"
                            value={vitalHeight}
                            onChange={(e) => setVitalHeight(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white rounded-lg border border-slate-200 text-center font-mono"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-600 block mb-1">السكر (mg/dL):</label>
                          <input
                            type="number"
                            placeholder="110"
                            value={vitalBloodSugar}
                            onChange={(e) => setVitalBloodSugar(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white rounded-lg border border-slate-200 text-center font-mono"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-600 block mb-1">الأكسجين (%):</label>
                          <input
                            type="number"
                            placeholder="98"
                            value={vitalSpO2}
                            onChange={(e) => setVitalSpO2(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white rounded-lg border border-slate-200 text-center font-mono"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Chief Complaint */}
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        الشكوى الرئيسية والأعراض:
                      </label>
                      <input
                        type="text"
                        value={consultChiefComplaint}
                        onChange={(e) => setConsultChiefComplaint(e.target.value)}
                        placeholder="مثال: ألم حاد في البطن منذ يومين مصحوب بحرارة..."
                        className="w-full px-3.5 py-2.5 bg-white rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-teal-500"
                      />
                    </div>

                    {/* Clinical Examination & Diagnosis */}
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        الفحص السريري والتشخيص الطبي <span className="text-rose-500">*</span>:
                      </label>
                      <textarea
                        rows={3}
                        required
                        value={consultDiagnosis}
                        onChange={(e) => setConsultDiagnosis(e.target.value)}
                        placeholder="كتابة التشخيص السريري، فحص الصدر أو البطن..."
                        className="w-full px-3.5 py-2.5 bg-white rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-teal-500 font-medium"
                      />
                    </div>

                    {/* Prescriptions Section in Consultation */}
                    <div className="p-4 bg-purple-50/50 rounded-2xl border border-purple-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-bold text-purple-900">
                          <Camera className="w-4 h-4 text-purple-700" />
                          <span>الروشتة العلاجية للكشف</span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                          >
                            <Camera className="w-3.5 h-3.5" />
                            <span>تصوير روشتة</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setActiveTab('prescriptions')}
                            className="px-2.5 py-1 bg-white hover:bg-purple-100 text-purple-800 border border-purple-300 rounded-lg text-[11px] font-bold transition cursor-pointer"
                          >
                            اختيار قالب
                          </button>
                        </div>
                      </div>

                      {/* Staged photo preview if captured */}
                      {stagedPhotoBase64 && (
                        <div className="p-3 bg-white rounded-xl border border-purple-200 flex items-center gap-3">
                          <img
                            src={stagedPhotoBase64}
                            alt="روشتة مصورة"
                            className="w-16 h-16 object-cover rounded-lg border border-slate-200 cursor-pointer"
                            onClick={() => setViewingPhotoUrl(stagedPhotoBase64)}
                          />
                          <div className="flex-1 min-w-0">
                            <span className="text-xs font-bold text-slate-800 block">
                              تم تصوير الروشتة بنجاح
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              الحجم: {stagedPhotoSizeKb} KB
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setStagedPhotoBase64(null)}
                            className="p-1 text-rose-500 hover:bg-rose-50 rounded-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}

                      {/* Medicines List Preview */}
                      {digitalMedicines.some((m) => m.name.trim().length > 0) && (
                        <div className="space-y-1.5 pt-1">
                          <span className="text-[11px] font-bold text-slate-700 block">الأدوية المحددة:</span>
                          {digitalMedicines
                            .filter((m) => m.name.trim().length > 0)
                            .map((m, idx) => (
                              <div
                                key={idx}
                                className="text-xs bg-white px-3 py-1.5 rounded-lg border border-purple-100 flex items-center justify-between"
                              >
                                <span className="font-bold text-slate-900">{m.name}</span>
                                <span className="text-slate-500 text-[11px]">
                                  {m.dosage} - {m.timing}
                                </span>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>

                    {/* Schedule Follow-up Appointment */}
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={consultScheduleFollowUp}
                          onChange={(e) => setConsultScheduleFollowUp(e.target.checked)}
                          className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500"
                        />
                        <span className="text-xs font-bold text-slate-800">
                          جدولة موعد استشارة / إعادة كشف
                        </span>
                      </label>

                      {consultScheduleFollowUp && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 text-xs">
                          <div>
                            <label className="font-bold text-slate-600 block mb-1">تاريخ الإعادة:</label>
                            <input
                              type="date"
                              value={consultFollowUpDate}
                              onChange={(e) => setConsultFollowUpDate(e.target.value)}
                              className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200"
                            />
                          </div>

                          <div>
                            <label className="font-bold text-slate-600 block mb-1">رسوم الإعادة (ج.م):</label>
                            <input
                              type="number"
                              value={consultFollowUpFee}
                              onChange={(e) => setConsultFollowUpFee(Number(e.target.value))}
                              className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200"
                            />
                          </div>

                          <div>
                            <label className="font-bold text-slate-600 block mb-1">سبب الاستشارة:</label>
                            <input
                              type="text"
                              value={consultFollowUpReason}
                              onChange={(e) => setConsultFollowUpReason(e.target.value)}
                              placeholder="متابعة التحاليل / السونار..."
                              className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Submit Consultation Action */}
                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={isSubmittingConsult}
                        className="w-full py-3.5 bg-teal-700 hover:bg-teal-800 active:scale-98 text-white rounded-2xl font-bold text-sm transition flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
                      >
                        {isSubmittingConsult ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>جارٍ حفظ الكشف والملف الطبي...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-5 h-5" />
                            <span>حفظ الكشف وإضافته للملف الطبي</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}

                {/* ======================================================== */}
                {/* 3. PRESCRIPTIONS TAB (PAPER PHOTO & DIGITAL TEMPLATES) */}
                {/* ======================================================== */}
                {activeTab === 'prescriptions' && (
                  <div className="space-y-6">
                    {/* Action Bar */}
                    <div className="p-4 bg-teal-50/70 border border-teal-200 rounded-2xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                      <div>
                        <h3 className="font-bold text-teal-950 text-sm">
                          📷 تصوير الروشتات الورقية وقوالب الأدوية
                        </h3>
                        <p className="text-xs text-teal-800/80 mt-0.5">
                          التقط صورة الروشتة المكتوبة باليد بضغطة زر وتُحفظ فورا بملف المريض.
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isCompressingPhoto}
                          className="px-4 py-2.5 bg-teal-700 hover:bg-teal-800 active:scale-95 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap"
                        >
                          <Camera className="w-4 h-4" />
                          <span>{isCompressingPhoto ? 'جارٍ الضغط...' : '📷 تصوير روشتة'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setShowTemplateModal(true)}
                          className="px-3 py-2.5 bg-white hover:bg-teal-100 text-teal-800 border border-teal-300 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                        >
                          <Plus className="w-4 h-4" />
                          <span>قالب جديد</span>
                        </button>
                      </div>
                    </div>

                    {/* Staged Photo Save Card */}
                    {stagedPhotoBase64 && (
                      <div className="p-4 bg-amber-50/60 rounded-2xl border-2 border-amber-300 space-y-3 animate-in fade-in zoom-in-95">
                        <div className="flex items-center justify-between text-xs font-bold text-amber-950">
                          <span>معاينة الروشتة المصورة قبل الحفظ</span>
                          <span className="px-2 py-0.5 bg-amber-200/80 rounded-md font-mono text-[10px]">
                            {stagedPhotoSizeKb} KB (أقل من 300KB)
                          </span>
                        </div>

                        <div className="flex flex-col sm:flex-row items-center gap-4">
                          <img
                            src={stagedPhotoBase64}
                            alt="معاينة الروشتة"
                            onClick={() => setViewingPhotoUrl(stagedPhotoBase64)}
                            className="w-full sm:w-36 h-48 object-cover rounded-xl border border-amber-300 shadow-xs cursor-pointer hover:opacity-90 transition"
                          />

                          <div className="flex-1 w-full space-y-2.5 text-xs">
                            <div>
                              <label className="font-bold text-slate-700 block mb-1">
                                التشخيص المصاحب للروشتة:
                              </label>
                              <input
                                type="text"
                                value={stagedPhotoDiagnosis}
                                onChange={(e) => setStagedPhotoDiagnosis(e.target.value)}
                                placeholder="مثال: التهاب حاد في الحلق..."
                                className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200"
                              />
                            </div>

                            <div>
                              <label className="font-bold text-slate-700 block mb-1">
                                ملاحظات إضافية أو تعليمات:
                              </label>
                              <input
                                type="text"
                                value={stagedPhotoNotes}
                                onChange={(e) => setStagedPhotoNotes(e.target.value)}
                                placeholder="تعليمات بعد الأكل، إعادة التحليل..."
                                className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200"
                              />
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-2">
                              <button
                                type="button"
                                onClick={() => setStagedPhotoBase64(null)}
                                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer"
                              >
                                إلغاء
                              </button>
                              <button
                                type="button"
                                disabled={isSavingPrescription}
                                onClick={handleSavePaperPrescription}
                                className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                              >
                                {isSavingPrescription ? (
                                  <>
                                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    <span>جارٍ الحفظ...</span>
                                  </>
                                ) : (
                                  <>
                                    <Save className="w-3.5 h-3.5" />
                                    <span>حفظ في ملف المريض</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Active Digital Prescription Review & Staging Card */}
                    {activePrescriptionReview && (
                      <div className="p-4 sm:p-5 bg-teal-50/80 rounded-2xl border-2 border-teal-500 shadow-sm space-y-4 animate-in fade-in zoom-in-95">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-teal-200/80 pb-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-teal-600 text-white flex items-center justify-center text-sm font-bold shadow-xs">
                              💊
                            </div>
                            <div>
                              <h4 className="font-bold text-sm text-teal-950">
                                مراجعة واعتماد الروشتة الرقمية
                              </h4>
                              <p className="text-[11px] text-teal-800">
                                قالب: <span className="font-bold text-teal-900">{activePrescriptionReview.templateTitle}</span> • المريض: <span className="font-bold text-teal-900">{medicalFile?.patientName || patientName}</span>
                              </p>
                            </div>
                          </div>
                          <span className="self-start sm:self-auto px-2.5 py-1 bg-teal-200/80 text-teal-900 rounded-lg text-[11px] font-bold">
                            مسودة قيد المراجعة قبل الحفظ
                          </span>
                        </div>

                        {/* Editable Diagnosis & Instructions */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          <div>
                            <label className="font-bold text-slate-700 block mb-1">
                              التشخيص الطبي المصاحب للروشتة:
                            </label>
                            <input
                              type="text"
                              value={activePrescriptionReview.diagnosis}
                              onChange={(e) =>
                                setActivePrescriptionReview({
                                  ...activePrescriptionReview,
                                  diagnosis: e.target.value
                                })
                              }
                              placeholder="مثال: التهاب حاد في المعدة، نزلة معوية..."
                              className="w-full px-3 py-2 bg-white rounded-xl border border-teal-300 focus:outline-none focus:ring-2 focus:ring-teal-500 font-bold text-slate-800"
                            />
                          </div>

                          <div>
                            <label className="font-bold text-slate-700 block mb-1">
                              تعليمات عامة للمريض:
                            </label>
                            <input
                              type="text"
                              value={activePrescriptionReview.notes}
                              onChange={(e) =>
                                setActivePrescriptionReview({
                                  ...activePrescriptionReview,
                                  notes: e.target.value
                                })
                              }
                              placeholder="مثال: تجنب الأطعمة الدسمة، راحة تامة..."
                              className="w-full px-3 py-2 bg-white rounded-xl border border-teal-300 focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-800"
                            />
                          </div>
                        </div>

                        {/* Medicines Review List */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-800">
                              الأدوية المدرجة بالروشتة ({activePrescriptionReview.medicines.length}):
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setActivePrescriptionReview({
                                  ...activePrescriptionReview,
                                  medicines: [
                                    ...activePrescriptionReview.medicines,
                                    { name: '', dosage: '', timing: '', duration: '', instructions: '' }
                                  ]
                                })
                              }
                              className="px-2.5 py-1 bg-white hover:bg-teal-100 text-teal-800 border border-teal-300 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition"
                            >
                              <Plus className="w-3 h-3" />
                              <span>إضافة دواء آخر</span>
                            </button>
                          </div>

                          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                            {activePrescriptionReview.medicines.map((med, idx) => (
                              <div
                                key={idx}
                                className="p-3 bg-white rounded-xl border border-teal-200 shadow-2xs space-y-2"
                              >
                                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center text-xs">
                                  <div className="sm:col-span-5">
                                    <label className="block text-[10px] font-bold text-slate-500 mb-0.5 sm:hidden">
                                      اسم الدواء
                                    </label>
                                    <input
                                      type="text"
                                      value={med.name}
                                      onChange={(e) => {
                                        const updated = [...activePrescriptionReview.medicines];
                                        updated[idx].name = e.target.value;
                                        setActivePrescriptionReview({ ...activePrescriptionReview, medicines: updated });
                                      }}
                                      placeholder="اسم الدواء / المادة الفعالة *"
                                      className="w-full px-2.5 py-1.5 bg-slate-50 rounded-lg border border-slate-200 font-bold text-slate-800 focus:bg-white"
                                    />
                                  </div>

                                  <div className="sm:col-span-3">
                                    <label className="block text-[10px] font-bold text-slate-500 mb-0.5 sm:hidden">
                                      الجرعة
                                    </label>
                                    <input
                                      type="text"
                                      value={med.dosage}
                                      onChange={(e) => {
                                        const updated = [...activePrescriptionReview.medicines];
                                        updated[idx].dosage = e.target.value;
                                        setActivePrescriptionReview({ ...activePrescriptionReview, medicines: updated });
                                      }}
                                      placeholder="الجرعة (مثال: 500mg)"
                                      className="w-full px-2.5 py-1.5 bg-slate-50 rounded-lg border border-slate-200 text-slate-800 focus:bg-white"
                                    />
                                  </div>

                                  <div className="sm:col-span-3">
                                    <label className="block text-[10px] font-bold text-slate-500 mb-0.5 sm:hidden">
                                      المواعيد والتكرار
                                    </label>
                                    <input
                                      type="text"
                                      value={med.timing}
                                      onChange={(e) => {
                                        const updated = [...activePrescriptionReview.medicines];
                                        updated[idx].timing = e.target.value;
                                        setActivePrescriptionReview({ ...activePrescriptionReview, medicines: updated });
                                      }}
                                      placeholder="المواعيد (مثال: 3 مرات بعد الأكل)"
                                      className="w-full px-2.5 py-1.5 bg-slate-50 rounded-lg border border-slate-200 text-slate-800 focus:bg-white"
                                    />
                                  </div>

                                  <div className="sm:col-span-1 flex justify-end">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updated = activePrescriptionReview.medicines.filter((_, i) => i !== idx);
                                        setActivePrescriptionReview({
                                          ...activePrescriptionReview,
                                          medicines: updated.length > 0 ? updated : [{ name: '', dosage: '', timing: '', duration: '', instructions: '' }]
                                        });
                                      }}
                                      className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer"
                                      title="حذف هذا الدواء"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Review Approval Actions */}
                        <div className="flex items-center justify-between pt-2 border-t border-teal-200/80">
                          <button
                            type="button"
                            onClick={() => setActivePrescriptionReview(null)}
                            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                          >
                            إلغاء المعاينة
                          </button>

                          <button
                            type="button"
                            disabled={isSavingDigitalPrescription}
                            onClick={handleSaveDigitalPrescription}
                            className="px-5 py-2.5 bg-teal-700 hover:bg-teal-800 active:scale-95 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
                          >
                            {isSavingDigitalPrescription ? (
                              <>
                                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                <span>جارٍ اعتماد وحفظ الروشتة...</span>
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="w-4 h-4" />
                                <span>اعتماد وحفظ الروشتة في ملف المريض</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Prescription Templates Picker */}
                    {templates.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-800">قوالب الروشتات الجاهزة:</span>
                          <span className="text-slate-500">{templates.length} قوالب متاحة</span>
                        </div>

                        <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
                          {templates.map((tpl) => (
                            <div
                              key={tpl.id}
                              className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs min-w-[200px] shrink-0 flex flex-col justify-between"
                            >
                              <div>
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-xs text-slate-900 truncate">
                                    {tpl.title}
                                  </span>
                                  <button
                                    onClick={() => handleDeleteTemplate(tpl.id)}
                                    className="text-slate-400 hover:text-rose-500"
                                    title="حذف القالب"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                                <span className="text-[10px] text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded font-bold mt-1 inline-block">
                                  {tpl.category || 'عام'}
                                </span>
                                <span className="text-[11px] text-slate-500 block mt-1">
                                  {tpl.medicines.length} أدوية
                                </span>
                              </div>

                              <button
                                onClick={() => handleApplyTemplate(tpl)}
                                className="mt-3 w-full py-1.5 bg-slate-100 hover:bg-teal-50 hover:text-teal-800 text-slate-700 font-bold text-xs rounded-lg transition cursor-pointer"
                              >
                                إدراج في الروشتة ←
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Prescriptions History List */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-slate-800 text-xs">
                          سجل الروشتات السابقة ({prescriptions.length}):
                        </h4>
                      </div>

                      {prescriptions.length === 0 ? (
                        <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                          <Camera className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-50" />
                          <p className="text-xs text-slate-500 font-bold">لا توجد روشتات مسجلة بعد لهذا المريض.</p>
                          <p className="text-[11px] text-slate-400 mt-1">
                            اضغط "📷 تصوير روشتة" لحفظ أول صورة روشتة ورقية.
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {prescriptions.map((rx) => (
                            <div
                              key={rx.id}
                              className="p-3.5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-xs transition space-y-3 flex flex-col justify-between"
                            >
                              <div>
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                                    {rx.type === 'paper_photo' ? '📷 روشتة ورقية' : '💊 روشتة رقمية'}
                                  </span>
                                  <span className="text-[10px] text-slate-500 font-mono">
                                    {rx.date}
                                  </span>
                                </div>

                                {rx.diagnosis && (
                                  <div className="text-xs text-slate-700 mt-1.5 font-bold">
                                    التشخيص: {rx.diagnosis}
                                  </div>
                                )}

                                {/* Paper Thumbnail */}
                                {rx.type === 'paper_photo' && rx.photoBase64 && (
                                  <div className="mt-2 relative group rounded-xl overflow-hidden border border-slate-200">
                                    <img
                                      src={rx.photoBase64}
                                      alt="روشتة المريض"
                                      className="w-full h-36 object-cover cursor-pointer group-hover:scale-105 transition duration-300"
                                      onClick={() => setViewingPhotoUrl(rx.photoBase64!)}
                                    />
                                    <div
                                      onClick={() => setViewingPhotoUrl(rx.photoBase64!)}
                                      className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-bold gap-1 cursor-pointer"
                                    >
                                      <Maximize2 className="w-4 h-4" />
                                      <span>تكبير وعرض كامل</span>
                                    </div>
                                  </div>
                                )}

                                {/* Digital Medicines List */}
                                {rx.type !== 'paper_photo' && rx.medicines && rx.medicines.length > 0 && (
                                  <div className="mt-2 space-y-1">
                                    {rx.medicines.map((m, idx) => (
                                      <div key={idx} className="text-xs text-slate-700">
                                        • <span className="font-bold">{m.name}</span> ({m.dosage} - {m.timing})
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {rx.notes && (
                                  <p className="text-[11px] text-slate-500 mt-1.5">{rx.notes}</p>
                                )}
                              </div>

                              <div className="flex items-center justify-between border-t border-slate-100 pt-2.5">
                                <button
                                  type="button"
                                  onClick={() => handlePrintPrescription(rx)}
                                  className="text-xs text-teal-700 hover:text-teal-900 font-bold flex items-center gap-1 cursor-pointer"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                  <span>طباعة الروشتة</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleDeletePrescription(rx.id)}
                                  className="text-xs text-rose-500 hover:text-rose-700 cursor-pointer p-1"
                                  title="حذف الروشتة"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ======================================================== */}
                {/* 4. INVESTIGATIONS TAB */}
                {/* ======================================================== */}
                {activeTab === 'investigations' && (
                  <div className="space-y-4">
                    <div className="p-4 bg-purple-50/70 border border-purple-200 rounded-2xl flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-xs text-purple-950">الفحوصات والأشعة والتحاليل</h4>
                        <p className="text-[11px] text-purple-800/80 mt-0.5">
                          سجل الفحوصات المعملية والأشعة التشخيصية المطلوبة للمريض.
                        </p>
                      </div>
                    </div>

                    <div className="p-6 text-center bg-slate-50 rounded-2xl border border-slate-200">
                      <FileSpreadsheet className="w-8 h-8 text-purple-600/50 mx-auto mb-2" />
                      <p className="text-xs text-slate-600 font-bold">
                        {patientRecord?.medicalOrderLabel
                          ? `طلب فحص معلق: ${patientRecord.medicalOrderLabel}`
                          : 'لا توجد فحوصات معملية مسجلة حالياً'}
                      </p>
                      {patientRecord?.medicalOrderLabel && (
                        <span className="inline-block mt-2 px-3 py-1 bg-purple-100 text-purple-800 text-xs font-bold rounded-lg border border-purple-200">
                          الحالة: قيد الانتظار في المعمل / مركز الأشعة
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* ======================================================== */}
                {/* 5. VISIT HISTORY TAB */}
                {/* ======================================================== */}
                {activeTab === 'history' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800">
                        الجدول الزمني للزيارات السابقة ({visits.length}):
                      </span>
                    </div>

                    {visits.length === 0 ? (
                      <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200">
                        <ClipboardList className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-50" />
                        <p className="text-xs text-slate-500 font-bold">لا توجد زيارات سابقة مسجلة.</p>
                      </div>
                    ) : (
                      <div className="space-y-3 relative before:absolute before:right-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
                        {visits.map((v, i) => (
                          <div key={v.id || i} className="relative pr-9">
                            <div className="absolute right-2.5 top-3.5 w-3.5 h-3.5 rounded-full bg-teal-600 ring-4 ring-white" />
                            <div className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-2xs space-y-2">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-bold text-slate-900">
                                  {v.visitType === 'follow_up' ? 'استشارة وإعادة' : 'كشف طبي'}
                                </span>
                                <span className="text-[11px] text-slate-500 font-mono flex items-center gap-1">
                                  <Calendar className="w-3.5 h-3.5 text-teal-600" />
                                  {v.date}
                                </span>
                              </div>

                              {v.diagnosis && (
                                <div className="text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                  <span className="font-bold text-slate-700 block mb-0.5">التشخيص:</span>
                                  <span className="text-slate-800">{v.diagnosis}</span>
                                </div>
                              )}

                              {v.prescription && (
                                <div className="text-xs bg-teal-50/50 p-2.5 rounded-xl border border-teal-100">
                                  <span className="font-bold text-teal-900 block mb-0.5">الروشتة:</span>
                                  <span className="text-teal-950 whitespace-pre-line">{v.prescription}</span>
                                </div>
                              )}

                              {v.notes && (
                                <p className="text-[11px] text-slate-500 italic">{v.notes}</p>
                              )}

                              {v.vitals && (
                                <div className="flex items-center gap-3 text-[11px] text-slate-500 border-t border-slate-100 pt-2 flex-wrap">
                                  {v.vitals.bloodPressure && <span>ضغط: {v.vitals.bloodPressure}</span>}
                                  {v.vitals.heartRate && <span>نبض: {v.vitals.heartRate}</span>}
                                  {v.vitals.temperature && <span>حرارة: {v.vitals.temperature}°C</span>}
                                  {v.vitals.weightKg && <span>وزن: {v.vitals.weightKg} كجم</span>}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ======================================================== */}
                {/* 6. PAYMENTS TAB */}
                {/* ======================================================== */}
                {activeTab === 'payments' && (
                  <div className="space-y-4">
                    {/* Financial Summary */}
                    <div className="grid grid-cols-3 gap-2.5 text-center">
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-500 block mb-0.5 font-bold">المطلوب</span>
                        <span className="font-black text-slate-900 text-sm">{totalBilled} ج.م</span>
                      </div>
                      <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                        <span className="text-[10px] text-emerald-700 block mb-0.5 font-bold">المدفوع</span>
                        <span className="font-black text-emerald-800 text-sm">{totalPaid} ج.م</span>
                      </div>
                      <div className={`p-3 rounded-xl border ${
                        outstandingBalance > 0 ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-200'
                      }`}>
                        <span className="text-[10px] text-slate-500 block mb-0.5 font-bold">المتبقي</span>
                        <span className={`font-black text-sm ${
                          outstandingBalance > 0 ? 'text-rose-700' : 'text-slate-900'
                        }`}>
                          {outstandingBalance} ج.م
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button
                        onClick={() => setShowPaymentModal(true)}
                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <Plus className="w-4 h-4" />
                        <span>تسجيل دفعة جديدة</span>
                      </button>
                    </div>

                    {/* Transactions list */}
                    <div className="space-y-2">
                      {transactions.length === 0 ? (
                        <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
                          لا توجد معاملات مالية مسجلة بعد.
                        </div>
                      ) : (
                        transactions.map((tx) => (
                          <div
                            key={tx.id}
                            className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between text-xs"
                          >
                            <div>
                              <div className="font-bold text-slate-900">{tx.serviceName || 'كشف عيادة'}</div>
                              <div className="text-[10px] text-slate-400 mt-0.5">{tx.date}</div>
                            </div>
                            <div className="text-left font-mono">
                              <div className="font-black text-emerald-700">+{tx.paidAmount} ج.م</div>
                              <span className="text-[10px] text-slate-400 uppercase">{tx.paymentMethod}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* ======================================================== */}
                {/* 7. GROWTH CHART TAB (PEDIATRIC & NUTRITION) */}
                {/* ======================================================== */}
                {activeTab === 'growth' && (
                  <div className="space-y-4">
                    <div className="p-4 bg-teal-50/70 border border-teal-200 rounded-2xl">
                      <h4 className="font-bold text-xs text-teal-950">
                        منحنى الوزن وتتبع النمو عبر الزيارات
                      </h4>
                      <p className="text-[11px] text-teal-800/80 mt-0.5">
                        رسم بياني تفاعلي يوضح تطور وزن وطول المريض عبر تواريخ الكشوفات السابقة.
                      </p>
                    </div>

                    {/* Interactive SVG Chart */}
                    {(() => {
                      const dataPoints = visits
                        .filter((v) => v.vitals && v.vitals.weightKg && v.vitals.weightKg > 0)
                        .map((v) => ({
                          date: v.date,
                          weight: v.vitals!.weightKg!,
                          height: v.vitals!.heightCm
                        }))
                        .reverse();

                      if (dataPoints.length < 2) {
                        return (
                          <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200">
                            <TrendingUp className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-50" />
                            <p className="text-xs text-slate-600 font-bold">
                              يتطلب منحنى النمو تسجيل قياسين على الأقل للوزن عبر زيارات المريض.
                            </p>
                            <p className="text-[11px] text-slate-400 mt-1">
                              أدخل الوزن في الكشف الحالي لتوليد المنحنى البياني التلقائي.
                            </p>
                          </div>
                        );
                      }

                      const minW = Math.min(...dataPoints.map((d) => d.weight)) * 0.9;
                      const maxW = Math.max(...dataPoints.map((d) => d.weight)) * 1.1;
                      const height = 180;
                      const width = 450;
                      const padding = 35;

                      const points = dataPoints.map((d, index) => {
                        const x =
                          padding +
                          (index / (dataPoints.length - 1)) * (width - 2 * padding);
                        const y =
                          height -
                          padding -
                          ((d.weight - minW) / (maxW - minW || 1)) *
                            (height - 2 * padding);
                        return { x, y, ...d };
                      });

                      const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(' ');

                      return (
                        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                          <svg
                            viewBox={`0 0 ${width} ${height}`}
                            className="w-full h-48 overflow-visible"
                          >
                            {/* Grid Lines */}
                            <line
                              x1={padding}
                              y1={height - padding}
                              x2={width - padding}
                              y2={height - padding}
                              stroke="#e2e8f0"
                              strokeWidth="1"
                            />
                            <line
                              x1={padding}
                              y1={padding}
                              x2={width - padding}
                              y2={padding}
                              stroke="#e2e8f0"
                              strokeWidth="1"
                              strokeDasharray="4 4"
                            />

                            {/* Trend Line */}
                            <polyline
                              fill="none"
                              stroke="#0f766e"
                              strokeWidth="3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              points={polylinePoints}
                            />

                            {/* Data Points */}
                            {points.map((p, idx) => (
                              <g key={idx}>
                                <circle
                                  cx={p.x}
                                  cy={p.y}
                                  r="5"
                                  fill="#0f766e"
                                  stroke="#ffffff"
                                  strokeWidth="2"
                                />
                                <text
                                  x={p.x}
                                  y={p.y - 10}
                                  textAnchor="middle"
                                  fontSize="10"
                                  fontWeight="bold"
                                  fill="#0f766e"
                                >
                                  {p.weight} kg
                                </text>
                                <text
                                  x={p.x}
                                  y={height - padding + 15}
                                  textAnchor="middle"
                                  fontSize="9"
                                  fill="#64748b"
                                >
                                  {p.date.slice(5)}
                                </text>
                              </g>
                            ))}
                          </svg>

                          <div className="flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-2">
                            <span>أدنى وزن: {Math.min(...dataPoints.map((d) => d.weight))} كجم</span>
                            <span>أعلى وزن: {Math.max(...dataPoints.map((d) => d.weight))} كجم</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Hidden File Input for Camera and Gallery */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handlePhotoSelected}
          />

          {/* Lightbox / Fullscreen Image Viewer Modal */}
          {viewingPhotoUrl && (
            <div
              className="fixed inset-0 z-60 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4"
              onClick={() => setViewingPhotoUrl(null)}
            >
              <div
                className="relative max-w-3xl max-h-[90vh] bg-slate-900 rounded-3xl overflow-hidden p-2 border border-slate-800 shadow-2xl flex flex-col items-center"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="w-full flex items-center justify-between p-3 text-white border-b border-slate-800">
                  <span className="text-xs font-bold text-teal-300">
                    روشتة ورقية - {medicalFile?.patientName || patientName}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handlePrintPrescription({
                        id: 'temp',
                        patientId: cleanPhone,
                        doctorId,
                        date: getTodayDateString(),
                        type: 'paper_photo',
                        photoBase64: viewingPhotoUrl,
                        createdAt: new Date().toISOString(),
                        createdByUid: doctorId
                      })}
                      className="px-3 py-1 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>طباعة</span>
                    </button>
                    <button
                      onClick={() => setViewingPhotoUrl(null)}
                      className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <div className="overflow-auto max-h-[75vh] p-2 flex items-center justify-center">
                  <img
                    src={viewingPhotoUrl}
                    alt="عرض الروشتة بالحجم الكامل"
                    className="max-w-full max-h-[72vh] object-contain rounded-xl"
                  />
                </div>
              </div>
            </div>
          )}

          {/* New Prescription Template Modal */}
          {showTemplateModal && (
            <div className="fixed inset-0 z-60 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 text-right space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="font-bold text-sm text-slate-900">إنشاء قالب روشتة جديد</h3>
                  <button
                    onClick={() => setShowTemplateModal(false)}
                    className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center text-xs"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">اسم القالب:</label>
                    <input
                      type="text"
                      value={newTemplateTitle}
                      onChange={(e) => setNewTemplateTitle(e.target.value)}
                      placeholder="مثال: بروتوكول نزلة معوية حادة"
                      className="w-full px-3 py-2 bg-slate-50 rounded-xl border border-slate-200"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">التصنيف الطبي:</label>
                    <input
                      type="text"
                      value={newTemplateCategory}
                      onChange={(e) => setNewTemplateCategory(e.target.value)}
                      placeholder="أطفال، باطنة، جلدية..."
                      className="w-full px-3 py-2 bg-slate-50 rounded-xl border border-slate-200"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">التشخيص الافتراضي:</label>
                    <input
                      type="text"
                      value={newTemplateDiagnosis}
                      onChange={(e) => setNewTemplateDiagnosis(e.target.value)}
                      placeholder="Gastroenteritis..."
                      className="w-full px-3 py-2 bg-slate-50 rounded-xl border border-slate-200"
                    />
                  </div>

                  {/* Medicines Rows in Template */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-700">قائمة الأدوية:</span>
                      <button
                        type="button"
                        onClick={() =>
                          setTemplateModalMedicines([
                            ...templateModalMedicines,
                            { name: '', dosage: '', timing: '', duration: '', instructions: '' }
                          ])
                        }
                        className="text-teal-700 hover:text-teal-900 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>إضافة دواء</span>
                      </button>
                    </div>

                    <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
                      {templateModalMedicines.map((m, idx) => (
                        <div key={idx} className="grid grid-cols-12 gap-1.5 items-center">
                          <input
                            type="text"
                            placeholder="اسم الدواء"
                            value={m.name}
                            onChange={(e) => {
                              const updated = [...templateModalMedicines];
                              updated[idx].name = e.target.value;
                              setTemplateModalMedicines(updated);
                            }}
                            className="col-span-5 px-2 py-1.5 bg-slate-50 rounded-lg border border-slate-200 text-xs"
                          />
                          <input
                            type="text"
                            placeholder="الجرعة"
                            value={m.dosage}
                            onChange={(e) => {
                              const updated = [...templateModalMedicines];
                              updated[idx].dosage = e.target.value;
                              setTemplateModalMedicines(updated);
                            }}
                            className="col-span-3 px-2 py-1.5 bg-slate-50 rounded-lg border border-slate-200 text-xs"
                          />
                          <input
                            type="text"
                            placeholder="المواعيد"
                            value={m.timing}
                            onChange={(e) => {
                              const updated = [...templateModalMedicines];
                              updated[idx].timing = e.target.value;
                              setTemplateModalMedicines(updated);
                            }}
                            className="col-span-3 px-2 py-1.5 bg-slate-50 rounded-lg border border-slate-200 text-xs"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setTemplateModalMedicines(templateModalMedicines.filter((_, i) => i !== idx))
                            }
                            className="col-span-1 text-slate-400 hover:text-rose-500 flex justify-center"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowTemplateModal(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateTemplate}
                    className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs"
                  >
                    حفظ القالب
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Quick Payment Modal */}
          {showPaymentModal && (
            <div className="fixed inset-0 z-60 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
              <form
                onSubmit={handleRecordPayment}
                className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-right space-y-4"
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="font-bold text-sm text-slate-900">تسجيل دفعة جديدة</h3>
                  <button
                    type="button"
                    onClick={() => setShowPaymentModal(false)}
                    className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center text-xs"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">المبلغ (ج.م):</label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 text-sm font-bold text-emerald-800"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">طريقة الدفع:</label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as any)}
                      className="w-full px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 font-bold"
                    >
                      <option value="CASH">نقداً (Cash)</option>
                      <option value="CARD">بطاقة / فيزا (Card)</option>
                      <option value="WALLET">محفظة إلكترونية (فودافون كاش / إنستاباي)</option>
                      <option value="TRANSFER">تحويل بنكي</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">ملاحظات الإيصال:</label>
                    <input
                      type="text"
                      value={paymentNotes}
                      onChange={(e) => setPaymentNotes(e.target.value)}
                      placeholder="رسوم كشف / متابعة..."
                      className="w-full px-3 py-2 bg-slate-50 rounded-xl border border-slate-200"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowPaymentModal(false)}
                    className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingPayment}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs"
                  >
                    {isSubmittingPayment ? 'جارٍ التسجيل...' : 'تأكيد التحصيل'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
