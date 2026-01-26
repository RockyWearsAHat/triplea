import { NavLink } from "react-router-dom";
import ui from "@shared/styles/primitives.module.scss";
import { useAuth } from "@shared";
import { useCart } from "../context/CartContext";

export function NavBar() {
  const { user } = useAuth();
  const { itemCount } = useCart();

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
          <NavLink
            to="/scan-tickets"
            className={({ isActive }) =>
              [ui.navLink, isActive ? ui.navLinkActive : ""].join(" ")
            }
          >
            Scanner
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

      <NavLink
        to="/cart"
        className={({ isActive }) =>
          [ui.navLink, isActive ? ui.navLinkActive : ""].join(" ")
        }
        style={{ position: "relative" }}
      >
        Cart
        {itemCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: -6,
              right: -10,
              background: "var(--gold)",
              color: "#000",
              fontSize: 11,
              fontWeight: 600,
              minWidth: 18,
              height: 18,
              borderRadius: 9,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 4px",
            }}
          >
            {itemCount}
          </span>
        )}
      </NavLink>

      {!user ? (
        <NavLink
          to="/login"
          className={({ isActive }) =>
            [ui.navLink, isActive ? ui.navLinkActive : ""].join(" ")
          }
        >
          Login
        </NavLink>
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
