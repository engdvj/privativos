import { describe, expect, it, vi } from "vitest";
import ExcelJS from "exceljs";

const getDataMock = vi.fn();

vi.mock("../../src/services/dashboard-service.js", () => ({
  DashboardService: class {
    getData = getDataMock;
  },
}));

const { ExportService } = await import("../../src/services/export-service.js");

describe("ExportService", () => {
  it("deve gerar xlsx estruturado para analise", async () => {
    getDataMock.mockResolvedValueOnce({
      kpis: {
        total_emprestimos: 1,
        total_devolucoes: 1,
        itens_disponiveis: 10,
        itens_emprestados: 2,
        funcionarios_ativos: 5,
      },
      rows: {
        solicitacoes: [
          {
            id: 10,
            timestamp: "2026-03-02T09:00:00.000Z",
            matricula: "123",
            nome_funcionario: "Funcionario A",
            item_codigo: "KIT-001",
            operador_nome: "Operador 1",
            unidade: "Hospital Central",
            setor: "UTI",
            origem: "colaborador",
            setor_solicitante: null,
          },
        ],
        devolucoes: [
          {
            id: 20,
            timestamp: "2026-03-02T10:00:00.000Z",
            matricula: "123",
            nome_funcionario: "Funcionario A",
            item_codigo: "KIT-001",
            operador_nome: "Operador 2",
            unidade: "Hospital Central",
            setor: "UTI",
            origem: "colaborador",
            setor_solicitante: null,
          },
        ],
      },
      total: 2,
      gerado_em: "2026-03-02T10:30:00.000Z",
    });

    const service = new ExportService();
    const xlsx = await service.gerarXlsx({
      data_inicio: "2026-03-01",
      data_fim: "2026-03-02",
      unidade: "Hospital Central",
    });

    expect(getDataMock).toHaveBeenCalledWith(
      {
        data_inicio: "2026-03-01",
        data_fim: "2026-03-02",
        unidade: "Hospital Central",
      },
      { maxRows: null },
    );

    const workbook = new ExcelJS.Workbook();
    const buffer = Buffer.isBuffer(xlsx) ? xlsx : Buffer.from(xlsx);
    await workbook.xlsx.load(buffer);

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(["Resumo", "Dados"]);

    const resumo = workbook.getWorksheet("Resumo");
    expect(resumo?.getCell("A1").value).toBe("Relatorio do Dashboard - Privativos");
    expect(resumo?.getCell("A3").value).toBe("Entidade foco");
    expect(resumo?.getCell("D3").value).toBe("Unidade: Hospital Central");
    expect(resumo?.getCell("A8").value).toContain("Total movimentacoes");

    const dados = workbook.getWorksheet("Dados");
    expect(dados?.getCell("A1").value).toBe("Data/Hora");
    expect(dados?.getCell("B1").value).toBe("Tipo");
    expect(dados?.getCell("C1").value).toBe("Status");
    expect(dados?.getCell("B2").value).toBe("Devolucao");
    expect(dados?.getCell("B3").value).toBe("Emprestimo");
    expect(dados?.getCell("C2").value).toBe("Devolvido");
    expect(dados?.getCell("C3").value).toBe("Emprestado");
  });
});
