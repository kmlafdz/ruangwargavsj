import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({ title, message, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
        <div className="modal-body" style={{ textAlign: 'center', padding: '32px 24px' }}>
          <div style={{ color: '#ef4444', marginBottom: 16 }}>
            <AlertTriangle size={48} style={{ margin: '0 auto' }} />
          </div>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--gray-800)', marginBottom: 8 }}>{title}</h3>
          <p style={{ fontSize: 14, color: 'var(--gray-500)', lineHeight: 1.5 }}>{message}</p>
        </div>
        <div className="modal-footer" style={{ justifyContent: 'center', gap: 12, borderTop: 'none', paddingTop: 0, paddingBottom: 24 }}>
          <button className="btn btn-secondary" style={{ minWidth: 100 }} onClick={onCancel}>Batal</button>
          <button className="btn btn-danger" style={{ minWidth: 100 }} onClick={onConfirm}>Ya, Hapus</button>
        </div>
      </div>
    </div>
  );
}
