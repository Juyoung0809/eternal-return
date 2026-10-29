import { Link, NavLink, Outlet } from "react-router-dom";
import "./App.css";

const NAV_ITEMS = [
  { to: "/characters", label: "실험체" },
  { to: "/items", label: "아이템" },
  { to: "/routes", label: "루트" },
];

export default function App() {
  return (
    <div className="app">
      <header className="app__header">
        <div className="app__header-inner">
          <Link to="/" className="app__brand">
            <span className="app__logo">ER</span>
            <span className="app__title">이터널 리턴 도감</span>
          </Link>
          <nav className="app__nav">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => "app__nav-link" + (isActive ? " app__nav-link--active" : "")}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="app__main">
        <Outlet />
      </main>
    </div>
  );
}
