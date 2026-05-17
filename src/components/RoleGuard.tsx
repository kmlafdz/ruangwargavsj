import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { User, AdminRole, AccountType } from '../types';

interface RoleGuardProps {
  user: User | null;
  allowedRoles: (AdminRole | AccountType | 'resident')[];
  children: React.ReactNode;
}

/**
 * RoleGuard: Protects routes based on accountType and adminRole
 */
export const RoleGuard: React.FC<RoleGuardProps> = ({ user, allowedRoles, children }) => {
  const location = useLocation();

  if (!user) {
    // If trying to access admin area, redirect to admin login
    const isAdminPath = location.pathname.startsWith('/admin');
    return <Navigate to={isAdminPath ? "/admin/login" : "/warga-login"} state={{ from: location }} replace />;
  }

  const accountType = user.accountType || ((user as any).role === 'warga' ? 'resident' : 'admin');
  const adminRole = user.adminRole || ((user as any).role !== 'warga' ? (user as any).role : undefined);
  
  // Developer punya akses mutlak ke mana saja (Master Key)
  if (adminRole === 'developer') return <>{children}</>;

  const isAllowed = allowedRoles.some(role => {
    if (role === 'resident' || role === 'admin') {
      return accountType === role;
    }
    return adminRole === role;
  });

  if (!isAllowed) {
    const isAdmin = accountType === 'admin' || (user as any).role !== 'warga';
    let target = '/warga/dashboard';
    
    if (isAdmin) {
      target = '/admin/dev/dashboard';
    }
    
    if (location.pathname === target) {
      return (
        <div style={{ padding: '80px 20px', textAlign: 'center', background: '#f8fafc', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: 64, marginBottom: 24 }}>🚫</div>
          <h2 style={{ fontSize: 24, fontWeight: 900, color: '#0f172a', marginBottom: 12 }}>Akses Terbatas</h2>
          <p style={{ color: '#64748b', fontSize: 16, maxWidth: 400, margin: '0 auto 32px', lineHeight: 1.6 }}>
            Maaf, akun Anda tidak memiliki izin untuk mengakses halaman ini. Silakan kembali ke dashboard utama Anda.
          </p>
          <button 
            onClick={() => window.location.href = target}
            style={{ 
              padding: '14px 28px', background: '#2563eb', color: '#fff', border: 'none', 
              borderRadius: 14, fontWeight: 700, fontSize: 15, cursor: 'pointer',
              boxShadow: '0 10px 15px -3px rgba(37, 99, 235, 0.3)'
            }}
          >
            Kembali ke Dashboard
          </button>
        </div>
      );
    }
    
    return <Navigate to={target} replace />;
  }

  return <>{children}</>;
};

/**
 * AreaFilter: Helper to filter data based on user role and area
 */
export function applyAreaFilter(query: any, user: User | null) {
  if (!user) return query;
  
  // RT Admin can only see their own RT
  if (user.accountType === 'admin' && user.adminRole === 'rt' && user.rt_id) {
    return { ...query, rt_id: user.rt_id, rw_id: user.rw_id };
  }
  
  // RW Admin can see all RTs in their RW
  if (user.accountType === 'admin' && user.adminRole === 'rw' && user.rw_id) {
    return { ...query, rw_id: user.rw_id };
  }
  
  // Developer/Resident seeing own data - return as is or add user constraint
  return query;
}
