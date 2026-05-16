import { 
  collection, getDocs, updateDoc, doc, deleteDoc, 
  query, orderBy, onSnapshot, where, setDoc, serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { User } from '../types';

/**
 * Fetch all users from Firestore
 */
export async function getAllUsers(): Promise<User[]> {
  const q = query(collection(db, 'users'), orderBy('name', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as User));
}

/**
 * Subscribe to users in real-time
 */
export function subscribeToUsers(onUpdate: (users: User[]) => void): () => void {
  const q = query(collection(db, 'users'), orderBy('name', 'asc'));
  return onSnapshot(q, (snap) => {
    onUpdate(snap.docs.map(d => ({ id: d.id, ...d.data() } as User)));
  });
}

/**
 * Update user role
 */
export async function updateUserRole(userId: string, role: string): Promise<void> {
  await updateDoc(doc(db, 'users', userId), { role });
}

/**
 * Update user status
 */
export async function updateUserStatus(userId: string, status: string): Promise<void> {
  await updateDoc(doc(db, 'users', userId), { status });
}

/**
 * Delete user account and associated resident record
 */
export async function deleteUser(nik: string): Promise<void> {
  // 1. Delete user doc where ID = NIK
  await deleteDoc(doc(db, 'users', nik));
  
  // 2. Search and delete any user docs where username = NIK (case where ID is random)
  try {
    const uq = query(collection(db, 'users'), where('username', '==', nik));
    const uSnap = await getDocs(uq);
    const uPromises = uSnap.docs.map(d => deleteDoc(d.ref));
    await Promise.all(uPromises);
  } catch (err) { console.error("Err cleaning users:", err); }

  // 3. Delete corresponding resident doc(s) and cleanup empty families
  try {
    const q = query(collection(db, 'residents'), where('nik', '==', nik));
    const snap = await getDocs(q);
    
    for (const d of snap.docs) {
      const resData = d.data();
      const noKK = resData.noKK || resData.nomorKK;
      
      // Delete the resident
      await deleteDoc(d.ref);
      
      // Cleanup family if empty
      if (noKK) {
        const remainingQ = query(collection(db, 'residents'), where('noKK', '==', noKK));
        const remainingSnap = await getDocs(remainingQ);
        
        const remainingQ2 = query(collection(db, 'residents'), where('nomorKK', '==', noKK));
        const remainingSnap2 = await getDocs(remainingQ2);

        if (remainingSnap.empty && remainingSnap2.empty) {
          // No more members, delete family doc
          const famQ = query(collection(db, 'families'), where('nomorKK', '==', noKK));
          const famSnap = await getDocs(famQ);
          for (const f of famSnap.docs) {
            await deleteDoc(f.ref);
          }
        }
      }
    }
  } catch (err) {
    console.error("Gagal menghapus data warga/keluarga terkait:", err);
  }
}

/**
 * Create a user account from a resident record
 */
export async function createUserFromResident(resident: any, role: string): Promise<void> {
  // Use NIK as the document ID for the user to keep it unique per resident
  const userRef = doc(db, 'users', resident.nik);
  
  // New Activation Flow fields
  const dobRaw = resident.birthDate || resident.tanggalLahir || '01/01/2000';
  let dobFormatted = '2000-01-01';

  if (dobRaw.includes('/')) {
    // Handle DD/MM/YYYY
    const [d, m, y] = dobRaw.split('/');
    dobFormatted = `${y}-${d}-${m}`; // Format: YYYY-DD-MM
  } else if (dobRaw.includes('-')) {
    // Handle YYYY-MM-DD (legacy)
    const [y, m, d] = dobRaw.split('-');
    dobFormatted = `${y}-${d}-${m}`; // Format: YYYY-DD-MM
  }

  await setDoc(userRef, {
    name: resident.nama || resident.fullName || resident.namaLengkap,
    nik: resident.nik,
    role: role,
    rt_id: resident.rt_id || resident.rt || '',
    rw_id: resident.rw || '011',
    status: 'Approved',
    accountStatus: 'pending_registration',
    isFirstLogin: true,
    temporaryPasswordActive: true,
    createdAt: serverTimestamp(),
    username: resident.nik, // Default username is NIK
    password: dobFormatted // Temporary password is DOB (YYYY-DD-MM)
  });
}
