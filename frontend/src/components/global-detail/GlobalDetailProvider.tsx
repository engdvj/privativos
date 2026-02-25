/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Loader2, Save } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ItemStatus } from "@/pages/admin/types";

interface HistoricoEvento {
  timestamp: string;
  matricula: string;
  nome_funcionario: string;
  item_codigo: string;
  operador_nome: string;
}

interface BuscaKitResponse {
  tipo: "kit";
  consulta: string;
  kit: {
    codigo: string;
    descricao: string;
    status: ItemStatus;
    status_ativo: boolean;
    solicitante_matricula: string | null;
    data_emprestimo: string | null;
  };
  historico: {
    solicitacoes: HistoricoEvento[];
    devolucoes: HistoricoEvento[];
  };
}

interface BuscaFuncionarioResponse {
  tipo: "funcionario";
  consulta: string;
  funcionario: {
    matricula: string;
    nome: string;
    setor: string;
    funcao: string;
    status_ativo: boolean;
  };
  itens_emprestados: Array<{
    codigo: string;
    descricao: string;
    data_emprestimo: string | null;
  }>;
  historico: {
    solicitacoes: HistoricoEvento[];
    devolucoes: HistoricoEvento[];
  };
}

interface BuscaSugestoesResponse {
  tipo: "sugestoes_funcionario";
  consulta: string;
  sugestoes: Array<{
    matricula: string;
    nome: string;
    setor: string;
    funcao: string;
  }>;
}

interface BuscaNaoEncontradoResponse {
  tipo: "nao_encontrado";
  consulta: string;
}

type BuscaGlobalResponse =
  | BuscaKitResponse
  | BuscaFuncionarioResponse
  | BuscaSugestoesResponse
  | BuscaNaoEncontradoResponse;

interface CatalogoRow {
  id: number;
  nome: string;
  statusAtivo: boolean;
}

interface FuncionarioEditDraft {
  nome: string;
  setor: string;
  funcao: string;
  status_ativo: boolean;
}

interface KitEditDraft {
  descricao: string;
  status: ItemStatus;
  status_ativo: boolean;
}

interface HistoricoDetalhesResponse {
  pagina: number;
  limite: number;
  total: number;
  ciclos: HistoricoCiclo[];
}

interface HistoricoCiclo {
  matricula: string;
  nome_funcionario: string;
  item_codigo: string;
  saida_em: string | null;
  saida_operador: string | null;
  entrada_em: string | null;
  entrada_operador: string | null;
  duracao_horas: number | null;
  em_aberto: boolean;
}

interface GlobalDetailContextValue {
  openByQuery: (query: string) => Promise<void>;
  openFuncionario: (matricula: string) => Promise<void>;
  openKit: (codigo: string) => Promise<void>;
}

const GlobalDetailContext = createContext<GlobalDetailContextValue | null>(null);

function formatDateTime(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-BR");
}

function statusKitLabel(status: ItemStatus) {
  if (status === "disponivel") return "Disponivel";
  if (status === "emprestado") return "Emprestado";
  return "Inativo";
}

function statusKitVariant(status: ItemStatus): "default" | "secondary" | "destructive" {
  if (status === "disponivel") return "secondary";
  if (status === "emprestado") return "default";
  return "destructive";
}

function formatDuracaoHoras(horas: number | null) {
  if (horas === null || Number.isNaN(horas)) return "-";
  const totalMinutos = Math.max(0, Math.round(horas * 60));
  const horasInteiras = Math.floor(totalMinutos / 60);
  const minutos = totalMinutos % 60;
  return `${horasInteiras}h ${minutos}m`;
}

function montarCiclosHistorico(
  solicitacoes: HistoricoEvento[],
  devolucoes: HistoricoEvento[],
): HistoricoCiclo[] {
  const pendentes = new Map<string, HistoricoEvento[]>();
  const ciclos: HistoricoCiclo[] = [];

  const eventos = [
    ...solicitacoes.map((evento) => ({ tipo: "saida" as const, evento })),
    ...devolucoes.map((evento) => ({ tipo: "entrada" as const, evento })),
  ].sort((a, b) => new Date(a.evento.timestamp).getTime() - new Date(b.evento.timestamp).getTime());

  for (const item of eventos) {
    const key = `${item.evento.item_codigo}::${item.evento.matricula}`;
    if (item.tipo === "saida") {
      const fila = pendentes.get(key) ?? [];
      fila.push(item.evento);
      pendentes.set(key, fila);
      continue;
    }

    const fila = pendentes.get(key) ?? [];
    const saida = fila.shift();
    if (fila.length > 0) {
      pendentes.set(key, fila);
    } else {
      pendentes.delete(key);
    }

    if (!saida) continue;

    const duracaoMs = new Date(item.evento.timestamp).getTime() - new Date(saida.timestamp).getTime();
    ciclos.push({
      matricula: saida.matricula,
      nome_funcionario: saida.nome_funcionario,
      item_codigo: saida.item_codigo,
      saida_em: saida.timestamp,
      saida_operador: saida.operador_nome,
      entrada_em: item.evento.timestamp,
      entrada_operador: item.evento.operador_nome,
      duracao_horas: duracaoMs >= 0 ? Number((duracaoMs / 3_600_000).toFixed(2)) : null,
      em_aberto: false,
    });
  }

  for (const fila of pendentes.values()) {
    for (const saida of fila) {
      ciclos.push({
        matricula: saida.matricula,
        nome_funcionario: saida.nome_funcionario,
        item_codigo: saida.item_codigo,
        saida_em: saida.timestamp,
        saida_operador: saida.operador_nome,
        entrada_em: null,
        entrada_operador: null,
        duracao_horas: null,
        em_aberto: true,
      });
    }
  }

  return ciclos.sort((a, b) => {
    const aTime = a.saida_em ? new Date(a.saida_em).getTime() : 0;
    const bTime = b.saida_em ? new Date(b.saida_em).getTime() : 0;
    return bTime - aTime;
  });
}

function canEditInModal() {
  const perfil = api.getPerfil();
  return perfil === "admin" || perfil === "superadmin";
}

export function GlobalDetailProvider({ children }: { children: ReactNode }) {
  const { success, error } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [erroBusca, setErroBusca] = useState<string | null>(null);
  const [resultado, setResultado] = useState<BuscaGlobalResponse | null>(null);
  const [lastQuery, setLastQuery] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [setores, setSetores] = useState<CatalogoRow[]>([]);
  const [funcoes, setFuncoes] = useState<CatalogoRow[]>([]);
  const [draftFuncionario, setDraftFuncionario] = useState<FuncionarioEditDraft>({
    nome: "",
    setor: "",
    funcao: "",
    status_ativo: true,
  });
  const [draftKit, setDraftKit] = useState<KitEditDraft>({
    descricao: "",
    status: "disponivel",
    status_ativo: true,
  });
  const [historicoModalOpen, setHistoricoModalOpen] = useState(false);
  const [historicoPagina, setHistoricoPagina] = useState(1);
  const [historicoLimite] = useState(20);
  const [historicoTotal, setHistoricoTotal] = useState(0);
  const [historicoCiclos, setHistoricoCiclos] = useState<HistoricoCiclo[]>([]);
  const [historicoLoading, setHistoricoLoading] = useState(false);

  const hydrateDraftFromResult = useCallback((data: BuscaGlobalResponse) => {
    if (data.tipo === "funcionario") {
      setDraftFuncionario({
        nome: data.funcionario.nome,
        setor: data.funcionario.setor,
        funcao: data.funcionario.funcao,
        status_ativo: data.funcionario.status_ativo,
      });
    }
    if (data.tipo === "kit") {
      setDraftKit({
        descricao: data.kit.descricao,
        status: data.kit.status,
        status_ativo: data.kit.status_ativo,
      });
    }
  }, []);

  const ensureCatalogos = useCallback(async () => {
    if (setores.length > 0 && funcoes.length > 0) return;
    const [setoresData, funcoesData] = await Promise.all([
      api.get<CatalogoRow[]>("/admin/setores"),
      api.get<CatalogoRow[]>("/admin/funcoes"),
    ]);
    setSetores(setoresData.filter((row) => row.statusAtivo));
    setFuncoes(funcoesData.filter((row) => row.statusAtivo));
  }, [setores.length, funcoes.length]);

  const fetchByQuery = useCallback(
    async (query: string) => {
      const normalized = query.trim();
      if (!normalized) return;

      setOpen(true);
      setLoading(true);
      setErroBusca(null);
      setEditMode(false);
      setResultado(null);

      try {
        const data = await api.get<BuscaGlobalResponse>(
          `/ops/busca-global?q=${encodeURIComponent(normalized)}`,
        );
        setLastQuery(normalized);
        setResultado(data);
        hydrateDraftFromResult(data);
      } catch (err) {
        setErroBusca(err instanceof Error ? err.message : "Falha ao realizar a busca");
      } finally {
        setLoading(false);
      }
    },
    [hydrateDraftFromResult],
  );

  const openByQuery = useCallback(
    async (query: string) => {
      await fetchByQuery(query);
    },
    [fetchByQuery],
  );

  const openFuncionario = useCallback(
    async (matricula: string) => {
      await fetchByQuery(matricula);
    },
    [fetchByQuery],
  );

  const openKit = useCallback(
    async (codigo: string) => {
      await fetchByQuery(codigo);
    },
    [fetchByQuery],
  );

  const handleClose = useCallback(() => {
    setOpen(false);
    setEditMode(false);
    setHistoricoModalOpen(false);
  }, []);

  const handleEnableEdit = useCallback(async () => {
    if (!resultado || !canEditInModal()) return;
    if (resultado.tipo === "funcionario") {
      try {
        await ensureCatalogos();
      } catch (err) {
        error(err instanceof Error ? err.message : "Erro ao carregar catalogos");
        return;
      }
    }
    setEditMode(true);
  }, [resultado, ensureCatalogos, error]);

  const refreshCurrent = useCallback(async () => {
    if (!lastQuery) return;
    await fetchByQuery(lastQuery);
  }, [fetchByQuery, lastQuery]);

  const handleSave = useCallback(async () => {
    if (!resultado || !editMode) return;

    setSaving(true);
    try {
      let entidadeAtualizada: "funcionario" | "kit" | null = null;
      if (resultado.tipo === "funcionario") {
        if (!draftFuncionario.nome.trim() || !draftFuncionario.setor.trim() || !draftFuncionario.funcao.trim()) {
          error("Preencha nome, setor e funcao");
          return;
        }
        await api.put(`/admin/funcionarios/${resultado.funcionario.matricula}`, {
          nome: draftFuncionario.nome.trim(),
          setor: draftFuncionario.setor,
          funcao: draftFuncionario.funcao,
          status_ativo: draftFuncionario.status_ativo,
        });
        entidadeAtualizada = "funcionario";
        success("Funcionario atualizado");
      }

      if (resultado.tipo === "kit") {
        if (!draftKit.descricao.trim()) {
          error("Informe a descricao do item");
          return;
        }
        await api.put(`/admin/itens/${resultado.kit.codigo}`, {
          descricao: draftKit.descricao.trim(),
          status: draftKit.status,
          status_ativo: draftKit.status_ativo,
        });
        entidadeAtualizada = "kit";
        success("Item atualizado");
      }

      setEditMode(false);
      await refreshCurrent();
      if (entidadeAtualizada) {
        window.dispatchEvent(
          new CustomEvent("global-detail-updated", { detail: { entidade: entidadeAtualizada } }),
        );
      }
    } catch (err) {
      error(err instanceof Error ? err.message : "Erro ao salvar alteracoes");
    } finally {
      setSaving(false);
    }
  }, [resultado, editMode, draftFuncionario, draftKit, error, success, refreshCurrent]);

  const historicoTarget = useMemo(() => {
    if (!resultado) return null;
    if (resultado.tipo === "funcionario") {
      return { entidade: "funcionario" as const, id: resultado.funcionario.matricula };
    }
    if (resultado.tipo === "kit") {
      return { entidade: "kit" as const, id: resultado.kit.codigo };
    }
    return null;
  }, [resultado]);

  const carregarHistoricoDetalhado = useCallback(
    async (pagina: number) => {
      if (!historicoTarget) return;
      setHistoricoLoading(true);
      try {
        const payload = await api.get<HistoricoDetalhesResponse>(
          `/ops/historico-detalhes?entidade=${historicoTarget.entidade}&id=${encodeURIComponent(historicoTarget.id)}&pagina=${pagina}&limite=${historicoLimite}`,
        );
        setHistoricoCiclos(payload.ciclos);
        setHistoricoTotal(payload.total);
      } catch (err) {
        error(err instanceof Error ? err.message : "Erro ao carregar historico detalhado");
      } finally {
        setHistoricoLoading(false);
      }
    },
    [historicoTarget, historicoLimite, error],
  );

  const abrirHistoricoDetalhado = useCallback(async () => {
    setHistoricoPagina(1);
    setHistoricoModalOpen(true);
  }, []);

  useEffect(() => {
    if (!historicoModalOpen) return;
    void carregarHistoricoDetalhado(historicoPagina);
  }, [historicoModalOpen, historicoPagina, carregarHistoricoDetalhado]);

  useEffect(() => {
    setHistoricoModalOpen(false);
    setHistoricoCiclos([]);
    setHistoricoTotal(0);
    setHistoricoPagina(1);
  }, [resultado]);

  const ciclosRecentes = useMemo(() => {
    if (!resultado || (resultado.tipo !== "funcionario" && resultado.tipo !== "kit")) {
      return [];
    }
    return montarCiclosHistorico(resultado.historico.solicitacoes, resultado.historico.devolucoes).slice(0, 5);
  }, [resultado]);

  const contextValue = useMemo<GlobalDetailContextValue>(
    () => ({
      openByQuery,
      openFuncionario,
      openKit,
    }),
    [openByQuery, openFuncionario, openKit],
  );

  return (
    <GlobalDetailContext.Provider value={contextValue}>
      {children}
      <Modal
        open={open}
        title={resultado ? `Detalhes: ${resultado.consulta}` : "Detalhes"}
        onClose={handleClose}
      >
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Buscando informacoes...
          </div>
        )}

        {!loading && erroBusca && (
          <div className="rounded-md border border-destructive/45 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {erroBusca}
          </div>
        )}

        {!loading && !erroBusca && resultado?.tipo === "nao_encontrado" && (
          <div className="rounded-md border border-border/70 bg-muted/35 px-3 py-2 text-sm text-muted-foreground">
            Nenhum kit, usuario ou matricula encontrado para: <strong>{resultado.consulta}</strong>.
          </div>
        )}

        {!loading && !erroBusca && resultado?.tipo === "sugestoes_funcionario" && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Foram encontrados varios usuarios para <strong>{resultado.consulta}</strong>. Selecione um:
            </p>
            <div className="space-y-2">
              {resultado.sugestoes.map((sugestao) => (
                <button
                  key={sugestao.matricula}
                  type="button"
                  className="w-full rounded-md border border-border/70 px-3 py-2 text-left transition-colors hover:bg-muted/40"
                  onClick={() => {
                    void openFuncionario(sugestao.matricula);
                  }}
                >
                  <div className="font-medium">{sugestao.nome}</div>
                  <div className="text-sm text-muted-foreground">
                    Matricula {sugestao.matricula} | {sugestao.setor} | {sugestao.funcao}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {!loading && !erroBusca && resultado?.tipo === "kit" && (
          <div className="space-y-3">
            {!editMode ? (
              <div className="rounded-md border border-border/70 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-lg font-semibold text-primary">{resultado.kit.codigo}</span>
                  <Badge variant={statusKitVariant(resultado.kit.status)}>
                    {statusKitLabel(resultado.kit.status)}
                  </Badge>
                  {!resultado.kit.status_ativo && <Badge variant="destructive">Inativo no cadastro</Badge>}
                </div>
                <p className="mt-2 text-sm">{resultado.kit.descricao}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Matricula atual: {resultado.kit.solicitante_matricula ?? "-"} | Data emprestimo:{" "}
                  {formatDateTime(resultado.kit.data_emprestimo)}
                </p>
              </div>
            ) : (
              <div className="space-y-3 rounded-md border border-border/70 p-3">
                <div className="space-y-1">
                  <Label htmlFor="detalhe-kit-descricao">Descricao</Label>
                  <Input
                    id="detalhe-kit-descricao"
                    value={draftKit.descricao}
                    onChange={(event) =>
                      setDraftKit((prev) => ({ ...prev, descricao: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="detalhe-kit-status">Status</Label>
                  <Select
                    value={draftKit.status}
                    onValueChange={(value) =>
                      setDraftKit((prev) => ({ ...prev, status: value as ItemStatus }))
                    }
                  >
                    <SelectTrigger id="detalhe-kit-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="disponivel">disponivel</SelectItem>
                      <SelectItem value="emprestado">emprestado</SelectItem>
                      <SelectItem value="inativo">inativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Checkbox
                    checked={draftKit.status_ativo}
                    onCheckedChange={(checked) =>
                      setDraftKit((prev) => ({ ...prev, status_ativo: Boolean(checked) }))
                    }
                  />
                  Ativo
                </label>
              </div>
            )}

            <div className="space-y-2 rounded-md border border-border/70 p-3">
              <p className="text-sm font-semibold">Historico recente (saida x entrada)</p>
              <HistoricoCiclosSection ciclos={ciclosRecentes} />
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void abrirHistoricoDetalhado();
                  }}
                >
                  Ver historico completo
                </Button>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              {canEditInModal() && !editMode && (
                <Button variant="outline" onClick={() => void handleEnableEdit()}>
                  Editar
                </Button>
              )}
              {canEditInModal() && editMode && (
                <>
                  <Button variant="outline" onClick={() => setEditMode(false)} disabled={saving}>
                    Cancelar
                  </Button>
                  <Button onClick={() => void handleSave()} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Salvar
                  </Button>
                </>
              )}
            </div>
          </div>
        )}

        {!loading && !erroBusca && resultado?.tipo === "funcionario" && (
          <div className="space-y-3">
            {!editMode ? (
              <div className="rounded-md border border-border/70 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{resultado.funcionario.nome}</span>
                  <Badge variant="outline">Matricula {resultado.funcionario.matricula}</Badge>
                  <Badge variant={resultado.funcionario.status_ativo ? "secondary" : "destructive"}>
                    {resultado.funcionario.status_ativo ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Setor: {resultado.funcionario.setor} | Funcao: {resultado.funcionario.funcao}
                </p>
              </div>
            ) : (
              <div className="space-y-3 rounded-md border border-border/70 p-3">
                <div className="space-y-1">
                  <Label htmlFor="detalhe-func-nome">Nome</Label>
                  <Input
                    id="detalhe-func-nome"
                    value={draftFuncionario.nome}
                    onChange={(event) =>
                      setDraftFuncionario((prev) => ({ ...prev, nome: event.target.value }))
                    }
                  />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="detalhe-func-setor">Setor</Label>
                    <Select
                      value={draftFuncionario.setor}
                      onValueChange={(value) =>
                        setDraftFuncionario((prev) => ({ ...prev, setor: value }))
                      }
                    >
                      <SelectTrigger id="detalhe-func-setor">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {setores.map((setor) => (
                          <SelectItem key={setor.id} value={setor.nome}>
                            {setor.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="detalhe-func-funcao">Funcao</Label>
                    <Select
                      value={draftFuncionario.funcao}
                      onValueChange={(value) =>
                        setDraftFuncionario((prev) => ({ ...prev, funcao: value }))
                      }
                    >
                      <SelectTrigger id="detalhe-func-funcao">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {funcoes.map((funcao) => (
                          <SelectItem key={funcao.id} value={funcao.nome}>
                            {funcao.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Checkbox
                    checked={draftFuncionario.status_ativo}
                    onCheckedChange={(checked) =>
                      setDraftFuncionario((prev) => ({ ...prev, status_ativo: Boolean(checked) }))
                    }
                  />
                  Ativo
                </label>
              </div>
            )}

            <div className="space-y-2 rounded-md border border-border/70 p-3">
              <p className="text-sm font-semibold">Kits em uso</p>
              {resultado.itens_emprestados.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum kit emprestado no momento.</p>
              ) : (
                <div className="space-y-2">
                  {resultado.itens_emprestados.map((item) => (
                    <button
                      key={item.codigo}
                      type="button"
                      className="w-full rounded-md border border-border/60 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/40"
                      onClick={() => {
                        void openKit(item.codigo);
                      }}
                    >
                      <div className="font-mono font-semibold text-primary">{item.codigo}</div>
                      <div>{item.descricao}</div>
                      <div className="text-xs text-muted-foreground">
                        Emprestado em: {formatDateTime(item.data_emprestimo)}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2 rounded-md border border-border/70 p-3">
              <p className="text-sm font-semibold">Historico recente (saida x entrada)</p>
              <HistoricoCiclosSection ciclos={ciclosRecentes} />
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void abrirHistoricoDetalhado();
                  }}
                >
                  Ver historico completo
                </Button>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              {canEditInModal() && !editMode && (
                <Button variant="outline" onClick={() => void handleEnableEdit()}>
                  Editar
                </Button>
              )}
              {canEditInModal() && editMode && (
                <>
                  <Button variant="outline" onClick={() => setEditMode(false)} disabled={saving}>
                    Cancelar
                  </Button>
                  <Button onClick={() => void handleSave()} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Salvar
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </Modal>
      <Modal
        open={historicoModalOpen}
        title="Historico completo (ciclos)"
        onClose={() => setHistoricoModalOpen(false)}
      >
        <div className="space-y-3">
          {historicoLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando historico...
            </div>
          ) : historicoCiclos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum registro encontrado.</p>
          ) : (
            <HistoricoCiclosSection ciclos={historicoCiclos} />
          )}

          <div className="flex items-center justify-between border-t border-border/50 pt-3">
            <p className="text-xs text-muted-foreground">
              {historicoTotal === 0
                ? "0 ciclos"
                : `${(historicoPagina - 1) * historicoLimite + 1}-${Math.min(historicoPagina * historicoLimite, historicoTotal)} de ${historicoTotal}`}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setHistoricoPagina((prev) => Math.max(1, prev - 1))}
                disabled={historicoPagina === 1 || historicoLoading}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setHistoricoPagina((prev) =>
                    prev * historicoLimite >= historicoTotal ? prev : prev + 1,
                  )
                }
                disabled={historicoPagina * historicoLimite >= historicoTotal || historicoLoading}
              >
                Proxima
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </GlobalDetailContext.Provider>
  );
}

function HistoricoCiclosSection({ ciclos }: { ciclos: HistoricoCiclo[] }) {
  return (
    <div className="space-y-2">
      {ciclos.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum registro.</p>
      ) : (
        <div className="space-y-2">
          {ciclos.map((ciclo, index) => (
            <div
              key={`ciclo-${ciclo.item_codigo}-${ciclo.matricula}-${ciclo.saida_em ?? "sem-saida"}-${index}`}
              className="rounded-md border border-border/60 px-3 py-2 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono font-semibold text-primary">{ciclo.item_codigo}</span>
                  <span className="text-muted-foreground">{ciclo.nome_funcionario}</span>
                  <span className="text-muted-foreground">({ciclo.matricula})</span>
                </div>
                <Badge variant={ciclo.em_aberto ? "destructive" : "secondary"}>
                  {ciclo.em_aberto ? "Em aberto" : "Concluido"}
                </Badge>
              </div>
              <div className="mt-2 grid gap-1 text-xs text-muted-foreground">
                <div>
                  Saida: {formatDateTime(ciclo.saida_em)} | Operador: {ciclo.saida_operador ?? "-"}
                </div>
                <div>
                  Entrada: {formatDateTime(ciclo.entrada_em)} | Operador: {ciclo.entrada_operador ?? "-"}
                </div>
                <div>Tempo com kit: {formatDuracaoHoras(ciclo.duracao_horas)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function useGlobalDetail() {
  const context = useContext(GlobalDetailContext);
  if (!context) {
    throw new Error("useGlobalDetail must be used within GlobalDetailProvider");
  }
  return context;
}
