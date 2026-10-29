import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './providers';
import { AuthGuard, RoleGuard } from './guards';
import { AppShell } from './layout';
import { LoginForm } from '../features/auth';
import { PasswordResetForm } from '../features/auth/components/PasswordResetForm';
import { UpdatePasswordForm } from '../features/auth/components/UpdatePasswordForm';
import { ImportsPage } from '../features/imports';
import { HouseholdsPage } from '../features/households';
import { CarsPage } from '../features/cars';
import { ReviewPage } from '../features/review';
import { TemplatesPage } from '../features/templates';
import { DocumentsPage } from '../features/documents';
import { DashboardPage } from '../features/dashboard';
import { AuditPage } from '../features/audit';

export function Router() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginForm />} />
          <Route path="/forgot-password" element={<PasswordResetForm />} />
          <Route path="/reset-password" element={<UpdatePasswordForm />} />
          <Route
            path="/dashboard"
            element={
              <AuthGuard>
                <AppShell>
                  <DashboardPage />
                </AppShell>
              </AuthGuard>
            }
          />
          <Route
            path="/imports"
            element={
              <AuthGuard>
                <RoleGuard roles={['admin', 'operator']}>
                  <AppShell>
                    <ImportsPage />
                  </AppShell>
                </RoleGuard>
              </AuthGuard>
            }
          />
          <Route
            path="/households"
            element={
              <AuthGuard>
                <AppShell>
                  <HouseholdsPage />
                </AppShell>
              </AuthGuard>
            }
          />
          <Route
            path="/cars"
            element={
              <AuthGuard>
                <RoleGuard roles={['admin', 'case_worker']}>
                  <AppShell>
                    <CarsPage />
                  </AppShell>
                </RoleGuard>
              </AuthGuard>
            }
          />
          <Route
            path="/review"
            element={
              <AuthGuard>
                <RoleGuard roles={['reviewer']}>
                  <AppShell>
                    <ReviewPage />
                  </AppShell>
                </RoleGuard>
              </AuthGuard>
            }
          />
          <Route
            path="/templates"
            element={
              <AuthGuard>
                <RoleGuard roles={['admin']}>
                  <AppShell>
                    <TemplatesPage />
                  </AppShell>
                </RoleGuard>
              </AuthGuard>
            }
          />
          <Route
            path="/documents"
            element={
              <AuthGuard>
                <RoleGuard roles={['admin', 'case_worker', 'reviewer', 'auditor']}>
                  <AppShell>
                    <DocumentsPage />
                  </AppShell>
                </RoleGuard>
              </AuthGuard>
            }
          />
          <Route
            path="/audit"
            element={
              <AuthGuard>
                <RoleGuard roles={['admin', 'auditor']}>
                  <AppShell>
                    <AuditPage />
                  </AppShell>
                </RoleGuard>
              </AuthGuard>
            }
          />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
