import React, { useState, useEffect } from 'react';
import {
  Building2,
  UserCheck,
  ShieldCheck,
  Mail,
  Lock,
  User,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  LogOut
} from 'lucide-react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut
} from 'firebase/auth';
import { auth } from '../firebase/config';
import {
  getClinicInvitation,
  acceptClinicInvitation
} from '../services/firebaseService';
import { ClinicInvitation, ClinicMember } from '../types';

interface ClinicInvitationAcceptModalProps {
  invitationToken: string;
  currentUser: any;
  onAccepted: (newMember: ClinicMember) => void;
  onClose: () => void;
  onShowToast: (title: string, message?: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

const ROLE_LABELS_AR: Record<string, string> = {
  OWNER: 'مالك العيادة',
  DOCTOR: 'طبيب معالج',
  SECRETARY: 'سكرتير / استقبال',
  STAFF: 'كادر إداري ومساعد'
};

export const ClinicInvitationAcceptModal: React.FC<ClinicInvitationAcceptModalProps> = ({
  invitationToken,
  currentUser,
  onAccepted,
  onClose,
  onShowToast
}) => {
  const [invitation, setInvitation] = useState<ClinicInvitation | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Auth form state for unauthenticated users
  const [authMode, setAuthMode] = useState<'register' | 'login'>('register');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [displayName, setDisplayName] = useState<string>('');

  useEffect(() => {
    let isMounted = true;
    async function loadInvitation() {
      setLoading(true);
      setErrorMsg(null);
      try {
        const inv = await getClinicInvitation(invitationToken);
        if (isMounted) {
          setInvitation(inv);
          if (inv) {
            setEmail(inv.invitedEmail);
            setDisplayName(inv.invitedName || '');
          } else {
            setErrorMsg('لم يتم العثور على هذه الدعوة. قد تكون قد حُذفت أو الرابط غير صحيح.');
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setErrorMsg(err.message || 'حدث خطأ أثناء تحميل بيانات الدعوة');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    if (invitationToken) {
      loadInvitation();
    }
    return () => { isMounted = false; };
  }, [invitationToken]);

  const handleAccept = async (userToUse = currentUser) => {
    if (!invitationToken || !userToUse) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const newMember = await acceptClinicInvitation(invitationToken, {
        uid: userToUse.uid,
        email: userToUse.email,
        displayName: userToUse.displayName || displayName || invitation?.invitedName
      });
      onShowToast('تم الانضمام بنجاح', `مرحباً بك في ${invitation?.clinicName}`, 'success');
      onAccepted(newMember);
    } catch (err: any) {
      console.error("Accept invitation error:", err);
      setErrorMsg(err.message || 'حدث خطأ أثناء قبول الدعوة');
      onShowToast('تعذر قبول الدعوة', err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAuthAndAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setErrorMsg('يرجى ملء كافة الحقول المطلوبة');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    try {
      let creds;
      if (authMode === 'register') {
        creds = await createUserWithEmailAndPassword(auth, email.trim(), password);
      } else {
        creds = await signInWithEmailAndPassword(auth, email.trim(), password);
      }

      if (creds && creds.user) {
        await handleAccept(creds.user);
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      setErrorMsg(err.message || 'فشل تسجيل الدخول / إنشاء الحساب');
      onShowToast('خطأ في الحساب', err.message, 'error');
      setSubmitting(false);
    }
  };

  const handleGoogleAndAccept = async () => {
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const provider = new GoogleAuthProvider();
      const res = await signInWithPopup(auth, provider);
      if (res && res.user) {
        await handleAccept(res.user);
      }
    } catch (err: any) {
      console.error("Google Auth error:", err);
      setErrorMsg(err.message || 'فشل تسجيل الدخول عبر Google');
      onShowToast('خطأ في تسجيل الدخول', err.message, 'error');
      setSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      onShowToast('تم تسجيل الخروج', 'يرجى تسجيل الدخول بالبريد الإلكتروني المدعو', 'info');
    } catch (e) { /* ignore */ }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto dir-rtl font-sans">
      <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-100 shadow-2xl overflow-hidden relative my-8 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header decoration */}
        <div className="bg-gradient-to-r from-sky-600 via-sky-700 to-indigo-800 p-6 sm:p-8 text-white relative">
          <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white">
              <Building2 className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider bg-white/20 px-3 py-1 rounded-full backdrop-blur-xs">
              دعوة رسمية للانضمام
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-white mt-2 leading-snug">
            {loading ? 'جاري جلب بيانات الدعوة...' : (invitation?.clinicName || 'دعوة انضمام للعيادة')}
          </h2>
          <p className="text-sky-100 text-xs sm:text-sm mt-1">
            منظومة دَوري (Dory) لإدارة العيادات والمواعيد الطبية
          </p>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-8 space-y-6">

          {loading ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-10 h-10 border-4 border-sky-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm font-bold text-slate-600">جاري التحقق من رابط الدعوة...</p>
            </div>
          ) : errorMsg && !invitation ? (
            <div className="text-center py-8 space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
                <XCircle className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">رابط الدعوة غير صالح</h3>
                <p className="text-xs text-slate-500 mt-1">{errorMsg}</p>
              </div>
              <button
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition"
              >
                إغلاق
              </button>
            </div>
          ) : invitation ? (
            <>
              {/* Invitation Details Summary Card */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
                  <span className="text-xs text-slate-500 font-medium">اسم العضو المدعو:</span>
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-sky-600" />
                    {invitation.invitedName || 'غير مسمى'}
                  </span>
                </div>

                <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
                  <span className="text-xs text-slate-500 font-medium">البريد الإلكتروني المعتمد:</span>
                  <span className="text-xs font-bold text-slate-900 dir-ltr font-mono">
                    {invitation.invitedEmail}
                  </span>
                </div>

                <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
                  <span className="text-xs text-slate-500 font-medium">الدور الوظيفي والصلاحيات:</span>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-sky-100 text-sky-800 border border-sky-200">
                    {ROLE_LABELS_AR[invitation.role] || invitation.role}
                  </span>
                </div>

                {invitation.invitedByName && (
                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                    <span>صاحب الدعوة:</span>
                    <span className="font-semibold text-slate-700">{invitation.invitedByName}</span>
                  </div>
                )}
              </div>

              {/* Status Checks */}
              {invitation.status === 'expired' && (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-3">
                  <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold mb-0.5">دعوة منتهية الصلاحية</h4>
                    <p className="text-[11px] leading-relaxed">
                      انتهت فترة صلاحية هذه الدعوة (7 أيام). يرجى التواصل مع مالك العيادة لإعادة إرسال دعوة جديدة.
                    </p>
                  </div>
                </div>
              )}

              {invitation.status === 'revoked' && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-3">
                  <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold mb-0.5">تم إلغاء الدعوة</h4>
                    <p className="text-[11px] leading-relaxed">
                      قام مالك العيادة بتمكين إلغاء هذه الدعوة. إذا كنت تعتقد أن هذا خطأ يرجى مراجعته.
                    </p>
                  </div>
                </div>
              )}

              {invitation.status === 'accepted' && (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold mb-0.5">تم قبول الدعوة سابقاً</h4>
                    <p className="text-[11px] leading-relaxed">
                      هذه الدعوة مُفعلة ومربوطة بحساب العضو بالفعل.
                    </p>
                  </div>
                </div>
              )}

              {/* Action Area for Pending Invitation */}
              {invitation.status === 'pending' && (
                <>
                  {errorMsg && (
                    <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                      <span>{errorMsg}</span>
                    </div>
                  )}

                  {/* Case A: User is Authenticated */}
                  {currentUser ? (
                    currentUser.email?.toLowerCase().trim() === invitation.invitedEmail.toLowerCase().trim() ? (
                      <div className="space-y-4 pt-2">
                        <div className="p-3.5 rounded-2xl bg-sky-50 border border-sky-100 flex items-center gap-3">
                          <UserCheck className="w-5 h-5 text-sky-600 shrink-0" />
                          <div className="text-xs">
                            <span className="text-slate-500 font-medium block">مسجل الدخول حالياً بصفتك:</span>
                            <span className="font-bold text-slate-900">{currentUser.displayName || currentUser.email}</span>
                          </div>
                        </div>

                        <button
                          onClick={() => handleAccept()}
                          disabled={submitting}
                          className="w-full py-3.5 px-6 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-sm shadow-lg shadow-sky-600/20 transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                        >
                          {submitting ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              <span>جاري معالجة وتأكيد الانضمام...</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-5 h-5" />
                              <span>تأكيد وقبول الدعوة والانضمام للعيادة</span>
                            </>
                          )}
                        </button>
                      </div>
                    ) : (
                      /* Authenticated with DIFFERENT email */
                      <div className="space-y-4 pt-2">
                        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2">
                          <div className="flex items-center gap-2 font-bold">
                            <AlertCircle className="w-4 h-4 text-amber-600" />
                            <span>البريد الإلكتروني لا يطابق الدعوة</span>
                          </div>
                          <p className="leading-relaxed">
                            أنت مسجل الدخول ببريد <strong className="dir-ltr inline-block font-mono text-amber-950">{currentUser.email}</strong>، بينما أُرسلت هذه الدعوة حصرياً إلى البريد <strong className="dir-ltr inline-block font-mono text-amber-950">{invitation.invitedEmail}</strong>.
                          </p>
                        </div>

                        <button
                          onClick={handleSignOut}
                          className="w-full py-3 px-4 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <LogOut className="w-4 h-4" />
                          <span>تسجيل الخروج وتبديل الحساب للبريد الصحيح</span>
                        </button>
                      </div>
                    )
                  ) : (
                    /* Case B: User is NOT Authenticated -> Offer inline registration/login */
                    <div className="space-y-4 pt-2">
                      <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-bold text-slate-600">
                        <button
                          type="button"
                          onClick={() => setAuthMode('register')}
                          className={`flex-1 py-2 rounded-lg transition ${
                            authMode === 'register' ? 'bg-white text-sky-700 shadow-xs' : 'hover:text-slate-900'
                          }`}
                        >
                          إنشاء حساب جديد
                        </button>
                        <button
                          type="button"
                          onClick={() => setAuthMode('login')}
                          className={`flex-1 py-2 rounded-lg transition ${
                            authMode === 'login' ? 'bg-white text-sky-700 shadow-xs' : 'hover:text-slate-900'
                          }`}
                        >
                          تسجيل دخول سابق
                        </button>
                      </div>

                      <form onSubmit={handleAuthAndAccept} className="space-y-3">
                        {authMode === 'register' && (
                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">الاسم الكامل *</label>
                            <div className="relative">
                              <input
                                type="text"
                                required
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                placeholder="د. أحمد علي / م. سارة"
                                className="w-full pr-10 pl-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-sky-500 outline-none font-bold text-slate-900"
                              />
                              <User className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                            </div>
                          </div>
                        )}

                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">البريد الإلكتروني (المعتمد في الدعوة) *</label>
                          <div className="relative">
                            <input
                              type="email"
                              required
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              className="w-full pr-10 pl-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-sky-500 outline-none font-bold text-slate-900 dir-ltr text-left"
                            />
                            <Mail className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">كلمة المرور *</label>
                          <div className="relative">
                            <input
                              type="password"
                              required
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              placeholder="••••••••"
                              className="w-full pr-10 pl-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-sky-500 outline-none font-bold text-slate-900"
                            />
                            <Lock className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={submitting}
                          className="w-full py-3.5 px-6 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-sm shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50 mt-2 cursor-pointer"
                        >
                          {submitting ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              <span>جاري معالجة الحساب وقبول الدعوة...</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-5 h-5" />
                              <span>{authMode === 'register' ? 'إنشاء الحساب وقبول الدعوة' : 'تسجيل الدخول وقبول الدعوة'}</span>
                            </>
                          )}
                        </button>
                      </form>

                      <div className="relative my-3">
                        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200" /></div>
                        <div className="relative flex justify-center text-[10px] uppercase"><span className="bg-white px-2 text-slate-400 font-bold">أو القبول عبر Google</span></div>
                      </div>

                      <button
                        type="button"
                        onClick={handleGoogleAndAccept}
                        disabled={submitting}
                        className="w-full py-2.5 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                        </svg>
                        <span>تسجيل الدخول بـ Google والتأكيد</span>
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          ) : null}

          {/* Modal Footer */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1 font-mono text-[11px]">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              ربط آمن وحماية بيانات مشفرة
            </span>
            <button
              onClick={onClose}
              className="text-slate-500 hover:text-slate-800 font-bold p-1 rounded-lg hover:bg-slate-100 transition"
            >
              إلغاء / إغلاق
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};
