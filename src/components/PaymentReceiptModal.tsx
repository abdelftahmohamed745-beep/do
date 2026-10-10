import React from 'react';
import { ClinicTransaction, DoctorProfile } from '../types';

interface PaymentReceiptModalProps {
  transaction: ClinicTransaction | null;
  doctor: DoctorProfile | null;
  onClose: () => void;
}

export const PaymentReceiptModal: React.FC<PaymentReceiptModalProps> = ({
  transaction,
  doctor,
  onClose
}) => {
  if (!transaction) return null;

  const handlePrint = () => {
    window.print();
  };

  const getStatusBadge = () => {
    switch (transaction.paymentStatus) {
      case 'PAID':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <span className="text-xs font-bold leading-none inline-flex items-center justify-center">✓</span>
            <span>مدفوع بالكامل</span>
          </span>
        );
      case 'PARTIAL':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
            <span className="text-xs leading-none inline-flex items-center justify-center">⏰</span>
            <span>مدفوع جزئياً (مستحق)</span>
          </span>
        );
      case 'UNPAID':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
            <span className="text-xs leading-none inline-flex items-center justify-center">⚠️</span>
            <span>غير مدفوع</span>
          </span>
        );
      case 'REFUNDED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-300">
            <span className="text-xs leading-none inline-flex items-center justify-center">🔄</span>
            <span>مبلغ مسترد (ملغاة)</span>
          </span>
        );
      default:
        return null;
    }
  };

  const getMethodLabel = (method: string) => {
    switch (method) {
      case 'CASH': return 'نقداً (كاش)';
      case 'CARD': return 'بطاقة ائتمان / فيزا';
      case 'BANK_TRANSFER': return 'تحويل بنكي / فودافون كاش';
      case 'OTHER': return 'طريقة أخرى';
      default: return method;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 border border-slate-200 shadow-2xl relative font-['Tajawal',sans-serif]">
        
        {/* Print controls - hidden when printing */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6 print:hidden">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
              <span className="text-lg leading-none inline-flex items-center justify-center">🧾</span>
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">إيصال سداد رسوم كشف</h3>
              <p className="text-xs text-slate-500">رقم المعاملة: {transaction.id}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
            >
              <span className="text-sm leading-none inline-flex items-center justify-center">🖨️</span>
              <span>طباعة</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition cursor-pointer"
            >
              <span className="text-base font-bold select-none leading-none">✕</span>
            </button>
          </div>
        </div>

        {/* RECEIPT CONTENT AREA FOR PRINT */}
        <div id="printable-receipt" className="space-y-6">
          
          {/* Clinic Header */}
          <div className="text-center border-b border-dashed border-slate-200 pb-5">
            <h2 className="text-xl font-black text-slate-900">
              {doctor?.clinicName || "عيادة دكتوري الطبية"}
            </h2>
            <p className="text-xs text-sky-600 font-bold mt-1">
              {doctor?.name ? `د. ${doctor.name}` : ''} {doctor?.specialty ? `- ${doctor.specialty}` : ''}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              تاريخ الإيصال: {new Date(transaction.createdAt).toLocaleString('ar-EG')}
            </p>
          </div>

          {/* Status Banner */}
          <div className="flex justify-center">
            {getStatusBadge()}
          </div>

          {/* Details Table */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-3 text-xs">
            
            <div className="flex justify-between items-center py-1 border-b border-slate-200/50">
              <span className="text-slate-500 font-medium">اسم المريض:</span>
              <span className="font-extrabold text-slate-900">{transaction.patientName}</span>
            </div>

            {transaction.patientPhone && (
              <div className="flex justify-between items-center py-1 border-b border-slate-200/50">
                <span className="text-slate-500 font-medium">رقم الهاتف:</span>
                <span className="font-bold text-slate-800 dir-ltr">{transaction.patientPhone}</span>
              </div>
            )}

            <div className="flex justify-between items-center py-1 border-b border-slate-200/50">
              <span className="text-slate-500 font-medium">الخدمة المطلوبة:</span>
              <span className="font-extrabold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                {transaction.serviceName}
              </span>
            </div>

            <div className="flex justify-between items-center py-1 border-b border-slate-200/50">
              <span className="text-slate-500 font-medium">طريقة الدفع:</span>
              <span className="font-bold text-slate-800">{getMethodLabel(transaction.paymentMethod)}</span>
            </div>

            {transaction.createdByName && (
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500 font-medium">محرر الإيصال:</span>
                <span className="font-medium text-slate-700">{transaction.createdByName}</span>
              </div>
            )}
          </div>

          {/* Financial Breakdown Card */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-5 text-white space-y-2.5 shadow-md">
            <div className="flex justify-between text-xs text-slate-300">
              <span>إجمالي رسوم الخدمة:</span>
              <span className="font-bold">{transaction.totalAmount} جنيه</span>
            </div>

            <div className="flex justify-between text-sm font-bold text-emerald-400">
              <span>المبلغ المدفوع:</span>
              <span className="font-black text-base">{transaction.paidAmount} جنيه</span>
            </div>

            <div className="pt-2 border-t border-slate-700 flex justify-between text-xs text-slate-300">
              <span>المبلغ المتبقي المستحق:</span>
              <span className={`font-bold ${transaction.remainingAmount > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                {transaction.remainingAmount} جنيه
              </span>
            </div>
          </div>

          {/* Refund Details Warning if applicable */}
          {transaction.paymentStatus === 'REFUNDED' && transaction.refundDetails && (
            <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 text-xs text-purple-900 space-y-1">
              <div className="font-bold flex items-center gap-1 text-purple-800">
                <span className="text-sm leading-none inline-flex items-center justify-center">🔄</span>
                <span>تم استرداد مبلغ المعاملة</span>
              </div>
              <div>مبلغ الاسترداد: {transaction.refundDetails.refundAmount} جنيه</div>
              <div>سبب الاسترداد: {transaction.refundDetails.reason}</div>
              <div className="text-[10px] text-purple-600">
                بتاريخ: {new Date(transaction.refundDetails.refundedAt).toLocaleString('ar-EG')} بواسطة {transaction.refundDetails.refundedByName}
              </div>
            </div>
          )}

          {/* Notes if present */}
          {transaction.notes && (
            <div className="text-xs text-slate-500 bg-amber-50/60 p-3 rounded-xl border border-amber-200/60">
              <span className="font-bold text-amber-900">ملاحظات: </span>
              <span>{transaction.notes}</span>
            </div>
          )}

          {/* Footer note */}
          <div className="text-center text-[10px] text-slate-400 pt-3 border-t border-slate-100">
            شكرًا لزيارتكم - هذا إيصال إلكتروني صادر من نظام دكتوري المالي
          </div>

        </div>

      </div>
    </div>
  );
};
