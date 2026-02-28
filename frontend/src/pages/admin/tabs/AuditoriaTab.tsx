import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar } from "@/components/ui/filter-bar";
import { SectionCard } from "@/components/ui/section-card";
import { StatusPill } from "@/components/ui/status-pill";
import { useToast } from "@/components/ui/use-toast";
import { useGlobalDetail } from "@/components/global-detail/GlobalDetailProvider";
import { RefreshCw, ShieldCheck } from "lucide-react";
import type { AuditoriaRow } from "../types";

const FILTRO_INPUT_CLASS =
  "h-8 rounded-xl border-border/80 bg-background/85 text-xs dark:border-border/90 dark:bg-background/70";
const TABELA_CONTAINER_CLASS =
  "overflow-hidden border-border/65 bg-background/72 shadow-[var(--shadow-soft)] dark:border-border/85 dark:bg-background/58";
const TABELA_DENSE_CLASS = `${TABELA_CONTAINER_CLASS} [--table-inline-gap:0.95rem]`;
const FILTRO_BAR_CLASS = "gap-1.5 md:flex-nowrap md:items-end";
const SECTION_HEADER_CLASS = "gap-2 px-3 pb-2 pt-3 sm:px-4 sm:pb-2 sm:pt-4";
const SECTION_CONTENT_CLASS = "space-y-2.5 px-3 pb-3 pt-0 sm:px-4 sm:pb-4";

function formatarDataHora(valor: string) {
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return { completo: "-", data: "-", hora: "-" };
  return {
    completo: data.toLocaleString("pt-BR"),
    data: data.toLocaleDateString("pt-BR"),
    hora: data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
  };
}

export function AuditoriaTab() {
  const [rows, setRows] = useState<AuditoriaRow[]>([]);
  const [limit, setLimit] = useState("100");
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(false);
  const { error } = useToast();
  const { openByQuery, openFuncionario, openKit } = useGlobalDetail();

  function abrirDetalheAuditoria(row: AuditoriaRow) {
    const entidade = row.entidade.toLowerCase();
    const registro = String(row.registroId);

    if (entidade.includes("funcion")) {
      void openFuncionario(registro);
      return;
    }

    if (entidade.includes("item") || entidade.includes("kit")) {
      void openKit(registro);
      return;
    }

    void openByQuery(registro);
  }

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
      const data = await api.get<AuditoriaRow[]>(`/admin/auditoria?limit=${safeLimit}`);
      setRows(data);
    } catch (err) {
      error(err instanceof Error ? err.message : "Erro ao carregar auditoria");
    } finally {
      setLoading(false);
    }
  }, [error, limit]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return rows;
    return rows.filter((row) =>
      [row.operador, row.entidade, row.operacao, row.registroId].join(" ").toLowerCase().includes(termo),
    );
  }, [rows, busca]);

  return (
    <div className="space-y-3">
      <SectionCard
        title={<span className="text-sm font-semibold">Auditoria</span>}
        icon={ShieldCheck}
        description={(
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
            <span>Registros filtrados: {filtrados.length}</span>
            <span>Limite carregado: {Math.min(Math.max(Number(limit) || 100, 1), 500)}</span>
          </div>
        )}
        className="border-border/70 bg-card/94 shadow-[var(--shadow-soft)] dark:border-border/85 dark:bg-card/90"
        headerClassName={SECTION_HEADER_CLASS}
        contentClassName={SECTION_CONTENT_CLASS}
        actions={(
          <FilterBar className={FILTRO_BAR_CLASS}>
            <Input
              type="number"
              min={1}
              max={500}
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              className={`${FILTRO_INPUT_CLASS} w-full sm:w-28`}
              placeholder="Limite"
            />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Operador, entidade, operacao ou registro"
              className={`${FILTRO_INPUT_CLASS} w-full sm:w-56 lg:w-72`}
            />
            <Button
              variant="outline"
              className="h-8 rounded-lg text-xs"
              onClick={() => {
                void carregar();
              }}
              disabled={loading}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Atualizar
            </Button>
          </FilterBar>
        )}
      >
        <div className="hidden md:block">
          <DataTable
            columns={[
              {
                key: "timestamp",
                title: "Data/Hora",
                width: "20%",
                className: "font-mono tabular-nums",
                sortValue: (row) => new Date(row.timestamp).getTime(),
              },
              { key: "operador", title: "Operador", width: "20%", sortValue: (row) => row.operador },
              { key: "entidade", title: "Entidade", width: "20%", sortValue: (row) => row.entidade },
              { key: "operacao", title: "Operacao", align: "center", width: "20%", sortValue: (row) => row.operacao },
              {
                key: "registro",
                title: "Registro",
                align: "center",
                width: "20%",
                className: "font-mono tabular-nums",
                sortValue: (row) => row.registroId,
              },
            ]}
            rows={filtrados}
            getRowKey={(row) => row.id}
            onRowClick={(row) => abrirDetalheAuditoria(row)}
            loading={loading}
            emptyMessage="Nenhum registro de auditoria encontrado."
            minWidthClassName="min-w-[900px]"
            containerClassName={TABELA_DENSE_CLASS}
            renderRow={(row) => {
              const dataHora = formatarDataHora(row.timestamp);
              return (
                <>
                  <td className="max-w-0 truncate" title={dataHora.completo}>{dataHora.completo}</td>
                  <td className="max-w-0 truncate" title={row.operador}>{row.operador}</td>
                  <td className="max-w-0 truncate" title={row.entidade}>{row.entidade}</td>
                  <td>
                    <div className="flex justify-center">
                      <StatusPill tone="info" className="text-[10px]">{row.operacao}</StatusPill>
                    </div>
                  </td>
                  <td>{row.registroId}</td>
                </>
              );
            }}
          />
        </div>

        <div className="space-y-2 md:hidden">
          {loading ? (
            Array.from({ length: 3 }).map((_, index) => (
              <div key={`auditoria-skeleton-${index}`} className="rounded-xl border border-border/70 bg-surface-2/80 p-3">
                <div className="h-3 w-28 animate-pulse rounded bg-muted/70" />
                <div className="mt-2 h-2.5 w-full animate-pulse rounded bg-muted/60" />
                <div className="mt-1.5 h-2.5 w-3/4 animate-pulse rounded bg-muted/45" />
              </div>
            ))
          ) : filtrados.length === 0 ? (
            <div className="rounded-xl border border-border/70 bg-surface-2/80 px-3 py-5">
              <EmptyState compact title="Nenhum registro de auditoria encontrado." />
            </div>
          ) : (
            filtrados.map((row) => {
              const dataHora = formatarDataHora(row.timestamp);
              return (
                <article
                  key={row.id}
                  className="rounded-xl border border-border/70 bg-surface-2/85 p-3 shadow-[var(--shadow-soft)]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      className="font-mono text-xs font-semibold text-primary underline-offset-2 hover:underline"
                      onClick={() => abrirDetalheAuditoria(row)}
                    >
                      {dataHora.data} {dataHora.hora}
                    </button>
                    <StatusPill tone="info" className="text-[10px]">{row.operacao}</StatusPill>
                  </div>
                  <p className="mt-1 text-xs text-foreground">{row.operador}</p>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <div>
                      <p className="text-[10px] uppercase tracking-wide">Entidade</p>
                      <p className="truncate text-foreground" title={row.entidade}>{row.entidade}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide">Registro</p>
                      <p className="truncate font-mono text-foreground" title={String(row.registroId)}>
                        {row.registroId}
                      </p>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </SectionCard>
    </div>
  );
}
