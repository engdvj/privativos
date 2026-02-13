import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { api } from "@/lib/api";

interface ProtectedRouteProps {
  perfis: Array<"setor" | "admin" | "superadmin">;
  children: React.ReactNode;
}

export function ProtectedRoute({ perfis, children }: ProtectedRouteProps) {
  const [validated, setValidated] = useState<boolean | null>(null);

  useEffect(() => {
    let isMounted = true;

    api.validateSetorAdminSession(perfis).then((ok) => {
      if (isMounted) {
        setValidated(ok);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [perfis]);

  if (validated === null) {
    return <div className="min-h-screen bg-background" />;
  }

  if (!validated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
