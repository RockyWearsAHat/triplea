import React from "react";
import { AppShell, Button, spacing, useAuth } from "@shared";
import ui from "@shared/styles/primitives.module.scss";
import { useNavigate, useSearchParams } from "react-router-dom";
import { MUSIC_ORIGIN, MUSICIAN_ORIGIN } from "../lib/urls";

export function LoginPage() {
  const { user, login } = useAuth();
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

  // If already logged in, show account info
  if (user) {
    return (
      <AppShell title="Welcome back">
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
            onClick={() => navigate("/")}
            style={{ alignSelf: "flex-start" }}
          >
            Go to home
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Sign in to Triple A" centered>
      <form
        onSubmit={handleSubmit}
        style={{
          maxWidth: 360,
          width: "100%",
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

        {/* Cross-app links */}
        <div
          style={{
            marginTop: spacing.xl,
            paddingTop: spacing.md,
            borderTop: "1px solid var(--border)",
            display: "flex",
            flexDirection: "column",
            gap: spacing.sm,
            textAlign: "center",
          }}
        >
          <p className={ui.help}>
            Looking for concerts?{" "}
            <a
              href={MUSIC_ORIGIN}
              style={{ color: "var(--gold)", textDecoration: "underline" }}
            >
              Browse and host events
            </a>
          </p>
          <p className={ui.help}>
            Ready to perform?{" "}
            <a
              href={`${MUSICIAN_ORIGIN}/login`}
              style={{ color: "var(--gold)", textDecoration: "underline" }}
            >
              Sign in as a musician
            </a>
          </p>
        </div>
      </form>
    </AppShell>
  );
}
