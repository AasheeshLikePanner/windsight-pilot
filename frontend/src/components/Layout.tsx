import {
  BookOpen,
  Database,
  LayoutDashboard,
  LineChart,
  Wind,
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
      <aside className="sidebar">
        <div className="brand">
          <span className="brand__mark" aria-hidden="true">
            <Wind size={21} strokeWidth={2.2} />
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
          <p>January 2026 · national wind</p>
          <p className="sidebar__fine">
            A pilot decision-support build. Not affiliated with Elexon or REint AI.
          </p>
        </div>
      </aside>

      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
