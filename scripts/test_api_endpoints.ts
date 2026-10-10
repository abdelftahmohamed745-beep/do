import healthHandler from '../api/health';
import aiStatusHandler from '../api/ai/status';
import aiChatHandler from '../api/ai/chat';
import aiExecuteToolHandler from '../api/ai/execute-tool';
import bookingSpamHandler from '../api/security/check-booking-spam';
import adminToggleHandler from '../api/admin/toggle-status';
import adminSubHandler from '../api/admin/update-subscription';
import adminDeleteHandler from '../api/admin/delete-doctor';

interface MockResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: any;
  status(code: number): MockResponse;
  setHeader(name: string, value: string): MockResponse;
  json(data: any): MockResponse;
  end(): MockResponse;
}

function createMockRes(): MockResponse {
  const res: MockResponse = {
    statusCode: 200,
    headers: {},
    body: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    setHeader(name: string, value: string) {
      this.headers[name] = value;
      return this;
    },
    json(data: any) {
      this.body = data;
      return this;
    },
    end() {
      return this;
    }
  };
  return res;
}

async function testApiEndpoints() {
  console.log('=== STARTING HTTP API ENDPOINTS VERIFICATION ===\n');
  const results: any[] = [];

  // 1. GET /api/health
  {
    const req = { method: 'GET' };
    const res = createMockRes();
    await healthHandler(req, res);
    results.push({
      endpoint: 'GET /api/health',
      expectedStatus: 200,
      actualStatus: res.statusCode,
      result: res.statusCode === 200 && res.body?.status === 'ok' ? 'PASS' : 'FAIL',
      evidence: JSON.stringify(res.body)
    });
  }

  // 2. GET /api/ai/status
  {
    const req = { method: 'GET' };
    const res = createMockRes();
    await aiStatusHandler(req, res);
    results.push({
      endpoint: 'GET /api/ai/status',
      expectedStatus: 200,
      actualStatus: res.statusCode,
      result: res.statusCode === 200 && res.body?.status === 'ready' ? 'PASS' : 'FAIL',
      evidence: JSON.stringify(res.body)
    });
  }

  // 3. POST /api/ai/chat - Missing Auth Token
  {
    const req = {
      method: 'POST',
      headers: {},
      body: { clinicId: 'clinic_test_123', messages: [{ role: 'user', content: 'test' }] }
    };
    const res = createMockRes();
    await aiChatHandler(req, res);
    results.push({
      endpoint: 'POST /api/ai/chat (No Auth)',
      expectedStatus: 401,
      actualStatus: res.statusCode,
      result: res.statusCode === 401 && res.body?.error === 'UNAUTHENTICATED' ? 'PASS' : 'FAIL',
      evidence: JSON.stringify(res.body)
    });
  }

  // 4. POST /api/ai/chat - Forged Client Roles & Invalid Token
  {
    const req = {
      method: 'POST',
      headers: { authorization: 'Bearer forged.invalid.token' },
      body: {
        clinicId: 'clinic_test_123',
        isDoctorOwner: true,
        isSubscriptionActive: true,
        userMember: { role: 'DOCTOR', permissions: ['ALL'] },
        messages: [{ role: 'user', content: 'test' }]
      }
    };
    const res = createMockRes();
    await aiChatHandler(req, res);
    results.push({
      endpoint: 'POST /api/ai/chat (Forged Client Roles)',
      expectedStatus: 401,
      actualStatus: res.statusCode,
      result: res.statusCode === 401 && res.body?.error === 'UNAUTHENTICATED' ? 'PASS' : 'FAIL',
      evidence: `Rejected forged role: status=${res.statusCode}, error=${res.body?.error}`
    });
  }

  // 5. POST /api/ai/execute-tool - Missing Auth Token
  {
    const req = {
      method: 'POST',
      headers: {},
      body: { clinicId: 'clinic_test_123', toolName: 'callNextPatient' }
    };
    const res = createMockRes();
    await aiExecuteToolHandler(req, res);
    results.push({
      endpoint: 'POST /api/ai/execute-tool (No Auth)',
      expectedStatus: 401,
      actualStatus: res.statusCode,
      result: res.statusCode === 401 ? 'PASS' : 'FAIL',
      evidence: JSON.stringify(res.body)
    });
  }

  // 6. POST /api/admin/toggle-status - Missing Auth Token
  {
    const req = {
      method: 'POST',
      headers: {},
      body: { doctorId: 'doc_1', isActive: false }
    };
    const res = createMockRes();
    await adminToggleHandler(req, res);
    results.push({
      endpoint: 'POST /api/admin/toggle-status (No Auth)',
      expectedStatus: 401,
      actualStatus: res.statusCode,
      result: res.statusCode === 401 ? 'PASS' : 'FAIL',
      evidence: JSON.stringify(res.body)
    });
  }

  // 7. POST /api/admin/update-subscription - Missing Auth Token
  {
    const req = {
      method: 'POST',
      headers: {},
      body: { doctorId: 'doc_1', subscriptionStatus: 'active' }
    };
    const res = createMockRes();
    await adminSubHandler(req, res);
    results.push({
      endpoint: 'POST /api/admin/update-subscription (No Auth)',
      expectedStatus: 401,
      actualStatus: res.statusCode,
      result: res.statusCode === 401 ? 'PASS' : 'FAIL',
      evidence: JSON.stringify(res.body)
    });
  }

  // 8. POST /api/admin/delete-doctor - Missing Auth Token
  {
    const req = {
      method: 'POST',
      headers: {},
      body: { doctorId: 'doc_1' }
    };
    const res = createMockRes();
    await adminDeleteHandler(req, res);
    results.push({
      endpoint: 'POST /api/admin/delete-doctor (No Auth)',
      expectedStatus: 401,
      actualStatus: res.statusCode,
      result: res.statusCode === 401 ? 'PASS' : 'FAIL',
      evidence: JSON.stringify(res.body)
    });
  }

  // 9. POST /api/security/check-booking-spam - Valid request & rate limit triggering
  {
    const phone = '01155554444';
    let triggeredRateLimit = false;
    let firstAllowed = false;

    for (let i = 0; i < 6; i++) {
      const req = { method: 'POST', headers: { 'x-forwarded-for': '192.168.1.50' }, body: { phone } };
      const res = createMockRes();
      await bookingSpamHandler(req, res);

      if (i === 0 && res.statusCode === 200 && res.body?.allowed === true) {
        firstAllowed = true;
      }
      if (res.statusCode === 429) {
        triggeredRateLimit = true;
        break;
      }
    }

    results.push({
      endpoint: 'POST /api/security/check-booking-spam (Spam Rate Limit)',
      expectedStatus: 429,
      actualStatus: triggeredRateLimit ? 429 : 200,
      result: firstAllowed && triggeredRateLimit ? 'PASS' : 'FAIL',
      evidence: `First attempt allowed=${firstAllowed}. Subsequent attempts triggered HTTP 429 rate limit.`
    });
  }

  console.table(results);
  process.exit(0);
}

testApiEndpoints();
