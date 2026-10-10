import React, { useEffect, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { X, Camera, Search, UserCheck, Phone, Hash } from 'lucide-react';
import { PatientRecord } from '../types';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  patients: PatientRecord[];
  onSelectPatient: (patient: PatientRecord) => void;
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({
  isOpen,
  onClose,
  patients,
  onSelectPatient
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [scanResult, setScanResult] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    let scanner: Html5QrcodeScanner | null = null;
    const element = document.getElementById('qr-reader');

    if (element) {
      try {
        scanner = new Html5QrcodeScanner(
          'qr-reader',
          { fps: 10, qrbox: { width: 220, height: 220 } },
          /* verbose= */ false
        );

        scanner.render(
          (decodedText) => {
            setScanResult(decodedText);
            if (scanner) scanner.clear().catch(console.error);
          },
          (errorMessage) => {
            // handle scan error silently
          }
        );
      } catch (e) {
        console.warn("Failed to initialize camera scanner", e);
      }
    }

    return () => {
      if (scanner) {
        scanner.clear().catch(console.error);
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Search filtered patients
  const filteredPatients = patients.filter(p => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;
    return (
      p.name.toLowerCase().includes(term) ||
      p.phone.includes(term) ||
      p.sequenceNumber.toString() === term ||
      p.id === term
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 left-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
            <Camera className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 font-['Tajawal',sans-serif]">
              ماسح التذاكر والبحث المباشر
            </h3>
            <p className="text-xs text-slate-500">
              امسح تذكرة المريض أو ابحث برقم الدور/الموبايل/الاسم
            </p>
          </div>
        </div>

        {/* Camera Scanner View */}
        <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200 mb-4 overflow-hidden">
          <div id="qr-reader" className="w-full rounded-xl overflow-hidden"></div>
          {scanResult && (
            <div className="mt-2 text-xs bg-emerald-50 text-emerald-800 p-2 rounded-lg font-mono text-center">
              تم العثور على التذكرة: {scanResult}
            </div>
          )}
        </div>

        {/* Manual Search */}
        <div className="relative mb-3">
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ابحث برقم الموبايل أو الاسم أو رقم الدور (#)..."
            className="w-full pl-4 pr-10 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-sky-500 font-medium"
          />
        </div>

        {/* Patient List Results */}
        <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
          {filteredPatients.length === 0 ? (
            <div className="text-center py-6 text-slate-400 text-xs">
              لا توجد نتائج مطابقة للبحث
            </div>
          ) : (
            filteredPatients.map((p) => (
              <div
                key={p.id}
                onClick={() => {
                  onSelectPatient(p);
                  onClose();
                }}
                className="flex items-center justify-between p-3 bg-slate-50 hover:bg-sky-50/70 border border-slate-200/70 hover:border-sky-300 rounded-xl cursor-pointer transition group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-sky-600 text-white font-extrabold text-sm flex items-center justify-center shrink-0">
                    #{p.sequenceNumber}
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 text-xs sm:text-sm font-['Tajawal',sans-serif]">
                      {p.name}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3 text-slate-400" />
                        {p.phone}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                    p.status === 'called' ? 'bg-amber-100 text-amber-800' :
                    p.status === 'done' ? 'bg-emerald-100 text-emerald-800' :
                    p.status === 'waiting' ? 'bg-sky-100 text-sky-800' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {p.status === 'called' ? 'في الكشف' :
                     p.status === 'done' ? 'مكتمل' :
                     p.status === 'waiting' ? 'في الانتظار' : 'ملغي'}
                  </span>
                  <UserCheck className="w-4 h-4 text-slate-400 group-hover:text-sky-600" />
                </div>
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
};
