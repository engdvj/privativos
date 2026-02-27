import { useState } from "react";
import { api } from "@/lib/api";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { QuantitySelector } from "@/components/ui/quantity-selector";
import {
  Search,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Package,
  Undo2,
  Loader2,
  Trash2,
} from "lucide-react";

interface FuncionarioInfo {
  nome: string;
  setor: string;
  kits_em_uso: number;
  max_kits: number;
}

interface ItemEmprestado {
  codigo: string;
  descricao: string;
}

type Etapa = "busca" | "resumo" | "resultado";

// ─── Aba Empréstimo ──────────────────────────────────────────────

function EmprestimoTab() {
  const [matricula, setMatricula] = useState("");
  const [funcionario, setFuncionario] = useState<FuncionarioInfo | null>(null);
  const [quantidade, setQuantidade] = useState(1);
  const [etapa, setEtapa] = useState<Etapa>("busca");
  const [resultado, setResultado] = useState<{ sucesso: boolean; itens: string[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const { success, error } = useToast();

  function reset() {
    setMatricula("");
    setFuncionario(null);
    setQuantidade(1);
    setEtapa("busca");
    setResultado(null);
  }

  async function buscarFuncionario() {
    if (!matricula.trim()) return;
    setLoading(true);
    try {
      const data = await api.get<FuncionarioInfo>(`/ops/funcionario/${matricula.trim()}`);
      setFuncionario(data);
      setQuantidade(1);
    } catch (err) {
      error(err instanceof Error ? err.message : "Funcionario nao encontrado");
      setFuncionario(null);
    } finally {
      setLoading(false);
    }
  }

  async function limparFila() {
    if (!matricula.trim()) {
      error("Informe uma matricula para limpar a fila");
      return;
    }
    setLoading(true);
    try {
      await api.post("/ops/limpar-fila", { matricula: matricula.trim() });
      success("Fila de operacoes limpa com sucesso");
    } catch (err) {
      error(err instanceof Error ? err.message : "Erro ao limpar fila");
    } finally {
      setLoading(false);
    }
  }

  function abrirResumo() {
    if (!funcionario) return;
    setEtapa("resumo");
  }

  async function confirmarEmprestimo() {
    if (!funcionario) return;
    setLoading(true);
    try {
      const data = await api.post<{ sucesso: boolean; itens_emprestados: string[] }>(
        "/ops/emprestimo-direto",
        {
          matricula: matricula.trim(),
          quantidade,
        },
      );
      setResultado({ sucesso: true, itens: data.itens_emprestados });
      setEtapa("resultado");
      success(`Emprestimo realizado: ${data.itens_emprestados.join(", ")}`);
    } catch (err) {
      error(err instanceof Error ? err.message : "Erro ao realizar emprestimo");
      setEtapa("busca");
    } finally {
      setLoading(false);
    }
  }

  function cancelarResumo() {
    setEtapa("busca");
  }

  const disponivelParaEmprestimo =
    funcionario && funcionario.kits_em_uso < funcionario.max_kits;
  const maxEmprestavel = funcionario
    ? funcionario.max_kits - funcionario.kits_em_uso
    : 0;

  return (
    <div className="w-full space-y-4">
      {/* Etapa: Busca */}
      {etapa === "busca" && (
        <div className="w-full space-y-4 animate-in fade-in-50 duration-500">
          {/* Search Bar */}
          <Card className="w-full border-primary/30 bg-gradient-to-br from-primary/[0.06] via-background to-background shadow-md">
            <CardContent className="pt-4 pb-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                    <Search className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <Label htmlFor="mat-emp" className="text-sm font-semibold">
                      Matricula do funcionario
                    </Label>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Input
                    id="mat-emp"
                    placeholder="Digite a matricula"
                    value={matricula}
                    onChange={(e) => setMatricula(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && buscarFuncionario()}
                    className="h-10"
                  />
                  <Button
                    onClick={buscarFuncionario}
                    disabled={loading || !matricula.trim()}
                    className="min-w-28 h-10"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                    Buscar
                  </Button>
                  <Button
                    onClick={limparFila}
                    disabled={loading || !matricula.trim()}
                    variant="outline"
                    className="h-10 px-3"
                    title="Limpar fila de operações pendentes"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Resultado da Busca */}
          {funcionario && (
            <Card className="overflow-hidden border-primary/30 bg-gradient-to-br from-primary/[0.04] via-card to-card shadow-lg animate-in slide-in-from-bottom-4 duration-500">
              <CardHeader className="border-b bg-gradient-to-r from-primary/5 to-transparent pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 ring-2 ring-primary/10">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-base">Funcionário Encontrado</CardTitle>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-4 space-y-4">
                {/* Informações do Funcionário */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="group relative overflow-hidden rounded-lg border border-border/70 bg-gradient-to-br from-surface-2 to-surface-2/50 p-3 transition-all hover:shadow-md hover:border-primary/30">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
                      Nome
                    </p>
                    <p className="text-sm font-semibold text-foreground relative">
                      {funcionario.nome}
                    </p>
                  </div>
                  <div className="group relative overflow-hidden rounded-lg border border-border/70 bg-gradient-to-br from-surface-2 to-surface-2/50 p-3 transition-all hover:shadow-md hover:border-primary/30">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
                      Setor
                    </p>
                    <p className="text-sm font-semibold text-foreground relative">
                      {funcionario.setor}
                    </p>
                  </div>
                </div>

                {/* Status de Kits */}
                <div className="rounded-lg border border-border/70 bg-gradient-to-br from-surface-2 to-surface-2/50 p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${disponivelParaEmprestimo ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                        <Package className={`h-4 w-4 ${disponivelParaEmprestimo ? 'text-green-600' : 'text-red-600'}`} />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Kits em uso</p>
                        <div className="flex items-baseline gap-1.5">
                          <p className="text-lg font-bold text-foreground">
                            {funcionario.kits_em_uso}
                          </p>
                          <p className="text-xs text-muted-foreground">/ {funcionario.max_kits}</p>
                        </div>
                      </div>
                    </div>
                    <Badge
                      variant={disponivelParaEmprestimo ? "secondary" : "destructive"}
                      className="text-xs"
                    >
                      {disponivelParaEmprestimo ? 'Disponível' : 'Limite atingido'}
                    </Badge>
                  </div>

                  {/* Barra de Progresso */}
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full transition-all duration-500 ${
                        disponivelParaEmprestimo ? 'bg-green-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${(funcionario.kits_em_uso / funcionario.max_kits) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Alerta de Limite */}
                {!disponivelParaEmprestimo && (
                  <div className="rounded-lg border border-amber-200 bg-gradient-to-br from-amber-50 to-amber-50/50 p-3 animate-in slide-in-from-top-2 duration-300">
                    <div className="flex gap-2">
                      <XCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-amber-900">Limite de kits atingido</p>
                        <p className="text-xs text-amber-800 mt-0.5">
                          Este funcionário já está utilizando o número máximo de kits permitido.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Seleção de Quantidade */}
                {disponivelParaEmprestimo && (
                  <div className="space-y-3 animate-in slide-in-from-bottom-2 duration-500">
                    <Separator />
                    <div className="rounded-lg border border-primary/20 bg-primary/[0.03] p-4">
                      <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
                        <QuantitySelector
                          value={quantidade}
                          onChange={setQuantidade}
                          min={1}
                          max={maxEmprestavel}
                          label="Quantidade de kits"
                        />
                        <Button
                          onClick={abrirResumo}
                          disabled={loading}
                          className="sm:min-w-44 h-10 shadow-md"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Continuar
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Etapa: Resumo */}
      {etapa === "resumo" && funcionario && (
        <Card className="border-primary/30 bg-gradient-to-br from-card via-card to-surface-2/50 shadow-lg animate-in zoom-in-95 duration-500">
          <CardContent className="pt-6 pb-6">
            <div className="mx-auto max-w-md space-y-5">
              {/* Título */}
              <div className="text-center space-y-2">
                <div className="flex justify-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 ring-4 ring-primary/10">
                    <Package className="h-6 w-6 text-primary" />
                  </div>
                </div>
                <h3 className="text-lg font-bold text-foreground">Confirmar Empréstimo</h3>
                <p className="text-xs text-muted-foreground">
                  Revise as informações antes de confirmar a operação.
                </p>
              </div>

              {/* Resumo */}
              <div className="space-y-3 rounded-lg border border-border/70 bg-surface-2/50 p-4">
                <div className="flex items-center justify-between pb-2 border-b border-border/50">
                  <span className="text-xs font-medium text-muted-foreground">Funcionário</span>
                  <span className="text-sm font-semibold text-foreground">{funcionario.nome}</span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-border/50">
                  <span className="text-xs font-medium text-muted-foreground">Matrícula</span>
                  <span className="text-sm font-mono font-semibold text-foreground">{matricula}</span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-border/50">
                  <span className="text-xs font-medium text-muted-foreground">Setor</span>
                  <span className="text-sm font-semibold text-foreground">{funcionario.setor}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Quantidade de kits</span>
                  <Badge variant="secondary" className="text-sm font-bold">
                    {quantidade} {quantidade === 1 ? 'kit' : 'kits'}
                  </Badge>
                </div>
              </div>

              {/* Ações */}
              <div className="flex gap-2">
                <Button
                  onClick={cancelarResumo}
                  disabled={loading}
                  variant="outline"
                  className="flex-1 h-10"
                >
                  <XCircle className="h-4 w-4" />
                  Cancelar
                </Button>
                <Button
                  onClick={confirmarEmprestimo}
                  disabled={loading}
                  className="flex-1 h-10 shadow-md"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  Confirmar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Etapa: Resultado */}
      {etapa === "resultado" && resultado && (
        <Card className="border-primary/30 bg-gradient-to-br from-card via-card to-surface-2/50 shadow-lg animate-in zoom-in-95 duration-500">
          <CardContent className="pt-6 pb-6 text-center">
            <div className="mx-auto max-w-sm space-y-4">
              {/* Ícone de Status */}
              <div className="flex justify-center">
                <div
                  className={`flex h-14 w-14 items-center justify-center rounded-full ${
                    resultado.sucesso
                      ? 'bg-green-500/10 ring-4 ring-green-500/10'
                      : 'bg-slate-500/10 ring-4 ring-slate-500/10'
                  } animate-in zoom-in-50 duration-700`}
                >
                  {resultado.sucesso ? (
                    <CheckCircle2 className="h-7 w-7 text-green-600" />
                  ) : (
                    <XCircle className="h-7 w-7 text-slate-600" />
                  )}
                </div>
              </div>

              {/* Mensagem */}
              <div>
                <h3 className="text-lg font-bold text-foreground mb-1">
                  {resultado.sucesso ? 'Empréstimo Realizado!' : 'Operação Cancelada'}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {resultado.sucesso
                    ? 'O empréstimo foi confirmado com sucesso.'
                    : 'A operação foi cancelada e nenhuma alteração foi realizada.'}
                </p>
              </div>

              {/* Itens emprestados */}
              {resultado.sucesso && resultado.itens.length > 0 && (
                <div className="rounded-lg border bg-surface-2/50 p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    Itens emprestados:
                  </p>
                  <div className="flex flex-wrap gap-1.5 justify-center">
                    {resultado.itens.map((item) => (
                      <Badge key={item} variant="secondary" className="font-mono text-xs">
                        {item}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Ação */}
              <Button onClick={reset} variant="outline" className="w-full h-9 shadow-md">
                <RefreshCw className="h-4 w-4" />
                Nova Operação
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Aba Devolução ──────────────────────────────────────────────

function DevolucaoTab() {
  const [matricula, setMatricula] = useState("");
  const [funcionario, setFuncionario] = useState<FuncionarioInfo | null>(null);
  const [itens, setItens] = useState<ItemEmprestado[]>([]);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [etapa, setEtapa] = useState<Etapa>("busca");
  const [resultado, setResultado] = useState<{ sucesso: boolean; itens: string[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const { success, error } = useToast();

  function reset() {
    setMatricula("");
    setFuncionario(null);
    setItens([]);
    setSelecionados(new Set());
    setEtapa("busca");
    setResultado(null);
  }

  async function buscarFuncionario() {
    if (!matricula.trim()) return;
    setLoading(true);
    try {
      const [func, emprestados] = await Promise.all([
        api.get<FuncionarioInfo>(`/ops/funcionario/${matricula.trim()}`),
        api.get<ItemEmprestado[]>(`/ops/itens-emprestados/${matricula.trim()}`),
      ]);
      setFuncionario(func);
      setItens(emprestados);
      setSelecionados(new Set());
    } catch (err) {
      error(err instanceof Error ? err.message : "Funcionario nao encontrado");
      setFuncionario(null);
      setItens([]);
    } finally {
      setLoading(false);
    }
  }

  async function limparFila() {
    if (!matricula.trim()) {
      error("Informe uma matricula para limpar a fila");
      return;
    }
    setLoading(true);
    try {
      await api.post("/ops/limpar-fila", { matricula: matricula.trim() });
      success("Fila de operacoes limpa com sucesso");
    } catch (err) {
      error(err instanceof Error ? err.message : "Erro ao limpar fila");
    } finally {
      setLoading(false);
    }
  }

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

  function abrirResumo() {
    if (selecionados.size === 0) return;
    setEtapa("resumo");
  }

  async function confirmarDevolucao() {
    if (selecionados.size === 0) return;
    setLoading(true);
    try {
      const itemCodigos = Array.from(selecionados);
      const data = await api.post<{ sucesso: boolean; itens_devolvidos: string[] }>(
        "/ops/devolucao-direta",
        {
          matricula: matricula.trim(),
          item_codigos: itemCodigos,
        },
      );
      setResultado({ sucesso: true, itens: data.itens_devolvidos });
      setEtapa("resultado");
      success(`Devolucao realizada: ${data.itens_devolvidos.join(", ")}`);
    } catch (err) {
      error(err instanceof Error ? err.message : "Erro ao realizar devolucao");
      setEtapa("busca");
    } finally {
      setLoading(false);
    }
  }

  function cancelarResumo() {
    setEtapa("busca");
  }

  return (
    <div className="w-full space-y-4">
      {/* Etapa: Busca */}
      {etapa === "busca" && (
        <div className="w-full space-y-4 animate-in fade-in-50 duration-500">
          {/* Search Bar */}
          <Card className="w-full border-primary/30 bg-gradient-to-br from-primary/[0.06] via-background to-background shadow-md">
            <CardContent className="pt-4 pb-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                    <Search className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <Label htmlFor="mat-dev" className="text-sm font-semibold">
                      Matricula do funcionario
                    </Label>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Input
                    id="mat-dev"
                    placeholder="Digite a matricula"
                    value={matricula}
                    onChange={(e) => setMatricula(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && buscarFuncionario()}
                    className="h-10"
                  />
                  <Button
                    onClick={buscarFuncionario}
                    disabled={loading || !matricula.trim()}
                    className="min-w-28 h-10"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                    Buscar
                  </Button>
                  <Button
                    onClick={limparFila}
                    disabled={loading || !matricula.trim()}
                    variant="outline"
                    className="h-10 px-3"
                    title="Limpar fila de operações pendentes"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Resultado da Busca */}
          {funcionario && (
            <Card className="overflow-hidden border-primary/30 bg-gradient-to-br from-primary/[0.04] via-card to-card shadow-lg animate-in slide-in-from-bottom-4 duration-500">
              <CardHeader className="border-b bg-gradient-to-r from-primary/5 to-transparent pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 ring-2 ring-primary/10">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-base">Funcionário Encontrado</CardTitle>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-4 space-y-4">
                {/* Informações do Funcionário */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="group relative overflow-hidden rounded-lg border border-border/70 bg-gradient-to-br from-surface-2 to-surface-2/50 p-3 transition-all hover:shadow-md hover:border-primary/30">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
                      Nome
                    </p>
                    <p className="text-sm font-semibold text-foreground relative">
                      {funcionario.nome}
                    </p>
                  </div>
                  <div className="group relative overflow-hidden rounded-lg border border-border/70 bg-gradient-to-br from-surface-2 to-surface-2/50 p-3 transition-all hover:shadow-md hover:border-primary/30">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
                      Setor
                    </p>
                    <p className="text-sm font-semibold text-foreground relative">
                      {funcionario.setor}
                    </p>
                  </div>
                </div>

                <Separator />

                {/* Lista de Itens */}
                {itens.length === 0 ? (
                  <div className="rounded-lg border border-slate-200 bg-gradient-to-br from-slate-50 to-slate-50/50 p-4 text-center animate-in fade-in-50 duration-300">
                    <div className="flex justify-center mb-2">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
                        <Package className="h-5 w-5 text-slate-400" />
                      </div>
                    </div>
                    <p className="text-sm font-medium text-slate-700 mb-0.5">Nenhum item emprestado</p>
                    <p className="text-xs text-slate-600">
                      Este funcionário não possui itens para devolução.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 animate-in slide-in-from-bottom-2 duration-500">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-muted-foreground">
                        Itens emprestados ({itens.length})
                      </p>
                      {selecionados.size > 0 && (
                        <Badge variant="secondary" className="text-xs animate-in fade-in-50 duration-200">
                          {selecionados.size} selecionado{selecionados.size !== 1 ? 's' : ''}
                        </Badge>
                      )}
                    </div>

                    <div className="space-y-1.5 rounded-lg border border-border/70 bg-surface-2/30 p-2">
                      {itens.map((item, index) => (
                        <label
                          key={item.codigo}
                          className="flex cursor-pointer items-center gap-2 rounded-lg border border-transparent bg-background p-2 transition-all hover:border-primary/30 hover:shadow-sm animate-in slide-in-from-left-2 duration-300"
                          style={{ animationDelay: `${index * 50}ms` }}
                        >
                          <Checkbox
                            checked={selecionados.has(item.codigo)}
                            onCheckedChange={() => toggleItem(item.codigo)}
                            className="h-4 w-4"
                          />
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <Badge variant="outline" className="font-mono text-xs font-semibold shrink-0">
                              {item.codigo}
                            </Badge>
                            <span className="text-xs text-muted-foreground truncate">
                              {item.descricao}
                            </span>
                          </div>
                        </label>
                      ))}
                    </div>

                    <div className="flex justify-end">
                      <Button
                        onClick={abrirResumo}
                        disabled={loading || selecionados.size === 0}
                        className="min-w-48 h-9 shadow-md"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Continuar ({selecionados.size})
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Etapa: Resumo */}
      {etapa === "resumo" && funcionario && (
        <Card className="border-primary/30 bg-gradient-to-br from-card via-card to-surface-2/50 shadow-lg animate-in zoom-in-95 duration-500">
          <CardContent className="pt-6 pb-6">
            <div className="mx-auto max-w-md space-y-5">
              {/* Título */}
              <div className="text-center space-y-2">
                <div className="flex justify-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-500/10 ring-4 ring-sky-500/10">
                    <Undo2 className="h-6 w-6 text-sky-600" />
                  </div>
                </div>
                <h3 className="text-lg font-bold text-foreground">Confirmar Devolução</h3>
                <p className="text-xs text-muted-foreground">
                  Revise as informações antes de confirmar a operação.
                </p>
              </div>

              {/* Resumo */}
              <div className="space-y-3 rounded-lg border border-border/70 bg-surface-2/50 p-4">
                <div className="flex items-center justify-between pb-2 border-b border-border/50">
                  <span className="text-xs font-medium text-muted-foreground">Funcionário</span>
                  <span className="text-sm font-semibold text-foreground">{funcionario.nome}</span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-border/50">
                  <span className="text-xs font-medium text-muted-foreground">Matrícula</span>
                  <span className="text-sm font-mono font-semibold text-foreground">{matricula}</span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-border/50">
                  <span className="text-xs font-medium text-muted-foreground">Setor</span>
                  <span className="text-sm font-semibold text-foreground">{funcionario.setor}</span>
                </div>
                <div className="pt-2">
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    Itens a devolver ({selecionados.size}):
                  </p>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto rounded-md border border-border/50 bg-background/50 p-2">
                    {itens
                      .filter((item) => selecionados.has(item.codigo))
                      .map((item) => (
                        <div
                          key={item.codigo}
                          className="flex items-center gap-2 rounded-md border border-border/40 bg-surface-2/50 p-2"
                        >
                          <Badge variant="outline" className="font-mono text-xs font-semibold shrink-0">
                            {item.codigo}
                          </Badge>
                          <span className="text-xs text-muted-foreground truncate">
                            {item.descricao}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>

              {/* Ações */}
              <div className="flex gap-2">
                <Button
                  onClick={cancelarResumo}
                  disabled={loading}
                  variant="outline"
                  className="flex-1 h-10"
                >
                  <XCircle className="h-4 w-4" />
                  Cancelar
                </Button>
                <Button
                  onClick={confirmarDevolucao}
                  disabled={loading}
                  className="flex-1 h-10 shadow-md"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  Confirmar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Etapa: Resultado */}
      {etapa === "resultado" && resultado && (
        <Card className="border-primary/30 bg-gradient-to-br from-card via-card to-surface-2/50 shadow-lg animate-in zoom-in-95 duration-500">
          <CardContent className="pt-6 pb-6 text-center">
            <div className="mx-auto max-w-sm space-y-4">
              {/* Ícone de Status */}
              <div className="flex justify-center">
                <div
                  className={`flex h-14 w-14 items-center justify-center rounded-full ${
                    resultado.sucesso
                      ? 'bg-green-500/10 ring-4 ring-green-500/10'
                      : 'bg-slate-500/10 ring-4 ring-slate-500/10'
                  } animate-in zoom-in-50 duration-700`}
                >
                  {resultado.sucesso ? (
                    <CheckCircle2 className="h-7 w-7 text-green-600" />
                  ) : (
                    <XCircle className="h-7 w-7 text-slate-600" />
                  )}
                </div>
              </div>

              {/* Mensagem */}
              <div>
                <h3 className="text-lg font-bold text-foreground mb-1">
                  {resultado.sucesso ? 'Devolução Realizada!' : 'Operação Cancelada'}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {resultado.sucesso
                    ? 'A devolução foi confirmada com sucesso.'
                    : 'A operação foi cancelada e nenhuma alteração foi realizada.'}
                </p>
              </div>

              {/* Itens devolvidos */}
              {resultado.sucesso && resultado.itens.length > 0 && (
                <div className="rounded-lg border bg-surface-2/50 p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    Itens devolvidos:
                  </p>
                  <div className="flex flex-wrap gap-1.5 justify-center">
                    {resultado.itens.map((item) => (
                      <Badge key={item} variant="secondary" className="font-mono text-xs">
                        {item}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Ação */}
              <Button onClick={reset} variant="outline" className="w-full h-9 shadow-md">
                <RefreshCw className="h-4 w-4" />
                Nova Operação
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Página principal ───────────────────────────────────────────

export function SetorPage() {
  return (
    <div className="flex min-h-dvh flex-col overflow-x-hidden bg-gradient-to-br from-background via-background to-muted/20">
      <Header />
      <main className="mx-auto flex w-full max-w-5xl flex-1 items-center justify-center p-4 sm:p-6">
        <Card className="w-full border-border/70 bg-gradient-to-br from-card via-card to-surface-2/30 shadow-xl backdrop-blur-sm animate-in fade-in-50 slide-in-from-bottom-8 duration-700">
          <CardHeader className="border-b bg-gradient-to-r from-primary/5 via-transparent to-primary/5 pb-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/80 shadow-md ring-4 ring-primary/10 shrink-0">
                <Package className="h-5 w-5 text-primary-foreground" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-xl sm:text-2xl font-bold">Operações</CardTitle>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                  Gerencie empréstimos e devoluções de kits com validação rápida.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-5 sm:pt-6">
            <Tabs defaultValue="emprestimo" className="w-full space-y-5">
              <TabsList className="mx-auto grid h-auto w-full max-w-lg grid-cols-2 gap-1 rounded-2xl border border-border/70 bg-gradient-to-r from-surface-2/90 via-muted/55 to-surface-2/90 p-1.5 shadow-sm">
                <TabsTrigger
                  value="emprestimo"
                  className="gap-2 rounded-xl border border-transparent py-2.5 text-[13px] font-semibold tracking-wide transition-all duration-200 data-[state=active]:border-primary/25 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary/16 data-[state=active]:to-primary/6 data-[state=active]:text-primary data-[state=active]:shadow-sm"
                >
                  <Package className="h-4 w-4" />
                  <span className="font-medium">Empréstimo</span>
                </TabsTrigger>
                <TabsTrigger
                  value="devolucao"
                  className="gap-2 rounded-xl border border-transparent py-2.5 text-[13px] font-semibold tracking-wide transition-all duration-200 data-[state=active]:border-sky-300/45 data-[state=active]:bg-gradient-to-r data-[state=active]:from-sky-500/15 data-[state=active]:to-cyan-500/10 data-[state=active]:text-sky-700 data-[state=active]:shadow-sm dark:data-[state=active]:text-sky-300"
                >
                  <Undo2 className="h-4 w-4" />
                  <span className="font-medium">Devolução</span>
                </TabsTrigger>
              </TabsList>
              <TabsContent value="emprestimo" className="mt-5 w-full">
                <EmprestimoTab />
              </TabsContent>
              <TabsContent value="devolucao" className="mt-5 w-full">
                <DevolucaoTab />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
