import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LoginPage } from "@/pages/LoginPage";
import { SetorPage } from "@/pages/SetorPage";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route
          path="/setor"
          element={
            <ProtectedRoute perfil="setor">
              <SetorPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute perfil="admin">
              <div className="flex min-h-screen items-center justify-center">
                <p className="text-muted-foreground">Painel Admin — em desenvolvimento</p>
              </div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
