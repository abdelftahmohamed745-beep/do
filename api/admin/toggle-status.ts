import { verifyFirebaseIdToken, updateDoctorDocAuthoritative, db } from "../../src/server/serverBundle.js";
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
    const { doctorId, isActive } = body;

    if (!doctorId) {
      return res.status(400).json({ error: "Doctor ID is required" });
    }

    const activeBool = Boolean(isActive);
    const updates = {
      isActive: activeBool,
      updatedAt: new Date().toISOString(),
      lastModifiedByAdmin: verifiedUser.email || verifiedUser.uid
    };

    const ok = await updateDoctorDocAuthoritative(doctorId, updates, verifiedUser.idToken);
    if (!ok) {
      const doctorRef = doc(db, "doctors", doctorId);
      await updateDoc(doctorRef, updates);
    }

    console.log(`[AUDIT LOG] Admin (${verifiedUser.email || verifiedUser.uid}) toggleDoctorStatus: doctorId ${doctorId} -> ${activeBool}`);

    return res.status(200).json({
      success: true,
      message: `Doctor ${doctorId} status updated to ${activeBool ? 'active' : 'deactivated'}`,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("[Admin toggle-status error]:", error);
    return res.status(500).json({ error: error.message || "Failed to update doctor status" });
  }
}
