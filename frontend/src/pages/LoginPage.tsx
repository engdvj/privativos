import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { LogIn } from "lucide-react";

interface LoginResponse {
  token: string;
  perfil: string;
  nome: string;
}

export function LoginPage() {
  const navigate = useNavigate();
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const { error } = useToast();

  useEffect(() => {
    let active = true;

    (async () => {
      if (!api.isAuthenticated()) return;

      const perfilAtual = api.getPerfil();
      if (perfilAtual !== "setor" && perfilAtual !== "admin" && perfilAtual !== "superadmin") return;

      const ok = await api.validateSetorAdminSession(perfilAtual);
      if (!active || !ok) return;

      navigate(perfilAtual === "setor" ? "/setor" : "/admin", { replace: true });
    })();

    return () => {
      active = false;
    };
  }, [navigate]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!usuario || !senha) {
      error("Preencha todos os campos");
      return;
    }

    setLoading(true);
    try {
      const data = await api.post<LoginResponse>("/auth/login", {
        usuario,
        senha,
      });

      api.saveSession(data.token, data.perfil, data.nome);

      if (data.perfil === "setor") {
        navigate("/setor");
      } else if (data.perfil === "admin" || data.perfil === "superadmin") {
        navigate("/admin");
      }
    } catch (err) {
      error(err instanceof Error ? err.message : "Erro ao fazer login");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-dvh overflow-hidden bg-[linear-gradient(160deg,#e2ecff_0%,#f7fbff_28%,#ffe8d6_58%,#d9f2ff_100%)]">
      <main className="relative flex min-h-dvh items-center justify-center px-4 py-10 sm:px-6">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(900px_460px_at_8%_0%,rgba(14,116,255,0.34),transparent_58%),radial-gradient(780px_460px_at_90%_100%,rgba(249,115,22,0.3),transparent_54%),radial-gradient(600px_320px_at_50%_80%,rgba(16,185,129,0.25),transparent_62%)]" />
          <div className="absolute top-5 left-6 h-40 w-40 rounded-full bg-blue-500/25 blur-[90px]" />
          <div className="absolute right-8 top-20 h-36 w-36 rounded-full bg-emerald-400/20 blur-[90px]" />
          <div className="absolute bottom-8 left-[12%] h-48 w-48 rounded-full bg-orange-400/20 blur-[110px]" />
        </div>

        <Card className="relative w-full max-w-md border-border/70 bg-surface-2/90 shadow-[var(--shadow-pop)] backdrop-blur-xl">
          <CardHeader className="pb-3 text-center">
            <div className="mb-2 flex justify-center">
              <img src="/privativos.png" alt="Controle de Privativos" className="h-16 w-16 rounded-2xl shadow-sm object-cover" />
            </div>
            <CardTitle className="text-2xl">Entrar no sistema</CardTitle>
            <CardDescription>Informe suas credenciais para continuar.</CardDescription>
          </CardHeader>

          <CardContent className="pt-0">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="usuario">Usuario</Label>
                <Input
                  id="usuario"
                  type="text"
                  placeholder="Digite seu usuario"
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                  autoComplete="username"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="senha">Senha</Label>
                <Input
                  id="senha"
                  type="password"
                  placeholder="Digite sua senha"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  autoComplete="current-password"
                />
              </div>

              <Button type="submit" className="mt-1 w-full" loading={loading}>
                <LogIn className="h-4 w-4" />
                {loading ? "Entrando..." : "Entrar"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
