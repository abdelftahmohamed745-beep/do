import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, increment } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import {
  createDoctorProfile,
  getDoctorProfile
} from '../services/firebaseService';
import { DoctorProfile, MEDICAL_SPECIALTIES } from '../types';
import { Stethoscope, Mail, Lock, User, Building, ArrowLeft, RotateCcw, CheckCircle2, LogOut, KeyRound } from 'lucide-react';
import { CustomWebsiteSection } from './CustomWebsiteSection';

interface AuthPageProps {
  initialAccountType?: string;
  onDoctorLoggedIn: (doctor: DoctorProfile) => void;
  onShowToast: (title: string, message?: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  onSelectPatientBookingView: () => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({
  onDoctorLoggedIn,
  onShowToast,
  onSelectPatientBookingView
}) => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [specialty, setSpecialty] = useState('طب أطفال وباطنة');
  const [clinicName, setClinicName] = useState('');
  const [phone, setPhone] = useState('');

  const [loading, setLoading] = useState(false);

  // Email Verification State
  const [isVerifyingEmail, setIsVerifyingEmail] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [resendTimer, setResendTimer] = useState(60);
  const [verifyingLoading, setVerifyingLoading] = useState(false);

  // Auto-check unverified session on mount
  useEffect(() => {
    const checkPendingVerification = async () => {
      const user = auth.currentUser;
      if (!user) return;

      try {
        const vSnap = await getDoc(doc(db, "email_verifications", user.uid));
        if (vSnap.exists() && vSnap.data()?.verified === true) {
          setIsVerifyingEmail(false);
        } else {
          setIsVerifyingEmail(true);
          setVerificationEmail(user.email || '');
        }
      } catch (e) {
        console.warn("Error checking pending verification on mount:", e);
      }
    };
    checkPendingVerification();
  }, []);

  // Countdown timer for email resend
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isVerifyingEmail && resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isVerifyingEmail, resendTimer]);

  const sendOtpEmail = async (uid: string, targetEmail: string) => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    await setDoc(doc(db, "email_verifications", uid), {
      uid,
      email: targetEmail.trim().toLowerCase(),
      code,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes expiry
      attempts: 0,
      verified: false,
      accountType: 'doctor',
      pendingPayload: {
        doctorName: doctorName.trim() || "دكتور جديد",
        specialty: specialty.trim() || "طبيب عام",
        clinicName: clinicName.trim() || "العيادة الطبية",
        phone: phone.trim() || "01000000000"
      }
    }, { merge: true });

    const resp = await fetch('/api/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: targetEmail.trim(), code })
    });

    let data: any = {};
    const responseText = await resp.text();
    if (responseText) {
      try {
        data = JSON.parse(responseText);
      } catch (err) {
        console.error("[OTP Client Error] Failed to parse JSON response from /api/send-otp:", responseText);
        throw new Error(`استجابة غير صالحة من خادم البريد (رمز الحالة ${resp.status})`);
      }
    } else {
      throw new Error(`استجابة فارغة من خادم البريد (رمز الحالة ${resp.status})`);
    }

    if (!resp.ok || !data.success) {
      throw new Error(data.error || `فشل إرسال كود التحقق عبر البريد الإلكتروني (رمز الحالة ${resp.status})`);
    }

    setResendTimer(60);
    return code;
  };

  const handleVerifyOtpCode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!otpCode.trim() || otpCode.trim().length !== 6) {
      onShowToast("كود غير مكتمل", "يرجى إدخال كود التحقق المكون من 6 أرقام بالكامل", "warning");
      return;
    }

    setVerifyingLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error("لم يتم العثور على الجلسة الحالية. يرجى تسجيل الدخول مجدداً.");
      }

      const vRef = doc(db, "email_verifications", user.uid);
      const vSnap = await getDoc(vRef);

      if (!vSnap.exists()) {
        throw new Error("لم يتم العثور على رمز تحقق فعال. يرجى الضغط على إعادة إرسال الكود.");
      }

      const vData = vSnap.data();

      // 1. Expiry check
      if (new Date(vData.expiresAt).getTime() < Date.now()) {
        throw new Error("انتهت صلاحية كود التحقق (10 دقائق). يرجى الضغط على زر إعادة إرسال الكود.");
      }

      // 2. Max attempts check
      if (vData.attempts >= 5) {
        throw new Error("تجاوزت الحد الأقصى للمحاولات الخاطئة (5 محاولات). يرجى الضغط على إعادة إرسال الكود للحصول على كود جديد.");
      }

      // 3. Code verification
      if (vData.code !== otpCode.trim()) {
        await updateDoc(vRef, { attempts: increment(1) });
        const currentAttempts = (vData.attempts || 0) + 1;
        throw new Error(`كود التحقق غير صحيح. (المحاولة ${currentAttempts} من 5).`);
      }

      // Success!
      await updateDoc(vRef, { verified: true });

      const payload = vData.pendingPayload || {};

      let docProf = await getDoctorProfile(user.uid);
      if (!docProf) {
        docProf = await createDoctorProfile(
          user.uid,
          payload.doctorName || doctorName.trim() || "دكتور جديد",
          payload.specialty || specialty.trim() || "طبيب عام",
          payload.clinicName || clinicName.trim() || "العيادة الطبية"
        );
      }
      setVerifyingLoading(false);
      setIsVerifyingEmail(false);
      onShowToast("تم تأكيد الحساب بنجاح", `مرحباً بك في لوحة تحكم ${docProf.clinicName}`, "success");
      onDoctorLoggedIn(docProf);
    } catch (err: any) {
      console.error("[OTP Verification Error]", err);
      setVerifyingLoading(false);
      onShowToast("فشل التحقق", err.message || "رمز التحقق غير صحيح", "error");
    }
  };

  const handleResendEmailLink = async () => {
    if (resendTimer > 0) return;
    setVerifyingLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error("لم يتم العثور على الجلسة الحالية. يرجى تسجيل الدخول مجدداً.");
      }

      await sendOtpEmail(user.uid, user.email || verificationEmail);
      setVerifyingLoading(false);
      onShowToast(
        "تم إرسال كود جديد",
        `تم إرسال كود تحقق جديد مكون من 6 أرقام إلى بريدك الإلكتروني: ${user.email || verificationEmail}`,
        "success"
      );
    } catch (err: any) {
      console.error("[OTP Resend Error]", err);
      setVerifyingLoading(false);
      onShowToast("فشل إعادة الإرسال", err.message || "تعذر إرسال كود التحقق", "error");
    }
  };

  const handleSignOut = async () => {
    try {
      await auth.signOut();
    } catch (e) {
      console.warn("Sign out error:", e);
    }
    setIsVerifyingEmail(false);
    setOtpCode('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;

    setLoading(true);
    try {
      if (isRegister) {
        // 1. Create user in Firebase Auth
        let user;
        try {
          const creds = await createUserWithEmailAndPassword(auth, email.trim(), password);
          user = creds.user;
        } catch (authErr: any) {
          if (authErr?.code === 'auth/email-already-in-use') {
            try {
              const signCreds = await signInWithEmailAndPassword(auth, email.trim(), password);
              user = signCreds.user;
            } catch {
              throw new Error('هذا البريد الإلكتروني مسجل بالفعل. يرجى اختيار "تسجيل دخول" بدلاً من حساب جديد.');
            }
          } else if (authErr?.code === 'auth/weak-password') {
            throw new Error('كلمة المرور ضعيفة. يرجى اختيار كلمة مرور من 6 أحرف أو أكثر.');
          } else if (authErr?.code === 'auth/invalid-email') {
            throw new Error('البريد الإلكتروني غير صالحة صيغته.');
          } else {
            throw authErr;
          }
        }

        // Send OTP via Gmail SMTP
        await sendOtpEmail(user.uid, user.email || email.trim());

        setLoading(false);
        setIsVerifyingEmail(true);
        setVerificationEmail(user.email || email.trim());

        onShowToast(
          "تم إرسال كود التحقق",
          `تم إرسال كود تحقق مكون من 6 أرقام إلى بريدك الإلكتروني: ${user.email || email.trim()}`,
          "info"
        );

      } else {
        // Sign In
        let creds;
        try {
          creds = await signInWithEmailAndPassword(auth, email.trim(), password);
        } catch (authErr: any) {
          if (
            authErr?.code === 'auth/invalid-credential' ||
            authErr?.code === 'auth/user-not-found' ||
            authErr?.code === 'auth/wrong-password' ||
            authErr?.code === 'auth/invalid-email'
          ) {
            throw new Error('البريد الإلكتروني أو كلمة المرور غير صحيحة');
          }
          throw authErr;
        }

        const user = creds.user;

        // Check if verified in Firestore
        const vSnap = await getDoc(doc(db, "email_verifications", user.uid));
        if (!vSnap.exists() || vSnap.data()?.verified !== true) {
          await sendOtpEmail(user.uid, user.email || email.trim());
          setLoading(false);
          setIsVerifyingEmail(true);
          setVerificationEmail(user.email || email.trim());

          onShowToast(
            "حسابك يحتاج تفعيل",
            "تم إرسال كود تحقق مكون من 6 أرقام إلى بريدك الإلكتروني لتأكيد الحساب.",
            "warning"
          );
          return;
        }

        // Check if Doctor profile exists
        let doctor = await getDoctorProfile(user.uid);
        if (doctor) {
          setLoading(false);
          onShowToast("أهلاً بعودتك!", `تم تسجيل الدخول في ${doctor.clinicName}`, "success");
          onDoctorLoggedIn(doctor);
          return;
        }

        // Fallback profile creation if needed
        doctor = await createDoctorProfile(user.uid, "دكتور", "طبيب عام", "العيادة الطبية");
        setLoading(false);
        onShowToast("أهلاً بك!", `تم تفعيل حساب ${doctor.clinicName}`, "success");
        onDoctorLoggedIn(doctor);
      }
    } catch (err: unknown) {
      console.error("Auth error:", err);
      setLoading(false);
      const errMsg = err instanceof Error ? err.message : "فشل عملية المصادقة";
      onShowToast("خطأ في المصادقة", errMsg, "error");
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      
      {/* Nodemailer Gmail OTP Verification Pending Screen */}
      {isVerifyingEmail ? (
        <div className="bg-[#fdfcf9] rounded-3xl p-6 sm:p-8 shadow-xl border border-sky-100 mb-8">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-sky-50 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-sky-100">
              <KeyRound className="w-8 h-8 text-sky-600" />
            </div>
            <h2 className="text-xl font-black text-slate-900 font-['Tajawal',sans-serif] mb-2">
              تأكيد ملكية البريد الإلكتروني (رمز OTP)
            </h2>
            <p className="text-sm text-slate-600 font-medium max-w-md mx-auto leading-relaxed">
              أرسلنا كود تحقق مكوّن من 6 أرقام إلى بريدك الإلكتروني:
            </p>
            <span className="inline-block mt-2 font-bold text-sky-700 bg-sky-50 border border-sky-200 px-4 py-1.5 rounded-full text-xs dir-ltr">
              {verificationEmail}
            </span>
          </div>

          <form onSubmit={handleVerifyOtpCode} className="space-y-4 max-w-md mx-auto">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2 text-center">أدخل كود التحقق (6 أرقام):</label>
              <input
                type="text"
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                placeholder="••••••"
                required
                className="w-full text-center text-2xl tracking-[12px] font-mono py-3 px-4 bg-slate-50 border border-slate-300 rounded-2xl focus:outline-hidden focus:ring-2 focus:ring-sky-500 dir-ltr font-black text-sky-900"
              />
              <p className="text-[11px] text-slate-400 text-center mt-1">الكود صالـح لمدة 10 دقائق (الحد الأقصى 5 محاولات)</p>
            </div>

            <button
              type="submit"
              disabled={verifyingLoading || otpCode.length !== 6}
              className="w-full py-3.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-black text-sm rounded-2xl transition shadow-md cursor-pointer flex items-center justify-center gap-2"
            >
              {verifyingLoading ? (
                <span>جاري التحقق من الرمز...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  <span>تأكيد رمز التحقق والدخول لنظام العيادة</span>
                </>
              )}
            </button>

            <button
              type="button"
              disabled={resendTimer > 0 || verifyingLoading}
              onClick={handleResendEmailLink}
              className="w-full py-3 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-800 font-bold text-xs rounded-2xl transition flex items-center justify-center gap-2 cursor-pointer border border-slate-200"
            >
              <RotateCcw className="w-4 h-4 text-slate-600" />
              <span>
                {resendTimer > 0
                  ? `إعادة إرسال كود التحقق خلال (${resendTimer} ثانية)`
                  : 'إعادة إرسال كود التحقق'}
              </span>
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-100 text-center">
            <button
              type="button"
              onClick={handleSignOut}
              className="text-slate-500 hover:text-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 mx-auto cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>تسجيل الخروج والعودة لصفحة الدخول</span>
            </button>
          </div>
        </div>
      ) : (
        /* Main Login / Signup Card */
        <div className="bg-[#fdfcf9] rounded-3xl p-6 sm:p-8 shadow-xl border border-[#e7e3da] mb-8">
          
          <div className="text-center mb-6">
            <div className="w-14 h-14 bg-[#122c4a] rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-md">
              <Stethoscope className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-black text-[#122c4a] font-['Tajawal',sans-serif] mb-1">
              نظام تشغيل وإدارة العيادات الطبية
            </h1>
            <p className="text-xs text-slate-600">
              {isRegister ? 'أنشئ حساب عيادتك الطبية وابدأ تشغيل الطابور الذكي والجلسات اليومية' : 'تسجيل الدخول للوصول إلى لوحة تحكم العيادة والطابور النشط'}
            </p>
          </div>

          {/* Toggle Tabs */}
          <div className="flex bg-[#f4efe6] p-1 rounded-2xl mb-6">
            <button
              onClick={() => setIsRegister(false)}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                !isRegister ? 'bg-[#122c4a] text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              تسجيل دخول العيادة
            </button>
            <button
              onClick={() => setIsRegister(true)}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                isRegister ? 'bg-[#122c4a] text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              حساب عيادة جديدة
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {isRegister && (
              <>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">اسم الطبيب أو مدير العيادة</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-[#1b3a5c] absolute right-3.5 top-3.5" />
                    <input
                      type="text"
                      value={doctorName}
                      onChange={(e) => setDoctorName(e.target.value)}
                      placeholder="د. محمد عبد الله"
                      required
                      className="w-full pl-3 pr-10 py-2.5 bg-[#faf8f5] border border-[#e7e3da] rounded-xl text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-[#122c4a]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">التخصص الطبي</label>
                  <select
                    value={specialty}
                    onChange={(e) => setSpecialty(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 bg-[#faf8f5] border border-[#e7e3da] rounded-xl text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-[#122c4a]"
                  >
                    {MEDICAL_SPECIALTIES.map((spec) => (
                      <option key={spec} value={spec}>
                        {spec}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">اسم العيادة أو المركز الطبي</label>
                  <div className="relative">
                    <Building className="w-4 h-4 text-[#1b3a5c] absolute right-3.5 top-3.5" />
                    <input
                      type="text"
                      value={clinicName}
                      onChange={(e) => setClinicName(e.target.value)}
                      placeholder="عيادة الشفاء التخصصية"
                      required
                      className="w-full pl-3 pr-10 py-2.5 bg-[#faf8f5] border border-[#e7e3da] rounded-xl text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-[#122c4a]"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">البريد الإلكتروني للعيادة</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#1b3a5c] absolute right-3.5 top-3.5" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="doctor@clinic.com"
                  required
                  className="w-full pl-3 pr-10 py-2.5 bg-[#faf8f5] border border-[#e7e3da] rounded-xl text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-[#122c4a] dir-ltr text-left"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">كلمة المرور</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#1b3a5c] absolute right-3.5 top-3.5" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-3 pr-10 py-2.5 bg-[#faf8f5] border border-[#e7e3da] rounded-xl text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-[#122c4a] dir-ltr text-left"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#122c4a] hover:bg-[#0d223a] text-white font-extrabold text-sm rounded-2xl transition shadow-md cursor-pointer"
            >
              {loading ? 'جاري التحقق...' : isRegister ? 'إنشاء حساب عيادة وبدء العمل' : 'تسجيل الدخول'}
            </button>
          </form>

        <hr className="my-6 border-[#f0ebe1]" />

        {/* Patient Preview Link */}
        <button
          onClick={onSelectPatientBookingView}
          className="w-full py-2.5 bg-[#edf3fa] hover:bg-[#dce7f3] text-[#122c4a] font-bold text-xs rounded-xl transition border border-[#d1dfed] flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>تصفح صفحة المريض (مسح كود الـ QR)</span>
          <ArrowLeft className="w-4 h-4" />
        </button>

      </div>
      )}

      {/* Standalone Section: Want a custom website? */}
      <CustomWebsiteSection />

    </div>
  );
};

