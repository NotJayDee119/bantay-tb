import { lazyWithPreload } from "./lazyWithPreload";

// Public site
export const Landing = lazyWithPreload(() => import("../pages/public/Landing").then(m => ({ default: m.Landing })));
export const About = lazyWithPreload(() => import("../pages/public/About").then(m => ({ default: m.About })));
export const DotsLocator = lazyWithPreload(() => import("../pages/public/DotsLocator").then(m => ({ default: m.DotsLocator })));
export const LearnPublic = lazyWithPreload(() => import("../pages/public/LearnPublic").then(m => ({ default: m.LearnPublic })));
export const Login = lazyWithPreload(() => import("../pages/public/Login").then(m => ({ default: m.Login })));
export const Register = lazyWithPreload(() => import("../pages/public/Register").then(m => ({ default: m.Register })));
export const StaffRegister = lazyWithPreload(() => import("../pages/public/StaffRegister").then(m => ({ default: m.StaffRegister })));
export const ForgotPassword = lazyWithPreload(() => import("../pages/public/ForgotPassword").then(m => ({ default: m.ForgotPassword })));
export const ResetPassword = lazyWithPreload(() => import("../pages/public/ResetPassword").then(m => ({ default: m.ResetPassword })));

// App (authenticated)
export const Dashboard = lazyWithPreload(() => import("../pages/app/Dashboard").then(m => ({ default: m.Dashboard })));
export const GISMapTab = lazyWithPreload(() => import("../pages/app/GISMapTab").then(m => ({ default: m.GISMapTab })));
export const Hotspots = lazyWithPreload(() => import("../pages/app/Hotspots").then(m => ({ default: m.Hotspots })));
export const Alerts = lazyWithPreload(() => import("../pages/app/Alerts").then(m => ({ default: m.Alerts })));
export const Cases = lazyWithPreload(() => import("../pages/app/Cases").then(m => ({ default: m.Cases })));
export const CaseFormPage = lazyWithPreload(() => import("../pages/app/CaseFormPage").then(m => ({ default: m.CaseFormPage })));
export const Adherence = lazyWithPreload(() => import("../pages/app/Adherence").then(m => ({ default: m.Adherence })));
export const BulkImport = lazyWithPreload(() => import("../pages/app/BulkImport").then(m => ({ default: m.BulkImport })));
export const Chatbot = lazyWithPreload(() => import("../pages/app/Chatbot").then(m => ({ default: m.Chatbot })));
export const HealthEducation = lazyWithPreload(() => import("../pages/app/HealthEducation").then(m => ({ default: m.HealthEducation })));
export const Cds = lazyWithPreload(() => import("../pages/app/Cds").then(m => ({ default: m.Cds })));
export const DotsCentersAdmin = lazyWithPreload(() => import("../pages/app/DotsCentersAdmin").then(m => ({ default: m.DotsCentersAdmin })));
export const SettingsPage = lazyWithPreload(() => import("../pages/app/SettingsPage").then(m => ({ default: m.SettingsPage })));
export const Analytics = lazyWithPreload(() => import("../pages/app/Analytics").then(m => ({ default: m.Analytics })));
export const Users = lazyWithPreload(() => import("../pages/app/Users").then(m => ({ default: m.Users })));
export const AdminDashboard = lazyWithPreload(() => import("../pages/app/AdminDashboard").then(m => ({ default: m.AdminDashboard })));

/**
 * Maps a nav-link `to` path to the chunk that route renders, so hovering a
 * link can warm its chunk before the click. Keyed by the exact `to` values
 * used in the PublicLayout / AppLayout nav arrays.
 */
const PRELOAD_BY_PATH: Record<string, () => Promise<unknown>> = {
  // Public
  "/": Landing.preload,
  "/about": About.preload,
  "/dots-locator": DotsLocator.preload,
  "/learn": LearnPublic.preload,
  "/login": Login.preload,
  "/register": Register.preload,
  "/register/staff": StaffRegister.preload,
  "/forgot-password": ForgotPassword.preload,
  "/reset-password": ResetPassword.preload,
  // App
  "/app": Dashboard.preload,
  "/app/admin": AdminDashboard.preload,
  "/app/map": GISMapTab.preload,
  "/app/hotspots": Hotspots.preload,
  "/app/alerts": Alerts.preload,
  "/app/cases": Cases.preload,
  "/app/cases/new": CaseFormPage.preload,
  "/app/analytics": Analytics.preload,
  "/app/cds": Cds.preload,
  "/app/dots-admin": DotsCentersAdmin.preload,
  "/app/adherence": Adherence.preload,
  "/app/education": HealthEducation.preload,
  "/app/import": BulkImport.preload,
  "/app/chatbot": Chatbot.preload,
  "/app/settings": SettingsPage.preload,
  "/app/users": Users.preload,
};

/**
 * Warm the chunk for a route path if we know it. Safe to call on every
 * hover/focus — unknown paths are ignored and repeat calls are no-ops.
 */
export function preloadRoute(path: string) {
  PRELOAD_BY_PATH[path]?.();
}
