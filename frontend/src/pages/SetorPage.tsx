import { useEffect, useRef, useState, type CSSProperties } from "react";
import { api } from "@/lib/api";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { StatusPill } from "@/components/ui/status-pill";
import { SetorItensPanel } from "@/components/setor/SetorItensPanel";
import { cn } from "@/lib/utils";
import { publishOperacaoMonitor, type MonitorTipoOperacao } from "@/lib/operacao-monitor";
import {
  Boxes,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Package,
  Undo2,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  X,
  SearchX,
  WifiOff,
  CircleAlert,
  ChevronRight,
  Building2,
  UserRound,
  Minus,
  Plus,
} from "lucide-react";

interface FuncionarioInfo {
  nome: string;
  unidade: string;
  setor: string;
  kits_em_uso: number;
  max_kits: number;
}

interface ItemEmprestado {
  codigo: string;
  descricao: string | null;
  tipo: string;
  tamanho: string;
}

interface TamanhoDisponivel {
  tipo: string;
  tamanho: string;
  disponiveis: number;
}

interface PendenciaSetor {
  setor: string;
  tipo: string;
  tamanho: string;
  quantidade_pendente: number;
}

interface PendenciasSetorResponse {
  setor: string | null;
  total_pendente: number;
  pendencias: PendenciaSetor[];
}

interface TamanhoDisponivelOpcao extends TamanhoDisponivel {
  disponiveis_restantes: number;
}

interface PendenciaDisponivelOpcao extends PendenciaSetor {
  quantidade_disponivel: number;
}

interface BuscaSugestao {
  tipo: "funcionario" | "kit";
  chave: string;
  titulo: string;
  subtitulo: string;
}

interface SelecaoPedido {
  tipo: string;
  tamanho: string;
  quantidade: number;
}

type BuscaGlobalResultado =
  | {
      tipo: "funcionario";
      funcionario: {
        matricula: string;
      };
    }
  | {
      tipo: "kit";
      kit: {
        codigo: string;
        solicitante_matricula: string | null;
      };
    }
  | {
      tipo: "sugestoes_funcionario";
      sugestoes: Array<{
        matricula: string;
        nome: string;
        setor: string;
        funcao: string;
      }>;
    }
  | {
      tipo: "nao_encontrado";
    };

type Etapa = "busca" | "resumo" | "resultado";
type BuscaEstado = "idle" | "loading" | "success" | "empty" | "notFound" | "networkError" | "error";
type OperacaoTipo = "solicitacao" | "devolucao";

function enviarMonitorEmEspera(mensagem: string) {
  publishOperacaoMonitor({
    kind: "waiting",
    timestamp: new Date().toISOString(),
    mensagem,
  });
}

function enviarMonitorResumo(params: {
  tipo: MonitorTipoOperacao;
  matricula: string;
  funcionario: FuncionarioInfo;
  quantidade: number;
  tipoItem?: string | null;
  tamanho?: string | null;
  selecoes?: SelecaoPedido[];
  itens?: ItemEmprestado[];
}) {
  publishOperacaoMonitor({
    kind: "resumo",
    timestamp: new Date().toISOString(),
    data: {
      tipo: params.tipo,
      funcionarioNome: params.funcionario.nome,
      funcionarioUnidade: params.funcionario.unidade,
      funcionarioSetor: params.funcionario.setor,
      matricula: params.matricula,
      quantidade: params.quantidade,
      tipo_item: params.tipoItem ?? null,
      tamanho: params.tamanho ?? null,
      selecoes: params.selecoes ?? [],
      itens: (params.itens ?? []).map((item) => ({
        codigo: item.codigo,
        descricao: item.descricao,
        tipo: item.tipo,
        tamanho: item.tamanho,
      })),
    },
  });
}

function descricaoItemLabel(descricao: string | null | undefined) {
  const normalized = (descricao ?? "").trim();
  return normalized;
}

function chaveSelecao(tipo: string, tamanho: string) {
  return `${tipo}::${tamanho}`;
}

function enviarMonitorResultado(params: {
  tipo: MonitorTipoOperacao;
  sucesso: boolean;
  mensagem: string;
  itens: string[];
}) {
  publishOperacaoMonitor({
    kind: "resultado",
    timestamp: new Date().toISOString(),
    data: {
      tipo: params.tipo,
      sucesso: params.sucesso,
      mensagem: params.mensagem,
      itens: params.itens,
    },
  });
}

function createBuscaError(estado: BuscaEstado, mensagem: string) {
  const err = new Error(mensagem) as Error & { buscaEstado?: BuscaEstado };
  err.buscaEstado = estado;
  return err;
}

function classificarErroBusca(err: unknown, mensagemNotFound: string) {
  if (typeof err === "object" && err !== null && "buscaEstado" in err) {
    const estado = (err as { buscaEstado?: BuscaEstado }).buscaEstado ?? "error";
    const mensagem = err instanceof Error ? err.message : "Erro ao buscar dados.";
    return { estado, mensagem };
  }

  const status = typeof err === "object" && err !== null && "status" in err
    ? Number((err as { status?: unknown }).status)
    : null;
  const mensagem = err instanceof Error ? err.message : "Erro ao buscar dados.";

  if (status === 404) {
    return { estado: "notFound" as const, mensagem: mensagemNotFound };
  }

  if (err instanceof TypeError || /failed to fetch|network|fetch/i.test(mensagem)) {
    return { estado: "networkError" as const, mensagem: "Erro de rede. Verifique a conexão." };
  }

  return { estado: "error" as const, mensagem: mensagem || "Erro ao buscar dados." };
}

function obterStatusErro(err: unknown): number | null {
  if (typeof err !== "object" || err === null || !("status" in err)) {
    return null;
  }
  return Number((err as { status?: unknown }).status);
}

function normalizarBusca(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

async function resolverMatriculaPorTermo(termoEntrada: string): Promise<string> {
  const termo = termoEntrada.trim();
  const termoNumerico = /^\d+$/.test(termo);

  const resultado = await api.get<BuscaGlobalResultado>(`/ops/busca-global?q=${encodeURIComponent(termo)}`);

  if (resultado.tipo === "funcionario") {
    return resultado.funcionario.matricula;
  }

  if (resultado.tipo === "kit") {
    // Evita colisão quando o código do kit é igual a uma matrícula numérica.
    if (termoNumerico) {
      try {
        await api.get<FuncionarioInfo>(`/ops/funcionario/${encodeURIComponent(termo)}`);
        return termo;
      } catch (err) {
        const status = obterStatusErro(err);
        if (status !== 404) {
          throw err;
        }
      }
    }

    if (!resultado.kit.solicitante_matricula) {
      throw createBuscaError("empty", "Kit sem empréstimo ativo no momento.");
    }
    return resultado.kit.solicitante_matricula;
  }

  if (resultado.tipo === "sugestoes_funcionario") {
    const termoNormalizado = normalizarBusca(termo);
    const sugestaoExata = resultado.sugestoes.find(
      (row) =>
        normalizarBusca(row.matricula) === termoNormalizado ||
        normalizarBusca(row.nome) === termoNormalizado,
    );

    if (sugestaoExata) {
      return sugestaoExata.matricula;
    }

    throw createBuscaError("idle", "Encontramos mais de um funcionário. Selecione uma sugestão.");
  }

  throw createBuscaError("notFound", "Nenhum funcionário ou kit encontrado.");
}

function useBuscaSugestoes(termo: string, enabled: boolean) {
  const [sugestoes, setSugestoes] = useState<BuscaSugestao[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const query = termo.trim();
    if (!enabled || query.length < 2) {
      setSugestoes([]);
      setLoading(false);
      return;
    }

    let ativo = true;
    const timeoutId = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await api.get<{ sugestoes: BuscaSugestao[] }>(
          `/ops/busca-sugestoes?q=${encodeURIComponent(query)}`,
        );
        if (!ativo) return;
        setSugestoes(data.sugestoes ?? []);
      } catch {
        if (!ativo) return;
        setSugestoes([]);
      } finally {
        if (ativo) {
          setLoading(false);
        }
      }
    }, 250);

    return () => {
      ativo = false;
      clearTimeout(timeoutId);
    };
  }, [termo, enabled]);

  return { sugestoes, sugestoesLoading: loading };
}

function useDelicateTransition(trigger: string, duration = 320) {
  const [ativo, setAtivo] = useState(false);

  useEffect(() => {
    setAtivo(false);
    const frame = window.requestAnimationFrame(() => {
      setAtivo(true);
    });
    const timeout = window.setTimeout(() => {
      setAtivo(false);
    }, duration);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [trigger, duration]);

  return ativo;
}

function SearchSection({
  id,
  matricula,
  matriculaError,
  loading,
  canClear,
  sugestoes,
  sugestoesLoading,
  showSugestoes,
  onMatriculaChange,
  onLimpar,
  onSelecionarSugestao,
}: {
  id: string;
  matricula: string;
  matriculaError: string | null;
  loading: boolean;
  canClear: boolean;
  sugestoes: BuscaSugestao[];
  sugestoesLoading: boolean;
  showSugestoes: boolean;
  onMatriculaChange: (value: string) => void;
  onLimpar: () => void;
  onSelecionarSugestao: (sugestao: BuscaSugestao) => void;
}) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id} className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Identificação
        </Label>

      </div>

      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <div className="relative z-30 space-y-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id={id}
              value={matricula}
              placeholder="Matrícula, nome ou código do kit"
              autoComplete="off"
              aria-invalid={Boolean(matriculaError)}
              aria-describedby={matriculaError ? errorId : hintId}
              onChange={(e) => onMatriculaChange(e.target.value)}
              className={cn(
                "h-11 rounded-xl border-border/80 bg-background pl-9 text-sm",
                matriculaError && "border-destructive/60",
              )}
            />
          </div>

          {matriculaError ? (
            <p id={errorId} role="alert" className="text-xs font-medium text-destructive">
              {matriculaError}
            </p>
          ) : null}

          {showSugestoes && (sugestoesLoading || sugestoes.length > 0) ? (
            <div className="absolute inset-x-0 top-[calc(100%+8px)] z-50 max-h-64 overflow-y-auto rounded-xl border border-border/70 bg-popover p-2 shadow-[var(--shadow-soft)]">
              {sugestoesLoading ? (
                <p className="px-2 py-2 text-xs text-muted-foreground">Buscando sugestões...</p>
              ) : (
                sugestoes.map((sugestao) => (
                  <button
                    key={`${sugestao.tipo}-${sugestao.chave}`}
                    type="button"
                    className="w-full rounded-lg px-2 py-2 text-left transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => onSelecionarSugestao(sugestao)}
                  >
                    <p className="text-xs font-semibold text-foreground">{sugestao.titulo}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{sugestao.subtitulo}</p>
                  </button>
                ))
              )}
            </div>
          ) : null}
        </div>

        <Button
          onClick={onLimpar}
          disabled={loading || !canClear}
          variant="outline"
          size="icon"
          className="h-11 w-11 rounded-xl"
          aria-label="Limpar busca"
          title="Limpar busca"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function BuscaSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-12 rounded-xl border border-border/60 bg-surface-2/75 animate-pulse-slow" />
      <div className="h-24 rounded-xl border border-border/60 bg-surface-2/65 animate-pulse-slow" />
    </div>
  );
}

function BuscaEstadoCard({
  estado,
  mensagem,
  onRetry,
}: {
  estado: BuscaEstado;
  mensagem: string | null;
  onRetry?: () => void;
}) {
  if (estado === "idle" || estado === "success" || estado === "loading") {
    return null;
  }

  if (estado === "empty") {
    return (
      <div className="rounded-xl border border-border/70 bg-surface-2/65 p-4 text-center">
        <Package className="mx-auto mb-2 h-6 w-6 text-muted-foreground/60" />
        <p className="text-sm font-semibold text-foreground">Nenhum resultado encontrado.</p>
        {mensagem ? <p className="mt-1 text-xs text-muted-foreground">{mensagem}</p> : null}
      </div>
    );
  }

  const isNotFound = estado === "notFound";
  const isNetworkError = estado === "networkError";
  const Icon = isNotFound ? SearchX : isNetworkError ? WifiOff : CircleAlert;
  const titulo = isNotFound ? "Funcionário não encontrado" : isNetworkError ? "Erro de rede" : "Erro na busca";

  return (
    <div
      className={cn(
        "rounded-xl border p-4",
        isNotFound ? "border-border/70 bg-surface-2/65" : "border-destructive/35 bg-destructive/10",
      )}
      role={isNotFound ? undefined : "alert"}
    >
      <div className="flex items-start gap-3">
        <Icon className={cn("mt-0.5 h-4 w-4", isNotFound ? "text-muted-foreground" : "text-destructive")} />
        <div className="space-y-2">
          <p className="text-sm font-semibold text-foreground">{titulo}</p>
          {mensagem ? <p className="text-xs text-muted-foreground">{mensagem}</p> : null}
          {isNetworkError && onRetry && (
            <Button onClick={onRetry} size="sm" variant="outline" className="h-8 rounded-lg text-xs">
              <RefreshCw className="h-3.5 w-3.5" />
              Tentar novamente
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function OperacaoStepper({
  value,
  onChange,
  min = 1,
  max = 99,
  disabled = false,
  label,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  label?: string;
}) {
  const canDecrement = value > min;
  const canIncrement = value < max;

  return (
    <div className="space-y-2">
      {label ? <Label className="text-xs text-muted-foreground">{label}</Label> : null}
      <div className="flex h-11 items-center rounded-xl border border-border/70 bg-background px-1">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={() => {
            if (canDecrement && !disabled) onChange(value - 1);
          }}
          disabled={disabled || !canDecrement}
          className="h-9 w-9 rounded-lg"
          aria-label="Diminuir quantidade"
        >
          <Minus className="h-4 w-4" />
        </Button>

        <div className="flex flex-1 justify-center px-2">
          <input
            type="number"
            min={min}
            max={max}
            value={value}
            disabled={disabled}
            onChange={(event) => {
              const parsed = Number.parseInt(event.target.value, 10);
              if (Number.isNaN(parsed)) return;
              onChange(Math.min(max, Math.max(min, parsed)));
            }}
            className="h-9 w-full bg-transparent text-center text-sm font-semibold tabular-nums text-foreground focus-visible:outline-none disabled:opacity-60 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            aria-label="Quantidade"
          />
        </div>

        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={() => {
            if (canIncrement && !disabled) onChange(value + 1);
          }}
          disabled={disabled || !canIncrement}
          className="h-9 w-9 rounded-lg"
          aria-label="Aumentar quantidade"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function ResumoEtapa({
  tipo,
  funcionario,
  matricula,
  quantidade,
  tipoItem,
  tamanho,
  selecoes,
  itens,
  loading,
  onCancelar,
  onConfirmar,
}: {
  tipo: "emprestimo" | "devolucao";
  funcionario: FuncionarioInfo;
  matricula: string;
  quantidade?: number;
  tipoItem?: string;
  tamanho?: string;
  selecoes?: SelecaoPedido[];
  itens?: ItemEmprestado[];
  loading: boolean;
  onCancelar: () => void;
  onConfirmar: () => void;
}) {
  const isEmprestimo = tipo === "emprestimo";
  const Icon = isEmprestimo ? Package : Undo2;
  const totalSelecionado = isEmprestimo
    ? quantidade ?? selecoes?.reduce((acc, item) => acc + item.quantidade, 0) ?? 0
    : itens?.length ?? 0;
  const selecoesFallback = tipoItem
    ? [
        {
          tipo: tipoItem,
          tamanho: tamanho ?? "-",
          quantidade: quantidade ?? 1,
        },
      ]
    : [];
  const selecoesResumo = selecoes && selecoes.length > 0 ? selecoes : selecoesFallback;

  return (
    <Card className="border-border/70 bg-card/95 shadow-sm animate-in fade-in-0 slide-in-from-bottom-2">
      <CardContent className="p-4 sm:p-6">
        <div className="mx-auto max-w-xl space-y-4">
          <div className="space-y-2 text-center">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-primary/25 bg-primary/10">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">
              {isEmprestimo ? "Confirmar Solicitação" : "Confirmar Devolução"}
            </h3>
            <p className="text-sm text-muted-foreground">Revise as informações antes de confirmar.</p>
          </div>

          <div className="space-y-4">
            <section className="space-y-4">
              <div className="overflow-hidden rounded-xl border border-border/70 bg-surface-2/60">
                <div className="border-b border-border px-4 py-2.5">
                  <h4 className="text-sm font-semibold text-foreground">Dados do usuário</h4>
                </div>
                <div className="divide-y divide-border">
                  <div className="flex items-center justify-between gap-4 px-4 py-2.5">
                    <span className="text-sm text-muted-foreground">Funcionário</span>
                    <span className="text-sm font-semibold text-foreground">{funcionario.nome}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4 px-4 py-2.5">
                    <span className="text-sm text-muted-foreground">Matrícula</span>
                    <span className="font-mono text-sm font-semibold text-foreground">{matricula}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4 px-4 py-2.5">
                    <span className="text-sm text-muted-foreground">Unidade</span>
                    <span className="text-sm font-semibold text-foreground">{funcionario.unidade}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4 px-4 py-2.5">
                    <span className="text-sm text-muted-foreground">Setor</span>
                    <span className="text-sm font-semibold text-foreground">{funcionario.setor}</span>
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <div className="rounded-xl border border-border/70 bg-surface-2/60 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-foreground">
                    {isEmprestimo ? "Pedido" : "Itens para devolução"}
                  </h4>
                  <StatusPill tone="info">
                    {totalSelecionado} {totalSelecionado === 1 ? "item" : "itens"}
                  </StatusPill>
                </div>

                {isEmprestimo ? (
                  selecoesResumo.length > 0 ? (
                    <div className="max-h-40 divide-y divide-border overflow-y-auto rounded-xl border border-border/70 bg-background">
                      {selecoesResumo.map((selecao) => (
                        <div
                          key={chaveSelecao(selecao.tipo, selecao.tamanho)}
                          className="flex items-center justify-between gap-3 px-3 py-2.5"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusPill tone="neutral">{selecao.tipo}</StatusPill>
                            <StatusPill tone="neutral">{selecao.tamanho}</StatusPill>
                          </div>
                          <StatusPill tone="info" className="tabular-nums">
                            {selecao.quantidade}
                          </StatusPill>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-border/70 bg-background p-3 text-center">
                      <p className="text-sm text-muted-foreground">Nenhum item selecionado para solicitação.</p>
                    </div>
                  )
                ) : itens && itens.length > 0 ? (
                  <div className="max-h-40 divide-y divide-border overflow-y-auto rounded-xl border border-border/70 bg-background">
                    {itens.map((item) => (
                      <div key={item.codigo} className="space-y-1.5 px-3 py-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusPill tone="info" className="font-mono">{item.codigo}</StatusPill>
                          <StatusPill tone="neutral">{item.tipo}</StatusPill>
                          <StatusPill tone="neutral">{item.tamanho}</StatusPill>
                        </div>
                        <p className="truncate text-sm text-muted-foreground">{descricaoItemLabel(item.descricao)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-border/70 bg-background p-3 text-center">
                    <p className="text-sm text-muted-foreground">Nenhum item selecionado para devolução.</p>
                  </div>
                )}
              </div>
            </section>
          </div>

          <div className="mx-auto flex w-full max-w-md flex-col-reverse gap-3 sm:flex-row sm:justify-center">
            <Button onClick={onCancelar} disabled={loading} variant="outline" className="h-11 w-full rounded-xl text-sm sm:w-44">
              Cancelar
            </Button>
            <Button onClick={onConfirmar} disabled={loading} className="h-11 w-full rounded-xl text-sm sm:w-44">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Confirmar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ResultadoEtapa({
  tipo,
  resultado,
  onReset,
}: {
  tipo: "emprestimo" | "devolucao";
  resultado: { sucesso: boolean; itens: string[] };
  onReset: () => void;
}) {
  const isEmprestimo = tipo === "emprestimo";

  return (
    <Card className="border-border/70 bg-card/95 shadow-sm animate-in fade-in-0 slide-in-from-bottom-2">
      <CardContent className="p-6">
        <div className="mx-auto max-w-3xl space-y-6">
          <div className="space-y-2 text-center">
            <div className="flex justify-center">
              <div
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-2xl border",
                  resultado.sucesso ? "border-success/30 bg-success/10" : "border-border/70 bg-muted/45",
                )}
              >
                {resultado.sucesso ? (
                  <CheckCircle2 className="h-6 w-6 text-success" />
                ) : (
                  <XCircle className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
            </div>

            <h3 className="text-xl font-semibold text-foreground">
              {resultado.sucesso ? (isEmprestimo ? "Solicitação realizada" : "Devolução realizada") : "Operação cancelada"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {resultado.sucesso
                ? isEmprestimo
                  ? "A solicitação foi confirmada com sucesso."
                  : "A devolução foi confirmada com sucesso."
                : "A operação foi cancelada e nenhuma alteração foi realizada."}
            </p>
          </div>

          <div className="flex justify-center">
            <Button onClick={onReset} variant="outline" className="h-11 w-full rounded-xl text-sm sm:w-48">
              <RefreshCw className="h-4 w-4" />
              Nova Operação
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
function EmprestimoTab() {
  const [matricula, setMatricula] = useState("");
  const [matriculaError, setMatriculaError] = useState<string | null>(null);
  const [funcionario, setFuncionario] = useState<FuncionarioInfo | null>(null);
  const [tamanhosDisponiveis, setTamanhosDisponiveis] = useState<TamanhoDisponivel[]>([]);
  const [tipoSelecionado, setTipoSelecionado] = useState("");
  const [tamanhoSelecionado, setTamanhoSelecionado] = useState("");
  const [quantidadeSelecionada, setQuantidadeSelecionada] = useState(1);
  const [pedido, setPedido] = useState<SelecaoPedido[]>([]);
  const [etapa, setEtapa] = useState<Etapa>("busca");
  const [resultado, setResultado] = useState<{ sucesso: boolean; itens: string[] } | null>(null);
  const [buscaEstado, setBuscaEstado] = useState<BuscaEstado>("idle");
  const [buscaMensagem, setBuscaMensagem] = useState<string | null>(null);
  const [buscaLoading, setBuscaLoading] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const ultimoTermoBuscadoRef = useRef("");
  const { sugestoes, sugestoesLoading } = useBuscaSugestoes(
    matricula,
    etapa === "busca" && !funcionario && !buscaLoading,
  );
  const { success, error } = useToast();

  function limparTudo() {
    setMatricula("");
    setMatriculaError(null);
    setFuncionario(null);
    setTamanhosDisponiveis([]);
    setTipoSelecionado("");
    setTamanhoSelecionado("");
    setQuantidadeSelecionada(1);
    setPedido([]);
    setResultado(null);
    setBuscaEstado("idle");
    setBuscaMensagem(null);
    setEtapa("busca");
    ultimoTermoBuscadoRef.current = "";
    enviarMonitorEmEspera("Aguardando uma nova operação.");
  }

  function onMatriculaChange(value: string) {
    setMatricula(value);
    setMatriculaError(null);

    if (funcionario || buscaEstado !== "idle") {
      setFuncionario(null);
      setTamanhosDisponiveis([]);
      setTipoSelecionado("");
      setTamanhoSelecionado("");
      setBuscaEstado("idle");
      setBuscaMensagem(null);
      setQuantidadeSelecionada(1);
      setPedido([]);
    }
  }

  async function buscarFuncionario(entrada?: string) {
    const termo = (entrada ?? matricula).trim();
    if (!termo) {
      setMatriculaError("Informe matrícula, nome ou kit.");
      return;
    }
    setMatriculaError(null);

    setBuscaLoading(true);
    setBuscaEstado("loading");
    setBuscaMensagem(null);
    setFuncionario(null);
    setTamanhosDisponiveis([]);
    setTipoSelecionado("");
    setTamanhoSelecionado("");
    setPedido([]);
    enviarMonitorEmEspera("Operador consultando seus dados...");

    try {
      const matriculaResolvida = await resolverMatriculaPorTermo(termo);
      const [data, tamanhos] = await Promise.all([
        api.get<FuncionarioInfo>(`/ops/funcionario/${matriculaResolvida}`),
        api.get<TamanhoDisponivel[]>("/ops/tamanhos-disponiveis"),
      ]);
      ultimoTermoBuscadoRef.current = matriculaResolvida;
      setMatricula(matriculaResolvida);
      setFuncionario(data);
      setTamanhosDisponiveis(tamanhos);
      const primeiroTipo = tamanhos[0]?.tipo ?? "";
      const primeiroTamanho = primeiroTipo
        ? (tamanhos.find((row) => row.tipo === primeiroTipo)?.tamanho ?? "")
        : "";
      setTipoSelecionado(primeiroTipo);
      setTamanhoSelecionado(primeiroTamanho);
      setQuantidadeSelecionada(1);
      setPedido([]);
      setBuscaEstado("success");
      enviarMonitorEmEspera("Dados localizados. Aguardando resumo para confirmação.");
    } catch (err) {
      const classificado = classificarErroBusca(err, "Não encontramos funcionário para esta matrícula.");
      setBuscaEstado(classificado.estado);
      setBuscaMensagem(classificado.estado === "idle" ? null : classificado.mensagem);
      setFuncionario(null);
      setTamanhosDisponiveis([]);
      setTipoSelecionado("");
      setTamanhoSelecionado("");
      setPedido([]);
      enviarMonitorEmEspera(
        classificado.estado === "idle"
          ? "Multiplos resultados localizados. Selecione uma sugestao para continuar."
          : "Não foi possível localizar os dados. Aguardando nova tentativa.",
      );
    } finally {
      setBuscaLoading(false);
    }
  }

  async function onSelecionarSugestao(sugestao: BuscaSugestao) {
    setMatricula(sugestao.chave);
    await buscarFuncionario(sugestao.chave);
  }

  useEffect(() => {
    if (etapa !== "busca") return;

    const termo = matricula.trim();
    if (termo.length < 2) {
      ultimoTermoBuscadoRef.current = "";
      return;
    }

    if (buscaLoading || termo === ultimoTermoBuscadoRef.current) return;

    const timeoutId = window.setTimeout(() => {
      ultimoTermoBuscadoRef.current = termo;
      void buscarFuncionario(termo);
    }, 380);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [etapa, matricula, buscaLoading, buscaEstado]);

  const tiposDisponiveis = Array.from(new Set(tamanhosDisponiveis.map((row) => row.tipo)));
  const tamanhosDoTipoSelecionado = tipoSelecionado
    ? tamanhosDisponiveis.filter((row) => row.tipo === tipoSelecionado)
    : [];

  function selecionarTipo(value: string) {
    setTipoSelecionado(value);
    const primeiroTamanho = tamanhosDisponiveis.find((row) => row.tipo === value)?.tamanho ?? "";
    setTamanhoSelecionado(primeiroTamanho);
    setQuantidadeSelecionada(1);
  }

  function selecionarTamanho(value: string) {
    setTamanhoSelecionado(value);
    setQuantidadeSelecionada(1);
  }

  const disponivel = funcionario ? funcionario.kits_em_uso < funcionario.max_kits : false;
  const usuarioNoLimite = Boolean(funcionario) && !disponivel;
  const maxEmprestavel = funcionario ? Math.max(0, funcionario.max_kits - funcionario.kits_em_uso) : 0;
  const estoqueTamanhoSelecionado = tamanhosDisponiveis.find(
    (row) => row.tipo === tipoSelecionado && row.tamanho === tamanhoSelecionado,
  )?.disponiveis ?? 0;
  const quantidadeJaNoPedido = pedido.find(
    (row) => row.tipo === tipoSelecionado && row.tamanho === tamanhoSelecionado,
  )?.quantidade ?? 0;
  const totalSelecionado = pedido.reduce((acc, row) => acc + row.quantidade, 0);
  const restanteLimiteFuncionario = Math.max(0, maxEmprestavel - totalSelecionado);
  const restanteNoEstoque = Math.max(0, estoqueTamanhoSelecionado - quantidadeJaNoPedido);
  const maxSolicitavelAtual = Math.min(restanteLimiteFuncionario, restanteNoEstoque);

  useEffect(() => {
    if (maxSolicitavelAtual <= 0) {
      setQuantidadeSelecionada(1);
      return;
    }

    setQuantidadeSelecionada((atual) => Math.min(Math.max(1, atual), maxSolicitavelAtual));
  }, [maxSolicitavelAtual]);

  const podeAdicionar =
    Boolean(funcionario) &&
    disponivel &&
    Boolean(tipoSelecionado) &&
    Boolean(tamanhoSelecionado) &&
    maxSolicitavelAtual > 0 &&
    quantidadeSelecionada >= 1 &&
    quantidadeSelecionada <= maxSolicitavelAtual;
  const podeContinuar = Boolean(funcionario) && pedido.length > 0;

  let motivoAdicionar: string | null = null;
  if (funcionario && !disponivel) {
    motivoAdicionar = "Sem disponibilidade para nova solicitação.";
  } else if (funcionario && tamanhosDisponiveis.length === 0) {
    motivoAdicionar = "Não há kits disponíveis no estoque.";
  } else if (funcionario && !tipoSelecionado) {
    motivoAdicionar = "Selecione o tipo do item.";
  } else if (funcionario && !tamanhoSelecionado) {
    motivoAdicionar = "Selecione o tamanho do kit.";
  } else if (funcionario && restanteNoEstoque === 0) {
    motivoAdicionar = "Sem estoque disponivel para adicionar este tamanho.";
  } else if (funcionario && restanteLimiteFuncionario === 0) {
    motivoAdicionar = "Limite máximo do funcionário já atingido no pedido.";
  } else if (funcionario && !podeAdicionar) {
    motivoAdicionar = `Selecione de 1 a ${maxSolicitavelAtual}.`;
  }

  function adicionarAoPedido() {
    if (!podeAdicionar) return;

    setPedido((prev) => {
      const index = prev.findIndex((item) => item.tipo === tipoSelecionado && item.tamanho === tamanhoSelecionado);
      if (index === -1) {
        return [
          ...prev,
          {
            tipo: tipoSelecionado,
            tamanho: tamanhoSelecionado,
            quantidade: quantidadeSelecionada,
          },
        ];
      }

      return prev.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              quantidade: item.quantidade + quantidadeSelecionada,
            }
          : item,
      );
    });
    setQuantidadeSelecionada(1);
  }

  function removerDoPedido(tipo: string, tamanho: string) {
    setPedido((prev) => prev.filter((item) => !(item.tipo === tipo && item.tamanho === tamanho)));
  }

  function abrirResumo() {
    if (!funcionario || pedido.length === 0) return;

    enviarMonitorResumo({
      tipo: "emprestimo",
      matricula: matricula.trim(),
      funcionario,
      quantidade: totalSelecionado,
      selecoes: pedido,
    });
    setEtapa("resumo");
  }

  async function confirmarEmprestimo() {
    if (!funcionario || pedido.length === 0) return;

    setConfirmLoading(true);
    try {
      const itensEmprestados: string[] = [];

      for (const selecao of pedido) {
        const data = await api.post<{ sucesso: boolean; itens_emprestados: string[] }>("/ops/emprestimo-direto", {
          matricula: matricula.trim(),
          quantidade: selecao.quantidade,
          tipo_item: selecao.tipo,
          tamanho: selecao.tamanho,
        });
        itensEmprestados.push(...data.itens_emprestados);
      }

      setResultado({ sucesso: true, itens: itensEmprestados });
      setEtapa("resultado");
      success(`Solicitação realizada: ${itensEmprestados.join(", ")}`);
      enviarMonitorResultado({
        tipo: "emprestimo",
        sucesso: true,
        mensagem: "Solicitação confirmada com sucesso.",
        itens: itensEmprestados,
      });
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : "Erro ao realizar solicitação";
      error(mensagem);
      enviarMonitorResultado({
        tipo: "emprestimo",
        sucesso: false,
        mensagem,
        itens: [],
      });
      setEtapa("busca");
    } finally {
      setConfirmLoading(false);
    }
  }

  function cancelarResumo() {
    enviarMonitorEmEspera("Resumo cancelado. Aguardando nova operação.");
    setEtapa("busca");
  }

  const etapaUsuario = funcionario ? "Concluído" : "--";
  const etapaItens = usuarioNoLimite ? "Limite atingido" : totalSelecionado;
  const etapaRevisao = usuarioNoLimite ? "Bloqueado" : podeContinuar ? "Pronto" : "Aguardando";
  const animacaoEtapa = useDelicateTransition(`emprestimo-${etapa}-${buscaEstado}`);

  return (
    <div
      className={cn(
        "w-full space-y-6 transition-[opacity,transform] duration-300 ease-[var(--motion-ease-standard)]",
        animacaoEtapa && "animate-in fade-in-0 slide-in-from-bottom-2",
      )}
    >
      {etapa === "busca" && (
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 space-y-6 xl:col-span-8">
            <Card className="relative z-20 border-border/70 bg-card/95 shadow-sm">
              <CardContent className="space-y-6 p-6">
                <div className="space-y-2">
                  <h2 className="text-lg font-semibold text-foreground">Identificação</h2>
                  <p className="text-sm text-muted-foreground">
                    Busque o usuário para iniciar a solicitação.
                  </p>
                </div>

                <SearchSection
                  id="mat-emp"
                  matricula={matricula}
                  matriculaError={matriculaError}
                  loading={buscaLoading}
                  canClear={Boolean(matricula || funcionario || buscaEstado !== "idle")}
                  sugestoes={sugestoes}
                  sugestoesLoading={sugestoesLoading}
                  showSugestoes={matricula.trim().length >= 2 && !funcionario}
                  onMatriculaChange={onMatriculaChange}
                  onLimpar={limparTudo}
                  onSelecionarSugestao={onSelecionarSugestao}
                />
              </CardContent>
            </Card>

            <Card
              className={cn(
                "relative z-0 border-border/70 bg-card/95 shadow-sm",
                buscaEstado === "idle" ? "xl:min-h-[180px]" : "xl:min-h-[240px]",
              )}
            >
              <CardContent className="space-y-4 p-4 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-lg font-semibold text-foreground">Resultados</h3>
                  <StatusPill
                    tone={
                      buscaEstado === "success"
                        ? "success"
                        : buscaEstado === "loading"
                          ? "info"
                          : buscaEstado === "idle"
                            ? "neutral"
                            : "danger"
                    }
                  >
                    {buscaEstado === "success"
                      ? "Usuário localizado"
                      : buscaEstado === "loading"
                        ? "Buscando"
                        : buscaEstado === "idle"
                          ? "Aguardando busca"
                          : "Sem resultado"}
                  </StatusPill>
                </div>

                {buscaEstado === "loading" ? <BuscaSkeleton /> : null}

                {buscaEstado !== "loading" && (
                  <>
                    {(buscaEstado === "notFound" || buscaEstado === "networkError" || buscaEstado === "error") && (
                      <BuscaEstadoCard
                        estado={buscaEstado}
                        mensagem={buscaMensagem}
                        onRetry={buscaEstado === "networkError" ? buscarFuncionario : undefined}
                      />
                    )}

                    {buscaEstado === "idle" && (
                      <div className="rounded-xl border border-border/70 bg-surface-2/65 p-5 text-center">
                        <Package className="mx-auto mb-4 h-8 w-8 text-muted-foreground/60" />
                        <p className="text-sm font-semibold text-foreground">Nenhum usuário selecionado</p>
                        <p className="text-sm text-muted-foreground">
                          Informe matrícula, nome ou código do kit para carregar os dados.
                        </p>
                      </div>
                    )}

                    {buscaEstado === "success" && funcionario && (
                      <div className="space-y-4 animate-in fade-in-0 slide-in-from-bottom-2">
                        <div className="rounded-xl border border-border/70 bg-background/75 p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0 space-y-1">
                              <p className="truncate text-lg font-semibold text-foreground">{funcionario.nome}</p>
                              <p className="truncate text-sm text-muted-foreground">{funcionario.unidade}</p>
                              <p className="truncate text-sm text-muted-foreground">{funcionario.setor}</p>
                            </div>
                            <StatusPill tone={usuarioNoLimite ? "danger" : "info"} className="shrink-0">
                              {usuarioNoLimite
                                ? `No limite: ${funcionario.kits_em_uso}/${funcionario.max_kits}`
                                : `Em uso: ${funcionario.kits_em_uso}/${funcionario.max_kits}`}
                            </StatusPill>
                          </div>
                        </div>

                        {usuarioNoLimite ? (
                          <div className="rounded-xl border border-destructive/35 bg-destructive/10 p-4">
                            <p className="text-sm font-semibold text-foreground">Usuário no limite de solicitações</p>
                            <p className="text-sm text-muted-foreground">
                              Este usuário já está com {funcionario.kits_em_uso}/{funcionario.max_kits} kits em uso.
                              Realize uma devolução para liberar novas solicitações.
                            </p>
                          </div>
                        ) : (
                          <>
                            <Separator />

                            <section className="space-y-3">
                              <h4 className="text-sm font-semibold text-foreground">Configurar solicitação</h4>

                              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(220px,0.9fr)_auto] lg:items-end">
                                <div className="space-y-2">
                                  <Label htmlFor="emprestimo-tipo" className="text-xs text-muted-foreground">
                                    Tipo
                                  </Label>
                                  <Select
                                    value={tipoSelecionado}
                                    onValueChange={selecionarTipo}
                                    disabled={!disponivel || tiposDisponiveis.length === 0}
                                  >
                                    <SelectTrigger id="emprestimo-tipo" className="h-11 rounded-xl border-border/80 bg-background text-sm">
                                      <SelectValue placeholder="Selecione o tipo" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {tiposDisponiveis.map((tipo) => (
                                        <SelectItem key={tipo} value={tipo}>
                                          {tipo}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>

                                <div className="space-y-2">
                                  <Label htmlFor="emprestimo-tamanho" className="text-xs text-muted-foreground">
                                    Tamanho
                                  </Label>
                                  <Select
                                    value={tamanhoSelecionado}
                                    onValueChange={selecionarTamanho}
                                    disabled={!disponivel || !tipoSelecionado || tamanhosDoTipoSelecionado.length === 0}
                                  >
                                    <SelectTrigger id="emprestimo-tamanho" className="h-11 rounded-xl border-border/80 bg-background text-sm">
                                      <SelectValue placeholder="Selecione o tamanho" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {tamanhosDoTipoSelecionado.map((row) => (
                                        <SelectItem key={row.tamanho} value={row.tamanho}>
                                          {row.tamanho} ({row.disponiveis} disp.)
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>

                                <OperacaoStepper
                                  value={quantidadeSelecionada}
                                  onChange={setQuantidadeSelecionada}
                                  min={1}
                                  max={Math.max(1, maxSolicitavelAtual)}
                                  disabled={!disponivel || !tipoSelecionado || !tamanhoSelecionado || maxSolicitavelAtual === 0}
                                  label={`Quantidade (max. ${maxSolicitavelAtual})`}
                                />
                                <Button
                                  variant="outline"
                                  onClick={adicionarAoPedido}
                                  disabled={!podeAdicionar}
                                  className="h-11 w-full rounded-xl text-sm lg:min-w-48"
                                >
                                  Adicionar ao pedido
                                </Button>
                              </div>

                              {!podeAdicionar && motivoAdicionar && (
                                <p className="text-xs text-muted-foreground" role="status">
                                  {motivoAdicionar}
                                </p>
                              )}
                            </section>

                            <Separator />

                            <section className="space-y-3">
                              <div className="flex items-center justify-between">
                                <h4 className="text-sm font-semibold text-foreground">Carrinho</h4>
                                <StatusPill tone="info">Itens: {totalSelecionado}</StatusPill>
                              </div>

                              {pedido.length === 0 ? (
                                <div className="rounded-xl border border-border/70 bg-surface-2/60 p-4 text-center">
                                  <p className="text-sm font-medium text-foreground">Carrinho vazio</p>
                                  <p className="text-sm text-muted-foreground">
                                    Adicione tipo, tamanho e quantidade para montar o pedido.
                                  </p>
                                </div>
                              ) : (
                                <div className="divide-y divide-border rounded-xl border border-border/70 bg-background">
                                  {pedido.map((item) => (
                                    <div
                                      key={chaveSelecao(item.tipo, item.tamanho)}
                                      className="flex items-center justify-between gap-4 px-4 py-4"
                                    >
                                      <div className="flex flex-wrap items-center gap-2">
                                        <StatusPill tone="neutral">{item.tipo}</StatusPill>
                                        <StatusPill tone="neutral">{item.tamanho}</StatusPill>
                                        <StatusPill tone="info">{item.quantidade}</StatusPill>
                                      </div>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-9 w-9 rounded-lg"
                                        aria-label={`Remover ${item.tipo} ${item.tamanho}`}
                                        onClick={() => removerDoPedido(item.tipo, item.tamanho)}
                                      >
                                        <X className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              )}

                              <Button
                                onClick={abrirResumo}
                                disabled={!podeContinuar}
                                className="h-11 w-full rounded-xl text-sm"
                                aria-label="Continuar para resumo de solicitação"
                              >
                                Revisar pedido
                                <ChevronRight className="h-4 w-4" />
                              </Button>
                            </section>
                          </>
                        )}
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="col-span-12 xl:col-span-4">
            <Card className="border-border/70 bg-card/95 shadow-sm xl:sticky xl:top-32 animate-in fade-in-0 slide-in-from-right-2">
              <CardContent className="space-y-6 p-6">
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-foreground">Como funciona</h3>
                  <p className="text-sm text-muted-foreground">Acompanhe os próximos passos da solicitação.</p>
                </div>

                <div className="space-y-4">
                  <div className="rounded-xl border border-border/70 bg-surface-2/60 p-4 transition-all duration-200 hover:-translate-y-0.5">
                    <p className="text-xs text-muted-foreground">1. Usuário</p>
                    <p className="truncate text-sm font-semibold text-foreground">{etapaUsuario}</p>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-surface-2/60 p-4 transition-all duration-200 hover:-translate-y-0.5">
                    <p className="text-xs text-muted-foreground">2. Itens</p>
                    <p className="text-sm font-semibold text-foreground">{etapaItens}</p>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-surface-2/60 p-4 transition-all duration-200 hover:-translate-y-0.5">
                    <p className="text-xs text-muted-foreground">3. Revisão</p>
                    <p className="text-sm font-semibold text-foreground">{etapaRevisao}</p>
                  </div>
                </div>

                <div className="rounded-xl border border-border/70 bg-primary/[0.06] p-4 transition-all duration-200 hover:-translate-y-0.5">
                  <p className="text-sm text-muted-foreground">
                    A Solicitação será validada no resumo.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {etapa === "resumo" && funcionario && (
        <ResumoEtapa
          tipo="emprestimo"
          funcionario={funcionario}
          matricula={matricula}
          quantidade={totalSelecionado}
          selecoes={pedido}
          loading={confirmLoading}
          onCancelar={cancelarResumo}
          onConfirmar={confirmarEmprestimo}
        />
      )}

      {etapa === "resultado" && resultado && (
        <ResultadoEtapa tipo="emprestimo" resultado={resultado} onReset={limparTudo} />
      )}
    </div>
  );
}
function DevolucaoTab() {
  const [matricula, setMatricula] = useState("");
  const [matriculaError, setMatriculaError] = useState<string | null>(null);
  const [funcionario, setFuncionario] = useState<FuncionarioInfo | null>(null);
  const [itens, setItens] = useState<ItemEmprestado[]>([]);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [etapa, setEtapa] = useState<Etapa>("busca");
  const [resultado, setResultado] = useState<{ sucesso: boolean; itens: string[] } | null>(null);
  const [buscaEstado, setBuscaEstado] = useState<BuscaEstado>("idle");
  const [buscaMensagem, setBuscaMensagem] = useState<string | null>(null);
  const [buscaLoading, setBuscaLoading] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const ultimoTermoBuscadoRef = useRef("");
  const { sugestoes, sugestoesLoading } = useBuscaSugestoes(
    matricula,
    etapa === "busca" && !funcionario && !buscaLoading,
  );
  const { success, error } = useToast();

  function limparTudo() {
    setMatricula("");
    setMatriculaError(null);
    setFuncionario(null);
    setItens([]);
    setSelecionados(new Set());
    setResultado(null);
    setBuscaEstado("idle");
    setBuscaMensagem(null);
    setEtapa("busca");
    ultimoTermoBuscadoRef.current = "";
    enviarMonitorEmEspera("Aguardando uma nova operação.");
  }

  function onMatriculaChange(value: string) {
    setMatricula(value);
    setMatriculaError(null);

    if (funcionario || itens.length > 0 || buscaEstado !== "idle") {
      setFuncionario(null);
      setItens([]);
      setSelecionados(new Set());
      setBuscaEstado("idle");
      setBuscaMensagem(null);
    }
  }

  async function buscarFuncionario(entrada?: string) {
    const termo = (entrada ?? matricula).trim();
    if (!termo) {
      setMatriculaError("Informe matrícula, nome ou kit.");
      return;
    }
    setMatriculaError(null);

    setBuscaLoading(true);
    setBuscaEstado("loading");
    setBuscaMensagem(null);
    setFuncionario(null);
    setItens([]);
    setSelecionados(new Set());
    enviarMonitorEmEspera("Operador consultando seus dados...");

    try {
      const matriculaResolvida = await resolverMatriculaPorTermo(termo);
      const [func, emprestados] = await Promise.all([
        api.get<FuncionarioInfo>(`/ops/funcionario/${matriculaResolvida}`),
        api.get<ItemEmprestado[]>(`/ops/itens-emprestados/${matriculaResolvida}`),
      ]);
      ultimoTermoBuscadoRef.current = matriculaResolvida;
      setMatricula(matriculaResolvida);
      setFuncionario(func);
      setItens(emprestados);
      setBuscaEstado(emprestados.length === 0 ? "empty" : "success");
      setBuscaMensagem(emprestados.length === 0 ? "Este funcionário não possui itens emprestados." : null);
      enviarMonitorEmEspera("Dados localizados. Aguardando resumo para confirmação.");
    } catch (err) {
      const classificado = classificarErroBusca(err, "Não encontramos funcionário para esta matrícula.");
      setBuscaEstado(classificado.estado);
      setBuscaMensagem(classificado.estado === "idle" ? null : classificado.mensagem);
      setFuncionario(null);
      setItens([]);
      setSelecionados(new Set());
      enviarMonitorEmEspera(
        classificado.estado === "idle"
          ? "Multiplos resultados localizados. Selecione uma sugestao para continuar."
          : "Não foi possível localizar os dados. Aguardando nova tentativa.",
      );
    } finally {
      setBuscaLoading(false);
    }
  }

  async function onSelecionarSugestao(sugestao: BuscaSugestao) {
    setMatricula(sugestao.chave);
    await buscarFuncionario(sugestao.chave);
  }

  useEffect(() => {
    if (etapa !== "busca") return;

    const termo = matricula.trim();
    if (termo.length < 2) {
      ultimoTermoBuscadoRef.current = "";
      return;
    }

    if (buscaLoading || termo === ultimoTermoBuscadoRef.current) return;

    const timeoutId = window.setTimeout(() => {
      ultimoTermoBuscadoRef.current = termo;
      void buscarFuncionario(termo);
    }, 380);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [etapa, matricula, buscaLoading, buscaEstado]);

  function toggleItem(codigo: string) {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(codigo)) {
        next.delete(codigo);
      } else {
        next.add(codigo);
      }
      return next;
    });
  }

  function setItemSelecionado(codigo: string, checked: boolean) {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(codigo);
      } else {
        next.delete(codigo);
      }
      return next;
    });
  }

  function abrirResumo() {
    if (selecionados.size === 0) return;
    if (!funcionario) return;
    const itensSelecionados = itens.filter((item) => selecionados.has(item.codigo));
    enviarMonitorResumo({
      tipo: "devolucao",
      matricula: matricula.trim(),
      funcionario,
      quantidade: itensSelecionados.length,
      itens: itensSelecionados,
    });
    setEtapa("resumo");
  }

  async function confirmarDevolucao() {
    if (selecionados.size === 0) return;

    setConfirmLoading(true);
    try {
      const data = await api.post<{ sucesso: boolean; itens_devolvidos: string[] }>("/ops/devolucao-direta", {
        matricula: matricula.trim(),
        item_codigos: Array.from(selecionados),
      });
      setResultado({ sucesso: true, itens: data.itens_devolvidos });
      setEtapa("resultado");
      success(`Devolução realizada: ${data.itens_devolvidos.join(", ")}`);
      enviarMonitorResultado({
        tipo: "devolucao",
        sucesso: true,
        mensagem: "Devolução confirmada com sucesso.",
        itens: data.itens_devolvidos,
      });
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : "Erro ao realizar devolução";
      error(mensagem);
      enviarMonitorResultado({
        tipo: "devolucao",
        sucesso: false,
        mensagem,
        itens: [],
      });
      setEtapa("busca");
    } finally {
      setConfirmLoading(false);
    }
  }

  function cancelarResumo() {
    enviarMonitorEmEspera("Resumo cancelado. Aguardando nova operação.");
    setEtapa("busca");
  }

  const selecionadosCount = selecionados.size;
  const itensSelecionados = itens.filter((item) => selecionados.has(item.codigo));
  const podeContinuar = buscaEstado === "success" && selecionadosCount > 0;
  const motivoContinuar = buscaEstado === "empty"
    ? "Nenhum item disponível para devolução."
    : buscaEstado === "success" && selecionadosCount === 0
      ? "Selecione ao menos um item."
      : null;
  const etapaUsuario = funcionario ? "Concluído" : "--";
  const etapaItens = selecionadosCount;
  const etapaRevisao = podeContinuar ? "Pronto" : "Aguardando";
  const animacaoEtapa = useDelicateTransition(`devolucao-${etapa}-${buscaEstado}`);

  return (
    <div
      className={cn(
        "w-full space-y-6 transition-[opacity,transform] duration-300 ease-[var(--motion-ease-standard)]",
        animacaoEtapa && "animate-in fade-in-0 slide-in-from-bottom-2",
      )}
    >
      {etapa === "busca" && (
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 space-y-6 xl:col-span-8">
            <Card className="relative z-20 border-border/70 bg-card/95 shadow-sm">
              <CardContent className="space-y-6 p-6">
                <div className="space-y-2">
                  <h2 className="text-lg font-semibold text-foreground">Identificação</h2>
                  <p className="text-sm text-muted-foreground">
                    Busque o usuário para iniciar a devolução.
                  </p>
                </div>

                <SearchSection
                  id="mat-dev"
                  matricula={matricula}
                  matriculaError={matriculaError}
                  loading={buscaLoading}
                  canClear={Boolean(matricula || funcionario || itens.length > 0 || buscaEstado !== "idle")}
                  sugestoes={sugestoes}
                  sugestoesLoading={sugestoesLoading}
                  showSugestoes={matricula.trim().length >= 2 && !funcionario}
                  onMatriculaChange={onMatriculaChange}
                  onLimpar={limparTudo}
                  onSelecionarSugestao={onSelecionarSugestao}
                />
              </CardContent>
            </Card>

            <Card
              className={cn(
                "relative z-0 border-border/70 bg-card/95 shadow-sm",
                buscaEstado === "idle" ? "xl:min-h-[180px]" : "xl:min-h-[240px]",
              )}
            >
              <CardContent className="space-y-4 p-4 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-lg font-semibold text-foreground">Resultados</h3>
                  <StatusPill
                    tone={
                      buscaEstado === "success" || buscaEstado === "empty"
                        ? "success"
                        : buscaEstado === "loading"
                          ? "info"
                          : buscaEstado === "idle"
                            ? "neutral"
                            : "danger"
                    }
                  >
                    {buscaEstado === "success" || buscaEstado === "empty"
                      ? "Usuário localizado"
                      : buscaEstado === "loading"
                        ? "Buscando"
                        : buscaEstado === "idle"
                          ? "Aguardando busca"
                          : "Sem resultado"}
                  </StatusPill>
                </div>

                {buscaEstado === "loading" ? <BuscaSkeleton /> : null}

                {buscaEstado !== "loading" && (
                  <>
                    {(buscaEstado === "notFound" || buscaEstado === "networkError" || buscaEstado === "error") && (
                      <BuscaEstadoCard
                        estado={buscaEstado}
                        mensagem={buscaMensagem}
                        onRetry={buscaEstado === "networkError" ? buscarFuncionario : undefined}
                      />
                    )}

                    {buscaEstado === "idle" && (
                      <div className="rounded-xl border border-border/70 bg-surface-2/65 p-5 text-center">
                        <Package className="mx-auto mb-4 h-8 w-8 text-muted-foreground/60" />
                        <p className="text-sm font-semibold text-foreground">Nenhum usuário selecionado</p>
                        <p className="text-sm text-muted-foreground">
                          Informe matrícula, nome ou código do kit para carregar os dados.
                        </p>
                      </div>
                    )}

                    {(buscaEstado === "success" || buscaEstado === "empty") && funcionario && (
                      <div className="space-y-4 animate-in fade-in-0 slide-in-from-bottom-2">
                        <div className="rounded-xl border border-border/70 bg-background/75 p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0 space-y-1">
                              <p className="truncate text-lg font-semibold text-foreground">{funcionario.nome}</p>
                              <p className="truncate text-sm text-muted-foreground">{funcionario.unidade}</p>
                              <p className="truncate text-sm text-muted-foreground">{funcionario.setor}</p>
                            </div>
                            <StatusPill tone={buscaEstado === "empty" ? "danger" : "info"} className="shrink-0">
                              {buscaEstado === "empty" ? "Sem itens em uso" : `Em uso: ${itens.length}`}
                            </StatusPill>
                          </div>
                        </div>

                        <Separator />

                        <section className="space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <h4 className="text-sm font-semibold text-foreground">Itens emprestados</h4>
                            <StatusPill tone="info">Selecionados: {selecionadosCount}</StatusPill>
                          </div>

                          {buscaEstado === "empty" ? (
                            <div className="rounded-xl border border-border/70 bg-surface-2/60 p-4 text-center">
                              <Package className="mx-auto mb-3 h-8 w-8 text-muted-foreground/60" />
                              <p className="text-sm font-medium text-foreground">Nenhum item emprestado</p>
                              <p className="text-sm text-muted-foreground">
                                Este usuário não possui itens para devolução.
                              </p>
                            </div>
                          ) : (
                            <div className="max-h-[26rem] space-y-2 overflow-y-auto pr-1">
                              {itens.map((item, index) => {
                                const checked = selecionados.has(item.codigo);
                                return (
                                  <div
                                    key={item.codigo}
                                    role="checkbox"
                                    aria-checked={checked}
                                    aria-label={`Selecionar item ${item.codigo} tamanho ${item.tamanho}`}
                                    tabIndex={0}
                                    onClick={() => toggleItem(item.codigo)}
                                    onKeyDown={(e) => {
                                      if (e.key === " " || e.key === "Enter") {
                                        e.preventDefault();
                                        toggleItem(item.codigo);
                                      }
                                    }}
                                    className={cn(
                                      "flex cursor-pointer items-center gap-2 rounded-xl border bg-background px-3 py-3 transition-all hover:border-primary/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 animate-in fade-in-0 slide-in-from-bottom-2",
                                      checked ? "border-primary/45 bg-primary/[0.05]" : "border-border/70",
                                    )}
                                    style={{ animationDelay: `${index * 30}ms` }}
                                  >
                                    <Checkbox
                                      checked={checked}
                                      tabIndex={-1}
                                      onCheckedChange={(value) => setItemSelecionado(item.codigo, Boolean(value))}
                                      onClick={(e) => e.stopPropagation()}
                                      aria-label={`Checkbox item ${item.codigo}`}
                                    />
                                    <div className="flex min-w-0 flex-1 items-center gap-2">
                                      <span className="font-mono text-xs font-semibold text-primary">{item.codigo}</span>
                                      <StatusPill tone="neutral">{item.tipo}</StatusPill>
                                      <StatusPill tone="neutral">{item.tamanho}</StatusPill>
                                      <span className="truncate text-sm text-muted-foreground">
                                        {descricaoItemLabel(item.descricao)}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </section>

                        <Separator />

                        <section className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-semibold text-foreground">Carrinho</h4>
                            <StatusPill tone="info">Itens: {selecionadosCount}</StatusPill>
                          </div>

                          {itensSelecionados.length === 0 ? (
                            <div className="rounded-xl border border-border/70 bg-surface-2/60 p-4 text-center">
                              <p className="text-sm font-medium text-foreground">Carrinho vazio</p>
                              <p className="text-sm text-muted-foreground">
                                Selecione os itens para montar o pedido de devolução.
                              </p>
                            </div>
                          ) : (
                            <div className="divide-y divide-border rounded-xl border border-border/70 bg-background">
                              {itensSelecionados.map((item) => (
                                <div key={item.codigo} className="flex items-center justify-between gap-4 px-4 py-4">
                                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                                    <StatusPill tone="neutral">{item.tipo}</StatusPill>
                                    <StatusPill tone="neutral">{item.tamanho}</StatusPill>
                                    <StatusPill tone="info" className="font-mono">{item.codigo}</StatusPill>
                                  </div>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-9 w-9 rounded-lg"
                                    onClick={() => setItemSelecionado(item.codigo, false)}
                                    aria-label={`Remover ${item.codigo}`}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}

                          <Button
                            onClick={abrirResumo}
                            disabled={!podeContinuar}
                            className="h-11 w-full rounded-xl text-sm"
                            aria-label="Continuar para resumo de devolução"
                          >
                            Revisar pedido
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                          {!podeContinuar && motivoContinuar && (
                            <p className="text-xs text-muted-foreground" role="status">
                              {motivoContinuar}
                            </p>
                          )}
                        </section>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="col-span-12 xl:col-span-4">
            <Card className="border-border/70 bg-card/95 shadow-sm xl:sticky xl:top-32 animate-in fade-in-0 slide-in-from-right-2">
              <CardContent className="space-y-6 p-6">
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-foreground">Como funciona</h3>
                  <p className="text-sm text-muted-foreground">Acompanhe os próximos passos da devolução.</p>
                </div>

                <div className="space-y-4">
                  <div className="rounded-xl border border-border/70 bg-surface-2/60 p-4 transition-all duration-200 hover:-translate-y-0.5">
                    <p className="text-xs text-muted-foreground">1. Usuário</p>
                    <p className="truncate text-sm font-semibold text-foreground">{etapaUsuario}</p>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-surface-2/60 p-4 transition-all duration-200 hover:-translate-y-0.5">
                    <p className="text-xs text-muted-foreground">2. Itens</p>
                    <p className="text-sm font-semibold text-foreground">{etapaItens}</p>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-surface-2/60 p-4 transition-all duration-200 hover:-translate-y-0.5">
                    <p className="text-xs text-muted-foreground">3. Revisão</p>
                    <p className="text-sm font-semibold text-foreground">{etapaRevisao}</p>
                  </div>
                </div>

                <div className="rounded-xl border border-border/70 bg-primary/[0.06] p-4 transition-all duration-200 hover:-translate-y-0.5">
                  <p className="text-sm text-muted-foreground">
                    A Devolução será validada no resumo.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {etapa === "resumo" && funcionario && (
        <ResumoEtapa
          tipo="devolucao"
          funcionario={funcionario}
          matricula={matricula}
          itens={itensSelecionados}
          loading={confirmLoading}
          onCancelar={cancelarResumo}
          onConfirmar={confirmarDevolucao}
        />
      )}

      {etapa === "resultado" && resultado && (
        <ResultadoEtapa tipo="devolucao" resultado={resultado} onReset={limparTudo} />
      )}
    </div>
  );
}

function SetorOperacoesTab({ tipoOperacao }: { tipoOperacao: OperacaoTipo }) {
  const [setores, setSetores] = useState<string[]>([]);
  const [setorSelecionado, setSetorSelecionado] = useState("");
  const [estoque, setEstoque] = useState<TamanhoDisponivel[]>([]);
  const [pendencias, setPendencias] = useState<PendenciaSetor[]>([]);
  const [loadingBase, setLoadingBase] = useState(true);
  const [loadingPendencias, setLoadingPendencias] = useState(false);
  const [loadingSaida, setLoadingSaida] = useState(false);
  const [loadingDevolucao, setLoadingDevolucao] = useState(false);
  const [tipoSaida, setTipoSaida] = useState("");
  const [tamanhoSaida, setTamanhoSaida] = useState("");
  const [quantidadeSaida, setQuantidadeSaida] = useState(1);
  const [pedidoSaida, setPedidoSaida] = useState<SelecaoPedido[]>([]);
  const [resumoSaidaAberto, setResumoSaidaAberto] = useState(false);
  const [tipoDevolucao, setTipoDevolucao] = useState("");
  const [tamanhoDevolucao, setTamanhoDevolucao] = useState("");
  const [quantidadeDevolucao, setQuantidadeDevolucao] = useState(1);
  const [pedidoDevolucao, setPedidoDevolucao] = useState<SelecaoPedido[]>([]);
  const [resumoDevolucaoAberto, setResumoDevolucaoAberto] = useState(false);
  const { success, error } = useToast();
  const isSolicitacao = tipoOperacao === "solicitacao";

  async function carregarEstoque() {
    const data = await api.get<TamanhoDisponivel[]>("/ops/tamanhos-disponiveis");
    setEstoque(data);
  }

  async function carregarPendencias(setor: string) {
    if (!setor) {
      setPendencias([]);
      return;
    }

    setLoadingPendencias(true);
    try {
      const data = await api.get<PendenciasSetorResponse>(
        `/ops/pendencias-setor?setor=${encodeURIComponent(setor)}`,
      );
      setPendencias(data.pendencias);
    } catch (err) {
      setPendencias([]);
      error(err instanceof Error ? err.message : "Erro ao carregar pendências do setor");
    } finally {
      setLoadingPendencias(false);
    }
  }

  useEffect(() => {
    let ativo = true;

    const carregar = async () => {
      setLoadingBase(true);
      try {
        const [setoresData, estoqueData] = await Promise.all([
          api.get<{ setores: string[] }>("/ops/setores-disponiveis"),
          api.get<TamanhoDisponivel[]>("/ops/tamanhos-disponiveis"),
        ]);

        if (!ativo) return;
        setSetores(setoresData.setores);
        setSetorSelecionado(setoresData.setores[0] ?? "");
        setEstoque(estoqueData);
      } catch (err) {
        if (!ativo) return;
      error(err instanceof Error ? err.message : "Erro ao carregar operações por setor");
      } finally {
        if (ativo) {
          setLoadingBase(false);
        }
      }
    };

    void carregar();

    return () => {
      ativo = false;
    };
  }, [error]);

  useEffect(() => {
    if (!setorSelecionado) {
      setPendencias([]);
      return;
    }
    void carregarPendencias(setorSelecionado);
  }, [setorSelecionado]);

  const quantidadeSaidaPorChave = new Map<string, number>();
  pedidoSaida.forEach((row) => {
    quantidadeSaidaPorChave.set(chaveSelecao(row.tipo, row.tamanho), row.quantidade);
  });

  const estoqueDisponivel: TamanhoDisponivelOpcao[] = estoque
    .map((row) => ({
      ...row,
      disponiveis_restantes: Math.max(
        0,
        row.disponiveis - (quantidadeSaidaPorChave.get(chaveSelecao(row.tipo, row.tamanho)) ?? 0),
      ),
    }))
    .filter((row) => row.disponiveis_restantes > 0);

  const tiposSaida = Array.from(new Set(estoqueDisponivel.map((row) => row.tipo)));
  const tamanhosSaida = tipoSaida ? estoqueDisponivel.filter((row) => row.tipo === tipoSaida) : [];

  useEffect(() => {
    if (tiposSaida.length === 0) {
      setTipoSaida("");
      return;
    }
    if (!tipoSaida || !tiposSaida.includes(tipoSaida)) {
      setTipoSaida(tiposSaida[0]);
    }
  }, [tiposSaida, tipoSaida]);

  useEffect(() => {
    if (!tipoSaida) {
      setTamanhoSaida("");
      return;
    }

    const opcoes = tamanhosSaida.map((row) => row.tamanho);
    if (opcoes.length === 0) {
      setTamanhoSaida("");
      return;
    }

    if (!tamanhoSaida || !opcoes.includes(tamanhoSaida)) {
      setTamanhoSaida(opcoes[0]);
    }
  }, [tamanhosSaida, tipoSaida, tamanhoSaida]);

  const estoqueSelecionado = estoqueDisponivel.find(
    (row) => row.tipo === tipoSaida && row.tamanho === tamanhoSaida,
  );
  const maxSaida = estoqueSelecionado?.disponiveis_restantes ?? 0;
  const maxSaidaDisponivel = maxSaida;

  useEffect(() => {
    if (maxSaidaDisponivel <= 0) {
      setQuantidadeSaida(1);
      return;
    }
    setQuantidadeSaida((atual) => Math.min(Math.max(1, atual), maxSaidaDisponivel));
  }, [maxSaidaDisponivel]);

  const quantidadeDevolucaoPorChave = new Map<string, number>();
  pedidoDevolucao.forEach((row) => {
    quantidadeDevolucaoPorChave.set(chaveSelecao(row.tipo, row.tamanho), row.quantidade);
  });

  const pendenciasDisponiveis: PendenciaDisponivelOpcao[] = pendencias
    .map((row) => ({
      ...row,
      quantidade_disponivel: Math.max(
        0,
        row.quantidade_pendente - (quantidadeDevolucaoPorChave.get(chaveSelecao(row.tipo, row.tamanho)) ?? 0),
      ),
    }))
    .filter((row) => row.quantidade_disponivel > 0);

  const tiposPendentes = Array.from(new Set(pendenciasDisponiveis.map((row) => row.tipo)));
  const pendenciasDoTipo = tipoDevolucao
    ? pendenciasDisponiveis.filter((row) => row.tipo === tipoDevolucao)
    : [];

  useEffect(() => {
    if (tiposPendentes.length === 0) {
      setTipoDevolucao("");
      return;
    }
    if (!tipoDevolucao || !tiposPendentes.includes(tipoDevolucao)) {
      setTipoDevolucao(tiposPendentes[0]);
    }
  }, [tiposPendentes, tipoDevolucao]);

  useEffect(() => {
    if (!tipoDevolucao) {
      setTamanhoDevolucao("");
      return;
    }
    const opcoes = pendenciasDoTipo.map((row) => row.tamanho);
    if (opcoes.length === 0) {
      setTamanhoDevolucao("");
      return;
    }
    if (!tamanhoDevolucao || !opcoes.includes(tamanhoDevolucao)) {
      setTamanhoDevolucao(opcoes[0]);
    }
  }, [pendenciasDoTipo, tipoDevolucao, tamanhoDevolucao]);

  const pendenciaSelecionada = pendenciasDisponiveis.find(
    (row) => row.tipo === tipoDevolucao && row.tamanho === tamanhoDevolucao,
  );
  const maxDevolucao = pendenciaSelecionada?.quantidade_disponivel ?? 0;
  const maxDevolucaoDisponivel = maxDevolucao;

  useEffect(() => {
    if (maxDevolucaoDisponivel <= 0) {
      setQuantidadeDevolucao(1);
      return;
    }
    setQuantidadeDevolucao((atual) => Math.min(Math.max(1, atual), maxDevolucaoDisponivel));
  }, [maxDevolucaoDisponivel]);

  const totalPendente = pendencias.reduce((acc, row) => acc + row.quantidade_pendente, 0);
  const totalPedidoSaida = pedidoSaida.reduce((acc, row) => acc + row.quantidade, 0);
  const totalPedidoDevolucao = pedidoDevolucao.reduce((acc, row) => acc + row.quantidade, 0);
  const podeAdicionarSaida =
    Boolean(setorSelecionado) &&
    Boolean(tipoSaida) &&
    Boolean(tamanhoSaida) &&
    maxSaidaDisponivel > 0 &&
    quantidadeSaida >= 1 &&
    quantidadeSaida <= maxSaidaDisponivel;
  const podeAdicionarDevolucao =
    Boolean(setorSelecionado) &&
    Boolean(tipoDevolucao) &&
    Boolean(tamanhoDevolucao) &&
    maxDevolucaoDisponivel > 0 &&
    quantidadeDevolucao >= 1 &&
    quantidadeDevolucao <= maxDevolucaoDisponivel;
  const podeRevisarSaida = Boolean(setorSelecionado) && pedidoSaida.length > 0;
  const podeRevisarDevolucao = Boolean(setorSelecionado) && pedidoDevolucao.length > 0;

  let motivoAdicionarSaida: string | null = null;
  if (!setorSelecionado) {
    motivoAdicionarSaida = "Selecione um setor.";
  } else if (estoque.length > 0 && estoqueDisponivel.length === 0) {
    motivoAdicionarSaida = "Todos os tamanhos disponíveis já foram adicionados ao pedido.";
  } else if (!tipoSaida) {
    motivoAdicionarSaida = "Selecione o tipo.";
  } else if (!tamanhoSaida) {
    motivoAdicionarSaida = "Selecione o tamanho.";
  } else if (maxSaida === 0) {
    motivoAdicionarSaida = "Sem estoque para este tipo/tamanho.";
  } else if (maxSaidaDisponivel === 0) {
    motivoAdicionarSaida = "Quantidade máxima deste tamanho já foi adicionada ao pedido.";
  } else if (!podeAdicionarSaida) {
    motivoAdicionarSaida = `Selecione de 1 a ${maxSaidaDisponivel}.`;
  }

  let motivoAdicionarDevolucao: string | null = null;
  if (!setorSelecionado) {
    motivoAdicionarDevolucao = "Selecione um setor.";
  } else if (pendencias.length > 0 && pendenciasDisponiveis.length === 0) {
    motivoAdicionarDevolucao = "Todas as pendências já foram adicionadas ao pedido.";
  } else if (!tipoDevolucao) {
    motivoAdicionarDevolucao = null;
  } else if (!tamanhoDevolucao) {
    motivoAdicionarDevolucao = "Selecione o tamanho.";
  } else if (maxDevolucao === 0) {
    motivoAdicionarDevolucao = "Sem pendência para este tipo/tamanho.";
  } else if (maxDevolucaoDisponivel === 0) {
    motivoAdicionarDevolucao = "Quantidade máxima deste tamanho já foi adicionada ao pedido.";
  } else if (!podeAdicionarDevolucao) {
    motivoAdicionarDevolucao = `Selecione de 1 a ${maxDevolucaoDisponivel}.`;
  }

  const totalNoCarrinho = isSolicitacao ? totalPedidoSaida : totalPedidoDevolucao;
  const tiposAtivos = isSolicitacao ? tiposSaida.length : tiposPendentes.length;
  const variacoesAtivas = isSolicitacao ? estoqueDisponivel.length : pendenciasDisponiveis.length;
  const descricaoFluxo = isSolicitacao
    ? "Selecione itens no painel lateral para montar a solicitação deste setor."
    : "Selecione pendências no painel lateral para montar a devolução deste setor.";
  const animacaoFluxo = useDelicateTransition(`setor-${tipoOperacao}-${setorSelecionado}`);

  async function recarregarDados() {
    if (!setorSelecionado) {
      await carregarEstoque();
      return;
    }
    await Promise.all([carregarEstoque(), carregarPendencias(setorSelecionado)]);
  }

  function trocarSetor(value: string) {
    setSetorSelecionado(value);
    setPedidoSaida([]);
    setPedidoDevolucao([]);
    setResumoSaidaAberto(false);
    setResumoDevolucaoAberto(false);
    setQuantidadeSaida(1);
    setQuantidadeDevolucao(1);
  }

  function adicionarSaidaAoPedido() {
    if (!podeAdicionarSaida) return;

    setPedidoSaida((prev) => {
      const index = prev.findIndex((row) => row.tipo === tipoSaida && row.tamanho === tamanhoSaida);
      if (index === -1) {
        return [...prev, { tipo: tipoSaida, tamanho: tamanhoSaida, quantidade: quantidadeSaida }];
      }

      return prev.map((row, rowIndex) =>
        rowIndex === index
          ? {
              ...row,
              quantidade: row.quantidade + quantidadeSaida,
            }
          : row,
      );
    });
    setQuantidadeSaida(1);
  }

  function removerSaidaDoPedido(tipo: string, tamanho: string) {
    setPedidoSaida((prev) => prev.filter((row) => !(row.tipo === tipo && row.tamanho === tamanho)));
  }

  function adicionarLinhaPedidoDevolucao(tipo: string, tamanho: string, quantidade: number) {
    setPedidoDevolucao((prev) => {
      const index = prev.findIndex((row) => row.tipo === tipo && row.tamanho === tamanho);
      if (index === -1) {
        return [...prev, { tipo, tamanho, quantidade }];
      }

      return prev.map((row, rowIndex) =>
        rowIndex === index
          ? {
              ...row,
              quantidade: row.quantidade + quantidade,
            }
          : row,
      );
    });
  }

  function adicionarDevolucaoAoPedido() {
    if (!podeAdicionarDevolucao) return;

    adicionarLinhaPedidoDevolucao(tipoDevolucao, tamanhoDevolucao, quantidadeDevolucao);
    setQuantidadeDevolucao(1);
  }

  function removerDevolucaoDoPedido(tipo: string, tamanho: string) {
    setPedidoDevolucao((prev) => prev.filter((row) => !(row.tipo === tipo && row.tamanho === tamanho)));
  }

  async function confirmarSaidaSetor() {
    if (!podeRevisarSaida) return;

    setLoadingSaida(true);
    try {
      const itensEmprestados: string[] = [];
      for (const selecao of pedidoSaida) {
        const data = await api.post<{ sucesso: boolean; setor: string; itens_emprestados: string[] }>(
          "/ops/saida-setor-direta",
          {
            setor: setorSelecionado,
            quantidade: selecao.quantidade,
            tipo_item: selecao.tipo,
            tamanho: selecao.tamanho,
          },
        );
        itensEmprestados.push(...data.itens_emprestados);
      }
      success(`Solicitação registrada para ${setorSelecionado}: ${itensEmprestados.length} item(ns).`);
      setPedidoSaida([]);
      setResumoSaidaAberto(false);
      await recarregarDados();
    } catch (err) {
      error(err instanceof Error ? err.message : "Erro ao registrar solicitação para setor");
    } finally {
      setLoadingSaida(false);
    }
  }

  async function confirmarDevolucaoSetor() {
    if (!podeRevisarDevolucao) return;

    setLoadingDevolucao(true);
    try {
      const itensDevolvidos: string[] = [];
      for (const selecao of pedidoDevolucao) {
        const data = await api.post<{ sucesso: boolean; setor: string; itens_devolvidos: string[] }>(
          "/ops/devolucao-setor-direta",
          {
            setor: setorSelecionado,
            quantidade: selecao.quantidade,
            tipo_item: selecao.tipo,
            tamanho: selecao.tamanho,
          },
        );
        itensDevolvidos.push(...data.itens_devolvidos);
      }
      success(`Devolução registrada para ${setorSelecionado}: ${itensDevolvidos.length} item(ns).`);
      setPedidoDevolucao([]);
      setResumoDevolucaoAberto(false);
      await recarregarDados();
    } catch (err) {
      error(err instanceof Error ? err.message : "Erro ao registrar devolução para setor");
    } finally {
      setLoadingDevolucao(false);
    }
  }

  return (
    <div
      className={cn(
        "grid grid-cols-12 gap-6 xl:items-stretch transition-[opacity,transform] duration-300 ease-[var(--motion-ease-standard)]",
        animacaoFluxo && "animate-in fade-in-0 slide-in-from-bottom-2",
      )}
    >
      <div className="col-span-12 xl:col-span-7">
        <Card className="h-full border-border/70 bg-card/95 shadow-sm">
          <CardContent className="space-y-6 p-6">
            <section className="space-y-4">
              <div className="flex items-center">
                <h3 className="text-lg font-semibold text-foreground">Setor</h3>
              </div>

              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="setor-operacao" className="text-xs text-muted-foreground">
                    Setor
                  </Label>
                  <Select
                    value={setorSelecionado}
                    onValueChange={trocarSetor}
                    disabled={loadingBase || setores.length === 0}
                  >
                    <SelectTrigger id="setor-operacao" className="h-11 rounded-xl border-border/80 bg-background text-sm">
                      <SelectValue placeholder="Selecione o setor" />
                    </SelectTrigger>
                    <SelectContent>
                      {setores.map((setor) => (
                        <SelectItem key={setor} value={setor}>
                          {setor}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            <Separator />

            <section className="space-y-4">
              <h4 className="text-sm font-semibold text-foreground">Resumo do setor</h4>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-border/70 bg-surface-2/60 p-4 transition-all duration-200 hover:-translate-y-0.5 animate-in fade-in-0 slide-in-from-bottom-2">
                  <p className="text-xs text-muted-foreground">{isSolicitacao ? "Variações disponíveis" : "Variações pendentes"}</p>
                  <p className="text-2xl font-semibold tabular-nums text-foreground">{variacoesAtivas}</p>
                  <p className="text-xs text-muted-foreground">{tiposAtivos} tipo(s) ativo(s)</p>
                </div>
                <div className="rounded-xl border border-border/70 bg-surface-2/60 p-4 transition-all duration-200 hover:-translate-y-0.5 animate-in fade-in-0 slide-in-from-bottom-2">
                  <p className="text-xs text-muted-foreground">Pendências totais</p>
                  <p className="text-2xl font-semibold tabular-nums text-foreground">{totalPendente}</p>
                  <p className="text-xs text-muted-foreground">Atualizado no setor</p>
                </div>
                <div className="rounded-xl border border-border/70 bg-surface-2/60 p-4 transition-all duration-200 hover:-translate-y-0.5 animate-in fade-in-0 slide-in-from-bottom-2">
                  <p className="text-xs text-muted-foreground">Itens no carrinho</p>
                  <p className="text-2xl font-semibold tabular-nums text-foreground">{totalNoCarrinho}</p>
                  <p className="text-xs text-muted-foreground">{isSolicitacao ? "Pronto para revisão" : "Pronto para devolução"}</p>
                </div>
                <div className="rounded-xl border border-border/70 bg-surface-2/60 p-4 transition-all duration-200 hover:-translate-y-0.5 animate-in fade-in-0 slide-in-from-bottom-2">
                  <p className="text-xs text-muted-foreground">Fluxo atual</p>
                  <p className="text-lg font-semibold text-foreground">{isSolicitacao ? "Solicitação" : "Devolução"}</p>
                  <p className="text-xs text-muted-foreground">{descricaoFluxo}</p>
                </div>
              </div>
            </section>

          </CardContent>
        </Card>
      </div>

      <div className="col-span-12 xl:col-span-5">
        <Card className="h-full overflow-hidden border-border/70 bg-card/95 shadow-sm xl:sticky xl:top-32">
          <div className="flex h-full flex-col">
            <CardContent className="flex-1 space-y-6 overflow-y-auto p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-foreground">
                  {isSolicitacao ? "Solicitação" : "Devolução"}
                </h3>
                <StatusPill tone="info">Pedido: {totalNoCarrinho}</StatusPill>
              </div>

              {isSolicitacao ? (
                resumoSaidaAberto ? (
                  <div className="space-y-4 rounded-xl border border-border/70 bg-surface-2/60 p-4 animate-in fade-in-0 slide-in-from-bottom-2">
                    <p className="text-sm font-semibold text-foreground">Resumo da solicitação</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Setor</span>
                      <StatusPill tone="neutral">{setorSelecionado || "-"}</StatusPill>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Quantidade total</span>
                      <StatusPill tone="info">{totalPedidoSaida}</StatusPill>
                    </div>
                    <div className="space-y-2">
                      {pedidoSaida.map((row) => (
                        <div
                          key={chaveSelecao(row.tipo, row.tamanho)}
                          className="flex items-center justify-between rounded-xl border border-border/60 bg-background px-4 py-4"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusPill tone="neutral">{row.tipo}</StatusPill>
                            <StatusPill tone="neutral">{row.tamanho}</StatusPill>
                          </div>
                          <StatusPill tone="info">{row.quantidade}</StatusPill>
                        </div>
                      ))}
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <Button
                        variant="outline"
                        onClick={() => setResumoSaidaAberto(false)}
                        disabled={loadingSaida}
                        className="h-11 rounded-xl text-sm"
                      >
                        Voltar
                      </Button>
                      <Button
                        onClick={() => void confirmarSaidaSetor()}
                        disabled={loadingSaida || !podeRevisarSaida}
                        className="h-11 rounded-xl text-sm"
                      >
                        {loadingSaida ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
                        Confirmar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 animate-in fade-in-0 slide-in-from-bottom-2">
                    <div className="grid gap-4 xl:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="setor-saida-tipo" className="text-xs text-muted-foreground">
                          Tipo
                        </Label>
                        <Select
                          value={tipoSaida}
                          onValueChange={(value) => {
                            setTipoSaida(value);
                            setQuantidadeSaida(1);
                          }}
                          disabled={loadingBase || tiposSaida.length === 0 || !setorSelecionado}
                        >
                          <SelectTrigger id="setor-saida-tipo" className="h-11 rounded-xl border-border/80 bg-background text-sm">
                            <SelectValue placeholder="Selecione o tipo" />
                          </SelectTrigger>
                          <SelectContent>
                            {tiposSaida.map((tipo) => (
                              <SelectItem key={tipo} value={tipo}>
                                {tipo}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="setor-saida-tamanho" className="text-xs text-muted-foreground">
                          Tamanho
                        </Label>
                        <Select
                          value={tamanhoSaida}
                          onValueChange={(value) => {
                            setTamanhoSaida(value);
                            setQuantidadeSaida(1);
                          }}
                          disabled={loadingBase || !tipoSaida || tamanhosSaida.length === 0 || !setorSelecionado}
                        >
                          <SelectTrigger id="setor-saida-tamanho" className="h-11 rounded-xl border-border/80 bg-background text-sm">
                            <SelectValue placeholder="Selecione o tamanho" />
                          </SelectTrigger>
                          <SelectContent>
                            {tamanhosSaida.map((row) => (
                              <SelectItem key={`${row.tipo}-${row.tamanho}`} value={row.tamanho}>
                                {row.tamanho} ({row.disponiveis_restantes} disp.)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                      <OperacaoStepper
                        value={quantidadeSaida}
                        onChange={setQuantidadeSaida}
                        min={1}
                        max={Math.max(1, maxSaidaDisponivel)}
                        disabled={!setorSelecionado || !tipoSaida || !tamanhoSaida || maxSaidaDisponivel === 0 || loadingSaida}
                        label={`Quantidade (max. ${maxSaidaDisponivel})`}
                      />

                      <Button
                        onClick={adicionarSaidaAoPedido}
                        disabled={!podeAdicionarSaida || loadingSaida}
                        className="h-11 w-full rounded-xl text-sm md:min-w-48"
                        variant="outline"
                      >
                        Adicionar ao pedido
                      </Button>
                    </div>
                    {!podeAdicionarSaida && motivoAdicionarSaida && (
                      <p className="text-xs text-muted-foreground">{motivoAdicionarSaida}</p>
                    )}

                    <div className="space-y-2 rounded-xl border border-border/70 bg-surface-2/60 p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-muted-foreground">Carrinho de solicitação</p>
                        <p className="text-sm font-semibold text-foreground">{pedidoSaida.length} selecao(oes)</p>
                      </div>
                      {pedidoSaida.length === 0 ? (
                        <p className="rounded-xl border border-border/70 bg-background p-6 text-sm text-muted-foreground">
                          Adicione os tamanhos para montar a solicitação.
                        </p>
                      ) : (
                        <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                          {pedidoSaida.map((row) => (
                            <div
                              key={chaveSelecao(row.tipo, row.tamanho)}
                              className="flex items-center justify-between rounded-xl border border-border/55 bg-background px-4 py-4"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <StatusPill tone="neutral">{row.tipo}</StatusPill>
                                <StatusPill tone="neutral">{row.tamanho}</StatusPill>
                                <StatusPill tone="info">{row.quantidade}</StatusPill>
                              </div>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-9 w-9 rounded-lg"
                                onClick={() => removerSaidaDoPedido(row.tipo, row.tamanho)}
                                aria-label={`Remover ${row.tipo} ${row.tamanho}`}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <Button
                      onClick={() => setResumoSaidaAberto(true)}
                      disabled={!podeRevisarSaida || loadingSaida}
                      className="h-11 w-full rounded-xl text-sm"
                    >
                      Revisar pedido
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )
              ) : (
                resumoDevolucaoAberto ? (
                  <div className="space-y-4 rounded-xl border border-border/70 bg-surface-2/60 p-4 animate-in fade-in-0 slide-in-from-bottom-2">
                    <p className="text-sm font-semibold text-foreground">Resumo da devolução</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Setor</span>
                      <StatusPill tone="neutral">{setorSelecionado || "-"}</StatusPill>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Quantidade total</span>
                      <StatusPill tone="info">{totalPedidoDevolucao}</StatusPill>
                    </div>
                    <div className="space-y-2">
                      {pedidoDevolucao.map((row) => (
                        <div
                          key={chaveSelecao(row.tipo, row.tamanho)}
                          className="flex items-center justify-between rounded-xl border border-border/60 bg-background px-4 py-4"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusPill tone="neutral">{row.tipo}</StatusPill>
                            <StatusPill tone="neutral">{row.tamanho}</StatusPill>
                          </div>
                          <StatusPill tone="info">{row.quantidade}</StatusPill>
                        </div>
                      ))}
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <Button
                        variant="outline"
                        onClick={() => setResumoDevolucaoAberto(false)}
                        disabled={loadingDevolucao}
                        className="h-11 rounded-xl text-sm"
                      >
                        Voltar
                      </Button>
                      <Button
                        onClick={() => void confirmarDevolucaoSetor()}
                        disabled={loadingDevolucao || !podeRevisarDevolucao}
                        className="h-11 rounded-xl text-sm"
                      >
                        {loadingDevolucao ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}
                        Confirmar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 animate-in fade-in-0 slide-in-from-bottom-2">
                    <div className="grid gap-4 xl:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="setor-dev-tipo" className="text-xs text-muted-foreground">
                          Tipo
                        </Label>
                        <Select
                          value={tipoDevolucao}
                          onValueChange={(value) => {
                            setTipoDevolucao(value);
                            setQuantidadeDevolucao(1);
                          }}
                          disabled={!setorSelecionado || tiposPendentes.length === 0 || loadingPendencias}
                        >
                          <SelectTrigger id="setor-dev-tipo" className="h-11 rounded-xl border-border/80 bg-background text-sm">
                            <SelectValue placeholder="Selecione o tipo" />
                          </SelectTrigger>
                          <SelectContent>
                            {tiposPendentes.map((tipo) => (
                              <SelectItem key={tipo} value={tipo}>
                                {tipo}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="setor-dev-tamanho" className="text-xs text-muted-foreground">
                          Tamanho
                        </Label>
                        <Select
                          value={tamanhoDevolucao}
                          onValueChange={(value) => {
                            setTamanhoDevolucao(value);
                            setQuantidadeDevolucao(1);
                          }}
                          disabled={!setorSelecionado || !tipoDevolucao || pendenciasDoTipo.length === 0 || loadingPendencias}
                        >
                          <SelectTrigger id="setor-dev-tamanho" className="h-11 rounded-xl border-border/80 bg-background text-sm">
                            <SelectValue placeholder="Selecione o tamanho" />
                          </SelectTrigger>
                          <SelectContent>
                            {pendenciasDoTipo.map((row) => (
                              <SelectItem key={`${row.tipo}-${row.tamanho}`} value={row.tamanho}>
                                {row.tamanho} ({row.quantidade_disponivel} pend.)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                      <OperacaoStepper
                        value={quantidadeDevolucao}
                        onChange={setQuantidadeDevolucao}
                        min={1}
                        max={Math.max(1, maxDevolucaoDisponivel)}
                        disabled={!setorSelecionado || !tipoDevolucao || !tamanhoDevolucao || maxDevolucaoDisponivel === 0 || loadingDevolucao}
                        label={`Quantidade (max. ${maxDevolucaoDisponivel})`}
                      />

                      <Button
                        onClick={adicionarDevolucaoAoPedido}
                        disabled={!podeAdicionarDevolucao || loadingDevolucao}
                        className="h-11 w-full rounded-xl text-sm md:min-w-48"
                        variant="outline"
                      >
                        Adicionar ao pedido
                      </Button>
                    </div>
                    {!podeAdicionarDevolucao && motivoAdicionarDevolucao && (
                      <p className="text-xs text-muted-foreground">{motivoAdicionarDevolucao}</p>
                    )}

                    <div className="space-y-2 rounded-xl border border-border/70 bg-surface-2/60 p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-muted-foreground">Carrinho de devolução</p>
                        <p className="text-sm font-semibold text-foreground">{pedidoDevolucao.length} seleção(ões)</p>
                      </div>
                      {pedidoDevolucao.length === 0 ? (
                        <p className="rounded-xl border border-border/70 bg-background p-6 text-sm text-muted-foreground">
                          Adicione os tamanhos para montar a devolução.
                        </p>
                      ) : (
                        <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                          {pedidoDevolucao.map((row) => (
                            <div
                              key={chaveSelecao(row.tipo, row.tamanho)}
                              className="flex items-center justify-between rounded-xl border border-border/55 bg-background px-4 py-4"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <StatusPill tone="neutral">{row.tipo}</StatusPill>
                                <StatusPill tone="neutral">{row.tamanho}</StatusPill>
                                <StatusPill tone="info">{row.quantidade}</StatusPill>
                              </div>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-9 w-9 rounded-lg"
                                onClick={() => removerDevolucaoDoPedido(row.tipo, row.tamanho)}
                                aria-label={`Remover ${row.tipo} ${row.tamanho}`}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <Button
                      onClick={() => setResumoDevolucaoAberto(true)}
                      disabled={!podeRevisarDevolucao || loadingDevolucao}
                      className="sticky bottom-0 z-10 h-11 w-full rounded-xl border border-border/70 bg-primary text-sm"
                    >
                      Revisar pedido
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )
              )}

            </CardContent>
          </div>
        </Card>
      </div>
    </div>
  );
}

export function SetorPage() {
  useEffect(() => {
    enviarMonitorEmEspera("Aguardando uma operação na tela principal.");
  }, []);

  const [menuAtivo, setMenuAtivo] = useState<"operacoes" | "itens">("operacoes");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [tipoOperacao, setTipoOperacao] = useState<OperacaoTipo>("solicitacao");
  const [destinoOperacao, setDestinoOperacao] = useState<"usuario" | "setor">("usuario");
  const animacaoContexto = useDelicateTransition(`contexto-${tipoOperacao}-${destinoOperacao}`);
  const animacaoConteudo = useDelicateTransition(`conteudo-${tipoOperacao}-${destinoOperacao}`);
  const isIconOnly = sidebarCollapsed;
  const sidebarWidth = sidebarCollapsed ? 78 : 248;
  const layoutStyle = {
    ["--setor-sidebar-width" as string]: `${sidebarWidth}px`,
  } as CSSProperties;

  function toggleSidebar() {
    setSidebarCollapsed((prev) => !prev);
  }

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-background animate-in fade-in-0">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-background via-accent/20 to-secondary/42 dark:from-background dark:via-primary/8 dark:to-accent/18" />
        <div className="absolute -left-20 top-[-10rem] h-[30rem] w-[30rem] rounded-full bg-primary/24 blur-[128px] animate-drift-slower" />
        <div className="absolute right-[-11rem] bottom-[-11rem] h-[33rem] w-[33rem] rounded-full bg-secondary/68 blur-[136px] animate-drift-slow dark:bg-accent/26" />
      </div>

      <Header />
      <main className="relative min-h-0 flex-1 overflow-hidden">
        <div
          className="grid h-full min-h-0 transition-[grid-template-columns] duration-300 ease-[var(--motion-ease-standard)] motion-reduce:transition-none md:grid-cols-[var(--setor-sidebar-width)_minmax(0,1fr)]"
          style={layoutStyle}
        >
          <aside className="relative flex h-full min-h-0 flex-col overflow-hidden border-r border-border/70 bg-gradient-to-b from-card/94 via-surface-2/88 to-card/92 backdrop-blur-xl transition-colors duration-200 dark:border-border/85 dark:from-card/88 dark:via-background/90 dark:to-card/86">
            <div className="relative z-[1] min-h-0 flex-1 space-y-4 overflow-y-auto p-3 pt-4">
              <div className="animate-in fade-in-0">
                <p
                  className={cn(
                    "mb-1.5 overflow-hidden px-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground transition-all duration-200 dark:text-white/70",
                    isIconOnly ? "max-h-0 opacity-0" : "max-h-5 opacity-100",
                  )}
                >
                  Operação
                </p>

                <div className="space-y-1">
                  <Button
                    type="button"
                    variant="ghost"
                    className={cn(
                      "group relative h-9 w-full overflow-hidden rounded-xl border transition-all duration-200",
                      menuAtivo === "operacoes"
                        ? "border-primary/35 bg-primary/14 !text-foreground shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.08)] dark:border-primary/40 dark:bg-primary/22 dark:!text-white"
                        : "border-transparent bg-transparent text-foreground/88 hover:-translate-y-0.5 hover:border-primary/28 hover:!bg-primary/10 hover:!text-foreground dark:text-white/90 dark:hover:border-primary/35 dark:hover:!bg-primary/18 dark:hover:!text-white",
                      isIconOnly ? "justify-center px-2" : "justify-start px-2.5",
                    )}
                    onClick={() => setMenuAtivo("operacoes")}
                    title="Operações"
                  >
                    <Package
                      className={cn(
                        "h-4 w-4 transition-all duration-200 group-hover:scale-105",
                        menuAtivo === "operacoes"
                          ? "text-foreground dark:text-white"
                          : "text-foreground/85 group-hover:text-foreground dark:text-white/85 dark:group-hover:text-white",
                      )}
                    />
                    <span
                      className={cn(
                        "origin-left overflow-hidden whitespace-nowrap text-[13px] font-semibold transition-all duration-200",
                        menuAtivo === "operacoes"
                          ? "text-foreground dark:text-white"
                          : "group-hover:text-foreground dark:group-hover:text-white",
                        isIconOnly ? "max-w-0 -translate-x-1 opacity-0" : "max-w-[12rem] translate-x-0 opacity-100",
                      )}
                    >
                      Operações
                    </span>
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    className={cn(
                      "group relative h-9 w-full overflow-hidden rounded-xl border transition-all duration-200",
                      menuAtivo === "itens"
                        ? "border-primary/35 bg-primary/14 !text-foreground shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.08)] dark:border-primary/40 dark:bg-primary/22 dark:!text-white"
                        : "border-transparent bg-transparent text-foreground/88 hover:-translate-y-0.5 hover:border-primary/28 hover:!bg-primary/10 hover:!text-foreground dark:text-white/90 dark:hover:border-primary/35 dark:hover:!bg-primary/18 dark:hover:!text-white",
                      isIconOnly ? "justify-center px-2" : "justify-start px-2.5",
                    )}
                    onClick={() => setMenuAtivo("itens")}
                    title="Itens"
                  >
                    <Boxes
                      className={cn(
                        "h-4 w-4 transition-all duration-200 group-hover:scale-105",
                        menuAtivo === "itens"
                          ? "text-foreground dark:text-white"
                          : "text-foreground/85 group-hover:text-foreground dark:text-white/85 dark:group-hover:text-white",
                      )}
                    />
                    <span
                      className={cn(
                        "origin-left overflow-hidden whitespace-nowrap text-[13px] font-semibold transition-all duration-200",
                        menuAtivo === "itens"
                          ? "text-foreground dark:text-white"
                          : "group-hover:text-foreground dark:group-hover:text-white",
                        isIconOnly ? "max-w-0 -translate-x-1 opacity-0" : "max-w-[12rem] translate-x-0 opacity-100",
                      )}
                    >
                      Itens
                    </span>
                  </Button>
                </div>
              </div>
            </div>
          </aside>

          <section className="min-h-0 min-w-0 overflow-y-auto">
            <div className="w-full px-4 py-6 md:px-6">
              <div className="mx-auto w-full max-w-[1320px]">
                {menuAtivo === "operacoes" ? (
                  <>
                    <section className="grid grid-cols-12 gap-6">
                      <div className="col-span-12 flex flex-wrap items-start justify-between gap-6">
                        <div className="space-y-2">
                          <h1 className="text-3xl font-bold text-foreground">Operações</h1>
                          <p className="text-sm text-muted-foreground">
                            Gerencie solicitações e devoluções para usuários e setores.
                          </p>
                        </div>
                        <StatusPill tone="info">Fluxo operacional ativo</StatusPill>
                      </div>
                    </section>

                    <section
                      className={cn(
                        "mt-6 grid grid-cols-12 gap-6 transition-[opacity,transform] duration-300 ease-[var(--motion-ease-standard)]",
                        animacaoContexto && "animate-in fade-in-0 slide-in-from-bottom-2",
                      )}
                    >
                      <div className="col-span-12">
                        <div className="relative overflow-visible rounded-2xl border border-border/75 bg-card/95 p-4 shadow-[var(--shadow-soft)]">
                          <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-surface-2/70 via-transparent to-accent/18" />

                          <div className="relative grid gap-4 lg:grid-cols-2">
                            <Tabs value={tipoOperacao} onValueChange={(value) => setTipoOperacao(value as OperacaoTipo)} className="w-full space-y-2">
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Operação</p>
                              <TabsList className="grid h-10 w-full grid-cols-2 gap-1 rounded-xl border border-border/75 bg-background/70 p-1 shadow-[var(--shadow-soft)]">
                                <TabsTrigger
                                  value="solicitacao"
                                  className="h-8 gap-2 rounded-lg border border-transparent text-[13px] font-semibold text-muted-foreground transition-all duration-200 hover:bg-accent/35 data-[state=active]:border-primary/25 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary/16 data-[state=active]:to-primary/8 data-[state=active]:text-primary data-[state=active]:shadow-sm"
                                >
                                  <Package className="h-4 w-4" />
                                  Solicitação
                                </TabsTrigger>
                                <TabsTrigger
                                  value="devolucao"
                                  className="h-8 gap-2 rounded-lg border border-transparent text-[13px] font-semibold text-muted-foreground transition-all duration-200 hover:bg-accent/35 data-[state=active]:border-primary/25 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary/16 data-[state=active]:to-primary/8 data-[state=active]:text-primary data-[state=active]:shadow-sm"
                                >
                                  <Undo2 className="h-4 w-4" />
                                  Devolução
                                </TabsTrigger>
                              </TabsList>
                            </Tabs>

                            <Tabs value={destinoOperacao} onValueChange={(value) => setDestinoOperacao(value as "usuario" | "setor")} className="w-full space-y-2">
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Destino</p>
                              <TabsList className="grid h-10 w-full grid-cols-2 gap-1 rounded-xl border border-border/75 bg-background/70 p-1 shadow-[var(--shadow-soft)]">
                                <TabsTrigger
                                  value="usuario"
                                  className="h-8 gap-2 rounded-lg border border-transparent text-[13px] font-semibold text-muted-foreground transition-all duration-200 hover:bg-accent/35 data-[state=active]:border-primary/25 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary/16 data-[state=active]:to-primary/8 data-[state=active]:text-primary data-[state=active]:shadow-sm"
                                >
                                  <UserRound className="h-4 w-4" />
                                  Usuário
                                </TabsTrigger>
                                <TabsTrigger
                                  value="setor"
                                  className="h-8 gap-2 rounded-lg border border-transparent text-[13px] font-semibold text-muted-foreground transition-all duration-200 hover:bg-accent/35 data-[state=active]:border-primary/25 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary/16 data-[state=active]:to-primary/8 data-[state=active]:text-primary data-[state=active]:shadow-sm"
                                >
                                  <Building2 className="h-4 w-4" />
                                  Setor
                                </TabsTrigger>
                              </TabsList>
                            </Tabs>
                          </div>
                        </div>
                      </div>
                    </section>

                    <section
                      className={cn(
                        "mt-6 grid grid-cols-12 gap-6 transition-[opacity,transform] duration-300 ease-[var(--motion-ease-standard)]",
                        animacaoConteudo && "animate-in fade-in-0 slide-in-from-bottom-2",
                      )}
                    >
                      <div className="col-span-12">
                        {destinoOperacao === "usuario"
                          ? tipoOperacao === "solicitacao"
                            ? <EmprestimoTab />
                            : <DevolucaoTab />
                          : <SetorOperacoesTab tipoOperacao={tipoOperacao} />}
                      </div>
                    </section>
                  </>
                ) : (
                  <SetorItensPanel />
                )}
              </div>
            </div>
          </section>
        </div>
      </main>
      <Footer
        leading={(
          <Button
            variant="outline"
            size="icon"
            onClick={toggleSidebar}
            aria-label={isIconOnly ? "Expandir menu lateral" : "Recolher menu lateral"}
            title={isIconOnly ? "Expandir menu lateral" : "Recolher menu lateral"}
            className="h-7 w-7 rounded-lg"
          >
            {isIconOnly ? <PanelLeftOpen className="h-3 w-3" /> : <PanelLeftClose className="h-3 w-3" />}
          </Button>
        )}
      />
    </div>
  );
}
