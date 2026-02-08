import React from "react";
import { AppShell, Button, useAuth } from "@shared";
import ui from "@shared/styles/primitives.module.scss";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
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
      <AppShell title="Welcome back" centered>
        <div
          className={ui.formSection}
          style={{ maxWidth: 420, width: "100%" }}
        >
          <h2 className={ui.formSectionTitle}>Welcome back</h2>
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
        className={ui.formSection}
        style={{ maxWidth: 400, width: "100%" }}
      >
        <h2 className={ui.formSectionTitle}>Sign in</h2>
        <p className={ui.formSectionDesc}>
          Sign in to request rentals/services and access staff dashboards.
        </p>

        <div className={ui.field}>
          <label className={ui.label}>Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={ui.input}
          />
        </div>

        <div className={ui.field}>
          <label className={ui.label}>Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={ui.input}
          />
          <Link
            to="/forgot-password"
            style={{
              fontSize: 13,
              color: "var(--gold)",
              textDecoration: "none",
              alignSelf: "flex-end",
            }}
          >
            Forgot password?
          </Link>
        </div>

        {error && <p className={ui.alertError}>{error}</p>}

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
        <div className={ui.divider} />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
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
