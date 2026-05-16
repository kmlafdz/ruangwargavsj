import React from 'react';
import { 
  AlertTriangle, RefreshCw, Upload, 
  ChevronRight, ArrowLeft, MessageCircle,
  FileX, Info
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { User } from '../types';
import logo from '../assets/login/logo.png';

interface RevisionPageProps {
  user: User;
  onLogout: () => void;
}

export default function RevisionPage({ user, onLogout }: RevisionPageProps) {
  const navigate = useNavigate();

  return (
    <div className="revision-page-root">
      <style dangerouslySetInnerHTML={{ __html: `
        .revision-page-root {
          min-height: 100vh;
          height: 100vh;
          width: 100%;
          background: #fff1f2;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          overflow: hidden;
          touch-action: pan-y;
        }
        .revision-card {
          width: 100%;
          max-width: 500px;
          max-height: calc(100vh - 40px);
          background: #fff;
          border-radius: 32px;
          padding: 48px;
          box-shadow: 0 40px 100px rgba(225, 29, 72, 0.1);
          border: 1px solid #fecdd3;
          text-align: center;
          overflow-y: auto;
          scrollbar-width: none;
        }
        .revision-card::-webkit-scrollbar { display: none; }

        @media (max-width: 768px) {
          .revision-page-root { padding: 0; }
          .revision-card { 
            max-width: 100%; 
            max-height: 100vh; 
            height: 100vh;
            border-radius: 0; 
            border: none; 
            padding: 32px 24px !important;
          }
          h1 { font-size: 20px !important; }
          p { font-size: 13px !important; }
          .btn-revision { height: 50px !important; font-size: 14px !important; }
        }
        .reject-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          background: #fff1f2;
          color: #e11d48;
          border-radius: 100px;
          font-size: 12px;
          font-weight: 800;
          text-transform: uppercase;
          margin-bottom: 32px;
        }
        .btn-revision {
          width: 100%;
          height: 56px;
          background: #e11d48;
          color: #fff;
          border: none;
          border-radius: 16px;
          font-weight: 800;
          font-size: 15px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          box-shadow: 0 10px 20px rgba(225, 29, 72, 0.2);
          transition: all 0.2s;
        }
        .btn-revision:hover { background: #be123c; transform: translateY(-2px); }
      `}} />

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="revision-card"
      >
        <img src={logo} alt="Logo" style={{ width: '50px', marginBottom: '24px' }} />
        
        <div className="reject-badge">
          <AlertTriangle size={14} /> Perlu Revisi Data
        </div>

        <h1 style={{ fontSize: '26px', fontWeight: 900, color: '#9f1239', marginBottom: '16px' }}>Verifikasi Ditolak</h1>
        <p style={{ color: '#64748b', fontSize: '14px', lineHeight: 1.6, marginBottom: '32px' }}>
          Mohon maaf <strong>{user.name}</strong>, pengajuan verifikasi akun Anda ditolak oleh Admin karena terdapat data yang tidak sesuai atau foto dokumen yang kurang jelas.
        </p>

        <div style={{ background: '#fff1f2', borderRadius: '24px', padding: '24px', textAlign: 'left', marginBottom: '40px', border: '1px dashed #fda4af' }}>
          <h4 style={{ fontSize: '13px', fontWeight: 800, color: '#e11d48', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Info size={16} /> Alasan Penolakan:
          </h4>
          <p style={{ fontSize: '14px', color: '#9f1239', fontWeight: 600, background: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid #fecdd3' }}>
            "{user.rejectionReason || 'Data yang Anda masukkan tidak sesuai dengan dokumen fisik atau foto kurang jelas. Silakan lakukan registrasi ulang.'}"
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px' }}>
          <button 
            onClick={() => navigate('/warga/aktivasi')}
            className="btn-revision"
          >
            <RefreshCw size={20} /> Perbaiki Data Sekarang
          </button>
          
          <button 
            onClick={onLogout}
            style={{ width: '100%', height: '54px', background: '#fff', color: '#64748b', border: '1.5px solid #e2e8f0', borderRadius: '16px', fontWeight: 800, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            <ArrowLeft size={18} /> Keluar
          </button>
        </div>

        <div style={{ padding: '16px', borderRadius: '16px', display: 'flex', gap: '12px', textAlign: 'left' }}>
          <MessageCircle size={20} style={{ color: '#94a3b8', flexShrink: 0 }} />
          <p style={{ fontSize: '12px', color: '#64748b' }}>
            Jika Anda yakin data sudah benar, silakan hubungi <span style={{ color: '#e11d48', fontWeight: 700 }}>Admin RW</span> untuk bantuan manual.
          </p>
        </div>
      </motion.div>

    </div>
  );
}
