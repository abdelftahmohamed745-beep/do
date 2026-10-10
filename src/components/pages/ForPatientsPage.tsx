import React, { useEffect } from 'react';
import {
  Users,
  Smartphone,
  RotateCcw,
  Clock,
  FileCheck,
  CheckCircle2,
  Search,
  Sparkles,
  ArrowLeft
} from 'lucide-react';
import { setPageSeo, FOR_PATIENTS_PAGE_SEO } from '../../utils/seo';

interface ForPatientsPageProps {
  onNavigate: (tab: any, options?: any) => void;
}

export const ForPatientsPage: React.FC<ForPatientsPageProps> = ({ onNavigate }) => {
  useEffect(() => {
    setPageSeo(FOR_PATIENTS_PAGE_SEO);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12 font-['Tajawal',sans-serif]">
      
      {/* Header */}
      <header className="space-y-4 text-center max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#fef3c7] border border-[#fde68a] text-[#92400e] font-bold text-xs">
          <Users className="w-3.5 h-3.5 text-[#b45309]" />
          <span>منظومة دوري للمرضى والمراجعين</span>
        </div>

        <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-snug">
          حجز الكشف الطبي وفحص المعمل ومتابعة دورك لحظياً بدون تطبيقات
        </h1>

        <p className="text-slate-600 text-sm sm:text-base leading-relaxed font-normal">
          وفر وقتك وتجنب الانتظار الطويل في العيادات والمختبرات. احجز دورك في ثوانٍ، وتابع موعد دخولك الفعلي من هاتفك.
        </p>

        <div className="pt-2 flex items-center justify-center gap-3">
          <button
            onClick={() => onNavigate('directory')}
            className="px-6 py-3 bg-[#122c4a] hover:bg-[#0d223a] text-white rounded-xl text-xs sm:text-sm font-bold shadow-2xs cursor-pointer transition flex items-center gap-2"
          >
            <Search className="w-4 h-4 text-sky-300" />
            <span>البحث عن طبيب أو معمل الآن</span>
          </button>
        </div>
      </header>

      {/* Patient Advantages */}
      <section aria-labelledby="patient-advantages-title" className="space-y-6">
        <h2 id="patient-advantages-title" className="text-xl sm:text-2xl font-bold text-slate-900">
          ماذا تقدم دوري لك كمريض أو مراجع؟
        </h2>

        <div className="grid sm:grid-cols-2 gap-5">
          
          <div className="bg-[#fdfcf9] p-6 rounded-2xl border border-[#e7e3da] shadow-2xs space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#faf8f5] text-[#b45309] flex items-center justify-center font-bold">
              <Smartphone className="w-5 h-5 text-[#b45309]" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">حجز فوري بدون تحميل تطبيق وبدون حساب</h3>
            <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
              لا داعي لتثبيت تطبيقات جديدة أو حفظ كلمات مرور معقدة. ادخل الاسم ورقم الهاتف فقط واحصل على تذكرتك فوراً.
            </p>
          </div>

          <div className="bg-[#fdfcf9] p-6 rounded-2xl border border-[#e7e3da] shadow-2xs space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#faf8f5] text-[#b45309] flex items-center justify-center font-bold">
              <Clock className="w-5 h-5 text-[#b45309]" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">تذكرة رقمية حية تعرض عدد المتبقين قبلك</h3>
            <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
              شاهد تحديث الدور في الزمن الفعلي. تعرف على الحالة الحالية للكشف وموعد الوصول المقترح بدلاً من الجلوس لساعات.
            </p>
          </div>

          <div className="bg-[#fdfcf9] p-6 rounded-2xl border border-[#e7e3da] shadow-2xs space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#faf8f5] text-[#b45309] flex items-center justify-center font-bold">
              <RotateCcw className="w-5 h-5 text-[#b45309]" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">استرجاع سهل للتذكرة برقم الهاتف</h3>
            <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
              إذا أغلقت صفحة المتصفح بالخطأ، فقط أدخل رقم هاتفك في صفحة العيادة وستظهر تذكرتك السارية مباشرة.
            </p>
          </div>

          <div className="bg-[#fdfcf9] p-6 rounded-2xl border border-[#e7e3da] shadow-2xs space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#faf8f5] text-[#b45309] flex items-center justify-center font-bold">
              <FileCheck className="w-5 h-5 text-[#b45309]" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">استلام نتائج التحاليل والروشتات إلكترونياً</h3>
            <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
              تصفح تقرير تحليلك المعتمد بصيغة PDF مع باركود QR موثق ومشاركته مع طبيبك المعالج بضغطة زر.
            </p>
          </div>

        </div>
      </section>

      {/* How to Book Guide */}
      <section aria-labelledby="how-to-book-title" className="bg-[#fdfcf9] rounded-2xl p-6 sm:p-8 border border-[#e7e3da] shadow-2xs space-y-6">
        <h2 id="how-to-book-title" className="text-xl sm:text-2xl font-bold text-slate-900">
          كيف تحجز دورك بخطوات بسيطة؟
        </h2>

        <div className="grid sm:grid-cols-3 gap-4">
          <div className="p-4 bg-[#faf8f5] rounded-xl border border-[#e7e3da] space-y-2">
            <div className="text-xs font-bold text-[#122c4a]">1. اختر الطبيب أو المعمل</div>
            <div className="text-xs text-slate-600">ابحث بالاسم أو التخصص أو المدينة واستعرض مواعيد العمل والأسعار.</div>
          </div>

          <div className="p-4 bg-[#faf8f5] rounded-xl border border-[#e7e3da] space-y-2">
            <div className="text-xs font-bold text-[#122c4a]">2. أدخل بيانات الحجز</div>
            <div className="text-xs text-slate-600">اكتب اسمك ورقم الهاتف ونوع الكشف (كشف جديد أو إعادة كشف).</div>
          </div>

          <div className="p-4 bg-[#faf8f5] rounded-xl border border-[#e7e3da] space-y-2">
            <div className="text-xs font-bold text-[#122c4a]">3. تابع دورك في الطابور</div>
            <div className="text-xs text-slate-600">احتفظ بالتذكرة الحية وتوجه للعيادة عندما يقترب دورك للدخول فوراً.</div>
          </div>
        </div>
      </section>

      {/* Footer Navigation */}
      <div className="border-t border-[#e7e3da] pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4 text-xs text-slate-600">
          <button onClick={() => onNavigate('faq')} className="hover:underline font-bold">الأسئلة الشائعة</button>
          <span>•</span>
          <button onClick={() => onNavigate('about')} className="hover:underline font-bold">عن المنظومة</button>
          <span>•</span>
          <button onClick={() => onNavigate('privacy')} className="hover:underline font-bold">الخصوصية والأمان</button>
        </div>

        <button
          onClick={() => onNavigate('directory')}
          className="px-6 py-3 bg-[#122c4a] hover:bg-[#0d223a] text-white rounded-xl text-xs sm:text-sm font-bold shadow-2xs cursor-pointer transition flex items-center gap-2"
        >
          <span>تصفح دليل الأطباء والمعامل</span>
          <ArrowLeft className="w-3.5 h-3.5" />
        </button>
      </div>

    </div>
  );
};
