import React from "react";
import { AppShell, Button, spacing, useAuth } from "@shared";
import ui from "@shared/styles/primitives.module.scss";
import { useNavigate } from "react-router-dom";

export function AccountPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // If not logged in, redirect to login
  React.useEffect(() => {
    if (!user) {
      navigate("/login");
    }
  }, [user, navigate]);

  if (!user) {
    return null;
  }

  return (
    <AppShell
      title="Your account"
      subtitle="Manage your Triple A profile and settings."
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: spacing.md,
          maxWidth: 420,
        }}
      >
        <p>
          Signed in as <strong>{user.name}</strong> ({user.email})
        </p>
        <p className={ui.help}>Roles: {user.role.join(", ")}</p>
        <Button
          variant="secondary"
          onClick={logout}
          style={{ alignSelf: "flex-start" }}
        >
          Sign out
        </Button>
      </div>
    </AppShell>
  );
}
