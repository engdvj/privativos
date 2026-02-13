import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
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
    <div className="flex min-h-dvh flex-col bg-background">
      <main className="flex flex-1 items-center justify-center p-4">
        <Card className="w-full max-w-md border-border/80 bg-white/88 backdrop-blur-sm dark:bg-slate-900/60">
          <CardHeader className="text-center">
            <div className="mb-2 flex justify-center">
              <img src="/privativos.png" alt="Controle de Privativos" className="h-32 w-32 rounded-2xl shadow-md object-cover" />
            </div>
            <CardTitle className="text-2xl text-[hsl(232,57%,26%)] dark:text-slate-100">Controle de Privativos</CardTitle>
            <CardDescription>Painel de emprestimos e devolucoes</CardDescription>
          </CardHeader>
          <CardContent>
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
              <Button type="submit" className="w-full" disabled={loading}>
                <LogIn className="h-4 w-4" />
                {loading ? "Entrando..." : "Entrar"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
