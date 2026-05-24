import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, XCircle, Eye, 
  MessageCircle, Search, Filter, 
  Clock, ShieldAlert, Loader2,
  History
} from 'lucide-react';
import { collection, query, where, onSnapshot, updateDoc, doc, Timestamp, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';
import { sendWhatsAppMessage } from '../services/notificationService';
import { showAlert } from '../utils/alert';

interface RegistrationRequest {
  id: string;
  nik: string;
  nama: string;
  rt_id: string;
  nomorHP: string;
  statusValidasi: string;
  tanggalLahir: string;
  [key: string]: any;
}

export default function ApprovalPage() {
  const [requests, setRequests] = useState<RegistrationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [lastActionPhone, setLastActionPhone] = useState('');
  const [lastActionMsg, setLastActionMsg] = useState('');

  useEffect(() => {
    const q = query(
      collection(db, 'residents'),
      where('statusValidasi', 'in', ['Pending', 'Ditolak', 'Menunggu']),
      orderBy('nama', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as RegistrationRequest));
      setRequests(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleApprove = async (req: RegistrationRequest) => {
    try {
      await updateDoc(doc(db, 'residents', req.id), { 
        statusValidasi: 'Terverifikasi',
        verifiedAt: Timestamp.now()
      });
      
      // Update user status
      await updateDoc(doc(db, 'users', req.nik), { registrationStatus: 'verified' });

      const msg = `Selamat ${req.nama}! Registrasi Anda di Ruang Warga VSJ telah DISETUJUI. Sekarang Anda dapat mengakses dashboard penuh.`;
      setLastActionPhone(req.nomorHP);
      setLastActionMsg(msg);
      setSuccessMessage('Warga berhasil diverifikasi!');
      setShowSuccessModal(true);
      
      // Try auto-send
      await sendWhatsAppMessage(req.nomorHP, msg);
    } catch (error) {
      console.error('Error approving user:', error);
      showAlert('Gagal', "Gagal menyetujui warga.", 'error');
    }
  };

  const handleReject = async (req: RegistrationRequest) => {
    const reason = prompt("Masukkan alasan penolakan (misal: Foto KTP buram):", "Data tidak valid atau foto KTP/KK buram");
    if (!reason) return;

    try {
      await updateDoc(doc(db, 'residents', req.id), { 
        statusValidasi: 'Ditolak',
        rejectionReason: reason
      });

      // Allow user to try again
      await updateDoc(doc(db, 'users', req.nik), { registrationStatus: 'pending_input' });

      const msg = `Mohon maaf ${req.nama}, registrasi Anda di Ruang Warga VSJ DITOLAK. Alasan: ${reason}. Silakan login kembali dan lengkapi ulang data Anda.`;
      setLastActionPhone(req.nomorHP);
      setLastActionMsg(msg);
      setSuccessMessage('Pendaftaran warga ditolak.');
      setShowSuccessModal(true);
      
      await sendWhatsAppMessage(req.nomorHP, msg);
    } catch (error) {
      console.error('Error rejecting user:', error);
      showAlert('Gagal', "Gagal menolak warga.", 'error');
    }
  };

  const filteredRequests = requests.filter(r => 
    r.nama.toLowerCase().includes(search.toLowerCase()) || 
    r.nik.includes(search)
  );

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Persetujuan Warga</h1>
          <p className="page-subtitle">Tinjau dan verifikasi data pendaftaran warga baru</p>
        </div>
      </div>

      <div className="table-toolbar">
        <div className="search-box">
          <Search size={16} className="search-icon" />
          <input 
            type="text" 
            placeholder="Cari NIK atau Nama..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <Loader2 className="spin" size={32} style={{ color: 'var(--blue-600)', margin: '0 auto 16px' }} />
            <p style={{ color: 'var(--gray-50)' }}>Memuat antrian persetujuan...</p>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center' }}>
            <div style={{ width: 80, height: 80, background: 'var(--gray-50)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', color: 'var(--gray-300)' }}>
              <CheckCircle2 size={40} />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--gray-800)' }}>Tidak ada antrian</h3>
            <p style={{ color: 'var(--gray-500)' }}>Semua pendaftaran warga telah diproses.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Warga</th>
                  <th>NIK</th>
                  <th>RT</th>
                  <th>Status Saat Ini</th>
                  <th style={{ textAlign: 'right' }}>Aksi Verifikasi</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map(req => (
                  <tr key={req.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div className="admin-avatar" style={{ background: 'var(--blue-50)', color: 'var(--blue-600)' }}>
                          {req.nama.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600 }}>{req.nama}</div>
                          <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{req.nomorHP || '-'}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontFamily: 'monospace' }}>{req.nik}</td>
                    <td><span style={{ fontWeight: 600 }}>RT {req.rt_id}</span></td>
                    <td>
                      <span className="badge" style={{ 
                        background: req.statusValidasi === 'Ditolak' ? 'var(--red-50)' : 'var(--yellow-50)',
                        color: req.statusValidasi === 'Ditolak' ? 'var(--red-600)' : 'var(--yellow-600)',
                      }}>
                        {req.statusValidasi === 'Ditolak' ? 'Ditolak' : 'Menunggu Review'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button className="btn btn-secondary btn-sm" title="Tinjau Detail">
                          <Eye size={14} /> <span className="hide-mobile">Tinjau</span>
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleReject(req)}>
                          <XCircle size={14} /> <span className="hide-mobile">Tolak</span>
                        </button>
                        <button className="btn btn-primary btn-sm" onClick={() => handleApprove(req)}>
                          <CheckCircle2 size={14} /> <span className="hide-mobile">Setujui</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SUCCESS MODAL WITH WA OPTION */}
      {showSuccessModal && (
        <div className="modal-overlay" style={{ zIndex: 2100 }}>
          <div className="card fade-in shadow-xl" style={{ maxWidth: 360, width: '100%', padding: 32, borderRadius: 24, textAlign: 'center' }}>
            <img 
              src="/vira_ai_berhasil.png" 
              alt="Vira AI" 
              style={{ width: 140, height: 140, objectFit: 'contain', display: 'block', margin: '0 auto 20px' }} 
            />
            <h3 style={{ fontSize: 20, fontWeight: 800, color: 'var(--gray-800)', marginBottom: 12 }}>Berhasil!</h3>
            <p style={{ fontSize: 15, color: 'var(--gray-500)', marginBottom: 28, lineHeight: 1.5 }}>{successMessage}</p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                className="btn btn-secondary btn-block"
                style={{ padding: '12px', fontSize: '14px', fontWeight: 600, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                onClick={() => {
                  if (lastActionPhone) {
                    const cleanPhone = lastActionPhone.replace(/^0/, '62');
                    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(lastActionMsg)}`, '_blank');
                  }
                }}
              >
                <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" width={16} height={16} alt="WA" /> Kirim Ulang via WhatsApp
              </button>
              
              <button
                className="btn btn-primary btn-block"
                style={{ padding: '14px', fontSize: '15px', fontWeight: 700, borderRadius: '12px' }}
                onClick={() => setShowSuccessModal(false)}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
