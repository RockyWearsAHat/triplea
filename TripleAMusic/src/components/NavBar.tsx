import { NavLink } from "react-router-dom";
import ui from "@shared/styles/primitives.module.scss";
import { useAuth } from "@shared";
import { useCart } from "../context/CartContext";
import {
  Music,
  LayoutDashboard,
  CalendarDays,
  ScanLine,
  MessageSquare,
  Ticket,
  ShoppingCart,
  LogIn,
  User,
} from "lucide-react";

import styles from "./NavBar.module.scss";

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
        <Music size={18} />
        <span className={styles.navLabel}>Concerts</span>
      </NavLink>

      {user?.role.includes("customer") && (
        <>
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              [ui.navLink, isActive ? ui.navLinkActive : ""].join(" ")
            }
          >
            <LayoutDashboard size={18} />
            <span className={styles.navLabel}>Host</span>
          </NavLink>
          <NavLink
            to="/events"
            className={({ isActive }) =>
              [ui.navLink, isActive ? ui.navLinkActive : ""].join(" ")
            }
          >
            <CalendarDays size={18} />
            <span className={styles.navLabel}>Events</span>
          </NavLink>
          <NavLink
            to="/scan-tickets"
            className={({ isActive }) =>
              [ui.navLink, isActive ? ui.navLinkActive : ""].join(" ")
            }
          >
            <ScanLine size={18} />
            <span className={styles.navLabel}>Scanner</span>
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
            <MessageSquare size={18} />
            <span className={styles.navLabel}>Messages</span>
          </NavLink>
          <NavLink
            to="/my-tickets"
            className={({ isActive }) =>
              [ui.navLink, isActive ? ui.navLinkActive : ""].join(" ")
            }
          >
            <Ticket size={18} />
            <span className={styles.navLabel}>My Tickets</span>
          </NavLink>
        </>
      )}

      <NavLink
        to="/cart"
        className={({ isActive }) =>
          [ui.navLink, styles.cartLink, isActive ? ui.navLinkActive : ""].join(
            " ",
          )
        }
      >
        <ShoppingCart size={18} />
        <span className={styles.navLabel}>Cart</span>
        {itemCount > 0 && <span className={styles.cartBadge}>{itemCount}</span>}
      </NavLink>

      {!user ? (
        <NavLink
          to="/login"
          className={({ isActive }) =>
            [ui.navLink, isActive ? ui.navLinkActive : ""].join(" ")
          }
        >
          <LogIn size={18} />
          <span className={styles.navLabel}>Login</span>
        </NavLink>
      ) : (
        <NavLink
          to="/account"
          className={({ isActive }) =>
            [ui.navLink, isActive ? ui.navLinkActive : ""].join(" ")
          }
        >
          <User size={18} />
          <span className={styles.navLabel}>Account</span>
        </NavLink>
      )}
    </nav>
  );
}

export default NavBar;
