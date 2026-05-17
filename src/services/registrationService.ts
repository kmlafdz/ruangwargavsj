/**
 * registrationService.ts
 * Core registration logic with AI verification, Firestore storage, and notifications
 */
import { collection, addDoc, Timestamp, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { sendNotification } from './notificationService';
import { uploadVerificationDocument } from './storageService';
import { extractKTPData, calculateMatchScore } from './ocrService';
import { detectAndCropFace } from './faceService';

export type RegistrationStatus = 'pending' | 'auto_approved' | 'approved' | 'rejected' | 'revision';

export interface RegistrationPayload {
  method: 'email' | 'google';
  email: string;
  nik: string;
  fullName: string;
  tempatLahir?: string;
  birthDate: string;
  jenisKelamin?: string;
  agama?: string;
  statusPerkawinan?: string;
  pekerjaan?: string;
  kewarganegaraan?: string;
  rt: string;
  rw: string;
  kkNumber: string;
  address: string;
  kelDesa?: string;
  kecamatan?: string;
  ktpFile: File;
  kkFile: File;
  password?: string;
}

const AUTO_APPROVE_THRESHOLD = 85; // AI match score threshold

export async function submitRegistration(payload: RegistrationPayload): Promise<{ registrationId: string; status: RegistrationStatus; matchScore: number }> {
  // 1. OCR KTP to extract data
  let matchScore = 0;
  let ocrData: any = {};

  try {
    const ocrResult = await extractKTPData(payload.ktpFile);
    ocrData = ocrResult.ktpData;
    matchScore = calculateMatchScore(
      { nik: payload.nik, fullName: payload.fullName, birthDate: payload.birthDate },
      ocrData
    );
  } catch (err) {
    console.warn('OCR failed, proceeding without score:', err);
  }

  // 2. Detect & crop face from KTP
  let faceBase64: string | null = null;
  try {
    faceBase64 = await detectAndCropFace(payload.ktpFile);
  } catch (err) {
    console.warn('Face detection failed:', err);
  }

  // 3. Determine initial status
  const status: RegistrationStatus = matchScore >= AUTO_APPROVE_THRESHOLD ? 'auto_approved' : 'pending';

  // 4. Save registration to Firestore
  const registrationRef = await addDoc(collection(db, 'registrations'), {
    ...payload,
    ktpFile: null, // Don't save binary in Firestore
    kkFile: null,
    status,
    matchScore,
    ocrData,
    facePhotoBase64: faceBase64,
    ktpUrl: null,
    kkUrl: null,
    createdAt: Timestamp.now(),
    approvedAt: null,
    approvedBy: null,
  });

  const registrationId = registrationRef.id;

  // 5. Upload KTP & KK documents (with auto-delete scheduling)
  try {
    const [ktpUpload, kkUpload] = await Promise.all([
      uploadVerificationDocument(payload.ktpFile, registrationId, 'ktp'),
      uploadVerificationDocument(payload.kkFile, registrationId, 'kk'),
    ]);
    await updateDoc(doc(db, 'registrations', registrationId), {
      ktpUrl: ktpUpload.url,
      kkUrl: kkUpload.url,
      ktpPublicId: ktpUpload.publicId,
      kkPublicId: kkUpload.publicId,
      ktpExpiresAt: Timestamp.fromDate(ktpUpload.expiresAt),
    });

  } catch (err) {
    console.warn('Upload failed:', err);
  }

  // 6. Send notification
  const targetRoles = ['ketua_rw', `ketua_rt_${payload.rt}`];
  if (status === 'auto_approved') {
    await sendNotification(
      'approval',
      '✅ Registrasi Auto-Disetujui',
      `${payload.fullName} (NIK: ${payload.nik}) diverifikasi otomatis oleh AI dengan skor ${matchScore}%.`,
      targetRoles,
      { relatedId: registrationId, route: `/admin/dev/approval/${registrationId}` }
    );
  } else {
    await sendNotification(
      'registration',
      '📋 Pendaftaran Warga Baru',
      `${payload.fullName} memerlukan persetujuan. Skor AI: ${matchScore}%.`,
      targetRoles,
      { relatedId: registrationId, route: `/admin/dev/approval/${registrationId}` }
    );
  }

  return { registrationId, status, matchScore };
}

export async function processApproval(
  registrationId: string,
  action: 'approved' | 'rejected',
  adminId: string,
  note?: string
): Promise<void> {
  await updateDoc(doc(db, 'registrations', registrationId), {
    status: action,
    approvedBy: adminId,
    approvedAt: Timestamp.now(),
    adminNote: note ?? '',
  });

  const regSnap = await getDoc(doc(db, 'registrations', registrationId));
  if (!regSnap.exists()) return;

  const reg = regSnap.data();

  await addDoc(collection(db, 'email_queue'), {
    to: reg.email,
    subject: action === 'approved' 
      ? 'Selamat! Pendaftaran Anda di Ruang Warga VSJ Disetujui' 
      : 'Pemberitahuan: Pendaftaran Anda Memerlukan Revisi',
    body: action === 'approved'
      ? `Halo ${reg.fullName},\n\nSelamat! Pendaftaran Anda sebagai warga RW 011 telah DISETUJUI oleh pengurus.\n\nAnda sekarang dapat masuk ke akun Anda menggunakan NIK dan Password yang telah didaftarkan.\n\nKlik tautan di bawah ini untuk login:\nhttps://ruang-warga-011-2607a.web.app/warga-login\n\nTerima kasih,\nAdmin Ruang Warga VSJ`
      : `Halo ${reg.fullName},\n\nMohon maaf, pendaftaran Anda belum dapat kami setujui saat ini.\n\nAlasan: ${note}\n\nSilakan lakukan pendaftaran ulang dengan data yang benar atau hubungi Ketua RT ${reg.rt} untuk informasi lebih lanjut.\n\nSalam,\nAdmin Ruang Warga VSJ`,
    createdAt: Timestamp.now(),
  });

}
