import React, { useState } from 'react';
import {
  Stethoscope,
  Building2,
  ShieldCheck,
  Bell,
  CreditCard,
  ExternalLink,
  QrCode,
  Settings,
  LogOut,
  LogIn,
  Menu,
  X,
  Info,
  HelpCircle,
  FileText,
  Users
} from 'lucide-react';
import { DoctorProfile } from '../types';

export type NavTabType =
  | 'dashboard'
  | 'clinic'
  | 'booking'
  | 'ticket'
  | 'subscription'
  | 'auth'
  | 'admin'
  | 'about'
  | 'for-clinics'
  | 'for-patients'
  | 'faq'
  | 'privacy'
  // Deprecated legacy tabs preserved for routing backward compatibility
  | 'directory';

interface NavbarProps {
  currentDoctor: DoctorProfile | null;
  activeTab: NavTabType;
  isAdmin?: boolean;
  unreadNotificationCount?: number;
  onNavigate: (tab: NavTabType) => void;
  onOpenQRModal: () => void;
  onOpenSettingsModal: () => void;
  onOpenNotificationModal?: () => void;
  onSignOut: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentDoctor,
  activeTab,
  isAdmin = false,
  unreadNotificationCount = 0,
  onNavigate,
  onOpenQRModal,
  onOpenSettingsModal,
  onOpenNotificationModal,
  onSignOut
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleMobileNav = (tab: NavTabType) => {
    setMobileMenuOpen(false);
    onNavigate(tab);
  };

  const handleMobileAction = (action: () => void) => {
    setMobileMenuOpen(false);
    action();
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-2xs">
        <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            
            {/* Brand Logo & Desktop Nav Tabs */}
            <div className="flex items-center gap-3 sm:gap-6 shrink-0">
              <button
                onClick={() => handleMobileNav(currentDoctor ? 'dashboard' : 'auth')}
                className="flex items-center gap-2 sm:gap-2.5 text-right group focus:outline-hidden cursor-pointer"
                aria-label="الصفحة الرئيسية لمنظومة دوري"
              >
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#0d5c58] flex items-center justify-center text-white shadow-xs group-hover:bg-[#084d49] transition-all shrink-0">
                  <Stethoscope className="w-5 h-5 text-teal-200" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-black text-lg sm:text-xl text-[#0f172a] tracking-tight font-['Tajawal',sans-serif]">
                      دوري
                    </span>
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500"></span>
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-medium hidden sm:block -mt-1">
                    نظام إدارة وتشغيل العيادات الطبية
                  </span>
                </div>
              </button>

              {/* Nav Tabs (Desktop) */}
              <nav className="hidden md:flex items-center gap-1">
                {currentDoctor && (
                  <button
                    onClick={() => onNavigate('dashboard')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition flex items-center gap-1.5 cursor-pointer min-h-[38px] ${
                      activeTab === 'dashboard'
                        ? 'bg-[#0d5c58] text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Building2 className="w-4 h-4" />
                    <span>لوحة العيادة</span>
                  </button>
                )}

                <button
                  onClick={() => onNavigate('subscription')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition cursor-pointer min-h-[38px] flex items-center ${
                    activeTab === 'subscription'
                      ? 'bg-[#0d5c58] text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  الاشتراكات والباقات
                </button>

                {isAdmin && (
                  <button
                    onClick={() => onNavigate('admin')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition flex items-center gap-1 cursor-pointer min-h-[38px] ${
                      activeTab === 'admin'
                        ? 'bg-rose-900 text-white shadow-2xs'
                        : 'text-rose-700 hover:text-rose-900 hover:bg-rose-50'
                    }`}
                    title="لوحة تحكم إدارة المنصة"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>إدارة المنصة</span>
                  </button>
                )}
              </nav>
            </div>

            {/* Right Navigation Actions Cluster */}
            <div className="flex items-center gap-1.5 sm:gap-2.5">
              
              {/* Notification Center Bell Button */}
              {onOpenNotificationModal && (
                <button
                  onClick={onOpenNotificationModal}
                  className="w-9 h-9 sm:w-10 sm:h-10 text-slate-600 hover:text-[#0d5c58] hover:bg-slate-100 rounded-xl transition relative cursor-pointer flex items-center justify-center shrink-0 border border-slate-200/60"
                  title="مركز التنبيهات والإعلانات"
                  aria-label="مركز التنبيهات والإعلانات"
                >
                  <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
                  {unreadNotificationCount > 0 ? (
                    <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 bg-amber-600 text-white rounded-full text-[10px] font-black flex items-center justify-center border-2 border-white shadow-2xs">
                      {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
                    </span>
                  ) : (
                    <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-teal-500 rounded-full" />
                  )}
                </button>
              )}

              {currentDoctor ? (
                <>
                  {/* Subscription Indicator (Desktop) */}
                  <button
                    onClick={() => onNavigate('subscription')}
                    className={`hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition border shrink-0 min-h-[38px] cursor-pointer ${
                      currentDoctor.subscriptionStatus === 'active'
                        ? 'bg-teal-50 text-teal-800 border-teal-200 hover:bg-teal-100'
                        : currentDoctor.subscriptionStatus === 'trial'
                        ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                        : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                    }`}
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>
                      {currentDoctor.subscriptionStatus === 'active'
                        ? 'اشتراك نشط'
                        : currentDoctor.subscriptionStatus === 'trial'
                        ? 'تجريبي'
                        : 'منتهي'}
                    </span>
                  </button>

                  {/* Patient View Preview Button (Desktop only on small screens to prevent collisions) */}
                  <button
                    onClick={() => onNavigate('booking')}
                    className={`hidden sm:flex h-9 sm:h-10 px-2 sm:px-3 rounded-xl text-xs font-bold transition cursor-pointer items-center justify-center gap-1.5 shrink-0 border border-slate-200 ${
                      activeTab === 'booking'
                        ? 'bg-[#0d5c58] text-white border-[#0d5c58]'
                        : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                    title="معاينة صفحة حجز المريض"
                    aria-label="معاينة صفحة حجز المريض"
                  >
                    <ExternalLink className="w-4 h-4 shrink-0" />
                    <span className="hidden md:inline">معاينة الحجز</span>
                  </button>

                  {/* QR Code Action (Always available with clean hit area) */}
                  <button
                    onClick={onOpenQRModal}
                    className="h-9 sm:h-10 px-2 sm:px-3 bg-[#0d5c58] hover:bg-[#084d49] text-white rounded-xl text-xs font-bold shadow-2xs transition cursor-pointer flex items-center justify-center gap-1.5 shrink-0 min-w-[36px]"
                    title="عرض وطباعة QR Code العيادة"
                    aria-label="رمز QR العيادة"
                  >
                    <QrCode className="w-4 h-4 shrink-0 text-teal-200" />
                    <span className="hidden md:inline">رمز QR</span>
                  </button>

                  {/* Settings (Desktop) */}
                  <button
                    onClick={onOpenSettingsModal}
                    className="hidden sm:flex w-9 sm:w-10 h-9 sm:h-10 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition cursor-pointer items-center justify-center shrink-0 border border-slate-200/60"
                    title="إعدادات العيادة وتعديل الملف"
                    aria-label="إعدادات العيادة"
                  >
                    <Settings className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                  </button>

                  {/* Sign Out (Desktop) */}
                  <button
                    onClick={() => {
                      if (window.confirm("هل أنت متأكد أنك تريد الخروج؟")) {
                        onSignOut();
                      }
                    }}
                    className="hidden sm:flex w-9 sm:w-10 h-9 sm:h-10 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-xl transition cursor-pointer items-center justify-center shrink-0 border border-rose-200/60"
                    title="تسجيل الخروج"
                    aria-label="تسجيل الخروج"
                  >
                    <LogOut className="w-4 h-4 sm:w-4.5 sm:h-4.5 rtl:rotate-180" />
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  {/* Clinic Login & Access Button */}
                  <button
                    onClick={() => onNavigate('auth')}
                    className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition shadow-2xs cursor-pointer min-h-[38px] ${
                      activeTab === 'auth'
                        ? 'bg-[#0d5c58] text-white ring-2 ring-[#0d5c58]/30'
                        : 'bg-[#0d5c58] hover:bg-[#084d49] text-white'
                    }`}
                  >
                    <LogIn className="w-4 h-4 rtl:rotate-180 text-teal-200 shrink-0" />
                    <span>دخول العيادة</span>
                  </button>
                </div>
              )}

              {/* Mobile Navigation Hamburger Button (Accessible on all screens < md) */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className={`md:hidden w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition cursor-pointer shrink-0 border min-h-[38px] min-w-[38px] ${
                  mobileMenuOpen
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
                title="القائمة الرئيسية"
                aria-label={mobileMenuOpen ? 'إغلاق القائمة' : 'فتح القائمة الرئيسية'}
                aria-expanded={mobileMenuOpen}
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>

            </div>

          </div>
        </div>
      </header>

      {/* Mobile Navigation Drawer / Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 md:hidden bg-slate-950/60 backdrop-blur-xs flex flex-col justify-start pt-16">
          <div className="bg-white border-b border-slate-200 shadow-2xl overflow-y-auto max-h-[calc(100vh-4rem)] p-4 sm:p-5 pb-safe space-y-4 text-right animate-in fade-in slide-in-from-top-4 duration-200">
            
            {/* Logged in clinic card info */}
            {currentDoctor && (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-[#0d5c58] text-white flex items-center justify-center font-bold shrink-0">
                    <Stethoscope className="w-4 h-4 text-teal-200" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-black text-slate-900 truncate font-['Tajawal',sans-serif]">
                      {doctorTitle(currentDoctor)}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">
                      {currentDoctor.clinicName}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleMobileNav('subscription')}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border shrink-0 ${
                    currentDoctor.subscriptionStatus === 'active'
                      ? 'bg-teal-50 text-teal-800 border-teal-200'
                      : currentDoctor.subscriptionStatus === 'trial'
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : 'bg-rose-50 text-rose-700 border-rose-200'
                  }`}
                >
                  {currentDoctor.subscriptionStatus === 'active'
                    ? 'اشتراك نشط'
                    : currentDoctor.subscriptionStatus === 'trial'
                    ? 'تجريبي'
                    : 'منتهي'}
                </button>
              </div>
            )}

            {/* Core Navigation Links */}
            <div className="space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 pb-1">
                التنقل السريع
              </div>

              {currentDoctor && (
                <button
                  onClick={() => handleMobileNav('dashboard')}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer min-h-[44px] ${
                    activeTab === 'dashboard'
                      ? 'bg-[#0d5c58] text-white shadow-2xs'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Building2 className="w-4 h-4 shrink-0" />
                  <span>لوحة العيادة والطابور</span>
                </button>
              )}

              <button
                onClick={() => handleMobileNav('subscription')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer min-h-[44px] ${
                  activeTab === 'subscription'
                    ? 'bg-[#0d5c58] text-white shadow-2xs'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <CreditCard className="w-4 h-4 shrink-0" />
                <span>الاشتراكات والباقات الرسمية</span>
              </button>

              {currentDoctor && (
                <>
                  <button
                    onClick={() => handleMobileNav('booking')}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer min-h-[44px] ${
                      activeTab === 'booking'
                        ? 'bg-[#0d5c58] text-white shadow-2xs'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <ExternalLink className="w-4 h-4 shrink-0" />
                    <span>معاينة صفحة حجز المريض (QR View)</span>
                  </button>

                  <button
                    onClick={() => handleMobileAction(onOpenQRModal)}
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer min-h-[44px]"
                  >
                    <QrCode className="w-4 h-4 shrink-0 text-[#0d5c58]" />
                    <span>عرض وطباعة رمز QR للعيادة</span>
                  </button>

                  <button
                    onClick={() => handleMobileAction(onOpenSettingsModal)}
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer min-h-[44px]"
                  >
                    <Settings className="w-4 h-4 shrink-0 text-slate-600" />
                    <span>إعدادات العيادة وتعديل الملف</span>
                  </button>
                </>
              )}

              {isAdmin && (
                <button
                  onClick={() => handleMobileNav('admin')}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer min-h-[44px] ${
                    activeTab === 'admin'
                      ? 'bg-rose-900 text-white shadow-2xs'
                      : 'text-rose-700 hover:bg-rose-50'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>لوحة إدارة المنصة المركزية</span>
                </button>
              )}

              {!currentDoctor && (
                <button
                  onClick={() => handleMobileNav('auth')}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition cursor-pointer min-h-[44px] ${
                    activeTab === 'auth'
                      ? 'bg-[#0d5c58] text-white'
                      : 'bg-teal-50 text-teal-900 hover:bg-teal-100'
                  }`}
                >
                  <LogIn className="w-4 h-4 rtl:rotate-180 shrink-0 text-[#0d5c58]" />
                  <span>تسجيل دخول العيادة</span>
                </button>
              )}
            </div>

            {/* Informational Pages */}
            <div className="space-y-1 pt-2 border-t border-slate-100">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 pb-1">
                عن المنصة والمعلومات
              </div>

              <button
                onClick={() => handleMobileNav('for-clinics')}
                className="w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 min-h-[40px]"
              >
                <Users className="w-4 h-4 shrink-0 text-teal-700" />
                <span>مميزات المنصة للعيادات والمراكز</span>
              </button>

              <button
                onClick={() => handleMobileNav('for-patients')}
                className="w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 min-h-[40px]"
              >
                <Stethoscope className="w-4 h-4 shrink-0 text-teal-700" />
                <span>كيف يعمل الحجز وتتبع الدور للمرضى؟</span>
              </button>

              <button
                onClick={() => handleMobileNav('about')}
                className="w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 min-h-[40px]"
              >
                <Info className="w-4 h-4 shrink-0 text-slate-500" />
                <span>من نحن ورسالة دوري</span>
              </button>

              <button
                onClick={() => handleMobileNav('faq')}
                className="w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 min-h-[40px]"
              >
                <HelpCircle className="w-4 h-4 shrink-0 text-slate-500" />
                <span>الأسئلة الشائعة والدعم</span>
              </button>

              <button
                onClick={() => handleMobileNav('privacy')}
                className="w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 min-h-[40px]"
              >
                <FileText className="w-4 h-4 shrink-0 text-slate-500" />
                <span>سياسة الخصوصية وسرية البيانات</span>
              </button>
            </div>

            {/* Sign Out on Mobile */}
            {currentDoctor && (
              <div className="pt-2 border-t border-slate-100">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    if (window.confirm("هل أنت متأكد أنك تريد الخروج؟")) {
                      onSignOut();
                    }
                  }}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 transition min-h-[44px]"
                >
                  <LogOut className="w-4 h-4 rtl:rotate-180 shrink-0" />
                  <span>تسجيل الخروج من الحساب</span>
                </button>
              </div>
            )}

          </div>
        </div>
      )}
    </>
  );
};

function doctorTitle(doc: DoctorProfile): string {
  if (!doc.name) return 'طبيب العيادة';
  return doc.name.startsWith('د.') ? doc.name : `د. ${doc.name}`;
}

