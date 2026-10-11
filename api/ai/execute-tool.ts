import { executeAiToolCall, verifyFirebaseIdToken, verifyClinicAccess } from "../../src/server/serverBundle.js";

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
    const { clinicId, toolName, args, confirmedActionId } = body;

    if (!clinicId || !toolName) {
      return res.status(400).json({ error: "معرف العيادة واسم الأداة مطلوبان" });
    }

    // 1. Authenticate user from Bearer Token - Fail Closed
    const authHeader = req.headers.authorization;
    const verifiedUser = await verifyFirebaseIdToken(authHeader);

    if (!verifiedUser) {
      return res.status(401).json({
        status: "denied",
        error: "غير مصرح: يجب تسجيل الدخول لتنفيذ هذا الإجراء (Authentication Required)"
      });
    }

    // 2. Enforce server-side authoritative verification of clinic access & subscription
    const accessCheck = await verifyClinicAccess(verifiedUser, clinicId);
    if (!accessCheck.authorized) {
      return res.status(403).json({
        status: "denied",
        error: accessCheck.reason || "ليس لديك الصلاحية لتنفيذ هذا الإجراء في هذه العيادة"
      });
    }

    const isDoctorOwner = Boolean(accessCheck.isDoctorOwner || accessCheck.isAdmin);
    const isSubscriptionActive = Boolean(accessCheck.isSubscriptionActive);
    const userMember = accessCheck.userMember;

    const clientIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket?.remoteAddress || "unknown_ip";
    const idToken = authHeader?.startsWith("Bearer ") ? authHeader.substring(7).trim() : undefined;

    const toolResult = await executeAiToolCall(toolName, args || {}, {
      clinicId,
      member: userMember,
      isDoctorOwner,
      isSubscriptionActive,
      confirmedActionId,
      clientIp,
      idToken
    });

    return res.status(200).json(toolResult);
  } catch (error: any) {
    console.error("[AI Execute Tool API Error]:", error);
    return res.status(500).json({
      status: "failed",
      error: error?.message || "فشل تنفيذ الأداة"
    });
  }
}
