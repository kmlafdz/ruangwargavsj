import React from 'react';

export type CommunityPosition = 'warga' | 'ketua_rw' | 'ketua_rt' | 'sekretaris' | 'bendahara' | 'keamanan' | 'pengurus_rw' | 'pengurus_rt';

interface SocialBadgeProps {
  position?: string;
  rt_id?: string;
  className?: string;
  style?: React.CSSProperties;
}

export const SocialBadge: React.FC<SocialBadgeProps> = ({ position, rt_id, className, style }) => {
  if (!position || position === 'warga') return null;

  const getBadgeStyle = () => {
    const posLower = position.toLowerCase();
    
    if (posLower === 'ketua_rw') {
      return { icon: '', label: 'Ketua RW', color: '#f59e0b', bg: '#fef3c7', border: '#fcd34d' };
    }
    if (posLower === 'ketua_rt' || posLower.startsWith('ketua_rt_')) {
      const rtNum = posLower.startsWith('ketua_rt_') ? posLower.split('_')[2] : (rt_id || '');
      return { icon: '', label: `Ketua RT ${rtNum}`, color: '#059669', bg: '#d1fae5', border: '#6ee7b7' };
    }
    if (posLower === 'sekretaris') {
      return { icon: '', label: 'Sekretaris', color: '#2563eb', bg: '#dbeafe', border: '#93c5fd' };
    }
    if (posLower === 'bendahara') {
      return { icon: '', label: 'Bendahara', color: '#7c3aed', bg: '#ede9fe', border: '#c4b5fd' };
    }
    if (posLower === 'keamanan') {
      return { icon: '', label: 'Keamanan', color: '#dc2626', bg: '#fee2e2', border: '#fca5a5' };
    }
    if (posLower === 'pengurus_rw') {
      return { icon: '', label: 'Pengurus RW', color: '#4b5563', bg: '#f3f4f6', border: '#d1d5db' };
    }
    if (posLower === 'pengurus_rt') {
      return { icon: '', label: 'Pengurus RT', color: '#4b5563', bg: '#f3f4f6', border: '#d1d5db' };
    }
    
    return { icon: '', label: position.replace(/_/g, ' '), color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb' };
  };

  const badge = getBadgeStyle();

  return (
    <div 
      className={`social-badge ${className || ''}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 8px',
        borderRadius: '50px',
        fontSize: '11px',
        fontWeight: 700,
        color: badge.color,
        background: badge.bg,
        border: `1px solid ${badge.border}`,
        textTransform: 'uppercase',
        letterSpacing: '0.02em',
        ...style
      }}
    >
      {badge.icon && <span>{badge.icon}</span>}
      <span>{badge.label}</span>
    </div>
  );
};
