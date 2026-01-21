import React from "react";
import { AppShell, Button, spacing, useAuth } from "@shared";
import ui from "@shared/styles/primitives.module.scss";
import { useNavigate, useSearchParams } from "react-router-dom";

export function AccountPage() {
  const { user, login, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);

      const next = searchParams.get("next");
      if (next && next.startsWith("/")) {
        navigate(next);
        return;
      }

      navigate("/");
    } catch {
      setError("Login failed. Please check your details and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell
      title="Muse account"
      subtitle="Where performer, customer, and service-consumer roles come together."
    >
      {user ? (
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
      ) : (
        <form
          onSubmit={handleSubmit}
          style={{
            maxWidth: 360,
            display: "flex",
            flexDirection: "column",
            gap: spacing.md,
          }}
        >
          <p className={ui.help}>
            Sign in to request rentals/services and access staff dashboards.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 13 }}>Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={ui.input}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 13 }}>Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={ui.input}
            />
          </div>

          {error && <p className={ui.error}>{error}</p>}

          <Button type="submit" disabled={submitting}>
            {submitting ? "Signing in..." : "Sign in"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate("/register")}
          >
            Create an account
          </Button>
        </form>
      )}
    </AppShell>
  );
}
