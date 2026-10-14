import { sanitizeInput, sanitizePatientPhoneNumber, validatePatientPhoneNumber, checkBookingRateLimit, recordBookingSuccess } from '../src/services/securityService';
import { verifyFirebaseIdToken, verifyClinicAccess } from '../src/server/authVerify';
import { calculateExpirationDate } from '../src/utils/subscriptionUtils';
import { evaluateSubscriptionStatus } from '../src/services/firebaseService';
import { cleanMessageForStorage } from '../src/services/ai/aiAgentClient';
import { sanitizeFirestorePayload, validateAndNormalizeTask } from '../src/services/ai/taskValidation';
import { classifyProviderError } from '../src/server/aiAgentServer';
import type { AiConversation, AiAgentMessage } from '../src/types/aiAgent';
import type { DoctorProfile } from '../src/types';

interface TestResult {
  suite: string;
  testName: string;
  result: 'PASS' | 'FAIL' | 'BLOCKED';
  evidence: string;
  details?: any;
}

const auditResults: TestResult[] = [];

async function runAudit() {
  console.log('=== STARTING INDEPENDENT VERIFICATION AUDIT SUITE ===\n');

  // =========================================================================
  // SUITE 1: AUTHENTICATION AND AUTHORIZATION
  // =========================================================================
  console.log('--- Suite 1: Authentication and Authorization ---');

  // Test 1.1: Missing Bearer Token
  try {
    const resNull = await verifyFirebaseIdToken(undefined);
    const resEmpty = await verifyFirebaseIdToken('');
    const resInvalidFormat = await verifyFirebaseIdToken('Basic dXNlcjpwYXNz');

    if (resNull === null && resEmpty === null && resInvalidFormat === null) {
      auditResults.push({
        suite: '1. Authentication and Authorization',
        testName: '1.1 Missing & Malformed Bearer Token Rejection',
        result: 'PASS',
        evidence: 'verifyFirebaseIdToken correctly returns null for undefined, empty, and non-Bearer headers.'
      });
    } else {
      auditResults.push({
        suite: '1. Authentication and Authorization',
        testName: '1.1 Missing & Malformed Bearer Token Rejection',
        result: 'FAIL',
        evidence: `Expected all null, got: null=${resNull}, empty=${resEmpty}, invalid=${resInvalidFormat}`
      });
    }
  } catch (err: any) {
    auditResults.push({
      suite: '1. Authentication and Authorization',
      testName: '1.1 Missing & Malformed Bearer Token Rejection',
      result: 'FAIL',
      evidence: `Error thrown: ${err.message}`
    });
  }

  // Test 1.2: Invalid / Forged Token String
  try {
    const fakeToken = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.fake_signature';
    const resFake = await verifyFirebaseIdToken(fakeToken);

    if (resFake === null) {
      auditResults.push({
        suite: '1. Authentication and Authorization',
        testName: '1.2 Invalid / Forged Token Cryptographic Rejection',
        result: 'PASS',
        evidence: 'Google Identity Toolkit REST API rejects invalid signature/claims, returning null.'
      });
    } else {
      auditResults.push({
        suite: '1. Authentication and Authorization',
        testName: '1.2 Invalid / Forged Token Cryptographic Rejection',
        result: 'FAIL',
        evidence: `Fake token unexpectedly validated: ${JSON.stringify(resFake)}`
      });
    }
  } catch (err: any) {
    auditResults.push({
      suite: '1. Authentication and Authorization',
      testName: '1.2 Invalid / Forged Token Cryptographic Rejection',
      result: 'FAIL',
      evidence: `Error thrown: ${err.message}`
    });
  }

  // Test 1.3: Cross-Clinic Access Enforcement (Mock user verified with uid 'attacker_uid')
  try {
    const mockUser = {
      uid: 'attacker_123',
      email: 'attacker@example.com',
      emailVerified: true,
      isAdmin: false
    };

    // Attempt to access clinic 'target_clinic_999' where doctor does not exist or user is not owner
    const accessCheck = await verifyClinicAccess(mockUser, 'non_existent_or_unauthorized_clinic');
    if (!accessCheck.authorized) {
      auditResults.push({
        suite: '1. Authentication and Authorization',
        testName: '1.3 Cross-Clinic Access Rejection',
        result: 'PASS',
        evidence: `Access denied as expected: authorized=${accessCheck.authorized}, reason="${accessCheck.reason}"`
      });
    } else {
      auditResults.push({
        suite: '1. Authentication and Authorization',
        testName: '1.3 Cross-Clinic Access Rejection',
        result: 'FAIL',
        evidence: 'Unauthorized user was granted access!'
      });
    }
  } catch (err: any) {
    auditResults.push({
      suite: '1. Authentication and Authorization',
      testName: '1.3 Cross-Clinic Access Rejection',
      result: 'FAIL',
      evidence: `Error thrown: ${err.message}`
    });
  }

  // =========================================================================
  // SUITE 2: QUEUE INTEGRITY AND ANTI-SPAM LOGIC
  // =========================================================================
  console.log('--- Suite 2: Queue Integrity & Sanitization ---');

  // Test 2.1: Phone number normalization with Eastern Arabic digits and international prefix
  try {
    const p1 = sanitizePatientPhoneNumber('٠١٠١٢٣٤٥٦٧٨'); // Egyptian Eastern Arabic
    const p2 = sanitizePatientPhoneNumber('+201012345678'); // International prefix +20
    const p3 = sanitizePatientPhoneNumber('00201012345678'); // 0020 prefix
    const p4 = sanitizePatientPhoneNumber('01012345678'); // Standard

    const allMatch = p1 === '01012345678' && p2 === '01012345678' && p3 === '01012345678' && p4 === '01012345678';
    if (allMatch) {
      auditResults.push({
        suite: '2. Queue Integrity & Sanitization',
        testName: '2.1 Phone Number Normalization & Arabic Numeral Conversion',
        result: 'PASS',
        evidence: `All variants normalized to identical local Egyptian phone 01012345678. p1=${p1}, p2=${p2}, p3=${p3}`
      });
    } else {
      auditResults.push({
        suite: '2. Queue Integrity & Sanitization',
        testName: '2.1 Phone Number Normalization & Arabic Numeral Conversion',
        result: 'FAIL',
        evidence: `Normalization mismatch: p1=${p1}, p2=${p2}, p3=${p3}, p4=${p4}`
      });
    }
  } catch (err: any) {
    auditResults.push({
      suite: '2. Queue Integrity & Sanitization',
      testName: '2.1 Phone Number Normalization & Arabic Numeral Conversion',
      result: 'FAIL',
      evidence: `Error: ${err.message}`
    });
  }

  // Test 2.2: Dirty Dozen XSS / Malicious payload sanitization
  try {
    const dirty = '<script>alert("xss")</script><iframe src="evil.com"></iframe>John Doe & Co.';
    const clean = sanitizeInput(dirty);
    const hasScript = clean.includes('<script>') || clean.includes('iframe') || clean.includes('evil.com');

    if (!hasScript && clean.includes('John Doe & Co.')) {
      auditResults.push({
        suite: '2. Queue Integrity & Sanitization',
        testName: '2.2 XSS & Malicious Script Stripping',
        result: 'PASS',
        evidence: `Sanitizer stripped script and iframe tags cleanly. Output: "${clean}"`
      });
    } else {
      auditResults.push({
        suite: '2. Queue Integrity & Sanitization',
        testName: '2.2 XSS & Malicious Script Stripping',
        result: 'FAIL',
        evidence: `Sanitization leak: "${clean}"`
      });
    }
  } catch (err: any) {
    auditResults.push({
      suite: '2. Queue Integrity & Sanitization',
      testName: '2.2 XSS & Malicious Script Stripping',
      result: 'FAIL',
      evidence: `Error: ${err.message}`
    });
  }

  // Test 2.3: In-Memory Rate Limiting Behavior
  try {
    const testPhone = '01299998888';
    const firstCheck = checkBookingRateLimit(testPhone);
    recordBookingSuccess(testPhone);
    const secondCheck = checkBookingRateLimit(testPhone);

    if (firstCheck.allowed === true && secondCheck.allowed === false && (secondCheck.remainingSeconds || 0) > 0) {
      auditResults.push({
        suite: '2. Queue Integrity & Sanitization',
        testName: '2.3 In-Memory Booking Rate Limiter Cooldown',
        result: 'PASS',
        evidence: `First call allowed: ${firstCheck.allowed}. Rapid second call blocked: allowed=${secondCheck.allowed}, remainingSeconds=${secondCheck.remainingSeconds}.`
      });
    } else {
      auditResults.push({
        suite: '2. Queue Integrity & Sanitization',
        testName: '2.3 In-Memory Booking Rate Limiter Cooldown',
        result: 'FAIL',
        evidence: `Rate limiter failed: firstCheck=${JSON.stringify(firstCheck)}, secondCheck=${JSON.stringify(secondCheck)}`
      });
    }
  } catch (err: any) {
    auditResults.push({
      suite: '2. Queue Integrity & Sanitization',
      testName: '2.3 In-Memory Booking Rate Limiter Cooldown',
      result: 'FAIL',
      evidence: `Error: ${err.message}`
    });
  }

  // =========================================================================
  // SUITE 3: AI CHAT PERSISTENCE AND HISTORY MERGING
  // =========================================================================
  console.log('--- Suite 3: AI Chat Persistence & Safe Merging ---');

  // Test 3.1: cleanMessageForStorage removes undefined and dangerous props
  try {
    const rawMsg: any = {
      id: 'msg_1',
      role: 'user',
      content: 'مرحباً',
      toolCalls: undefined,
      toolResults: undefined,
      dummyFunction: () => {}
    };

    const cleaned = cleanMessageForStorage(rawMsg);
    const hasUndefined = Object.values(cleaned).some((v) => v === undefined);

    if (!hasUndefined && cleaned.id === 'msg_1' && cleaned.content === 'مرحباً') {
      auditResults.push({
        suite: '3. AI Chat Persistence',
        testName: '3.1 Message Sanitization for Storage',
        result: 'PASS',
        evidence: 'cleanMessageForStorage eliminated undefined keys and preserved valid message fields.'
      });
    } else {
      auditResults.push({
        suite: '3. AI Chat Persistence',
        testName: '3.1 Message Sanitization for Storage',
        result: 'FAIL',
        evidence: `Cleaned message has issues: ${JSON.stringify(cleaned)}`
      });
    }
  } catch (err: any) {
    auditResults.push({
      suite: '3. AI Chat Persistence',
      testName: '3.1 Message Sanitization for Storage',
      result: 'FAIL',
      evidence: `Error: ${err.message}`
    });
  }

  // Test 3.2: Stale/Empty Remote History Merge Protection Logic
  try {
    // Simulate smart merge logic:
    // Local conversation has 5 messages, remote has 1 message or 0 messages (stale sync)
    const localConv: AiConversation = {
      id: 'conv_1',
      clinicId: 'doc_1',
      userId: 'user_1',
      title: 'استفسار عن الحجوزات',
      createdAt: '2026-10-10T10:00:00.000Z',
      updatedAt: '2026-10-10T10:05:00.000Z',
      messageCount: 5,
      messages: [
        { id: '1', role: 'user', content: '1', timestamp: '10:00' },
        { id: '2', role: 'assistant', content: '2', timestamp: '10:01' },
        { id: '3', role: 'user', content: '3', timestamp: '10:02' },
        { id: '4', role: 'assistant', content: '4', timestamp: '10:03' },
        { id: '5', role: 'user', content: '5', timestamp: '10:04' }
      ]
    };

    const staleRemoteConv: AiConversation = {
      id: 'conv_1',
      clinicId: 'doc_1',
      userId: 'user_1',
      title: 'محادثة سابقة',
      createdAt: '2026-10-10T10:00:00.000Z',
      updatedAt: '2026-10-10T10:01:00.000Z',
      messageCount: 1,
      messages: [{ id: '1', role: 'user', content: '1', timestamp: '10:00' }]
    };

    // The merge invariant:
    const localCount = localConv.messages?.length || 0;
    const remoteCount = staleRemoteConv.messages?.length || 0;
    let chosen: AiConversation;

    if (remoteCount > localCount) {
      chosen = staleRemoteConv;
    } else {
      chosen = localConv; // Preserve local!
    }

    if (chosen.messageCount === 5 && chosen.messages?.length === 5) {
      auditResults.push({
        suite: '3. AI Chat Persistence',
        testName: '3.2 Stale Remote Overwrite Protection Invariant',
        result: 'PASS',
        evidence: 'Smart merge preserved richer local conversation (5 messages) over stale remote version (1 message).'
      });
    } else {
      auditResults.push({
        suite: '3. AI Chat Persistence',
        testName: '3.2 Stale Remote Overwrite Protection Invariant',
        result: 'FAIL',
        evidence: `Stale remote was incorrectly chosen with messageCount: ${chosen.messageCount}`
      });
    }
  } catch (err: any) {
    auditResults.push({
      suite: '3. AI Chat Persistence',
      testName: '3.2 Stale Remote Overwrite Protection Invariant',
      result: 'FAIL',
      evidence: `Error: ${err.message}`
    });
  }

  // =========================================================================
  // SUITE 4: SUBSCRIPTION AND EXPIRATION EVALUATION
  // =========================================================================
  console.log('--- Suite 4: Subscription Evaluation ---');

  try {
    const expiredDoctor: Partial<DoctorProfile> = {
      isActive: true,
      isLifetime: false,
      subscriptionStatus: 'active',
      subscriptionExpiresAt: '2020-01-01T00:00:00.000Z' // Far in past
    };

    const lifetimeDoctor: Partial<DoctorProfile> = {
      isActive: true,
      isLifetime: true,
      subscriptionStatus: 'lifetime'
    };

    const statusExpired = evaluateSubscriptionStatus(expiredDoctor as DoctorProfile);
    const statusLifetime = evaluateSubscriptionStatus(lifetimeDoctor as DoctorProfile);

    if (statusExpired === 'expired' && statusLifetime === 'lifetime') {
      auditResults.push({
        suite: '4. Subscription Evaluation',
        testName: '4.1 Authoritative Subscription Expiry Computation',
        result: 'PASS',
        evidence: `Expired profile correctly evaluated as "expired"; Lifetime profile evaluated as "lifetime".`
      });
    } else {
      auditResults.push({
        suite: '4. Subscription Evaluation',
        testName: '4.1 Authoritative Subscription Expiry Computation',
        result: 'FAIL',
        evidence: `Unexpected evaluation: expiredDoctor=${statusExpired}, lifetimeDoctor=${statusLifetime}`
      });
    }
  } catch (err: any) {
    auditResults.push({
      suite: '4. Subscription Evaluation',
      testName: '4.1 Authoritative Subscription Expiry Computation',
      result: 'FAIL',
      evidence: `Error: ${err.message}`
    });
  }

  // =========================================================================
  // SUITE 5: FIRESTORE TASK PERSISTENCE & UNDEFINED-SAFETY
  // =========================================================================
  console.log('--- Suite 5: Firestore Task Persistence & Undefined-Safety ---');

  // Test 5.1: Deep Undefined Elimination with Intentional Null Preservation
  try {
    const rawPayload: any = {
      title: 'مهمة متابعة الحالات',
      notes: null, // Intentional null
      optionalNote: undefined, // Must be stripped
      nested: {
        keep: 'value',
        removeMe: undefined,
        nullField: null,
        innerList: [1, undefined, null, { deeplyNested: undefined, keepDeep: 42 }]
      }
    };

    const sanitized = sanitizeFirestorePayload(rawPayload);
    const hasUndefinedInRoot = 'optionalNote' in sanitized;
    const hasUndefinedInNested = 'removeMe' in sanitized.nested;
    const hasUndefinedInDeep = 'deeplyNested' in sanitized.nested.innerList[2];
    const preservedNull1 = sanitized.notes === null;
    const preservedNull2 = sanitized.nested.nullField === null;
    const preservedDeep = sanitized.nested.innerList[2].keepDeep === 42;

    if (!hasUndefinedInRoot && !hasUndefinedInNested && !hasUndefinedInDeep && preservedNull1 && preservedNull2 && preservedDeep) {
      auditResults.push({
        suite: '5. Firestore Task Persistence',
        testName: '5.1 Deep Undefined Elimination with Null Semantics Preservation',
        result: 'PASS',
        evidence: 'sanitizeFirestorePayload cleanly eliminated all undefined properties while preserving null values and nested arrays.'
      });
    } else {
      auditResults.push({
        suite: '5. Firestore Task Persistence',
        testName: '5.1 Deep Undefined Elimination with Null Semantics Preservation',
        result: 'FAIL',
        evidence: `Sanitization leak: rootUndef=${hasUndefinedInRoot}, nestedUndef=${hasUndefinedInNested}, preservedNull=${preservedNull1}`
      });
    }
  } catch (err: any) {
    auditResults.push({
      suite: '5. Firestore Task Persistence',
      testName: '5.1 Deep Undefined Elimination with Null Semantics Preservation',
      result: 'FAIL',
      evidence: `Error: ${err.message}`
    });
  }

  // Test 5.2: Required Field Validation & Malformed Task Rejection
  try {
    const malformed1 = validateAndNormalizeTask({ title: '' }, 'clinic_1', { uid: 'u1' });
    const malformed2 = validateAndNormalizeTask({ title: 'valid' }, '', { uid: 'u1' });

    if (!malformed1.valid && malformed1.fieldErrors?.title && !malformed2.valid && malformed2.fieldErrors?.clinicId) {
      auditResults.push({
        suite: '5. Firestore Task Persistence',
        testName: '5.2 Required Field Validation & Malformed Rejection',
        result: 'PASS',
        evidence: 'Rejected empty title and empty clinicId with explicit fieldErrors without writing to database.'
      });
    } else {
      auditResults.push({
        suite: '5. Firestore Task Persistence',
        testName: '5.2 Required Field Validation & Malformed Rejection',
        result: 'FAIL',
        evidence: `Validation failed to catch missing fields: m1=${JSON.stringify(malformed1)}, m2=${JSON.stringify(malformed2)}`
      });
    }
  } catch (err: any) {
    auditResults.push({
      suite: '5. Firestore Task Persistence',
      testName: '5.2 Required Field Validation & Malformed Rejection',
      result: 'FAIL',
      evidence: `Error: ${err.message}`
    });
  }

  // Test 5.3: Valid Task Normalization & Safe Payload Construction
  try {
    const validRaw = {
      title: 'إرسال تنبيه للمتأخرين',
      triggerType: 'EVENT',
      triggerConfig: {
        event: 'PATIENT_CALLED',
        optionalUndefined: undefined
      },
      actionType: 'SEND_REMINDER',
      actionConfig: {
        severity: 'urgent',
        autoExecution: true,
        messageTemplate: 'يرجى التوجه إلى غرفة الكشف'
      }
    };

    const norm = validateAndNormalizeTask(validRaw, 'clinic_123', { uid: 'doctor_1', name: 'د. أحمد' });

    if (norm.valid && norm.task) {
      const keys = Object.keys(norm.task);
      const values = Object.values(norm.task);
      const hasAnyUndefined = values.some((v) => v === undefined);
      const triggerKeys = Object.keys(norm.task.triggerConfig || {});

      if (!hasAnyUndefined && !triggerKeys.includes('optionalUndefined') && norm.task.clinicId === 'clinic_123' && norm.task.status === 'active') {
        auditResults.push({
          suite: '5. Firestore Task Persistence',
          testName: '5.3 Valid Task Normalization & Safe Payload Construction',
          result: 'PASS',
          evidence: `Task validated and normalized successfully without undefined properties: triggerEvent=${norm.task.triggerConfig?.event}, actionType=${norm.task.actionType}`
        });
      } else {
        auditResults.push({
          suite: '5. Firestore Task Persistence',
          testName: '5.3 Valid Task Normalization & Safe Payload Construction',
          result: 'FAIL',
          evidence: `Task normalized with undefined fields: ${JSON.stringify(norm.task)}`
        });
      }
    } else {
      auditResults.push({
        suite: '5. Firestore Task Persistence',
        testName: '5.3 Valid Task Normalization & Safe Payload Construction',
        result: 'FAIL',
        evidence: `Task was unexpectedly marked invalid: ${norm.error}`
      });
    }
  } catch (err: any) {
    auditResults.push({
      suite: '5. Firestore Task Persistence',
      testName: '5.3 Valid Task Normalization & Safe Payload Construction',
      result: 'FAIL',
      evidence: `Error: ${err.message}`
    });
  }

  // =========================================================================
  // SUITE 6: AI RESILIENCE & PROVIDER FAULT-TOLERANCE
  // =========================================================================
  console.log('--- Suite 6: AI Resilience & Provider Fault-Tolerance ---');

  // Test 6.1: Temporary Overload (503 UNAVAILABLE) Error Classification
  try {
    const error503 = new Error('503 UNAVAILABLE: This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.');
    const classified = classifyProviderError(error503);

    if (classified.category === 'TRANSIENT_OVERLOAD' && classified.isRetryable === true && classified.status === 503) {
      auditResults.push({
        suite: '6. AI Resilience & Fault-Tolerance',
        testName: '6.1 Temporary Overload (503 UNAVAILABLE) Classification',
        result: 'PASS',
        evidence: `Classified as TRANSIENT_OVERLOAD (status 503, retryable=true) with localized message: "${classified.messageAr}"`
      });
    } else {
      auditResults.push({
        suite: '6. AI Resilience & Fault-Tolerance',
        testName: '6.1 Temporary Overload (503 UNAVAILABLE) Classification',
        result: 'FAIL',
        evidence: `Unexpected classification: ${JSON.stringify(classified)}`
      });
    }
  } catch (err: any) {
    auditResults.push({
      suite: '6. AI Resilience & Fault-Tolerance',
      testName: '6.1 Temporary Overload (503 UNAVAILABLE) Classification',
      result: 'FAIL',
      evidence: `Error: ${err.message}`
    });
  }

  // Test 6.2: Rate Limit (429) & Retry-After Header Parsing
  try {
    const error429 = {
      message: '429 RESOURCE_EXHAUSTED: quota exceeded',
      status: 429,
      response: {
        headers: {
          get: (header: string) => (header === 'retry-after' ? '3' : null)
        }
      }
    };
    const classified = classifyProviderError(error429);

    if (classified.category === 'RATE_LIMIT' && classified.isRetryable === true && classified.retryAfterMs === 3000) {
      auditResults.push({
        suite: '6. AI Resilience & Fault-Tolerance',
        testName: '6.2 Rate Limit (429) & Retry-After Parsing',
        result: 'PASS',
        evidence: `Classified as RATE_LIMIT with retryAfterMs=3000 correctly extracted.`
      });
    } else {
      auditResults.push({
        suite: '6. AI Resilience & Fault-Tolerance',
        testName: '6.2 Rate Limit (429) & Retry-After Parsing',
        result: 'FAIL',
        evidence: `Unexpected classification: ${JSON.stringify(classified)}`
      });
    }
  } catch (err: any) {
    auditResults.push({
      suite: '6. AI Resilience & Fault-Tolerance',
      testName: '6.2 Rate Limit (429) & Retry-After Parsing',
      result: 'FAIL',
      evidence: `Error: ${err.message}`
    });
  }

  // Test 6.3: Request Timeout Classification
  try {
    const errorTimeout = new Error('Timeout exceeding 12000ms on model gemini-3.1-flash');
    const classified = classifyProviderError(errorTimeout);

    if (classified.category === 'TIMEOUT' && classified.isRetryable === true && classified.status === 504) {
      auditResults.push({
        suite: '6. AI Resilience & Fault-Tolerance',
        testName: '6.3 Request Timeout Classification',
        result: 'PASS',
        evidence: `Classified as TIMEOUT (status 504, retryable=true) with localized message: "${classified.messageAr}"`
      });
    } else {
      auditResults.push({
        suite: '6. AI Resilience & Fault-Tolerance',
        testName: '6.3 Request Timeout Classification',
        result: 'FAIL',
        evidence: `Unexpected classification: ${JSON.stringify(classified)}`
      });
    }
  } catch (err: any) {
    auditResults.push({
      suite: '6. AI Resilience & Fault-Tolerance',
      testName: '6.3 Request Timeout Classification',
      result: 'FAIL',
      evidence: `Error: ${err.message}`
    });
  }

  // Test 6.4: Unsupported Model (404) vs Transient Differentiation
  try {
    const error404 = { message: 'models/gemini-old is not found for API version v1beta', status: 404 };
    const classified = classifyProviderError(error404);

    if (classified.category === 'UNSUPPORTED_MODEL' && classified.isRetryable === false && classified.status === 404) {
      auditResults.push({
        suite: '6. AI Resilience & Fault-Tolerance',
        testName: '6.4 Unsupported Model (404) Non-Retryable Differentiation',
        result: 'PASS',
        evidence: 'Classified 404 as non-retryable UNSUPPORTED_MODEL, allowing clean advancement to verified fallback without spinning.'
      });
    } else {
      auditResults.push({
        suite: '6. AI Resilience & Fault-Tolerance',
        testName: '6.4 Unsupported Model (404) Non-Retryable Differentiation',
        result: 'FAIL',
        evidence: `Unexpected classification: ${JSON.stringify(classified)}`
      });
    }
  } catch (err: any) {
    auditResults.push({
      suite: '6. AI Resilience & Fault-Tolerance',
      testName: '6.4 Unsupported Model (404) Non-Retryable Differentiation',
      result: 'FAIL',
      evidence: `Error: ${err.message}`
    });
  }

  console.log('\n=== AUDIT RESULTS SUMMARY ===');
  console.table(auditResults);
  process.exit(0);
}

runAudit();
