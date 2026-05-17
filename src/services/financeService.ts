/**
 * financeService.ts
 * Complete contribution and billing management service for Ruang Warga 011 VSJ
 */
import { 
  collection, addDoc, query, where, getDocs, doc, 
  updateDoc, Timestamp, writeBatch, onSnapshot, getDoc, runTransaction,
  orderBy
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { sendNotification } from './notificationService';

export interface Bill {
  id: string;
  title: string;
  category: string;
  amount: number;
  dueDate: string;
  targetType: 'all' | 'rt' | 'kk';
  targetValue: string; // RT number (e.g. '001') or KK number or 'all'
  monthYear: string;   // e.g. '2026-05'
  createdAt: Timestamp;
}

export interface FamilyBill {
  id: string;
  billId: string;
  familyId: string;
  nomorKK: string;
  kepalaKeluarga: string;
  rt: string;
  title: string;
  category: string;
  amount: number;
  dueDate: string;
  status: 'LUNAS' | 'BELUM BAYAR' | 'MENUNGGU VERIFIKASI' | 'MENUNGGAK';
  updatedAt: Timestamp;
}

export interface Payment {
  id: string;
  familyBillId: string;
  billId: string;
  familyId: string;
  nomorKK: string;
  kepalaKeluarga: string;
  rt: string;
  amount: number;
  paymentDate: Timestamp;
  paymentMethod: 'Transfer Bank' | 'QRIS' | 'RuangPay';
  proofImage?: string; // base64
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectionReason?: string;
  verifiedBy?: string;
  verifiedAt?: Timestamp;
}

/**
 * Automatically create monthly bills for all active Family Cards (KK)
 */
export async function autoGenerateMonthlyBills(monthYear: string, families: any[]): Promise<boolean> {
  try {
    // 1. Check if the bill for this month already exists
    const q = query(
      collection(db, 'bills'),
      where('category', '==', 'Iuran Bulanan'),
      where('monthYear', '==', monthYear)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      console.log(`[AutoBilling]: Monthly bills for ${monthYear} already exist.`);
      return false; // Already generated
    }

    const [year, month] = monthYear.split('-');
    const monthNames = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    const monthName = monthNames[parseInt(month) - 1] || month;
    const title = `Iuran Bulanan Warga ${monthName} ${year}`;
    const amount = 50000; // Rp 50.000 default iuran
    const dueDate = `${year}-${month}-10`; // Due 10th of every month

    console.log(`[AutoBilling]: Generating "${title}" for all families...`);

    // Create the master Bill document
    const billRef = await addDoc(collection(db, 'bills'), {
      title,
      category: 'Iuran Bulanan',
      amount,
      dueDate,
      targetType: 'all',
      targetValue: 'all',
      monthYear,
      createdAt: Timestamp.now()
    });

    const batch = writeBatch(db);
    
    // Assign to all families
    families.forEach((fam) => {
      const fbId = `${fam.id}_${billRef.id}`;
      const fbRef = doc(db, 'family_bills', fbId);
      
      batch.set(fbRef, {
        billId: billRef.id,
        familyId: fam.id,
        nomorKK: fam.nomorKK,
        kepalaKeluarga: fam.kepalaKeluarga,
        rt: fam.rt,
        title,
        category: 'Iuran Bulanan',
        amount,
        dueDate,
        status: 'BELUM BAYAR',
        updatedAt: Timestamp.now()
      });
    });

    await batch.commit();

    // Send notifications to all residents
    await sendNotification(
      'system',
      'Tagihan Iuran Baru',
      `Tagihan ${title} sebesar Rp ${amount.toLocaleString('id-ID')} telah diterbitkan. Jatuh tempo: ${dueDate}.`,
      ['warga']
    );

    return true;
  } catch (error) {
    console.error('Error generating auto monthly bills:', error);
    return false;
  }
}

/**
 * Create a Custom Bill and assign to target families
 */
export async function createCustomBill(billData: {
  title: string;
  category: string;
  amount: number;
  dueDate: string;
  targetType: 'all' | 'rt' | 'kk';
  targetValue: string; // e.g. '001' or KK number or 'all'
}, families: any[]): Promise<string> {
  const monthYear = billData.dueDate.substring(0, 7); // 'YYYY-MM'
  
  // Create master bill doc
  const billRef = await addDoc(collection(db, 'bills'), {
    ...billData,
    monthYear,
    createdAt: Timestamp.now()
  });

  // Filter families based on target
  let targetFamilies = families;
  if (billData.targetType === 'rt') {
    targetFamilies = families.filter(fam => fam.rt === billData.targetValue);
  } else if (billData.targetType === 'kk') {
    targetFamilies = families.filter(fam => fam.nomorKK === billData.targetValue);
  }

  const batch = writeBatch(db);
  targetFamilies.forEach((fam) => {
    const fbId = `${fam.id}_${billRef.id}`;
    const fbRef = doc(db, 'family_bills', fbId);
    
    batch.set(fbRef, {
      billId: billRef.id,
      familyId: fam.id,
      nomorKK: fam.nomorKK,
      kepalaKeluarga: fam.kepalaKeluarga,
      rt: fam.rt,
      title: billData.title,
      category: billData.category,
      amount: billData.amount,
      dueDate: billData.dueDate,
      status: 'BELUM BAYAR',
      updatedAt: Timestamp.now()
    });
  });

  await batch.commit();

  // Send notifications
  const targetRoles = billData.targetType === 'rt' 
    ? [`warga_rt_${billData.targetValue}`] 
    : billData.targetType === 'kk'
    ? [`warga_kk_${billData.targetValue}`]
    : ['warga'];

  await sendNotification(
    'system',
    'Tagihan Iuran Baru',
    `Tagihan "${billData.title}" sebesar Rp ${billData.amount.toLocaleString('id-ID')} telah diterbitkan.`,
    targetRoles
  );

  return billRef.id;
}

/**
 * Submit manual payment proof
 */
export async function submitPaymentProof(
  familyBillId: string, 
  paymentMethod: 'Transfer Bank' | 'QRIS', 
  proofImageBase64: string,
  familyData: { id: string; nomorKK: string; kepalaKeluarga: string; rt: string }
): Promise<void> {
  const fbRef = doc(db, 'family_bills', familyBillId);
  const fbSnap = await getDoc(fbRef);
  if (!fbSnap.exists()) throw new Error('Tagihan tidak ditemukan');
  
  const billInfo = fbSnap.data();

  // 1. Create a Payment document
  const paymentRef = await addDoc(collection(db, 'payments'), {
    familyBillId,
    billId: billInfo.billId,
    familyId: familyData.id,
    nomorKK: familyData.nomorKK,
    kepalaKeluarga: familyData.kepalaKeluarga,
    rt: familyData.rt,
    amount: billInfo.amount,
    paymentDate: Timestamp.now(),
    paymentMethod,
    proofImage: proofImageBase64,
    status: 'PENDING'
  });

  // 2. Update family bill status
  await updateDoc(fbRef, {
    status: 'MENUNGGU VERIFIKASI',
    updatedAt: Timestamp.now()
  });

  // 3. Notify Admin (RW & specific RT)
  await sendNotification(
    'system',
    'Menunggu Verifikasi Pembayaran',
    `Pembayaran ${billInfo.title} oleh KK ${familyData.kepalaKeluarga} membutuhkan verifikasi Anda.`,
    ['ketua_rw', `ketua_rt_${familyData.rt}`],
    { relatedId: paymentRef.id }
  );
}

/**
 * Pay instantly using RuangPay e-wallet (Auto verification enabled!)
 */
export async function payWithRuangPay(
  familyBillId: string,
  userId: string,
  familyData: { id: string; nomorKK: string; kepalaKeluarga: string; rt: string }
): Promise<boolean> {
  return await runTransaction(db, async (transaction) => {
    const userRef = doc(db, 'users', userId);
    const fbRef = doc(db, 'family_bills', familyBillId);

    const userSnap = await transaction.get(userRef);
    const fbSnap = await transaction.get(fbRef);

    if (!userSnap.exists()) throw new Error('Pengguna tidak ditemukan');
    if (!fbSnap.exists()) throw new Error('Tagihan tidak ditemukan');

    const userData = userSnap.data();
    const billData = fbSnap.data();

    const currentBalance = userData.ruangPayBalance || 0;
    const billAmount = billData.amount || 0;

    if (currentBalance < billAmount) {
      throw new Error('Saldo RuangPay Anda tidak mencukupi. Silakan lakukan Top Up terlebih dahulu.');
    }

    // 1. Deduct balance from resident's user doc
    transaction.update(userRef, {
      ruangPayBalance: currentBalance - billAmount
    });

    // 2. Update family bill status directly to LUNAS
    transaction.update(fbRef, {
      status: 'LUNAS',
      updatedAt: Timestamp.now()
    });

    // 3. Create a verified payment document directly
    const paymentColRef = collection(db, 'payments');
    const paymentDocRef = doc(paymentColRef);
    transaction.set(paymentDocRef, {
      familyBillId,
      billId: billData.billId,
      familyId: familyData.id,
      nomorKK: familyData.nomorKK,
      kepalaKeluarga: familyData.kepalaKeluarga,
      rt: familyData.rt,
      amount: billAmount,
      paymentDate: Timestamp.now(),
      paymentMethod: 'RuangPay',
      status: 'APPROVED',
      verifiedBy: 'Sistem RuangPay',
      verifiedAt: Timestamp.now()
    });

    // 4. Record wallet transaction log
    const walletColRef = collection(db, 'wallet_transactions');
    const walletDocRef = doc(walletColRef);
    transaction.set(walletDocRef, {
      userId,
      amount: billAmount,
      type: 'Out',
      description: `Pembayaran ${billData.title}`,
      createdAt: Timestamp.now()
    });

    return true;
  });
}

/**
 * Top up RuangPay balance
 */
export async function topUpRuangPay(userId: string, amount: number): Promise<void> {
  const userRef = doc(db, 'users', userId);
  await runTransaction(db, async (transaction) => {
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists()) throw new Error('Pengguna tidak ditemukan');
    const userData = userSnap.data();
    const currentBalance = userData.ruangPayBalance || 0;

    transaction.update(userRef, {
      ruangPayBalance: currentBalance + amount
    });

    // Add log
    const walletDocRef = doc(collection(db, 'wallet_transactions'));
    transaction.set(walletDocRef, {
      userId,
      amount,
      type: 'In',
      description: 'Top Up Saldo RuangPay',
      createdAt: Timestamp.now()
    });
  });
}

/**
 * Approve payment verification
 */
export async function verifyPayment(
  paymentId: string, 
  familyBillId: string, 
  adminName: string
): Promise<void> {
  const paymentRef = doc(db, 'payments', paymentId);
  const fbRef = doc(db, 'family_bills', familyBillId);

  await updateDoc(paymentRef, {
    status: 'APPROVED',
    verifiedBy: adminName,
    verifiedAt: Timestamp.now()
  });

  const fbSnap = await getDoc(fbRef);
  let billTitle = 'Iuran';
  let nomorKK = '';
  if (fbSnap.exists()) {
    billTitle = fbSnap.data().title;
    nomorKK = fbSnap.data().nomorKK;
  }

  await updateDoc(fbRef, {
    status: 'LUNAS',
    updatedAt: Timestamp.now()
  });

  // Notify resident
  await sendNotification(
    'approval',
    'Pembayaran Terverifikasi! 🎉',
    `Pembayaran Anda untuk "${billTitle}" telah berhasil diverifikasi oleh ${adminName}. Terimakasih!`,
    [`warga_kk_${nomorKK}`]
  );
}

/**
 * Reject payment verification
 */
export async function rejectPayment(
  paymentId: string, 
  familyBillId: string, 
  adminName: string, 
  reason: string
): Promise<void> {
  const paymentRef = doc(db, 'payments', paymentId);
  const fbRef = doc(db, 'family_bills', familyBillId);

  await updateDoc(paymentRef, {
    status: 'REJECTED',
    rejectionReason: reason,
    verifiedBy: adminName,
    verifiedAt: Timestamp.now()
  });

  const fbSnap = await getDoc(fbRef);
  let billTitle = 'Iuran';
  let nomorKK = '';
  if (fbSnap.exists()) {
    billTitle = fbSnap.data().title;
    nomorKK = fbSnap.data().nomorKK;
  }

  await updateDoc(fbRef, {
    status: 'BELUM BAYAR', // Reset back so they can try again
    updatedAt: Timestamp.now()
  });

  // Notify resident
  await sendNotification(
    'rejection',
    'Pembayaran Ditolak ⚠️',
    `Pembayaran Anda untuk "${billTitle}" ditolak oleh ${adminName}. Alasan: ${reason}. Silakan upload ulang.`,
    [`warga_kk_${nomorKK}`]
  );
}

/**
 * Listen to all Master Bills (real-time)
 */
export function subscribeToBills(onBills: (bills: Bill[]) => void): () => void {
  const q = query(collection(db, 'bills'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    onBills(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Bill)));
  });
}

/**
 * Listen to Family Bills with dynamic query filters
 */
export function subscribeToFamilyBills(
  filters: { rt?: string; status?: string; nomorKK?: string },
  onFamilyBills: (fb: FamilyBill[]) => void
): () => void {
  let q = query(collection(db, 'family_bills'));

  if (filters.rt) {
    q = query(q, where('rt', '==', filters.rt));
  }
  if (filters.status) {
    q = query(q, where('status', '==', filters.status));
  }
  if (filters.nomorKK) {
    q = query(q, where('nomorKK', '==', filters.nomorKK));
  }

  return onSnapshot(q, (snap) => {
    onFamilyBills(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as FamilyBill)));
  });
}

/**
 * Listen to all Payments (real-time)
 */
export function subscribeToPayments(
  filters: { rt?: string; status?: string },
  onPayments: (p: Payment[]) => void
): () => void {
  let q = query(collection(db, 'payments'), orderBy('paymentDate', 'desc'));

  if (filters.rt) {
    q = query(q, where('rt', '==', filters.rt));
  }
  if (filters.status) {
    q = query(q, where('status', '==', filters.status));
  }

  return onSnapshot(q, (snap) => {
    onPayments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment)));
  });
}

/**
 * Listen to Resident wallet transactions logs
 */
export function subscribeToWalletLogs(
  userId: string,
  onLogs: (logs: any[]) => void
): () => void {
  const q = query(
    collection(db, 'wallet_transactions'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(q, (snap) => {
    onLogs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  });
}
