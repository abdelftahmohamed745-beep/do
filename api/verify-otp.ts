import { verifyFirebaseIdToken } from "../src/server/authVerify";
import { db } from "../src/firebase/config";
import { doc, getDoc, updateDoc, increment } from "firebase/firestore";

export default async function handler(req: any, res: any) {
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: `Method ${req.method} Not Allowed. Expected POST.` });
  }

  try {
    const authHeader = req.headers.authorization;
    const verifiedUser = await verifyFirebaseIdToken(authHeader);

    if (!verifiedUser) {
      return res.status(401).json({
        success: false,
        error: "غير مصرح: يجب تسجيل الدخول بحساب معتمد للتحقق (Authentication Required)"
      });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const { code } = body;

    if (!code || typeof code !== "string" || code.trim().length !== 6) {
      return res.status(400).json({
        success: false,
        error: "يرجى إدخال كود التحقق المكون من 6 أرقام"
      });
    }

    const cleanCode = code.trim();
    const vRef = doc(db, "email_verifications", verifiedUser.uid);
    const vSnap = await getDoc(vRef);

    if (!vSnap.exists()) {
      return res.status(404).json({
        success: false,
        error: "لم يتم العثور على رمز تحقق فعال. يرجى الضغط على إعادة إرسال الكود."
      });
    }

    const vData = vSnap.data();

    // 1. Expiry check
    if (new Date(vData.expiresAt).getTime() < Date.now()) {
      return res.status(400).json({
        success: false,
        error: "انتهت صلاحية كود التحقق (10 دقائق). يرجى الضغط على زر إعادة إرسال الكود."
      });
    }

    // 2. Max attempts check
    if ((vData.attempts || 0) >= 5) {
      return res.status(429).json({
        success: false,
        error: "تجاوزت الحد الأقصى للمحاولات الخاطئة (5 محاولات). يرجى الضغط على إعادة إرسال الكود للحصول على كود جديد."
      });
    }

    // 3. Code verification
    if (vData.code !== cleanCode) {
      await updateDoc(vRef, { attempts: increment(1) });
      const currentAttempts = (vData.attempts || 0) + 1;
      return res.status(400).json({
        success: false,
        error: `كود التحقق غير صحيح. (المحاولة ${currentAttempts} من 5).`,
        attempts: currentAttempts
      });
    }

    // Success! Authoritative server-side verification mark
    await updateDoc(vRef, {
      verified: true,
      verifiedAt: new Date().toISOString(),
      verifiedByServer: true
    });

    return res.status(200).json({
      success: true,
      message: "تم التحقق من البريد الإلكتروني بنجاح",
      verified: true,
      pendingPayload: vData.pendingPayload || {}
    });
  } catch (error: any) {
    console.error("[OTP Verify API Error]:", error);
    return res.status(500).json({
      success: false,
      error: error?.message || "حدث خطأ أثناء التحقق من كود البريد الإلكتروني"
    });
  }
}
