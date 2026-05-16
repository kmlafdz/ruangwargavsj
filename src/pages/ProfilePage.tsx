import React, { useState, useEffect, useRef } from 'react';
import { User as UserIcon, Camera, Save, CheckCircle, AlertCircle, Loader2, Trash2, ShieldAlert, Settings, LogOut } from 'lucide-react';
import { doc, setDoc, getDoc, collection, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../firebase/config';
import { User } from '../types';

interface ProfilePageProps {
  user: User | null;
  onUpdateUser: (user: User) => void;
}

export default function ProfilePage({ user, onUpdateUser }: ProfilePageProps) {
  // 1. All States at the Top
  const [name, setName] = useState(user?.name || '');
  const [photoPreview, setPhotoPreview] = useState(user?.photoUrl || '');
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(true);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);

  // 2. All Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const holdIntervalRef = useRef<any>(null);

  // 3. Effects
  useEffect(() => {
    async function init() {
      if (!user?.id) {
        setSyncing(false);
        return;
      }
      try {
        const snap = await getDoc(doc(db, 'users', user.id));
        if (snap.exists()) {
          const data = snap.data();
          if (data.name) setName(data.name);
          if (data.photoUrl) setPhotoPreview(data.photoUrl);
          onUpdateUser({ ...user, ...data });
        }
      } catch (e) {
        console.error("Sync error:", e);
      } finally {
        setSyncing(false);
      }
    }
    init();
  }, [user?.id]);

  useEffect(() => {
    return () => {
      if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
    };
  }, []);

  // 4. Handlers
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    setMessage(null);

    try {
      const { updateDoc, query, where, getDocs, collection } = await import('firebase/firestore');

      // 1. Update Users collection
      await setDoc(doc(db, 'users', user.id), {
        name,
        photoUrl: photoPreview,
        updatedAt: new Date()
      }, { merge: true });

      // 2. Sync with Residents collection (important for visibility to others/admin)
      const userNik = user.nik || user.id;
      const residentsQ = query(collection(db, 'residents'), where('nik', '==', userNik));
      const residentsSnap = await getDocs(residentsQ);

      if (!residentsSnap.empty) {
        for (const residentDoc of residentsSnap.docs) {
          await updateDoc(residentDoc.ref, {
            nama: name,
            fullName: name, // Sync both if they exist
            facePhotoBase64: photoPreview,
            updatedAt: new Date()
          });
        }
      }

      // 3. Sync with Families collection if user is Kepala Keluarga
      if (user.isKepalaKeluarga || user.hubunganKeluarga === 'Kepala Keluarga') {
        const familiesQ = query(collection(db, 'families'), where('kepalaKeluargaId', '==', userNik));
        const familiesSnap = await getDocs(familiesQ);
        if (!familiesSnap.empty) {
          for (const familyDoc of familiesSnap.docs) {
            await updateDoc(familyDoc.ref, {
              kepalaKeluarga: name,
              updatedAt: new Date()
            });
          }
        }
      }

      onUpdateUser({ ...user, name, photoUrl: photoPreview });
      setMessage({ text: 'Profil berhasil diperbarui dan disinkronkan!', type: 'success' });
    } catch (err: any) {
      setMessage({ text: 'Gagal sinkronisasi: ' + err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX = 400;
        let w = img.width;
        let h = img.height;
        if (w > h) { if (w > MAX) { h *= MAX / w; w = MAX; } }
        else { if (h > MAX) { w *= MAX / h; h = MAX; } }
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d')?.drawImage(img, 0, 0, w, h);
        setPhotoPreview(canvas.toDataURL('image/jpeg', 0.7));
        setMessage({ text: 'Foto siap. Simpan untuk menerapkan.', type: 'success' });
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const startHold = () => {
    if (confirmText.trim().toUpperCase() !== 'HAPUS SEMUA DATA' || isDeleting) return;
    const start = Date.now();
    holdIntervalRef.current = setInterval(() => {
      const p = Math.min(((Date.now() - start) / 3000) * 100, 100);
      setHoldProgress(p);
      if (p >= 100) {
        clearInterval(holdIntervalRef.current);
        executeDeleteAll();
      }
    }, 50);
  };

  const stopHold = () => {
    if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
    setHoldProgress(0);
  };

  const executeDeleteAll = async () => {
    setIsDeleting(true);
    try {
      // 1. Common collections
      const colls = ['residents', 'families', 'messages', 'registrations'];
      for (const c of colls) {
        const snap = await getDocs(collection(db, c));
        const batch = writeBatch(db);
        snap.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }

      // 2. Delete resident user accounts
      const userSnap = await getDocs(collection(db, 'users'));
      const userBatch = writeBatch(db);
      let userCount = 0;
      userSnap.docs.forEach(d => {
        if (d.data().role === 'warga') {
          userBatch.delete(d.ref);
          userCount++;
        }
      });
      if (userCount > 0) await userBatch.commit();

      setMessage({ text: 'SELURUH DATA WARGA & AKUN BERHASIL DIHAPUS!', type: 'success' });
      setShowDeleteModal(false);
      setConfirmText('');
    } catch (e: any) {
      alert("Error saat menghapus: " + e.message);
    } finally {
      setIsDeleting(false);
      setHoldProgress(0);
    }
  };


  const [activeSection, setActiveSection] = useState<'identitas' | 'akun' | 'notif' | 'feedback' | 'about'>('identitas');

  // 5. Render
  if (!user) return null;
  if (syncing) return null; // Already removed in previous turn but keeping consistent

  const renderSection = () => {
    switch (activeSection) {
      case 'identitas':
        return (
          <div className="section-content fade-in">
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <div style={{
                  width: 100, height: 100, borderRadius: '50%',
                  background: 'var(--gray-100)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  overflow: 'hidden', border: '4px solid #fff',
                  boxShadow: '0 8px 20px rgba(0,0,0,0.08)'
                }}>
                  {photoPreview || user.photoUrl ? (
                    <img src={photoPreview || user.photoUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <UserIcon size={40} color="var(--gray-300)" />
                  )}
                </div>
                <button
                  className="btn-icon"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    position: 'absolute', bottom: 0, right: 0,
                    background: '#2563eb', color: '#fff',
                    borderRadius: '50%', border: '2px solid #fff',
                    width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                >
                  <Camera size={14} />
                </button>
                <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept="image/*" onChange={handlePhotoUpload} />
              </div>
            </div>

            <form onSubmit={handleUpdateProfile}>
              <div className="form-group" style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#64748b', marginBottom: 8, textTransform: 'uppercase' }}>Nama Lengkap</label>
                <input
                  className="form-input"
                  value={name}
                  onChange={e => setName(e.target.value.toUpperCase())}
                  placeholder="Masukkan nama sesuai KK"
                  required
                  style={{ height: 52, borderRadius: 14, border: '1px solid #e2e8f0', padding: '0 16px', textTransform: 'uppercase', fontSize: 14, fontWeight: 700 }}
                />
              </div>

              {message && (
                <div style={{
                  padding: 14, borderRadius: 12, fontSize: 13, marginBottom: 20,
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: message.type === 'success' ? '#f0fdf4' : '#fef2f2',
                  color: message.type === 'success' ? '#15803d' : '#b91c1c',
                  border: `1px solid ${message.type === 'success' ? '#dcfce7' : '#fee2e2'}`
                }}>
                  {message.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                  <span style={{ fontWeight: 700 }}>{message.text}</span>
                </div>
              )}

              <button
                className="btn-primary"
                type="submit"
                style={{ width: '100%', height: 52, borderRadius: 14, background: '#2563eb', color: '#fff', border: 'none', fontSize: 15, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}
                disabled={loading}
              >
                {loading ? <Loader2 size={20} className="spin" /> : <><Save size={20} /> Simpan Profil</>}
              </button>
            </form>
          </div>
        );
      case 'akun':
        return (
          <div className="section-content fade-in">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: '#f8fafc', padding: 20, borderRadius: 18, border: '1px solid #f1f5f9' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 }}>Nomor Induk Kependudukan (NIK)</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#1e293b' }}>{user.nik || user.id}</div>
              </div>
              <div style={{ background: '#f8fafc', padding: 20, borderRadius: 18, border: '1px solid #f1f5f9' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 }}>Nomor Kartu Keluarga (KK)</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#1e293b' }}>{user.noKK || 'Belum Terdaftar'}</div>
              </div>
              <div style={{ background: '#f8fafc', padding: 20, borderRadius: 18, border: '1px solid #f1f5f9' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 }}>Level Akses</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#2563eb', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ShieldAlert size={14} /> {user.role.toUpperCase()}
                </div>
              </div>
            </div>
          </div>
        );
      case 'notif':
        return (
          <div className="section-content fade-in">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { id: 'n1', label: 'Pengumuman RW', desc: 'Dapatkan berita terbaru dari pengurus RT/RW' },
                { id: 'n2', label: 'Status Iuran', desc: 'Notifikasi pembayaran dan tagihan kas' },
                { id: 'n3', label: 'Pesan Masuk', desc: 'Notifikasi saat ada balasan dari admin' }
              ].map(n => (
                <div key={n.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: '#fff', borderRadius: 18, border: '1px solid #f1f5f9' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#1e293b' }}>{n.label}</div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{n.desc}</div>
                  </div>
                  <div style={{ width: 44, height: 24, background: '#22c55e', borderRadius: 100, padding: 3, cursor: 'pointer' }}>
                    <div style={{ width: 18, height: 18, background: '#fff', borderRadius: '50%', marginLeft: 'auto' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      case 'feedback':
        return (
          <div className="section-content fade-in">
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <AlertCircle size={48} color="#cbd5e1" style={{ margin: '0 auto 16px' }} />
              <h4 style={{ fontSize: 16, fontWeight: 800, color: '#1e293b' }}>Kirim Umpan Balik</h4>
              <p style={{ fontSize: 13, color: '#64748b', marginTop: 8, marginBottom: 24 }}>Bantu kami meningkatkan kualitas layanan Ruang Warga VSJ.</p>
              <textarea
                placeholder="Tulis saran atau keluhan Anda di sini..."
                style={{ width: '100%', minHeight: 120, borderRadius: 18, border: '1px solid #e2e8f0', padding: 16, fontSize: 14, outline: 'none', marginBottom: 16 }}
              />
              <button style={{ width: '100%', height: 48, borderRadius: 14, background: '#1e293b', color: '#fff', border: 'none', fontWeight: 700 }}>Kirim Sekarang</button>
            </div>
          </div>
        );
      case 'about':
        return (
          <div className="section-content fade-in">
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ width: 80, height: 80, background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)', borderRadius: 20, margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                <Settings size={40} />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 900, color: '#1e3a8a' }}>Ruang Warga VSJ</h3>
              <p style={{ fontSize: 13, color: '#64748b', marginTop: 8, lineHeight: 1.6 }}>
                Sistem Informasi & Administrasi Mandiri<br />
                <strong>Vila Samudra Jaya - RW 011</strong>
              </p>

              <div style={{ marginTop: 40, borderTop: '1px solid #f1f5f9', paddingTop: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0' }}>
                  <span style={{ fontSize: 13, color: '#64748b' }}>Versi Aplikasi</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#1e293b' }}>v1.0.0-gold</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0' }}>
                  <span style={{ fontSize: 13, color: '#64748b' }}>Terakhir Diperbarui</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#1e293b' }}>16 Mei 2026</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0' }}>
                  <span style={{ fontSize: 13, color: '#64748b' }}>Developer</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#2563eb' }}>Tim Digital VSJ</span>
                </div>
              </div>
            </div>
          </div>
        );
      default: return null;
    }
  };

  return (
    <div className="profile-page-premium" style={{ background: '#f8fafc', minHeight: '100vh', padding: '24px 20px 100px' }}>
      <header style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 24, fontWeight: 900, color: '#1e3a8a', margin: 0 }}>Pengaturan</h2>
        <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Personalisasi akun & aplikasi Anda</p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100%, 1fr))', gap: 24 }}>
        {/* NAV SECTIONS */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8, marginBottom: 8 }} className="hide-scrollbar">
          {[
            { id: 'identitas', label: 'Identitas', icon: UserIcon },
            { id: 'akun', label: 'Akun', icon: ShieldAlert },
            { id: 'notif', label: 'Notifikasi', icon: AlertCircle },
            { id: 'feedback', label: 'Feedback', icon: Save },
            { id: 'about', label: 'Tentang', icon: Settings }
          ].map(s => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id as any)}
              style={{
                whiteSpace: 'nowrap', padding: '10px 16px', borderRadius: 12, border: 'none',
                background: activeSection === s.id ? '#1e3a8a' : '#fff',
                color: activeSection === s.id ? '#fff' : '#64748b',
                fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8,
                boxShadow: activeSection === s.id ? '0 4px 12px rgba(30, 58, 138, 0.2)' : 'none',
                transition: 'all 0.2s ease'
              }}
            >
              <s.icon size={16} /> {s.label}
            </button>
          ))}
        </div>

        {/* SECTION CARD */}
        <div style={{ background: '#fff', borderRadius: 28, padding: 24, border: '1px solid #f1f5f9', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
          {renderSection()}
        </div>

        {/* DANGER ZONE FOR ADMIN ONLY - MOVING TO BOTTOM AS BUTTON */}
        {['developer', 'rw'].includes(user.role) && activeSection === 'akun' && (
          <button
            onClick={() => setShowDeleteModal(true)}
            style={{ width: '100%', padding: '16px', borderRadius: 18, border: '1px solid #fee2e2', background: '#fef2f2', color: '#ef4444', fontWeight: 800, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}
          >
            <Trash2 size={18} /> Hapus Seluruh Database Warga
          </button>
        )}
      </div>

      {/* DELETE MODAL (Restored logic) */}
      {showDeleteModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(8px)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#fff', width: '100%', maxWidth: 450, borderRadius: 28, padding: 32, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ width: 64, height: 64, background: '#fef2f2', color: '#ef4444', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}><ShieldAlert size={32} /></div>
              <h3 style={{ fontSize: 20, fontWeight: 900, color: '#0f172a' }}>Konfirmasi Hapus Total</h3>
              <p style={{ fontSize: 13, color: '#64748b', marginTop: 8 }}>Ketik frasa di bawah untuk menghapus seluruh data permanen:</p>
              <div style={{ marginTop: 12, padding: 10, background: '#f8fafc', borderRadius: 10, fontWeight: 900, fontSize: 12, letterSpacing: 1 }}>HAPUS SEMUA DATA</div>
            </div>
            <input className="form-input" value={confirmText} onChange={e => setConfirmText(e.target.value)} style={{ width: '100%', textAlign: 'center', textTransform: 'uppercase', height: 48, borderRadius: 14, border: '2px solid #f1f5f9' }} placeholder="..." />
            <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onMouseDown={startHold} onMouseUp={stopHold} onMouseLeave={stopHold}
                disabled={confirmText.toUpperCase() !== 'HAPUS SEMUA DATA' || isDeleting}
                style={{ height: 52, borderRadius: 14, background: '#ef4444', color: '#fff', border: 'none', fontWeight: 800, position: 'relative', overflow: 'hidden' }}
              >
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${holdProgress}%`, background: 'rgba(255,255,255,0.3)' }} />
                <span style={{ position: 'relative' }}>{isDeleting ? 'Menghapus...' : 'Tahan 3 Detik untuk Hapus'}</span>
              </button>
              <button onClick={() => setShowDeleteModal(false)} style={{ height: 52, borderRadius: 14, border: 'none', background: '#f1f5f9', color: '#64748b', fontWeight: 700 }}>Batalkan</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .fade-in { animation: fadeIn 0.3s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}

