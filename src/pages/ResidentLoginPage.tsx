import React, { useState, useEffect } from 'react';
import { 
  User as UserIcon, Lock, CheckCircle2, AlertCircle, 
  Loader2, Eye, EyeOff, Fingerprint, Globe, 
  ChevronRight, HelpCircle, Calendar, Phone
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { User } from '../types';
import logo from '../assets/login/logo.png';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase/config';
import { collection, query, where, getDocs, onSnapshot, addDoc, updateDoc } from 'firebase/firestore';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';

// Images from public assets
const housingImages = [
  "/assets/housing/housing1.png",
  "/assets/housing/housing2.png",
  "/assets/housing/housing3.png"
];

interface LoginPageProps {
  onLogin: (user: User) => void;
}

export default function ResidentLoginPage({ onLogin }: LoginPageProps) {
  const [nik, setNik] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [showContactModal, setShowContactModal] = useState(false);
  const [adminsList, setAdminsList] = useState<any[]>([]);
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');
  const navigate = useNavigate();

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    setForgotSuccess('');

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(forgotEmail)) {
      setForgotError('Format alamat email tidak valid.');
      return;
    }

    setForgotLoading(true);
    try {
      // Find user with this email
      const q = query(collection(db, 'users'), where('email', '==', forgotEmail));
      const snap = await getDocs(q);
      
      if (snap.empty) {
        throw new Error('Alamat email tidak terdaftar.');
      }

      const userDoc = snap.docs[0];
      const userData = userDoc.data();

      // Check if email is verified
      if (!userData.emailVerified && !userData.email_verified) {
        throw new Error('Gunakan email terverifikasi untuk reset password.');
      }

      // Call Native Firebase Auth password reset
      await sendPasswordResetEmail(auth, forgotEmail);

      setForgotSuccess('Link reset password telah dikirim ke email Anda. Silakan periksa inbox/spam Anda.');
      setForgotEmail('');
    } catch (err: any) {
      setForgotError(err.message || 'Gagal mengirim email atur ulang sandi.');
    } finally {
      setForgotLoading(false);
    }
  };

  useEffect(() => {
    // Real-time synchronization of admin contacts who have a valid active WhatsApp number
    const q = query(
      collection(db, 'users'), 
      where('accountType', '==', 'admin')
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      const list = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as any))
        .filter(admin => admin.phoneNumber && admin.phoneNumber.trim() !== '');
      setAdminsList(list);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % housingImages.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // DEV BYPASS
    if (nik === 'dev' && password === 'dev') {
      onLogin({
        id: 'dev-warga',
        username: 'dev',
        name: 'Developer Warga',
        accountType: 'resident',
        rt_id: 'RT 001',
        nik: '1234567890123456',
        accountStatus: 'active'
      } as User);
      return;
    }

    const isEmail = nik.includes('@');
    if (isEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(nik)) {
        setError('Format alamat email tidak valid.');
        return;
      }
    } else {
      if (nik.length !== 16 || /\D/.test(nik)) {
        setError('NIK harus berjumlah tepat 16 digit angka.');
        return;
      }
    }

    setLoading(true);

    try {
      let userData: User;

      if (isEmail) {
        // Native Firebase Auth Email Sign In
        let authUser;
        try {
          const userCredential = await signInWithEmailAndPassword(auth, nik, password);
          authUser = userCredential.user;
        } catch (authErr: any) {
          if (authErr.code === 'auth/wrong-password' || authErr.code === 'auth/invalid-credential' || authErr.code === 'auth/invalid-email') {
            throw new Error('Password yang Anda masukkan salah.');
          } else if (authErr.code === 'auth/user-not-found') {
            throw new Error('Alamat email tidak terdaftar.');
          } else {
            throw authErr;
          }
        }

        if (!authUser.emailVerified) {
          throw new Error('Email Anda belum diverifikasi. Silakan masuk menggunakan NIK dan verifikasi email Anda di Pengaturan.');
        }

        // Fetch user from Firestore
        const q = query(collection(db, 'users'), where('email', '==', nik));
        const snap = await getDocs(q);
        if (snap.empty) {
          throw new Error('Data warga tidak ditemukan di database.');
        }

        const userDoc = snap.docs[0];
        userData = { id: userDoc.id, ...userDoc.data() } as User;

        // Self-Healing Sync: Update Firestore password if out of sync
        if (userData.password !== password) {
          await updateDoc(userDoc.ref, {
            password: password,
            updatedAt: new Date()
          });
          userData.password = password;
        }

        // Sync verification status in Firestore if not yet marked verified
        if (!userData.emailVerified || !userData.email_verified) {
          await updateDoc(userDoc.ref, {
            emailVerified: true,
            email_verified: true,
            email_verified_at: new Date()
          });
          userData.emailVerified = true;
          userData.email_verified = true;
        }
      } else {
        // Normal NIK Login via Firestore
        const q = query(collection(db, 'users'), where('username', '==', nik));
        const snap = await getDocs(q);
        
        if (snap.empty) {
          throw new Error('Akun NIK tidak ditemukan. Silakan hubungi Admin.');
        }

        userData = { id: snap.docs[0].id, ...snap.docs[0].data() } as User;

        // Password Verification
        if (userData.password !== password) {
          throw new Error('Password yang Anda masukkan salah.');
        }
      }

      // Check if user is a resident
      const isResident = userData.accountType === 'resident' || (userData as any).accountType === 'warga' || (userData as any).role === 'warga';
      if (!isResident) {
         throw new Error('Akses Ditolak: Gunakan halaman Login Admin untuk akun ini.');
      }
      
      // Normalize accountType for compatibility
      if ((userData as any).accountType === 'warga') {
        userData.accountType = 'resident';
      }

      // Default status for users who haven't activated yet (e.g. legacy family members)
      if (!userData.accountStatus) {
        userData.accountStatus = 'pending_registration';
        userData.isFirstLogin = true;
      }
      
      // 2. Check for account status
      if (userData.accountStatus === 'blocked') {
         throw new Error('Akun Anda dinonaktifkan sementara oleh Admin karena pindah atau sudah tidak tinggal di lingkungan RW 011.');
      }

      if (userData.accountStatus === 'pending_registration' || userData.isFirstLogin) {
        onLogin(userData);
        return;
      }

      if (userData.accountStatus === 'waiting_admin_approval') {
         throw new Error('Akun Anda sedang menunggu persetujuan Admin.');
      }

      if (userData.accountStatus === 'rejected') {
         onLogin(userData);
         return;
      }

      setTimeout(() => {
        onLogin(userData);
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Login gagal.');
      setLoading(false);
    }
  };

  return (
    <div className="login-page-root">
      <style dangerouslySetInnerHTML={{ __html: `
        .login-page-root {
          min-height: 100vh;
          width: 100%;
          background: #0f172a;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow-y: auto;
          font-family: 'Inter', sans-serif;
        }
        .desktop-split {
          display: none;
          width: 100%;
          height: 100vh;
          flex-direction: row;
          background: #0f172a;
        }
        .left-slide {
          flex: 1;
          height: 100%;
          position: relative;
          overflow: hidden;
        }
        .right-form {
          width: 45%;
          min-width: 450px;
          max-width: 650px;
          height: 100vh;
          background: #0f172a;
          background-image: radial-gradient(at 100% 0%, #1e40af 0, transparent 50%);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px;
          position: relative;
          z-index: 10;
          box-shadow: -10px 0 30px rgba(0,0,0,0.2);
        }
        .glass-card {
          width: 100%;
          max-width: 400px;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 32px;
          padding: 40px;
          position: relative;
          z-index: 10;
          box-shadow: 0 40px 100px rgba(0, 0, 0, 0.2);
          color: #111827;
        }
        .input-group {
          margin-bottom: 20px;
          text-align: left;
        }
        .label {
          display: block;
          font-size: 13px;
          font-weight: 700;
          color: #374151;
          margin-bottom: 8px;
          margin-left: 4px;
          text-align: left;
        }
        .input-wrapper {
          position: relative;
        }
        .input-field {
          width: 100%;
          height: 54px;
          background: #f9fafb;
          border: 1.5px solid #e5e7eb;
          border-radius: 16px;
          padding: 0 48px;
          font-size: 15px;
          color: #111827;
          outline: none;
          transition: all 0.3s ease;
        }
        .input-field:focus {
          border-color: #2563eb;
          background: #fff;
          box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.1);
        }
        .input-icon {
          position: absolute;
          left: 16px;
          top: 50%;
          transform: translateY(-50%);
          color: #9ca3af;
        }
        .btn-login {
          width: 100%;
          height: 54px;
          background: #2563eb;
          color: #fff;
          border: none;
          border-radius: 16px;
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          box-shadow: 0 10px 20px rgba(37, 99, 235, 0.2);
          margin-top: 10px;
          transition: all 0.2s;
        }
        .btn-login:hover { background: #1d4ed8; transform: translateY(-2px); }
        .btn-login:active { transform: translateY(0); }
        .btn-fingerprint {
          width: 100%;
          height: 50px;
          background: #fff;
          color: #374151;
          border: 1.5px solid #e5e7eb;
          border-radius: 16px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          margin-top: 20px;
          transition: all 0.2s;
        }
        .btn-fingerprint:hover { background: #f9fafb; border-color: #d1d5db; }
        .input-field::-ms-reveal, .input-field::-ms-clear { display: none; }
        
        .blob {
          position: absolute;
          width: 500px;
          height: 500px;
          background: #3b82f6;
          filter: blur(100px);
          opacity: 0.2;
          border-radius: 50%;
          z-index: 0;
          animation: float-blob 20s infinite alternate;
        }
        @keyframes float-blob {
          0% { transform: translate(-100px, -100px) scale(1); }
          100% { transform: translate(100px, 100px) scale(1.2); }
        }

        @media (min-width: 769px) {
          .login-page-root { display: block; overflow: hidden; }
          .desktop-split { display: flex; }
          .mobile-view { display: none; }
        }

        @media (max-width: 768px) {
          .login-page-root { 
            padding: 16px; 
            align-items: center; 
            overflow: hidden !important; 
            display: flex; 
            touch-action: none; 
            height: 100vh !important;
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
          }
          .desktop-split { display: none; }
          .mobile-view { 
            width: 100%; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            height: 100%;
          }
          .glass-card { 
            padding: 24px 20px; 
            border-radius: 24px; 
            width: 100%; 
            margin: 0; 
            max-width: 100%; 
            box-sizing: border-box; 
            max-height: calc(100vh - 32px);
          }
          .blob { width: 200px; height: 200px; }
          h1 { font-size: 20px !important; margin-bottom: 4px !important; }
          p { font-size: 12px !important; }
          .btn-login, .input-field { height: 46px; font-size: 14px; }
          .input-group { margin-bottom: 12px; }
          img { width: 90px !important; height: auto !important; margin-bottom: 12px !important; transition: all 0.2s ease; }
          .glass-card-header { margin-bottom: 20px !important; }
          .btn-fingerprint { height: 44px; margin-top: 12px; font-size: 13px; }
        }

        /* Keyboard active / small screen height optimization to keep fixed card fully visible and crisp without scrolling */
        @media (max-width: 768px) and (max-height: 600px) {
          .glass-card {
            padding: 16px 20px !important;
          }
          img { 
            display: none !important; /* Hide logo when keyboard is open to fit screen perfectly */
          }
          .glass-card-header {
            margin-bottom: 8px !important;
          }
          .input-group {
            margin-bottom: 8px !important;
          }
          .btn-login, .input-field {
            height: 42px !important;
          }
          h1 {
            font-size: 16px !important;
          }
          p {
            display: none !important; /* Hide subtitle when keyboard is open */
          }
          .label {
            margin-bottom: 4px !important;
          }
          /* Hide bottom redundant links when keyboard is active to save space */
          .glass-card > div:last-child {
            display: none !important;
          }
        }
      `}} />

      {/* Background Blobs for Mobile & Desktop Fallback */}
      <div className="mobile-view-blobs">
        <div className="blob" style={{ top: '-100px', left: '-100px' }} />
        <div className="blob" style={{ bottom: '-100px', right: '-100px', background: '#8b5cf6' }} />
      </div>

      {/* DESKTOP SPLIT VIEW */}
      <div className="desktop-split">
        {/* Left: Slideshow */}
        <div className="left-slide">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSlide}
              initial={{ opacity: 0, scale: 1.1 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.5 }}
              style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: `url(${housingImages[currentSlide]})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              }}
            >
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(15,23,42,0.8), rgba(15,23,42,0.2))' }} />
              <div style={{ position: 'absolute', bottom: '80px', left: '80px', zIndex: 20, color: '#fff', maxWidth: '600px' }}>
                <motion.h2 
                  initial={{ opacity: 0, y: 20 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  transition={{ delay: 0.5, duration: 0.8 }} 
                  style={{ fontSize: 'min(5vw, 64px)', fontWeight: 900, marginBottom: '24px', lineHeight: 1.1, letterSpacing: '-1px' }}
                >
                  Hunian Idaman, <br/>Keluarga Bahagia.
                </motion.h2>
                <motion.p 
                  initial={{ opacity: 0, y: 20 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  transition={{ delay: 0.7, duration: 0.8 }} 
                  style={{ fontSize: 'min(1.5vw, 20px)', opacity: 0.9, fontWeight: 500, lineHeight: 1.6 }}
                >
                  "Nikmati layanan administrasi warga yang modern, cepat, dan transparan di Ruang Warga VSJ."
                </motion.p>
              </div>
            </motion.div>
          </AnimatePresence>
          {/* Slide Indicators */}
          <div style={{ position: 'absolute', bottom: '40px', left: '60px', display: 'flex', gap: '8px', zIndex: 30 }}>
            {housingImages.map((_, i) => (
              <div key={i} style={{ width: i === currentSlide ? '32px' : '8px', height: '8px', borderRadius: '4px', backgroundColor: i === currentSlide ? '#3b82f6' : 'rgba(255,255,255,0.3)', transition: 'all 0.3s ease' }} />
            ))}
          </div>
        </div>

        {/* Right: Form */}
        <div className="right-form">
          <LoginForm 
            logo={logo} 
            nik={nik} setNik={setNik} 
            password={password} setPassword={setPassword}
            showPassword={showPassword} setShowPassword={setShowPassword}
            rememberMe={rememberMe} setRememberMe={setRememberMe}
            loading={loading} error={error}
            handleLoginSubmit={handleLoginSubmit}
            navigate={navigate}
            showContactModal={showContactModal}
            setShowContactModal={setShowContactModal}
            adminsList={adminsList}
            showForgotPasswordModal={showForgotPasswordModal}
            setShowForgotPasswordModal={setShowForgotPasswordModal}
            forgotEmail={forgotEmail}
            setForgotEmail={setForgotEmail}
            forgotLoading={forgotLoading}
            forgotError={forgotError}
            forgotSuccess={forgotSuccess}
            handleForgotPasswordSubmit={handleForgotPasswordSubmit}
            setForgotError={setForgotError}
            setForgotSuccess={setForgotSuccess}
          />
        </div>
      </div>

      {/* MOBILE VIEW (Unchanged) */}
      <div className="mobile-view">
        <LoginForm 
          logo={logo} 
          nik={nik} setNik={setNik} 
          password={password} setPassword={setPassword}
          showPassword={showPassword} setShowPassword={setShowPassword}
          rememberMe={rememberMe} setRememberMe={setRememberMe}
          loading={loading} error={error}
          handleLoginSubmit={handleLoginSubmit}
          navigate={navigate}
          showContactModal={showContactModal}
          setShowContactModal={setShowContactModal}
          adminsList={adminsList}
          showForgotPasswordModal={showForgotPasswordModal}
          setShowForgotPasswordModal={setShowForgotPasswordModal}
          forgotEmail={forgotEmail}
          setForgotEmail={setForgotEmail}
          forgotLoading={forgotLoading}
          forgotError={forgotError}
          forgotSuccess={forgotSuccess}
          handleForgotPasswordSubmit={handleForgotPasswordSubmit}
          setForgotError={setForgotError}
          setForgotSuccess={setForgotSuccess}
        />
      </div>

    </div>
  );
}

// Sub-component to avoid code duplication between views
function LoginForm({ 
  logo, nik, setNik, password, setPassword, 
  showPassword, setShowPassword, rememberMe, setRememberMe,
  loading, error, handleLoginSubmit, navigate,
  showContactModal, setShowContactModal, adminsList,
  showForgotPasswordModal, setShowForgotPasswordModal,
  forgotEmail, setForgotEmail, forgotLoading,
  forgotError, forgotSuccess, handleForgotPasswordSubmit,
  setForgotError, setForgotSuccess
}: any) {
  // Activation form states
  const [selectedAdminForForm, setSelectedAdminForForm] = useState<any>(null);
  const [formName, setFormName] = useState('');
  const [formNik, setFormNik] = useState('');
  const [formDob, setFormDob] = useState('');
  const [formWa, setFormWa] = useState('');
  const [formError, setFormError] = useState('');

  // Reset form when modal is closed
  useEffect(() => {
    if (!showContactModal) {
      setSelectedAdminForForm(null);
      setFormName('');
      setFormNik('');
      setFormDob('');
      setFormWa('');
      setFormError('');
    }
  }, [showContactModal]);

  const handleActivationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formName.trim()) {
      setFormError('Nama lengkap wajib diisi.');
      return;
    }

    if (formNik.length !== 16) {
      setFormError('NIK harus berjumlah tepat 16 digit.');
      return;
    }

    if (!formDob) {
      setFormError('Tanggal lahir wajib diisi.');
      return;
    }

    if (formWa.length < 10) {
      setFormError('Nomor WA aktif minimal 10 digit.');
      return;
    }

    // Format admin's phone number to clean E.164
    let formattedAdminPhone = selectedAdminForForm.phoneNumber.trim().replace(/\D/g, '');
    if (formattedAdminPhone.startsWith('0')) {
      formattedAdminPhone = '62' + formattedAdminPhone.substring(1);
    }

    // Format Date of Birth to readable DD-MM-YYYY format
    const parts = formDob.split('-');
    const formattedDob = parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : formDob;

    // Construct the formatted WhatsApp message
    const message = `Halo Admin Ruang Warga, saya ingin mengajukan aktivasi akun warga. Berikut data diri saya:

- Nama Lengkap: ${formName.trim()}
- NIK: ${formNik}
- Tanggal Lahir: ${formattedDob}
- Nomor WA Aktif: ${formWa}

Mohon bantuannya untuk memproses aktivasi ini. Terima kasih!`;

    const encodedMessage = encodeURIComponent(message);
    const waLink = `https://wa.me/${formattedAdminPhone}?text=${encodedMessage}`;

    // Open WhatsApp in a new tab
    window.open(waLink, '_blank', 'noopener,noreferrer');

    // Reset states and close modal
    setSelectedAdminForForm(null);
    setFormName('');
    setFormNik('');
    setFormDob('');
    setFormWa('');
    setShowContactModal(false);
  };

  return (
    <>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card"
      >
      <div className="glass-card-header" style={{ marginBottom: '24px', textAlign: 'center' }}>
        <img src={logo} alt="Logo" style={{ width: '120px', height: 'auto', margin: '0 auto 16px', display: 'block' }} />
        <h1 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '6px', color: '#111827' }}>Selamat Datang</h1>
        <p style={{ color: '#6b7280', fontSize: '14px' }}>Silakan masuk ke akun warga Anda</p>
      </div>

      <form onSubmit={handleLoginSubmit}>
        <AnimatePresence mode="wait">
          {error && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              style={{ background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '14px', padding: '14px', color: '#dc2626', fontSize: '14px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}
            >
              <AlertCircle size={18} /> {error}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="input-group">
          <label className="label">NIK atau Email</label>
          <div className="input-wrapper">
            <div className="input-icon"><UserIcon size={18} /></div>
            <input 
              type="text" 
              value={nik}
              onChange={(e) => setNik(e.target.value.trim())}
              placeholder="Masukkan NIK atau Email"
              className="input-field"
              required
            />
          </div>
        </div>

        <div className="input-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <label className="label" style={{ marginBottom: 0 }}>Password</label>
            <button 
              type="button" 
              onClick={() => {
                setForgotError('');
                setForgotSuccess('');
                setShowForgotPasswordModal(true);
              }}
              style={{ border: 'none', background: 'none', color: '#2563eb', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}
            >
              Lupa Password?
            </button>
          </div>
          <div className="input-wrapper">
            <div className="input-icon"><Lock size={18} /></div>
            <input 
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="input-field"
              required
            />
            <button 
              type="button" 
              onClick={() => setShowPassword(!showPassword)}
              style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', color: '#9ca3af', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <div style={{ height: '16px' }} />

        <button type="submit" disabled={loading} className="btn-login">
          {loading ? <Loader2 className="animate-spin" size={20} /> : <>Masuk ke Akun Warga <ChevronRight size={18} /></>}
        </button>
      </form>

      <div style={{ marginTop: '20px', borderTop: '1px solid #f3f4f6', paddingTop: '16px', textAlign: 'center' }}>
        <p style={{ fontSize: '13px', color: '#6b7280' }}>
          Ingin mengaktifkan akun warga? {' '}
          <button type="button" onClick={() => setShowContactModal(true)} style={{ border: 'none', background: 'none', color: '#2563eb', fontWeight: 800, cursor: 'pointer', textDecoration: 'underline' }}>Hubungi Admin</button>
        </p>
      </div>
    </motion.div>

    {/* Contact Admin WhatsApp Modal */}
    <AnimatePresence>
        {showContactModal && (
          <div className="contact-modal-overlay" style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}>
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              style={{
                width: '100%',
                maxWidth: '420px',
                background: '#ffffff',
                borderRadius: '28px',
                padding: '28px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                position: 'relative',
                color: '#1e293b'
              }}
            >
              <button 
                onClick={() => setShowContactModal(false)}
                style={{
                  position: 'absolute',
                  right: '20px',
                  top: '20px',
                  border: 'none',
                  background: 'rgba(241, 245, 249, 0.8)',
                  color: '#64748b',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '14px',
                  transition: 'all 0.2s',
                  zIndex: 20
                }}
              >
                ✕
              </button>

              {!selectedAdminForForm ? (
                <>
                  <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                    <img 
                      src="/vira_ai_berhasil.png" 
                      alt="Vira AI" 
                      style={{ 
                        width: '80px', 
                        height: '80px', 
                        objectFit: 'contain', 
                        display: 'block', 
                        margin: '0 auto 16px' 
                      }} 
                    />
                    <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', marginBottom: '6px' }}>
                      Hubungi Admin
                    </h3>
                    <p style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>
                      Pilih salah satu administrator resmi di bawah ini untuk aktivasi akun via WhatsApp
                    </p>
                  </div>

                  <div style={{ 
                    maxHeight: '280px', 
                    overflowY: 'auto', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '12px',
                    paddingRight: '4px'
                  }}>
                    {adminsList.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '30px 10px', color: '#64748b', fontSize: '13px' }}>
                        Belum ada kontak admin yang terdaftar.
                      </div>
                    ) : (
                      adminsList.map((admin: any) => {
                        // Generate a nice title for the admin's role
                        const roleLabel = admin.adminRole === 'rw' 
                          ? 'Ketua RW 011' 
                          : admin.adminRole === 'developer' 
                          ? 'Developer Sistem' 
                          : `Ketua RT ${admin.rt_id || '001'}`;

                        return (
                          <div 
                            key={admin.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '14px 16px',
                              background: '#f8fafc',
                              border: '1px solid #e2e8f0',
                              borderRadius: '16px',
                              transition: 'all 0.2s',
                              gap: '12px'
                            }}
                          >
                            <div style={{ textAlign: 'left', flex: 1 }}>
                              {admin.name && admin.name !== admin.username ? (
                                <>
                                  <div style={{ fontWeight: 800, fontSize: '14px', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '160px' }}>
                                    {admin.name}
                                  </div>
                                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, marginTop: '2px' }}>
                                    {roleLabel}
                                  </div>
                                </>
                              ) : (
                                <div style={{ fontWeight: 800, fontSize: '14px', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' }}>
                                  {roleLabel}
                                </div>
                              )}
                            </div>

                            <button 
                              onClick={() => setSelectedAdminForForm(admin)}
                              style={{
                                background: '#10b981',
                                color: '#ffffff',
                                border: 'none',
                                padding: '8px 14px',
                                borderRadius: '12px',
                                fontSize: '12px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)',
                                transition: 'all 0.2s',
                                flexShrink: 0
                              }}
                            >
                              Chat WA
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <button
                    onClick={() => setShowContactModal(false)}
                    style={{
                      width: '100%',
                      height: '48px',
                      background: '#f1f5f9',
                      color: '#475569',
                      border: 'none',
                      borderRadius: '14px',
                      fontSize: '14px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      marginTop: '20px',
                      transition: 'all 0.2s'
                    }}
                  >
                    Kembali
                  </button>
                </>
              ) : (
                <form onSubmit={handleActivationSubmit}>
                  <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                    <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', marginBottom: '6px' }}>
                      Aktivasi Akun Warga
                    </h3>
                    <p style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>
                      Kirim data diri ke admin <strong>{selectedAdminForForm.name || (selectedAdminForForm.adminRole === 'rw' ? 'Ketua RW 011' : selectedAdminForForm.adminRole === 'developer' ? 'Developer Sistem' : `Ketua RT ${selectedAdminForForm.rt_id || '001'}`)}</strong>
                    </p>
                  </div>

                  {formError && (
                    <div style={{ 
                      background: '#fef2f2', 
                      border: '1px solid #fee2e2', 
                      borderRadius: '12px', 
                      padding: '10px 14px', 
                      color: '#dc2626', 
                      fontSize: '13px', 
                      fontWeight: 500, 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '8px', 
                      marginBottom: '16px' 
                    }}>
                      <AlertCircle size={16} /> {formError}
                    </div>
                  )}

                  <div style={{ 
                    maxHeight: '280px', 
                    overflowY: 'auto', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '14px',
                    paddingRight: '4px',
                    marginBottom: '20px',
                    textAlign: 'left'
                  }}>
                    {/* Nama Lengkap */}
                    <div className="input-group" style={{ marginBottom: 0 }}>
                      <label className="label">Nama Lengkap</label>
                      <div className="input-wrapper">
                        <div className="input-icon"><UserIcon size={18} /></div>
                        <input 
                          type="text" 
                          value={formName}
                          onChange={(e) => setFormName(e.target.value)}
                          placeholder="Masukkan Nama Lengkap"
                          className="input-field"
                          required
                        />
                      </div>
                    </div>

                    {/* NIK */}
                    <div className="input-group" style={{ marginBottom: 0 }}>
                      <label className="label">NIK (16 Digit)</label>
                      <div className="input-wrapper">
                        <div className="input-icon"><Fingerprint size={18} /></div>
                        <input 
                          type="text" 
                          value={formNik}
                          onChange={(e) => setFormNik(e.target.value.replace(/\D/g, '').slice(0, 16))}
                          placeholder="Masukkan NIK"
                          className="input-field"
                          required
                        />
                      </div>
                    </div>

                    {/* Tanggal Lahir */}
                    <div className="input-group" style={{ marginBottom: 0 }}>
                      <label className="label">Tanggal Lahir</label>
                      <div className="input-wrapper">
                        <div className="input-icon"><Calendar size={18} /></div>
                        <input 
                          type="date" 
                          value={formDob}
                          onChange={(e) => setFormDob(e.target.value)}
                          className="input-field"
                          required
                          style={{ paddingRight: '16px' }}
                        />
                      </div>
                    </div>

                    {/* Nomor WA Aktif */}
                    <div className="input-group" style={{ marginBottom: 0 }}>
                      <label className="label">Nomor WA Aktif</label>
                      <div className="input-wrapper">
                        <div className="input-icon"><Phone size={18} /></div>
                        <input 
                          type="text" 
                          value={formWa}
                          onChange={(e) => setFormWa(e.target.value.replace(/\D/g, ''))}
                          placeholder="Contoh: 08123456789"
                          className="input-field"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                      type="button"
                      onClick={() => setSelectedAdminForForm(null)}
                      style={{
                        flex: 1,
                        height: '48px',
                        background: '#f1f5f9',
                        color: '#475569',
                        border: 'none',
                        borderRadius: '14px',
                        fontSize: '14px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      Batal
                    </button>
                    
                    <button
                      type="submit"
                      style={{
                        flex: 2,
                        height: '48px',
                        background: '#10b981',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '14px',
                        fontSize: '14px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)',
                        transition: 'all 0.2s'
                      }}
                    >
                      Kirim via WA
                    </button>
                  </div>
                </form>
              )}

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Forgot Password Modal Overlay */}
      <AnimatePresence>
        {showForgotPasswordModal && (
          <div className="forgot-password-modal-overlay" style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}>
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              style={{
                width: '100%',
                maxWidth: '420px',
                background: '#ffffff',
                borderRadius: '28px',
                padding: '28px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                position: 'relative',
                color: '#1e293b',
                textAlign: 'center'
              }}
            >
              <button 
                onClick={() => setShowForgotPasswordModal(false)}
                style={{
                  position: 'absolute',
                  right: '20px',
                  top: '20px',
                  border: 'none',
                  background: 'rgba(241, 245, 249, 0.8)',
                  color: '#64748b',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '14px',
                  transition: 'all 0.2s',
                  zIndex: 20
                }}
              >
                ✕
              </button>

              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <img 
                  src="/vira_ai_confirm.png" 
                  alt="Reset Password" 
                  style={{ 
                    width: '80px', 
                    height: '80px', 
                    objectFit: 'contain', 
                    display: 'block', 
                    margin: '0 auto 16px' 
                  }} 
                />
                <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', marginBottom: '6px' }}>
                  Lupa Password Warga
                </h3>
                <p style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>
                  Masukkan email terverifikasi Anda untuk menerima tautan atur ulang password.
                </p>
              </div>

              {forgotError && (
                <div style={{ 
                  background: '#fef2f2', 
                  border: '1px solid #fee2e2', 
                  borderRadius: '12px', 
                  padding: '10px 14px', 
                  color: '#dc2626', 
                  fontSize: '13px', 
                  fontWeight: 500, 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px', 
                  marginBottom: '16px',
                  textAlign: 'left'
                }}>
                  <AlertCircle size={16} /> {forgotError}
                </div>
              )}

              {forgotSuccess && (
                <div style={{ 
                  background: '#f0fdf4', 
                  border: '1px solid #dcfce7', 
                  borderRadius: '12px', 
                  padding: '10px 14px', 
                  color: '#15803d', 
                  fontSize: '13px', 
                  fontWeight: 500, 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px', 
                  marginBottom: '16px',
                  textAlign: 'left'
                }}>
                  <CheckCircle2 size={16} /> {forgotSuccess}
                </div>
              )}

              <form onSubmit={handleForgotPasswordSubmit}>
                <div className="input-group" style={{ marginBottom: '20px', textAlign: 'left' }}>
                  <label className="label">Alamat Email</label>
                  <div className="input-wrapper">
                    <div className="input-icon"><UserIcon size={18} /></div>
                    <input 
                      type="email" 
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="Gunakan email terverifikasi untuk reset password"
                      className="input-field"
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    type="button"
                    onClick={() => setShowForgotPasswordModal(false)}
                    style={{
                      flex: 1,
                      height: '48px',
                      background: '#f1f5f9',
                      color: '#475569',
                      border: 'none',
                      borderRadius: '14px',
                      fontSize: '14px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    Batal
                  </button>
                  
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    style={{
                      flex: 2,
                      height: '48px',
                      background: '#2563eb',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '14px',
                      fontSize: '14px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)',
                      transition: 'all 0.2s'
                    }}
                  >
                    {forgotLoading ? <Loader2 className="animate-spin" size={16} /> : 'Kirim Link Reset'}
                  </button>
                </div>
              </form>

            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
