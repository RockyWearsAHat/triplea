import React from "react";
import { AppShell, Button, spacing } from "@shared";
import ui from "@shared/styles/primitives.module.scss";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { createApiClient } from "../lib/urls";

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  const api = createApiClient();

  // If no token, show error state
  if (!token) {
    return (
      <AppShell title="Invalid link" centered>
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
          <div style={{ fontSize: 48, marginBottom: spacing.sm }}>⚠️</div>
          <p style={{ color: "var(--text-primary)", lineHeight: 1.5 }}>
            This password reset link is invalid or has expired.
          </p>
          <p className={ui.help}>Please request a new password reset link.</p>
          <Button onClick={() => navigate("/forgot-password")}>
            Request new link
          </Button>
        </div>
      </AppShell>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setSubmitting(true);

    try {
      await api.resetPassword(token!, newPassword);
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
      <AppShell title="Password reset" centered>
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
          <div style={{ fontSize: 48, marginBottom: spacing.sm }}>✅</div>
          <p style={{ color: "var(--text-primary)", lineHeight: 1.5 }}>
            Your password has been reset successfully.
          </p>
          <p className={ui.help}>You can now sign in with your new password.</p>
          <Button onClick={() => navigate("/login")}>Sign in</Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Create new password" centered>
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
        <p className={ui.help}>Enter your new password below.</p>

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 13 }}>New password</label>
          <input
            type="password"
            required
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className={ui.input}
            autoFocus
          />
          <p className={ui.help}>Minimum 8 characters</p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 13 }}>Confirm password</label>
          <input
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={ui.input}
          />
        </div>

        {error && <p className={ui.error}>{error}</p>}

        <Button type="submit" disabled={submitting}>
          {submitting ? "Resetting..." : "Reset password"}
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
