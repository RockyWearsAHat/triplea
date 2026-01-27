import React from "react";
import { AppShell, Button, spacing } from "@shared";
import ui from "@shared/styles/primitives.module.scss";
import { useNavigate, Link } from "react-router-dom";
import { createApiClient } from "../lib/urls";

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  const api = createApiClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await api.requestPasswordReset(email);
      setSuccess(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <AppShell title="Check your email" centered>
        <div
          style={{
            maxWidth: 400,
            width: "100%",
            display: "flex",
            flexDirection: "column",
            gap: spacing.md,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 48, marginBottom: spacing.sm }}>📧</div>
          <p style={{ color: "var(--text-primary)", lineHeight: 1.5 }}>
            If an account exists for <strong>{email}</strong>, you'll receive an
            email with instructions to reset your password.
          </p>
          <p className={ui.help}>
            Didn't receive the email? Check your spam folder or try again.
          </p>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: spacing.sm,
              marginTop: spacing.md,
            }}
          >
            <Button onClick={() => setSuccess(false)} variant="ghost">
              Try a different email
            </Button>
            <Button onClick={() => navigate("/login")}>Back to sign in</Button>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Reset your password" centered>
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
          Enter your email address and we'll send you a link to reset your
          password.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 13 }}>Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={ui.input}
            autoFocus
          />
        </div>

        {error && <p className={ui.error}>{error}</p>}

        <Button type="submit" disabled={submitting}>
          {submitting ? "Sending..." : "Send reset link"}
        </Button>

        <Link
          to="/login"
          style={{
            textAlign: "center",
            color: "var(--gold)",
            textDecoration: "none",
            fontSize: 14,
          }}
        >
          Back to sign in
        </Link>
      </form>
    </AppShell>
  );
}
