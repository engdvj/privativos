import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable } from "@/components/ui/data-table";
import { SectionCard } from "@/components/ui/section-card";
import { useToast } from "@/components/ui/use-toast";
import { BarChart3, Download } from "lucide-react";
import type { DashboardDataResponse, DashboardFiltersResponse } from "../types";

const ITENS_POR_PAGINA = 5;

const FILTROS_INICIAIS = {
  data_inicio: "",
  data_fim: "",
  setor: "",
  matricula: "",
};

export function DashboardTab() {
  const [filtros, setFiltros] = useState({ ...FILTROS_INICIAIS });
  const [opcoes, setOpcoes] = useState<DashboardFiltersResponse>({
    setores: [],
    funcionarios: [],
  });
  const [data, setData] = useState<DashboardDataResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [paginaSolicitacoes, setPaginaSolicitacoes] = useState(1);
  const [paginaDevolucoes, setPaginaDevolucoes] = useState(1);
  const { success, error } = useToast();

  const carregarOpcoes = useCallback(async () => {
    try {
      const payload = await api.get<DashboardFiltersResponse>("/admin/dashboard/filtros");
      setOpcoes(payload);
    } catch (err) {
      error(err instanceof Error ? err.message : "Erro ao carregar filtros");
    }
  }, [error]);

  const carregarDashboard = useCallback(
    async (filtrosOverride?: typeof FILTROS_INICIAIS) => {
      const filtrosAtuais = filtrosOverride ?? filtros;
      setLoading(true);
      try {
        const payload = await api.post<DashboardDataResponse>("/admin/dashboard", {
          data_inicio: filtrosAtuais.data_inicio || undefined,
          data_fim: filtrosAtuais.data_fim || undefined,
          setor: filtrosAtuais.setor || undefined,
          matricula: filtrosAtuais.matricula || undefined,
        });
        setData(payload);
      } catch (err) {
        error(err instanceof Error ? err.message : "Erro ao carregar dashboard");
      } finally {
        setLoading(false);
      }
    },
    [error, filtros],
  );

  async function exportar() {
    setExporting(true);
    try {
      const blob = await api.postBlob("/admin/export", {
        data_inicio: filtros.data_inicio || undefined,
        data_fim: filtros.data_fim || undefined,
        setor: filtros.setor || undefined,
        matricula: filtros.matricula || undefined,
      });

      const fileName = `privativos_export_${new Date().toISOString().replace(/[:.]/g, "-")}.xlsx`;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      success("Exportacao XLSX concluida");
    } catch (err) {
      error(err instanceof Error ? err.message : "Erro ao exportar XLSX");
    } finally {
      setExporting(false);
    }
  }

  function limparFiltros() {
    setFiltros(FILTROS_INICIAIS);
  }

  useEffect(() => {
    void carregarOpcoes();
  }, [carregarOpcoes]);

  useEffect(() => {
    void carregarDashboard();
  }, [carregarDashboard, filtros.data_inicio, filtros.data_fim, filtros.setor, filtros.matricula]);

  const solicitacoesFiltradas = useMemo(() => data?.rows.solicitacoes ?? [], [data]);
  const devolucoesFiltradas = useMemo(() => data?.rows.devolucoes ?? [], [data]);

  useEffect(() => {
    setPaginaSolicitacoes(1);
    setPaginaDevolucoes(1);
  }, [filtros.data_inicio, filtros.data_fim, filtros.setor, filtros.matricula, data]);

  const totalPaginasSolicitacoes = Math.max(1, Math.ceil(solicitacoesFiltradas.length / ITENS_POR_PAGINA));
  const totalPaginasDevolucoes = Math.max(1, Math.ceil(devolucoesFiltradas.length / ITENS_POR_PAGINA));

  const solicitacoesPaginadas = useMemo(() => {
    const inicio = (paginaSolicitacoes - 1) * ITENS_POR_PAGINA;
    return solicitacoesFiltradas.slice(inicio, inicio + ITENS_POR_PAGINA);
  }, [solicitacoesFiltradas, paginaSolicitacoes]);

  const devolucoesPaginadas = useMemo(() => {
    const inicio = (paginaDevolucoes - 1) * ITENS_POR_PAGINA;
    return devolucoesFiltradas.slice(inicio, inicio + ITENS_POR_PAGINA);
  }, [devolucoesFiltradas, paginaDevolucoes]);

  useEffect(() => {
    if (paginaSolicitacoes > totalPaginasSolicitacoes) setPaginaSolicitacoes(totalPaginasSolicitacoes);
  }, [paginaSolicitacoes, totalPaginasSolicitacoes]);

  useEffect(() => {
    if (paginaDevolucoes > totalPaginasDevolucoes) setPaginaDevolucoes(totalPaginasDevolucoes);
  }, [paginaDevolucoes, totalPaginasDevolucoes]);

  const inicioSolicitacoes = solicitacoesFiltradas.length === 0 ? 0 : (paginaSolicitacoes - 1) * ITENS_POR_PAGINA + 1;
  const fimSolicitacoes = Math.min(paginaSolicitacoes * ITENS_POR_PAGINA, solicitacoesFiltradas.length);
  const inicioDevolucoes = devolucoesFiltradas.length === 0 ? 0 : (paginaDevolucoes - 1) * ITENS_POR_PAGINA + 1;
  const fimDevolucoes = Math.min(paginaDevolucoes * ITENS_POR_PAGINA, devolucoesFiltradas.length);

  return (
    <div className="space-y-4">
      <SectionCard
        title="Filtros do Dashboard"
        icon={BarChart3}
        actions={
          <>
            <Button variant="ghost" onClick={limparFiltros} disabled={loading}>
              Limpar filtros
            </Button>
            <Button onClick={exportar} loading={exporting}>
              <Download className="h-4 w-4" />
              Exportar XLSX
            </Button>
          </>
        }
      >
        <div className="grid gap-3 md:grid-cols-4">
          <div className="space-y-1">
            <Label htmlFor="f-data-inicio">Data inicio</Label>
            <Input
              id="f-data-inicio"
              type="date"
              value={filtros.data_inicio}
              onChange={(e) => setFiltros((p) => ({ ...p, data_inicio: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="f-data-fim">Data fim</Label>
            <Input
              id="f-data-fim"
              type="date"
              value={filtros.data_fim}
              onChange={(e) => setFiltros((p) => ({ ...p, data_fim: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="f-setor">Setor</Label>
            <Select
              value={filtros.setor || "todos"}
              onValueChange={(value) => setFiltros((p) => ({ ...p, setor: value === "todos" ? "" : value }))}
            >
              <SelectTrigger id="f-setor">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {opcoes.setores.map((setor) => (
                  <SelectItem key={setor} value={setor}>
                    {setor}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="f-matricula">Funcionario</Label>
            <Select
              value={filtros.matricula || "todos"}
              onValueChange={(value) =>
                setFiltros((p) => ({ ...p, matricula: value === "todos" ? "" : value }))
              }
            >
              <SelectTrigger id="f-matricula">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {opcoes.funcionarios.map((f) => (
                  <SelectItem key={f.matricula} value={f.matricula}>
                    {f.nome} ({f.matricula})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </SectionCard>

      {data ? (
        <>
          <div className="grid gap-3 md:grid-cols-5">
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Emprestimos</p><p className="text-2xl font-semibold">{data.kpis.total_emprestimos}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Devolucoes</p><p className="text-2xl font-semibold">{data.kpis.total_devolucoes}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Itens disponiveis</p><p className="text-2xl font-semibold">{data.kpis.itens_disponiveis}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Itens emprestados</p><p className="text-2xl font-semibold">{data.kpis.itens_emprestados}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Funcionarios ativos</p><p className="text-2xl font-semibold">{data.kpis.funcionarios_ativos}</p></CardContent></Card>
          </div>

          <div className="grid gap-4 2xl:grid-cols-2">
            <SectionCard title={`Solicitacoes (${solicitacoesFiltradas.length})`}>
              <DataTable
                columns={[
                  {
                    key: "timestamp",
                    title: "Data/Hora",
                    align: "center",
                    width: "20%",
                    className: "font-mono tabular-nums",
                  },
                  {
                    key: "matricula",
                    title: "Matricula",
                    align: "center",
                    width: "20%",
                    className: "font-mono tabular-nums",
                  },
                  { key: "nome", title: "Nome", align: "center", width: "20%" },
                  { key: "setor", title: "Setor", align: "center", width: "20%" },
                  { key: "item", title: "Item", align: "center", width: "20%", className: "font-mono tabular-nums" },
                ]}
                rows={solicitacoesPaginadas}
                getRowKey={(row) => row.id}
                loading={loading}
                emptyMessage="Sem solicitacoes para os filtros atuais."
                minWidthClassName="min-w-0"
                containerClassName="overflow-x-hidden"
                emptyCellClassName="py-2.5"
                renderRow={(row) => (
                  <>
                    <td className="max-w-0 truncate" title={new Date(row.timestamp).toLocaleString()}>
                      {new Date(row.timestamp).toLocaleString()}
                    </td>
                    <td className="max-w-0 truncate" title={row.matricula}>{row.matricula}</td>
                    <td className="max-w-0 truncate" title={row.nome_funcionario}>{row.nome_funcionario}</td>
                    <td className="max-w-0 truncate" title={row.setor ?? "-"}>{row.setor ?? "-"}</td>
                    <td className="max-w-0 truncate" title={row.item_codigo}>{row.item_codigo}</td>
                  </>
                )}
              />

              {totalPaginasSolicitacoes > 1 ? (
                <div className="mt-3 flex items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    {inicioSolicitacoes}-{fimSolicitacoes} de {solicitacoesFiltradas.length} . Pagina {paginaSolicitacoes} de {totalPaginasSolicitacoes}
                  </p>
                  <div className="flex min-w-[220px] justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="min-w-24"
                      onClick={() => setPaginaSolicitacoes((p) => Math.max(1, p - 1))}
                      disabled={paginaSolicitacoes === 1}
                    >
                      Anterior
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="min-w-24"
                      onClick={() => setPaginaSolicitacoes((p) => Math.min(totalPaginasSolicitacoes, p + 1))}
                      disabled={paginaSolicitacoes === totalPaginasSolicitacoes}
                    >
                      Proxima
                    </Button>
                  </div>
                </div>
              ) : null}
            </SectionCard>

            <SectionCard title={`Devolucoes (${devolucoesFiltradas.length})`}>
              <DataTable
                columns={[
                  {
                    key: "timestamp",
                    title: "Data/Hora",
                    align: "center",
                    width: "20%",
                    className: "font-mono tabular-nums",
                  },
                  {
                    key: "matricula",
                    title: "Matricula",
                    align: "center",
                    width: "20%",
                    className: "font-mono tabular-nums",
                  },
                  { key: "nome", title: "Nome", align: "center", width: "20%" },
                  { key: "setor", title: "Setor", align: "center", width: "20%" },
                  { key: "item", title: "Item", align: "center", width: "20%", className: "font-mono tabular-nums" },
                ]}
                rows={devolucoesPaginadas}
                getRowKey={(row) => row.id}
                loading={loading}
                emptyMessage="Sem devolucoes para os filtros atuais."
                minWidthClassName="min-w-0"
                containerClassName="overflow-x-hidden"
                emptyCellClassName="py-2.5"
                renderRow={(row) => (
                  <>
                    <td className="max-w-0 truncate" title={new Date(row.timestamp).toLocaleString()}>
                      {new Date(row.timestamp).toLocaleString()}
                    </td>
                    <td className="max-w-0 truncate" title={row.matricula}>{row.matricula}</td>
                    <td className="max-w-0 truncate" title={row.nome_funcionario}>{row.nome_funcionario}</td>
                    <td className="max-w-0 truncate" title={row.setor ?? "-"}>{row.setor ?? "-"}</td>
                    <td className="max-w-0 truncate" title={row.item_codigo}>{row.item_codigo}</td>
                  </>
                )}
              />

              {totalPaginasDevolucoes > 1 ? (
                <div className="mt-3 flex items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    {inicioDevolucoes}-{fimDevolucoes} de {devolucoesFiltradas.length} . Pagina {paginaDevolucoes} de {totalPaginasDevolucoes}
                  </p>
                  <div className="flex min-w-[220px] justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="min-w-24"
                      onClick={() => setPaginaDevolucoes((p) => Math.max(1, p - 1))}
                      disabled={paginaDevolucoes === 1}
                    >
                      Anterior
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="min-w-24"
                      onClick={() => setPaginaDevolucoes((p) => Math.min(totalPaginasDevolucoes, p + 1))}
                      disabled={paginaDevolucoes === totalPaginasDevolucoes}
                    >
                      Proxima
                    </Button>
                  </div>
                </div>
              ) : null}
            </SectionCard>
          </div>
        </>
      ) : null}
    </div>
  );
}
