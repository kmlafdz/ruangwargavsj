/**
 * storageService.ts
 * Cloudinary Storage implementation with auto-delete scheduling
 */
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase/config';

const EXPIRY_HOURS = 48;
const API_URL = 'http://localhost:5000/api'; // Update this for production

export interface UploadResult {
  url: string;
  publicId: string;
  expiresAt: Date;
}

/**
 * Upload KTP/KK file to Cloudinary
 * Automatically schedules deletion after 48 hours via Firestore
 */
export async function uploadVerificationDocument(
  file: File,
  registrationId: string,
  docType: 'ktp' | 'kk'
): Promise<UploadResult> {
  const folder = `rw011_verification/${registrationId}`;
  
  // 1. Get signed upload signature from backend
  const sigResponse = await fetch(`${API_URL}/cloudinary-signature`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folder })
  });
  
  if (!sigResponse.ok) throw new Error('Failed to get upload signature');
  const { signature, timestamp, apiKey, cloudName } = await sigResponse.json();

  // 2. Upload to Cloudinary
  const formData = new FormData();
  formData.append('file', file);
  formData.append('signature', signature);
  formData.append('timestamp', timestamp);
  formData.append('api_key', apiKey);
  formData.append('folder', folder);

  const uploadResponse = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    { method: 'POST', body: formData }
  );

  if (!uploadResponse.ok) {
    const error = await uploadResponse.json();
    throw new Error(error.message || 'Upload to Cloudinary failed');
  }

  const result = await uploadResponse.json();
  const expiresAt = new Date(Date.now() + EXPIRY_HOURS * 60 * 60 * 1000);

  // 3. Log deletion for the backend to handle
  await setDoc(doc(db, 'scheduled_deletions', `${registrationId}_${docType}`), {
    publicId: result.public_id,
    registrationId,
    docType,
    uploadedAt: Timestamp.now(),
    expiresAt: Timestamp.fromDate(expiresAt),
    deleted: false,
    provider: 'cloudinary'
  });

  return {
    url: result.secure_url,
    publicId: result.public_id,
    expiresAt
  };
}
