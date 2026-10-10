import React, { useEffect, useState } from 'react';
import {
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Stethoscope,
  Users,
  ShieldCheck,
  Search,
  ArrowLeft
} from 'lucide-react';
import { setPageSeo, FAQ_PAGE_SEO } from '../../utils/seo';

interface FaqPageProps {
  onNavigate: (tab: any, options?: any) => void;
  onNavigateAuth: () => void;
}

interface FaqItem {
  id: string;
  category: 'patients' | 'clinics' | 'privacy';
  question: string;
  answer: string;
}

const FAQ_LIST: FaqItem[] = [
  {
    id: 'p1',
    category: 'patients',
    question: 'هل يحتاج المريض لتحميل تطبيق لحجز الدور في دوري؟',
    answer: 'لا، تعمل منصة دوري مباشرة عبر أي متصفح هاتف ذكي (سفاري، كروم، إيدج) دون الحاجة لتثبيت أي تطبيق أو استهلاك ذاكرة الهاتف.'
  },
  {
    id: 'p2',
    category: 'patients',
    question: 'هل يمكن للمريض حجز دوره بدون تسجيل حساب؟',
    answer: 'نعم، يدعم دوري الحجز السريع كزائر (Guest Booking) بمجرد كتابة الاسم ورقم الهاتف واختيار نوع الكشف، دون الحاجة لإنشاء حساب أو تذكر كلمة مرور.'
  },
  {
    id: 'p3',
    category: 'patients',
    question: 'كيف يسترجع المريض تذكرته إذا أغلق صفحة المتصفح بالخطأ؟',
    answer: 'يتم حفظ التذكرة محلياً في جهاز المريض. كما توفر صفحة العيادة خيار "استرجاع التذكرة" بإدخال رقم الهاتف المسجل لتظهر التذكرة الحالية وتفاصيل الدور مباشرة.'
  },
  {
    id: 'p4',
    category: 'patients',
    question: 'هل يعرف المريض عدد المنتظرين قبله في العيادة؟',
    answer: 'نعم، تعرض التذكرة الرقمية الحية رقمك في الطابور، ورقم الكشف الجاري فحصه حالياً، وعدد المرضى المتبقين قبلك مع الوقت التقديري المتوقع للدخول.'
  },
  {
    id: 'c1',
    category: 'clinics',
    question: 'كيف تعمل جلسات العمل اليومية (Daily Sessions)؟',
    answer: 'يعتمد دوري على جلسة عمل يومية نشطة لكل عيادة. يتم فتح الجلسة في بداية اليوم، وعند اكتمال الكشوفات يقوم الطبيب بإنهاء اليوم (Complete Day)، ليتم أرشفة الإحصائيات والإيرادات وقفل الطابور وحفظ سجل كامل للأرشيف.'
  },
  {
    id: 'c2',
    category: 'clinics',
    question: 'كيف تعمل شاشة التلفزيون في صالة الانتظار (TV View)؟',
    answer: 'يفتح مسؤول الاستقبال أو الطبيب رابط شاشة الانتظار (TV View) على أي شاشة تلفزيون سمارت أو كمبيوتر متصل بالإنترنت. تعرض الشاشة الدور الحالي التالي مع تنبيه صوتي آلي واضح باللغة العربية عند نداء كل مريض.'
  },
  {
    id: 'c3',
    category: 'clinics',
    question: 'هل يستطيع الطبيب دعوة مساعدين أو سكرتارية للعيادة؟',
    answer: 'نعم، توفر المنصة نظام دعوات فريق العمل (Clinic Team Invitations) لمنح المساعدين صلاحيات محددة لإدارة الطابور وتسجيل الحضور المباشر دون الوصول لإعدادات الطبيب الحساسة.'
  },
  {
    id: 'c4',
    category: 'clinics',
    question: 'كيف تتم إدارة مواعيد إعادة الكشف والاستشارات؟',
    answer: 'يمكن للطبيب أو المساعد تحديد موعد إعادة الكشف للمريض خلال فترة السماح المقررة، ليتم إدراجه تلقائياً في قائمة اليوم المحدد وتذكيره بموعده.'
  },
  {
    id: 'c5',
    category: 'clinics',
    question: 'هل تتوفر تقارير مالية لخزينة العيادة؟',
    answer: 'نعم، تحتوي لوحة التحكم على مدير مالي لتسجيل إيرادات الكشوفات والمصروفات وحساب صافي الدخل اليومي والشهري مع خيارات الطباعة والتصدير.'
  },
  {
    id: 'sec1',
    category: 'privacy',
    question: 'هل بيانات المرضى وسجلاتهم الطبية معزولة ومحمية؟',
    answer: 'نعم، تعتمد منصة دوري قواعد أمان صارمة في قاعدة البيانات (Firestore Security Rules) تضمن عزل بيانات كل عيادة تماماً، بحيث لا يتاح الاطلاع على السجل الطبي إلا للطبيب المعالج وفريق عيادته المصرح لهم.'
  }
];

export const FaqPage: React.FC<FaqPageProps> = ({ onNavigate, onNavigateAuth }) => {
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'patients' | 'clinics' | 'privacy'>('all');
  const [openItems, setOpenItems] = useState<string[]>(['p1', 'p2', 'c1', 'c2']);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setPageSeo(FAQ_PAGE_SEO);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const toggleItem = (id: string) => {
    setOpenItems((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const filteredFaqs = FAQ_LIST.filter((item) => {
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch = !q || item.question.toLowerCase().includes(q) || item.answer.toLowerCase().includes(q);
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10 font-['Tajawal',sans-serif]">
      
      {/* Header */}
      <header className="space-y-4 text-center max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#edf3fa] border border-[#d1dfed] text-[#122c4a] font-bold text-xs">
          <HelpCircle className="w-3.5 h-3.5 text-[#1b3a5c]" />
          <span>مركز الأسئلة الشائعة والمساعدة</span>
        </div>

        <h1 className="text-2xl sm:text-4xl font-extrabold text-[#122c4a] tracking-tight">
          الأسئلة الأكثر شيوعاً حول نظام دوري للعيادات
        </h1>

        <p className="text-slate-600 text-xs sm:text-sm">
          إجابات واضحة ومباشرة حول كيفية عمل نظام دوري، تجربة حجز المرضى، وإدارة الطوابير والجلسات في العيادة.
        </p>

        {/* Search Bar */}
        <div className="relative max-w-md mx-auto pt-2">
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-5.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث عن سؤالك هنا..."
            className="w-full pl-4 pr-10 py-2.5 bg-[#fdfcf9] border border-[#e7e3da] rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-[#122c4a] transition"
          />
        </div>
      </header>

      {/* Category Filter Tabs */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          onClick={() => setSelectedCategory('all')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            selectedCategory === 'all'
              ? 'bg-[#122c4a] text-white shadow-2xs'
              : 'bg-[#fdfcf9] text-slate-700 hover:bg-[#edf3fa] border border-[#e7e3da]'
          }`}
        >
          الكل ({FAQ_LIST.length})
        </button>

        <button
          onClick={() => setSelectedCategory('patients')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
            selectedCategory === 'patients'
              ? 'bg-[#122c4a] text-white shadow-2xs'
              : 'bg-[#fdfcf9] text-slate-700 hover:bg-[#edf3fa] border border-[#e7e3da]'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>أسئلة المرضى والمراجعين</span>
        </button>

        <button
          onClick={() => setSelectedCategory('clinics')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
            selectedCategory === 'clinics'
              ? 'bg-[#122c4a] text-white shadow-2xs'
              : 'bg-[#fdfcf9] text-slate-700 hover:bg-[#edf3fa] border border-[#e7e3da]'
          }`}
        >
          <Stethoscope className="w-3.5 h-3.5" />
          <span>أسئلة الأطباء والعيادات</span>
        </button>

        <button
          onClick={() => setSelectedCategory('privacy')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
            selectedCategory === 'privacy'
              ? 'bg-[#122c4a] text-white shadow-2xs'
              : 'bg-[#fdfcf9] text-slate-700 hover:bg-[#edf3fa] border border-[#e7e3da]'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>الخصوصية والأمان</span>
        </button>
      </div>

      {/* Accordion Questions List */}
      <div className="space-y-3">
        {filteredFaqs.length === 0 ? (
          <div className="text-center py-12 bg-[#fdfcf9] rounded-2xl border border-[#e7e3da] p-6">
            <p className="text-slate-500 text-xs sm:text-sm">لم نتمكن من العثور على سؤال يطابق بحثك.</p>
          </div>
        ) : (
          filteredFaqs.map((item) => {
            const isOpen = openItems.includes(item.id);
            return (
              <div
                key={item.id}
                className="bg-[#fdfcf9] rounded-2xl border border-[#e7e3da] shadow-2xs overflow-hidden transition"
              >
                <button
                  onClick={() => toggleItem(item.id)}
                  className="w-full p-4 sm:p-5 text-right flex items-center justify-between gap-4 font-bold text-slate-900 text-xs sm:text-sm hover:bg-[#faf8f5] transition cursor-pointer"
                >
                  <span>{item.question}</span>
                  <div className="w-7 h-7 rounded-lg bg-[#edf3fa] text-[#122c4a] flex items-center justify-center shrink-0">
                    {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </button>

                {isOpen && (
                  <div className="px-4 sm:px-5 pb-5 pt-1 text-slate-600 text-xs sm:text-sm leading-relaxed border-t border-[#f0ebe1] bg-[#faf8f5]">
                    {item.answer}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Bottom Help & Navigation */}
      <div className="border-t border-[#e7e3da] pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4 text-xs text-slate-600">
          <button onClick={() => onNavigate('about')} className="hover:underline font-bold">عن النظام</button>
          <span>•</span>
          <button onClick={() => onNavigate('for-clinics')} className="hover:underline font-bold">للعيادات</button>
          <span>•</span>
          <button onClick={() => onNavigate('for-patients')} className="hover:underline font-bold">للمرضى</button>
          <span>•</span>
          <button onClick={() => onNavigate('privacy')} className="hover:underline font-bold">الخصوصية</button>
        </div>

        <a
          href="https://wa.me/201032120351"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-4 py-2 rounded-xl transition"
        >
          لديك استفسار آخر؟ تواصل عبر واتساب
        </a>
      </div>

    </div>
  );
};
