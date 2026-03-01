import ExcelJS from "exceljs";
import { DashboardFiltros, DashboardService } from "./dashboard-service.js";

function origemLabel(origem: string) {
  return origem === "setor" ? "Setor" : "Colaborador";
}

export class ExportService {
  private readonly dashboardService = new DashboardService();

  async gerarXlsx(filtros: DashboardFiltros) {
    const data = await this.dashboardService.getData(filtros);
    const totalEmprestimosSetor = data.rows.solicitacoes.filter((row) => row.origem === "setor").length;
    const totalEmprestimosColaborador = data.rows.solicitacoes.length - totalEmprestimosSetor;
    const totalDevolucoesSetor = data.rows.devolucoes.filter((row) => row.origem === "setor").length;
    const totalDevolucoesColaborador = data.rows.devolucoes.length - totalDevolucoesSetor;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Privativos";
    workbook.created = new Date();

    const resumo = workbook.addWorksheet("Resumo");
    resumo.columns = [
      { header: "Indicador", key: "indicador", width: 40 },
      { header: "Valor", key: "valor", width: 20 },
    ];

    resumo.addRows([
      { indicador: "Total de emprestimos", valor: data.kpis.total_emprestimos },
      { indicador: "Emprestimos (colaborador)", valor: totalEmprestimosColaborador },
      { indicador: "Emprestimos (setor)", valor: totalEmprestimosSetor },
      { indicador: "Total de devolucoes", valor: data.kpis.total_devolucoes },
      { indicador: "Devolucoes (colaborador)", valor: totalDevolucoesColaborador },
      { indicador: "Devolucoes (setor)", valor: totalDevolucoesSetor },
      { indicador: "Itens disponiveis", valor: data.kpis.itens_disponiveis },
      { indicador: "Itens emprestados", valor: data.kpis.itens_emprestados },
      { indicador: "Funcionarios ativos", valor: data.kpis.funcionarios_ativos },
      { indicador: "Gerado em", valor: data.gerado_em },
    ]);

    const solicitacoes = workbook.addWorksheet("Solicitacoes");
    solicitacoes.columns = [
      { header: "Timestamp", key: "timestamp", width: 28 },
      { header: "Matricula", key: "matricula", width: 16 },
      { header: "Nome", key: "nome_funcionario", width: 28 },
      { header: "Unidade", key: "unidade", width: 24 },
      { header: "Setor", key: "setor", width: 20 },
      { header: "Origem", key: "origem", width: 16 },
      { header: "Setor solicitante", key: "setor_solicitante", width: 22 },
      { header: "Item", key: "item_codigo", width: 16 },
      { header: "Operador", key: "operador_nome", width: 28 },
    ];

    solicitacoes.addRows(
      data.rows.solicitacoes.map((row) => ({
        ...row,
        timestamp: row.timestamp,
        origem: origemLabel(row.origem),
      })),
    );

    const devolucoes = workbook.addWorksheet("Devolucoes");
    devolucoes.columns = [
      { header: "Timestamp", key: "timestamp", width: 28 },
      { header: "Matricula", key: "matricula", width: 16 },
      { header: "Nome", key: "nome_funcionario", width: 28 },
      { header: "Unidade", key: "unidade", width: 24 },
      { header: "Setor", key: "setor", width: 20 },
      { header: "Origem", key: "origem", width: 16 },
      { header: "Setor solicitante", key: "setor_solicitante", width: 22 },
      { header: "Item", key: "item_codigo", width: 16 },
      { header: "Operador", key: "operador_nome", width: 28 },
    ];

    devolucoes.addRows(
      data.rows.devolucoes.map((row) => ({
        ...row,
        timestamp: row.timestamp,
        origem: origemLabel(row.origem),
      })),
    );

    return workbook.xlsx.writeBuffer();
  }
}
