import React, { useState, useEffect } from 'react';
import { 
  FileText, Search, Plus, 
  CheckCircle, XCircle, Clock,
  Eye, Download, Filter, Loader2, Send, AlertCircle,
  ChevronRight, ArrowLeft, MoreVertical,
  Calendar, Info, FileStack, BadgeCheck
} from 'lucide-react';
import { db } from '../firebase/config';
import { collection, query, where, onSnapshot, addDoc, orderBy, serverTimestamp } from 'firebase/firestore';
import { User } from '../types';
import { motion, AnimatePresence } from 'framer-motion';

export default function SuratPage() {
  const [user] = useState<User | null>(() => {
    const saved = localStorage.getItem('erw_user');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('Semua');
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'riwayat' | 'informasi'>('riwayat');
  
  const [formData, setFormData] = useState({
    jenis: 'Surat Pengantar Domisili',
    keperluan: '',
    keterangan: ''
  });

  const isAdmin = user?.role === 'rw' || user?.role === 'rt' || user?.role === 'developer';

  useEffect(() => {
    if (!user) return;

    let q;
    if (isAdmin) {
      q = query(collection(db, 'surat_requests'), orderBy('createdAt', 'desc'));
    } else {
      q = query(
        collection(db, 'surat_requests'), 
        where('wargaId', '==', user.id),
        orderBy('createdAt', 'desc')
      );
    }

    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRequests(data);
      setLoading(false);
    }, (err) => {
      console.error("Firestore Error:", err);
      setLoading(false);
    });

    return () => unsub();
  }, [user, isAdmin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !formData.keperluan) return;
    
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'surat_requests'), {
        ...formData,
        wargaId: user.id,
        wargaName: user.name,
        rt_id: user.rt_id,
        nik: user.nik,
        status: 'Pending',
        nomor: `SRT/${Math.floor(100 + Math.random() * 900)}/${new Date().getFullYear()}`,
        createdAt: serverTimestamp(),
      });
      setShowForm(false);
      setFormData({ jenis: 'Surat Pengantar Domisili', keperluan: '', keterangan: '' });
    } catch (e) {
      console.error("Error submitting:", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filtered = requests.filter((r: any) => {
    const matchesSearch = (r.wargaName || '').toLowerCase().includes(search.toLowerCase()) || 
                          (r.nomor || '').toLowerCase().includes(search.toLowerCase()) ||
                          (r.jenis || '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === 'Semua' || r.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: requests.length,
    pending: requests.filter((r: any) => r.status === 'Pending').length,
    approved: requests.filter((r: any) => r.status === 'Disetujui').length,
    rejected: requests.filter((r: any) => r.status === 'Ditolak').length
  };

  const letterTypes = [
    { title: 'Pengantar Domisili', desc: 'Untuk pengurusan KTP atau domisili sementara.', icon: FileText, color: '#3b82f6' },
    { title: 'SKTM', desc: 'Surat Keterangan Tidak Mampu untuk keringanan biaya.', icon: AlertCircle, color: '#f59e0b' },
    { title: 'Pengantar Nikah', desc: 'Dokumen syarat administrasi pernikahan.', icon: FileStack, color: '#ec4899' },
    { title: 'Keterangan Usaha', desc: 'Untuk pengajuan kredit atau izin usaha.', icon: BadgeCheck, color: '#10b981' },
  ];

  return (
    <div className="surat-page-container">
      {/* MOBILE HEADER & ACTION */}
      <div className="mobile-only-header">
        <div className="header-flex">
          <div>
            <h2 className="mobile-title">Persuratan</h2>
            <p className="mobile-subtitle">{isAdmin ? 'Kelola pengajuan warga' : 'Layanan mandiri warga'}</p>
          </div>
          {!isAdmin && (
            <motion.button 
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowForm(true)}
              className="btn-add-surat"
            >
              <Plus size={20} />
            </motion.button>
          )}
        </div>

        <div className="status-pills-scroll">
          {['Semua', 'Pending', 'Disetujui', 'Ditolak'].map(st => (
            <button 
              key={st} 
              className={`pill-item ${filterStatus === st ? 'active' : ''}`}
              onClick={() => setFilterStatus(st)}
            >
              {st}
              {st !== 'Semua' && <span className="pill-count">{stats[st.toLowerCase() as keyof typeof stats]}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* WEB DASHBOARD HEADER */}
      <div className="web-only-header">
        <div className="web-header-top">
          <div className="title-area">
            <h1>Manajemen Surat</h1>
            <p>Sistem pengajuan dan monitoring persuratan digital VSJ</p>
          </div>
          {!isAdmin && (
            <button className="btn-premium" onClick={() => setShowForm(true)}>
              <Plus size={18} />
              Buat Pengajuan Baru
            </button>
          )}
        </div>

        <div className="stats-dashboard">
          <div className="glass-stat-card">
            <div className="stat-icon-bg" style={{ background: '#eff6ff', color: '#3b82f6' }}><FileText size={22} /></div>
            <div className="stat-info">
              <span className="stat-label">Total Pengajuan</span>
              <span className="stat-value">{stats.total}</span>
            </div>
          </div>
          <div className="glass-stat-card">
            <div className="stat-icon-bg" style={{ background: '#fffbeb', color: '#d97706' }}><Clock size={22} /></div>
            <div className="stat-info">
              <span className="stat-label">Menunggu</span>
              <span className="stat-value">{stats.pending}</span>
            </div>
          </div>
          <div className="glass-stat-card">
            <div className="stat-icon-bg" style={{ background: '#f0fdf4', color: '#16a34a' }}><CheckCircle size={22} /></div>
            <div className="stat-info">
              <span className="stat-label">Disetujui</span>
              <span className="stat-value">{stats.approved}</span>
            </div>
          </div>
        </div>
      </div>

      {/* CONTENT AREA */}
      <div className="surat-content">
        <div className="search-filter-bar">
          <div className="premium-search">
            <Search size={18} color="#94a3b8" />
            <input 
              type="text" 
              placeholder="Cari nomor surat atau jenis pengajuan..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="web-filter">
             <Filter size={18} color="#64748b" />
             <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                <option>Semua</option>
                <option>Pending</option>
                <option>Disetujui</option>
                <option>Ditolak</option>
             </select>
          </div>
        </div>

        {loading ? (
          <div className="loading-state">
            <Loader2 size={40} className="animate-spin" color="#3b82f6" />
            <p>Menghubungkan ke server...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
             <div className="empty-icon-box">
                <FileStack size={48} color="#cbd5e1" />
             </div>
             <h3>Tidak Ada Data</h3>
             <p>Belum ada riwayat pengajuan surat yang ditemukan.</p>
             {!isAdmin && <button onClick={() => setShowForm(true)} className="btn-text">Buat pengajuan sekarang</button>}
          </div>
        ) : (
          <div className="requests-grid">
            {filtered.map((req, idx) => (
              <motion.div 
                key={req.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="letter-card"
              >
                <div className="card-top">
                  <div className="type-badge" style={{ 
                    background: req.jenis.includes('Domisili') ? '#dbeafe' : 
                               req.jenis.includes('SKTM') ? '#fef3c7' : '#fce7f3',
                    color: req.jenis.includes('Domisili') ? '#1e40af' : 
                           req.jenis.includes('SKTM') ? '#92400e' : '#9d174d'
                  }}>
                    {req.jenis}
                  </div>
                  <div className={`status-badge-flat ${req.status.toLowerCase()}`}>
                    {req.status === 'Pending' && <Clock size={12} />}
                    {req.status === 'Disetujui' && <CheckCircle size={12} />}
                    {req.status === 'Ditolak' && <XCircle size={12} />}
                    {req.status}
                  </div>
                </div>

                <div className="card-middle">
                  <h4 className="req-nomor">{req.nomor}</h4>
                  <div className="req-meta">
                    <Calendar size={13} />
                    <span>{req.createdAt?.seconds ? new Date(req.createdAt.seconds * 1000).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Baru saja'}</span>
                  </div>
                  {isAdmin && (
                    <div className="req-owner">
                      <div className="owner-avatar">{req.wargaName?.charAt(0)}</div>
                      <div className="owner-info">
                        <div className="owner-name">{req.wargaName}</div>
                        <div className="owner-rt">RT 0{req.rt_id} / RW 011</div>
                      </div>
                    </div>
                  )}
                  <p className="req-keperluan">{req.keperluan}</p>
                </div>

                <div className="card-bottom">
                  <button className="btn-card-action">
                    <Eye size={16} />
                    Detail
                  </button>
                  {req.status === 'Disetujui' && (
                    <button className="btn-card-action primary">
                      <Download size={16} />
                      Unduh PDF
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* SUBMISSION MODAL */}
      <AnimatePresence>
        {showForm && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="modal-overlay"
          >
            <motion.div 
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="modal-sheet"
            >
              <div className="sheet-header">
                <div className="sheet-handle" />
                <h3>Buat Pengajuan Surat</h3>
                <button className="btn-close-sheet" onClick={() => setShowForm(false)}>
                  <XCircle size={24} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="sheet-form">
                <div className="form-group">
                  <label>Pilih Jenis Surat</label>
                  <div className="type-selector-grid">
                    {letterTypes.map(type => (
                      <div 
                        key={type.title}
                        className={`type-option ${formData.jenis.includes(type.title) ? 'selected' : ''}`}
                        onClick={() => setFormData({...formData, jenis: `Surat ${type.title}`})}
                      >
                        <div className="type-icon" style={{ background: type.color + '15', color: type.color }}>
                          <type.icon size={20} />
                        </div>
                        <div className="type-text">
                          <span className="type-title">{type.title}</span>
                          <span className="type-desc">{type.desc}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label>Tujuan / Keperluan</label>
                  <textarea 
                    placeholder="Contoh: Untuk persyaratan pendaftaran sekolah anak di SMA 1 Jakarta."
                    value={formData.keperluan}
                    onChange={e => setFormData({...formData, keperluan: e.target.value})}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Keterangan Tambahan (Opsional)</label>
                  <input 
                    type="text"
                    placeholder="Catatan tambahan jika diperlukan..."
                    value={formData.keterangan}
                    onChange={e => setFormData({...formData, keterangan: e.target.value})}
                  />
                </div>

                <div className="form-actions">
                  <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Batal</button>
                  <button type="submit" className="btn-submit" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <><Send size={18} /> Kirim Pengajuan</>}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .surat-page-container {
          min-height: calc(100vh - 80px);
          padding: 24px;
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
          max-width: 1200px;
          margin: 0 auto;
        }

        /* Responsive Visibility */
        .mobile-only-header { display: none; }
        .web-only-header { display: block; }

        @media (max-width: 768px) {
          .surat-page-container { padding: 16px; padding-bottom: 100px; }
          .mobile-only-header { display: block; }
          .web-only-header { display: none; }
          .surat-content { margin-top: 16px; }
        }

        /* Web Header Styles */
        .web-header-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }
        .web-header-top h1 { font-size: 28px; font-weight: 900; color: #0f172a; margin: 0; }
        .web-header-top p { color: #64748b; font-size: 15px; margin: 4px 0 0; }

        .btn-premium {
          display: flex;
          align-items: center;
          gap: 10px;
          background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
          color: #fff;
          padding: 12px 24px;
          border-radius: 16px;
          border: none;
          font-weight: 700;
          font-size: 14px;
          cursor: pointer;
          box-shadow: 0 10px 20px -5px rgba(37, 99, 235, 0.3);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .btn-premium:hover { transform: translateY(-2px); box-shadow: 0 15px 25px -5px rgba(37, 99, 235, 0.4); }

        .stats-dashboard {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
          margin-bottom: 32px;
        }
        .glass-stat-card {
          background: #fff;
          border-radius: 24px;
          padding: 20px;
          display: flex;
          align-items: center;
          gap: 20px;
          border: 1px solid #f1f5f9;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
        }
        .stat-icon-bg {
          width: 52px;
          height: 52px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .stat-label { font-size: 13px; color: #64748b; display: block; }
        .stat-value { font-size: 24px; font-weight: 900; color: #0f172a; }

        /* Mobile Header Styles */
        .mobile-title { font-size: 22px; font-weight: 900; color: #0f172a; margin: 0; }
        .mobile-subtitle { font-size: 13px; color: #64748b; margin: 2px 0 12px; }
        .header-flex { display: flex; justify-content: space-between; align-items: flex-start; }
        
        .btn-add-surat {
          width: 44px;
          height: 44px;
          background: #2563eb;
          color: #fff;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2);
        }

        .status-pills-scroll {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding: 4px 0 12px;
          scrollbar-width: none;
        }
        .status-pills-scroll::-webkit-scrollbar { display: none; }
        
        .pill-item {
          padding: 8px 16px;
          border-radius: 20px;
          background: #fff;
          border: 1px solid #e2e8f0;
          font-size: 13px;
          font-weight: 600;
          color: #64748b;
          white-space: nowrap;
          display: flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
        }
        .pill-item.active {
          background: #2563eb;
          border-color: #2563eb;
          color: #fff;
        }
        .pill-count {
          background: rgba(0,0,0,0.1);
          padding: 2px 6px;
          border-radius: 8px;
          font-size: 11px;
        }

        /* Content Styles */
        .search-filter-bar {
          display: flex;
          gap: 16px;
          margin-bottom: 24px;
        }
        .premium-search {
          flex: 1;
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          display: flex;
          align-items: center;
          padding: 0 16px;
          height: 52px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.02);
        }
        .premium-search input {
          flex: 1;
          border: none;
          background: none;
          padding: 0 12px;
          font-size: 14px;
          outline: none;
          color: #1e293b;
        }
        .web-filter {
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          display: flex;
          align-items: center;
          padding: 0 16px;
          gap: 10px;
          height: 52px;
        }
        .web-filter select { border: none; background: none; font-size: 14px; font-weight: 600; color: #475569; outline: none; }

        @media (max-width: 768px) {
          .web-filter { display: none; }
          .premium-search { height: 48px; border-radius: 14px; }
        }

        /* Card Styles */
        .requests-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 20px;
        }
        @media (max-width: 480px) {
          .requests-grid { grid-template-columns: 1fr; }
        }

        .letter-card {
          background: #fff;
          border-radius: 24px;
          border: 1px solid #f1f5f9;
          padding: 20px;
          display: flex;
          flex-direction: column;
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
        }
        .letter-card:hover { transform: translateY(-4px); box-shadow: 0 12px 24px -10px rgba(0,0,0,0.1); border-color: #e2e8f0; }

        .card-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        .type-badge {
          padding: 6px 12px;
          border-radius: 10px;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .status-badge-flat {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 12px;
          font-weight: 700;
        }
        .status-badge-flat.pending { color: #d97706; }
        .status-badge-flat.disetujui { color: #16a34a; }
        .status-badge-flat.ditolak { color: #ef4444; }

        .req-nomor { font-size: 17px; font-weight: 800; color: #1e293b; margin: 0; }
        .req-meta { display: flex; align-items: center; gap: 6px; color: #94a3b8; font-size: 12px; margin-top: 4px; }
        .req-keperluan { font-size: 13px; color: #475569; margin: 16px 0; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

        .req-owner {
          margin-top: 12px;
          padding: 10px;
          background: #f8fafc;
          border-radius: 14px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .owner-avatar { width: 32px; height: 32px; background: #e2e8f0; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; color: #475569; }
        .owner-name { font-size: 13px; font-weight: 700; color: #334155; }
        .owner-rt { font-size: 11px; color: #94a3b8; }

        .card-bottom {
          display: flex;
          gap: 8px;
          margin-top: auto;
          padding-top: 16px;
          border-top: 1px dashed #f1f5f9;
        }
        .btn-card-action {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 10px;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          background: #fff;
          color: #475569;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-card-action:hover { background: #f8fafc; color: #1e293b; border-color: #cbd5e1; }
        .btn-card-action.primary { background: #2563eb; color: #fff; border: none; }
        .btn-card-action.primary:hover { background: #1e40af; }

        /* Loading & Empty States */
        .loading-state, .empty-state {
          padding: 80px 20px;
          text-align: center;
          background: #fff;
          border-radius: 32px;
          border: 1px dashed #e2e8f0;
        }
        .loading-state p { margin-top: 16px; color: #64748b; font-weight: 600; }
        .empty-icon-box { margin: 0 auto 20px; width: 80px; height: 80px; background: #f8fafc; border-radius: 24px; display: flex; align-items: center; justify-content: center; }
        .empty-state h3 { font-size: 18px; font-weight: 800; color: #1e293b; margin: 0; }
        .empty-state p { color: #94a3b8; font-size: 14px; margin: 8px 0 20px; }
        .btn-text { background: none; border: none; color: #2563eb; font-weight: 700; font-size: 14px; cursor: pointer; text-decoration: underline; }

        /* Modal Sheet Styles */
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.4);
          backdrop-filter: blur(8px);
          z-index: 5000;
          display: flex;
          align-items: flex-end;
        }
        @media (min-width: 769px) {
          .modal-overlay { align-items: center; justify-content: center; }
        }

        .modal-sheet {
          background: #fff;
          width: 100%;
          border-radius: 32px 32px 0 0;
          padding: 24px 24px calc(24px + env(safe-area-inset-bottom, 24px));
          max-height: 95vh;
          overflow-y: auto;
        }
        @media (min-width: 769px) {
          .modal-sheet { width: 550px; border-radius: 32px; padding: 32px; }
        }

        .sheet-header {
          display: flex;
          flex-direction: column;
          align-items: center;
          position: relative;
          margin-bottom: 24px;
        }
        .sheet-handle { width: 40px; height: 4px; background: #e2e8f0; border-radius: 2px; margin-bottom: 20px; }
        .sheet-header h3 { font-size: 20px; font-weight: 900; color: #1e3a8a; margin: 0; }
        .btn-close-sheet { position: absolute; right: 0; top: 20px; background: none; border: none; color: #cbd5e1; cursor: pointer; }

        .sheet-form .form-group { margin-bottom: 20px; }
        .sheet-form label { display: block; font-size: 13px; font-weight: 800; color: #475569; margin-bottom: 10px; }
        .sheet-form textarea, .sheet-form input[type="text"] {
          width: 100%;
          border-radius: 16px;
          border: 1px solid #e2e8f0;
          padding: 14px;
          font-size: 14px;
          outline: none;
          background: #f8fafc;
          transition: all 0.2s;
        }
        .sheet-form textarea:focus, .sheet-form input[type="text"]:focus { border-color: #2563eb; background: #fff; }
        .sheet-form textarea { height: 100px; resize: none; }

        .type-selector-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }
        .type-option {
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .type-option.selected { border-color: #2563eb; background: #eff6ff; }
        .type-icon { width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
        .type-title { font-size: 13px; font-weight: 800; color: #1e293b; }
        .type-desc { font-size: 10px; color: #64748b; line-height: 1.3; }

        .form-actions { display: flex; gap: 12px; margin-top: 32px; }
        .form-actions button { height: 52px; border-radius: 16px; font-weight: 700; font-size: 15px; cursor: pointer; transition: all 0.2s; }
        .btn-secondary { flex: 1; background: #f1f5f9; color: #64748b; border: none; }
        .btn-submit { flex: 2; background: #2563eb; color: #fff; border: none; display: flex; align-items: center; justify-content: center; gap: 10px; }
        .btn-submit:hover { background: #1e40af; }
        .btn-submit:disabled { opacity: 0.7; cursor: not-allowed; }
      `}</style>
    </div>
  );
}
