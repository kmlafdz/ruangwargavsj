import express from 'express';
import type { Request, Response } from 'express';
import cors from 'cors';
import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
import * as admin from 'firebase-admin';

dotenv.config();

// ─── Firebase Admin Init ───────────────────────────────────────────────────
// Uses GOOGLE_APPLICATION_CREDENTIALS env var (path to serviceAccountKey.json)
// OR FIREBASE_SERVICE_ACCOUNT env var (JSON string of service account)
let firebaseApp: admin.app.App;
try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    // For deployment on Render/Railway: set env var as JSON string
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    // Local: use service account key file path
    firebaseApp = admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
  } else {
    console.warn('[FCM] No Firebase credentials found. Push notifications disabled.');
    firebaseApp = admin.initializeApp(); // Will fail gracefully
  }
} catch (e) {
  console.error('[FCM] Firebase Admin init error:', e);
  firebaseApp = admin.initializeApp();
}

const db = admin.firestore();
const messaging = admin.messaging();

// ─── Cloudinary Init ───────────────────────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ─── Express App ───────────────────────────────────────────────────────────
const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// ─── Push Notification Sender ──────────────────────────────────────────────
async function sendPushToTokens(
  tokens: string[],
  title: string,
  body: string,
  data: Record<string, string> = {}
) {
  if (tokens.length === 0) return;

  const batchSize = 500;
  for (let i = 0; i < tokens.length; i += batchSize) {
    const batch = tokens.slice(i, i + batchSize);
    try {
      const response = await messaging.sendEachForMulticast({
        tokens: batch,
        notification: { title, body },
        android: {
          priority: 'high',
          notification: {
            channelId: 'ruang_warga_default',
            sound: 'default',
          },
        },
        data,
      });

      console.log(`[FCM] Sent ${response.successCount}/${batch.length} - Failed: ${response.failureCount}`);

      // Clean up stale tokens
      response.responses.forEach(async (resp, idx) => {
        if (!resp.success) {
          const code = resp.error?.code;
          if (
            code === 'messaging/invalid-registration-token' ||
            code === 'messaging/registration-token-not-registered'
          ) {
            const badToken = batch[idx];
            const usersSnap = await db
              .collection('users')
              .where('fcmToken', '==', badToken)
              .get();
            usersSnap.forEach((u) => {
              u.ref.update({ fcmToken: admin.firestore.FieldValue.delete() });
              console.log(`[FCM] Removed stale token for user: ${u.id}`);
            });
          }
        }
      });
    } catch (err) {
      console.error('[FCM] Batch send error:', err);
    }
  }
}

// ─── Firestore Notification Listener ──────────────────────────────────────
// Listen to new documents in the 'notifications' collection and push FCM
function startNotificationListener() {
  console.log('[FCM] Starting Firestore notification listener...');

  // Track processed IDs to avoid double-sending
  const processedIds = new Set<string>();
  // Mark all existing docs as already processed (don't push on startup)
  let initialized = false;

  db.collection('notifications').onSnapshot(
    async (snapshot) => {
      if (!initialized) {
        // On first load, mark all existing docs as processed
        snapshot.docs.forEach((d) => processedIds.add(d.id));
        initialized = true;
        console.log(`[FCM] Listener ready. Tracking ${processedIds.size} existing notifications.`);
        return;
      }

      for (const change of snapshot.docChanges()) {
        if (change.type !== 'added') continue;
        if (processedIds.has(change.doc.id)) continue;
        processedIds.add(change.doc.id);

        const notif = change.doc.data();
        const { title, message, targetRoles, targetId, targetAccountType, route } = notif;

        console.log(`[FCM] New notification: "${title}" → roles:${targetRoles} id:${targetId}`);

        const fcmTokens: string[] = [];

        // Find tokens by specific targetId
        if (targetId) {
          const userDoc = await db.collection('users').doc(targetId).get();
          const token = userDoc.data()?.fcmToken;
          if (token) fcmTokens.push(token);
        }

        // Find tokens by targetRoles
        if (targetRoles && Array.isArray(targetRoles) && targetRoles.length > 0) {
          const usersSnap = await db.collection('users').get();
          usersSnap.forEach((userDoc) => {
            const data = userDoc.data();
            const token = data.fcmToken;
            if (!token || fcmTokens.includes(token)) return;

            const userRole = data.role || data.accountType;
            const matches = targetRoles.some(
              (r: string) => r === userRole || r === data.accountType
            );
            if (matches) fcmTokens.push(token);
          });
        }

        if (fcmTokens.length === 0) {
          console.log(`[FCM] No FCM tokens found. Skipping.`);
          continue;
        }

        await sendPushToTokens(fcmTokens, title || 'Ruang Warga VSJ', message || 'Ada notifikasi baru.', {
          route: route || '/',
          notifId: change.doc.id,
        });
      }
    },
    (err) => {
      console.error('[FCM] Firestore listener error:', err);
    }
  );
}

// Start the listener
startNotificationListener();

// ─── REST API Endpoints ────────────────────────────────────────────────────

// Health check
app.get('/', (_req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'Ruang Warga VSJ API + FCM Server Running' });
});

// Cloudinary signature endpoint
app.post('/api/cloudinary-signature', (req: Request, res: Response) => {
  const timestamp = Math.round(new Date().getTime() / 1000);
  const { folder } = req.body;

  const signature = cloudinary.utils.api_sign_request(
    { timestamp, folder },
    process.env.CLOUDINARY_API_SECRET!
  );

  res.json({
    signature,
    timestamp,
    apiKey: process.env.CLOUDINARY_API_KEY,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
  });
});

// Manual push endpoint (for testing or admin triggers)
app.post('/api/send-push', async (req: Request, res: Response) => {
  const { tokens, title, body, data } = req.body;
  if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
    res.status(400).json({ error: 'tokens array required' });
    return;
  }
  await sendPushToTokens(tokens, title || 'Test Push', body || 'Ini test notifikasi.', data || {});
  res.json({ success: true, sent: tokens.length });
});

// ─── Start Server ──────────────────────────────────────────────────────────
app.listen(Number(port), '0.0.0.0', () => {
  console.log(`[server]: Running at http://0.0.0.0:${port}`);
});
