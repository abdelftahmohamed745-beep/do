import React, { useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Printer, Download, Copy, Check, QrCode, Smartphone } from 'lucide-react';
import { DoctorProfile } from '../types';

interface QRModalProps {
  isOpen: boolean;
  onClose: () => void;
  doctor: DoctorProfile;
  onCopyLink: () => void;
}

export const QRModal: React.FC<QRModalProps> = ({
  isOpen,
  onClose,
  doctor,
  onCopyLink
}) => {
  const [copied, setCopied] = React.useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const bookingUrl = `${window.location.origin}/clinic/${doctor.uid}/book`;

  const handleCopy = () => {
    navigator.clipboard.writeText(bookingUrl);
    setCopied(true);
    onCopyLink();
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPNG = () => {
    const svgElement = qrRef.current?.querySelector('svg');
    if (!svgElement) return;

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      canvas.width = 1000;
      canvas.height = 1000;
      if (ctx) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 100, 100, 800, 800);
        
        const pngUrl = canvas.toDataURL('image/png');
        const downloadLink = document.createElement('a');
        downloadLink.href = pngUrl;
        downloadLink.download = `QR-Dawry-${doctor.name.replace(/\s+/g, '-')}.png`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
      }
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative bg-[#fdfcf9] rounded-3xl max-w-md w-full p-4 sm:p-6 md:p-8 shadow-2xl border border-[#e7e3da] text-center animate-in fade-in zoom-in-95 duration-200 my-4 max-h-[92vh] overflow-y-auto">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3 left-3 sm:top-4 sm:left-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center"
          aria-label="إغلاق"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex justify-center mb-3">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center bg-[#eef7f4] text-[#143d30] border border-[#c4e5db]">
            <QrCode className="w-5 h-5 sm:w-6 sm:h-6 text-[#1c5242]" />
          </div>
        </div>

        <h3 className="text-lg sm:text-xl font-bold text-slate-900 font-['Tajawal',sans-serif]">
          رمز QR الخاص بالعيادة
        </h3>
        <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
          اطبع هذا الرمز وضعه في صالة الانتظار ليتمكن المرضى من مسحه وحجز دورهم فورًا
        </p>

        {/* Printable Poster Container */}
        <div className="mt-5 p-3.5 sm:p-6 rounded-2xl border border-[#c4e5db] shadow-xs flex flex-col items-center bg-[#faf8f5] w-full" id="printable-qr-poster">
          
          <div className="text-[11px] sm:text-xs font-bold uppercase tracking-widest mb-1 text-[#1c5242]">
            نظام تشغيل العيادات — دوري
          </div>
          <div className="font-extrabold text-base sm:text-lg text-slate-900 font-['Tajawal',sans-serif] px-2 truncate max-w-full">
            {doctor.clinicName}
          </div>
          <div className="text-xs font-semibold text-slate-600 mb-3 sm:mb-4 px-2 truncate max-w-full">
            {doctor.name} - {doctor.specialty}
          </div>

          {/* QR Code Graphic (Responsive container) */}
          <div ref={qrRef} className="p-3 sm:p-4 bg-white rounded-2xl shadow-md border border-[#e7e3da] flex items-center justify-center max-w-[220px] w-full">
            <QRCodeSVG
              value={bookingUrl}
              size={180}
              level="H"
              includeMargin={true}
              className="w-full h-auto max-w-[190px] sm:max-w-[200px]"
            />
          </div>

          <div className="mt-3.5 sm:mt-4 text-[11px] sm:text-xs font-bold text-slate-800 bg-white px-3 sm:px-4 py-1.5 rounded-full border border-[#e7e3da] shadow-2xs flex items-center gap-1.5 justify-center max-w-full">
            <Smartphone className="w-3.5 h-3.5 text-[#1c5242] shrink-0" />
            <span className="truncate">امسح الرمز بموبايلك لحجز دورك مباشرة</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-5 sm:mt-6 space-y-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
            <button
              onClick={handlePrint}
              className="flex items-center justify-center gap-2 py-2.5 px-3 bg-[#122c4a] hover:bg-[#0d223a] text-white font-semibold text-xs sm:text-sm rounded-xl transition shadow-xs cursor-pointer min-h-[42px]"
            >
              <Printer className="w-4 h-4 text-sky-400 shrink-0" />
              <span>طباعة الرمز</span>
            </button>

            <button
              onClick={handleDownloadPNG}
              className="flex items-center justify-center gap-2 py-2.5 px-3 bg-[#1c5242] hover:bg-[#143d30] text-white font-semibold text-xs sm:text-sm rounded-xl transition shadow-xs cursor-pointer min-h-[42px]"
            >
              <Download className="w-4 h-4 shrink-0" />
              <span>تحميل صورة PNG</span>
            </button>
          </div>

          {/* Copy Direct Link */}
          <button
            onClick={handleCopy}
            className="w-full flex items-center justify-between py-2.5 px-3 sm:px-4 bg-[#faf8f5] hover:bg-[#f4efe6] text-slate-700 font-medium text-xs rounded-xl transition border border-[#e7e3da] cursor-pointer min-h-[42px]"
          >
            <span className="truncate max-w-[160px] sm:max-w-[240px] dir-ltr text-slate-500 font-mono text-[11px]">
              {bookingUrl}
            </span>
            <div className="flex items-center gap-1.5 shrink-0 text-[#143d30] font-semibold text-xs">
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'تم النسخ' : 'نسخ الرابط'}</span>
            </div>
          </button>
        </div>

      </div>
    </div>
  );
};
