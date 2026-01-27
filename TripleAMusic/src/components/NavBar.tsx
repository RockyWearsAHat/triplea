import { NavLink } from "react-router-dom";
import ui from "@shared/styles/primitives.module.scss";
import { useAuth } from "@shared";
import { useCart } from "../context/CartContext";
import {
  Music,
  LayoutDashboard,
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
  const isHost = user?.role.includes("customer");

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

      {isHost && (
        <NavLink
          to="/manage"
          className={({ isActive }) =>
            [ui.navLink, isActive ? ui.navLinkActive : ""].join(" ")
          }
        >
          <LayoutDashboard size={18} />
          <span className={styles.navLabel}>Manage</span>
        </NavLink>
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
            <span className={styles.navLabel}>Tickets</span>
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
        <span className={styles.cartIconWrapper}>
          <ShoppingCart size={18} />
          {itemCount > 0 && <span className={styles.cartBadge} />}
        </span>
        <span className={styles.navLabel}>Cart</span>
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
