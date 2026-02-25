import { useEffect, useRef, useState } from "react";
import { Loader2, LogOut, Moon, Sun } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGlobalDetail } from "@/components/global-detail/GlobalDetailProvider";

interface BuscaSugestao {
  tipo: "funcionario" | "kit";
  chave: string;
  titulo: string;
  subtitulo: string;
}

export function Header() {
  const navigate = useNavigate();
  const nome = api.getNome();
  const { openFuncionario, openKit } = useGlobalDetail();
  const [busca, setBusca] = useState("");
  const [loadingBusca, setLoadingBusca] = useState(false);
  const [sugestoes, setSugestoes] = useState<BuscaSugestao[]>([]);
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("theme") === "dark";
  });
  const containerBuscaDesktopRef = useRef<HTMLDivElement | null>(null);
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
      const clicouNoDesktop = containerBuscaDesktopRef.current?.contains(target);
      const clicouNoMobile = containerBuscaMobileRef.current?.contains(target);
      if (!clicouNoDesktop && !clicouNoMobile) {
        setMostrarSugestoes(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem("theme", darkMode ? "dark" : "light");
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

  function renderSugestoesDropdown() {
    if (!mostrarSugestoes || sugestoes.length === 0) return null;

    return (
      <div className="absolute inset-x-0 top-[calc(100%+8px)] z-50 rounded-xl border border-border/60 bg-popover shadow-lg backdrop-blur">
        <div className="max-h-72 overflow-auto p-1.5">
          {sugestoes.map((sugestao) => (
            <button
              key={`${sugestao.tipo}-${sugestao.chave}`}
              type="button"
              className="w-full rounded-lg px-3 py-2 text-left transition-colors hover:bg-accent/55"
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
    <header className="border-b border-border/35 bg-gradient-to-r from-[#0d3b66] via-[#0b7285] to-[#1f6feb] px-4 py-3 text-white shadow-md sm:px-6">
      <div className="flex w-full flex-col gap-3">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div
            ref={containerBuscaDesktopRef}
            className="relative hidden md:block md:min-w-0 md:w-full md:max-w-3xl md:justify-self-center"
          >
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

          <div className="flex items-center justify-end gap-2">
            <span className="block max-w-44 truncate rounded-full bg-white/14 px-3 py-1 text-sm text-white/95">
              {nome}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="rounded-lg bg-white/12 text-white ring-1 ring-white/22 hover:bg-white/24 hover:text-white"
              aria-label={darkMode ? "Ativar modo claro" : "Ativar modo escuro"}
              title={darkMode ? "Modo claro" : "Modo escuro"}
            >
              {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="rounded-lg bg-white/12 text-white ring-1 ring-white/22 hover:bg-white/24 hover:text-white"
              aria-label="Sair"
              title="Sair"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div ref={containerBuscaMobileRef} className="relative md:hidden">
          <Input
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            onFocus={() => {
              if (sugestoes.length > 0) setMostrarSugestoes(true);
            }}
            placeholder="Buscar kit, usuario ou matricula"
            className="h-9 border-white/30 bg-white/14 pr-10 text-white placeholder:text-white/75"
          />
          {loadingBusca ? (
            <Loader2 className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 animate-spin text-white/80" />
          ) : null}
          {renderSugestoesDropdown()}
        </div>
      </div>
    </header>
  );
}
