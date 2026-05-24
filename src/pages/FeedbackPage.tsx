import React, { useState, useEffect } from 'react';
import {
  MessageSquare, Plus, Search, Calendar, User as UserIcon,
  CheckCircle, AlertCircle, Loader2, Heart, HelpCircle,
  Send, Filter, ShieldCheck, ChevronRight, MessageCircle,
  X, Check, CheckSquare, Info
} from 'lucide-react';
import {
  collection, addDoc, query, orderBy, onSnapshot,
  doc, updateDoc, serverTimestamp, where, getDoc, Timestamp
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { User } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { showAlert } from '../utils/alert';

interface FeedbackPageProps {
  isAdminView?: boolean;
  user: User;
}

interface Feedback {
  id: string;
  type: 'saran' | 'kritik';
  category: string;
  title: string;
  content: string;
  isAnonymous: boolean;
  authorId: string;
  authorName: string;
  authorPhoto?: string;
  status: 'Terkirim' | 'Dibaca' | 'Ditindaklanjuti';
  adminResponse?: string | null;
  responseAuthor?: string | null;
  responseAt?: any;
  createdAt: any;
  date: string;
}

export default function FeedbackPage({ isAdminView = false, user }: FeedbackPageProps) {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showAdminSuccessModal, setShowAdminSuccessModal] = useState(false);

  // States for Adding New Feedback
  const [newFeedback, setNewFeedback] = useState({
    type: 'saran' as 'saran' | 'kritik',
    category: 'Pelayanan',
    title: '',
    content: '',
    isAnonymous: false
  });
  const [submitLoading, setSubmitLoading] = useState(false);

  // States for Admin Response
  const [adminResponseText, setAdminResponseText] = useState('');
  const [newStatus, setNewStatus] = useState<'Terkirim' | 'Dibaca' | 'Ditindaklanjuti'>('Dibaca');
  const [responseLoading, setResponseLoading] = useState(false);

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Load Feedbacks Real-time
  useEffect(() => {
    setLoading(true);
    let q = query(
      collection(db, 'feedbacks'),
      orderBy('createdAt', 'desc')
    );

    // If resident view, only load their own submitted feedback OR non-anonymous ones
    // But to keep it transparent and engaging, let's load all feedback so they can see what others suggest!
    // But they can only edit or see details of their own unless they are admin.
    const unsubscribe = onSnapshot(q, (snap) => {
      const items: Feedback[] = [];
      snap.forEach((doc) => {
        const data = doc.data() as any;
        if (isAdminView && user?.adminRole === 'rt') {
          // Filter by rt_id if present (or show all if feedback has no rt_id for backwards compatibility)
          if (!data.rt_id || data.rt_id === user.rt_id) {
            items.push({ id: doc.id, ...data } as Feedback);
          }
        } else {
          items.push({ id: doc.id, ...data } as Feedback);
        }
      });
      setFeedbacks(items);
      setLoading(false);
    }, (error) => {
      console.error("Gagal memuat Kritik & Saran:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, isAdminView]);

  // Submit Feedback
  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFeedback.title.trim() || !newFeedback.content.trim()) {
      showAlert('Peringatan', "Harap lengkapi judul dan isi!", 'warning');
      return;
    }

    setSubmitLoading(true);
    try {
      const docData = {
        type: newFeedback.type,
        category: newFeedback.category,
        title: newFeedback.title.trim(),
        content: newFeedback.content.trim(),
        isAnonymous: newFeedback.isAnonymous,
        authorId: user.id,
        authorName: user.name,
        authorPhoto: user.photoUrl || null,
        rt_id: user.rt_id || '',
        status: 'Terkirim',
        adminResponse: null,
        responseAuthor: null,
        responseAt: null,
        date: new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'feedbacks'), docData);

      // Create Admin Notification
      await addDoc(collection(db, 'notifications'), {
        type: 'system',
        title: `📥 ${newFeedback.type === 'saran' ? 'Saran' : 'Kritik'} Baru: ${newFeedback.title}`,
        message: `${newFeedback.isAnonymous ? 'Seorang Warga' : user.name} mengirimkan ${newFeedback.type}: "${newFeedback.title}"`,
        targetAccountType: 'admin',
        targetRoles: ['ketua_rw', 'ketua_rt_01', 'ketua_rt_02', 'ketua_rt_03'], // RTCentre
        targetId: null,
        route: '/admin/dev/feedback',
        isRead: false,
        createdAt: serverTimestamp()
      });

      setShowAddModal(false);
      setNewFeedback({
        type: 'saran',
        category: 'Pelayanan',
        title: '',
        content: '',
        isAnonymous: false
      });
      setShowSuccessModal(true);
    } catch (error) {
      console.error("Gagal mengirim:", error);
      showAlert('Gagal', "Gagal mengirim Kritik & Saran.", 'error');
    } finally {
      setSubmitLoading(false);
    }
  };

  // Submit Admin Response
  const handleSaveResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFeedback) return;

    setResponseLoading(true);
    try {
      const docRef = doc(db, 'feedbacks', selectedFeedback.id);

      const updateData: any = {
        status: 'Dibaca',
        adminResponse: adminResponseText.trim() || null,
        responseAuthor: `${user.name} (${user.adminRole?.toUpperCase() || 'ADMIN'})`,
        responseAt: Timestamp.now()
      };

      await updateDoc(docRef, updateData);

      // Notify Resident
      if (selectedFeedback.authorId) {
        await addDoc(collection(db, 'notifications'), {
          type: 'system',
          title: `💬 Tanggapan ${selectedFeedback.type === 'saran' ? 'Saran' : 'Kritik'}`,
          message: `Admin menanggapi: "${selectedFeedback.title}"`,
          targetAccountType: 'resident',
          targetRoles: ['resident', 'warga'],
          targetId: selectedFeedback.authorId,
          route: '/warga/feedback',
          isRead: false,
          createdAt: serverTimestamp()
        });
      }

      setSelectedFeedback(null);
      setShowAdminSuccessModal(true);
    } catch (error) {
      console.error("Gagal menyimpan tanggapan:", error);
      showAlert('Gagal', "Gagal menyimpan tanggapan.", 'error');
    } finally {
      setResponseLoading(false);
    }
  };

  // Category Color Map
  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'Keamanan': return { bg: '#fee2e2', text: '#ef4444' };
      case 'Kebersihan': return { bg: '#ecfdf5', text: '#10b981' };
      case 'Fasilitas': return { bg: '#eff6ff', text: '#3b82f6' };
      case 'Pelayanan': return { bg: '#fef3c7', text: '#d97706' };
      default: return { bg: '#f1f5f9', text: '#475569' };
    }
  };

  // Status Badge Map
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Terkirim': return { bg: '#fffbeb', text: '#d97706', label: 'Terkirim' };
      case 'Dibaca': return { bg: '#eff6ff', text: '#2563eb', label: 'Dibaca' };
      case 'Ditindaklanjuti': return { bg: '#ecfdf5', text: '#10b981', label: 'Selesai / Ditindaklanjuti' };
      default: return { bg: '#f1f5f9', text: '#475569', label: 'Terkirim' };
    }
  };

  // Filter feedbacks
  const filteredFeedbacks = feedbacks.filter(f => {
    const matchesSearch = f.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (!f.isAnonymous && f.authorName.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesType = filterType === 'all' || f.type === filterType;
    const matchesCategory = filterCategory === 'all' || f.category === filterCategory;
    const matchesStatus = filterStatus === 'all' || f.status === filterStatus;

    return matchesSearch && matchesType && matchesCategory && matchesStatus;
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className={`feedback-page-container ${isAdminView ? 'is-admin' : 'is-resident'}`}
      style={{
        padding: isAdminView ? '24px' : '16px 16px 100px',
        maxWidth: isAdminView ? '1200px' : '500px',
        margin: '0 auto',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}
    >
      {/* HEADER SECTION */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 16,
        marginBottom: 28
      }}>
        <div style={{ textAlign: 'left' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a', margin: '0 0 6px 0', letterSpacing: '-0.5px' }}>
            {isAdminView ? '🗂️ Moderasi Kritik & Saran Warga' : '💬 Kotak Kritik & Saran Warga'}
          </h2>
          <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
            {isAdminView
              ? 'Tinjau dan tanggapi setiap saran serta kritik demi kemajuan lingkungan warga.'
              : 'Sampaikan ide, saran, maupun kritik Anda demi peningkatan kualitas pelayanan lingkungan.'}
          </p>
        </div>

        {!isAdminView && (
          <button
            onClick={() => {
              setNewFeedback({
                type: 'saran',
                category: 'Pelayanan',
                title: '',
                content: '',
                isAnonymous: false
              });
              setShowAddModal(true);
            }}
            style={{
              height: '42px',
              borderRadius: '12px',
              border: 'none',
              background: '#2563eb',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: '13px',
              cursor: 'pointer',
              padding: '0 20px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
              transition: 'transform 0.15s ease'
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <Plus size={16} /> Buat Saran / Kritik
          </button>
        )}
      </div>

      {/* FILTER BAR SECTION */}
      <div style={{
        background: '#ffffff',
        borderRadius: '20px',
        padding: '16px 20px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)',
        border: '1px solid #f1f5f9',
        display: 'flex',
        flexWrap: 'wrap',
        gap: 12,
        alignItems: 'center',
        marginBottom: 24
      }}>
        {/* Search */}
        <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="Cari Kritik & Saran..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              height: '40px',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              padding: '0 16px 0 38px',
              fontSize: '12px',
              fontWeight: 600,
              outline: 'none'
            }}
          />
        </div>

        {/* Type Filter */}
        <div style={{ minWidth: '120px' }}>
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            style={{
              width: '100%',
              height: '40px',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              padding: '0 12px',
              fontSize: '12px',
              fontWeight: 700,
              color: '#334155',
              background: '#ffffff',
              outline: 'none'
            }}
          >
            <option value="all">Tipe: Semua</option>
            <option value="saran">💡 Saran</option>
            <option value="kritik">⚠️ Kritik</option>
          </select>
        </div>

        {/* Category Filter */}
        <div style={{ minWidth: '130px' }}>
          <select
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            style={{
              width: '100%',
              height: '40px',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              padding: '0 12px',
              fontSize: '12px',
              fontWeight: 700,
              color: '#334155',
              background: '#ffffff',
              outline: 'none'
            }}
          >
            <option value="all">Kategori: Semua</option>
            <option value="Pelayanan">🛎️ Pelayanan</option>
            <option value="Keamanan">🛡️ Keamanan</option>
            <option value="Kebersihan">🧹 Kebersihan</option>
            <option value="Fasilitas">🏢 Fasilitas</option>
            <option value="Lainnya">📦 Lainnya</option>
          </select>
        </div>

        {/* Status Filter */}
        <div style={{ minWidth: '140px' }}>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            style={{
              width: '100%',
              height: '40px',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              padding: '0 12px',
              fontSize: '12px',
              fontWeight: 700,
              color: '#334155',
              background: '#ffffff',
              outline: 'none'
            }}
          >
            <option value="all">Status: Semua</option>
            <option value="Terkirim">⏳ Terkirim</option>
            <option value="Dibaca">👀 Dibaca</option>
            <option value="Ditindaklanjuti">✅ Selesai</option>
          </select>
        </div>
      </div>

      {/* LOADING STATE */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: 12 }}>
          <Loader2 className="animate-spin" size={32} color="#2563eb" />
          <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>Memuat kotak Kritik & Saran...</span>
        </div>
      ) : filteredFeedbacks.length === 0 ? (
        <div style={{
          background: '#ffffff',
          borderRadius: '24px',
          padding: '60px 20px',
          textAlign: 'center',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)',
          border: '1px solid #f1f5f9'
        }}>
          <HelpCircle size={48} style={{ color: '#94a3b8', margin: '0 auto 16px' }} />
          <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#1e293b', margin: '0 0 6px 0' }}>Tidak Ada Saran atau Kritik</h3>
          <p style={{ fontSize: '12px', color: '#64748b', margin: 0, lineHeight: 1.5 }}>
            {searchTerm || filterType !== 'all' || filterCategory !== 'all' || filterStatus !== 'all'
              ? 'Tidak ada saran atau kritik yang cocok dengan filter pencarian Anda.'
              : 'Belum ada saran atau kritik yang diajukan oleh warga saat ini.'}
          </p>
        </div>
      ) : (
        /* FEEDBACK CARD LIST GRID */
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: 16
        }}>
          {filteredFeedbacks.map((f) => {
            const catColors = getCategoryColor(f.category);
            const statColors = getStatusBadge(f.status);

            return (
              <motion.div
                key={f.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => {
                  setSelectedFeedback(f);
                  setAdminResponseText(f.adminResponse || '');
                  setNewStatus(f.status);
                }}
                style={{
                  background: '#ffffff',
                  borderRadius: '20px',
                  border: '1px solid #f1f5f9',
                  padding: '24px',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease'
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
                    {/* Type Badge */}
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: '8px',
                      fontSize: '10px',
                      fontWeight: 800,
                      background: f.type === 'saran' ? '#eff6ff' : '#fef2f2',
                      color: f.type === 'saran' ? '#2563eb' : '#ef4444',
                      textTransform: 'uppercase',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4
                    }}>
                      {f.type === 'saran' ? '💡 Saran' : '⚠️ Kritik'}
                    </span>

                    {/* Category Badge */}
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: '8px',
                      fontSize: '10px',
                      fontWeight: 800,
                      background: catColors.bg,
                      color: catColors.text
                    }}>
                      {f.category}
                    </span>
                  </div>

                  {/* Status Badge */}
                  <span style={{
                    padding: '4px 10px',
                    borderRadius: '8px',
                    fontSize: '10px',
                    fontWeight: 800,
                    background: statColors.bg,
                    color: statColors.text
                  }}>
                    {statColors.label}
                  </span>
                </div>

                <h3 style={{ fontSize: '15px', fontWeight: 900, color: '#0f172a', margin: '0 0 8px 0', lineHeight: 1.4 }}>
                  {f.title}
                </h3>

                <p style={{
                  fontSize: '12px',
                  color: '#475569',
                  lineHeight: 1.6,
                  margin: '0 0 16px 0',
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden'
                }}>
                  {f.content}
                </p>

                {/* Card Footer Info */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: 14,
                  borderTop: '1px solid #f8fafc'
                }}>
                  {/* Author Meta */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {f.isAnonymous ? (
                      <div style={{
                        width: '26px',
                        height: '26px',
                        borderRadius: '50%',
                        background: '#f1f5f9',
                        color: '#64748b',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '11px',
                        fontWeight: 800
                      }}>
                        A
                      </div>
                    ) : f.authorPhoto ? (
                      <img src={f.authorPhoto} alt="" style={{ width: '26px', height: '26px', borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{
                        width: '26px',
                        height: '26px',
                        borderRadius: '50%',
                        background: '#eff6ff',
                        color: '#2563eb',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '11px',
                        fontWeight: 800
                      }}>
                        <UserIcon size={12} />
                      </div>
                    )}
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#334155' }}>
                      {f.isAnonymous ? 'Anonim (Disamarkan)' : f.authorName}
                    </span>
                  </div>

                  {/* Date */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#94a3b8' }}>
                    <Calendar size={12} />
                    <span style={{ fontSize: '10px', fontWeight: 700 }}>{f.date}</span>
                  </div>
                </div>

                {/* Nested Admin Response Preview */}
                {f.adminResponse && (
                  <div style={{
                    marginTop: 16,
                    background: '#f8fafc',
                    borderRadius: '14px',
                    border: '1px solid #f1f5f9',
                    padding: '14px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <ShieldCheck size={14} color="#2563eb" />
                      <span style={{ fontSize: '11px', fontWeight: 800, color: '#1e293b' }}>
                        Tanggapan: <strong style={{ color: '#2563eb' }}>{f.responseAuthor}</strong>
                      </span>
                    </div>
                    <p style={{ fontSize: '11px', color: '#475569', margin: 0, lineHeight: 1.5, fontStyle: 'italic' }}>
                      "{f.adminResponse.length > 120 ? f.adminResponse.slice(0, 120) + '...' : f.adminResponse}"
                    </p>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* CREATE NEW SUGGESTION MODAL OVERLAY */}
      <AnimatePresence>
        {showAddModal && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(8px)',
            zIndex: 8000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              style={{
                background: '#ffffff',
                width: '100%',
                maxWidth: '460px',
                borderRadius: '24px',
                padding: '28px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
                color: '#0f172a',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                maxHeight: '90vh',
                overflowY: 'auto'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h3 style={{ fontSize: '18px', fontWeight: 950, color: '#0f172a', margin: 0 }}>
                  📝 Kirim Kritik & Saran
                </h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  style={{
                    border: 'none',
                    background: '#f1f5f9',
                    borderRadius: '50%',
                    width: '32px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: '#64748b'
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSubmitFeedback} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Type Selection Tabs */}
                <div style={{ display: 'flex', gap: 8, background: '#f1f5f9', padding: '4px', borderRadius: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setNewFeedback(prev => ({ ...prev, type: 'saran' }))}
                    style={{
                      flex: 1,
                      height: '36px',
                      borderRadius: '8px',
                      border: 'none',
                      background: newFeedback.type === 'saran' ? '#ffffff' : 'transparent',
                      color: newFeedback.type === 'saran' ? '#2563eb' : '#475569',
                      fontWeight: 800,
                      fontSize: '12px',
                      cursor: 'pointer',
                      boxShadow: newFeedback.type === 'saran' ? '0 2px 6px rgba(0,0,0,0.05)' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4
                    }}
                  >
                    💡 Saran
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewFeedback(prev => ({ ...prev, type: 'kritik' }))}
                    style={{
                      flex: 1,
                      height: '36px',
                      borderRadius: '8px',
                      border: 'none',
                      background: newFeedback.type === 'kritik' ? '#ffffff' : 'transparent',
                      color: newFeedback.type === 'kritik' ? '#ef4444' : '#475569',
                      fontWeight: 800,
                      fontSize: '12px',
                      cursor: 'pointer',
                      boxShadow: newFeedback.type === 'kritik' ? '0 2px 6px rgba(0,0,0,0.05)' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4
                    }}
                  >
                    ⚠️ Kritik
                  </button>
                </div>

                {/* Category Selector */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'left' }}>
                  <label style={{ fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Kategori Bidang</label>
                  <select
                    value={newFeedback.category}
                    onChange={e => setNewFeedback(prev => ({ ...prev, category: e.target.value }))}
                    style={{
                      width: '100%',
                      height: '46px',
                      borderRadius: '12px',
                      border: '1px solid #cbd5e1',
                      padding: '0 12px',
                      fontSize: '13px',
                      fontWeight: 700,
                      color: '#0f172a',
                      background: '#ffffff',
                      outline: 'none'
                    }}
                  >
                    <option value="Pelayanan">🛎️ Pelayanan Warga / RT</option>
                    <option value="Keamanan">🛡️ Keamanan & Ronda</option>
                    <option value="Kebersihan">🧹 Lingkungan & Kebersihan</option>
                    <option value="Fasilitas">🏢 Fasilitas Sosial / Balai</option>
                    <option value="Lainnya">📦 Lain-lain</option>
                  </select>
                </div>

                {/* Title Input */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'left' }}>
                  <label style={{ fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Judul Singkat</label>
                  <input
                    type="text"
                    value={newFeedback.title}
                    onChange={e => setNewFeedback(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Contoh: Lampu jalan mati di RT 03..."
                    required
                    style={{
                      width: '100%',
                      height: '46px',
                      borderRadius: '12px',
                      border: '1px solid #cbd5e1',
                      padding: '0 16px',
                      fontSize: '13px',
                      fontWeight: 600,
                      outline: 'none'
                    }}
                  />
                </div>

                {/* Content Input */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'left' }}>
                  <label style={{ fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Isi Detail Masukan Anda</label>
                  <textarea
                    rows={4}
                    value={newFeedback.content}
                    onChange={e => setNewFeedback(prev => ({ ...prev, content: e.target.value }))}
                    placeholder="Tuliskan secara lengkap dan jelas di sini..."
                    required
                    style={{
                      width: '100%',
                      borderRadius: '12px',
                      border: '1px solid #cbd5e1',
                      padding: '12px 16px',
                      fontSize: '13px',
                      fontWeight: 600,
                      outline: 'none',
                      resize: 'none',
                      lineHeight: 1.5
                    }}
                  />
                </div>

                {/* Anonymous Toggle Option */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  background: '#f8fafc',
                  border: '1px solid #f1f5f9',
                  textAlign: 'left'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: '12px', fontWeight: 800, color: '#1e293b' }}>Kirim Sebagai Anonim</span>
                    <span style={{ fontSize: '10px', color: '#64748b' }}>Identitas Anda akan disembunyikan dari daftar</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={newFeedback.isAnonymous}
                    onChange={e => setNewFeedback(prev => ({ ...prev, isAnonymous: e.target.checked }))}
                    style={{
                      width: '18px',
                      height: '18px',
                      cursor: 'pointer'
                    }}
                  />
                </div>

                {/* Buttons */}
                <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    style={{
                      flex: 1,
                      height: '42px',
                      borderRadius: '12px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#64748b',
                      fontWeight: 800,
                      fontSize: '13px',
                      cursor: 'pointer'
                    }}
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={submitLoading}
                    style={{
                      flex: 1,
                      height: '42px',
                      borderRadius: '12px',
                      border: 'none',
                      background: newFeedback.type === 'saran' ? '#2563eb' : '#ef4444',
                      color: '#ffffff',
                      fontWeight: 800,
                      fontSize: '13px',
                      cursor: submitLoading ? 'not-allowed' : 'pointer',
                      boxShadow: `0 4px 12px ${newFeedback.type === 'saran' ? 'rgba(37,99,235,0.2)' : 'rgba(239,68,68,0.2)'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6
                    }}
                  >
                    {submitLoading ? (
                      <>
                        <Loader2 size={14} className="animate-spin" /> Mengirim...
                      </>
                    ) : (
                      <>
                        <Send size={13} /> Kirim
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DETAIL & ADMIN MODERATION MODAL OVERLAY */}
      <AnimatePresence>
        {selectedFeedback && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(8px)',
            zIndex: 8000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              style={{
                background: '#ffffff',
                width: '100%',
                maxWidth: '520px',
                borderRadius: '24px',
                padding: '32px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
                color: '#0f172a',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                maxHeight: '90vh',
                overflowY: 'auto'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h3 style={{ fontSize: '18px', fontWeight: 950, color: '#0f172a', margin: 0 }}>
                  🔍 Detail Masukan Warga
                </h3>
                <button
                  onClick={() => setSelectedFeedback(null)}
                  style={{
                    border: 'none',
                    background: '#f1f5f9',
                    borderRadius: '50%',
                    width: '32px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: '#64748b'
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Detail Content Info */}
              <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    padding: '4px 10px',
                    borderRadius: '8px',
                    fontSize: '10px',
                    fontWeight: 800,
                    background: selectedFeedback.type === 'saran' ? '#eff6ff' : '#fef2f2',
                    color: selectedFeedback.type === 'saran' ? '#2563eb' : '#ef4444',
                    textTransform: 'uppercase'
                  }}>
                    {selectedFeedback.type === 'saran' ? '💡 Saran' : '⚠️ Kritik'}
                  </span>
                  <span style={{
                    padding: '4px 10px',
                    borderRadius: '8px',
                    fontSize: '10px',
                    fontWeight: 800,
                    background: getCategoryColor(selectedFeedback.category).bg,
                    color: getCategoryColor(selectedFeedback.category).text
                  }}>
                    {selectedFeedback.category}
                  </span>
                </div>

                <div>
                  <h4 style={{ fontSize: '16px', fontWeight: 900, color: '#0f172a', margin: '0 0 8px 0', lineHeight: 1.4 }}>
                    {selectedFeedback.title}
                  </h4>
                  <p style={{ fontSize: '12.5px', color: '#334155', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>
                    {selectedFeedback.content}
                  </p>
                </div>

                {/* Author Info row */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: '#f8fafc',
                  borderRadius: '16px',
                  padding: '12px 16px',
                  border: '1px solid #f1f5f9'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {selectedFeedback.isAnonymous ? (
                      <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#cbd5e1', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 800 }}>A</div>
                    ) : selectedFeedback.authorPhoto ? (
                      <img src={selectedFeedback.authorPhoto} alt="" style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 800 }}><UserIcon size={12} /></div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '11px', fontWeight: 800, color: '#1e293b' }}>
                        {selectedFeedback.isAnonymous ? 'Anonim (Disamarkan)' : selectedFeedback.authorName}
                      </span>
                      <span style={{ fontSize: '9px', color: '#64748b' }}>Warga/Resident</span>
                    </div>
                  </div>

                  <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 700 }}>
                    {selectedFeedback.date}
                  </span>
                </div>

                {/* ADMIN RESPONSE WRAPPER OR VIEWER */}
                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 20, marginTop: 8 }}>
                  {isAdminView ? (
                    /* ADMIN RESPONSE FORM */
                    <form onSubmit={handleSaveResponse} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <label style={{ fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Berikan Tanggapan Resmi</label>
                        <textarea
                          rows={4}
                          value={adminResponseText}
                          onChange={e => setAdminResponseText(e.target.value)}
                          placeholder="Tuliskan tanggapan resmi dari RT/RW atau tindakan yang diambil..."
                          required
                          style={{
                            width: '100%',
                            borderRadius: '12px',
                            border: '1px solid #cbd5e1',
                            padding: '12px 16px',
                            fontSize: '12px',
                            fontWeight: 600,
                            outline: 'none',
                            resize: 'none',
                            lineHeight: 1.5
                          }}
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={responseLoading}
                        style={{
                          height: '42px',
                          borderRadius: '12px',
                          border: 'none',
                          background: '#2563eb',
                          color: '#ffffff',
                          fontWeight: 800,
                          fontSize: '13px',
                          cursor: responseLoading ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          boxShadow: '0 4px 12px rgba(37,99,235,0.2)'
                        }}
                      >
                        {responseLoading ? (
                          <>
                            <Loader2 size={14} className="animate-spin" /> Menyimpan...
                          </>
                        ) : (
                          <>
                            <CheckSquare size={14} /> Simpan Tanggapan Admin
                          </>
                        )}
                      </button>
                    </form>
                  ) : (
                    /* CITIZEN VIEWER ADMIN RESPONSE DISPLAY */
                    selectedFeedback.adminResponse ? (
                      <div style={{
                        background: '#eff6ff',
                        borderRadius: '18px',
                        border: '1px solid #dbeafe',
                        padding: '20px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <ShieldCheck size={16} color="#2563eb" />
                          <span style={{ fontSize: '12px', fontWeight: 800, color: '#1e3a8a' }}>
                            Tanggapan Resmi: <strong style={{ color: '#2563eb' }}>{selectedFeedback.responseAuthor}</strong>
                          </span>
                        </div>
                        <p style={{ fontSize: '12px', color: '#1e3a8a', margin: 0, lineHeight: 1.6, fontStyle: 'italic', fontWeight: 550 }}>
                          "{selectedFeedback.adminResponse}"
                        </p>
                      </div>
                    ) : (
                      <div style={{
                        background: '#f8fafc',
                        border: '1px dashed #cbd5e1',
                        borderRadius: '16px',
                        padding: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        color: '#64748b'
                      }}>
                        <Info size={18} style={{ color: '#94a3b8' }} />
                        <span style={{ fontSize: '11px', fontWeight: 700 }}>Belum ada tanggapan resmi dari RT/RW saat ini. Masukan Anda sedang dalam proses tinjauan.</span>
                      </div>
                    )
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SUCCESS MODAL OVERLAY */}
      <AnimatePresence>
        {showSuccessModal && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(8px)',
            zIndex: 9000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              style={{
                background: '#ffffff',
                width: '100%',
                maxWidth: '400px',
                borderRadius: '28px',
                padding: '36px 28px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
                color: '#0f172a',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                textAlign: 'center'
              }}
            >
              <img 
                src="/vira_ai_berhasil.png" 
                alt="Vira AI" 
                style={{ width: 140, height: 140, objectFit: 'contain', display: 'block', margin: '0 auto 24px' }} 
              />

              <h3 style={{ fontSize: '18px', fontWeight: 950, color: '#0f172a', marginBottom: 12 }}>
                Kritik & Saran Dikirim!
              </h3>
              
              <p style={{ fontSize: '12.5px', color: '#475569', lineHeight: 1.6, marginBottom: 24, padding: '0 8px' }}>
                Terima kasih atas partisipasi aktif Anda. Kritik dan saran Anda sangat berharga dan akan menjadi **bahan evaluasi** penting bagi pengurus RT/RW demi kemajuan bersama.
              </p>

              <button
                onClick={() => setShowSuccessModal(false)}
                style={{
                  width: '100%',
                  height: '44px',
                  borderRadius: '12px',
                  border: 'none',
                  background: '#2563eb',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '13px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)'
                }}
              >
                Tutup & Kembali
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ADMIN RESPONSE SUCCESS MODAL OVERLAY */}
      <AnimatePresence>
        {showAdminSuccessModal && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(8px)',
            zIndex: 9000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              style={{
                background: '#ffffff',
                width: '100%',
                maxWidth: '400px',
                borderRadius: '28px',
                padding: '36px 28px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
                color: '#0f172a',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                textAlign: 'center'
              }}
            >
              <img 
                src="/vira_ai_berhasil.png" 
                alt="Vira AI" 
                style={{ width: 140, height: 140, objectFit: 'contain', display: 'block', margin: '0 auto 24px' }} 
              />

              <h3 style={{ fontSize: '18px', fontWeight: 950, color: '#0f172a', marginBottom: 12 }}>
                Tanggapan Terkirim!
              </h3>
              
              <p style={{ fontSize: '12.5px', color: '#475569', lineHeight: 1.6, marginBottom: 24, padding: '0 8px' }}>
                Tanggapan resmi Anda berhasil disimpan. Masukan warga ini telah otomatis diperbarui statusnya menjadi **Dibaca** dan notifikasi tanggapan telah diteruskan ke warga terkait.
              </p>

              <button
                onClick={() => setShowAdminSuccessModal(false)}
                style={{
                  width: '100%',
                  height: '44px',
                  borderRadius: '12px',
                  border: 'none',
                  background: '#10b981',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '13px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)'
                }}
              >
                Tutup & Selesai
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <style>{`
        @media (max-width: 768px) {
          .feedback-page-container.is-resident {
            padding: 12px 6px 100px !important;
          }
        }
      `}</style>
    </motion.div>
  );
}
