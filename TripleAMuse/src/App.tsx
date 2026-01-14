import React, { type CSSProperties, type ReactNode } from "react";
import {
  AppShell,
  Button,
  RequireAnyRole,
  RequireRole,
  spacing,
  useAuth,
} from "@shared";
import { NavLink, Route, Routes } from "react-router-dom";
import "./App.css";

type TagProps = {
  label: string;
};

function Tag({ label }: TagProps) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: `${spacing.xs}px ${spacing.sm}px`,
        borderRadius: 999,
        backgroundColor: "#020617",
        border: "1px solid #1f2937",
        fontSize: 11,
        letterSpacing: 0.4,
        textTransform: "uppercase",
        color: "#e5e7eb",
      }}
    >
      {label}
    </span>
  );
}

type SectionProps = {
  title: string;
  children: ReactNode;
};

function Section({ title, children }: SectionProps) {
  return (
    <section
      style={{
        display: "flex",
        flexDirection: "column",
        gap: spacing.sm,
      }}
    >
      <h2
        style={{
          fontSize: 16,
          fontWeight: 600,
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function HomeDashboardPage() {
  return (
    <AppShell
      title="Triple A Muse"
      subtitle="Operations hub for gear rental, lessons, and event logistics."
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: spacing.lg,
        }}
      >
        <Section title="Who is this for?">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: spacing.lg,
            }}
          >
            <div
              style={{
                padding: spacing.lg,
                borderRadius: 12,
                backgroundColor: "#020617",
                border: "1px solid #1f2937",
              }}
            >
              <h3 style={{ fontWeight: 600 }}>Musicians</h3>
              <p
                style={{
                  marginTop: spacing.xs,
                  color: "#9ca3af",
                  fontSize: 14,
                }}
              >
                Request backline, amps, and stage support for upcoming gigs.
              </p>
              <Button
                style={{ marginTop: spacing.md }}
                onClick={() => (window.location.href = "/new-request")}
              >
                Request gear
              </Button>
            </div>

            <div
              style={{
                padding: spacing.lg,
                borderRadius: 12,
                backgroundColor: "#020617",
                border: "1px solid #1f2937",
              }}
            >
              <h3 style={{ fontWeight: 600 }}>Event organisers</h3>
              <p
                style={{
                  marginTop: spacing.xs,
                  color: "#9ca3af",
                  fontSize: 14,
                }}
              >
                Book full packages: PA, lights, transport, and on-site crew.
              </p>
              <Button
                style={{ marginTop: spacing.md }}
                onClick={() => (window.location.href = "/new-request")}
              >
                Plan an event
              </Button>
            </div>

            <div
              style={{
                padding: spacing.lg,
                borderRadius: 12,
                backgroundColor: "#020617",
                border: "1px solid #1f2937",
              }}
            >
              <h3 style={{ fontWeight: 600 }}>Owner dashboard</h3>
              <p
                style={{
                  marginTop: spacing.xs,
                  color: "#9ca3af",
                  fontSize: 14,
                }}
              >
                See all open requests, today's pickups, and logistics tasks.
              </p>
              <Button
                style={{ marginTop: spacing.md }}
                variant="secondary"
                onClick={() => (window.location.href = "/requests")}
              >
                View requests
              </Button>
            </div>
          </div>
        </Section>

        <Section title="Today at a glance">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: spacing.lg,
            }}
          >
            <div
              style={{
                padding: spacing.lg,
                borderRadius: 12,
                backgroundColor: "#020617",
                border: "1px solid #1f2937",
              }}
            >
              <p style={{ fontSize: 12, color: "#9ca3af" }}>Open requests</p>
              <p style={{ fontSize: 28, fontWeight: 600 }}>7</p>
              <p style={{ fontSize: 12, color: "#9ca3af" }}>
                3 awaiting confirmation, 4 scheduled.
              </p>
            </div>

            <div
              style={{
                padding: spacing.lg,
                borderRadius: 12,
                backgroundColor: "#020617",
                border: "1px solid #1f2937",
              }}
            >
              <p style={{ fontSize: 12, color: "#9ca3af" }}>Pickups today</p>
              <p style={{ fontSize: 28, fontWeight: 600 }}>2</p>
              <p style={{ fontSize: 12, color: "#9ca3af" }}>
                Both from the warehouse location.
              </p>
            </div>

            <div
              style={{
                padding: spacing.lg,
                borderRadius: 12,
                backgroundColor: "#020617",
                border: "1px solid #1f2937",
              }}
            >
              <p style={{ fontSize: 12, color: "#9ca3af" }}>Deliveries today</p>
              <p style={{ fontSize: 28, fontWeight: 600 }}>3</p>
              <p style={{ fontSize: 12, color: "#9ca3af" }}>
                1 club, 2 private events.
              </p>
            </div>
          </div>
        </Section>
      </div>
    </AppShell>
  );
}

function AdminDashboardPage() {
  return (
    <AppShell
      title="Admin dashboard"
      subtitle="Control access, employees, and high-level operations."
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: spacing.lg,
        }}
      >
        <Section title="People & access">
          <div
            style={{
              padding: spacing.lg,
              borderRadius: 12,
              backgroundColor: "#020617",
              border: "1px solid #1f2937",
              display: "flex",
              flexDirection: "column",
              gap: spacing.sm,
            }}
          >
            <p style={{ color: "#9ca3af", fontSize: 14 }}>
              Assign roles like operations, gear tech, and drivers to employees.
              This is where permission-based access will be managed.
            </p>
            <Button variant="secondary" style={{ alignSelf: "flex-start" }}>
              Manage employees
            </Button>
          </div>
        </Section>

        <Section title="Operational overview">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: spacing.lg,
            }}
          >
            <div
              style={{
                padding: spacing.lg,
                borderRadius: 12,
                backgroundColor: "#020617",
                border: "1px solid #1f2937",
              }}
            >
              <p style={{ fontSize: 12, color: "#9ca3af" }}>Active employees</p>
              <p style={{ fontSize: 28, fontWeight: 600 }}>5</p>
              <p style={{ fontSize: 12, color: "#9ca3af" }}>
                3 on logistics, 2 on staging.
              </p>
            </div>
            <div
              style={{
                padding: spacing.lg,
                borderRadius: 12,
                backgroundColor: "#020617",
                border: "1px solid #1f2937",
              }}
            >
              <p style={{ fontSize: 12, color: "#9ca3af" }}>
                Open gear tickets
              </p>
              <p style={{ fontSize: 28, fontWeight: 600 }}>4</p>
              <p style={{ fontSize: 12, color: "#9ca3af" }}>
                2 for tonight, 2 this weekend.
              </p>
            </div>
          </div>
        </Section>
      </div>
    </AppShell>
  );
}

function EmployeeDashboardPage() {
  return (
    <AppShell
      title="Employee dashboard"
      subtitle="Today's gear runs, pickups, and on-site jobs."
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: spacing.md,
        }}
      >
        <Section title="Your tasks today">
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: spacing.sm,
            }}
          >
            <div
              style={{
                padding: spacing.lg,
                borderRadius: 12,
                backgroundColor: "#020617",
                border: "1px solid #1f2937",
              }}
            >
              <h3 style={{ fontWeight: 600 }}>Deliver backline to City Club</h3>
              <p
                style={{
                  marginTop: spacing.xs,
                  color: "#9ca3af",
                  fontSize: 14,
                }}
              >
                Pickup 17:00 · Load-in 17:30 · Contact: Jamie (musician).
              </p>
              <div
                style={{
                  display: "flex",
                  gap: spacing.sm,
                  marginTop: spacing.sm,
                }}
              >
                <Button variant="secondary">Mark in progress</Button>
                <Button variant="ghost">View route</Button>
              </div>
            </div>
          </div>
        </Section>
      </div>
    </AppShell>
  );
}

function NewRequestPage() {
  return (
    <AppShell
      title="New request"
      subtitle="Tell us what you need for your gig or event."
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: spacing.md,
          maxWidth: 640,
        }}
      >
        <Section title="Who are you?">
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: spacing.sm,
            }}
          >
            <Button>Musician / band</Button>
            <Button variant="secondary">Event organiser</Button>
          </div>
        </Section>

        <Section title="Event details">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: spacing.md,
            }}
          >
            <input
              placeholder="Event name or venue"
              style={{
                padding: `${spacing.sm}px ${spacing.md}px`,
                borderRadius: 999,
                border: "1px solid #374151",
                backgroundColor: "#020617",
                color: "white",
              }}
            />
            <input
              placeholder="Date"
              style={{
                padding: `${spacing.sm}px ${spacing.md}px`,
                borderRadius: 999,
                border: "1px solid #374151",
                backgroundColor: "#020617",
                color: "white",
              }}
            />
            <input
              placeholder="City"
              style={{
                padding: `${spacing.sm}px ${spacing.md}px`,
                borderRadius: 999,
                border: "1px solid #374151",
                backgroundColor: "#020617",
                color: "white",
              }}
            />
          </div>
        </Section>

        <Section title="What do you need?">
          <textarea
            placeholder="Backline, PA, lights, transport, on-site crew… give as much detail as you can."
            style={{
              minHeight: 120,
              padding: `${spacing.sm}px ${spacing.md}px`,
              borderRadius: 16,
              border: "1px solid #374151",
              backgroundColor: "#020617",
              color: "white",
              resize: "vertical",
            }}
          />
        </Section>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-start",
            gap: spacing.sm,
            marginTop: spacing.md,
          }}
        >
          <Button>Submit request</Button>
          <Button variant="ghost">Save as draft</Button>
        </div>
      </div>
    </AppShell>
  );
}

function RequestsPage() {
  return (
    <AppShell
      title="Requests"
      subtitle="Track gear, lessons, and logistics requests in one queue."
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: spacing.md,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
            gap: spacing.sm,
            marginBottom: spacing.md,
          }}
        >
          <Tag label="All" />
          <Tag label="Pending" />
          <Tag label="Confirmed" />
          <Tag label="In progress" />
          <Tag label="Completed" />
        </div>

        {[1, 2, 3].map((id) => (
          <div
            key={id}
            style={{
              padding: spacing.lg,
              borderRadius: 12,
              backgroundColor: "#020617",
              border: "1px solid #1f2937",
              display: "flex",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: spacing.lg,
            }}
          >
            <div>
              <h3 style={{ fontWeight: 600 }}>
                Rooftop launch · Full PA + backline
              </h3>
              <p
                style={{
                  marginTop: spacing.xs,
                  color: "#9ca3af",
                  fontSize: 14,
                }}
              >
                Sat 22:00 · City centre · 150 guests
              </p>
              <p
                style={{
                  marginTop: spacing.xs,
                  color: "#9ca3af",
                  fontSize: 13,
                }}
              >
                Guitar amps, bass rig, 4 vocal mics, 2 monitor mixes, basic
                lighting.
              </p>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: spacing.sm,
                minWidth: 200,
              }}
            >
              <div style={{ display: "flex", gap: spacing.xs }}>
                <Tag label="Pending" />
                <Tag label="Gear" />
              </div>
              <div
                style={{
                  display: "flex",
                  gap: spacing.sm,
                  marginTop: spacing.sm,
                }}
              >
                <Button fullWidth>Confirm</Button>
                <Button variant="ghost" fullWidth>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}

function AccountPage() {
  const { user, login, logout } = useAuth();
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
    } catch (err) {
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
          <p style={{ color: "#9ca3af", fontSize: 14 }}>
            Roles: {user.role.join(", ")}
          </p>
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
          <p style={{ color: "#9ca3af", fontSize: 14 }}>
            Sign in to access admin and employee dashboards.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 13 }}>Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                padding: `${spacing.sm}px ${spacing.md}px`,
                borderRadius: 999,
                border: "1px solid #374151",
                backgroundColor: "#020617",
                color: "white",
              }}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 13 }}>Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                padding: `${spacing.sm}px ${spacing.md}px`,
                borderRadius: 999,
                border: "1px solid #374151",
                backgroundColor: "#020617",
                color: "white",
              }}
            />
          </div>
          {error && <p style={{ color: "#f87171", fontSize: 13 }}>{error}</p>}
          <Button type="submit" disabled={submitting}>
            {submitting ? "Signing in..." : "Sign in"}
          </Button>
        </form>
      )}
    </AppShell>
  );
}

function NavBar() {
  const { user } = useAuth();
  const linkStyle: CSSProperties = {
    fontSize: 13,
    padding: `${spacing.xs}px ${spacing.sm}px`,
  };

  const activeStyle: CSSProperties = {
    textDecoration: "underline",
  };

  return (
    <nav
      style={{
        marginBottom: spacing.md,
        display: "flex",
        gap: spacing.sm,
      }}
    >
      <NavLink
        to="/"
        style={({ isActive }) => ({
          ...linkStyle,
          ...(isActive ? activeStyle : {}),
        })}
      >
        Home
      </NavLink>
      {user?.role.includes("admin") && (
        <NavLink
          to="/admin"
          style={({ isActive }) => ({
            ...linkStyle,
            ...(isActive ? activeStyle : {}),
          })}
        >
          Admin
        </NavLink>
      )}
      {user?.role.includes("rental_provider") && (
        <NavLink
          to="/employee"
          style={({ isActive }) => ({
            ...linkStyle,
            ...(isActive ? activeStyle : {}),
          })}
        >
          Employee
        </NavLink>
      )}
      <NavLink
        to="/new-request"
        style={({ isActive }) => ({
          ...linkStyle,
          ...(isActive ? activeStyle : {}),
        })}
      >
        New request
      </NavLink>
      <NavLink
        to="/requests"
        style={({ isActive }) => ({
          ...linkStyle,
          ...(isActive ? activeStyle : {}),
        })}
      >
        Requests
      </NavLink>
      <NavLink
        to="/account"
        style={({ isActive }) => ({
          ...linkStyle,
          ...(isActive ? activeStyle : {}),
        })}
      >
        Account
      </NavLink>
    </nav>
  );
}

function App() {
  return (
    <div style={{ paddingTop: spacing.sm }}>
      <NavBar />
      <Routes>
        <Route path="/" element={<HomeDashboardPage />} />
        <Route path="/new-request" element={<NewRequestPage />} />
        <Route path="/requests" element={<RequestsPage />} />
        <Route
          path="/admin"
          element={
            <RequireRole role="admin">
              <AdminDashboardPage />
            </RequireRole>
          }
        />
        <Route
          path="/employee"
          element={
            <RequireAnyRole roles={["rental_provider"]}>
              <EmployeeDashboardPage />
            </RequireAnyRole>
          }
        />
        <Route path="/account" element={<AccountPage />} />
      </Routes>
    </div>
  );
}

export default App;
