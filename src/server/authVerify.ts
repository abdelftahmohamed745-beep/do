import { db } from '../firebase/config';
import { doc, getDoc } from 'firebase/firestore';

export interface VerifiedAuthUser {
  uid: string;
  email?: string;
  emailVerified?: boolean;
  isAdmin: boolean;
  idToken?: string;
}

export interface ClinicAccessCheck {
  authorized: boolean;
  isDoctorOwner: boolean;
  isAdmin: boolean;
  userMember: any | null;
  isSubscriptionActive: boolean;
  reason?: string;
}

// Project & Firestore config constants
const FIREBASE_PROJECT_ID = 'prefab-groove-502023-t4';
const FIRESTORE_DATABASE_ID = 'ai-studio-f8a934fa-e4dd-4561-8d66-6ad00154589f';

// Authorized Admin Emails
const ADMIN_EMAILS = [
  'bkay38757@gmail.com',
  'abdelftahmohamed745@gmail.com',
  'admin@dawry.app'
];

/**
 * Parse Firestore REST API document fields into plain JavaScript object
 */
function parseFirestoreRestFields(fields: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, val] of Object.entries(fields)) {
    if (!val || typeof val !== 'object') continue;
    if ('stringValue' in val) result[key] = val.stringValue;
    else if ('booleanValue' in val) result[key] = val.booleanValue;
    else if ('integerValue' in val) result[key] = Number(val.integerValue);
    else if ('doubleValue' in val) result[key] = Number(val.doubleValue);
    else if ('nullValue' in val) result[key] = null;
    else if ('mapValue' in val) result[key] = parseFirestoreRestFields(val.mapValue.fields || {});
    else if ('arrayValue' in val) {
      result[key] = (val.arrayValue.values || []).map((item: any) => {
        if ('stringValue' in item) return item.stringValue;
        if ('booleanValue' in item) return item.booleanValue;
        if ('integerValue' in item) return Number(item.integerValue);
        if ('doubleValue' in item) return Number(item.doubleValue);
        return item;
      });
    }
  }
  return result;
}

/**
 * Serialize plain JavaScript object into Firestore REST API fields format
 */
function serializeToFirestoreRest(data: Record<string, any>): Record<string, any> {
  const fields: Record<string, any> = {};
  for (const [key, val] of Object.entries(data)) {
    if (val === undefined) continue;
    if (val === null) {
      fields[key] = { nullValue: null };
    } else if (typeof val === 'string') {
      fields[key] = { stringValue: val };
    } else if (typeof val === 'boolean') {
      fields[key] = { booleanValue: val };
    } else if (typeof val === 'number') {
      if (Number.isInteger(val)) {
        fields[key] = { integerValue: String(val) };
      } else {
        fields[key] = { doubleValue: val };
      }
    } else if (Array.isArray(val)) {
      fields[key] = {
        arrayValue: {
          values: val.map((v) => {
            if (typeof v === 'string') return { stringValue: v };
            if (typeof v === 'boolean') return { booleanValue: v };
            if (typeof v === 'number') return { integerValue: String(v) };
            return { stringValue: String(v) };
          })
        }
      };
    } else if (typeof val === 'object') {
      fields[key] = {
        mapValue: {
          fields: serializeToFirestoreRest(val)
        }
      };
    }
  }
  return fields;
}

/**
 * Fetch a document from Firestore REST API with the user's Bearer token
 */
export async function getDocRestWithToken(
  collectionName: string,
  docId: string,
  idToken?: string
): Promise<Record<string, any> | null> {
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/${FIRESTORE_DATABASE_ID}/documents/${collectionName}/${docId}`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (idToken) headers['Authorization'] = `Bearer ${idToken}`;

    const res = await fetch(url, { headers });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.fields) return null;
    return parseFirestoreRestFields(data.fields);
  } catch (err) {
    console.warn(`[Server Auth] REST fetch error for ${collectionName}/${docId}:`, err);
    return null;
  }
}

/**
 * Update a doctor document authoritatively in Firestore using admin ID token
 */
export async function updateDoctorDocAuthoritative(
  doctorId: string,
  updates: Record<string, any>,
  adminIdToken?: string
): Promise<boolean> {
  try {
    const fieldMask = Object.keys(updates)
      .map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`)
      .join('&');
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/${FIRESTORE_DATABASE_ID}/documents/doctors/${doctorId}?${fieldMask}`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (adminIdToken) headers['Authorization'] = `Bearer ${adminIdToken}`;

    const res = await fetch(url, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ fields: serializeToFirestoreRest(updates) })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error(`[Server Admin Auth] Authoritative doctor update failed (${res.status}):`, err);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[Server Admin Auth] Exception during authoritative doctor update:`, err);
    return false;
  }
}

/**
 * Delete a doctor document authoritatively in Firestore using admin ID token
 */
export async function deleteDoctorDocAuthoritative(
  doctorId: string,
  adminIdToken?: string
): Promise<boolean> {
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/${FIRESTORE_DATABASE_ID}/documents/doctors/${doctorId}`;
    const headers: Record<string, string> = {};
    if (adminIdToken) headers['Authorization'] = `Bearer ${adminIdToken}`;

    const res = await fetch(url, { method: 'DELETE', headers });
    if (!res.ok && res.status !== 404) {
      const err = await res.json().catch(() => ({}));
      console.error(`[Server Admin Auth] Authoritative doctor delete failed (${res.status}):`, err);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[Server Admin Auth] Exception during authoritative doctor delete:`, err);
    return false;
  }
}

/**
 * Verify Firebase ID Token via Google Identity Toolkit REST API
 */
export async function verifyFirebaseIdToken(authHeader?: string): Promise<VerifiedAuthUser | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const idToken = authHeader.substring(7).trim();
  if (!idToken) return null;

  try {
    const apiKey = process.env.VITE_FIREBASE_API_KEY || 'AIzaSyCcS-iNhEkZ80ryW6AGS854ERxXBklYSyE';
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken })
      }
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.warn('[Server Auth] Token validation failed:', err?.error?.message || response.statusText);
      return null;
    }

    const data = await response.json();
    const user = data.users?.[0];
    if (!user || !user.localId) return null;

    const email = user.email ? String(user.email).toLowerCase() : undefined;
    const emailVerified = Boolean(user.emailVerified);

    let isAdmin = false;
    if (email && emailVerified && ADMIN_EMAILS.includes(email)) {
      isAdmin = true;
    }

    // Check custom claims for admin
    if (user.customAttributes) {
      try {
        const claims = JSON.parse(user.customAttributes);
        if (claims.admin === true) {
          isAdmin = true;
        }
      } catch {}
    }

    return {
      uid: user.localId,
      email,
      emailVerified,
      isAdmin,
      idToken
    };
  } catch (error) {
    console.error('[Server Auth] Error validating token with Google Identity:', error);
    return null;
  }
}

/**
 * Server-side verification of user clinic membership and subscription validity
 * Does NOT trust client-supplied flags
 */
export async function verifyClinicAccess(
  user: VerifiedAuthUser,
  clinicId: string
): Promise<ClinicAccessCheck> {
  try {
    // 1. If user is Platform Admin, full access is granted
    if (user.isAdmin) {
      return {
        authorized: true,
        isDoctorOwner: false,
        isAdmin: true,
        userMember: null,
        isSubscriptionActive: true
      };
    }

    // 2. Fetch Clinic Doctor Profile from Firestore
    let doctorData: any = null;
    try {
      const doctorDocRef = doc(db, 'doctors', clinicId);
      const doctorSnap = await getDoc(doctorDocRef);
      if (doctorSnap.exists()) {
        doctorData = doctorSnap.data();
      }
    } catch {
      // Fallback via REST API
      doctorData = await getDocRestWithToken('doctors', clinicId, user.idToken);
    }

    if (!doctorData) {
      return {
        authorized: false,
        isDoctorOwner: false,
        isAdmin: false,
        userMember: null,
        isSubscriptionActive: false,
        reason: 'العيادة غير مسجلة في النظام'
      };
    }

    // Check if clinic is active
    if (doctorData.isActive === false) {
      return {
        authorized: false,
        isDoctorOwner: false,
        isAdmin: false,
        userMember: null,
        isSubscriptionActive: false,
        reason: 'حساب هذه العيادة معطل حالياً'
      };
    }

    // Evaluate subscription on server
    let isSubActive = false;
    if (doctorData.isLifetime) {
      isSubActive = true;
    } else if (doctorData.subscriptionStatus === 'active') {
      if (doctorData.subscriptionExpiresAt) {
        isSubActive = new Date(doctorData.subscriptionExpiresAt).getTime() > Date.now();
      } else {
        isSubActive = true;
      }
    }

    // 3. Check if user is the Doctor Owner
    const isOwner = user.uid === clinicId || doctorData.ownerId === user.uid;
    if (isOwner) {
      return {
        authorized: true,
        isDoctorOwner: true,
        isAdmin: false,
        userMember: null,
        isSubscriptionActive: isSubActive
      };
    }

    // 4. Check if user is an authorized Clinic Member in clinic_members
    let memberData: any = null;
    try {
      const memberDocRef = doc(db, 'clinic_members', user.uid);
      const memberSnap = await getDoc(memberDocRef);
      if (memberSnap.exists()) {
        memberData = { id: memberSnap.id, ...memberSnap.data() };
      }
    } catch {
      // If client SDK throws permission-denied in server environment, use REST with user's ID token
    }

    if (!memberData && user.idToken) {
      const restMember = await getDocRestWithToken('clinic_members', user.uid, user.idToken);
      if (restMember) {
        memberData = { id: user.uid, ...restMember };
      }
    }

    if (memberData) {
      if (
        memberData.organizationId === clinicId &&
        memberData.status === 'active'
      ) {
        return {
          authorized: true,
          isDoctorOwner: false,
          isAdmin: false,
          userMember: memberData,
          isSubscriptionActive: isSubActive
        };
      }
    }

    return {
      authorized: false,
      isDoctorOwner: false,
      isAdmin: false,
      userMember: null,
      isSubscriptionActive: isSubActive,
      reason: 'ليس لديك صلاحية الوصول لبيانات هذه العيادة'
    };
  } catch (error: any) {
    console.error('[Server Auth] Error checking clinic access:', error);
    return {
      authorized: false,
      isDoctorOwner: false,
      isAdmin: false,
      userMember: null,
      isSubscriptionActive: false,
      reason: 'حدث خطأ أثناء التحقق من الصلاحيات'
    };
  }
}
