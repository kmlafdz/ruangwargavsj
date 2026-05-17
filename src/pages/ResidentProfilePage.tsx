import React, { useState, useEffect } from 'react';
import { 
  User as UserIcon, Calendar, MapPin, ShieldCheck, 
  Settings, LogOut, Eye, EyeOff, CreditCard, Users, 
  ArrowRight, CheckCircle2, ChevronRight, Phone, MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { User } from '../types';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase/config';
import { doc, onSnapshot } from 'firebase/firestore';

interface ResidentProfilePageProps {
  user: User | null;
  onLogout: () => void;
}

export default function ResidentProfilePage({ user: initialUser, onLogout }: ResidentProfilePageProps) {
  const [user, setUser] = useState<User | null>(initialUser);
  const [showNik, setShowNik] = useState(false);
  const [showKk, setShowKk] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const navigate = useNavigate();

  // PIN Verification for Sensitive Data
  const [pinVerificationMode, setPinVerificationMode] = useState<'nik' | 'kk' | null>(null);
  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState(false);

  const handleToggleNik = () => {
    if (showNik) {
      setShowNik(false);
    } else {
      if (user?.pin) {
        setPinVerificationMode('nik');
        setEnteredPin('');
        setPinError(false);
      } else {
        setShowNik(true);
      }
    }
  };

  const handleToggleKk = () => {
    if (showKk) {
      setShowKk(false);
    } else {
      if (user?.pin) {
        setPinVerificationMode('kk');
        setEnteredPin('');
        setPinError(false);
      } else {
        setShowKk(true);
      }
    }
  };

  const handlePinKeyPress = (num: string) => {
    if (pinError) return;
    if (enteredPin.length < 6) {
      const nextPin = enteredPin + num;
      setEnteredPin(nextPin);

      if (nextPin === user?.pin) {
        setTimeout(() => {
          if (pinVerificationMode === 'nik') {
            setShowNik(true);
          } else if (pinVerificationMode === 'kk') {
            setShowKk(true);
          }
          setPinVerificationMode(null);
          setEnteredPin('');
        }, 300);
      } else if (nextPin.length === 6) {
        setTimeout(() => {
          setPinError(true);
          setEnteredPin('');
          setTimeout(() => setPinError(false), 500);
        }, 200);
      }
    }
  };

  const handlePinDelete = () => {
    if (enteredPin.length > 0) {
      setEnteredPin(enteredPin.slice(0, -1));
    }
  };

  // Sync user data in real-time
  useEffect(() => {
    if (!initialUser?.id) return;
    const unsubscribe = onSnapshot(doc(db, 'users', initialUser.id), (snap) => {
      if (snap.exists()) {
        const latest = { id: snap.id, ...snap.data() } as User;
        setUser(latest);
      }
    });
    return unsubscribe;
  }, [initialUser?.id]);

  if (!user) return null;

  const initials = user.name 
    ? user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'W';

  // Format joined date beautifully
  const formatJoinedDate = (createdAt: any) => {
    if (!createdAt) return '17 Mei 2026';
    try {
      const date = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
      return date.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    } catch (e) {
      return '17 Mei 2026';
    }
  };

  // Mask NIK helper
  const getMaskedText = (text: string | undefined, show: boolean, fallback: string) => {
    if (!text) return fallback;
    if (show) return text;
    if (text.length <= 8) return '****' + text.slice(-4);
    return text.slice(0, 4) + ' •••••••• ' + text.slice(-4);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className="resident-profile-container" 
      style={{
        background: '#f8fafc',
        minHeight: '100vh',
        padding: '24px 16px 120px',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Background Blobs for Luxury Aesthetic */}
      <div style={{
        position: 'absolute',
        width: '400px',
        height: '400px',
        background: '#e0f2fe',
        filter: 'blur(100px)',
        opacity: 0.5,
        borderRadius: '50%',
        top: '-100px',
        left: '-100px',
        zIndex: 0,
        pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute',
        width: '400px',
        height: '400px',
        background: '#fef2f2',
        filter: 'blur(100px)',
        opacity: 0.5,
        borderRadius: '50%',
        bottom: '-100px',
        right: '-100px',
        zIndex: 0,
        pointerEvents: 'none'
      }} />

      {/* Logout Confirmation Modal */}
      <AnimatePresence>
        {showLogoutConfirm && (
          <div className="modal-overlay" style={{
            position: 'fixed',
            inset: 0,
            zIndex: 5000,
            background: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}>
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              style={{
                background: '#ffffff',
                width: '100%',
                maxWidth: '380px',
                borderRadius: '28px',
                padding: '28px',
                textAlign: 'center',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
              }}
            >
              <div style={{ position: 'relative', width: 140, height: 140, margin: '0 auto 20px' }}>
                <img 
                  src="/vira_ai_confirm.png" 
                  alt="Vira AI Confirm" 
                  style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '16px' }} 
                />
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a', marginBottom: '8px' }}>
                Konfirmasi Keluar
              </h3>
              <p style={{ color: '#64748b', fontSize: '13px', lineHeight: 1.5, marginBottom: '24px' }}>
                Apakah Anda yakin ingin keluar dari aplikasi Ruang Warga VSJ?
              </p>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button 
                  onClick={() => setShowLogoutConfirm(false)}
                  style={{
                    flex: 1,
                    height: '46px',
                    borderRadius: '14px',
                    border: '1px solid #e2e8f0',
                    background: '#ffffff',
                    color: '#64748b',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  Batal
                </button>
                <button 
                  onClick={onLogout}
                  style={{
                    flex: 1,
                    height: '46px',
                    borderRadius: '14px',
                    border: 'none',
                    background: '#ef4444',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  Keluar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div style={{ position: 'relative', zIndex: 1, maxWidth: '480px', margin: '0 auto' }}>
        {/* Header */}
        <header style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a', margin: 0 }}>Profil Warga</h2>
            <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>Informasi kartu identitas & keanggotaan Anda</p>
          </div>
        </header>

        {/* Premium Digital ID Card */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="digital-id-card" 
          style={{
            background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
            color: '#ffffff',
            borderRadius: '24px',
            padding: '24px',
            boxShadow: '0 20px 40px rgba(30, 58, 138, 0.25)',
            position: 'relative',
            overflow: 'hidden',
            marginBottom: '24px'
          }}
        >
          {/* Card Accent Grid Decoration */}
          <div style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'radial-gradient(circle at 80% 20%, rgba(255,255,255,0.15) 0%, transparent 60%)',
            pointerEvents: 'none',
            zIndex: 1
          }} />

          {/* Card Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 2, marginBottom: '20px' }}>
            <div>
              <div style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px', opacity: 0.7 }}>
                KARTU IDENTITAS DIGITAL
              </div>
              <div style={{ fontSize: '15px', fontWeight: 900, marginTop: '2px' }}>
                VILA SAMUDRA JAYA
              </div>
            </div>
            <div style={{ 
              background: 'rgba(255, 255, 255, 0.15)',
              backdropFilter: 'blur(4px)',
              padding: '6px 12px',
              borderRadius: '10px',
              fontSize: '10px',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <ShieldCheck size={12} /> VERIFIED RESIDENT
            </div>
          </div>

          {/* Profile Core */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', position: 'relative', zIndex: 2, marginBottom: '24px' }}>
            <div style={{
              width: '84px',
              height: '84px',
              borderRadius: '20px',
              background: 'rgba(255, 255, 255, 0.2)',
              border: '2px solid rgba(255, 255, 255, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              boxShadow: '0 8px 16px rgba(0,0,0,0.15)',
              flexShrink: 0
            }}>
              {user.photoUrl ? (
                <img src={user.photoUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontSize: '28px', fontWeight: 900, color: '#ffffff' }}>{initials}</span>
              )}
            </div>
            <div style={{ textAlign: 'left', overflow: 'hidden' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 900, margin: 0, textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user.name}
              </h3>
              <div style={{ fontSize: '12px', opacity: 0.9, fontWeight: 700, marginTop: '3px' }}>
                RT {user.rt_id || '001'} / RW 011
              </div>
              <div style={{ 
                fontSize: '11px', 
                background: 'rgba(16, 185, 129, 0.25)', 
                color: '#34d399',
                border: '1px solid rgba(52, 211, 153, 0.3)',
                padding: '3px 8px', 
                borderRadius: '8px', 
                display: 'inline-block', 
                fontWeight: 800,
                marginTop: '8px'
              }}>
                🟢 {user.accountStatus === 'active' ? 'AKUN AKTIF' : 'PENDING'}
              </div>
            </div>
          </div>

          {/* Card Footer: Metadata Grid */}
          <div style={{ 
            borderTop: '1px solid rgba(255,255,255,0.2)', 
            paddingTop: '16px', 
            display: 'grid', 
            gridTemplateColumns: '1fr 1fr', 
            gap: '12px',
            position: 'relative', 
            zIndex: 2 
          }}>
            <div>
              <div style={{ fontSize: '9px', opacity: 0.7, fontWeight: 700, textTransform: 'uppercase' }}>TANGGAL BERGABUNG</div>
              <div style={{ fontSize: '13px', fontWeight: 800, marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Calendar size={13} style={{ opacity: 0.8 }} /> {formatJoinedDate(user.createdAt)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '9px', opacity: 0.7, fontWeight: 700, textTransform: 'uppercase' }}>JABATAN WARGA</div>
              <div style={{ fontSize: '13px', fontWeight: 800, marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Users size={13} style={{ opacity: 0.8 }} /> {user.communityPosition || 'Warga Tetap'}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Detailed Information Section */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          style={{
            background: '#ffffff',
            borderRadius: '24px',
            padding: '24px',
            border: '1px solid #e2e8f0',
          boxShadow: '0 4px 20px rgba(0,0,0,0.02)',
          marginBottom: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          <h4 style={{ fontSize: '15px', fontWeight: 900, color: '#0f172a', margin: '0 0 4px 0', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
            Detail Data Kependudukan
          </h4>

          {/* NIK Field */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Nomor Induk Kependudukan (NIK)</div>
              <div style={{ fontSize: '14px', fontWeight: 800, color: '#1e293b', fontFamily: 'monospace', marginTop: '3px' }}>
                {getMaskedText(user.nik || user.username, showNik, '3275 •••••••• ••••')}
              </div>
            </div>
            <button 
              type="button"
              onClick={handleToggleNik}
              style={{ border: 'none', background: '#f8fafc', color: '#64748b', width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
              {showNik ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {/* No KK Field */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f8fafc', paddingTop: '12px' }}>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Nomor Kartu Keluarga (KK)</div>
              <div style={{ fontSize: '14px', fontWeight: 800, color: '#1e293b', fontFamily: 'monospace', marginTop: '3px' }}>
                {getMaskedText(user.noKK, showKk, '3275 •••••••• ••••')}
              </div>
            </div>
            <button 
              type="button"
              onClick={handleToggleKk}
              style={{ border: 'none', background: '#f8fafc', color: '#64748b', width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
              {showKk ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {/* Hubungan Keluarga Field */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f8fafc', paddingTop: '12px' }}>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Status Hubungan Keluarga</div>
              <div style={{ fontSize: '14px', fontWeight: 800, color: '#1e293b', marginTop: '3px' }}>
                {user.hubunganKeluarga || 'Kepala Keluarga / Mandiri'}
              </div>
            </div>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#ecfdf5', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={16} />
            </div>
          </div>

          {/* Wilayah RT/RW Field */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f8fafc', paddingTop: '12px' }}>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Wilayah Administratif</div>
              <div style={{ fontSize: '14px', fontWeight: 800, color: '#1e293b', marginTop: '3px' }}>
                RT {user.rt_id || '001'} / RW 011
              </div>
            </div>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#e0f2fe', color: '#0369a1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MapPin size={16} />
            </div>
          </div>
        </motion.div>

        {/* Quick Actions Navigation Buttons */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
        >
          <button 
            onClick={() => navigate('/warga/setting')}
            style={{
              width: '100%',
              height: '52px',
              borderRadius: '16px',
              border: 'none',
              background: '#2563eb',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 14px rgba(37,99,235,0.2)',
              transition: 'all 0.2s'
            }}
          >
            <Settings size={18} /> Ubah Pengaturan Akun
          </button>
          
          <button 
            onClick={() => setShowLogoutConfirm(true)}
            style={{
              width: '100%',
              height: '52px',
              borderRadius: '16px',
              border: '1px solid #fee2e2',
              background: '#fef2f2',
              color: '#ef4444',
              fontWeight: 800,
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.2s'
            }}
          >
            <LogOut size={18} /> Keluar Aplikasi
          </button>
        </motion.div>
      </div>

      {/* PIN Verification Modal Overlay */}
      <AnimatePresence>
        {pinVerificationMode && (
          <div className="modal-overlay" style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(15, 23, 42, 0.4)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              style={{
                background: '#ffffff',
                width: '100%',
                maxWidth: '320px',
                borderRadius: '28px',
                padding: '28px',
                textAlign: 'center',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
                color: '#0f172a',
                fontFamily: 'system-ui, -apple-system, sans-serif'
              }}
            >
              <div style={{
                width: '56px',
                height: '56px',
                background: 'rgba(37, 99, 235, 0.05)',
                color: '#2563eb',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
                border: '1.5px solid rgba(37, 99, 235, 0.15)'
              }}>
                <ShieldCheck size={26} />
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 900, marginBottom: '6px', letterSpacing: '-0.5px' }}>
                Verifikasi PIN Anda
              </h3>
              <p style={{ color: 'rgba(15, 23, 42, 0.6)', fontSize: '12px', lineHeight: 1.5, marginBottom: '24px' }}>
                Masukkan 6 digit PIN Transaksi Anda untuk melihat data sensitif ini.
              </p>

              {/* Dots */}
              <div className={pinError ? 'shake-dots' : ''} style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '28px' }}>
                {[0, 1, 2, 3, 4, 5].map((idx) => {
                  const hasVal = enteredPin.length > idx;
                  return (
                    <div 
                      key={idx}
                      style={{
                        width: '14px',
                        height: '14px',
                        borderRadius: '50%',
                        border: pinError 
                          ? '2px solid #ef4444' 
                          : hasVal 
                            ? '2px solid #2563eb' 
                            : '2px solid rgba(15, 23, 42, 0.15)',
                        background: pinError 
                          ? '#ef4444' 
                          : hasVal 
                            ? '#2563eb' 
                            : 'transparent',
                        transform: hasVal ? 'scale(1.1)' : 'scale(1)',
                        transition: 'all 0.15s ease'
                      }}
                    />
                  );
                })}
              </div>

              {/* Keypad */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '12px 14px',
                width: '100%',
                maxWidth: '240px',
                margin: '0 auto 16px'
              }}>
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                  <button
                    key={num}
                    onClick={() => handlePinKeyPress(num)}
                    style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '50%',
                      border: '1px solid rgba(15, 23, 42, 0.08)',
                      background: 'rgba(15, 23, 42, 0.03)',
                      color: '#0f172a',
                      fontSize: '18px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      outline: 'none',
                      transition: 'all 0.1s ease'
                    }}
                    onMouseDown={(e) => (e.currentTarget.style.background = 'rgba(15, 23, 42, 0.12)')}
                    onMouseUp={(e) => (e.currentTarget.style.background = 'rgba(15, 23, 42, 0.03)')}
                    onTouchStart={(e) => (e.currentTarget.style.background = 'rgba(15, 23, 42, 0.12)')}
                    onTouchEnd={(e) => (e.currentTarget.style.background = 'rgba(15, 23, 42, 0.03)')}
                  >
                    {num}
                  </button>
                ))}

                <button
                  onClick={() => setPinVerificationMode(null)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: '#64748b',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Batal
                </button>

                <button
                  onClick={() => handlePinKeyPress('0')}
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    border: '1px solid rgba(15, 23, 42, 0.08)',
                    background: 'rgba(15, 23, 42, 0.03)',
                    color: '#0f172a',
                    fontSize: '18px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    outline: 'none',
                    transition: 'all 0.1s ease'
                  }}
                  onMouseDown={(e) => (e.currentTarget.style.background = 'rgba(15, 23, 42, 0.12)')}
                  onMouseUp={(e) => (e.currentTarget.style.background = 'rgba(15, 23, 42, 0.03)')}
                  onTouchStart={(e) => (e.currentTarget.style.background = 'rgba(15, 23, 42, 0.12)')}
                  onTouchEnd={(e) => (e.currentTarget.style.background = 'rgba(15, 23, 42, 0.03)')}
                >
                  0
                </button>

                <button
                  onClick={handlePinDelete}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: '#64748b',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  Hapus
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style>{`
        .shake-dots {
          animation: shake 0.4s ease-in-out;
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          15%, 45%, 75% { transform: translateX(-8px); }
          30%, 60%, 90% { transform: translateX(8px); }
        }
      `}</style>
    </motion.div>
  );
}
