import React, { useEffect, useState } from 'react';
import {
  Phone,
  MessageCircle,
  MapPin,
  Clock,
  Calendar,
  Stethoscope,
  Building,
  User,
  CheckCircle2,
  Share2,
  ArrowRight,
  Info,
  DollarSign,
  Image as ImageIcon,
  Ticket,
  Star,
  MessageSquare
} from 'lucide-react';
import { DoctorProfile, DoctorRating } from '../types';
import { getDoctorProfile, formatPhoneNumberForUrl, getDoctorRatings } from '../services/firebaseService';
import { setPageSeo, getDoctorSeoData, DEFAULT_HOMEPAGE_SEO } from '../utils/seo';

interface ClinicProfilePageProps {
  doctorId: string;
  onBookTurn: (doctorId: string) => void;
  onBackToDirectory: () => void;
  onShowToast: (title: string, message?: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export const ClinicProfilePage: React.FC<ClinicProfilePageProps> = ({
  doctorId,
  onBookTurn,
  onBackToDirectory,
  onShowToast
}) => {
  const [doctor, setDoctor] = useState<DoctorProfile | null>(null);
  const [ratings, setRatings] = useState<DoctorRating[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('[DIAGNOSTIC] CLINIC_PROFILE_RENDER', {
      url: typeof window !== 'undefined' ? window.location.href : '',
      path: typeof window !== 'undefined' ? window.location.pathname : '',
      search: typeof window !== 'undefined' ? window.location.search : '',
    });

    const handleBeforeUnload = () => {
      console.log('[DIAGNOSTIC] PAGE_RELOAD');
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', handleBeforeUnload);
    }

    let isMounted = true;
    async function load() {
      setLoading(true);
      const [profile, rList] = await Promise.all([
        getDoctorProfile(doctorId),
        getDoctorRatings(doctorId)
      ]);
      if (isMounted) {
        if (profile) {
          if (rList.length > 0) {
            const calculatedAvg = parseFloat((rList.reduce((acc, r) => acc + (Number(r.stars) || 0), 0) / rList.length).toFixed(1));
            profile.ratingAverage = calculatedAvg;
            profile.ratingCount = rList.length;
          }
          setDoctor(profile);
          setRatings(rList);
          setLoading(false);
          setPageSeo(getDoctorSeoData(profile));
        } else {
          setDoctor(null);
          setLoading(false);
          setPageSeo({
            title: 'العيادة غير موجودة | منصة دوري',
            description: 'لم نتمكن من العثور على العيادة أو الطبيب المطلوب في منصة دوري.',
            canonicalUrl: `https://dory-system.vercel.app/clinic/${doctorId}`,
            robots: 'noindex, nofollow'
          });
        }
      }
    }
    load();
    return () => {
      isMounted = false;
      setPageSeo(DEFAULT_HOMEPAGE_SEO);
      if (typeof window !== 'undefined') {
        window.removeEventListener('beforeunload', handleBeforeUnload);
      }
    };
  }, [doctorId]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="w-12 h-12 border-4 border-sky-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-600 font-semibold text-sm">جاري تحميل بيانات صفحة العيادة...</p>
      </div>
    );
  }

  if (!doctor) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-xl">
          <Building className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">العيادة غير موجودة</h2>
          <p className="text-xs text-slate-500 mb-6">لم نتمكن من العثور على بيانات الطبيب أو العيادة المطلوبة.</p>
          <button
            onClick={onBackToDirectory}
            className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition"
          >
            العودة إلى دليل الأطباء والعيادات
          </button>
        </div>
      </div>
    );
  }

  const rawPhone = doctor.phone ? doctor.phone.trim() : "";
  const rawWhatsapp = doctor.whatsappNumber ? doctor.whatsappNumber.trim() : rawPhone;
  
  const cleanPhone = formatPhoneNumberForUrl(rawPhone);
  const cleanWhatsapp = formatPhoneNumberForUrl(rawWhatsapp);

  const hasPhone = Boolean(cleanPhone && cleanPhone.length > 5);
  const hasWhatsapp = Boolean(cleanWhatsapp && cleanWhatsapp.length > 5);

  const handleCopyClinicLink = () => {
    const url = `${window.location.origin}/clinic/${doctor.uid}/book`;
    navigator.clipboard.writeText(url);
    onShowToast("تم نسخ رابط حجز العيادة المباشر بنجاح", "", "success");
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      
      {/* Back Navigation Header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <button
          onClick={onBackToDirectory}
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-2xs transition"
        >
          <ArrowRight className="w-4 h-4" />
          <span>العودة لدليل الأطباء</span>
        </button>

        <button
          onClick={handleCopyClinicLink}
          className="inline-flex items-center gap-2 text-xs font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 px-4 py-2 rounded-xl border border-sky-200 transition"
        >
          <Share2 className="w-4 h-4" />
          <span>مشاركة رابط العيادة</span>
        </button>
      </div>

      {/* Main Doctor & Clinic Hero Header */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-xl mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-sky-50 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        
        <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start gap-6 text-center md:text-right">
          
          {/* Doctor Photo or Avatar */}
          <div className="relative shrink-0">
            {doctor.photoUrl ? (
              <img
                src={doctor.photoUrl}
                alt={doctor.name}
                className="w-28 h-28 sm:w-36 sm:h-36 rounded-3xl object-cover border-4 border-white shadow-xl bg-slate-100"
              />
            ) : (
              <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-3xl bg-gradient-to-br from-sky-600 to-teal-600 text-white flex items-center justify-center font-black text-4xl shadow-xl border-4 border-white">
                {doctor.name ? doctor.name.replace("د.", "").trim().charAt(0) : "ط"}
              </div>
            )}
            <div className="absolute -bottom-2 right-1/2 translate-x-1/2 md:translate-x-0 md:right-2 bg-emerald-500 text-white px-2.5 py-0.5 rounded-full text-[10px] font-bold shadow-md flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              <span>عيادة مفعّلة</span>
            </div>
          </div>

          {/* Doctor Info */}
          <div className="flex-1 space-y-3">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-sky-50 border border-sky-100 text-sky-700 rounded-full text-xs font-bold">
                <Stethoscope className="w-3.5 h-3.5" />
                <span>{doctor.specialty}</span>
              </div>

              {doctor.ratingAverage && doctor.ratingAverage > 0 ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200 text-amber-900 rounded-full text-xs font-black">
                  <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                  <span>{doctor.ratingAverage} / 5</span>
                  <span className="text-slate-400 font-normal">({doctor.ratingCount || ratings.length} تقييم)</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-1 px-3 py-1 bg-slate-50 border border-slate-200 text-slate-500 rounded-full text-xs font-semibold">
                  <Star className="w-3.5 h-3.5 text-slate-400" />
                  <span>لا يوجد تقييمات بعد</span>
                </div>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 font-['Tajawal',sans-serif]">
              {doctor.name}
            </h1>

            <div className="text-sm font-bold text-slate-700 flex items-center justify-center md:justify-start gap-2">
              <Building className="w-4 h-4 text-sky-600" />
              <span>{doctor.clinicName}</span>
            </div>

            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-xs text-slate-500 font-medium pt-1">
              {doctor.address && (
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>{doctor.city ? `${doctor.city} - ${doctor.address}` : doctor.address}</span>
                </div>
              )}
              {doctor.workHours && (
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>
                    {doctor.workHours.open} - {doctor.workHours.close} (حتى {doctor.workHours.maxPatientsPerDay} مريض يومياً)
                  </span>
                </div>
              )}
            </div>

            {/* Direct Action Phone & WhatsApp Buttons (Strictly if doctor provided number) */}
            <div className="pt-4 flex flex-wrap items-center justify-center md:justify-start gap-3">
              
              {/* Call Button */}
              {hasPhone ? (
                <a
                  href={`tel:${cleanPhone}`}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs sm:text-sm font-extrabold shadow-md transition active:scale-95"
                >
                  <Phone className="w-4 h-4" />
                  <span>اتصل بالطبيب ({rawPhone})</span>
                </a>
              ) : null}

              {/* WhatsApp Button */}
              {hasWhatsapp ? (
                <a
                  href={`https://wa.me/${cleanWhatsapp}?text=${encodeURIComponent(`مرحبًا دكتور ${doctor.name}، أريد الاستفسار وحجز موعد في عيادتكم.`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs sm:text-sm font-extrabold shadow-md transition active:scale-95"
                >
                  <MessageCircle className="w-4 h-4 fill-current" />
                  <span>تواصل مع الطبيب عبر واتساب</span>
                </a>
              ) : null}

              {/* Book Turn Button */}
              <button
                type="button"
                onClick={() => {
                  console.log('[DIAGNOSTIC] BOOKING_CLICK');
                  console.log('[DIAGNOSTIC] BEFORE_URL', typeof window !== 'undefined' ? window.location.href : '');
                  onBookTurn(doctor.uid);
                  setTimeout(() => {
                    console.log('[DIAGNOSTIC] AFTER_URL', typeof window !== 'undefined' ? window.location.href : '');
                  }, 300);
                }}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-teal-800 hover:bg-teal-900 text-white rounded-xl text-xs sm:text-sm font-bold shadow-2xs transition active:scale-95 cursor-pointer relative z-10"
              >
                <Ticket className="w-4 h-4" />
                <span>احجز دورك الآن أونلاين</span>
              </button>

            </div>

          </div>

        </div>

      </div>

      {/* Grid: Bio, Working Hours, Services & Pricing */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        
        {/* Left 2 Cols: About & Services */}
        <div className="md:col-span-2 space-y-6">
          
          {/* About Doctor & Clinic */}
          <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-sm">
            <h3 className="text-base font-bold text-slate-900 mb-3 flex items-center gap-2 font-['Tajawal',sans-serif]">
              <User className="w-5 h-5 text-sky-600" />
              <span>نبذة عن الطبيب والعيادة</span>
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed whitespace-pre-line">
              {doctor.description || "أهلاً بكم في عيادتنا. نسعى دائماً لتقديم أعلى مستويات الرعاية الصحية والتخصصية المتميزة لمرضانا الكرام."}
            </p>
          </div>

          {/* Services & Prices */}
          {doctor.servicesAndPrices && doctor.servicesAndPrices.length > 0 && (
            <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-sm">
              <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2 font-['Tajawal',sans-serif]">
                <DollarSign className="w-5 h-5 text-emerald-600" />
                <span>الخدمات الطبية وقائمة الأسعار</span>
              </h3>
              <div className="divide-y divide-slate-100">
                {doctor.servicesAndPrices.map((srv, idx) => (
                  <div key={idx} className="py-3 flex items-center justify-between text-xs sm:text-sm">
                    <span className="font-bold text-slate-800">{srv.serviceName}</span>
                    <span className="font-extrabold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                      {srv.price}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Clinic Photos Gallery */}
          {doctor.clinicPhotos && doctor.clinicPhotos.length > 0 && (
            <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-sm">
              <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2 font-['Tajawal',sans-serif]">
                <ImageIcon className="w-5 h-5 text-sky-600" />
                <span>صور من العيادة</span>
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {doctor.clinicPhotos.map((url, idx) => (
                  <img
                    key={idx}
                    src={url}
                    alt={`صور العيادة ${idx + 1}`}
                    className="w-full h-28 object-cover rounded-2xl border border-slate-200 shadow-xs hover:scale-105 transition"
                  />
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Right 1 Col: Working Hours & Contact Card */}
        <div className="space-y-6">
          
          {/* Work Hours Card */}
          <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-sm">
            <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2 font-['Tajawal',sans-serif]">
              <Calendar className="w-5 h-5 text-amber-500" />
              <span>مواعيد العمل في العيادة</span>
            </h3>

            <div className="space-y-3 text-xs sm:text-sm">
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-slate-500">ساعات الدوام:</span>
                <span className="font-bold text-slate-900">{doctor.workHours?.open} - {doctor.workHours?.close}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-slate-500">متوسط زمن الاستشارة:</span>
                <span className="font-bold text-sky-700">{doctor.avgConsultTime} دقيقة</span>
              </div>
              <div className="py-2">
                <span className="text-slate-500 block mb-1.5">أيام استقبال المرضى:</span>
                <div className="flex flex-wrap gap-1.5">
                  {doctor.workHours?.daysOfWeek?.map((day, dIdx) => (
                    <span key={dIdx} className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-[11px] font-bold">
                      {day}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Contact Direct Card */}
          <div className="bg-gradient-to-br from-slate-900 to-sky-950 text-white rounded-3xl p-6 shadow-xl space-y-4">
            <h4 className="font-extrabold text-sm font-['Tajawal',sans-serif] text-sky-300">
              تواصل حقيقي مع العيادة
            </h4>

            {hasPhone || hasWhatsapp ? (
              <div className="space-y-2.5 text-xs">
                {hasPhone && (
                  <a
                    href={`tel:${cleanPhone}`}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-white text-slate-900 rounded-xl font-bold hover:bg-slate-100 transition"
                  >
                    <Phone className="w-4 h-4 text-sky-600" />
                    <span>اتصال تلفوني مباشر</span>
                  </a>
                )}
                {hasWhatsapp && (
                  <a
                    href={`https://wa.me/${cleanWhatsapp}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-500 transition"
                  >
                    <MessageCircle className="w-4 h-4 fill-current" />
                    <span>واتساب العيادة المباشر</span>
                  </a>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-300 leading-relaxed">
                لم يقم الطبيب بإدخال رقم هاتف مباشر حتى الآن. يمكنك حجز الدور مباشرة عبر النظام الرقمي.
              </p>
            )}

            <hr className="border-slate-800" />

            {/* Platform Admin Support Info (Requirement 12) */}
            <div className="text-[11px] text-slate-400 space-y-1">
              <span className="font-bold text-slate-200 block">للدعم وإدارة منصة دوري:</span>
              <a
                href="https://wa.me/201032120351"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-400 hover:underline flex items-center gap-1 font-bold"
              >
                <MessageCircle className="w-3 h-3 fill-current" />
                <span>01032120351 (واتساب الإدارة)</span>
              </a>
            </div>

          </div>

        </div>

      </div>

      {/* Patient Reviews & Ratings Section */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-100">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-800 rounded-full text-xs font-bold border border-amber-200 mb-2">
              <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
              <span>تقييمات وآراء المرضى الحقيقية</span>
            </div>
            <h3 className="text-xl font-extrabold text-slate-900 font-['Tajawal',sans-serif]">
              انطباعات مرضى {doctor.clinicName}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              يتم جمع التقييمات تلقائياً من المرضى بعد اكتمال كشفهم الطبي بنجاح عبر النظام
            </p>
          </div>

          {/* Score Summary Box */}
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 p-4 rounded-2xl text-center shrink-0 w-full sm:w-auto">
            <div className="text-3xl font-black text-amber-900 font-['Tajawal',sans-serif] flex items-center justify-center gap-1 dir-ltr">
              <Star className="w-7 h-7 text-amber-500 fill-amber-500" />
              <span>{doctor.ratingAverage ? doctor.ratingAverage : "0.0"}</span>
            </div>
            <div className="text-xs font-bold text-amber-800 mt-1">
              {ratings.length > 0 ? `بناءً على ${ratings.length} تقييم` : "لا يوجد تقييمات حتى الآن"}
            </div>
          </div>
        </div>

        {/* Reviews List */}
        {ratings.length === 0 ? (
          <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            <MessageSquare className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h4 className="font-bold text-slate-700 text-sm mb-1">لا توجد آراء مسجلة لهذا الطبيب بعد</h4>
            <p className="text-xs text-slate-500">
              تظهر التقييمات هنا بعد قيام المرضى بتقييم زيارتهم عند انتهاء الدور
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {ratings.map((rev) => {
              const reviewDate = rev.createdAt ? new Date(rev.createdAt).toLocaleDateString('ar-EG', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              }) : '';

              return (
                <div key={rev.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-xs sm:text-sm font-['Tajawal',sans-serif]">
                      {rev.patientName || "مريض"}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {reviewDate}
                    </span>
                  </div>

                  {/* Stars */}
                  <div className="flex items-center gap-1 dir-ltr">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`w-4 h-4 ${
                          s <= rev.stars ? 'text-amber-400 fill-amber-400' : 'text-slate-200'
                        }`}
                      />
                    ))}
                  </div>

                  {rev.comment ? (
                    <p className="text-xs text-slate-700 leading-relaxed font-medium bg-white p-3 rounded-xl border border-slate-100">
                      "{rev.comment}"
                    </p>
                  ) : (
                    <p className="text-[11px] text-slate-400 italic">
                      (تقييم بالنجوم بدون تعليق نصي)
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
};
