import React, { useState } from 'react';
import { X, Save, Clock, Stethoscope, Building, Phone, MapPin, MessageCircle, FileText, Plus, Trash2, Image as ImageIcon, Map, Sparkles } from 'lucide-react';
import { DoctorProfile, ClinicServiceItem, MEDICAL_SPECIALTIES } from '../types';
import { updateDoctorSettings } from '../services/firebaseService';
import { ImageUpload } from './ui/ImageUpload';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  doctor: DoctorProfile;
  onShowToast: (title: string, message?: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  doctor,
  onShowToast
}) => {
  const [name, setName] = useState(doctor.name || '');
  const [photoUrl, setPhotoUrl] = useState(doctor.photoUrl || '');
  const [specialty, setSpecialty] = useState(doctor.specialty || MEDICAL_SPECIALTIES[0]);
  const [clinicName, setClinicName] = useState(doctor.clinicName || '');
  const [city, setCity] = useState(doctor.city || 'بغداد');
  const [address, setAddress] = useState(doctor.address || '');
  const [googleMapsUrl, setGoogleMapsUrl] = useState(doctor.googleMapsUrl || '');
  const [phone, setPhone] = useState(doctor.phone || '');
  const [whatsappNumber, setWhatsappNumber] = useState(doctor.whatsappNumber || '');
  const [description, setDescription] = useState(doctor.description || '');
  const [avgConsultTime, setAvgConsultTime] = useState(doctor.avgConsultTime || 12);
  const [openTime, setOpenTime] = useState(doctor.workHours?.open || '09:00');
  const [closeTime, setCloseTime] = useState(doctor.workHours?.close || '21:00');
  const [maxPatients, setMaxPatients] = useState(doctor.workHours?.maxPatientsPerDay || 40);

  // Services & Prices
  const [services, setServices] = useState<ClinicServiceItem[]>(doctor.servicesAndPrices || []);
  const [newSrvName, setNewSrvName] = useState('');
  const [newSrvPrice, setNewSrvPrice] = useState('');

  // Clinic photos list
  const [clinicPhotos, setClinicPhotos] = useState<string[]>(doctor.clinicPhotos || []);

  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleAddService = () => {
    if (!newSrvName.trim()) return;
    setServices([...services, { serviceName: newSrvName.trim(), price: newSrvPrice.trim() || 'حسب الفحص' }]);
    setNewSrvName('');
    setNewSrvPrice('');
  };

  const handleRemoveService = (index: number) => {
    setServices(services.filter((_, i) => i !== index));
  };

  const handleAddClinicPhoto = (dataUrl: string) => {
    if (!dataUrl) return;
    setClinicPhotos([...clinicPhotos, dataUrl]);
  };

  const handleRemoveClinicPhoto = (index: number) => {
    setClinicPhotos(clinicPhotos.filter((_, i) => i !== index));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      await updateDoctorSettings(doctor.uid, {
        name,
        photoUrl,
        specialty,
        clinicName,
        city,
        address,
        googleMapsUrl,
        phone,
        whatsappNumber,
        description,
        servicesAndPrices: services,
        clinicPhotos: clinicPhotos,
        avgConsultTime: Number(avgConsultTime),
        workHours: {
          open: openTime,
          close: closeTime,
          maxPatientsPerDay: Number(maxPatients),
          daysOfWeek: doctor.workHours?.daysOfWeek || ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس"]
        }
      });

      setIsSaving(false);
      onShowToast("تم حفظ بيانات وإعدادات العيادة بنجاح", "تم تحديث الملف الشخصي وصفحة العيادة الدليل", "success");
      onClose();
    } catch (err) {
      console.error("Settings save error:", err);
      setIsSaving(false);
      onShowToast("خطأ في حفظ الإعدادات", "يرجى التأكد من البيانات والمحاولة مجدداً", "error");
    }
  };


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-100 text-right animate-in fade-in zoom-in-95 duration-200 my-8 max-h-[90vh] overflow-y-auto">
        
        <button
          onClick={onClose}
          className="absolute top-4 left-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <h3 className="text-xl font-bold text-slate-900 mb-1 font-['Tajawal',sans-serif]">
          إعدادات العيادة والملف الشخصي
        </h3>
        <p className="text-xs text-slate-500 mb-6">
          تعديل بيانات الطبيب، أرقام التواصل المباشر، مواعيد العمل، وقائمة الخدمات لصفحة العيادة
        </p>

        <form onSubmit={handleSave} className="space-y-5">
          
          {/* Doctor Name & Direct Photo Upload */}
          <div className="grid sm:grid-cols-2 gap-4 items-start">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">اسم الطبيب بالكامل</label>
              <div className="relative">
                <Stethoscope className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>

            <div>
              <ImageUpload
                label="صورة الطبيب الشخصية"
                helperText="تظهر في بطاقة الطبيب والدليل وصفحة الحجز"
                currentImageUrl={photoUrl}
                onChange={(dataUrl) => setPhotoUrl(dataUrl)}
                onRemove={() => setPhotoUrl('')}
                variant="avatar"
                maxDimension={600}
              />
            </div>
          </div>

          {/* Specialty & Clinic Name */}
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">التخصص الطبي</label>
              <select
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                required
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-sky-500"
              >
                {MEDICAL_SPECIALTIES.map((spec) => (
                  <option key={spec} value={spec}>
                    {spec}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">اسم العيادة / المركز الطبي</label>
              <div className="relative">
                <Building className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                <input
                  type="text"
                  value={clinicName}
                  onChange={(e) => setClinicName(e.target.value)}
                  required
                  className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>
          </div>

          {/* Contact Numbers (Phone & WhatsApp) - Key Requirements */}
          <div className="grid sm:grid-cols-2 gap-3 p-4 bg-sky-50/50 rounded-2xl border border-sky-100">
            <div>
              <label className="block text-xs font-bold text-sky-900 mb-1">
                رقم الهاتف (للاتصال المباشر)
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-sky-600 absolute right-3 top-3" />
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+964 770 000 0000"
                  className="w-full pl-3 pr-10 py-2.5 bg-white border border-sky-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-sky-500 dir-ltr text-left"
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                * سيظهر زر "اتصل بالطبيب" للمرضى فقط في حال إدخال هذا الرقم.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-emerald-900 mb-1">
                رقم الواتساب (للتواصل المباشر)
              </label>
              <div className="relative">
                <MessageCircle className="w-4 h-4 text-emerald-600 absolute right-3 top-3" />
                <input
                  type="text"
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                  placeholder="+964 780 000 0000"
                  className="w-full pl-3 pr-10 py-2.5 bg-white border border-emerald-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 dir-ltr text-left"
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                * سيظهر زر "واتساب" المباشر للمرضى بمجرد إدخاله.
              </p>
            </div>
          </div>

          {/* City & Address */}
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">المدينة / المحافظة</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="بغداد، أربيل، البصرة..."
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">العنوان بالتفصيل</label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="شارع فلسطين، مجمع الأطباء، الطابق الثاني"
                  className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>
          </div>

          {/* Google Maps Location URL */}
          <div>
            <label className="block text-xs font-bold text-sky-900 mb-1">رابط الموقع على خرائط Google Maps</label>
            <div className="relative">
              <Map className="w-4 h-4 text-sky-600 absolute right-3 top-3" />
              <input
                type="url"
                value={googleMapsUrl}
                onChange={(e) => setGoogleMapsUrl(e.target.value)}
                placeholder="https://maps.google.com/?q=33.3152,44.3661"
                className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-sky-500 text-left dir-ltr"
              />
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              * الصق رابط الخريطة لتتيح للمرضى التوجه للعيادة بضغطة زر.
            </p>
          </div>

          {/* Description / Bio */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">وصف مختصر عن الطبيب والعيادة</label>
            <div className="relative">
              <FileText className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="اكتب هنا الخبرات الطبية، العضويات، ومواعيد الاستشارات..."
                className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>

          {/* Services & Prices */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
            <label className="block text-xs font-bold text-slate-800 mb-2">
              الخدمات الطبية والأسعار (تظهر في صفحة العيادة)
            </label>
            
            <div className="space-y-2 mb-3">
              {services.map((srv, idx) => (
                <div key={idx} className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-slate-200 text-xs">
                  <span className="font-bold text-slate-800">{srv.serviceName}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full">
                      {srv.price}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveService(idx)}
                      className="text-rose-500 hover:text-rose-700 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="اسم الخدمة (مثل: كشف عام، سونار)"
                value={newSrvName}
                onChange={(e) => setNewSrvName(e.target.value)}
                className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold"
              />
              <input
                type="text"
                placeholder="السعر (مثل: 25,000 د.ع)"
                value={newSrvPrice}
                onChange={(e) => setNewSrvPrice(e.target.value)}
                className="w-28 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold"
              />
              <button
                type="button"
                onClick={handleAddService}
                className="px-3 py-2 bg-sky-600 text-white rounded-xl text-xs font-bold hover:bg-sky-500 transition flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة</span>
              </button>
            </div>
          </div>

          {/* Clinic Photos Gallery */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-xs font-bold text-slate-800">
                  معرض صور العيادة والمركز الطبي
                </label>
                <span className="text-[10px] text-slate-500">
                  أضف صور الاستقبال، غرف الكشف، والأجهزة الطبية لتعريف المرضى بعيادتك
                </span>
              </div>
              <span className="text-xs font-bold text-sky-700 bg-sky-50 px-2.5 py-1 rounded-full border border-sky-200">
                {clinicPhotos.length} صور
              </span>
            </div>

            {/* Upload New Photo */}
            <ImageUpload
              helperText="اختر صورة من هاتفك أو جهازك لإضافتها للمعرض مباشرة"
              onChange={handleAddClinicPhoto}
              variant="card"
              maxDimension={1000}
            />

            {/* Gallery Thumbnails List */}
            {clinicPhotos.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 pt-2">
                {clinicPhotos.map((photo, pIdx) => (
                  <div key={pIdx} className="relative group rounded-xl overflow-hidden border border-slate-200 aspect-video bg-white shadow-2xs">
                    <img
                      src={photo}
                      alt={`صورة عيادة ${pIdx + 1}`}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveClinicPhoto(pIdx)}
                      className="absolute top-1 left-1 p-1 bg-rose-600 text-white rounded-lg opacity-90 hover:opacity-100 transition shadow-sm cursor-pointer"
                      title="حذف الصورة من المعرض"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <hr className="border-slate-100" />

          {/* Work Hours & Daily Limit */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">وقت الفتح</label>
              <input
                type="time"
                value={openTime}
                onChange={(e) => setOpenTime(e.target.value)}
                className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 text-center"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">وقت الإغلاق</label>
              <input
                type="time"
                value={closeTime}
                onChange={(e) => setCloseTime(e.target.value)}
                className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 text-center"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">الحد اليومي للمرضى</label>
              <input
                type="number"
                min="5"
                max="200"
                value={maxPatients}
                onChange={(e) => setMaxPatients(Number(e.target.value))}
                className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 text-center"
              />
            </div>
          </div>

          {/* Action Footer */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-200 transition"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-7 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl transition shadow-md flex items-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'جاري حفظ البيانات...' : 'حفظ التعديلات ونشرها'}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
