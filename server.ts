import express from "express";
import path from "path";
import nodemailer from "nodemailer";
import { createServer as createViteServer } from "vite";
import { renderClinicHtml } from "./src/server/prerenderClinic";
import { generateSitemapXml } from "./src/server/generateSitemap";
import { handleAiChatServer } from "./src/server/aiAgentServer";
import { executeAiToolCall } from "./src/services/ai/aiToolExecutor";
import { verifyFirebaseIdToken, verifyClinicAccess, updateDoctorDocAuthoritative } from "./src/server/authVerify";
import { db } from "./src/firebase/config";
import { doc, updateDoc } from "firebase/firestore";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Basic security middleware headers & request logging
  app.use((req, res, next) => {
    console.log(`[Server Request Log] Method: ${req.method}, Path: ${req.path}`);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    next();
  });

  app.use(express.json({ limit: '2mb' }));

  // API Health Check
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      version: "Dawry-Security-Engine-v2.0"
    });
  });

  // AI Agent Status Endpoint (Provider-Neutral Native Experience)
  app.get("/api/ai/status", (req, res) => {
    const hasApiKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY");
    res.json({
      status: "ready",
      provider: "Dory Native AI Engine",
      hasApiKey,
      agentVersion: "Dory-Agent-v2.0"
    });
  });

  // AI Agent Chat & Multi-turn Execution Endpoint (Secured by Token & Clinic Isolation)
  app.post("/api/ai/chat", async (req, res) => {
    res.setHeader("Content-Type", "application/json");

    try {
      const {
        clinicId,
        messages,
        confirmedActionId
      } = req.body || {};

      if (!clinicId) {
        return res.status(400).json({ error: "معرف العيادة (clinicId) مطلوب" });
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

      // Authoritative properties derived purely from server verification
      const isDoctorOwner = Boolean(accessCheck.isDoctorOwner || accessCheck.isAdmin);
      const isSubscriptionActive = Boolean(accessCheck.isSubscriptionActive);
      const userMember = accessCheck.userMember;

      const clientIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown_ip";

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
      console.error("[AI Chat Route Error]:", error);
      return res.status(500).json({
        reply: `حدث خطأ أثناء معالجة الطلب: ${error?.message || "خطأ غير متوقع"}`,
        status: "failed",
        error: error?.message
      });
    }
  });

  // AI Agent Direct Tool Execution Endpoint (Secured by Token, Permissions & Isolation)
  app.post("/api/ai/execute-tool", async (req, res) => {
    res.setHeader("Content-Type", "application/json");

    try {
      const {
        clinicId,
        toolName,
        args,
        confirmedActionId
      } = req.body || {};

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

      const clientIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown_ip";

      const toolResult = await executeAiToolCall(toolName, args || {}, {
        clinicId,
        member: userMember,
        isDoctorOwner,
        isSubscriptionActive,
        confirmedActionId,
        clientIp
      });

      return res.status(200).json(toolResult);
    } catch (error: any) {
      console.error("[AI Execute Tool Route Error]:", error);
      return res.status(500).json({
        status: "failed",
        error: error?.message || "فشل تنفيذ الأداة"
      });
    }
  });

  // In-Memory Rate Limiting for OTP Endpoint
  interface OtpRateLimitEntry {
    count: number;
    resetAt: number;
  }
  const otpIpRateMap = new Map<string, OtpRateLimitEntry>();
  const otpEmailRateMap = new Map<string, OtpRateLimitEntry>();

  function isOtpRateLimited(map: Map<string, OtpRateLimitEntry>, key: string, maxRequests: number, windowMs: number): boolean {
    const now = Date.now();
    const entry = map.get(key);
    if (!entry || now > entry.resetAt) {
      map.set(key, { count: 1, resetAt: now + windowMs });
      return false;
    }
    if (entry.count >= maxRequests) {
      return true;
    }
    entry.count += 1;
    return false;
  }

  // OTP Email Sending Route via Nodemailer (Gmail SMTP)
  app.post("/api/send-otp", async (req, res) => {
    res.setHeader("Content-Type", "application/json");

    try {
      const { email, code } = req.body || {};
      if (!email || !code) {
        return res.status(400).json({ success: false, error: "Email and OTP code are required" });
      }

      const clientIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown_ip";
      const normalizedEmail = String(email).trim().toLowerCase();

      // Per-IP Rate Limit: max 5 OTP requests per 5 minutes
      if (isOtpRateLimited(otpIpRateMap, clientIp, 5, 5 * 60 * 1000)) {
        return res.status(429).json({
          success: false,
          error: "تم تجاوز حد محاولات إرسال كود التحقق من هذا الجهاز. يرجى الانتظار 5 دقائق والمحاولة مجدداً."
        });
      }

      // Per-Email Rate Limit: max 3 OTP requests per 5 minutes
      if (isOtpRateLimited(otpEmailRateMap, normalizedEmail, 3, 5 * 60 * 1000)) {
        return res.status(429).json({
          success: false,
          error: "تم تجاوز حد الطلبات المسموح بها لهذا البريد الإلكتروني. يرجى الانتظار 5 دقائق والمحاولة مجدداً."
        });
      }

      const gmailUser = process.env.GMAIL_USER;
      const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;

      if (!gmailUser || !gmailAppPassword) {
        console.error("[OTP Server Error] GMAIL_USER or GMAIL_APP_PASSWORD environment variable is missing.");
        return res.status(500).json({
          success: false,
          error: "خادم البريد غير مهيأ (يرجى إعداد GMAIL_USER و GMAIL_APP_PASSWORD في متغيرات البيئة)."
        });
      }

      const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true, // TLS
        auth: {
          user: gmailUser,
          pass: gmailAppPassword,
        },
      });

      const htmlContent = `
        <div dir="rtl" style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 20px; background-color: #ffffff;">
          <div style="text-align: center; margin-bottom: 20px;">
            <div style="display: inline-block; background-color: #f0f9ff; padding: 12px 24px; border-radius: 16px; border: 1px solid #bae6fd;">
              <h1 style="color: #0284c7; margin: 0; font-size: 22px; font-weight: 800;">Dory Medical System</h1>
            </div>
          </div>
          <h2 style="color: #0f172a; text-align: center; font-size: 18px; margin-bottom: 12px;">كود التحقق من حسابك في Dory</h2>
          <p style="color: #475569; font-size: 14px; line-height: 1.6; text-align: center; margin-bottom: 24px;">
            مرحباً بك! رمز التحقق الخاص بك لتأكيد البريد الإلكتروني وتفعيل حسابك في منصة Dory هو:
          </p>
          <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-radius: 16px; margin: 16px 0; border: 1px border-dashed #cbd5e1;">
            <span style="font-size: 36px; font-weight: 900; letter-spacing: 8px; color: #0284c7; font-family: monospace; direction: ltr; display: inline-block;">${code}</span>
          </div>
          <p style="color: #64748b; font-size: 12px; text-align: center; margin-top: 20px; line-height: 1.5;">
            ⏰ صلاحية هذا الكود هي 10 دقائق فقط.<br/>
            إذا لم تطلب هذا الكود، يمكنك تجاهل هذه الرسالة بأمان.
          </p>
        </div>
      `;

      console.log(`[OTP Server Log] Initiating Gmail SMTP sendMail to target email...`);

      const info = await transporter.sendMail({
        from: `"Dory Medical System" <${gmailUser}>`,
        to: email.trim(),
        subject: "كود التحقق من حسابك في Dory",
        html: htmlContent,
      });

      console.log(`[OTP Server Log] Gmail SMTP sendMail succeeded:`, {
        messageId: info.messageId,
        accepted: info.accepted,
        rejected: info.rejected,
        response: info.response,
      });

      return res.status(200).json({
        success: true,
        message: "تم إرسال كود التحقق بنجاح",
        messageId: info.messageId
      });
    } catch (error: any) {
      console.error("[OTP Server Error] Failed to send email via Nodemailer Gmail SMTP:", {
        message: error?.message,
        code: error?.code,
        command: error?.command,
        response: error?.response,
        responseCode: error?.responseCode
      });

      return res.status(500).json({
        success: false,
        error: error?.message 
          ? `فشل إرسال البريد عبر Gmail SMTP: ${error.message}`
          : "فشل إرسال كود التحقق عبر Gmail. يرجى التأكد من البريد الإلكتروني والإعدادات."
      });
    }
  });

  // Rate Limiting maps for booking spam prevention
  const bookingPhoneRateMap = new Map<string, OtpRateLimitEntry>();
  const bookingIpRateMap = new Map<string, OtpRateLimitEntry>();

  // Helper middleware for admin routes returning verified user
  async function requireAdminUser(req: express.Request, res: express.Response) {
    const authHeader = req.headers.authorization;
    const verifiedUser = await verifyFirebaseIdToken(authHeader);
    if (!verifiedUser) {
      res.status(401).json({ error: "غير مصرح: يجب تسجيل الدخول بحساب مدير المنصة (Authentication Required)" });
      return null;
    }
    if (!verifiedUser.isAdmin) {
      res.status(403).json({ error: "تم رفض الطلب: يتطلب صلاحيات مدير المنصة (Admin Privileges Required)" });
      return null;
    }
    return verifiedUser;
  }

  // Admin Security Action: Toggle Doctor Account Status with Firestore persistence
  app.post("/api/admin/toggle-status", async (req, res) => {
    try {
      const admin = await requireAdminUser(req, res);
      if (!admin) return;

      const { doctorId, isActive } = req.body;
      
      if (!doctorId) {
        return res.status(400).json({ error: "Doctor ID is required" });
      }

      const activeBool = Boolean(isActive);
      const updates = {
        isActive: activeBool,
        updatedAt: new Date().toISOString(),
        lastModifiedByAdmin: admin.email || admin.uid
      };
      const ok = await updateDoctorDocAuthoritative(doctorId, updates, admin.idToken);
      if (!ok) {
        const doctorRef = doc(db, "doctors", doctorId);
        await updateDoc(doctorRef, updates);
      }

      console.log(`[AUDIT LOG] Admin (${admin.email || admin.uid}) toggleDoctorStatus: doctorId ${doctorId} -> ${activeBool}`);

      res.json({
        success: true,
        message: `Doctor ${doctorId} status updated to ${activeBool ? 'active' : 'deactivated'}`,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error("[Admin toggle-status error]:", error);
      res.status(500).json({ error: error.message || "Failed to update doctor status" });
    }
  });

  // Admin Security Action: Update Doctor Subscription with Firestore persistence
  app.post("/api/admin/update-subscription", async (req, res) => {
    try {
      const admin = await requireAdminUser(req, res);
      if (!admin) return;

      const { doctorId, subscriptionStatus, durationMonths } = req.body;
      
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
        subscriptionModifiedBy: admin.email || admin.uid
      };

      if (subscriptionStatus === 'active') {
        updateData.subscriptionStartedAt = now.toISOString();
      }

      const doctorOk = await updateDoctorDocAuthoritative(doctorId, updateData, admin.idToken);
      if (!doctorOk) {
        const doctorRef = doc(db, "doctors", doctorId);
        await updateDoc(doctorRef, updateData);
      }

      console.log(`[AUDIT LOG] Admin (${admin.email || admin.uid}) updateSubscription for ${doctorId}: ${subscriptionStatus}`);

      res.json({
        success: true,
        message: `Subscription for doctor ${doctorId} set to ${subscriptionStatus}`,
        expiresAt,
        timestamp: now.toISOString()
      });
    } catch (error: any) {
      console.error("[Admin update-subscription error]:", error);
      res.status(500).json({ error: error.message || "Failed to update subscription" });
    }
  });

  // Admin Security Action: Delete or Deactivate Doctor Account with Firestore persistence
  app.post("/api/admin/delete-doctor", async (req, res) => {
    try {
      const admin = await requireAdminUser(req, res);
      if (!admin) return;

      const { doctorId } = req.body;
      if (!doctorId) {
        return res.status(400).json({ error: "Doctor ID is required" });
      }

      const delData = {
        isActive: false,
        isDeleted: true,
        deletedAt: new Date().toISOString(),
        deletedByAdmin: admin.email || admin.uid
      };
      const delOk = await updateDoctorDocAuthoritative(doctorId, delData, admin.idToken);
      if (!delOk) {
        const doctorRef = doc(db, "doctors", doctorId);
        await updateDoc(doctorRef, delData);
      }

      console.log(`[AUDIT LOG] Admin (${admin.email || admin.uid}) deleteDoctorAccount for doctorId: ${doctorId}`);

      res.json({
        success: true,
        message: `Doctor account ${doctorId} deactivated/marked deleted by Admin`,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error("[Admin delete-doctor error]:", error);
      res.status(500).json({ error: error.message || "Failed to delete doctor account" });
    }
  });

  // Admin Security Action: Set Custom Claim for Admin privilege
  app.post("/api/admin/set-custom-claim", async (req, res) => {
    try {
      const admin = await requireAdminUser(req, res);
      if (!admin) return;

      const { targetUid, isAdmin } = req.body;
      if (!targetUid) {
        return res.status(400).json({ error: "Target UID is required" });
      }

      console.log(`[AUDIT LOG] Admin (${admin.email || admin.uid}) action: setCustomClaim admin=${isAdmin} for UID: ${targetUid}`);

      res.json({
        success: true,
        message: `Admin custom claim set to ${isAdmin} for user ${targetUid}`,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to set custom claim" });
    }
  });

  // Security Verification Endpoint for Booking Rate Limiting & Spam Protection
  app.post("/api/security/check-booking-spam", (req, res) => {
    const { phone } = req.body || {};
    if (!phone) {
      return res.status(400).json({ allowed: false, error: "رقم الهاتف مطلوب للتحقق من الحجز" });
    }

    const clientIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown_ip";
    const normalizedPhone = String(phone).replace(/\D/g, '');

    // IP limit: max 10 booking requests per 15 minutes
    if (isOtpRateLimited(bookingIpRateMap, clientIp, 10, 15 * 60 * 1000)) {
      return res.status(429).json({
        allowed: false,
        error: "تم تجاوز الحد الأقصى لمحاولات الحجز من هذا الجهاز. يرجى الانتظار قليلاً والمحاولة مجدداً."
      });
    }

    // Phone limit: max 4 booking attempts per 10 minutes per phone
    if (normalizedPhone && isOtpRateLimited(bookingPhoneRateMap, normalizedPhone, 4, 10 * 60 * 1000)) {
      return res.status(429).json({
        allowed: false,
        error: "تم تجاوز عدد محاولات الحجز المسموح بها لرقم الهاتف هذا خلال وقت قصير. يرجى الانتظار 10 دقائق."
      });
    }

    res.json({ allowed: true });
  });

  // Dynamic Sitemap Route
  app.get("/sitemap.xml", async (req, res) => {
    try {
      const xml = await generateSitemapXml();
      res.setHeader("Content-Type", "application/xml; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800");
      res.status(200).send(xml);
    } catch (err) {
      console.error("Express sitemap error:", err);
      const fallbackXml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>https://dory-system.vercel.app/</loc>\n  </url>\n</urlset>`;
      res.setHeader("Content-Type", "application/xml; charset=utf-8");
      res.status(200).send(fallbackXml);
    }
  });

  // Clinic SEO Prerender Route (supports /clinic/:docId and /clinic/:docId/book)
  app.get(["/clinic/:docId", "/clinic/:docId/book"], async (req, res) => {
    try {
      const docId = req.params.docId;
      const rootDir = process.cwd();
      const result = await renderClinicHtml(rootDir, docId);

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      if (result.status === 200) {
        res.setHeader("Cache-Control", "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400");
      } else {
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      }

      res.status(result.status).send(result.html);
    } catch (err) {
      console.error("Express clinic prerender error:", err);
      res.status(500).send('<!doctype html><html lang="ar" dir="rtl"><head><title>خطأ في الخادم</title></head><body><h1>500 - حدث خطأ غير متوقع</h1></body></html>');
    }
  });

  // Vite middleware for development vs Production static files
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running securely on http://localhost:${PORT}`);
  });
}

startServer();
