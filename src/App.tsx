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
import ChatPage from './pages/ChatPage';
import AccountActivationPage from './pages/AccountActivationPage';
import WaitingApprovalPage from './pages/WaitingApprovalPage';
import RevisionPage from './pages/RevisionPage';
import { RoleGuard } from './components/RoleGuard';
import ResidentBottomNav from './components/ResidentBottomNav';
import SplashScreen from './components/SplashScreen';
import { AnimatePresence } from 'framer-motion';

import { User } from './types';
import './index.css';

const PAGE_META: Record<string, { title: string; subtitle: string }> = {
  '/': { title: 'Dashboard Analitik', subtitle: 'Ringkasan data Ruang Warga VSJ' },
  '/admin/dashboard': { title: 'Dashboard Analitik', subtitle: 'Ringkasan data Ruang Warga VSJ' },
  '/warga/dashboard': { title: 'Ruang Warga VSJ', subtitle: 'Layanan Mandiri Warga VSJ' },
  '/admin/warga': { title: 'Data Warga', subtitle: 'Manajemen basis data kependudukan VSJ' },
  '/admin/keluarga': { title: 'Kartu Keluarga', subtitle: 'Manajemen data keluarga dan hubungan anggota' },
  '/admin/surat': { title: 'Pengajuan Surat', subtitle: 'Kelola permintaan surat dari warga' },
  '/admin/keuangan': { title: 'Transaksi Kas', subtitle: 'Catatan pemasukan dan pengeluaran kas VSJ' },
};

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="card">
      <div style={{padding:'80px 40px',textAlign:'center',color:'var(--gray-400)'}}>
        <div style={{fontSize:64,marginBottom:24, filter: 'grayscale(1)'}}>📂</div>
        <h2 style={{fontSize:20,fontWeight:800,color:'var(--gray-800)',marginBottom:12}}>{title}</h2>
        <p style={{fontSize:14, maxWidth: 400, margin: '0 auto', lineHeight: 1.6}}>
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
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => setAppLoading(false), 2500);
    return () => clearTimeout(timer);
  }, []);

  const handleLogin = (userData: User) => {
    setUser(userData);
    localStorage.setItem('erw_user', JSON.stringify(userData));
  };

  // Real-time user data sync from Firestore
  useEffect(() => {
    if (!user?.id) return;
    
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
            latestData.role !== prev.role ||
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
    setUser(null);
    setSidebarOpen(false);
    localStorage.removeItem('erw_user');
    navigate('/admin-login');
  };

  // Auth Redirection Logic
  if (!user && !['/admin-login', '/warga-login', '/register'].includes(location.pathname)) {
    return <Navigate to="/warga-login" replace />;
  }

  if (user && ['/admin-login', '/warga-login', '/register'].includes(location.pathname)) {
    if (user.role === 'warga') {
      if (user.accountStatus === 'pending_registration' || user.isFirstLogin) {
        return <Navigate to="/warga/aktivasi" replace />;
      }
      if (user.accountStatus === 'waiting_family_approval' || user.accountStatus === 'waiting_admin_approval') {
        return <Navigate to="/warga/waiting" replace />;
      }
      if (user.accountStatus === 'rejected') {
        return <Navigate to="/warga/revisi" replace />;
      }
    }
    // If they log in via /warga-login, send them to /warga/dashboard even if they are admins
    // If they log in via /admin-login, send to /admin/dashboard
    const target = location.pathname === '/admin-login' ? '/admin/dashboard' : '/warga/dashboard';
    return <Navigate to={target} replace />;
  }

  // Resident Onboarding Middleware
  if (user && user.role === 'warga') {
    const status = user.accountStatus;
    const isFirst = user.isFirstLogin;

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

  const meta = PAGE_META[location.pathname] || { title: 'Ruang Warga VSJ', subtitle: 'Sistem Informasi Administrasi' };

  return (
    <>
      <AnimatePresence>
        {appLoading && <SplashScreen key="splash" />}
      </AnimatePresence>

      <Routes>
        <Route path="/admin-login" element={<LoginPage onLogin={handleLogin} />} />
        <Route path="/warga-login" element={<ResidentLoginPage onLogin={handleLogin} />} />
        <Route path="/register" element={<RegistrationPage />} />
        
        {/* FULL SCREEN ONBOARDING ROUTES */}
        <Route 
          path="/warga/aktivasi" 
          element={
            <RoleGuard user={user} allowedRoles={['warga']}>
              <AccountActivationPage user={user!} onComplete={handleLogin} />
            </RoleGuard>
          } 
        />
        <Route 
          path="/warga/waiting" 
          element={
            <RoleGuard user={user} allowedRoles={['warga']}>
              <WaitingApprovalPage user={user!} onLogout={handleLogout} />
            </RoleGuard>
          } 
        />
        <Route 
          path="/warga/revisi" 
          element={
            <RoleGuard user={user} allowedRoles={['warga']}>
              <RevisionPage user={user!} onLogout={handleLogout} />
            </RoleGuard>
          } 
        />

        <Route 
          path="*" 
          element={
            <div className={`app-layout ${user?.role === 'warga' ? 'is-resident' : ''}`}>
              <Sidebar 
                activePage={location.pathname} 
                onNavigate={(path) => navigate(path)} 
                onLogout={handleLogout} 
                user={user} 
                isOpen={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
              />
              <div className="main-area">
                <Navbar 
                  title={meta.title} 
                  subtitle={meta.subtitle} 
                  user={user} 
                  onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
                  onLogout={handleLogout}
                  hideToggle={user?.role === 'warga'}
                />
                <main className="page-content">
                  <div>
                    <Routes>
                      <Route path="/" element={<Navigate to="/warga/dashboard" replace />} />
                      
                      {/* ADMIN DOMAIN */}
                      <Route path="/admin/dashboard" element={<RoleGuard user={user} allowedRoles={['developer', 'rw', 'rt']}><DashboardPage /></RoleGuard>} />
                      <Route path="/admin/warga" element={<RoleGuard user={user} allowedRoles={['developer', 'rw', 'rt']}><WargaPage /></RoleGuard>} />
                      <Route path="/admin/keluarga" element={<RoleGuard user={user} allowedRoles={['developer', 'rw', 'rt']}><KeluargaPage /></RoleGuard>} />
                      <Route path="/admin/surat" element={<RoleGuard user={user} allowedRoles={['developer', 'rw', 'rt']}><SuratPage /></RoleGuard>} />
                      <Route path="/admin/keuangan" element={<RoleGuard user={user} allowedRoles={['developer', 'rw', 'rt']}><KeuanganPage /></RoleGuard>} />
                      <Route path="/admin/approvals" element={<RoleGuard user={user} allowedRoles={['developer', 'rw', 'rt']}><ApprovalListPage /></RoleGuard>} />
                      <Route path="/admin/approval/:id" element={<RoleGuard user={user} allowedRoles={['developer', 'rw', 'rt']}><AdminApprovalPage /></RoleGuard>} />
                      <Route path="/admin/users" element={<RoleGuard user={user} allowedRoles={['developer', 'rw']}><UserManagementPage /></RoleGuard>} />
                      <Route path="/admin/setting" element={<RoleGuard user={user} allowedRoles={['developer', 'rw', 'rt']}><ProfilePage user={user!} onUpdateUser={handleLogin} /></RoleGuard>} />
                      <Route path="/admin/chat" element={<RoleGuard user={user} allowedRoles={['developer', 'rw', 'rt']}><ChatPage user={user!} /></RoleGuard>} />

                      {/* WARGA DOMAIN */}
                      <Route path="/warga/dashboard" element={<RoleGuard user={user} allowedRoles={['warga']}><ResidentDashboard user={user!} /></RoleGuard>} />
                      <Route path="/warga/setting" element={<RoleGuard user={user} allowedRoles={['warga']}><ProfilePage user={user!} onUpdateUser={handleLogin} /></RoleGuard>} />
                      <Route path="/warga/chat" element={<RoleGuard user={user} allowedRoles={['warga']}><ChatPage user={user!} /></RoleGuard>} />
                      <Route path="/warga/keluarga" element={<RoleGuard user={user} allowedRoles={['warga']}><ResidentFamilyPage user={user!} /></RoleGuard>} />
                      <Route path="/warga/surat" element={<RoleGuard user={user} allowedRoles={['warga']}><SuratPage /></RoleGuard>} />
                      <Route path="/warga/keuangan" element={<RoleGuard user={user} allowedRoles={['warga']}><ResidentKeuangan user={user!} /></RoleGuard>} />

                      <Route path="*" element={<PlaceholderPage title={meta.title} />} />
                    </Routes>
                  </div>
                </main>
              </div>
              {user?.role === 'warga' && <ResidentBottomNav />}
            </div>
          } 
        />
      </Routes>
    </>
  );
}
