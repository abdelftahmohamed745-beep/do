interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const bookingPhoneRateMap = new Map<string, RateLimitEntry>();
const bookingIpRateMap = new Map<string, RateLimitEntry>();

function isRateLimited(
  map: Map<string, RateLimitEntry>,
  key: string,
  maxAttempts: number,
  windowMs: number
): boolean {
  const now = Date.now();
  const entry = map.get(key);

  if (!entry || now > entry.resetAt) {
    map.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }

  entry.count += 1;
  return entry.count > maxAttempts;
}

export default async function handler(req: any, res: any) {
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ allowed: false, error: "Method Not Allowed" });
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
  const { phone } = body;

  if (!phone) {
    return res.status(400).json({ allowed: false, error: "رقم الهاتف مطلوب للتحقق من الحجز" });
  }

  const clientIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket?.remoteAddress || "unknown_ip";
  const normalizedPhone = String(phone).replace(/\D/g, '');

  // IP limit: max 10 booking requests per 15 minutes
  if (isRateLimited(bookingIpRateMap, clientIp, 10, 15 * 60 * 1000)) {
    return res.status(429).json({
      allowed: false,
      error: "تم تجاوز الحد الأقصى لمحاولات الحجز من هذا الجهاز. يرجى الانتظار قليلاً والمحاولة مجدداً."
    });
  }

  // Phone limit: max 4 booking attempts per 10 minutes per phone
  if (normalizedPhone && isRateLimited(bookingPhoneRateMap, normalizedPhone, 4, 10 * 60 * 1000)) {
    return res.status(429).json({
      allowed: false,
      error: "تم تجاوز عدد محاولات الحجز المسموح بها لرقم الهاتف هذا خلال وقت قصير. يرجى الانتظار 10 دقائق."
    });
  }

  return res.status(200).json({ allowed: true });
}
