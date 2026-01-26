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
        Concerts
      </NavLink>

      {user?.role.includes("customer") && (
        <>
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              [ui.navLink, isActive ? ui.navLinkActive : ""].join(" ")
            }
          >
            Host
          </NavLink>
          <NavLink
            to="/events"
            className={({ isActive }) =>
              [ui.navLink, isActive ? ui.navLinkActive : ""].join(" ")
            }
          >
            Events
          </NavLink>
        </>
      )}

      {user && (
        <>
          <NavLink
            to="/messages"
            className={({ isActive }) =>
              [ui.navLink, isActive ? ui.navLinkActive : ""].join(" ")
            }
          >
            Messages
          </NavLink>
          <NavLink
            to="/my-tickets"
            className={({ isActive }) =>
              [ui.navLink, isActive ? ui.navLinkActive : ""].join(" ")
            }
          >
            My tickets
          </NavLink>
        </>
      )}

      {!user ? (
        <>
          <NavLink
            to="/login"
            className={({ isActive }) =>
              [ui.navLink, isActive ? ui.navLinkActive : ""].join(" ")
            }
          >
            Login
          </NavLink>
          <NavLink
            to="/register"
            className={({ isActive }) =>
              [ui.navLink, isActive ? ui.navLinkActive : ""].join(" ")
            }
          >
            Register
          </NavLink>
        </>
      ) : (
        <NavLink
          to="/account"
          className={({ isActive }) =>
            [ui.navLink, isActive ? ui.navLinkActive : ""].join(" ")
          }
        >
          Account
        </NavLink>
      )}
    </nav>
  );
}

export default NavBar;
