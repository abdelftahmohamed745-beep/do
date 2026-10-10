import React, { useState, useEffect } from 'react';
import {
  X,
  Bell,
  Megaphone,
  Sparkles,
  AlertTriangle,
  Wrench,
  Rocket,
  CheckCheck,
  ExternalLink,
  Info,
  Clock,
  ChevronLeft
} from 'lucide-react';
import { AdminAnnouncement, AnnouncementType } from '../types';

interface NotificationCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  announcements: AdminAnnouncement[];
  readAnnouncementIds: string[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
}

export const NotificationCenterModal: React.FC<NotificationCenterModalProps> = ({
  isOpen,
  onClose,
  announcements,
  readAnnouncementIds,
  onMarkAsRead,
  onMarkAllAsRead
}) => {
  const [filter, setFilter] = useState<'all' | 'unread' | 'updates' | 'warnings'>('all');

  if (!isOpen) return null;

  const unreadCount = announcements.filter(a => !readAnnouncementIds.includes(a.id)).length;

  const filteredAnnouncements = announcements.filter((ann) => {
    const isUnread = !readAnnouncementIds.includes(ann.id);
    if (filter === 'unread') return isUnread;
    if (filter === 'updates') return ann.type === 'update' || ann.type === 'feature';
    if (filter === 'warnings') return ann.type === 'warning' || ann.type === 'maintenance';
    return true;
  });

  const getAnnouncementBadge = (type: AnnouncementType) => {
    switch (type) {
      case 'update':
        return {
          icon: Rocket,
          label: 'تحديث نظام',
          bg: 'bg-indigo-50 text-indigo-700 border-indigo-200'
        };
      case 'feature':
      case 'new_feature':
        return {
          icon: Sparkles,
          label: 'ميزة جديدة',
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-200'
        };
      case 'warning':
        return {
          icon: AlertTriangle,
          label: 'تنبيه هام',
          bg: 'bg-amber-50 text-amber-800 border-amber-200'
        };
      case 'maintenance':
        return {
          icon: Wrench,
          label: 'صيانة مجدولة',
          bg: 'bg-rose-50 text-rose-700 border-rose-200'
        };
      default:
        return {
          icon: Megaphone,
          label: 'إعلان عام',
          bg: 'bg-sky-50 text-sky-700 border-sky-200'
        };
    }
  };

  const formatRelativeTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMinutes / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMinutes < 1) return 'الآن';
      if (diffMinutes < 60) return `منذ ${diffMinutes} دقيقة`;
      if (diffHours < 24) return `منذ ${diffHours} ساعة`;
      if (diffDays === 1) return 'أمس';
      if (diffDays < 7) return `منذ ${diffDays} أيام`;
      return date.toLocaleDateString('ar-EG');
    } catch {
      return '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative bg-white rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl border border-slate-100 text-right animate-in fade-in zoom-in-95 duration-200 my-8 max-h-[85vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-50 text-purple-700 rounded-2xl border border-purple-200 relative">
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-600 text-white rounded-full text-[10px] font-bold flex items-center justify-center border-2 border-white">
                  {unreadCount}
                </span>
              )}
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 font-['Tajawal',sans-serif]">
                مركز التنبيهات والإعلانات
              </h2>
              <p className="text-xs text-slate-500">
                آخر التحديثات، التنبيهات الإدارية، وإشعارات المنصة اللحظية
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filters & Mark All Read */}
        <div className="flex items-center justify-between gap-2 py-3 border-b border-slate-100 shrink-0 flex-wrap">
          <div className="flex items-center gap-1.5 bg-slate-100/80 p-1 rounded-xl text-xs">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                filter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              الكل ({announcements.length})
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                filter === 'unread' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              غير مقروء ({unreadCount})
            </button>
            <button
              onClick={() => setFilter('updates')}
              className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                filter === 'updates' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              تحديثات
            </button>
            <button
              onClick={() => setFilter('warnings')}
              className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                filter === 'warnings' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              تنبيهات
            </button>
          </div>

          {unreadCount > 0 && (
            <button
              onClick={onMarkAllAsRead}
              className="text-xs font-bold text-purple-700 hover:text-purple-900 flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-purple-50 transition cursor-pointer"
            >
              <CheckCheck className="w-4 h-4" />
              <span>تحديد الكل كمقروء</span>
            </button>
          )}
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto py-3 space-y-3 pr-1">
          {filteredAnnouncements.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <Bell className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-bold text-slate-600">لا توجد إشعارات حالياً</p>
              <p className="text-xs text-slate-400 mt-1">أنت مطلع على كل التحديثات والتنبيهات أولاً بأول</p>
            </div>
          ) : (
            filteredAnnouncements.map((ann) => {
              const isUnread = !readAnnouncementIds.includes(ann.id);
              const badge = getAnnouncementBadge(ann.type);
              const BadgeIcon = badge.icon;

              return (
                <div
                  key={ann.id}
                  onClick={() => isUnread && onMarkAsRead(ann.id)}
                  className={`p-4 rounded-2xl border transition relative group ${
                    isUnread
                      ? 'bg-purple-50/40 border-purple-200 hover:border-purple-300'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {/* Unread indicator dot */}
                  {isUnread && (
                    <span className="absolute top-4 left-4 w-2.5 h-2.5 bg-purple-600 rounded-full ring-4 ring-purple-100" />
                  )}

                  <div className="flex items-center gap-2 mb-2">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold border ${badge.bg}`}>
                      <BadgeIcon className="w-3 h-3" />
                      <span>{badge.label}</span>
                    </span>

                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>{formatRelativeTime(ann.createdAt)}</span>
                    </span>
                  </div>

                  <h3 className="font-extrabold text-slate-900 text-sm mb-1.5">
                    {ann.title}
                  </h3>

                  <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
                    {ann.message}
                  </p>

                  {/* Optional Interactive CTA */}
                  {ann.actionLink && (
                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                      <a
                        href={ann.actionLink}
                        target={ann.actionLink.startsWith('http') ? '_blank' : '_self'}
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold rounded-xl shadow-xs transition"
                        onClick={() => {
                          onMarkAsRead(ann.id);
                          if (!ann.actionLink?.startsWith('http')) {
                            onClose();
                          }
                        }}
                      >
                        <span>{ann.actionLabel || 'عرض التفاصيل'}</span>
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between shrink-0 text-xs text-slate-500">
          <span>دوري • التنبيهات المباشرة</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold transition cursor-pointer"
          >
            إغلاق
          </button>
        </div>

      </div>
    </div>
  );
};
