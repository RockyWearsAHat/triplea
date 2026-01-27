import { NavLink } from "react-router-dom";
import ui from "@shared/styles/primitives.module.scss";
import { useAuth } from "@shared";
import { Home, MessageSquare, LogIn, User, Settings } from "lucide-react";

export function NavBar() {
  const { user } = useAuth();
  const isAdmin = user?.role.includes("admin");
  const isEmployee = user?.role.includes("rental_provider");

  return (
    <nav className={ui.nav}>
      <NavLink
        to="/"
        className={({ isActive }) =>
          [ui.navLink, isActive ? ui.navLinkActive : ""].join(" ")
        }
      >
        <Home size={18} />
        <span>Home</span>
      </NavLink>

      {user && (
        <NavLink
          to="/messages"
          className={({ isActive }) =>
            [ui.navLink, isActive ? ui.navLinkActive : ""].join(" ")
          }
        >
          <MessageSquare size={18} />
          <span>Messages</span>
        </NavLink>
      )}

      {isAdmin && (
        <NavLink
          to="/admin"
          className={({ isActive }) =>
            [ui.navLink, isActive ? ui.navLinkActive : ""].join(" ")
          }
        >
          <Settings size={18} />
          <span>Admin</span>
        </NavLink>
      )}

      {isEmployee && !isAdmin && (
        <NavLink
          to="/employee"
          className={({ isActive }) =>
            [ui.navLink, isActive ? ui.navLinkActive : ""].join(" ")
          }
        >
          <Settings size={18} />
          <span>Dashboard</span>
        </NavLink>
      )}

      {!user ? (
        <NavLink
          to="/login"
          className={({ isActive }) =>
            [ui.navLink, isActive ? ui.navLinkActive : ""].join(" ")
          }
        >
          <LogIn size={18} />
          <span>Login</span>
        </NavLink>
      ) : (
        <NavLink
          to="/account"
          className={({ isActive }) =>
            [ui.navLink, isActive ? ui.navLinkActive : ""].join(" ")
          }
        >
          <User size={18} />
          <span>Account</span>
        </NavLink>
      )}
    </nav>
  );
}
