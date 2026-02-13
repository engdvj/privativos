import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "@/lib/api";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Search,
  KeyRound,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Package,
  Undo2,
  Loader2,
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

type Etapa = "busca" | "codigo" | "resultado";

// ─── Aba Empréstimo ──────────────────────────────────────────────

function EmprestimoTab() {
  const [matricula, setMatricula] = useState("");
  const [funcionario, setFuncionario] = useState<FuncionarioInfo | null>(null);
  const [quantidade, setQuantidade] = useState(1);
  const [codigo, setCodigo] = useState("");
  const [etapa, setEtapa] = useState<Etapa>("busca");
  const [resultado, setResultado] = useState<{ sucesso: boolean; itens: string[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const { success, error, info } = useToast();
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const limparPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  useEffect(() => {
    return limparPolling;
  }, [limparPolling]);

  function reset() {
    setMatricula("");
    setFuncionario(null);
    setQuantidade(1);
    setCodigo("");
    setEtapa("busca");
    setResultado(null);
    limparPolling();
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

  async function gerarCodigo() {
    if (!funcionario) return;
    setLoading(true);
    try {
      const data = await api.post<{ codigo: string }>("/ops/gerar-codigo", {
        matricula: matricula.trim(),
        tipo: "emprestimo",
        quantidade,
      });
      setCodigo(data.codigo);
      setEtapa("codigo");
    } catch (err) {
      error(err instanceof Error ? err.message : "Erro ao gerar codigo");
    } finally {
      setLoading(false);
    }
  }

  async function confirmar() {
    setLoading(true);
    try {
      const data = await api.post<{ sucesso: boolean; itens_emprestados: string[] }>(
        "/ops/confirmar",
        {
          matricula: matricula.trim(),
          tipo: "emprestimo",
          codigo,
        },
      );
      limparPolling();
      setResultado({ sucesso: true, itens: data.itens_emprestados });
      setEtapa("resultado");
      success(`Emprestimo realizado: ${data.itens_emprestados.join(", ")}`);
    } catch (err) {
      error(err instanceof Error ? err.message : "Erro ao confirmar");
    } finally {
      setLoading(false);
    }
  }

  async function cancelar() {
    try {
      await api.post("/ops/cancelar", {
        matricula: matricula.trim(),
        tipo: "emprestimo",
      });
    } catch {
      // ignore
    }
    limparPolling();
    setResultado({ sucesso: false, itens: [] });
    setEtapa("resultado");
    info("Operacao cancelada");
  }

  // Inicia polling quando entra na etapa de código
  useEffect(() => {
    if (etapa !== "codigo") return;
    pollingRef.current = setInterval(async () => {
      try {
        await api.get(`/ops/status-setor/${matricula.trim()}`);
      } catch {
        // ignore polling errors
      }
    }, 3000);
    return limparPolling;
  }, [etapa, matricula, limparPolling]);

  const disponivelParaEmprestimo =
    funcionario && funcionario.kits_em_uso < funcionario.max_kits;
  const maxEmprestavel = funcionario
    ? funcionario.max_kits - funcionario.kits_em_uso
    : 0;

  return (
    <div className="space-y-4">
      {/* Etapa: Busca */}
      {etapa === "busca" && (
        <>
          <div className="flex gap-2">
            <div className="flex-1 space-y-2">
              <Label htmlFor="mat-emp">Matricula do funcionario</Label>
              <Input
                id="mat-emp"
                placeholder="Digite a matricula"
                value={matricula}
                onChange={(e) => setMatricula(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && buscarFuncionario()}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={buscarFuncionario} disabled={loading || !matricula.trim()}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Buscar
              </Button>
            </div>
          </div>

          {funcionario && (
            <Card className="border-blue-200 bg-blue-50/50">
              <CardContent className="pt-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Nome:</span>{" "}
                    <span className="font-medium">{funcionario.nome}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Setor:</span>{" "}
                    <span className="font-medium">{funcionario.setor}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Kits em uso:</span>{" "}
                    <Badge variant={disponivelParaEmprestimo ? "secondary" : "destructive"}>
                      {funcionario.kits_em_uso} / {funcionario.max_kits}
                    </Badge>
                  </div>
                </div>

                {!disponivelParaEmprestimo && (
                  <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    Limite de kits atingido. Nao e possivel realizar emprestimo.
                  </div>
                )}

                {disponivelParaEmprestimo && (
                  <>
                    <Separator className="my-3" />
                    <div className="flex items-end gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="qtd">Quantidade</Label>
                        <Input
                          id="qtd"
                          type="number"
                          min={1}
                          max={maxEmprestavel}
                          value={quantidade}
                          onChange={(e) => setQuantidade(Number(e.target.value))}
                          className="w-24"
                        />
                      </div>
                      <Button onClick={gerarCodigo} disabled={loading}>
                        <KeyRound className="h-4 w-4" />
                        Gerar Codigo
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Etapa: Código gerado */}
      {etapa === "codigo" && (
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="mb-2 text-sm text-muted-foreground">
              Codigo de validacao para emprestimo
            </p>
            <div className="mb-4 inline-block rounded-lg border-2 border-dashed border-primary/40 bg-primary/5 px-8 py-4">
              <span className="font-mono text-4xl font-bold tracking-[0.5em] text-primary">
                {codigo}
              </span>
            </div>
            <p className="mb-1 text-sm text-muted-foreground">
              Funcionario: <strong>{funcionario?.nome}</strong>
            </p>
            <p className="mb-4 text-sm text-muted-foreground">
              Quantidade: <strong>{quantidade} kit(s)</strong>
            </p>

            <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground mb-4">
              <Loader2 className="h-3 w-3 animate-spin" />
              Aguardando solicitante visualizar o codigo...
            </div>

            <div className="flex justify-center gap-3">
              <Button onClick={confirmar} variant="success" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Confirmar Emprestimo
              </Button>
              <Button onClick={cancelar} variant="destructive">
                <XCircle className="h-4 w-4" />
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Etapa: Resultado */}
      {etapa === "resultado" && resultado && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-sm text-muted-foreground">
              {resultado.sucesso ? "Emprestimo finalizado." : "Operacao cancelada."}
            </p>
            <div className="mt-4 flex justify-center">
              <Button onClick={reset} variant="outline">
                <RefreshCw className="h-4 w-4" />
                Nova Operacao
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
  const [codigo, setCodigo] = useState("");
  const [etapa, setEtapa] = useState<Etapa>("busca");
  const [resultado, setResultado] = useState<{ sucesso: boolean; itens: string[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const { success, error, info } = useToast();
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const limparPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  useEffect(() => {
    return limparPolling;
  }, [limparPolling]);

  function reset() {
    setMatricula("");
    setFuncionario(null);
    setItens([]);
    setSelecionados(new Set());
    setCodigo("");
    setEtapa("busca");
    setResultado(null);
    limparPolling();
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

  async function gerarCodigo() {
    if (selecionados.size === 0) return;
    setLoading(true);
    try {
      const itemCodigos = Array.from(selecionados);
      const data = await api.post<{ codigo: string }>("/ops/gerar-codigo", {
        matricula: matricula.trim(),
        tipo: "devolucao",
        quantidade: itemCodigos.length,
        item_codigos: itemCodigos,
      });
      setCodigo(data.codigo);
      setEtapa("codigo");
    } catch (err) {
      error(err instanceof Error ? err.message : "Erro ao gerar codigo");
    } finally {
      setLoading(false);
    }
  }

  async function confirmar() {
    setLoading(true);
    try {
      const data = await api.post<{ sucesso: boolean; itens_devolvidos: string[] }>(
        "/ops/confirmar",
        {
          matricula: matricula.trim(),
          tipo: "devolucao",
          codigo,
        },
      );
      limparPolling();
      setResultado({ sucesso: true, itens: data.itens_devolvidos });
      setEtapa("resultado");
      success(`Devolucao realizada: ${data.itens_devolvidos.join(", ")}`);
    } catch (err) {
      error(err instanceof Error ? err.message : "Erro ao confirmar");
    } finally {
      setLoading(false);
    }
  }

  async function cancelar() {
    try {
      await api.post("/ops/cancelar", {
        matricula: matricula.trim(),
        tipo: "devolucao",
      });
    } catch {
      // ignore
    }
    limparPolling();
    setResultado({ sucesso: false, itens: [] });
    setEtapa("resultado");
    info("Operacao cancelada");
  }

  useEffect(() => {
    if (etapa !== "codigo") return;
    pollingRef.current = setInterval(async () => {
      try {
        await api.get(`/ops/status-setor/${matricula.trim()}`);
      } catch {
        // ignore
      }
    }, 3000);
    return limparPolling;
  }, [etapa, matricula, limparPolling]);

  return (
    <div className="space-y-4">
      {/* Etapa: Busca */}
      {etapa === "busca" && (
        <>
          <div className="flex gap-2">
            <div className="flex-1 space-y-2">
              <Label htmlFor="mat-dev">Matricula do funcionario</Label>
              <Input
                id="mat-dev"
                placeholder="Digite a matricula"
                value={matricula}
                onChange={(e) => setMatricula(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && buscarFuncionario()}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={buscarFuncionario} disabled={loading || !matricula.trim()}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Buscar
              </Button>
            </div>
          </div>

          {funcionario && (
            <Card className="border-blue-200 bg-blue-50/50">
              <CardContent className="pt-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Nome:</span>{" "}
                    <span className="font-medium">{funcionario.nome}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Setor:</span>{" "}
                    <span className="font-medium">{funcionario.setor}</span>
                  </div>
                </div>

                <Separator className="my-3" />

                {itens.length === 0 ? (
                  <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    Nenhum item emprestado para este funcionario.
                  </div>
                ) : (
                  <>
                    <p className="mb-2 text-sm font-medium text-muted-foreground">
                      Selecione os itens a devolver:
                    </p>
                    <div className="space-y-2 rounded-md border p-3">
                      {itens.map((item) => (
                        <label
                          key={item.codigo}
                          className="flex cursor-pointer items-center gap-3 rounded-md p-2 hover:bg-accent"
                        >
                          <Checkbox
                            checked={selecionados.has(item.codigo)}
                            onCheckedChange={() => toggleItem(item.codigo)}
                          />
                          <span className="font-mono text-sm font-semibold text-primary">
                            {item.codigo}
                          </span>
                          <span className="text-sm text-muted-foreground">{item.descricao}</span>
                        </label>
                      ))}
                    </div>
                    <div className="mt-3 flex justify-end">
                      <Button onClick={gerarCodigo} disabled={loading || selecionados.size === 0}>
                        <KeyRound className="h-4 w-4" />
                        Gerar Codigo ({selecionados.size} item{selecionados.size !== 1 ? "s" : ""})
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Etapa: Código gerado */}
      {etapa === "codigo" && (
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="mb-2 text-sm text-muted-foreground">
              Codigo de validacao para devolucao
            </p>
            <div className="mb-4 inline-block rounded-lg border-2 border-dashed border-primary/40 bg-primary/5 px-8 py-4">
              <span className="font-mono text-4xl font-bold tracking-[0.5em] text-primary">
                {codigo}
              </span>
            </div>
            <p className="mb-1 text-sm text-muted-foreground">
              Funcionario: <strong>{funcionario?.nome}</strong>
            </p>
            <p className="mb-4 text-sm text-muted-foreground">
              Itens: <strong>{Array.from(selecionados).join(", ")}</strong>
            </p>

            <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground mb-4">
              <Loader2 className="h-3 w-3 animate-spin" />
              Aguardando solicitante visualizar o codigo...
            </div>

            <div className="flex justify-center gap-3">
              <Button onClick={confirmar} variant="success" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Confirmar Devolucao
              </Button>
              <Button onClick={cancelar} variant="destructive">
                <XCircle className="h-4 w-4" />
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Etapa: Resultado */}
      {etapa === "resultado" && resultado && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-sm text-muted-foreground">
              {resultado.sucesso ? "Devolucao finalizada." : "Operacao cancelada."}
            </p>
            <div className="mt-4 flex justify-center">
              <Button onClick={reset} variant="outline">
                <RefreshCw className="h-4 w-4" />
                Nova Operacao
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
    <div className="flex min-h-dvh flex-col bg-background">
      <Header />
      <main className="mx-auto w-full max-w-3xl flex-1 p-4 sm:p-6">
        <Card className="border-border/80 bg-white/86 dark:bg-slate-900/55">
          <CardHeader>
            <CardTitle className="text-xl">Operacoes</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="emprestimo">
              <TabsList className="w-full">
                <TabsTrigger value="emprestimo" className="flex-1 gap-1.5">
                  <Package className="h-4 w-4" />
                  Emprestimo
                </TabsTrigger>
                <TabsTrigger value="devolucao" className="flex-1 gap-1.5">
                  <Undo2 className="h-4 w-4" />
                  Devolucao
                </TabsTrigger>
              </TabsList>
              <TabsContent value="emprestimo">
                <EmprestimoTab />
              </TabsContent>
              <TabsContent value="devolucao">
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
