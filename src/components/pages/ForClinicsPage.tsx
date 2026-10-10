import React, { useEffect } from 'react';
import {
  Stethoscope,
  Tv,
  Users,
  FileText,
  CalendarCheck,
  DollarSign,
  QrCode,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowLeft,
  Volume2
} from 'lucide-react';
import { setPageSeo, FOR_CLINICS_PAGE_SEO } from '../../utils/seo';

interface ForClinicsPageProps {
  onNavigate: (tab: any, options?: any) => void;
  onNavigateAuth: () => void;
}

export const ForClinicsPage: React.FC<ForClinicsPageProps> = ({ onNavigate, onNavigateAuth }) => {
  useEffect(() => {
    setPageSeo(FOR_CLINICS_PAGE_SEO);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12 font-['Tajawal',sans-serif]">
      
      {/* Header */}
      <header className="space-y-4 text-center max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#eef7f4] border border-[#c4e5db] text-[#143d30] font-bold text-xs">
          <Stethoscope className="w-3.5 h-3.5 text-[#1c5242]" />
          <span>منظومة دوري للأطباء والعيادات الطبية</span>
        </div>

        <h1 className="text-2xl sm:text-4xl font-extrabold text-[#143d30] tracking-tight leading-snug">
          إدارة متكاملة لطابور العيادة، شاشات الانتظار، والسجلات الطبية
        </h1>

        <p className="text-slate-600 text-sm sm:text-base leading-relaxed font-normal">
          منصة سحابية متخصصة للأطباء والعيادات الفردية والمجمعة لتنظيم تدفق المرضى، تسجيل الكشوفات، ومتابعة العمليات المالية بكل دقة.
        </p>

        <div className="pt-2 flex items-center justify-center gap-3">
          <button
            onClick={() => onNavigateAuth()}
            className="px-6 py-3 bg-[#1c5242] hover:bg-[#143d30] text-white rounded-xl text-xs sm:text-sm font-bold shadow-2xs cursor-pointer transition flex items-center gap-2"
          >
            <Stethoscope className="w-4 h-4 text-emerald-200" />
            <span>إنشاء حساب عيادة الآن</span>
          </button>
        </div>
      </header>

      {/* Main Core Features for Clinics */}
      <section aria-labelledby="clinic-features-title" className="space-y-6">
        <h2 id="clinic-features-title" className="text-xl sm:text-2xl font-bold text-[#143d30]">
          المزايا التشغيلية لمنظومة العيادات في دوري
        </h2>

        <div className="grid sm:grid-cols-2 gap-5">
          
          {/* Feature 1: Live Queue */}
          <div className="bg-[#fdfcf9] p-6 rounded-2xl border border-[#c4e5db] shadow-2xs space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#eef7f4] text-[#143d30] flex items-center justify-center font-bold">
              <Users className="w-5 h-5 text-[#1c5242]" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">إدارة الطابور الرقمي المباشر</h3>
            <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
              نداء المرضى بضغطة زر، تحديث حالة الكشف (في الانتظار، داخل الكشف، مكتمل)، وحساب الوقت التقريبي المتبقي لكل مريض تلقائياً.
            </p>
          </div>

          {/* Feature 2: TV Queue Display */}
          <div className="bg-[#fdfcf9] p-6 rounded-2xl border border-[#c4e5db] shadow-2xs space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#eef7f4] text-[#143d30] flex items-center justify-center font-bold">
              <Tv className="w-5 h-5 text-[#1c5242]" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">شاشة صالة الانتظار التفاعلية (TV View)</h3>
            <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
              عرض دور الكشف الحالي والأدوار القادمة على شاشة تلفزيون الاستقبال مع تنبيه صوتي فوري عند دخول كل دور جديد لمنع التزاحم.
            </p>
          </div>

          {/* Feature 3: Medical Records & Prescriptions */}
          <div className="bg-[#fdfcf9] p-6 rounded-2xl border border-[#c4e5db] shadow-2xs space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#eef7f4] text-[#143d30] flex items-center justify-center font-bold">
              <FileText className="w-5 h-5 text-[#1c5242]" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">الملفات الطبية والروشتات الإلكترونية</h3>
            <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
              أرشفة التاريخ الطبي لكل مريض، تسجيل التشخيصات، الأدوية، والجرعات، وإمكانية طباعة الروشتة أو مشاركتها رقمياً.
            </p>
          </div>

          {/* Feature 4: Follow-up scheduling */}
          <div className="bg-[#fdfcf9] p-6 rounded-2xl border border-[#c4e5db] shadow-2xs space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#eef7f4] text-[#143d30] flex items-center justify-center font-bold">
              <CalendarCheck className="w-5 h-5 text-[#1c5242]" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">مواعيد الإعادة والمتابعات</h3>
            <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
              جدولة مواعيد الاستشارة وإعادة الكشف ضمن فترة السماح المحددة مع تنبيه تلقائي وإدراج المريض في جدول اليوم المطلوب.
            </p>
          </div>

          {/* Feature 5: Financial Management */}
          <div className="bg-[#fdfcf9] p-6 rounded-2xl border border-[#c4e5db] shadow-2xs space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#eef7f4] text-[#143d30] flex items-center justify-center font-bold">
              <DollarSign className="w-5 h-5 text-[#1c5242]" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">الخزينة والتقارير المالية اليومية</h3>
            <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
              تسجيل إيرادات الكشوفات والمصروفات النثرية وحساب صافي الدخل اليومي والشهري مع تقارير وإيصالات محاسبية واضحة.
            </p>
          </div>

          {/* Feature 6: QR Code & Assistant Access */}
          <div className="bg-[#fdfcf9] p-6 rounded-2xl border border-[#c4e5db] shadow-2xs space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#eef7f4] text-[#143d30] flex items-center justify-center font-bold">
              <QrCode className="w-5 h-5 text-[#1c5242]" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">باركود QR ودعوة فريق العمل</h3>
            <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
              رمز QR مخصص للعيادة لطباعته عند الاستقبال لتسجيل المرضى فور وصولهم، مع إمكانية دعوة مساعد العيادة بصلاحيات محددة.
            </p>
          </div>

        </div>
      </section>

      {/* Step by Step Workflow */}
      <section aria-labelledby="clinic-workflow-title" className="bg-[#fdfcf9] rounded-2xl p-6 sm:p-8 border border-[#e7e3da] shadow-2xs space-y-6">
        <h2 id="clinic-workflow-title" className="text-xl sm:text-2xl font-bold text-[#143d30]">
          كيف تعمل العيادة في دوري؟ (خطوة بخطوة)
        </h2>

        <div className="grid sm:grid-cols-4 gap-4">
          <div className="p-4 bg-[#faf8f5] rounded-xl border border-[#c4e5db] space-y-2">
            <div className="text-xs font-bold text-[#1c5242]">الخطوة 1</div>
            <div className="font-bold text-slate-900 text-sm">تسجيل العيادة وضبط المواعيد</div>
            <div className="text-xs text-slate-600">تحديد التخصص، أوقات العمل، رسوم الكشف، وزمن الاستشارة المتوسط.</div>
          </div>

          <div className="p-4 bg-[#faf8f5] rounded-xl border border-[#c4e5db] space-y-2">
            <div className="text-xs font-bold text-[#1c5242]">الخطوة 2</div>
            <div className="font-bold text-slate-900 text-sm">استقبال الحجوزات أو تسجيل الحضور</div>
            <div className="text-xs text-slate-600">يقوم المريض بالحجز عبر الرابط أو باركود الاستقبال مباشرة.</div>
          </div>

          <div className="p-4 bg-[#faf8f5] rounded-xl border border-[#c4e5db] space-y-2">
            <div className="text-xs font-bold text-[#1c5242]">الخطوة 3</div>
            <div className="font-bold text-slate-900 text-sm">نداء الدور عبر الشاشة التفاعلية</div>
            <div className="text-xs text-slate-600">ينادي الطبيب أو المساعد على المريض مع ظهور رقمه على شاشة التلفزيون.</div>
          </div>

          <div className="p-4 bg-[#faf8f5] rounded-xl border border-[#c4e5db] space-y-2">
            <div className="text-xs font-bold text-[#1c5242]">الخطوة 4</div>
            <div className="font-bold text-slate-900 text-sm">تدوين الكشف وتحديد الإعادة</div>
            <div className="text-xs text-slate-600">حفظ الروشتة في ملف المريض وجدولة موعد الإعادة القادم عند الحاجة.</div>
          </div>
        </div>
      </section>

      {/* Internal Links & CTA */}
      <div className="border-t border-[#e7e3da] pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4 text-xs text-slate-600">
          <button onClick={() => onNavigate('faq')} className="hover:underline font-bold">الأسئلة الشائعة</button>
          <span>•</span>
          <button onClick={() => onNavigate('about')} className="hover:underline font-bold">عن النظام</button>
          <span>•</span>
          <button onClick={() => onNavigate('privacy')} className="hover:underline font-bold">الخصوصية والأمان</button>
        </div>

        <button
          onClick={() => onNavigateAuth()}
          className="px-6 py-3 bg-[#1c5242] hover:bg-[#143d30] text-white rounded-xl text-xs sm:text-sm font-bold shadow-2xs cursor-pointer transition flex items-center gap-2"
        >
          <span>تسجيل حساب طبيب مجاناً</span>
          <ArrowLeft className="w-3.5 h-3.5" />
        </button>
      </div>

    </div>
  );
};
