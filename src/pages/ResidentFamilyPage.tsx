import React, { useState, useEffect } from 'react';
import { 
  Users, UserPlus, ShieldCheck, 
  Trash2, Edit2, Search, 
  CheckCircle, Plus, ArrowRight,
  Info, AlertCircle, Download
} from 'lucide-react';

import { User } from '../types';
import { collection, query, where, getDocs, addDoc, Timestamp, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';

interface FamilyMember {
  id: string;
  nik: string;
  nama: string;
  hubungan: string;
  status?: string;
  facePhotoBase64?: string;
}

export default function ResidentFamilyPage({ user }: { user: User | null }) {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  
  // State for new member form
  const [newMember, setNewMember] = useState({
    nik: '',
    nama: '',
    hubungan: 'Anak',
    jenisKelamin: 'LAKI-LAKI'
  });

  useEffect(() => {
    if (!user?.noKK) {
      setLoading(false);
      return;
    }

    const q = query(collection(db, 'residents'), where('noKK', '==', user.noKK));
    
    const unsubscribe = onSnapshot(q, (snapshot: any) => {
      const data = snapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data()
      }));
      setMembers(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.noKK]);

  const handleAddMember = async () => {
    // Logic to add member or search by KK
    alert(`Fitur penambahan anggota baru akan diproses melalui verifikasi Admin.`);
    setShowAddModal(false);
  };

  return (
    <div className="fade-in" style={{ padding: '20px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 800 }}>Data Keluarga</h2>
          <p style={{ color: 'var(--gray-500)', fontSize: 14 }}>Kelola daftar anggota keluarga yang terdaftar dalam satu KK</p>
        </div>
        {user?.isKepalaKeluarga && (
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            <UserPlus size={18} /> Tambah Anggota
          </button>
        )}
      </div>

      {/* Info Card */}
      <div className="card" style={{ 
        background: 'linear-gradient(to right, var(--blue-600), var(--blue-700))', 
        color: '#fff', padding: 24, marginBottom: 24, border: 'none' 
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 12, opacity: 0.8, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Nomor Kartu Keluarga</div>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: 2 }}>3216061209120005</div>
            <div style={{ marginTop: 12, display: 'flex', gap: 16 }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                  <ShieldCheck size={16} /> Data Terverifikasi
               </div>
               <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                  <Users size={16} /> {members.length} Anggota Terdaftar
               </div>
            </div>
          </div>
          <button className="btn" style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff' }}>
             <Download size={18} /> Unduh Digital
          </button>
        </div>
      </div>

      {/* Members Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
        {loading ? (
          <div className="card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 40 }}>Memuat data keluarga...</div>
        ) : members.map((member) => (
          <div key={member.id} className="card" style={{ padding: 20, position: 'relative' }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <div style={{ 
                width: 56, height: 56, borderRadius: 16, 
                background: member.hubungan === 'Kepala Keluarga' ? 'var(--blue-50)' : 'var(--gray-50)',
                color: member.hubungan === 'Kepala Keluarga' ? 'var(--blue-600)' : 'var(--gray-600)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800,
                overflow: 'hidden'
              }}>
                {member.facePhotoBase64 ? (
                  <img src={member.facePhotoBase64} alt={member.nama} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  member.nama.charAt(0)
                )}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--gray-800)' }}>{member.nama}</div>
                <div style={{ fontSize: 12, color: 'var(--gray-400)', fontFamily: 'monospace' }}>NIK: {member.nik}</div>
                <div style={{ marginTop: 8 }}>
                  <span style={{ 
                    fontSize: 10, fontWeight: 800, padding: '4px 8px', borderRadius: 6,
                    background: member.hubungan === 'Kepala Keluarga' ? 'var(--blue-100)' : 'var(--gray-100)',
                    color: member.hubungan === 'Kepala Keluarga' ? 'var(--blue-700)' : 'var(--gray-700)',
                    textTransform: 'uppercase'
                  }}>
                    {member.hubungan}
                  </span>
                </div>
              </div>
            </div>
            
            {user?.isKepalaKeluarga && member.hubungan !== 'Kepala Keluarga' && (
              <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', gap: 4 }}>
                <button className="btn btn-secondary btn-icon btn-sm"><Edit2 size={12} /></button>
                <button className="btn btn-secondary btn-icon btn-sm" style={{ color: 'var(--red-500)' }}><Trash2 size={12} /></button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add Member Modal */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div className="card fade-in" style={{ maxWidth: 450, width: '100%', padding: 32 }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Tambah Anggota Keluarga</h2>
            <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 24 }}>Masukkan data anggota keluarga baru sesuai dengan Kartu Keluarga</p>
            
            <div className="form-group">
              <label>NIK Anggota</label>
              <input type="text" className="form-input" placeholder="16 Digit NIK" value={newMember.nik} onChange={e => setNewMember(p => ({ ...p, nik: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Nama Lengkap</label>
              <input type="text" className="form-input" placeholder="Sesuai KTP" value={newMember.nama} onChange={e => setNewMember(p => ({ ...p, nama: e.target.value.toUpperCase() }))} />
            </div>
            <div className="form-group">
              <label>Hubungan</label>
              <select className="form-input" value={newMember.hubungan} onChange={e => setNewMember(p => ({ ...p, hubungan: e.target.value }))}>
                <option value="Istri">Istri</option>
                <option value="Anak">Anak</option>
                <option value="Orang Tua">Orang Tua</option>
                <option value="Famili Lain">Famili Lain</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowAddModal(false)}>Batal</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleAddMember}>Simpan Anggota</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
