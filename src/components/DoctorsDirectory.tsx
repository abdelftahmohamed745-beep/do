import React, { useState, useEffect } from 'react';
import {
  Search,
  MapPin,
  Calendar,
  Clock,
  Phone,
  MessageCircle,
  Eye,
  Star,
  Building,
  Stethoscope,
  ShieldCheck,
  CheckCircle2,
  ArrowLeft,
  X,
  Map,
  Filter,
  RotateCcw
} from 'lucide-react';
import { DoctorProfile, MEDICAL_SPECIALTIES } from '../types';
import { getAllDoctors, formatPhoneNumberForUrl } from '../services/firebaseService';
import { CustomWebsiteSection } from './CustomWebsiteSection';
import { ProductOverviewSection } from './ProductOverviewSection';

interface DoctorsDirectoryProps {
  onSelectDoctorClinic: (doctorId: string) => void;
  onBookTurn: (doctorId: string) => void;
  onNavigateAuth: () => void;
  onNavigate: (tab: any, options?: any) => void;
  onShowToast: (title: string, message?: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export const DoctorsDirectory: React.FC<DoctorsDirectoryProps> = ({
  onSelectDoctorClinic,
  onBookTurn,
  onNavigateAuth,
  onNavigate,
  onShowToast
}) => {
  const [profiles, setProfiles] = useState<DoctorProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('all');
  const [selectedCity, setSelectedCity] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function loadDirectory() {
      setLoading(true);
      try {
        const doctorsList = await getAllDoctors();
        if (isMounted) {
          setProfiles(doctorsList);
          setLoading(false);
        }
      } catch (err) {
        console.error("Error loading doctors directory:", err);
        if (isMounted) setLoading(false);
      }
    }
    loadDirectory();
    return () => {
      isMounted = false;
    };
  }, []);

  // Filter profiles by search query, specialty, and city
  const filteredProfiles = profiles.filter((item) => {
    const query = searchQuery.trim().toLowerCase();

    const nameMatch = item.name?.toLowerCase().includes(query);
    const specMatch = item.specialty?.toLowerCase().includes(query);
    const clinicMatch = item.clinicName?.toLowerCase().includes(query);
    const cityMatch = item.city?.toLowerCase().includes(query) || item.address?.toLowerCase().includes(query);

    const matchesSearch = !query || nameMatch || specMatch || clinicMatch || cityMatch;

    const matchesSpecialty =
      selectedSpecialty === 'all' ||
      item.specialty === selectedSpecialty;

    const matchesCity =
      selectedCity === 'all' ||
      item.city === selectedCity ||
      item.address?.includes(selectedCity);

    return matchesSearch && matchesSpecialty && matchesCity;
  });

  // Extract unique cities
  const cities = Array.from(
    new Set(profiles.map((d) => d.city || d.address?.split('،')[0] || 'بغداد').filter(Boolean))
  );

  const hasActiveFilters = searchQuery !== '' || selectedSpecialty !== 'all' || selectedCity !== 'all';

  const resetAllFilters = () => {
    setSearchQuery('');
    setSelectedSpecialty('all');
    setSelectedCity('all');
  };

  const handleScrollToSearch = () => {
    const el = document.getElementById('directory');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
    setTimeout(() => {
      const input = document.getElementById('search-input');
      if (input) {
        input.focus();
      }
    }, 300);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10 font-['Tajawal',sans-serif]">
      
      {/* Hero Header Section */}
      <header className="text-center max-w-3xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#eef7f4] border border-[#c4e5db] text-[#143d30] font-bold text-xs">
          <ShieldCheck className="w-3.5 h-3.5 text-[#1c5242]" />
          <span>منظومة تشغيل العيادات الطبية — دوري</span>
        </div>

        <h1 className="text-2xl sm:text-4xl font-extrabold text-[#122c4a] tracking-tight leading-snug font-['Tajawal',sans-serif]">
          دوري (Dory) — نظام إدارة وتشغيل العيادات وتنظيم الانتظار
        </h1>

        <p className="text-slate-600 text-xs sm:text-sm leading-relaxed max-w-2xl mx-auto font-medium">
          نظام سحابي متكامل للأطباء والعيادات الطبية لتنظيم جلسات العمل اليومية، طوابير المرضى لحظياً، وحجز المواعيد، والسجلات الطبية.
        </p>

        {/* Hero Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            onClick={handleScrollToSearch}
            className="px-5 py-3 bg-[#fdfcf9] hover:bg-[#f4efe6] active:scale-[0.98] text-[#122c4a] font-bold text-xs sm:text-sm rounded-xl transition-all border border-[#e7e3da] shadow-2xs flex items-center gap-2 cursor-pointer"
          >
            <Search className="w-4 h-4 text-[#1b3a5c]" />
            <span>ابحث عن عيادة أو طبيب</span>
          </button>

          <button
            onClick={() => onNavigateAuth()}
            className="px-5 py-3 bg-[#1c5242] hover:bg-[#143d30] active:scale-[0.98] text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-2xs flex items-center gap-2 cursor-pointer"
          >
            <Stethoscope className="w-4 h-4 text-emerald-200" />
            <span>تسجيل عيادة جديدة مجاناً</span>
          </button>
        </div>
      </header>

      {/* Clinic Operating System Feature Card */}
      <section aria-label="بوابة العيادة الطبية" className="max-w-3xl mx-auto">
        <div className="bg-[#fdfcf9] rounded-2xl p-5 sm:p-6 border border-[#c4e5db] shadow-2xs hover:border-[#1c5242]/50 transition duration-150 flex flex-col sm:flex-row items-center justify-between gap-6 group">
          <div className="space-y-3 flex-1 text-right">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-[#eef7f4] text-[#143d30] flex items-center justify-center font-bold border border-[#c4e5db]">
                <Stethoscope className="w-5 h-5 text-[#1c5242]" />
              </div>
              <span className="text-[11px] font-bold text-[#143d30] bg-[#eef7f4] px-2.5 py-1 rounded-full border border-[#c4e5db]">
                🩺 للأطباء والعيادات
              </span>
            </div>

            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 group-hover:text-[#143d30] transition">
                إدارة العيادة وجلسات العمل اليومية
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed mt-1">
                بدء جلسة العمل اليومية، إدارة الطابور الحي، شاشة التلفزيون للانتظار، السجلات الطبية، وإنهاء اليوم مع تقرير الأرشيف المالي.
              </p>
            </div>

            <ul className="text-xs text-slate-600 space-y-1.5 pt-1">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#1c5242] shrink-0" />
                <span>جلسة يومية نشطة مع عزل كامل لطابور اليوم الحالي</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#1c5242] shrink-0" />
                <span>إقفال اليوم وأرشفة الإحصائيات والإيرادات بضغطة زر</span>
              </li>
            </ul>
          </div>

          <div className="w-full sm:w-auto shrink-0">
            <button
              onClick={() => onNavigateAuth()}
              className="w-full sm:w-auto px-6 py-3 bg-[#1c5242] hover:bg-[#143d30] active:scale-[0.98] text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs whitespace-nowrap"
            >
              <span>دخول / تسجيل حساب عيادة</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* Directory Section Anchor */}
      <div id="directory" className="pt-4">
        
        {/* Search & Filter Bar */}
        <section aria-label="البحث والفلترة" className="bg-[#fdfcf9] rounded-2xl p-5 shadow-2xs border border-[#e7e3da] mb-6 space-y-4">
          
          <div className="flex items-center justify-between border-b border-[#f0ebe1] pb-3">
            <span className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
              <Filter className="w-4 h-4 text-[#1c5242]" />
              <span>دليل العيادات الطبية المعتمدة ({profiles.length})</span>
            </span>

            {hasActiveFilters && (
              <button
                onClick={resetAllFilters}
                className="px-3 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-xl text-xs font-bold transition flex items-center gap-1 shrink-0 cursor-pointer"
                title="إعادة ضبط الفلاتر"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>مسح الفلاتر</span>
              </button>
            )}
          </div>

          {/* Search Input & Selectors */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            
            {/* Text Search Input */}
            <div className="relative md:col-span-6 w-full">
              <Search className="w-4 h-4 text-[#1b3a5c] absolute right-3.5 top-3.5" />
              <input
                id="search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث باسم الطبيب، التخصص، العيادة، أو المدينة..."
                className="w-full pl-8 pr-10 py-2.5 bg-[#fdfcf9] border border-[#e7e3da] rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-[#122c4a] transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute left-3 top-3 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                  title="مسح البحث"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Specialty Dropdown */}
            <div className="md:col-span-3">
              <select
                value={selectedSpecialty}
                onChange={(e) => setSelectedSpecialty(e.target.value)}
                className="w-full py-2.5 px-3 bg-[#fdfcf9] border border-[#e7e3da] rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#122c4a] transition cursor-pointer"
              >
                <option value="all">جميع التخصصات</option>
                {MEDICAL_SPECIALTIES.map((spec) => (
                  <option key={spec} value={spec}>
                    {spec}
                  </option>
                ))}
              </select>
            </div>

            {/* City Dropdown */}
            <div className="md:col-span-3">
              <select
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="w-full py-2.5 px-3 bg-[#fdfcf9] border border-[#e7e3da] rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#122c4a] transition cursor-pointer"
              >
                <option value="all">جميع المدن</option>
                {cities.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            </div>

          </div>
        </section>

        {/* Doctor Cards Grid */}
        <section aria-label="قائمة الأطباء والعيادات">
          {loading ? (
            <div className="py-16 text-center">
              <div className="w-8 h-8 border-3 border-[#122c4a] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-slate-500 font-semibold text-xs">جاري تحميل دليل العيادات...</p>
            </div>
          ) : filteredProfiles.length === 0 ? (
            <div className="bg-[#fdfcf9] rounded-2xl p-8 text-center border border-[#e7e3da] max-w-md mx-auto shadow-2xs">
              <Stethoscope className="w-10 h-10 text-[#1b3a5c] mx-auto mb-3 opacity-50" />
              <h3 className="font-bold text-slate-800 text-sm mb-1">لم نتمكن من العثور على عيادات مطابقة</h3>
              <p className="text-xs text-slate-500 mb-4">جرب البحث بكلمة أخرى أو تغيير خيارات الفلترة</p>
              <button
                onClick={resetAllFilters}
                className="px-4 py-2 bg-[#122c4a] hover:bg-[#0d223a] text-white rounded-xl text-xs font-bold cursor-pointer active:scale-95 transition"
              >
                إعادة ضبط جميع الفلاتر
              </button>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredProfiles.map((doc) => {
                const rawPhone = doc.phone ? doc.phone.trim() : "";
                const rawWhatsapp = doc.whatsappNumber ? doc.whatsappNumber.trim() : rawPhone;

                const cleanPhone = formatPhoneNumberForUrl(rawPhone);
                const cleanWhatsapp = formatPhoneNumberForUrl(rawWhatsapp);

                const hasPhone = Boolean(cleanPhone && cleanPhone.length > 5);
                const hasWhatsapp = Boolean(cleanWhatsapp && cleanWhatsapp.length > 5);

                const mapUrl = doc.googleMapsUrl || (doc.latitude && doc.longitude ? `https://maps.google.com/?q=${doc.latitude},${doc.longitude}` : null);

                return (
                  <div
                    key={doc.uid}
                    className="bg-[#fdfcf9] rounded-2xl border border-[#c4e5db] hover:border-[#1c5242]/40 p-5 shadow-2xs hover:shadow-xs transition duration-150 flex flex-col justify-between group relative"
                  >
                    <div>
                      
                      {/* Top Avatar & Specialty Badge */}
                      <div className="flex items-start gap-3 mb-3.5">
                        {doc.photoUrl ? (
                          <img
                            src={doc.photoUrl}
                            alt={doc.name}
                            className="w-14 h-14 rounded-xl object-cover border border-[#e7e3da] shadow-2xs shrink-0"
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-xl text-white flex items-center justify-center font-bold text-xl shadow-2xs shrink-0 bg-[#1c5242]">
                            {doc.name ? doc.name.replace("د.", "").trim().charAt(0) : "ط"}
                          </div>
                        )}

                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="inline-block px-2.5 py-0.5 font-bold text-[11px] rounded-full border bg-[#eef7f4] text-[#143d30] border-[#c4e5db]">
                              {doc.specialty}
                            </span>

                            {doc.ratingAverage && doc.ratingAverage > 0 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-900 font-bold text-[11px] rounded-full border border-amber-200">
                                <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                                <span>{doc.ratingAverage}</span>
                                <span className="text-slate-400 font-normal">({doc.ratingCount})</span>
                              </span>
                            ) : null}
                          </div>

                          <h3 className="font-bold text-slate-900 text-sm sm:text-base font-['Tajawal',sans-serif] transition truncate group-hover:text-[#143d30]">
                            {doc.name}
                          </h3>
                          <p className="text-xs text-slate-600 font-medium flex items-center gap-1">
                            <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{doc.clinicName}</span>
                          </p>
                        </div>
                      </div>

                      {/* City / Address & Map Link */}
                      <div className="text-xs text-slate-600 font-medium flex items-center justify-between gap-1.5 mb-3 bg-[#faf8f5] p-2.5 rounded-xl border border-[#e7e3da]">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <MapPin className="w-3.5 h-3.5 text-[#1b3a5c] shrink-0" />
                          <span className="truncate">{doc.city ? `${doc.city} - ${doc.address}` : doc.address}</span>
                        </div>
                        {mapUrl && (
                          <a
                            href={mapUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-[#122c4a] hover:underline font-bold flex items-center gap-1 shrink-0 bg-[#edf3fa] px-2 py-1 rounded-lg border border-[#d1dfed]"
                            title="عرض على الخريطة"
                          >
                            <Map className="w-3 h-3 text-[#1b3a5c]" />
                            <span>الخريطة</span>
                          </a>
                        )}
                      </div>

                      {/* Working Hours Badge */}
                      {doc.workHours && (
                        <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mb-3 px-0.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>ساعات العمل: {doc.workHours.open} - {doc.workHours.close}</span>
                        </div>
                      )}

                    </div>

                    {/* Bottom Action Buttons */}
                    <div className="pt-3 border-t border-[#f0ebe1] space-y-2">
                      
                      {/* Primary Row: View Clinic & Book Turn */}
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => onSelectDoctorClinic(doc.uid)}
                          className="w-full py-2 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer border bg-[#eef7f4] hover:bg-[#d8ede7] text-[#143d30] border-[#c4e5db]"
                        >
                          <Eye className="w-3.5 h-3.5 shrink-0" />
                          <span>عرض العيادة</span>
                        </button>

                        <button
                          onClick={() => onBookTurn(doc.uid)}
                          className="w-full py-2 active:scale-[0.98] text-white font-bold text-xs rounded-xl transition shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer bg-[#1c5242] hover:bg-[#143d30]"
                        >
                          <Clock className="w-3.5 h-3.5 shrink-0" />
                          <span>حجز دور</span>
                        </button>
                      </div>

                      {/* Direct Contact Buttons (Phone & WhatsApp) */}
                      {(hasPhone || hasWhatsapp) ? (
                        <div className="grid grid-cols-2 gap-2 pt-0.5">
                          {hasPhone ? (
                            <a
                              href={`tel:${cleanPhone}`}
                              className="py-1.5 bg-[#122c4a] hover:bg-[#0d223a] active:scale-[0.98] text-white rounded-xl text-[11px] font-bold transition flex items-center justify-center gap-1 text-center"
                            >
                              <Phone className="w-3 h-3 text-sky-300" />
                              <span>اتصال</span>
                            </a>
                          ) : (
                            <div className="py-1.5 bg-[#faf8f5] text-slate-400 rounded-xl text-[11px] font-medium text-center border border-dashed border-[#e7e3da]">
                              الهاتف غير مضاف
                            </div>
                          )}

                          {hasWhatsapp ? (
                            <a
                              href={`https://wa.me/${cleanWhatsapp}?text=${encodeURIComponent(`مرحبًا، أريد الاستفسار عن المواعيد والخدمات.`)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="py-1.5 bg-emerald-700 hover:bg-emerald-800 active:scale-[0.98] text-white rounded-xl text-[11px] font-bold transition flex items-center justify-center gap-1 text-center"
                            >
                              <MessageCircle className="w-3 h-3 fill-current" />
                              <span>واتساب</span>
                            </a>
                          ) : (
                            <div className="py-1.5 bg-[#faf8f5] text-slate-400 rounded-xl text-[11px] font-medium text-center border border-dashed border-[#e7e3da]">
                              الواتساب غير مضاف
                            </div>
                          )}
                        </div>
                      ) : null}

                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </section>

      </div>

      {/* SEO & Conversion Booster Section */}
      <CustomWebsiteSection
        onNavigateAuth={() => onNavigateAuth()}
        onShowToast={onShowToast}
      />

      {/* Product Overview Section */}
      <ProductOverviewSection
        onNavigate={onNavigate}
        onNavigateAuth={onNavigateAuth}
      />

    </div>
  );
};
