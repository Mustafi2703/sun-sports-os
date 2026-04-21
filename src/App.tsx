import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
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

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
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
          <Route path="/app/settings" element={<AppLayout><AppSettings /></AppLayout>} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
