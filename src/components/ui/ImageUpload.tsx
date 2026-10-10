import React, { useRef, useState } from 'react';
import { Upload, X, RefreshCw, Image as ImageIcon, AlertCircle } from 'lucide-react';
import { processAndCompressImage } from '../../utils/imageCompressor';

interface ImageUploadProps {
  id?: string;
  label?: string;
  helperText?: string;
  currentImageUrl?: string;
  onChange: (dataUrl: string) => void;
  onRemove?: () => void;
  variant?: 'avatar' | 'card' | 'banner';
  maxDimension?: number;
  quality?: number;
}

export const ImageUpload: React.FC<ImageUploadProps> = ({
  id,
  label,
  helperText,
  currentImageUrl,
  onChange,
  onRemove,
  variant = 'avatar',
  maxDimension = 800,
  quality = 0.82
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setErrorMsg(null);
    setProcessing(true);
    try {
      const processed = await processAndCompressImage(file, maxDimension, quality);
      onChange(processed.dataUrl);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'فشل رفع الصورة';
      setErrorMsg(message);
    } finally {
      setProcessing(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      handleFile(files[0]);
    }
    // reset input so selecting the same file triggers onChange
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleFile(files[0]);
    }
  };

  const triggerUpload = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-xs font-bold text-slate-700">
          {label}
        </label>
      )}

      <input
        ref={fileInputRef}
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/jpg"
        onChange={handleInputChange}
        className="hidden"
      />

      {currentImageUrl ? (
        <div className="flex items-center gap-3">
          {variant === 'avatar' ? (
            <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border-2 border-sky-500 shadow-sm shrink-0 bg-slate-100">
              <img
                src={currentImageUrl}
                alt="الصورة الحالية"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
          ) : (
            <div className="relative w-full h-32 rounded-2xl overflow-hidden border-2 border-sky-500 shadow-sm bg-slate-100">
              <img
                src={currentImageUrl}
                alt="الصورة الحالية"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5 flex-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={triggerUpload}
                disabled={processing}
                className="px-3 py-1.5 bg-[#edf3fa] hover:bg-[#dce7f3] text-[#1b3a5c] text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${processing ? 'animate-spin' : ''}`} />
                <span>{processing ? 'جاري المعالجة...' : 'استبدال الصورة'}</span>
              </button>

              {onRemove && (
                <button
                  type="button"
                  onClick={onRemove}
                  className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                  title="حذف الصورة"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <span className="text-[10px] text-emerald-600 font-medium">✓ تم رفع ومعالجة الصورة بنجاح</span>
          </div>
        </div>
      ) : (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={triggerUpload}
          className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2 ${
            isDragging
              ? 'border-sky-500 bg-sky-50'
              : 'border-slate-300 hover:border-sky-400 bg-slate-50/70 hover:bg-sky-50/30'
          }`}
        >
          <div className="w-10 h-10 rounded-xl bg-white text-sky-600 flex items-center justify-center shadow-xs border border-slate-200">
            {processing ? (
              <RefreshCw className="w-5 h-5 animate-spin text-sky-600" />
            ) : (
              <Upload className="w-5 h-5" />
            )}
          </div>

          <div>
            <span className="text-xs font-bold text-slate-800 block">
              {processing ? 'جاري ضغط ومعالجة الصورة...' : 'اضغط لاختيار صورة من جهازك'}
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              JPG, PNG, WEBP (يتم الضغط الذكي تلقائياً)
            </span>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="flex items-center gap-1.5 text-rose-600 text-xs mt-1">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {helperText && !errorMsg && (
        <p className="text-[10px] text-slate-500">{helperText}</p>
      )}
    </div>
  );
};
