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
  { to: '/farmers', label: 'Farmer Database', Icon: IconFarmers, roles: ['LOAN_OFFICER', 'ADMIN', 'CREDIT_MANAGER'] },
  { to: '/applications', label: 'Loan Queue', Icon: IconApplications, roles: ['LOAN_OFFICER', 'CREDIT_MANAGER', 'ADMIN'] },
  { to: '/score', label: 'Run Score', Icon: IconScore, roles: ['LOAN_OFFICER', 'ADMIN'] },
  { to: '/history', label: 'Decision History', Icon: IconHistory, roles: ['CREDIT_MANAGER', 'ADMIN'] },
  { to: '/reports', label: 'Portfolio Reports', Icon: IconReports, roles: ['CREDIT_MANAGER', 'ADMIN'] },
];

function topbarForPath(pathname) {
  if (pathname === '/' || pathname === '') return { kicker: 'Overview', title: 'Dashboard' };
  if (pathname.startsWith('/farmers/new')) return { kicker: 'Agent View', title: 'Onboard New Farmer' };
  if (pathname.startsWith('/farmers')) return { kicker: 'Portfolio', title: 'Farmer Profile' };
  if (pathname === '/applications/new') return { kicker: 'Agent View', title: 'Create Application' };
  if (pathname === '/applications') return { kicker: 'Review', title: 'Loan Application Queue' };
  if (pathname.startsWith('/applications/')) return { kicker: 'Review', title: 'Detailed Assessment' };
  if (pathname === '/score') return { kicker: 'Wizard', title: 'Fin-Agri Scoring Engine' };
  if (pathname === '/history') return { kicker: 'Auditing', title: 'Credit Committee Logs' };
  if (pathname === '/reports') return { kicker: 'Intelligence', title: 'Bank Portfolio Reports' };
  return { kicker: 'Fin-Agri Score', title: 'Portfolio Management' };
}

export default function AppLayout() {
  const [navOpen, setNavOpen] = useState(false);
  const { pathname } = useLocation();
  const top = useMemo(() => topbarForPath(pathname), [pathname]);
  const { user, authDisabled, logout, setUser } = useAuth();
  
  const role = user?.role || 'LOAN_OFFICER';
  const displayName = user?.username || 'Authenticated User';

  const filteredNav = useMemo(() => {
    return NAV.filter(item => !item.roles || item.roles.includes(role));
  }, [role]);

  return (
    <div className={`app-shell ${navOpen ? 'nav-open' : ''} is-role-${role.toLowerCase()}`}>
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
          <div className="logo">{role === 'LOAN_OFFICER' ? 'FA' : 'BM'}</div>
          <div>
            <div className="brand-title">Fin-Agri Score</div>
            <div className="brand-sub">
              {role === 'LOAN_OFFICER' ? 'Agri-Agent Workspace' : 
               role === 'CREDIT_MANAGER' ? 'Risk Management Panel' : 
               'System Administration'}
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {filteredNav.map((item) => (
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
          <div className="sf-role">{role.replace('_', ' ')}</div>
          <div className="sf-name">{displayName}</div>
          <div className="sf-sub">Enterprise Hub</div>
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
