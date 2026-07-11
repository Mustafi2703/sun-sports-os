import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AcademyProvider } from "@/context/AcademyContext";
import NotFound from "./pages/NotFound.tsx";
import { AppLayout } from "./components/app/AppLayout";
import Dashboard from "./pages/app/Dashboard";
import Students from "./pages/app/Students";
import Batches from "./pages/app/Batches";
import Fees from "./pages/app/Fees";
import Attendance from "./pages/app/Attendance";
import Performance from "./pages/app/Performance";
import ParentPortal from "./pages/app/ParentPortal";
import Coach from "./pages/app/Coach";
import Communications from "./pages/app/Communications";
import Reports from "./pages/app/Reports";
import AppSettings from "./pages/app/Settings";
import Tournaments from "./pages/app/Tournaments";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AcademyProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/app" replace />} />
            <Route path="/app" element={<AppLayout><Dashboard /></AppLayout>} />
            <Route path="/app/students" element={<AppLayout><Students /></AppLayout>} />
            <Route path="/app/batches" element={<AppLayout><Batches /></AppLayout>} />
            <Route path="/app/fees" element={<AppLayout><Fees /></AppLayout>} />
            <Route path="/app/attendance" element={<AppLayout><Attendance /></AppLayout>} />
            <Route path="/app/performance" element={<AppLayout><Performance /></AppLayout>} />
            <Route path="/app/parent-portal" element={<AppLayout><ParentPortal /></AppLayout>} />
            <Route path="/app/coach" element={<AppLayout><Coach /></AppLayout>} />
            <Route path="/app/communications" element={<AppLayout><Communications /></AppLayout>} />
            <Route path="/app/reports" element={<AppLayout><Reports /></AppLayout>} />
            <Route path="/app/tournaments" element={<AppLayout><Tournaments /></AppLayout>} />
            <Route path="/app/settings" element={<AppLayout><AppSettings /></AppLayout>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AcademyProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
