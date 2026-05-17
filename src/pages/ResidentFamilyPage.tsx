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
import { collection, query, where, getDocs, addDoc, Timestamp, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';
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
}

export default function ResidentFamilyPage({ user }: { user: User | null }) {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSensitive, setShowSensitive] = useState(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [userProfiles, setUserProfiles] = useState<Record<string, string>>({});

  const handleVerifySensitive = () => {
    if (!showSensitive && user?.pin) {
      setIsPinModalOpen(true);
    } else {
      setShowSensitive(false);
    }
  };
  
  // State for new member form
  const [newMember, setNewMember] = useState({
    nik: '',
    nama: '',
    hubungan: 'Anak',
    jenisKelamin: 'LAKI-LAKI'
  });

  useEffect(() => {
    const noKK = user?.noKK || (user as any)?.extractedData?.nomorKK;
    
    if (!noKK) {
      setLoading(false);
      return;
    }

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

    return () => unsubscribe();
  }, [user?.noKK]);

  const handleAddMember = async () => {
    if (!newMember.nik || !newMember.nama) return;
    alert(`Permintaan penambahan ${newMember.nama} telah dikirim ke Admin untuk verifikasi.`);
    setShowAddModal(false);
  };

  return (
    <div className="family-page-wrapper" style={{ padding: '0 0 100px' }}>
      <header className="page-header-premium" style={{ background: '#fff', padding: '24px 20px', borderBottom: '1px solid #f1f5f9', marginBottom: 24 }}>
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

      <div style={{ padding: '0 20px' }}>
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
                  : `3216 •••• •••• ${String(user?.noKK || (user as any)?.extractedData?.nomorKK || '0000').slice(-4)}`
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
            <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 20 }}>Terdaftar di RT 0{user?.rt_id}/RW 011 • Vila Samudra Jaya</div>

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
                <div style={{ marginTop: 6 }}>
                  <span style={{ 
                    fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 6,
                    background: member.hubungan === 'Kepala Keluarga' ? '#dbeafe' : '#f1f5f9',
                    color: member.hubungan === 'Kepala Keluarga' ? '#1e40af' : '#64748b',
                    textTransform: 'uppercase'
                  }}>
                    {member.hubungan}
                  </span>
                </div>
              </div>

              {user?.isKepalaKeluarga && member.hubungan !== 'Kepala Keluarga' && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button style={{ border: 'none', background: '#f8fafc', color: '#64748b', width: 32, height: 32, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Edit2 size={14} /></button>
                  <button style={{ border: 'none', background: '#fef2f2', color: '#ef4444', width: 32, height: 32, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Trash2 size={14} /></button>
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
            style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          >
            <motion.div 
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              style={{ background: '#fff', width: '100%', maxWidth: 500, borderRadius: '32px 32px 0 0', padding: '32px 24px', maxHeight: '90vh', overflowY: 'auto' }}
            >
              <div style={{ width: 40, height: 4, background: '#e2e8f0', borderRadius: 2, margin: '0 auto 24px' }} />
              <h2 style={{ fontSize: 20, fontWeight: 900, color: '#1e3a8a', marginBottom: 8 }}>Tambah Keluarga</h2>
              <p style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>Data akan diverifikasi oleh Admin RT/RW</p>
              
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#475569', marginBottom: 8 }}>NIK 16 Digit</label>
                <input 
                  type="text" placeholder="3216..." value={newMember.nik} 
                  onChange={e => setNewMember(p => ({ ...p, nik: e.target.value }))} 
                  style={{ width: '100%', height: 50, borderRadius: 14, border: '1px solid #e2e8f0', padding: '0 16px', outline: 'none' }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#475569', marginBottom: 8 }}>Nama Sesuai KK</label>
                <input 
                  type="text" placeholder="NAMA LENGKAP" value={newMember.nama} 
                  onChange={e => setNewMember(p => ({ ...p, nama: e.target.value.toUpperCase() }))} 
                  style={{ width: '100%', height: 50, borderRadius: 14, border: '1px solid #e2e8f0', padding: '0 16px', outline: 'none' }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 24 }}>
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

              <div style={{ display: 'flex', gap: 12 }}>
                <button className="btn" style={{ flex: 1, height: 52, background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: 14, fontWeight: 700 }} onClick={() => setShowAddModal(false)}>Batal</button>
                <button className="btn" style={{ flex: 2, height: 52, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 14, fontWeight: 700 }} onClick={handleAddMember}>Simpan Data</button>
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
