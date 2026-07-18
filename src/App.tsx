import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AcademyProvider } from "@/context/AcademyContext";
import { AuthProvider } from "@/context/AuthContext";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { LoginPage } from "@/components/auth/LoginPage";
import NotFound from "./pages/NotFound.tsx";
import Landing from "./pages/Landing";
import { AppLayout } from "./components/app/AppLayout";
import Dashboard from "./pages/app/Dashboard";
import Students from "./pages/app/Students";
import Batches from "./pages/app/Batches";
import Fees from "./pages/app/Fees";
import Attendance from "./pages/app/Attendance";
import Performance from "./pages/app/Performance";
import Communications from "./pages/app/Communications";
import Reports from "./pages/app/Reports";
import AppSettings from "./pages/app/Settings";
import Tournaments from "./pages/app/Tournaments";
import ParentHome from "./pages/portals/ParentHome";
import CoachHome from "./pages/portals/CoachHome";

const queryClient = new QueryClient();

function AdminShell() {
  return (
    <RequireAuth role="admin" loginPath="/app/login">
      <AcademyProvider>
        <AppLayout>
          <Outlet />
        </AppLayout>
      </AcademyProvider>
    </RequireAuth>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Landing />} />

            <Route path="/parent/login" element={<LoginPage portal="parent" />} />
            <Route
              path="/parent"
              element={
                <RequireAuth role="parent" loginPath="/parent/login">
                  <ParentHome />
                </RequireAuth>
              }
            />

            <Route path="/coach/login" element={<LoginPage portal="coach" />} />
            <Route
              path="/coach"
              element={
                <RequireAuth role="coach" loginPath="/coach/login">
                  <CoachHome />
                </RequireAuth>
              }
            />

            <Route path="/app/login" element={<LoginPage portal="admin" />} />
            <Route path="/app" element={<AdminShell />}>
              <Route index element={<Dashboard />} />
              <Route path="students" element={<Students />} />
              <Route path="batches" element={<Batches />} />
              <Route path="fees" element={<Fees />} />
              <Route path="attendance" element={<Attendance />} />
              <Route path="performance" element={<Performance />} />
              <Route path="communications" element={<Communications />} />
              <Route path="reports" element={<Reports />} />
              <Route path="tournaments" element={<Tournaments />} />
              <Route path="settings" element={<AppSettings />} />
              <Route path="parent-portal" element={<Navigate to="/parent" replace />} />
              <Route path="coach" element={<Navigate to="/coach" replace />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
