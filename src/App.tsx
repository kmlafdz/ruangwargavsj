import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { db } from './firebase/config';
import { doc, onSnapshot } from 'firebase/firestore';
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
import FeedbackPage from './pages/FeedbackPage';
import AccountActivationPage from './pages/AccountActivationPage';
import ResidentAIAssistant from './pages/ResidentAIAssistant';
import { MessageSquare } from 'lucide-react';
import WaitingApprovalPage from './pages/WaitingApprovalPage';
import RevisionPage from './pages/RevisionPage';
import { RoleGuard } from './components/RoleGuard';
import VerifyEmailPage from './pages/VerifyEmailPage';
import ResidentBottomNav from './components/ResidentBottomNav';
import SplashScreen from './components/SplashScreen';
import GlobalPinLock from './components/GlobalPinLock';
import { AnimatePresence } from 'framer-motion';

import { User } from './types';
import './index.css';

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
  '/warga/feedback': { title: 'Kritik & Saran', subtitle: 'Ajukan saran dan kritik membangun untuk RT/RW' },
};

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="card">
      <div style={{ padding: '80px 40px', textAlign: 'center', color: 'var(--gray-400)' }}>
        <div style={{ fontSize: 64, marginBottom: 24, filter: 'grayscale(1)' }}>📂</div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--gray-800)', marginBottom: 12 }}>{title}</h2>
        <p style={{ fontSize: 14, maxWidth: 400, margin: '0 auto', lineHeight: 1.6 }}>
          Halaman ini sedang dalam tahap pengembangan untuk versi berikutnya.
          Fitur ini akan segera tersedia untuk meningkatkan efisiensi administrasi RW 011.
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
  const [appLoading, setAppLoading] = useState(true);
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

  const location = useLocation();
  const navigate = useNavigate();

  // Reset scroll position to top when navigating to a new page
  useEffect(() => {
    window.scrollTo(0, 0);
    const pageContent = document.querySelector('.page-content');
    if (pageContent) {
      pageContent.scrollTop = 0;
    }
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
      navigate('/admin/dev/dashboard', { replace: true });
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

    // Paksa reload untuk bersihkan sisa-sisa state/cache
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

  // 2. Jika SUDAH login tapi masih di halaman login/register
  if (user && isPublicPath) {
    const isAdmin = user.accountType === 'admin';
    const target = isAdmin ? '/admin/dev/dashboard' : '/warga/dashboard';
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

  const isChatPage = location.pathname === '/warga/chat' || location.pathname === '/admin/dev/chat';
  const meta = PAGE_META[location.pathname] || { title: 'Ruang Warga VSJ', subtitle: 'Sistem Informasi Administrasi' };

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
                          ? <Navigate to="/admin/dev/dashboard" replace />
                          : <Navigate to="/warga/dashboard" replace />
                      } />

                      {/* ADMIN DOMAIN */}
                      <Route path="/admin/dev/dashboard" element={<RoleGuard user={user} allowedRoles={['developer', 'rw', 'rt']}><DashboardPage user={user} /></RoleGuard>} />

                      <Route path="/admin/dev/warga" element={<RoleGuard user={user} allowedRoles={['developer', 'rw', 'rt']}><WargaPage /></RoleGuard>} />
                      <Route path="/admin/dev/keluarga" element={<RoleGuard user={user} allowedRoles={['developer', 'rw', 'rt']}><KeluargaPage /></RoleGuard>} />
                      <Route path="/admin/dev/surat" element={<RoleGuard user={user} allowedRoles={['developer', 'rw', 'rt']}><SuratPage /></RoleGuard>} />
                      <Route path="/admin/dev/keuangan" element={<RoleGuard user={user} allowedRoles={['developer', 'rw', 'rt']}><KeuanganPage user={user!} /></RoleGuard>} />
                      <Route path="/admin/dev/approvals" element={<RoleGuard user={user} allowedRoles={['developer', 'rw', 'rt']}><ApprovalListPage /></RoleGuard>} />
                      <Route path="/admin/dev/approval/:id" element={<RoleGuard user={user} allowedRoles={['developer', 'rw', 'rt']}><AdminApprovalPage /></RoleGuard>} />
                      <Route path="/admin/dev/users" element={<RoleGuard user={user} allowedRoles={['developer', 'rw']}><UserManagementPage /></RoleGuard>} />
                      <Route path="/admin/dev/setting" element={<RoleGuard user={user} allowedRoles={['developer', 'rw', 'rt']}><ProfilePage user={user!} onUpdateUser={handleUpdateUser} /></RoleGuard>} />
                      <Route path="/admin/dev/chat" element={<RoleGuard user={user} allowedRoles={['developer', 'rw', 'rt']}><ChatPage user={user!} /></RoleGuard>} />
                      <Route path="/admin/dev/pengumuman" element={<RoleGuard user={user} allowedRoles={['developer', 'rw', 'rt']}><AnnouncementsPage isAdminView={true} user={user!} /></RoleGuard>} />
                      <Route path="/admin/dev/feedback" element={<RoleGuard user={user} allowedRoles={['developer', 'rw', 'rt']}><FeedbackPage isAdminView={true} user={user!} /></RoleGuard>} />

                      {/* WARGA DOMAIN */}
                      <Route path="/warga/dashboard" element={<RoleGuard user={user} allowedRoles={['resident']}><ResidentDashboard user={user!} /></RoleGuard>} />
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

                      <Route path="*" element={<PlaceholderPage title={meta.title} />} />
                    </Routes>
                  </div>
                </main>
              </div>
              {user?.accountType === 'resident' && location.pathname !== '/warga/setting' && location.pathname !== '/warga/chat' && <ResidentBottomNav />}
              {user?.accountType === 'resident' && location.pathname !== '/warga/chat' && (
                <button
                  onClick={() => navigate('/warga/chat')}
                  style={{
                    position: 'fixed',
                    bottom: location.pathname === '/warga/setting' ? '24px' : '90px',
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
              {user?.accountType === 'admin' && location.pathname !== '/admin/dev/chat' && (
                <button
                  onClick={() => navigate('/admin/dev/chat')}
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
    </>
  );
}
