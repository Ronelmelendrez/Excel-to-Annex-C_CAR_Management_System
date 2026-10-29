import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../providers';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { session, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // CRITICAL: block disabled accounts that somehow obtained a session.
  if (profile?.status === 'disabled') {
    return <Navigate to="/login?disabled=1" replace />;
  }

  return <>{children}</>;
}

export function RoleGuard({ children, roles }: { children: React.ReactNode; roles: string[] }) {
  const { session, profile, roles: userRoles, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Block disabled accounts.
  if (profile?.status === 'disabled') {
    return <Navigate to="/login?disabled=1" replace />;
  }

  // Enforce role membership — defense in depth: even if the UI hides a route,
  // the guard must still deny access.
  const hasRequiredRole = roles.some((r) => userRoles.includes(r));
  if (!hasRequiredRole) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
