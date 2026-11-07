import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './providers';
import { AuthGuard, DashboardGuard, RoleGuard } from './guards';
import { AppShell } from './layout';
import { LoginForm } from '../features/auth';
import { PasswordResetForm } from '../features/auth/components/PasswordResetForm';
import { UpdatePasswordForm } from '../features/auth/components/UpdatePasswordForm';
import { HouseholdsPage } from '../features/households';
import { CarsPage } from '../features/cars';
import { ReviewPage } from '../features/review';
import { TemplatesPage, REPORT_GENERATOR_ROLES } from '../features/templates';
import { DashboardPage } from '../features/dashboard';
import { AuditPage } from '../features/audit';
import { ImportsUnavailablePage } from '../features/imports/components/ImportsUnavailablePage';
import { LandingPage } from '../features/landing';

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
              <DashboardGuard>
                <AppShell>
                  <DashboardPage />
                </AppShell>
              </DashboardGuard>
            }
          />
          <Route
            path="/imports"
            element={
              <AuthGuard>
                <RoleGuard roles={['admin', 'operator']}>
                  <AppShell>
                    <ImportsUnavailablePage />
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
                <RoleGuard roles={REPORT_GENERATOR_ROLES}>
                  <AppShell>
                    <TemplatesPage />
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
          <Route path="/documents" element={<Navigate to="/dashboard" replace />} />
          <Route path="/" element={<LandingPage />} />
          {/* Any other pasted/unknown link falls back to the landing page
              instead of a blank screen. Real 404s never reach here — Vercel
              hands every unmatched path to the SPA via vercel.json rewrites. */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
