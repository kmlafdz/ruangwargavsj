import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { db } from './firebase/config';
import { doc, onSnapshot, collection, query, where, updateDoc } from 'firebase/firestore';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import KeluargaPage from './pages/KeluargaPage';
import WargaPage from './pages/WargaPage';
import SuratPage from './pages/SuratPage';
import KeuanganPage from './pages/KeuanganPage';
import ResidentKeuangan from './pages/ResidentKeuangan';
import DashboardPage from './pages/DashboardPage';
import ResidentDashboard from './pages/ResidentDashboard';
import LoginPage from './pages/LoginPage';

import ResidentLoginPage from './pages/ResidentLoginPage';
import RegistrationPage from './pages/RegistrationPage';
import AdminApprovalPage from './pages/AdminApprovalPage';
import ApprovalListPage from './pages/ApprovalListPage';
import UserManagementPage from './pages/UserManagementPage';
import ResidentFamilyPage from './pages/ResidentFamilyPage';
import ProfilePage from './pages/ProfilePage';
import ResidentProfilePage from './pages/ResidentProfilePage';
import ChatPage from './pages/ChatPage';
import AnnouncementsPage from './pages/AnnouncementsPage';
import AdminKegiatanPage from './pages/AdminKegiatanPage';
import AdminFypPage from './pages/AdminFypPage';
import FeedbackPage from './pages/FeedbackPage';
import AccountActivationPage from './pages/AccountActivationPage';
import ResidentAIAssistant from './pages/ResidentAIAssistant';
import ResidentReportPage from './pages/ResidentReportPage';
import AdminPengaduanPage from './pages/AdminPengaduanPage';
import { MessageSquare, Sparkles, X, Wifi } from 'lucide-react';
import WaitingApprovalPage from './pages/WaitingApprovalPage';
import RevisionPage from './pages/RevisionPage';
import { RoleGuard } from './components/RoleGuard';
import VerifyEmailPage from './pages/VerifyEmailPage';
import ResidentBottomNav from './components/ResidentBottomNav';
import SplashScreen from './components/SplashScreen';
import GlobalPinLock from './components/GlobalPinLock';
import { motion, AnimatePresence } from 'framer-motion';

import { User } from './types';
import './index.css';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { StatusBar } from '@capacitor/status-bar';
import { Keyboard } from '@capacitor/keyboard';

const PAGE_META: Record<string, { title: string; subtitle: string }> = {
  '/': { title: 'Dashboard Analitik', subtitle: 'Ringkasan data Ruang Warga VSJ' },
  '/admin/dev/dashboard': { title: 'Dashboard Analitik', subtitle: 'Ringkasan data Ruang Warga VSJ' },
  '/admin/dev/rw011/dashboard': { title: 'RW 011 Dashboard', subtitle: 'Ringkasan data seluruh RT di RW 011' },
  '/admin/dev/rt001/dashboard': { title: 'RT 001 Dashboard', subtitle: 'Manajemen kependudukan wilayah RT 001' },
  '/admin/dev/rt002/dashboard': { title: 'RT 002 Dashboard', subtitle: 'Manajemen kependudukan wilayah RT 002' },
  '/admin/dev/rt003/dashboard': { title: 'RT 003 Dashboard', subtitle: 'Manajemen kependudukan wilayah RT 003' },
  '/admin/dev/warga': { title: 'Data Warga', subtitle: 'Manajemen basis data kependudukan VSJ' },
  '/admin/dev/keluarga': { title: 'Kartu Keluarga', subtitle: 'Manajemen data keluarga dan hubungan anggota' },
  '/admin/dev/surat': { title: 'Pengajuan Surat', subtitle: 'Kelola permintaan surat dari warga' },
  '/admin/dev/keuangan': { title: 'Transaksi Kas', subtitle: 'Catatan pemasukan dan pengeluaran kas VSJ' },
  '/admin/dev/users': { title: 'Manajemen Admin', subtitle: 'Kelola akun administrator dan hak akses' },
  '/admin/dev/pengumuman': { title: 'Pengumuman Resmi', subtitle: 'Kelola siaran pengumuman resmi ke running text warga' },
  '/admin/dev/feedback': { title: 'Kotak Masukan Warga', subtitle: 'Moderasi saran dan kritik kependudukan warga' },
  '/admin/dev/pengaduan': { title: 'Laporan Pengaduan Warga', subtitle: 'Moderasi laporan kejadian dan pengaduan kependudukan warga' },
  '/warga/feedback': { title: 'Kritik & Saran', subtitle: 'Ajukan saran dan kritik membangun untuk RT/RW' },
  '/warga/report': { title: 'Lapor Warga', subtitle: 'Laporkan kejadian di sekitar lingkungan' },
};

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="card">
      <div style={{ padding: '80px 40px', textAlign: 'center', color: 'var(--gray-400)' }}>
        <div style={{ fontSize: 64, marginBottom: 24, filter: 'grayscale(1)' }}>📂</div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--gray-800)', marginBottom: 12 }}>{title}</h2>
        <p style={{ fontSize: 14, maxWidth: 400, margin: '0 auto', lineHeight: 1.6 }}>
          Halaman ini sedang dalam tahap pengembangan untuk versi berikutnya.
        </p>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem('erw_user');
    if (savedUser) {
      try {
        return JSON.parse(savedUser);
      } catch (e) {
        localStorage.removeItem('erw_user');
        return null;
      }
    }
    return null;
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [appLoading, setAppLoading] = useState(false);
  const [isAppLocked, setIsAppLocked] = useState(() => {
    // If they have set a PIN, prompt PIN lockscreen on startup
    const savedUser = localStorage.getItem('erw_user');
    if (savedUser) {
      try {
        const u = JSON.parse(savedUser);
        if (u.pinSet || u.pin) {
          const alreadyUnlocked = sessionStorage.getItem('app_initially_unlocked') === 'true';
          return !alreadyUnlocked;
        }
      } catch (e) { }
    }
    return false;
  });
  const [isViraOpen, setIsViraOpen] = useState(false);
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [activeToast, setActiveToast] = useState<{ id: string; title: string; message: string; userPhotoUrl?: string; route?: string } | null>(null);

  const [runningAnnouncements, setRunningAnnouncements] = useState<string>('Belum ada pengumuman resmi terbaru.');
  const [hasUnpaidIuran, setHasUnpaidIuran] = useState<boolean>(false);
  const [headerVisible, setHeaderVisible] = useState(true);
  const lastScrollYRef = useRef(0);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    let showListener: any;
    let hideListener: any;

    if (Capacitor.isNativePlatform()) {
      showListener = Keyboard.addListener('keyboardDidShow', () => {
        setIsKeyboardVisible(true);
      });
      hideListener = Keyboard.addListener('keyboardDidHide', () => {
        setIsKeyboardVisible(false);
      });
    } else {
      const handleResize = () => {
        if (window.visualViewport) {
          const isKeyboard = window.innerHeight - window.visualViewport.height > 150;
          setIsKeyboardVisible(isKeyboard);
        }
      };
      window.visualViewport?.addEventListener('resize', handleResize);
      return () => {
        window.visualViewport?.removeEventListener('resize', handleResize);
      };
    }

    return () => {
      if (showListener) {
        showListener.then((l: any) => l.remove());
      }
      if (hideListener) {
        hideListener.then((l: any) => l.remove());
      }
    };
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Hide status bar on native platforms for fullscreen
    if (Capacitor.isNativePlatform()) {
      StatusBar.hide().catch(err => console.warn('StatusBar hide err:', err));
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);


  // Initialize Push Notifications for Native Devices (Android/iOS)
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let regListener: any;
    let recListener: any;
    let actListener: any;

    const initPushNotifications = async () => {
      try {
        const permStatus = await PushNotifications.checkPermissions();
        if (permStatus.receive === 'prompt') {
          const newStatus = await PushNotifications.requestPermissions();
          if (newStatus.receive !== 'granted') return;
        } else if (permStatus.receive !== 'granted') {
          return;
        }

        await PushNotifications.register();

        // Save FCM token to state on registration
        regListener = await PushNotifications.addListener('registration', (token) => {
          console.log('FCM Token registered:', token.value);
          setFcmToken(token.value);
        });

        // Handle push received while app is in foreground
        recListener = await PushNotifications.addListener('pushNotificationReceived', (notification) => {
          console.log('Push diterima (foreground):', notification.title, notification.body);
        });

        // Handle tap on push notification
        actListener = await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
          const route = action.notification.data?.route;
          if (route) {
            window.location.hash = route;
          }
        });

      } catch (e) {
        console.error('Push Notification Setup Error:', e);
      }
    };

    initPushNotifications();

    return () => {
      if (regListener) regListener.remove();
      if (recListener) recListener.remove();
      if (actListener) actListener.remove();
    };
  }, []);

  // Save FCM token to Firestore when both token and user?.id are available
  useEffect(() => {
    if (fcmToken && user?.id) {
      const saveToken = async () => {
        try {
          await updateDoc(doc(db, 'users', user.id), {
            fcmToken: fcmToken,
            fcmTokenUpdatedAt: new Date().toISOString(),
          });
          console.log('FCM Token successfully saved to Firestore for user:', user.id);
        } catch (e) {
          console.error('Gagal simpan FCM token ke Firestore:', e);
        }
      };
      saveToken();
    }
  }, [fcmToken, user?.id]);

  // Sync announcements and iuran status globally for seamless running text position preservation
  useEffect(() => {
    if (!user || user.accountType !== 'resident') return;

    // 1. Announcements
    const annQuery = query(collection(db, 'announcements'));
    const unsubAnn = onSnapshot(annQuery, (snapshot) => {
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

    // 2. Unpaid iuran status
    const iuranQuery = query(collection(db, 'keuangan'), where('userId', '==', user.id), where('type', '==', 'Iuran'));
    const unsubIuran = onSnapshot(iuranQuery, (snap) => {
      const unpaid = snap.docs.filter(d => d.data().status === 'Unpaid').length;
      setHasUnpaidIuran(unpaid > 0);
    });

    // 3. Scroll handler for running text auto-hide
    const handleScroll = (e: any) => {
      const target = e.target;
      if (!target) return;

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

    return () => {
      unsubAnn();
      unsubIuran();
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [user?.id, user?.accountType]);

  // Real-time listener for incoming notifications for active resident to trigger pop-up toast
  useEffect(() => {
    if (!user || user.accountType !== 'resident') return;

    const notifQuery = query(
      collection(db, 'notifications'),
      where('targetId', '==', user.id),
      where('isRead', '==', false)
    );

    const sessionStartTime = Date.now();

    const unsub = onSnapshot(notifQuery, (snap) => {
      snap.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          const createdAt = data.createdAt?.toDate ? data.createdAt.toDate().getTime() : Date.now();

          // Only show popup for notifications created after the app was loaded to prevent old history spamming on start
          if (createdAt > sessionStartTime - 5000) {
            setActiveToast({
              id: change.doc.id,
              title: data.title || 'Notifikasi Baru',
              message: data.message || '',
              userPhotoUrl: data.userPhotoUrl || undefined,
              route: data.route || undefined
            });

            // Mark as read immediately on firestore to prevent duplicate popups on page reloads/history syncs
            updateDoc(doc(db, 'notifications', change.doc.id), { isRead: true }).catch(console.error);

            // Automatically hide after 6 seconds
            setTimeout(() => {
              setActiveToast(current => {
                if (current && current.id === change.doc.id) {
                  return null;
                }
                return current;
              });
            }, 6000);
          }
        }
      });
    });

  }, [user?.id, user?.accountType]);

  // Background check for auto-billing and Vira notifications
  useEffect(() => {
    if (!user || user.accountType !== 'resident') return;
    const rtId = user.rt_id;
    if (!rtId) return;

    const now = new Date();
    const currentMonthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const runChecks = async () => {
      try {
        const { checkAndGenerateRTMonthlyBills, checkAndTriggerViraNotifications } = await import('./services/financeService');
        await checkAndGenerateRTMonthlyBills(rtId, currentMonthYear);
        await checkAndTriggerViraNotifications(user);
      } catch (err) {
        console.error('Failed to run billing or Vira checks:', err);
      }
    };

    const timer = setTimeout(runChecks, 2000);
    return () => clearTimeout(timer);
  }, [user?.id, user?.rt_id, user?.accountType]);

  // Background Visibility & Inactivity Timers (5 Minutes)
  useEffect(() => {
    if (!user?.pin) {
      setIsAppLocked(false);
      return;
    }

    // A. Background lock check (5 minutes)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        localStorage.setItem('app_backgrounded_at', Date.now().toString());
      } else if (document.visibilityState === 'visible') {
        const bgTimeStr = localStorage.getItem('app_backgrounded_at');
        if (bgTimeStr) {
          const bgTime = parseInt(bgTimeStr, 10);
          const elapsed = Date.now() - bgTime;
          const fiveMinutes = 5 * 60 * 1000; // 300,000 ms
          if (elapsed >= fiveMinutes) {
            setIsAppLocked(true);
          }
        }
      }
    };

    // B. Inactivity lock check (5 minutes)
    let inactivityTimer: any;
    const resetInactivityTimer = () => {
      clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(() => {
        setIsAppLocked(true);
      }, 5 * 60 * 1000); // 5 minutes inactivity
    };

    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    activityEvents.forEach(evt => window.addEventListener(evt, resetInactivityTimer));
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Initial start
    resetInactivityTimer();

    return () => {
      clearTimeout(inactivityTimer);
      activityEvents.forEach(evt => window.removeEventListener(evt, resetInactivityTimer));
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user?.pin]);

  // Listen to incoming notifications in real-time to trigger custom Toast Pop-ups
  const isFirstRun = useRef(true);
  useEffect(() => {
    isFirstRun.current = true;
    if (!user) return;

    const q = query(
      collection(db, 'notifications'),
      where('targetId', '==', user.id)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (isFirstRun.current) {
        isFirstRun.current = false;
        return;
      }

      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          // Display a dynamic sliding toast notification!
          setActiveToast({
            id: change.doc.id,
            title: data.title || 'Notifikasi Baru',
            message: data.message || '',
            userPhotoUrl: data.userPhotoUrl || ''
          });

          // Auto close toast after 5 seconds
          setTimeout(() => {
            setActiveToast(null);
          }, 5000);
        }
      });
    });

    return () => unsubscribe();
  }, [user?.id]);

  const location = useLocation();
  const navigate = useNavigate();

  // Reset scroll position to top when navigating to a new page
  useEffect(() => {
    window.scrollTo(0, 0);
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;

    const scrollContainers = document.querySelectorAll('.page-content, .main-area, .resident-layout, .resident-container, .dashboard-content');
    scrollContainers.forEach(el => {
      el.scrollTop = 0;
    });
  }, [location.pathname]);

  useEffect(() => {
    // Jika sudah login, tidak perlu splash screen lama-lama atau sama sekali
    const savedUser = localStorage.getItem('erw_user');
    if (savedUser) {
      setAppLoading(false);
    } else {
      const timer = setTimeout(() => setAppLoading(false), 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleLogin = (userData: User) => {
    setUser(userData);
    localStorage.setItem('erw_user', JSON.stringify(userData));

    // Explicitly navigate based on user type
    if (userData.accountType === 'admin') {
      let scope = 'dev';
      if (userData.adminRole === 'rw') {
        scope = 'rw011';
      } else if (userData.adminRole === 'rt') {
        scope = `rt${userData.rt_id || '001'}`;
      }
      const targetPath = `/admin/${scope}/dashboard`;
      navigate(targetPath, { replace: true });
    } else {
      navigate('/warga/dashboard', { replace: true });
    }
  };

  const handleUpdateUser = (userData: User) => {
    setUser(userData);
    localStorage.setItem('erw_user', JSON.stringify(userData));
  };

  // Real-time user data sync from Firestore
  useEffect(() => {
    // JANGAN sinkronisasi kalau akun dev (biar nggak kena overwrite data salah)
    if (!user?.id || user.id === 'dev-admin') return;

    const userRef = doc(db, 'users', user.id);
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const latestData = { id: docSnap.id, ...docSnap.data() } as User;

        // Use functional update to always have the latest state for comparison
        setUser(prev => {
          if (!prev) return latestData;

          const hasChanged =
            latestData.accountStatus !== prev.accountStatus ||
            latestData.isFirstLogin !== prev.isFirstLogin ||
            latestData.adminRole !== prev.adminRole ||
            latestData.accountType !== prev.accountType ||
            latestData.name !== prev.name;

          if (hasChanged) {
            localStorage.setItem('erw_user', JSON.stringify(latestData));
            return latestData;
          }
          return prev;
        });
      }
    });

    return () => unsubscribe();
  }, [user?.id]); // Only re-run if user ID changes

  const handleLogout = () => {
    // Defensive check: explicitly check if role exists and verify active URL path to ensure perfect redirection
    const isCurrentlyOnAdminPath = window.location.hash.startsWith('#/admin') || window.location.pathname.startsWith('/admin');
    const isAdminUser = user?.accountType === 'admin' || ((user as any)?.role && (user as any).role !== 'warga');
    const isAdmin = !!(isAdminUser || isCurrentlyOnAdminPath);

    setUser(null);
    setSidebarOpen(false);
    localStorage.removeItem('erw_user');

    // Paksa reload untuk bersihkan sisa-sisa state/cache ke path login yang bersih
    const loginPath = isAdmin ? '/admin/login' : '/warga-login';
    window.location.href = loginPath;
  };
  // Logika Normalisasi Data
  useEffect(() => {
    if (user && !user.accountType) {
      const isLegacyAdmin = (user as any).role && (user as any).role !== 'warga';
      const isLegacyResident = (user as any).role === 'warga';

      if (isLegacyAdmin || isLegacyResident) {
        const updatedUser = {
          ...user,
          accountType: isLegacyAdmin ? 'admin' : 'resident',
          adminRole: isLegacyAdmin ? (user as any).role : undefined
        } as User;
        setUser(updatedUser);
        localStorage.setItem('erw_user', JSON.stringify(updatedUser));
      }
    }
  }, [user]);

  // Logika Redireksi Auth
  const publicPaths = ['/admin/login', '/admin/dev/login', '/warga-login', '/register'];
  const currentPath = location.pathname.replace(/\/$/, ''); // Hapus trailing slash
  const isPublicPath = publicPaths.includes(currentPath);

  // 1. Jika BELUM login dan mencoba akses halaman privat
  if (!user && !isPublicPath) {
    if (location.pathname.startsWith('/admin')) {
      return <Navigate to="/admin/login" replace />;
    }
    return <Navigate to="/warga-login" replace />;
  }

  // Hook redirect admin:
  // Mengarahkan admin ke scope URL yang sesuai dengan perannya:
  // - RW -> /admin/rw011/*
  // - RT -> /admin/rt[rt_id]/*
  // - Developer -> /admin/dev/*
  React.useEffect(() => {
    if (user && user.accountType === 'admin') {
      let correctScope = 'dev';
      if (user.adminRole === 'rw') {
        correctScope = 'rw011';
      } else if (user.adminRole === 'rt') {
        correctScope = `rt${user.rt_id || '001'}`;
      }

      const path = location.pathname;
      if (path.startsWith('/admin/')) {
        const segments = path.split('/');
        const currentScope = segments[2];
        if (currentScope && currentScope !== correctScope && currentScope !== 'login' && currentScope !== 'dev/login') {
          segments[2] = correctScope;
          const newPath = segments.join('/');
          navigate(newPath, { replace: true });
        }
      }
    }
  }, [user, location.pathname, navigate]);

  // 2. Jika SUDAH login tapi masih di halaman login/register
  if (user && isPublicPath) {
    const isAdmin = user.accountType === 'admin';
    let target = '/warga/dashboard';
    if (isAdmin) {
      let scope = 'dev';
      if (user.adminRole === 'rw') scope = 'rw011';
      else if (user.adminRole === 'rt') scope = `rt${user.rt_id || '001'}`;
      target = `/admin/${scope}/dashboard`;
    }
    // Gunakan window.location.replace untuk navigasi instan dan hapus splash screen
    window.location.href = target;
    return null;
  }

  // Resident Onboarding Middleware
  const isResident = user?.accountType === 'resident';
  if (user && isResident) {
    const status = user.accountStatus;
    const isFirst = user.isFirstLogin;

    if (status === 'blocked') {
      handleLogout();
      return null;
    }

    if ((status === 'pending_registration' || isFirst) && location.pathname !== '/warga/aktivasi') {
      return <Navigate to="/warga/aktivasi" replace />;
    }
    if ((status === 'waiting_family_approval' || status === 'waiting_admin_approval') && location.pathname !== '/warga/waiting') {
      return <Navigate to="/warga/waiting" replace />;
    }
    if (status === 'rejected' && location.pathname !== '/warga/revisi' && location.pathname !== '/warga/aktivasi') {
      return <Navigate to="/warga/revisi" replace />;
    }
    if (status !== 'active' && location.pathname.startsWith('/warga/dashboard')) {
      if (status === 'pending_registration') return <Navigate to="/warga/aktivasi" replace />;
      if (status === 'waiting_admin_approval') return <Navigate to="/warga/waiting" replace />;
      if (status === 'rejected') return <Navigate to="/warga/revisi" replace />;
    }
  }

  const isChatPage = location.pathname === '/warga/chat' || /^\/admin\/(dev|rw011|rt\d+)\/chat$/.test(location.pathname);
  const normalizedPathForMeta = location.pathname.replace(/^\/admin\/(rw011|rt\d+)/, '/admin/dev');
  let meta = PAGE_META[normalizedPathForMeta] || { title: 'Ruang Warga VSJ', subtitle: 'Sistem Informasi Administrasi' };

  if (user && user.accountType === 'admin' && user.adminRole === 'rt' && normalizedPathForMeta === '/admin/dev/dashboard') {
    meta = {
      title: `RT ${user.rt_id} Dashboard`,
      subtitle: `Manajemen kependudukan wilayah RT ${user.rt_id}`
    };
  }

  return (
    <>
      <AnimatePresence>
        {appLoading && <SplashScreen key="splash" />}
      </AnimatePresence>

      <Routes>
        <Route path="/admin/dev/login" element={<LoginPage onLogin={handleLogin} />} />
        <Route path="/admin/login" element={<LoginPage onLogin={handleLogin} />} />
        <Route path="/warga-login" element={<ResidentLoginPage onLogin={handleLogin} />} />
        <Route path="/register" element={<RegistrationPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />

        {/* FULL SCREEN ONBOARDING ROUTES */}
        <Route
          path="/warga/aktivasi"
          element={
            <RoleGuard user={user} allowedRoles={['resident']}>
              <AccountActivationPage user={user!} onComplete={handleLogin} />
            </RoleGuard>
          }
        />
        <Route
          path="/warga/waiting"
          element={
            <RoleGuard user={user} allowedRoles={['resident']}>
              <WaitingApprovalPage user={user!} onLogout={handleLogout} />
            </RoleGuard>
          }
        />
        <Route
          path="/warga/revisi"
          element={
            <RoleGuard user={user} allowedRoles={['resident']}>
              <RevisionPage user={user!} onLogout={handleLogout} />
            </RoleGuard>
          }
        />

        <Route
          path="*"
          element={
            <div className={`app-layout ${user?.accountType === 'resident' || !location.pathname.startsWith('/admin') ? 'is-resident' : ''}`}>
              {user?.accountType === 'admin' && location.pathname.startsWith('/admin') && (
                <Sidebar
                  activePage={location.pathname}
                  onNavigate={(path) => navigate(path)}
                  onLogout={handleLogout}
                  user={user}
                  isOpen={sidebarOpen}
                  onClose={() => setSidebarOpen(false)}
                />
              )}
              <div
                className={`main-area ${isChatPage ? 'chat-page-main-area' : ''}`}
              >
                {!isChatPage && (
                  <Navbar
                    title={meta.title}
                    subtitle={meta.subtitle}
                    user={user}
                    onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
                    onLogout={handleLogout}
                    hideToggle={user?.accountType === 'resident' || !location.pathname.startsWith('/admin')}
                  />
                )}
                <main
                  className={`page-content ${isChatPage ? 'chat-page-content' : ''}`}
                >
                  <div className={isChatPage ? 'chat-page-content-wrapper' : ''}>
                    <Routes>
                      <Route path="/" element={
                        user?.accountType === 'admin'
                          ? (() => {
                            let scope = 'dev';
                            if (user.adminRole === 'rw') scope = 'rw011';
                            else if (user.adminRole === 'rt') scope = `rt${user.rt_id || '001'}`;
                            return <Navigate to={`/admin/${scope}/dashboard`} replace />;
                          })()
                          : <Navigate to="/warga/dashboard" replace />
                      } />

                      {/* ADMIN DOMAIN */}
                      <Route path="/admin/:scope/dashboard" element={<RoleGuard user={user} allowedRoles={['developer', 'rw', 'rt']}><DashboardPage user={user} /></RoleGuard>} />

                      <Route path="/admin/:scope/warga" element={<RoleGuard user={user} allowedRoles={['developer', 'rw', 'rt']}><WargaPage /></RoleGuard>} />
                      <Route path="/admin/:scope/keluarga" element={<RoleGuard user={user} allowedRoles={['developer', 'rw', 'rt']}><KeluargaPage user={user} /></RoleGuard>} />
                      <Route path="/admin/:scope/surat" element={<RoleGuard user={user} allowedRoles={['developer', 'rw', 'rt']}><SuratPage /></RoleGuard>} />
                      <Route path="/admin/:scope/keuangan" element={<RoleGuard user={user} allowedRoles={['developer', 'rw', 'rt']}><KeuanganPage user={user!} /></RoleGuard>} />
                      <Route path="/admin/:scope/approvals" element={<RoleGuard user={user} allowedRoles={['developer', 'rw', 'rt']}><ApprovalListPage /></RoleGuard>} />
                      <Route path="/admin/:scope/approval/:id" element={<RoleGuard user={user} allowedRoles={['developer', 'rw', 'rt']}><AdminApprovalPage /></RoleGuard>} />
                      <Route path="/admin/:scope/users" element={<RoleGuard user={user} allowedRoles={['developer', 'rw']}><UserManagementPage currentUser={user!} /></RoleGuard>} />
                      <Route path="/admin/:scope/setting" element={<RoleGuard user={user} allowedRoles={['developer', 'rw', 'rt']}><ProfilePage user={user!} onUpdateUser={handleUpdateUser} /></RoleGuard>} />
                      <Route path="/admin/:scope/chat" element={<RoleGuard user={user} allowedRoles={['developer', 'rw', 'rt']}><ChatPage user={user!} /></RoleGuard>} />
                      <Route path="/admin/:scope/pengumuman" element={<RoleGuard user={user} allowedRoles={['developer', 'rw', 'rt']}><AnnouncementsPage isAdminView={true} user={user!} /></RoleGuard>} />
                      <Route path="/admin/:scope/feedback" element={<RoleGuard user={user} allowedRoles={['developer', 'rw', 'rt']}><FeedbackPage isAdminView={true} user={user!} /></RoleGuard>} />
                      <Route path="/admin/:scope/pengaduan" element={<RoleGuard user={user} allowedRoles={['developer', 'rw', 'rt']}><AdminPengaduanPage user={user!} /></RoleGuard>} />
                      <Route path="/admin/:scope/kegiatan" element={<RoleGuard user={user} allowedRoles={['developer', 'rw', 'rt']}><AdminKegiatanPage user={user!} /></RoleGuard>} />
                      <Route path="/admin/:scope/fyp" element={<RoleGuard user={user} allowedRoles={['developer', 'rw', 'rt']}><AdminFypPage user={user!} /></RoleGuard>} />

                      {/* WARGA DOMAIN */}
                      <Route path="/warga/dashboard" element={<RoleGuard user={user} allowedRoles={['resident']}><ResidentDashboard user={user!} onToggleViraAI={() => setIsViraOpen(true)} /></RoleGuard>} />
                      <Route path="/warga/profile" element={<RoleGuard user={user} allowedRoles={['resident']}><ResidentProfilePage user={user!} onLogout={handleLogout} /></RoleGuard>} />
                      <Route path="/warga/setting" element={<RoleGuard user={user} allowedRoles={['resident']}><ProfilePage user={user!} onUpdateUser={handleUpdateUser} /></RoleGuard>} />
                      <Route path="/warga/chat" element={<RoleGuard user={user} allowedRoles={['resident']}><ChatPage user={user!} /></RoleGuard>} />
                      <Route path="/warga/keluarga" element={<RoleGuard user={user} allowedRoles={['resident']}><ResidentFamilyPage user={user!} /></RoleGuard>} />
                      <Route path="/warga/surat" element={<RoleGuard user={user} allowedRoles={['resident']}><SuratPage /></RoleGuard>} />
                      <Route path="/warga/keuangan" element={<RoleGuard user={user} allowedRoles={['resident']}><ResidentKeuangan user={user!} /></RoleGuard>} />
                      <Route path="/warga/iuran" element={<RoleGuard user={user} allowedRoles={['resident']}><ResidentKeuangan user={user!} /></RoleGuard>} />
                      <Route path="/warga/ai" element={<RoleGuard user={user} allowedRoles={['resident']}><ResidentAIAssistant user={user!} /></RoleGuard>} />
                      <Route path="/warga/pengumuman" element={<RoleGuard user={user} allowedRoles={['resident']}><AnnouncementsPage isAdminView={false} user={user!} /></RoleGuard>} />
                      <Route path="/warga/feedback" element={<RoleGuard user={user} allowedRoles={['resident']}><FeedbackPage isAdminView={false} user={user!} /></RoleGuard>} />
                      <Route path="/warga/report" element={<RoleGuard user={user} allowedRoles={['resident']}><ResidentReportPage user={user!} /></RoleGuard>} />

                      <Route path="*" element={<PlaceholderPage title={meta.title} />} />
                    </Routes>
                  </div>
                </main>
              </div>
              {user?.accountType === 'resident' && location.pathname !== '/warga/setting' && !isKeyboardVisible && (
                <ResidentBottomNav onTabClick={() => setIsViraOpen(false)} />
              )}
              {user?.accountType === 'resident' && location.pathname !== '/warga/chat' && !isKeyboardVisible && (
                <button
                  onClick={() => setIsViraOpen(prev => !prev)}
                  style={{
                    position: 'fixed',
                    bottom: location.pathname === '/warga/setting' ? '24px' : '90px',
                    right: '20px',
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    background: isViraOpen
                      ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                      : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                    color: '#ffffff',
                    border: 'none',
                    boxShadow: isViraOpen
                      ? '0 8px 24px rgba(239, 68, 68, 0.4)'
                      : '0 8px 24px rgba(37, 99, 235, 0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    zIndex: 10001,
                    transition: 'transform 0.2s, background 0.2s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.08)')}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                >
                  {isViraOpen ? <X size={24} /> : <Sparkles size={24} />}
                </button>
              )}
              {user?.accountType === 'admin' && !isChatPage && !isKeyboardVisible && (
                <button
                  onClick={() => {
                    let scope = 'dev';
                    if (user.adminRole === 'rw') scope = 'rw011';
                    else if (user.adminRole === 'rt') scope = `rt${user.rt_id || '001'}`;
                    navigate(`/admin/${scope}/chat`);
                  }}
                  style={{
                    position: 'fixed',
                    bottom: '24px',
                    right: '20px',
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                    color: '#ffffff',
                    border: 'none',
                    boxShadow: '0 8px 24px rgba(37, 99, 235, 0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    zIndex: 999,
                    transition: 'transform 0.2s, background 0.2s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.08)')}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                >
                  <MessageSquare size={24} />
                </button>
              )}
            </div>
          }
        />
      </Routes>
      {user?.accountType === 'resident' && !isChatPage && (
        <div
          className="running-text-container-full"
          style={{
            transform: headerVisible ? 'translateY(0)' : 'translateY(-100px)',
            transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          <div className="running-text-content">
            <span>📢 PENGUMUMAN TERBARU: {runningAnnouncements}  •  💰 STATUS KEUANGAN: {hasUnpaidIuran ? 'Terdapat Iuran Belum Terbayar' : 'Seluruh Iuran Lunas'}  •  🏠 Selamat Datang di Ruang Warga VSJ</span>
          </div>
        </div>
      )}

      {user?.accountType === 'resident' && (
        <style>{`
          .dashboard-header,
          .running-text-container-full,
          .resident-container {
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
          }
          .running-text-container-full {
            background: #eff6ff;
            border-bottom: 1px solid #bfdbfe;
            height: 30px;
            overflow: hidden;
            position: fixed;
            top: calc(64px + env(safe-area-inset-top, 0px));
            left: 0;
            width: 100%;
            z-index: 1000;
            display: flex;
            align-items: center;
            pointer-events: none;
          }
          @media (max-width: 768px) {
            .running-text-container-full {
               top: calc(50px + env(safe-area-inset-top, 0px));
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

          .vira-ai-chat-panel {
            position: fixed;
            bottom: 160px;
            right: 20px;
            width: 380px;
            max-width: calc(100vw - 40px);
            height: 560px;
            max-height: calc(100vh - 200px);
            background: rgba(255, 255, 255, 0.72) !important;
            backdrop-filter: blur(24px) saturate(180%);
            -webkit-backdrop-filter: blur(24px) saturate(180%);
            border: 1px solid rgba(255, 255, 255, 0.45);
            border-radius: 24px;
            box-shadow: 0 20px 50px rgba(15, 23, 42, 0.15), inset 0 0 0 1px rgba(255,255,255,0.25);
            z-index: 10000;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            transition: bottom 0.2s ease, max-height 0.2s ease;
          }
          @media (max-width: 768px) {
            .vira-ai-chat-panel {
              bottom: 160px;
              right: 20px;
              width: 340px;
              max-width: calc(100vw - 40px);
              height: 480px;
              max-height: calc(100vh - 200px);
              border-radius: 24px;
              border: 1px solid rgba(255, 255, 255, 0.45) !important;
            }
          }
        `}</style>
      )}

      {/* FLOATING VIRA AI CHAT WINDOW */}
      {user?.accountType === 'resident' && (
        <>
          {/* BLURRED BACKDROP OVERLAY */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{
              opacity: isViraOpen ? 1 : 0,
              pointerEvents: isViraOpen ? 'auto' : 'none'
            }}
            transition={{ duration: 0.25 }}
            onClick={() => setIsViraOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15, 23, 42, 0.4)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              zIndex: 9999,
            }}
          />

          {/* CHAT PANEL */}
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{
              opacity: isViraOpen ? 1 : 0,
              y: isViraOpen ? 0 : 50,
              scale: isViraOpen ? 1 : 0.9,
              pointerEvents: isViraOpen ? 'auto' : 'none'
            }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="vira-ai-chat-panel"
            style={{
              bottom: isKeyboardVisible ? '10px' : undefined,
              maxHeight: isKeyboardVisible ? 'calc(100vh - 30px)' : undefined
            }}
          >
            <ResidentAIAssistant user={user} onClose={() => setIsViraOpen(false)} />
          </motion.div>
        </>
      )}

      {/* Toast Pop-up Notification Banner */}
      <AnimatePresence>
        {activeToast && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            onClick={() => {
              const route = activeToast.route || '/warga/pengumuman';
              setActiveToast(null);
              navigate(route);
            }}
            style={{
              position: 'fixed',
              top: 'calc(24px + env(safe-area-inset-top, 0px))',
              right: 24,
              left: window.innerWidth < 480 ? 24 : 'auto',
              zIndex: 99999,
              background: 'rgba(255, 255, 255, 0.9)',
              backdropFilter: 'blur(20px)',
              borderRadius: '20px',
              padding: '16px 20px',
              boxShadow: '0 12px 40px rgba(15, 23, 42, 0.12)',
              border: '1px solid rgba(226, 232, 240, 0.8)',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              cursor: 'pointer',
              maxWidth: 380,
              minWidth: 280,
            }}
          >
            {activeToast.userPhotoUrl ? (
              <img
                src={activeToast.userPhotoUrl}
                alt="Avatar"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '2px solid #2563eb',
                  boxShadow: '0 4px 10px rgba(37,99,235,0.15)',
                  flexShrink: 0,
                }}
              />
            ) : (
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16,
                  fontWeight: 900,
                  boxShadow: '0 4px 10px rgba(37,99,235,0.2)',
                  flexShrink: 0,
                }}
              >
                🔔
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 900, fontSize: 13, color: '#0f172a', marginBottom: 2 }}>
                {activeToast.title}
              </div>
              <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.4 }}>
                {activeToast.message}
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setActiveToast(null);
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#f1f5f9')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
            >
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {isAppLocked && user?.pin && (
        <GlobalPinLock
          correctPin={user.pin}
          userName={user.name || 'Warga'}
          userId={user.id}
          userPassword={user.password}
          onUnlock={() => {
            setIsAppLocked(false);
            sessionStorage.setItem('app_initially_unlocked', 'true');
          }}
        />
      )}

      <AnimatePresence>
        {isOffline && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="modal-overlay"
            style={{ zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', background: 'rgba(0,0,0,0.85)', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
          >
            <motion.div
              initial={{ scale: 0.8, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="modal-content"
              style={{ background: '#fff', borderRadius: '24px', padding: '30px 20px', maxWidth: '340px', width: '100%', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}
            >
              <img src="/vira_ai_kaget.png" alt="Vira Kaget" style={{ width: '140px', height: '140px', objectFit: 'cover', margin: '0 auto 20px', display: 'block', filter: 'drop-shadow(0 10px 15px rgba(0,0,0,0.2))' }} />
              <h2 style={{ fontSize: '22px', fontWeight: 900, color: '#1e293b', marginBottom: '12px' }}>Ups! Koneksi Terputus</h2>
              <p style={{ fontSize: '15px', color: '#64748b', lineHeight: 1.6, marginBottom: '24px' }}>
                Sepertinya Anda sedang offline. Silakan periksa koneksi internet Anda agar aplikasi Ruang Warga VSJ dapat berjalan dengan normal kembali.
              </p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#f59e0b', fontWeight: 700, fontSize: '14px', background: '#fef3c7', padding: '12px', borderRadius: '12px' }}>
                <Wifi size={18} />
                Menunggu Sinyal...
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
