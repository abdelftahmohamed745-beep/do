import { handleAiChatServer, classifyProviderError } from './aiAgentServer.ts';
import { executeAiToolCall } from '../services/ai/aiToolExecutor.ts';
import { validateAndNormalizeTask, sanitizeFirestorePayload } from '../services/ai/taskValidation.ts';
import {
  verifyFirebaseIdToken,
  verifyClinicAccess,
  updateDoctorDocAuthoritative,
  deleteDoctorDocAuthoritative,
  getDocRestWithToken
} from './authVerify.ts';
import { db } from '../firebase/config.ts';

export {
  handleAiChatServer,
  classifyProviderError,
  executeAiToolCall,
  validateAndNormalizeTask,
  sanitizeFirestorePayload,
  verifyFirebaseIdToken,
  verifyClinicAccess,
  updateDoctorDocAuthoritative,
  deleteDoctorDocAuthoritative,
  getDocRestWithToken,
  db
};
