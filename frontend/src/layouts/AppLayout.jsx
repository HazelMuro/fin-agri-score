/**
 * Shell layout: sidebar navigation, branding, signed-in footer, mobile drawer trigger, theme toggle.
 * Child routes render in <Outlet /> inside main content.
 */

import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import ThemeToggle from '../components/ThemeToggle';
import {
  IconApplications,
  IconDashboard,
  IconFarmers,
  IconHistory,
  IconReports,
  IconScore,
} from '../components/NavIcons';

const NAV = [
  { to: '/', label: 'Dashboard', Icon: IconDashboard, end: true },
  { to: '/farmers', label: 'Farmers', Icon: IconFarmers },
  { to: '/applications', label: 'Applications', Icon: IconApplications },
  { to: '/score', label: 'Score application', Icon: IconScore },
  { to: '/history', label: 'History', Icon: IconHistory },
  { to: '/reports', label: 'Reports', Icon: IconReports },
];

function topbarForPath(pathname) {
  if (pathname === '/' || pathname === '') return { kicker: 'Overview', title: 'Dashboard' };
  if (pathname.startsWith('/farmers/new')) return { kicker: 'Farmers', title: 'Register farmer' };
  if (pathname.startsWith('/farmers')) return { kicker: 'Farmers', title: 'Farmer profile' };
  if (pathname === '/applications/new') return { kicker: 'Applications', title: 'New application' };
  if (pathname === '/applications') return { kicker: 'Applications', title: 'Loan applications' };
  if (pathname.startsWith('/applications/')) return { kicker: 'Applications', title: 'Application' };
  if (pathname === '/score') return { kicker: 'Risk Model', title: 'Fin-Agri Assessment' };
  if (pathname === '/history') return { kicker: 'Audit Trail', title: 'Assessment History' };
  if (pathname === '/reports') return { kicker: 'Intelligence', title: 'Reports & Exports' };
  return { kicker: 'Fin-Agri Score', title: 'Portfolio Management' };
}

export default function AppLayout() {
  const [navOpen, setNavOpen] = useState(false);
  const { pathname } = useLocation();
  const top = useMemo(() => topbarForPath(pathname), [pathname]);
  const { user, authDisabled, logout } = useAuth();
  const displayName = user?.username || 'Loan officer';

  return (
    <div className={`app-shell ${navOpen ? 'nav-open' : ''}`}>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <button
        type="button"
        className="sidebar-scrim"
        aria-label="Close navigation"
        onClick={() => setNavOpen(false)}
      />
      <aside id="app-sidebar-nav" className="sidebar" aria-label="Main navigation">
        <div className="sidebar-brand">
          <div className="logo">FA</div>
          <div>
            <div className="brand-title">Fin-Agri Score</div>
            <div className="brand-sub">Zimbabwe · Agricultural credit</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setNavOpen(false)}
              className={({ isActive }) => (isActive ? 'is-active' : '')}
            >
              <span className="nav-icon">
                <item.Icon />
              </span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sf-role">Signed in as</div>
          <div className="sf-name">{displayName}</div>
          <div className="sf-sub">{authDisabled ? 'Enterprise Workspace' : 'Authenticated Session'}</div>
          {/* Removed sign out button from here */}
        </div>
      </aside>

      <main id="main-content" className="main-area" tabIndex={-1}>
        <header className="topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="sidebar-toggle"
              aria-label={navOpen ? 'Close navigation' : 'Open navigation'}
              aria-expanded={navOpen}
              aria-controls="app-sidebar-nav"
              onClick={() => setNavOpen((open) => !open)}
            >
              ☰
            </button>
            <div>
              <div className="tb-kicker">{top.kicker}</div>
              <div className="tb-title">{top.title}</div>
            </div>
          </div>
          <div className="flex gap-2 items-center">
            <button type="button" className="btn btn-ghost btn-sm" onClick={logout}>Logout</button>
            <ThemeToggle compact />
          </div>
        </header>

        <div className="main-area-body">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
