import React, { useMemo, useState } from "react";
import { AppShell, Button, spacing } from "@shared";
import ui from "@shared/styles/primitives.module.scss";
import { useNavigate, useSearchParams } from "react-router-dom";
import { TripleAApiClient } from "@shared/api/client";
import { API_BASE_URL } from "../lib/urls";

export function InviteOnboardingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const api = useMemo(
    () => new TripleAApiClient({ baseUrl: API_BASE_URL }),
    [],
  );

  const [token, setToken] = useState(searchParams.get("token") ?? "");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.registerWithInvite({ token, name, email, password });
      navigate("/account");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell
      title="Employee onboarding"
      subtitle="Use your private invite link to create an employee account."
    >
      <form
        onSubmit={handleSubmit}
        style={{
          maxWidth: 420,
          display: "flex",
          flexDirection: "column",
          gap: spacing.md,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 13 }}>Invite token</label>
          <input
            required
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className={ui.input}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 13 }}>Name</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={ui.input}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 13 }}>Email (must match invite)</label>
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
          {submitting ? "Creating..." : "Create employee account"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => navigate("/account")}
        >
          Back to account
        </Button>
      </form>
    </AppShell>
  );
}
