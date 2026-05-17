import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  CheckCircle2, XCircle, Eye, 
  MessageCircle, Search, Filter, 
  Clock, ShieldAlert, Loader2,
  ExternalLink
} from 'lucide-react';
import { collection, query, where, onSnapshot, updateDoc, doc, Timestamp, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';
import { sendWhatsAppMessage } from '../services/notificationService';

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

export default function ApprovalListPage() {
  const [requests, setRequests] = useState<RegistrationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [lastActionPhone, setLastActionPhone] = useState('');
  const [lastActionMsg, setLastActionMsg] = useState('');

  useEffect(() => {
    // Fetch all residents and filter in-memory to catch all non-verified statuses (including undefined)
    const q = query(collection(db, 'residents'));

    const unsubscribe = onSnapshot(q, (snap) => {
      const allData = snap.docs.map(d => ({ id: d.id, ...d.data() } as RegistrationRequest));
      
      const currentUserStr = localStorage.getItem('erw_user');
      const currentUser = currentUserStr ? JSON.parse(currentUserStr) : null;
      
      // Filter only those who need approval (exclude verified)
      let data = allData.filter(r => r.statusValidasi !== 'Terverifikasi');
      
      // Role-based filtering: RT can only see their own RT's residents
      if (currentUser && (currentUser.role === 'rt' || currentUser.role?.toLowerCase().includes('rt'))) {
         data = data.filter(r => r.rt_id === currentUser.rt_id || r.rt === currentUser.rt_id);
      }
      // Sort in memory
      data.sort((a, b) => a.nama.localeCompare(b.nama));
      setRequests(data);
      setLoading(false);
    }, (err) => {
      console.error("Approval query error:", err);
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
      
      // Update user account status to allow login
      await updateDoc(doc(db, 'users', req.nik), { 
        registrationStatus: 'verified',
        accountStatus: 'active',
        isFirstLogin: false
      });

      const msg = `Selamat ${req.nama}! Registrasi Anda di Ruang Warga VSJ telah DISETUJUI. Sekarang Anda dapat mengakses dashboard penuh.`;
      setLastActionPhone(req.nomorHP);
      setLastActionMsg(msg);
      setSuccessMessage(`Warga ${req.nama} berhasil disetujui.`);
      setShowSuccessModal(true);
      
      await sendWhatsAppMessage(req.nomorHP, msg);
    } catch (err) {
      console.error(err);
      alert("Gagal menyetujui warga.");
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
      setSuccessMessage(`Registrasi ${req.nama} telah ditolak.`);
      setShowSuccessModal(true);
      
      await sendWhatsAppMessage(req.nomorHP, msg);
    } catch (err) {
      console.error(err);
      alert("Gagal menolak warga.");
    }
  };

  const filteredRequests = requests.filter(r => 
    r.nama.toLowerCase().includes(search.toLowerCase()) || 
    r.nik.includes(search)
  );

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 800 }}>Persetujuan Warga</h2>
          <p style={{ color: 'var(--gray-500)', fontSize: 14 }}>Tinjau dan verifikasi data pendaftaran warga baru</p>
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
            <p style={{ color: 'var(--gray-500)' }}>Memuat antrian persetujuan...</p>
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
                    <td style={{ textAlign: 'left' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div className="admin-avatar" style={{ background: 'var(--blue-50)', color: 'var(--blue-600)', width: 36, height: 36 }}>
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
                        <button className="btn btn-secondary btn-sm" title="Kirim WA" onClick={() => {
                          const msg = `Halo ${req.nama}, mohon segera lengkapi data Anda...`;
                          window.open(`https://wa.me/62${(req.nomorHP || '').replace(/^0/, '')}?text=${encodeURIComponent(msg)}`, '_blank');
                        }}>
                          <MessageCircle size={14} />
                        </button>
                        <button 
                          className={`btn btn-sm ${req.statusValidasi === 'Ditolak' ? 'btn-secondary' : 'btn-primary'}`} 
                          onClick={() => navigate(`/admin/dev/approval/${req.nik}`)}
                        >
                          {req.statusValidasi === 'Ditolak' ? (
                            <><CheckCircle2 size={14} /> <span className="hide-mobile">Telah Ditinjau</span></>
                          ) : (
                            <><Eye size={14} /> <span className="hide-mobile">Tinjau Data</span></>
                          )}
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
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="card fade-in shadow-xl" style={{ maxWidth: 360, width: '100%', padding: 32, borderRadius: 24, textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, background: 'var(--green-50)', color: 'var(--green-600)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <CheckCircle2 size={32} />
            </div>
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
                <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" width={16} height={16} alt="WA" /> Kirim Pesan WhatsApp
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
