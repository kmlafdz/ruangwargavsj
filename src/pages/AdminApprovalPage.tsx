import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  CheckCircle, XCircle, AlertTriangle, 
  User, FileText, MapPin, Calendar, 
  CreditCard, ShieldCheck, Clock,
  ChevronLeft, ExternalLink, Mail, Phone
} from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { processApproval } from '../services/registrationService';

export default function AdminApprovalPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [rejectNote, setRejectNote] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [lastActionPhone, setLastActionPhone] = useState('');
  const [lastActionMsg, setLastActionMsg] = useState('');
  const [isApproved, setIsApproved] = useState(false);


  useEffect(() => {
    async function fetchData() {
      if (!id) return;
      try {
        const { collection, query, where, getDocs } = await import('firebase/firestore');
        const q = query(collection(db, 'residents'), where('nik', '==', id));
        const snap = await getDocs(q);
        
        if (!snap.empty) {
          const docData = snap.docs[0].data();
          
          const currentUserStr = localStorage.getItem('erw_user');
          const currentUser = currentUserStr ? JSON.parse(currentUserStr) : null;
          
          if (currentUser && (currentUser.role === 'rt' || currentUser.role?.toLowerCase().includes('rt'))) {
             if (docData.rt_id !== currentUser.rt_id && docData.rt !== currentUser.rt_id) {
                 setData(null); // Access denied
                 setLoading(false);
                 return;
             }
          }
          
          setData({ id: snap.docs[0].id, ...docData });
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [id]);

  const handleAction = async (action: 'approved' | 'rejected') => {
    if (!id || !data) return;
    setProcessing(true);
    try {
      const { updateDoc, doc, Timestamp } = await import('firebase/firestore');
      
      if (action === 'approved') {
        // Approve Resident
        await updateDoc(doc(db, 'residents', data.id), { 
          statusValidasi: 'Terverifikasi',
          verifiedAt: Timestamp.now()
        });
        
        // Activate User and set new password
        const { getDoc, deleteField } = await import('firebase/firestore');
        const userDocRef = doc(db, 'users', data.nik);
        const userSnap = await getDoc(userDocRef);
        
        const updatePayload: any = { 
          registrationStatus: 'verified',
          accountStatus: 'active',
          isFirstLogin: false
        };
        
        if (userSnap.exists()) {
           const userData = userSnap.data();
           if (userData.pendingPassword) {
               updatePayload.password = userData.pendingPassword;
               updatePayload.pendingPassword = deleteField();
           }
           await updateDoc(userDocRef, updatePayload);
        }
        
        // --- Create Family Doc if Kepala Keluarga ---
        if (data.isKepalaKeluarga && data.noKK) {
           const { setDoc } = await import('firebase/firestore');
           const familyDocRef = doc(db, 'families', data.noKK);
           await setDoc(familyDocRef, {
               nomorKK: data.noKK,
               kepalaKeluarga: data.nama || data.fullName || '',
               kepalaKeluargaId: data.nik,
               alamat: `Blok ${data.blok || ''} No. ${data.nomorRumah || ''}`,
               rt: data.rt_id || data.rt || '',
               rw: data.rw_id || data.rw || '011',
               blok: data.blok || '',
               nomorRumah: data.nomorRumah || '',
               createdAt: Timestamp.now(),
               updatedAt: Timestamp.now(),
               status: 'active'
           }, { merge: true });
        }
        // --------------------------------------------

        let targetUserId = data.nik;
        let isFamilyMember = !data.isKepalaKeluarga;

        if (isFamilyMember && data.noKK) {
           const { doc: fDoc, getDoc: fGet } = await import('firebase/firestore');
           const famDoc = await fGet(fDoc(db, 'families', data.noKK));
           if (famDoc.exists() && famDoc.data().kepalaKeluargaId) {
               targetUserId = famDoc.data().kepalaKeluargaId;
           }
        }

        // Send WhatsApp Approval
        let msg = '';
        try {
          const { sendWhatsAppMessage, sendNotification } = await import('../services/notificationService');
          msg = isFamilyMember 
             ? `Halo, pengajuan penambahan anggota keluarga Anda atas nama ${data.nama || data.fullName} telah DISETUJUI oleh Admin.`
             : `Halo ${data.nama || data.fullName}, pengajuan akun Ruang Warga VSJ Anda telah DISETUJUI. Sekarang Anda dapat login dan mengakses layanan RW 011 secara penuh dengan password terbaru yang telah Anda buat. Terima kasih!`;
          if (data.nomorHP) await sendWhatsAppMessage(data.nomorHP, msg);
          
          await sendNotification(
            'approval',
            isFamilyMember ? 'Anggota Keluarga Disetujui' : 'Pendaftaran Disetujui',
            isFamilyMember 
               ? `Penambahan anggota keluarga atas nama ${data.nama || data.fullName} telah DISETUJUI.`
               : `Pengajuan pendaftaran warga Anda atas nama ${data.nama || data.fullName} telah DISETUJUI.`,
            ['warga'],
            { targetId: targetUserId, targetAccountType: 'resident', route: isFamilyMember ? '/warga/keluarga' : '/warga/dashboard' }
          );
        } catch (waErr) { console.error("WA Error:", waErr); }

        setIsApproved(true);
        setSuccessMessage(isFamilyMember
          ? `Penambahan anggota keluarga atas nama ${data.nama || data.fullName} telah disetujui.`
          : `Pengajuan pendaftaran warga atas nama ${data.nama || data.fullName} telah disetujui.`
        );
        setLastActionPhone(data.nomorHP || '');
        setLastActionMsg(msg);


      } else {
        // Reject Resident
        let targetUserId = data.nik;
        let isFamilyMember = !data.isKepalaKeluarga;
        
        if (isFamilyMember && data.noKK) {
           const { doc: fDoc, getDoc: fGet } = await import('firebase/firestore');
           const famDoc = await fGet(fDoc(db, 'families', data.noKK));
           if (famDoc.exists() && famDoc.data().kepalaKeluargaId) {
               targetUserId = famDoc.data().kepalaKeluargaId;
           }
        }

        await updateDoc(doc(db, 'residents', data.id), { 
          statusValidasi: 'Ditolak',
          rejectionReason: rejectNote,
          ktpPhotoUrl: '',
          kkPhotoUrl: '',
          facePhotoBase64: '',
          ktpUrl: '',
          kkUrl: '',
          fotoKK: ''
        });
        
        const { getDoc, updateDoc: updateDocReject, doc: docReject } = await import('firebase/firestore');
        const userDocRefRej = docReject(db, 'users', data.nik);
        const userSnapRej = await getDoc(userDocRefRej);
        if (userSnapRej.exists()) {
          const userPayload: any = { 
            rejectionReason: rejectNote,
            ktpPhotoUrl: '',
            kkPhotoUrl: '',
            facePhotoBase64: '',
            ktpUrl: '',
            kkUrl: ''
          };
          if (!isFamilyMember) {
            userPayload.registrationStatus = 'pending_input';
            userPayload.accountStatus = 'rejected';
          }
          await updateDocReject(userDocRefRej, userPayload);
        }

        // Send WhatsApp Rejection
        let msg = '';
        try {
          const { sendWhatsAppMessage, sendNotification } = await import('../services/notificationService');
          msg = isFamilyMember 
             ? `Halo, pengajuan penambahan anggota keluarga atas nama ${data.nama || data.fullName} DITOLAK karena: ${rejectNote}. Silakan cek aplikasi untuk memperbaikinya.`
             : `Halo ${data.nama || data.fullName}, pengajuan akun Ruang Warga VSJ Anda PERLU REVISI. Alasan: ${rejectNote}. Silakan login kembali ke aplikasi menggunakan akun yang sama untuk memperbaiki data. Terima kasih.`;
          if (data.nomorHP) await sendWhatsAppMessage(data.nomorHP, msg);

          await sendNotification(
            'rejection',
            isFamilyMember ? 'Anggota Keluarga Ditolak' : 'Pengajuan Ditolak',
            isFamilyMember
              ? `Penambahan anggota keluarga atas nama ${data.nama || data.fullName} ditolak. Alasan: ${rejectNote}`
              : `Pengajuan pendaftaran Anda perlu direvisi. Alasan: ${rejectNote}`,
            ['warga'],
            { targetId: targetUserId, targetAccountType: 'resident', route: isFamilyMember ? '/warga/keluarga' : '/warga/aktivasi' }
          );
        } catch (waErr) { console.error("WA Error:", waErr); }

        setIsApproved(false);
        setSuccessMessage(isFamilyMember
          ? `Penambahan anggota keluarga atas nama ${data.nama || data.fullName} telah ditolak.`
          : `Pengajuan pendaftaran warga atas nama ${data.nama || data.fullName} telah ditolak.`
        );
        setLastActionPhone(data.nomorHP || '');
        setLastActionMsg(msg);
      }
      
      setShowSuccessModal(true); 
    } catch (err) {
      console.error(err);
    } finally {
      setProcessing(false);
      setShowRejectModal(false);
    }
  };

  if (loading) return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--gray-400)' }}>
      <div className="spinner" style={{ margin: '0 auto 16px' }}></div>
      Memuat data pendaftaran...
    </div>
  );

  if (!data) return (
    <div className="card" style={{ padding: 40, textAlign: 'center' }}>
      <XCircle size={48} style={{ color: 'var(--red-500)', marginBottom: 16 }} />
      <h3>Data Tidak Ditemukan</h3>
      <p>ID pendaftaran mungkin salah atau sudah dihapus.</p>
      <button className="btn btn-secondary" onClick={() => navigate(-1)} style={{ marginTop: 20 }}>
        <ChevronLeft size={16} /> Kembali
      </button>
    </div>
  );

  const isAutoApproved = data.status === 'auto_approved';
  const score = data.matchScore || 0;

  return (
    <div className="fade-in">
      {/* Zoom Modal */}
      {zoomedImage && (
        <div 
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}
          onClick={() => setZoomedImage(null)}
        >
          <img src={zoomedImage} alt="Zoomed" style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain', borderRadius: 8 }} />
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate(-1)}>
          <ChevronLeft size={16} /> Kembali
        </button>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800 }}>Persetujuan Warga Baru</h2>
          <p style={{ fontSize: 13, color: 'var(--gray-500)' }}>ID: {id}</p>
        </div>
      </div>

      <div className="approval-main-grid">
        {/* Left Column: Data & Documents */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* AI Verification Summary */}
          <div style={{ 
            background: score >= 85 ? 'var(--green-50)' : 'var(--blue-50)', 
            border: `1px solid ${score >= 85 ? 'var(--green-200)' : 'var(--blue-200)'}`,
            borderRadius: 12, padding: 20, display: 'flex', alignItems: 'center', gap: 20,
            position: 'relative', overflow: 'hidden'
          }}>
            <div style={{ 
              width: 60, height: 60, borderRadius: '50%', 
              background: score >= 85 ? 'var(--green-600)' : 'var(--blue-600)',
              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, fontWeight: 800, flexShrink: 0
            }}>
              {score}%
            </div>
            <div>
              <h4 style={{ color: score >= 85 ? 'var(--green-800)' : 'var(--blue-800)', marginBottom: 4 }}>
                Skor Verifikasi AI {score >= 85 ? '(Sangat Akurat)' : '(Perlu Review)'}
              </h4>
              <p style={{ fontSize: 13, color: 'var(--gray-600)', lineHeight: 1.5 }}>
                {score >= 85 
                  ? 'Sistem AI mendeteksi data input warga cocok dengan data pada gambar KTP.'
                  : 'Sistem AI mendeteksi ketidakcocokan minor atau kualitas gambar rendah.'}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 11, color: 'var(--red-600)', fontWeight: 600 }}>
                <Clock size={12} /> Data foto akan dihapus otomatis dalam 48 jam untuk keamanan.
              </div>
            </div>
          </div>

          {/* Resident Details & Photos Grid */}
          <div className="approval-inner-grid">
            {/* Data Card */}
            <div className="card">
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--gray-100)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                <User size={18} className="text-blue" /> Data Profil Warga
              </div>
              <div style={{ padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ fontSize: 10, color: 'var(--gray-400)', textTransform: 'uppercase' }}>Nama Lengkap</label>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{data.nama || data.fullName}</div>
                </div>
                <div>
                  <label style={{ fontSize: 10, color: 'var(--gray-400)', textTransform: 'uppercase' }}>NIK</label>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{data.nik}</div>
                </div>
                <div>
                  <label style={{ fontSize: 10, color: 'var(--gray-400)', textTransform: 'uppercase' }}>Nomor HP</label>
                  <div style={{ fontSize: 14 }}>{data.nomorHP}</div>
                </div>
                <div>
                  <label style={{ fontSize: 10, color: 'var(--gray-400)', textTransform: 'uppercase' }}>Nomor KK</label>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{data.noKK || data.kkNumber || '-'}</div>
                </div>
                <div>
                  <label style={{ fontSize: 10, color: 'var(--gray-400)', textTransform: 'uppercase' }}>Tempat Lahir</label>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{data.tempatLahir || '-'}</div>
                </div>
                <div>
                  <label style={{ fontSize: 10, color: 'var(--gray-400)', textTransform: 'uppercase' }}>Agama</label>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{data.agama || '-'}</div>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ fontSize: 10, color: 'var(--gray-400)', textTransform: 'uppercase' }}>Alamat KTP</label>
                  <div style={{ fontSize: 13, display: 'flex', gap: 6, marginTop: 4 }}>
                    <MapPin size={14} className="text-blue" style={{ flexShrink: 0 }} />
                    {data.alamat || data.address || '-'}
                  </div>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ fontSize: 10, color: 'var(--gray-400)', textTransform: 'uppercase' }}>Alamat Perumahan (Domisili)</label>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--blue-700)', marginTop: 4 }}>
                    {data.blok ? `Blok ${data.blok}, Nomor ${data.nomorRumah} — RT ${data.rt_id || data.rt} / RW ${data.rw_id || data.rw || '011'}` : 'Data perumahan belum diisi'}
                  </div>
                </div>
              </div>
            </div>

            {/* Document Previews Card */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div className="card" style={{ flex: 1 }}>
                <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--gray-100)', fontWeight: 600, fontSize: 12, background: 'var(--gray-50)' }}>Foto KTP</div>
                <div style={{ padding: 12 }}>
                  {(data.ktpPhotoUrl || data.ktpUrl) ? (
                    <div style={{ position: 'relative' }}>
                      <img src={data.ktpPhotoUrl || data.ktpUrl} alt="KTP" onClick={() => setZoomedImage(data.ktpPhotoUrl || data.ktpUrl)} style={{ width: '100%', borderRadius: 8, border: '1px solid var(--gray-200)', maxHeight: 200, objectFit: 'contain', cursor: 'zoom-in' }} />
                    </div>
                  ) : (
                    <div style={{ padding: 30, color: 'var(--gray-300)', textAlign: 'center', fontSize: 12 }}>Foto KTP tidak tersedia</div>
                  )}
                </div>
              </div>
              <div className="card" style={{ flex: 1 }}>
                <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--gray-100)', fontWeight: 600, fontSize: 12, background: 'var(--gray-50)' }}>Foto Kartu Keluarga</div>
                <div style={{ padding: 12 }}>
                  {(data.kkPhotoUrl || data.kkUrl || data.fotoKK) ? (
                    <div style={{ position: 'relative' }}>
                      <img src={data.kkPhotoUrl || data.kkUrl || data.fotoKK} alt="KK" onClick={() => setZoomedImage(data.kkPhotoUrl || data.kkUrl || data.fotoKK)} style={{ width: '100%', borderRadius: 8, border: '1px solid var(--gray-200)', maxHeight: 200, objectFit: 'contain', cursor: 'zoom-in' }} />
                    </div>
                  ) : (
                    <div style={{ padding: 30, color: 'var(--gray-300)', textAlign: 'center', fontSize: 12 }}>Foto KK tidak tersedia</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Actions & Status */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Face Detection Preview (AI Crop) */}
          <div className="card" style={{ textAlign: 'center', padding: 24 }}>
            <div style={{ 
              width: 100, height: 100, borderRadius: '50%', 
              margin: '0 auto 16px', border: '4px solid var(--blue-100)',
              overflow: 'hidden', background: 'var(--gray-100)'
            }}>
              {data.facePhotoBase64 ? (
                <img src={data.facePhotoBase64} alt="Wajah" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gray-300)' }}>
                  <User size={48} />
                </div>
              )}
            </div>
            <h4 style={{ marginBottom: 4 }}>Foto Verifikasi AI</h4>
            <p style={{ fontSize: 12, color: 'var(--gray-500)' }}>Wajah dideteksi & di-crop dari KTP</p>
          </div>

          <div className="card" style={{ padding: 20 }}>
            <h4 style={{ marginBottom: 16 }}>Keputusan Admin</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {(data.statusValidasi === 'Terverifikasi' || data.statusValidasi === 'Ditolak') ? (
                <div style={{ padding: '16px', background: 'var(--gray-100)', color: 'var(--gray-600)', borderRadius: '12px', textAlign: 'center', fontWeight: 600, fontSize: '14px', border: '1px solid var(--gray-200)' }}>
                  Data telah ditinjau ({data.statusValidasi})
                </div>
              ) : (
                <>
                  <button 
                    className="btn btn-primary" 
                    style={{ 
                      background: '#22c55e', 
                      color: '#000000',
                      width: '100%', 
                      justifyContent: 'center',
                      fontWeight: 'bold',
                      border: '1px solid #16a34a'
                    }}
                    onClick={() => handleAction('approved')}
                    disabled={processing}
                  >
                    <CheckCircle size={18} /> {processing ? 'Memproses...' : 'Setujui Pendaftaran'}
                  </button>

                  <button 
                    className="btn btn-secondary" 
                    style={{ color: 'var(--red-600)', borderColor: 'var(--red-200)', width: '100%', justifyContent: 'center' }}
                    onClick={() => setShowRejectModal(true)}
                    disabled={processing}
                  >
                    <XCircle size={18} /> Tolak / Revisi
                  </button>
                </>
              )}
            </div>
            
            <div style={{ marginTop: 20, padding: 12, background: 'var(--gray-50)', borderRadius: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--gray-600)', marginBottom: 8 }}>
                <Clock size={14} /> Riwayat Sistem
              </div>
              <ul style={{ padding: 0, margin: 0, listStyle: 'none', fontSize: 11, color: 'var(--gray-500)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <li>• Pendaftaran dibuat: {data.createdAt?.toDate().toLocaleString()}</li>
                <li>• Status AI: {data.status} ({score}%)</li>
                {data.ktpExpiresAt && (
                  <li style={{ color: 'var(--red-500)' }}>• File KTP akan dihapus otomatis: {data.ktpExpiresAt.toDate().toLocaleString()}</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
          <div className="card" style={{ width: 400, padding: 24 }}>
            <h3>Tolak Pendaftaran</h3>
            <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 16 }}>Berikan alasan penolakan agar warga dapat melakukan revisi.</p>
            <textarea 
              className="form-input" 
              style={{ 
                height: 120, 
                width: '100%', 
                marginBottom: 24,
                padding: 12,
                fontSize: 14,
                resize: 'none'
              }} 
              placeholder="Contoh: Foto KTP tidak jelas, NIK tidak sesuai..."
              value={rejectNote}
              onChange={e => setRejectNote(e.target.value)}
            />
            <div style={{ display: 'flex', gap: 12 }}>
              <button 
                className="btn btn-secondary" 
                style={{ flex: 1, padding: '12px' }} 
                onClick={() => setShowRejectModal(false)}
              >
                Batal
              </button>
              <button 
                className="btn btn-primary" 
                style={{ 
                  flex: 1, 
                  background: '#dc2626', 
                  color: '#ffffff',
                  padding: '12px',
                  border: 'none',
                  fontWeight: 'bold'
                }} 
                onClick={() => handleAction('rejected')} 
                disabled={!rejectNote || processing}
              >
                {processing ? 'Memproses...' : 'Konfirmasi Tolak'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Success / Rejection Modal */}
      {showSuccessModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2100 }}>
          <div className="card fade-in shadow-xl" style={{ maxWidth: 360, width: '100%', padding: 32, borderRadius: 24, textAlign: 'center', background: '#fff' }}>
            <img 
              src="/vira_ai_berhasil.png" 
              alt="Vira AI" 
              style={{ width: 140, height: 140, objectFit: 'contain', display: 'block', margin: '0 auto 20px' }} 
            />
            <h3 style={{ fontSize: 20, fontWeight: 800, color: 'var(--gray-800)', marginBottom: 12 }}>
              {isApproved ? "Berhasil!" : "Pengajuan Ditolak"}
            </h3>
            <p style={{ fontSize: 15, color: 'var(--gray-500)', marginBottom: 28, lineHeight: 1.5 }}>{successMessage}</p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                className="btn btn-secondary btn-block"
                style={{ padding: '12px', fontSize: '14px', fontWeight: 600, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%' }}
                onClick={() => {
                  if (lastActionPhone) {
                    const cleanPhone = lastActionPhone.replace(/^0/, '62');
                    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(lastActionMsg)}`, '_blank');
                  }
                }}
              >
                <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" width={16} height={16} alt="WA" /> Kirim via WhatsApp
              </button>
              
              <button
                className="btn btn-primary btn-block"
                style={{ padding: '14px', fontSize: '15px', fontWeight: 700, borderRadius: '12px', width: '100%' }}
                onClick={() => {
                  setShowSuccessModal(false);
                  navigate('/admin/dev/approvals');
                }}
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
