import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, Search, Calendar, User as UserIcon, MapPin,
  CheckCircle, AlertCircle, Loader2, Send, Filter, ShieldCheck, 
  ChevronRight, X, Check, Clock, Play, AlertTriangle, MessageCircle, HelpCircle, Eye
} from 'lucide-react';
import { 
  collection, query, orderBy, onSnapshot, 
  doc, updateDoc, serverTimestamp, addDoc, Timestamp 
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { User } from '../types';
import { sendWhatsAppMessage } from '../services/notificationService';
import { showAlert } from '../utils/alert';
import { motion, AnimatePresence } from 'framer-motion';

interface AdminPengaduanPageProps {
  user: User;
}

interface Pengaduan {
  id: string;
  userId: string;
  userName: string;
  title: string;
  category: string;
  description: string;
  location: string;
  images: string[];
  video?: string | null;
  status: 'Pending' | 'Diterima' | 'Sudah Dilaksanakan' | 'Ditolak' | 'Di Proses' | 'Selesai';
  rt_id: string;
  rw_id: string;
  date: string;
  createdAt: any;
  adminNotes?: string;
  resolvedAt?: any;
  resolvedBy?: string;
  isPublic?: boolean;
  completionImage?: string;
}

export default function AdminPengaduanPage({ user }: AdminPengaduanPageProps) {
  const [reports, setReports] = useState<Pengaduan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<Pengaduan | null>(null);
  
  // Moderation form states
  const [adminNotes, setAdminNotes] = useState('');
  const [completionImage, setCompletionImage] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Image full view preview state
  const [expandedImage, setExpandedImage] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterRt, setFilterRt] = useState('all');

  // Real-time synchronization of resident reports (pengaduan)
  useEffect(() => {
    setLoading(true);
    // Real-time listener
    const q = query(
      collection(db, 'pengaduan'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const items: Pengaduan[] = [];
      snap.forEach((doc) => {
        const rawData = doc.data() as any;
        const data = { id: doc.id, ...rawData } as Pengaduan;
        if (user?.adminRole === 'rt') {
          // Filter by rt_id or rt
          const docRt = String(data.rt_id || rawData.rt || '');
          const userRt = String(user.rt_id || '');
          if (docRt.replace(/^0+/, '') === userRt.replace(/^0+/, '')) {
            items.push(data);
          }
        } else {
          items.push(data);
        }
      });
      setReports(items);
      setLoading(false);
    }, (err) => {
      console.error("Gagal memuat laporan pengaduan:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Update report status & resolution
  const handleUpdateStatus = async (reportId: string, nextStatus: string) => {
    setActionLoading(true);
    try {
      const docRef = doc(db, 'pengaduan', reportId);
      const updateData: any = {
        status: nextStatus,
        adminNotes: adminNotes.trim() || '',
        resolvedBy: user.name,
        resolvedAt: serverTimestamp()
      };

      if (nextStatus === 'Ditolak') {
        updateData.isPublic = false;
      } else if (nextStatus === 'Di Proses' || nextStatus === 'Diterima') {
        updateData.isPublic = true;
      } else if (nextStatus === 'Selesai' || nextStatus === 'Sudah Dilaksanakan') {
        if (completionImage) updateData.completionImage = completionImage;
        updateData.isPublic = true;
      }

      await updateDoc(docRef, updateData);

      // Notify the resident who submitted this report
      const report = reports.find(r => r.id === reportId);
      if (report?.userId) {
        let statusLabel = '';
        let emoji = '';
        if (nextStatus === 'Di Proses' || nextStatus === 'Diterima') {
          statusLabel = 'telah diterima oleh Admin dan sedang dalam proses peninjauan.';
          emoji = '⚙️';
        } else if (nextStatus === 'Selesai' || nextStatus === 'Sudah Dilaksanakan') {
          statusLabel = 'telah selesai dilaksanakan dan ditindaklanjuti oleh pengurus.';
          emoji = '✅';
        } else if (nextStatus === 'Ditolak') {
          statusLabel = 'telah ditolak oleh Admin. Silakan periksa catatan Admin.';
          emoji = '❌';
        }

        await addDoc(collection(db, 'notifications'), {
          type: 'system',
          title: `${emoji} Status Pengaduan: ${nextStatus}`,
          message: `Laporan Anda "${report.title}" ${statusLabel}`,
          targetAccountType: 'resident',
          targetRoles: ['resident', 'warga'],
          targetId: report.userId,
          route: '/warga/pengumuman',
          isRead: false,
          userPhotoUrl: '/vira_ai_avatar.png',
          createdAt: serverTimestamp()
        });
      }

      // Reset states
      setSelectedReport(null);
      setAdminNotes('');
      setCompletionImage(null);
      setSuccessMessage(`Status laporan pengaduan berhasil diubah menjadi "${nextStatus}" dan warga terkait telah dinotifikasi.`);
      setShowSuccessModal(true);
    } catch (err) {
      console.error("Gagal memproses laporan:", err);
      showAlert('Gagal', "Gagal memproses status laporan.", 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Computations for statistics
  const stats = {
    total: reports.length,
    pending: reports.filter(r => r.status === 'Pending').length,
    diterima: reports.filter(r => r.status === 'Diterima' || r.status === 'Di Proses').length,
    sudahDilaksanakan: reports.filter(r => r.status === 'Sudah Dilaksanakan' || r.status === 'Selesai').length,
    ditolak: reports.filter(r => r.status === 'Ditolak').length,
  };

  // Category Color Map
  const getCategoryBadge = (cat: string) => {
    switch (cat) {
      case 'Keamanan': return { bg: '#fee2e2', text: '#ef4444', label: '🛡️ Keamanan' };
      case 'Kebersihan': return { bg: '#ecfdf5', text: '#10b981', label: '🧹 Kebersihan' };
      case 'Infrastruktur': return { bg: '#eff6ff', text: '#3b82f6', label: '🏢 Infrastruktur' };
      case 'Ketertiban': return { bg: '#fef3c7', text: '#d97706', label: '📢 Ketertiban' };
      case 'Sosial': return { bg: '#f3e8ff', text: '#a855f7', label: '🤝 Sosial' };
      default: return { bg: '#f1f5f9', text: '#475569', label: '📦 Lainnya' };
    }
  };

  // Status Badge Map
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Pending': return { bg: '#fffbeb', text: '#d97706', label: '⏳ Baru' };
      case 'Diterima': 
      case 'Di Proses': return { bg: '#eff6ff', text: '#2563eb', label: '⚙️ Di Proses' };
      case 'Sudah Dilaksanakan':
      case 'Selesai': return { bg: '#ecfdf5', text: '#10b981', label: '✅ Selesai' };
      case 'Ditolak': return { bg: '#fef2f2', text: '#ef4444', label: '❌ Ditolak' };
      default: return { bg: '#f1f5f9', text: '#475569', label: '⏳ Baru' };
    }
  };

  // Filter reports
  const filteredReports = reports.filter(r => {
    const matchesSearch = 
      r.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.userName.toLowerCase().includes(searchTerm.toLowerCase());
      
    const matchesCategory = filterCategory === 'all' || r.category === filterCategory;
    const matchesStatus = filterStatus === 'all' || r.status === filterStatus;
    const matchesRt = filterRt === 'all' || String(r.rt_id).includes(filterRt);

    return matchesSearch && matchesCategory && matchesStatus && matchesRt;
  });

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }} 
      animate={{ opacity: 1, y: 0 }}
      style={{
        padding: '24px',
        maxWidth: '1200px',
        margin: '0 auto',
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        color: '#1e293b'
      }}
    >
      {/* HEADER SECTION */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div style={{ textAlign: 'left' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a', margin: '0 0 6px 0', letterSpacing: '-0.5px' }}>
            🗂️ Moderasi Pengaduan Warga RW 011
          </h2>
          <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
            Tinjau bukti foto/video, koordinasi dengan RT setempat, dan tangani pengaduan warga secara real-time.
          </p>
        </div>
      </div>

      {/* STATS BANNER */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 16,
        marginBottom: 24
      }}>
        {[
          { label: 'Total Pengaduan', value: stats.total, color: '#475569', bg: '#f8fafc' },
          { label: 'Laporan Baru', value: stats.pending, color: '#d97706', bg: '#fffbeb' },
          { label: 'Laporan Diterima', value: stats.diterima, color: '#2563eb', bg: '#eff6ff' },
          { label: 'Sudah Dilaksanakan', value: stats.sudahDilaksanakan, color: '#10b981', bg: '#ecfdf5' },
        ].map((s, idx) => (
          <div key={idx} style={{
            background: s.bg, padding: '20px', borderRadius: '16px', border: '1px solid #f1f5f9',
            boxShadow: '0 2px 8px rgba(0,0,0,0.01)', textAlign: 'left'
          }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>{s.label}</span>
            <h3 style={{ fontSize: '28px', fontWeight: 900, color: s.color, margin: '6px 0 0 0' }}>{s.value}</h3>
          </div>
        ))}
      </div>

      {/* FILTER BAR */}
      <div style={{
        background: '#ffffff', borderRadius: '20px', padding: '16px 20px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)', border: '1px solid #f1f5f9',
        display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginBottom: 24
      }}>
        {/* Search */}
        <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="Cari nama warga, subjek, atau kronologi..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{
              width: '100%', height: '40px', borderRadius: '10px', border: '1px solid #e2e8f0',
              padding: '0 16px 0 38px', fontSize: '12px', fontWeight: 600, outline: 'none'
            }}
          />
        </div>

        {/* RT Filter */}
        {user?.adminRole !== 'rt' && (
          <div style={{ minWidth: '110px' }}>
            <select
              value={filterRt}
              onChange={e => setFilterRt(e.target.value)}
              style={{
                width: '100%', height: '40px', borderRadius: '10px', border: '1px solid #e2e8f0',
                padding: '0 12px', fontSize: '12px', fontWeight: 700, color: '#334155', background: '#fff', outline: 'none'
              }}
            >
              <option value="all">RT: Semua</option>
              <option value="1">RT 001</option>
              <option value="2">RT 002</option>
              <option value="3">RT 003</option>
            </select>
          </div>
        )}

        {/* Category Filter */}
        <div style={{ minWidth: '130px' }}>
          <select
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            style={{
              width: '100%', height: '40px', borderRadius: '10px', border: '1px solid #e2e8f0',
              padding: '0 12px', fontSize: '12px', fontWeight: 700, color: '#334155', background: '#fff', outline: 'none'
            }}
          >
            <option value="all">Kategori: Semua</option>
            <option value="Keamanan">🛡️ Keamanan</option>
            <option value="Kebersihan">🧹 Kebersihan</option>
            <option value="Infrastruktur">🏢 Infrastruktur</option>
            <option value="Ketertiban">📢 Ketertiban</option>
            <option value="Sosial">🤝 Sosial</option>
            <option value="Lainnya">📦 Lainnya</option>
          </select>
        </div>

        {/* Status Filter */}
        <div style={{ minWidth: '130px' }}>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            style={{
              width: '100%', height: '40px', borderRadius: '10px', border: '1px solid #e2e8f0',
              padding: '0 12px', fontSize: '12px', fontWeight: 700, color: '#334155', background: '#fff', outline: 'none'
            }}
          >
            <option value="all">Status: Semua</option>
            <option value="Pending">⏳ Baru</option>
            <option value="Diterima">⚙️ Laporan Diterima</option>
            <option value="Sudah Dilaksanakan">✅ Sudah Dilaksanakan</option>
          </select>
        </div>
      </div>

      {/* RENDER CONTENT REPORTS */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: 12 }}>
          <Loader2 className="animate-spin" size={32} color="#2563eb" />
          <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>Menghubungkan data pengaduan...</span>
        </div>
      ) : filteredReports.length === 0 ? (
        <div style={{
          background: '#ffffff', borderRadius: '24px', padding: '60px 20px', textAlign: 'center',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)', border: '1px solid #f1f5f9'
        }}>
          <AlertCircle size={48} style={{ color: '#cbd5e1', margin: '0 auto 16px' }} />
          <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#1e293b', margin: '0 0 6px 0' }}>Tidak Ada Pengaduan Warga</h3>
          <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
            {searchTerm || filterCategory !== 'all' || filterStatus !== 'all' || filterRt !== 'all'
              ? 'Tidak ada pengaduan warga yang cocok dengan kriteria filter pencarian Anda.'
              : 'Seluruh lingkungan RW 011 aman & damai. Belum ada warga yang mengirim pengaduan.'}
          </p>
        </div>
      ) : (
        /* REPORTS GRID */
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
          {filteredReports.map((report) => {
            const catBadge = getCategoryBadge(report.category);
            const statBadge = getStatusBadge(report.status);

            return (
              <motion.div
                key={report.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => {
                  setSelectedReport(report);
                  setAdminNotes(report.adminNotes || '');
                }}
                style={{
                  background: '#ffffff', borderRadius: '20px', border: '1px solid #f1f5f9',
                  padding: '24px', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)', cursor: 'pointer',
                  textAlign: 'left', transition: 'all 0.15s ease'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 10px 25px rgba(0, 0, 0, 0.04)';
                  e.currentTarget.style.borderColor = '#e2e8f0';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.02)';
                  e.currentTarget.style.borderColor = '#f1f5f9';
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {/* Category */}
                    <span style={{
                      padding: '4px 10px', borderRadius: '8px', fontSize: '10px', fontWeight: 800,
                      background: catBadge.bg, color: catBadge.text
                    }}>
                      {catBadge.label}
                    </span>

                    {/* RT Badge */}
                    <span style={{
                      padding: '4px 10px', borderRadius: '8px', fontSize: '10px', fontWeight: 800,
                      background: '#f1f5f9', color: '#475569'
                    }}>
                      RT {String(report.rt_id).padStart(3, '0')}
                    </span>
                  </div>

                  {/* Status Badge */}
                  <span style={{
                    padding: '4px 10px', borderRadius: '8px', fontSize: '10px', fontWeight: 800,
                    background: statBadge.bg, color: statBadge.text
                  }}>
                    {statBadge.label}
                  </span>
                </div>

                <h3 style={{ fontSize: '15px', fontWeight: 900, color: '#0f172a', margin: '0 0 8px 0', lineHeight: 1.4 }}>
                  {report.title}
                </h3>

                <p style={{
                  fontSize: '12px', color: '#475569', lineHeight: 1.6, margin: '0 0 16px 0',
                  display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden'
                }}>
                  {report.description}
                </p>

                {/* Evidence Thumbnail Previews */}
                {((report.images && report.images.length > 0) || report.video) && (
                  <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                    {report.images && report.images.slice(0, 3).map((img, idx) => (
                      <div key={idx} style={{ width: 44, height: 44, borderRadius: 6, overflow: 'hidden', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                        <img src={img} alt="Bukti" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    ))}
                    {report.video && (
                      <div style={{
                        width: 44, height: 44, borderRadius: 6, overflow: 'hidden', border: '1px solid #e2e8f0',
                        background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff'
                      }}>
                        <Play size={14} fill="#fff" />
                      </div>
                    )}
                  </div>
                )}

                {/* Footer details */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  paddingTop: 14, borderTop: '1px solid #f8fafc'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: '26px', height: '26px', borderRadius: '50%', background: '#eff6ff',
                      color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '11px', fontWeight: 800
                    }}>
                      <UserIcon size={12} />
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#334155' }}>
                      {report.userName}
                    </span>
                  </div>

                  {/* Date and Location */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#94a3b8' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <MapPin size={12} />
                      <span style={{ fontSize: '10px', fontWeight: 700 }}>
                        {report.location.length > 25 ? report.location.slice(0, 25) + '...' : report.location}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Calendar size={12} />
                      <span style={{ fontSize: '10px', fontWeight: 700 }}>{report.date}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* DRAWER / DETAILED REPORT MODAL OVERLAY */}
      <AnimatePresence>
        {selectedReport && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(8px)', zIndex: 8000, display: 'flex',
            alignItems: 'center', justifyContent: 'center', padding: '20px'
          }}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              style={{
                background: '#ffffff', width: '100%', maxWidth: '640px', borderRadius: '24px',
                padding: '28px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
                color: '#0f172a', maxHeight: '90vh', overflowY: 'auto', textAlign: 'left'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{
                      padding: '4px 10px', borderRadius: '8px', fontSize: '10px', fontWeight: 800,
                      background: getCategoryBadge(selectedReport.category).bg, color: getCategoryBadge(selectedReport.category).text
                    }}>
                      {getCategoryBadge(selectedReport.category).label}
                    </span>
                    <span style={{
                      padding: '4px 10px', borderRadius: '8px', fontSize: '10px', fontWeight: 800,
                      background: '#f1f5f9', color: '#475569'
                    }}>
                      RT {String(selectedReport.rt_id).padStart(3, '0')}
                    </span>
                    <span style={{
                      padding: '4px 10px', borderRadius: '8px', fontSize: '10px', fontWeight: 800,
                      background: getStatusBadge(selectedReport.status).bg, color: getStatusBadge(selectedReport.status).text
                    }}>
                      {getStatusBadge(selectedReport.status).label}
                    </span>
                  </div>
                  <h3 style={{ fontSize: '18px', fontWeight: 950, color: '#0f172a', margin: 0, lineHeight: 1.4 }}>
                    {selectedReport.title}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedReport(null)}
                  style={{
                    border: 'none', background: '#f1f5f9', borderRadius: '50%',
                    width: '32px', height: '32px', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', cursor: 'pointer', color: '#64748b', flexShrink: 0
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* REPORT METADATA GRID */}
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
                background: '#f8fafc', padding: 14, borderRadius: 16, marginBottom: 20
              }}>
                <div>
                  <span style={{ fontSize: '10px', fontWeight: 800, color: '#64748b', display: 'block', textTransform: 'uppercase' }}>Nama Pelapor</span>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>{selectedReport.userName}</span>
                </div>
                <div>
                  <span style={{ fontSize: '10px', fontWeight: 800, color: '#64748b', display: 'block', textTransform: 'uppercase' }}>Tanggal Kirim</span>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>{selectedReport.date}</span>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <span style={{ fontSize: '10px', fontWeight: 800, color: '#64748b', display: 'block', textTransform: 'uppercase' }}>Lokasi Kejadian</span>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <MapPin size={14} color="#3b82f6" /> {selectedReport.location}
                  </span>
                </div>
              </div>

              {/* CHRONOLOGY DETAILS */}
              <div style={{ marginBottom: 20 }}>
                <span style={{ fontSize: '10px', fontWeight: 800, color: '#64748b', display: 'block', textTransform: 'uppercase', marginBottom: 6 }}>Kronologi / Deskripsi Laporan</span>
                <p style={{ fontSize: '13.5px', color: '#334155', lineHeight: 1.6, margin: 0, background: '#fff', border: '1px solid #f1f5f9', padding: 16, borderRadius: 16 }}>
                  {selectedReport.description}
                </p>
              </div>

              {/* EVIDENCE FILE PREVIEWS */}
              {((selectedReport.images && selectedReport.images.length > 0) || selectedReport.video) && (
                <div style={{ marginBottom: 24, borderTop: '1px solid #f1f5f9', paddingTop: 18 }}>
                  <span style={{ fontSize: '10px', fontWeight: 800, color: '#64748b', display: 'block', textTransform: 'uppercase', marginBottom: 10 }}>Berkas Bukti Pendukung (Foto & Video)</span>
                  
                  {/* Photo gallery */}
                  {selectedReport.images && selectedReport.images.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }}>
                      {selectedReport.images.map((img, idx) => (
                        <div 
                          key={idx} 
                          onClick={() => setExpandedImage(img)}
                          style={{
                            aspectRatio: '4/3', borderRadius: 12, overflow: 'hidden', border: '1px solid #e2e8f0',
                            background: '#f8fafc', cursor: 'pointer', position: 'relative'
                          }}
                        >
                          <img src={img} alt="evidence" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <div style={{
                            position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.15)', opacity: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
                            transition: 'opacity 0.2s'
                          }} onMouseEnter={e => e.currentTarget.style.opacity = '1'} onMouseLeave={e => e.currentTarget.style.opacity = '0'}>
                            <Eye size={18} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Video player */}
                  {selectedReport.video && (
                    <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #e2e8f0', background: '#0f172a' }}>
                      <video src={selectedReport.video} controls style={{ width: '100%', display: 'block' }} />
                    </div>
                  )}
                </div>
              )}

              {/* ACTION MODERATION CONTROLS */}
              {selectedReport.status === 'Pending' || selectedReport.status === 'Diterima' || selectedReport.status === 'Di Proses' ? (
                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 20 }}>
                  <span style={{ fontSize: '10px', fontWeight: 800, color: '#64748b', display: 'block', textTransform: 'uppercase', marginBottom: 8 }}>Form Tindak Lanjut & Resolusi Admin</span>
                  
                  <textarea
                    rows={3}
                    placeholder={selectedReport.status === 'Pending' ? "Masukkan catatan alasan menerima/menolak laporan ini..." : "Masukkan catatan instruksi/penyelesaian laporan (contoh: 'Selokan dibersihkan oleh tim oranye RT')..."}
                    value={adminNotes}
                    onChange={e => setAdminNotes(e.target.value)}
                    style={{
                      width: '100%', borderRadius: 12, border: '1px solid #cbd5e1', padding: 12,
                      fontSize: '13px', outline: 'none', resize: 'none', lineHeight: 1.5, marginBottom: 12
                    }}
                  />

                  {/* Jika di proses, izinkan unggah bukti gambar */}
                  {(selectedReport.status === 'Diterima' || selectedReport.status === 'Di Proses') && (
                    <div style={{ marginBottom: 16 }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 6 }}>Unggah Bukti Penyelesaian (Opsional)</span>
                      <input 
                        type="file" 
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onloadend = () => setCompletionImage(reader.result as string);
                          reader.readAsDataURL(file);
                        }}
                        style={{ fontSize: 12, color: '#64748b', width: '100%' }}
                      />
                      {completionImage && (
                        <div style={{ marginTop: 8 }}>
                          <img src={completionImage} alt="Bukti" style={{ height: 60, borderRadius: 8, border: '1px solid #cbd5e1' }} />
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 10 }}>
                    {selectedReport.status === 'Pending' ? (
                      <>
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={() => handleUpdateStatus(selectedReport.id, 'Ditolak')}
                          style={{
                            flex: 1, height: 44, borderRadius: 10, border: 'none', background: '#fee2e2', color: '#ef4444',
                            fontWeight: 800, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                          }}
                        >
                          {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <><X size={14} /> Tolak Laporan</>}
                        </button>
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={() => handleUpdateStatus(selectedReport.id, 'Di Proses')}
                          style={{
                            flex: 1, height: 44, borderRadius: 10, border: 'none', background: '#2563eb', color: '#fff',
                            fontWeight: 800, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                            boxShadow: '0 4px 10px rgba(37,99,235,0.2)'
                          }}
                        >
                          {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <><CheckCircle size={14} /> Terima Laporan</>}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => handleUpdateStatus(selectedReport.id, 'Selesai')}
                        style={{
                          flex: 1, height: 44, borderRadius: 10, border: 'none', background: '#10b981', color: '#fff',
                          fontWeight: 800, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                          boxShadow: '0 4px 10px rgba(16,185,129,0.2)'
                        }}
                      >
                        {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <><Check size={14} /> Sudah Dilaksanakan</>}
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                /* ARCHIVED ACTION LOGS */
                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 20, background: '#f8fafc', padding: 16, borderRadius: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <ShieldCheck size={16} color={selectedReport.status === 'Ditolak' ? "#ef4444" : "#10b981"} />
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#1e293b' }}>
                      {selectedReport.status === 'Ditolak' ? 'Laporan Ditolak' : 'Laporan Resmi Selesai Diproses (Sudah Dilaksanakan)'}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#475569', lineHeight: 1.5, marginBottom: 6 }}>
                    <strong>Ditangani Oleh:</strong> {selectedReport.resolvedBy || 'Pengurus RW'}
                  </div>
                  {selectedReport.adminNotes && (
                    <div style={{ fontSize: '12px', color: '#475569', lineHeight: 1.5, marginBottom: selectedReport.completionImage ? 6 : 0 }}>
                      <strong>Catatan Resolusi:</strong> "{selectedReport.adminNotes}"
                    </div>
                  )}
                  {selectedReport.completionImage && (
                    <div style={{ marginTop: 8 }}>
                      <strong style={{ fontSize: '11px', color: '#475569' }}>Bukti Penyelesaian:</strong>
                      <img 
                        src={selectedReport.completionImage} 
                        alt="Penyelesaian" 
                        onClick={() => setExpandedImage(selectedReport.completionImage!)}
                        style={{ height: 80, borderRadius: 8, marginTop: 6, cursor: 'zoom-in', display: 'block', border: '1px solid #cbd5e1' }} 
                      />
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* EXPANDED IMAGE MODAL */}
      <AnimatePresence>
        {expandedImage && (
          <div 
            onClick={() => setExpandedImage(null)}
            style={{
              position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15, 23, 42, 0.9)',
              backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              style={{ position: 'relative', maxWidth: '90%', maxHeight: '90%' }}
            >
              <img src={expandedImage} alt="Expanded evidence" style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: 16, objectFit: 'contain', border: '2px solid rgba(255,255,255,0.1)' }} />
              <button 
                onClick={() => setExpandedImage(null)}
                style={{
                  position: 'absolute', top: -40, right: 0, border: 'none', background: 'none',
                  color: '#fff', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4
                }}
              >
                <X size={20} /> Tutup
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SUCCESS MODAL FOR ACTION */}
      <AnimatePresence>
        {showSuccessModal && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(15, 23, 42, 0.5)',
            backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
          }}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              style={{
                background: '#ffffff', width: '100%', maxWidth: '400px', borderRadius: '24px',
                padding: '32px', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)'
              }}
            >
              <img 
                src="/vira_ai_berhasil.png" 
                alt="Berhasil" 
                style={{ width: 140, height: 140, objectFit: 'contain', display: 'block', margin: '0 auto 20px' }} 
              />
              <h3 style={{ fontSize: '20px', fontWeight: 900, color: '#0f172a', marginBottom: 12 }}>Tindak Lanjut Berhasil!</h3>
              <p style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.6, marginBottom: 28 }}>
                {successMessage}
              </p>
              <button
                onClick={() => setShowSuccessModal(false)}
                style={{
                  width: '100%', height: '48px', borderRadius: '12px', border: 'none',
                  background: '#2563eb', color: '#ffffff', fontWeight: 800, fontSize: '13px',
                  cursor: 'pointer', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)'
                }}
              >
                Mengerti
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
