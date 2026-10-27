import {
  BookOpen,
  Database,
  LayoutDashboard,
  LineChart,
} from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";

const navigation = [
  { to: "/", label: "Decision Room", icon: LayoutDashboard, end: true },
  { to: "/accuracy", label: "Accuracy Lab", icon: LineChart, end: false },
  { to: "/methodology", label: "Methodology", icon: BookOpen, end: false },
];

export function Layout() {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="sidebar">
        <div className="brand">
          <span className="brand__mark" aria-hidden="true">
            <svg viewBox="0 0 32 32" fill="none" stroke="currentColor">
              <circle cx="16" cy="16" r="10.5" opacity="0.2" />
              <path d="M16 3.5v3M16 25.5v3M3.5 16h3M25.5 16h3" opacity="0.55" />
              <path
                d="M7.5 13h11.25a3.25 3.25 0 1 0-3.25-3.25M7.5 19h15.25a3.25 3.25 0 1 1-3.25 3.25"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <span className="brand__text">
            <strong>WindSight</strong>
            <span>Day-ahead wind intelligence</span>
          </span>
        </div>

        <nav className="nav" aria-label="Primary">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                aria-label={item.label}
                className={({ isActive }) =>
                  `nav__link${isActive ? " is-active" : ""}`
                }
              >
                <Icon size={17} strokeWidth={1.9} aria-hidden="true" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="sidebar__foot">
          <div className="snapshot">
            <Database size={14} aria-hidden="true" />
            <span>Elexon BMRS snapshot</span>
          </div>
          <p>January 2026, national wind</p>
          <p className="sidebar__fine">
            A pilot decision-support build. Not affiliated with Elexon or REint AI.
          </p>
        </div>
      </aside>

      <main className="main" id="main-content" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  );
}
