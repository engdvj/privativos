import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LoginPage } from "@/pages/LoginPage";
import { SetorPage } from "@/pages/SetorPage";
import { AdminPage } from "@/pages/AdminPage";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ToastProvider } from "@/components/ui/toast";
import { GlobalDetailProvider } from "@/components/global-detail/GlobalDetailProvider";

export default function App() {
  return (
    <ToastProvider>
      <GlobalDetailProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LoginPage />} />
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
        </BrowserRouter>
      </GlobalDetailProvider>
    </ToastProvider>
  );
}
