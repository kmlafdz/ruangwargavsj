import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from './config';
import { mockFamilies, mockFamilyMembers } from '../data/mockData';
import { addKeluarga, addAnggota } from './familyService';
import { Family } from '../types';

export async function seedFirestore() {
  const col = collection(db, 'keluarga');
  const existing = await getDocs(col);
  if (!existing.empty) {
    console.warn('Firestore sudah punya data, seed dibatalkan.');
    return;
  }

  console.log('Seeding Firestore...');
  for (const fam of mockFamilies) {
    const members = (mockFamilyMembers as any)[fam.id] || [];
    // Tambah KK dengan jumlahAnggota=0 dulu
    const kkId = await addKeluarga({ ...(fam as any), jumlahAnggota: 0 } as Partial<Family>);
    // Tambah semua anggota
    for (const member of members) {
      await addAnggota(kkId, member);
    }
    // Set jumlahAnggota yang benar
    await updateDoc(doc(db, 'keluarga', kkId), { jumlahAnggota: members.length });
    console.log(`✓ KK ${fam.nomorKK} — ${members.length} anggota`);
  }
  console.log('Seed selesai!');
}
