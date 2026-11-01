import { Link, NavLink, Outlet } from "react-router";
import { BackendFooter } from "./BackendFooter";
import { Icon } from "./Icon";

export function Layout() {
  return (
    <div className="app">
      <aside className="sidebar">
        <Link to="/" className="brand">
          <span className="brand-mark">
            <Icon name="check" size={16} />
          </span>
          <span>TaskFlow</span>
        </Link>

        <nav className="nav" aria-label="Main">
          <NavLink to="/" end className="nav-link">
            <Icon name="dashboard" />
            <span>Dashboard</span>
          </NavLink>
          <NavLink to="/tasks" className="nav-link">
            <Icon name="tasks" />
            <span>Tasks</span>
          </NavLink>
          <NavLink to="/activity" className="nav-link">
            <Icon name="activity" />
            <span>Activity</span>
          </NavLink>
        </nav>

        <Link to="/tasks/new" className="btn btn-primary sidebar-cta">
          <Icon name="plus" />
          <span>New task</span>
        </Link>
      </aside>

      <div className="main">
        <main className="content">
          <Outlet />
        </main>
        <BackendFooter />
      </div>
    </div>
  );
}
