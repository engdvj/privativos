import ExcelJS from "exceljs";
import { DashboardFiltros, DashboardService } from "./dashboard-service.js";

type TipoMovimentacao = "emprestimo" | "devolucao";

interface MovimentacaoExportRow {
  data_hora: Date | null;
  tipo: string;
  status: string;
  origem: string;
  matricula: string;
  funcionario: string;
  unidade: string;
  setor: string;
  item: string;
  operador: string;
}

interface EntityFocus {
  entidade: string;
  valor: string;
  filtrosAtivos: string[];
}

function origemLabel(origem: string) {
  return origem === "setor" ? "Setor" : "Colaborador";
}

function tipoLabel(tipo: TipoMovimentacao) {
  return tipo === "emprestimo" ? "Empréstimo" : "Devolução";
}

function texto(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function dateFromIso(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateTimePtBr(date: Date | null) {
  if (!date) {
    return "";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(date);
}

function formatPeriodo(filtros: DashboardFiltros) {
  const inicio = filtros.data_inicio?.trim() ?? "";
  const fim = filtros.data_fim?.trim() ?? "";
  if (inicio && fim) {
    return `${inicio} até ${fim}`;
  }
  if (inicio) {
    return `a partir de ${inicio}`;
  }
  if (fim) {
    return `até ${fim}`;
  }
  return "Período completo";
}

export class ExportService {
  private readonly dashboardService = new DashboardService();

  async gerarXlsx(filtros: DashboardFiltros) {
    const data = await this.dashboardService.getData(filtros, { maxRows: null });
    const movimentacoes = this.buildMovimentacoes(data);
    const focus = this.resolveEntityFocus(filtros, movimentacoes);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Privativos";
    workbook.created = new Date();

    const resumo = workbook.addWorksheet("Resumo");
    this.renderResumo(resumo, data, filtros, focus, movimentacoes.length);

    const dados = workbook.addWorksheet("Dados");
    this.renderDados(dados, movimentacoes);

    return workbook.xlsx.writeBuffer();
  }

  private buildMovimentacoes(data: Awaited<ReturnType<DashboardService["getData"]>>) {
    const solicitacoes: MovimentacaoExportRow[] = data.rows.solicitacoes.map((row) => ({
      data_hora: dateFromIso(row.timestamp),
      tipo: tipoLabel("emprestimo"),
      status: "Emprestado",
      origem: origemLabel(row.origem),
      matricula: row.matricula,
      funcionario: texto(row.nome_funcionario),
      unidade: texto(row.unidade),
      setor: texto(row.setor || row.setor_solicitante),
      item: row.item_codigo,
      operador: texto(row.operador_nome),
    }));

    const devolucoes: MovimentacaoExportRow[] = data.rows.devolucoes.map((row) => ({
      data_hora: dateFromIso(row.timestamp),
      tipo: tipoLabel("devolucao"),
      status: "Devolvido",
      origem: origemLabel(row.origem),
      matricula: row.matricula,
      funcionario: texto(row.nome_funcionario),
      unidade: texto(row.unidade),
      setor: texto(row.setor || row.setor_solicitante),
      item: row.item_codigo,
      operador: texto(row.operador_nome),
    }));

    return [...solicitacoes, ...devolucoes].sort((a, b) => {
      const timeA = a.data_hora?.getTime() ?? 0;
      const timeB = b.data_hora?.getTime() ?? 0;
      return timeB - timeA;
    });
  }

  private renderResumo(
    worksheet: ExcelJS.Worksheet,
    data: Awaited<ReturnType<DashboardService["getData"]>>,
    filtros: DashboardFiltros,
    focus: EntityFocus,
    totalMovimentacoes: number,
  ) {
    [22, 22, 22, 22, 22, 22, 22, 22].forEach((width, index) => {
      worksheet.getColumn(index + 1).width = width;
    });

    worksheet.mergeCells("A1:H1");
    const title = worksheet.getCell("A1");
    title.value = "Relatório do Dashboard - Privativos";
    title.font = { size: 16, bold: true, color: { argb: "FFFFFFFF" } };
    title.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF12324F" },
    };
    title.alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getRow(1).height = 30;

    this.renderInfoRow(worksheet, 3, "Entidade foco", `${focus.entidade}: ${focus.valor}`);
    this.renderInfoRow(worksheet, 4, "Período", formatPeriodo(filtros));
    this.renderInfoRow(worksheet, 5, "Gerado em (UTC)", formatDateTimePtBr(dateFromIso(data.gerado_em)));
    this.renderInfoRow(
      worksheet,
      6,
      "Filtros ativos",
      focus.filtrosAtivos.length > 0 ? focus.filtrosAtivos.join(" | ") : "Nenhum",
    );

    this.renderCard(worksheet, "A8:B10", "Total movimentações", totalMovimentacoes, "FF12324F");
    this.renderCard(worksheet, "C8:D10", "Empréstimos", data.kpis.total_emprestimos, "FF1B5E20");
    this.renderCard(worksheet, "E8:F10", "Devoluções", data.kpis.total_devolucoes, "FF004D40");
    this.renderCard(worksheet, "G8:H10", "Itens emprestados", data.kpis.itens_emprestados, "FF4A148C");
  }

  private renderInfoRow(worksheet: ExcelJS.Worksheet, row: number, label: string, value: string) {
    worksheet.mergeCells(`A${row}:C${row}`);
    worksheet.mergeCells(`D${row}:H${row}`);

    const labelCell = worksheet.getCell(`A${row}`);
    labelCell.value = label;
    labelCell.font = { bold: true, color: { argb: "FF12324F" } };
    labelCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFEAF1F8" },
    };

    const valueCell = worksheet.getCell(`D${row}`);
    valueCell.value = value || "-";
    valueCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF8FBFF" },
    };
    valueCell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
  }

  private renderCard(
    worksheet: ExcelJS.Worksheet,
    range: string,
    titulo: string,
    valor: number,
    color: string,
  ) {
    worksheet.mergeCells(range);
    const cell = worksheet.getCell(range.split(":")[0] ?? range);
    cell.value = `${titulo}\n${valor}`;
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.font = { bold: true, size: 13, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: color },
    };
  }

  private renderDados(worksheet: ExcelJS.Worksheet, rows: MovimentacaoExportRow[]) {
    worksheet.columns = [
      { header: "Data/Hora", key: "data_hora", width: 21 },
      { header: "Tipo", key: "tipo", width: 14 },
      { header: "Status", key: "status", width: 14 },
      { header: "Origem", key: "origem", width: 14 },
      { header: "Matrícula", key: "matricula", width: 14 },
      { header: "Funcionário", key: "funcionario", width: 32 },
      { header: "Unidade", key: "unidade", width: 24 },
      { header: "Setor", key: "setor", width: 24 },
      { header: "Item", key: "item", width: 18 },
      { header: "Operador", key: "operador", width: 28 },
    ];
    worksheet.addRows(rows);
    worksheet.getColumn("data_hora").numFmt = "dd/mm/yyyy hh:mm:ss";
    this.styleDataWorksheet(worksheet);
  }

  private resolveEntityFocus(filtros: DashboardFiltros, movimentacoes: MovimentacaoExportRow[]): EntityFocus {
    const filtrosAtivos = this.activeFilterLabels(filtros);

    if (filtros.matricula) {
      const matricula = filtros.matricula.trim();
      const funcionario = movimentacoes.find((row) => row.matricula === matricula)?.funcionario;
      return {
        entidade: "Funcionário",
        valor: funcionario ? `${matricula} - ${funcionario}` : matricula,
        filtrosAtivos,
      };
    }

    if (filtros.setor) {
      return { entidade: "Setor", valor: filtros.setor.trim(), filtrosAtivos };
    }

    if (filtros.unidade) {
      return { entidade: "Unidade", valor: filtros.unidade.trim(), filtrosAtivos };
    }

    if (filtros.origem) {
      return { entidade: "Origem", valor: origemLabel(filtros.origem), filtrosAtivos };
    }

    if (filtros.data_inicio || filtros.data_fim) {
      return { entidade: "Período", valor: formatPeriodo(filtros), filtrosAtivos };
    }

    return {
      entidade: "Visão geral",
      valor: "Sem recorte específico",
      filtrosAtivos,
    };
  }

  private activeFilterLabels(filtros: DashboardFiltros) {
    const labels: string[] = [];
    if (filtros.data_inicio) {
      labels.push(`Data início: ${filtros.data_inicio}`);
    }
    if (filtros.data_fim) {
      labels.push(`Data fim: ${filtros.data_fim}`);
    }
    if (filtros.unidade) {
      labels.push(`Unidade: ${filtros.unidade}`);
    }
    if (filtros.setor) {
      labels.push(`Setor: ${filtros.setor}`);
    }
    if (filtros.matricula) {
      labels.push(`Matrícula: ${filtros.matricula}`);
    }
    if (filtros.origem) {
      labels.push(`Origem: ${origemLabel(filtros.origem)}`);
    }
    return labels;
  }

  private styleDataWorksheet(worksheet: ExcelJS.Worksheet) {
    if (worksheet.columnCount < 1 || worksheet.rowCount < 1) {
      return;
    }

    worksheet.views = [{ state: "frozen", ySplit: 1 }];
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: worksheet.columnCount },
    };

    const header = worksheet.getRow(1);
    header.font = { bold: true };
    header.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE8EEF8" },
      };
      cell.alignment = { vertical: "middle", horizontal: "left" };
    });
  }
}
