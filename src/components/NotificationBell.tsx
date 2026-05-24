/**
 * NotificationBell.tsx
 * Real-time admin notification bell with Firestore subscriptions
 */
import React, { useState, useEffect, useRef } from 'react';
import { Bell, CheckCheck, LayoutDashboard, User, FileText, Trash2 } from 'lucide-react';
import { subscribeToNotifications, markNotificationRead, markAllRead, deleteAllNotifications } from '../services/notificationService';
import type { Notification } from '../services/notificationService';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  userRole: string;
  userId?: string;
}

export default function NotificationBell({ userRole, userId }: Props) {
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 480);
  const dropRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Handle window resize dynamically for premium responsive popup placement
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 480);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const unreadCount = notifs.filter(n => !n.isRead).length;

  // Real-time Firestore subscription
  useEffect(() => {
    const unsub = subscribeToNotifications(userRole, userId, setNotifs);
    return () => unsub();
  }, [userRole, userId]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleNotifClick = async (notif: Notification) => {
    await markNotificationRead(notif.id);
    setOpen(false);

    // 1. Citizens (warga) should never be redirected to admin routes (e.g. /admin/...)
    if (userRole === 'warga' && notif.route?.startsWith('/admin')) {
      return;
    }

    // 2. If it is a registration/approval notification and has already been reviewed/approved/rejected, don't redirect
    if (notif.relatedId && (
      notif.type === 'registration' || 
      notif.type === 'approval' || 
      notif.route?.includes('/approval/') || 
      notif.title.toLowerCase().includes('pendaftaran') || 
      notif.title.toLowerCase().includes('registrasi')
    )) {
      try {
        const { doc, getDoc } = await import('firebase/firestore');
        const { db } = await import('../firebase/config');
        const regSnap = await getDoc(doc(db, 'registrations', notif.relatedId));
        if (regSnap.exists()) {
          const regData = regSnap.data();
          if (regData.status && regData.status !== 'pending') {
            // Already reviewed (approved, rejected, auto_approved)! DO NOT redirect.
            return;
          }
        }
      } catch (err) {
        console.error("Gagal memeriksa status peninjauan pendaftaran warga:", err);
      }
    }

    if (notif.route) navigate(notif.route);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'registration': return <User size={14} />;
      case 'approval': return <LayoutDashboard size={14} />;
      case 'surat': return <FileText size={14} />;
      default: return <Bell size={14} />;
    }
  };

  const timeAgo = (date: Date) => {
    const diff = Date.now() - date.getTime();
    const mins = Math.floor(diff / 60000);
    const hrs = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (days > 0) return `${days}h lalu`;
    if (hrs > 0) return `${hrs}j lalu`;
    return `${mins}m lalu`;
  };

  return (
    <div ref={dropRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(p => !p)}
        style={{
          position: 'relative', background: 'var(--gray-100)', border: '1px solid var(--gray-200)',
          borderRadius: 10, width: 38, height: 38, display: 'flex', alignItems: 'center',
          justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s',
          color: 'var(--gray-700)',
        }}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4, background: '#ef4444', color: '#fff',
            fontSize: 10, fontWeight: 800, borderRadius: '50%', width: 18, height: 18,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid #fff', animation: 'pulse 2s infinite',
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: isMobile ? 'fixed' : 'absolute',
          right: isMobile ? 16 : 0,
          left: isMobile ? 16 : 'auto',
          top: isMobile ? 64 : 48,
          width: isMobile ? 'auto' : 340,
          maxWidth: isMobile ? 380 : 'none',
          margin: isMobile ? '0 auto' : '0',
          background: '#fff',
          borderRadius: 14,
          boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
          border: '1px solid var(--gray-100)',
          zIndex: 1000,
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{ 
            padding: '14px 18px', 
            borderBottom: '1px solid var(--gray-100)', 
            display: 'flex', 
            flexDirection: 'column',
            gap: 10
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6, color: '#0f172a' }}>
                Notifikasi
                {unreadCount > 0 && (
                  <span style={{ 
                    background: 'var(--blue-600)', 
                    color: '#fff', 
                    fontSize: 10, 
                    padding: '2px 7px', 
                    borderRadius: 20, 
                    fontWeight: 700,
                    whiteSpace: 'nowrap'
                  }}>
                    {unreadCount} baru
                  </span>
                )}
              </div>
            </div>

            {(unreadCount > 0 || notifs.length > 0) && (
              <div style={{ 
                display: 'flex', 
                gap: 12, 
                alignItems: 'center',
                borderTop: '1px solid #f1f5f9',
                paddingTop: 8
              }}>
                {unreadCount > 0 && (
                  <button onClick={() => markAllRead(userRole)}
                    style={{ 
                      background: 'none', 
                      border: 'none', 
                      fontSize: 11, 
                      color: 'var(--blue-600)', 
                      fontWeight: 700, 
                      cursor: 'pointer', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 4,
                      padding: 0,
                      whiteSpace: 'nowrap'
                    }}>
                    <CheckCheck size={13} /> Tandai dibaca
                  </button>
                )}
                {notifs.length > 0 && (
                  <button onClick={() => deleteAllNotifications(userRole)}
                    style={{ 
                      background: 'none', 
                      border: 'none', 
                      fontSize: 11, 
                      color: '#ef4444', 
                      fontWeight: 700, 
                      cursor: 'pointer', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 4,
                      padding: 0,
                      marginLeft: 'auto',
                      whiteSpace: 'nowrap'
                    }}>
                    <Trash2 size={13} /> Hapus semua
                  </button>
                )}
              </div>
            )}
          </div>

          {/* List */}
          <div style={{ maxHeight: 340, overflowY: 'auto' }}>
            {notifs.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--gray-400)', fontSize: 13 }}>
                <Bell size={32} style={{ margin: '0 auto 12px', opacity: 0.3, display: 'block' }} />
                Belum ada notifikasi
              </div>
            ) : (
              notifs.map(n => (
                <div key={n.id} onClick={() => handleNotifClick(n)}
                  style={{
                    padding: '12px 18px', cursor: 'pointer', transition: 'background 0.15s',
                    background: n.isRead ? '#fff' : 'var(--blue-50)',
                    borderBottom: '1px solid var(--gray-50)',
                    display: 'flex', gap: 12, alignItems: 'flex-start',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--gray-50)')}
                  onMouseLeave={e => (e.currentTarget.style.background = n.isRead ? '#fff' : 'var(--blue-50)')}
                >
                  {n.userPhotoUrl ? (
                    <img 
                      src={n.userPhotoUrl} 
                      alt="Avatar" 
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: '50%',
                        objectFit: 'cover',
                        flexShrink: 0
                      }}
                    />
                  ) : (
                    <div style={{
                      width: 34, height: 34, borderRadius: 10, background: n.isRead ? 'var(--gray-100)' : 'var(--blue-100)',
                      color: n.isRead ? 'var(--gray-500)' : 'var(--blue-600)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                    }}>
                      {getIcon(n.type)}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: n.isRead ? 500 : 700, fontSize: 13, color: 'var(--gray-800)', marginBottom: 2 }}>{n.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--gray-500)', lineHeight: 1.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.message}</div>
                    <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 4 }}>{timeAgo(n.createdAt)}</div>
                  </div>
                  {!n.isRead && (
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--blue-500)', flexShrink: 0, marginTop: 4 }} />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
