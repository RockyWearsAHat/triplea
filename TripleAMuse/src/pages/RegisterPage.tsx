import React from "react";
import { AppShell, Button, spacing, useAuth } from "@shared";
import ui from "@shared/styles/primitives.module.scss";
import { useNavigate } from "react-router-dom";

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [accountType, setAccountType] = React.useState<"musician" | "customer">(
    "customer",
  );
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register({
        name,
        email,
        password,
        roles: [accountType],
      });
      navigate("/");
    } catch {
      setError("Registration failed. Please try a different email.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell
      title="Create account"
      subtitle="Unified identity across Triple A apps."
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
          <label style={{ fontSize: 13 }}>Account type</label>
          <select
            value={accountType}
            onChange={(e) =>
              setAccountType(e.target.value as "musician" | "customer")
            }
            className={ui.input}
          >
            <option value="customer">Customer / organiser</option>
            <option value="musician">Musician</option>
          </select>
          <p className={ui.help} style={{ marginTop: 6 }}>
            Employees must use an invite link. Admins cannot self-register.
          </p>
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
          {submitting ? "Creating..." : "Create account"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => navigate("/account")}
        >
          Back to sign in
        </Button>
      </form>
    </AppShell>
  );
}
