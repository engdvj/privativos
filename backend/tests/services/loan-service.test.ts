import { describe, expect, it, vi } from "vitest";

const prismaMock = {
  funcionario: {
    findFirst: vi.fn(),
  },
  configuracao: {
    findUnique: vi.fn(),
  },
  item: {
    count: vi.fn(),
  },
  $transaction: vi.fn(),
};

vi.mock("../../src/lib/prisma.js", () => ({
  prisma: prismaMock,
}));

vi.mock("../../src/services/dashboard-service.js", () => ({
  DashboardService: class {
    invalidateCache = vi.fn();
  },
}));

const { LoanService } = await import("../../src/services/loan-service.js");

describe("LoanService", () => {
  it("deve bloquear emprestimo quando excede max kits por funcionario", async () => {
    prismaMock.funcionario.findFirst.mockResolvedValueOnce({ nome: "Funcionario 1" });
    prismaMock.configuracao.findUnique.mockResolvedValueOnce({ valor: "2" });
    prismaMock.item.count.mockResolvedValueOnce(2);

    const service = new LoanService();

    await expect(
      service.registrarEmprestimo({
        matricula: "123",
        operadorNome: "Setor",
        quantidade: 1,
      }),
    ).rejects.toMatchObject({ code: "MAX_KITS_REACHED" });
  });
});
