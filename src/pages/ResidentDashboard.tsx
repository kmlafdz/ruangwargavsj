import React, { useState, useEffect, useRef } from 'react';
import {
  Home, User as UserIcon, Users, FileText,
  Wallet, MessageSquare, Megaphone, Bell,
  HelpCircle, LogOut, Search, CreditCard,
  FileCheck, AlertCircle, Clock, ChevronRight,
  MapPin, Calendar, Smartphone, Info, Settings,
  MessageCircle, ThumbsUp, Share2, Bookmark, MoreHorizontal,
  Send, Image as ImageIcon, PlusCircle, Filter, TrendingUp,
  Plus, ArrowRight, ShieldCheck, Eye, EyeOff, CheckCircle,
  Lock as LockIcon, Fingerprint, XCircle, Loader2, Wifi
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { User } from '../types';
import { db } from '../firebase/config';
import { doc, updateDoc, onSnapshot, collection, query, where, addDoc, serverTimestamp } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import logo from '../assets/login/logo.png';
import { SocialBadge } from '../components/SocialBadge';
import PinVerificationModal from '../components/PinVerificationModal';

interface ResidentDashboardProps {
  user: User | null;
}

export default function ResidentDashboard({ user: initialUser }: ResidentDashboardProps) {
  const [user, setUser] = useState<User | null>(initialUser);
  const [isLocked, setIsLocked] = useState(false);
  const [showNik, setShowNik] = useState(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState({
    iuranStatus: 'Lunas',
    suratActive: 0,
    pengaduanSelesai: 0,
    notifBaru: 0,
    iuranBelumBayar: 0
  });
  const [forumPosts, setForumPosts] = useState<any[]>([]);
  const [forumCategory, setForumCategory] = useState('Semua');
  const [isPosting, setIsPosting] = useState(false);
  const [newPost, setNewPost] = useState({ title: '', content: '', category: 'Diskusi Umum' });
  const navigate = useNavigate();

  const [headerVisible, setHeaderVisible] = useState(true);
  const lastScrollYRef = useRef(0);

  useEffect(() => {
    const handleScroll = (e: any) => {
      const target = e.target;
      if (!target) return;

      const currentScrollY = target === document 
        ? window.scrollY 
        : (target.scrollTop !== undefined ? target.scrollTop : 0);

      const scrollDiff = Math.abs(currentScrollY - lastScrollYRef.current);

      if (currentScrollY <= 10) {
        setHeaderVisible(true);
      } else if (scrollDiff > 8) {
        if (currentScrollY > lastScrollYRef.current) {
          setHeaderVisible(false);
        } else {
          setHeaderVisible(true);
        }
        lastScrollYRef.current = currentScrollY;
      }
    };

    window.addEventListener('scroll', handleScroll, true);
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, []);

  const [runningAnnouncements, setRunningAnnouncements] = useState<string>('');

  useEffect(() => {
    const q = query(collection(db, 'announcements'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const titles: string[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.title) {
          titles.push(data.title);
        }
      });
      if (titles.length > 0) {
        setRunningAnnouncements(titles.join('  •  '));
      } else {
        setRunningAnnouncements('Belum ada pengumuman resmi terbaru.');
      }
    });
    return unsubscribe;
  }, []);

  const [showLetterForm, setShowLetterForm] = useState(false);
  const [isSubmittingLetter, setIsSubmittingLetter] = useState(false);
  const [letterData, setLetterData] = useState({
    jenis: 'Surat Pengantar Domisili',
    keperluan: '',
    keterangan: ''
  });

  const letterTypes = [
    { title: 'Pengantar Domisili', desc: 'Untuk pengurusan KTP atau domisili.', icon: FileText, color: '#3b82f6' },
    { title: 'SKTM', desc: 'Surat Keterangan Tidak Mampu.', icon: AlertCircle, color: '#f59e0b' },
    { title: 'Pengantar Nikah', desc: 'Syarat administrasi pernikahan.', icon: Users, color: '#ec4899' },
    { title: 'Keterangan Usaha', desc: 'Untuk izin atau kredit usaha.', icon: ShieldCheck, color: '#10b981' },
  ];

  const handleSubmitLetter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !letterData.keperluan) return;

    setIsSubmittingLetter(true);
    try {
      await addDoc(collection(db, 'surat_requests'), {
        ...letterData,
        wargaId: user.id,
        wargaName: user.name,
        rt_id: user.rt_id,
        nik: user.nik,
        status: 'Pending',
        nomor: `SRT/${Math.floor(100 + Math.random() * 900)}/${new Date().getFullYear()}`,
        createdAt: serverTimestamp(),
      });
      setShowLetterForm(false);
      setLetterData({ jenis: 'Surat Pengantar Domisili', keperluan: '', keterangan: '' });
      alert("Pengajuan surat berhasil dikirim!");
    } catch (e) {
      console.error("Error submitting letter:", e);
    } finally {
      setIsSubmittingLetter(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('erw_user');
    window.location.href = '/warga-login';
  };

  const handleToggleNik = () => {
    if (!showNik && user?.pin) {
      setIsPinModalOpen(true);
    } else {
      setShowNik(false);
    }
  };

  // Real-time user data sync
  useEffect(() => {
    if (!initialUser?.id) return;
    const unsubscribe = onSnapshot(doc(db, 'users', initialUser.id), (doc) => {
      if (doc.exists()) {
        const userData = { id: doc.id, ...doc.data() } as User;
        setUser(userData);
        // Sync local storage
        localStorage.setItem('erw_user', JSON.stringify(userData));
      }
    });
    return () => unsubscribe();
  }, [initialUser?.id]);

  // Real-time stats sync
  useEffect(() => {
    if (!user?.id) return;

    // 1. Iuran Status
    const iuranQuery = query(collection(db, 'keuangan'), where('userId', '==', user.id), where('type', '==', 'Iuran'));
    const iuranUnsub = onSnapshot(iuranQuery, (snap) => {
      const currentMonth = new Date().toLocaleString('default', { month: 'long' });
      const isLunas = snap.docs.some(d => d.data().description?.includes(currentMonth));
      const unpaid = snap.docs.filter(d => d.data().status === 'Unpaid').length;
      setStats(prev => ({
        ...prev,
        iuranStatus: isLunas ? 'LUNAS' : 'BELUM BAYAR',
        iuranBelumBayar: unpaid
      }));
    });

    // 2. Surat Requests
    const suratQuery = query(collection(db, 'suratRequests'), where('userId', '==', user.id));
    const suratUnsub = onSnapshot(suratQuery, (snap) => {
      const active = snap.docs.filter(d => d.data().status === 'Pending').length;
      setStats(prev => ({ ...prev, suratActive: active }));
    });

    // 3. Pengaduan
    const pengaduanQuery = query(collection(db, 'pengaduan'), where('userId', '==', user.id));
    const pengaduanUnsub = onSnapshot(pengaduanQuery, (snap) => {
      const selesai = snap.docs.filter(d => d.data().status === 'Selesai').length;
      setStats(prev => ({ ...prev, pengaduanSelesai: selesai }));
    });

    // 4. Notifications
    const notifQuery = query(collection(db, 'notifications'), where('isRead', '==', false));
    const notifUnsub = onSnapshot(notifQuery, (snap) => {
      const unread = snap.docs.filter(d => {
        const data = d.data();
        const isTargetUser = data.targetId === user.id;
        const isTargetResident = data.targetAccountType === 'resident' || 
                                 data.targetAccountType === 'warga' ||
                                 (data.targetRoles && (data.targetRoles.includes('resident') || data.targetRoles.includes('warga')));
        return isTargetUser || isTargetResident;
      }).length;
      setStats(prev => ({ ...prev, notifBaru: unread }));
    });

    return () => {
      iuranUnsub();
      suratUnsub();
      pengaduanUnsub();
      notifUnsub();
    };
  }, [user?.id, user?.accountType]);



  // Forum Real-time Sync
  useEffect(() => {
    const q = query(collection(db, 'forumPosts'), where('status', '==', 'active'));
    const unsub = onSnapshot(q, (snap) => {
      const posts = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setForumPosts(posts.sort((a: any, b: any) => b.createdAt?.seconds - a.createdAt?.seconds));
    });
    return () => unsub();
  }, []);

  const handleCreatePost = async () => {
    if (!newPost.title || !newPost.content) return;
    try {
      await addDoc(collection(db, 'forumPosts'), {
        ...newPost,
        authorId: user?.id,
        authorName: user?.name,
        authorPosition: user?.communityPosition || 'Warga',
        rt_id: user?.rt_id,
        createdAt: new Date(),
        likes: 0,
        comments: 0,
        status: 'active'
      });
      setIsPosting(false);
      setNewPost({ title: '', content: '', category: 'Diskusi Umum' });
    } catch (e) {
      console.error("Error posting:", e);
    }
  };



  // MANDATORY REGISTRATION CHECK
  if (user?.accountType === 'resident') {
    if (user.registrationStatus === 'pending_input') {
      return (
        <div className="login-container" style={{ padding: 20 }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="login-card"
            style={{ maxWidth: 450, textAlign: 'center', background: 'rgba(255, 255, 255, 0.9)', backdropFilter: 'blur(10px)' }}
          >
            <div style={{ width: 80, height: 80, background: 'var(--blue-50)', color: 'var(--blue-600)', borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
              <FileCheck size={40} />
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 900, marginBottom: 12, color: '#1e3a8a' }}>Lengkapi Registrasi</h2>
            <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.6, marginBottom: 24 }}>
              Selamat datang! Akun Anda telah dibuat oleh Admin. <br />
              Sesuai prosedur keamanan, Anda wajib melengkapi data profil dan mengunggah foto KTP/KK untuk verifikasi identitas.
            </p>
            <button className="btn btn-primary btn-block" style={{ height: 54, borderRadius: 16 }} onClick={() => window.location.href = '#/warga/aktivasi'}>
              Mulai Pengisian Data <ArrowRight size={18} />
            </button>
          </motion.div>
        </div>
      );
    }

    if (user.registrationStatus === 'pending_approval') {
      return (
        <div className="login-container" style={{ padding: 20 }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="login-card"
            style={{ maxWidth: 450, textAlign: 'center', background: 'rgba(255, 255, 255, 0.9)', backdropFilter: 'blur(10px)' }}
          >
            <div style={{ width: 80, height: 80, background: '#fffbeb', color: '#d97706', borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
              <Clock size={40} />
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 900, marginBottom: 12, color: '#92400e' }}>Menunggu Verifikasi</h2>
            <p style={{ fontSize: 14, color: '#78350f', opacity: 0.8, lineHeight: 1.6, marginBottom: 24 }}>
              Terima kasih! Data pendaftaran Anda telah kami terima. <br />
              Saat ini tim Admin RW sedang melakukan peninjauan. Anda akan menerima notifikasi melalui WhatsApp setelah akun disetujui.
            </p>
            <div style={{ background: '#fef3c7', padding: 20, borderRadius: 20, marginBottom: 24, textAlign: 'left', border: '1px solid #fde68a' }}>
              <div style={{ fontSize: 11, color: '#92400e', fontWeight: 800, textTransform: 'uppercase', marginBottom: 6, letterSpacing: 1 }}>STATUS TERBARU</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#78350f', display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="pulse-yellow" style={{ width: 8, height: 8, background: '#d97706', borderRadius: '50%' }} />
                Dalam Antrian Verifikasi RT {user.rt_id}
              </div>
            </div>
            <button className="btn btn-secondary btn-block" style={{ height: 54, borderRadius: 16 }} onClick={() => window.location.reload()}>
              Cek Status Terbaru
            </button>
          </motion.div>
        </div>
      );
    }
  }

  const renderTabContent = () => {
    if (activeTab === 'dashboard') {
      return (
        <div className="dashboard-content">
          {/* DIGITAL ID CARD - THE ONLY ONE WITH CONTAINER */}
          <section className="section-card-id">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ scale: 1.01 }}
              className="digital-id-card"
            >
              <div className="card-watermark" />
              <div className="card-decor-dots" />
              <div className="card-smart-chip">
                <div /><div /><div /><div />
              </div>
              
              {/* MAIN CONTENT AREA - SHIFTED UP */}
              <div className="card-main-content" style={{ marginTop: '2cqw' }}>
                <div className="card-left">
                  <div style={{ marginBottom: 8 }}>
                    <SocialBadge 
                      position={user?.communityPosition} 
                      rt_id={user?.rt_id} 
                      style={{ fontSize: 10, padding: '2px 10px' }} 
                    />
                  </div>
                  <div className="user-name">{user?.name}</div>
                  <div className="user-nik-pill">
                    <Fingerprint size={14} className="nik-icon" />
                    <span className="user-nik">
                      {showNik ? user?.nik : `•••• •••• •••• ${user?.nik?.slice(-4) || '0000'}`}
                    </span>
                    <button onClick={handleToggleNik} className="btn-toggle-nik-glass">
                      {showNik ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <div className="user-address-text">
                    <MapPin size={14} color="#3b82f6" fill="#3b82f6" fillOpacity={0.2} />
                    {`BLOK ${(user as any).blok || 'G/8'}, RT ${user?.rt_id || '002'}/11`}
                  </div>
                </div>

                <div className="card-right">
                  <div className="card-qr-area-new">
                    <div className="qr-wrapper">
                      <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${user?.nik || 'RESIDENT'}&bgcolor=ffffff&color=0f172a`} 
                        alt="QR Code" 
                        className="card-qr-img-new" 
                      />
                      <div className="qr-center-logo">
                        <img src={logo} alt="Logo" />
                      </div>
                    </div>
                    <div className="qr-label-new">SCAN TO VERIFY</div>
                  </div>
                </div>
              </div>

              {/* FOOTER */}
              <div className="card-footer-new">
                <div className="verified-badge-pill">
                  <ShieldCheck size={16} color="#4ade80" />
                  <span>VERIFIED MEMBER</span>
                </div>
                <div className="official-id-group">
                  <span className="official-id-text">OFFICIAL ID</span>
                  <Wifi size={16} className="wireless-icon" />
                </div>
              </div>
            </motion.div>
          </section>

          {(!user?.email || !user?.pinSet || !user?.pin) && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
                border: '1px solid #fde68a',
                borderRadius: '20px',
                padding: '16px 20px',
                marginTop: '10px',
                marginBottom: '24px',
                boxShadow: '0 10px 15px -3px rgba(217, 119, 6, 0.05)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                textAlign: 'left'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: '#f59e0b',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <LockIcon size={18} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 900, color: '#78350f' }}>
                    Lengkapi Keamanan Akun
                  </h4>
                  <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#92400e', fontWeight: 700 }}>
                    Email & PIN transaksi belum lengkap.
                  </p>
                </div>
              </div>
              <p style={{ margin: 0, fontSize: '11.5px', color: '#78350f', lineHeight: 1.5 }}>
                Demi keamanan data Anda, silakan lengkapi <strong>Email</strong> (pemulihan akun) serta <strong>PIN Keamanan</strong> untuk otorisasi transaksi kas atau pengajuan surat.
              </p>
              <button 
                onClick={() => navigate('/warga/setting')}
                style={{
                  height: '38px',
                  borderRadius: '10px',
                  border: 'none',
                  background: '#d97706',
                  color: '#ffffff',
                  fontSize: '11.5px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  boxShadow: '0 4px 6px -1px rgba(217, 119, 6, 0.2)',
                  width: 'fit-content',
                  padding: '0 16px'
                }}
              >
                Lengkapi Sekarang <ArrowRight size={13} />
              </button>
            </motion.div>
          )}

          {/* QUICK ACTIONS SECTION - No Container */}
          <section className="section-quick-actions">
            <h3 className="section-title">Layanan Cepat</h3>
            <div className="quick-actions-grid">
              {[
                { label: 'Keluarga', icon: Users, color: '#8b5cf6', route: '/warga/keluarga' },
                { label: 'Surat', icon: Plus, color: '#3b82f6', route: '/warga/surat' },
                { label: 'Lapor', icon: Megaphone, color: '#f59e0b', route: '/warga/report' },
                { label: 'Kritik & Saran', icon: MessageSquare, color: '#10b981', route: '/warga/feedback' },
              ].map((act, i) => (
                <motion.button
                  key={i} whileTap={{ scale: 0.95 }}
                  onClick={() => navigate(act.route || '/')}
                  className="quick-action-item"
                >
                  <div className="action-icon-wrapper" style={{ background: act.color }}>
                    <act.icon size={22} />
                  </div>
                  <span className="action-label">{act.label}</span>
                </motion.button>
              ))}
            </div>
          </section>

          {/* SUMMARY STATS SECTION - No Container */}
          <section className="section-summary">
            <h3 className="section-title">Ringkasan Aktivitas</h3>
            <div className="summary-grid">
              <div className="summary-item" style={{ background: stats.iuranStatus === 'LUNAS' ? '#f0fdf4' : '#fef2f2' }}>
                <div className="summary-icon" style={{ color: stats.iuranStatus === 'LUNAS' ? '#16a34a' : '#dc2626', background: stats.iuranStatus === 'LUNAS' ? '#dcfce7' : '#fee2e2' }}>
                  <Wallet size={20} />
                </div>
                <div className="summary-info">
                  <span className="summary-label">Iuran {new Date().toLocaleString('id-ID', { month: 'long' })}</span>
                  <span className="summary-value" style={{ color: stats.iuranStatus === 'LUNAS' ? '#16a34a' : '#dc2626' }}>{stats.iuranStatus}</span>
                </div>
              </div>
              <div className="summary-item status-blue">
                <div className="summary-icon icon-blue"><FileText size={20} /></div>
                <div className="summary-info">
                  <span className="summary-label">Surat Aktif</span>
                  <span className="summary-value value-blue">{stats.suratActive} Pengajuan</span>
                </div>
              </div>
              <div className="summary-item status-purple">
                <div className="summary-icon icon-purple"><MessageSquare size={20} /></div>
                <div className="summary-info">
                  <span className="summary-label">Pengaduan</span>
                  <span className="summary-value value-purple">{stats.pengaduanSelesai} Selesai</span>
                </div>
              </div>
              <div className="summary-item status-orange" onClick={() => navigate('/warga/pengumuman')} style={{ cursor: 'pointer' }}>
                <div className="summary-icon icon-orange"><Bell size={20} /></div>
                <div className="summary-info">
                  <span className="summary-label">Notifikasi</span>
                  <span className="summary-value value-orange">{stats.notifBaru} Baru</span>
                </div>
              </div>
            </div>
          </section>

          {/* ANNOUNCEMENTS SECTION - No Container */}
          <section className="section-announcements">
            <div className="info-header">
              <h3 className="section-title">Informasi Terkini</h3>
              <button className="btn-text">Lihat Semua</button>
            </div>
            <div className="announcements-carousel">
              {[
                { title: 'Kerja Bakti Minggu Ini', date: '12 Mei', type: 'Kegiatan', color: '#3b82f6' },
                { title: 'Pemutakhiran Data Warga', date: '15 Mei', type: 'Penting', color: '#ef4444' },
                { title: 'Siskamling Terpadu', date: 'Update', type: 'Informasi', color: '#10b981' },
              ].map((ann, i) => (
                <div key={i} className="announcement-card">
                  <div className="ann-type" style={{ color: ann.color }}>{ann.type}</div>
                  <div className="ann-title">{ann.title}</div>
                  <div className="ann-meta"><Clock size={12} /> {ann.date}</div>
                </div>
              ))}
            </div>
          </section>

          {/* SECURITY & SETTINGS - No Container */}
          <section className="section-security">
            <div className="security-banner-flat">
              <div className="security-info">
                <div className="security-icon-box"><ShieldCheck size={24} color="#3b82f6" /></div>
                <div className="security-text">
                  <span className="security-title">Keamanan & PIN</span>
                  <span className="security-status">{user?.pin ? 'PIN Aktif' : 'Belum Aktif'}</span>
                </div>
              </div>
              <button className="btn-circle-action" onClick={() => window.location.href = '#/warga/setting'}><ArrowRight size={20} /></button>
            </div>
          </section>
        </div>
      );
    }

    if (activeTab === 'profile') {
      return (
        <div className="dashboard-content profile-tab-content">
          <section className="profile-header-section" style={{ textAlign: 'center', padding: '40px 0 20px' }}>
            <div className="profile-avatar-large">
              {user?.photoUrl ? <img src={user.photoUrl} alt="User" /> : <UserIcon size={48} />}
            </div>
            <h2 className="profile-name-text">{user?.name}</h2>
            {user?.communityPosition && (
              <div className="card-position-badge" style={{ marginBottom: 12 }}>
                {user.communityPosition.includes('RW') ? '👑' : user.communityPosition.includes('RT') ? '🛡️' : user.communityPosition.includes('Sekretaris') ? '📋' : user.communityPosition.includes('Bendahara') ? '💰' : '✨'}
                {' '}{user.communityPosition}
              </div>
            )}
            <p className="profile-nik-text">NIK: {user?.nik || 'N/A'}</p>
            <div className="profile-tag">RT {user?.rt_id} / RW 011</div>
          </section>

          <section className="profile-menu-section">
            <h3 className="section-title">Akun & Keamanan</h3>
            <div className="profile-menu-list">
              <button className="profile-menu-item" onClick={() => window.location.href = '#/warga/setting'}>
                <div className="menu-item-icon bg-blue"><Settings size={18} /></div>
                <span className="menu-item-label">Edit Profil</span>
                <ChevronRight size={18} color="#cbd5e1" />
              </button>
              <button className="profile-menu-item">
                <div className="menu-item-icon bg-purple"><LockIcon size={18} /></div>
                <span className="menu-item-label">Ubah Password</span>
                <ChevronRight size={18} color="#cbd5e1" />
              </button>

            </div>

            <h3 className="section-title" style={{ marginTop: 24 }}>Dukungan</h3>
            <div className="profile-menu-list">
              <button className="profile-menu-item">
                <div className="menu-item-icon bg-gray"><HelpCircle size={18} /></div>
                <span className="menu-item-label">Pusat Bantuan</span>
                <ChevronRight size={18} color="#cbd5e1" />
              </button>
              <button className="profile-menu-item">
                <div className="menu-item-icon bg-gray"><Info size={18} /></div>
                <span className="menu-item-label">Tentang Aplikasi</span>
                <ChevronRight size={18} color="#cbd5e1" />
              </button>
            </div>

            <div style={{ marginTop: 40, padding: '0 4px' }}>
              <button className="btn-logout-warga" onClick={handleLogout}><LogOut size={20} /> Keluar dari Akun</button>
              <p style={{ textAlign: 'center', fontSize: 11, color: '#94a3b8', marginTop: 16 }}>Versi 2.0.4 - Ruang Warga VSJ</p>
            </div>
          </section>
        </div>
      );
    }

    if (activeTab === 'forum') {
      const categories = ['Semua', 'Pengumuman', 'Keamanan', 'Lingkungan', 'Kegiatan', 'Jual Beli', 'Diskusi Umum'];
      const filteredPosts = forumCategory === 'Semua' ? forumPosts : forumPosts.filter(p => p.category === forumCategory);

      return (
        <div className="forum-container">
          <section className="forum-header">
            <div className="forum-title-area">
              <h2 className="forum-title">Forum Warga</h2>
              <button className="btn-create-post" onClick={() => setIsPosting(true)}>
                <PlusCircle size={18} />
                <span>Buat Diskusi</span>
              </button>
            </div>

            <div className="forum-search-container">
              <Search className="forum-search-icon" size={20} />
              <input type="text" placeholder="Cari diskusi atau topik..." className="forum-search-input" />
            </div>

            <div className="category-scroll">
              {categories.map(cat => (
                <div
                  key={cat}
                  className={`category-chip ${forumCategory === cat ? 'active' : ''}`}
                  onClick={() => setForumCategory(cat)}
                >
                  {cat}
                </div>
              ))}
            </div>
          </section>

          {/* TRENDING SECTION */}
          <section className="trending-section">
            <div className="section-header-flex" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 className="section-title" style={{ margin: 0 }}>Sedang Tren</h3>
              <TrendingUp size={16} color="#3b82f6" />
            </div>
            <div className="trending-list">
              {[
                { title: 'Perbaikan Aspal Blok G', cat: 'Lingkungan', count: 24 },
                { title: 'Lomba 17 Agustus', cat: 'Kegiatan', count: 56 },
                { title: 'Pos Keamanan Baru', cat: 'Keamanan', count: 18 }
              ].map((t, i) => (
                <div key={i} className="trending-card">
                  <div className="trending-label">🔥 {t.cat}</div>
                  <div className="trending-title">{t.title}</div>
                  <div className="trending-stats">{t.count} Komentar</div>
                </div>
              ))}
            </div>
          </section>

          {/* MAIN FEED */}
          <div className="forum-feed">
            {filteredPosts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                <MessageSquare size={48} color="#cbd5e1" style={{ margin: '0 auto 16px' }} />
                <h4 style={{ color: '#64748b', fontSize: 16, fontWeight: 700 }}>Belum ada diskusi di forum warga</h4>
                <p style={{ color: '#94a3b8', fontSize: 13, marginTop: 4 }}>Jadilah yang pertama memulai obrolan!</p>
              </div>
            ) : (
              filteredPosts.map(post => (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="forum-post-card"
                >
                  <div className="post-header">
                    <div className="post-author-info">
                      <div className="author-avatar">{post.authorName?.charAt(0)}</div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div className="author-name">{post.authorName}</div>
                          {(post as any).authorPosition && (
                            <span style={{ 
                              fontSize: 10, 
                              fontWeight: 800, 
                              background: '#eff6ff', 
                              color: '#2563eb', 
                              padding: '1px 6px', 
                              borderRadius: 4,
                              textTransform: 'uppercase'
                            }}>
                              {(post as any).authorPosition}
                            </span>
                          )}
                        </div>
                        <div className="post-meta">
                          <span className="role-badge">RT 0{post.rt_id}</span>
                          <span>•</span>
                          <span>{post.createdAt?.seconds ? new Date(post.createdAt.seconds * 1000).toLocaleDateString('id-ID') : 'Baru saja'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="category-tag" style={{
                      background: post.category === 'Pengumuman' ? '#fee2e2' : '#eff6ff',
                      color: post.category === 'Pengumuman' ? '#ef4444' : '#3b82f6'
                    }}>
                      {post.category}
                    </div>
                  </div>

                  <div className="post-content">
                    <h3 className="post-title">{post.title}</h3>
                    <p className="post-text">{post.content}</p>
                    {post.imageUrl && (
                      <div className="post-image-container">
                        <img src={post.imageUrl} alt="Attachment" className="post-image" />
                      </div>
                    )}
                  </div>

                  <div className="post-actions">
                    <button className="action-btn"><ThumbsUp size={18} /> {post.likes || 0}</button>
                    <button className="action-btn"><MessageCircle size={18} /> {post.comments || 0}</button>
                    <button className="action-btn"><Share2 size={18} /></button>
                    <button className="action-btn"><Bookmark size={18} /></button>
                  </div>
                </motion.div>
              ))
            )}
          </div>

          {/* CREATE POST MODAL */}
          <AnimatePresence>
            {isPosting && (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)', zIndex: 2000, display: 'flex', alignItems: 'flex-end' }}
              >
                <motion.div
                  initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                  style={{ background: '#fff', width: '100%', borderRadius: '32px 32px 0 0', padding: '24px', maxHeight: '90vh', overflowY: 'auto' }}
                >
                  <div style={{ width: 40, height: 4, background: '#e2e8f0', borderRadius: 2, margin: '0 auto 24px' }} />
                  <h3 style={{ fontSize: 20, fontWeight: 900, color: '#1e3a8a', marginBottom: 20 }}>Buat Diskusi Baru</h3>

                  <div className="input-group">
                    <label className="label">Judul Diskusi</label>
                    <input
                      type="text" className="form-input" placeholder="Apa yang ingin Anda bahas?"
                      value={newPost.title} onChange={e => setNewPost({ ...newPost, title: e.target.value })}
                      style={{ width: '100%', height: 48, borderRadius: 12, border: '1px solid #e2e8f0', padding: '0 16px', outline: 'none' }}
                    />
                  </div>

                  <div className="input-group" style={{ marginTop: 16 }}>
                    <label className="label">Kategori</label>
                    <select
                      className="form-input" value={newPost.category} onChange={e => setNewPost({ ...newPost, category: e.target.value })}
                      style={{ width: '100%', height: 48, borderRadius: 12, border: '1px solid #e2e8f0', padding: '0 16px', outline: 'none', appearance: 'none' }}
                    >
                      {categories.filter(c => c !== 'Semua').map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  <div className="input-group" style={{ marginTop: 16 }}>
                    <label className="label">Konten / Isi Diskusi</label>
                    <textarea
                      placeholder="Ceritakan lebih detail..."
                      value={newPost.content} onChange={e => setNewPost({ ...newPost, content: e.target.value })}
                      style={{ width: '100%', height: 120, borderRadius: 12, border: '1px solid #e2e8f0', padding: '16px', outline: 'none', resize: 'none', fontFamily: 'inherit' }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                    <button className="btn-logout-warga" style={{ background: '#f1f5f9', color: '#64748b', flex: 1 }} onClick={() => setIsPosting(false)}>Batal</button>
                    <button className="btn-logout-warga" style={{ background: '#2563eb', color: '#fff', flex: 2 }} onClick={handleCreatePost}>Posting Sekarang</button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      );
    }

    return null;
  };

  const [showAvatarMenu, setShowAvatarMenu] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  return (
    <div className="resident-layout">
      {/* Logout Confirmation Modal */}
      <AnimatePresence>
        {showLogoutConfirm && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              style={{ background: '#fff', width: '100%', maxWidth: 400, borderRadius: 28, padding: 32, textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}
            >
              <div style={{ width: 64, height: 64, background: '#fef2f2', color: '#ef4444', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <LogOut size={28} />
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 900, color: '#0f172a', marginBottom: 12 }}>Konfirmasi Keluar</h3>
              <p style={{ color: '#64748b', fontSize: 14, lineHeight: 1.6, marginBottom: 32 }}>
                Apakah Anda yakin ingin keluar dari akun <strong>{user?.name}</strong>? Anda perlu login kembali untuk mengakses layanan warga.
              </p>
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  style={{ flex: 1, height: 50, borderRadius: 14, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
                >
                  Batal
                </button>
                <button
                  onClick={handleLogout}
                  style={{ flex: 1, height: 50, borderRadius: 14, border: 'none', background: '#ef4444', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
                >
                  Ya, Keluar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FULL WIDTH RUNNING TEXT / MARQUEE */}
      {/* LETTER SUBMISSION MODAL */}
      <AnimatePresence>
        {showLetterForm && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(8px)', zIndex: 5000, display: 'flex', alignItems: 'flex-end' }}
          >
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              style={{
                background: '#fff', width: '100%',
                borderRadius: '32px 32px 0 0',
                padding: '24px 24px 42px', // Added more bottom padding for safe area
                maxHeight: '95vh', overflowY: 'auto'
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', marginBottom: 24 }}>
                <div style={{ width: 40, height: 4, background: '#e2e8f0', borderRadius: 2, marginBottom: 20 }} />
                <div style={{ width: 48, height: 48, background: '#eff6ff', color: '#2563eb', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                  <FileText size={24} />
                </div>
                <h3 style={{ fontSize: 20, fontWeight: 900, color: '#1e3a8a', margin: 0 }}>Buat Pengajuan Surat</h3>
                <button
                  onClick={() => setShowLetterForm(false)}
                  style={{ position: 'absolute', right: 0, top: 20, background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer' }}
                >
                  <XCircle size={24} />
                </button>
              </div>

              <form onSubmit={handleSubmitLetter} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 800, color: '#475569', marginBottom: 10 }}>Pilih Jenis Surat</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                    {letterTypes.map(type => (
                      <div
                        key={type.title}
                        onClick={() => setLetterData({ ...letterData, jenis: `Surat ${type.title}` })}
                        style={{
                          border: `1px solid ${letterData.jenis.includes(type.title) ? '#2563eb' : '#e2e8f0'}`,
                          background: letterData.jenis.includes(type.title) ? '#eff6ff' : '#fff',
                          borderRadius: 16, padding: 12, display: 'flex', flexDirection: 'column', gap: 8, cursor: 'pointer'
                        }}
                      >
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: type.color + '15', color: type.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <type.icon size={18} style={{ margin: '0 auto' }} />
                        </div>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 800, color: '#1e293b' }}>{type.title}</div>
                          <div style={{ fontSize: 9, color: '#64748b' }}>{type.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 800, color: '#475569', marginBottom: 10 }}>Tujuan / Keperluan</label>
                  <textarea
                    placeholder="Contoh: Persyaratan pendaftaran sekolah."
                    value={letterData.keperluan}
                    onChange={e => setLetterData({ ...letterData, keperluan: e.target.value })}
                    required
                    style={{ width: '100%', height: 100, border: '1px solid #e2e8f0', borderRadius: 16, padding: 14, fontSize: 14, outline: 'none', background: '#f8fafc', resize: 'none' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                  <button type="button" onClick={() => setShowLetterForm(false)} style={{ flex: 1, height: 52, borderRadius: 16, background: '#f1f5f9', color: '#64748b', fontWeight: 700, border: 'none' }}>Batal</button>
                  <button type="submit" disabled={isSubmittingLetter} style={{ flex: 2, height: 52, borderRadius: 16, background: '#2563eb', color: '#fff', fontWeight: 700, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    {isSubmittingLetter ? <Loader2 size={18} className="animate-spin" /> : <><Send size={18} /> Kirim Pengajuan</>}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => { setShowLetterForm(false); navigate('/warga/surat'); }}
                  style={{ background: 'none', border: 'none', color: '#2563eb', fontWeight: 700, fontSize: 13, textDecoration: 'underline', marginTop: 8, cursor: 'pointer', textAlign: 'center' }}
                >
                  Lihat Riwayat Pengajuan
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {activeTab === 'dashboard' && (
        <div 
          className="running-text-container-full"
          style={{
            transform: headerVisible ? 'translateY(0)' : 'translateY(-100px)',
            transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          <div className="running-text-content">
            <span>📢 PENGUMUMAN TERBARU: {runningAnnouncements}  •  💰 STATUS KEUANGAN: {(stats as any).iuranBelumBayar > 0 ? 'Terdapat Iuran Belum Terbayar' : 'Seluruh Iuran Lunas'}  •  🏠 Selamat Datang di Ruang Warga VSJ RT 0{user?.rt_id}/11</span>
          </div>
        </div>
      )}

      <div className="resident-container">
        <header className="dashboard-header">
          <div className="header-greeting">
            <h1 className="greeting-title">
              {activeTab === 'dashboard' ? `Halo, ${user?.name?.split(' ')[0] || 'Warga'} 👋` : 'Profil Saya'}
            </h1>
            <p className="greeting-date">
              {activeTab === 'dashboard'
                ? new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })
                : 'Kelola informasi akun Anda'
              }
            </p>
          </div>

          <div className="header-actions">
          </div>
        </header>

        {renderTabContent()}
      </div>



      {user && (
        <PinVerificationModal
          isOpen={isPinModalOpen}
          correctPin={user.pin || ''}
          userName={user.name || 'Warga'}
          userId={user.id}
          userPassword={user.password}
          title="Verifikasi PIN untuk Melihat NIK"
          onSuccess={() => setShowNik(true)}
          onClose={() => setIsPinModalOpen(false)}
        />
      )}

      <style>{`
        .resident-layout {
          min-height: 100vh;
          background: #f8fafc;
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
          color: #1e293b;
        }
        
        .resident-container {
          max-width: 500px;
          margin: 0 auto;
          padding: 12px 16px 80px; /* Added 16px lateral padding for premium mobile safe margins */
        }

        /* Header Styles */
        .dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px; /* Reduced from 12px */
          padding: 0 4px;
        }
        .greeting-title {
          font-size: 20px;
          font-weight: 800;
          color: #0f172a;
          margin: 0;
        }
        .greeting-date {
          font-size: 13px;
          color: #64748b;
          margin: 2px 0 0;
        }
        .header-actions {
          display: flex;
          gap: 10px;
        }
        .search-icon-dim {
          color: #94a3b8;
        }
        .running-text-container-full {
          background: #fff;
          border-bottom: 1px solid #f1f5f9;
          height: 30px;
          overflow: hidden;
          position: fixed;
          top: 64px; /* Default for desktop */
          left: 0;
          width: 100%;
          z-index: 1000;
          display: flex;
          align-items: center;
          pointer-events: none; /* Allow clicks through to content if needed */
        }
        
        @media (max-width: 768px) {
          .running-text-container-full {
             top: 50px; /* Aligned with 50px mobile navbar */
             height: 28px;
          }
        }
        
        @media (min-width: 768px) {
          .running-text-container-full {
            left: var(--sidebar-width);
            width: calc(100% - var(--sidebar-width));
          }
        }
        .running-text-content {
          white-space: nowrap;
          position: absolute;
          animation: marquee 25s linear infinite;
          padding-left: 100%;
          font-size: 12px;
          font-weight: 700;
          color: #1e40af;
        }
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-100%); }
        }
        @media (max-width: 768px) {
          .header-search-bar { display: none; }
        }
        .icon-btn-glass {
          width: 42px;
          height: 42px;
          border-radius: 12px;
          background: #fff;
          border: 1px solid #e2e8f0;
          color: #475569;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05);
          cursor: pointer;
          transition: all 0.2s;
        }
        .notify-btn {
          position: relative;
        }
        .notification-dot {
          position: absolute;
          top: 10px;
          right: 10px;
          width: 8px;
          height: 8px;
          background: #ef4444;
          border: 2px solid #fff;
          border-radius: 50%;
        }

        /* Content Sections */
        .dashboard-content {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 0 4px;
        }

        .section-title {
          font-size: 14px;
          font-weight: 800;
          color: #1e293b;
          margin-bottom: 8px;
          padding-left: 2px;
        }

        /* Digital ID Card (REMAINS AS CARD) */
        .digital-id-card {
          width: 100%;
          max-width: 420px;
          aspect-ratio: 1.58 / 1;
          height: auto;
          margin: 0 auto;
          background: linear-gradient(135deg, #021a52 0%, #083b9c 45%, #021a52 100%);
          border-radius: 32px;
          padding: 6cqw;
          color: #fff;
          position: relative;
          overflow: hidden;
          box-shadow: none;
          container-type: inline-size;
          display: flex;
          flex-direction: column;
        }
        .card-decor-dots {
          position: absolute;
          top: 8cqw;
          left: 6cqw;
          width: 8cqw;
          height: 6cqw;
          opacity: 0.15;
          background-image: radial-gradient(circle, #fff 1px, transparent 1px);
          background-size: 5px 5px;
        }
        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 2cqw;
          position: relative;
          z-index: 2;
        }
        .card-logo-placeholder {
          background: #fff;
          width: 18cqw;
          height: 18cqw;
          border-radius: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 8px 16px rgba(0,0,0,0.2);
        }
        .card-divider-glow {
          height: 1px;
          background: linear-gradient(to right, #3b82f6 0%, #3b82f6 12%, rgba(255,255,255,0.08) 12%, rgba(255,255,255,0.08) 100%);
          width: 100%;
          margin-bottom: 5cqw;
          position: relative;
        }
        .card-divider-glow::before {
          content: '';
          position: absolute;
          left: 0;
          top: -1px;
          width: 12cqw;
          height: 3px;
          background: #3b82f6;
          filter: blur(2px);
          border-radius: 10px;
        }
        .card-main-content {
          display: grid;
          grid-template-columns: 1fr 28cqw;
          gap: 4cqw;
          flex: 1;
          align-items: center;
          position: relative;
          z-index: 2;
        }
        .user-name {
          font-size: 6.2cqw;
          font-weight: 900;
          color: #fff;
          margin-bottom: 2.5cqw;
          line-height: 1.1;
          text-transform: uppercase;
        }
        .card-position-badge {
          background: rgba(255, 255, 255, 0.15);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          padding: 1cqw 2.5cqw;
          border-radius: 50px;
          font-size: 2.5cqw;
          font-weight: 800;
          color: #fff;
          display: inline-flex;
          align-items: center;
          gap: 1cqw;
          margin-bottom: 2cqw;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .user-nik-pill {
          display: flex;
          align-items: center;
          gap: 2.5cqw;
          background: rgba(15, 23, 42, 0.4);
          padding: 2cqw 4cqw;
          border-radius: 100px;
          border: 1px solid rgba(255,255,255,0.1);
          margin-bottom: 3cqw;
          width: fit-content;
          backdrop-filter: blur(4px);
        }
        .user-nik {
          font-size: 3.8cqw;
          font-family: 'JetBrains Mono', monospace;
          color: #fff;
        }
        .user-address-text {
          font-size: 3.5cqw;
          color: #fff;
          display: flex;
          align-items: center;
          gap: 2cqw;
          font-weight: 700;
          opacity: 0.9;
        }
        .card-qr-area-new {
          background: #fff;
          padding: 2.5cqw;
          border-radius: 16px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2cqw;
          box-shadow: 0 15px 35px rgba(0,0,0,0.3);
          width: 28cqw;
        }
        .qr-wrapper {
          position: relative;
          width: 23cqw;
          height: 23cqw;
        }
        .card-qr-img-new {
          width: 100%;
          height: 100%;
        }
        .qr-center-logo {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 6cqw;
          height: 6cqw;
          background: #fff;
          border-radius: 4px;
          padding: 1px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .qr-label-new {
          font-size: 2.2cqw;
          font-weight: 900;
          color: #0f172a;
        }
        .card-footer-new {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-top: 4cqw;
          z-index: 2;
        }
        .verified-badge-pill {
          background: rgba(16, 185, 129, 0.1);
          color: #10b981;
          padding: 2cqw 4cqw;
          border-radius: 100px;
          font-size: 3.2cqw;
          font-weight: 800;
          display: flex;
          align-items: center;
          gap: 2cqw;
          border: 1.5px solid rgba(16, 185, 129, 0.3);
        }
        .official-id-group {
          display: flex;
          align-items: center;
          gap: 2cqw;
          color: #94a3b8;
          opacity: 0.6;
        }
        .official-id-text {
          font-size: 2.8cqw;
          font-weight: 800;
        }
          padding: 2px;
        }
        .card-meta-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          border-top: 1px solid rgba(255,255,255,0.15);
          padding-top: 12px;
          position: relative;
          z-index: 1;
        }
        .meta-label {
          display: block;
          font-size: 8px;
          font-weight: 700;
          opacity: 0.6;
          margin-bottom: 2px;
          text-transform: uppercase;
        }
        .meta-value {
          font-size: 11px;
          font-weight: 700;
          display: block;
        }

        /* High-End Container Queries for Ultra-Responsive Card Elements */
        @container (max-width: 360px) {
          .digital-id-card {
            padding: 4.5cqw !important;
          }
          .card-main-content {
            gap: 2.5cqw !important;
          }
          .user-name {
            font-size: 5.6cqw !important;
            margin-bottom: 2cqw !important;
          }
          .user-nik-pill {
            padding: 1.5cqw 3cqw !important;
            gap: 1.5cqw !important;
            margin-bottom: 2cqw !important;
          }
          .user-nik {
            font-size: 3.4cqw !important;
            letter-spacing: -0.2px !important;
          }
          .user-address-text {
            font-size: 3.2cqw !important;
            gap: 1.5cqw !important;
          }
          .card-qr-area-new {
            padding: 2cqw !important;
            border-radius: 12px !important;
            width: 26cqw !important;
          }
          .qr-wrapper {
            width: 22cqw !important;
            height: 22cqw !important;
          }
          .qr-label-new {
            font-size: 2cqw !important;
          }
          .card-footer-new {
            padding-top: 3cqw !important;
          }
          .verified-badge-pill {
            padding: 1.5cqw 3cqw !important;
            font-size: 2.8cqw !important;
            gap: 1.5cqw !important;
          }
          .official-id-text {
            font-size: 2.5cqw !important;
          }
        }

        @container (max-width: 310px) {
          .digital-id-card {
            padding: 4cqw !important;
          }
          .user-name {
            font-size: 5cqw !important;
          }
          .user-nik-pill {
            padding: 1cqw 2cqw !important;
            gap: 1cqw !important;
          }
          .user-nik {
            font-size: 3cqw !important;
            letter-spacing: -0.4px !important;
          }
          .user-address-text {
            font-size: 2.8cqw !important;
          }
          .card-qr-area-new {
            width: 24cqw !important;
          }
          .qr-wrapper {
            width: 20cqw !important;
            height: 20cqw !important;
          }
          .verified-badge-pill {
            padding: 1cqw 2cqw !important;
            font-size: 2.5cqw !important;
          }
          .official-id-text {
            font-size: 2.2cqw !important;
          }
        }

        /* Quick Actions (FLAT) */
        .quick-actions-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
        }
        .quick-action-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          background: none;
          border: none;
          padding: 8px 0;
          cursor: pointer;
          transition: transform 0.2s;
        }
        .action-icon-wrapper {
          width: 54px;
          height: 54px;
          border-radius: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          box-shadow: 0 4px 12px rgba(0,0,0,0.08);
        }
        .action-label {
          font-size: 11px;
          font-weight: 700;
          color: #475569;
        }

        /* Summary Grid (FLAT) */
        .summary-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }
        .summary-item {
          padding: 14px;
          border-radius: 18px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .summary-icon {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .summary-label {
          display: block;
          font-size: 10px;
          font-weight: 600;
          color: #64748b;
          margin-bottom: 1px;
        }
        .summary-value {
          font-size: 12px;
          font-weight: 800;
        }
        .status-blue { background: #eff6ff; }
        .icon-blue { background: #dbeafe; color: #2563eb; }
        .value-blue { color: #2563eb; }
        .status-purple { background: #f5f3ff; }
        .icon-purple { background: #ede9fe; color: #7c3aed; }
        .value-purple { color: #7c3aed; }
        .status-orange { background: #fff7ed; }
        .icon-orange { background: #ffedd5; color: #ea580c; }
        .value-orange { color: #ea580c; }

        /* Announcements (FLAT) */
        .info-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }
        .btn-text {
          font-size: 12px;
          color: #2563eb;
          font-weight: 700;
          background: none;
          border: none;
          cursor: pointer;
        }
        .announcements-carousel {
          display: flex;
          gap: 12px;
          overflow-x: auto;
          padding-bottom: 8px;
          scrollbar-width: none;
        }
        .announcements-carousel::-webkit-scrollbar { display: none; }
        .announcement-card {
          min-width: 210px;
          background: #fff;
          padding: 16px;
          border-radius: 18px;
          border: 1px solid #f1f5f9;
          box-shadow: 0 2px 4px rgba(0,0,0,0.02);
        }
        .ann-type {
          font-size: 9px;
          font-weight: 800;
          text-transform: uppercase;
          margin-bottom: 6px;
        }
        .ann-title {
          font-size: 13px;
          font-weight: 700;
          color: #0f172a;
          margin-bottom: 10px;
          line-height: 1.4;
        }
        .ann-meta {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          color: #94a3b8;
        }

        /* Security Banner (FLAT) */
        .security-banner-flat {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 4px 4px 4px 12px;
        }
        .security-info {
          display: flex;
          gap: 12px;
          align-items: center;
        }
        .security-icon-box {
          width: 44px;
          height: 44px;
          background: #fff;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 8px rgba(0,0,0,0.04);
        }
        .security-title {
          display: block;
          font-size: 14px;
          font-weight: 700;
          color: #0f172a;
        }
        .security-status {
          font-size: 11px;
          color: #64748b;
        }
        .btn-circle-action {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: #3b82f6;
          color: #fff;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 10px rgba(59, 130, 246, 0.3);
          cursor: pointer;
        }

        /* Bottom Nav */
        .bottom-nav {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          height: 72px;
          background: rgba(255, 255, 255, 0.9);
          backdrop-filter: blur(12px);
          display: flex;
          justify-content: space-around;
          align-items: center;
          border-top: 1px solid #e2e8f0;
          padding-bottom: env(safe-area-inset-bottom);
          z-index: 1000;
        }
        .nav-link {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          background: none;
          border: none;
          color: #94a3b8;
          padding: 8px;
          cursor: pointer;
          min-width: 60px;
          transition: color 0.2s;
        }
        .nav-link.active {
          color: #2563eb;
        }
        .nav-icon-wrapper {
          position: relative;
        }
        .nav-badge {
          position: absolute;
          top: -4px;
          right: -8px;
          background: #ef4444;
          color: #fff;
          font-size: 9px;
          font-weight: 800;
          padding: 1px 5px;
          border-radius: 10px;
          border: 2px solid #fff;
        }
        .nav-label {
          font-size: 10px;
          font-weight: 700;
        }

        /* Profile Tab Styles */
        .profile-tab-content {
          animation: fade-in 0.3s ease-out;
        }
        .profile-avatar-large {
          width: 90px;
          height: 90px;
          border-radius: 50%;
          background: #fff;
          border: 4px solid #fff;
          box-shadow: 0 10px 20px rgba(0,0,0,0.05);
          margin: 0 auto 16px;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #cbd5e1;
        }
        .profile-avatar-large img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .profile-name-text {
          font-size: 20px;
          font-weight: 800;
          color: #0f172a;
          margin-bottom: 4px;
        }
        .profile-nik-text {
          font-size: 13px;
          color: #64748b;
          margin-bottom: 12px;
        }
        .profile-tag {
          display: inline-block;
          background: #eff6ff;
          color: #2563eb;
          padding: 4px 12px;
          border-radius: 100px;
          font-size: 11px;
          font-weight: 800;
        }
        .profile-menu-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .profile-menu-item {
          display: flex;
          align-items: center;
          gap: 16px;
          background: #fff;
          padding: 12px 16px;
          border-radius: 18px;
          border: 1px solid #f1f5f9;
          cursor: pointer;
          transition: all 0.2s;
        }
        .profile-menu-item:active {
          transform: scale(0.98);
          background: #f8fafc;
        }
        .menu-item-icon {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
        }
        .bg-blue { background: #3b82f6; }
        .bg-purple { background: #8b5cf6; }
        .bg-orange { background: #f59e0b; }
        .bg-gray { background: #94a3b8; }
        .menu-item-label {
          flex: 1;
          text-align: left;
          font-size: 14px;
          font-weight: 700;
          color: #334155;
        }
        .menu-item-badge {
          background: #f1f5f9;
          color: #64748b;
          font-size: 11px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 6px;
        }
        .btn-logout-warga {
          width: 100%;
          height: 56px;
          background: #fef2f2;
          color: #ef4444;
          border: 1px solid #fee2e2;
          border-radius: 18px;
          font-size: 15px;
          font-weight: 800;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-logout-warga:active {
          background: #fee2e2;
          transform: scale(0.98);
        }

        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* Animations */
        @keyframes pulse-yellow {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.5); opacity: 0.5; }
          100% { transform: scale(1); opacity: 1; }
        }
        .pulse-yellow {
          animation: pulse-yellow 2s infinite;
        }

        @media (min-width: 768px) {
          .bottom-nav { display: none; }
          .resident-container { 
            max-width: 1300px; 
            padding: 40px 60px; 
          }
          .dashboard-header {
            margin-bottom: 40px;
            background: #fff;
            padding: 24px 32px;
            border-radius: 20px;
            border: 1px solid #e2e8f0;
            box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05);
          }
          .dashboard-content {
            display: grid;
            grid-template-columns: repeat(12, 1fr);
            gap: 24px;
            align-items: start;
          }
          /* Card-ify sections for Web */
          .section-card-id, .section-quick-actions, .section-summary, .section-announcements, .section-security {
            background: #fff;
            padding: 28px;
            border-radius: 20px;
            border: 1px solid #e2e8f0;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          }
          .section-card-id {
            grid-column: span 8;
            padding: 0;
            border: none;
            box-shadow: none;
          }
          .section-quick-actions {
            grid-column: span 4;
            height: 100%;
          }
          .quick-actions-grid {
            grid-template-columns: repeat(2, 1fr);
          }
          .section-summary {
            grid-column: span 8;
          }
          .summary-grid {
            grid-template-columns: repeat(4, 1fr);
          }
          .section-announcements {
            grid-column: span 4;
          }
          .announcements-carousel {
            flex-direction: column;
            overflow: visible;
            gap: 12px;
          }
          .announcement-card {
            min-width: 0;
            width: 100%;
          }
          .section-security {
            grid-column: span 12;
          }
          .profile-tab-content {
            display: grid;
            grid-template-columns: 350px 1fr;
            gap: 40px;
            align-items: start;
          }
          .profile-header-section, .profile-menu-section {
            background: #fff;
            padding: 40px;
            border-radius: 24px;
            border: 1px solid #f1f5f9;
            box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05);
          }
        }

        @media (max-width: 380px) {
          .resident-container { padding: 16px 16px 90px; }
          .summary-grid { gap: 8px; }
          .summary-item { padding: 10px 8px; }
        }
        /* FORUM WARGA STYLES */
        .forum-header {
          margin-bottom: 20px;
        }
        .forum-title-area {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        .forum-title {
          font-size: 22px;
          font-weight: 900;
          color: #1e3a8a;
        }
        .btn-create-post {
          background: #2563eb;
          color: #fff;
          border: none;
          padding: 10px 16px;
          border-radius: 12px;
          font-weight: 700;
          font-size: 14px;
          display: flex;
          align-items: center;
          gap: 8px;
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2);
        }
        .forum-search-container {
          position: relative;
          margin-bottom: 16px;
        }
        .forum-search-input {
          width: 100%;
          height: 44px;
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 0 16px 0 44px;
          font-size: 14px;
          outline: none;
          box-shadow: 0 2px 6px rgba(0,0,0,0.02);
        }
        .forum-search-icon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
        }
        .category-scroll {
          display: flex;
          gap: 10px;
          overflow-x: auto;
          padding: 4px 2px 12px;
          scrollbar-width: none;
        }
        .category-scroll::-webkit-scrollbar { display: none; }
        .category-chip {
          white-space: nowrap;
          padding: 8px 16px;
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 100px;
          font-size: 13px;
          font-weight: 600;
          color: #64748b;
          cursor: pointer;
          transition: all 0.2s;
        }
        .category-chip.active {
          background: #2563eb;
          color: #fff;
          border-color: #2563eb;
          box-shadow: 0 4px 10px rgba(37, 99, 235, 0.2);
        }
        
        /* POST CARD */
        .forum-post-card {
          background: #fff;
          border-radius: 20px;
          padding: 16px;
          margin-bottom: 16px;
          border: 1px solid #f1f5f9;
          box-shadow: 0 4px 15px rgba(0,0,0,0.03);
        }
        .post-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 12px;
        }
        .post-author-info {
          display: flex;
          gap: 12px;
        }
        .author-avatar {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          background: #eff6ff;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #3b82f6;
          font-weight: 700;
        }
        .author-name {
          font-size: 14px;
          font-weight: 700;
          color: #1e293b;
          margin-bottom: 2px;
        }
        .post-meta {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 11px;
          color: #94a3b8;
        }
        .role-badge {
          background: #f1f5f9;
          color: #64748b;
          padding: 2px 6px;
          border-radius: 4px;
          font-weight: 700;
          text-transform: uppercase;
        }
        .category-tag {
          font-size: 11px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 6px;
          text-transform: uppercase;
        }
        .post-content {
          margin-bottom: 16px;
        }
        .post-title {
          font-size: 16px;
          font-weight: 800;
          color: #1e293b;
          margin-bottom: 8px;
          line-height: 1.4;
        }
        .post-text {
          font-size: 14px;
          color: #475569;
          line-height: 1.6;
        }
        .post-image-container {
          margin-top: 12px;
          border-radius: 16px;
          overflow: hidden;
          border: 1px solid #f1f5f9;
        }
        .post-image {
          width: 100%;
          max-height: 300px;
          object-fit: cover;
        }
        .post-actions {
          display: flex;
          justify-content: space-between;
          border-top: 1px solid #f8fafc;
          padding-top: 12px;
        }
        .action-btn {
          background: none;
          border: none;
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          font-weight: 600;
          color: #64748b;
          cursor: pointer;
          transition: all 0.2s;
          padding: 6px 8px;
          border-radius: 8px;
        }
        .action-btn:hover { background: #f8fafc; color: #1e293b; }
        .action-btn.liked { color: #ef4444; }
        
        /* TRENDING CAROUSEL */
        .trending-section {
          margin-bottom: 24px;
        }
        .trending-list {
          display: flex;
          gap: 12px;
          overflow-x: auto;
          padding: 4px 2px 10px;
          scrollbar-width: none;
        }
        .trending-list::-webkit-scrollbar { display: none; }
        .trending-card {
          min-width: 200px;
          max-width: 200px;
          background: linear-gradient(135deg, #2563eb, #1d4ed8);
          border-radius: 18px;
          padding: 14px;
          color: #fff;
          position: relative;
          overflow: hidden;
        }
        .trending-card::after {
          content: '';
          position: absolute;
          top: -20px;
          right: -20px;
          width: 80px;
          height: 80px;
          background: rgba(255,255,255,0.1);
          border-radius: 50%;
        }
        .trending-label {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          opacity: 0.8;
          margin-bottom: 8px;
        }
        .trending-title {
          font-size: 13px;
          font-weight: 700;
          line-height: 1.4;
          margin-bottom: 12px;
        }
        .trending-stats {
          font-size: 10px;
          font-weight: 600;
          opacity: 0.7;
        }
      `}</style>
    </div>
  );
}
