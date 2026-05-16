/**
 * notificationService.ts
 * Real-time notification system using Firestore
 */
import { 
  collection, addDoc, query, where, orderBy, 
  onSnapshot, Timestamp, doc, updateDoc, getDocs
} from 'firebase/firestore';
import { db } from '../firebase/config';

export type NotifType = 'registration' | 'approval' | 'rejection' | 'surat' | 'pengaduan' | 'system';

export interface Notification {
  id: string;
  type: NotifType;
  title: string;
  message: string;
  targetRoles: string[]; // e.g. ['ketua_rw', 'ketua_rt_001']
  relatedId?: string;    // registration ID, surat ID, etc.
  route?: string;        // where to navigate on click
  isRead: boolean;
  createdAt: Date;
}

/**
 * Send a notification to specific roles
 */
export async function sendNotification(
  type: NotifType,
  title: string,
  message: string,
  targetRoles: string[],
  options?: { relatedId?: string; route?: string }
): Promise<string> {
  const docRef = await addDoc(collection(db, 'notifications'), {
    type,
    title,
    message,
    targetRoles,
    relatedId: options?.relatedId ?? null,
    route: options?.route ?? null,
    isRead: false,
    createdAt: Timestamp.now(),
  });
  return docRef.id;
}

/**
 * Subscribe to real-time notifications for a user role
 */
export function subscribeToNotifications(
  userRole: string,
  onNotifications: (notifs: Notification[]) => void
): () => void {
  const q = query(
    collection(db, 'notifications'),
    where('targetRoles', 'array-contains', userRole)
  );

  return onSnapshot(q, (snapshot) => {
    const notifs = snapshot.docs.map(d => ({
      id: d.id,
      ...d.data(),
      createdAt: (d.data().createdAt as Timestamp).toDate(),
    })) as Notification[];
    
    // Sort on client side to avoid requiring composite index
    notifs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    
    onNotifications(notifs);
  });
}

/**
 * Mark a notification as read
 */
export async function markNotificationRead(notifId: string): Promise<void> {
  await updateDoc(doc(db, 'notifications', notifId), { isRead: true });
}

/**
 * Mark all notifications as read for a given role
 */
export async function markAllRead(userRole: string): Promise<void> {
  const q = query(
    collection(db, 'notifications'),
    where('targetRoles', 'array-contains', userRole),
    where('isRead', '==', false)
  );
  const snap = await getDocs(q);
  const updates = snap.docs.map(d => updateDoc(d.ref, { isRead: true }));
  await Promise.all(updates);
}

/**
 * Send WhatsApp Message (Simulated/API Link)
 */
export async function sendWhatsAppMessage(phone: string, message: string): Promise<void> {
  // Clean phone number
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  const formattedPhone = cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : cleanPhone;
  
  console.log(`[WA SENT to ${formattedPhone}]: ${message}`);
  
  // Open whatsapp link
  window.open(`https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`, '_blank');
}
