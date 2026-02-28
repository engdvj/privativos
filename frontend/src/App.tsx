import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { LoginPage } from "@/pages/LoginPage";
import { SetorPage } from "@/pages/SetorPage";
import { AdminPage } from "@/pages/AdminPage";
import { OperacaoMonitorPage } from "@/pages/OperacaoMonitorPage";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ToastProvider } from "@/components/ui/toast";
import { GlobalDetailProvider } from "@/components/global-detail/GlobalDetailProvider";

function AppRoutes() {
  const location = useLocation();

  return (
    <div key={location.pathname} className="animate-in fade-in-0 slide-in-from-bottom-2">
      <Routes location={location}>
        <Route path="/" element={<LoginPage />} />
        <Route path="/monitor-operacao" element={<OperacaoMonitorPage />} />
        <Route
          path="/setor"
          element={
            <ProtectedRoute perfis={["setor"]}>
              <SetorPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute perfis={["admin", "superadmin"]}>
              <AdminPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <GlobalDetailProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </GlobalDetailProvider>
    </ToastProvider>
  );
}
