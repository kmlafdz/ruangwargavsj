import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase/config';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, AlertTriangle, Loader2, CheckCircle, Home, MailCheck } from 'lucide-react';

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const token = searchParams.get('token');
  const userId = searchParams.get('userId');
  
  const [status, setStatus] = useState<'verifying' | 'success' | 'invalid'>('verifying');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    async function verify() {
      if (!token || !userId) {
        setStatus('invalid');
        setErrorMsg('Parameter verifikasi tidak lengkap.');
        return;
      }

      try {
        // 1. Query the email_verifications collection
        const q = query(
          collection(db, 'email_verifications'),
          where('userId', '==', userId),
          where('token', '==', token)
        );
        
        const snap = await getDocs(q);
        if (snap.empty) {
          setStatus('invalid');
          setErrorMsg('Tautan verifikasi tidak cocok atau tidak terdaftar.');
          return;
        }

        const verificationDoc = snap.docs[0];
        const verificationData = verificationDoc.data();

        if (verificationData.verified) {
          setStatus('success'); // Already verified, just show success
          return;
        }

        // 2. Perform batched update to ensure transactional integrity
        const batch = writeBatch(db);
        
        // Update verification document
        batch.update(doc(db, 'email_verifications', verificationDoc.id), {
          verified: true,
          verifiedAt: new Date()
        });

        // Update user document
        batch.update(doc(db, 'users', userId), {
          email: verificationData.email,
          emailVerified: true
        });

        // Try to update residents collection too if they exist
        try {
          const userSnap = await getDocs(query(collection(db, 'users'), where('__name__', '==', userId)));
          if (!userSnap.empty) {
            const userNik = userSnap.docs[0].data().nik || userSnap.docs[0].data().username;
            if (userNik) {
              const resSnap = await getDocs(query(collection(db, 'residents'), where('nik', '==', userNik)));
              if (!resSnap.empty) {
                batch.update(doc(db, 'residents', resSnap.docs[0].id), {
                  email: verificationData.email,
                  emailVerified: true
                });
              }
            }
          }
        } catch (e) {
          console.warn('Sync to residents failed, ignoring:', e);
        }

        await batch.commit();
        setStatus('success');
      } catch (err: any) {
        console.error('Verification error:', err);
        setStatus('invalid');
        setErrorMsg(err.message || 'Terjadi kesalahan sistem.');
      }
    }
    
    // Slight delay for premium loading experience
    const timer = setTimeout(() => {
      verify();
    }, 1500);

    return () => clearTimeout(timer);
  }, [token, userId]);

  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      background: 'radial-gradient(circle at top, #0f172a 0%, #020617 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      fontFamily: "'Inter', sans-serif"
    }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
          100% { transform: translateY(0px); }
        }
        .premium-card {
          width: 100%;
          max-width: 480px;
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 32px;
          padding: 48px 40px;
          box-shadow: 0 40px 100px rgba(0, 0, 0, 0.5);
          text-align: center;
          color: #fff;
          position: relative;
          overflow: hidden;
        }
        .premium-card::before {
          content: '';
          position: absolute;
          top: 0; left: -100%;
          width: 50%; height: 100%;
          background: linear-gradient(to right, transparent, rgba(255,255,255,0.03), transparent);
          transform: skewX(-25deg);
          transition: 0.75s;
        }
        .premium-card:hover::before {
          left: 150%;
        }
        .floating-icon {
          animation: float 4s ease-in-out infinite;
        }
      `}} />

      <AnimatePresence mode="wait">
        {status === 'verifying' && (
          <motion.div
            key="verifying"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="premium-card"
          >
            <div style={{ width: '80px', height: '80px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 32px', color: '#3b82f6' }}>
              <Loader2 className="spin" size={40} style={{ animation: 'spin 1.5s linear infinite' }} />
            </div>
            
            <h1 style={{ fontSize: '24px', fontWeight: 900, marginBottom: '16px', letterSpacing: '-0.025em' }}>Memverifikasi Email Anda</h1>
            <p style={{ color: '#94a3b8', fontSize: '14px', lineHeight: 1.6, marginBottom: 0 }}>
              Sistem sedang menautkan alamat email baru ke profil kependudukan Anda secara aman. Mohon tunggu sebentar...
            </p>
          </motion.div>
        )}

        {status === 'success' && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="premium-card"
          >
            <div className="floating-icon" style={{ width: '80px', height: '80px', background: 'rgba(34, 197, 94, 0.1)', borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 32px', color: '#22c55e' }}>
              <MailCheck size={40} />
            </div>
            
            <h1 style={{ fontSize: '24px', fontWeight: 900, marginBottom: '16px', color: '#4ade80', letterSpacing: '-0.025em' }}>Email Berhasil Diverifikasi!</h1>
            <p style={{ color: '#94a3b8', fontSize: '14px', lineHeight: 1.6, marginBottom: '40px' }}>
              Selamat! Alamat email Anda telah sah terverifikasi. Sekarang Anda dapat menggunakannya untuk pemulihan akun, dan transaksi kas.
            </p>

            <button 
              onClick={() => navigate('/warga-login')}
              style={{
                width: '100%',
                height: '54px',
                background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: '16px',
                fontWeight: 800,
                fontSize: '14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                boxShadow: '0 10px 20px rgba(59,130,246,0.3)',
                transition: 'all 0.2s'
              }}
            >
              <Home size={18} /> Kembali ke Halaman Utama
            </button>
          </motion.div>
        )}

        {status === 'invalid' && (
          <motion.div
            key="invalid"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="premium-card"
          >
            <div className="floating-icon" style={{ width: '80px', height: '80px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 32px', color: '#ef4444' }}>
              <AlertTriangle size={40} />
            </div>
            
            <h1 style={{ fontSize: '24px', fontWeight: 900, marginBottom: '16px', color: '#f87171', letterSpacing: '-0.025em' }}>Verifikasi Gagal</h1>
            <p style={{ color: '#94a3b8', fontSize: '14px', lineHeight: 1.6, marginBottom: '40px' }}>
              {errorMsg || 'Tautan verifikasi tidak valid, kedaluwarsa, atau sudah pernah digunakan sebelumnya.'}
            </p>

            <button 
              onClick={() => navigate('/warga-login')}
              style={{
                width: '100%',
                height: '54px',
                background: '#334155',
                color: '#fff',
                border: 'none',
                borderRadius: '16px',
                fontWeight: 800,
                fontSize: '14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                transition: 'all 0.2s'
              }}
            >
              <Home size={18} /> Kembali ke Halaman Utama
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
