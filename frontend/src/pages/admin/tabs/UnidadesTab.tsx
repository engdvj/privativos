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

const UNIDADES_POR_PAGINA = 10;
const FUNCIONARIOS_POR_PAGINA = 10;

interface UnidadeFuncionariosResponse {
  pagina: number;
  limite: number;
  total: number;
  rows: FuncionarioRow[];
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

export function UnidadesTab() {
  const [rows, setRows] = useState<CatalogoRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [openCreateModal, setOpenCreateModal] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<"todos" | "ativo" | "inativo">("todos");
  const [paginaUnidades, setPaginaUnidades] = useState(1);
  const [sortUnidades, setSortUnidades] = useState<DataTableSortState>(null);
  const [nomeNovo, setNomeNovo] = useState("");
  const [edicao, setEdicao] = useState({ nome: "", status_ativo: true });
  const [unidadeParaExcluir, setUnidadeParaExcluir] = useState<CatalogoRow | null>(null);
  const [unidadeSelecionada, setUnidadeSelecionada] = useState<CatalogoRow | null>(null);
  const [funcionariosUnidade, setFuncionariosUnidade] = useState<FuncionarioRow[]>([]);
  const [totalFuncionariosUnidade, setTotalFuncionariosUnidade] = useState(0);
  const [paginaFuncionariosUnidade, setPaginaFuncionariosUnidade] = useState(1);
  const [loadingFuncionariosUnidade, setLoadingFuncionariosUnidade] = useState(false);
  const { success, error } = useToast();
  const { openFuncionario } = useGlobalDetail();

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<CatalogoRow[]>("/admin/unidades?include_inactive=true");
      setRows(data);
    } catch (err) {
      error(err instanceof Error ? err.message : "Erro ao carregar unidades");
    } finally {
      setLoading(false);
    }
  }, [error]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const rowsFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return rows.filter((row) => {
      const matchTexto = !termo || row.nome.toLowerCase().includes(termo);
      const matchStatus = filtroStatus === "todos" || (filtroStatus === "ativo" ? row.statusAtivo : !row.statusAtivo);
      return matchTexto && matchStatus;
    });
  }, [rows, busca, filtroStatus]);
  const colunasUnidades = useMemo<DataTableColumn<CatalogoRow>[]>(() => [
    { key: "nome", title: "Nome", width: "45%", sortValue: (row) => row.nome },
    {
      key: "total",
      title: "Total funcionários",
      align: "center",
      width: "17%",
      sortValue: (row) => row.totalFuncionarios ?? 0,
    },
    { key: "status", title: "Status", align: "center", width: "18%", sortValue: (row) => row.statusAtivo },
    { key: "acoes", title: "Acoes", align: "center", width: "20%" },
  ], []);
  const rowsOrdenadas = useMemo(
    () => sortDataTableRows(rowsFiltradas, colunasUnidades, sortUnidades),
    [rowsFiltradas, colunasUnidades, sortUnidades],
  );

  const ativosFiltrados = useMemo(
    () => rowsFiltradas.filter((row) => row.statusAtivo).length,
    [rowsFiltradas],
  );
  const inativosFiltrados = rowsFiltradas.length - ativosFiltrados;
  const totalPaginasUnidades = Math.max(1, Math.ceil(rowsOrdenadas.length / UNIDADES_POR_PAGINA));
  const rowsPaginadas = useMemo(() => {
    const inicio = (paginaUnidades - 1) * UNIDADES_POR_PAGINA;
    return rowsOrdenadas.slice(inicio, inicio + UNIDADES_POR_PAGINA);
  }, [rowsOrdenadas, paginaUnidades]);
  const inicioPaginaUnidades = rowsOrdenadas.length === 0 ? 0 : (paginaUnidades - 1) * UNIDADES_POR_PAGINA + 1;
  const fimPaginaUnidades = Math.min(paginaUnidades * UNIDADES_POR_PAGINA, rowsOrdenadas.length);

  useEffect(() => {
    setPaginaUnidades(1);
  }, [busca, filtroStatus]);

  useEffect(() => {
    if (paginaUnidades > totalPaginasUnidades) {
      setPaginaUnidades(totalPaginasUnidades);
    }
  }, [paginaUnidades, totalPaginasUnidades]);

  const carregarFuncionariosUnidade = useCallback(async () => {
    if (!unidadeSelecionada) {
      return;
    }

    setLoadingFuncionariosUnidade(true);
    try {
      const query = new URLSearchParams({
        pagina: String(paginaFuncionariosUnidade),
        limite: String(FUNCIONARIOS_POR_PAGINA),
        include_inactive: "true",
      });
      const data = await api.get<UnidadeFuncionariosResponse>(
        `/admin/unidades/${unidadeSelecionada.id}/funcionarios?${query.toString()}`,
      );
      setFuncionariosUnidade(data.rows);
      setTotalFuncionariosUnidade(data.total);
    } catch (err) {
      error(err instanceof Error ? err.message : "Erro ao carregar funcionários da unidade");
    } finally {
      setLoadingFuncionariosUnidade(false);
    }
  }, [error, paginaFuncionariosUnidade, unidadeSelecionada]);

  useEffect(() => {
    if (!unidadeSelecionada) return;
    void carregarFuncionariosUnidade();
  }, [unidadeSelecionada, paginaFuncionariosUnidade, carregarFuncionariosUnidade]);

  const totalPaginasFuncionariosUnidade = Math.max(
    1,
    Math.ceil(totalFuncionariosUnidade / FUNCIONARIOS_POR_PAGINA),
  );
  const inicioFuncionariosUnidade =
    totalFuncionariosUnidade === 0
      ? 0
      : (paginaFuncionariosUnidade - 1) * FUNCIONARIOS_POR_PAGINA + 1;
  const fimFuncionariosUnidade = Math.min(
    paginaFuncionariosUnidade * FUNCIONARIOS_POR_PAGINA,
    totalFuncionariosUnidade,
  );

  useEffect(() => {
    if (paginaFuncionariosUnidade > totalPaginasFuncionariosUnidade) {
      setPaginaFuncionariosUnidade(totalPaginasFuncionariosUnidade);
    }
  }, [paginaFuncionariosUnidade, totalPaginasFuncionariosUnidade]);

  function abrirFuncionariosUnidade(row: CatalogoRow) {
    setUnidadeSelecionada(row);
    setPaginaFuncionariosUnidade(1);
    setFuncionariosUnidade([]);
    setTotalFuncionariosUnidade(0);
  }

  async function criar() {
    if (!nomeNovo.trim()) {
      error("Informe o nome da unidade");
      return;
    }

    setCreating(true);
    try {
      await api.post("/admin/unidades", { nome: nomeNovo.trim() });
      setNomeNovo("");
      setOpenCreateModal(false);
      success("Unidade criada com sucesso");
      await carregar();
      notificarAtualizacaoGlobal("unidade");
    } catch (err) {
      error(err instanceof Error ? err.message : "Erro ao criar unidade");
    } finally {
      setCreating(false);
    }
  }

  function abrirEdicao(row: CatalogoRow) {
    setEditandoId(row.id);
    setEdicao({ nome: row.nome, status_ativo: row.statusAtivo });
  }

  function fecharEdicao() {
    setEditandoId(null);
    setEdicao({ nome: "", status_ativo: true });
  }

  async function salvarEdicao() {
    if (!editandoId) return;
    if (!edicao.nome.trim()) {
      error("Informe o nome da unidade");
      return;
    }

    setSavingId(editandoId);
    try {
      await api.put(`/admin/unidades/${editandoId}`, {
        nome: edicao.nome.trim(),
        status_ativo: edicao.status_ativo,
      });
      success("Unidade atualizada");
      fecharEdicao();
      await carregar();
      notificarAtualizacaoGlobal("unidade");
    } catch (err) {
      error(err instanceof Error ? err.message : "Erro ao atualizar unidade");
    } finally {
      setSavingId(null);
    }
  }

  async function apagar(row: CatalogoRow) {
    try {
      await api.del(`/admin/unidades/${row.id}`);
      success("Unidade apagada");
      await carregar();
      notificarAtualizacaoGlobal("unidade");
    } catch (err) {
      error(err instanceof Error ? err.message : "Erro ao apagar unidade");
    }
  }

  return (
    <div className="space-y-3">
      <SectionCard
        title={<span className="text-sm font-semibold">Unidades</span>}
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
              placeholder="Buscar unidade"
              className={`${FILTRO_INPUT_CLASS} w-full sm:w-56`}
            />
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
              aria-label="Nova unidade"
              title="Nova unidade"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </FilterBar>
        }
      >
        <div className="hidden md:block">
          <DataTable
            columns={colunasUnidades}
            rows={rowsPaginadas}
            sortState={sortUnidades}
            onSortStateChange={setSortUnidades}
            getRowKey={(row) => row.id}
            onRowClick={(row) => abrirFuncionariosUnidade(row)}
            loading={loading}
            emptyMessage="Nenhuma unidade encontrada."
            minWidthClassName="min-w-[700px]"
            containerClassName={TABELA_DENSE_CLASS}
            renderRow={(row) => (
              <>
                <td className="max-w-0 truncate" title={row.nome}>{row.nome}</td>
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
                      aria-label={`Editar unidade ${row.nome}`}
                      title="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/12 hover:text-destructive"
                      onClick={() => setUnidadeParaExcluir(row)}
                      aria-label={`Apagar unidade ${row.nome}`}
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
              <EmptyState compact title="Nenhuma unidade encontrada." />
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
                    onClick={() => abrirFuncionariosUnidade(row)}
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
                <div className="mt-2 flex justify-end gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-[11px]"
                    onClick={() => abrirFuncionariosUnidade(row)}
                  >
                    Ver vinculados
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 rounded-lg"
                    onClick={() => abrirEdicao(row)}
                    aria-label={`Editar unidade ${row.nome}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/12 hover:text-destructive"
                    onClick={() => setUnidadeParaExcluir(row)}
                    aria-label={`Apagar unidade ${row.nome}`}
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
            {inicioPaginaUnidades}-{fimPaginaUnidades} de {rowsFiltradas.length} | Página {paginaUnidades} de {totalPaginasUnidades}
          </p>
          <div className="flex min-w-[220px] justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 min-w-20 border-border/80 bg-background/85 text-[10px] dark:border-border/90 dark:bg-background/60 dark:hover:bg-accent/35"
              onClick={() => setPaginaUnidades((paginaAtual) => Math.max(1, paginaAtual - 1))}
              disabled={paginaUnidades === 1}
            >
              Anterior
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 min-w-20 border-border/80 bg-background/85 text-[10px] dark:border-border/90 dark:bg-background/60 dark:hover:bg-accent/35"
              onClick={() => setPaginaUnidades((paginaAtual) => Math.min(totalPaginasUnidades, paginaAtual + 1))}
              disabled={paginaUnidades === totalPaginasUnidades}
            >
              Próxima
            </Button>
          </div>
        </div>
      </SectionCard>

      <Modal
        open={Boolean(unidadeSelecionada)}
        onClose={() => setUnidadeSelecionada(null)}
        title={unidadeSelecionada ? `Funcionários vinculados - ${unidadeSelecionada.nome}` : "Funcionários vinculados"}
        description="Lista de funcionários atualmente associados a esta unidade."
        maxWidthClassName="max-w-5xl"
      >
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-foreground">Funcionários vinculados</h4>
          <div className="text-[11px] text-muted-foreground">
            {inicioFuncionariosUnidade}-{fimFuncionariosUnidade} de {totalFuncionariosUnidade} | Página{" "}
            {paginaFuncionariosUnidade} de {totalPaginasFuncionariosUnidade}
          </div>

          <div className="space-y-2">
            {loadingFuncionariosUnidade ? (
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={`func-unidade-skeleton-${index}`} className="rounded-xl border border-border/70 bg-surface-2/80 p-3">
                    <div className="h-3 w-20 animate-pulse rounded bg-muted/70" />
                    <div className="mt-2 h-2.5 w-full animate-pulse rounded bg-muted/60" />
                    <div className="mt-1.5 h-2.5 w-3/4 animate-pulse rounded bg-muted/45" />
                  </div>
                ))}
              </div>
            ) : funcionariosUnidade.length === 0 ? (
              <div className="rounded-xl border border-border/70 bg-surface-2/80 px-3 py-5">
                <EmptyState compact title="Nenhum funcionário vinculado." />
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {funcionariosUnidade.map((row) => (
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
              onClick={() => setPaginaFuncionariosUnidade((prev) => Math.max(1, prev - 1))}
              disabled={paginaFuncionariosUnidade === 1 || loadingFuncionariosUnidade}
            >
              Anterior
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-[11px]"
              onClick={() =>
                setPaginaFuncionariosUnidade((prev) =>
                  Math.min(totalPaginasFuncionariosUnidade, prev + 1),
                )
              }
              disabled={paginaFuncionariosUnidade >= totalPaginasFuncionariosUnidade || loadingFuncionariosUnidade}
            >
              Próxima
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={openCreateModal}
        onClose={() => setOpenCreateModal(false)}
        title="Nova Unidade"
        description="Crie uma unidade para organizar setores e funcionários."
        maxWidthClassName="max-w-xl"
      >
        <div className="space-y-3">
          <FormField label="Nome da unidade" htmlFor="nova-unidade-nome">
            <Input
              id="nova-unidade-nome"
              value={nomeNovo}
              onChange={(e) => setNomeNovo(e.target.value)}
              placeholder="Nome da unidade"
              className="h-9 text-xs"
            />
          </FormField>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" className="h-9 text-xs" onClick={() => setOpenCreateModal(false)}>
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
        title="Editar Unidade"
        description="Atualize o nome e o status da unidade."
        maxWidthClassName="max-w-xl"
      >
        <div className="space-y-3">
          <FormField label="Nome" htmlFor="edicao-unidade-nome">
            <Input
              id="edicao-unidade-nome"
              value={edicao.nome}
              onChange={(e) => setEdicao((p) => ({ ...p, nome: e.target.value }))}
              className="h-9 text-xs"
            />
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
        open={Boolean(unidadeParaExcluir)}
        onClose={() => setUnidadeParaExcluir(null)}
        title="Apagar unidade"
        description={
          unidadeParaExcluir
            ? `Tem certeza que deseja apagar a unidade ${unidadeParaExcluir.nome}?`
            : undefined
        }
        confirmLabel="Apagar"
        onConfirm={async () => {
          if (!unidadeParaExcluir) return;
          await apagar(unidadeParaExcluir);
          setUnidadeParaExcluir(null);
        }}
      />
    </div>
  );
}

