import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { LockKeyhole, LogIn, Search, UserRound } from "lucide-react";

interface LoginResponse {
  token: string;
  perfil: string;
  nome: string;
  tema_preferido?: string;
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

      api.saveSession(data.token, data.perfil, data.nome, data.tema_preferido);

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

  function abrirTelaAcompanhamento() {
    const opened = window.open(
      "/monitor-operacao",
      "monitor-operacao",
      "width=1080,height=760,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes",
    );

    if (!opened) {
      error("Não foi possível abrir a janela de acompanhamento");
      return;
    }

    opened.focus();
  }

  return (
    <div className="relative min-h-dvh overflow-hidden bg-background animate-in fade-in-0">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-background via-accent/25 to-secondary/55 dark:from-background dark:via-primary/8 dark:to-accent/18" />
        <div className="absolute -left-16 top-[-8.5rem] h-[26rem] w-[26rem] rounded-full bg-primary/28 blur-[120px] animate-drift-slower" />
        <div className="absolute right-[-9rem] bottom-[-10rem] h-[30rem] w-[30rem] rounded-full bg-secondary/75 blur-[132px] animate-drift-slow dark:bg-accent/30" />
        <div className="absolute left-[44%] top-[8%] h-44 w-44 rounded-full bg-success/20 blur-[88px] animate-drift-slow" />
      </div>

      <main className="relative mx-auto flex min-h-dvh w-full max-w-6xl items-center justify-center px-4 py-10 sm:px-6">
        <Card className="relative w-full max-w-md border-border/80 bg-card/95 shadow-[0_30px_60px_-34px_hsl(200_76%_20%_/_0.65)] backdrop-blur-xl animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2">
          <CardHeader className="space-y-3 pb-4 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.6rem] border border-primary/28 bg-gradient-to-br from-primary/18 via-background to-accent/52 p-3 shadow-[0_16px_40px_-24px_hsl(198_68%_26%_/_0.56)]">
              <img src="/logo-privativos.png" alt="Privativos" className="h-full w-full rounded-2xl object-cover shadow-[0_4px_18px_-10px_hsl(198_70%_12%_/_0.7)]" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-3xl font-black tracking-tight">Privativos</CardTitle>
              <CardDescription className="mx-auto max-w-sm text-[13px] leading-relaxed">Entre com suas credenciais para continuar.</CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-4 pt-0">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2 animate-in fade-in-0 slide-in-from-bottom-2" style={{ animationDelay: "80ms" }}>
                <Label htmlFor="usuario" className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Usuário
                </Label>
                <div className="relative">
                  <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="usuario"
                    type="text"
                    placeholder="Digite seu usuário"
                    value={usuario}
                    onChange={(e) => setUsuario(e.target.value)}
                    autoComplete="username"
                    className="h-11 rounded-xl border-border/80 bg-background/85 pl-10 text-foreground placeholder:text-muted-foreground/80 focus-visible:border-primary/55 focus-visible:ring-primary/35"
                  />
                </div>
              </div>

              <div className="space-y-2 animate-in fade-in-0 slide-in-from-bottom-2" style={{ animationDelay: "120ms" }}>
                <Label htmlFor="senha" className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Senha
                </Label>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="senha"
                    type="password"
                    placeholder="Digite sua senha"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    autoComplete="current-password"
                    className="h-11 rounded-xl border-border/80 bg-background/85 pl-10 text-foreground placeholder:text-muted-foreground/80 focus-visible:border-primary/55 focus-visible:ring-primary/35"
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="mt-1 h-11 w-full bg-gradient-to-r from-primary to-primary/85 text-primary-foreground shadow-[0_16px_34px_-18px_hsl(198_78%_22%_/_0.9)] hover:from-primary/95 hover:to-primary animate-in fade-in-0 slide-in-from-bottom-2"
                loading={loading}
                style={{ animationDelay: "160ms" }}
              >
                <LogIn className="h-4 w-4" />
                {loading ? "Entrando..." : "Entrar"}
              </Button>

              <Button
                type="button"
                variant="ghost"
                className="h-9 w-full text-xs font-medium text-muted-foreground hover:text-foreground animate-in fade-in-0 slide-in-from-bottom-2"
                style={{ animationDelay: "200ms" }}
                onClick={abrirTelaAcompanhamento}
              >
                <Search className="h-3.5 w-3.5" />
                Abrir janela de acompanhamento
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
