import React, { useState } from 'react';
import { Eye, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { User } from '../types';
import { logSensitiveDataView } from '../services/notificationService';
import { showAlert } from '../utils/alert';

interface SensitiveDataViewerProps {
  value: string;
  type: 'NIK' | 'No. KK';
  residentId: string;
  residentName: string;
  adminUser: User | null;
  style?: React.CSSProperties;
}

export default function SensitiveDataViewer({
  value,
  type,
  residentId,
  residentName,
  adminUser,
  style
}: SensitiveDataViewerProps) {
  const [isMasked, setIsMasked] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  // Default value for mask
  const maskedValue = value 
    ? (value.length >= 8 ? `${value.substring(0, 4)}${'•'.repeat(8)}${value.substring(value.length - 4)}` : '••••••••••••••••')
    : '-';

  const handleOpenModal = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row click in tables
    if (!isMasked) {
      setIsMasked(true); // Toggle back to masked
      return;
    }
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!reason.trim() || !adminUser) return;
    
    setLoading(true);
    try {
      await logSensitiveDataView(adminUser.id, adminUser.name || 'Admin', residentId, residentName, type, reason);
      setIsMasked(false);
      setShowModal(false);
      setReason('');
    } catch (error) {
      console.error('Failed to log sensitive data view:', error);
      showAlert('Gagal', 'Gagal membuka data. Silakan coba lagi.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', ...style }}>
        <span>{isMasked ? maskedValue : value}</span>
        {value && value !== '-' && (
          <button
            onClick={handleOpenModal}
            title={isMasked ? `Lihat ${type}` : 'Sembunyikan'}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: isMasked ? 'var(--gray-400)' : 'var(--primary)',
              padding: '2px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Eye size={14} />
          </button>
        )}
      </div>

      <AnimatePresence>
        {showModal && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(15,23,42,0.6)',
              backdropFilter: 'blur(4px)',
            }}
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: '#fff',
                width: '100%',
                maxWidth: '400px',
                borderRadius: '24px',
                padding: '32px',
                position: 'relative',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
              }}
            >
              <button
                onClick={() => setShowModal(false)}
                style={{
                  position: 'absolute',
                  top: '16px',
                  right: '16px',
                  background: 'none',
                  border: 'none',
                  color: 'var(--gray-400)',
                  cursor: 'pointer',
                }}
              >
                <X size={20} />
              </button>

              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <div style={{ position: 'relative', width: '100px', height: '100px', margin: '0 auto 16px' }}>
                  <img 
                    src="/vira_ai_confirm.png" 
                    alt="Vira AI Confirm" 
                    style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '16px' }} 
                  />
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#1e293b', marginBottom: '8px' }}>
                  Akses Data Sensitif
                </h3>
                <p style={{ fontSize: '13px', color: '#64748b' }}>
                  Anda akan melihat {type} lengkap atas nama <strong>{residentName}</strong>. Tindakan ini akan dicatat dan diberitahukan kepada warga terkait.
                </p>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '8px' }}>
                  Alasan Mengakses Data
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={`Masukkan alasan mengapa Anda perlu melihat ${type} ini...`}
                  style={{
                    width: '100%',
                    height: '100px',
                    padding: '16px',
                    borderRadius: '16px',
                    border: '1px solid #e2e8f0',
                    resize: 'none',
                    fontSize: '14px',
                    outline: 'none',
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => setShowModal(false)}
                  style={{
                    flex: 1,
                    height: '48px',
                    background: '#f1f5f9',
                    color: '#64748b',
                    border: 'none',
                    borderRadius: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Batal
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!reason.trim() || loading}
                  style={{
                    flex: 1,
                    height: '48px',
                    background: '#2563eb',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '12px',
                    fontWeight: 700,
                    cursor: (!reason.trim() || loading) ? 'not-allowed' : 'pointer',
                    opacity: (!reason.trim() || loading) ? 0.7 : 1,
                  }}
                >
                  {loading ? 'Memproses...' : 'Lihat Data'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
