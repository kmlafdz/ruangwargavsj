import React from 'react';
import { Menu, Search } from 'lucide-react';
import { User } from '../types';
import NotificationBell from './NotificationBell';

interface NavbarProps {
  title: string;
  subtitle?: string;
  user: User | null;
  onToggleSidebar: () => void;
  hideToggle?: boolean;
}

export default function Navbar({ title, subtitle, user, onToggleSidebar, hideToggle }: NavbarProps) {
  const initials = user?.name 
    ? user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase() 
    : 'AD';

  // Map role for notifications
  const notifRole = (user?.role === 'rw' || user?.role === 'developer') 
    ? 'ketua_rw' 
    : (user?.role === 'rt' || (user?.role && user.role.toUpperCase().includes('RT')))
      ? `ketua_rt_${(user?.rt_id || user?.role?.split(' ').pop() || '01').slice(-2)}`
      : 'warga';


  return (
    <header className="navbar">
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
        {user?.role === 'warga' && (
          <div className="navbar-search-resident">
            <Search size={16} />
            <input type="text" placeholder="Cari..." />
          </div>
        )}
        <NotificationBell userRole={notifRole} />
        <div className="admin-profile" onClick={() => window.location.href = user?.role === 'warga' ? '/warga/setting' : '/admin/setting'}>
          <div className="admin-avatar">
            {user?.photoUrl ? (
              <img src={user.photoUrl} alt="Profile" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              initials
            )}
          </div>
          <div className="admin-info">
            <div className="name">{user?.name || 'Admin RW'}</div>
            <div className="role">
              {user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Administrator'}
            </div>
          </div>
        </div>

      </div>
    </header>
  );
}
