import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { User, UserRole } from '../types';

interface RoleGuardProps {
  user: User | null;
  allowedRoles: UserRole[];
  children: React.ReactNode;
}

/**
 * RoleGuard: Protects routes based on UserRole
 */
export const RoleGuard: React.FC<RoleGuardProps> = ({ user, allowedRoles, children }) => {
  const location = useLocation();

  if (!user) {
    return <Navigate to="/warga-login" state={{ from: location }} replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    // Redirect to proper dashboard based on role if not allowed here
    const target = user.role === 'warga' ? '/warga/dashboard' : '/admin/dashboard';
    return <Navigate to={target} replace />;
  }

  return <>{children}</>;
};

/**
 * AreaFilter: Helper to filter data based on user role and area
 */
export function applyAreaFilter(query: any, user: User | null) {
  if (!user) return query;
  
  // RT can only see their own RT
  if (user.role === 'rt' && user.rt_id) {
    return { ...query, rt_id: user.rt_id, rw_id: user.rw_id };
  }
  
  // RW can see all RTs in their RW
  if (user.role === 'rw' && user.rw_id) {
    return { ...query, rw_id: user.rw_id };
  }
  
  // Developer sees everything
  return query;
}
