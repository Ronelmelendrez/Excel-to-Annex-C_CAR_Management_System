import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../providers';
import { isDemoMode } from '../../shared/supabase';
import { useScrolledPast } from '../../shared/hooks';

const linkBase =
  'px-1 py-2 text-sm underline-offset-[6px] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a1f1f]';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, profile, roles, signOut } = useAuth();
  const navigate = useNavigate();
  const condensed = useScrolledPast(24);
  const canImport = roles.includes('admin') || roles.includes('operator');
  const canViewHouseholds = roles.some((role) =>
    ['admin', 'operator', 'case_worker', 'reviewer', 'auditor'].includes(role),
  );
  const canAuthorCars = roles.includes('admin') || roles.includes('case_worker');
  const canReviewCars = roles.includes('reviewer');
  const canManageTemplates = roles.includes('admin');
  const canViewDocuments = roles.some((role) =>
    ['admin', 'case_worker', 'reviewer', 'auditor'].includes(role),
  );
  const canViewAudit = roles.includes('admin') || roles.includes('auditor');

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#f4f1ea] text-[#161512]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:border focus:border-[#161512] focus:bg-[#f4f1ea] focus:px-3 focus:py-2"
      >
        Skip to content
      </a>

      {isDemoMode && (
        <div className="border-b border-[#161512] bg-[#161512] text-[#f4f1ea]">
          <p className="mx-auto max-w-[1180px] px-4 py-2 font-mono text-[10px] uppercase tracking-[0.16em] sm:px-6">
            Demo build / Supabase not connected / local mock data only
          </p>
        </div>
      )}

      <header
        className={`sticky top-0 z-40 border-b border-[#161512] transition-[background-color,box-shadow] duration-300 ease-out ${
          condensed
            ? 'bg-[#f4f1ea]/95 shadow-[0_1px_0_0_rgba(22,21,18,0.08),0_8px_24px_-12px_rgba(22,21,18,0.35)] backdrop-blur supports-[backdrop-filter]:bg-[#f4f1ea]/80'
            : 'bg-[#f4f1ea] shadow-none'
        }`}
      >
        <div
          className={`mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-x-8 gap-y-3 px-4 transition-[padding] duration-300 ease-out sm:px-6 ${
            condensed ? 'py-2.5' : 'py-4'
          }`}
        >
          <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
            <NavLink to="/dashboard" className="group flex items-baseline gap-2">
              <span
                className={`font-serif leading-none tracking-tight transition-[font-size] duration-300 ease-out ${
                  condensed ? 'text-base' : 'text-lg'
                }`}
              >
                Annex C
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#5b574e]">
                CAR register
              </span>
            </NavLink>

            <nav aria-label="Primary" className="flex items-center gap-5">
              <NavLink
                to="/dashboard"
                className={({ isActive }) =>
                  `${linkBase} ${isActive ? 'font-semibold underline decoration-2' : 'text-[#3f3b34]'}`
                }
              >
                Dashboard
              </NavLink>
              {canImport && (
                <NavLink
                  to="/imports"
                  className={({ isActive }) =>
                    `${linkBase} ${isActive ? 'font-semibold underline decoration-2' : 'text-[#3f3b34]'}`
                  }
                >
                  Excel imports
                </NavLink>
              )}
              {canViewHouseholds && (
                <NavLink
                  to="/households"
                  className={({ isActive }) =>
                    `${linkBase} ${isActive ? 'font-semibold underline decoration-2' : 'text-[#3f3b34]'}`
                  }
                >
                  Households
                </NavLink>
              )}
              {canAuthorCars && (
                <NavLink
                  to="/cars"
                  className={({ isActive }) =>
                    `${linkBase} ${isActive ? 'font-semibold underline decoration-2' : 'text-[#3f3b34]'}`
                  }
                >
                  CARs
                </NavLink>
              )}
              {canReviewCars && (
                <NavLink
                  to="/review"
                  className={({ isActive }) =>
                    `${linkBase} ${isActive ? 'font-semibold underline decoration-2' : 'text-[#3f3b34]'}`
                  }
                >
                  Review queue
                </NavLink>
              )}
              {canManageTemplates && (
                <NavLink
                  to="/templates"
                  className={({ isActive }) =>
                    `${linkBase} ${isActive ? 'font-semibold underline decoration-2' : 'text-[#3f3b34]'}`
                  }
                >
                  Templates
                </NavLink>
              )}
              {canViewDocuments && (
                <NavLink
                  to="/documents"
                  className={({ isActive }) =>
                    `${linkBase} ${isActive ? 'font-semibold underline decoration-2' : 'text-[#3f3b34]'}`
                  }
                >
                  Documents
                </NavLink>
              )}
              {canViewAudit && (
                <NavLink
                  to="/audit"
                  className={({ isActive }) =>
                    `${linkBase} ${isActive ? 'font-semibold underline decoration-2' : 'text-[#3f3b34]'}`
                  }
                >
                  Audit
                </NavLink>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-[0.14em] text-[#5b574e]">Signed in</p>
              <p className="max-w-[220px] truncate text-sm">
                {profile?.display_name || user?.email || 'Unknown user'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className="border border-[#161512] px-3 py-2 text-xs font-medium hover:bg-[#161512] hover:text-[#f4f1ea] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a1f1f]"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-[1180px] px-4 py-8 sm:px-6 sm:py-10">
        {children}
      </main>

      <footer className="mx-auto max-w-[1180px] border-t border-[#c9c3b6] px-4 py-6 text-xs text-[#5b574e] sm:px-6">
        Household data is confidential. Downloads are logged. Do not forward workbooks or reports
        outside authorised staff.
      </footer>
    </div>
  );
}
