import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
import { Pencil, RotateCcw, Save, Settings2 } from "lucide-react";
import type { ConfiguracaoRow } from "../types";

const MAX_KITS_KEY = "MAX_KITS_POR_FUNCIONARIO";
const CONFIG_DEFAULTS: Record<string, string> = {
  [MAX_KITS_KEY]: "2",
};

const FILTRO_INPUT_CLASS =
  "h-8 rounded-xl border-border/80 bg-background/85 text-xs dark:border-border/90 dark:bg-background/70";
const TABELA_CONTAINER_CLASS =
  "overflow-hidden border-border/65 bg-background/72 shadow-[var(--shadow-soft)] dark:border-border/85 dark:bg-background/58";
const TABELA_DENSE_CLASS = `${TABELA_CONTAINER_CLASS} [--table-inline-gap:0.95rem]`;
const FILTRO_BAR_CLASS = "gap-1.5 md:flex-nowrap md:items-end";
const SECTION_HEADER_CLASS = "gap-2 px-3 pb-2 pt-3 sm:px-4 sm:pb-2 sm:pt-4";
const SECTION_CONTENT_CLASS = "space-y-2.5 px-3 pb-3 pt-0 sm:px-4 sm:pb-4";

function formatarDataHora(valor: string | null) {
  if (!valor) return "-";
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return valor;
  return data.toLocaleString("pt-BR");
}

export function ConfiguracoesTab() {
  const [rows, setRows] = useState<ConfiguracaoRow[]>([]);
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [openEditModal, setOpenEditModal] = useState(false);
  const [configParaResetar, setConfigParaResetar] = useState<ConfiguracaoRow | null>(null);
  const [confirmarResetTotal, setConfirmarResetTotal] = useState(false);
  const [maxKits, setMaxKits] = useState("2");
  const { success, error } = useToast();

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<ConfiguracaoRow[]>("/admin/configuracoes");
      setRows(data);
      const atual = data.find((row) => row.chave === MAX_KITS_KEY);
      if (atual?.valor) {
        setMaxKits(atual.valor);
      }
    } catch (err) {
      error(err instanceof Error ? err.message : "Erro ao carregar configurações");
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
      if (!termo) return true;
      return [row.chave, row.valor, row.atualizadoPor ?? ""].join(" ").toLowerCase().includes(termo);
    });
  }, [rows, busca]);

  const totalEditaveis = useMemo(
    () => rowsFiltradas.filter((row) => row.chave === MAX_KITS_KEY).length,
    [rowsFiltradas],
  );

  async function salvarMaxKits() {
    const valor = Number(maxKits);
    if (!Number.isInteger(valor) || valor <= 0) {
      error(`${MAX_KITS_KEY} deve ser inteiro positivo`);
      return;
    }

    setSaving(true);
    try {
      await api.put("/admin/configuracoes/max-kits", {
        max_kits_por_funcionario: valor,
      });
      success("Configuração atualizada");
      setOpenEditModal(false);
      await carregar();
    } catch (err) {
      error(err instanceof Error ? err.message : "Erro ao salvar configuração");
    } finally {
      setSaving(false);
    }
  }

  function podeResetar(chave: string) {
    return Object.prototype.hasOwnProperty.call(CONFIG_DEFAULTS, chave);
  }

  async function resetarConfiguracoes(chaves?: string[]) {
    try {
      await api.post<ConfiguracaoRow[]>("/admin/configuracoes/reset", chaves?.length ? { chaves } : undefined);
      success("Configurações resetadas para os valores padrão");
      await carregar();
    } catch (err) {
      error(err instanceof Error ? err.message : "Erro ao resetar configurações");
    }
  }

  async function resetarConfiguracao(row: ConfiguracaoRow) {
    await resetarConfiguracoes([row.chave]);
  }

  function abrirEdicao(row: ConfiguracaoRow) {
    if (row.chave !== MAX_KITS_KEY) return;
    setMaxKits(row.valor || "1");
    setOpenEditModal(true);
  }

  return (
    <div className="space-y-3">
      <SectionCard
        title={<span className="text-sm font-semibold">Configurações</span>}
        icon={Settings2}
        description={(
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
            <span>Total filtrado: {rowsFiltradas.length}</span>
            <span>Editaveis: {totalEditaveis}</span>
          </div>
        )}
        className="border-border/70 bg-card/94 shadow-[var(--shadow-soft)] dark:border-border/85 dark:bg-card/90"
        headerClassName={SECTION_HEADER_CLASS}
        contentClassName={SECTION_CONTENT_CLASS}
        actions={(
          <FilterBar className={FILTRO_BAR_CLASS}>
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar chave, valor ou operador"
              className={`${FILTRO_INPUT_CLASS} w-full sm:w-56 lg:w-64`}
            />
            <Button
              variant="outline"
              className="h-8 rounded-lg border-destructive/30 text-xs text-destructive hover:bg-destructive/12 hover:text-destructive"
              onClick={() => setConfirmarResetTotal(true)}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Resetar tudo
            </Button>
          </FilterBar>
        )}
      >
        <div className="hidden md:block">
          <DataTable
            columns={[
              { key: "chave", title: "Chave", width: "27%", className: "font-mono font-semibold", sortValue: (row) => row.chave },
              {
                key: "valor",
                title: "Valor",
                align: "center",
                width: "13%",
                className: "font-mono tabular-nums",
                sortValue: (row) => row.valor,
              },
              {
                key: "tipo",
                title: "Tipo",
                align: "center",
                width: "15%",
                sortValue: (row) => (row.chave === MAX_KITS_KEY ? "editavel" : "somente leitura"),
              },
              { key: "atualizado-por", title: "Atualizado por", width: "16%", sortValue: (row) => row.atualizadoPor ?? "" },
              {
                key: "atualizado-em",
                title: "Atualizado em",
                width: "16%",
                className: "font-mono tabular-nums",
                sortValue: (row) => (row.atualizadoEm ? new Date(row.atualizadoEm).getTime() : null),
              },
              { key: "acoes", title: "Acoes", align: "center", width: "13%", sortable: false },
            ]}
            rows={rowsFiltradas}
            getRowKey={(row) => row.chave}
            onRowClick={(row) => abrirEdicao(row)}
            loading={loading}
            emptyMessage="Nenhuma configuração encontrada."
            minWidthClassName="min-w-[980px]"
            containerClassName={TABELA_DENSE_CLASS}
            renderRow={(row) => {
              const isEditavel = row.chave === MAX_KITS_KEY;
              const isResetavel = podeResetar(row.chave);

              return (
                <>
                  <td className="max-w-0 truncate" title={row.chave}>{row.chave}</td>
                  <td>{row.valor}</td>
                  <td>
                    <div className="flex justify-center">
                      <StatusPill tone={isEditavel ? "success" : "neutral"} className="text-[10px]">
                        {isEditavel ? "editavel" : "somente leitura"}
                      </StatusPill>
                    </div>
                  </td>
                  <td className="max-w-0 truncate" title={row.atualizadoPor ?? "-"}>{row.atualizadoPor ?? "-"}</td>
                  <td>{formatarDataHora(row.atualizadoEm)}</td>
                  <td>
                    <TableActions className="justify-center">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 rounded-lg"
                        onClick={() => abrirEdicao(row)}
                        disabled={!isEditavel}
                        aria-label={`Editar configuração ${row.chave}`}
                        title={isEditavel ? "Editar" : "Somente leitura"}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/12 hover:text-destructive"
                        onClick={() => setConfigParaResetar(row)}
                        disabled={!isResetavel}
                        aria-label={`Resetar configuração ${row.chave}`}
                        title={
                          isResetavel
                            ? "Resetar para valor padrão"
                            : "Configuração sem valor padrão cadastrado"
                        }
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    </TableActions>
                  </td>
                </>
              );
            }}
          />
        </div>

        <div className="space-y-2 md:hidden">
          {loading ? (
            Array.from({ length: 3 }).map((_, index) => (
              <div key={`config-skeleton-${index}`} className="rounded-xl border border-border/70 bg-surface-2/80 p-3">
                <div className="h-3 w-28 animate-pulse rounded bg-muted/70" />
                <div className="mt-2 h-2.5 w-full animate-pulse rounded bg-muted/60" />
                <div className="mt-1.5 h-2.5 w-3/4 animate-pulse rounded bg-muted/45" />
              </div>
            ))
          ) : rowsFiltradas.length === 0 ? (
            <div className="rounded-xl border border-border/70 bg-surface-2/80 px-3 py-5">
              <EmptyState compact title="Nenhuma configuração encontrada." />
            </div>
          ) : (
            rowsFiltradas.map((row) => {
              const isEditavel = row.chave === MAX_KITS_KEY;
              const isResetavel = podeResetar(row.chave);

              return (
                <article
                  key={row.chave}
                  className="rounded-xl border border-border/70 bg-surface-2/85 p-3 shadow-[var(--shadow-soft)]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      className="font-mono text-xs font-semibold text-primary underline-offset-2 hover:underline"
                      onClick={() => abrirEdicao(row)}
                    >
                      {row.chave}
                    </button>
                    <StatusPill tone={isEditavel ? "success" : "neutral"} className="text-[10px]">
                      {isEditavel ? "editavel" : "fixo"}
                    </StatusPill>
                  </div>
                  <p className="mt-1 font-mono text-sm text-foreground">{row.valor}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {row.atualizadoPor ?? "-"} | {formatarDataHora(row.atualizadoEm)}
                  </p>
                  <div className="mt-2 flex justify-end gap-1.5">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 rounded-lg"
                      onClick={() => abrirEdicao(row)}
                      disabled={!isEditavel}
                      aria-label={`Editar configuração ${row.chave}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/12 hover:text-destructive"
                      onClick={() => setConfigParaResetar(row)}
                      disabled={!isResetavel}
                      aria-label={`Resetar configuração ${row.chave}`}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </SectionCard>

      <Modal
        open={openEditModal}
        onClose={() => setOpenEditModal(false)}
        title={`Editar Configuração: ${MAX_KITS_KEY}`}
        description="Defina um número inteiro positivo para limitar kits por funcionário."
        maxWidthClassName="max-w-xl"
      >
        <div className="space-y-3">
          <FormField
            label="Valor"
            htmlFor="max-kits"
            helperText="Esse valor impacta diretamente validações de empréstimo."
          >
            <Input
              id="max-kits"
              type="number"
              min={1}
              value={maxKits}
              onChange={(e) => setMaxKits(e.target.value)}
              className="h-9 text-xs"
            />
          </FormField>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" className="h-9 text-xs" onClick={() => setOpenEditModal(false)}>
              Cancelar
            </Button>
            <Button className="h-9 text-xs" onClick={salvarMaxKits} loading={saving}>
              <Save className="h-4 w-4" />
              Salvar
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(configParaResetar)}
        onClose={() => setConfigParaResetar(null)}
        title="Resetar configuração"
        description={
          configParaResetar
            ? `Tem certeza que deseja resetar ${configParaResetar.chave} para o valor padrão (${CONFIG_DEFAULTS[configParaResetar.chave] ?? "-"})?`
            : undefined
        }
        confirmLabel="Resetar"
        onConfirm={async () => {
          if (!configParaResetar) return;
          await resetarConfiguracao(configParaResetar);
          setConfigParaResetar(null);
        }}
      />

      <ConfirmDialog
        open={confirmarResetTotal}
        onClose={() => setConfirmarResetTotal(false)}
        title="Resetar todas as configurações"
        description="Tem certeza que deseja resetar todas as configurações para os valores padrão?"
        confirmLabel="Resetar tudo"
        onConfirm={async () => {
          await resetarConfiguracoes();
          setConfirmarResetTotal(false);
        }}
      />
    </div>
  );
}
