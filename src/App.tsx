// src/App.tsx
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import AdminLogin from "./pages/AdminLogin";
import Admin from "./pages/Admin";
import DealerPortal from "./pages/DealerPortal";
import AccessRestricted from "./pages/AccessRestricted";
import InventoryStockPage from "@/pages/InventoryStockPage";
import DealerDashboard from "./pages/DealerDashboard";
import UnsignedEmptySlots from "./pages/UnsignedEmptySlots";
import PasswordLogin from "./pages/PasswordLogin";
import ProtectedMainRoute from "./components/ProtectedMainRoute";
import ProtectedDealerRoute from "./components/ProtectedDealerRoute";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <BrowserRouter>
        <Routes>
          {/* 根路径重定向到密码登录页 */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          
          {/* 密码登录页 */}
          <Route path="/login" element={<PasswordLogin />} />
          
          {/* 主仪表板（需要密码验证） */}
          <Route path="/dashboard" element={
            <ProtectedMainRoute>
              <Index />
            </ProtectedMainRoute>
          } />
          
          {/* 管理员相关路由 */}
          <Route path="/admin-login" element={<AdminLogin />} />
          <Route path="/admin" element={<Admin />} />

          {/* Dealer 上下文 - 必须带生成码，格式验证 */}
          <Route path="/dealer/:dealerSlug" element={
            <ProtectedDealerRoute>
              <DealerPortal />
            </ProtectedDealerRoute>
          } />
          <Route path="/dealer/:dealerSlug/inventorystock" element={
            <ProtectedDealerRoute>
              <InventoryStockPage />
            </ProtectedDealerRoute>
          } />
          <Route path="/dealer/:dealerSlug/unsigned" element={
            <ProtectedDealerRoute>
              <UnsignedEmptySlots />
            </ProtectedDealerRoute>
          } />
          <Route path="/dealer/:dealerSlug/dashboard" element={
            <ProtectedDealerRoute>
              <DealerDashboard />
            </ProtectedDealerRoute>
          } />

          {/* 受限页 */}
          <Route path="/access-restricted" element={<AccessRestricted />} />

          {/* 兜底 404，放最后 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
