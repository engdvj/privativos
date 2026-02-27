import { useEffect, useRef, useState } from "react";
import { Loader2, LogOut, Moon, Sun, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGlobalDetail } from "@/components/global-detail/GlobalDetailProvider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EditarPerfilModal } from "@/components/EditarPerfilModal";

interface BuscaSugestao {
  tipo: "funcionario" | "kit";
  chave: string;
  titulo: string;
  subtitulo: string;
}

export function Header() {
  const navigate = useNavigate();
  const [nome, setNome] = useState(() => api.getNome() ?? "");
  const { openFuncionario, openKit } = useGlobalDetail();
  const [busca, setBusca] = useState("");
  const [loadingBusca, setLoadingBusca] = useState(false);
  const [sugestoes, setSugestoes] = useState<BuscaSugestao[]>([]);
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("theme") === "dark";
  });
  const [modalPerfilAberto, setModalPerfilAberto] = useState(false);
  const containerBuscaMobileRef = useRef<HTMLDivElement | null>(null);
  const requestIdRef = useRef(0);

  async function handleLogout() {
    try {
      await api.post("/auth/logout");
    } catch {
      // ignore
    }
    api.clearSession();
    navigate("/");
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const clicouNoMobile = containerBuscaMobileRef.current?.contains(target);
      if (!clicouNoMobile) {
        setMostrarSugestoes(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const tema = darkMode ? "dark" : "light";
    document.documentElement.classList.toggle("dark", darkMode);

    // Salva no backend (async, sem bloquear UI)
    api.atualizarTema(tema as "light" | "dark").catch(() => {
      // Ignora erro silenciosamente para não atrapalhar UX
    });
  }, [darkMode]);

  useEffect(() => {
    const query = busca.trim();
    if (query.length < 2) {
      setSugestoes([]);
      setMostrarSugestoes(false);
      setLoadingBusca(false);
      return;
    }

    const currentRequestId = ++requestIdRef.current;
    const timeoutId = setTimeout(async () => {
      setLoadingBusca(true);
      try {
        const data = await api.get<{ sugestoes: BuscaSugestao[] }>(
          `/ops/busca-sugestoes?q=${encodeURIComponent(query)}`,
        );
        if (currentRequestId !== requestIdRef.current) return;
        setSugestoes(data.sugestoes);
        setMostrarSugestoes(true);
      } catch {
        if (currentRequestId !== requestIdRef.current) return;
        setSugestoes([]);
        setMostrarSugestoes(false);
      } finally {
        if (currentRequestId === requestIdRef.current) {
          setLoadingBusca(false);
        }
      }
    }, 250);

    return () => clearTimeout(timeoutId);
  }, [busca]);

  async function handleSelecionarSugestao(sugestao: BuscaSugestao) {
    setLoadingBusca(true);
    try {
      if (sugestao.tipo === "funcionario") {
        await openFuncionario(sugestao.chave);
      } else {
        await openKit(sugestao.chave);
      }
      setBusca(sugestao.chave);
      setMostrarSugestoes(false);
    } finally {
      setLoadingBusca(false);
    }
  }

  function toggleTheme() {
    setDarkMode((prev) => !prev);
  }

  function getIniciais(nomeCompleto: string): string {
    const palavras = nomeCompleto.trim().split(/\s+/);
    if (palavras.length === 1) {
      return palavras[0].substring(0, 2).toUpperCase();
    }
    return (palavras[0][0] + palavras[palavras.length - 1][0]).toUpperCase();
  }

  function handlePerfilAtualizado(novoNome: string) {
    setNome(novoNome);
  }

  const circleIconButtonClass =
    "rounded-full bg-white/12 text-white ring-1 ring-white/22 transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/24 hover:text-white";

  function renderSugestoesDropdown() {
    if (!mostrarSugestoes || sugestoes.length === 0) return null;

    return (
      <div className="absolute inset-x-0 top-[calc(100%+8px)] z-50 rounded-xl border border-border/60 bg-popover shadow-lg backdrop-blur animate-in fade-in-0 zoom-in-95 slide-in-from-top-2">
        <div className="max-h-72 overflow-auto p-1.5">
          {sugestoes.map((sugestao) => (
            <button
              key={`${sugestao.tipo}-${sugestao.chave}`}
              type="button"
              className="w-full rounded-lg px-3 py-2 text-left transition-all duration-150 hover:bg-accent/55 hover:translate-x-0.5"
              onClick={() => {
                void handleSelecionarSugestao(sugestao);
              }}
            >
              <div className="text-sm font-medium text-foreground">{sugestao.titulo}</div>
              <div className="text-xs text-muted-foreground">{sugestao.subtitulo}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <header className="border-b border-border/35 bg-gradient-to-r from-[#0d3b66] via-[#0b7285] to-[#1f6feb] px-4 py-3 text-white shadow-md animate-in fade-in-0 slide-in-from-top-2 sm:px-6">
      <div className="mx-auto flex w-full items-center gap-3 md:grid md:grid-cols-[1fr_minmax(0,64rem)_1fr]">
        <div className="order-2 flex shrink-0 items-center justify-end gap-2 md:col-start-3 md:justify-self-end">
          <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={circleIconButtonClass}
                  aria-label="Menu do usuário"
                  title={nome}
                >
                  <span className="text-xs font-medium">{getIniciais(nome)}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{nome}</p>
                    <p className="text-xs leading-none text-muted-foreground">Conta do usuário</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setModalPerfilAberto(true)}>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Editar perfil</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className={circleIconButtonClass}
              aria-label={darkMode ? "Ativar modo claro" : "Ativar modo escuro"}
              title={darkMode ? "Modo claro" : "Modo escuro"}
            >
              {darkMode ? <Sun className="h-4 w-4 animate-in fade-in-0 zoom-in-95" /> : <Moon className="h-4 w-4 animate-in fade-in-0 zoom-in-95" />}
            </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            className={circleIconButtonClass}
            aria-label="Sair"
            title="Sair"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>

        <div ref={containerBuscaMobileRef} className="order-1 relative min-w-0 flex-1 md:col-start-2 md:w-full">
          <Input
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            onFocus={() => {
              if (sugestoes.length > 0) setMostrarSugestoes(true);
            }}
            placeholder="Busca global: kit, usuario ou matricula"
            className="h-9 border-white/30 bg-white/14 pr-10 text-white placeholder:text-white/75"
          />
          {loadingBusca ? (
            <Loader2 className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 animate-spin text-white/80" />
          ) : null}
          {renderSugestoesDropdown()}
        </div>
      </div>

      <EditarPerfilModal
        open={modalPerfilAberto}
        onClose={() => setModalPerfilAberto(false)}
        onPerfilAtualizado={handlePerfilAtualizado}
      />
    </header>
  );
}
