import React, { useState, useEffect, useRef } from 'react';
import { Menu, Search, Settings, LogOut, User as UserIcon } from 'lucide-react';
import { User } from '../types';
import NotificationBell from './NotificationBell';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

interface NavbarProps {
  title: string;
  subtitle?: string;
  user: User | null;
  onToggleSidebar: () => void;
  onLogout: () => void;
  hideToggle?: boolean;
}

export default function Navbar({ title, subtitle, user, onToggleSidebar, onLogout, hideToggle }: NavbarProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const navigate = useNavigate();

  const [visible, setVisible] = useState(true);
  const lastScrollY = useRef(0);

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

      const scrollDiff = Math.abs(currentScrollY - lastScrollY.current);

      if (currentScrollY <= 10) {
        setVisible(true);
      } else if (scrollDiff > 8) {
        if (currentScrollY > lastScrollY.current) {
          setVisible(false);
        } else {
          setVisible(true);
        }
        lastScrollY.current = currentScrollY;
      }
    };

    window.addEventListener('scroll', handleScroll, true);
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, []);

  const initials = user?.name 
    ? user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase() 
    : 'AD';

  // Map role for notifications
  const notifRole = (user?.accountType === 'admin') 
    ? (user.adminRole === 'rw' || user.adminRole === 'developer' ? 'ketua_rw' : `ketua_rt_${(user.rt_id || '01').slice(-2)}`)
    : 'warga';

  return (
    <>
      {/* Logout Confirmation Modal */}
      <AnimatePresence>
        {showLogoutConfirm && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, zIndex: 5000, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              style={{ background: '#fff', width: '100%', maxWidth: 400, borderRadius: 28, padding: 32, textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}
            >
              <div style={{ position: 'relative', width: 140, height: 140, margin: '0 auto 20px' }}>
                <img 
                  src="/vira_ai_confirm.png" 
                  alt="Vira AI Confirm" 
                  style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '16px' }} 
                />
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 900, color: '#0f172a', marginBottom: 12 }}>Konfirmasi Keluar</h3>
              <p style={{ color: '#64748b', fontSize: 14, lineHeight: 1.6, marginBottom: 32 }}>
                Apakah Anda yakin ingin keluar dari akun <strong>{user?.name}</strong>?
              </p>
              <div style={{ display: 'flex', gap: 12 }}>
                <button 
                  onClick={() => setShowLogoutConfirm(false)}
                  style={{ flex: 1, height: 50, borderRadius: 14, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
                >
                  Batal
                </button>
                <button 
                  onClick={onLogout}
                  style={{ flex: 1, height: 50, borderRadius: 14, border: 'none', background: '#ef4444', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
                >
                  Ya, Keluar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <header
        className="navbar"
        style={{
          zIndex: 90,
          transform: visible ? 'translateY(0)' : 'translateY(-100%)',
          transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <div className="navbar-left" style={{ display: 'flex', alignItems: 'center' }}>
          {!hideToggle && (
            <button className="mobile-toggle" onClick={onToggleSidebar}>
              <Menu size={20} />
            </button>
          )}
          <div>
            <h1>{title}</h1>
            {subtitle && <p className="navbar-subtitle">{subtitle}</p>}
          </div>
        </div>
        <div className="navbar-right">
          {user?.accountType === 'resident' && (
            <div className="navbar-search-resident">
              <Search size={16} />
              <input type="text" placeholder="Cari..." />
            </div>
          )}
          <NotificationBell userRole={notifRole} userId={user?.id} />
          
          <div style={{ position: 'relative' }}>
            <div 
              className="admin-profile" 
              onClick={() => setShowMenu(!showMenu)}
              style={{ cursor: 'pointer' }}
            >
              <div className="admin-avatar">
                {user?.photoUrl ? (
                  <img src={user.photoUrl} alt="Profile" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  initials
                )}
              </div>
              <div className="admin-info">
                <div className="name">{user?.name || 'User'}</div>
                <div className="role">
                  {user?.accountType === 'admin' 
                    ? (user.adminRole?.toUpperCase() || 'ADMIN') 
                    : (user?.communityPosition || 'Warga')}
                </div>
              </div>
            </div>

            <AnimatePresence>
              {showMenu && (
                <>
                  <div 
                    style={{ position: 'fixed', inset: 0, zIndex: 1100 }} 
                    onClick={() => setShowMenu(false)} 
                  />
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    style={{ 
                      position: 'absolute', top: '100%', right: 0, marginTop: 12,
                      width: 220, background: '#fff', borderRadius: 20,
                      boxShadow: '0 10px 25px rgba(0,0,0,0.1)', border: '1px solid #f1f5f9',
                      padding: 8, zIndex: 1101, overflow: 'hidden'
                    }}
                  >
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', marginBottom: 8 }}>
                       <div style={{ fontSize: 13, fontWeight: 900, color: '#1e293b' }}>{user?.name}</div>
                       <div style={{ fontSize: 11, color: '#64748b' }}>
                        {user?.accountType === 'admin' ? user.adminRole?.toUpperCase() : (user?.communityPosition || 'WARGA')}
                       </div>
                    </div>
                    {user?.accountType === 'resident' && (
                      <button 
                        onClick={() => { navigate('/warga/profile'); setShowMenu(false); }}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 14, border: 'none', background: 'transparent', color: '#334155', fontSize: 14, fontWeight: 700, cursor: 'pointer', textAlign: 'left' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <UserIcon size={18} color="#64748b" /> Lihat Profil
                      </button>
                    )}
                    <button 
                      onClick={() => { navigate(user?.accountType === 'resident' ? '/warga/setting' : '/admin/dev/setting'); setShowMenu(false); }}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 14, border: 'none', background: 'transparent', color: '#334155', fontSize: 14, fontWeight: 700, cursor: 'pointer', textAlign: 'left' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <Settings size={18} color="#64748b" /> Pengaturan Akun
                    </button>
                    <div style={{ height: 1, background: '#f1f5f9', margin: '4px 8px' }} />
                    <button 
                      onClick={() => { setShowLogoutConfirm(true); setShowMenu(false); }}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 14, border: 'none', background: 'transparent', color: '#ef4444', fontSize: 14, fontWeight: 700, cursor: 'pointer', textAlign: 'left' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <LogOut size={18} /> Keluar Aplikasi
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>
    </>
  );
}
