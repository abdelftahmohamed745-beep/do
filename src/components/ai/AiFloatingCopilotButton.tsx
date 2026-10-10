import React from 'react';
import { Bot, X } from 'lucide-react';

interface AiFloatingCopilotButtonProps {
  onClick: () => void;
  isOpen: boolean;
  unreadCount?: number;
}

export const AiFloatingCopilotButton: React.FC<AiFloatingCopilotButtonProps> = ({
  onClick,
  isOpen,
  unreadCount = 0
}) => {
  return (
    <div className="fixed bottom-20 left-4 sm:bottom-24 sm:left-6 z-40 flex items-center gap-2 group">
      {/* Tooltip Label on hover */}
      <div className="hidden sm:block opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-[#122c4a] text-white text-xs font-bold py-1.5 px-3 rounded-xl shadow-lg border border-slate-700 pointer-events-none select-none">
        <span>المساعد الذكي</span>
      </div>

      <button
        onClick={onClick}
        className={`relative w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-xl cursor-pointer ${
          isOpen
            ? 'bg-slate-900 text-white rotate-90 scale-95 ring-4 ring-slate-800/50'
            : 'bg-[#122c4a] hover:bg-[#0d223a] text-white hover:scale-105 hover:shadow-2xl ring-4 ring-[#122c4a]/20 border border-slate-700'
        }`}
        title="فتح المساعد الذكي"
        aria-label="المساعد الذكي"
      >
        {isOpen ? (
          <X className="w-6 h-6 text-white" />
        ) : (
          <>
            <Bot className="w-6 h-6 text-emerald-400 transition-transform group-hover:scale-110" />
            
            {/* Status indicator dot */}
            <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-white" />
            </span>

            {unreadCount > 0 && (
              <span className="absolute -bottom-1 -left-1 bg-rose-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-xs">
                {unreadCount}
              </span>
            )}
          </>
        )}
      </button>
    </div>
  );
};
