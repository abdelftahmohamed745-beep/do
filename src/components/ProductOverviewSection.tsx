import React from 'react';
import {
  Stethoscope,
  Users,
  Clock,
  ShieldCheck,
  CheckCircle2,
  Tv,
  FileText,
  CalendarCheck,
  QrCode,
  DollarSign,
  Bell,
  Smartphone,
  HelpCircle,
  ArrowLeft,
  ChevronLeft
} from 'lucide-react';

interface ProductOverviewSectionProps {
  onNavigate: (tab: any, options?: any) => void;
  onNavigateAuth: () => void;
}

export const ProductOverviewSection: React.FC<ProductOverviewSectionProps> = ({
  onNavigate,
  onNavigateAuth
}) => {
  return (
    <div className="space-y-12 my-12 pt-8 border-t border-[#e7e3da] font-['Tajawal',sans-serif]">
      
      {/* 1. What is Dory & Problems Solved (Brief & Crisp) */}
      <section aria-labelledby="quick-overview-title" className="bg-[#fdfcf9] rounded-2xl p-6 sm:p-8 border border-[#e7e3da] shadow-2xs space-y-6">
        <div className="max-w-3xl space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#edf3fa] border border-[#d1dfed] text-[#122c4a] font-bold text-xs">
            <Clock className="w-3.5 h-3.5 text-[#1b3a5c]" />
            <span>نظرة سريعة على نظام التشغيل</span>
          </div>
          <h2 id="quick-overview-title" className="text-xl sm:text-2xl font-bold text-[#122c4a]">
            ما هو دوري (Dory)؟ وما المشكلة التي يحلها؟
          </h2>
          <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
            نظام تشغيل سحابي متكامل ينهي عشوائية الانتظار الورقي وينظم جلسات العيادة اليومية ويوفر للمرضى تذاكر حضور رقمية حية.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="bg-[#faf8f5] p-4 rounded-xl border border-[#c4e5db] space-y-1.5">
            <span className="font-bold text-[#143d30] text-xs sm:text-sm block">🩺 للطبيب والعيادة الطبية</span>
            <p className="text-slate-600 text-xs leading-relaxed">
              تنظيم تدفق الكشوفات، تقليل الضغط على الاستقبال، أرشفة ملفات المرضى، إدارة جلسات العمل اليومية والأرشيف.
            </p>
          </div>

          <div className="bg-[#faf8f5] p-4 rounded-xl border border-[#e7e3da] space-y-1.5">
            <span className="font-bold text-[#b45309] text-xs sm:text-sm block">👥 للمريض والمراجع</span>
            <p className="text-slate-600 text-xs leading-relaxed">
              حجز فوري بدون تطبيق، تذكرة رقمية حية لمتابعة الدور والوقت المتوقع، واسترجاع سهل برقم الهاتف.
            </p>
          </div>
        </div>

        <div className="pt-2 flex items-center justify-between text-xs border-t border-[#f0ebe1]">
          <span className="text-slate-500">تريد معرفة المزيد عن فلسفة ورؤية النظام؟</span>
          <button
            onClick={() => onNavigate('about')}
            className="text-[#122c4a] font-bold hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>عن نظام دوري</span>
            <ArrowLeft className="w-3 h-3" />
          </button>
        </div>
      </section>

      {/* 2. Target Audiences */}
      <section aria-labelledby="tracks-title" className="space-y-4">
        <div className="text-center max-w-xl mx-auto space-y-1">
          <h2 id="tracks-title" className="text-xl sm:text-2xl font-bold text-[#122c4a]">
            مسارات مخصصة لكل مستخدم
          </h2>
          <p className="text-slate-600 text-xs sm:text-sm">اختر المسار المناسب لاستكشاف الميزات المخصصة لك:</p>
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          
          {/* Track 1: Clinics */}
          <div className="bg-[#fdfcf9] rounded-2xl p-5 border border-[#c4e5db] shadow-2xs space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-9 h-9 rounded-xl bg-[#eef7f4] text-[#143d30] flex items-center justify-center font-bold">
                <Stethoscope className="w-4 h-4 text-[#1c5242]" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm sm:text-base">العيادات والأطباء</h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  إدارة المواعيد، نداء المرضى في الطابور، شاشة TV View، جلسات العمل اليومية، والأرشيف المحفوظ.
                </p>
              </div>
              <ul className="text-xs text-slate-600 space-y-1">
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#1c5242]" />
                  <span>طابور حي وشاشة انتظار ذكية مع نداء صوتي</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#1c5242]" />
                  <span>جلسة يومية نشطة وإقفال اليوم بأرشيف مفصل</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#1c5242]" />
                  <span>سجلات المرضى ومواعيد الإعادة والإيرادات</span>
                </li>
              </ul>
            </div>
            <div className="pt-3 border-t border-[#f0ebe1] flex items-center justify-between">
              <button
                onClick={() => onNavigate('for-clinics')}
                className="text-xs font-bold text-[#1c5242] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>ميزات العيادات</span>
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onNavigateAuth()}
                className="px-3 py-1.5 bg-[#1c5242] hover:bg-[#143d30] text-white rounded-lg text-xs font-bold transition cursor-pointer"
              >
                تسجيل عيادة
              </button>
            </div>
          </div>

          {/* Track 2: Patients */}
          <div className="bg-[#fdfcf9] rounded-2xl p-5 border border-[#e7e3da] shadow-2xs space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-9 h-9 rounded-xl bg-[#faf8f5] text-[#b45309] flex items-center justify-center font-bold">
                <Users className="w-4 h-4 text-[#b45309]" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm sm:text-base">المرضى والمراجعون</h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  حجز فوري كـ Guest بدون حساب، متابعة الوقت المتبقي، والتنبيه التلقائي مع اقتراب الدور.
                </p>
              </div>
              <ul className="text-xs text-slate-600 space-y-1">
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#b45309]" />
                  <span>تذكرة رقمية حية على هاتفك مباشرة</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#b45309]" />
                  <span>استرجاع التذكرة بسهولة برقم هاتفك</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#b45309]" />
                  <span>حساب الوقت المتبقي وعدد الكشوفات أمامك</span>
                </li>
              </ul>
            </div>
            <div className="pt-3 border-t border-[#f0ebe1] flex items-center justify-between">
              <button
                onClick={() => onNavigate('for-patients')}
                className="text-xs font-bold text-[#b45309] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>دليل المرضى</span>
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  const el = document.getElementById('directory');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className="px-3 py-1.5 bg-[#faf8f5] hover:bg-[#f4efe6] text-slate-800 border border-[#e7e3da] rounded-lg text-xs font-bold transition cursor-pointer"
              >
                احجز كشفك
              </button>
            </div>
          </div>

        </div>
      </section>

      {/* 3. Top Features */}
      <section aria-labelledby="features-grid-title" className="space-y-4">
        <div className="text-center max-w-xl mx-auto space-y-1">
          <h2 id="features-grid-title" className="text-xl sm:text-2xl font-bold text-[#122c4a]">
            أهم ميزات ووظائف دوري للعيادات
          </h2>
          <p className="text-slate-600 text-xs sm:text-sm">أدوات متكاملة لإدارة جلسات العمل والانتظار باحترافية وبساطة:</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          
          <div className="bg-[#fdfcf9] p-3.5 rounded-xl border border-[#e7e3da] shadow-2xs space-y-1.5 text-center">
            <Smartphone className="w-5 h-5 text-[#122c4a] mx-auto" />
            <h3 className="font-bold text-slate-900 text-xs">الحجز الإلكتروني</h3>
            <p className="text-[11px] text-slate-500 leading-snug">حجز سريع كـ Guest بدون تطبيق</p>
          </div>

          <div className="bg-[#fdfcf9] p-3.5 rounded-xl border border-[#e7e3da] shadow-2xs space-y-1.5 text-center">
            <Users className="w-5 h-5 text-[#1c5242] mx-auto" />
            <h3 className="font-bold text-slate-900 text-xs">إدارة الطوابير الحية</h3>
            <p className="text-[11px] text-slate-500 leading-snug">تنظيم وترتيب الأدوار لحظياً</p>
          </div>

          <div className="bg-[#fdfcf9] p-3.5 rounded-xl border border-[#e7e3da] shadow-2xs space-y-1.5 text-center">
            <Tv className="w-5 h-5 text-[#122c4a] mx-auto" />
            <h3 className="font-bold text-slate-900 text-xs">شاشة الانتظار TV</h3>
            <p className="text-[11px] text-slate-500 leading-snug">عرض الأدوار مع نداء صوتي</p>
          </div>

          <div className="bg-[#fdfcf9] p-3.5 rounded-xl border border-[#e7e3da] shadow-2xs space-y-1.5 text-center">
            <CalendarCheck className="w-5 h-5 text-[#1c5242] mx-auto" />
            <h3 className="font-bold text-slate-900 text-xs">الجلسات والأرشيف</h3>
            <p className="text-[11px] text-slate-500 leading-snug">جلسات يومية وأرشفة متكاملة</p>
          </div>

          <div className="bg-[#fdfcf9] p-3.5 rounded-xl border border-[#e7e3da] shadow-2xs space-y-1.5 text-center">
            <FileText className="w-5 h-5 text-[#122c4a] mx-auto" />
            <h3 className="font-bold text-slate-900 text-xs">الملفات والروشتات</h3>
            <p className="text-[11px] text-slate-500 leading-snug">حفظ التشخيص وتاريخ الزيارات</p>
          </div>

          <div className="bg-[#fdfcf9] p-3.5 rounded-xl border border-[#e7e3da] shadow-2xs space-y-1.5 text-center">
            <QrCode className="w-5 h-5 text-[#1c5242] mx-auto" />
            <h3 className="font-bold text-slate-900 text-xs">باركود الاستقبال</h3>
            <p className="text-[11px] text-slate-500 leading-snug">تسجيل سريع بمسح الكود</p>
          </div>

          <div className="bg-[#fdfcf9] p-3.5 rounded-xl border border-[#e7e3da] shadow-2xs space-y-1.5 text-center">
            <DollarSign className="w-5 h-5 text-[#122c4a] mx-auto" />
            <h3 className="font-bold text-slate-900 text-xs">الإدارة المالية</h3>
            <p className="text-[11px] text-slate-500 leading-snug">حساب الإيرادات اليومية والخزينة</p>
          </div>

          <div className="bg-[#fdfcf9] p-3.5 rounded-xl border border-[#e7e3da] shadow-2xs space-y-1.5 text-center">
            <Bell className="w-5 h-5 text-[#1c5242] mx-auto" />
            <h3 className="font-bold text-slate-900 text-xs">التنبيهات الفورية</h3>
            <p className="text-[11px] text-slate-500 leading-snug">إشعار عند اقتراب موعد الدور</p>
          </div>

        </div>
      </section>

      {/* 4. Trust & Security */}
      <section aria-labelledby="privacy-trust-title" className="bg-[#fdfcf9] rounded-2xl p-6 sm:p-8 border border-[#e7e3da] shadow-2xs space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#edf3fa] text-[#122c4a] flex items-center justify-center font-bold">
            <ShieldCheck className="w-4 h-4 text-[#1b3a5c]" />
          </div>
          <div>
            <h2 id="privacy-trust-title" className="text-base sm:text-lg font-bold text-slate-900">
              الخصوصية وأمان البيانات في دوري
            </h2>
            <p className="text-xs text-slate-500">حماية مبنية على العزل السحابي والصلاحيات المحددة</p>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-4 text-xs">
          <div className="p-3.5 bg-[#faf8f5] rounded-xl border border-[#e7e3da] space-y-1">
            <span className="font-bold text-slate-800 block">عزل بيانات العيادات</span>
            <p className="text-slate-600 leading-relaxed">
              تخزين محمي بقواعد أمان Firestore يمنع وصول أي جهة غير مصرح لها لسجلات العيادة أو المرضى.
            </p>
          </div>

          <div className="p-3.5 bg-[#faf8f5] rounded-xl border border-[#e7e3da] space-y-1">
            <span className="font-bold text-slate-800 block">سرية بيانات المريض</span>
            <p className="text-slate-600 leading-relaxed">
              استخدام الاسم والهاتف فقط لإدارة الكشف، ولا يتم بيع أو مشاركة بيانات المرضى مع أي طرف إعلاني.
            </p>
          </div>

          <div className="p-3.5 bg-[#faf8f5] rounded-xl border border-[#e7e3da] space-y-1">
            <span className="font-bold text-slate-800 block">اتصال مشفر قياسياً</span>
            <p className="text-slate-600 leading-relaxed">
              نقل البيانات بالكامل عبر بروتوكول HTTPS المشفر (TLS) لضمان سلامة وسرية المعلومات عبر الإنترنت.
            </p>
          </div>
        </div>

        <div className="pt-2 flex items-center justify-end text-xs">
          <button
            onClick={() => onNavigate('privacy')}
            className="text-[#122c4a] font-bold hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>اقرأ سياسة الخصوصية وأمان البيانات بالكامل</span>
            <ArrowLeft className="w-3 h-3" />
          </button>
        </div>
      </section>

      {/* 5. Compact FAQ Snippet */}
      <section aria-labelledby="faq-snippet-title" className="bg-[#fdfcf9] rounded-2xl p-6 sm:p-8 border border-[#e7e3da] shadow-2xs space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-[#1b3a5c]" />
            <h2 id="faq-snippet-title" className="text-lg sm:text-xl font-bold text-slate-900">
              أسئلة شائعة سريعة
            </h2>
          </div>
          <button
            onClick={() => onNavigate('faq')}
            className="text-xs font-bold text-[#122c4a] hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>عرض جميع الأسئلة (FAQ)</span>
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 text-xs sm:text-sm">
          <div className="bg-[#faf8f5] p-4 rounded-xl border border-[#e7e3da] space-y-1">
            <h3 className="font-bold text-[#122c4a]">هل يحتاج المريض لتحميل تطبيق؟</h3>
            <p className="text-slate-600 leading-relaxed text-xs">
              لا، يعمل دوري مباشرة عبر أي متصفح هاتف ذكي (Safari, Chrome) دون الحاجة لتثبيت أي تطبيق.
            </p>
          </div>

          <div className="bg-[#faf8f5] p-4 rounded-xl border border-[#e7e3da] space-y-1">
            <h3 className="font-bold text-[#1c5242]">هل يمكن الحجز بدون إنشاء حساب؟</h3>
            <p className="text-slate-600 leading-relaxed text-xs">
              نعم، يدعم دوري الحجز كـ Guest فوراً بمجرد إدخال الاسم ورقم الهاتف ونوع الكشف.
            </p>
          </div>

          <div className="bg-[#faf8f5] p-4 rounded-xl border border-[#e7e3da] space-y-1">
            <h3 className="font-bold text-[#122c4a]">كيف يسترجع المريض تذكرته إذا أغلق المتصفح؟</h3>
            <p className="text-slate-600 leading-relaxed text-xs">
              يتم حفظ التذكرة محلياً، ويمكن استرجاعها فوراً بإدخال رقم الهاتف في صفحة العيادة.
            </p>
          </div>

          <div className="bg-[#faf8f5] p-4 rounded-xl border border-[#e7e3da] space-y-1">
            <h3 className="font-bold text-[#1c5242]">هل يدعم النظام شاشات التلفزيون في صالة الانتظار؟</h3>
            <p className="text-slate-600 leading-relaxed text-xs">
              نعم، يوفر وضع TV View لعرض الرقم الحالي والأدوار القادمة مع نداء صوتي آلي واضح.
            </p>
          </div>
        </div>
      </section>

    </div>
  );
};
