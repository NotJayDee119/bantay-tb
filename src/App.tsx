import { lazy, Suspense, useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { PublicLayout } from "./components/PublicLayout";
import { useAuth } from "./hooks/useAuth";
import type { AppRole } from "./lib/supabase";
import { Spinner } from "./components/ui";

const Landing = lazy(() => import("./pages/public/Landing").then(m => ({ default: m.Landing })));
const About = lazy(() => import("./pages/public/About").then(m => ({ default: m.About })));
const DotsLocator = lazy(() => import("./pages/public/DotsLocator").then(m => ({ default: m.DotsLocator })));
const LearnPublic = lazy(() => import("./pages/public/LearnPublic").then(m => ({ default: m.LearnPublic })));
const Login = lazy(() => import("./pages/public/Login").then(m => ({ default: m.Login })));
const Register = lazy(() => import("./pages/public/Register").then(m => ({ default: m.Register })));
const StaffRegister = lazy(() => import("./pages/public/StaffRegister").then(m => ({ default: m.StaffRegister })));
const ForgotPassword = lazy(() => import("./pages/public/ForgotPassword").then(m => ({ default: m.ForgotPassword })));
const ResetPassword = lazy(() => import("./pages/public/ResetPassword").then(m => ({ default: m.ResetPassword })));

const Dashboard = lazy(() => import("./pages/app/Dashboard").then(m => ({ default: m.Dashboard })));
const GISMapTab = lazy(() => import("./pages/app/GISMapTab").then(m => ({ default: m.GISMapTab })));
const Hotspots = lazy(() => import("./pages/app/Hotspots").then(m => ({ default: m.Hotspots })));
const Alerts = lazy(() => import("./pages/app/Alerts").then(m => ({ default: m.Alerts })));
const Cases = lazy(() => import("./pages/app/Cases").then(m => ({ default: m.Cases })));
const CaseFormPage = lazy(() => import("./pages/app/CaseFormPage").then(m => ({ default: m.CaseFormPage })));
const Adherence = lazy(() => import("./pages/app/Adherence").then(m => ({ default: m.Adherence })));
const BulkImport = lazy(() => import("./pages/app/BulkImport").then(m => ({ default: m.BulkImport })));
const Chatbot = lazy(() => import("./pages/app/Chatbot").then(m => ({ default: m.Chatbot })));
const HealthEducation = lazy(() => import("./pages/app/HealthEducation").then(m => ({ default: m.HealthEducation })));
const Cds = lazy(() => import("./pages/app/Cds").then(m => ({ default: m.Cds })));
const DotsCentersAdmin = lazy(() => import("./pages/app/DotsCentersAdmin").then(m => ({ default: m.DotsCentersAdmin })));
const SettingsPage = lazy(() => import("./pages/app/SettingsPage").then(m => ({ default: m.SettingsPage })));
const Analytics = lazy(() => import("./pages/app/Analytics").then(m => ({ default: m.Analytics })));
const Users = lazy(() => import("./pages/app/Users").then(m => ({ default: m.Users })));
const AdminDashboard = lazy(() => import("./pages/app/AdminDashboard").then(m => ({ default: m.AdminDashboard })));

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

/**
 * Suspense fallback for lazy route chunks. Chunks usually resolve well
 * under 300ms, so the spinner only appears on genuinely slow loads — a
 * spinner that flashes for a few frames on every navigation reads as
 * jank, and it would double up with each page's own skeleton state.
 */
function LazyFallback() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShow(true), 300);
    return () => clearTimeout(t);
  }, []);
  if (!show) return null;
  return (
    <div className="flex h-64 items-center justify-center">
      <Spinner />
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<LazyFallback />}>
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
