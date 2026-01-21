import { NavLink } from "react-router-dom";
import ui from "@shared/styles/primitives.module.scss";
import { useAuth } from "@shared";

export function NavBar() {
  const { user } = useAuth();
  return (
    <nav className={ui.nav}>
      <NavLink
        to="/"
        className={({ isActive }) =>
          [ui.navLink, isActive ? ui.navLinkActive : ""].join(" ")
        }
      >
        Portal
      </NavLink>
      {user?.role.includes("admin") && (
        <NavLink
          to="/admin"
          className={({ isActive }) =>
            [ui.navLink, isActive ? ui.navLinkActive : ""].join(" ")
          }
        >
          Admin
        </NavLink>
      )}
      {user?.role.includes("rental_provider") && (
        <NavLink
          to="/employee"
          className={({ isActive }) =>
            [ui.navLink, isActive ? ui.navLinkActive : ""].join(" ")
          }
        >
          Employee
        </NavLink>
      )}
      {user && (
        <NavLink
          to="/messages"
          className={({ isActive }) =>
            [ui.navLink, isActive ? ui.navLinkActive : ""].join(" ")
          }
        >
          Messages
        </NavLink>
      )}

      <NavLink
        to="/account"
        className={({ isActive }) =>
          [ui.navLink, isActive ? ui.navLinkActive : ""].join(" ")
        }
      >
        Account
      </NavLink>
    </nav>
  );
}
