import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertCircle, Info, XCircle, X } from 'lucide-react';
import { ToastMessage } from '../types';

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  return (
    <div className="fixed top-5 left-4 sm:left-6 z-50 flex flex-col gap-2 max-w-md w-full pointer-events-none px-4 sm:px-0">
      <AnimatePresence>
        {toasts.map((toast) => {
          let bgColor = 'bg-slate-900 text-white';
          let icon = <Info className="w-5 h-5 text-sky-400 shrink-0" />;

          if (toast.type === 'success') {
            bgColor = 'bg-emerald-950/90 border border-emerald-500/30 text-emerald-100 shadow-lg shadow-emerald-950/20';
            icon = <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />;
          } else if (toast.type === 'error') {
            bgColor = 'bg-rose-950/90 border border-rose-500/30 text-rose-100 shadow-lg shadow-rose-950/20';
            icon = <XCircle className="w-5 h-5 text-rose-400 shrink-0" />;
          } else if (toast.type === 'warning') {
            bgColor = 'bg-amber-950/90 border border-amber-500/30 text-amber-100 shadow-lg shadow-amber-950/20';
            icon = <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />;
          }

          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className={`pointer-events-auto rounded-xl p-4 flex items-start gap-3 backdrop-blur-md ${bgColor}`}
            >
              {icon}
              <div className="flex-1 text-sm font-medium">
                <div className="font-semibold text-base">{toast.title}</div>
                {toast.message && <div className="mt-0.5 opacity-90 text-xs sm:text-sm">{toast.message}</div>}
              </div>
              <button
                onClick={() => onDismiss(toast.id)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition"
                aria-label="إغلاق"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
