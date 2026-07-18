import { Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { PublicLayout } from "./components/PublicLayout";
import { useAuth } from "./hooks/useAuth";
import type { AppRole } from "./lib/supabase";
import { Spinner } from "./components/ui";
import {
  Landing,
  About,
  DotsLocator,
  LearnPublic,
  Login,
  Register,
  StaffRegister,
  ForgotPassword,
  ResetPassword,
  Dashboard,
  GISMapTab,
  Hotspots,
  Alerts,
  Cases,
  CaseFormPage,
  Adherence,
  BulkImport,
  Chatbot,
  HealthEducation,
  Cds,
  DotsCentersAdmin,
  SettingsPage,
  Analytics,
  Users,
  AdminDashboard,
} from "./lib/lazyPages";

function RequireRole({
  roles,
  children,
}: {
  roles: AppRole[];
  children: React.ReactNode;
}) {
  const { profile, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner />
      </div>
    );
  }
  if (!profile || !roles.includes(profile.role)) {
    return <Navigate to="/app" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    // Bare safety-net boundary. Each layout wraps its own routed content in a
    // Suspense that shows the route-progress bar, so a cold page chunk falls
    // back *inside* the still-mounted shell (header/sidebar) rather than
    // blanking the whole app. This top-level boundary only catches anything
    // lazy that might suspend outside a layout — normal navigation never
    // reaches it.
    <Suspense fallback={null}>
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<Landing />} />
        <Route path="about" element={<About />} />
        <Route path="dots-locator" element={<DotsLocator />} />
        <Route path="learn" element={<LearnPublic />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route path="register/staff" element={<StaffRegister />} />
        <Route path="forgot-password" element={<ForgotPassword />} />
        <Route path="reset-password" element={<ResetPassword />} />
      </Route>

      <Route path="app" element={<AppLayout />}>
        <Route index element={<Dashboard />} />
        <Route
          path="admin"
          element={
            <RequireRole roles={["system_admin"]}>
              <AdminDashboard />
            </RequireRole>
          }
        />
        <Route
          path="map"
          element={
            <RequireRole
              roles={[
                "tb_coordinator",
                "barangay_admin",
                "health_worker",
                "system_admin",
              ]}
            >
              <GISMapTab />
            </RequireRole>
          }
        />
        <Route
          path="hotspots"
          element={
            <RequireRole roles={["tb_coordinator", "system_admin", "barangay_admin", "health_worker"]}>
              <Hotspots />
            </RequireRole>
          }
        />
        <Route
          path="alerts"
          element={
            <RequireRole
              roles={["tb_coordinator", "barangay_admin", "health_worker", "system_admin"]}
            >
              <Alerts />
            </RequireRole>
          }
        />
        <Route
          path="cases"
          element={
            <RequireRole
              roles={[
                "tb_coordinator",
                "barangay_admin",
                "health_worker",
                "system_admin",
              ]}
            >
              <Cases />
            </RequireRole>
          }
        />
        <Route
          path="cases/new"
          element={
            <RequireRole roles={["tb_coordinator", "barangay_admin"]}>
              <CaseFormPage />
            </RequireRole>
          }
        />
        <Route
          path="cds"
          element={
            <RequireRole roles={["health_worker"]}>
              <Cds />
            </RequireRole>
          }
        />
        <Route
          path="dots-admin"
          element={
            <RequireRole roles={["tb_coordinator", "system_admin"]}>
              <DotsCentersAdmin />
            </RequireRole>
          }
        />
        <Route
          path="adherence"
          element={
            <RequireRole roles={["health_worker", "patient"]}>
              <Adherence />
            </RequireRole>
          }
        />
        <Route
          path="import"
          element={
            <RequireRole roles={["tb_coordinator"]}>
              <BulkImport />
            </RequireRole>
          }
        />
        <Route
          path="chatbot"
          element={
            <RequireRole roles={["tb_coordinator", "barangay_admin", "health_worker", "patient"]}>
              <Chatbot />
            </RequireRole>
          }
        />
        <Route
          path="education"
          element={
            <RequireRole roles={["patient"]}>
              <HealthEducation />
            </RequireRole>
          }
        />
        <Route
          path="analytics"
          element={
            <RequireRole
              roles={["tb_coordinator", "barangay_admin", "health_worker", "system_admin"]}
            >
              <Analytics />
            </RequireRole>
          }
        />
        <Route
          path="settings"
          element={
            <RequireRole roles={["tb_coordinator", "system_admin"]}>
              <SettingsPage />
            </RequireRole>
          }
        />
        <Route
          path="users"
          element={
            <RequireRole roles={["tb_coordinator", "system_admin"]}>
              <Users />
            </RequireRole>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  );
}
