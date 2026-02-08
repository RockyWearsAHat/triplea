import React from "react";
import { AppShell, Button, useAuth } from "@shared";
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
    <AppShell title="Create account" centered>
      <form
        onSubmit={handleSubmit}
        className={ui.formSection}
        style={{ maxWidth: 420, width: "100%" }}
      >
        <h2 className={ui.formSectionTitle}>Create account</h2>
        <p className={ui.formSectionDesc}>
          Unified identity across Triple A apps.
        </p>

        <div className={ui.field}>
          <label className={ui.label}>Account type</label>
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
          <p className={ui.help}>
            Employees must use an invite link. Admins cannot self-register.
          </p>
        </div>

        <div className={ui.field}>
          <label className={ui.label}>Name</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={ui.input}
          />
        </div>

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
        </div>

        {error && <p className={ui.alertError}>{error}</p>}

        <Button type="submit" disabled={submitting}>
          {submitting ? "Creating..." : "Create account"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => navigate("/login")}
        >
          Back to sign in
        </Button>
      </form>
    </AppShell>
  );
}
