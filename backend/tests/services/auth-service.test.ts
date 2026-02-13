import { beforeEach, describe, expect, it, vi } from "vitest";

const compareMock = vi.fn();

const prismaMock = {
  credencial: {
    findFirst: vi.fn(),
  },
  funcionario: {
    findFirst: vi.fn(),
  },
};

const redisMock = {
  set: vi.fn(),
  get: vi.fn(),
  del: vi.fn(),
};

vi.mock("bcrypt", () => ({
  default: {
    compare: compareMock,
  },
}));

vi.mock("../../src/lib/prisma.js", () => ({
  prisma: prismaMock,
}));

vi.mock("../../src/lib/redis.js", () => ({
  redis: redisMock,
}));

const { AuthService } = await import("../../src/services/auth-service.js");

describe("AuthService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deve falhar login com credencial invalida", async () => {
    prismaMock.credencial.findFirst.mockResolvedValueOnce(null);
    const service = new AuthService();

    await expect(
      service.login({
        usuario: "u",
        senha: "s",
        perfil: "admin",
      }),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
  });

  it("deve criar sessao de solicitante", async () => {
    prismaMock.funcionario.findFirst.mockResolvedValueOnce({ matricula: "123", nome: "Fulano" });
    redisMock.set.mockResolvedValueOnce("OK");

    const service = new AuthService();
    const data = await service.criarSessaoSolicitante({ matricula: "123" });

    expect(data.matricula).toBe("123");
    expect(data.nome_funcionario).toBe("Fulano");
    expect(redisMock.set).toHaveBeenCalled();
  });
});
