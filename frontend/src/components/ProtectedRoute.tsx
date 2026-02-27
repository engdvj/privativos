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
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-5xl space-y-4 animate-in fade-in-0">
          <div className="h-12 rounded-2xl bg-muted animate-pulse-slow" />
          <div className="h-40 rounded-2xl bg-muted/80 animate-pulse-slow" />
          <div className="h-64 rounded-2xl bg-muted/65 animate-pulse-slow" />
        </div>
      </div>
    );
  }

  if (!validated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
