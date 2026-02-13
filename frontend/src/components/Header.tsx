import { useEffect, useRef, useState } from "react";
import { Loader2, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGlobalDetail } from "@/components/global-detail/GlobalDetailProvider";

interface HeaderProps {
  onLogoClick?: () => void;
}

interface BuscaSugestao {
  tipo: "funcionario" | "kit";
  chave: string;
  titulo: string;
  subtitulo: string;
}

export function Header({ onLogoClick }: HeaderProps) {
  const navigate = useNavigate();
  const nome = api.getNome();
  const { openFuncionario, openKit } = useGlobalDetail();
  const [busca, setBusca] = useState("");
  const [loadingBusca, setLoadingBusca] = useState(false);
  const [sugestoes, setSugestoes] = useState<BuscaSugestao[]>([]);
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false);
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

  function renderSugestoesDropdown() {
    if (!mostrarSugestoes || sugestoes.length === 0) return null;
    return (
      <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 rounded-md border border-border/70 bg-background shadow-lg">
        <div className="max-h-72 overflow-auto p-1">
          {sugestoes.map((sugestao) => (
            <button
              key={`${sugestao.tipo}-${sugestao.chave}`}
              type="button"
              className="w-full rounded-sm px-3 py-2 text-left transition-colors hover:bg-muted"
              onClick={() => {
                void handleSelecionarSugestao(sugestao);
              }}
            >
              <div className="text-sm font-medium">{sugestao.titulo}</div>
              <div className="text-xs text-muted-foreground">{sugestao.subtitulo}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <header className="border-b border-indigo-200/20 bg-gradient-to-l from-[#6A6CFF] via-[#3D33DB] to-[#1D1097] px-3 py-3 text-white shadow-md sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          className="group flex items-center rounded-md px-1 py-1 text-left transition-all hover:bg-white/10 disabled:cursor-default disabled:hover:bg-transparent"
          onClick={onLogoClick}
          disabled={!onLogoClick}
        >
          <img src="/privativos.png" alt="Privativos" className="h-10 w-10 rounded-md object-cover" />
        </button>

        <div ref={containerBuscaDesktopRef} className="relative hidden flex-1 md:block md:max-w-xl">
          <Input
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            onFocus={() => {
              if (sugestoes.length > 0) setMostrarSugestoes(true);
            }}
            placeholder="Busca global: kit, usuario ou matricula"
            className="h-9 border-white/35 bg-white/12 pr-10 text-white placeholder:text-white/70"
          />
          {loadingBusca && <Loader2 className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 animate-spin text-white/80" />}
          {renderSugestoesDropdown()}
        </div>

        <div className="flex items-center gap-2">
          <span className="block max-w-44 truncate px-1 text-sm text-white/95">{nome}</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            className="rounded-md bg-white/10 text-white ring-1 ring-white/20 hover:bg-white/20 hover:text-white"
            aria-label="Sair"
            title="Sair"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div ref={containerBuscaMobileRef} className="relative mt-3 md:hidden">
        <Input
          value={busca}
          onChange={(event) => setBusca(event.target.value)}
          onFocus={() => {
            if (sugestoes.length > 0) setMostrarSugestoes(true);
          }}
          placeholder="Buscar kit, usuario ou matricula"
          className="h-9 border-white/35 bg-white/12 pr-10 text-white placeholder:text-white/70"
        />
        {loadingBusca && <Loader2 className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 animate-spin text-white/80" />}
        {renderSugestoesDropdown()}
      </div>
    </header>
  );
}
