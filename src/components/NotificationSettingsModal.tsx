import React, { useState, useEffect } from 'react';
import {
  Bell,
  BellOff,
  CheckCircle2,
  AlertCircle,
  X,
  Clock,
  Smartphone,
  Inbox
} from 'lucide-react';
import { UserNotificationSettings, NotificationTimingPreference, AppNotification } from '../types';
import {
  requestNotificationPermissionAndGetToken,
  getUserNotificationSettings,
  saveUserNotificationSettings,
  getUserNotifications,
  markNotificationAsRead
} from '../services/fcmService';

interface NotificationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onShowToast: (title: string, message?: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export const NotificationSettingsModal: React.FC<NotificationSettingsModalProps> = ({
  isOpen,
  onClose,
  userId,
  onShowToast
}) => {
  const [activeTab, setActiveTab] = useState<'settings' | 'inbox'>('settings');
  const [settings, setSettings] = useState<UserNotificationSettings>({
    timingPreference: 'two_turns',
    pushEnabled: false,
    inAppEnabled: true
  });
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'default' | 'unsupported'>('default');
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  useEffect(() => {
    if (isOpen && userId) {
      loadSettingsAndNotifications();
    }
  }, [isOpen, userId]);

  const loadSettingsAndNotifications = async () => {
    setLoading(true);
    const userPref = await getUserNotificationSettings(userId);
    setSettings(userPref);

    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermissionStatus(Notification.permission as any);
    } else {
      setPermissionStatus('unsupported');
    }

    const inbox = await getUserNotifications(userId);
    setNotifications(inbox);
    setLoading(false);
  };

  const handleEnablePush = async () => {
    setLoading(true);
    const result = await requestNotificationPermissionAndGetToken(userId);
    setLoading(false);

    if (result.success) {
      setPermissionStatus('granted');
      setSettings(prev => ({ ...prev, pushEnabled: true }));
      onShowToast("تم تفعيل إشعارات قرب الدور بنجاح!", "ستصلك التنبيهات المباشرة فور اقتراب رقمك", "success");
    } else if (result.status === 'denied') {
      setPermissionStatus('denied');
      onShowToast("تم رفض إذن الإشعارات من المتصفح", "يمكنك تفعيل الإشعارات يدويًا من إعدادات المتصفح", "warning");
    } else {
      onShowToast("تعذر تفعيل الإشعارات", "المتصفح لا يدعم التنبيهات المنبثقة", "error");
    }
  };

  const handleTimingChange = async (pref: NotificationTimingPreference) => {
    const updated = { ...settings, timingPreference: pref };
    setSettings(updated);
    await saveUserNotificationSettings(userId, updated);
    onShowToast("تم حفظ التوقيت المفضل للإشعار", "", "success");
  };

  const handleMarkRead = async (notifId: string) => {
    await markNotificationAsRead(userId, notifId);
    setNotifications(notifications.map(n => n.id === notifId ? { ...n, isRead: true } : n));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-sky-50 text-sky-600 rounded-2xl">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 font-['Tajawal',sans-serif]">
                إعدادات وتنبيهات قرب الدور
              </h2>
              <p className="text-xs text-slate-500">تخصيص وقت استلام الإشعار قبل الدخول للعيادة</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Buttons */}
        <div className="flex bg-slate-100 p-1 rounded-2xl mb-5">
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 ${
              activeTab === 'settings' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>تخصيص الإشعارات</span>
          </button>
          <button
            onClick={() => setActiveTab('inbox')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 ${
              activeTab === 'inbox' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
            }`}
          >
            <Inbox className="w-4 h-4" />
            <span>صندوق الرسائل ({notifications.filter(n => !n.isRead).length})</span>
          </button>
        </div>

        {/* Tab 1: Settings */}
        {activeTab === 'settings' && (
          <div className="space-y-6 overflow-y-auto pr-1">
            
            {/* Status Banner */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-extrabold text-slate-700">حالة إشعارات المتصفح (Web Push)</span>
                {permissionStatus === 'granted' ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-black">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>مفعلة</span>
                  </span>
                ) : permissionStatus === 'denied' ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-100 text-rose-800 rounded-full text-xs font-black">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>تم رفض الإذن</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-black">
                    <BellOff className="w-3.5 h-3.5" />
                    <span>غير مفعلة</span>
                  </span>
                )}
              </div>

              {permissionStatus !== 'granted' && (
                <button
                  onClick={handleEnablePush}
                  disabled={loading}
                  className="w-full py-2.5 bg-teal-800 hover:bg-teal-900 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-2xs cursor-pointer"
                >
                  <Bell className="w-4 h-4" />
                  <span>تفعيل إشعارات قرب الدور الآن</span>
                </button>
              )}
            </div>

            {/* Timing Preference Options */}
            <div>
              <label className="block text-xs font-extrabold text-slate-800 mb-2">
                توقيت التنبيه المفضل (متى ترغب بالإشعار؟)
              </label>

              <div className="space-y-2">
                
                {/* Two Turns Before */}
                <label
                  onClick={() => handleTimingChange('two_turns')}
                  className={`flex items-center justify-between p-3.5 rounded-2xl border cursor-pointer transition ${
                    settings.timingPreference === 'two_turns'
                      ? 'bg-sky-50/80 border-sky-500 text-sky-950 font-black'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${settings.timingPreference === 'two_turns' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="block text-xs font-bold">قبل دورك بدورين (افتراضي)</span>
                      <span className="text-[11px] text-slate-500 font-normal">يعطيك وقتًا كافياً للوصول لمقر العيادة</span>
                    </div>
                  </div>
                  <input
                    type="radio"
                    name="timing"
                    checked={settings.timingPreference === 'two_turns'}
                    onChange={() => {}}
                    className="accent-sky-600 w-4 h-4"
                  />
                </label>

                {/* One Turn Before */}
                <label
                  onClick={() => handleTimingChange('one_turn')}
                  className={`flex items-center justify-between p-3.5 rounded-2xl border cursor-pointer transition ${
                    settings.timingPreference === 'one_turn'
                      ? 'bg-sky-50/80 border-sky-500 text-sky-950 font-black'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${settings.timingPreference === 'one_turn' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="block text-xs font-bold">قبل دورك بدور واحد فقط</span>
                      <span className="text-[11px] text-slate-500 font-normal">مناسب إذا كنت متواجدًا بالقرب من العيادة</span>
                    </div>
                  </div>
                  <input
                    type="radio"
                    name="timing"
                    checked={settings.timingPreference === 'one_turn'}
                    onChange={() => {}}
                    className="accent-sky-600 w-4 h-4"
                  />
                </label>

                {/* 10 Minutes Before */}
                <label
                  onClick={() => handleTimingChange('ten_minutes')}
                  className={`flex items-center justify-between p-3.5 rounded-2xl border cursor-pointer transition ${
                    settings.timingPreference === 'ten_minutes'
                      ? 'bg-sky-50/80 border-sky-500 text-sky-950 font-black'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${settings.timingPreference === 'ten_minutes' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="block text-xs font-bold">قبل الموعد التقديري بـ 10 دقائق</span>
                      <span className="text-[11px] text-slate-500 font-normal">يعتمد على متوسط وقت الاستشارة التقديري</span>
                    </div>
                  </div>
                  <input
                    type="radio"
                    name="timing"
                    checked={settings.timingPreference === 'ten_minutes'}
                    onChange={() => {}}
                    className="accent-sky-600 w-4 h-4"
                  />
                </label>

              </div>
            </div>

          </div>
        )}

        {/* Tab 2: In-App Notifications Inbox */}
        {activeTab === 'inbox' && (
          <div className="space-y-3 overflow-y-auto pr-1 flex-1">
            {notifications.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <Bell className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-xs font-semibold">لا توجد إشعارات مسجلة حالياً</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleMarkRead(n.id)}
                  className={`p-3.5 rounded-2xl border transition cursor-pointer ${
                    n.isRead ? 'bg-white border-slate-200' : 'bg-sky-50/50 border-sky-300 font-bold'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${n.isRead ? 'bg-slate-300' : 'bg-sky-600'}`} />
                      <h4 className="text-xs font-extrabold text-slate-900">{n.title}</h4>
                    </div>
                    <span className="text-[10px] text-slate-400 font-normal">
                      {new Date(n.createdAt).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">{n.body}</p>
                </div>
              ))
            )}
          </div>
        )}

        {/* Footer */}
        <div className="pt-4 border-t border-slate-100 mt-4">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition"
          >
            إغلاق
          </button>
        </div>

      </div>
    </div>
  );
};
