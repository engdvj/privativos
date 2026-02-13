import { beforeEach, describe, expect, it, vi } from "vitest";

const redisMock = {
  exists: vi.fn(),
  set: vi.fn(),
  get: vi.fn(),
  del: vi.fn(),
};

const emitMock = vi.fn();

vi.mock("../../src/lib/redis.js", () => ({
  redis: redisMock,
}));

vi.mock("../../src/sse/sse-manager.js", () => ({
  sseManager: {
    emit: emitMock,
  },
}));

const { ValidationQueueService } = await import("../../src/services/validation-queue-service.js");

describe("ValidationQueueService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deve impedir gerar codigo quando ja existe pendencia", async () => {
    redisMock.exists.mockResolvedValueOnce(1);
    const service = new ValidationQueueService();

    await expect(
      service.gerarCodigo({
        matricula: "123",
        tipo: "emprestimo",
        quantidade: 1,
        operadorNome: "Setor 1",
      }),
    ).rejects.toMatchObject({ code: "PENDING_OPERATION_ALREADY_EXISTS" });
  });

  it("deve gerar e consumir codigo com sucesso", async () => {
    redisMock.exists.mockResolvedValueOnce(0);
    redisMock.set.mockResolvedValue("OK");

    const service = new ValidationQueueService();

    const generated = await service.gerarCodigo({
      matricula: "123",
      tipo: "devolucao",
      quantidade: 2,
      itemCodigos: ["KIT-001", "KIT-001", "KIT-002"],
      operadorNome: "Setor 1",
    });

    expect(generated.codigo).toMatch(/^\d{6}$/);
    expect(emitMock).toHaveBeenCalledWith(
      "123",
      "code_generated",
      expect.objectContaining({
        codigo: generated.codigo,
        tipo: "devolucao",
        quantidade: 2,
        item_codigos: ["KIT-001", "KIT-002"],
      }),
    );

    redisMock.get.mockResolvedValueOnce(
      JSON.stringify({
        codigo: generated.codigo,
        operador_nome: "Setor 1",
        quantidade: 2,
        item_codigos: ["KIT-001", "KIT-002"],
        criado_em: new Date().toISOString(),
      }),
    );

    const consumed = await service.consumirCodigo({
      matricula: "123",
      tipo: "devolucao",
      codigo: generated.codigo,
    });

    expect(consumed.item_codigos).toEqual(["KIT-001", "KIT-002"]);
  });
});
