import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
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

function Dashboard() {
  return (
    <div className="max-w-[680px]">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#5b574e]">
        Case register / dashboard
      </p>
      <h1 className="mt-3 font-serif text-4xl leading-[1.05] tracking-tight sm:text-5xl">
        The dashboard is not wired to records yet.
      </h1>
      <p className="mt-5 max-w-[52ch] text-[15px] leading-7 text-[#3f3b34]">
        Household review and CAR authoring now have local mock screens. Dashboard metrics remain
        unwired until the app has persisted records, so this page deliberately shows no invented numbers.
      </p>
      <p className="mt-8">
        <Link
          to="/imports"
          className="inline-block border border-[#161512] bg-[#161512] px-4 py-3 text-sm text-[#f4f1ea] hover:bg-[#7a1f1f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a1f1f]"
        >
          Go to Excel imports
        </Link>
        <Link
          to="/cars"
          className="ml-3 inline-block border border-[#161512] px-4 py-3 text-sm hover:bg-[#e6e0d4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a1f1f]"
        >
          Open CAR drafts
        </Link>
      </p>
    </div>
  );
}

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
                  <Dashboard />
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
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
