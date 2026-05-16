import React, { useEffect, useState } from 'react';
import { 
  Clock, ShieldCheck, UserCheck, 
  MessageCircle, ExternalLink, 
  ChevronRight, ArrowLeft, Loader2,
  CheckCircle2, AlertCircle, XCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { User } from '../types';
import logo from '../assets/login/logo.png';
import { db } from '../firebase/config';
import { doc, onSnapshot } from 'firebase/firestore';

interface WaitingApprovalPageProps {
  user: User;
  onLogout: () => void;
}

export default function WaitingApprovalPage({ user, onLogout }: WaitingApprovalPageProps) {
  const navigate = useNavigate();
  const [showStatusPopup, setShowStatusPopup] = useState<'approved' | 'rejected' | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Real-time listener for status change within this page
  useEffect(() => {
    if (!user?.id) return;
    const userRef = doc(db, 'users', user.id);
    const unsubscribe = onSnapshot(userRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.accountStatus === 'active') {
          setShowStatusPopup('approved');
          // Manual navigation fail-safe after 2 seconds
          setTimeout(() => {
            navigate('/warga/dashboard', { replace: true });
          }, 2500);
        } else if (data.accountStatus === 'rejected') {
          setRejectionReason(data.rejectionReason || 'Data tidak sesuai atau kurang lengkap.');
          setShowStatusPopup('rejected');
        }
      }
    });
    return () => unsubscribe();
  }, [user?.id]);

  // Progress logic based on account status
  const steps = [
    { id: 1, label: 'Registrasi Selesai', status: 'completed', date: user.createdAt ? (user.createdAt.seconds ? new Date(user.createdAt.seconds * 1000).toLocaleDateString('id-ID') : 'Hari ini') : 'Hari ini' },
    { id: 2, label: 'Verifikasi Identitas & Keluarga', status: user.accountStatus === 'waiting_family_approval' ? 'processing' : 'completed' },
    { id: 3, label: 'Persetujuan Admin RW', status: user.accountStatus === 'waiting_admin_approval' ? 'processing' : 'pending' },
    { id: 4, label: 'Akses Dashboard Aktif', status: 'pending' },
  ];

  return (
    <div className="waiting-page-root">
      <style dangerouslySetInnerHTML={{ __html: `
        .waiting-page-root {
          min-height: 100vh;
          height: 100vh;
          width: 100%;
          background: #f8fafc;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          overflow: hidden;
          touch-action: pan-y;
        }
        .waiting-card {
          width: 100%;
          max-width: 500px;
          max-height: calc(100vh - 40px);
          background: #fff;
          border-radius: 32px;
          padding: 48px;
          box-shadow: 0 40px 100px rgba(0,0,0,0.05);
          border: 1px solid #e2e8f0;
          text-align: center;
          overflow-y: auto;
          scrollbar-width: none;
        }
        .waiting-card::-webkit-scrollbar { display: none; }

        @media (max-width: 768px) {
          .waiting-page-root { padding: 0; }
          .waiting-card { 
            max-width: 100%; 
            max-height: 100vh; 
            height: 100vh;
            border-radius: 0; 
            border: none; 
            padding: 32px 24px !important;
          }
          h1 { font-size: 20px !important; }
          p { font-size: 13px !important; }
          .status-badge { margin-bottom: 20px !important; }
        }
        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          background: #eff6ff;
          color: #3b82f6;
          border-radius: 100px;
          font-size: 12px;
          font-weight: 800;
          text-transform: uppercase;
          margin-bottom: 32px;
        }
        .step-item {
          display: flex;
          align-items: center;
          gap: 16px;
          text-align: left;
          margin-bottom: 24px;
          position: relative;
        }
        .step-item:not(:last-child)::after {
          content: '';
          position: absolute;
          left: 12px;
          top: 30px;
          width: 2px;
          height: 20px;
          background: #e2e8f0;
        }
        .step-icon {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 800;
          z-index: 1;
        }
        .step-completed { background: #22c55e; color: #fff; }
        .step-processing { background: #3b82f6; color: #fff; animation: pulse 2s infinite; }
        .step-pending { background: #f1f5f9; color: #94a3b8; border: 2px solid #e2e8f0; }
        @keyframes pulse {
          0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4); }
          70% { transform: scale(1.1); box-shadow: 0 0 0 10px rgba(59, 130, 246, 0); }
          100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
        }
        .status-overlay {
          position: fixed;
          inset: 0;
          background: rgba(255,255,255,0.95);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }
      `}} />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="waiting-card"
      >
        <img src={logo} alt="Logo" style={{ width: '50px', marginBottom: '24px', display: 'block', marginLeft: 'auto', marginRight: 'auto' }} />
        
        <div className="status-badge">
          <Clock size={14} /> Menunggu Verifikasi
        </div>

        <h1 style={{ fontSize: '24px', fontWeight: 900, color: '#1e3a8a', marginBottom: '12px' }}>Sedang Ditinjau</h1>
        <p style={{ color: '#64748b', fontSize: '14px', lineHeight: 1.6, marginBottom: '40px' }}>
          Terima kasih, <strong>{user.name}</strong>. Data Anda telah kami terima dan sedang dalam proses verifikasi oleh pengurus RW 011 VSJ.
        </p>

        <div style={{ background: '#f8fafc', borderRadius: '24px', padding: '32px', marginBottom: '40px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 800, color: '#1e3a8a', textTransform: 'uppercase', marginBottom: '24px', letterSpacing: '0.1em' }}>Progres Verifikasi</h3>
          
          {steps.map((step) => (
            <div key={step.id} className="step-item">
              <div className={`step-icon step-${step.status}`}>
                {step.status === 'completed' ? <ShieldCheck size={14} /> : step.id}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '14px', fontWeight: 700, color: step.status === 'pending' ? '#94a3b8' : '#1e3a8a' }}>{step.label}</p>
                {step.date && <p style={{ fontSize: '11px', color: '#94a3b8' }}>{step.date}</p>}
              </div>
            </div>
          ))}
        </div>

        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '16px', padding: '16px', marginBottom: '32px', textAlign: 'left', display: 'flex', gap: '12px' }}>
          <MessageCircle size={20} style={{ color: '#d97706', flexShrink: 0 }} />
          <div>
            <p style={{ fontSize: '13px', fontWeight: 700, color: '#92400e' }}>Butuh bantuan?</p>
            <p style={{ fontSize: '12px', color: '#b45309' }}>Hubungi Ketua RT setempat untuk mempercepat proses verifikasi Anda.</p>
          </div>
        </div>

        <button 
          onClick={onLogout}
          style={{ width: '100%', height: '54px', background: '#fff', color: '#64748b', border: '1.5px solid #e2e8f0', borderRadius: '16px', fontWeight: 800, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
        >
          <ArrowLeft size={18} /> Keluar & Periksa Nanti
        </button>
      </motion.div>

      {/* Real-time Status Overlays */}
      <AnimatePresence>
        {showStatusPopup === 'approved' && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="status-overlay"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
              style={{ textAlign: 'center', maxWidth: 400 }}
            >
              <div style={{ width: 80, height: 80, background: '#dcfce7', color: '#22c55e', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                <CheckCircle2 size={48} />
              </div>
              <h2 style={{ fontSize: '24px', fontWeight: 900, color: '#14532d', marginBottom: '12px' }}>Akun Aktif!</h2>
              <p style={{ color: '#166534', marginBottom: '32px' }}>Selamat, pendaftaran Anda telah disetujui. Membuka dashboard warga...</p>
              <Loader2 className="spin" style={{ color: '#22c55e', margin: '0 auto' }} />
            </motion.div>
          </motion.div>
        )}

        {showStatusPopup === 'rejected' && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="status-overlay"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
              style={{ textAlign: 'center', maxWidth: 400, padding: 32, background: '#fff', borderRadius: 32, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.2)', border: '1px solid #fee2e2' }}
            >
              <div style={{ width: 80, height: 80, background: '#fee2e2', color: '#ef4444', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                <XCircle size={48} />
              </div>
              <h2 style={{ fontSize: '24px', fontWeight: 900, color: '#991b1b', marginBottom: '12px' }}>Verifikasi Ditolak</h2>
              <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '24px' }}>Mohon maaf, pendaftaran Anda memerlukan revisi dengan alasan:</p>
              <div style={{ background: '#fef2f2', padding: '16px', borderRadius: '16px', color: '#b91c1c', fontWeight: 700, fontSize: '14px', marginBottom: '32px', border: '1px solid #fecdd3' }}>
                "{rejectionReason}"
              </div>
              <button 
                onClick={() => navigate('/warga/revisi')}
                style={{ width: '100%', height: '54px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '16px', fontWeight: 800, fontSize: '14px', cursor: 'pointer' }}
              >
                Perbaiki Data Sekarang
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
