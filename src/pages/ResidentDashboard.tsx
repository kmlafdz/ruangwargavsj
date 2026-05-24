import React, { useState, useEffect, useRef } from 'react';
import {
  Home, User as UserIcon, Users, FileText,
  Wallet, MessageSquare, Megaphone, Bell,
  HelpCircle, LogOut, Search, CreditCard,
  FileCheck, AlertCircle, Clock, ChevronRight,
  MapPin, Calendar, Smartphone, Info, Settings, Compass,
  MessageCircle, ThumbsUp, Share2, Bookmark, MoreHorizontal,
  Send, Sparkles, Image as ImageIcon, PlusCircle, Filter, TrendingUp,
  Plus, ArrowRight, ShieldCheck, Eye, EyeOff, CheckCircle,
  Lock as LockIcon, Fingerprint, XCircle, Loader2, Wifi
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Kegiatan, FypLink } from '../types';
import { db } from '../firebase/config';
import { doc, updateDoc, onSnapshot, collection, query, where, addDoc, serverTimestamp } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { Geolocation } from '@capacitor/geolocation';
import { showAlert } from '../utils/alert';
import logo from '../assets/login/logo.png';
import { getEmbedUrl } from '../utils/url';
import { SocialBadge } from '../components/SocialBadge';
import PinVerificationModal from '../components/PinVerificationModal';

const getPlatformDetails = (platform: string) => {
  switch (platform) {
    case 'instagram':
      return {
        name: 'Instagram',
        color: '#d62976',
        bgColor: '#fdf2f8',
        borderColor: '#fbcfe8',
        icon: '📸'
      };
    case 'youtube':
      return {
        name: 'YouTube',
        color: '#ef4444',
        bgColor: '#fef2f2',
        borderColor: '#fca5a5',
        icon: '📺'
      };
    case 'facebook':
      return {
        name: 'Facebook',
        color: '#1877f2',
        bgColor: '#eff6ff',
        borderColor: '#bfdbfe',
        icon: '👥'
      };
    case 'x':
      return {
        name: 'X (Twitter)',
        color: '#0f172a',
        bgColor: '#f8fafc',
        borderColor: '#cbd5e1',
        icon: '𝕏'
      };
    case 'threads':
      return {
        name: 'Threads',
        color: '#000000',
        bgColor: '#f8fafc',
        borderColor: '#cbd5e1',
        icon: '🧵'
      };
    case 'article':
      return {
        name: 'Artikel',
        color: '#10b981',
        bgColor: '#ecfdf5',
        borderColor: '#a7f3d0',
        icon: '📰'
      };
    default:
      return {
        name: 'Tautan',
        color: '#6366f1',
        bgColor: '#eef2ff',
        borderColor: '#c7d2fe',
        icon: '🔗'
      };
  }
};

interface WeatherState {
  temp: number | null;
  conditionCode: number | null;
  city: string;
  loading: boolean;
}

const getWeatherDetails = (code: number | null) => {
  if (code === null) return { label: 'Berawan', icon: '⛅', color: '#60a5fa' };
  if (code === 0) return { label: 'Cerah', icon: '☀️', color: '#f59e0b' };
  if ([1, 2, 3].includes(code)) return { label: 'Berawan', icon: '⛅', color: '#60a5fa' };
  if ([45, 48].includes(code)) return { label: 'Kabut', icon: '🌫️', color: '#94a3b8' };
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return { label: 'Hujan', icon: '🌧️', color: '#3b82f6' };
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { label: 'Salju', icon: '❄️', color: '#93c5fd' };
  if ([95, 96, 99].includes(code)) return { label: 'Petir', icon: '⛈️', color: '#8b5cf6' };
  return { label: 'Berawan', icon: '⛅', color: '#60a5fa' };
};

interface ResidentDashboardProps {
  user: User | null;
  onToggleViraAI?: () => void;
}

export default function ResidentDashboard({ user: initialUser, onToggleViraAI }: ResidentDashboardProps) {
  const [user, setUser] = useState<User | null>(initialUser);
  const [isLocked, setIsLocked] = useState(false);
  const [showNik, setShowNik] = useState(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [activePreviewUrl, setActivePreviewUrl] = useState<string | null>(null);
  const [activePreviewTitle, setActivePreviewTitle] = useState<string>('');

  const [weather, setWeather] = useState<WeatherState>({
    temp: null,
    conditionCode: null,
    city: 'Jakarta',
    loading: true
  });
  const [weatherRefreshCount, setWeatherRefreshCount] = useState(0);

  const handleRefreshWeather = (e: React.MouseEvent) => {
    e.stopPropagation();
    setWeather(prev => ({ ...prev, loading: true }));
    setWeatherRefreshCount(prev => prev + 1);
  };

  // 3D Card Flip & Parallax state
  const [isFlipped, setIsFlipped] = useState(false);
  const [isHolding, setIsHolding] = useState(false);
  const [showFullQr, setShowFullQr] = useState(false);
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);
  const [shineStyle, setShineStyle] = useState<React.CSSProperties>({});

  // Prevent scroll when holding the card to rotate
  useEffect(() => {
    if (isHolding) {
      document.body.style.overflow = 'hidden';
      const preventDefault = (e: TouchEvent) => {
        e.preventDefault();
      };
      document.addEventListener('touchmove', preventDefault, { passive: false });
      return () => {
        document.body.style.overflow = '';
        document.removeEventListener('touchmove', preventDefault);
      };
    }
  }, [isHolding]);

  const handleCardMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (
      target.closest('.btn-toggle-nik-glass') ||
      target.closest('svg') ||
      target.closest('button') ||
      target.closest('.card-qr-area-new')
    ) {
      return;
    }
    setIsHolding(true);
  };

  const handleCardMouseUp = () => {
    setIsHolding(false);
    setRotateX(0);
    setRotateY(0);
    setShineStyle({});
  };

  const handleCardMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isHolding) return;
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    // Calculate rotation (-12 to 12 degrees)
    const newRotateX = ((centerY - y) / centerY) * 12;
    const newRotateY = ((x - centerX) / centerX) * 12;

    setRotateX(newRotateX);
    setRotateY(newRotateY);

    // Spotlight reflection following the cursor
    const shineX = (x / rect.width) * 100;
    const shineY = (y / rect.height) * 100;
    setShineStyle({
      background: `radial-gradient(circle at ${shineX}% ${shineY}%, rgba(255, 255, 255, 0.15) 0%, transparent 60%)`,
    });
  };

  const handleCardMouseLeave = () => {
    setIsHolding(false);
    setRotateX(0);
    setRotateY(0);
    setShineStyle({});
  };

  const handleCardTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (
      target.closest('.btn-toggle-nik-glass') ||
      target.closest('svg') ||
      target.closest('button') ||
      target.closest('.card-qr-area-new')
    ) {
      return;
    }
    setIsHolding(true);
  };

  const handleCardTouchEnd = () => {
    setIsHolding(false);
    setRotateX(0);
    setRotateY(0);
    setShineStyle({});
  };

  const handleCardTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isHolding) return;
    const touch = e.touches[0];
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const newRotateX = ((centerY - y) / centerY) * 12;
    const newRotateY = ((x - centerX) / centerX) * 12;

    setRotateX(newRotateX);
    setRotateY(newRotateY);
  };
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
  const [kegiatans, setKegiatans] = useState<Kegiatan[]>([]);
  const [showAllKegiatanModal, setShowAllKegiatanModal] = useState(false);
  const [fypLinks, setFypLinks] = useState<FypLink[]>([]);

  const [headerVisible, setHeaderVisible] = useState(true);
  const lastScrollYRef = useRef(0);

  useEffect(() => {
    let active = true;

    const fetchWeather = async (lat: number, lon: number, defaultCityName: string) => {
      try {
        const weatherRes = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code`
        );
        if (!weatherRes.ok) throw new Error('Failed to fetch weather');
        const weatherData = await weatherRes.json();

        const currentTemp = weatherData.current?.temperature_2m;
        const currentCode = weatherData.current?.weather_code;

        let resolvedCity = defaultCityName;
        try {
          const geoRes = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
            {
              headers: {
                'Accept-Language': 'id-ID,id;q=0.9',
              }
            }
          );
          if (geoRes.ok) {
            const geoData = await geoRes.json();
            const addr = geoData.address || {};
            resolvedCity = addr.suburb || addr.village || addr.town || addr.city_district || addr.city || addr.municipality || addr.county || defaultCityName;
            resolvedCity = resolvedCity.replace(/Kelurahan\s+/i, '').replace(/Kecamatan\s+/i, '').replace(/Kota\s+/i, '');
          }
        } catch (geoErr) {
          console.warn('Reverse geocoding failed:', geoErr);
        }

        if (active) {
          setWeather({
            temp: currentTemp !== undefined ? Math.round(currentTemp) : null,
            conditionCode: currentCode !== undefined ? currentCode : null,
            city: resolvedCity,
            loading: false
          });
        }
      } catch (err) {
        console.error('Error fetching weather:', err);
        if (active) {
          setWeather(prev => ({ ...prev, loading: false }));
        }
      }
    };

    const fetchLocationByIP = async () => {
      try {
        const ipRes = await fetch('https://freeipapi.com/api/json');
        if (ipRes.ok) {
          const ipData = await ipRes.json();
          if (ipData.latitude && ipData.longitude) {
            const city = ipData.cityName || 'Jakarta';
            fetchWeather(ipData.latitude, ipData.longitude, city);
            return;
          }
        }
      } catch (ipErr) {
        console.warn('IP Geolocation failed:', ipErr);
      }
      if (active) {
        setWeather({ temp: null, conditionCode: null, city: '-', loading: false });
      }
    };

    const fetchLocationWithCapacitor = async () => {
      try {
        const hasPermission = await Geolocation.checkPermissions();
        if (hasPermission.location !== 'granted') {
          const request = await Geolocation.requestPermissions();
          if (request.location !== 'granted') {
            throw new Error('Permission denied');
          }
        }
        const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 6000 });
        const { latitude, longitude } = position.coords;
        fetchWeather(latitude, longitude, 'Lokasi Anda');
      } catch (error) {
        console.warn('Geolocation failed or denied. Trying IP location.', error);
        fetchLocationByIP();
      }
    };

    if (Capacitor.isNativePlatform()) {
      fetchLocationWithCapacitor();
    } else {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            fetchWeather(latitude, longitude, 'Lokasi Anda');
          },
          (error) => {
            console.warn('Geolocation error. Trying IP location.', error);
            fetchLocationByIP();
          },
          { enableHighAccuracy: false, timeout: 6000 }
        );
      } else {
        fetchLocationByIP();
      }
    }

    return () => {
      active = false;
    };
  }, [weatherRefreshCount]);

  useEffect(() => {
    const handleScroll = (e: any) => {
      const target = e.target;
      if (!target) return;

      // Only respond to scroll events on the main document or viewport!
      if (target !== document && target !== window && target !== document.documentElement && target !== document.body) {
        return;
      }

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

  // Sync Kegiatan in real-time
  useEffect(() => {
    const q = query(collection(db, 'kegiatan'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: Kegiatan[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        items.push({
          id: doc.id,
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
    });
    return unsubscribe;
  }, []);

  // Sync FYP links in real-time
  useEffect(() => {
    const q = query(collection(db, 'fyp_links'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: FypLink[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        items.push({
          id: docSnap.id,
          url: data.url || '',
          title: data.title || '',
          description: data.description || '',
          imageUrl: data.imageUrl || '',
          platform: data.platform || 'other',
          createdAt: data.createdAt
        });
      });

      // Sort by createdAt desc
      items.sort((a, b) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeB - timeA;
      });

      setFypLinks(items);
    });
    return unsubscribe;
  }, []);

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

  const getGoogleCalendarUrl = (kegiatan: { title: string; description: string; date: string; time: string; location: string }) => {
    const title = encodeURIComponent(kegiatan.title);
    const details = encodeURIComponent(kegiatan.description);
    const location = encodeURIComponent(kegiatan.location);

    const dateStr = kegiatan.date.replace(/-/g, '');
    const timeStr = kegiatan.time.replace(/:/g, '') + '00';
    const startDateTime = `${dateStr}T${timeStr}`;

    let endHour = parseInt(kegiatan.time.split(':')[0]) + 1;
    if (endHour >= 24) endHour = 23;
    const endHourStr = endHour.toString().padStart(2, '0');
    const endMinStr = kegiatan.time.split(':')[1];
    const endDateTime = `${dateStr}T${endHourStr}${endMinStr}00`;

    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startDateTime}/${endDateTime}&details=${details}&location=${location}`;
  };

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
      showAlert('Berhasil', "Pengajuan surat berhasil dikirim!", 'success');
    } catch (e) {
      console.error("Error submitting letter:", e);
      showAlert('Gagal', "Terjadi kesalahan saat mengirim pengajuan.", 'error');
    } finally {
      setIsSubmittingLetter(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('erw_user');
    window.location.href = '/warga-login';
  };

  const handleToggleNik = () => {
    if (!showNik) {
      if (user?.pin) {
        setIsPinModalOpen(true);
      } else {
        setShowNik(true);
      }
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

    const noKK = user?.noKK || (user as any)?.extractedData?.nomorKK;

    // 1. Iuran Status
    let iuranUnsub = () => { };
    if (noKK) {
      const iuranQuery = query(collection(db, 'family_bills'), where('nomorKK', '==', noKK));
      iuranUnsub = onSnapshot(iuranQuery, (snap) => {
        const bills = snap.docs.map(d => d.data());
        const unpaidBills = bills.filter(b => b.status !== 'LUNAS');
        const hasUnpaid = unpaidBills.length > 0;
        setStats(prev => ({
          ...prev,
          iuranStatus: hasUnpaid ? 'BELUM BAYAR' : 'LUNAS',
          iuranBelumBayar: unpaidBills.length
        }));
      });
    } else {
      setStats(prev => ({
        ...prev,
        iuranStatus: 'LUNAS',
        iuranBelumBayar: 0
      }));
    }

    // 2. Surat Requests
    const suratQuery = query(collection(db, 'surat_requests'), where('wargaId', '==', user.id));
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
  }, [user?.id, user?.accountType, user?.noKK, (user as any)?.extractedData?.nomorKK]);



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
          {/* DIGITAL ID CARD - 3D ROTATING INTERACTIVE CARD */}
          <section className="section-card-id" style={{ marginBottom: '20px' }}>
            <div
              className="card-container-3d"
              onMouseDown={handleCardMouseDown}
              onMouseUp={handleCardMouseUp}
              onMouseMove={handleCardMouseMove}
              onMouseLeave={handleCardMouseLeave}
              onTouchStart={handleCardTouchStart}
              onTouchEnd={handleCardTouchEnd}
              onTouchMove={handleCardTouchMove}
            >
              <motion.div
                className="card-inner-3d"
                onClick={(e) => {
                  const target = e.target as HTMLElement;
                  // Prevent flipping if clicked on buttons, toggles, or QR area
                  if (
                    target.closest('.btn-toggle-nik-glass') ||
                    target.closest('svg') ||
                    target.closest('button') ||
                    target.closest('.card-qr-area-new')
                  ) {
                    return;
                  }
                  setIsFlipped(!isFlipped);
                }}
                animate={{
                  rotateX: rotateX,
                  rotateY: (isFlipped ? 180 : 0) + (isFlipped ? -rotateY : rotateY)
                }}
                transition={{ type: 'spring', stiffness: 180, damping: 20 }}
                style={{ transformStyle: 'preserve-3d', position: 'relative', width: '100%', height: '100%' }}
              >
                {/* FRONT SIDE */}
                <div className="card-face card-face-front digital-id-card" style={{ zIndex: isFlipped ? 1 : 2 }}>
                  <div className="card-shine-overlay" style={shineStyle} />
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
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleNik();
                          }}
                          className="btn-toggle-nik-glass"
                        >
                          {showNik ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      <div className="user-address-text">
                        <MapPin size={14} color="#3b82f6" fill="#3b82f6" fillOpacity={0.2} />
                        {`BLOK ${(user as any).blok || 'G/8'}, RT ${user?.rt_id || '002'}/11`}
                      </div>
                    </div>

                    <div className="card-right">
                      <div
                        className="card-qr-area-new"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowFullQr(true);
                        }}
                        style={{ cursor: 'zoom-in' }}
                      >
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
                </div>

                {/* BACK SIDE */}
                <div className="card-face card-face-back digital-id-card-back" style={{ zIndex: isFlipped ? 2 : 1 }}>
                  {/* Shine overlay to keep the interactive glossy reflect effect */}
                  <div className="card-shine-overlay" style={shineStyle} />
                </div>
              </motion.div>
            </div>
          </section>
          {(!user?.email || !user?.pinSet || !user?.pin) && (
            <motion.div
              className="keamanan-warning-card"
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
                { label: 'Administrasi', icon: FileText, color: '#8b5cf6', route: '/warga/surat' },
                { label: 'RuangPay', icon: Wallet, color: '#3b82f6', route: '/warga/keuangan' },
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

          {/* SUMMARY STATS SECTION - Replaced with Kegiatan Mendatang */}
          <section className="section-summary" style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 className="section-title" style={{ margin: 0 }}>Kegiatan Mendatang</h3>
              {kegiatans.filter(k => !isEventArchived(k.date)).length > 0 && (
                <button
                  onClick={() => setShowAllKegiatanModal(true)}
                  style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: 12, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  Lihat Selengkapnya <ChevronRight size={14} />
                </button>
              )}
            </div>

            {kegiatans.filter(k => !isEventArchived(k.date)).length === 0 ? (
              <div style={{ background: '#fff', borderRadius: 20, padding: 24, textAlign: 'center', border: '1px solid #e2e8f0', color: '#64748b' }}>
                <Calendar size={32} style={{ margin: '0 auto 12px', opacity: 0.5, color: '#64748b' }} />
                <div style={{ fontSize: 13, fontWeight: 800, color: '#1e293b' }}>Belum Ada Kegiatan</div>
                <div style={{ fontSize: 11, marginTop: 4 }}>Seluruh kegiatan mendatang akan tampil di sini.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 12, scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch', scrollSnapType: 'x mandatory' }} className="kegiatan-scroll-container">
                {kegiatans
                  .filter(k => !isEventArchived(k.date))
                  .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                  .slice(0, 5) // Show top 5 preview
                  .map((item) => (
                    <div
                      key={item.id}
                      style={{
                        flex: '0 0 280px',
                        scrollSnapAlign: 'start',
                        background: '#fff',
                        borderRadius: 20,
                        border: '1px solid #e2e8f0',
                        padding: 16,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: 12,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
                        textAlign: 'left'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 800, color: '#2563eb', background: '#eff6ff', padding: '4px 8px', borderRadius: 6 }}>
                            <Calendar size={11} /> {new Date(item.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                          </span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 800, color: '#64748b' }}>
                            <Clock size={11} /> {item.time}
                          </span>
                        </div>
                        <h4 style={{ fontSize: 13, fontWeight: 900, color: '#1e293b', margin: '0 0 6px', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.3 }}>
                          {item.title}
                        </h4>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#64748b', fontSize: 10, fontWeight: 600, marginBottom: 8 }}>
                          <MapPin size={11} style={{ color: '#ef4444' }} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.location}</span>
                        </div>
                        <p style={{ fontSize: 11, color: '#64748b', margin: 0, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                          {item.description}
                        </p>
                      </div>

                      <a
                        href={getGoogleCalendarUrl(item)}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          background: '#f1f5f9',
                          color: '#1e293b',
                          border: 'none',
                          borderRadius: 12,
                          height: 36,
                          fontSize: 11,
                          fontWeight: 800,
                          cursor: 'pointer',
                          textDecoration: 'none',
                          transition: 'background 0.2s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = '#e2e8f0'}
                        onMouseLeave={e => e.currentTarget.style.background = '#f1f5f9'}
                      >
                        <Calendar size={13} style={{ color: '#2563eb' }} /> Ingatkan Saya
                      </a>
                    </div>
                  ))}
              </div>
            )}
          </section>

          {/* UNTUK KAMU (FYP) SECTION - No Container */}
          <section className="section-announcements" style={{ marginBottom: 24 }}>
            <div className="info-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 className="section-title" style={{ margin: 0 }}>Untuk Kamu</h3>
            </div>

            {fypLinks.length === 0 ? (
              <div style={{ background: '#fff', borderRadius: 20, padding: 24, textAlign: 'center', border: '1px solid #e2e8f0', color: '#64748b' }}>
                <Compass size={32} style={{ margin: '0 auto 12px', opacity: 0.5, color: '#64748b' }} />
                <div style={{ fontSize: 13, fontWeight: 800, color: '#1e293b' }}>Belum Ada Konten</div>
                <div style={{ fontSize: 11, marginTop: 4 }}>Konten menarik pilihan admin akan tampil di sini.</div>
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  gap: 16,
                  overflowX: 'auto',
                  paddingBottom: 12,
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
                  WebkitOverflowScrolling: 'touch',
                  scrollSnapType: 'x mandatory'
                }}
                className="kegiatan-scroll-container"
              >
                {fypLinks.map((item) => {
                  const platformDetails = getPlatformDetails(item.platform);
                  return (
                    <motion.div
                      key={item.id}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        setActivePreviewUrl(item.url);
                        setActivePreviewTitle(item.title);
                      }}
                      style={{
                        flex: '0 0 260px',
                        scrollSnapAlign: 'start',
                        background: '#fff',
                        borderRadius: 20,
                        border: '1px solid #e2e8f0',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
                        textAlign: 'left',
                        cursor: 'pointer'
                      }}
                    >
                      {/* Cover Image or Gradient */}
                      {item.imageUrl ? (
                        <div style={{ width: '100%', height: 130, background: '#f1f5f9', position: 'relative', overflow: 'hidden' }}>
                          <img src={item.imageUrl} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <span style={{
                            position: 'absolute',
                            top: 10,
                            left: 10,
                            padding: '4px 8px',
                            borderRadius: 8,
                            fontSize: 9,
                            fontWeight: 800,
                            background: platformDetails.bgColor,
                            color: platformDetails.color,
                            border: `1px solid ${platformDetails.borderColor}`,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4
                          }}>
                            <span>{platformDetails.icon}</span>
                            <span>{platformDetails.name}</span>
                          </span>
                        </div>
                      ) : (
                        <div style={{
                          width: '100%',
                          height: 110,
                          background: `linear-gradient(135deg, ${platformDetails.bgColor} 0%, #ffffff 100%)`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          position: 'relative',
                          borderBottom: '1px solid #f1f5f9'
                        }}>
                          <span style={{ fontSize: 32 }}>{platformDetails.icon}</span>
                          <span style={{
                            position: 'absolute',
                            top: 10,
                            left: 10,
                            padding: '4px 8px',
                            borderRadius: 8,
                            fontSize: 9,
                            fontWeight: 800,
                            background: platformDetails.bgColor,
                            color: platformDetails.color,
                            border: `1px solid ${platformDetails.borderColor}`
                          }}>
                            {platformDetails.name}
                          </span>
                        </div>
                      )}

                      {/* Card Content */}
                      <div style={{ padding: 14, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 6 }}>
                        <div>
                          <h4 style={{
                            fontSize: 12.5,
                            fontWeight: 900,
                            color: '#1e293b',
                            margin: 0,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            lineHeight: 1.3
                          }}>
                            {item.title}
                          </h4>
                          <p style={{
                            fontSize: 10.5,
                            color: '#64748b',
                            margin: '4px 0 0',
                            lineHeight: 1.4,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical'
                          }}>
                            {item.description}
                          </p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, fontWeight: 700, color: '#94a3b8' }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.url.replace('https://', '').replace('http://', '').split('/')[0]}
                          </span>
                          <span>•</span>
                          <span>Buka Preview ↗️</span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </section>


          {/* INSIGHT DARI VIRA AI - PREMIUM WIDGET */}
          <section className="section-vira-insight" style={{ marginBottom: '24px' }}>
            <h3 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              Insight dari Vira AI <Sparkles size={16} color="#fbbf24" className="pulse-yellow" />
            </h3>
            <div style={{
              background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
              border: '1px solid #bfdbfe',
              borderRadius: '24px',
              padding: '20px',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: '0 10px 15px -3px rgba(59, 130, 246, 0.05)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              {/* Background avatar watermark */}
              <div style={{
                position: 'absolute',
                right: '-10px',
                bottom: '-15px',
                width: '100px',
                height: '100px',
                opacity: 0.12,
                backgroundImage: 'url(/vira_ai_avatar.png)',
                backgroundSize: 'cover',
                borderRadius: '24px',
                transform: 'rotate(-10deg)'
              }} />

              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '14px',
                  border: '2px solid #3b82f6',
                  overflow: 'hidden',
                  background: '#fff',
                  flexShrink: 0,
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
                }}>
                  <img src="/vira_ai_avatar.png" alt="Vira AI" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '13.5px', fontWeight: 900, color: '#1e3a8a' }}>Vira AI Community Companion</h4>
                  <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#3b82f6', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Saran & Pengingat Pintar
                  </p>
                </div>
              </div>

              <div style={{ margin: 0, fontSize: '12px', color: '#1e293b', lineHeight: 1.6, position: 'relative', zIndex: 1 }}>
                {stats.iuranStatus === 'BELUM BAYAR' ? (
                  <span>⚠️ Halo <strong>{user?.name?.split(' ')[0] || 'Warga'}-San</strong>, Vira melihat ada <strong>tagihan iuran bulan ini yang belum terbayar</strong>. Segera selesaikan pembayaran di menu RuangPay agar operasional warga RT {user?.rt_id} tetap prima ya!</span>
                ) : stats.suratActive > 0 ? (
                  <span>📄 Halo <strong>{user?.name?.split(' ')[0] || 'Warga'}-San</strong>, ada <strong>{stats.suratActive} pengajuan surat</strong> yang sedang diverifikasi Ketua RT/RW. Pantau terus statusnya ya!</span>
                ) : (
                  <span>✨ Halo <strong>{user?.name?.split(' ')[0] || 'Warga'}-San</strong>! Vira melaporkan seluruh iuran bulan ini sudah Lunas, dan lingkungan RT {user?.rt_id || '011'} terpantau aman & harmonis. Tetap jaga kebersihan lingkungan ya!</span>
                )}
              </div>

              <button
                onClick={() => onToggleViraAI ? onToggleViraAI() : navigate('/warga/ai')}
                style={{
                  height: '38px',
                  borderRadius: '12px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
                  color: '#ffffff',
                  fontSize: '11.5px',
                  fontWeight: 900,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2)',
                  width: 'fit-content',
                  padding: '0 16px',
                  position: 'relative',
                  zIndex: 1
                }}
              >
                <Sparkles size={13} /> Diskusi dengan Vira AI <ArrowRight size={13} />
              </button>
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
                style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)', zIndex: 20000, display: 'flex', alignItems: 'flex-end' }}
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
            style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(8px)', zIndex: 20000, display: 'flex', alignItems: 'flex-end' }}
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



      <div className="resident-container">
        <header className="dashboard-header">
          <div className="header-greeting">
            <h1 className="greeting-title">
              {activeTab === 'dashboard' ? `Halo, ${user?.name?.split(' ')[0] || 'Warga'}` : 'Profil Saya'}
            </h1>
            <p className="greeting-date">
              {activeTab === 'dashboard'
                ? new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })
                : 'Kelola informasi akun Anda'
              }
            </p>
          </div>

          <div className="header-actions">
            {activeTab === 'dashboard' && (
              weather.loading ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'rgba(255, 255, 255, 0.75)',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid #e2e8f0',
                    borderRadius: '16px',
                    padding: '6px 12px',
                    boxShadow: '0 4px 10px rgba(0,0,0,0.03)',
                    height: '42px',
                    justifyContent: 'center'
                  }}
                >
                  <Loader2 size={13} className="animate-spin" style={{ color: '#3b82f6' }} />
                  <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 700 }}>Cuaca...</span>
                </div>
              ) : (
                (() => {
                  const details = getWeatherDetails(weather.conditionCode);
                  return (
                    <motion.div
                      onClick={handleRefreshWeather}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        background: 'rgba(255, 255, 255, 0.8)',
                        backdropFilter: 'blur(8px)',
                        border: '1px solid #e2e8f0',
                        borderRadius: '16px',
                        padding: '6px 12px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.04)',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        maxWidth: '160px'
                      }}
                    >
                      <span style={{ fontSize: '22px' }}>{details.icon}</span>
                      <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left', minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 900, color: '#1f2937' }}>
                            {weather.temp !== null ? `${weather.temp}°` : '--'}
                          </span>
                          <span style={{
                            fontSize: '8.5px',
                            fontWeight: 800,
                            color: details.color,
                            background: `${details.color}15`,
                            padding: '1px 5px',
                            borderRadius: '4px',
                            whiteSpace: 'nowrap'
                          }}>
                            {details.label}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '2px', color: '#6b7280', fontSize: '9px', fontWeight: 700, marginTop: '2px' }}>
                          <MapPin size={9} style={{ color: '#ef4444', flexShrink: 0 }} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80px' }}>
                            {weather.city}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })()
              )
            )}
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

      {/* FULL SCREEN QR CODE OVERLAY */}
      <AnimatePresence>
        {showFullQr && (
          <div
            onClick={() => setShowFullQr(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(15, 23, 42, 0.85)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              zIndex: 99999,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px'
            }}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: '#ffffff',
                borderRadius: '24px',
                padding: '28px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '20px',
                maxWidth: '90vw',
                width: '320px'
              }}
            >
              <div style={{ position: 'relative', width: '240px', height: '240px' }}>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${user?.nik || 'RESIDENT'}&bgcolor=ffffff&color=0f172a`}
                  alt="Enlarged QR Code"
                  style={{ width: '100%', height: '100%', borderRadius: '12px' }}
                />
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '48px',
                  height: '48px',
                  background: '#ffffff',
                  borderRadius: '12px',
                  padding: '4px',
                  boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <img src={logo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '16px', fontWeight: 900, color: '#0f172a' }}>
                  QR Code Warga
                </div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#475569', marginTop: '4px' }}>
                  {user?.name}
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px', fontFamily: 'monospace' }}>
                  NIK: {showNik ? user?.nik : `•••• •••• •••• ${user?.nik?.slice(-4) || '0000'}`}
                </div>
              </div>
              <button
                onClick={() => setShowFullQr(false)}
                style={{
                  width: '100%',
                  height: '46px',
                  borderRadius: '14px',
                  background: '#ef4444',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 800,
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: '0 4px 12px rgba(239, 68, 68, 0.2)'
                }}
              >
                Tutup
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ALL EVENTS MODAL SHEET */}
      <AnimatePresence>
        {showAllKegiatanModal && (
          <>
            <div className="sheet-overlay" style={{ zIndex: 11000 }} onClick={() => setShowAllKegiatanModal(false)} />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
              className="modal-sheet"
              style={{ zIndex: 11001 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h3 style={{ fontSize: 18, fontWeight: 900, color: '#1e3a8a', margin: 0 }}>Semua Kegiatan Warga</h3>
                <button onClick={() => setShowAllKegiatanModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 18, cursor: 'pointer' }}>✕</button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '70vh', overflowY: 'auto', paddingRight: 4 }}>
                {kegiatans
                  .filter(k => !isEventArchived(k.date))
                  .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                  .map((item) => (
                    <div
                      key={item.id}
                      style={{
                        background: '#f8fafc',
                        borderRadius: 16,
                        border: '1px solid #e2e8f0',
                        padding: 16,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 10,
                        textAlign: 'left'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: '#2563eb', background: '#eff6ff', padding: '4px 8px', borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Calendar size={12} /> {new Date(item.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 800, color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Clock size={12} /> Pukul {item.time} WIB
                        </span>
                      </div>

                      <h4 style={{ fontSize: 14, fontWeight: 900, color: '#1e293b', margin: 0 }}>{item.title}</h4>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#475569', fontSize: 11, fontWeight: 600 }}>
                        <MapPin size={12} style={{ color: '#ef4444' }} />
                        <span>{item.location}</span>
                      </div>

                      <p style={{ fontSize: 12, color: '#64748b', margin: 0, lineHeight: 1.5, whiteSpace: 'pre-line' }}>
                        {item.description}
                      </p>

                      <a
                        href={getGoogleCalendarUrl(item)}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          background: '#2563eb',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: 12,
                          height: 40,
                          fontSize: 12,
                          fontWeight: 800,
                          cursor: 'pointer',
                          textDecoration: 'none',
                          marginTop: 4,
                          boxShadow: '0 2px 8px rgba(37,99,235,0.15)',
                          transition: 'background 0.2s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = '#1e40af'}
                        onMouseLeave={e => e.currentTarget.style.background = '#2563eb'}
                      >
                        <Calendar size={14} /> Tambahkan ke Google Kalender
                      </a>
                    </div>
                  ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* WEB IN-APP BROWSER PREVIEW MODAL */}
      <AnimatePresence>
        {activePreviewUrl && (
          <>
            <div 
              className="sheet-overlay" 
              style={{ zIndex: 12000, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(12px)' }} 
              onClick={() => {
                setActivePreviewUrl(null);
                setActivePreviewTitle('');
              }} 
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              style={{
                position: 'fixed',
                left: 0,
                right: 0,
                bottom: 0,
                background: '#ffffff',
                borderRadius: '32px 32px 0 0',
                height: '92vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 -20px 50px rgba(15,23,42,0.3)',
                zIndex: 12001,
                overflow: 'hidden',
                fontFamily: "'Outfit', sans-serif"
              }}
            >
              {/* Modal Header */}
              <div style={{ 
                padding: '16px 20px', 
                borderBottom: '1px solid #f1f5f9', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                background: '#fff'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, maxWidth: '70%', textAlign: 'left' }}>
                  <span style={{ fontSize: 18 }}>📱</span>
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{ fontSize: '13px', fontWeight: 900, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {activePreviewTitle || 'Preview Konten'}
                    </div>
                    <div style={{ fontSize: '10.5px', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {activePreviewUrl}
                    </div>
                  </div>
                </div>
                
                {/* Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button
                    onClick={() => window.open(activePreviewUrl, '_blank')}
                    title="Buka di tab baru"
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 10,
                      border: '1.5px solid #cbd5e1',
                      background: '#fff',
                      color: '#475569',
                      fontWeight: 800,
                      fontSize: 16,
                      padding: 0,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                  >
                    ↗️
                  </button>
                  <button 
                    onClick={() => {
                      setActivePreviewUrl(null);
                      setActivePreviewTitle('');
                    }} 
                    style={{ 
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: '#f1f5f9',
                      border: 'none', 
                      color: '#64748b', 
                      fontSize: 14, 
                      fontWeight: 900,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* WebView Iframe Wrapper */}
              <div style={{ flex: 1, position: 'relative', background: '#f8fafc' }}>
                <iframe
                  src={activePreviewUrl ? getEmbedUrl(activePreviewUrl) : ''}
                  title={activePreviewTitle}
                  style={{
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    background: '#ffffff'
                  }}
                  sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                />
                

              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&display=swap');

        .resident-layout {
          min-height: 100vh;
          background: #f8fafc;
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
          color: #1e293b;
        }
        
        .resident-container {
          max-width: 500px;
          margin: 0 auto;
          padding: 12px 6px 80px; /* Reduced lateral padding to 6px for edge-to-edge look on mobile */
        }

        /* Header Styles */
        .dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px; /* Reduced from 12px */
          padding: 0 2px;
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
          padding: 0 2px;
        }

        .section-title {
          font-size: 14px;
          font-weight: 800;
          color: #1e293b;
          margin-bottom: 8px;
          padding-left: 2px;
        }

        /* 3D Rotating Card Container & Faces */
        .card-container-3d {
          perspective: 1500px;
          width: 100%;
          max-width: 420px;
          aspect-ratio: 1.58 / 1;
          margin: 0 auto 16px;
          container-type: inline-size;
        }
        
        .card-inner-3d {
          width: 100%;
          height: 100%;
          position: relative;
          transform-style: preserve-3d;
          cursor: pointer;
        }
        
        .card-face {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
          border-radius: 28px;
          overflow: hidden;
          box-shadow: 0 15px 35px rgba(2, 26, 82, 0.22), 0 1px 3px rgba(0,0,0,0.1);
          border: 1px solid rgba(255,255,255,0.12);
          box-sizing: border-box;
        }
        
        .card-face-front {
          z-index: 2;
          transform: rotateY(0deg);
        }
        
        .card-face-back {
          transform: rotateY(180deg);
          z-index: 1;
        }
        
        .card-shine-overlay {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 5;
          mix-blend-mode: overlay;
        }
        
        /* Digital ID Card Front styling (modified to fit 3D container) */
        .digital-id-card {
          width: 100%;
          height: 100%;
          background: linear-gradient(135deg, #021a52 0%, #083b9c 45%, #021a52 100%);
          padding: 6cqw;
          color: #fff;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }
        
        /* Upgraded Glossy Gold-Indonesia themed back style */
        .digital-id-card-back {
          width: 100%;
          height: 100%;
          background: url('/back_card.png') no-repeat center center;
          background-size: cover;
          border: 1.5px solid rgba(212, 175, 55, 0.45);
          position: relative;
        }

        .card-back-inner-border {
          position: absolute;
          inset: 6px;
          border: 1px dashed rgba(212, 175, 55, 0.15);
          border-radius: 22px;
          pointer-events: none;
          z-index: 1;
        }

        .card-back-radar-lines {
          position: absolute;
          inset: 0;
          background-image: 
            radial-gradient(circle at 50% 50%, rgba(212, 175, 55, 0.05) 0%, transparent 60%),
            radial-gradient(circle at 50% 50%, transparent 20%, rgba(212, 175, 55, 0.03) 21%, rgba(212, 175, 55, 0.03) 22%, transparent 23%),
            radial-gradient(circle at 50% 50%, transparent 40%, rgba(212, 175, 55, 0.02) 41%, rgba(212, 175, 55, 0.02) 42%, transparent 43%),
            radial-gradient(circle at 50% 50%, transparent 60%, rgba(212, 175, 55, 0.015) 61%, rgba(212, 175, 55, 0.015) 62%, transparent 63%);
          pointer-events: none;
          z-index: 1;
        }

        .card-back-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          position: relative;
          z-index: 2;
          width: 100%;
        }
        
        .card-back-title-gold {
          font-size: 5cqw;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          background: linear-gradient(to right, #ffe066 0%, #f5b041 50%, #d4af37 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
        }

        .card-back-badge-gold {
          background: rgba(212, 175, 55, 0.12);
          border: 1px solid rgba(212, 175, 55, 0.4);
          padding: 1cqw 2cqw;
          border-radius: 50px;
          font-size: 2.2cqw;
          font-weight: 800;
          color: #ffd700;
          display: inline-flex;
          align-items: center;
          gap: 1cqw;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }

        .card-back-nfc-icon {
          color: rgba(212, 175, 55, 0.7);
          transform: rotate(90deg);
        }

        .card-back-seal-container {
          display: flex;
          align-items: center;
          justify-content: center;
          flex: 1;
          position: relative;
          z-index: 2;
          margin: 1.5cqw 0;
        }

        .card-back-seal-outer {
          width: 20cqw;
          height: 20cqw;
          border-radius: 50%;
          border: 1px solid rgba(212, 175, 55, 0.35);
          background: radial-gradient(circle, rgba(212, 175, 55, 0.1) 0%, transparent 70%);
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          box-shadow: 0 0 15px rgba(212, 175, 55, 0.15);
        }

        .card-back-seal-outer::before {
          content: '';
          position: absolute;
          inset: -4px;
          border-radius: 50%;
          border: 1px dashed rgba(212, 175, 55, 0.15);
          animation: spin 24s linear infinite;
        }

        .card-back-seal-inner {
          width: 16cqw;
          height: 16cqw;
          border-radius: 50%;
          border: 1.5px solid rgba(212, 175, 55, 0.45);
          background: rgba(2, 26, 82, 0.45);
          backdrop-filter: blur(4px);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.5cqw;
        }

        .card-back-seal-icon {
          color: #ffd700;
          filter: drop-shadow(0 0 6px rgba(212, 175, 55, 0.5));
        }

        .card-back-seal-text {
          font-size: 1.6cqw;
          font-weight: 900;
          letter-spacing: 0.1em;
          color: #ffd700;
          text-transform: uppercase;
          filter: drop-shadow(0 1px 2px rgba(0,0,0,0.4));
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes shimmer-gold {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        
        .card-back-cursive-text {
          font-family: 'Dancing Script', cursive, 'Brush Script MT', sans-serif;
          font-size: 5.5cqw;
          font-weight: 700;
          background: linear-gradient(90deg, #ffd700 0%, #ffeaa7 25%, #e6c229 50%, #ffeaa7 75%, #ffd700 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          text-align: center;
          margin-top: auto;
          padding-bottom: 1.5cqw;
          filter: drop-shadow(0 2px 6px rgba(0,0,0,0.6));
          animation: shimmer-gold 6s linear infinite;
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
            max-width: 1080px; 
            padding: 32px 32px 80px; 
          }
          .dashboard-header {
            margin-bottom: 24px;
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
            grid-column: span 7;
            padding: 0;
            border: none;
            box-shadow: none;
            background: none !important;
          }
          .keamanan-warning-card {
            grid-column: span 5;
            margin-top: 0 !important;
            margin-bottom: 0 !important;
            height: 100% !important;
            min-height: 270px;
            box-sizing: border-box;
            justify-content: space-between;
          }
          .section-quick-actions {
            grid-column: span 5;
            height: 100%;
          }
          .quick-actions-grid {
            grid-template-columns: repeat(2, 1fr);
          }
          .section-summary {
            grid-column: span 7;
          }
          .summary-grid {
            grid-template-columns: repeat(4, 1fr);
          }
          .section-announcements {
            grid-column: span 5;
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
          .section-vira-insight {
            grid-column: span 5;
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
          .resident-container { padding: 12px 6px 90px; }
          .summary-grid { gap: 6px; }
          .summary-item { padding: 8px 6px; }
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
        .kegiatan-scroll-container::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
