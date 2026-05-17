import React, { useState } from 'react';
import {
  LayoutDashboard, Users, UserCheck,
  FileText, Wallet, MessageSquare,
  Calendar, PieChart, Shield,
  Settings, LogOut, ChevronDown, ChevronRight,
  User as UserIcon, Bell, HelpCircle, Megaphone
} from 'lucide-react';
import { User, AdminRole, AccountType } from '../types';
import logo from '../assets/login/logo.png';

interface NavItem {
  icon: any;
  label: string;
  path: string;
  allowedTypes?: AccountType[];
  adminRoles?: AdminRole[];
  subItems?: { label: string; path: string; allowedTypes?: AccountType[]; adminRoles?: AdminRole[] }[];
}

const NAV_ITEMS = (user: User | null): NavItem[] => {
  const isAdmin = user?.accountType === 'admin';
  let dashboardPath = '/warga/dashboard';

  if (isAdmin) {
    dashboardPath = '/admin/dev/dashboard';
  }

  const prefix = isAdmin ? '/admin/dev' : '/warga';

  return [
    {
      icon: LayoutDashboard,
      label: 'Dashboard',
      path: dashboardPath
    },

    // ADMIN DOMAIN ITEMS
    {
      icon: Users,
      label: 'Manajemen Warga',
      path: '/admin/dev/warga-group',
      allowedTypes: ['admin'],
      adminRoles: ['developer', 'rw', 'rt'],
      subItems: [
        { label: 'Persetujuan Warga', path: '/admin/dev/approvals', adminRoles: ['developer', 'rw', 'rt'] },
        { label: 'Data Warga', path: '/admin/dev/warga', adminRoles: ['developer', 'rw', 'rt'] },
        { label: 'Data Keluarga / KK', path: '/admin/dev/keluarga', adminRoles: ['developer', 'rw', 'rt'] }
      ]
    },
    {
      icon: Shield,
      label: 'Manajemen Admin',
      path: '/admin/dev/users',
      allowedTypes: ['admin'],
      adminRoles: ['developer', 'rw']
    },

    // WARGA DOMAIN ITEMS
    { icon: UserIcon, label: 'Profil Saya', path: '/warga/dashboard', allowedTypes: ['resident'] },
    { icon: Users, label: 'Data Keluarga', path: '/warga/keluarga', allowedTypes: ['resident'] },

    // COMMON ITEMS (Prefix Adjusted)
    {
      icon: FileText,
      label: 'Administrasi Surat',
      path: `${prefix}/surat`,
    },
    {
      icon: MessageSquare,
      label: 'Chat Warga',
      path: `${prefix}/chat`,
    },
    {
      icon: Wallet,
      label: isAdmin ? 'Keuangan RW/RT' : 'Keuangan & Iuran',
      path: `${prefix}/keuangan`,
    },
    { icon: MessageSquare, label: 'Pengaduan', path: `${prefix}/pengaduan` },
    { icon: Megaphone, label: 'Pengumuman', path: `${prefix}/pengumuman` },
    { icon: HelpCircle, label: 'Kritik & Saran', path: `${prefix}/feedback` },

    // RESIDENT ONLY
    { icon: Bell, label: 'Notifikasi', path: '/warga/notifications', allowedTypes: ['resident'] },
    { icon: HelpCircle, label: 'Bantuan', path: '/warga/bantuan', allowedTypes: ['resident'] },

    // SETTINGS
    { icon: Settings, label: 'Pengaturan', path: `${prefix}/setting` },
  ];
};


interface SidebarProps {
  activePage: string;
  onNavigate: (path: string) => void;
  onLogout: () => void;
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ activePage, onNavigate, onLogout, user, isOpen, onClose }: SidebarProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const getRoleBadge = () => {
    if (user?.accountType === 'admin') {
      const role = user.adminRole;
      if (role === 'developer') return { label: '👨‍💻 Developer', color: 'var(--purple-600)', bg: 'var(--purple-50)' };
      if (role === 'rw') return { label: 'Ketua RW', color: 'var(--blue-600)', bg: 'var(--blue-50)' };
      if (role === 'rt') return { label: `Ketua RT ${user.rt_id}`, color: 'var(--green-600)', bg: 'var(--green-50)' };
    }
    // For residents, use communityPosition badge
    const pos = user?.communityPosition;
    if (pos) {
      const posLower = pos.toLowerCase();
      if (posLower === 'ketua_rw') {
        return { label: 'Ketua RW', color: 'var(--blue-600)', bg: 'var(--blue-50)' };
      }
      if (posLower.startsWith('ketua_rt_')) {
        const rtNum = posLower.split('_')[2];
        return { label: `Ketua RT ${rtNum}`, color: 'var(--green-600)', bg: 'var(--green-50)' };
      }
      if (posLower === 'ketua_rt') {
        return { label: 'Ketua RT', color: 'var(--green-600)', bg: 'var(--green-50)' };
      }
      return { label: pos.replace(/_/g, ' '), color: 'var(--gray-600)', bg: 'var(--gray-50)' };
    }
    return { label: 'Warga', color: 'var(--gray-600)', bg: 'var(--gray-50)' };
  };

  const badge = getRoleBadge();

  const handleNavClick = (item: NavItem) => {
    if (item.subItems) {
      setExpanded(expanded === item.path ? null : item.path);
    } else {
      onNavigate(item.path);
      if (window.innerWidth <= 768) onClose();
    }
  };

  const handleSubClick = (path: string) => {
    onNavigate(path);
    if (window.innerWidth <= 768) onClose();
  };

  const isSubActive = (item: NavItem) => item.subItems?.some(s => s.path === activePage);

  const isItemAllowed = (item: NavItem | { allowedTypes?: AccountType[]; adminRoles?: AdminRole[] }) => {
    if (!user) return false;

    // Check type allowance
    if (item.allowedTypes && !item.allowedTypes.includes(user.accountType)) {
      return false;
    }

    // Check admin role allowance
    if (item.adminRoles && (!user.adminRole || !item.adminRoles.includes(user.adminRole))) {
      return false;
    }

    return true;
  };

  return (
    <>
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-logo" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="brand-icon">
                <img src={logo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </div>
              <div className="brand-text">
                <div className="title">Ruang Warga VSJ</div>
                <div className="subtitle">Villa Samudra Jaya</div>
              </div>
            </div>
          </div>
        </div>

        {/* User Info removed as requested */}


        <nav className="sidebar-nav">
          <div className="nav-section-title">Menu Navigasi</div>
          {NAV_ITEMS(user).filter(isItemAllowed).map((item) => {
            const Icon = item.icon;
            const isExpanded = expanded === item.path || isSubActive(item);
            const isActive = activePage === item.path || isSubActive(item);

            return (
              <div key={item.path} className="nav-group">
                <div
                  className={`nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => handleNavClick(item)}
                >
                  <Icon className="nav-icon" size={18} />
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {item.subItems && (isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
                </div>

                {item.subItems && isExpanded && (
                  <div className="sub-nav">
                    {item.subItems
                      .filter(isItemAllowed)
                      .map(sub => (
                        <div key={sub.path} className={`sub-nav-item ${activePage === sub.path ? 'active' : ''}`} onClick={() => handleSubClick(sub.path)}>
                          {sub.label}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <button className="logout-btn" onClick={onLogout}>
            <LogOut size={17} />
            <span>Keluar Sistem</span>
          </button>
          <div style={{
            marginTop: 16,
            paddingTop: 16,
            borderTop: '1px solid var(--gray-100)',
            fontSize: 9,
            color: 'var(--gray-400)',
            textAlign: 'center',
            fontWeight: 600,
            letterSpacing: 0.5
          }}>
            © 2026 MUHAMMAD KEMAL AFRILIDZI
          </div>
        </div>
      </aside>
      {isOpen && <div className="sidebar-overlay" onClick={onClose} />}
    </>
  );
}
