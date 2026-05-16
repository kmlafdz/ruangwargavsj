import React, { useState, useEffect } from 'react';
import { 
  User as UserIcon, Lock, CheckCircle2, AlertCircle, 
  Loader2, Eye, EyeOff, Fingerprint, Globe, 
  ChevronRight, HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { User } from '../types';
import logo from '../assets/login/logo.png';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase/config';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { authenticateBiometric, isBiometricAvailable } from '../services/biometricService';

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
  const [verifyingBiometric, setVerifyingBiometric] = useState(false);
  const [biometricSuccess, setBiometricSuccess] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  useEffect(() => {
    isBiometricAvailable().then(setBiometricAvailable);
  }, []);
  
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % housingImages.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (nik.length !== 16) {
      setError('NIK harus berjumlah tepat 16 digit.');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const q = query(collection(db, 'users'), where('username', '==', nik), where('role', '==', 'warga'));
      const snap = await getDocs(q);
      
      if (snap.empty) {
         throw new Error('Akun NIK tidak ditemukan. Silakan hubungi Admin.');
      }

      const userData = { id: snap.docs[0].id, ...snap.docs[0].data() } as User;

      // 1. Password Verification
      // Note: In a production app, use hashed passwords. For this demo, we compare direct strings.
      if (userData.password !== password) {
         throw new Error('Password yang Anda masukkan salah.');
      }
      
      // 2. Check for account status
      if (userData.accountStatus === 'pending_registration' || userData.isFirstLogin) {
        onLogin(userData);
        return;
      }

      if (userData.accountStatus === 'waiting_admin_approval') {
         throw new Error('Akun Anda sedang menunggu persetujuan Admin.');
      }

      if (userData.accountStatus === 'rejected') {
         // Redirecting to revision is handled by App.tsx, but we allow login here
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

  const handleFingerprintLogin = async () => {
    if (!nik) {
      setError('Masukkan NIK Anda terlebih dahulu.');
      return;
    }

    setVerifyingBiometric(true);
    setError('');
    
    try {
      // 1. Get user data to find the biometric credential ID
      const q = query(collection(db, 'users'), where('username', '==', nik), where('role', '==', 'warga'));
      const snap = await getDocs(q);
      
      if (snap.empty) {
        throw new Error('NIK tidak ditemukan.');
      }

      const userData = { id: snap.docs[0].id, ...snap.docs[0].data() } as User;

      if (!userData.biometricEnabled || !userData.biometricCredentialId) {
        throw new Error('Biometrik belum diaktifkan untuk akun ini.');
      }

      // 2. Trigger real hardware biometric authentication
      const success = await authenticateBiometric(userData.biometricCredentialId);
      
      if (success) {
        setBiometricSuccess(true);
        setTimeout(() => {
          onLogin(userData);
        }, 1500);
      } else {
        throw new Error('Autentikasi biometrik dibatalkan atau gagal.');
      }
    } catch (err: any) {
      setError(err.message || 'Login biometrik gagal.');
      setVerifyingBiometric(false);
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
          .login-page-root { padding: 16px; align-items: center; overflow: hidden; display: flex; touch-action: pan-y; }
          .desktop-split { display: none; }
          .mobile-view { width: 100%; display: flex; align-items: center; justify-content: center; }
          .glass-card { padding: 24px 20px; border-radius: 24px; width: 100%; margin: 0; max-width: 100%; }
          .blob { width: 200px; height: 200px; }
          h1 { font-size: 20px !important; margin-bottom: 4px !important; }
          p { font-size: 12px !important; }
          .btn-login, .input-field { height: 46px; font-size: 14px; }
          .input-group { margin-bottom: 12px; }
          img { width: 40px !important; height: 40px !important; margin-bottom: 12px !important; }
          .glass-card-header { margin-bottom: 20px !important; }
          .btn-fingerprint { height: 44px; margin-top: 12px; font-size: 13px; }
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
            handleFingerprintLogin={handleFingerprintLogin}
            navigate={navigate}
            biometricAvailable={biometricAvailable}
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
          handleFingerprintLogin={handleFingerprintLogin}
          navigate={navigate}
          biometricAvailable={biometricAvailable}
        />
      </div>

      {/* Biometric Overlay */}
      <AnimatePresence>
        {verifyingBiometric && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(12px)' }}
          >
            <motion.div 
              initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '40px', padding: '48px', maxWidth: '360px', width: '100%', textAlign: 'center' }}
            >
              <div style={{ width: '80px', height: '80px', margin: '0 auto 32px', position: 'relative' }}>
                <div style={{ position: 'absolute', inset: 0, background: '#eff6ff', borderRadius: '50%' }}></div>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: biometricSuccess ? '#22c55e' : '#3b82f6' }}>
                  <Fingerprint size={48} className={biometricSuccess ? "" : "animate-pulse"} />
                </div>
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '8px', color: '#111827' }}>{biometricSuccess ? "Berhasil!" : "Verifikasi Sidik Jari"}</h3>
              <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '32px' }}>Gunakan biometrik perangkat untuk akses aman.</p>
              {!biometricSuccess && <button onClick={() => setVerifyingBiometric(false)} style={{ border: 'none', background: 'none', color: '#f87171', fontWeight: 700, textTransform: 'uppercase', fontSize: '12px', cursor: 'pointer' }}>Batal</button>}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Sub-component to avoid code duplication between views
function LoginForm({ 
  logo, nik, setNik, password, setPassword, 
  showPassword, setShowPassword, rememberMe, setRememberMe,
  loading, error, handleLoginSubmit, handleFingerprintLogin, navigate, biometricAvailable
}: any) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card"
    >
      <div className="glass-card-header" style={{ marginBottom: '24px', textAlign: 'center' }}>
        <img src={logo} alt="Logo" style={{ width: '60px', height: '60px', margin: '0 auto 16px' }} />
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
          <label className="label">NIK (16 Digit)</label>
          <div className="input-wrapper">
            <div className="input-icon"><UserIcon size={18} /></div>
            <input 
              type="text" 
              value={nik}
              onChange={(e) => setNik(e.target.value.replace(/\D/g, '').slice(0, 16))}
              placeholder="Masukkan NIK"
              className="input-field"
              required
            />
          </div>
        </div>

        <div className="input-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <label className="label" style={{ marginBottom: 0 }}>Password</label>
            <button type="button" style={{ border: 'none', background: 'none', color: '#2563eb', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}>Lupa Password?</button>
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '32px' }}>
          <input 
            type="checkbox" 
            id="rem-warga" 
            checked={rememberMe} 
            onChange={(e) => setRememberMe(e.target.checked)}
            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
          />
          <label htmlFor="rem-warga" style={{ fontSize: '14px', color: '#4b5563', fontWeight: 500, cursor: 'pointer' }}>Ingat saya</label>
        </div>

        <button type="submit" disabled={loading} className="btn-login">
          {loading ? <Loader2 className="animate-spin" size={20} /> : <>Masuk ke Akun Warga <ChevronRight size={18} /></>}
        </button>

        {biometricAvailable && (
          <button type="button" onClick={handleFingerprintLogin} className="btn-fingerprint" style={{ marginTop: '16px', border: '1.5px solid #3b82f6', color: '#1e3a8a' }}>
            <Fingerprint size={20} /> Masuk dengan Sidik Jari
          </button>
        )}
      </form>

      <div style={{ marginTop: '20px', borderTop: '1px solid #f3f4f6', paddingTop: '16px', textAlign: 'center' }}>
        <p style={{ fontSize: '13px', color: '#6b7280' }}>
          Ingin mengaktifkan akun warga? {' '}
          <button onClick={() => navigate('/help')} style={{ border: 'none', background: 'none', color: '#2563eb', fontWeight: 800, cursor: 'pointer', textDecoration: 'underline' }}>Hubungi Admin</button>
        </p>
      </div>
    </motion.div>
  );
}
