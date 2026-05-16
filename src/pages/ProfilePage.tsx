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
        if (w > h) { if (w > MAX) { h *= MAX/w; w = MAX; } }
        else { if (h > MAX) { w *= MAX/h; h = MAX; } }
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


  // 5. Render
  if (!user) return null;
  if (syncing) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 12 }}>
      <Loader2 className="spin" size={32} color="var(--blue-600)" />
      <p style={{fontSize: 14, color: 'var(--gray-500)'}}>Menyinkronkan data...</p>
    </div>
  );

  const isDangerAuthorized = ['developer', 'rw'].includes(user.role);

  return (
    <div className="profile-container" style={{ maxWidth: 600, margin: '0 auto', paddingBottom: 60 }}>
      <div className="card shadow-sm">
        <div className="card-header" style={{ background: 'var(--blue-50)', borderBottom: '1px solid var(--blue-100)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Settings size={20} color="var(--blue-600)" />
            <h3 className="card-title" style={{ color: 'var(--blue-800)' }}>Pengaturan Profil</h3>
          </div>
        </div>
        <div className="card-body" style={{ padding: 32 }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <div style={{ 
                width: 120, height: 120, borderRadius: '50%', 
                background: 'var(--gray-100)', display: 'flex', 
                alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden', border: '4px solid #fff',
                boxShadow: '0 8px 16px rgba(0,0,0,0.1)'
              }}>
                {photoPreview || user.photoUrl ? (
                  <img src={photoPreview || user.photoUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <UserIcon size={48} color="var(--gray-300)" />
                )}
              </div>
              <button 
                className="btn-icon" 
                onClick={() => fileInputRef.current?.click()} 
                style={{ 
                  position: 'absolute', bottom: 4, right: 4, 
                  background: 'var(--blue-600)', color: '#fff', 
                  borderRadius: '50%', border: '2px solid #fff',
                  width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
                disabled={loading}
              >
                <Camera size={14} />
              </button>
              <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept="image/*" onChange={handlePhotoUpload} />
            </div>
            <h3 style={{ marginTop: 20, fontSize: 20, fontWeight: 800, color: 'var(--gray-800)' }}>{user.name}</h3>
            <p style={{ color: 'var(--gray-500)', fontSize: 13, marginTop: 4 }}>
              <span style={{ fontWeight: 700, color: 'var(--blue-600)' }}>{user.role.toUpperCase()}</span> · {user.rt_id ? `Wilayah RT ${user.rt_id}` : 'RW 011'}
            </p>
          </div>

          <form onSubmit={handleUpdateProfile} className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
            <div className="form-group">
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 8, display: 'block' }}>Nama Lengkap (KAPITAL)</label>
              <input 
                className="form-input" 
                value={name} 
                onChange={e => setName(e.target.value.toUpperCase())} 
                placeholder="Masukkan nama sesuai KTP"
                required 
                style={{ height: 48, borderRadius: 12, textTransform: 'uppercase' }}
              />
            </div>
            <div className="form-group" style={{ marginTop: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 8, display: 'block' }}>Hak Akses Sistem</label>
              <input 
                className="form-input" 
                value={user.role.toUpperCase()} 
                disabled 
                style={{ background: 'var(--gray-50)', height: 48, borderRadius: 12, color: 'var(--gray-500)' }} 
              />
            </div>

            {message && (
              <div style={{ 
                padding: 14, borderRadius: 12, fontSize: 13, marginTop: 24, 
                display: 'flex', alignItems: 'center', gap: 10, 
                background: message.type === 'success' ? 'var(--green-50)' : 'var(--red-50)', 
                color: message.type === 'success' ? 'var(--green-700)' : 'var(--red-700)',
                border: `1px solid ${message.type === 'success' ? 'var(--green-100)' : 'var(--red-100)'}`
              }}>
                {message.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                <span style={{ fontWeight: 600 }}>{message.text}</span>
              </div>
            )}

            <button 
              className="btn btn-primary btn-block" 
              type="submit" 
              style={{ marginTop: 32, height: 50, borderRadius: 12, fontSize: 15, fontWeight: 700 }} 
              disabled={loading}
            >
              {loading ? <Loader2 size={20} className="spin" /> : <><Save size={20} /> Simpan Perubahan</>}
            </button>
          </form>

          {/* ADDED LOGOUT BUTTON FOR RESIDENTS */}
          {user.role === 'warga' && (
            <div style={{ marginTop: 24, borderTop: '1px solid var(--gray-100)', paddingTop: 24 }}>
              <button 
                className="btn btn-danger btn-block" 
                style={{ 
                  height: 50, borderRadius: 12, fontSize: 15, fontWeight: 700,
                  background: '#fef2f2', color: '#ef4444', border: '1px solid #fee2e2'
                }} 
                onClick={() => {
                  localStorage.removeItem('erw_user');
                  window.location.href = '/warga-login';
                }}
              >
                <LogOut size={20} style={{ marginRight: 8 }} /> Keluar dari Akun
              </button>
            </div>
          )}
        </div>
      </div>

      {user.role !== 'warga' && (
        <div className="card shadow-sm" style={{ marginTop: 24, border: '1px solid var(--blue-200)' }}>
          <div className="card-header" style={{ background: 'var(--blue-50)', borderBottom: '1px solid var(--blue-100)' }}>
            <div style={{ color: 'var(--blue-800)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShieldAlert size={20} /> Akses Panel Admin
            </div>
          </div>
          <div className="card-body" style={{ padding: 24 }}>
            <p style={{ fontSize: 13, color: 'var(--gray-600)', marginBottom: 20, lineHeight: 1.5 }}>
              Anda memiliki hak akses sebagai pengurus. Klik tombol di bawah ini untuk masuk ke <strong>Web Login Panel Admin</strong>. Anda dapat menggunakan kredensial yang sama.
            </p>
            <button 
              className="btn btn-primary" 
              style={{ padding: '12px 24px', borderRadius: 10, fontWeight: 700 }}
              onClick={() => {
                // Clear state and redirect to admin login
                localStorage.removeItem('erw_user');
                window.location.href = '/admin-login';
              }}
            >
              Menuju Login Admin
            </button>
          </div>
        </div>
      )}

      {isDangerAuthorized && (
        <div className="card shadow-sm" style={{ marginTop: 32, border: '1px solid var(--red-100)' }}>
          <div className="card-header" style={{ background: 'var(--red-50)', borderBottom: '1px solid var(--red-100)' }}>
            <div style={{ color: 'var(--red-700)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShieldAlert size={20} /> Zona Bahaya (Admin)
            </div>
          </div>
          <div className="card-body" style={{ padding: 24 }}>
            <p style={{ fontSize: 13, color: 'var(--gray-600)', marginBottom: 20, lineHeight: 1.5 }}>
              Fitur ini akan menghapus <strong>seluruh database warga</strong> termasuk kartu keluarga, riwayat pengaduan, akun warga, dan registrasi secara permanen.
            </p>
            <button 
              className="btn btn-danger" 
              style={{ padding: '12px 24px', borderRadius: 10, fontWeight: 700 }}
              onClick={() => setShowDeleteModal(true)}
            >
              <Trash2 size={18} /> Hapus Semua Data
            </button>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div style={{ 
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', 
          zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 
        }}>
          <div className="card fade-in shadow-xl" style={{ maxWidth: 480, width: '100%', padding: 40, borderRadius: 24 }}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ width: 64, height: 64, background: 'var(--red-50)', color: 'var(--red-600)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <ShieldAlert size={32} />
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--gray-800)' }}>Konfirmasi Hapus Total</h2>
              <p style={{ fontSize: 14, color: 'var(--gray-500)', marginTop: 8 }}>
                Ketik kalimat konfirmasi di bawah ini untuk mengaktifkan tombol hapus:
              </p>
              <div style={{ marginTop: 16, padding: '12px', background: 'var(--gray-100)', borderRadius: 12, fontSize: 13, fontWeight: 800, color: 'var(--gray-700)', letterSpacing: 1 }}>
                HAPUS SEMUA DATA
              </div>
            </div>
            
            <input 
              className="form-input" 
              value={confirmText} 
              onChange={e => setConfirmText(e.target.value)} 
              style={{ 
                width: '100%',
                textAlign: 'center', 
                textTransform: 'uppercase', 
                height: 50, 
                fontSize: 14, 
                fontWeight: 700, 
                letterSpacing: 1,
                border: '2px solid var(--gray-200)',
                borderRadius: 12
              }} 
              placeholder="Ketik frasa di atas..." 
            />
            
            <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button 
                className="btn btn-danger btn-block"
                style={{ 
                  position: 'relative', overflow: 'hidden', height: 56, borderRadius: 14, fontSize: 15, fontWeight: 800,
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  transform: holdProgress > 0 ? `scale(${1 + (holdProgress/800)})` : 'scale(1)',
                  boxShadow: holdProgress > 0 ? '0 10px 20px rgba(239, 68, 68, 0.3)' : 'none',
                  cursor: confirmText.trim().toUpperCase() !== 'HAPUS SEMUA DATA' ? 'not-allowed' : 'pointer',
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                  touchAction: 'none'
                }}
                onMouseDown={startHold} 
                onMouseUp={stopHold} 
                onMouseLeave={stopHold}
                onTouchStart={(e) => { e.preventDefault(); startHold(); }} 
                onTouchEnd={stopHold}
                disabled={confirmText.trim().toUpperCase() !== 'HAPUS SEMUA DATA' || isDeleting}
              >
                {/* Visual Progress Bar Overlay */}
                <div style={{ 
                  position: 'absolute', left: 0, top: 0, bottom: 0, 
                  width: `${holdProgress}%`, background: 'rgba(255,255,255,0.4)',
                  transition: 'width 0.05s linear' 
                }} />
                
                <span style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center' }}>
                  {isDeleting ? <Loader2 size={20} className="spin" /> : (
                    holdProgress > 0 ? (
                      <span style={{ letterSpacing: 2 }}>TAHAN... {Math.ceil((100 - holdProgress)/33.3)}s</span>
                    ) : <><Trash2 size={20} /> Tekan & Tahan 3 Detik</>
                  )}
                </span>
              </button>
              
              <button 
                className="btn btn-secondary btn-block" 
                style={{ height: 50, borderRadius: 14, fontWeight: 700 }}
                onClick={() => { setShowDeleteModal(false); setConfirmText(''); setHoldProgress(0); }} 
                disabled={isDeleting}
              >
                Batalkan Tindakan
              </button>
              
              {confirmText.trim().toUpperCase() === 'HAPUS SEMUA DATA' && holdProgress === 0 && (
                <div className="fade-in" style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', marginTop: 8 }}>
                  <AlertCircle size={14} color="var(--red-600)" />
                  <span style={{ fontSize: 11, color: 'var(--red-600)', fontWeight: 700 }}>Tahan tombol merah untuk menghapus permanen</span>
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  );
}

