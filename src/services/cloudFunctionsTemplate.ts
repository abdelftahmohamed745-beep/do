/**
 * Firebase Cloud Functions (v2) for Dawry Administrative & Queue Inspector Engine
 * Deploy using: firebase deploy --only functions
 */

/*
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// 1. Callable Cloud Function: Set Admin Custom Claim
export const setAdminCustomClaim = functions.https.onCall(async (data, context) => {
  // Verify requester is already an Admin
  if (!context.auth || context.auth.token.admin !== true) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'فقط مدير المنصة يستطيع تعيين صلاحيات الإدارة.'
    );
  }

  const { targetUid, isAdmin } = data;
  if (!targetUid) {
    throw new functions.https.HttpsError('invalid-argument', 'يرجى تزويد معرف المستخدم');
  }

  await admin.auth().setCustomUserClaims(targetUid, { admin: isAdmin === true });
  
  // Write Audit Log
  await db.collection('auditLogs').add({
    action: 'SET_ADMIN_CUSTOM_CLAIM',
    performedByUid: context.auth.uid,
    targetUid,
    isAdmin,
    timestamp: new Date().toISOString()
  });

  return { success: true, message: `Updated custom claims for ${targetUid}` };
});

// 2. Callable Cloud Function: Delete Doctor Account
export const deleteDoctorAccount = functions.https.onCall(async (data, context) => {
  // Check admin authorization
  if (!context.auth || context.auth.token.admin !== true) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'فقط مدير المنصة يستطيع حذف حسابات الأطباء.'
    );
  }

  const { doctorId } = data;
  if (!doctorId) {
    throw new functions.https.HttpsError('invalid-argument', 'معرف الطبيب مطلوب');
  }

  // Delete doctor auth account if exists
  try {
    await admin.auth().deleteUser(doctorId);
  } catch (err) {
    console.warn('Auth user deletion note:', err);
  }

  // Delete doctor doc in Firestore
  await db.collection('doctors').doc(doctorId).delete();

  // Record Audit Log
  await db.collection('auditLogs').add({
    action: 'DELETE_DOCTOR_ACCOUNT',
    performedByUid: context.auth.uid,
    targetDoctorId: doctorId,
    timestamp: new Date().toISOString()
  });

  return { success: true, message: `Doctor ${doctorId} account deleted successfully` };
});

// 3. Scheduled Cloud Function: Inspect Queues & Send Near-Turn Notifications
export const checkQueuesAndSendNearTurnNotifications = functions.pubsub
  .schedule('every 1 minutes')
  .onRun(async (context) => {
    const today = new Date().toISOString().split('T')[0];

    // Get all active doctor queues
    const doctorsSnap = await db.collection('doctors').where('isActive', '==', true).get();

    for (const docSnap of doctorsSnap.docs) {
      const doctorId = docSnap.id;
      const doctorData = docSnap.data();
      const avgConsultTime = doctorData.avgConsultTime || 15;

      // Get waiting patients ordered by sequence number
      const patientsSnap = await db
        .collection('queues')
        .doc(doctorId)
        .collection('patients')
        .where('date', '==', today)
        .where('status', '==', 'waiting')
        .orderBy('sequenceNumber', 'asc')
        .get();

      if (patientsSnap.empty) continue;

      // Get current serving patient
      const servingSnap = await db
        .collection('queues')
        .doc(doctorId)
        .collection('patients')
        .where('date', '==', today)
        .where('status', '==', 'called')
        .orderBy('calledAt', 'desc')
        .limit(1)
        .get();

      const currentServingSeq = !servingSnap.empty ? servingSnap.docs[0].data().sequenceNumber : 0;

      for (const patientDoc of patientsSnap.docs) {
        const patientData = patientDoc.data();
        const sequenceNumber = patientData.sequenceNumber;
        const remainingTurns = sequenceNumber - currentServingSeq;
        const estMinutes = Math.max(0, remainingTurns * avgConsultTime);
        const pref = patientData.notificationPreference || 'two_turns';

        let shouldNotify = false;
        let flagToSet = '';

        if (pref === 'two_turns' && remainingTurns <= 2 && !patientData.notifiedForTwoTurns) {
          shouldNotify = true;
          flagToSet = 'notifiedForTwoTurns';
        } else if (pref === 'one_turn' && remainingTurns <= 1 && !patientData.notifiedForOneTurn) {
          shouldNotify = true;
          flagToSet = 'notifiedForOneTurn';
        } else if (pref === 'ten_minutes' && estMinutes <= 10 && !patientData.notifiedForTenMinutes) {
          shouldNotify = true;
          flagToSet = 'notifiedForTenMinutes';
        }

        if (shouldNotify && flagToSet) {
          // Transactional atomic update to guarantee idempotency and prevent duplicate pushes
          await db.runTransaction(async (transaction) => {
            const freshRef = patientDoc.ref;
            const freshDoc = await transaction.get(freshRef);
            if (!freshDoc.exists || freshDoc.data()?.[flagToSet]) {
              return; // Already notified by concurrent trigger
            }

            // Mark flag as sent
            transaction.update(freshRef, {
              [flagToSet]: true,
              notificationSent: true,
              notificationSentAt: new Date().toISOString()
            });

            // Send FCM Push Notification if userId or phone is associated
            const userId = patientData.userId || patientData.phone;
            if (userId) {
              const tokensSnap = await db.collection('users').doc(userId).collection('fcmTokens').get();
              const tokens = tokensSnap.docs.map(d => d.data().token);

              if (tokens.length > 0) {
                const message = {
                  notification: {
                    title: 'دورك اقترب!',
                    body: `تبقى أمامك ${remainingTurns} أدوار تقريبًا في ${doctorData.clinicName || 'العيادة'}.`
                  },
                  data: {
                    doctorId,
                    patientId: patientDoc.id,
                    url: `/?doctor=${doctorId}&ticket=${patientDoc.id}`
                  },
                  tokens
                };

                await admin.messaging().sendMulticast(message).catch((err) => {
                  console.warn('FCM multicast send note:', err);
                });
              }

              // Create In-App Notification entry
              await db.collection('users').doc(userId).collection('notifications').add({
                userId,
                title: 'دورك اقترب!',
                body: `تبقى أمامك ${remainingTurns} أدوار تقريبًا في ${doctorData.clinicName || 'العيادة'}.`,
                type: 'near_turn',
                bookingId: patientDoc.id,
                clinicName: doctorData.clinicName || '',
                isRead: false,
                createdAt: new Date().toISOString()
              });
            }
          });
        }
      }
    }
  });
*/

export const CLOUD_FUNCTIONS_SUMMARY = {
  version: "2.0.0",
  functions: [
    "setAdminCustomClaim",
    "deleteDoctorAccount",
    "checkQueuesAndSendNearTurnNotifications"
  ]
};
