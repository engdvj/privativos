import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar } from "@/components/ui/filter-bar";
import { FormField } from "@/components/ui/form-field";
import { SectionCard } from "@/components/ui/section-card";
import { StatusPill } from "@/components/ui/status-pill";
import { TableActions } from "@/components/ui/table-actions";
import { useToast } from "@/components/ui/use-toast";
import { Pencil, Plus, Save, Trash2, UserCog } from "lucide-react";
import type { CatalogoRow } from "../types";

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
const FUNCOES_POR_PAGINA = 10;

export function FuncoesTab() {
  const [rows, setRows] = useState<CatalogoRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [openCreateModal, setOpenCreateModal] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<"todos" | "ativo" | "inativo">("todos");
  const [paginaFuncoes, setPaginaFuncoes] = useState(1);
  const [nomeNovo, setNomeNovo] = useState("");
  const [edicao, setEdicao] = useState({ nome: "", status_ativo: true });
  const [funcaoParaExcluir, setFuncaoParaExcluir] = useState<CatalogoRow | null>(null);
  const { success, error } = useToast();

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<CatalogoRow[]>("/admin/funcoes?include_inactive=true");
      setRows(data);
    } catch (err) {
      error(err instanceof Error ? err.message : "Erro ao carregar funcoes");
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

  const ativosFiltrados = useMemo(
    () => rowsFiltradas.filter((row) => row.statusAtivo).length,
    [rowsFiltradas],
  );
  const inativosFiltrados = rowsFiltradas.length - ativosFiltrados;
  const totalPaginasFuncoes = Math.max(1, Math.ceil(rowsFiltradas.length / FUNCOES_POR_PAGINA));
  const rowsPaginadas = useMemo(() => {
    const inicio = (paginaFuncoes - 1) * FUNCOES_POR_PAGINA;
    return rowsFiltradas.slice(inicio, inicio + FUNCOES_POR_PAGINA);
  }, [rowsFiltradas, paginaFuncoes]);
  const inicioPaginaFuncoes = rowsFiltradas.length === 0 ? 0 : (paginaFuncoes - 1) * FUNCOES_POR_PAGINA + 1;
  const fimPaginaFuncoes = Math.min(paginaFuncoes * FUNCOES_POR_PAGINA, rowsFiltradas.length);

  useEffect(() => {
    setPaginaFuncoes(1);
  }, [busca, filtroStatus]);

  useEffect(() => {
    if (paginaFuncoes > totalPaginasFuncoes) {
      setPaginaFuncoes(totalPaginasFuncoes);
    }
  }, [paginaFuncoes, totalPaginasFuncoes]);

  async function criar() {
    if (!nomeNovo.trim()) {
      error("Informe o nome da funcao");
      return;
    }

    setCreating(true);
    try {
      await api.post("/admin/funcoes", { nome: nomeNovo.trim() });
      setNomeNovo("");
      setOpenCreateModal(false);
      success("Funcao criada com sucesso");
      await carregar();
    } catch (err) {
      error(err instanceof Error ? err.message : "Erro ao criar funcao");
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
      error("Informe o nome da funcao");
      return;
    }

    setSavingId(editandoId);
    try {
      await api.put(`/admin/funcoes/${editandoId}`, {
        nome: edicao.nome.trim(),
        status_ativo: edicao.status_ativo,
      });
      success("Funcao atualizada");
      fecharEdicao();
      await carregar();
    } catch (err) {
      error(err instanceof Error ? err.message : "Erro ao atualizar funcao");
    } finally {
      setSavingId(null);
    }
  }

  async function apagar(row: CatalogoRow) {
    try {
      await api.del(`/admin/funcoes/${row.id}`);
      success("Funcao apagada");
      await carregar();
    } catch (err) {
      error(err instanceof Error ? err.message : "Erro ao apagar funcao");
    }
  }

  return (
    <div className="space-y-3">
      <SectionCard
        title={<span className="text-sm font-semibold">Funcoes</span>}
        icon={UserCog}
        description={
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
            <span>Total: {rowsFiltradas.length}</span>
            <span>Ativas: {ativosFiltrados}</span>
            <span>Inativas: {inativosFiltrados}</span>
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
              placeholder="Buscar funcao"
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
              aria-label="Nova funcao"
              title="Nova funcao"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </FilterBar>
        }
      >
        <div className="hidden md:block">
          <DataTable
            columns={[
              { key: "nome", title: "Nome", width: "60%", sortValue: (row) => row.nome },
              { key: "status", title: "Status", align: "center", width: "20%", sortValue: (row) => row.statusAtivo },
              { key: "acoes", title: "Acoes", align: "center", width: "20%" },
            ]}
            rows={rowsPaginadas}
            getRowKey={(row) => row.id}
            onRowClick={(row) => abrirEdicao(row)}
            loading={loading}
            emptyMessage="Nenhuma funcao encontrada."
            minWidthClassName="min-w-[620px]"
            containerClassName={TABELA_DENSE_CLASS}
            renderRow={(row) => (
              <>
                <td className="max-w-0 truncate" title={row.nome}>{row.nome}</td>
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
                      aria-label={`Editar funcao ${row.nome}`}
                      title="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/12 hover:text-destructive"
                      onClick={() => setFuncaoParaExcluir(row)}
                      aria-label={`Apagar funcao ${row.nome}`}
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
              <div key={`funcao-skeleton-${index}`} className="rounded-xl border border-border/70 bg-surface-2/80 p-3">
                <div className="h-3 w-28 animate-pulse rounded bg-muted/70" />
                <div className="mt-2 h-2.5 w-full animate-pulse rounded bg-muted/60" />
                <div className="mt-1.5 h-2.5 w-3/4 animate-pulse rounded bg-muted/45" />
              </div>
            ))
          ) : rowsFiltradas.length === 0 ? (
            <div className="rounded-xl border border-border/70 bg-surface-2/80 px-3 py-5">
              <EmptyState compact title="Nenhuma funcao encontrada." />
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
                    onClick={() => abrirEdicao(row)}
                  >
                    {row.nome}
                  </button>
                  <StatusPill tone={row.statusAtivo ? "success" : "danger"} className="text-[10px]">
                    {row.statusAtivo ? "ativo" : "inativo"}
                  </StatusPill>
                </div>
                <div className="mt-2 flex justify-end gap-1.5">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 rounded-lg"
                    onClick={() => abrirEdicao(row)}
                    aria-label={`Editar funcao ${row.nome}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/12 hover:text-destructive"
                    onClick={() => setFuncaoParaExcluir(row)}
                    aria-label={`Apagar funcao ${row.nome}`}
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
            {inicioPaginaFuncoes}-{fimPaginaFuncoes} de {rowsFiltradas.length} | Pagina {paginaFuncoes} de {totalPaginasFuncoes}
          </p>
          <div className="flex min-w-[220px] justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 min-w-20 border-border/80 bg-background/85 text-[10px] dark:border-border/90 dark:bg-background/60 dark:hover:bg-accent/35"
              onClick={() => setPaginaFuncoes((paginaAtual) => Math.max(1, paginaAtual - 1))}
              disabled={paginaFuncoes === 1}
            >
              Anterior
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 min-w-20 border-border/80 bg-background/85 text-[10px] dark:border-border/90 dark:bg-background/60 dark:hover:bg-accent/35"
              onClick={() => setPaginaFuncoes((paginaAtual) => Math.min(totalPaginasFuncoes, paginaAtual + 1))}
              disabled={paginaFuncoes === totalPaginasFuncoes}
            >
              Proxima
            </Button>
          </div>
        </div>
      </SectionCard>

      <Modal
        open={openCreateModal}
        onClose={() => setOpenCreateModal(false)}
        title="Nova Funcao"
        description="Crie uma funcao para associacao de colaboradores."
        maxWidthClassName="max-w-xl"
      >
        <div className="space-y-3">
          <FormField label="Nome da funcao" htmlFor="nova-funcao-nome">
            <Input
              id="nova-funcao-nome"
              value={nomeNovo}
              onChange={(e) => setNomeNovo(e.target.value)}
              placeholder="Nome da funcao"
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
        title="Editar Funcao"
        description="Atualize o nome e o status da funcao."
        maxWidthClassName="max-w-xl"
      >
        <div className="space-y-3">
          <FormField label="Nome" htmlFor="edicao-funcao-nome">
            <Input
              id="edicao-funcao-nome"
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
        open={Boolean(funcaoParaExcluir)}
        onClose={() => setFuncaoParaExcluir(null)}
        title="Apagar funcao"
        description={
          funcaoParaExcluir
            ? `Tem certeza que deseja apagar a funcao ${funcaoParaExcluir.nome}?`
            : undefined
        }
        confirmLabel="Apagar"
        onConfirm={async () => {
          if (!funcaoParaExcluir) return;
          await apagar(funcaoParaExcluir);
          setFuncaoParaExcluir(null);
        }}
      />
    </div>
  );
}
