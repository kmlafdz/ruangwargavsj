import React, { useState, useEffect } from 'react';
import { 
  User as UserIcon, Lock, ShieldCheck, 
  Loader2, Eye, EyeOff, ChevronRight, 
  ShieldAlert, LogIn,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { User } from '../types';
import logo from '../assets/login/logo.png';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase/config';
import { collection, query, where, getDocs } from 'firebase/firestore';

// Images from public assets
const housingImages = [
  "/assets/housing/housing1.png",
  "/assets/housing/housing2.png",
  "/assets/housing/housing3.png"
];

interface LoginPageProps {
  onLogin: (user: User) => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % housingImages.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // DEV BYPASS
    if (username === 'kemaldev' && password === '1234') {
      onLogin({
        id: 'dev-admin',
        username: 'kemaldev',
        name: 'Developer Admin',
        role: 'developer',
        rt_id: 'RT 001',
        accountStatus: 'active'
      } as User);
      return;
    }

    try {
      const q = query(collection(db, 'users'), where('username', '==', username));
      const snap = await getDocs(q);
      
      if (snap.empty) {
        throw new Error('Username tidak terdaftar.');
      }

      const userData = { id: snap.docs[0].id, ...snap.docs[0].data() } as User;

      if (userData.password !== password) {
        throw new Error('Password salah.');
      }

      onLogin(userData);
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
          background: #020617;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
          font-family: 'Inter', sans-serif;
        }
        .desktop-split {
          display: none;
          width: 100%;
          height: 100vh;
          flex-direction: row;
          background: #020617;
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
          background: #020617;
          background-image: radial-gradient(at 100% 0%, #1e3a8a 0, transparent 50%);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px;
          position: relative;
          z-index: 10;
          box-shadow: -10px 0 30px rgba(0,0,0,0.3);
        }
        .glass-card-admin {
          width: 100%;
          max-width: 400px;
          max-height: calc(100vh - 120px);
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 32px;
          padding: 40px;
          position: relative;
          z-index: 10;
          box-shadow: 0 50px 120px rgba(0, 0, 0, 0.4);
          color: #0f172a;
          overflow: visible;
        }
        .admin-input-group {
          margin-bottom: 24px;
          text-align: left;
        }
        .admin-label {
          display: block;
          font-size: 10px;
          font-weight: 900;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.2em;
          margin-bottom: 8px;
          margin-left: 8px;
          text-align: left;
        }
        .admin-input-field {
          width: 100%;
          height: 52px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 0 48px;
          font-size: 14px;
          font-weight: 600;
          color: #0f172a;
          outline: none;
          transition: all 0.3s ease;
        }
        .admin-input-field:focus {
          border-color: #1e3a8a;
          background: #fff;
          box-shadow: 0 0 0 4px rgba(30, 58, 138, 0.1);
        }
        .admin-btn-primary {
          width: 100%;
          height: 56px;
          background: #1e3a8a;
          color: #fff;
          border: none;
          border-radius: 16px;
          font-size: 13px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.15em;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          box-shadow: 0 20px 30px rgba(30, 58, 138, 0.2);
          transition: all 0.2s;
        }
        .admin-btn-primary:hover { background: #1e40af; transform: translateY(-2px); }
        .admin-btn-primary:active { transform: scale(0.98); }
        .admin-input-field::-ms-reveal, .admin-input-field::-ms-clear { display: none; }
        
        .blob {
          position: absolute;
          width: 600px;
          height: 600px;
          background: #2563eb;
          filter: blur(120px);
          opacity: 0.15;
          border-radius: 50%;
          z-index: 0;
          animation: float-admin-blob 25s infinite alternate;
        }
        @keyframes float-admin-blob {
          0% { transform: translate(-150px, -150px) scale(1); }
          100% { transform: translate(150px, 150px) scale(1.3); }
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
          .glass-card-admin { padding: 24px 20px; border-radius: 24px; width: 100%; margin: 0; max-width: 100%; }
          .blob { width: 200px; height: 200px; }
          h1 { font-size: 18px !important; margin-bottom: 4px !important; }
          .admin-btn-primary, .admin-input-field { height: 48px; font-size: 12px; }
          .admin-input-group { margin-bottom: 12px; }
          .admin-card-header { margin-bottom: 20px !important; }
          .admin-card-header img { width: 40px !important; height: 40px !important; margin-bottom: 12px !important; }
        }
      `}} />

      <div className="mobile-view-blobs">
        <div className="blob" style={{ top: '-150px', left: '-150px' }} />
        <div className="blob" style={{ bottom: '-150px', right: '-150px', background: '#4338ca' }} />
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
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(2,6,23,0.8), rgba(2,6,23,0.2))' }} />
              <div style={{ position: 'absolute', bottom: '80px', left: '80px', zIndex: 20, color: '#fff', maxWidth: '600px' }}>
                <motion.h2 
                  initial={{ opacity: 0, y: 20 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  transition={{ delay: 0.5, duration: 0.8 }} 
                  style={{ fontSize: 'min(5vw, 64px)', fontWeight: 900, marginBottom: '24px', lineHeight: 1.1, letterSpacing: '-1px' }}
                >
                  Akses Terenkripsi, <br/>Sistem Terpadu.
                </motion.h2>
                <motion.p 
                  initial={{ opacity: 0, y: 20 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  transition={{ delay: 0.7, duration: 0.8 }} 
                  style={{ fontSize: 'min(1.5vw, 20px)', opacity: 0.9, fontWeight: 500, lineHeight: 1.6 }}
                >
                  "Panel kendali administratif Ruang Warga VSJ. Amankan data, kelola pelayanan, dan monitor komunitas dengan satu akses terpercaya."
                </motion.p>
              </div>
            </motion.div>
          </AnimatePresence>
          <div style={{ position: 'absolute', bottom: '40px', left: '60px', display: 'flex', gap: '8px', zIndex: 30 }}>
            {housingImages.map((_, i) => (
              <div key={i} style={{ width: i === currentSlide ? '32px' : '8px', height: '8px', borderRadius: '4px', backgroundColor: i === currentSlide ? '#3b82f6' : 'rgba(255,255,255,0.3)', transition: 'all 0.3s ease' }} />
            ))}
          </div>
        </div>

        {/* Right: Form */}
        <div className="right-form">
          <AdminLoginForm 
            logo={logo} username={username} setUsername={setUsername}
            password={password} setPassword={setPassword}
            showPassword={showPassword} setShowPassword={setShowPassword}
            loading={loading} error={error}
            handleLoginSubmit={handleLoginSubmit}
            navigate={navigate}
          />
        </div>
      </div>

      {/* MOBILE VIEW (Unchanged) */}
      <div className="mobile-view">
        <AdminLoginForm 
          logo={logo} username={username} setUsername={setUsername}
          password={password} setPassword={setPassword}
          showPassword={showPassword} setShowPassword={setShowPassword}
          loading={loading} error={error}
          handleLoginSubmit={handleLoginSubmit}
          navigate={navigate}
        />
      </div>

    </div>
  );
}

function AdminLoginForm({ 
  logo, username, setUsername, password, setPassword, 
  showPassword, setShowPassword, loading, error, 
  handleLoginSubmit, navigate 
}: any) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card-admin"
    >
      <div className="admin-card-header" style={{ marginBottom: '24px', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '60px', height: '60px', background: 'rgba(0,0,0,0.05)', borderRadius: '18px', border: '1px solid rgba(0,0,0,0.05)', padding: '12px', marginBottom: '20px', position: 'relative' }}>
          <img src={logo} alt="Logo" style={{ width: '100%', objectFit: 'contain', zIndex: 10 }} />
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(59, 130, 246, 0.1)', filter: 'blur(15px)', borderRadius: '50%' }} />
        </div>
        <h1 style={{ fontSize: '24px', fontWeight: 900, marginBottom: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', fontStyle: 'italic', color: '#0f172a' }}>
          <ShieldCheck size={24} style={{ color: '#1e3a8a' }} /> Secure Access
        </h1>
        <p style={{ fontSize: '9px', fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4em' }}>Admin & Developer Control</p>
      </div>

      <form onSubmit={handleLoginSubmit}>
        <AnimatePresence mode="wait">
          {error && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} style={{ background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '14px', padding: '16px', color: '#dc2626', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
              <ShieldAlert size={18} /> {error}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="admin-input-group">
          <label className="admin-label">Administrator Identity</label>
          <div style={{ position: 'relative' }}>
            <UserIcon size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="ID Admin" className="admin-input-field" required />
          </div>
        </div>

        <div className="admin-input-group">
          <label className="admin-label">Access Credentials</label>
          <div style={{ position: 'relative' }}>
            <Lock size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            <input type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="admin-input-field" required />
            <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', color: '#9ca3af', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <button type="submit" disabled={loading} className="admin-btn-primary">
          {loading ? <Loader2 className="animate-spin" size={20} /> : <>Authorize Entry <ChevronRight size={18} /></>}
        </button>
      </form>

      <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #f3f4f6', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <button 
          onClick={async () => {
            try {
              const { setDoc, doc } = await import('firebase/firestore');
              await setDoc(doc(db, 'users', 'kemaldev'), {
                username: 'kemaldev',
                password: '1234',
                name: 'Kemal Developer',
                role: 'developer',
                rt_id: 'RT 001',
                accountStatus: 'active',
                createdAt: new Date()
              });
              alert('Kredensial kemaldev berhasil disimpan ke Database!');
            } catch (e) {
              alert('Gagal simpan ke DB: ' + e);
            }
          }}
          style={{ border: 'none', background: 'none', color: '#1e3a8a', fontWeight: 900, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.2em', cursor: 'pointer', textDecoration: 'underline' }}
        >
          <ShieldCheck size={14} style={{ marginRight: 6 }} /> Sync dev to Database
        </button>

        <button onClick={() => navigate('/warga-login')} style={{ border: 'none', background: 'none', color: '#64748b', fontWeight: 900, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.2em', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', margin: '0 auto' }}>
          <LogIn size={14} /> Back to Warga Login
        </button>
      </div>
    </motion.div>
  );
}
