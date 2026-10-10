import React, { useEffect } from 'react';
import {
  ShieldCheck,
  Lock,
  Database,
  UserCheck,
  FileText,
  KeyRound,
  CheckCircle2,
  ArrowLeft
} from 'lucide-react';
import { setPageSeo, PRIVACY_PAGE_SEO } from '../../utils/seo';

interface PrivacyPageProps {
  onNavigate: (tab: any, options?: any) => void;
}

export const PrivacyPage: React.FC<PrivacyPageProps> = ({ onNavigate }) => {
  useEffect(() => {
    setPageSeo(PRIVACY_PAGE_SEO);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10 font-['Tajawal',sans-serif]">
      
      {/* Header */}
      <header className="space-y-4 text-center max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#edf3fa] border border-[#d1dfed] text-[#122c4a] font-bold text-xs">
          <ShieldCheck className="w-3.5 h-3.5 text-[#1b3a5c]" />
          <span>سياسة الخصوصية وحماية البيانات</span>
        </div>

        <h1 className="text-2xl sm:text-4xl font-extrabold text-[#122c4a] tracking-tight leading-snug">
          سياسة الخصوصية وأمان المعلومات في منصة دوري
        </h1>

        <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
          نوضح هنا بشفافية تامة كيفية معالجة البيانات، حماية خصوصية المرضى، وعزل سجلات العيادات والمختبرات وفق البنية البرمجية المعتمدة للمنصة.
        </p>
      </header>

      {/* Principles & Factual Security Architecture */}
      <div className="space-y-6">
        
        {/* Section 1: Data Isolation */}
        <section className="bg-[#fdfcf9] rounded-2xl p-6 sm:p-8 border border-[#e7e3da] shadow-2xs space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#edf3fa] text-[#122c4a] flex items-center justify-center font-bold">
              <Database className="w-4 h-4 text-[#1b3a5c]" />
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              1. عزل قواعد البيانات وصلاحيات الوصول (Access Control)
            </h2>
          </div>
          <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
            يتم تخزين بيانات كل عيادة ومعمل في مجموعات بيانات مخصصة على البنية السحابية لقاعدة بيانات Firebase Firestore، محكومة بقواعد أمان برمجية صارمة (Firestore Security Rules) تمنع أي طبيب أو مستخدم آخر من الوصول إلى سجلات المرضى أو الحسابات المالية الخاصة بعيادة أخرى.
          </p>
        </section>

        {/* Section 2: Patient Privacy & Guest Booking */}
        <section className="bg-[#fdfcf9] rounded-2xl p-6 sm:p-8 border border-[#e7e3da] shadow-2xs space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#eef7f4] text-[#143d30] flex items-center justify-center font-bold">
              <UserCheck className="w-4 h-4 text-[#1c5242]" />
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              2. خصوصية بيانات المرضى والحجز السريع
            </h2>
          </div>
          <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
            عند حجز المريض لدوره كزائر (Guest)، يتم استخدام الاسم ورقم الهاتف فقط لغرض تنظيم الطابور والتواصل بشأن موعد الكشف أو استلام نتيجة الفحص. لا نقوم ببيع أو مشاركة بيانات المرضى أو أرقام هواتفهم مع أي طرف ثالث لأغراض إعلانية أو ترويجية.
          </p>
        </section>

        {/* Section 3: Data in Transit & Cloud Infrastructure */}
        <section className="bg-[#fdfcf9] rounded-2xl p-6 sm:p-8 border border-[#e7e3da] shadow-2xs space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#edf3fa] text-[#122c4a] flex items-center justify-center font-bold">
              <Lock className="w-4 h-4 text-[#1b3a5c]" />
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              3. نقل البيانات وحماية الاتصال (HTTPS / TLS)
            </h2>
          </div>
          <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
            تتم جميع الاتصالات ونقل البيانات بين المتصفح والخادم عبر بروتوكول HTTPS المشفر قياسياً (TLS) لحماية البيانات أثناء الإرسال ومنع التنصت أو التلاعب بالمعلومات أثناء انتقالها عبر شبكة الإنترنت.
          </p>
        </section>

        {/* Section 4: Role-based Assistant Delegation */}
        <section className="bg-[#fdfcf9] rounded-2xl p-6 sm:p-8 border border-[#e7e3da] shadow-2xs space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#faf8f5] text-[#b45309] flex items-center justify-center font-bold">
              <KeyRound className="w-4 h-4 text-[#b45309]" />
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              4. إدارة صلاحيات مساعدي العيادات
            </h2>
          </div>
          <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
            عندما يدعو الطبيب مساعداً أو موظف استقبال عبر رمز دعوة مخصص، يتم تقييد صلاحيات المساعد لتشمل فقط تسجيل حضور المرضى ونداء الأدوار، دون منحه صلاحية تعديل أسعار الكشوفات أو الاطلاع على تقارير الأرباح والخزينة ما لم يُصرح له بذلك من قبل الطبيب مالك الحساب.
          </p>
        </section>

      </div>

      {/* Footer Navigation */}
      <div className="border-t border-[#e7e3da] pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4 text-xs text-slate-600">
          <button onClick={() => onNavigate('about')} className="hover:underline font-bold">عن المنظومة</button>
          <span>•</span>
          <button onClick={() => onNavigate('faq')} className="hover:underline font-bold">الأسئلة الشائعة</button>
          <span>•</span>
          <button onClick={() => onNavigate('directory')} className="hover:underline font-bold">دليل الأطباء</button>
        </div>

        <button
          onClick={() => onNavigate('directory')}
          className="px-5 py-2.5 bg-[#122c4a] hover:bg-[#0d223a] text-white rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer"
        >
          <span>العودة للرئيسية</span>
          <ArrowLeft className="w-3.5 h-3.5" />
        </button>
      </div>

    </div>
  );
};
