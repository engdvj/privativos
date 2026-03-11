import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DataTable,
  type DataTableColumn,
  type DataTableSortState,
  sortDataTableRows,
} from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar } from "@/components/ui/filter-bar";
import { FormField } from "@/components/ui/form-field";
import { SectionCard } from "@/components/ui/section-card";
import { StatusPill } from "@/components/ui/status-pill";
import { TableActions } from "@/components/ui/table-actions";
import { useToast } from "@/components/ui/use-toast";
import { useGlobalDetail } from "@/components/global-detail/GlobalDetailProvider";
import { Building2, Pencil, Plus, Save, Trash2 } from "lucide-react";
import type { CatalogoRow, FuncionarioRow } from "../types";

const SETORES_POR_PAGINA = 10;
const FUNCIONARIOS_POR_PAGINA = 10;

interface SetorFuncionariosResponse {
  pagina: number;
  limite: number;
  total: number;
  rows: FuncionarioRow[];
}

interface SetorItemEmprestadoRow {
  codigo: string;
  descricao: string | null;
  tipo: string;
  tamanho: string;
  status: "disponivel" | "emprestado" | "inativo";
  statusAtivo: boolean;
  solicitanteMatricula: string | null;
  setorSolicitante: string | null;
  dataEmprestimo: string | null;
}

const FILTRO_INPUT_CLASS =
  "h-8 rounded-xl border-border/80 bg-background/85 text-xs dark:border-border/90 dark:bg-background/70";
const FILTRO_SELECT_CLASS =
  "h-8 rounded-xl border-border/80 bg-background/85 text-xs dark:border-border/90 dark:bg-background/70";
const TABELA_CONTAINER_CLASS =
  "overflow-hidden border-border/65 bg-background/72 shadow-[var(--shadow-soft)] dark:border-border/85 dark:bg-background/58";
const TABELA_DENSE_CLASS = `${TABELA_CONTAINER_CLASS} [--table-inline-gap:0.95rem]`;
const FILTRO_BAR_CLASS = "gap-1.5 md:flex-nowrap md:items-end";
const SECTION_HEADER_CLASS = "gap-2 px-3 pb-2 pt-3 sm:px-4 sm:pb-2 sm:pt-4";
const SECTION_CONTENT_CLASS = "space-y-2.5 px-3 pb-3 pt-0 sm:px-4 sm:pb-4";

function notificarAtualizacaoGlobal(entidade: "kit" | "funcionario" | "setor" | "unidade" | "funcao") {
  window.dispatchEvent(new CustomEvent("global-detail-updated", { detail: { entidade } }));
}

function normalizarTexto(valor: string | null | undefined) {
  return (valor ?? "").trim().toLowerCase();
}

export function SetoresTab() {
  const [rows, setRows] = useState<CatalogoRow[]>([]);
  const [unidades, setUnidades] = useState<CatalogoRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [openCreateModal, setOpenCreateModal] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [busca, setBusca] = useState("");
  const [filtroUnidade, setFiltroUnidade] = useState("todos");
  const [filtroStatus, setFiltroStatus] = useState<"todos" | "ativo" | "inativo">("todos");
  const [paginaSetores, setPaginaSetores] = useState(1);
  const [sortSetores, setSortSetores] = useState<DataTableSortState>(null);
  const [nomeNovo, setNomeNovo] = useState("");
  const [unidadesNovo, setUnidadesNovo] = useState<string[]>([]);
  const [edicao, setEdicao] = useState({ nome: "", status_ativo: true, unidades: [] as string[] });
  const [setorParaExcluir, setSetorParaExcluir] = useState<CatalogoRow | null>(null);
  const [setorSelecionado, setSetorSelecionado] = useState<CatalogoRow | null>(null);
  const [funcionariosSetor, setFuncionariosSetor] = useState<FuncionarioRow[]>([]);
  const [totalFuncionariosSetor, setTotalFuncionariosSetor] = useState(0);
  const [paginaFuncionariosSetor, setPaginaFuncionariosSetor] = useState(1);
  const [loadingFuncionariosSetor, setLoadingFuncionariosSetor] = useState(false);
  const [itensEmprestadosSetor, setItensEmprestadosSetor] = useState<SetorItemEmprestadoRow[]>([]);
  const [loadingItensEmprestadosSetor, setLoadingItensEmprestadosSetor] = useState(false);
  const { success, error } = useToast();
  const { openFuncionario } = useGlobalDetail();

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const [setoresData, unidadesData] = await Promise.all([
        api.get<CatalogoRow[]>("/admin/setores?include_inactive=true"),
        api.get<CatalogoRow[]>("/admin/unidades?include_inactive=true"),
      ]);
      setRows(setoresData);
      setUnidades(unidadesData);
    } catch (err) {
      error(err instanceof Error ? err.message : "Erro ao carregar setores");
    } finally {
      setLoading(false);
    }
  }, [error]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const unidadesAtivas = useMemo(() => unidades.filter((row) => row.statusAtivo), [unidades]);

  function unidadesSetor(row: CatalogoRow) {
    return row.unidades?.filter(Boolean) ?? [];
  }

  function unidadesSetorLabel(row: CatalogoRow) {
    const valores = unidadesSetor(row);
    return valores.join(", ") || "-";
  }

  const rowsFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return rows.filter((row) => {
      const matchTexto =
        !termo ||
        [row.nome, unidadesSetor(row).join(" "), row.statusAtivo ? "ativo" : "inativo"]
          .join(" ")
          .toLowerCase()
          .includes(termo);
      const matchUnidade = filtroUnidade === "todos" || unidadesSetor(row).includes(filtroUnidade);
      const matchStatus = filtroStatus === "todos" || (filtroStatus === "ativo" ? row.statusAtivo : !row.statusAtivo);
      return matchTexto && matchUnidade && matchStatus;
    });
  }, [rows, busca, filtroUnidade, filtroStatus]);
  const colunasSetores = useMemo<DataTableColumn<CatalogoRow>[]>(() => [
    { key: "nome", title: "Nome", width: "28%", sortValue: (row) => row.nome },
    { key: "unidades", title: "Unidades", width: "28%", sortValue: (row) => (row.unidades?.filter(Boolean) ?? []).join(", ") },
    {
      key: "total",
      title: "Total funcionários",
      align: "center",
      width: "16%",
      sortValue: (row) => row.totalFuncionarios ?? 0,
    },
    { key: "status", title: "Status", align: "center", width: "14%", sortValue: (row) => row.statusAtivo },
    { key: "acoes", title: "Acoes", align: "center", width: "14%" },
  ], []);
  const rowsOrdenadas = useMemo(
    () => sortDataTableRows(rowsFiltradas, colunasSetores, sortSetores),
    [rowsFiltradas, colunasSetores, sortSetores],
  );

  const ativosFiltrados = useMemo(
    () => rowsFiltradas.filter((row) => row.statusAtivo).length,
    [rowsFiltradas],
  );
  const inativosFiltrados = rowsFiltradas.length - ativosFiltrados;
  const totalPaginasSetores = Math.max(1, Math.ceil(rowsOrdenadas.length / SETORES_POR_PAGINA));
  const rowsPaginadas = useMemo(() => {
    const inicio = (paginaSetores - 1) * SETORES_POR_PAGINA;
    return rowsOrdenadas.slice(inicio, inicio + SETORES_POR_PAGINA);
  }, [rowsOrdenadas, paginaSetores]);
  const inicioPaginaSetores = rowsOrdenadas.length === 0 ? 0 : (paginaSetores - 1) * SETORES_POR_PAGINA + 1;
  const fimPaginaSetores = Math.min(paginaSetores * SETORES_POR_PAGINA, rowsOrdenadas.length);

  useEffect(() => {
    setPaginaSetores(1);
  }, [busca, filtroUnidade, filtroStatus]);

  useEffect(() => {
    if (paginaSetores > totalPaginasSetores) {
      setPaginaSetores(totalPaginasSetores);
    }
  }, [paginaSetores, totalPaginasSetores]);

  const carregarFuncionariosSetor = useCallback(async () => {
    if (!setorSelecionado) {
      return;
    }

    setLoadingFuncionariosSetor(true);
    try {
      const query = new URLSearchParams({
        pagina: String(paginaFuncionariosSetor),
        limite: String(FUNCIONARIOS_POR_PAGINA),
        include_inactive: "true",
      });
      const data = await api.get<SetorFuncionariosResponse>(
        `/admin/setores/${setorSelecionado.id}/funcionarios?${query.toString()}`,
      );
      setFuncionariosSetor(data.rows);
      setTotalFuncionariosSetor(data.total);
    } catch (err) {
      error(err instanceof Error ? err.message : "Erro ao carregar funcionários do setor");
    } finally {
      setLoadingFuncionariosSetor(false);
    }
  }, [error, paginaFuncionariosSetor, setorSelecionado]);

  useEffect(() => {
    if (!setorSelecionado) return;
    void carregarFuncionariosSetor();
  }, [setorSelecionado, paginaFuncionariosSetor, carregarFuncionariosSetor]);

  const carregarItensEmprestadosSetor = useCallback(async () => {
    if (!setorSelecionado) {
      return;
    }

    setLoadingItensEmprestadosSetor(true);
    try {
      const itens = await api.get<SetorItemEmprestadoRow[]>("/admin/itens?include_inactive=true");
      const setorSelecionadoNormalizado = normalizarTexto(setorSelecionado.nome);
      const filtrados = itens
        .filter((item) =>
          item.status === "emprestado"
          && item.statusAtivo
          && normalizarTexto(item.setorSolicitante) === setorSelecionadoNormalizado,
        )
        .sort((a, b) => a.codigo.localeCompare(b.codigo));
      setItensEmprestadosSetor(filtrados);
    } catch (err) {
      error(err instanceof Error ? err.message : "Erro ao carregar itens emprestados do setor");
    } finally {
      setLoadingItensEmprestadosSetor(false);
    }
  }, [error, setorSelecionado]);

  useEffect(() => {
    if (!setorSelecionado) return;
    void carregarItensEmprestadosSetor();
  }, [setorSelecionado, carregarItensEmprestadosSetor]);

  const totalPaginasFuncionariosSetor = Math.max(
    1,
    Math.ceil(totalFuncionariosSetor / FUNCIONARIOS_POR_PAGINA),
  );
  const inicioFuncionariosSetor =
    totalFuncionariosSetor === 0
      ? 0
      : (paginaFuncionariosSetor - 1) * FUNCIONARIOS_POR_PAGINA + 1;
  const fimFuncionariosSetor = Math.min(
    paginaFuncionariosSetor * FUNCIONARIOS_POR_PAGINA,
    totalFuncionariosSetor,
  );

  useEffect(() => {
    if (paginaFuncionariosSetor > totalPaginasFuncionariosSetor) {
      setPaginaFuncionariosSetor(totalPaginasFuncionariosSetor);
    }
  }, [paginaFuncionariosSetor, totalPaginasFuncionariosSetor]);

  useEffect(() => {
    if (filtroUnidade === "todos") {
      return;
    }
    if (!unidades.some((row) => row.nome === filtroUnidade)) {
      setFiltroUnidade("todos");
    }
  }, [filtroUnidade, unidades]);

  function abrirFuncionariosSetor(row: CatalogoRow) {
    setSetorSelecionado(row);
    setPaginaFuncionariosSetor(1);
    setFuncionariosSetor([]);
    setTotalFuncionariosSetor(0);
    setItensEmprestadosSetor([]);
  }

  async function criar() {
    if (!nomeNovo.trim()) {
      error("Informe o nome do setor");
      return;
    }
    if (unidadesNovo.length === 0) {
      error("Selecione ao menos uma unidade para o setor");
      return;
    }

    setCreating(true);
    try {
      await api.post("/admin/setores", {
        nome: nomeNovo.trim(),
        unidades: unidadesNovo,
      });
      setNomeNovo("");
      setUnidadesNovo([]);
      setOpenCreateModal(false);
      success("Setor criado com sucesso");
      await carregar();
      notificarAtualizacaoGlobal("setor");
    } catch (err) {
      error(err instanceof Error ? err.message : "Erro ao criar setor");
    } finally {
      setCreating(false);
    }
  }

  function abrirEdicao(row: CatalogoRow) {
    const unidadesAtivasSetor = unidadesSetor(row).filter((nomeUnidade) =>
      unidadesAtivas.some((unidade) => unidade.nome === nomeUnidade),
    );

    setEditandoId(row.id);
    setEdicao({
      nome: row.nome,
      status_ativo: row.statusAtivo,
      unidades: unidadesAtivasSetor,
    });
  }

  function fecharEdicao() {
    setEditandoId(null);
    setEdicao({ nome: "", status_ativo: true, unidades: [] });
  }

  async function salvarEdicao() {
    if (!editandoId) return;
    if (!edicao.nome.trim()) {
      error("Informe o nome do setor");
      return;
    }
    if (edicao.unidades.length === 0) {
      error("Selecione ao menos uma unidade para o setor");
      return;
    }

    setSavingId(editandoId);
    try {
      await api.put(`/admin/setores/${editandoId}`, {
        nome: edicao.nome.trim(),
        unidades: edicao.unidades,
        status_ativo: edicao.status_ativo,
      });
      success("Setor atualizado");
      fecharEdicao();
      await carregar();
      notificarAtualizacaoGlobal("setor");
    } catch (err) {
      error(err instanceof Error ? err.message : "Erro ao atualizar setor");
    } finally {
      setSavingId(null);
    }
  }

  async function apagar(row: CatalogoRow) {
    try {
      await api.del(`/admin/setores/${row.id}`);
      success("Setor apagado");
      await carregar();
      notificarAtualizacaoGlobal("setor");
    } catch (err) {
      error(err instanceof Error ? err.message : "Erro ao apagar setor");
    }
  }

  function toggleUnidadeNovo(nomeUnidade: string, checked: boolean) {
    setUnidadesNovo((prev) => {
      if (checked) {
        if (prev.includes(nomeUnidade)) {
          return prev;
        }
        return [...prev, nomeUnidade];
      }
      return prev.filter((unidade) => unidade !== nomeUnidade);
    });
  }

  function toggleUnidadeEdicao(nomeUnidade: string, checked: boolean) {
    setEdicao((prev) => {
      if (checked) {
        if (prev.unidades.includes(nomeUnidade)) {
          return prev;
        }
        return {
          ...prev,
          unidades: [...prev.unidades, nomeUnidade],
        };
      }
      return {
        ...prev,
        unidades: prev.unidades.filter((unidade) => unidade !== nomeUnidade),
      };
    });
  }

  return (
    <div className="space-y-3">
      <SectionCard
        title={<span className="text-sm font-semibold">Setores</span>}
        icon={Building2}
        description={
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
            <span>Total: {rowsFiltradas.length}</span>
            <span>Ativos: {ativosFiltrados}</span>
            <span>Inativos: {inativosFiltrados}</span>
          </div>
        }
        className="border-border/70 bg-card/94 shadow-[var(--shadow-soft)] dark:border-border/85 dark:bg-card/90"
        headerClassName={SECTION_HEADER_CLASS}
        contentClassName={SECTION_CONTENT_CLASS}
        actions={
          <FilterBar className={FILTRO_BAR_CLASS}>
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar setor ou unidade"
              className={`${FILTRO_INPUT_CLASS} w-full sm:w-56`}
            />
            <Select value={filtroUnidade} onValueChange={setFiltroUnidade}>
              <SelectTrigger className={`${FILTRO_SELECT_CLASS} w-full sm:w-44`}>
                <SelectValue placeholder="Unidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas unidades</SelectItem>
                {unidades.map((unidade) => (
                  <SelectItem key={unidade.id} value={unidade.nome}>
                    {unidade.nome}
                    {unidade.statusAtivo ? "" : " (inativa)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filtroStatus} onValueChange={(value) => setFiltroStatus(value as "todos" | "ativo" | "inativo")}>
              <SelectTrigger className={`${FILTRO_SELECT_CLASS} w-full sm:w-36`}>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos status</SelectItem>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="inativo">Inativo</SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="icon"
              className="h-8 w-8 shrink-0 rounded-lg border-0 bg-primary text-primary-foreground shadow-[var(--shadow-soft)] transition-all duration-200 hover:bg-sky-500 hover:animate-pulse"
              onClick={() => setOpenCreateModal(true)}
              aria-label="Novo setor"
              title="Novo setor"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </FilterBar>
        }
      >
        <div className="hidden md:block">
          <DataTable
            columns={colunasSetores}
            rows={rowsPaginadas}
            sortState={sortSetores}
            onSortStateChange={setSortSetores}
            getRowKey={(row) => row.id}
            onRowClick={(row) => abrirFuncionariosSetor(row)}
            loading={loading}
            emptyMessage="Nenhum setor encontrado."
            minWidthClassName="min-w-[860px]"
            containerClassName={TABELA_DENSE_CLASS}
            renderRow={(row) => (
              <>
                <td className="max-w-0 truncate" title={row.nome}>{row.nome}</td>
                <td className="max-w-0 truncate" title={unidadesSetorLabel(row)}>{unidadesSetorLabel(row)}</td>
                <td>
                  <div className="text-center font-semibold">{row.totalFuncionarios ?? 0}</div>
                </td>
                <td>
                  <div className="flex justify-center">
                    <StatusPill tone={row.statusAtivo ? "success" : "danger"} className="text-[10px]">
                      {row.statusAtivo ? "ativo" : "inativo"}
                    </StatusPill>
                  </div>
                </td>
                <td>
                  <TableActions className="justify-center">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 rounded-lg"
                      onClick={() => abrirEdicao(row)}
                      aria-label={`Editar setor ${row.nome}`}
                      title="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/12 hover:text-destructive"
                      onClick={() => setSetorParaExcluir(row)}
                      aria-label={`Apagar setor ${row.nome}`}
                      title="Apagar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableActions>
                </td>
              </>
            )}
          />
        </div>

        <div className="space-y-2 md:hidden">
          {loading ? (
            Array.from({ length: 3 }).map((_, index) => (
              <div key={`setor-skeleton-${index}`} className="rounded-xl border border-border/70 bg-surface-2/80 p-3">
                <div className="h-3 w-28 animate-pulse rounded bg-muted/70" />
                <div className="mt-2 h-2.5 w-full animate-pulse rounded bg-muted/60" />
                <div className="mt-1.5 h-2.5 w-3/4 animate-pulse rounded bg-muted/45" />
              </div>
            ))
          ) : rowsFiltradas.length === 0 ? (
            <div className="rounded-xl border border-border/70 bg-surface-2/80 px-3 py-5">
              <EmptyState compact title="Nenhum setor encontrado." />
            </div>
          ) : (
            rowsPaginadas.map((row) => (
              <article
                key={row.id}
                className="rounded-xl border border-border/70 bg-surface-2/85 p-3 shadow-[var(--shadow-soft)]"
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    className="text-sm font-semibold text-primary underline-offset-2 hover:underline"
                    onClick={() => abrirFuncionariosSetor(row)}
                  >
                    {row.nome}
                  </button>
                  <StatusPill tone={row.statusAtivo ? "success" : "danger"} className="text-[10px]">
                    {row.statusAtivo ? "ativo" : "inativo"}
                  </StatusPill>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Funcionários vinculados: <span className="font-semibold text-foreground">{row.totalFuncionarios ?? 0}</span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Unidades: <span className="font-semibold text-foreground">{unidadesSetorLabel(row)}</span>
                </p>
                <div className="mt-2 flex justify-end gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-[11px]"
                    onClick={() => abrirFuncionariosSetor(row)}
                  >
                    Ver vinculados
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 rounded-lg"
                    onClick={() => abrirEdicao(row)}
                    aria-label={`Editar setor ${row.nome}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/12 hover:text-destructive"
                    onClick={() => setSetorParaExcluir(row)}
                    aria-label={`Apagar setor ${row.nome}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </article>
            ))
          )}
        </div>

        <div className="mt-1.5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[10px] text-muted-foreground">
            {inicioPaginaSetores}-{fimPaginaSetores} de {rowsFiltradas.length} | Página {paginaSetores} de {totalPaginasSetores}
          </p>
          <div className="flex min-w-[220px] justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 min-w-20 border-border/80 bg-background/85 text-[10px] dark:border-border/90 dark:bg-background/60 dark:hover:bg-accent/35"
              onClick={() => setPaginaSetores((paginaAtual) => Math.max(1, paginaAtual - 1))}
              disabled={paginaSetores === 1}
            >
              Anterior
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 min-w-20 border-border/80 bg-background/85 text-[10px] dark:border-border/90 dark:bg-background/60 dark:hover:bg-accent/35"
              onClick={() => setPaginaSetores((paginaAtual) => Math.min(totalPaginasSetores, paginaAtual + 1))}
              disabled={paginaSetores === totalPaginasSetores}
            >
              Próxima
            </Button>
          </div>
        </div>
      </SectionCard>

      <Modal
        open={Boolean(setorSelecionado)}
        onClose={() => setSetorSelecionado(null)}
        title={setorSelecionado ? `Funcionários vinculados - ${setorSelecionado.nome}` : "Funcionários vinculados"}
        description="Lista de funcionários associados e itens atualmente emprestados para este setor."
        maxWidthClassName="max-w-5xl"
      >
        <div className="space-y-4">
          <div className="space-y-2.5">
            <h4 className="text-sm font-semibold text-foreground">Funcionários vinculados</h4>
            <div className="text-[11px] text-muted-foreground">
              {inicioFuncionariosSetor}-{fimFuncionariosSetor} de {totalFuncionariosSetor} | Página{" "}
              {paginaFuncionariosSetor} de {totalPaginasFuncionariosSetor}
            </div>

            <div className="space-y-2">
              {loadingFuncionariosSetor ? (
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {Array.from({ length: 3 }).map((_, index) => (
                  <div key={`func-setor-skeleton-${index}`} className="rounded-xl border border-border/70 bg-surface-2/80 p-3">
                    <div className="h-3 w-20 animate-pulse rounded bg-muted/70" />
                    <div className="mt-2 h-2.5 w-full animate-pulse rounded bg-muted/60" />
                    <div className="mt-1.5 h-2.5 w-3/4 animate-pulse rounded bg-muted/45" />
                  </div>
                  ))}
                </div>
              ) : funcionariosSetor.length === 0 ? (
                <div className="rounded-xl border border-border/70 bg-surface-2/80 px-3 py-5">
                  <EmptyState compact title="Nenhum funcionário vinculado." />
                </div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {funcionariosSetor.map((row) => (
                    <button
                      type="button"
                      key={row.matricula}
                      className="rounded-xl border border-border/70 bg-surface-2/85 p-3 text-left shadow-[var(--shadow-soft)] transition-colors hover:bg-accent/20"
                      onClick={() => {
                        void openFuncionario(row.matricula);
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-mono text-sm font-semibold text-primary">
                          {row.matricula}
                        </span>
                        <StatusPill tone={row.statusAtivo ? "success" : "danger"} className="text-[10px]">
                          {row.statusAtivo ? "ativo" : "inativo"}
                        </StatusPill>
                      </div>
                      <p className="mt-1 text-sm font-medium text-foreground">{row.nome}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-[11px]"
                onClick={() => setPaginaFuncionariosSetor((prev) => Math.max(1, prev - 1))}
                disabled={paginaFuncionariosSetor === 1 || loadingFuncionariosSetor}
              >
                Anterior
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-[11px]"
                onClick={() =>
                  setPaginaFuncionariosSetor((prev) =>
                    Math.min(totalPaginasFuncionariosSetor, prev + 1),
                  )
                }
                disabled={paginaFuncionariosSetor >= totalPaginasFuncionariosSetor || loadingFuncionariosSetor}
              >
                Próxima
              </Button>
            </div>
          </div>

          <div className="space-y-2.5">
            <h4 className="text-sm font-semibold text-foreground">Itens emprestados para este setor</h4>
            <p className="text-[11px] text-muted-foreground">Total: {itensEmprestadosSetor.length}</p>

            <div className="space-y-2">
              {loadingItensEmprestadosSetor ? (
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div key={`item-setor-skeleton-${index}`} className="rounded-xl border border-border/70 bg-surface-2/80 p-3">
                      <div className="h-3 w-20 animate-pulse rounded bg-muted/70" />
                      <div className="mt-2 h-2.5 w-full animate-pulse rounded bg-muted/60" />
                      <div className="mt-1.5 h-2.5 w-3/4 animate-pulse rounded bg-muted/45" />
                    </div>
                  ))}
                </div>
              ) : itensEmprestadosSetor.length === 0 ? (
                <div className="rounded-xl border border-border/70 bg-surface-2/80 px-3 py-5">
                  <EmptyState compact title="Nenhum item emprestado." />
                </div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {itensEmprestadosSetor.map((row) => (
                    <article
                      key={row.codigo}
                      className="rounded-xl border border-border/70 bg-surface-2/85 p-3 shadow-[var(--shadow-soft)]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-mono text-sm font-semibold text-foreground">{row.codigo}</p>
                        <StatusPill tone="info" className="text-[10px]">emprestado</StatusPill>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={openCreateModal}
        onClose={() => {
          setOpenCreateModal(false);
          setNomeNovo("");
          setUnidadesNovo([]);
        }}
        title="Novo Setor"
        description="Crie um setor para classificar funcionários e operações."
        maxWidthClassName="max-w-xl"
      >
        <div className="space-y-3">
          <FormField label="Nome do setor" htmlFor="novo-setor-nome">
            <Input
              id="novo-setor-nome"
              value={nomeNovo}
              onChange={(e) => setNomeNovo(e.target.value)}
              placeholder="Nome do setor"
              className="h-9 text-xs"
            />
          </FormField>
          <FormField label="Unidades vinculadas">
            <div className="max-h-44 space-y-1.5 overflow-y-auto rounded-xl border border-border/70 bg-surface-2/80 p-2.5">
              {unidadesAtivas.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhuma unidade ativa encontrada.</p>
              ) : (
                unidadesAtivas.map((unidade) => (
                  <label
                    key={unidade.id}
                    className="flex items-center gap-2 rounded-lg px-1.5 py-1 text-xs hover:bg-accent/40"
                  >
                    <Checkbox
                      checked={unidadesNovo.includes(unidade.nome)}
                      onCheckedChange={(checked) =>
                        toggleUnidadeNovo(unidade.nome, Boolean(checked))
                      }
                    />
                    <span>{unidade.nome}</span>
                  </label>
                ))
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Selecionadas: {unidadesNovo.length}
            </p>
          </FormField>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              className="h-9 text-xs"
              onClick={() => {
                setOpenCreateModal(false);
                setNomeNovo("");
                setUnidadesNovo([]);
              }}
            >
              Cancelar
            </Button>
            <Button className="h-9 text-xs" onClick={criar} loading={creating}>
              <Plus className="h-4 w-4" />
              Criar
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(editandoId)}
        onClose={fecharEdicao}
        title="Editar Setor"
        description="Atualize nome, unidades vinculadas e status do setor."
        maxWidthClassName="max-w-xl"
      >
        <div className="space-y-3">
          <FormField label="Nome" htmlFor="edicao-setor-nome">
            <Input
              id="edicao-setor-nome"
              value={edicao.nome}
              onChange={(e) => setEdicao((p) => ({ ...p, nome: e.target.value }))}
              className="h-9 text-xs"
            />
          </FormField>
          <FormField label="Unidades vinculadas">
            <div className="max-h-44 space-y-1.5 overflow-y-auto rounded-xl border border-border/70 bg-surface-2/80 p-2.5">
              {unidadesAtivas.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhuma unidade ativa encontrada.</p>
              ) : (
                unidadesAtivas.map((unidade) => (
                  <label
                    key={unidade.id}
                    className="flex items-center gap-2 rounded-lg px-1.5 py-1 text-xs hover:bg-accent/40"
                  >
                    <Checkbox
                      checked={edicao.unidades.includes(unidade.nome)}
                      onCheckedChange={(checked) =>
                        toggleUnidadeEdicao(unidade.nome, Boolean(checked))
                      }
                    />
                    <span>{unidade.nome}</span>
                  </label>
                ))
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Selecionadas: {edicao.unidades.length}
            </p>
          </FormField>
          <label className="flex items-center gap-2 rounded-lg border border-border/70 bg-surface-2/70 px-2.5 py-2 text-xs text-muted-foreground">
            <Checkbox
              checked={edicao.status_ativo}
              onCheckedChange={(checked) => setEdicao((p) => ({ ...p, status_ativo: Boolean(checked) }))}
            />
            Ativo
          </label>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" className="h-9 text-xs" onClick={fecharEdicao}>
              Cancelar
            </Button>
            <Button className="h-9 text-xs" onClick={salvarEdicao} loading={savingId === editandoId}>
              <Save className="h-4 w-4" />
              Salvar
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(setorParaExcluir)}
        onClose={() => setSetorParaExcluir(null)}
        title="Apagar setor"
        description={
          setorParaExcluir
            ? `Tem certeza que deseja apagar o setor ${setorParaExcluir.nome}?`
            : undefined
        }
        confirmLabel="Apagar"
        onConfirm={async () => {
          if (!setorParaExcluir) return;
          await apagar(setorParaExcluir);
          setSetorParaExcluir(null);
        }}
      />
    </div>
  );
}
