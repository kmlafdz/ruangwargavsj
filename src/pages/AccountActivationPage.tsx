import React, { useState, useRef, useEffect } from 'react';
import { 
  ShieldCheck, Upload, Camera, FileText, 
  Users, Lock, Fingerprint, CheckCircle2, 
  AlertCircle, ChevronRight, ChevronLeft, 
  Loader2, Scan, Smartphone, User, 
  MapPin, Calendar, Info, Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { User as UserType } from '../types';
import { extractKTPData } from '../services/ocrService';
import logo from '../assets/login/logo.png';
import { db } from '../firebase/config';
import { doc, updateDoc, collection, query, where, getDocs, setDoc, Timestamp } from 'firebase/firestore';
import { registerBiometric, isBiometricAvailable } from '../services/biometricService';

interface ActivationPageProps {
  user: UserType;
  onComplete: (updatedUser: UserType) => void;
}

type Step = 'welcome' | 'upload' | 'ocr' | 'data_review' | 'family' | 'password' | 'biometric' | 'final';

export default function AccountActivationPage({ user, onComplete }: ActivationPageProps) {
  const [currentStep, setCurrentStep] = useState<Step>('welcome');
  const [ktpPhoto, setKtpPhoto] = useState<File | null>(null);
  const [kkPhoto, setKkPhoto] = useState<File | null>(null);
  const [ktpPreview, setKtpPreview] = useState<string>('');
  const [kkPreview, setKkPreview] = useState<string>('');
  const [ocrProgress, setOcrProgress] = useState(0);
  const [extractedData, setExtractedData] = useState<any>(null);
  const [familyMatch, setFamilyMatch] = useState<{ exists: boolean; headName?: string; kkNumber?: string } | null>(null);
  const [relationship, setRelationship] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricCredentialId, setBiometricCredentialId] = useState<string | null>(null);

  useEffect(() => {
    isBiometricAvailable().then(setBiometricAvailable);
  }, []);
  
  const navigate = useNavigate();

  // Animation variants
  const stepVariants = {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 }
  };

  const handleNext = () => {
    switch (currentStep) {
      case 'welcome': setCurrentStep('upload'); break;
      case 'upload': 
        if (!ktpPhoto || !kkPhoto) {
          setError('Mohon upload foto KTP dan KK Anda.');
          return;
        }
        setError('');
        setCurrentStep('ocr'); 
        processOCR();
        break;
      case 'data_review': setCurrentStep('family'); break;
      case 'family': setCurrentStep('password'); break;
      case 'password': 
        if (newPassword.length < 8) {
          setError('Password minimal 8 karakter.');
          return;
        }
        if (newPassword !== confirmPassword) {
          setError('Konfirmasi password tidak cocok.');
          return;
        }
        setError('');
        setCurrentStep('biometric'); 
        break;
      case 'biometric': finalizeActivation(); break;
    }
  };

  const processOCR = async () => {
    if (!ktpPhoto || !kkPhoto) return;
    try {
      // 1. Scan KTP (Progress 0 - 50%)
      setOcrProgress(10);
      const ktpResult = await extractKTPData(ktpPhoto, (p) => setOcrProgress(Math.round(p * 0.5)));
      
      // 2. Scan KK (Progress 50 - 100%)
      setOcrProgress(55);
      const kkResult = await extractKTPData(kkPhoto, (p) => setOcrProgress(50 + Math.round(p * 0.5)));
      
      const { calculateMatchScore } = await import('../services/ocrService');
      const score = calculateMatchScore(
        { nik: user.nik || '', fullName: user.name || '', birthDate: user.dob || '' },
        ktpResult.ktpData
      );

      const mergedData = {
        ...ktpResult.ktpData,
        nomorKK: kkResult.ktpData.nomorKK || ktpResult.ktpData.nomorKK || '',
        matchScore: score,
        ktpExpiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000) // 48 hours from now
      };
      
      setExtractedData(mergedData);
      
      if (mergedData.nomorKK) {
        checkFamily(mergedData.nomorKK);
      }
      
      setTimeout(() => setCurrentStep('data_review'), 1000);
    } catch (err) {
      console.error(err);
      setError('Gagal memproses dokumen secara otomatis. Silakan isi data secara manual.');
      setCurrentStep('data_review');
    }
  };

  const checkFamily = async (kkNumber: string) => {
    if (kkNumber.length !== 16) return;
    
    try {
      const q = query(collection(db, 'families'), where('nomorKK', '==', kkNumber));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const familyData = snap.docs[0].data();
        setFamilyMatch({ exists: true, headName: familyData.kepalaKeluarga, kkNumber });
        
        // Auto-fill address if family exists
        if (familyData.blok || familyData.nomorRumah || familyData.rt) {
          // Normalize RT (ensure 001 format)
          let normalizedRT = familyData.rt || '';
          if (normalizedRT && normalizedRT.length < 3) {
            normalizedRT = normalizedRT.padStart(3, '0');
          }

          setExtractedData((prev: any) => ({
            ...prev,
            blok: familyData.blok || '',
            nomorRumah: familyData.nomorRumah || '',
            rt: normalizedRT,
            nomorKK: kkNumber
          }));
        }
      } else {
        setFamilyMatch({ exists: false, kkNumber });
      }
    } catch (err) {
      setFamilyMatch({ exists: false });
    }
  };

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // Max dimension 1024px to keep Firestore size manageable
          const maxDim = 1024;
          if (width > height && width > maxDim) {
            height *= maxDim / width;
            width = maxDim;
          } else if (height > maxDim) {
            width *= maxDim / height;
            height = maxDim;
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.onerror = error => reject(error);
      };
      reader.onerror = error => reject(error);
    });
  };

  const finalizeActivation = async () => {
    setLoading(true);
    setError('');
    try {
      let targetId = user?.id;

      // Fallback: If ID is missing (stale session), try to find it by NIK
      if (!targetId && user?.nik) {
        console.log('ID missing, attempting recovery via NIK:', user.nik);
        const q = query(collection(db, 'users'), where('username', '==', user.nik));
        const snap = await getDocs(q);
        if (!snap.empty) {
          targetId = snap.docs[0].id;
        }
      }

      if (!targetId) {
        throw new Error('ID akun tidak ditemukan. Silakan Keluar dan Login kembali.');
      }

      let finalKtpUrl = ktpPreview || '';
      let finalKkUrl = kkPreview || '';

      if (ktpPhoto) {
        try { finalKtpUrl = await compressImage(ktpPhoto); } catch(e) { console.error(e); }
      }
      if (kkPhoto) {
        try { finalKkUrl = await compressImage(kkPhoto); } catch(e) { console.error(e); }
      }

      const isKepalaKeluarga = !familyMatch?.exists;
      const noKK = extractedData?.nomorKK || '';

      const userRef = doc(db, 'users', targetId);
      const updateData: any = {
        accountStatus: familyMatch?.exists ? 'waiting_family_approval' : 'waiting_admin_approval',
        isFirstLogin: false,
        temporaryPasswordActive: false,
        extractedData: extractedData || {},
        registrationStatus: 'pending_approval',
        name: extractedData?.nama || user.name || '',
        ktpPhotoUrl: finalKtpUrl,
        kkPhotoUrl: finalKkUrl,
        biometricCredentialId: biometricCredentialId || null,
        biometricEnabled: biometricEnabled || false,
        dob: extractedData?.tanggalLahir || user.dob || '',
        pendingPassword: newPassword,
        noKK,
        isKepalaKeluarga,
        hubunganKeluarga: relationship || (isKepalaKeluarga ? 'Kepala Keluarga' : ''),
        rt_id: extractedData?.rt || user.rt_id || '',
        rw_id: extractedData?.rw || user.rw_id || '011'
      };

      // Clean undefined values for Firestore
      Object.keys(updateData).forEach(key => 
        updateData[key] === undefined && delete updateData[key]
      );
      
      await updateDoc(userRef, updateData);

      // Sync with residents collection so it appears in ApprovalListPage
      const residentsQ = query(collection(db, 'residents'), where('nik', '==', user.nik));
      const residentsSnap = await getDocs(residentsQ);
      if (!residentsSnap.empty) {
        const residentDocRef = doc(db, 'residents', residentsSnap.docs[0].id);
        await updateDoc(residentDocRef, {
          statusValidasi: 'Menunggu Review',
          nama: extractedData?.nama || user.name || '',
          tanggalLahir: extractedData?.tanggalLahir || user.dob || '',
          jenisKelamin: extractedData?.jenisKelamin || 'Laki-laki',
          nomorHP: user.phone || extractedData?.nomorHP || '',
          noKK,
          isKepalaKeluarga,
          hubungan: relationship || (isKepalaKeluarga ? 'Kepala Keluarga' : ''),
          alamat: extractedData?.alamat || '',
          tempatLahir: extractedData?.tempatLahir || '',
          agama: extractedData?.agama || '',
          statusPerkawinan: extractedData?.statusPerkawinan || '',
          pekerjaan: extractedData?.pekerjaan || '',
          blok: extractedData?.blok || '',
          nomorRumah: extractedData?.nomorRumah || '',
          rt_id: extractedData?.rt || user.rt_id || '',
          rw_id: extractedData?.rw || user.rw_id || '011',
          kelurahan: extractedData?.kelurahan || '',
          kecamatan: extractedData?.kecamatan || '',
          matchScore: extractedData?.matchScore || 0,
          facePhotoBase64: extractedData?.facePhotoBase64 || '',
          ktpPhotoUrl: finalKtpUrl,
          kkPhotoUrl: finalKkUrl,
          ktpExpiresAt: extractedData?.ktpExpiresAt || null,
          updatedAt: Timestamp.now()
        });
      }
      
      // Send Notification to Admin
      try {
        const { sendNotification } = await import('../services/notificationService');
        const targetRoles = ['ketua_rw'];
        const targetRt = extractedData?.rt || user.rt_id;
        if (targetRt) targetRoles.push(`ketua_rt_${targetRt.slice(-2)}`);
        
        await sendNotification(
          'registration',
          'Pendaftaran Warga Baru',
          `${user.name} telah menyelesaikan registrasi. Mohon tinjau data KTP & KK.`,
          targetRoles,
          { relatedId: user.nik, route: `/admin/approval/${user.nik}` }
        );
      } catch (notifErr) {
        console.error("Gagal mengirim notifikasi admin:", notifErr);
      }
      
      const updatedUser = { ...user, ...updateData, id: targetId } as UserType;
      onComplete(updatedUser);
      setCurrentStep('final');
    } catch (err: any) {
      console.error('Finalize Activation Error:', err);
      setError('Gagal menyelesaikan aktivasi: ' + (err.message || 'Error tidak dikenal'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="activation-root">
      <style dangerouslySetInnerHTML={{ __html: `
        .activation-root {
          min-height: 100vh;
          height: 100vh;
          width: 100%;
          background: #f8fafc;
          padding: 40px 20px;
          display: flex;
          justify-content: center;
          align-items: center;
          overflow: hidden;
          position: relative;
          touch-action: pan-y;
        }
        .activation-card {
          width: 100%;
          max-width: 600px;
          max-height: calc(100vh - 40px);
          background: #fff;
          border-radius: 32px;
          box-shadow: 0 20px 50px rgba(0,0,0,0.05);
          border: 1px solid #e2e8f0;
          overflow-y: auto;
          position: relative;
          scrollbar-width: none;
        }
        .activation-card::-webkit-scrollbar { display: none; }

        @media (max-width: 768px) {
          .activation-root { padding: 0; }
          .activation-card { 
            max-width: 100%; 
            max-height: 100vh; 
            height: 100vh;
            border-radius: 0; 
            border: none; 
          }
          .activation-card > div:last-child { padding: 32px 24px !important; }
          h1 { font-size: 20px !important; }
          h2 { font-size: 18px !important; }
          p { font-size: 12px !important; }
          .btn-primary { padding: 12px 24px !important; font-size: 13px !important; }
          .upload-box { padding: 16px !important; }
          .upload-box p { font-size: 11px !important; }
          .upload-box img { max-height: 120px !important; }
        }
        .step-indicator {
          display: flex;
          gap: 8px;
          padding: 24px;
          background: #f1f5f9;
          border-bottom: 1px solid #e2e8f0;
        }
        .step-dot {
          height: 4px;
          flex: 1;
          background: #cbd5e1;
          border-radius: 2px;
          transition: all 0.3s;
        }
        .step-dot.active { background: #3b82f6; }
        .upload-box {
          border: 2px dashed #e2e8f0;
          border-radius: 24px;
          padding: 32px;
          text-align: center;
          cursor: pointer;
          transition: all 0.2s;
          background: #f8fafc;
        }
        .upload-box:hover { border-color: #3b82f6; background: #eff6ff; }
        .btn-primary {
          background: #1e3a8a;
          color: #fff;
          border: none;
          border-radius: 16px;
          padding: 16px 32px;
          font-weight: 800;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-primary:hover { background: #1e40af; transform: translateY(-2px); }
        .btn-outline {
          background: #fff;
          color: #64748b;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 16px 32px;
          font-weight: 700;
          cursor: pointer;
        }
        .input-group { margin-bottom: 20px; }
        .label { display: block; font-size: 13px; font-weight: 700; color: #475569; margin-bottom: 8px; }
        .input { width: 100%; height: 50px; border: 1px solid #e2e8f0; border-radius: 12px; padding: 0 16px; font-size: 14px; }
      `}} />

      <div className="activation-card">
        {/* Step dots */}
        <div className="step-indicator">
          {['welcome', 'upload', 'ocr', 'data_review', 'family', 'password', 'biometric', 'final'].map((s, idx) => (
            <div key={s} className={`step-dot ${['welcome', 'upload', 'ocr', 'data_review', 'family', 'password', 'biometric', 'final'].indexOf(currentStep) >= idx ? 'active' : ''}`} />
          ))}
        </div>

        <div style={{ padding: '48px' }}>
          <AnimatePresence mode="wait">
            {currentStep === 'welcome' && (
              <motion.div key="welcome" {...stepVariants}>
                <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                  <div style={{ width: '80px', height: '80px', background: '#eff6ff', borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', color: '#3b82f6' }}>
                    <ShieldCheck size={40} />
                  </div>
                  <h1 style={{ fontSize: '28px', fontWeight: 900, color: '#1e3a8a', marginBottom: '12px' }}>Aktivasi Akun Warga</h1>
                  <p style={{ color: '#64748b', lineHeight: 1.6 }}>Halo <strong>{user.name}</strong>, akun Anda telah dibuat oleh Admin. Silakan lengkapi verifikasi identitas untuk mengaktifkan akses penuh ke layanan Ruang Warga VSJ.</p>
                </div>
                
                <div style={{ background: '#f8fafc', borderRadius: '20px', padding: '24px', marginBottom: '40px' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: 800, color: '#1e3a8a', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}><Info size={18}/> Persiapan Dokumen:</h4>
                  <ul style={{ paddingLeft: '20px', fontSize: '13px', color: '#64748b', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <li>KTP Asli (Fisik)</li>
                    <li>Kartu Keluarga (KK)</li>
                    <li>Koneksi internet stabil untuk proses OCR</li>
                  </ul>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <button className="btn-primary" style={{ width: '100%' }} onClick={handleNext}>
                    Mulai Aktivasi Sekarang <ChevronRight size={18} />
                  </button>
                  <button 
                    className="btn-outline" 
                    style={{ width: '100%', color: '#ef4444', borderColor: '#fee2e2', background: '#fef2f2' }} 
                    onClick={() => {
                      localStorage.removeItem('erw_user');
                      window.location.href = '/warga-login';
                    }}
                  >
                    Batal & Keluar
                  </button>
                </div>
              </motion.div>
            )}

            {currentStep === 'upload' && (
              <motion.div key="upload" {...stepVariants}>
                <h2 style={{ fontSize: '22px', fontWeight: 900, marginBottom: '8px', color: '#1e3a8a' }}>Verifikasi Dokumen</h2>
                <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '32px' }}>Upload foto KTP dan KK Anda untuk verifikasi identitas otomatis.</p>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '40px' }}>
                  <div className="upload-box" style={{ border: ktpPreview ? '2px solid #3b82f6' : '2px dashed #e2e8f0' }} onClick={() => document.getElementById('ktp-up')?.click()}>
                    <input id="ktp-up" type="file" hidden accept="image/*" capture="environment" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setKtpPhoto(file);
                        setKtpPreview(URL.createObjectURL(file));
                      }
                    }} />
                    {ktpPreview ? (
                      <div style={{ position: 'relative', width: '100%' }}>
                        <img src={ktpPreview} style={{ width: '100%', maxHeight: '180px', objectFit: 'cover', borderRadius: '12px' }} />
                        <div style={{ position: 'absolute', top: 8, right: 8, background: '#3b82f6', color: '#fff', borderRadius: '50%', padding: 4 }}><Check size={12} /></div>
                      </div>
                    ) : (
                      <>
                        <Camera size={32} style={{ color: '#94a3b8', marginBottom: '12px' }} />
                        <p style={{ fontSize: '14px', fontWeight: 700, color: '#475569' }}>Ambil Foto / Upload KTP</p>
                        <p style={{ fontSize: '12px', color: '#94a3b8' }}>Gunakan kamera atau galeri</p>
                      </>
                    )}
                  </div>

                  <div className="upload-box" style={{ border: kkPreview ? '2px solid #3b82f6' : '2px dashed #e2e8f0' }} onClick={() => document.getElementById('kk-up')?.click()}>
                    <input id="kk-up" type="file" hidden accept="image/*" capture="environment" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setKkPhoto(file);
                        setKkPreview(URL.createObjectURL(file));
                      }
                    }} />
                    {kkPreview ? (
                      <div style={{ position: 'relative', width: '100%' }}>
                        <img src={kkPreview} style={{ width: '100%', maxHeight: '180px', objectFit: 'cover', borderRadius: '12px' }} />
                        <div style={{ position: 'absolute', top: 8, right: 8, background: '#3b82f6', color: '#fff', borderRadius: '50%', padding: 4 }}><Check size={12} /></div>
                      </div>
                    ) : (
                      <>
                        <FileText size={32} style={{ color: '#94a3b8', marginBottom: '12px' }} />
                        <p style={{ fontSize: '14px', fontWeight: 700, color: '#475569' }}>Ambil Foto / Upload KK</p>
                        <p style={{ fontSize: '12px', color: '#94a3b8' }}>Gunakan kamera atau galeri</p>
                      </>
                    )}
                  </div>
                </div>

                {error && <div style={{ color: '#ef4444', fontSize: '13px', marginBottom: '20px', textAlign: 'center' }}>{error}</div>}

                <div style={{ display: 'flex', gap: '16px' }}>
                  <button className="btn-outline" onClick={() => setCurrentStep('welcome')}>Kembali</button>
                  <button className="btn-primary" style={{ flex: 1 }} onClick={handleNext}>Lanjutkan</button>
                </div>
              </motion.div>
            )}

            {currentStep === 'ocr' && (
              <motion.div key="ocr" {...stepVariants} style={{ textAlign: 'center', padding: '40px 0' }}>
                <div style={{ position: 'relative', width: '120px', height: '120px', margin: '0 auto 32px' }}>
                  <motion.div 
                    animate={{ rotate: 360 }} 
                    transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                    style={{ position: 'absolute', inset: 0, border: '4px solid #eff6ff', borderTopColor: '#3b82f6', borderRadius: '50%' }}
                  />
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6' }}>
                    <Scan size={48} />
                  </div>
                </div>
                <h2 style={{ fontSize: '22px', fontWeight: 900, marginBottom: '8px', color: '#1e3a8a' }}>Memproses Identitas...</h2>
                <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '32px' }}>Sistem sedang mengekstrak data dari KTP Anda secara aman.</p>
                
                <div style={{ width: '100%', height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden', marginBottom: '12px' }}>
                  <motion.div initial={{ width: 0 }} animate={{ width: `${ocrProgress}%` }} style={{ height: '100%', background: '#3b82f6' }} />
                </div>
                <p style={{ fontSize: '12px', fontWeight: 800, color: '#3b82f6' }}>{ocrProgress}% SELESAI</p>
              </motion.div>
            )}

            {currentStep === 'data_review' && (
              <motion.div key="data_review" {...stepVariants}>
                <h2 style={{ fontSize: '20px', fontWeight: 900, marginBottom: '8px', color: '#1e3a8a' }}>Konfirmasi Identitas</h2>
                <p style={{ color: '#64748b', fontSize: '12px', marginBottom: '32px' }}>Pastikan data berikut sesuai dengan identitas resmi Anda.</p>
                
                {/* AI Face Crop Preview for User */}
                {extractedData?.facePhotoBase64 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px', padding: '16px', background: '#f8fafc', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                    <div style={{ width: '64px', height: '64px', borderRadius: '50%', overflow: 'hidden', border: '2px solid #3b82f6', flexShrink: 0 }}>
                      <img src={extractedData.facePhotoBase64} alt="Face Crop" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <div>
                      <h4 style={{ fontSize: '13px', fontWeight: 800, color: '#1e3a8a', marginBottom: '4px' }}>Foto Verifikasi AI</h4>
                      <p style={{ fontSize: '11px', color: '#64748b' }}>Wajah ini berhasil diekstrak dari KTP Anda dan akan disertakan untuk review Admin.</p>
                    </div>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="input-group" style={{ gridColumn: 'span 2' }}>
                    <label className="label">Nama Lengkap</label>
                    <input 
                      className="input" 
                      value={(extractedData?.nama || user.name).toUpperCase()} 
                      onChange={(e) => setExtractedData({...(extractedData || {}), nama: e.target.value.toUpperCase()})}
                      style={{ textTransform: 'uppercase' }}
                    />
                  </div>
                  <div className="input-group">
                    <label className="label">NIK</label>
                    <input 
                      className="input" 
                      value={user.nik} 
                      readOnly 
                      style={{ background: '#f1f5f9', cursor: 'not-allowed' }}
                    />
                  </div>
                  <div className="input-group">
                    <label className="label">Tanggal Lahir (DD/MM/YYYY)</label>
                    <input 
                      className="input" 
                      type="text"
                      placeholder="31/12/1990"
                      value={extractedData?.tanggalLahir || user.dob || ''} 
                      onChange={(e) => {
                        let val = e.target.value.replace(/[^0-9/]/g, '');
                        if (val.length === 2 && !val.includes('/')) val += '/';
                        if (val.length === 5 && val.split('/').length === 2) val += '/';
                        if (val.length > 10) val = val.slice(0, 10);
                        setExtractedData({...(extractedData || {}), tanggalLahir: val});
                      }}
                    />
                  </div>
                  <div className="input-group">
                    <label className="label">Tempat Lahir</label>
                    <input 
                      className="input" 
                      value={(extractedData?.tempatLahir || '').toUpperCase()} 
                      onChange={(e) => setExtractedData({...(extractedData || {}), tempatLahir: e.target.value.toUpperCase()})}
                      placeholder="Contoh: JAKARTA"
                      list="cities-list"
                    />
                    <datalist id="cities-list">
                      {['JAKARTA', 'SURABAYA', 'BANDUNG', 'MEDAN', 'BEKASI', 'TANGERANG', 'DEPOK', 'SEMARANG', 'PALEMBANG', 'MAKASSAR', 'TANGERANG SELATAN', 'BOGOR', 'BATAM', 'PEKANBARU', 'BANDAR LAMPUNG', 'MALANG', 'PADANG', 'DENPASAR', 'SAMARINDA', 'TASIKMALAYA', 'BANJARMASIN', 'BALIKPAPAN', 'PONTIANAK', 'CIMAHI', 'JAMBI', 'SURAKARTA', 'MANADO', 'MATARAM', 'CILEGON', 'PALU', 'KUPANG', 'SUKABUMI', 'BENGKULU', 'CIREBON', 'PEKALONGAN', 'AMBON', 'TEGAL', 'BINJAI', 'PURWOKERTO', 'LUBUKLINGGAU', 'PEMATANGSIANTAR', 'LOA JANAN', 'BANDA ACEH', 'TARAKAN', 'SINGKAWANG', 'PROBOLINGGO', 'BITUNG', 'BANJARBARU', 'TEBING TINGGI', 'PANGKALPINANG', 'LHOKSEUMAWE', 'SORONG', 'MADIUN', 'SALATIGA', 'KEDIRI', 'PAGAR ALAM', 'SINGARAJA', 'GORONTALO', 'BUKITTINGGI', 'KENDARI', 'PADANG SIDEMPUAN', 'TUAL', 'PAREPARE', 'BONTANG', 'TANJUNGPINANG', 'TERNATE', 'PALOPO', 'SOLOK'].map(city => <option key={city} value={city} />)}
                    </datalist>
                  </div>

                  <div className="input-group" style={{ gridColumn: 'span 2' }}>
                    <label className="label">Nomor HP / WhatsApp Aktif</label>
                    <input 
                      className="input" 
                      type="tel"
                      value={extractedData?.nomorHP || user.phone || ''} 
                      onChange={(e) => setExtractedData({...(extractedData || {}), nomorHP: e.target.value})}
                      placeholder="Contoh: 081234567890"
                    />
                  </div>

                  <div className="input-group" style={{ gridColumn: 'span 2' }}>
                    <label className="label">Agama</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                      {['ISLAM', 'KRISTEN', 'KATOLIK', 'HINDU', 'BUDHA', 'KONGHUCU'].map(a => (
                        <div 
                          key={a}
                          onClick={() => setExtractedData({...(extractedData || {}), agama: a})}
                          style={{
                            padding: '10px 4px', textAlign: 'center', borderRadius: '12px', fontSize: '11px', fontWeight: 700,
                            cursor: 'pointer', transition: 'all 0.2s', border: '2px solid',
                            background: extractedData?.agama === a ? '#eff6ff' : '#fff',
                            borderColor: extractedData?.agama === a ? '#3b82f6' : '#f1f5f9',
                            color: extractedData?.agama === a ? '#1d4ed8' : '#64748b'
                          }}
                        >
                          {a}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="input-group" style={{ gridColumn: 'span 2' }}>
                    <label className="label">Status Perkawinan</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      {['BELUM KAWIN', 'KAWIN', 'CERAI HIDUP', 'CERAI MATI'].map(s => (
                        <div 
                          key={s}
                          onClick={() => setExtractedData({...(extractedData || {}), statusPerkawinan: s})}
                          style={{
                            padding: '12px', textAlign: 'center', borderRadius: '12px', fontSize: '12px', fontWeight: 700,
                            cursor: 'pointer', transition: 'all 0.2s', border: '2px solid',
                            background: extractedData?.statusPerkawinan === s ? '#eff6ff' : '#fff',
                            borderColor: extractedData?.statusPerkawinan === s ? '#3b82f6' : '#f1f5f9',
                            color: extractedData?.statusPerkawinan === s ? '#1d4ed8' : '#64748b'
                          }}
                        >
                          {s}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="input-group" style={{ gridColumn: 'span 2' }}>
                    <label className="label">Pekerjaan</label>
                    <input 
                      className="input" 
                      value={(extractedData?.pekerjaan || '').toUpperCase()} 
                      onChange={(e) => setExtractedData({...(extractedData || {}), pekerjaan: e.target.value.toUpperCase()})}
                      placeholder="Contoh: KARYAWAN SWASTA"
                    />
                  </div>

                  <div className="input-group" style={{ gridColumn: 'span 2' }}>
                    <label className="label">Nomor Kartu Keluarga (KK)</label>
                    <input 
                      className="input" 
                      value={extractedData?.nomorKK || ''} 
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 16);
                        setExtractedData({...(extractedData || {}), nomorKK: val});
                        if (val.length === 16) {
                          checkFamily(val);
                        }
                      }}
                      placeholder="Masukkan 16 Digit Nomor KK"
                      maxLength={16}
                    />
                  </div>

                  <div style={{ gridColumn: 'span 2', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', background: '#f8fafc', padding: '16px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                    <div className="input-group" style={{ marginBottom: 0 }}>
                      <label className="label">Blok</label>
                      <select 
                        className="input" 
                        value={extractedData?.blok || ''} 
                        onChange={(e) => setExtractedData({...(extractedData || {}), blok: e.target.value})}
                      >
                        <option value="">Pilih...</option>
                        {"ABCDEFGHIJKLMNOPQRST".split("").map(b => <option key={b} value={b}>Blok {b}</option>)}
                      </select>
                    </div>
                    <div className="input-group" style={{ marginBottom: 0 }}>
                      <label className="label">Nomor</label>
                      <select 
                        className="input" 
                        value={extractedData?.nomorRumah || ''} 
                        onChange={(e) => setExtractedData({...(extractedData || {}), nomorRumah: e.target.value})}
                      >
                        <option value="">No...</option>
                        {Array.from({length: 30}, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>
                    <div className="input-group" style={{ marginBottom: 0 }}>
                      <label className="label">RT</label>
                      <select 
                        className="input" 
                        value={extractedData?.rt || ''} 
                        onChange={(e) => setExtractedData({...(extractedData || {}), rt: e.target.value})}
                      >
                        <option value="">RT...</option>
                        {["001", "002", "003", "004", "005"].map(rt => <option key={rt} value={rt}>{rt}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '16px', marginTop: '32px' }}>
                  <button className="btn-outline" onClick={() => setCurrentStep('upload')}>Ulang Scan</button>
                  <button 
                    className="btn-primary" 
                    style={{ 
                      flex: 1, 
                      opacity: (!(extractedData?.tanggalLahir || user.dob) || extractedData?.nomorKK?.length !== 16 || !extractedData?.blok || !extractedData?.nomorRumah || !extractedData?.rt) ? 0.5 : 1 
                    }} 
                    disabled={!(extractedData?.tanggalLahir || user.dob) || extractedData?.nomorKK?.length !== 16 || !extractedData?.blok || !extractedData?.nomorRumah || !extractedData?.rt}
                    onClick={() => {
                      checkFamily(extractedData.nomorKK);
                      setCurrentStep('family');
                    }}
                  >
                    Lanjutkan
                  </button>
                </div>
              </motion.div>
            )}

            {currentStep === 'family' && (
              <motion.div key="family" {...stepVariants}>
                <h2 style={{ fontSize: '22px', fontWeight: 900, marginBottom: '8px', color: '#1e3a8a' }}>Validasi Keluarga</h2>
                <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '32px' }}>Sistem mendeteksi data keluarga Anda berdasarkan No. KK.</p>
                
                {familyMatch?.exists ? (
                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '24px', padding: '24px', marginBottom: '32px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
                      <div style={{ width: '48px', height: '48px', background: '#dcfce7', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#22c55e' }}>
                        <Users size={24} />
                      </div>
                      <div>
                        <p style={{ fontSize: '12px', fontWeight: 700, color: '#16a34a' }}>KELUARGA DITEMUKAN</p>
                        <h4 style={{ fontSize: '18px', fontWeight: 900, color: '#14532d' }}>{familyMatch.headName}</h4>
                      </div>
                    </div>
                    <div className="input-group">
                      <label className="label" style={{ color: '#16a34a' }}>Hubungan dalam Keluarga</label>
                      <select className="input" value={relationship} onChange={(e) => setRelationship(e.target.value)} style={{ borderColor: '#bbf7d0' }}>
                        <option value="">Pilih Hubungan...</option>
                        <option value="anak">Anak</option>
                        <option value="istri">Istri</option>
                        <option value="saudara">Saudara</option>
                        <option value="orang tua">Orang Tua</option>
                        <option value="lainnya">Lainnya</option>
                      </select>
                    </div>
                    <p style={{ fontSize: '12px', color: '#16a34a', fontStyle: 'italic' }}>*Aktivasi memerlukan persetujuan dari Kepala Keluarga Anda.</p>
                  </div>
                ) : (
                  <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '24px', padding: '24px', marginBottom: '32px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ width: '48px', height: '48px', background: '#dbeafe', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6' }}>
                        <User size={24} />
                      </div>
                      <div>
                        <p style={{ fontSize: '12px', fontWeight: 700, color: '#2563eb' }}>KK BARU</p>
                        <h4 style={{ fontSize: '18px', fontWeight: 900, color: '#1e3a8a' }}>Menjadi Kepala Keluarga</h4>
                      </div>
                    </div>
                    <p style={{ fontSize: '13px', color: '#64748b', marginTop: '16px' }}>Nomor KK Anda belum terdaftar. Sistem akan membuat entitas keluarga baru dan Anda akan otomatis menjadi Kepala Keluarga.</p>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '16px' }}>
                  <button className="btn-outline" onClick={() => setCurrentStep('data_review')}>Kembali</button>
                  <button className="btn-primary" style={{ flex: 1 }} onClick={handleNext} disabled={familyMatch?.exists && !relationship}>Lanjutkan</button>
                </div>
              </motion.div>
            )}

            {currentStep === 'password' && (
              <motion.div key="password" {...stepVariants}>
                <h2 style={{ fontSize: '22px', fontWeight: 900, marginBottom: '8px', color: '#1e3a8a' }}>Buat Password Baru</h2>
                <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '32px' }}>Password sementara Anda akan segera kedaluwarsa. Buat password permanen yang kuat.</p>
                
                <div className="input-group">
                  <label className="label">Password Baru</label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input className="input" type="password" style={{ paddingLeft: '48px' }} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min. 8 karakter" />
                  </div>
                </div>

                <div className="input-group">
                  <label className="label">Konfirmasi Password</label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input className="input" type="password" style={{ paddingLeft: '48px' }} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Ulangi password" />
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', marginBottom: '32px', fontSize: '12px', color: '#64748b' }}>
                  <p style={{ fontWeight: 800, marginBottom: '8px' }}>Kriteria Keamanan:</p>
                  <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                    <span style={{ color: newPassword.length >= 8 ? '#22c55e' : '#94a3b8' }}>● Min. 8 Karakter</span>
                    <span style={{ color: /[A-Z]/.test(newPassword) ? '#22c55e' : '#94a3b8' }}>● Huruf Besar</span>
                    <span style={{ color: /[a-z]/.test(newPassword) ? '#22c55e' : '#94a3b8' }}>● Huruf Kecil</span>
                    <span style={{ color: /[0-9]/.test(newPassword) ? '#22c55e' : '#94a3b8' }}>● Angka</span>
                  </div>
                </div>

                {error && <div style={{ color: '#ef4444', fontSize: '13px', marginBottom: '20px' }}>{error}</div>}

                <div style={{ display: 'flex', gap: '16px' }}>
                  <button className="btn-outline" onClick={() => setCurrentStep('family')}>Kembali</button>
                  <button className="btn-primary" style={{ flex: 1 }} onClick={handleNext}>Simpan Password</button>
                </div>
              </motion.div>
            )}

            {currentStep === 'biometric' && (
              <motion.div key="biometric" {...stepVariants} style={{ textAlign: 'center' }}>
                <div style={{ width: '80px', height: '80px', background: '#eff6ff', borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', color: '#3b82f6' }}>
                  <Fingerprint size={40} />
                </div>
                <h2 style={{ fontSize: '22px', fontWeight: 900, marginBottom: '8px', color: '#1e3a8a' }}>Keamanan Biometrik</h2>
                <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '40px' }}>Gunakan sidik jari untuk masuk lebih cepat dan aman di masa mendatang.</p>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
                  {biometricAvailable ? (
                    <button 
                      className="btn-primary" 
                      style={{ background: biometricEnabled ? '#f0fdf4' : '#fff', color: biometricEnabled ? '#16a34a' : '#1e3a8a', border: `2px solid ${biometricEnabled ? '#22c55e' : '#3b82f6'}`, height: '54px' }}
                      onClick={async () => {
                        try {
                          setLoading(true);
                          const credential = await registerBiometric(user.nik || 'user');
                          setBiometricCredentialId(credential.id);
                          setBiometricEnabled(true);
                          setError('');
                        } catch (err: any) {
                          setError('Gagal mendaftarkan sidik jari: ' + err.message);
                        } finally {
                          setLoading(false);
                        }
                      }}
                      disabled={loading || biometricEnabled}
                    >
                      {biometricEnabled ? <><CheckCircle2 size={20} /> Biometrik Berhasil Ditambahkan</> : <><Fingerprint size={20} /> Tambahkan Biometrik</>}
                    </button>
                  ) : (
                    <div style={{ background: '#fff1f2', padding: '16px', borderRadius: '16px', border: '1px solid #fecdd3', marginBottom: '12px' }}>
                      <p style={{ fontSize: '11px', color: '#e11d48', fontWeight: 700 }}>Perangkat tidak mendukung biometrik browser.</p>
                    </div>
                  )}
                  
                  <button 
                    className="btn-outline" 
                    style={{ height: '54px', border: '1px solid #e2e8f0', color: '#64748b' }} 
                    onClick={finalizeActivation}
                    disabled={loading}
                  >
                    {biometricEnabled ? 'Selesaikan Aktivasi' : 'Lewati dan Selesaikan Aktivasi'}
                  </button>
                </div>

                {error && (
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ color: '#ef4444', fontSize: '13px', marginBottom: '12px', fontWeight: 600 }}>{error}</div>
                    {error.includes('ID akun') && (
                      <button 
                        style={{ border: 'none', background: '#fee2e2', color: '#dc2626', padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                        onClick={() => {
                          localStorage.removeItem('erw_user');
                          window.location.href = '/warga-login';
                        }}
                      >
                        Login Ulang
                      </button>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {currentStep === 'final' && (
              <motion.div key="final" {...stepVariants} style={{ textAlign: 'center' }}>
                <div style={{ width: '100px', height: '100px', background: '#f0fdf4', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 32px', color: '#22c55e' }}>
                  <CheckCircle2 size={56} />
                </div>
                <h2 style={{ fontSize: '26px', fontWeight: 900, marginBottom: '12px', color: '#16a34a' }}>Aktivasi Selesai!</h2>
                <p style={{ color: '#64748b', lineHeight: 1.6, marginBottom: '40px' }}>Data Anda telah berhasil dikirim. Saat ini status akun Anda adalah <strong>Menunggu Persetujuan Admin</strong>.</p>
                
                <div style={{ background: '#f8fafc', borderRadius: '24px', padding: '32px', textAlign: 'left', marginBottom: '40px' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: 800, color: '#1e3a8a', marginBottom: '16px' }}>Status Verifikasi:</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <div style={{ width: '20px', height: '20px', background: '#22c55e', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}><CheckCircle2 size={12}/></div>
                      <p style={{ fontSize: '13px', color: '#475569' }}>Lengkapi Data Identitas</p>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 2 }} style={{ width: '20px', height: '20px', background: '#3b82f6', borderRadius: '50%' }} />
                      <p style={{ fontSize: '13px', fontWeight: 700, color: '#1e3a8a' }}>Menunggu Verifikasi Admin / RW</p>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', opacity: 0.5 }}>
                      <div style={{ width: '20px', height: '20px', border: '2px solid #cbd5e1', borderRadius: '50%' }} />
                      <p style={{ fontSize: '13px', color: '#475569' }}>Akses Dashboard Aktif</p>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <button className="btn-primary" style={{ width: '100%', background: '#25d366', color: '#fff', border: 'none' }} onClick={async () => {
                    try {
                      const targetRtId = user.rt_id || extractedData?.rt || '001';
                      const { query, collection, where, getDocs } = await import('firebase/firestore');
                      const q = query(collection(db, 'users'), where('role', '==', 'rt'), where('rt_id', '==', targetRtId));
                      const snap = await getDocs(q);
                      if (!snap.empty) {
                        const rtPhone = snap.docs[0].data().phone || snap.docs[0].data().nomorHP;
                        if (rtPhone) {
                          const cleanPhone = rtPhone.replace(/[^0-9]/g, '');
                          const formattedPhone = cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : cleanPhone;
                          window.open(`https://wa.me/${formattedPhone}?text=Halo Bapak/Ibu Ketua RT ${targetRtId}, saya ${user.name} baru saja melakukan registrasi aplikasi Ruang Warga dan menunggu persetujuan. Mohon bantuannya.`, '_blank');
                          return;
                        }
                      }
                      alert(`Nomor Ketua RT ${targetRtId} belum terdaftar di sistem.`);
                    } catch(e) {
                      console.error(e);
                      alert('Gagal mengambil kontak RT.');
                    }
                  }}>
                    Hubungi Ketua RT {user.rt_id || extractedData?.rt || ''} (WhatsApp)
                  </button>
                  <button className="btn-outline" style={{ width: '100%' }} onClick={() => navigate('/warga-login')}>
                    Kembali ke Halaman Login
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
