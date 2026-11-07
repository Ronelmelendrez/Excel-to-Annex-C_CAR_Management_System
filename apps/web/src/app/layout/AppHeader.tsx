import React, { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { MenuIcon, XIcon } from '../../components/icons';
import { shellContainer } from './shell';
import { useAuth } from '../providers';
import { useScrolledPast } from '../../shared/hooks';

/** Focus ring shared by every interactive element in the header. */
const focusRing =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a1f1f]';

/** Id of the mobile panel, referenced by the toggle's `aria-controls`. */
const MENU_ID = 'app-header-menu';

/** Desktop nav link: compact, underline on hover, underline when active. */
const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'px-1 py-2 text-sm underline-offset-4 transition-colors duration-150 hover:underline',
    focusRing,
    isActive
      ? 'font-semibold text-[#161512] underline decoration-2'
      : 'text-[#3f3b34] hover:text-[#161512]',
  );

/** Mobile menu link: full-width row with a generous tap target. */
const menuLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'block border-b border-[#e2ddd1] px-1 py-3.5 text-base transition-colors duration-150',
    'last:border-b-0',
    focusRing,
    isActive
      ? 'bg-[#ece7dc] font-semibold text-[#161512]'
      : 'text-[#3f3b34] hover:bg-[#f4f1ea] hover:text-[#161512]',
  );

type NavItem = {
  to: string;
  label: string;
  /** Whether the signed-in roles may see this destination. */
  canSee: (roles: string[]) => boolean;
};

const hasAnyRole = (roles: string[], allowed: string[]) =>
  roles.some((role) => allowed.includes(role));

/** Primary navigation, gated by role — order defines the rendered order. */
const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', canSee: () => true },
  {
    to: '/imports',
    label: 'Excel imports',
    canSee: (roles) => hasAnyRole(roles, ['admin', 'operator']),
  },
  {
    to: '/households',
    label: 'Households',
    canSee: (roles) => hasAnyRole(roles, ['admin', 'operator', 'case_worker', 'reviewer', 'auditor']),
  },
  { to: '/cars', label: 'CARs', canSee: (roles) => hasAnyRole(roles, ['admin', 'case_worker']) },
  {
    to: '/templates',
    label: 'Report generator',
    canSee: (roles) => hasAnyRole(roles, ['admin', 'case_worker', 'reviewer']),
  },
  { to: '/audit', label: 'Audit', canSee: (roles) => hasAnyRole(roles, ['admin', 'auditor']) },
];

/** Up to two initials, e.g. "Maria Santos" → "MS"; "staff@x.gov" → "S". */
function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const parts = words.length > 1 ? words.slice(0, 2) : [words[0] ?? name];
  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('') || '?';
}

/** `case_worker` → `CASE WORKER` for the micro label under the name. */
function roleLabelOf(roles: string[]): string {
  if (!roles.length) return 'Signed in';
  return roles.map((role) => role.replace(/_/g, ' ')).join(' · ');
}

type AccountUnitProps = {
  displayName: string;
  roles: string[];
  onSignOut: () => void;
  /** Extra classes for placement — e.g. `hidden lg:flex` in the header row. */
  className?: string;
};

/**
 * Identity cell plus sign-out cell behind a single ink border. Used both in
 * the desktop header row and inside the mobile menu, so the account treatment
 * is identical at every width.
 */
function AccountUnit({ displayName, roles, onSignOut, className }: AccountUnitProps) {
  return (
    <div className={cn('flex items-stretch border border-[#161512] bg-[#fbf9f4]', className)}>
      <div className="flex min-w-0 flex-1 items-center gap-2.5 py-1.5 pl-2 pr-3">
        <span
          aria-hidden="true"
          className="flex h-7 w-7 shrink-0 items-center justify-center bg-[#161512] font-mono text-[10px] font-medium leading-none text-[#f4f1ea]"
        >
          {initialsOf(displayName)}
        </span>
        <span className="flex min-w-0 flex-col">
          <span
            className="max-w-[160px] truncate text-sm font-medium leading-5"
            title={displayName}
          >
            {displayName}
          </span>
          <span className="font-mono text-[10px] uppercase leading-4 tracking-[0.14em] text-[#5b574e]">
            {roleLabelOf(roles)}
          </span>
        </span>
      </div>
      <button
        type="button"
        onClick={onSignOut}
        className={cn(
          'border-l border-[#161512] px-3.5 text-xs font-medium transition-colors duration-150',
          'hover:bg-[#161512] hover:text-[#f4f1ea]',
          focusRing,
        )}
      >
        Sign out
      </button>
    </div>
  );
}

/**
 * Sticky application header: brand, role-gated primary navigation and the
 * account unit. Below `lg` the nav and account collapse into a hamburger
 * menu panel that opens directly under the header row; the panel is only
 * rendered while open so assistive tech never sees two sets of nav links.
 *
 * The panel closes on route change, on Escape (returning focus to the
 * toggle) and on any click outside the header.
 */
export function AppHeader() {
  const { user, profile, roles, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const condensed = useScrolledPast(24);

  const [menuOpen, setMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  const displayName = profile?.display_name || user?.email || 'Unknown user';
  const visibleItems = NAV_ITEMS.filter((item) => item.canSee(roles));

  const handleSignOut = async () => {
    setMenuOpen(false);
    await signOut();
    navigate('/login', { replace: true });
  };

  // Navigating from a menu link must not leave a stale panel behind the
  // new page.
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // While open: Escape closes and hands focus back to the toggle; a
  // pointer-down outside the header dismisses the panel.
  useEffect(() => {
    if (!menuOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setMenuOpen(false);
      toggleRef.current?.focus();
    };
    const onPointerDown = (event: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [menuOpen]);

  return (
    <header
      ref={headerRef}
      className={cn(
        'sticky top-0 z-40 border-b border-[#161512] bg-[#f4f1ea]/95 backdrop-blur',
        'transition-[padding,box-shadow] duration-300 ease-out supports-[backdrop-filter]:bg-[#f4f1ea]/80',
        condensed
          ? 'py-2.5 shadow-[0_1px_0_0_rgba(22,21,18,0.08),0_8px_24px_-12px_rgba(22,21,18,0.35)]'
          : 'py-4 shadow-none',
      )}
    >
      <div
        className={cn(
          shellContainer,
          'flex flex-wrap items-center justify-between gap-x-8 gap-y-3',
        )}
      >
        <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
          <NavLink to="/dashboard" className="group flex items-baseline gap-2">
            <span
              className={cn(
                'font-serif leading-none tracking-tight transition-[font-size,color] duration-300 ease-out group-hover:text-[#7a1f1f]',
                condensed ? 'text-lg' : 'text-xl',
              )}
            >
              Annex C
            </span>
            <span className="hidden font-mono text-[10px] uppercase tracking-[0.18em] text-[#5b574e] sm:inline">
              CAR register
            </span>
          </NavLink>

          <nav
            aria-label="Primary"
            className="hidden flex-wrap items-center gap-x-6 gap-y-1 lg:flex"
          >
            {visibleItems.map((item) => (
              <NavLink key={item.to} to={item.to} className={navLinkClass}>
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <AccountUnit
            displayName={displayName}
            roles={roles}
            onSignOut={handleSignOut}
            className="hidden lg:flex"
          />

          <button
            ref={toggleRef}
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls={menuOpen ? MENU_ID : undefined}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            className={cn(
              'flex h-10 w-10 items-center justify-center border border-[#161512] bg-[#fbf9f4]',
              'transition-colors duration-150 hover:bg-[#161512] hover:text-[#f4f1ea]',
              focusRing,
              'lg:hidden',
            )}
          >
            {menuOpen ? <XIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div
          id={MENU_ID}
          className="border-t border-[#161512] bg-[#f4f1ea] lg:hidden"
        >
          <nav
            aria-label="Primary menu"
            className={cn(shellContainer, 'flex flex-col py-1')}
          >
            {visibleItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMenuOpen(false)}
                className={menuLinkClass}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className={cn(shellContainer, 'border-t border-[#c9c3b6] py-3')}>
            <AccountUnit
              displayName={displayName}
              roles={roles}
              onSignOut={handleSignOut}
            />
          </div>
        </div>
      )}
    </header>
  );
}
