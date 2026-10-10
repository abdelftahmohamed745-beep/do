import { addDoc, collection } from 'firebase/firestore';
import { db } from '../firebase/config';

// 1. Sanitization & Anti-XSS Functions
export function sanitizeInput(input: string | undefined | null): string {
  if (!input) return '';
  
  // Strip dangerous script, iframe, HTML tags and inline event handlers
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .trim();
}

// 2. Patient Phone Number Sanitization & Strict Validation
// Minimum: 10 digits, Maximum: 11 digits. Digits only. Preserves leading zero as string.
export function sanitizePatientPhoneNumber(phone: string | undefined | null, maxDigits: number = 11): string {
  if (!phone) return '';
  
  // 1. Convert Eastern Arabic numerals (٠-٩) and Persian numerals (۰-۹) to standard ASCII (0-9)
  let str = phone.replace(/[٠-٩]/g, (d) => (d.charCodeAt(0) - 1632).toString());
  str = str.replace(/[۰-۹]/g, (d) => (d.charCodeAt(0) - 1776).toString());

  // 2. Remove all non-digit characters except for international + at the beginning for initial detection
  const hasPlus20 = str.trim().startsWith('+20');
  let digits = str.replace(/\D/g, '');

  // 3. Normalize Egyptian mobile phone numbers (+201... or 00201...) to local standard (01...)
  if (hasPlus20 && digits.startsWith('201') && digits.length >= 12) {
    digits = '0' + digits.slice(2);
  } else if (digits.length === 12 && digits.startsWith('201')) {
    digits = '0' + digits.slice(2);
  } else if (digits.length === 14 && digits.startsWith('00201')) {
    digits = '0' + digits.slice(4);
  }

  // 4. Input-level limit: never allow more than maxDigits
  if (maxDigits > 0 && digits.length > maxDigits) {
    digits = digits.slice(0, maxDigits);
  }

  return digits;
}

export function validatePatientPhoneNumber(phone: string | undefined | null): {
  isValid: boolean;
  error?: string;
  cleanPhone: string;
} {
  if (!phone || typeof phone !== 'string' || !phone.trim()) {
    return {
      isValid: false,
      error: 'رقم الهاتف يجب أن يكون من 10 إلى 11 رقمًا.',
      cleanPhone: ''
    };
  }

  // 1. Convert numerals
  let str = phone.trim().replace(/[٠-٩]/g, (d) => (d.charCodeAt(0) - 1632).toString());
  str = str.replace(/[۰-۹]/g, (d) => (d.charCodeAt(0) - 1776).toString());

  // Check if original value contains non-digits other than common separators (+, -, spaces, parentheses)
  const nonAllowedChars = str.replace(/[\d\s+\-()]/g, '');
  if (nonAllowedChars.length > 0) {
    return {
      isValid: false,
      error: 'رقم الهاتف يجب أن يحتوي على أرقام فقط.',
      cleanPhone: str.replace(/\D/g, '')
    };
  }

  // 2. Extract digits without truncating, to detect 12+ digits
  let digits = str.replace(/\D/g, '');

  // 3. Normalize Egyptian international prefixes (+201... or 00201...)
  if (digits.length === 12 && digits.startsWith('201')) {
    digits = '0' + digits.slice(2);
  } else if (digits.length === 14 && digits.startsWith('00201')) {
    digits = '0' + digits.slice(4);
  }

  // 4. Strict length verification: exactly 10 or 11 digits
  if (digits.length < 10 || digits.length > 11) {
    return {
      isValid: false,
      error: 'رقم الهاتف يجب أن يكون من 10 إلى 11 رقمًا.',
      cleanPhone: digits
    };
  }

  // 5. Must be purely numeric string
  if (!/^\d{10,11}$/.test(digits)) {
    return {
      isValid: false,
      error: 'رقم الهاتف يجب أن يحتوي على أرقام فقط.',
      cleanPhone: digits
    };
  }

  return {
    isValid: true,
    cleanPhone: digits
  };
}

export function isValidPhoneNumber(phone: string): boolean {
  return validatePatientPhoneNumber(phone).isValid;
}

// 3. Email Address Validation
export function isValidEmail(email: string): boolean {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

// 4. Safe URL Validation
export function isValidUrl(url: string): boolean {
  if (!url) return true; // Optional fields can be empty
  const trimmed = url.trim().toLowerCase();
  if (trimmed.startsWith('javascript:') || trimmed.startsWith('data:')) return false;
  return trimmed.startsWith('https://') || trimmed.startsWith('http://');
}

// 5. Booking Rate Limiting & Anti-Spam Check
const BOOKING_COOLDOWN_MS = 60 * 1000; // 60 seconds cooldown between tickets per phone
const bookingTimestamps: Record<string, number> = {};

export function checkBookingRateLimit(phoneKey: string): { allowed: boolean; remainingSeconds?: number } {
  const cleanKey = phoneKey.replace(/[+\s\-()]/g, '');
  const now = Date.now();
  const lastBooking = bookingTimestamps[cleanKey];

  if (lastBooking && now - lastBooking < BOOKING_COOLDOWN_MS) {
    const remainingSeconds = Math.ceil((BOOKING_COOLDOWN_MS - (now - lastBooking)) / 1000);
    return { allowed: false, remainingSeconds };
  }

  return { allowed: true };
}

export function recordBookingSuccess(phoneKey: string): void {
  const cleanKey = phoneKey.replace(/[+\s\-()]/g, '');
  bookingTimestamps[cleanKey] = Date.now();
}

// 6. Security Audit Log Service
export interface AuditLogEntry {
  action: string;
  performedByUid: string;
  targetDoctorId?: string;
  details?: Record<string, any>;
  timestamp: string;
  ipAddress?: string;
}

export async function writeAuditLog(
  action: string,
  performedByUid: string,
  targetDoctorId?: string,
  details?: Record<string, any>
): Promise<void> {
  try {
    const logData: AuditLogEntry = {
      action,
      performedByUid,
      targetDoctorId: targetDoctorId || 'N/A',
      details: details || {},
      timestamp: new Date().toISOString()
    };

    await addDoc(collection(db, "auditLogs"), logData);
  } catch (error) {
    console.error("Audit log creation error:", error);
  }
}
