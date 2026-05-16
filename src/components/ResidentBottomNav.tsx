import React from 'react';
import { Home, FileText, Wallet, MessageSquare, User } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

export default function ResidentBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { icon: Home, label: 'Beranda', path: '/warga/dashboard' },
    { icon: FileText, label: 'Surat', path: '/warga/surat' },
    { icon: Wallet, label: 'Iuran', path: '/warga/keuangan' },
    { icon: MessageSquare, label: 'Chat', path: '/warga/chat' },
    { icon: User, label: 'Profil', path: '/warga/setting' },
  ];

  return (
    <div className="resident-bottom-nav">
      {navItems.map((item, index) => {
        const Icon = item.icon;
        const isActive = location.pathname.startsWith(item.path);
        return (
          <div 
            key={index} 
            className={`bottom-nav-item ${isActive ? 'active' : ''}`}
            onClick={() => navigate(item.path)}
          >
            <Icon size={20} className="bottom-nav-icon" />
            <span className="bottom-nav-label">{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}
