import { handleAiChatServer, verifyFirebaseIdToken, verifyClinicAccess } from "../../src/server/serverBundle.js";

export default async function handler(req: any, res: any) {
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: `Method ${req.method} Not Allowed. Expected POST.` });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const { clinicId, messages, confirmedActionId } = body;

    if (!clinicId) {
      return res.status(400).json({ error: "معرف العيادة (clinicId) مطلوب", status: "failed" });
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        reply: "يجب إرسال مصفوفة الرسائل وبها رسالة المستخدم الحالية",
        status: "failed",
        error: "INVALID_MESSAGES_PAYLOAD"
      });
    }

    // 1. Authenticate user from Bearer Token - Fail Closed
    const authHeader = req.headers.authorization;
    const verifiedUser = await verifyFirebaseIdToken(authHeader);

    if (!verifiedUser) {
      return res.status(401).json({
        reply: "غير مصرح: يجب تسجيل الدخول بحساب معتمد للوصول إلى الوكيل الذكي (Authentication Required)",
        status: "failed",
        error: "UNAUTHENTICATED"
      });
    }

    // 2. Enforce server-side authoritative verification of clinic access & subscription
    const accessCheck = await verifyClinicAccess(verifiedUser, clinicId);
    if (!accessCheck.authorized) {
      return res.status(403).json({
        reply: `تم رفض الوصول: ${accessCheck.reason || "ليس لديك الصلاحية للتفاعل مع وكيل هذه العيادة"}`,
        status: "failed",
        error: "UNAUTHORIZED_CLINIC_ACCESS"
      });
    }

    const isDoctorOwner = Boolean(accessCheck.isDoctorOwner || accessCheck.isAdmin);
    const isSubscriptionActive = Boolean(accessCheck.isSubscriptionActive);
    const userMember = accessCheck.userMember;

    const clientIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket?.remoteAddress || "unknown_ip";

    const outcome = await handleAiChatServer({
      clinicId,
      messages: Array.isArray(messages) ? messages : [],
      userMember,
      isDoctorOwner,
      isSubscriptionActive,
      confirmedActionId,
      clientIp
    });

    return res.status(200).json(outcome);
  } catch (error: any) {
    console.error("[AI Chat API Error]:", error);
    return res.status(500).json({
      reply: `حدث خطأ أثناء معالجة الطلب: ${error?.message || "خطأ غير متوقع"}`,
      status: "failed",
      error: error?.message
    });
  }
}
