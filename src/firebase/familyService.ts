import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDocs, onSnapshot, query, orderBy, serverTimestamp,
  DocumentData, QuerySnapshot
} from 'firebase/firestore';
import { db } from './config';
import { Family, FamilyMember } from '../types';

const COL = 'keluarga';

// ── Real-time listener untuk daftar KK ──
export function subscribeKeluarga(callback: (data: Family[]) => void) {
  const q = query(collection(db, COL), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap: QuerySnapshot<DocumentData>) => {
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Family));
    callback(data);
  });
}

// ── Tambah KK baru ──
export async function addKeluarga(data: Partial<Family>) {
  const { id, ...payload } = data;
  const docRef = await addDoc(collection(db, COL), {
    ...payload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

// ── Update KK ──
export async function updateKeluarga(id: string, data: Partial<Family>) {
  const { id: _id, ...payload } = data;
  await updateDoc(doc(db, COL, id), {
    ...payload,
    updatedAt: serverTimestamp(),
  });
}

// ── Hapus KK + semua anggota ──
export async function deleteKeluarga(id: string) {
  const anggotaSnap = await getDocs(collection(db, COL, id, 'anggota'));
  const deletes = anggotaSnap.docs.map(d => deleteDoc(d.ref));
  await Promise.all(deletes);
  await deleteDoc(doc(db, COL, id));
}

// ── Real-time listener untuk anggota satu KK ──
export function subscribeAnggota(kkId: string, callback: (data: FamilyMember[]) => void) {
  const q = query(
    collection(db, COL, kkId, 'anggota'),
    orderBy('hubungan')
  );

  return onSnapshot(q, (snap: QuerySnapshot<DocumentData>) => {
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as FamilyMember));
    callback(data);
  });
}

// ── Tambah anggota ──
export async function addAnggota(kkId: string, data: Partial<FamilyMember>) {
  const { id, ...payload } = data;
  const docRef = await addDoc(collection(db, COL, kkId, 'anggota'), {
    ...payload,
    createdAt: serverTimestamp(),
  });
  const snap = await getDocs(collection(db, COL, kkId, 'anggota'));
  await updateDoc(doc(db, COL, kkId), {
    jumlahAnggota: snap.size,
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

// ── Update anggota ──
export async function updateAnggota(kkId: string, memberId: string, data: Partial<FamilyMember>) {
  const { id, ...payload } = data;
  await updateDoc(doc(db, COL, kkId, 'anggota', memberId), {
    ...payload,
    updatedAt: serverTimestamp(),
  });
}

// ── Hapus anggota ──
export async function deleteAnggota(kkId: string, memberId: string) {
  await deleteDoc(doc(db, COL, kkId, 'anggota', memberId));
  const snap = await getDocs(collection(db, COL, kkId, 'anggota'));
  await updateDoc(doc(db, COL, kkId), {
    jumlahAnggota: snap.size,
    updatedAt: serverTimestamp(),
  });
}
