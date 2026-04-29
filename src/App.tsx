import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { PublicLayout } from "./components/PublicLayout";
import { useAuth } from "./hooks/useAuth";
import type { AppRole } from "./lib/supabase";

import { Landing } from "./pages/public/Landing";
import { DotsLocator } from "./pages/public/DotsLocator";
import { LearnPublic } from "./pages/public/LearnPublic";
import { Login } from "./pages/public/Login";
import { Register } from "./pages/public/Register";

import { Dashboard } from "./pages/app/Dashboard";
import { MapView } from "./pages/app/MapView";
import { Hotspots } from "./pages/app/Hotspots";
import { Alerts } from "./pages/app/Alerts";
import { Cases } from "./pages/app/Cases";
import { CaseFormPage } from "./pages/app/CaseFormPage";
import { Adherence } from "./pages/app/Adherence";
import { BulkImport } from "./pages/app/BulkImport";
import { Chatbot } from "./pages/app/Chatbot";
import { HealthEducation } from "./pages/app/HealthEducation";
import { Cds } from "./pages/app/Cds";
import { DotsCentersAdmin } from "./pages/app/DotsCentersAdmin";
import { SettingsPage } from "./pages/app/SettingsPage";
import { Analytics } from "./pages/app/Analytics";
import { Users } from "./pages/app/Users";
import { AdminDashboard } from "./pages/app/AdminDashboard";
import { Spinner } from "./components/ui";

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
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<Landing />} />
        <Route path="dots-locator" element={<DotsLocator />} />
        <Route path="learn" element={<LearnPublic />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
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
              <MapView />
            </RequireRole>
          }
        />
        <Route
          path="hotspots"
          element={
            <RequireRole roles={["tb_coordinator", "system_admin"]}>
              <Hotspots />
            </RequireRole>
          }
        />
        <Route
          path="alerts"
          element={
            <RequireRole
              roles={["tb_coordinator", "barangay_admin", "health_worker"]}
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
            <RequireRole roles={["tb_coordinator", "patient"]}>
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
              roles={["tb_coordinator", "health_worker", "system_admin"]}
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
  );
}
