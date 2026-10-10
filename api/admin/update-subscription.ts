import { verifyFirebaseIdToken, updateDoctorDocAuthoritative } from "../../src/server/authVerify";
import { db } from "../../src/firebase/config";
import { doc, updateDoc } from "firebase/firestore";

export default async function handler(req: any, res: any) {
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed. Expected POST." });
  }

  try {
    const authHeader = req.headers.authorization;
    const verifiedUser = await verifyFirebaseIdToken(authHeader);

    if (!verifiedUser) {
      return res.status(401).json({ error: "غير مصرح: يجب تسجيل الدخول بحساب مدير المنصة (Authentication Required)" });
    }

    if (!verifiedUser.isAdmin) {
      return res.status(403).json({ error: "تم رفض الطلب: يتطلب صلاحيات مدير المنصة (Admin Privileges Required)" });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const { doctorId, subscriptionStatus, durationMonths } = body;

    if (!doctorId || !subscriptionStatus) {
      return res.status(400).json({ error: "Missing required parameters (doctorId, subscriptionStatus)" });
    }

    const now = new Date();
    let expiresAt: string | null = null;
    const isLifetime = subscriptionStatus === 'lifetime';

    if (subscriptionStatus === 'active') {
      const months = Number(durationMonths) > 0 ? Number(durationMonths) : 1;
      const expDate = new Date(now.getTime() + months * 30 * 24 * 60 * 60 * 1000);
      expiresAt = expDate.toISOString();
    } else if (isLifetime) {
      expiresAt = null;
    }

    const updateData: Record<string, any> = {
      subscriptionStatus,
      isLifetime,
      subscriptionExpiresAt: expiresAt,
      subscriptionEndDate: expiresAt || '',
      subscriptionLastModified: now.toISOString(),
      subscriptionModifiedBy: verifiedUser.email || verifiedUser.uid
    };

    if (subscriptionStatus === 'active') {
      updateData.subscriptionStartedAt = now.toISOString();
    }

    const ok = await updateDoctorDocAuthoritative(doctorId, updateData, verifiedUser.idToken);
    if (!ok) {
      const doctorRef = doc(db, "doctors", doctorId);
      await updateDoc(doctorRef, updateData);
    }

    console.log(`[AUDIT LOG] Admin (${verifiedUser.email || verifiedUser.uid}) updateSubscription for ${doctorId}: ${subscriptionStatus}`);

    return res.status(200).json({
      success: true,
      message: `Subscription for doctor ${doctorId} set to ${subscriptionStatus}`,
      expiresAt,
      timestamp: now.toISOString()
    });
  } catch (error: any) {
    console.error("[Admin update-subscription error]:", error);
    return res.status(500).json({ error: error.message || "Failed to update subscription" });
  }
}
