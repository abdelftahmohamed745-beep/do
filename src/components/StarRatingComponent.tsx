import React, { useState, useEffect } from 'react';
import { Star, CheckCircle, Send, MessageSquare } from 'lucide-react';
import { DoctorRating } from '../types';
import { addDoctorRating, checkTicketRated } from '../services/firebaseService';

interface StarRatingComponentProps {
  doctorId: string;
  patientRecordId: string;
  patientName: string;
  patientPhone?: string;
  onRatingSubmitted?: (rating: DoctorRating) => void;
  onShowToast?: (title: string, message?: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export const StarRatingComponent: React.FC<StarRatingComponentProps> = ({
  doctorId,
  patientRecordId,
  patientName,
  patientPhone,
  onRatingSubmitted,
  onShowToast
}) => {
  const [stars, setStars] = useState<number>(5);
  const [hoverStars, setHoverStars] = useState<number>(0);
  const [comment, setComment] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [existingRating, setExistingRating] = useState<DoctorRating | null>(null);
  const [checkingExisting, setCheckingExisting] = useState<boolean>(true);

  // Check if patient has already submitted a rating for this ticket
  useEffect(() => {
    let isMounted = true;
    async function verifyRating() {
      setCheckingExisting(true);
      const prevRating = await checkTicketRated(patientRecordId);
      if (isMounted) {
        if (prevRating) {
          setExistingRating(prevRating);
          setStars(prevRating.stars);
        }
        setCheckingExisting(false);
      }
    }
    verifyRating();
    return () => {
      isMounted = false;
    };
  }, [patientRecordId]);

  const handleSubmitRating = async (e: React.FormEvent) => {
    e.preventDefault();
    if (existingRating) return;

    if (stars < 1 || stars > 5) {
      if (onShowToast) onShowToast("يرجى اختيار عدد النجوم من 1 إلى 5", "", "warning");
      return;
    }

    setLoading(true);
    try {
      const newRating = await addDoctorRating({
        doctorId,
        patientRecordId,
        patientName,
        patientPhone,
        stars,
        comment: comment.trim()
      });

      setExistingRating(newRating);
      if (onShowToast) {
        onShowToast("تم إرسال تقييمك بنجاح! ⭐", "شكراً لمشاركتنا تجربتك مع العيادة", "success");
      }
      if (onRatingSubmitted) {
        onRatingSubmitted(newRating);
      }
    } catch (err: any) {
      console.error("Submit rating error:", err);
      const msg = err?.message || "تعذر إرسال التقييم حالياً";
      if (onShowToast) onShowToast("فشل إرسال التقييم", msg, "error");
    } finally {
      setLoading(false);
    }
  };

  if (checkingExisting) {
    return (
      <div className="bg-slate-50 rounded-2xl p-6 text-center border border-slate-200 animate-pulse">
        <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        <span className="text-xs text-slate-500 font-semibold">جاري التحقق من التقييم...</span>
      </div>
    );
  }

  // State: Patient already rated this visit
  if (existingRating) {
    return (
      <div className="bg-gradient-to-br from-emerald-50 to-teal-50/60 border border-emerald-200/90 rounded-3xl p-6 text-center space-y-3 shadow-sm">
        <div className="w-12 h-12 bg-emerald-500 text-white rounded-2xl flex items-center justify-center mx-auto shadow-md">
          <CheckCircle className="w-6 h-6" />
        </div>
        
        <h4 className="text-base font-bold text-slate-900 font-['Tajawal',sans-serif]">
          تم إرسال تقييمك، شكرًا لك!
        </h4>
        
        <p className="text-xs text-slate-600 font-medium max-w-sm mx-auto">
          يسهم تقييمك في تحسين جودة خدمات العيادة ومساعدة المرضى الآخرين.
        </p>

        {/* Display submitted star rating */}
        <div className="flex items-center justify-center gap-1 py-1 dir-ltr">
          {[1, 2, 3, 4, 5].map((starIndex) => (
            <Star
              key={starIndex}
              className={`w-6 h-6 ${
                starIndex <= existingRating.stars
                  ? 'text-amber-400 fill-amber-400'
                  : 'text-slate-200'
              }`}
            />
          ))}
        </div>

        {existingRating.comment && (
          <div className="bg-white/80 p-3 rounded-2xl border border-emerald-100 text-xs text-slate-700 italic max-w-sm mx-auto">
            "{existingRating.comment}"
          </div>
        )}
      </div>
    );
  }

  // Interactive Form: Patient has not rated yet
  return (
    <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-lg text-center space-y-4 relative overflow-hidden">
      <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-800 rounded-full text-xs font-bold border border-amber-200">
        <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
        <span>تقييم تجربة الكشف الطبي</span>
      </div>

      <div>
        <h4 className="text-base font-extrabold text-slate-900 font-['Tajawal',sans-serif]">
          كيف كانت تجربتك في العيادة؟
        </h4>
        <p className="text-xs text-slate-500 mt-1">
          اختر التقييم بالنجوم واكتب انطباعك لمساعدة الطبيب والمرضى الآخرين
        </p>
      </div>

      <form onSubmit={handleSubmitRating} className="space-y-4">
        
        {/* Interactive Star Picker */}
        <div className="flex items-center justify-center gap-2 py-2 dir-ltr">
          {[1, 2, 3, 4, 5].map((starIndex) => {
            const activeCount = hoverStars || stars;
            const isFilled = starIndex <= activeCount;

            return (
              <button
                key={starIndex}
                type="button"
                onClick={() => setStars(starIndex)}
                onMouseEnter={() => setHoverStars(starIndex)}
                onMouseLeave={() => setHoverStars(0)}
                className="p-1 focus:outline-hidden transition-transform hover:scale-125 active:scale-95"
                title={`${starIndex} نجوم`}
              >
                <Star
                  className={`w-8 h-8 sm:w-9 sm:h-9 transition-colors ${
                    isFilled
                      ? 'text-amber-400 fill-amber-400 drop-shadow-xs'
                      : 'text-slate-300 hover:text-amber-300'
                  }`}
                />
              </button>
            );
          })}
        </div>

        <div className="text-xs font-bold text-amber-700">
          {stars === 5 && "ممتاز جداً"}
          {stars === 4 && "جيد جداً"}
          {stars === 3 && "جيد"}
          {stars === 2 && "مقبول"}
          {stars === 1 && "يحتاج تحسين"}
        </div>

        {/* Optional Review Comment Field */}
        <div className="text-right">
          <label className="text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5 text-sky-600" />
            <span>تعليق أو ملاحظة نصية (اختياري)</span>
          </label>
          <textarea
            rows={2}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="اكتب انطباعك عن المعاملة، النظافة، أو تنظيم الوقت..."
            maxLength={300}
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-400 transition"
          />
          <span className="text-[10px] text-slate-400 block text-left mt-0.5">
            {comment.length} / 300 حرف
          </span>
        </div>

        {/* Submit Rating Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs sm:text-sm rounded-2xl transition shadow-md shadow-amber-500/20 flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              <span>جاري حفظ التقييم...</span>
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              <span>إرسال التقييم</span>
            </>
          )}
        </button>

      </form>

    </div>
  );
};
