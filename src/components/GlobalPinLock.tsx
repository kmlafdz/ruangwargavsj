import React, { useState } from 'react';
import { Lock, ShieldCheck, Delete, AlertCircle, Key } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../firebase/config';
import { doc, updateDoc } from 'firebase/firestore';
import { showAlert } from '../utils/alert';

interface GlobalPinLockProps {
  correctPin: string;
  userName: string;
  userId?: string;
  userPassword?: string;
  onUnlock: () => void;
}

export default function GlobalPinLock({ 
  correctPin, 
  userName, 
  userId,
  userPassword,
  onUnlock 
}: GlobalPinLockProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [success, setSuccess] = useState(false);

  // Forgot PIN state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState(false);

  const handleKeyPress = (num: string) => {
    if (success || error) return;
    setError(false);
    
    if (pin.length < 6) {
      const nextPin = pin + num;
      setPin(nextPin);
      
      // Auto submit when reaching 6 digits
      if (nextPin === correctPin) {
        setSuccess(true);
        setTimeout(() => {
          onUnlock();
        }, 800);
      } else if (nextPin.length === 6) {
        // Wrong PIN
        setTimeout(() => {
          setError(true);
          setPin('');
          // Clear error state after a short shake duration
          setTimeout(() => setError(false), 500);
        }, 200);
      }
    }
  };

  const handleDelete = () => {
    if (pin.length > 0) {
      setPin(pin.slice(0, -1));
    }
  };



  const handleResetPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');

    if (passwordInput !== userPassword) {
      setForgotError('❌ Password akun Anda salah.');
      return;
    }

    if (newPin.length !== 6 || !/^\d+$/.test(newPin)) {
      setForgotError('❌ PIN baru harus terdiri dari 6 digit angka.');
      return;
    }

    if (newPin !== confirmNewPin) {
      setForgotError('❌ Konfirmasi PIN baru tidak cocok.');
      return;
    }

    try {
      if (!userId) throw new Error('ID Pengguna tidak valid.');

      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        pin: newPin,
        pinSet: true
      });

      // Synchronize locally
      const savedUser = localStorage.getItem('erw_user');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        parsed.pin = newPin;
        parsed.pinSet = true;
        localStorage.setItem('erw_user', JSON.stringify(parsed));
      }

      setForgotSuccess(true);
      setTimeout(() => {
        showAlert('Berhasil', '🎉 PIN Keamanan Anda berhasil diperbarui! Silakan gunakan PIN baru Anda untuk masuk.', 'success');
        setForgotSuccess(false);
        setShowForgotModal(false);
        setPasswordInput('');
        setNewPin('');
        setConfirmNewPin('');
        // Immediately unlock or let them verify
        onUnlock();
      }, 1000);
    } catch (err: any) {
      setForgotError('❌ Gagal memperbarui PIN: ' + (err.message || err));
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 99999,
      background: '#ffffff',
      backdropFilter: 'blur(20px)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#0f172a',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <AnimatePresence mode="wait">
        {!showForgotModal ? (
          <motion.div 
            key="lock-pad"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            style={{ 
              textAlign: 'center', 
              width: '100%', 
              maxWidth: 320, 
              padding: '0 20px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center'
            }}
          >
            {/* Lock Shield Header */}
            <div style={{ position: 'relative', marginBottom: 24 }}>
              <div style={{ 
                width: 80, 
                height: 80, 
                borderRadius: '50%', 
                background: success ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                margin: '0 auto',
                border: success ? '2px solid rgba(16, 185, 129, 0.2)' : '2px solid rgba(59, 130, 246, 0.2)',
                boxShadow: success ? '0 0 30px rgba(16, 185, 129, 0.2)' : '0 0 30px rgba(59, 130, 246, 0.1)',
                transition: 'all 0.3s ease'
              }}>
                {success ? (
                  <ShieldCheck size={36} color="#10b981" />
                ) : (
                  <Lock size={32} color="#3b82f6" />
                )}
              </div>
            </div>

            <h2 style={{ fontSize: 20, fontWeight: 900, marginBottom: 6, letterSpacing: '-0.5px' }}>
              {success ? 'Akses Terbuka' : 'PIN Keamanan'}
            </h2>
            <p style={{ fontSize: 12, color: 'rgba(15, 23, 42, 0.6)', margin: '0 0 32px', fontWeight: 600 }}>
              {success ? 'Sesi berhasil diverifikasi' : `Halo ${userName}, silakan masukkan PIN Anda`}
            </p>

            {/* PIN Indicators Dots */}
            <div 
              className={error ? 'shake-dots' : ''}
              style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                gap: 16, 
                marginBottom: 40 
              }}
            >
              {[0, 1, 2, 3, 4, 5].map((idx) => {
                const hasValue = pin.length > idx;
                return (
                  <div 
                    key={idx} 
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      border: error 
                        ? '2.5px solid #ef4444' 
                        : success 
                          ? '2.5px solid #10b981' 
                          : hasValue 
                            ? '2.5px solid #2563eb' 
                            : '2.5px solid rgba(15, 23, 42, 0.15)',
                      background: error 
                        ? '#ef4444' 
                        : success 
                          ? '#10b981' 
                          : hasValue 
                            ? '#2563eb' 
                            : 'transparent',
                      boxShadow: hasValue && !error && !success ? '0 0 15px #2563eb' : 'none',
                      transform: hasValue ? 'scale(1.15)' : 'scale(1)',
                      transition: 'all 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                    }} 
                  />
                );
              })}
            </div>

            {/* Pin Pad Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '16px 20px',
              width: '100%',
              maxWidth: 270,
              margin: '0 auto 24px'
            }}>
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                <button
                  key={num}
                  onClick={() => handleKeyPress(num)}
                  style={{
                    width: 68,
                    height: 68,
                    borderRadius: '50%',
                    border: '1px solid rgba(15, 23, 42, 0.08)',
                    background: 'rgba(15, 23, 42, 0.03)',
                    color: '#0f172a',
                    fontSize: 22,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    outline: 'none',
                    transition: 'all 0.1s ease',
                  }}
                  onMouseDown={(e) => (e.currentTarget.style.background = 'rgba(15, 23, 42, 0.15)')}
                  onMouseUp={(e) => (e.currentTarget.style.background = 'rgba(15, 23, 42, 0.03)')}
                  onTouchStart={(e) => (e.currentTarget.style.background = 'rgba(15, 23, 42, 0.15)')}
                  onTouchEnd={(e) => (e.currentTarget.style.background = 'rgba(15, 23, 42, 0.03)')}
                >
                  {num}
                </button>
              ))}

              <div style={{ width: 68, height: 68 }} />

              <button
                onClick={() => handleKeyPress('0')}
                style={{
                  width: 68,
                  height: 68,
                  borderRadius: '50%',
                  border: '1px solid rgba(15, 23, 42, 0.08)',
                  background: 'rgba(15, 23, 42, 0.03)',
                  color: '#0f172a',
                  fontSize: 22,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  outline: 'none',
                  transition: 'all 0.1s ease',
                }}
                onMouseDown={(e) => (e.currentTarget.style.background = 'rgba(15, 23, 42, 0.15)')}
                onMouseUp={(e) => (e.currentTarget.style.background = 'rgba(15, 23, 42, 0.03)')}
                onTouchStart={(e) => (e.currentTarget.style.background = 'rgba(15, 23, 42, 0.15)')}
                onTouchEnd={(e) => (e.currentTarget.style.background = 'rgba(15, 23, 42, 0.03)')}
              >
                0
              </button>

              <button
                onClick={handleDelete}
                style={{
                  width: 68,
                  height: 68,
                  borderRadius: '50%',
                  border: 'none',
                  background: 'transparent',
                  color: 'rgba(15, 23, 42, 0.6)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  outline: 'none',
                  transition: 'all 0.1s ease',
                }}
                onMouseDown={(e) => (e.currentTarget.style.color = '#0f172a')}
                onMouseUp={(e) => (e.currentTarget.style.color = 'rgba(15, 23, 42, 0.6)')}
              >
                <Delete size={22} />
              </button>
            </div>

            {/* Lupa PIN */}
            {userPassword && (
              <button
                type="button"
                onClick={() => setShowForgotModal(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#3b82f6',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  marginTop: 10
                }}
              >
                Lupa PIN Keamanan?
              </button>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="forgot-pad"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            style={{ 
              width: '100%', 
              maxWidth: 340, 
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: 28,
              padding: 28,
              boxShadow: '0 20px 40px rgba(15,23,42,0.1)',
              color: '#0f172a',
              textAlign: 'left'
            }}
          >
            <h3 style={{ fontSize: 18, fontWeight: 900, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8, color: '#2563eb' }}>
              <Key size={20} /> Reset PIN Keamanan
            </h3>
            <p style={{ fontSize: 11, color: 'rgba(15,23,42,0.6)', marginBottom: 20, lineHeight: 1.5 }}>
              Verifikasi kata sandi akun Anda untuk membuat 6 digit PIN transaksi baru.
            </p>

            <form onSubmit={handleResetPin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'rgba(15,23,42,0.7)', display: 'block', marginBottom: 6 }}>
                  PASSWORD LOGIN AKUN
                </label>
                <input
                  type="password"
                  placeholder="Masukkan password akun Anda"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    height: 46,
                    borderRadius: 12,
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#0f172a',
                    padding: '0 14px',
                    fontSize: 13,
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'rgba(15,23,42,0.7)', display: 'block', marginBottom: 6 }}>
                    PIN BARU
                  </label>
                  <input
                    type="password"
                    maxLength={6}
                    placeholder="数字"
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                    required
                    style={{
                      width: '100%',
                      height: 46,
                      borderRadius: 12,
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#0f172a',
                      padding: '0 10px',
                      fontSize: 15,
                      textAlign: 'center',
                      letterSpacing: 2,
                      outline: 'none'
                    }}
                  />
                </div>

                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'rgba(15,23,42,0.7)', display: 'block', marginBottom: 6 }}>
                    KONFIRMASI PIN
                  </label>
                  <input
                    type="password"
                    maxLength={6}
                    placeholder="数字"
                    value={confirmNewPin}
                    onChange={(e) => setConfirmNewPin(e.target.value.replace(/\D/g, ''))}
                    required
                    style={{
                      width: '100%',
                      height: 46,
                      borderRadius: 12,
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#0f172a',
                      padding: '0 10px',
                      fontSize: 15,
                      textAlign: 'center',
                      letterSpacing: 2,
                      outline: 'none'
                    }}
                  />
                </div>
              </div>

              {forgotError && (
                <div style={{
                  fontSize: 11,
                  color: '#ef4444',
                  fontWeight: 600,
                  background: 'rgba(239, 68, 68, 0.05)',
                  border: '1px solid rgba(239, 68, 68, 0.15)',
                  padding: '8px 12px',
                  borderRadius: 10,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}>
                  <AlertCircle size={14} />
                  {forgotError}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(false)}
                  style={{
                    flex: 1,
                    height: 44,
                    borderRadius: 12,
                    border: '1px solid #cbd5e1',
                    background: 'transparent',
                    color: '#475569',
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: 'pointer'
                  }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={forgotSuccess}
                  style={{
                    flex: 1,
                    height: 44,
                    borderRadius: 12,
                    border: 'none',
                    background: forgotSuccess ? '#10b981' : '#2563eb',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)'
                  }}
                >
                  {forgotSuccess ? 'Mengupdate...' : 'Simpan PIN'}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .shake-dots {
          animation: shake 0.4s ease-in-out;
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          15%, 45%, 75% { transform: translateX(-10px); }
          30%, 60%, 90% { transform: translateX(10px); }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
