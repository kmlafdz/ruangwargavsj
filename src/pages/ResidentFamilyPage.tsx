import React, { useState, useEffect } from 'react';
import { 
  Users, UserPlus, ShieldCheck, 
  Trash2, Edit2, Search, 
  CheckCircle, Plus, ArrowRight,
  Info, AlertCircle, Download,
  Eye, EyeOff
} from 'lucide-react';

import { motion, AnimatePresence } from 'framer-motion';

import { User } from '../types';
import { collection, query, where, getDocs, addDoc, Timestamp, onSnapshot, orderBy, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { sendNotification } from '../services/notificationService';
import PinVerificationModal from '../components/PinVerificationModal';

interface FamilyMember {
  id: string;
  nik: string;
  nama: string;
  hubungan: string;
  status?: string;
  facePhotoBase64?: string;
  photoUrl?: string;
  facePhoto?: string;
  ktpPhotoUrl?: string;
  statusValidasi?: string;
}

export default function ResidentFamilyPage({ user }: { user: User | null }) {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSensitive, setShowSensitive] = useState(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [userProfiles, setUserProfiles] = useState<Record<string, string>>({});
  const [isEditing, setIsEditing] = useState(false);
  const [familyDetails, setFamilyDetails] = useState<any>(null);
  const [deletingMember, setDeletingMember] = useState<FamilyMember | null>(null);
  const [draftMembers, setDraftMembers] = useState<any[]>([]);
  const [customAlert, setCustomAlert] = useState<{
    title: string;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
  } | null>(null);

  const showAlert = (title: string, message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    setCustomAlert({ title, message, type });
  };

  const handleVerifySensitive = () => {
    if (!showSensitive && user?.pin) {
      setIsPinModalOpen(true);
    } else {
      setShowSensitive(false);
    }
  };
  
  // State for new member form
  const [newMember, setNewMember] = useState({
    id: '',
    nik: '',
    nama: '',
    hubungan: 'Anak',
    jenisKelamin: 'LAKI-LAKI',
    tempatLahir: '',
    tanggalLahir: '',
    statusPerkawinan: 'Belum Kawin',
    noHP: '',
    fotoKK: ''
  });

  useEffect(() => {
    const noKK = user?.noKK || (user as any)?.extractedData?.nomorKK;
    
    if (!noKK) {
      setLoading(false);
      return;
    }

    // Subscribe to families details to display dynamic address
    const famRef = doc(db, 'families', noKK);
    const unsubFam = onSnapshot(famRef, (docSnap) => {
      if (docSnap.exists()) {
        setFamilyDetails(docSnap.data());
      }
    });

    const q = query(collection(db, 'residents'), where('noKK', '==', noKK));
    
    const unsubscribe = onSnapshot(q, (snapshot: any) => {
      const data = snapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Sort members based on standard family hierarchy (Kepala Keluarga is always first)
      const HIERARCHY = ['Kepala Keluarga', 'Suami', 'Istri', 'Anak', 'Cucu', 'Menantu', 'Orang Tua', 'Saudara', 'Lainnya'];
      const sortedData = [...data].sort((a, b) => {
        const orderA = HIERARCHY.indexOf(a.hubungan || 'Lainnya');
        const orderB = HIERARCHY.indexOf(b.hubungan || 'Lainnya');
        const idxA = orderA === -1 ? 99 : orderA;
        const idxB = orderB === -1 ? 99 : orderB;
        return idxA - idxB;
      });

      setMembers(sortedData);
      setLoading(false);

      // Automatically clean up expired Foto KK (> 48 hours)
      const now = Timestamp.now().seconds;
      data.forEach((m: any) => {
        if (m.fotoKK && m.fotoKKUploadedAt && (now - m.fotoKKUploadedAt.seconds > 48 * 3600)) {
          updateDoc(doc(db, 'residents', m.id), {
            fotoKK: null
          }).catch((err: any) => console.error("Failed to clean up expired Foto KK:", err));
        }
      });

      // Fetch user profiles for these members to get personalized photos
      const niks = data.map((m: any) => m.nik).filter(Boolean);
      if (niks.length > 0) {
        // Break into chunks of 10 if needed, but usually family is < 10
        const usersQ = query(collection(db, 'users'), where('nik', 'in', niks));
        onSnapshot(usersQ, (uSnap) => {
          const profiles: Record<string, string> = {};
          uSnap.docs.forEach(uDoc => {
            const uData = uDoc.data();
            if (uData.photoUrl) profiles[uDoc.id] = uData.photoUrl;
          });
          setUserProfiles(profiles);
        });
      }
    });

    return () => {
      unsubFam();
      unsubscribe();
    };
  }, [user?.noKK]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Str = event.target?.result as string;
      
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let width = img.width;
        let height = img.height;
        const maxDim = 800;

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.6);
        setNewMember(prev => ({ ...prev, fotoKK: compressedBase64 }));
      };
    };
    reader.readAsDataURL(file);
  };

  const handleAddToDraft = () => {
    if (!newMember.nik || !newMember.nama || !newMember.tempatLahir || !newMember.tanggalLahir || !newMember.fotoKK) {
      showAlert("Data Tidak Lengkap", "Harap lengkapi semua data wajib (NIK, Nama Lengkap, Tempat Lahir, Tanggal Lahir, & Foto KK).", "warning");
      return;
    }
    if (newMember.nik.length !== 16) {
      showAlert("NIK Tidak Valid", "NIK harus terdiri dari 16 digit angka.", "warning");
      return;
    }

    setDraftMembers(prev => [...prev, {
      ...newMember,
      id: Math.random().toString(36).substr(2, 9)
    }]);

    setNewMember(prev => ({
      ...prev,
      nik: '',
      nama: '',
      hubungan: 'Anak',
      jenisKelamin: 'LAKI-LAKI',
      tempatLahir: '',
      tanggalLahir: '',
      statusPerkawinan: 'Belum Kawin',
      noHP: '',
    }));
  };

  const handleRemoveFromDraft = (id: string) => {
    setDraftMembers(prev => prev.filter(m => m.id !== id));
  };

  const handleSubmitAllDraft = async () => {
    if (draftMembers.length === 0) return;
    const noKK = user?.noKK || (user as any)?.extractedData?.nomorKK;
    if (!noKK) {
      showAlert("Gagal", "Gagal menambahkan anggota. Anda belum memiliki Nomor KK yang valid.", "error");
      return;
    }

    setLoading(true);
    try {
      const promises = draftMembers.map(m => {
        return addDoc(collection(db, 'residents'), {
          nik: m.nik,
          nama: m.nama,
          hubungan: m.hubungan,
          jenisKelamin: m.jenisKelamin,
          tempatLahir: m.tempatLahir,
          tanggalLahir: m.tanggalLahir,
          statusPerkawinan: m.statusPerkawinan,
          noHP: m.noHP || '',
          fotoKK: m.fotoKK,
          fotoKKUploadedAt: Timestamp.now(),
          noKK: noKK,
          rt_id: user?.rt_id || '',
          rw_id: '011',
          alamat: (user as any)?.alamat || (user as any)?.extractedData?.address || '',
          statusValidasi: 'Pending',
          createdAt: Timestamp.now()
        });
      });

      await Promise.all(promises);

      // Notify RT and RW admins
      try {
        const rtNum = String(user?.rt_id || '01').slice(-2).padStart(2, '0');
        const targetRtRole = `ketua_rt_${rtNum}`;
        const names = draftMembers.map(m => m.nama).join(', ');
        await sendNotification(
          'registration',
          '📋 Pengajuan Anggota Keluarga Baru',
          `Warga ${user?.name || 'Warga'} mengajukan penambahan ${draftMembers.length} anggota keluarga (${names}) untuk diverifikasi.`,
          ['ketua_rw', targetRtRole],
          { route: '/admin/dev/approvals' }
        );
      } catch (notifErr) {
        console.error("Gagal mengirimkan notifikasi penambahan keluarga ke admin:", notifErr);
      }

      showAlert("Berhasil", `Permintaan penambahan ${draftMembers.length} anggota keluarga telah dikirim ke Admin untuk verifikasi.`, "success");
      setDraftMembers([]);
      setShowAddModal(false);
      setIsEditing(false);
      setNewMember({
        id: '',
        nik: '',
        nama: '',
        hubungan: 'Anak',
        jenisKelamin: 'LAKI-LAKI',
        tempatLahir: '',
        tanggalLahir: '',
        statusPerkawinan: 'Belum Kawin',
        noHP: '',
        fotoKK: ''
      });
    } catch (err) {
      console.error(err);
      showAlert("Error", "Terjadi kesalahan saat menambahkan anggota keluarga.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateMember = async () => {
    if (!newMember.nik || !newMember.nama || !(newMember as any).id) return;
    
    if (newMember.nik.length !== 16) {
      showAlert("NIK Tidak Valid", "NIK harus terdiri dari 16 digit angka.", "warning");
      return;
    }

    if (!newMember.fotoKK) {
      showAlert("Foto KK Wajib", "Harap upload foto KK untuk anggota keluarga ini.", "warning");
      return;
    }

    setLoading(true);
    try {
      const memberDocRef = doc(db, 'residents', (newMember as any).id);
      const updateData: any = {
        nik: newMember.nik,
        nama: newMember.nama,
        hubungan: newMember.hubungan,
        jenisKelamin: newMember.jenisKelamin,
        tempatLahir: newMember.tempatLahir,
        tanggalLahir: newMember.tanggalLahir,
        statusPerkawinan: newMember.statusPerkawinan,
        noHP: newMember.noHP || '',
        statusValidasi: 'Pending'
      };

      if (newMember.fotoKK) {
        updateData.fotoKK = newMember.fotoKK;
        updateData.fotoKKUploadedAt = Timestamp.now();
      }

      await updateDoc(memberDocRef, updateData);
      
      // Notify RT and RW admins
      try {
        const rtNum = String(user?.rt_id || '01').slice(-2).padStart(2, '0');
        const targetRtRole = `ketua_rt_${rtNum}`;
        await sendNotification(
          'registration',
          '🔄 Pengajuan Ulang Anggota Keluarga',
          `Warga ${user?.name || 'Warga'} telah memperbaiki dan mengajukan ulang data keluarga (${newMember.nama}) untuk diverifikasi.`,
          ['ketua_rw', targetRtRole],
          { route: '/admin/dev/approvals' }
        );
      } catch (notifErr) {
        console.error("Gagal mengirim notifikasi update keluarga:", notifErr);
      }

      showAlert("Berhasil", `Perubahan data anggota keluarga ${newMember.nama} telah dikirim ke Admin untuk verifikasi.`, "success");
      setShowAddModal(false);
      setIsEditing(false);
      setNewMember({
        id: '',
        nik: '',
        nama: '',
        hubungan: 'Anak',
        jenisKelamin: 'LAKI-LAKI',
        tempatLahir: '',
        tanggalLahir: '',
        statusPerkawinan: 'Belum Kawin',
        noHP: '',
        fotoKK: ''
      });
    } catch (err) {
      console.error(err);
      showAlert("Error", "Terjadi kesalahan saat memperbarui data anggota keluarga.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMember = async () => {
    if (!deletingMember) return;
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'residents', deletingMember.id));
      showAlert("Berhasil", `Anggota keluarga ${deletingMember.nama} berhasil dihapus.`, "success");
      setDeletingMember(null);
    } catch (err) {
      console.error(err);
      showAlert("Error", "Terjadi kesalahan saat menghapus anggota keluarga.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleCloseModal = () => {
    setShowAddModal(false);
    setIsEditing(false);
    setDraftMembers([]);
    setNewMember({
      id: '',
      nik: '',
      nama: '',
      hubungan: 'Anak',
      jenisKelamin: 'LAKI-LAKI',
      tempatLahir: '',
      tanggalLahir: '',
      statusPerkawinan: 'Belum Kawin',
      noHP: '',
      fotoKK: ''
    });
  };

  const handleEditClick = (member: FamilyMember) => {
    setNewMember({
      id: member.id,
      nik: member.nik,
      nama: member.nama,
      hubungan: member.hubungan || 'Anak',
      jenisKelamin: (member as any).jenisKelamin || 'LAKI-LAKI',
      tempatLahir: (member as any).tempatLahir || '',
      tanggalLahir: (member as any).tanggalLahir || '',
      statusPerkawinan: (member as any).statusPerkawinan || 'Belum Kawin',
      noHP: (member as any).noHP || '',
      fotoKK: (member as any).fotoKK || ''
    } as any);
    setIsEditing(true);
    setShowAddModal(true);
  };

  const handleCreateAccount = async (member: any) => {
    if (!member.nik || member.nik.length < 16) {
      showAlert("NIK Tidak Valid", "NIK tidak valid atau belum lengkap.", "warning");
      return;
    }
    const nik = member.nik;
    let dd = parseInt(nik.substring(6, 8));
    const mm = parseInt(nik.substring(8, 10));
    const yy = parseInt(nik.substring(10, 12));
    
    if (dd > 40) dd -= 40;
    
    const currentYearStr = new Date().getFullYear().toString().substring(2, 4);
    const fullYear = yy > parseInt(currentYearStr) ? 1900 + yy : 2000 + yy;
    
    const dob = new Date(fullYear, mm - 1, dd);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
        age--;
    }

    if (age < 17) {
      showAlert("Batas Usia", "Anggota keluarga belum berusia 17 tahun. Akun tidak dapat dibuat.", "warning");
      return;
    }

    const tglLahirFormat = `${fullYear}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
    
    const uQ = query(collection(db, 'users'), where('username', '==', nik));
    const snap = await getDocs(uQ);
    if (!snap.empty) {
      showAlert("Sudah Terdaftar", "Akun warga sudah ada.", "info");
      return;
    }

    try {
      const { setDoc, doc: docRef } = await import('firebase/firestore');
      await setDoc(docRef(db, 'users', nik), {
        username: nik,
        password: tglLahirFormat,
        name: member.nama,
        accountType: 'resident',
        accountStatus: 'pending_registration',
        status: 'Approved',
        isFirstLogin: true,
        temporaryPasswordActive: true,
        rt_id: user?.rt_id || '',
        noKK: member.noKK || user?.noKK || '',
        nik: nik,
        createdAt: Timestamp.now()
      });
      showAlert("Akun Dibuat", `Akun berhasil dibuat. Silahkan login dengan Username: ${nik} dan Password: ${tglLahirFormat}`, "success");
    } catch (err) {
      console.error(err);
      showAlert("Gagal", "Gagal membuat akun.", "error");
    }
  };

  return (
    <div className="family-page-wrapper" style={{ maxWidth: 500, margin: '0 auto', padding: '0 0 100px' }}>
      <header className="page-header-premium" style={{ background: '#fff', padding: '16px 6px', borderBottom: '1px solid #f1f5f9', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 900, color: '#1e3a8a', margin: 0 }}>Data Keluarga</h2>
            <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>Kelola anggota keluarga terdaftar</p>
          </div>
          {user?.isKepalaKeluarga && (
            <motion.button 
              whileTap={{ scale: 0.95 }}
              className="btn-add-member" 
              onClick={() => setShowAddModal(true)}
              style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: 12, fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)' }}
            >
              <Plus size={18} /> Tambah
            </motion.button>
          )}
        </div>
      </header>

      <div style={{ padding: '0 6px' }}>
        {/* KK INFO CARD - PREMIUM DESIGN */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="kk-info-card"
          style={{ 
            background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)', 
            borderRadius: 24, padding: 24, marginBottom: 28, color: '#fff', position: 'relative', overflow: 'hidden',
            boxShadow: '0 12px 30px -10px rgba(37, 99, 235, 0.4)'
          }}
        >
          <div style={{ position: 'absolute', top: -20, right: -20, width: 120, height: 120, background: 'rgba(255,255,255,0.1)', borderRadius: '50%' }} />
          
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ background: 'rgba(255,255,255,0.2)', padding: '6px 12px', borderRadius: 10, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1 }}>Kartu Keluarga Digital</div>
              <Download size={20} style={{ opacity: 0.8 }} />
            </div>
            
            <div style={{ fontSize: 12, opacity: 0.8, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Nomor Kartu Keluarga</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
              <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: 1 }}>
                {showSensitive 
                  ? (user?.noKK || (user as any)?.extractedData?.nomorKK || '3216000000000000') 
                  : (() => {
                      const kkNum = String(user?.noKK || (user as any)?.extractedData?.nomorKK || '3216000000000000');
                      const first4 = kkNum.substring(0, 4);
                      const last4 = kkNum.slice(-4);
                      return `${first4} •••• •••• ${last4}`;
                    })()
                }
              </div>
              <button 
                type="button"
                onClick={handleVerifySensitive}
                style={{
                  background: 'rgba(255, 255, 255, 0.15)',
                  border: 'none',
                  color: '#ffffff',
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
              >
                {showSensitive ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 20 }}>
              Terdaftar di RT {(() => {
                const rtStr = String(familyDetails?.rt || user?.rt_id || '').replace(/\D/g, '');
                return rtStr ? rtStr.padStart(3, '0') : '001';
              })()}/RW {familyDetails?.rw || '011'} • {familyDetails?.alamat || 'Vila Samudra Jaya'}
            </div>

            <div style={{ display: 'flex', gap: 16, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 16 }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600 }}>
                  <ShieldCheck size={14} /> Terverifikasi
               </div>
               <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600 }}>
                  <Users size={14} /> {members.length} Anggota
               </div>
            </div>
          </div>
        </motion.div>

        {/* MEMBERS SECTION */}
        <h3 style={{ fontSize: 16, fontWeight: 900, color: '#1e3a8a', marginBottom: 16 }}>Daftar Anggota Keluarga</h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100%, 1fr))', gap: 12 }}>
          {loading ? null : members.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', background: '#fff', borderRadius: 24 }}>
              <Users size={48} color="#cbd5e1" style={{ margin: '0 auto 16px' }} />
              <p style={{ color: '#64748b', fontWeight: 600 }}>Belum ada data keluarga</p>
            </div>
          ) : members.map((member, idx) => (
            <motion.div 
              key={member.id} 
              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="family-member-card"
              style={{ 
                background: '#fff', padding: 16, borderRadius: 20, border: '1px solid #f1f5f9',
                display: 'flex', alignItems: 'center', gap: 16, position: 'relative',
                boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
              }}
            >
              <div style={{ 
                width: 52, height: 52, borderRadius: 16, 
                background: member.hubungan === 'Kepala Keluarga' ? '#eff6ff' : '#f8fafc',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800,
                color: member.hubungan === 'Kepala Keluarga' ? '#2563eb' : '#94a3b8',
                overflow: 'hidden', border: '1px solid #f1f5f9'
              }}>
                {(() => {
                  // PRIORITY: User Profile Photo > facePhotoBase64 > other fields
                  const photo = userProfiles[member.nik] || member.facePhotoBase64 || member.photoUrl || member.facePhoto || member.ktpPhotoUrl;
                  if (photo) {
                    const src = photo.startsWith('http') || photo.startsWith('data:') 
                      ? photo 
                      : `data:image/jpeg;base64,${photo}`;
                    return <img src={src} alt={member.nama} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
                  }
                  return member.nama?.charAt(0) || <Users size={20} />;
                })()}
              </div>
              
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#1e293b' }}>{member.nama}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>
                    {showSensitive 
                      ? member.nik 
                      : `•••• •••• •••• ${String(member.nik).slice(-4)}`
                    }
                  </span>
                  {!showSensitive && (
                    <button 
                      type="button"
                      onClick={handleVerifySensitive}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#2563eb',
                        padding: 0,
                        fontSize: 10,
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      (Lihat)
                    </button>
                  )}
                </div>
                <div style={{ marginTop: 6, display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ 
                    fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 6,
                    background: member.hubungan === 'Kepala Keluarga' ? '#dbeafe' : '#f1f5f9',
                    color: member.hubungan === 'Kepala Keluarga' ? '#1e40af' : '#64748b',
                    textTransform: 'uppercase'
                  }}>
                    {member.hubungan}
                  </span>
                  {(member.statusValidasi === 'Pending' || member.statusValidasi === 'Ditolak') && (
                    <span style={{
                      fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 6,
                      background: member.statusValidasi === 'Pending' ? '#fef9c3' : '#fee2e2',
                      color: member.statusValidasi === 'Pending' ? '#a16207' : '#991b1b',
                      textTransform: 'uppercase'
                    }}>
                      {member.statusValidasi === 'Pending' ? 'Menunggu' : 'Ditolak'}
                    </span>
                  )}
                </div>
              </div>

              {user?.isKepalaKeluarga && member.hubungan !== 'Kepala Keluarga' && (
                <div style={{ display: 'flex', gap: 6 }}>
                  {!userProfiles[member.nik] && (
                    <button 
                      onClick={() => handleCreateAccount(member)}
                      style={{ border: 'none', background: '#eff6ff', color: '#2563eb', padding: '0 12px', height: 32, borderRadius: 10, fontSize: 11, fontWeight: 800, cursor: 'pointer' }}
                    >
                      Buat Akun
                    </button>
                  )}
                  <button 
                    onClick={() => handleEditClick(member)}
                    style={{ border: 'none', background: '#f8fafc', color: '#64748b', width: 32, height: 32, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                  >
                    <Edit2 size={14} />
                  </button>
                  <button 
                    onClick={() => setDeletingMember(member)}
                    style={{ border: 'none', background: '#fef2f2', color: '#ef4444', width: 32, height: 32, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>

      {/* ADD MEMBER MODAL */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, zIndex: 20000, background: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          >
            <motion.div 
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              style={{ background: '#fff', width: '100%', maxWidth: 500, borderRadius: '32px 32px 0 0', padding: '32px 24px', maxHeight: '90vh', overflowY: 'auto' }}
            >
              <div style={{ width: 40, height: 4, background: '#e2e8f0', borderRadius: 2, margin: '0 auto 24px' }} />
              <h2 style={{ fontSize: 20, fontWeight: 900, color: '#1e3a8a', marginBottom: 8 }}>
                {isEditing ? 'Edit Anggota Keluarga' : 'Tambah Keluarga'}
              </h2>
              <p style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>
                {isEditing ? 'Perubahan data akan diverifikasi ulang oleh Admin' : 'Data akan diverifikasi oleh Admin RT/RW'}
              </p>

              {!isEditing && draftMembers.length > 0 && (
                <div style={{ marginBottom: 20, background: '#f8fafc', padding: 16, borderRadius: 20, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#475569', marginBottom: 10 }}>Daftar Antrean Tambah ({draftMembers.length})</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {draftMembers.map(m => (
                      <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', padding: '10px 12px', borderRadius: 12, border: '1px solid #f1f5f9' }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 800, color: '#1e293b' }}>{m.nama}</div>
                          <div style={{ fontSize: 10, color: '#94a3b8' }}>{m.hubungan} • {m.nik}</div>
                        </div>
                        <button 
                          type="button" 
                          onClick={() => handleRemoveFromDraft(m.id)}
                          style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', padding: 4 }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#475569', marginBottom: 8 }}>NIK 16 Digit</label>
                <input 
                  type="text" 
                  placeholder="3216..." 
                  value={newMember.nik} 
                  maxLength={16}
                  onChange={e => {
                    const val = e.target.value.replace(/\D/g, '');
                    setNewMember(p => ({ ...p, nik: val }));
                  }} 
                  style={{ width: '100%', height: 50, borderRadius: 14, border: '1px solid #e2e8f0', padding: '0 16px', outline: 'none' }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#475569', marginBottom: 8 }}>Nama Lengkap (Sesuai KK)</label>
                <input 
                  type="text" placeholder="NAMA LENGKAP" value={newMember.nama} 
                  onChange={e => setNewMember(p => ({ ...p, nama: e.target.value.toUpperCase() }))} 
                  style={{ width: '100%', height: 50, borderRadius: 14, border: '1px solid #e2e8f0', padding: '0 16px', outline: 'none' }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#475569', marginBottom: 8 }}>Hubungan Keluarga</label>
                <select 
                  value={newMember.hubungan} onChange={e => setNewMember(p => ({ ...p, hubungan: e.target.value }))}
                  style={{ width: '100%', height: 50, borderRadius: 14, border: '1px solid #e2e8f0', padding: '0 16px', outline: 'none', appearance: 'none' }}
                >
                  <option value="Istri">Istri</option>
                  <option value="Anak">Anak</option>
                  <option value="Orang Tua">Orang Tua</option>
                  <option value="Famili Lain">Famili Lain</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#475569', marginBottom: 8 }}>Jenis Kelamin</label>
                <select 
                  value={newMember.jenisKelamin} onChange={e => setNewMember(p => ({ ...p, jenisKelamin: e.target.value }))}
                  style={{ width: '100%', height: 50, borderRadius: 14, border: '1px solid #e2e8f0', padding: '0 16px', outline: 'none', appearance: 'none' }}
                >
                  <option value="LAKI-LAKI">Laki-laki</option>
                  <option value="PEREMPUAN">Perempuan</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#475569', marginBottom: 8 }}>Tempat Lahir</label>
                <input 
                  type="text" placeholder="TEMPAT LAHIR" value={newMember.tempatLahir} 
                  onChange={e => setNewMember(p => ({ ...p, tempatLahir: e.target.value.toUpperCase() }))} 
                  style={{ width: '100%', height: 50, borderRadius: 14, border: '1px solid #e2e8f0', padding: '0 16px', outline: 'none' }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#475569', marginBottom: 8 }}>Tanggal Lahir</label>
                <input 
                  type="date" value={newMember.tanggalLahir} 
                  onChange={e => setNewMember(p => ({ ...p, tanggalLahir: e.target.value }))} 
                  style={{ width: '100%', height: 50, borderRadius: 14, border: '1px solid #e2e8f0', padding: '0 16px', outline: 'none' }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#475569', marginBottom: 8 }}>Status Perkawinan</label>
                <select 
                  value={newMember.statusPerkawinan} onChange={e => setNewMember(p => ({ ...p, statusPerkawinan: e.target.value }))}
                  style={{ width: '100%', height: 50, borderRadius: 14, border: '1px solid #e2e8f0', padding: '0 16px', outline: 'none', appearance: 'none' }}
                >
                  <option value="Belum Kawin">Belum Kawin</option>
                  <option value="Kawin">Kawin</option>
                  <option value="Cerai Hidup">Cerai Hidup</option>
                  <option value="Cerai Mati">Cerai Mati</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#475569', marginBottom: 8 }}>Nomor HP (Opsional)</label>
                <input 
                  type="text" placeholder="0812..." value={(newMember as any).noHP || ''} 
                  onChange={e => setNewMember(p => ({ ...p, noHP: e.target.value.replace(/\D/g, '') }))} 
                  style={{ width: '100%', height: 50, borderRadius: 14, border: '1px solid #e2e8f0', padding: '0 16px', outline: 'none' }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#475569', marginBottom: 8 }}>
                  Foto KK {(!isEditing || !newMember.fotoKK) ? '(Wajib)' : '(Opsional jika tidak diganti)'}
                </label>
                <input 
                  type="file" accept="image/*" onChange={handleFileUpload} 
                  style={{ display: 'none' }} id="foto-kk-upload" 
                />
                <label 
                  htmlFor="foto-kk-upload" 
                  style={{ 
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', 
                    border: '2px dashed #cbd5e1', borderRadius: '16px', padding: '20px', cursor: 'pointer', 
                    background: '#f8fafc', transition: 'all 0.2s', minHeight: '120px'
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = '#2563eb'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = '#cbd5e1'}
                >
                  {newMember.fotoKK ? (
                    <div style={{ position: 'relative', width: '100%', maxHeight: '150px', overflow: 'hidden', borderRadius: '12px', textAlign: 'center' }}>
                      <img src={newMember.fotoKK} alt="Preview KK" style={{ maxWidth: '100%', maxHeight: '150px', objectFit: 'contain' }} />
                      <div style={{ position: 'absolute', bottom: '8px', right: '8px', background: 'rgba(15,23,42,0.7)', color: '#fff', fontSize: '10px', padding: '4px 8px', borderRadius: '20px' }}>
                        Klik untuk ganti
                      </div>
                    </div>
                  ) : (
                    <>
                      <Download size={24} color="#64748b" style={{ marginBottom: '8px' }} />
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#475569' }}>Upload Foto KK</span>
                      <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>PNG, JPG s/d 5MB (Terhapus otomatis 48 jam)</span>
                    </>
                  )}
                </label>
              </div>

              {!isEditing && (
                <button 
                  type="button" 
                  className="btn" 
                  onClick={handleAddToDraft}
                  style={{ width: '100%', height: 48, background: '#eff6ff', color: '#2563eb', border: 'none', borderRadius: 14, fontWeight: 700, marginBottom: 16, cursor: 'pointer' }}
                >
                  + Tambah ke Daftar
                </button>
              )}

              <div style={{ display: 'flex', gap: 12 }}>
                <button className="btn" style={{ flex: 1, height: 52, background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: 14, fontWeight: 700, cursor: 'pointer' }} onClick={handleCloseModal}>Batal</button>
                {isEditing ? (
                  <button className="btn" style={{ flex: 2, height: 52, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 14, fontWeight: 700, cursor: 'pointer' }} onClick={handleUpdateMember}>
                    Simpan Perubahan
                  </button>
                ) : (
                  <button 
                    className="btn" 
                    disabled={draftMembers.length === 0}
                    style={{ flex: 2, height: 52, background: draftMembers.length === 0 ? '#cbd5e1' : '#2563eb', color: '#fff', border: 'none', borderRadius: 14, fontWeight: 700, cursor: draftMembers.length === 0 ? 'not-allowed' : 'pointer' }} 
                    onClick={handleSubmitAllDraft}
                  >
                    Kirim Semua ({draftMembers.length})
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* DELETE CONFIRMATION MODAL */}
      <AnimatePresence>
        {deletingMember && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, zIndex: 20000, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              style={{ background: '#fff', width: '100%', maxWidth: 400, borderRadius: 28, padding: 32, textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}
            >
              <div style={{ position: 'relative', width: 140, height: 140, margin: '0 auto 20px' }}>
                <img 
                  src="/vira_ai_confirm.png" 
                  alt="Vira AI Confirm" 
                  style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '16px' }} 
                />
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 900, color: '#0f172a', marginBottom: 12 }}>Hapus Anggota Keluarga</h3>
              <p style={{ color: '#64748b', fontSize: 14, lineHeight: 1.6, marginBottom: 32 }}>
                Apakah Anda yakin ingin menghapus <strong>{deletingMember.nama}</strong> dari daftar keluarga Anda?
              </p>
              <div style={{ display: 'flex', gap: 12 }}>
                <button 
                  onClick={() => setDeletingMember(null)}
                  style={{ flex: 1, height: 50, borderRadius: 14, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
                >
                  Batal
                </button>
                <button 
                  onClick={handleDeleteMember}
                  style={{ flex: 1, height: 50, borderRadius: 14, border: 'none', background: '#ef4444', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
                >
                  Hapus
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {user && (
        <PinVerificationModal
          isOpen={isPinModalOpen}
          correctPin={user.pin || ''}
          userName={user.name || 'Warga'}
          userId={user.id}
          userPassword={user.password}
          title="Verifikasi PIN untuk Data Keluarga"
          onSuccess={() => setShowSensitive(true)}
          onClose={() => setIsPinModalOpen(false)}
        />
      )}

      {/* CUSTOM ALERT MODAL */}
      <AnimatePresence>
        {customAlert && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, zIndex: 30000, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              style={{ background: '#fff', width: '100%', maxWidth: 360, borderRadius: 28, padding: 32, textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}
            >
              <div style={{ position: 'relative', width: 120, height: 120, margin: '0 auto 20px' }}>
                <img 
                  src={customAlert.type === 'success' ? "/vira_ai_berhasil.png" : "/vira_ai_kaget.png"} 
                  alt={customAlert.type} 
                  style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '16px' }} 
                />
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 900, color: '#0f172a', marginBottom: 12 }}>{customAlert.title}</h3>
              <p style={{ color: '#64748b', fontSize: 14, lineHeight: 1.6, marginBottom: 28 }}>
                {customAlert.message}
              </p>
              <button 
                onClick={() => setCustomAlert(null)}
                style={{ width: '100%', height: 48, borderRadius: 14, border: 'none', background: '#2563eb', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
              >
                OK
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .family-member-card {
          transition: all 0.2s ease;
        }
        .family-member-card:active {
          transform: scale(0.98);
          background: #f8fafc;
        }
      `}</style>
    </div>
  );
}
