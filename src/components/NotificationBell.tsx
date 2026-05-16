/**
 * NotificationBell.tsx
 * Real-time admin notification bell with Firestore subscriptions
 */
import React, { useState, useEffect, useRef } from 'react';
import { Bell, CheckCheck, LayoutDashboard, User, FileText } from 'lucide-react';
import { subscribeToNotifications, markNotificationRead, markAllRead } from '../services/notificationService';
import type { Notification } from '../services/notificationService';
import { useNavigate } from 'react-router-dom';

interface Props {
  userRole: string;
}

export default function NotificationBell({ userRole }: Props) {
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const unreadCount = notifs.filter(n => !n.isRead).length;

  // Real-time Firestore subscription
  useEffect(() => {
    const unsub = subscribeToNotifications(userRole, setNotifs);
    return () => unsub();
  }, [userRole]);

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
          position: 'absolute', right: 0, top: 48, width: 340, background: '#fff',
          borderRadius: 14, boxShadow: '0 10px 40px rgba(0,0,0,0.15)', border: '1px solid var(--gray-100)',
          zIndex: 1000, overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>
              Notifikasi
              {unreadCount > 0 && (
                <span style={{ marginLeft: 8, background: 'var(--blue-600)', color: '#fff', fontSize: 10, padding: '2px 7px', borderRadius: 20, fontWeight: 700 }}>
                  {unreadCount} baru
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button onClick={() => markAllRead(userRole)}
                style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--blue-600)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                <CheckCheck size={13} /> Tandai semua
              </button>
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
                  <div style={{
                    width: 34, height: 34, borderRadius: 10, background: n.isRead ? 'var(--gray-100)' : 'var(--blue-100)',
                    color: n.isRead ? 'var(--gray-500)' : 'var(--blue-600)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                  }}>
                    {getIcon(n.type)}
                  </div>
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
