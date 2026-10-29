import { Suspense } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AppLayout } from "./components/AppLayout";
import { PublicLayout } from "./components/PublicLayout";
import { useAuth } from "./hooks/useAuth";
import type { AppRole } from "./lib/supabase";
import { LoadingSpinner } from "./components/LazyFallback";
import {
  Landing,
  About,
  DotsLocator,
  LearnPublic,
  Login,
  StaffRegister,
  ForgotPassword,
  ResetPassword,
  NotFound,
  Dashboard,
  GISMapTab,
  Hotspots,
  Alerts,
  Cases,
  CaseFormPage,
  BulkImport,
  Chatbot,
  DotsCentersAdmin,
  SettingsPage,
  Analytics,
  Users,
  InviteCodes,
  AdminDashboard,
  Interoperability,
  AuditLog,
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
    return <LoadingSpinner className="min-h-[60vh]" />;
  }
  if (!profile || !roles.includes(profile.role)) {
    return <Navigate to="/app" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  const { pathname } = useLocation();
  return (
    <ErrorBoundary resetKey={pathname}>
    <Suspense fallback={null}>
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<Landing />} />
        <Route path="about" element={<About />} />
        <Route path="dots-locator" element={<DotsLocator />} />
        <Route path="learn" element={<LearnPublic />} />
        <Route path="login" element={<Login />} />
        <Route path="register/staff" element={<StaffRegister />} />
        <Route path="forgot-password" element={<ForgotPassword />} />
        <Route path="reset-password" element={<ResetPassword />} />
        {/* Unknown addresses, public or under /app, get a real 404 rather
            than a silent bounce to the homepage. */}
        <Route path="*" element={<NotFound />} />
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
            /* health_worker records the patients who walk into their clinic —
               that intake is where every case starts, and enrollment reads
               from the record they create. */
            <RequireRole
              roles={[
                "tb_coordinator",
                "barangay_admin",
                "health_worker",
                "system_admin",
              ]}
            >
              <CaseFormPage />
            </RequireRole>
          }
        />
        <Route
          path="dots-admin"
          element={
            <RequireRole roles={["system_admin"]}>
              <DotsCentersAdmin />
            </RequireRole>
          }
        />
        <Route
          path="import"
          element={
            /* Field staff upload their own area's register; the page appends
               and stamps their assignment (importScope.ts). Replace-all stays
               a coordinator action, gated inside the page, not by this route. */
            <RequireRole
              roles={[
                "tb_coordinator",
                "barangay_admin",
                "health_worker",
                "system_admin",
              ]}
            >
              <BulkImport />
            </RequireRole>
          }
        />
        <Route
          path="chatbot"
          element={
            <RequireRole roles={["tb_coordinator", "barangay_admin", "health_worker"]}>
              <Chatbot />
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
            <RequireRole roles={["system_admin"]}>
              <SettingsPage />
            </RequireRole>
          }
        />
        <Route
          path="users"
          element={
            <RequireRole roles={["system_admin"]}>
              <Users />
            </RequireRole>
          }
        />
        <Route
          path="invites"
          element={
            <RequireRole roles={["tb_coordinator", "system_admin"]}>
              <InviteCodes />
            </RequireRole>
          }
        />
        <Route
          /* System admin only. This guard hides the page; the Edge Function
             and the database refuse every other role independently, which is
             the gate that actually counts. */
          path="interoperability"
          element={
            <RequireRole roles={["system_admin"]}>
              <Interoperability />
            </RequireRole>
          }
        />
        <Route
          /* System admin only, enforced again by the database (RLS +
             is_super_admin), so this guard is not the gate. */
          path="audit-log"
          element={
            <RequireRole roles={["system_admin"]}>
              <AuditLog />
            </RequireRole>
          }
        />
      </Route>
    </Routes>
    </Suspense>
    </ErrorBoundary>
  );
}
