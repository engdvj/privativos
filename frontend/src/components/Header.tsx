import { useEffect, useRef, useState, type FormEvent } from "react";
import { Loader2, LogOut, Moon, Search, Settings, Sun, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
  tipo: "funcionario" | "kit" | "setor" | "unidade" | "funcao";
  chave: string;
  titulo: string;
  subtitulo: string;
}

export function Header() {
  const navigate = useNavigate();
  const [nome, setNome] = useState(() => api.getNome() ?? "");
  const perfilAtual = api.getPerfil();
  const { openByQuery, openFuncionario, openKit, openSetor, openUnidade, openFuncao } = useGlobalDetail();
  const [busca, setBusca] = useState("");
  const [buscaAberta, setBuscaAberta] = useState(false);
  const [loadingBusca, setLoadingBusca] = useState(false);
  const [sugestoes, setSugestoes] = useState<BuscaSugestao[]>([]);
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("theme") === "dark";
  });
  const [modalPerfilAberto, setModalPerfilAberto] = useState(false);
  const containerBuscaRef = useRef<HTMLDivElement | null>(null);
  const inputBuscaRef = useRef<HTMLInputElement | null>(null);
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
      const clicouNoContainer = containerBuscaRef.current?.contains(target);
      if (!clicouNoContainer) {
        setMostrarSugestoes(false);
        setBuscaAberta(false);
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
      // Ignora erro silenciosamente para nao atrapalhar UX
    });
  }, [darkMode]);

  useEffect(() => {
    if (!buscaAberta) {
      setMostrarSugestoes(false);
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      inputBuscaRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [buscaAberta]);

  useEffect(() => {
    if (!buscaAberta) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMostrarSugestoes(false);
        setBuscaAberta(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [buscaAberta]);

  useEffect(() => {
    const query = busca.trim();
    if (!buscaAberta || query.length < 2) {
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
          `/ops/busca-sugestoes?q=${encodeURIComponent(query)}&escopo=global`,
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
    }, 220);

    return () => clearTimeout(timeoutId);
  }, [busca, buscaAberta]);

  async function handleSelecionarSugestao(sugestao: BuscaSugestao) {
    setLoadingBusca(true);
    try {
      if (sugestao.tipo === "funcionario") {
        await openFuncionario(sugestao.chave);
      } else if (sugestao.tipo === "kit") {
        await openKit(sugestao.chave);
      } else if (sugestao.tipo === "setor") {
        await openSetor(sugestao.chave);
      } else if (sugestao.tipo === "unidade") {
        await openUnidade(sugestao.chave);
      } else if (sugestao.tipo === "funcao") {
        await openFuncao(sugestao.chave);
      } else {
        await openByQuery(sugestao.chave);
      }
      setBusca(sugestao.titulo);
      setMostrarSugestoes(false);
      setBuscaAberta(false);
    } finally {
      setLoadingBusca(false);
    }
  }

  async function handleSubmitBusca(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const query = busca.trim();
    if (!query) return;

    setLoadingBusca(true);
    try {
      await openByQuery(query);
      setMostrarSugestoes(false);
      setBuscaAberta(false);
    } finally {
      setLoadingBusca(false);
    }
  }

  function handleToggleBusca() {
    setBuscaAberta((prev) => {
      const next = !prev;
      if (!next) {
        setMostrarSugestoes(false);
      }
      return next;
    });
  }

  function handleLimparBusca() {
    setBusca("");
    setSugestoes([]);
    setMostrarSugestoes(false);
    inputBuscaRef.current?.focus();
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

  function handleNavegarInicio() {
    if (perfilAtual === "setor") {
      navigate("/setor");
      return;
    }
    navigate("/admin");
  }

  const circleIconButtonClass =
    "h-9 w-9 rounded-xl border border-white/22 bg-white/12 text-white transition-all duration-200 hover:-translate-y-0.5 hover:border-white/35 hover:bg-white/22 hover:text-white dark:border-border/80 dark:bg-background/62 dark:text-foreground dark:hover:border-border dark:hover:bg-accent/40";

  function renderSugestoesDropdown() {
    if (!mostrarSugestoes || sugestoes.length === 0) return null;

    return (
      <div className="absolute inset-x-0 bottom-[calc(100%+7px)] z-[72] rounded-xl border border-border/75 bg-popover/98 shadow-[var(--shadow-soft)] backdrop-blur-xl animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2 dark:border-border/90">
        <div className="max-h-64 overflow-auto p-1">
          {sugestoes.map((sugestao, index) => (
            <button
              key={`${sugestao.tipo}-${sugestao.chave}`}
              type="button"
              className="w-full rounded-lg px-2.5 py-1.5 text-left transition-all duration-150 hover:bg-accent/50 hover:translate-x-0.5 animate-in fade-in-0 slide-in-from-bottom-2"
              style={{ animationDelay: `${index * 24}ms` }}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                void handleSelecionarSugestao(sugestao);
              }}
            >
              <div className="text-[13px] font-semibold text-foreground">{sugestao.titulo}</div>
              <div className="text-[11px] text-muted-foreground">{sugestao.subtitulo}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <header className="border-b border-border/60 bg-gradient-to-r from-primary/95 via-primary/82 to-primary/75 px-4 py-2.5 text-primary-foreground shadow-[0_10px_28px_-22px_hsl(198_72%_16%_/_0.9)] backdrop-blur-xl animate-in fade-in-0 slide-in-from-top-2 dark:from-background dark:via-background dark:to-muted/45 dark:text-foreground sm:px-6">
        <div className="mx-auto flex w-full items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={handleNavegarInicio}
            aria-label="Ir para a tela inicial do Privativos"
            className="group inline-flex items-center rounded-md px-1 py-0.5 text-left transition-all duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 dark:focus-visible:ring-ring/70"
          >
            <span className="font-display text-lg font-extrabold tracking-tight text-white dark:text-foreground sm:text-xl">
              Privativos
            </span>
          </button>

          <div className="flex items-center gap-2">
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={circleIconButtonClass}
                  aria-label="Menu do usuario"
                  title={nome}
                >
                  <span className="text-xs font-medium">{getIniciais(nome)}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 rounded-2xl border-border/80 bg-popover/98 p-1.5 dark:border-border/90">
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="rounded-xl border border-border/65 bg-background/65 p-3 dark:border-border/85 dark:bg-background/58">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary/25 bg-primary/12 text-[11px] font-semibold text-primary">
                        {getIniciais(nome)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold leading-none text-foreground">{nome}</p>
                        <p className="mt-1 text-[11px] leading-none text-muted-foreground">Conta do usuario</p>
                      </div>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setModalPerfilAberto(true)}>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Editar perfil</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={toggleTheme}>
                  {darkMode ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
                  <span>{darkMode ? "Modo claro" : "Modo escuro"}</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="text-destructive focus:bg-destructive/12 focus:text-destructive dark:focus:bg-destructive/20"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sair</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div ref={containerBuscaRef} className="pointer-events-none fixed bottom-[3.95rem] right-3.5 z-[70] sm:bottom-[4.2rem] sm:right-5">
        <div className="pointer-events-auto flex items-center gap-2">
          {buscaAberta && (
            <div className="w-[min(92vw,19rem)] origin-bottom-right animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2">
              <form
                onSubmit={(event) => {
                  void handleSubmitBusca(event);
                }}
                className="relative"
              >
                {renderSugestoesDropdown()}

                <div className="rounded-xl border border-border/80 bg-card/94 p-1.5 shadow-[var(--shadow-soft)] backdrop-blur-xl dark:border-border/90 dark:bg-popover/94">
                  <div className="flex h-8 items-center gap-1.5 rounded-lg border border-border/80 bg-background/86 px-2 dark:border-border/90 dark:bg-background/72">
                    <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <input
                      ref={inputBuscaRef}
                      value={busca}
                      onChange={(event) => setBusca(event.target.value)}
                      onFocus={() => {
                        if (sugestoes.length > 0) setMostrarSugestoes(true);
                      }}
                      placeholder="Buscar funcionario, kit, setor, unidade ou funcao"
                      className="h-full min-w-0 flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground/80 outline-none"
                      aria-label="Busca global"
                    />

                    {busca.trim().length > 0 && !loadingBusca && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={handleLimparBusca}
                        aria-label="Limpar busca"
                        title="Limpar busca"
                        className="h-5 w-5 shrink-0 rounded-md text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}

                    {loadingBusca ? (
                      <Loader2 className="h-3 w-3 shrink-0 animate-spin text-primary" />
                    ) : (
                      <Button
                        type="submit"
                        size="icon"
                        className="h-5 w-5 shrink-0 rounded-md"
                        disabled={!busca.trim()}
                        aria-label="Executar busca global"
                        title="Buscar"
                      >
                        <Search className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </form>
            </div>
          )}

          <div className="relative">
            <Button
              type="button"
              size="icon"
              onClick={handleToggleBusca}
              aria-label={buscaAberta ? "Fechar busca global" : "Abrir busca global"}
              aria-expanded={buscaAberta}
              title={buscaAberta ? "Fechar busca global" : "Abrir busca global"}
              className={cn(
                "relative h-10 w-10 rounded-xl border border-border/75 bg-card/95 text-primary shadow-[var(--shadow-soft)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent/35 hover:text-primary dark:border-border/90 dark:bg-popover/90",
                buscaAberta ? "scale-95" : "scale-100",
              )}
            >
              {!buscaAberta && (
                <span className="pointer-events-none absolute -inset-0.5 rounded-xl border border-primary/25 animate-pulse-slow dark:border-primary/35" />
              )}
              {buscaAberta ? <X className="h-3.5 w-3.5" /> : <Search className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      </div>

      <EditarPerfilModal
        open={modalPerfilAberto}
        onClose={() => setModalPerfilAberto(false)}
        onPerfilAtualizado={handlePerfilAtualizado}
      />
    </>
  );
}
