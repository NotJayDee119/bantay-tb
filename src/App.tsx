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
import { Cases } from "./pages/app/Cases";
import { CaseFormPage } from "./pages/app/CaseFormPage";
import { Adherence } from "./pages/app/Adherence";
import { BulkImport } from "./pages/app/BulkImport";
import { Chatbot } from "./pages/app/Chatbot";
import { HealthEducation } from "./pages/app/HealthEducation";
import { Users } from "./pages/app/Users";
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
        <Route path="map" element={<MapView />} />
        <Route path="hotspots" element={<Hotspots />} />
        <Route path="cases" element={<Cases />} />
        <Route path="cases/new" element={<CaseFormPage />} />
        <Route path="adherence" element={<Adherence />} />
        <Route
          path="import"
          element={
            <RequireRole roles={["tb_coordinator", "barangay_admin"]}>
              <BulkImport />
            </RequireRole>
          }
        />
        <Route path="chatbot" element={<Chatbot />} />
        <Route path="education" element={<HealthEducation />} />
        <Route
          path="users"
          element={
            <RequireRole roles={["tb_coordinator"]}>
              <Users />
            </RequireRole>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
