import React, { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, Plus, Trash2, X, AlertCircle, ShieldCheck, User as UserIcon, Loader2, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../firebase/config';
import { collection, query, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { User, Kegiatan } from '../types';

interface AdminKegiatanPageProps {
  user: User | null;
}

export default function AdminKegiatanPage({ user }: AdminKegiatanPageProps) {
  const [kegiatans, setKegiatans] = useState<Kegiatan[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'archived'>('upcoming');
  
  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [kegiatanToDelete, setKegiatanToDelete] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New Kegiatan Form state
  const [newKegiatan, setNewKegiatan] = useState({
    title: '',
    description: '',
    date: '',
    time: '',
    location: ''
  });

  // Sync Kegiatans from Firestore in real-time
  useEffect(() => {
    const q = query(collection(db, 'kegiatan'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: Kegiatan[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        items.push({
          id: docSnap.id,
          title: data.title || '',
          description: data.description || '',
          date: data.date || '',
          time: data.time || '',
          location: data.location || '',
          createdAt: data.createdAt,
          createdById: data.createdById,
          createdByRole: data.createdByRole
        });
      });

      setKegiatans(items);
      setLoading(false);
    }, (error) => {
      console.error("Gagal sinkronisasi kegiatan:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Helper to determine if an event is archived (date < yesterday)
  const isEventArchived = (dateStr: string) => {
    if (!dateStr) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const eventDate = new Date(dateStr);
    eventDate.setHours(0, 0, 0, 0);

    return eventDate < yesterday;
  };

  // Filter & Sort
  const upcomingKegiatans = kegiatans
    .filter(k => !isEventArchived(k.date))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()); // Soonest first

  const archivedKegiatans = kegiatans
    .filter(k => isEventArchived(k.date))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // Newest past first

  const displayedItems = activeTab === 'upcoming' ? upcomingKegiatans : archivedKegiatans;

  const handleAddKegiatan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKegiatan.title || !newKegiatan.date || !newKegiatan.time || !newKegiatan.location || !newKegiatan.description) return;
    
    setIsSubmitting(true);
    try {
      let createdRole = 'Pengurus RW';
      if (user?.accountType === 'admin') {
        if (user.adminRole === 'rw') createdRole = 'Ketua RW 011';
        else if (user.adminRole === 'rt') createdRole = `Ketua RT ${user.rt_id || '001'}`;
        else createdRole = 'Developer';
      }

      // 1. Add to Firestore
      const kegiatanDocRef = await addDoc(collection(db, 'kegiatan'), {
        title: newKegiatan.title,
        description: newKegiatan.description,
        date: newKegiatan.date,
        time: newKegiatan.time,
        location: newKegiatan.location,
        createdAt: serverTimestamp(),
        createdById: user?.id || 'admin',
        createdByRole: createdRole
      });

      // Format Date for Notification
      const formattedDate = new Date(newKegiatan.date).toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });

      // 2. Send real-time notification to all residents
      await addDoc(collection(db, 'notifications'), {
        type: 'system',
        title: `📅 Kegiatan Baru: ${newKegiatan.title}`,
        message: `${newKegiatan.description.substring(0, 80)}... pada ${formattedDate} pukul ${newKegiatan.time} di ${newKegiatan.location}`,
        targetAccountType: 'resident',
        targetRoles: ['resident', 'warga'],
        targetId: null,
        route: '/warga/dashboard',
        isRead: false,
        createdAt: serverTimestamp()
      });

      // Reset state & close modal
      setNewKegiatan({
        title: '',
        description: '',
        date: '',
        time: '',
        location: ''
      });
      setShowAddModal(false);
    } catch (err) {
      console.error("Gagal menambahkan kegiatan:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDeleteKegiatan = async () => {
    if (!kegiatanToDelete) return;
    try {
      await deleteDoc(doc(db, 'kegiatan', kegiatanToDelete));
    } catch (err) {
      console.error("Gagal menghapus kegiatan:", err);
    } finally {
      setKegiatanToDelete(null);
    }
  };

  const formatEventDate = (dateStr: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      style={{
        background: '#f8fafc',
        minHeight: '100vh',
        padding: '24px 20px 100px',
        position: 'relative'
      }}
    >
      {/* Header */}
      <header style={{ marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ flex: 1, textAlign: 'left' }}>
            <h2 style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', margin: 0 }}>
              Kelola Kegiatan Warga
            </h2>
            <p style={{ fontSize: 11, color: '#64748b', margin: '2px 0 0', fontWeight: 600 }}>
              Buat dan jadwalkan kegiatan mendatang serta pantau arsip kegiatan lingkungan warga.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={() => setShowAddModal(true)}
            style={{
              height: 42,
              borderRadius: 12,
              border: 'none',
              background: '#2563eb',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: 13,
              padding: '0 20px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 4px 14px rgba(37,99,235,0.25)',
              transition: 'transform 0.1s ease'
            }}
            onMouseDown={e => e.currentTarget.style.transform = 'scale(0.98)'}
            onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            <Plus size={16} /> Buat Kegiatan Baru
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        background: '#e2e8f0',
        borderRadius: 14,
        padding: 4,
        marginBottom: 24,
        gap: 4
      }}>
        <button
          onClick={() => setActiveTab('upcoming')}
          style={{
            flex: 1,
            height: 38,
            borderRadius: 10,
            border: 'none',
            background: activeTab === 'upcoming' ? '#ffffff' : 'transparent',
            color: activeTab === 'upcoming' ? '#1e293b' : '#64748b',
            fontSize: 13,
            fontWeight: 800,
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: activeTab === 'upcoming' ? '0 4px 6px -1px rgba(0,0,0,0.05)' : 'none'
          }}
        >
          📅 Kegiatan Mendatang ({upcomingKegiatans.length})
        </button>
        <button
          onClick={() => setActiveTab('archived')}
          style={{
            flex: 1,
            height: 38,
            borderRadius: 10,
            border: 'none',
            background: activeTab === 'archived' ? '#ffffff' : 'transparent',
            color: activeTab === 'archived' ? '#1e293b' : '#64748b',
            fontSize: 13,
            fontWeight: 800,
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: activeTab === 'archived' ? '0 4px 6px -1px rgba(0,0,0,0.05)' : 'none'
          }}
        >
          🗄️ Arsip Kegiatan ({archivedKegiatans.length})
        </button>
      </div>

      {/* List Content */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b', fontSize: 13, fontWeight: 700 }}>
            Memuat data kegiatan...
          </div>
        ) : displayedItems.length === 0 ? (
          <div style={{
            background: '#ffffff',
            borderRadius: 20,
            padding: 32,
            textAlign: 'center',
            border: '1px solid #e2e8f0',
            color: '#64748b'
          }}>
            <Calendar size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
            <div style={{ fontSize: 14, fontWeight: 800 }}>Belum Ada Kegiatan</div>
            <div style={{ fontSize: 11, marginTop: 4 }}>
              {activeTab === 'upcoming' 
                ? 'Klik tombol di atas untuk membuat kegiatan baru.' 
                : 'Belum ada kegiatan lampau yang diarsipkan.'}
            </div>
          </div>
        ) : (
          displayedItems.map((item) => (
            <motion.div 
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: 20,
                padding: 20,
                boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
                position: 'relative',
                textAlign: 'left'
              }}
            >
              {/* Title & Creator Badge */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                <h3 style={{ fontSize: 15, fontWeight: 900, color: '#1e293b', margin: 0, lineHeight: 1.4 }}>
                  {item.title}
                </h3>
                <span style={{
                  padding: '3px 8px',
                  borderRadius: 8,
                  fontSize: 9,
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  background: '#f1f5f9',
                  color: '#475569',
                  flexShrink: 0
                }}>
                  {item.createdByRole || 'Pengurus'}
                </span>
              </div>

              {/* Event Meta Details */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px 24px', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#475569', fontSize: 12, fontWeight: 600 }}>
                  <Calendar size={14} style={{ color: '#2563eb' }} />
                  <span>{formatEventDate(item.date)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#475569', fontSize: 12, fontWeight: 600 }}>
                  <Clock size={14} style={{ color: '#2563eb' }} />
                  <span>Pukul {item.time} WIB</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#475569', fontSize: 12, fontWeight: 600 }}>
                  <MapPin size={14} style={{ color: '#ef4444' }} />
                  <span>{item.location}</span>
                </div>
              </div>

              {/* Description */}
              <p style={{ 
                fontSize: 12, 
                color: '#64748b', 
                lineHeight: 1.6, 
                margin: '0 0 16px',
                whiteSpace: 'pre-line'
              }}>
                {item.description}
              </p>

              {/* Footer Delete Button */}
              <div style={{ 
                borderTop: '1px solid #f1f5f9', 
                paddingTop: 12, 
                display: 'flex', 
                justifyContent: 'flex-end'
              }}>
                <button
                  onClick={() => setKegiatanToDelete(item.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#ef4444',
                    cursor: 'pointer',
                    padding: '6px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 12,
                    fontWeight: 700,
                    borderRadius: '8px',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                >
                  <Trash2 size={14} /> Hapus Kegiatan
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* 1. ADD EVENT MODAL SHEET */}
      <AnimatePresence>
        {showAddModal && (
          <>
            <div className="sheet-overlay" style={{ zIndex: 11000 }} onClick={() => setShowAddModal(false)} />
            <motion.div 
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
              className="modal-sheet"
              style={{ zIndex: 11001 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h3 style={{ fontSize: 18, fontWeight: 900, color: '#1e3a8a', margin: 0 }}>Buat Kegiatan Warga Baru</h3>
                <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 18, cursor: 'pointer' }}>✕</button>
              </div>

              <form onSubmit={handleAddKegiatan} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 8, textAlign: 'left' }}>Nama Kegiatan</label>
                  <input 
                    type="text" 
                    placeholder="Contoh: Kerja Bakti Lingkungan RW" 
                    value={newKegiatan.title}
                    onChange={e => setNewKegiatan(prev => ({ ...prev, title: e.target.value }))}
                    required
                    style={{ width: '100%', height: 48, border: '1px solid #e2e8f0', borderRadius: 14, padding: '0 16px', fontSize: 14, outline: 'none' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 8, textAlign: 'left' }}>Tanggal</label>
                    <input 
                      type="date" 
                      value={newKegiatan.date}
                      onChange={e => setNewKegiatan(prev => ({ ...prev, date: e.target.value }))}
                      required
                      style={{ width: '100%', height: 48, border: '1px solid #e2e8f0', borderRadius: 14, padding: '0 16px', fontSize: 14, outline: 'none' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 8, textAlign: 'left' }}>Waktu Mulai</label>
                    <input 
                      type="time" 
                      value={newKegiatan.time}
                      onChange={e => setNewKegiatan(prev => ({ ...prev, time: e.target.value }))}
                      required
                      style={{ width: '100%', height: 48, border: '1px solid #e2e8f0', borderRadius: 14, padding: '0 16px', fontSize: 14, outline: 'none' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 8, textAlign: 'left' }}>Lokasi Kegiatan</label>
                  <input 
                    type="text" 
                    placeholder="Contoh: Balai Warga RT 011 / Lapangan Utama" 
                    value={newKegiatan.location}
                    onChange={e => setNewKegiatan(prev => ({ ...prev, location: e.target.value }))}
                    required
                    style={{ width: '100%', height: 48, border: '1px solid #e2e8f0', borderRadius: 14, padding: '0 16px', fontSize: 14, outline: 'none' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 8, textAlign: 'left' }}>Deskripsi Kegiatan</label>
                  <textarea 
                    placeholder="Tuliskan deskripsi lengkap agenda, perlengkapan yang perlu dibawa warga, dll..." 
                    rows={4}
                    value={newKegiatan.description}
                    onChange={e => setNewKegiatan(prev => ({ ...prev, description: e.target.value }))}
                    required
                    style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 14, padding: '12px 16px', fontSize: 14, outline: 'none', resize: 'vertical' }}
                  />
                </div>

                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  style={{ width: '100%', height: 50, background: '#1e40af', color: '#fff', border: 'none', borderRadius: 16, fontSize: 14, fontWeight: 700, marginTop: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : 'Jadwalkan & Siarkan Kegiatan'}
                </button>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 2. DELETE CONFIRMATION MODAL */}
      <AnimatePresence>
        {kegiatanToDelete && (
          <div className="sheet-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 12000 }} onClick={() => setKegiatanToDelete(null)}>
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              style={{ background: '#fff', width: '100%', maxWidth: 380, borderRadius: 24, padding: 24, position: 'relative', textAlign: 'center' }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#fef2f2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <AlertCircle size={24} />
              </div>
              <h4 style={{ fontWeight: 900, color: '#1e3a8a', fontSize: 16, margin: '0 0 8px' }}>Hapus Agenda Kegiatan?</h4>
              <p style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5, margin: '0 0 24px' }}>
                Apakah Anda yakin ingin menghapus kegiatan ini? Kegiatan yang dihapus tidak akan tampil lagi di dashboard warga.
              </p>
              
              <div style={{ display: 'flex', gap: 10 }}>
                <button 
                  onClick={() => setKegiatanToDelete(null)}
                  style={{ flex: 1, height: 44, borderRadius: 12, border: '1px solid #cbd5e1', background: '#fff', color: '#64748b', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}
                >
                  Batal
                </button>
                <button 
                  onClick={confirmDeleteKegiatan}
                  style={{ flex: 1, height: 44, borderRadius: 12, border: 'none', background: '#ef4444', color: '#fff', fontWeight: 800, cursor: 'pointer', fontSize: 13 }}
                >
                  Ya, Hapus
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Styled Modal Sheets */}
      <style>{`
        .modal-sheet {
          position: fixed;
          left: 0; right: 0; bottom: 0;
          background: #fff;
          border-radius: 32px 32px 0 0;
          padding: 24px 24px 42px;
          max-height: 95vh;
          overflow-y: auto;
          box-shadow: 0 -20px 40px rgba(0,0,0,0.1);
        }
        .sheet-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15,23,42,0.4);
          backdrop-filter: blur(8px);
        }
      `}</style>
    </motion.div>
  );
}
