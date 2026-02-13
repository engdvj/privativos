import { Navigate } from "react-router-dom";
import { api } from "@/lib/api";

interface ProtectedRouteProps {
  perfil: string;
  children: React.ReactNode;
}

export function ProtectedRoute({ perfil, children }: ProtectedRouteProps) {
  if (!api.isAuthenticated() || api.getPerfil() !== perfil) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
