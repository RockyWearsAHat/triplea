import { NavLink } from "react-router-dom";
import ui from "@shared/styles/primitives.module.scss";
import { useAuth } from "@shared";
import React from "react";
import { createApiClient } from "../lib/urls";

export function NavBar() {
  const { user } = useAuth();
  const api = React.useMemo(() => createApiClient(), []);
  const [isSetupComplete, setIsSetupComplete] = React.useState(false);
  const [checkingSetup, setCheckingSetup] = React.useState(true);

  React.useEffect(() => {
    if (!user?.role.includes("musician")) {
      setCheckingSetup(false);
      setIsSetupComplete(false);
      return;
    }

    let cancelled = false;
    async function checkSetup() {
      try {
        const [stripe, profile] = await Promise.all([
          api.getMusicianStripeStatus(),
          api.getMyMusicianProfile(),
        ]);
        if (cancelled) return;
        const stripeReady = !!stripe.chargesEnabled && !!stripe.payoutsEnabled;
        const profileReady =
          (profile.instruments?.length ?? 0) > 0 &&
          (profile.genres?.length ?? 0) > 0 &&
          !!profile.bio?.trim();
        setIsSetupComplete(stripeReady && profileReady);
      } catch {
        if (!cancelled) setIsSetupComplete(false);
      } finally {
        if (!cancelled) setCheckingSetup(false);
      }
    }

    void checkSetup();
    return () => {
      cancelled = true;
    };
  }, [api, user]);

  const isMusicianWithSetup =
    user?.role.includes("musician") && isSetupComplete;
  const isMusicianWithoutSetup =
    user?.role.includes("musician") && !checkingSetup && !isSetupComplete;

  return (
    <nav className={ui.nav}>
      <NavLink
        to="/"
        className={({ isActive }) =>
          [ui.navLink, isActive ? ui.navLinkActive : ""].join(" ")
        }
      >
        Home
      </NavLink>

      {isMusicianWithoutSetup && (
        <NavLink
          to="/onboarding"
          className={({ isActive }) =>
            [ui.navLink, isActive ? ui.navLinkActive : ""].join(" ")
          }
        >
          Setup
        </NavLink>
      )}

      {isMusicianWithSetup && (
        <>
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              [ui.navLink, isActive ? ui.navLinkActive : ""].join(" ")
            }
          >
            Dashboard
          </NavLink>
          <NavLink
            to="/gigs"
            className={({ isActive }) =>
              [ui.navLink, isActive ? ui.navLinkActive : ""].join(" ")
            }
          >
            Find gigs
          </NavLink>
          <NavLink
            to="/rentals"
            className={({ isActive }) =>
              [ui.navLink, isActive ? ui.navLinkActive : ""].join(" ")
            }
          >
            Rentals
          </NavLink>
          <NavLink
            to="/messages"
            className={({ isActive }) =>
              [ui.navLink, isActive ? ui.navLinkActive : ""].join(" ")
            }
          >
            Messages
          </NavLink>
        </>
      )}

      {!user ? (
        <NavLink
          to="/login"
          className={({ isActive }) =>
            [ui.navLink, isActive ? ui.navLinkActive : ""].join(" ")
          }
        >
          Login
        </NavLink>
      ) : isMusicianWithSetup ? (
        <NavLink
          to="/profile"
          className={({ isActive }) =>
            [ui.navLink, isActive ? ui.navLinkActive : ""].join(" ")
          }
        >
          Account
        </NavLink>
      ) : null}
    </nav>
  );
}

export default NavBar;
