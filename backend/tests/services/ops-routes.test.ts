import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";

const gerarCodigoMock = vi.fn();

vi.mock("../../src/middleware/auth.js", () => ({
  authenticate: async (request: any) => {
    request.user = { kind: "setor_admin", perfil: "setor", nomeCompleto: "Setor Teste" };
  },
  authorize: () => async () => {},
}));

vi.mock("../../src/services/validation-queue-service.js", () => ({
  ValidationQueueService: class {
    gerarCodigo = gerarCodigoMock;
    consumirCodigo = vi.fn();
    cancelar = vi.fn();
    getPendingByMatricula = vi.fn();
    statusSetor = vi.fn();
    limparOperacao = vi.fn();
    registrarResultado = vi.fn();
  },
}));

vi.mock("../../src/services/loan-service.js", () => ({
  LoanService: class {
    registrarEmprestimo = vi.fn();
  },
}));

vi.mock("../../src/services/return-service.js", () => ({
  ReturnService: class {
    registrarDevolucao = vi.fn();
  },
}));

vi.mock("../../src/lib/prisma.js", () => ({
  prisma: {
    item: { findMany: vi.fn(), count: vi.fn() },
    funcionario: { findFirst: vi.fn() },
    configuracao: { findUnique: vi.fn() },
  },
}));

vi.mock("../../src/sse/sse-manager.js", () => ({
  sseManager: { register: vi.fn(), emit: vi.fn() },
}));

const { opsRoutes } = await import("../../src/routes/ops.js");

describe("opsRoutes", () => {
  it("deve rejeitar gerar-codigo de devolucao sem item_codigos", async () => {
    const app = Fastify();
    await app.register(opsRoutes);

    const response = await app.inject({
      method: "POST",
      url: "/ops/gerar-codigo",
      payload: {
        matricula: "123",
        tipo: "devolucao",
        quantidade: 1,
      },
    });

    expect(response.statusCode).toBe(400);
    expect(gerarCodigoMock).not.toHaveBeenCalled();

    await app.close();
  });
});
