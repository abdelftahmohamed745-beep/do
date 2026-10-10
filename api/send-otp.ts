import nodemailer from "nodemailer";

export default async function handler(req: any, res: any) {
  // Safe logging: print method and pathname only, no secrets
  const pathname = req.url ? new URL(req.url, `http://${req.headers.host || 'localhost'}`).pathname : '/api/send-otp';
  console.log(`[API Log] Method: ${req.method}, Path: ${pathname}`);

  res.setHeader("Content-Type", "application/json");

  // Handle CORS options preflight if needed
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: `Method ${req.method} Not Allowed. Expected POST.`
    });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const { email, code } = body;

    if (!email || !code) {
      return res.status(400).json({ success: false, error: "Email and OTP code are required" });
    }

    const gmailUser = process.env.GMAIL_USER;
    const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;

    if (!gmailUser || !gmailAppPassword) {
      console.error("[OTP API Error] GMAIL_USER or GMAIL_APP_PASSWORD missing");
      return res.status(500).json({
        success: false,
        error: "خادم البريد غير مهيأ (GMAIL_USER / GMAIL_APP_PASSWORD مفقود)."
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

    console.log(`[OTP API Log] Initiating Gmail SMTP sendMail...`);

    const info = await transporter.sendMail({
      from: `"Dory Medical System" <${gmailUser}>`,
      to: String(email).trim(),
      subject: "كود التحقق من حسابك في Dory",
      html: htmlContent,
    });

    console.log(`[OTP API Log] Gmail SMTP sendMail succeeded:`, {
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
    console.error("[OTP API Error] Failed to send email via Gmail SMTP:", {
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
}
