import {
  AppFrame,
  RequireAnyRole,
  RequireAuth,
  RequireRole,
  spacing,
} from "@shared";
import { Route, Routes } from "react-router-dom";
import "./App.css";
import ui from "@shared/styles/primitives.module.scss";

import { NavBar } from "./components/NavBar";
import { PortalPage } from "./pages/PortalPage";
import { MessagesPage } from "./pages/MessagesPage";
import { AdminDashboardPage } from "./pages/AdminDashboardPage";
import { AdminUsersPage } from "./pages/AdminUsersPage";
import { EmployeeDashboardPage } from "./pages/EmployeeDashboardPage";
import { AccountPage } from "./pages/AccountPage";
import { RegisterPage } from "./pages/RegisterPage";
import { InviteOnboardingPage } from "./pages/InviteOnboardingPage";

function App() {
  return (
    <AppFrame app="muse">
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: spacing.md,
          flex: 1,
          minHeight: 0,
        }}
      >
        <div className={ui.chrome}>
          <header className={ui.header}>
            <h1 className={ui.title}>Triple A Muse</h1>
            <p className={ui.subtitle}>Portal & funnels</p>
          </header>
          <NavBar />
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          <Routes>
            <Route path="/" element={<PortalPage />} />
            <Route
              path="/messages"
              element={
                <RequireAuth>
                  <MessagesPage />
                </RequireAuth>
              }
            />
            <Route
              path="/admin"
              element={
                <RequireRole role="admin">
                  <AdminDashboardPage />
                </RequireRole>
              }
            />
            <Route
              path="/admin/users"
              element={
                <RequireRole role="admin">
                  <AdminUsersPage />
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
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/invite" element={<InviteOnboardingPage />} />
          </Routes>
        </div>
      </div>
    </AppFrame>
  );
}

export default App;
