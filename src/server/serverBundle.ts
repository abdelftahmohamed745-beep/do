import { handleAiChatServer } from './aiAgentServer';
import { executeAiToolCall } from '../services/ai/aiToolExecutor';
import {
  verifyFirebaseIdToken,
  verifyClinicAccess,
  updateDoctorDocAuthoritative,
  deleteDoctorDocAuthoritative,
  getDocRestWithToken
} from './authVerify';
import { db } from '../firebase/config';

export {
  handleAiChatServer,
  executeAiToolCall,
  verifyFirebaseIdToken,
  verifyClinicAccess,
  updateDoctorDocAuthoritative,
  deleteDoctorDocAuthoritative,
  getDocRestWithToken,
  db
};
