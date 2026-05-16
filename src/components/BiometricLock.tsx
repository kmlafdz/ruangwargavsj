import React, { useState, useEffect } from 'react';
import { Fingerprint, Lock, ShieldCheck, Key } from 'lucide-react';

interface BiometricLockProps {
  onUnlock: () => void;
  userName: string;
}

export default function BiometricLock({ onUnlock, userName }: BiometricLockProps) {
  const [verifying, setVerifying] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleVerify = () => {
    setVerifying(true);
    // Simulate biometric verification
    setTimeout(() => {
      setVerifying(false);
      setSuccess(true);
      setTimeout(() => {
        onUnlock();
      }, 800);
    }, 2000);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(15, 23, 42, 0.98)',
      backdropFilter: 'blur(10px)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      color: '#fff'
    }}>
      <div className="fade-in" style={{ textAlign: 'center', maxWidth: 320 }}>
        <div style={{ position: 'relative', marginBottom: 32 }}>
          <div style={{ 
            width: 100, height: 100, borderRadius: '50%', background: 'rgba(59, 130, 246, 0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto',
            border: '2px solid rgba(59, 130, 246, 0.2)'
          }}>
            {success ? <ShieldCheck size={48} color="#10b981" /> : <Lock size={40} color="#3b82f6" />}
          </div>
          {verifying && (
            <div style={{
              position: 'absolute', inset: -10, borderRadius: '50%',
              border: '2px solid #3b82f6', borderTopColor: 'transparent',
              animation: 'spin 1s linear infinite'
            }} />
          )}
        </div>

        <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Sesi Terkunci</h2>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', marginBottom: 40 }}>
          Halo <strong>{userName}</strong>, silakan verifikasi biometrik Anda untuk melanjutkan sesi.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>
          <button 
            onClick={handleVerify}
            disabled={verifying}
            style={{
              padding: '16px', borderRadius: 16, border: 'none',
              background: success ? '#10b981' : 'var(--blue-600)',
              color: '#fff', fontWeight: 700, fontSize: 15,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
              cursor: 'pointer', transition: 'all 0.3s ease',
              boxShadow: '0 10px 25px rgba(37, 99, 235, 0.4)'
            }}
          >
            <Fingerprint size={24} />
            {verifying ? 'Memverifikasi...' : success ? 'Berhasil' : 'Gunakan Fingerprint'}
          </button>

          <button style={{
            background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)',
            fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
          }}>
            <Key size={14} /> Gunakan PIN / Password
          </button>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
