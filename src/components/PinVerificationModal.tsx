import React, { useState } from 'react';
import { Lock, ShieldCheck, Delete, AlertCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../firebase/config';
import { doc, updateDoc } from 'firebase/firestore';

interface PinVerificationModalProps {
  isOpen: boolean;
  correctPin: string;
  userName: string;
  userId: string;
  userPassword?: string;
  title?: string;
  onSuccess: () => void;
  onClose: () => void;
}

export default function PinVerificationModal({
  isOpen,
  correctPin,
  userName,
  userId,
  userPassword,
  title = "Verifikasi PIN Keamanan",
  onSuccess,
  onClose
}: PinVerificationModalProps) {
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

  if (!isOpen) return null;

  const handleKeyPress = (num: string) => {
    if (success || error) return;
    setError(false);
    
    if (pin.length < 6) {
      const nextPin = pin + num;
      setPin(nextPin);
      
      // Check Pin
      if (nextPin === correctPin) {
        setSuccess(true);
        setTimeout(() => {
          onSuccess();
          handleClose();
        }, 800);
      } else if (nextPin.length === 6) {
        // Wrong PIN
        setTimeout(() => {
          setError(true);
          setPin('');
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

  const handleClose = () => {
    setPin('');
    setError(false);
    setSuccess(false);
    setShowForgotModal(false);
    setPasswordInput('');
    setNewPin('');
    setConfirmNewPin('');
    setForgotError('');
    setForgotSuccess(false);
    onClose();
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
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        pin: newPin,
        pinSet: true
      });

      // Synchronize in local storage to keep state active
      const savedUser = localStorage.getItem('erw_user');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        parsed.pin = newPin;
        parsed.pinSet = true;
        localStorage.setItem('erw_user', JSON.stringify(parsed));
      }

      setForgotSuccess(true);
      setTimeout(() => {
        alert('🎉 PIN Keamanan Anda berhasil diperbarui! Silakan gunakan PIN baru Anda.');
        handleClose();
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
      background: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(12px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16
    }}>
      <div style={{
        background: '#ffffff',
        width: '100%',
        maxWidth: 360,
        borderRadius: 28,
        padding: '24px 20px 32px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        position: 'relative',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        color: '#1e293b'
      }}>
        {/* Header Close */}
        <button
          onClick={handleClose}
          style={{
            position: 'absolute',
            top: 20,
            right: 20,
            background: '#f1f5f9',
            border: 'none',
            color: '#64748b',
            width: 32,
            height: 32,
            borderRadius: '50%',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold'
          }}
        >
          <X size={18} />
        </button>

        <AnimatePresence mode="wait">
          {!showForgotModal ? (
            <motion.div
              key="pin-view"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}
            >
              {/* Header Lock */}
              <div style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: success ? '#ecfdf5' : '#eff6ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
                border: success ? '2px solid #a7f3d0' : '2px solid #bfdbfe'
              }}>
                {success ? (
                  <ShieldCheck size={28} color="#10b981" />
                ) : (
                  <Lock size={24} color="#3b82f6" />
                )}
              </div>

              <h3 style={{ fontSize: 18, fontWeight: 900, marginBottom: 4, color: '#0f172a' }}>
                {title}
              </h3>
              <p style={{ fontSize: 12, color: '#64748b', marginBottom: 28 }}>
                {success ? 'Verifikasi sukses!' : 'Masukkan 6 digit PIN untuk otorisasi'}
              </p>

              {/* Dots */}
              <div 
                className={error ? 'shake-dots' : ''}
                style={{ display: 'flex', gap: 12, marginBottom: 32 }}
              >
                {[0, 1, 2, 3, 4, 5].map((idx) => {
                  const hasValue = pin.length > idx;
                  return (
                    <div 
                      key={idx}
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: '50%',
                        border: error 
                          ? '2px solid #ef4444' 
                          : success 
                            ? '2px solid #10b981' 
                            : hasValue 
                              ? '2px solid #2563eb' 
                              : '2px solid #cbd5e1',
                        background: error 
                          ? '#ef4444' 
                          : success 
                            ? '#10b981' 
                            : hasValue 
                              ? '#2563eb' 
                              : 'transparent',
                        transform: hasValue ? 'scale(1.15)' : 'scale(1)',
                        transition: 'all 0.15s ease'
                      }}
                    />
                  );
                })}
              </div>

              {/* Grid Pad */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '12px 16px',
                width: '100%',
                maxWidth: 240,
                marginBottom: 24
              }}>
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                  <button
                    key={num}
                    onClick={() => handleKeyPress(num)}
                    style={{
                      width: 58,
                      height: 58,
                      borderRadius: '50%',
                      border: '1px solid #e2e8f0',
                      background: '#f8fafc',
                      color: '#0f172a',
                      fontSize: 18,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      outline: 'none',
                      transition: 'all 0.1s ease'
                    }}
                    onMouseDown={(e) => (e.currentTarget.style.background = '#e2e8f0')}
                    onMouseUp={(e) => (e.currentTarget.style.background = '#f8fafc')}
                  >
                    {num}
                  </button>
                ))}
                
                <div style={{ width: 58, height: 58 }} />
                
                <button
                  onClick={() => handleKeyPress('0')}
                  style={{
                    width: 58,
                    height: 58,
                    borderRadius: '50%',
                    border: '1px solid #e2e8f0',
                    background: '#f8fafc',
                    color: '#0f172a',
                    fontSize: 18,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    outline: 'none'
                  }}
                  onMouseDown={(e) => (e.currentTarget.style.background = '#e2e8f0')}
                  onMouseUp={(e) => (e.currentTarget.style.background = '#f8fafc')}
                >
                  0
                </button>

                <button
                  onClick={handleDelete}
                  style={{
                    width: 58,
                    height: 58,
                    borderRadius: '50%',
                    border: 'none',
                    background: 'transparent',
                    color: '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                >
                  <Delete size={20} />
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
                    color: '#2563eb',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    textDecoration: 'underline'
                  }}
                >
                  Lupa PIN Keamanan?
                </button>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="forgot-view"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{ display: 'flex', flexDirection: 'column' }}
            >
              <h3 style={{ fontSize: 16, fontWeight: 900, color: '#0f172a', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                🔑 Reset PIN Keamanan
              </h3>
              <p style={{ fontSize: 11, color: '#64748b', marginBottom: 20, lineHeight: 1.5 }}>
                Demi keamanan data Anda, silakan verifikasi dengan password login Anda saat ini untuk membuat PIN transaksi baru.
              </p>

              <form onSubmit={handleResetPin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 6 }}>
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
                      height: 44,
                      borderRadius: 12,
                      border: '1px solid #cbd5e1',
                      padding: '0 14px',
                      fontSize: 13,
                      outline: 'none',
                      background: '#f8fafc'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 6 }}>
                      PIN BARU (6 DIGIT)
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
                        height: 44,
                        borderRadius: 12,
                        border: '1px solid #cbd5e1',
                        padding: '0 12px',
                        fontSize: 14,
                        textAlign: 'center',
                        letterSpacing: 2,
                        outline: 'none',
                        background: '#f8fafc'
                      }}
                    />
                  </div>

                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 6 }}>
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
                        height: 44,
                        borderRadius: 12,
                        border: '1px solid #cbd5e1',
                        padding: '0 12px',
                        fontSize: 14,
                        textAlign: 'center',
                        letterSpacing: 2,
                        outline: 'none',
                        background: '#f8fafc'
                      }}
                    />
                  </div>
                </div>

                {forgotError && (
                  <div style={{
                    fontSize: 11,
                    color: '#ef4444',
                    fontWeight: 600,
                    background: '#fef2f2',
                    padding: '8px 12px',
                    borderRadius: 8,
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
                      border: '1px solid #e2e8f0',
                      background: '#fff',
                      color: '#64748b',
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
                    {forgotSuccess ? 'Diproses...' : 'Simpan PIN'}
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

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
    </div>
  );
}
