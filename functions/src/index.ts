import * as admin from 'firebase-admin';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';

admin.initializeApp();
const db = admin.firestore();
const messaging = admin.messaging();

/**
 * Cloud Function: sendPushOnNewNotification
 *
 * Triggered when a new document is created in the `notifications` collection.
 * It finds all users matching the targetRoles/targetId, fetches their FCM tokens,
 * and sends a push notification to each device.
 */
export const sendPushOnNewNotification = onDocumentCreated(
  'notifications/{notifId}',
  async (event) => {
    const notif = event.data?.data();
    if (!notif) {
      logger.warn('No notification data found.');
      return;
    }

    const { title, message, targetRoles, targetId, targetAccountType, route } = notif;

    logger.info('New notification created:', { title, targetRoles, targetId, targetAccountType });

    // Build Firestore query to find target users
    let fcmTokens: string[] = [];

    // Case 1: Targeted to a specific user by ID
    if (targetId) {
      const userDoc = await db.collection('users').doc(targetId).get();
      if (userDoc.exists) {
        const token = userDoc.data()?.fcmToken;
        if (token) fcmTokens.push(token);
      }
    }

    // Case 2: Targeted to users by role(s)
    if (targetRoles && Array.isArray(targetRoles) && targetRoles.length > 0) {
      const usersSnap = await db.collection('users').get();
      usersSnap.forEach((userDoc) => {
        const data = userDoc.data();
        const userRole = data.role || data.accountType;
        const token = data.fcmToken;
        if (!token) return;

        // Check if user's role matches any of the targetRoles
        const matches = targetRoles.some(
          (r: string) => r === userRole || r === data.accountType
        );

        // Avoid duplicates if already added via targetId
        if (matches && !fcmTokens.includes(token)) {
          fcmTokens.push(token);
        }
      });
    }

    if (fcmTokens.length === 0) {
      logger.info('No FCM tokens found for this notification. Skipping push.');
      return;
    }

    logger.info(`Sending push to ${fcmTokens.length} device(s)...`);

    // Send in batches of 500 (FCM limit per multicast)
    const batchSize = 500;
    const results: admin.messaging.BatchResponse[] = [];

    for (let i = 0; i < fcmTokens.length; i += batchSize) {
      const batch = fcmTokens.slice(i, i + batchSize);

      const multicastMessage: admin.messaging.MulticastMessage = {
        tokens: batch,
        notification: {
          title: title || 'Ruang Warga VSJ',
          body: message || 'Ada notifikasi baru untuk Anda.',
        },
        android: {
          priority: 'high',
          notification: {
            channelId: 'ruang_warga_default',
            clickAction: 'FLUTTER_NOTIFICATION_CLICK',
            sound: 'default',
          },
        },
        data: {
          route: route || '/',
          notifId: event.params.notifId,
          click_action: 'FLUTTER_NOTIFICATION_CLICK',
        },
      };

      const batchResponse = await messaging.sendEachForMulticast(multicastMessage);
      results.push(batchResponse);

      logger.info(`Batch ${i / batchSize + 1}: ${batchResponse.successCount} success, ${batchResponse.failureCount} failed`);

      // Clean up invalid tokens (expired/unregistered)
      batchResponse.responses.forEach(async (resp, idx) => {
        if (!resp.success) {
          const errorCode = resp.error?.code;
          if (
            errorCode === 'messaging/invalid-registration-token' ||
            errorCode === 'messaging/registration-token-not-registered'
          ) {
            // Find and remove the invalid token from Firestore
            const badToken = batch[idx];
            const usersWithToken = await db
              .collection('users')
              .where('fcmToken', '==', badToken)
              .get();
            usersWithToken.forEach(async (u) => {
              await u.ref.update({ fcmToken: admin.firestore.FieldValue.delete() });
              logger.info(`Removed stale FCM token for user: ${u.id}`);
            });
          }
        }
      });
    }

    const totalSuccess = results.reduce((sum, r) => sum + r.successCount, 0);
    const totalFail = results.reduce((sum, r) => sum + r.failureCount, 0);
    logger.info(`Push selesai: ${totalSuccess} berhasil, ${totalFail} gagal`);
  }
);
