import { NavLink, Outlet } from "react-router-dom";
import "./App.css";

const NAV_ITEMS = [
  { to: "/characters", label: "캐릭터" },
  { to: "/items", label: "아이템" },
  { to: "/maps", label: "맵" },
  { to: "/monsters", label: "야생동물" },
];

export default function App() {
  return (
    <div className="app">
      <nav className="app__nav">
        <h1>Eternal Return 도감</h1>
        <div className="app__nav-links">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => "app__nav-link" + (isActive ? " app__nav-link--active" : "")}
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>
      <main className="app__main">
        <Outlet />
      </main>
    </div>
  );
}
