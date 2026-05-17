import React, { useState, useEffect, useRef } from 'react';
import { 
  User as UserIcon, Camera, Save, CheckCircle, 
  AlertCircle, Loader2, Trash2, ShieldAlert, 
  Settings, LogOut, Lock, Key, Eye, EyeOff, 
  Bell, Info, ShieldCheck, ChevronLeft 
} from 'lucide-react';
import { doc, setDoc, getDoc, collection, getDocs, writeBatch, addDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { User } from '../types';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

interface ProfilePageProps {
  user: User | null;
  onUpdateUser: (user: User) => void;
}

export default function ProfilePage({ user, onUpdateUser }: ProfilePageProps) {
  const navigate = useNavigate();
  // 1. All States at the Top
  const [name, setName] = useState(user?.name || '');
  const [chatUsername, setChatUsername] = useState(user?.chatUsername || '');
  const [photoPreview, setPhotoPreview] = useState(user?.photoUrl || '');
  const [email, setEmail] = useState(user?.email || '');
  const [emailVerified, setEmailVerified] = useState(user?.emailVerified || false);
  const [verifying, setVerifying] = useState(false);
  const [pin, setPin] = useState(user?.pin || '');
  const [confirmPin, setConfirmPin] = useState(user?.pin || '');
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(true);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [sentEmail, setSentEmail] = useState('');
  const [verificationToken, setVerificationToken] = useState('');

  // States for Image Cropper
  const [rawImage, setRawImage] = useState<string | null>(null);
  const [showCropModal, setShowCropModal] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // States for Change Password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPasswordState, setNewPasswordState] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMessage, setPwMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  
  // Toggle visibility of passwords
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  // Interactive Notification states
  const [notifSettings, setNotifSettings] = useState({
    n1: localStorage.getItem('notif_n1') !== 'false',
    n2: localStorage.getItem('notif_n2') !== 'false',
    n3: localStorage.getItem('notif_n3') !== 'false'
  });

  // States for PIN Setup Modal
  const [showPinSetupModal, setShowPinSetupModal] = useState(false);
  const [setupPassword, setSetupPassword] = useState('');
  const [setupPin, setSetupPin] = useState('');
  const [setupConfirmPin, setSetupConfirmPin] = useState('');
  const [pinSetupError, setPinSetupError] = useState<string | null>(null);
  const [pinSetupLoading, setPinSetupLoading] = useState(false);
  const [showSetupPassword, setShowSetupPassword] = useState(false);

  const toggleNotif = (key: 'n1' | 'n2' | 'n3') => {
    const newValue = !notifSettings[key];
    setNotifSettings(prev => ({ ...prev, [key]: newValue }));
    localStorage.setItem(`notif_${key}`, String(newValue));
  };

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
          if (data.email) setEmail(data.email);
          if (data.emailVerified !== undefined) setEmailVerified(data.emailVerified);
          if (data.pin) {
            setPin(data.pin);
            setConfirmPin(data.pin);
          }
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
        chatUsername,
        email,
        emailVerified,
        biometricEnabled: false,
        biometricCredentialId: null,
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

      onUpdateUser({ 
        ...user, 
        name, 
        photoUrl: photoPreview, 
        chatUsername,
        email,
        emailVerified,
        pin,
        pinSet: !!pin,
        biometricEnabled: false,
        biometricCredentialId: null
      });
      setMessage({ text: 'Profil berhasil diperbarui dan disinkronkan!', type: 'success' });
    } catch (err: any) {
      setMessage({ text: 'Gagal sinkronisasi: ' + err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEmail = async () => {
    if (!email) {
      alert("Harap isi alamat email terlebih dahulu.");
      return;
    }
    setVerifying(true);
    try {
      if (user?.id) {
        // 1. Generate unique verification token
        const tokenVal = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        setVerificationToken(tokenVal);
        
        // 2. Create verification doc in Firestore
        const verificationRef = doc(collection(db, 'email_verifications'));
        await setDoc(verificationRef, {
          userId: user.id,
          email,
          token: tokenVal,
          verified: false,
          createdAt: new Date()
        });

        // 3. Queue verification email
        const verifyLink = `${window.location.origin}/verify-email?token=${tokenVal}&userId=${user.id}`;
        await addDoc(collection(db, 'email_queue'), {
          to: email,
          subject: '[Ruang Warga 011] Verifikasi Alamat Email Anda',
          body: `Halo ${name || user.name},\n\nTerima kasih telah melengkapi alamat email Anda di platform Ruang Warga 011 VSJ.\n\nSesuai standar keamanan kependudukan, mohon verifikasi alamat email Anda dengan mengeklik tautan di bawah ini:\n\n${verifyLink}\n\nTautan ini hanya dapat digunakan satu kali.\n\nSalam Hangat,\nPengurus RW 011 VSJ`,
          createdAt: new Date()
        });

        setSentEmail(email);
        setShowVerificationModal(true);

        // 4. Listen for real-time verification changes
        const unsubscribe = onSnapshot(verificationRef, (docSnap) => {
          if (docSnap.exists() && docSnap.data().verified === true) {
            // Success! Update local states and alert user
            setEmailVerified(true);
            onUpdateUser({
              ...user,
              email,
              emailVerified: true
            });
            setShowVerificationModal(false);
            alert("Email Anda berhasil diverifikasi secara real-time!");
            unsubscribe();
          }
        });
      }
    } catch (err: any) {
      alert("Gagal mengirim email verifikasi: " + err.message);
    } finally {
      setVerifying(false);
    }
  };



  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setRawImage(event.target?.result as string);
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      setShowCropModal(true);
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // Memungkinkan unggah file yang sama kembali
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUpOrLeave = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - offset.x,
        y: e.touches[0].clientY - offset.y
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    setOffset({
      x: e.touches[0].clientX - dragStart.x,
      y: e.touches[0].clientY - dragStart.y
    });
  };

  const handleCropApply = () => {
    if (!rawImage) return;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 300;
      canvas.height = 300;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 300, 300);
        
        ctx.save();
        ctx.translate(150 + offset.x, 150 + offset.y);
        ctx.scale(zoom, zoom);
        
        let w = img.width;
        let h = img.height;
        const ratio = w / h;
        let drawW = 300;
        let drawH = 300;
        if (ratio > 1) {
          drawH = 300 / ratio;
        } else {
          drawW = 300 * ratio;
        }
        
        ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
        ctx.restore();
        
        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = 200;
        cropCanvas.height = 200;
        const cropCtx = cropCanvas.getContext('2d');
        if (cropCtx) {
          cropCtx.drawImage(canvas, 50, 50, 200, 200, 0, 0, 200, 200);
          setPhotoPreview(cropCanvas.toDataURL('image/jpeg', 0.85));
          setMessage({ text: 'Foto berhasil dipotong secara manual. Tekan Simpan untuk menerapkan.', type: 'success' });
          setShowCropModal(false);
        }
      }
    };
    img.src = rawImage;
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    if (newPasswordState.length < 8) {
      setPwMessage({ text: 'Password baru minimal harus 8 karakter!', type: 'error' });
      return;
    }
    
    if (newPasswordState !== confirmNewPassword) {
      setPwMessage({ text: 'Konfirmasi password baru tidak cocok!', type: 'error' });
      return;
    }
    
    setPwLoading(true);
    setPwMessage(null);
    
    try {
      const userRef = doc(db, 'users', user.id);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
        throw new Error('Data user tidak ditemukan di database.');
      }
      
      const userData = userSnap.data();
      const actualPassword = userData.password || userData.pendingPassword;
      
      if (currentPassword !== actualPassword) {
        setPwMessage({ text: 'Password saat ini salah!', type: 'error' });
        setPwLoading(false);
        return;
      }
      
      // Update password
      await setDoc(userRef, {
        password: newPasswordState,
        updatedAt: new Date()
      }, { merge: true });
      
      setPwMessage({ text: 'Password berhasil diperbarui!', type: 'success' });
      setCurrentPassword('');
      setNewPasswordState('');
      setConfirmNewPassword('');
    } catch (err: any) {
      setPwMessage({ text: 'Gagal memperbarui password: ' + err.message, type: 'error' });
    } finally {
      setPwLoading(false);
    }
  };

  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setPinSetupError(null);

    // 1. PIN Length Check
    if (setupPin.length !== 6) {
      setPinSetupError("PIN baru harus terdiri dari 6 digit angka!");
      return;
    }

    // 2. PIN Match Check
    if (setupPin !== setupConfirmPin) {
      setPinSetupError("Konfirmasi PIN tidak cocok!");
      return;
    }

    setPinSetupLoading(true);

    try {
      // 3. Verify Account Password
      const userRef = doc(db, 'users', user.id);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        throw new Error("Data user tidak ditemukan!");
      }
      const userData = userSnap.data();
      const actualPassword = userData.password || userData.pendingPassword;

      if (setupPassword !== actualPassword) {
        setPinSetupError("Password yang Anda masukkan salah!");
        setPinSetupLoading(false);
        return;
      }

      // 4. Update PIN in Firestore
      await updateDoc(userRef, {
        pin: setupPin,
        pinSet: true,
        updatedAt: new Date()
      });

      // 5. Update local user states and sync
      const updatedUser = { ...user, pin: setupPin, pinSet: true };
      onUpdateUser(updatedUser);
      setPin(setupPin);
      setConfirmPin(setupPin);

      // Reset states & close
      setShowPinSetupModal(false);
      setSetupPassword('');
      setSetupPin('');
      setSetupConfirmPin('');
      alert("🎉 PIN Keamanan Anda berhasil dikonfigurasi!");
    } catch (err: any) {
      console.error("Gagal menyimpan PIN:", err);
      setPinSetupError("Terjadi kesalahan sistem, silakan coba lagi.");
    } finally {
      setPinSetupLoading(false);
    }
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
        if (d.data().accountType === 'resident') {
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
                  disabled={user.accountType === 'resident'}
                  style={{ 
                    height: 52, 
                    borderRadius: 14, 
                    border: '1px solid #e2e8f0', 
                    padding: '0 16px', 
                    textTransform: 'uppercase', 
                    fontSize: 14, 
                    fontWeight: 700,
                    background: user.accountType === 'resident' ? '#f8fafc' : '#fff',
                    color: user.accountType === 'resident' ? '#64748b' : '#0f172a',
                    cursor: user.accountType === 'resident' ? 'not-allowed' : 'text'
                  }}
                />
                {user.accountType === 'resident' && (
                  <p style={{ marginTop: 8, fontSize: 11, color: '#94a3b8', lineHeight: 1.5, textAlign: 'left' }}>
                    * Nama warga tidak dapat diubah secara mandiri demi validitas data kependudukan. Hubungi admin atau pengurus RT Anda jika terdapat kesalahan penulisan nama.
                  </p>
                )}
              </div>

              <div className="form-group" style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#64748b', marginBottom: 8, textTransform: 'uppercase' }}>Username Chat (Maks 10 Karakter)</label>
                <input
                  className="form-input"
                  value={chatUsername}
                  onChange={e => setChatUsername(e.target.value.slice(0, 10))}
                  placeholder="Buat username untuk forum chat..."
                  maxLength={10}
                  style={{ 
                    height: 52, 
                    borderRadius: 14, 
                    border: '1px solid #e2e8f0', 
                    padding: '0 16px', 
                    fontSize: 14, 
                    fontWeight: 700 
                  }}
                />
                <p style={{ marginTop: 8, fontSize: 11, color: '#94a3b8', lineHeight: 1.5, textAlign: 'left' }}>
                  * Username ini akan ditampilkan pada forum obrolan warga (maksimal 10 karakter).
                </p>
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
          <div className="section-content fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            <div>
              <h4 style={{ fontSize: 15, fontWeight: 800, color: '#1e3a8a', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <ShieldCheck size={18} color="#2563eb" /> Detail Akun & Level Akses
              </h4>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
                {user.accountType === 'admin' ? (
                  <>
                    <div style={{ background: '#f8fafc', padding: '16px 20px', borderRadius: 16, border: '1px solid #f1f5f9', gridColumn: '1 / -1' }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 }}>Username Akun</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: '#1e293b', fontFamily: 'monospace' }}>{user.username || user.id}</div>
                    </div>
                    <div style={{ background: '#f8fafc', padding: '16px 20px', borderRadius: 16, border: '1px solid #f1f5f9' }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 }}>Jabatan Resmi</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#2563eb' }}>
                        {user.adminRole === 'developer' ? '👑 Developer Utama' : user.adminRole === 'rw' ? '🛡 Ketua RW 011' : `🛡 Ketua RT ${user.rt_id || '001'}`}
                      </div>
                    </div>
                    <div style={{ background: '#f8fafc', padding: '16px 20px', borderRadius: 16, border: '1px solid #f1f5f9' }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 }}>Wilayah Tugas</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#475569' }}>
                        {user.adminRole === 'developer' ? 'Sistem Global VSJ' : user.adminRole === 'rw' ? 'Seluruh Lingkungan RW 011' : `Rukun Tetangga RT ${user.rt_id}`}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ background: '#f8fafc', padding: '16px 20px', borderRadius: 16, border: '1px solid #f1f5f9' }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 }}>Nomor Induk Kependudukan (NIK)</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#1e293b', fontFamily: 'monospace' }}>{user.nik || user.id}</div>
                    </div>
                    <div style={{ background: '#f8fafc', padding: '16px 20px', borderRadius: 16, border: '1px solid #f1f5f9' }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 }}>Nomor Kartu Keluarga (KK)</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#1e293b', fontFamily: 'monospace' }}>{user.noKK || 'Belum Terdaftar'}</div>
                    </div>
                    <div style={{ background: '#f8fafc', padding: '16px 20px', borderRadius: 16, border: '1px solid #f1f5f9', gridColumn: '1 / -1' }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 }}>Status Hubungan Keluarga</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#059669', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <UserIcon size={14} /> {user.hubunganKeluarga || 'Kepala Keluarga / Mandiri'}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {user.accountType === 'resident' && (
              <>
                <hr style={{ border: 'none', borderTop: '1px solid #f1f5f9', margin: 0 }} />
                
                <div>
                  <h4 style={{ fontSize: 15, fontWeight: 800, color: '#1e3a8a', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Lock size={18} color="#2563eb" /> Pengaturan Keamanan Akun
                  </h4>
                  
                  <form onSubmit={handleUpdateProfile} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {/* Alamat Email */}
                    <div className="form-group">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <label style={{ fontSize: 12, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', margin: 0 }}>Alamat Email</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: 8,
                            fontSize: 10,
                            fontWeight: 800,
                            background: emailVerified ? '#dcfce7' : '#fee2e2',
                            color: emailVerified ? '#15803d' : '#b91c1c',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4
                          }}>
                            {emailVerified ? (
                              <>
                                <CheckCircle size={10} /> Terverifikasi
                              </>
                            ) : (
                              <>
                                <AlertCircle size={10} /> Belum Terverifikasi
                              </>
                            )}
                          </span>
                          
                          {emailVerified && (
                            <button
                              type="button"
                              onClick={() => {
                                setEmailVerified(false);
                              }}
                              style={{
                                border: 'none',
                                background: 'none',
                                color: '#2563eb',
                                fontSize: 11,
                                fontWeight: 800,
                                cursor: 'pointer',
                                textDecoration: 'underline',
                                padding: 0
                              }}
                            >
                              Ubah Email
                            </button>
                          )}
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', gap: 10 }}>
                        <input
                          type="email"
                          className="form-input"
                          value={email}
                          onChange={e => {
                            setEmail(e.target.value);
                            // If they change email, reset verified status until verified
                            if (e.target.value !== user?.email) {
                              setEmailVerified(false);
                            } else {
                              setEmailVerified(user?.emailVerified || false);
                            }
                          }}
                          placeholder="nama@email.com"
                          required
                          disabled={emailVerified}
                          style={{ 
                            height: 52, 
                            borderRadius: 14, 
                            border: '1px solid #e2e8f0', 
                            padding: '0 16px', 
                            fontSize: 14, 
                            fontWeight: 700,
                            flex: 1,
                            background: emailVerified ? '#f8fafc' : '#ffffff'
                          }}
                        />
                        {!emailVerified && email && (
                          <button
                            type="button"
                            onClick={handleVerifyEmail}
                            disabled={verifying}
                            style={{
                              height: 52,
                              borderRadius: 14,
                              border: 'none',
                              background: '#2563eb',
                              color: '#ffffff',
                              fontSize: 12,
                              fontWeight: 800,
                              padding: '0 16px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 6,
                              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)',
                            }}
                          >
                            {verifying ? (
                              <>
                                <Loader2 size={14} className="animate-spin" /> Memproses...
                              </>
                            ) : (
                              "Verifikasi"
                            )}
                          </button>
                        )}
                      </div>
                      <p style={{ marginTop: 8, fontSize: 11, color: '#94a3b8', lineHeight: 1.5, textAlign: 'left' }}>
                        * Digunakan untuk verifikasi akun, pemulihan password, dan reset PIN keamanan transaksi Anda.
                      </p>
                    </div>

                    {/* PIN & Biometrics warning if not verified */}
                    {!emailVerified && (
                      <div style={{
                        padding: '16px 20px',
                        borderRadius: 18,
                        background: '#fffbeb',
                        border: '1px solid #fde68a',
                        color: '#b45309',
                        fontSize: 12,
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 10,
                        textAlign: 'left'
                      }}>
                        <ShieldAlert size={18} style={{ flexShrink: 0, marginTop: 2, color: '#d97706' }} />
                        <div>
                          <div style={{ fontWeight: 800, color: '#92400e' }}>Verifikasi Email Diperlukan</div>
                          <div style={{ fontSize: 11, color: '#b45309', marginTop: 4, lineHeight: 1.4 }}>
                            Sesuai standar keamanan, Anda wajib memverifikasi alamat email terlebih dahulu sebelum dapat membuat PIN transaksi.
                          </div>
                        </div>
                      </div>
                    )}

                    {/* PIN Keamanan */}
                    <div style={{ 
                      opacity: emailVerified ? 1 : 0.5, 
                      pointerEvents: emailVerified ? 'auto' : 'none',
                      transition: 'all 0.2s',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      gap: 12
                    }}>
                      <button
                        type="button"
                        onClick={() => {
                          setSetupPassword('');
                          setSetupPin('');
                          setSetupConfirmPin('');
                          setPinSetupError(null);
                          setShowPinSetupModal(true);
                        }}
                        style={{
                          height: '46px',
                          borderRadius: '12px',
                          background: user?.pin ? '#f8fafc' : '#2563eb',
                          color: user?.pin ? '#334155' : '#ffffff',
                          border: user?.pin ? '1px solid #cbd5e1' : 'none',
                          fontWeight: 800,
                          fontSize: '13px',
                          cursor: 'pointer',
                          padding: '0 24px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          boxShadow: user?.pin ? 'none' : '0 4px 12px rgba(37, 99, 235, 0.2)',
                          transition: 'transform 0.15s ease'
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.transform = 'translateY(-1px)';
                          if (user?.pin) e.currentTarget.style.background = '#f1f5f9';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.transform = 'translateY(0)';
                          if (user?.pin) e.currentTarget.style.background = '#f8fafc';
                        }}
                      >
                        {user?.pin ? (
                          <>
                            <Lock size={15} color="#475569" /> Ubah PIN Transaksi
                          </>
                        ) : (
                          <>
                            <Key size={15} color="#ffffff" /> Setup PIN Transaksi
                          </>
                        )}
                      </button>

                      <p style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.5, textAlign: 'left', margin: 0 }}>
                        * PIN digunakan untuk memverifikasi transaksi kas, pengajuan surat, atau aktivitas penting warga.
                      </p>
                    </div>

                    {message && activeSection === 'akun' && (
                      <div style={{
                        padding: 14, borderRadius: 12, fontSize: 13,
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
                      style={{ width: '100%', height: 50, borderRadius: 14, background: '#2563eb', color: '#fff', border: 'none', fontSize: 14, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}
                      disabled={loading}
                    >
                      {loading ? <Loader2 size={18} className="spin" /> : <><Save size={18} /> Simpan Pengaturan Keamanan</>}
                    </button>
                  </form>
                </div>
              </>
            )}

            <hr style={{ border: 'none', borderTop: '1px solid #f1f5f9', margin: 0 }} />

            {/* SECURITY: CHANGE PASSWORD FORM */}
            <div>
              <h4 style={{ fontSize: 15, fontWeight: 800, color: '#1e3a8a', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Key size={18} color="#d97706" /> Keamanan & Ganti Password
              </h4>

              <form onSubmit={handleUpdatePassword} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Current Password */}
                <div className="form-group">
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#64748b', marginBottom: 6, textTransform: 'uppercase' }}>Password Saat Ini</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showCurrentPw ? 'text' : 'password'}
                      className="form-input"
                      value={currentPassword}
                      onChange={e => setCurrentPassword(e.target.value)}
                      placeholder="Masukkan password saat ini"
                      required
                      style={{ height: 48, borderRadius: 12, border: '1px solid #e2e8f0', padding: '0 44px 0 16px', fontSize: 14, width: '100%' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPw(!showCurrentPw)}
                      style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      {showCurrentPw ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {/* New Password */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div className="form-group">
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#64748b', marginBottom: 6, textTransform: 'uppercase' }}>Password Baru</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showNewPw ? 'text' : 'password'}
                        className="form-input"
                        value={newPasswordState}
                        onChange={e => setNewPasswordState(e.target.value)}
                        placeholder="Minimal 8 karakter"
                        required
                        style={{ height: 48, borderRadius: 12, border: '1px solid #e2e8f0', padding: '0 44px 0 16px', fontSize: 14, width: '100%' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPw(!showNewPw)}
                        style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        {showNewPw ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  <div className="form-group">
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#64748b', marginBottom: 6, textTransform: 'uppercase' }}>Konfirmasi Password</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showConfirmPw ? 'text' : 'password'}
                        className="form-input"
                        value={confirmNewPassword}
                        onChange={e => setConfirmNewPassword(e.target.value)}
                        placeholder="Ulangi password baru"
                        required
                        style={{ height: 48, borderRadius: 12, border: '1px solid #e2e8f0', padding: '0 44px 0 16px', fontSize: 14, width: '100%' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPw(!showConfirmPw)}
                        style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        {showConfirmPw ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                </div>

                {pwMessage && (
                  <div style={{
                    padding: '12px 16px', borderRadius: 12, fontSize: 13,
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: pwMessage.type === 'success' ? '#f0fdf4' : '#fef2f2',
                    color: pwMessage.type === 'success' ? '#16a34a' : '#dc2626',
                    border: `1px solid ${pwMessage.type === 'success' ? '#bbf7d0' : '#fecaca'}`
                  }}>
                    {pwMessage.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                    <span style={{ fontWeight: 700 }}>{pwMessage.text}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={pwLoading || !currentPassword || !newPasswordState || !confirmNewPassword}
                  style={{
                    height: 48, borderRadius: 12, background: 'linear-gradient(135deg, #d97706, #b45309)',
                    color: '#fff', border: 'none', fontSize: 14, fontWeight: 800, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    boxShadow: '0 4px 12px rgba(217, 119, 6, 0.15)', transition: 'all 0.2s',
                    opacity: (pwLoading || !currentPassword || !newPasswordState || !confirmNewPassword) ? 0.6 : 1
                  }}
                >
                  {pwLoading ? <Loader2 size={18} className="spin" /> : <><Lock size={16} /> Perbarui Password Keamanan</>}
                </button>
              </form>
            </div>
          </div>
        );
      case 'notif':
        return (
          <div className="section-content fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <Bell size={20} color="#2563eb" />
              <div>
                <h4 style={{ fontSize: 15, fontWeight: 800, color: '#1e3a8a', margin: 0 }}>Pengaturan Pemberitahuan</h4>
                <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>Kelola jenis notifikasi yang ingin Anda terima di perangkat</p>
              </div>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { id: 'n1', label: 'Pengumuman Resmi RW', desc: 'Informasi darurat, berita lingkungan, dan surat edaran dari RW 011' },
                { id: 'n2', label: 'Notifikasi Tagihan & Kas', desc: 'Pengingat pembayaran iuran wajib dan laporan pengeluaran kas berkala' },
                { id: 'n3', label: 'Pesan & Obrolan Masuk', desc: 'Notifikasi chat langsung, pengaduan warga, dan konfirmasi surat menyurat' }
              ].map(n => {
                const isActive = notifSettings[n.id as 'n1' | 'n2' | 'n3'];
                return (
                  <div 
                    key={n.id} 
                    style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center', 
                      padding: '16px 20px', 
                      background: '#fff', 
                      borderRadius: 18, 
                      border: '1px solid #f1f5f9',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.01)',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ flex: 1, paddingRight: 16 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#1e293b' }}>{n.label}</div>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 3, lineHeight: 1.4 }}>{n.desc}</div>
                    </div>
                    <div 
                      onClick={() => toggleNotif(n.id as 'n1' | 'n2' | 'n3')}
                      style={{ 
                        width: 46, 
                        height: 26, 
                        background: isActive ? '#22c55e' : '#cbd5e1', 
                        borderRadius: 100, 
                        padding: 3, 
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        transition: 'background-color 0.2s ease'
                      }}
                    >
                      <div 
                        style={{ 
                          width: 20, 
                          height: 20, 
                          background: '#fff', 
                          borderRadius: '50%', 
                          marginLeft: isActive ? 'auto' : '0',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
                          transition: 'margin-left 0.2s ease'
                        }} 
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      case 'feedback':
        return (
          <div className="section-content fade-in">
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <AlertCircle size={48} color="#cbd5e1" style={{ margin: '0 auto 16px' }} />
              <h4 style={{ fontSize: 16, fontWeight: 800, color: '#1e293b' }}>Kirim Umpan Balik</h4>
              <p style={{ color: '#64748b', fontSize: 13, marginBottom: 24 }}>Level Akses: {user?.adminRole?.toUpperCase() || 'WARGA'}</p>
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
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className="profile-page-premium" 
      style={{ background: '#f8fafc', minHeight: '100vh', padding: '24px 20px 100px' }}
    >
      <header style={{ marginBottom: 32, display: 'flex', alignItems: 'center', gap: 16 }}>
        {user?.accountType === 'resident' && (
          <button 
            onClick={() => navigate('/warga/profile')}
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              border: '1px solid #e2e8f0',
              background: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#1e3a8a',
              boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
              flexShrink: 0
            }}
          >
            <ChevronLeft size={22} />
          </button>
        )}
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 900, color: '#1e3a8a', margin: 0 }}>Pengaturan</h2>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Personalisasi akun & aplikasi Anda</p>
        </div>
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
        {user.accountType === 'admin' && ['developer', 'rw'].includes(user.adminRole || '') && activeSection === 'akun' && (
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

      {/* CROP MODAL */}
      {showCropModal && rawImage && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(8px)', zIndex: 6000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#fff', width: '100%', maxWidth: 400, borderRadius: 28, padding: 24, textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <h3 style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', marginBottom: 6 }}>Potong Foto Profil</h3>
            <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20 }}>Geser dan perbesar gambar sesuai keinginan Anda</p>
            
            {/* Viewport Wrapper */}
            <div 
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUpOrLeave}
              onMouseLeave={handleMouseUpOrLeave}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleMouseUpOrLeave}
              style={{
                width: 280,
                height: 280,
                background: '#f1f5f9',
                margin: '0 auto 20px',
                position: 'relative',
                overflow: 'hidden',
                borderRadius: 20,
                cursor: isDragging ? 'grabbing' : 'grab',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {/* Image element */}
              <img 
                src={rawImage} 
                alt="Raw" 
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                  userSelect: 'none',
                  pointerEvents: 'none'
                }}
              />
              
              {/* Circular Overlay Mask */}
              <div style={{
                position: 'absolute',
                inset: 0,
                border: '40px solid rgba(15, 23, 42, 0.65)',
                pointerEvents: 'none',
                boxSizing: 'border-box'
              }} />
              <div style={{
                position: 'absolute',
                top: 40,
                left: 40,
                width: 200,
                height: 200,
                borderRadius: '50%',
                border: '2px dashed #ffffff',
                pointerEvents: 'none',
                boxSizing: 'border-box'
              }} />
            </div>
            
            {/* Zoom Slider */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
                <span>Perbesar</span>
                <span>{Math.round(zoom * 100)}%</span>
              </div>
              <input 
                type="range" 
                min="1" 
                max="3" 
                step="0.05"
                value={zoom} 
                onChange={e => setZoom(parseFloat(e.target.value))}
                style={{ width: '100%', height: 6, background: '#e2e8f0', borderRadius: 3, outline: 'none' }}
              />
            </div>
            
            {/* Buttons */}
            <div style={{ display: 'flex', gap: 12 }}>
              <button 
                type="button"
                style={{ flex: 1, height: 48, borderRadius: 14, border: 'none', background: '#f1f5f9', color: '#64748b', fontWeight: 700, cursor: 'pointer' }}
                onClick={() => setShowCropModal(false)}
              >
                Batal
              </button>
              <button 
                type="button"
                style={{ flex: 1, height: 48, borderRadius: 14, border: 'none', background: '#2563eb', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
                onClick={handleCropApply}
              >
                Potong & Terapkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EMAIL VERIFICATION MODAL */}
      {showVerificationModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(8px)', zIndex: 6000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#fff', width: '100%', maxWidth: 460, borderRadius: 28, padding: '40px 32px', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', border: '1px solid #e2e8f0' }}>
            <div style={{ width: '72px', height: '72px', background: '#eff6ff', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', color: '#2563eb' }}>
              <Loader2 className="animate-spin" size={32} />
            </div>
            
            <h3 style={{ fontSize: 20, fontWeight: 900, color: '#0f172a', marginBottom: 12 }}>Tautan Verifikasi Dikirim!</h3>
            <p style={{ color: '#475569', fontSize: 13, lineHeight: 1.6, marginBottom: 24 }}>
              Kami telah mengirimkan tautan verifikasi ke email: <strong style={{ color: '#1e293b' }}>{sentEmail}</strong>.<br />
              Silakan periksa kotak masuk (atau spam) email Anda dan klik tautan tersebut untuk menyelesaikan verifikasi.
            </p>
            
            <div style={{ background: '#f8fafc', padding: 16, borderRadius: 16, border: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28, textAlign: 'left' }}>
              <Info size={20} style={{ color: '#3b82f6', flexShrink: 0 }} />
              <p style={{ fontSize: 11, color: '#64748b', margin: 0, lineHeight: 1.4 }}>
                Halaman ini mendeteksi status verifikasi Anda secara real-time. Modal ini akan tertutup otomatis begitu Anda mengeklik tautan tersebut.
              </p>
            </div>

            {(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && (
              <div style={{ marginTop: 0, marginBottom: 28, padding: 16, background: '#eff6ff', borderRadius: 16, border: '1px solid #bfdbfe', textAlign: 'left' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#1e40af', textTransform: 'uppercase', marginBottom: 6 }}>Mode Pengembang (Uji Coba Lokal)</div>
                <p style={{ fontSize: 11, color: '#1e40af', margin: '0 0 12px 0', lineHeight: 1.4 }}>
                  Karena tidak ada SMTP server di localhost Anda, klik tombol di bawah ini untuk mensimulasikan klik tautan dari kotak masuk email:
                </p>
                <a 
                  href={`${window.location.origin}/verify-email?token=${verificationToken}&userId=${user?.id}`}
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '100%',
                    height: '42px',
                    background: '#2563eb',
                    color: '#ffffff',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: 800,
                    textDecoration: 'none',
                    textAlign: 'center',
                    boxShadow: '0 4px 10px rgba(37,99,235,0.2)'
                  }}
                >
                  Buka Tautan Verifikasi Langsung 🚀
                </a>
              </div>
            )}
            
            <div style={{ display: 'flex', gap: 12 }}>
              <button 
                type="button"
                style={{ flex: 1, height: 48, borderRadius: 14, border: 'none', background: '#f1f5f9', color: '#64748b', fontWeight: 700, cursor: 'pointer' }}
                onClick={() => setShowVerificationModal(false)}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
      {/* PIN SETUP / CHANGE MODAL OVERLAY */}
      {showPinSetupModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.55)',
          backdropFilter: 'blur(10px)',
          zIndex: 7000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            style={{
              background: '#ffffff',
              width: '100%',
              maxWidth: '420px',
              borderRadius: '24px',
              padding: '32px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
              color: '#0f172a',
              fontFamily: 'system-ui, -apple-system, sans-serif'
            }}
          >
            <div style={{
              width: 52,
              height: 52,
              borderRadius: '16px',
              background: '#eff6ff',
              color: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px'
            }}>
              <Key size={24} style={{ color: '#2563eb' }} />
            </div>

            <h3 style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a', textAlign: 'center', margin: '0 0 8px' }}>
              {user?.pin ? 'Ubah PIN Transaksi' : 'Setup PIN Transaksi'}
            </h3>
            <p style={{ fontSize: '12px', color: '#64748b', textAlign: 'center', lineHeight: 1.5, margin: '0 0 24px' }}>
              Masukkan password akun Anda untuk melakukan perubahan atau pengaturan PIN keamanan transaksi.
            </p>

            <form onSubmit={handleSavePin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Account Password Field */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'left' }}>
                <label style={{ fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Password Akun Anda</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showSetupPassword ? "text" : "password"}
                    value={setupPassword}
                    onChange={e => setSetupPassword(e.target.value)}
                    placeholder="Masukkan password Anda..."
                    required
                    style={{
                      width: '100%',
                      height: '46px',
                      borderRadius: '12px',
                      border: '1px solid #cbd5e1',
                      padding: '0 40px 0 16px',
                      fontSize: '13px',
                      fontWeight: 600,
                      outline: 'none'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowSetupPassword(!showSetupPassword)}
                    style={{
                      position: 'absolute',
                      right: 12,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                      color: '#64748b',
                      padding: 4
                    }}
                  >
                    {showSetupPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Grid for PIN Baru and Konfirmasi PIN */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'left' }}>
                  <label style={{ fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>PIN Baru (6 Digit)</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={setupPin}
                    onChange={e => {
                      const val = e.target.value.replace(/[^0-9]/g, '');
                      if (val.length <= 6) setSetupPin(val);
                    }}
                    placeholder="Atur PIN..."
                    required
                    style={{
                      width: '100%',
                      height: '46px',
                      borderRadius: '12px',
                      border: '1px solid #cbd5e1',
                      padding: '0 12px',
                      fontSize: '13px',
                      fontWeight: 700,
                      letterSpacing: setupPin ? '4px' : 'normal',
                      textAlign: 'center',
                      outline: 'none'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'left' }}>
                  <label style={{ fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Konfirmasi PIN</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={setupConfirmPin}
                    onChange={e => {
                      const val = e.target.value.replace(/[^0-9]/g, '');
                      if (val.length <= 6) setSetupConfirmPin(val);
                    }}
                    placeholder="Konfirmasi..."
                    required
                    style={{
                      width: '100%',
                      height: '46px',
                      borderRadius: '12px',
                      border: '1px solid #cbd5e1',
                      padding: '0 12px',
                      fontSize: '13px',
                      fontWeight: 700,
                      letterSpacing: setupConfirmPin ? '4px' : 'normal',
                      textAlign: 'center',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>

              {/* Match Feedback & Errors */}
              {pinSetupError && (
                <div style={{
                  background: '#fef2f2',
                  border: '1px solid #fee2e2',
                  color: '#ef4444',
                  fontSize: '11px',
                  fontWeight: 700,
                  borderRadius: '10px',
                  padding: '10px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  textAlign: 'left'
                }}>
                  <AlertCircle size={14} style={{ flexShrink: 0 }} />
                  <span>{pinSetupError}</span>
                </div>
              )}

              {setupPin.length > 0 && setupConfirmPin.length > 0 && (
                <div style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  color: setupPin === setupConfirmPin ? '#10b981' : '#ef4444',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  paddingLeft: 4
                }}>
                  {setupPin === setupConfirmPin ? (
                    <>
                      <CheckCircle size={14} /> PIN Cocok & Siap Disimpan
                    </>
                  ) : (
                    <>
                      <AlertCircle size={14} /> PIN Belum Cocok
                    </>
                  )}
                </div>
              )}

              {/* Buttons */}
              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowPinSetupModal(false);
                    setSetupPassword('');
                    setSetupPin('');
                    setSetupConfirmPin('');
                  }}
                  style={{
                    flex: 1,
                    height: '42px',
                    borderRadius: '12px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#64748b',
                    fontWeight: 800,
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={pinSetupLoading || (setupPin.length > 0 && setupPin !== setupConfirmPin)}
                  style={{
                    flex: 1,
                    height: '42px',
                    borderRadius: '12px',
                    border: 'none',
                    background: '#2563eb',
                    color: '#ffffff',
                    fontWeight: 800,
                    fontSize: '13px',
                    cursor: pinSetupLoading ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6
                  }}
                >
                  {pinSetupLoading ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Menyimpan...
                    </>
                  ) : (
                    "Simpan PIN"
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .fade-in { animation: fadeIn 0.3s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </motion.div>
  );
}

