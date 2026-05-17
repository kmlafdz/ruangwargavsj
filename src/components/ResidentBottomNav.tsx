import React from 'react';
import { Home, FileText, MessageSquare, Megaphone, User } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

export default function ResidentBottomNav({ onTabClick }: { onTabClick?: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { icon: Home, label: 'Beranda', path: '/warga/dashboard' },
    { icon: FileText, label: 'Surat', path: '/warga/surat' },
    { icon: MessageSquare, label: 'Forum', path: '/warga/chat' },
    { icon: Megaphone, label: 'Pengumuman', path: '/warga/pengumuman' },
    { icon: User, label: 'Profil', path: '/warga/profile' },
  ];

  return (
    <div className="resident-bottom-nav">
      {navItems.map((item, index) => {
        const Icon = item.icon;
        const isActive = location.pathname.startsWith(item.path) || (item.label === 'Profil' && location.pathname.startsWith('/warga/setting'));
        return (
          <div 
            key={index} 
            className={`bottom-nav-item ${isActive ? 'active' : ''}`}
            onClick={() => {
              if (onTabClick) onTabClick();
              navigate(item.path);
            }}
          >
            <Icon size={20} className="bottom-nav-icon" />
            <span className="bottom-nav-label">{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}
