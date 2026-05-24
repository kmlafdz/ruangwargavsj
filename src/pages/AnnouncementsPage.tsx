import React, { useState, useEffect } from 'react';
import { Megaphone, Bell, Info, ArrowLeft, Calendar, ShieldCheck, User as UserIcon, Trash2, Plus, X, AlertCircle, Camera, Image as ImageIcon, Heart, MessageCircle, Send, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase/config';
import { collection, query, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp, where, getDocs, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { User } from '../types';
import { showAlert } from '../utils/alert';

// Helper to parse **bold** text in comments (e.g. from Vira AI)
const renderBoldText = (text: string) => {
  if (!text) return null;
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={idx} style={{ fontWeight: 800, color: '#1e293b' }}>{part.slice(2, -2)}</strong>;
    }
    return <span key={idx}>{part}</span>;
  });
};

interface Announcement {
  id: string;
  title: string;
  content: string;
  author: string;
  role: string;
  category: 'RW' | 'RT' | 'Umum';
  date: string;
  isImportant?: boolean;
  imageUrl?: string;
  createdAt?: any;
}

interface AnnouncementsPageProps {
  isAdminView?: boolean;
  user?: User | null;
}

export default function AnnouncementsPage({ isAdminView = false, user = null }: AnnouncementsPageProps) {
  const navigate = useNavigate();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
  const [announcementToDelete, setAnnouncementToDelete] = useState<string | null>(null);

  // States for citizen reports feed (Tab Laporan Warga)
  const [activeTab, setActiveTab] = useState<'announcements' | 'reports'>('announcements');
  const [reports, setReports] = useState<any[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [activeReportComments, setActiveReportComments] = useState<string | null>(null);

  // Citizen Reports Firestore Sync
  useEffect(() => {
    const q = query(collection(db, 'pengaduan'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: any[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        // Hanya tampilkan laporan yang sudah di-acc (Di Proses, Diterima, Selesai, Sudah Dilaksanakan)
        // Laporan Pending dan Ditolak tidak akan masuk feed publik
        if (
          data.status === 'Di Proses' || 
          data.status === 'Diterima' || 
          data.status === 'Selesai' || 
          data.status === 'Sudah Dilaksanakan' ||
          data.isPublic === true
        ) {
          if (data.status !== 'Ditolak' && data.status !== 'Pending') {
            items.push({
              id: doc.id,
              ...data,
              likesCount: data.likedBy ? data.likedBy.length : 0,
              likedBy: data.likedBy || [],
              comments: data.comments || []
            });
          }
        }
      });
      // Sort reports by createdAt desc or date
      items.sort((a, b) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeB - timeA;
      });
      setReports(items);
      setReportsLoading(false);
    }, (error) => {
      console.error("Gagal menyinkronkan pengaduan warga:", error);
      setReportsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLikeReport = async (reportId: string, likedBy: string[]) => {
    if (!user) return;
    const reportRef = doc(db, 'pengaduan', reportId);
    const isLiked = likedBy.includes(user.id);
    try {
      if (isLiked) {
        await updateDoc(reportRef, {
          likedBy: arrayRemove(user.id)
        });
      } else {
        await updateDoc(reportRef, {
          likedBy: arrayUnion(user.id)
        });

        // Find the report to notify the author
        const reportObj = reports.find(r => r.id === reportId);
        if (reportObj && reportObj.userId && reportObj.userId !== user.id) {
          await addDoc(collection(db, 'notifications'), {
            type: 'like',
            title: '❤️ Laporan Anda Disukai',
            message: `${user.name} menyukai laporan Anda: "${reportObj.title}"`,
            targetAccountType: 'resident',
            targetRoles: ['resident', 'warga'],
            targetId: reportObj.userId,
            route: '/warga/pengumuman',
            isRead: false,
            userPhotoUrl: user.photoUrl || '',
            createdAt: serverTimestamp()
          });
        }
      }
    } catch (err) {
      console.error("Gagal melakukan like:", err);
    }
  };

  const handleSendComment = async (reportId: string) => {
    const text = commentInputs[reportId]?.trim();
    if (!text || !user) return;
    const reportRef = doc(db, 'pengaduan', reportId);
    try {
      const newComment = {
        userId: user.id,
        userName: user.name,
        userPhotoUrl: user.photoUrl || '',
        text,
        createdAt: Date.now()
      };
      await updateDoc(reportRef, {
        comments: arrayUnion(newComment)
      });
      setCommentInputs(prev => ({ ...prev, [reportId]: '' }));

      // Find the report to notify the author
      const reportObj = reports.find(r => r.id === reportId);
      if (reportObj && reportObj.userId && reportObj.userId !== user.id) {
        await addDoc(collection(db, 'notifications'), {
          type: 'comment',
          title: '💬 Komentar Baru',
          message: `${user.name} mengomentari laporan Anda: "${text.length > 30 ? text.slice(0, 30) + '...' : text}"`,
          targetAccountType: 'resident',
          targetRoles: ['resident', 'warga'],
          targetId: reportObj.userId,
          route: '/warga/pengumuman',
          isRead: false,
          userPhotoUrl: user.photoUrl || '',
          createdAt: serverTimestamp()
        });
      }
    } catch (err) {
      console.error("Gagal mengirim komentar:", err);
    }
  };

  // States for Adding New Announcement
  const [showAddModal, setShowAddModal] = useState(false);
  const [newAnnouncement, setNewAnnouncement] = useState({
    title: '',
    content: '',
    category: 'Umum' as 'RW' | 'RT' | 'Umum',
    isImportant: false,
    image: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'announcements'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: Announcement[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        items.push({
          id: doc.id,
          title: data.title || '',
          content: data.content || '',
          author: data.author || 'Pengurus RW',
          role: data.role || 'RW 011',
          category: data.category || 'Umum',
          date: data.date || new Date().toLocaleDateString('id-ID'),
          isImportant: data.isImportant || false,
          imageUrl: data.imageUrl || '',
          createdAt: data.createdAt
        });
      });

      // Sort locally by createdAt desc
      items.sort((a, b) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeB - timeA;
      });

      setAnnouncements(items);
      setLoading(false);
    }, (error) => {
      console.error(error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Mark all resident notifications as read when resident views the page
  useEffect(() => {
    if (isAdminView) return;

    const clearNotifications = async () => {
      try {
        const q = query(
          collection(db, 'notifications'), 
          where('isRead', '==', false)
        );
        const snapshot = await getDocs(q);
        const batchPromises = snapshot.docs
          .filter(d => {
            const data = d.data();
            return data.targetAccountType === 'resident' || 
                   data.targetAccountType === 'warga' ||
                   (data.targetRoles && (data.targetRoles.includes('resident') || data.targetRoles.includes('warga')));
          })
          .map(d => updateDoc(d.ref, { isRead: true }));
        
        await Promise.all(batchPromises);
      } catch (err) {
        console.error("Gagal membersihkan notifikasi warga:", err);
      }
    };

    clearNotifications();
  }, [isAdminView]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Str = event.target?.result as string;
      
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 800; // Limit max size to keep base64 lightweight
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.65);
        setNewAnnouncement(prev => ({ ...prev, image: compressedBase64 }));
      };
    };
    reader.readAsDataURL(file);
  };

  const handleAddAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAnnouncement.title || !newAnnouncement.content) return;
    setIsSubmitting(true);
    try {
      const authorName = user?.name || 'Administrator';
      let authorRole = 'Pengurus RW';
      if (user?.accountType === 'admin') {
        if (user.adminRole === 'rw') authorRole = 'Ketua RW 011';
        else if (user.adminRole === 'rt') authorRole = `Ketua RT ${user.rt_id || '001'}`;
        else authorRole = 'Developer';
      }

      await addDoc(collection(db, 'announcements'), {
        title: newAnnouncement.title,
        content: newAnnouncement.content,
        category: newAnnouncement.category,
        isImportant: newAnnouncement.isImportant,
        imageUrl: newAnnouncement.image || '',
        author: authorName,
        role: authorRole,
        date: new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
        createdAt: serverTimestamp()
      });

      // Send real-time notification to all residents
      await addDoc(collection(db, 'notifications'), {
        type: 'system',
        title: `📢 Pengumuman Baru: ${newAnnouncement.title}`,
        message: newAnnouncement.content.length > 80 ? newAnnouncement.content.slice(0, 80) + '...' : newAnnouncement.content,
        targetAccountType: 'resident',
        targetRoles: ['resident', 'warga'],
        targetId: null,
        route: '/warga/pengumuman',
        isRead: false,
        createdAt: serverTimestamp()
      });

      setShowAddModal(false);
      setNewAnnouncement({ title: '', content: '', category: 'Umum', isImportant: false, image: '' });
    } catch (err) {
      console.error("Gagal menambahkan pengumuman:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAnnouncement = (id: string) => {
    if (!id.startsWith('news_') && !id.startsWith('pengumuman_') && !id.startsWith('laporan_')) {
      showAlert('Info', "Item demo mock tidak dapat dihapus dari database.", 'info');
      return;
    }
    setAnnouncementToDelete(id);
  };

  const confirmDeleteAnnouncement = async () => {
    if (!announcementToDelete) return;
    try {
      await deleteDoc(doc(db, 'announcements', announcementToDelete));
    } catch (err) {
      console.error("Gagal menghapus pengumuman:", err);
    } finally {
      setAnnouncementToDelete(null);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className={`announcements-page-container ${isAdminView ? 'is-admin' : 'is-resident'}`}
      style={{
        background: '#f8fafc',
        minHeight: '100vh',
        padding: isAdminView ? '24px' : '16px 16px 100px',
        maxWidth: isAdminView ? '100%' : '500px',
        margin: '0 auto',
        position: 'relative'
      }}
    >
      {/* Header */}
      <header style={{ marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ flex: 1, textAlign: 'left' }}>
            <h2 style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', margin: 0 }}>
              {isAdminView ? 'Kelola Pengumuman' : 'Pengumuman Resmi'}
            </h2>
            <p style={{ fontSize: 11, color: '#64748b', margin: '2px 0 0', fontWeight: 600 }}>
              {isAdminView ? 'Buat siaran pengumuman ke running text aplikasi warga' : 'Info terkini dari pengurus RT/RW Vila Samudra Jaya'}
            </p>
          </div>
        </div>

        {isAdminView && (
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
              <Plus size={16} /> Buat Pengumuman Baru
            </button>
          </div>
        )}
      </header>

      {/* Tab Selector (Only shown on non-admin citizen view) */}
      {!isAdminView && (
        <div style={{
          display: 'flex',
          background: '#e2e8f0',
          borderRadius: 14,
          padding: 4,
          marginBottom: 20,
          gap: 4
        }}>
          <button
            onClick={() => setActiveTab('announcements')}
            style={{
              flex: 1,
              height: 38,
              borderRadius: 10,
              border: 'none',
              background: activeTab === 'announcements' ? '#ffffff' : 'transparent',
              color: activeTab === 'announcements' ? '#1e293b' : '#64748b',
              fontSize: 13,
              fontWeight: 800,
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: activeTab === 'announcements' ? '0 4px 6px -1px rgba(0,0,0,0.05)' : 'none'
            }}
          >
            📢 Pengumuman Resmi
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            style={{
              flex: 1,
              height: 38,
              borderRadius: 10,
              border: 'none',
              background: activeTab === 'reports' ? '#ffffff' : 'transparent',
              color: activeTab === 'reports' ? '#1e293b' : '#64748b',
              fontSize: 13,
              fontWeight: 800,
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: activeTab === 'reports' ? '0 4px 6px -1px rgba(0,0,0,0.05)' : 'none'
            }}
          >
            🚨 Laporan Warga
          </button>
        </div>
      )}

      {/* Feed Content */}
      {(activeTab === 'announcements' || isAdminView) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b', fontSize: 13, fontWeight: 700 }}>
              Memuat pengumuman...
            </div>
          ) : announcements.length === 0 ? (
            <div style={{
              background: '#ffffff',
              borderRadius: 20,
              padding: 32,
              textAlign: 'center',
              border: '1px solid #e2e8f0',
              color: '#64748b'
            }}>
              <Megaphone size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
              <div style={{ fontSize: 14, fontWeight: 800 }}>Belum Ada Pengumuman</div>
              <div style={{ fontSize: 11, marginTop: 4 }}>Semua kabar resmi RT & RW akan tampil di sini.</div>
            </div>
          ) : (
            announcements.map((item) => (
              <motion.div 
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -4, boxShadow: '0 12px 24px rgba(0,0,0,0.06)' }}
                onClick={() => setSelectedAnnouncement(item)}
                transition={{ duration: 0.3 }}
                style={{
                  background: '#ffffff',
                  border: item.isImportant ? '1.5px solid #fde68a' : '1px solid #e2e8f0',
                  borderRadius: 20,
                  padding: 20,
                  boxShadow: item.isImportant ? '0 10px 20px -5px rgba(245, 158, 11, 0.08)' : '0 4px 12px rgba(0,0,0,0.02)',
                  position: 'relative',
                  overflow: 'hidden',
                  cursor: 'pointer'
                }}
              >
                {item.isImportant && (
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 4,
                    background: 'linear-gradient(90deg, #f59e0b, #eab308)'
                  }} />
                )}

                {/* Title & Badge */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 900, color: '#1e293b', margin: 0, lineHeight: 1.4, textAlign: 'left' }}>
                    {item.title}
                  </h3>
                  <span style={{
                    padding: '3px 8px',
                    borderRadius: 8,
                    fontSize: 9,
                    fontWeight: 900,
                    textTransform: 'uppercase',
                    background: item.category === 'RW' ? '#eff6ff' : item.category === 'RT' ? '#ecfdf5' : '#f1f5f9',
                    color: item.category === 'RW' ? '#2563eb' : item.category === 'RT' ? '#10b981' : '#475569',
                    flexShrink: 0
                  }}>
                    {item.category} Info
                  </span>
                </div>

                {/* Image Banner if present */}
                {item.imageUrl && (
                  <div style={{ width: '100%', maxHeight: '200px', borderRadius: '14px', overflow: 'hidden', marginBottom: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                    <img src={item.imageUrl} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                )}

                {/* Body Content */}
                <p style={{ 
                  fontSize: 12, 
                  color: '#475569', 
                  lineHeight: 1.6, 
                  margin: '0 0 16px', 
                  textAlign: 'left',
                  whiteSpace: 'pre-line' 
                }}>
                  {item.content}
                </p>

                {/* Footer Author Card */}
                <div style={{ 
                  borderTop: '1px solid #f1f5f9', 
                  paddingTop: 12, 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center' 
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ 
                      width: 28, 
                      height: 28, 
                      borderRadius: '50%', 
                      background: '#f1f5f9', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      color: '#64748b'
                    }}>
                      <UserIcon size={13} />
                    </div>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: '#1e293b' }}>{item.author}</div>
                      <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3 }}>
                        <ShieldCheck size={10} color="#10b981" /> {item.role}
                      </div>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#94a3b8' }}>
                      <Calendar size={11} />
                      <span style={{ fontSize: 9, fontWeight: 700 }}>{item.date}</span>
                    </div>

                    {isAdminView && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteAnnouncement(item.id);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#ef4444',
                          cursor: 'pointer',
                          padding: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: '6px',
                          transition: 'background 0.2s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'}
                        onMouseLeave={e => e.currentTarget.style.background = 'none'}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      )}

      {/* Citizen Reports Feed (Tab Laporan Warga) */}
      {!isAdminView && activeTab === 'reports' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {reportsLoading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b', fontSize: 13, fontWeight: 700 }}>
              Memuat laporan warga...
            </div>
          ) : reports.length === 0 ? (
            <div style={{
              background: '#ffffff',
              borderRadius: 20,
              padding: 32,
              textAlign: 'center',
              border: '1px solid #e2e8f0',
              color: '#64748b'
            }}>
              <AlertCircle size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
              <div style={{ fontSize: 14, fontWeight: 800 }}>Belum Ada Laporan Warga</div>
              <div style={{ fontSize: 11, marginTop: 4 }}>Semua pengaduan & aspirasi warga akan tampil di sini.</div>
            </div>
          ) : (
            reports.map((report) => {
              const isLiked = report.likedBy.includes(user?.id || '');
              const isCommentsOpen = activeReportComments === report.id;

              return (
                <motion.div
                  key={report.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: 20,
                    padding: 20,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
                    textAlign: 'left'
                  }}
                >
                  {/* Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {report.userPhotoUrl ? (
                        <img 
                          src={report.userPhotoUrl} 
                          alt={report.userName} 
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            objectFit: 'cover'
                          }} 
                        />
                      ) : (
                        <div style={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          background: '#f1f5f9',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          fontSize: 12,
                          color: '#475569'
                        }}>
                          {report.userName ? report.userName.charAt(0).toUpperCase() : 'W'}
                        </div>
                      )}
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 800, color: '#1e293b' }}>{report.userName || 'Warga VSJ'}</div>
                        <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 700 }}>
                          RT 0{report.rt_id || '01'} / RW 011 • {report.date || 'Hari ini'}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: 8,
                        fontSize: 9,
                        fontWeight: 900,
                        textTransform: 'uppercase',
                        background: '#fef2f2',
                        color: '#ef4444',
                        flexShrink: 0,
                        whiteSpace: 'nowrap'
                      }}>
                        {report.category || 'Laporan'}
                      </span>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: 8,
                        fontSize: 9,
                        fontWeight: 900,
                        textTransform: 'uppercase',
                        background: report.status === 'Selesai' || report.status === 'Sudah Dilaksanakan' ? '#ecfdf5' : '#eff6ff',
                        color: report.status === 'Selesai' || report.status === 'Sudah Dilaksanakan' ? '#10b981' : '#2563eb',
                        flexShrink: 0,
                        whiteSpace: 'nowrap'
                      }}>
                        {report.status === 'Selesai' || report.status === 'Sudah Dilaksanakan' ? '✅ Selesai' : '⚙️ Di Proses'}
                      </span>
                    </div>
                  </div>

                  {/* Content */}
                  <h3 style={{ fontSize: 14, fontWeight: 900, color: '#1e293b', margin: '0 0 6px', lineHeight: 1.4 }}>
                    {report.title}
                  </h3>
                  <p style={{ fontSize: 12, color: '#475569', lineHeight: 1.6, margin: '0 0 14px', whiteSpace: 'pre-line' }}>
                    {report.description}
                  </p>
                  
                  {/* Bukti Penyelesaian (Jika Selesai) */}
                  {report.completionImage && (
                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: 12, marginBottom: 14 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: '#16a34a', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <CheckCircle size={14} /> Laporan Telah Diselesaikan
                      </div>
                      <img src={report.completionImage} alt="Bukti Selesai" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 8 }} />
                    </div>
                  )}

                  {/* Media attachments */}
                  {report.images && report.images.length > 0 && (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: report.images.length === 1 ? '1fr' : 'repeat(auto-fit, minmax(120px, 1fr))',
                      gap: 8,
                      marginBottom: 14,
                      borderRadius: 14,
                      overflow: 'hidden'
                    }}>
                      {report.images.map((imgUrl: string, idx: number) => (
                        <div key={idx} style={{ position: 'relative', aspectRatio: '4/3', background: '#f1f5f9' }}>
                          <img src={imgUrl} alt={`Lampiran ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                      ))}
                    </div>
                  )}

                  {report.video && (
                    <div style={{ width: '100%', marginBottom: 14, borderRadius: 14, overflow: 'hidden', background: '#000' }}>
                      <video src={report.video} controls style={{ width: '100%', display: 'block', maxHeight: 240 }} />
                    </div>
                  )}

                  {/* Interactive Actions */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    borderTop: '1px solid #f1f5f9',
                    paddingTop: 12,
                    marginTop: 12
                  }}>
                    <button
                      onClick={() => handleLikeReport(report.id, report.likedBy)}
                      style={{
                        background: 'none',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        color: isLiked ? '#ef4444' : '#64748b',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        padding: '4px 8px',
                        borderRadius: 8,
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    >
                      <Heart size={16} fill={isLiked ? '#ef4444' : 'none'} />
                      <span>{report.likesCount} Suka</span>
                    </button>

                    <button
                      onClick={() => setActiveReportComments(isCommentsOpen ? null : report.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        color: isCommentsOpen ? '#2563eb' : '#64748b',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        padding: '4px 8px',
                        borderRadius: 8,
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#eff6ff'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    >
                      <MessageCircle size={16} />
                      <span>{report.comments.length} Komentar</span>
                    </button>
                  </div>

                  {/* Comments Section */}
                  {isCommentsOpen && (
                    <div style={{
                      marginTop: 14,
                      borderTop: '1px solid #f1f5f9',
                      paddingTop: 14,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12
                    }}>
                      {/* Comment List */}
                      {report.comments.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 200, overflowY: 'auto', paddingRight: 4 }}>
                          {report.comments.map((comm: any, cIdx: number) => (
                            <div key={cIdx} style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: 12, border: '1px solid #f1f5f9' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  {comm.userPhotoUrl ? (
                                    <img 
                                      src={comm.userPhotoUrl} 
                                      alt={comm.userName} 
                                      style={{
                                        width: 18,
                                        height: 18,
                                        borderRadius: '50%',
                                        objectFit: 'cover'
                                      }}
                                    />
                                  ) : (
                                    <div style={{
                                      width: 18,
                                      height: 18,
                                      borderRadius: '50%',
                                      background: '#cbd5e1',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: 8,
                                      fontWeight: 800,
                                      color: '#475569'
                                    }}>
                                      {comm.userName ? comm.userName.charAt(0).toUpperCase() : 'W'}
                                    </div>
                                  )}
                                  <span style={{ fontSize: 11, fontWeight: 800, color: '#1e293b' }}>{comm.userName}</span>
                                </div>
                                <span style={{ fontSize: 8, color: '#94a3b8' }}>
                                  {comm.createdAt ? new Date(comm.createdAt).toLocaleDateString('id-ID', { hour: '2-digit', minute: '2-digit' }) : ''}
                                </span>
                              </div>
                              <p style={{ fontSize: 11, color: '#475569', margin: 0, lineHeight: 1.4, paddingLeft: 24 }}>{renderBoldText(comm.text)}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Type Comment Bar */}
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                        <input
                          type="text"
                          placeholder="Tulis komentar..."
                          value={commentInputs[report.id] || ''}
                          onChange={(e) => setCommentInputs(prev => ({ ...prev, [report.id]: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSendComment(report.id);
                          }}
                          style={{
                            flex: 1,
                            height: 36,
                            borderRadius: 10,
                            border: '1px solid #cbd5e1',
                            padding: '0 12px',
                            fontSize: 12,
                            outline: 'none',
                            background: '#f8fafc'
                          }}
                        />
                        <button
                          onClick={() => handleSendComment(report.id)}
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 10,
                            border: 'none',
                            background: '#2563eb',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            boxShadow: '0 2px 8px rgba(37,99,235,0.2)'
                          }}
                        >
                          <Send size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })
          )}
        </div>
      )}

      {/* CREATE ANNOUNCEMENT MODAL OVERLAY */}
      <AnimatePresence>
        {showAddModal && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.4)',
            backdropFilter: 'blur(8px)',
            zIndex: 9999,
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
                maxWidth: '420px',
                borderRadius: '28px',
                padding: '28px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
                color: '#0f172a',
                fontFamily: 'system-ui, -apple-system, sans-serif'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: 'rgba(37,99,235,0.06)',
                    color: '#2563eb',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Megaphone size={18} />
                  </div>
                  <h3 style={{ fontSize: '16px', fontWeight: 900, letterSpacing: '-0.5px', margin: 0 }}>
                    Buat Pengumuman Baru
                  </h3>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 4,
                    borderRadius: '50%'
                  }}
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleAddAnnouncement} style={{ display: 'flex', flexDirection: 'column', gap: 16, textAlign: 'left' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>
                    Judul Pengumuman
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Kerja Bakti Saluran Air"
                    value={newAnnouncement.title}
                    onChange={e => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })}
                    style={{
                      width: '100%',
                      height: '44px',
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                      padding: '0 14px',
                      fontSize: '13px',
                      outline: 'none',
                      background: '#f8fafc'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>
                    Kategori Siaran
                  </label>
                   <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                    {(['Umum', 'RW', 'RT'] as const)
                      .filter(cat => !(user?.adminRole === 'rt' && cat === 'RW'))
                      .map(cat => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setNewAnnouncement({ ...newAnnouncement, category: cat })}
                          style={{
                            height: '38px',
                            borderRadius: '10px',
                            border: newAnnouncement.category === cat ? '1.5px solid #2563eb' : '1px solid #e2e8f0',
                            background: newAnnouncement.category === cat ? '#eff6ff' : '#ffffff',
                            color: newAnnouncement.category === cat ? '#2563eb' : '#64748b',
                            fontSize: '12px',
                            fontWeight: 800,
                            cursor: 'pointer',
                            transition: 'all 0.15s'
                          }}
                        >
                          {cat} Info
                        </button>
                      ))}
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>
                    Foto Pendukung (Opsional)
                  </label>
                  {newAnnouncement.image ? (
                    <div style={{ position: 'relative', width: '100%', height: '140px', borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                      <img src={newAnnouncement.image} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button
                        type="button"
                        onClick={() => setNewAnnouncement(prev => ({ ...prev, image: '' }))}
                        style={{
                          position: 'absolute',
                          top: 8,
                          right: 8,
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          background: 'rgba(15, 23, 42, 0.6)',
                          color: '#ffffff',
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <label style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '80px',
                      borderRadius: '12px',
                      border: '2px dashed #cbd5e1',
                      background: '#f8fafc',
                      cursor: 'pointer',
                      gap: 6,
                      color: '#64748b'
                    }}>
                      <Camera size={20} />
                      <span style={{ fontSize: '11px', fontWeight: 800 }}>Upload Foto Pengumuman</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        style={{ display: 'none' }}
                      />
                    </label>
                  )}
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>
                    Isi Pengumuman
                  </label>
                  <textarea
                    required
                    placeholder="Tulis pesan pengumuman lengkap Anda di sini..."
                    value={newAnnouncement.content}
                    onChange={e => setNewAnnouncement({ ...newAnnouncement, content: e.target.value })}
                    style={{
                      width: '100%',
                      height: '110px',
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                      padding: '12px 14px',
                      fontSize: '13px',
                      outline: 'none',
                      background: '#f8fafc',
                      resize: 'none',
                      lineHeight: 1.5
                    }}
                  />
                </div>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  background: '#f8fafc',
                  padding: '12px 14px',
                  borderRadius: '12px',
                  border: '1px solid #f1f5f9'
                }}>
                  <input
                    type="checkbox"
                    id="isImportant"
                    checked={newAnnouncement.isImportant}
                    onChange={e => setNewAnnouncement({ ...newAnnouncement, isImportant: e.target.checked })}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  <label htmlFor="isImportant" style={{ fontSize: '12px', fontWeight: 700, color: '#475569', cursor: 'pointer', userSelect: 'none' }}>
                    Tandai sebagai Penting / Urgent (Garis Kuning)
                  </label>
                </div>

                <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    style={{
                      flex: 1,
                      height: '44px',
                      borderRadius: '12px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#64748b',
                      fontWeight: 700,
                      fontSize: '13px',
                      cursor: 'pointer'
                    }}
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    style={{
                      flex: 2,
                      height: '44px',
                      borderRadius: '12px',
                      border: 'none',
                      background: '#2563eb',
                      color: '#ffffff',
                      fontWeight: 800,
                      fontSize: '13px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6
                    }}
                  >
                    {isSubmitting ? 'Memproses...' : 'Siarkan Pengumuman'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DETAIL ANNOUNCEMENT MODAL OVERLAY */}
      <AnimatePresence>
        {selectedAnnouncement && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(10px)',
            zIndex: 9999,
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
                maxWidth: '480px',
                borderRadius: '28px',
                padding: '28px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
                color: '#0f172a',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                maxHeight: '85vh',
                overflowY: 'auto'
              }}
            >
              {/* Header inside modal */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
                <span style={{
                  padding: '4px 10px',
                  borderRadius: '10px',
                  fontSize: '10px',
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  background: selectedAnnouncement.category === 'RW' ? '#eff6ff' : selectedAnnouncement.category === 'RT' ? '#ecfdf5' : '#f1f5f9',
                  color: selectedAnnouncement.category === 'RW' ? '#2563eb' : selectedAnnouncement.category === 'RT' ? '#10b981' : '#475569',
                }}>
                  {selectedAnnouncement.category} Info
                </span>
                <button
                  onClick={() => setSelectedAnnouncement(null)}
                  style={{
                    background: '#f1f5f9',
                    border: 'none',
                    color: '#64748b',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 6,
                    borderRadius: '50%'
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Title */}
              <h2 style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a', margin: '0 0 16px', textAlign: 'left', lineHeight: 1.4 }}>
                {selectedAnnouncement.title}
              </h2>

              {/* Image Banner if present */}
              {selectedAnnouncement.imageUrl && (
                <div style={{ width: '100%', maxHeight: '260px', borderRadius: '16px', overflow: 'hidden', marginBottom: '20px', boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>
                  <img src={selectedAnnouncement.imageUrl} alt={selectedAnnouncement.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              )}

              {/* Full Content */}
              <p style={{
                fontSize: '13px',
                color: '#334155',
                lineHeight: 1.7,
                margin: '0 0 24px',
                textAlign: 'left',
                whiteSpace: 'pre-line'
              }}>
                {selectedAnnouncement.content}
              </p>

              {/* Author & Info Card */}
              <div style={{
                background: '#f8fafc',
                borderRadius: '16px',
                padding: '16px',
                border: '1px solid #f1f5f9',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 34,
                    height: 34,
                    borderRadius: '50%',
                    background: '#e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#475569'
                  }}>
                    <UserIcon size={16} />
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '12px', fontWeight: 800, color: '#1e293b' }}>{selectedAnnouncement.author}</div>
                    <div style={{ fontSize: '10px', color: '#10b981', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 3 }}>
                      <ShieldCheck size={11} color="#10b981" /> {selectedAnnouncement.role}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#64748b' }}>
                  <Calendar size={13} />
                  <span style={{ fontSize: '10px', fontWeight: 800 }}>{selectedAnnouncement.date}</span>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DELETE CONFIRMATION MODAL OVERLAY */}
      <AnimatePresence>
        {announcementToDelete && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(8px)',
            zIndex: 10000,
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
                maxWidth: '360px',
                borderRadius: '24px',
                padding: '24px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
                color: '#0f172a',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                textAlign: 'center'
              }}
            >
              <div style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: '#fef2f2',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px'
              }}>
                <Trash2 size={22} style={{ color: '#ef4444' }} />
              </div>

              <h3 style={{ fontSize: '15px', fontWeight: 900, color: '#0f172a', margin: '0 0 8px' }}>
                Hapus Pengumuman?
              </h3>
              <p style={{ fontSize: '12px', color: '#64748b', lineHeight: 1.5, margin: '0 0 20px' }}>
                Apakah Anda yakin ingin menghapus pengumuman ini secara permanen? Tindakan ini tidak dapat dibatalkan.
              </p>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setAnnouncementToDelete(null)}
                  style={{
                    flex: 1,
                    height: '38px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#64748b',
                    fontWeight: 800,
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteAnnouncement}
                  style={{
                    flex: 1,
                    height: '38px',
                    borderRadius: '10px',
                    border: 'none',
                    background: '#ef4444',
                    color: '#ffffff',
                    fontWeight: 800,
                    fontSize: '12px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(239, 68, 68, 0.2)'
                  }}
                >
                  Ya, Hapus
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <style>{`
        @media (max-width: 768px) {
          .announcements-page-container.is-resident {
            padding: 12px 6px 100px !important;
          }
        }
      `}</style>
    </motion.div>
  );
}
