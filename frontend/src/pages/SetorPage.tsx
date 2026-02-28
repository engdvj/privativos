import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { StatusPill } from "@/components/ui/status-pill";
import { QuantitySelector } from "@/components/ui/quantity-selector";
import { cn } from "@/lib/utils";
import { publishOperacaoMonitor, type MonitorTipoOperacao } from "@/lib/operacao-monitor";
import {
  CheckCircle2,
  XCircle,
  RefreshCw,
  Package,
  Undo2,
  Loader2,
  Search,
  X,
  SearchX,
  WifiOff,
  CircleAlert,
  ChevronRight,
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
  descricao: string;
  tamanho: string;
}

interface TamanhoDisponivel {
  tamanho: string;
  disponiveis: number;
}

interface BuscaSugestao {
  tipo: "funcionario" | "kit";
  chave: string;
  titulo: string;
  subtitulo: string;
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
  tamanho?: string | null;
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
      tamanho: params.tamanho ?? null,
      itens: (params.itens ?? []).map((item) => ({
        codigo: item.codigo,
        descricao: item.descricao,
        tamanho: item.tamanho,
      })),
    },
  });
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
    return { estado: "networkError" as const, mensagem: "Erro de rede. Verifique a conexao." };
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
    // Evita colisao quando o codigo do kit e igual a uma matricula numerica.
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
      throw createBuscaError("empty", "Kit sem emprestimo ativo no momento.");
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

    throw createBuscaError("error", "Encontramos mais de um funcionario. Selecione uma sugestao.");
  }

  throw createBuscaError("notFound", "Nenhum funcionario ou kit encontrado.");
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
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id} className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Identificacao
        </Label>
        <p id={hintId} className="text-[11px] text-muted-foreground">
          Matricula, nome ou codigo do kit
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <div className="relative space-y-1">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id={id}
              value={matricula}
              placeholder="Ex.: 92148594, nome do colaborador ou codigo do kit"
              autoComplete="off"
              aria-invalid={Boolean(matriculaError)}
              aria-describedby={matriculaError ? errorId : hintId}
              onChange={(e) => onMatriculaChange(e.target.value)}
              className={cn(
                "h-10 rounded-xl border-border/80 bg-background/85 pl-9 text-sm",
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
            <div className="absolute inset-x-0 top-[calc(100%+4px)] z-20 rounded-lg border border-border/70 bg-popover/97 p-1 shadow-[var(--shadow-soft)] backdrop-blur-xl">
              {sugestoesLoading ? (
                <p className="px-2 py-1.5 text-xs text-muted-foreground">Buscando sugestoes...</p>
              ) : (
                sugestoes.map((sugestao) => (
                  <button
                    key={`${sugestao.tipo}-${sugestao.chave}`}
                    type="button"
                    className="w-full rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
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
          className="h-10 w-10 rounded-xl"
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
    <div className="space-y-2.5">
      <div className="h-14 rounded-xl border border-border/60 bg-surface-2/75 animate-pulse-slow" />
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
  const titulo = isNotFound ? "Funcionario nao encontrado" : isNetworkError ? "Erro de rede" : "Erro na busca";

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

function FuncionarioCard({ funcionario }: { funcionario: FuncionarioInfo }) {
  return (
    <div className="rounded-xl border border-border/70 bg-surface-1/90 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{funcionario.nome}</p>
          <p className="truncate text-xs text-muted-foreground">{funcionario.unidade}</p>
          <p className="truncate text-xs text-muted-foreground">{funcionario.setor}</p>
        </div>
        <StatusPill tone="info" className="text-[10px]">
          Em uso: {funcionario.kits_em_uso}/{funcionario.max_kits}
        </StatusPill>
      </div>
    </div>
  );
}
function ResumoEtapa({
  tipo,
  funcionario,
  matricula,
  quantidade,
  tamanho,
  itens,
  loading,
  onCancelar,
  onConfirmar,
}: {
  tipo: "emprestimo" | "devolucao";
  funcionario: FuncionarioInfo;
  matricula: string;
  quantidade?: number;
  tamanho?: string;
  itens?: ItemEmprestado[];
  loading: boolean;
  onCancelar: () => void;
  onConfirmar: () => void;
}) {
  const isEmprestimo = tipo === "emprestimo";
  const Icon = isEmprestimo ? Package : Undo2;

  return (
    <Card className="border-border/70 bg-card/94 shadow-[var(--shadow-soft)]">
      <CardContent className="px-4 pb-4 pt-5 sm:px-5">
        <div className="mx-auto max-w-md space-y-4">
          <div className="space-y-1 text-center">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-primary/25 bg-primary/12">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <h3 className="text-base font-bold text-foreground">
              {isEmprestimo ? "Confirmar Emprestimo" : "Confirmar Devolucao"}
            </h3>
            <p className="text-xs text-muted-foreground">Revise as informacoes antes de confirmar.</p>
          </div>

          <div className="space-y-2 rounded-xl border border-border/70 bg-surface-2/70 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Funcionario</span>
              <span className="text-sm font-semibold text-foreground">{funcionario.nome}</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Matricula</span>
              <span className="font-mono text-sm font-semibold text-foreground">{matricula}</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Unidade</span>
              <span className="text-sm font-semibold text-foreground">{funcionario.unidade}</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Setor</span>
              <span className="text-sm font-semibold text-foreground">{funcionario.setor}</span>
            </div>

            {isEmprestimo && quantidade != null && (
              <>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Quantidade</span>
                  <StatusPill tone="info">
                    {quantidade} {quantidade === 1 ? "kit" : "kits"}
                  </StatusPill>
                </div>
                {tamanho && (
                  <>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Tamanho</span>
                      <StatusPill tone="neutral">{tamanho}</StatusPill>
                    </div>
                  </>
                )}
              </>
            )}

            {!isEmprestimo && itens && itens.length > 0 && (
              <>
                <Separator />
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Itens a devolver ({itens.length})</p>
                  <div className="max-h-40 space-y-1 overflow-y-auto">
                    {itens.map((item) => (
                      <div key={item.codigo} className="flex items-center gap-2 rounded-lg border border-border/50 bg-background/75 p-2">
                        <span className="font-mono text-xs font-semibold text-primary">{item.codigo}</span>
                        <StatusPill tone="neutral">{item.tamanho}</StatusPill>
                        <span className="truncate text-xs text-muted-foreground">{item.descricao}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="flex gap-2">
            <Button onClick={onCancelar} disabled={loading} variant="outline" className="h-10 flex-1 rounded-xl text-xs">
              Cancelar
            </Button>
            <Button onClick={onConfirmar} disabled={loading} className="h-10 flex-1 rounded-xl text-xs">
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
    <Card className="border-border/70 bg-card/94 shadow-[var(--shadow-soft)]">
      <CardContent className="px-4 pb-5 pt-5 text-center sm:px-5">
        <div className="mx-auto max-w-sm space-y-4">
          <div className="flex justify-center">
            <div className={cn(
              "flex h-12 w-12 items-center justify-center rounded-2xl border",
              resultado.sucesso ? "border-success/30 bg-success/10" : "border-border/70 bg-muted/45",
            )}>
              {resultado.sucesso ? (
                <CheckCircle2 className="h-6 w-6 text-success" />
              ) : (
                <XCircle className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
          </div>

          <div>
            <h3 className="text-lg font-bold text-foreground">
              {resultado.sucesso ? (isEmprestimo ? "Emprestimo Realizado!" : "Devolucao Realizada!") : "Operacao Cancelada"}
            </h3>
            <p className="text-xs text-muted-foreground">
              {resultado.sucesso
                ? isEmprestimo
                  ? "O emprestimo foi confirmado com sucesso."
                  : "A devolucao foi confirmada com sucesso."
                : "A operacao foi cancelada e nenhuma alteracao foi realizada."}
            </p>
          </div>

          {resultado.sucesso && resultado.itens.length > 0 && (
            <div className="rounded-xl border border-border/70 bg-surface-2/70 p-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                {isEmprestimo ? "Itens emprestados:" : "Itens devolvidos:"}
              </p>
              <div className="flex flex-wrap justify-center gap-1.5">
                {resultado.itens.map((item) => (
                  <StatusPill key={item} tone="info" className="font-mono">
                    {item}
                  </StatusPill>
                ))}
              </div>
            </div>
          )}

          <Button onClick={onReset} variant="outline" className="h-9 w-full rounded-xl text-xs">
            <RefreshCw className="h-4 w-4" />
            Nova Operacao
          </Button>
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
  const [tamanhoSelecionado, setTamanhoSelecionado] = useState("");
  const [quantidade, setQuantidade] = useState(1);
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
    setTamanhoSelecionado("");
    setQuantidade(1);
    setResultado(null);
    setBuscaEstado("idle");
    setBuscaMensagem(null);
    setEtapa("busca");
    ultimoTermoBuscadoRef.current = "";
    enviarMonitorEmEspera("Aguardando uma nova operacao.");
  }

  function onMatriculaChange(value: string) {
    setMatricula(value);
    setMatriculaError(null);

    if (funcionario || buscaEstado !== "idle") {
      setFuncionario(null);
      setTamanhosDisponiveis([]);
      setTamanhoSelecionado("");
      setBuscaEstado("idle");
      setBuscaMensagem(null);
      setQuantidade(1);
    }
  }

  async function buscarFuncionario(entrada?: string) {
    const termo = (entrada ?? matricula).trim();
    if (!termo) {
      setMatriculaError("Informe matricula, nome ou kit.");
      return;
    }
    setMatriculaError(null);

    setBuscaLoading(true);
    setBuscaEstado("loading");
    setBuscaMensagem(null);
    setFuncionario(null);
    setTamanhosDisponiveis([]);
    setTamanhoSelecionado("");
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
      setTamanhoSelecionado(tamanhos[0]?.tamanho ?? "");
      setQuantidade(1);
      setBuscaEstado("success");
      enviarMonitorEmEspera("Dados localizados. Aguardando resumo para confirmacao.");
    } catch (err) {
      const classificado = classificarErroBusca(err, "Nao encontramos funcionario para esta matricula.");
      setBuscaEstado(classificado.estado);
      setBuscaMensagem(classificado.mensagem);
      setFuncionario(null);
      setTamanhosDisponiveis([]);
      setTamanhoSelecionado("");
      enviarMonitorEmEspera("Nao foi possivel localizar os dados. Aguardando nova tentativa.");
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

  function selecionarTamanho(value: string) {
    setTamanhoSelecionado(value);
    setQuantidade(1);
  }

  function abrirResumo() {
    if (!funcionario) return;
    if (!tamanhoSelecionado) return;
    enviarMonitorResumo({
      tipo: "emprestimo",
      matricula: matricula.trim(),
      funcionario,
      quantidade,
      tamanho: tamanhoSelecionado,
    });
    setEtapa("resumo");
  }

  async function confirmarEmprestimo() {
    if (!funcionario) return;
    if (!tamanhoSelecionado) return;

    setConfirmLoading(true);
    try {
      const data = await api.post<{ sucesso: boolean; itens_emprestados: string[] }>("/ops/emprestimo-direto", {
        matricula: matricula.trim(),
        quantidade,
        tamanho: tamanhoSelecionado,
      });
      setResultado({ sucesso: true, itens: data.itens_emprestados });
      setEtapa("resultado");
      success(`Emprestimo realizado: ${data.itens_emprestados.join(", ")}`);
      enviarMonitorResultado({
        tipo: "emprestimo",
        sucesso: true,
        mensagem: "Emprestimo confirmado com sucesso.",
        itens: data.itens_emprestados,
      });
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : "Erro ao realizar emprestimo";
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
    enviarMonitorEmEspera("Resumo cancelado. Aguardando nova operacao.");
    setEtapa("busca");
  }

  const disponivel = funcionario ? funcionario.kits_em_uso < funcionario.max_kits : false;
  const maxEmprestavel = funcionario ? Math.max(0, funcionario.max_kits - funcionario.kits_em_uso) : 0;
  const estoqueTamanhoSelecionado = tamanhosDisponiveis.find(
    (row) => row.tamanho === tamanhoSelecionado,
  )?.disponiveis ?? 0;
  const maxSolicitavel = Math.min(maxEmprestavel, estoqueTamanhoSelecionado);
  const quantidadeValida = maxSolicitavel > 0 && quantidade >= 1 && quantidade <= maxSolicitavel;
  const podeContinuar =
    Boolean(funcionario) &&
    disponivel &&
    Boolean(tamanhoSelecionado) &&
    estoqueTamanhoSelecionado > 0 &&
    quantidadeValida;

  let motivoContinuar: string | null = null;
  if (funcionario && !disponivel) {
    motivoContinuar = "Sem disponibilidade para novo emprestimo.";
  } else if (funcionario && tamanhosDisponiveis.length === 0) {
    motivoContinuar = "Nao ha kits disponiveis no estoque.";
  } else if (funcionario && !tamanhoSelecionado) {
    motivoContinuar = "Selecione o tamanho do kit.";
  } else if (funcionario && estoqueTamanhoSelecionado === 0) {
    motivoContinuar = "Sem estoque para o tamanho selecionado.";
  } else if (funcionario && !quantidadeValida) {
    motivoContinuar = `Selecione de 1 a ${maxSolicitavel}.`;
  }

  return (
    <div className="w-full space-y-3">
      {etapa === "busca" && (
        <div className="w-full space-y-3">
          <Card className="w-full border-border/70 bg-gradient-to-br from-background via-accent/12 to-muted/28 shadow-[var(--shadow-soft)]">
            <CardContent className="px-3 pb-3 pt-3 sm:px-4 sm:pb-4 sm:pt-4">
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

          {buscaEstado === "loading" && <BuscaSkeleton />}

          {buscaEstado !== "loading" && (
            <>
              {(buscaEstado === "idle" || buscaEstado === "notFound" || buscaEstado === "networkError" || buscaEstado === "error") && (
                <BuscaEstadoCard
                  estado={buscaEstado}
                  mensagem={buscaMensagem}
                  onRetry={buscaEstado === "networkError" ? buscarFuncionario : undefined}
                />
              )}

              {buscaEstado === "success" && funcionario && (
                <div className="space-y-3 animate-in fade-in-0 slide-in-from-bottom-2">
                  <Card className="border-border/70 bg-card/94 shadow-[var(--shadow-soft)]">
                    <CardContent className="space-y-2.5 px-3 pb-3 pt-3 sm:px-4 sm:pb-4 sm:pt-4">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Funcionario</p>
                      <FuncionarioCard funcionario={funcionario} />
                    </CardContent>
                  </Card>

                  <Card className="border-border/70 bg-card/94 shadow-[var(--shadow-soft)]">
                    <CardContent className="space-y-3 px-3 pb-3 pt-3 sm:px-4 sm:pb-4 sm:pt-4">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Status/Operacao</p>
                        <StatusPill tone={disponivel ? "success" : "danger"} className="text-[10px]">
                          {disponivel ? "Disponivel" : "Limite atingido"}
                        </StatusPill>
                      </div>

                      <div className="rounded-xl border border-border/65 bg-surface-2/60 p-3">
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-muted-foreground">Kits em uso</p>
                          <p className="text-sm font-semibold tabular-nums text-foreground">
                            {funcionario.kits_em_uso}
                            <span className="font-normal text-muted-foreground"> / {funcionario.max_kits}</span>
                          </p>
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <p className="text-xs text-muted-foreground">Estoque do tamanho</p>
                          <p className="text-sm font-semibold tabular-nums text-foreground">
                            {tamanhoSelecionado || "-"}
                            <span className="font-normal text-muted-foreground"> / {estoqueTamanhoSelecionado}</span>
                          </p>
                        </div>
                      </div>

                      <Separator />

                      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
                        <div className="space-y-1">
                          <Label htmlFor="emprestimo-tamanho" className="text-xs text-muted-foreground">
                            Tamanho
                          </Label>
                          <Select
                            value={tamanhoSelecionado}
                            onValueChange={selecionarTamanho}
                            disabled={!disponivel || tamanhosDisponiveis.length === 0}
                          >
                            <SelectTrigger id="emprestimo-tamanho" className="h-10 rounded-xl border-border/80 bg-background/85 text-xs">
                              <SelectValue placeholder="Selecione o tamanho" />
                            </SelectTrigger>
                            <SelectContent>
                              {tamanhosDisponiveis.map((row) => (
                                <SelectItem key={row.tamanho} value={row.tamanho}>
                                  {row.tamanho} ({row.disponiveis} disp.)
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <QuantitySelector
                          value={quantidade}
                          onChange={setQuantidade}
                          min={1}
                          max={Math.max(1, maxSolicitavel)}
                          disabled={!disponivel || !tamanhoSelecionado || estoqueTamanhoSelecionado === 0}
                          label={`Quantidade (max. ${maxSolicitavel})`}
                        />
                        <Button onClick={abrirResumo} disabled={!podeContinuar} className="h-10 w-full rounded-xl text-xs md:min-w-40 md:w-auto" aria-label="Continuar para resumo de emprestimo">
                          Continuar
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                        {!podeContinuar && motivoContinuar && (
                          <p className="text-xs text-muted-foreground sm:col-span-2" role="status">
                            {motivoContinuar}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {etapa === "resumo" && funcionario && (
        <ResumoEtapa
          tipo="emprestimo"
          funcionario={funcionario}
          matricula={matricula}
          quantidade={quantidade}
          tamanho={tamanhoSelecionado}
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
    enviarMonitorEmEspera("Aguardando uma nova operacao.");
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
      setMatriculaError("Informe matricula, nome ou kit.");
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
      setBuscaMensagem(emprestados.length === 0 ? "Este funcionario nao possui itens emprestados." : null);
      enviarMonitorEmEspera("Dados localizados. Aguardando resumo para confirmacao.");
    } catch (err) {
      const classificado = classificarErroBusca(err, "Nao encontramos funcionario para esta matricula.");
      setBuscaEstado(classificado.estado);
      setBuscaMensagem(classificado.mensagem);
      setFuncionario(null);
      setItens([]);
      setSelecionados(new Set());
      enviarMonitorEmEspera("Nao foi possivel localizar os dados. Aguardando nova tentativa.");
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
      success(`Devolucao realizada: ${data.itens_devolvidos.join(", ")}`);
      enviarMonitorResultado({
        tipo: "devolucao",
        sucesso: true,
        mensagem: "Devolucao confirmada com sucesso.",
        itens: data.itens_devolvidos,
      });
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : "Erro ao realizar devolucao";
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
    enviarMonitorEmEspera("Resumo cancelado. Aguardando nova operacao.");
    setEtapa("busca");
  }

  const selecionadosCount = selecionados.size;
  const podeContinuar = buscaEstado === "success" && selecionadosCount > 0;
  const motivoContinuar = buscaEstado === "empty"
    ? "Nenhum item disponivel para devolucao."
    : buscaEstado === "success" && selecionadosCount === 0
      ? "Selecione ao menos um item."
      : null;

  return (
    <div className="w-full space-y-3">
      {etapa === "busca" && (
        <div className="w-full space-y-3">
          <Card className="w-full border-border/70 bg-gradient-to-br from-background via-accent/12 to-muted/28 shadow-[var(--shadow-soft)]">
            <CardContent className="px-3 pb-3 pt-3 sm:px-4 sm:pb-4 sm:pt-4">
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

          {buscaEstado === "loading" && <BuscaSkeleton />}

          {buscaEstado !== "loading" && (
            <>
              {(buscaEstado === "idle" || buscaEstado === "notFound" || buscaEstado === "networkError" || buscaEstado === "error") && (
                <BuscaEstadoCard
                  estado={buscaEstado}
                  mensagem={buscaMensagem}
                  onRetry={buscaEstado === "networkError" ? buscarFuncionario : undefined}
                />
              )}

              {(buscaEstado === "success" || buscaEstado === "empty") && funcionario && (
                <div className="space-y-3 animate-in fade-in-0 slide-in-from-bottom-2">
                  <Card className="border-border/70 bg-card/94 shadow-[var(--shadow-soft)]">
                    <CardContent className="space-y-2.5 px-3 pb-3 pt-3 sm:px-4 sm:pb-4 sm:pt-4">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Funcionario</p>
                      <FuncionarioCard funcionario={funcionario} />
                    </CardContent>
                  </Card>

                  <Card className="border-border/70 bg-card/94 shadow-[var(--shadow-soft)]">
                    <CardContent className="space-y-3 px-3 pb-3 pt-3 sm:px-4 sm:pb-4 sm:pt-4">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Status/Operacao</p>
                        <StatusPill tone={buscaEstado === "empty" ? "danger" : "info"} className="text-[10px]">
                          {buscaEstado === "empty" ? "Sem itens" : `${itens.length} item(ns)`}
                        </StatusPill>
                      </div>

                      {buscaEstado === "empty" ? (
                        <div className="rounded-xl border border-border/65 bg-surface-2/60 p-4 text-center">
                          <Package className="mx-auto mb-2 h-7 w-7 text-muted-foreground/60" />
                          <p className="text-sm font-medium text-foreground">Nenhum item emprestado</p>
                          <p className="text-xs text-muted-foreground">Este funcionario nao possui itens para devolucao.</p>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-medium text-muted-foreground">Itens emprestados ({itens.length})</p>
                            <p className="text-xs font-semibold text-foreground">Selecionados: {selecionadosCount}</p>
                          </div>

                          <div className="space-y-1.5">
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
                                    "flex cursor-pointer items-center gap-2 rounded-xl border bg-background/80 px-3 py-2 transition-all hover:border-primary/30 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 animate-in fade-in-0 slide-in-from-bottom-2",
                                    checked ? "border-primary/40 bg-primary/[0.04]" : "border-border/50",
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
                                    <StatusPill tone="neutral">{item.tamanho}</StatusPill>
                                    <span className="truncate text-sm text-muted-foreground">{item.descricao}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      )}

                      <div className="space-y-2 pt-1">
                        <Button onClick={abrirResumo} disabled={!podeContinuar} className="h-10 rounded-xl text-xs sm:min-w-40" aria-label="Continuar para resumo de devolucao">
                          Continuar ({selecionadosCount})
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                        {!podeContinuar && motivoContinuar && (
                          <p className="text-xs text-muted-foreground" role="status">
                            {motivoContinuar}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {etapa === "resumo" && funcionario && (
        <ResumoEtapa
          tipo="devolucao"
          funcionario={funcionario}
          matricula={matricula}
          itens={itens.filter((item) => selecionados.has(item.codigo))}
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
export function SetorPage() {
  useEffect(() => {
    enviarMonitorEmEspera("Aguardando uma operacao na tela principal.");
  }, []);

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-background animate-in fade-in-0">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-background via-accent/20 to-secondary/42 dark:from-background dark:via-primary/8 dark:to-accent/18" />
        <div className="absolute -left-20 top-[-10rem] h-[30rem] w-[30rem] rounded-full bg-primary/24 blur-[128px] animate-drift-slower" />
        <div className="absolute right-[-11rem] bottom-[-11rem] h-[33rem] w-[33rem] rounded-full bg-secondary/68 blur-[136px] animate-drift-slow dark:bg-accent/26" />
      </div>

      <Header />
      <main className="relative min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-6xl p-4 sm:p-6">
          <Card className="w-full border-border/80 bg-card/95 shadow-[0_30px_60px_-34px_hsl(200_76%_20%_/_0.65)] backdrop-blur-xl animate-in fade-in-50 slide-in-from-bottom-8 duration-700">
          <CardHeader className="border-b border-border/65 bg-gradient-to-r from-primary/8 via-transparent to-accent/14 px-4 pb-4 pt-4 sm:px-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/28 bg-gradient-to-br from-primary/18 via-background to-accent/45 p-2.5 shadow-[0_10px_26px_-18px_hsl(198_68%_24%_/_0.68)]">
                  <img src="/logo-privativos.png" alt="Privativos" className="h-full w-full rounded-lg object-cover" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Privativos</p>
                  <CardTitle className="text-lg font-bold sm:text-2xl">Operacoes</CardTitle>
                  <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
                    Gerencie emprestimos e devolucoes de kits com validacao rapida.
                  </p>
                </div>
              </div>

              <StatusPill tone="info" className="text-[10px]">
                Fluxo operacional ativo
              </StatusPill>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-5 sm:px-5 sm:pb-5">
            <Tabs defaultValue="emprestimo" className="w-full space-y-4">
              <TabsList className="mx-auto grid h-auto w-full max-w-lg grid-cols-2 gap-1 rounded-2xl border border-border/70 bg-gradient-to-r from-surface-2/95 via-background/92 to-surface-2/95 p-1.5 shadow-sm">
                <TabsTrigger
                  value="emprestimo"
                  className="gap-2 rounded-xl border border-transparent py-2.5 text-[13px] font-semibold tracking-wide transition-all duration-200 data-[state=active]:border-primary/25 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary/16 data-[state=active]:to-primary/6 data-[state=active]:text-primary data-[state=active]:shadow-sm"
                >
                  <Package className="h-4 w-4" />
                  <span className="font-medium">Emprestimo</span>
                </TabsTrigger>
                <TabsTrigger
                  value="devolucao"
                  className="gap-2 rounded-xl border border-transparent py-2.5 text-[13px] font-semibold tracking-wide transition-all duration-200 data-[state=active]:border-sky-300/45 data-[state=active]:bg-gradient-to-r data-[state=active]:from-sky-500/15 data-[state=active]:to-cyan-500/10 data-[state=active]:text-sky-700 data-[state=active]:shadow-sm dark:data-[state=active]:text-sky-300"
                >
                  <Undo2 className="h-4 w-4" />
                  <span className="font-medium">Devolucao</span>
                </TabsTrigger>
              </TabsList>
              <TabsContent value="emprestimo" className="mt-4 w-full">
                <EmprestimoTab />
              </TabsContent>
              <TabsContent value="devolucao" className="mt-4 w-full">
                <DevolucaoTab />
              </TabsContent>
            </Tabs>
          </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
